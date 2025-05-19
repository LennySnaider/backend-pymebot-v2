/**
 * Sistema de gestión de flujos para builderbot
 * Maneja el registro y procesamiento de flujos dinámicos
 */

import { v4 as uuidv4 } from "uuid";
import { Bot } from "../types/bot";
import { saveConversationState, getConversationState } from "./conversationState";
import logger from "../utils/logger";
import { convertTemplateToBuilderbotFlow } from "./templateConverter";
import { processMessageWithIntent } from "./intentProcessor";
import { replaceVariables } from "../utils/variableReplacer";
import { getOrCreateSessionBot } from './flowRegistryPatch';
import { setCurrentSession, getSessionVariables } from './flowRegistryVariablePatch';
import { dequeueMessages, hasMessages } from './buttonNavigationQueue';
import { setSessionContext } from './sessionContext';
import * as systemVariablesLoader from '../utils/systemVariablesLoader';
import { findLeadByPhone, createLeadIfNotExists } from "./leadLookupService";
import { processSalesFunnelActions } from "./salesFunnelService";
import { getSessionStage } from "./flowRegistrySalesFix";

// Estado local para flujos persistentes entre mensajes
interface ExtendedFlowState {
  flowId: string;
  currentNodeId: string;
  history: Array<{
    timestamp: string;
    message: string;
    from: string;
    nodeId?: string;
  }>;
  tenantId: string;
  userId: string;
  variables: Record<string, any>;
  sessionStarted: Date;
  lastActivity: Date;
  metadata: {
    templateId?: string;
    templateType?: string;
    version?: string;
  };
  data: Record<string, any>;
  startedAt: Date;
  lastUpdatedAt: Date;
  sessionId: string;
  context: Record<string, any>;
}

const _localFlowStates: Record<string, ExtendedFlowState> = {};

// Tipos para compatibilidad con builderbot
export interface FlowAdapter {
  handleMsg: (ctx: { from: string; body: string }) => Promise<any>;
  flows?: any[];
}

// Verificar y actualizar imports
interface TFlow {
  id: number;
  ctx: string;
  ref: (provider: any, state: any) => void;
  endFlow: boolean;
  keyword: string[];
  answer: string;
  options?: any;
  json?: any;
  gotoFlow?: string;
  skipMiddlewares: boolean;
  childFlow?: TFlow[];
  fromFlow?: TFlow;
  flowSerialize?: any;
  resSerialize?: any;
  callbacks: Array<(ctx: any, options: any) => Promise<void>>;
}

// Flujo especial para captura de leads con fallback
const leadCaptureFlow = async (): Promise<FlowAdapter | null> => {
  try {
    // Intentar cargar el flujo lead-capture
    const leadModule = await import("../flows/lead-capture.flow");
    
    if (leadModule.default) {
      logger.info("Flujo lead-capture cargado exitosamente");
      return leadModule.default;
    }
    
    logger.warn("Módulo lead-capture no tiene export default, creando adaptador genérico");
    
    // Intentamos crear un adaptador genérico
    return {
      handleMsg: async (ctx: { from: string; body: string }) => {
        logger.warn("handleMsg genérico llamado - el flujo puede no funcionar correctamente");
        return {
          answer: "Lo siento, no puedo procesar tu mensaje en este momento.",
          media: [],
          buttons: [],
          delay: 0
        };
      },
      flows: []
    };
  } catch (error) {
    logger.error("Error al cargar flujo lead-capture:", error);
    return null;
  }
};

// Función helper para crear un adaptador de flujo
function createFlowAdapter(flowClass: any, flows: TFlow[]): FlowAdapter {
  return {
    handleMsg: async (ctx: { from: string; body: string }) => {
      // Implementación básica de handleMsg usando los flujos
      // Esta es una simulación simple del procesamiento de flujos
      return {
        answer: [{ body: "Procesando mensaje..." }]
      };
    },
    flows
  };
}

// Almacén central para flujos
export class FlowRegistry {
  private static flows: Map<string, any> = new Map();  // Cambiar a any para soportar FlowClass
  private static templates: Map<string, any> = new Map();
  private static bots: Map<string, any> = new Map();

