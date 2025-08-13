/**
 * src/services/whatsappFlowBridge.ts
 * 
 * Bridge service que conecta WhatsApp con los flujos modulares de BuilderBot
 * PROPÓSITO: Resolver el problema de navegación automática y asegurar integración correcta
 * 
 * @version 1.0.0
 * @created 2025-08-13
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../utils/logger';
import { getTemplateById } from '../utils/supabaseClient';
import { replaceVariables } from '../utils/variableReplacer';
import { getSystemVariablesForTenant } from '../utils/systemVariablesLoader';
import { processSalesFunnelActions } from './salesFunnelService';
import * as ModularFlows from '../flows/nodes';

/**
 * Interface para datos del template de React Flow
 */
interface TemplateNode {
  id: string;
  type: string;
  data: any;
  position?: { x: number; y: number };
}

interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface TemplateData {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

/**
 * Bridge service principal para WhatsApp + BuilderBot
 */
export class WhatsAppFlowBridge {
  private static instance: WhatsAppFlowBridge;
  private templateCache = new Map<string, TemplateData>();
  
  static getInstance(): WhatsAppFlowBridge {
    if (!WhatsAppFlowBridge.instance) {
      WhatsAppFlowBridge.instance = new WhatsAppFlowBridge();
    }
    return WhatsAppFlowBridge.instance;
  }

  /**
   * Crea el flujo principal que maneja todos los mensajes de WhatsApp
   */
  createMainWhatsAppFlow() {
    return addKeyword(['hola', 'hi', 'hello', 'inicio', 'start'])
      .addAction(async (ctx, { state, flowDynamic, gotoFlow }) => {
        try {
          logger.info(`[WhatsAppBridge] Mensaje recibido de ${ctx.from}: "${ctx.body}"`);
          
          // Determinar tenant basado en el número de teléfono o contexto
          const tenantId = await this.determineTenantId(ctx);
          if (!tenantId) {
            await flowDynamic(['No se pudo determinar la configuración. Contacta soporte.']);
            return;
          }

          // Cargar template activo para el tenant
          const templateData = await this.loadActiveTemplate(tenantId);
          if (!templateData) {
            await flowDynamic(['¡Hola! Bienvenido a nuestro chatbot. ¿En qué puedo ayudarte?']);
            return;
          }

          // Inicializar estado global
          const initialState = await this.initializeState(ctx, tenantId, templateData);
          await state.update(initialState);

          // Determinar nodo inicial
          const initialNode = this.findInitialNode(templateData);
          if (!initialNode) {
            await flowDynamic(['Error al cargar la configuración. Contacta soporte.']);
            return;
          }

          // Procesar el nodo inicial
          await this.processNode(initialNode, templateData, initialState, { flowDynamic, gotoFlow, ctx, state });

        } catch (error) {
          logger.error(`[WhatsAppBridge] Error en flujo principal:`, error);
          await flowDynamic(['Ocurrió un error. Por favor intenta nuevamente.']);
        }
      })
      .addAnswer('', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow }) => {
        try {
          const currentState = state.getMyState() || {};
          const tenantId = currentState.tenantId;
          
          if (!tenantId) {
            await flowDynamic(['Error de sesión. Por favor reinicia la conversación con "hola".']);
            return;
          }

          // Cargar template
          const templateData = await this.loadActiveTemplate(tenantId);
          if (!templateData) {
            await flowDynamic(['Error de configuración. Contacta soporte.']);
            return;
          }

          // Actualizar estado con nueva respuesta del usuario
          currentState.lastUserMessage = ctx.body;

          // Procesar respuesta del usuario
          await this.processUserResponse(ctx.body, currentState, templateData, { flowDynamic, gotoFlow, ctx, state });

        } catch (error) {
          logger.error(`[WhatsAppBridge] Error procesando respuesta:`, error);
          await flowDynamic(['Ocurrió un error procesando tu respuesta.']);
        }
      });
  }

  /**
   * Determina el tenant basado en el contexto de WhatsApp
   */
  private async determineTenantId(ctx: any): Promise<string | null> {
    // Lógica para determinar tenant - puede ser basado en número de teléfono, metadata, etc.
    // Por ahora, usamos un tenant por defecto o extraemos de ctx._metadata
    const tenantId = ctx._metadata?.tenantId || process.env.DEFAULT_TENANT_ID || 'default-tenant';
    
    logger.debug(`[WhatsAppBridge] Tenant determinado: ${tenantId}`);
    return tenantId;
  }

  /**
   * Carga el template activo para un tenant
   */
  private async loadActiveTemplate(tenantId: string): Promise<TemplateData | null> {
    try {
      // Verificar cache
      if (this.templateCache.has(tenantId)) {
        logger.debug(`[WhatsAppBridge] Template cargado desde cache para tenant ${tenantId}`);
        return this.templateCache.get(tenantId)!;
      }

      // TODO: Implementar carga desde Supabase
      // const activeTemplate = await getActiveTemplateForTenant(tenantId);
      
      // Por ahora, crear un template básico
      const basicTemplate: TemplateData = {
        nodes: [
          {
            id: 'welcome-message',
            type: 'messageNode',
            data: {
              message: '¡Hola! Bienvenido a {{company_name}}. ¿En qué puedo ayudarte?',
              waitForResponse: false
            }
          },
          {
            id: 'options-menu',
            type: 'buttonsNode',
            data: {
              message: 'Selecciona una opción:',
              buttons: [
                { id: 'info', text: 'Información', value: 'info' },
                { id: 'contact', text: 'Contacto', value: 'contact' }
              ]
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'welcome-message',
            target: 'options-menu'
          }
        ]
      };

      // Guardar en cache
      this.templateCache.set(tenantId, basicTemplate);
      logger.info(`[WhatsAppBridge] Template básico creado para tenant ${tenantId}`);

      return basicTemplate;

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error cargando template para tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Inicializa el estado de la conversación
   */
  private async initializeState(ctx: any, tenantId: string, templateData: TemplateData) {
    try {
      // Cargar variables del sistema
      const systemVariables = await getSystemVariablesForTenant(tenantId);
      
      const initialState = {
        tenantId,
        templateData,
        currentNodeId: null,
        nodeData: null,
        globalVars: {
          ...systemVariables,
          userId: ctx.from,
          startTime: new Date().toISOString()
        },
        conversationHistory: [],
        awaitingResponse: false,
        metadata: {
          sessionId: `session-${ctx.from}-${Date.now()}`,
          startTime: Date.now()
        }
      };

      logger.debug(`[WhatsAppBridge] Estado inicializado para usuario ${ctx.from}`);
      return initialState;

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error inicializando estado:`, error);
      throw error;
    }
  }

  /**
   * Encuentra el nodo inicial del template
   */
  private findInitialNode(templateData: TemplateData): TemplateNode | null {
    // Buscar nodos sin edges entrantes (nodos iniciales)
    const targetNodeIds = new Set(templateData.edges.map(edge => edge.target));
    const initialNodes = templateData.nodes.filter(node => !targetNodeIds.has(node.id));
    
    if (initialNodes.length > 0) {
      logger.debug(`[WhatsAppBridge] Nodo inicial encontrado: ${initialNodes[0].id}`);
      return initialNodes[0];
    }

    // Fallback: usar el primer nodo
    if (templateData.nodes.length > 0) {
      logger.warn(`[WhatsAppBridge] Usando primer nodo como inicial: ${templateData.nodes[0].id}`);
      return templateData.nodes[0];
    }

    logger.error(`[WhatsAppBridge] No se encontró nodo inicial`);
    return null;
  }

  /**
   * Procesa un nodo específico
   */
  private async processNode(
    node: TemplateNode, 
    templateData: TemplateData, 
    currentState: any,
    builderBotContext: any
  ) {
    try {
      logger.info(`[WhatsAppBridge] Procesando nodo: ${node.id} (${node.type})`);

      // Actualizar estado con nodo actual
      currentState.currentNodeId = node.id;
      currentState.nodeData = node;
      await builderBotContext.state.update(currentState);

      // Procesar según tipo de nodo
      switch (node.type.toLowerCase()) {
        case 'messagenode':
        case 'message':
          await this.processMessageNode(node, templateData, currentState, builderBotContext);
          break;

        case 'buttonsnode':
        case 'buttons':
          await this.processButtonsNode(node, templateData, currentState, builderBotContext);
          break;

        case 'inputnode':
        case 'input':
          await this.processInputNode(node, templateData, currentState, builderBotContext);
          break;

        default:
          logger.warn(`[WhatsAppBridge] Tipo de nodo no soportado: ${node.type}`);
          await builderBotContext.flowDynamic(['Tipo de nodo no soportado.']);
      }

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error procesando nodo ${node.id}:`, error);
      await builderBotContext.flowDynamic(['Error procesando nodo.']);
    }
  }

  /**
   * Procesa nodo de mensaje
   */
  private async processMessageNode(
    node: TemplateNode,
    templateData: TemplateData,
    currentState: any,
    builderBotContext: any
  ) {
    try {
      // Obtener mensaje del nodo
      let message = node.data?.message || 'Mensaje sin contenido';

      // Reemplazar variables
      message = replaceVariables(message, currentState.globalVars);

      // Enviar mensaje
      await builderBotContext.flowDynamic([message]);

      // Procesar sales funnel si aplica
      if (node.data?.salesStageId) {
        await processSalesFunnelActions(node, currentState);
      }

      // NAVEGACIÓN AUTOMÁTICA para nodos que no esperan respuesta
      if (!node.data?.waitForResponse) {
        logger.info(`[WhatsAppBridge] Nodo ${node.id} no espera respuesta, navegando automáticamente`);
        
        // Buscar siguiente nodo
        const nextEdge = templateData.edges.find(edge => edge.source === node.id);
        if (nextEdge) {
          const nextNode = templateData.nodes.find(n => n.id === nextEdge.target);
          if (nextNode) {
            // SOLUCIÓN: Usar setTimeout para navegación automática dentro del contexto de BuilderBot
            setTimeout(async () => {
              await this.processNode(nextNode, templateData, currentState, builderBotContext);
            }, 100);
          }
        }
      }

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error en processMessageNode:`, error);
      throw error;
    }
  }

  /**
   * Procesa nodo de botones
   */
  private async processButtonsNode(
    node: TemplateNode,
    templateData: TemplateData,
    currentState: any,
    builderBotContext: any
  ) {
    try {
      const message = node.data?.message || 'Selecciona una opción:';
      const buttons = node.data?.buttons || [];

      // Preparar mensaje con opciones
      let fullMessage = replaceVariables(message, currentState.globalVars);
      
      if (buttons.length > 0) {
        fullMessage += '\n\n';
        buttons.forEach((button, index) => {
          fullMessage += `${index + 1}. ${button.text}\n`;
        });
      }

      // Enviar mensaje
      await builderBotContext.flowDynamic([fullMessage]);

      // Actualizar estado para esperar respuesta
      currentState.awaitingResponse = true;
      currentState.awaitingButtonSelection = true;
      currentState.buttonOptions = buttons;
      await builderBotContext.state.update(currentState);

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error en processButtonsNode:`, error);
      throw error;
    }
  }

  /**
   * Procesa nodo de input
   */
  private async processInputNode(
    node: TemplateNode,
    templateData: TemplateData,
    currentState: any,
    builderBotContext: any
  ) {
    try {
      const question = node.data?.question || '¿Puedes proporcionar más información?';
      const variableName = node.data?.variableName;

      // Preparar pregunta
      const processedQuestion = replaceVariables(question, currentState.globalVars);

      // Enviar pregunta
      await builderBotContext.flowDynamic([processedQuestion]);

      // Actualizar estado para esperar respuesta
      currentState.awaitingResponse = true;
      currentState.expectedVariable = variableName;
      await builderBotContext.state.update(currentState);

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error en processInputNode:`, error);
      throw error;
    }
  }

  /**
   * Procesa la respuesta del usuario
   */
  private async processUserResponse(
    userMessage: string,
    currentState: any,
    templateData: TemplateData,
    builderBotContext: any
  ) {
    try {
      logger.info(`[WhatsAppBridge] Procesando respuesta: "${userMessage}"`);

      // Si estamos esperando selección de botón
      if (currentState.awaitingButtonSelection) {
        await this.handleButtonSelection(userMessage, currentState, templateData, builderBotContext);
        return;
      }

      // Si estamos esperando input para variable
      if (currentState.expectedVariable) {
        await this.handleVariableInput(userMessage, currentState, templateData, builderBotContext);
        return;
      }

      // Si no estamos esperando nada específico, procesar como mensaje general
      await builderBotContext.flowDynamic(['No esperaba una respuesta en este momento.']);

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error procesando respuesta del usuario:`, error);
      await builderBotContext.flowDynamic(['Error procesando tu respuesta.']);
    }
  }

  /**
   * Maneja la selección de botones
   */
  private async handleButtonSelection(
    userMessage: string,
    currentState: any,
    templateData: TemplateData,
    builderBotContext: any
  ) {
    try {
      const buttons = currentState.buttonOptions || [];
      let selectedButton = null;
      let selectedIndex = -1;

      // Buscar selección por número
      const numMatch = userMessage.match(/^(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > 0 && num <= buttons.length) {
          selectedIndex = num - 1;
          selectedButton = buttons[selectedIndex];
        }
      }

      // Buscar por texto si no encontró por número
      if (!selectedButton) {
        const normalizedInput = userMessage.toLowerCase().trim();
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          if (button.text.toLowerCase().includes(normalizedInput) ||
              button.value?.toLowerCase().includes(normalizedInput)) {
            selectedButton = button;
            selectedIndex = i;
            break;
          }
        }
      }

      if (selectedButton) {
        logger.info(`[WhatsAppBridge] Botón seleccionado: ${selectedButton.text}`);

        // Guardar selección en variables globales
        currentState.globalVars.lastButtonSelection = selectedButton.value || selectedButton.text;

        // Buscar siguiente nodo basado en la selección
        const currentNode = templateData.nodes.find(n => n.id === currentState.currentNodeId);
        if (currentNode) {
          const edges = templateData.edges.filter(edge => edge.source === currentNode.id);
          
          // Si hay edge específico para este botón
          let targetEdge = edges.find(edge => edge.sourceHandle === `handle-${selectedIndex}`);
          if (!targetEdge && edges.length > selectedIndex) {
            targetEdge = edges[selectedIndex];
          }
          if (!targetEdge && edges.length > 0) {
            targetEdge = edges[0]; // Fallback a primer edge
          }

          if (targetEdge) {
            const nextNode = templateData.nodes.find(n => n.id === targetEdge.target);
            if (nextNode) {
              // Limpiar estado de botones
              currentState.awaitingResponse = false;
              currentState.awaitingButtonSelection = false;
              currentState.buttonOptions = null;
              
              // Procesar siguiente nodo
              await this.processNode(nextNode, templateData, currentState, builderBotContext);
              return;
            }
          }
        }

        await builderBotContext.flowDynamic(['Selección procesada, pero no se encontró siguiente paso.']);
      } else {
        await builderBotContext.flowDynamic(['Selección no válida. Por favor elige un número del 1 al ' + buttons.length]);
      }

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error en handleButtonSelection:`, error);
      await builderBotContext.flowDynamic(['Error procesando selección.']);
    }
  }

  /**
   * Maneja input de variables
   */
  private async handleVariableInput(
    userMessage: string,
    currentState: any,
    templateData: TemplateData,
    builderBotContext: any
  ) {
    try {
      const variableName = currentState.expectedVariable;
      
      // Guardar valor en variables globales
      currentState.globalVars[variableName] = userMessage;
      logger.info(`[WhatsAppBridge] Variable ${variableName} = "${userMessage}"`);

      // Limpiar estado de espera
      currentState.awaitingResponse = false;
      currentState.expectedVariable = null;

      // Buscar siguiente nodo
      const currentNode = templateData.nodes.find(n => n.id === currentState.currentNodeId);
      if (currentNode) {
        const nextEdge = templateData.edges.find(edge => edge.source === currentNode.id);
        if (nextEdge) {
          const nextNode = templateData.nodes.find(n => n.id === nextEdge.target);
          if (nextNode) {
            await this.processNode(nextNode, templateData, currentState, builderBotContext);
            return;
          }
        }
      }

      await builderBotContext.flowDynamic(['Información guardada correctamente.']);

    } catch (error) {
      logger.error(`[WhatsAppBridge] Error en handleVariableInput:`, error);
      await builderBotContext.flowDynamic(['Error guardando información.']);
    }
  }

  /**
   * Limpia la cache de templates
   */
  clearCache(tenantId?: string) {
    if (tenantId) {
      this.templateCache.delete(tenantId);
      logger.debug(`[WhatsAppBridge] Cache limpiado para tenant ${tenantId}`);
    } else {
      this.templateCache.clear();
      logger.debug(`[WhatsAppBridge] Cache completamente limpiado`);
    }
  }
}

export default WhatsAppFlowBridge;