  static async initialize() {
    logger.info("Iniciando FlowRegistry");
    
    // Registrar flujos predefinidos
    await this.registerPredefinedFlows();
    
    logger.info("FlowRegistry inicializado con éxito");
  }

  private static async registerPredefinedFlows() {
    try {
      // Flujo principal de captura de leads
      const leadFlow = await leadCaptureFlow(); 
      if (leadFlow) {
        logger.info("Flujo 'lead-capture' cargado, creando adaptador...");
        
        // Registrar el flujo completo
        this.flows.set('lead-capture', leadFlow);
        logger.info("Flujo 'lead-capture' registrado");
      } else {
        logger.error("No se pudo cargar el flujo 'lead-capture'");
      }
      
      // Comentado: el flujo test-simple ya no existe
      /*
      try {
        const testModule = await import("../flows/test-simple.flow");
        if (testModule.default) {
          this.flows.set('test-simple', testModule.default);
          logger.info("Flujo 'test-simple' registrado");
        }
      } catch (error) {
        logger.error("Error al cargar flujo test-simple:", error);
      }
      */

      logger.info(`Total de flujos registrados: ${this.flows.size}`);
    } catch (error) {
      logger.error("Error al registrar flujos predefinidos:", error);
    }
  }

  /**
   * Registra una plantilla manualmente
   */
  static registerTemplate(id: string, template: any) {
    this.templates.set(id, template);
    logger.info(`Plantilla '${id}' registrada en FlowRegistry`);
  }

  /**
   * Registra un flujo de BuilderBot
   */
  static registerFlow(id: string, flow: any) {
    this.flows.set(id, flow);
    logger.info(`Flujo '${id}' registrado en FlowRegistry`);
  }

  /**
   * Obtiene un flujo por su ID
   */
  static getFlow(id: string): any {
    return this.flows.get(id);
  }
  
  /**
   * Crea un bot temporal para procesar un mensaje específico
   */
  static async createTemporaryBot(flowId: string, userId: string, tenantId: string, sessionId: string): Promise<{ bot: any; provider: any }> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flujo ${flowId} no encontrado`);
    }
    
    try {
      const { createBot, MemoryDB } = await import("@builderbot/bot");
      const { WebProvider } = await import("../provider/webProvider");
      
      // Debug logging para ver la estructura del flujo
      logger.info(`[createTemporaryBot] Creando bot para flujo ${flowId}`);
      logger.info(`[createTemporaryBot] Tipo de flujo: ${typeof flow}`);
      logger.info(`[createTemporaryBot] Propiedades del flujo:`, Object.keys(flow));
      
      // Verificar si el flujo tiene la estructura esperada de BuilderBot
      if (flow.flowRaw && flow.allCallbacks && flow.flowSerialize) {
        logger.info(`[createTemporaryBot] Flujo tiene estructura completa de BuilderBot`);
      } else {
        logger.warn(`[createTemporaryBot] Flujo puede no tener estructura completa de BuilderBot`);
      }
      
      // Crear un provider específico para este usuario con sessionId
      const provider = new WebProvider(userId, tenantId, sessionId);
      const database = new MemoryDB();
      
      // Parchear el método findSerializeByKeyword si está roto
      if (flow.findSerializeByKeyword && flow.flowSerialize) {
        flow.findSerializeByKeyword = function(keyword: string) {
          const result = this.flowSerialize?.find((item: any) => {
            if (Array.isArray(item.keyword)) {
              return item.keyword.some((kw: string) => kw.toLowerCase() === keyword.toLowerCase());
            }
            return false;
          });
          return result;
        };
      }
      
      // Si el flujo es un FlowClass, BuilderBot lo usa directamente
      const bot = await createBot({
        flow: flow,
        provider: provider,
        database: database
      });
      
      logger.info(`[createTemporaryBot] Bot creado exitosamente`);
      
      return { bot, provider };
    } catch (error) {
      logger.error(`Error creando bot temporal para flujo ${flowId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene o crea un flujo basado en una plantilla
   */
  static async getOrCreateFlowFromTemplate(
    tenantId: string,
    templateId: string,
    templateName?: string
  ): Promise<FlowAdapter | null> {
    const cacheKey = `${tenantId}-${templateId}`;
    
    // Intentar obtener del caché primero
    const cachedFlow = this.flows.get(cacheKey);
    if (cachedFlow) {
      logger.info(`Flujo encontrado en caché: ${cacheKey}`);
      return cachedFlow;
    }

    try {
      // Convertir plantilla a flujo de BuilderBot
      logger.info(`Generando flujo desde plantilla: ${templateId} para tenant: ${tenantId}`);
      const builderbotFlow = await convertTemplateToBuilderbotFlow(
        templateId,
        tenantId
      );

      if (builderbotFlow && builderbotFlow.flow) {
        // Asegurar que sea el FlowClass completo
        const flowAdapter = builderbotFlow.flow;
        
        logger.info(`Flujo creado para plantilla ${templateId}`, {
          hasFlowRaw: !!flowAdapter?.flowRaw,
          hasAllCallbacks: !!flowAdapter?.allCallbacks,
          hasFlowSerialize: !!flowAdapter?.flowSerialize,
          hasFindBySerialize: typeof flowAdapter?.findBySerialize === 'function'
        });

        // Guardar en caché
        this.flows.set(cacheKey, flowAdapter);
        logger.info(`Flujo generado y cacheado: ${cacheKey}`);
        
        return flowAdapter;
      }
    } catch (error) {
      logger.error(`Error al generar flujo desde plantilla ${templateId}:`, error);
    }

    return null;
  }

  /**
   * Limpia el caché de flujos
   */
  static clearCache() {
    this.flows.clear();
    this.templates.clear();
    logger.info("Caché de flujos limpiado");
  }

  /**
   * Lista todos los flujos registrados
   */
  static listFlows(): string[] {
    return Array.from(this.flows.keys());
  }
}

// Registrar desde función externa (para compatibilidad con código existente)
export function registerNewTemplate(templateId: string, flow: any) {
  try {
    logger.info(`Registrando nueva plantilla: ${templateId}`);
    
    // Verificar que el flujo sea válido
    if (!flow || typeof flow !== 'object') {
      logger.error(`Plantilla ${templateId} inválida`);
      return;
    }

    // Si el flow tiene handleMsg, lo registramos como flujo
    if (typeof flow.handleMsg === 'function') {
      FlowRegistry.registerFlow(templateId, flow as FlowAdapter);
    } else {
      // De lo contrario, lo registramos como plantilla
      FlowRegistry.registerTemplate(templateId, flow);
    }

    logger.info(`Plantilla ${templateId} registrada exitosamente`);
  } catch (error) {
    logger.error(`Error al registrar plantilla ${templateId}:`, error);
  }
}

// Obtener instancia del bot para un tenant y plantilla específicos
export async function getBotInstance(tenantId: string, templateId: string, sessionId?: string) {
  return FlowRegistry.createTemporaryBot(templateId, uuidv4(), tenantId, sessionId || uuidv4());
}

// Función principal unificada para procesar mensajes con flujos
export async function processFlowMessage(
  phoneFrom: string,
  messageBody: string,
  tenantId: string,
  sessionId: string,
  templateId: string | null,
  options?: {
    provider?: any;
    shouldClearState?: boolean;
    initialData?: Record<string, any>;
  }
): Promise<any> {
  try {
    const stateKey = `${tenantId}:${phoneFrom}`;
    logger.info(`[flowRegistry] Procesando mensaje desde ${phoneFrom}: "${messageBody}"`);
    
    // Verificar si debemos usar un flujo existente o crear uno nuevo
    let state = _localFlowStates[stateKey] || null;
    
    if (!state || options?.shouldClearState) {
      // Intentar cargar estado existente
      const savedState = await getConversationState(tenantId, phoneFrom, sessionId);
      
      if (savedState && savedState.data && typeof savedState.data === 'object') {
        state = {
          ...savedState.data,
          flowId: savedState.data.flowId || 'lead-capture',
          currentNodeId: savedState.data.currentNodeId || 'start',
          history: savedState.data.history || [],
          metadata: savedState.data.metadata || {},
          tenantId,
          userId: phoneFrom,
          variables: savedState.data.variables || {},
          data: savedState.data.data || {},
          startedAt: savedState.data.startedAt || new Date(),
          lastUpdatedAt: new Date(),
          lastActivity: new Date(),
          sessionStarted: savedState.data.sessionStarted || new Date(),
          sessionId,
          context: savedState.data.context || {}
        } as ExtendedFlowState;
      } else {
        // Crear nuevo estado
        state = {
          flowId: templateId || 'lead-capture',
          currentNodeId: 'start',
          history: [],
          metadata: {
            templateId: templateId || null,
            templateType: templateId ? 'template' : 'predefined',
            version: '1.0.0'
          },
          tenantId,
          userId: phoneFrom,
          variables: {},
          data: {},
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
          sessionId,
          context: {}
        } as ExtendedFlowState;
      }
    }

    // Asegurar que el estado tenga las propiedades requeridas
    if (!state.flowId) {
      state.flowId = 'lead-capture';
    }

    // Asegurar que tenemos un contexto
    if (!state.context) {
      state.context = {};
    }
    
    // Asegurar que el tenantId esté en el estado para procesamiento del sales funnel
    if (!state.tenantId && tenantId) {
      state.tenantId = tenantId;
    }
    
    // También añadirlo al contexto para compatibilidad
    if (!state.context.tenantId && tenantId) {
      state.context.tenantId = tenantId;
    }

    // Buscar o crear lead para este número de teléfono
    try {
      let leadId = state.context.leadId || state.context.lead_id;
      
      if (!leadId) {
        // Si el phoneFrom es un lead ID (formato lead_XXXX), usarlo directamente
        if (phoneFrom.startsWith('lead_')) {
          leadId = phoneFrom.replace('lead_', '');
          logger.info(`Usando lead ID existente desde identificador: ${leadId}`);
        } else {
          // Solo buscar/crear lead si es un número de teléfono real
          const phonePattern = /^\+?\d{10,}$/; // Patrón simple para números de teléfono
          if (phonePattern.test(phoneFrom.replace(/[\s-()]/g, ''))) {
            // Buscar lead existente por teléfono
            leadId = await findLeadByPhone(phoneFrom, tenantId);
            
            if (!leadId) {
              // Crear nuevo lead si no existe
              logger.info(`Creando nuevo lead para teléfono ${phoneFrom}`);
              leadId = await createLeadIfNotExists(phoneFrom, tenantId, {
                source: 'chatbot',
                name: state.variables?.nombre_usuario || undefined
              });
            }
          } else {
            logger.warn(`phoneFrom "${phoneFrom}" no es un número de teléfono válido, no se creará lead`);
          }
        }
        
        if (leadId) {
          // Guardar leadId en el contexto
          state.context.leadId = leadId;
          state.context.lead_id = leadId; // Guardar en ambos formatos para compatibilidad
          logger.info(`Lead asociado a la conversación: ${leadId}`);
        }
      }
    } catch (error) {
      logger.error(`Error al buscar/crear lead: ${error}`);
      // Continuar sin lead ID
    }

    // Guardar en caché local
    _localFlowStates[stateKey] = state as ExtendedFlowState;

    // Obtener flujo correspondiente
    // Si el flowId es una plantilla (UUID), primero intentamos cargar o crear el flujo
    const flowId = state.flowId;
    
    // Si es un UUID de plantilla y no es un flujo predefinido, intentamos cargar primero
    const builtinFlows = ['lead-capture', 'flujo-basico-lead'];
    let actualFlowId = flowId;
    
    if (!builtinFlows.includes(flowId) && flowId.includes('-')) {
      // Es un UUID, intentar cargar como plantilla con sessionId
      const flowAdapter = await FlowRegistry.getOrCreateFlowFromTemplate(tenantId, flowId);
      if (flowAdapter) {
        FlowRegistry.registerFlow(flowId, flowAdapter);
        logger.info(`Plantilla ${flowId} cargada y registrada`);
      } else {
        logger.warn(`No se pudo cargar plantilla ${flowId}, usando lead-capture como fallback`);
        actualFlowId = 'lead-capture';
        // Actualizar el estado para usar el flow por defecto
        state.flowId = actualFlowId;
      }
    }
    
    // Obtener o crear bot para esta sesión
    const { bot, provider } = await getOrCreateSessionBot(actualFlowId, phoneFrom, tenantId, sessionId);
    if (!bot) {
      throw new Error(`No se pudo crear bot para flujo ${actualFlowId}`);
    }
    
    // Guardar contexto de sesión para acceso en callbacks
    setSessionContext(phoneFrom, { tenantId, sessionId, templateId });

    // Limpiar mensajes anteriores del provider
    provider.queuedMessages = [];
    // Limpiar metadatos anteriores
    provider.messageMetadata = {};
    
    // Procesar el mensaje con el bot
    try {
      logger.info(`[flowRegistry] Enviando mensaje al bot: "${messageBody}"`);
      
      // Establecer la sesión actual para captura de variables
      setCurrentSession(sessionId);
      
      // Si tenemos un provider pasado como opción, usarlo para capturar las respuestas
      const currentProvider = options?.provider || provider;
      
      // Asegurar que el mensaje se envíe con el formato correcto
      const ctx = {
        from: phoneFrom,
        body: messageBody,
        name: phoneFrom
      };
      
      // Para capturar los mensajes enviados por el bot, necesitamos interceptar el sendMessage
      const originalSendMessage = provider.sendMessage.bind(provider);
      const interceptedMessages: any[] = [];
      
      // Interceptar los mensajes enviados
      provider.sendMessage = async (userId: string, message: any, options?: any) => {
        logger.info(`[flowRegistry] Interceptado sendMessage`);
        logger.info(`[flowRegistry] userId:`, userId);
        logger.info(`[flowRegistry] mensaje:`, JSON.stringify(message));
        logger.info(`[flowRegistry] tipo de mensaje:`, typeof message);
        logger.info(`[flowRegistry] options:`, JSON.stringify(options));
        
        // Si el mensaje es un objeto (puede contener body y buttons)
        if (typeof message === 'object' && message !== null) {
          logger.info(`[flowRegistry] Mensaje es un objeto, extrayendo componentes...`);
          logger.info(`[flowRegistry] Keys del mensaje:`, Object.keys(message));
          logger.info(`[flowRegistry] message.body:`, message.body);
          logger.info(`[flowRegistry] message.buttons:`, JSON.stringify(message.buttons));
          
          // Reemplazar variables si hay body
          if (message.body) {
            const capturedVariables = getSessionVariables(sessionId);
            
            // Obtener variables del sistema del tenant
            let systemVars = {};
            try {
              systemVars = await systemVariablesLoader.getSystemVariablesForTenant(state.tenantId);
              logger.info(`[flowRegistry] Variables del sistema para tenant ${state.tenantId}:`, systemVars);
            } catch (error) {
              logger.error(`[flowRegistry] Error al obtener variables del sistema:`, error);
            }
            
            const mergedVariables = { ...state.variables, ...capturedVariables, ...systemVars };
            const replacedBody = replaceVariables(message.body, mergedVariables);
            message.body = replacedBody;
            logger.info(`[flowRegistry] Mensaje con variables reemplazadas: "${replacedBody}"`);
          }
          
          // Capturar el mensaje completo con botones si los tiene
          const capturedMessage: any = {
            body: message.body || '',
            buttons: message.buttons || []
          };
          
          logger.info(`[flowRegistry] Mensaje capturado:`, JSON.stringify(capturedMessage));
          interceptedMessages.push(capturedMessage);
          
          // Llamar al original con el formato esperado
          return originalSendMessage(userId, message, options);
        } else {
          // Mensaje es string
          const capturedVariables = getSessionVariables(sessionId);
          
          // Obtener variables del sistema del tenant
          let systemVars = {};
          try {
            systemVars = await systemVariablesLoader.getSystemVariablesForTenant(state.tenantId);
            logger.info(`[flowRegistry] Variables del sistema para tenant ${state.tenantId}:`, systemVars);
          } catch (error) {
            logger.error(`[flowRegistry] Error al obtener variables del sistema:`, error);
          }
          
          const mergedVariables = { ...state.variables, ...capturedVariables, ...systemVars };
          const replacedMessage = replaceVariables(message, mergedVariables);
          logger.info(`[flowRegistry] Mensaje con variables reemplazadas: "${replacedMessage}"`);
          
          // Capturar el mensaje con sus opciones (que incluyen botones)
          const messageData: any = {
            body: replacedMessage,
            options: options || {}
          };
          
          // Buscar botones en las opciones
          if (options?.options?.buttons) {
            messageData.buttons = options.options.buttons;
          }
          
          interceptedMessages.push(messageData);
          
          return originalSendMessage(userId, replacedMessage, options);
        }
      };
      
      // También interceptar sendButtons
      const originalSendButtons = provider.sendButtons?.bind(provider);
      if (originalSendButtons) {
        provider.sendButtons = async (userId: string, buttons: any[], text?: string) => {
          logger.info(`[flowRegistry] Interceptado sendButtons`);
          logger.info(`[flowRegistry] Botones:`, JSON.stringify(buttons));
          
          interceptedMessages.push({
            body: text || '',
            buttons: buttons
          });
          
          return originalSendButtons(userId, buttons, text);
        };
      }
      
      // Interceptar el vendor para capturar llamadas a flowDynamic
      const vendor = provider.vendor;
      if (vendor) {
        const originalEmit = vendor.emit?.bind(vendor);
        if (originalEmit) {
          vendor.emit = (event: string, ...args: any[]) => {
            logger.info(`[flowRegistry] Vendor emit: ${event}`, args);
            return originalEmit(event, ...args);
          };
        }
      }
      
      // CAMBIO IMPORTANTE: Agregar metadata con tenantId, sessionId y leadId
      // Esto permite que el estado tenga acceso a estos valores
      const messageWithMetadata = {
        ...ctx,
        _metadata: {
          tenantId,
          sessionId,
          leadId: state.context?.leadId || state.context?.lead_id
        },
        _sessionId: sessionId,  // Backup para compatibilidad
        leadId: state.context?.leadId || state.context?.lead_id  // También pasar directamente
      };
      
      // También intentar inyectar en el provider para acceso global
      if (provider) {
        provider.tenantId = tenantId;
        provider.sessionId = sessionId;
      }
      
      // Simular un mensaje entrante a través del provider
      // BuilderBot espera que los mensajes lleguen a través del provider
      provider.emit('message', messageWithMetadata);
      
      // Esperar un poco para que el bot procese
      await new Promise(resolve => setTimeout(resolve, 300));
      
      logger.info(`[flowRegistry] Esperando respuestas del bot...`);
      
      // No necesitamos result porque los mensajes se capturan en el interceptor
      
      // Restaurar el sendMessage original
      provider.sendMessage = originalSendMessage;
      if (originalSendButtons) {
        provider.sendButtons = originalSendButtons;
      }
      
      // Verificar si hay mensajes en la cola de navegación de botones
      const queueKey = `${tenantId}:${phoneFrom}:${sessionId}`;
      const queuedMessages = dequeueMessages(queueKey);
      if (queuedMessages.length > 0) {
        logger.info(`[flowRegistry] ${queuedMessages.length} mensajes encontrados en la cola de navegación`);
        
        // Combinar con los mensajes interceptados
        for (const msg of queuedMessages) {
          if (!interceptedMessages.some(im => im.body === msg.body)) {
            interceptedMessages.push(msg);
          }
        }
      }
      
      // No agregar mensajes del provider ya que ya se interceptaron
      // Esto evita duplicados
      // if (provider.queuedMessages.length > 0) {
      //   interceptedMessages.push(...provider.queuedMessages);
      // }
      
      // Verificar mensajes interceptados
      if (interceptedMessages.length > 0) {
        logger.info(`[flowRegistry] Mensajes interceptados: ${interceptedMessages.length}`);
        
        // Extraer botones del último mensaje si los tiene
        const allButtons: any[] = [];
        const messages: any[] = [];
        
        interceptedMessages.forEach(msg => {
          // Si es un string, es un mensaje simple
          if (typeof msg === 'string') {
            messages.push({ body: msg });
          } else if (msg.body) {
            messages.push({ body: msg.body });
            
            // Si tiene botones directamente, capturarlos
            if (msg.buttons && Array.isArray(msg.buttons)) {
              allButtons.push(...msg.buttons);
            }
            // Si tiene botones en las opciones, capturarlos
            else if (msg.options?.options?.buttons && Array.isArray(msg.options.options.buttons)) {
              allButtons.push(...msg.options.options.buttons);
            }
          }
        });
        
        // También capturar botones de los metadatos del provider si existen
        if (provider.messageMetadata?.buttons && Array.isArray(provider.messageMetadata.buttons)) {
          logger.info(`[flowRegistry] Agregando botones de metadatos:`, JSON.stringify(provider.messageMetadata.buttons));
          allButtons.push(...provider.messageMetadata.buttons);
        }
        
        // Obtener el stage de la sesión si está disponible
        const sessionStage = getSessionStage(sessionId);
        
        const response = {
          answer: messages,
          media: [],
          buttons: allButtons,
          delay: 0,
          // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
          context: {
            ...(sessionStage && { currentLeadStage: sessionStage }),
            ...(state.currentLeadStage && { currentLeadStage: state.currentLeadStage }),
            ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
          }
        };
        
        logger.info(`[flowRegistry] Devolviendo ${messages.length} mensajes y ${allButtons.length} botones`);
        logger.info(`[flowRegistry] Estado actual del lead: ${state.context?.currentLeadStage}`);
        logger.info(`[flowRegistry] Respuesta completa:`, JSON.stringify(response));
        return response;
      }
      
      // Verificar si el provider tiene mensajes capturados
      const capturedMessages = provider.queuedMessages || [];
      logger.info(`[flowRegistry] Mensajes capturados en el provider: ${capturedMessages.length}`, capturedMessages);
      
      // Construir respuesta basada en los mensajes capturados
      if (capturedMessages.length > 0) {
        const sessionStage = getSessionStage(sessionId);
        
        const response = {
          answer: capturedMessages.map(msg => ({ body: msg })),
          media: [],
          buttons: [],
          delay: 0,
          // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
          context: {
            ...(sessionStage && { currentLeadStage: sessionStage }),
            ...(state.currentLeadStage && { currentLeadStage: state.currentLeadStage }),
            ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
          }
        };
        
        logger.info(`[flowRegistry] Devolviendo respuesta con ${capturedMessages.length} mensajes`);
        logger.info(`[flowRegistry] Estado actual del lead: ${state.context?.currentLeadStage}`);
        return response;
      }
      
      
      // Si nada funcionó, devolver un mensaje por defecto
      logger.warn(`[flowRegistry] No se obtuvieron respuestas del bot`);
      const sessionStage = getSessionStage(sessionId);
      
      return {
        answer: [{ body: "Lo siento, no pude procesar tu mensaje." }],
        media: [],
        buttons: [],
        delay: 0,
        // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
        context: {
          ...(sessionStage && { currentLeadStage: sessionStage }),
          ...(state.currentLeadStage && { currentLeadStage: state.currentLeadStage }),
          ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
        }
      };
      
    } catch (error) {
      logger.error(`[flowRegistry] Error al procesar mensaje con el bot:`, error);
      throw error;
    }
    
  } catch (error) {
    logger.error(`[flowRegistry] Error en processFlowMessage:`, error);
    throw error;
  }
}

// Función para guardar el estado en background
async function saveStateBackground(
  tenantId: string,
  userId: string,
  sessionId: string,
  state: ExtendedFlowState
): Promise<void> {
  try {
    await saveConversationState(tenantId, userId, sessionId, state);
    logger.debug(`Estado guardado correctamente en background para sesión ${tenantId}:${userId}`);
  } catch (error) {
    logger.error("Error al guardar estado en background:", error);
  }
}

// Cleanup function para limpiar estados antiguos
export function cleanupOldStates(maxAgeHours: number = 24): number {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [key, state] of Object.entries(_localFlowStates)) {
    if (state.lastUpdatedAt) {
      const stateAge = now - new Date(state.lastUpdatedAt).getTime();
      if (stateAge > maxAge) {
        delete _localFlowStates[key];
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    logger.info(`Limpiados ${cleaned} estados locales antiguos`);
  }

  return cleaned;
}

// Configurar limpieza periódica
setInterval(() => {
  cleanupOldStates();
}, 30 * 60 * 1000); // Cada 30 minutos

// Exportar funciones de estado para compatibilidad
export const flowStates = _localFlowStates;

// Inicializar al importar
FlowRegistry.initialize().catch(error => {
  logger.error("Error al inicializar FlowRegistry:", error);
});