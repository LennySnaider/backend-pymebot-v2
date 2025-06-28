/**
 * src/services/templateConverter.ts
 * 
 * Servicio para convertir plantillas visuales a flujos de BuilderBot
 * @version 6.0.0 - Corregido para construir flujos encadenados correctamente
 * @created 2025-05-10
 * @updated 2025-05-16
 */

import { createFlow, addKeyword, addAnswer } from '@builderbot/bot';
import logger from '../utils/logger';
import { replaceVariables } from '../utils/variableReplacer';
import { 
  ReactFlowData, 
  ReactFlowNode, 
  ReactFlowEdge,
  FlowNode
} from '../models/flow.types';
import { enqueueMessage } from './buttonNavigationQueue';
import { getSessionContext } from './sessionContext';
import { processSalesFunnelActions } from './salesFunnelService';
import { setSessionStage } from './flowRegistrySalesFix';
import { getTenantCategories, getTenantProducts } from './categoriesService';

// Store global para flujos creados
const globalButtonFlows: Record<string, any> = {};

/**
 * Helper para crear callback que procesa sales funnel
 */
function createSalesFunnelCallback(nodeData: any) {
  return async (ctx: any, { state }: any) => {
    try {
      logger.info(`[SALES FUNNEL CALLBACK] Iniciando con nodeData:`, JSON.stringify(nodeData));
      logger.info(`[SALES FUNNEL CALLBACK] ctx:`, JSON.stringify(ctx || {}));
      logger.info(`[SALES FUNNEL CALLBACK] state:`, JSON.stringify(state || {}));
      
      // Asegurar que tenemos los metadatos necesarios
      const metadata = ctx?._metadata || {};
      const tenantId = state.tenantId || metadata.tenantId;
      const sessionId = state.sessionId || metadata.sessionId;
      const leadId = state.leadId || state.lead_id || ctx.leadId || metadata.leadId || state.get?.('leadId') || state.get?.('lead_id');
      
      logger.info(`[SALES FUNNEL CALLBACK] tenantId=${tenantId}, sessionId=${sessionId}, leadId=${leadId}`);
      
      // Solo procesar si el nodo tiene salesStageId
      if (nodeData.salesStageId) {
        logger.info(`[SALES FUNNEL CALLBACK] Procesando sales funnel para nodo: salesStageId=${nodeData.salesStageId}, leadId=${leadId}`);
        
        if (!leadId) {
          logger.warn(`[SALES FUNNEL CALLBACK] No se encontró leadId, abortando procesamiento`);
          return;
        }
        
        const stateForFunnel = {
          ...state,
          tenantId,
          leadId,
          lead_id: leadId,
          context: {
            leadId,
            lead_id: leadId,
            tenantId,
            sessionId
          }
        };
        
        // Crear estructura de nodo con metadata
        const nodeForFunnel = {
          id: nodeData.id,
          type: nodeData.type,
          metadata: {
            salesStageId: nodeData.salesStageId
          },
          data: {
            salesStageId: nodeData.salesStageId
          }
        };
        
        await processSalesFunnelActions(nodeForFunnel, stateForFunnel);
        
        // IMPORTANTE: Actualizar el estado para que se propague
        if (state && typeof state.update === 'function') {
          await state.update({
            currentLeadStage: nodeData.salesStageId
          });
          logger.info(`[SALES FUNNEL CALLBACK] Estado actualizado con currentLeadStage: ${nodeData.salesStageId}`);
          
          // También guardar en el fix
          if (metadata.sessionId) {
            setSessionStage(metadata.sessionId, nodeData.salesStageId);
          }
        }
      } else {
        logger.info(`[SALES FUNNEL CALLBACK] Nodo sin salesStageId, saltando procesamiento`);
      }
    } catch (error) {
      logger.error(`[SALES FUNNEL CALLBACK] Error procesando sales funnel: ${error}`);
    }
  };
}

/**
 * Interfaz para el resultado de la conversión
 */
export interface FlowConversionResult {
  flow: any; // Flujo de BuilderBot
  entryKeywords: string[];
  nodeMap: Record<string, any>;
}

/**
 * Convierte una plantilla de flujo visual a un flujo de BuilderBot
 * @param templateId ID de la plantilla
 * @returns Flujo compatible con BuilderBot
 */
export async function convertTemplateToBuilderbotFlow(
  templateId: string,
  tenantId?: string,
  sessionId?: string
): Promise<FlowConversionResult> {
  try {
    logger.info(`Iniciando conversión de plantilla: ${templateId}`);
    logger.info(`Contexto: tenantId=${tenantId}, sessionId=${sessionId}`);
    
    // Cargar la plantilla desde la base de datos
    const { getTemplateById } = await import('./supabase');
    const template = await getTemplateById(templateId);
    
    if (!template) {
      logger.error(`Plantilla no encontrada: ${templateId}`);
      throw new Error(`Plantilla ${templateId} no encontrada`);
    }
    
    // Debug logging para ver la estructura de la plantilla
    logger.info(`Plantilla recuperada:`, {
      id: template.id,
      name: template.name,
      hasReactFlowJson: !!template.react_flow_json,
      keys: Object.keys(template)
    });
    
    let nodes: Record<string, any> = {};
    let edges: ReactFlowEdge[] = [];
    let startNodeId: string | undefined;
    
    // Priorizar react_flow_json si existe
    if (template.react_flow_json && typeof template.react_flow_json === 'object') {
      const templateJson = template.react_flow_json;
      
      if (templateJson.nodes && templateJson.edges && Array.isArray(templateJson.nodes)) {
        // Formato con arrays de nodes y edges
        const nodeArray = templateJson.nodes as any[];
        edges = templateJson.edges;
        
        // Convertir array de nodos a mapa
        nodeArray.forEach(node => {
          nodes[node.id] = node;
        });
        
        // Encontrar nodo inicial
        const startNodeObj = nodeArray.find(n => 
          n.type === 'startNode' || 
          n.type === 'start-node' || 
          n.id === 'start-node'
        );
        startNodeId = startNodeObj?.id;
        
        logger.info(`Usando formato react_flow_json con ${nodeArray.length} nodos y ${edges.length} edges`);
      }
    }
    
    // Si no encontramos nodes/edges válidos, intentar con el formato de la API
    if (Object.keys(nodes).length === 0) {
      if (template.nodes && typeof template.nodes === 'object') {
        nodes = template.nodes;
        startNodeId = template.entryNodeId || 'start-node';
        logger.info(`Usando formato de API con ${Object.keys(nodes).length} nodos`);
      }
    }
    
    if (Object.keys(nodes).length === 0) {
      logger.error(`Plantilla ${templateId} sin nodos válidos`);
      const emptyFlow = addKeyword(['EMPTY']);
      return {
        flow: createFlow([emptyFlow]),
        entryKeywords: ['EMPTY'],
        nodeMap: {}
      };
    }
    
    // DEBUG: Logging de nodos categories y products desde la plantilla
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (['categories', 'categoriesNode', 'categories-node', 'products', 'productsNode', 'products-node'].includes(node.type)) {
        logger.info(`[TEMPLATE LOAD DEBUG] Nodo ${nodeId} (${node.type}) desde plantilla:`, {
          data: node.data,
          metadata: node.metadata,
          waitForResponse: node.data?.waitForResponse,
          hasOptions: !!(node.data?.options),
          hasButtons: !!(node.data?.buttons)
        });
      }
    });
    
    // Verificar que tenemos un nodo inicial
    if (!startNodeId || !nodes[startNodeId]) {
      logger.error(`No se encontró nodo inicial válido: ${startNodeId}`);
      throw new Error('El flujo debe tener un nodo inicial válido');
    }
    
    // Configurar palabras clave de entrada en minúsculas y mayúsculas
    let entryKeywords = ['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START'];
    const startNode = nodes[startNodeId];
    
    if (startNode.metadata?.keywords) {
      const customKeywords = Array.isArray(startNode.metadata.keywords) 
        ? startNode.metadata.keywords
        : startNode.metadata.keywords.split(',').map((kw: string) => kw.trim());
      
      // Añadir cada palabra clave en minúsculas y mayúsculas
      customKeywords.forEach((kw: string) => {
        entryKeywords.push(kw.toLowerCase());
        entryKeywords.push(kw.toUpperCase());
      });
    }
    
    if (template.name) {
      entryKeywords.push(template.name.toLowerCase());
      entryKeywords.push(template.name.toUpperCase());
    }
    
    // Crear flujo principal con palabras clave
    logger.info(`Configurando palabras clave de entrada: ${entryKeywords.join(', ')}`);
    // addKeyword requiere al menos un string, asegurar que siempre hay uno  
    if (entryKeywords.length === 0) {
      entryKeywords = ['HOLA'];
    }
    
    // Construir el flujo completo de manera lineal
    // CAMBIO IMPORTANTE: Agregar callback inicial para configurar tenantId y sessionId
    let flowChain = addKeyword(entryKeywords as [string, ...string[]])
      .addAction(async (ctx: any, { state, provider }: any) => {
        // Usar los parámetros pasados a la función o buscar en el contexto
        const metadata = ctx?._metadata || {};
        const ctxTenantId = tenantId || metadata.tenantId || provider?.tenantId || 'default';
        const ctxSessionId = sessionId || metadata.sessionId || provider?.sessionId || 'default';
        
        await state.update({
          tenantId: ctxTenantId,
          sessionId: ctxSessionId,
          templateId,
          initialized: true
        });
        
        logger.info(`[templateConverter] Estado inicial configurado:`, {
          tenantId: ctxTenantId,
          sessionId: ctxSessionId,
          templateId,
          from: ctx.from
        });
      });
    
    // Obtener el primer nodo después del inicio
    const firstNodeId = getNextNodeId(startNode, edges, nodes);
    logger.info(`Primer nodo después del inicio: ${firstNodeId}`);
    
    if (firstNodeId) {
      // Construir toda la cadena de flujo
      flowChain = buildFlowChain(firstNodeId, flowChain, nodes, edges, new Set<string>());
    } else {
      // Si no hay siguiente nodo, agregar mensaje por defecto
      logger.info('No se encontró siguiente nodo, agregando mensaje por defecto');
      flowChain = flowChain.addAnswer('Hola, ¿en qué puedo ayudarte?');
    }
    
    // Crear flujos adicionales para cada rama de botones
    const allFlows = [flowChain];
    const allNodeMap: Record<string, any> = { [startNodeId]: flowChain };
    
    // Mapa de flujos de botones para acceso rápido
    const buttonFlowMap: Record<string, any> = {};
    
    // Buscar todos los nodos de botones y crear flujos para cada rama
    Object.entries(nodes).forEach(([nodeId, node]) => {
      if (node.type === 'buttonsNode' || node.type === 'buttons-node' || node.type === 'buttons') {
        const buttons = node.metadata?.buttons || node.data?.buttons || [];
        
        // Para cada botón, crear un flujo que comience con su keyword
        buttons.forEach((btn: any, index: number) => {
          const keyword = `btn_${nodeId}_${index}`;
          
          // Buscar el edge que sale de este botón (handle específico)
          const buttonEdge = edges.find(edge => 
            edge.source === nodeId && 
            edge.sourceHandle === `handle-${index}`
          );
          
          if (buttonEdge) {
            logger.info(`Creando flujo para botón ${index} (${btn.text || btn.label}) con keyword ${keyword}`);
            
            // También agregar el texto del botón como keyword adicional
            const buttonTextKeyword = btn.text || btn.label || btn.body;
            const buttonKeywords = [keyword];
            if (buttonTextKeyword) {
              buttonKeywords.push(buttonTextKeyword.toLowerCase());
              buttonKeywords.push(buttonTextKeyword);
            }
            
            logger.info(`Keywords para botón: ${buttonKeywords.join(', ')}`);
            
            // Crear un nuevo flujo que comience con estos keywords
            let buttonFlow = addKeyword(buttonKeywords);
            
            // Construir el flujo a partir del nodo destino
            buttonFlow = buildFlowChain(buttonEdge.target, buttonFlow, nodes, edges, new Set<string>());
            
            allFlows.push(buttonFlow);
            allNodeMap[`${nodeId}_button_${index}`] = buttonFlow;
            buttonFlowMap[keyword] = buttonFlow;
            globalButtonFlows[keyword] = buttonFlow; // Almacenar globalmente
          }
        });
      }
    });
    
    
    // Crear el flujo final con todos los subflujos
    const createdFlow = createFlow(allFlows);
    
    logger.info(`Flujo creado exitosamente con ${allFlows.length} subflujos`);
    logger.info(`Flujos de botones registrados: ${Object.keys(globalButtonFlows).join(', ')}`);
    
    // DEBUG: Verificar el flujo creado
    try {
      logger.info(`[TEMPLATE CONVERTER DEBUG] Flujo creado correctamente:`, {
        type: typeof createdFlow,
        hasFlowSerialize: typeof createdFlow?.flowSerialize === 'function',
        keys: Object.keys(createdFlow || {})
      });
    } catch (e) {
      logger.warn(`[TEMPLATE CONVERTER DEBUG] Error verificando flujo:`, e);
    }
    
    return {
      flow: createdFlow,
      entryKeywords,
      nodeMap: allNodeMap
    };
    
  } catch (error) {
    logger.error('Error al convertir plantilla a flujo BuilderBot:', error);
    throw error;
  }
}

/**
 * Construye la cadena de flujo de manera recursiva
 */
function buildFlowChain(
  nodeId: string,
  flowChain: any,
  nodes: Record<string, any>,
  edges: ReactFlowEdge[],
  processedNodes: Set<string>
): any {
  if (processedNodes.has(nodeId)) {
    logger.info(`Nodo ${nodeId} ya procesado, saltando`);
    return flowChain;
  }
  
  const currentNode = nodes[nodeId];
  if (!currentNode) {
    logger.warn(`Nodo ${nodeId} no encontrado`);
    return flowChain;
  }
  
  processedNodes.add(nodeId);
  logger.info(`Procesando nodo ${nodeId} de tipo ${currentNode.type}`);
  
  // DEBUG: Logging completo del nodo si es categories o products
  if (['categories', 'categoriesNode', 'categories-node', 'products', 'productsNode', 'products-node'].includes(currentNode.type)) {
    logger.info(`[FLOW CHAIN DEBUG] Nodo especial detectado:`, {
      nodeId,
      type: currentNode.type,
      data: currentNode.data,
      metadata: currentNode.metadata,
      content: currentNode.content
    });
  }
  
  // 🔧 CORRECCIÓN AUTOMÁTICA: Nodos que deben esperar respuesta del usuario
  if (currentNode.data) {
    const hasButtons = currentNode.data.buttons && Array.isArray(currentNode.data.buttons) && currentNode.data.buttons.length > 0;
    const hasOptions = currentNode.data.options && Array.isArray(currentNode.data.options) && currentNode.data.options.length > 0;
    const isInteractiveNodeType = ['buttonsNode', 'buttons-node', 'inputNode', 'input-node', 'categories', 'categoriesNode', 'products', 'productsNode', 'listNode', 'list-node'].includes(currentNode.type);
    
    // Si es un nodo interactivo y no tiene waitForResponse definido, añadirlo
    if (isInteractiveNodeType && currentNode.data.waitForResponse === undefined) {
      logger.info(`🔧 CORRECCIÓN: Nodo ${nodeId} (${currentNode.type}) es interactivo pero no tiene waitForResponse. Añadiendo waitForResponse=true.`);
      currentNode.data.waitForResponse = true;
    }
    
    // Si tiene botones/opciones pero waitForResponse es false, corregirlo
    if ((hasButtons || hasOptions || isInteractiveNodeType) && currentNode.data.waitForResponse === false) {
      logger.info(`🔧 CORRECCIÓN: Nodo ${nodeId} (${currentNode.type}) tiene botones/opciones pero waitForResponse=false. Corrigiendo a true.`);
      currentNode.data.waitForResponse = true;
    }
  }
  
  // Si este nodo es el destino de un botón, necesitamos procesarlo diferente
  const isButtonTarget = edges.some(edge => 
    edge.target === nodeId && edge.sourceHandle && edge.sourceHandle.startsWith('handle-')
  );
  
  // Procesar según el tipo de nodo
  switch (currentNode.type) {
    case 'messageNode':
    case 'message-node':
    case 'message':
      const messageContent = currentNode.content || 
                           currentNode.metadata?.message || 
                           currentNode.data?.message || 
                           'Mensaje sin contenido';
      logger.info(`Agregando mensaje: ${messageContent}`);
      
      // SOLUCIÓN: Verificar si este nodo no espera respuesta Y el siguiente nodo es un inputNode
      const isNonInteractive = currentNode.data?.waitForResponse === false;
      let nextNode = null;
      let nextInputPrompt = null;
      let nextInputVariableName = null;
      
      if (isNonInteractive) {
        const nextEdge = edges.find(edge => edge.source === nodeId);
        if (nextEdge) {
          nextNode = Object.values(nodes).find(n => n.id === nextEdge.target);
          if (nextNode && (nextNode.type === 'inputNode' || nextNode.type === 'input-node' || nextNode.type === 'input')) {
            nextInputPrompt = nextNode.metadata?.question || 
                             nextNode.data?.question || 
                             nextNode.content || 
                             '¿Cuál es tu respuesta?';
            nextInputVariableName = nextNode.metadata?.variableName || 
                                   nextNode.data?.variableName || 
                                   'userInput';
            logger.info(`🔗 OPTIMIZACIÓN: Combinando messageNode sin respuesta con inputNode siguiente`);
            logger.info(`🔗 Mensaje combinado: "${messageContent}" + "${nextInputPrompt}"`);
          }
        }
      }
      
      if (nextInputPrompt) {
        // Combinar ambos mensajes en un solo addAnswer con capture
        const combinedMessage = `${messageContent}\n${nextInputPrompt}`;
        
        // Verificar si tiene salesStageId
        const stageId = currentNode.salesStageId || currentNode.data?.salesStageId;
        if (stageId) {
          logger.info(`[TEMPLATE CONVERTER] Nodo ${currentNode.id} tiene salesStageId: ${stageId}`);
          const nodeData = { 
            salesStageId: stageId,
            type: currentNode.type,
            id: currentNode.id
          };
          flowChain = flowChain.addAnswer(combinedMessage, { capture: true }, async (ctx, { state }) => {
            await createSalesFunnelCallback(nodeData)(ctx, { state });
            
            // Actualizar variable del input
            await state.update({ 
              [nextInputVariableName]: ctx.body,
              currentLeadStage: stageId,
              tenantId: state.tenantId || ctx?._metadata?.tenantId,
              sessionId: state.sessionId || ctx?._metadata?.sessionId
            });
            logger.info(`Variable ${nextInputVariableName} actualizada con: ${ctx.body}`);
            logger.info(`[TEMPLATE CONVERTER] Estado actualizado con currentLeadStage: ${stageId}`);
            
            // También guardar en el fix
            const sessionContext = getSessionContext(ctx.from);
            if (sessionContext?.sessionId) {
              setSessionStage(sessionContext.sessionId, stageId);
            }
          });
        } else {
          flowChain = flowChain.addAnswer(combinedMessage, { capture: true }, async (ctx, { state }) => {
            // Actualizar variable del input
            const metadata = ctx?._metadata || {};
            await state.update({ 
              [nextInputVariableName]: ctx.body,
              tenantId: state.tenantId || metadata.tenantId,
              sessionId: state.sessionId || metadata.sessionId
            });
            logger.info(`Variable ${nextInputVariableName} actualizada con: ${ctx.body}`);
          });
        }
        
        // Saltar el próximo nodo porque ya lo procesamos
        processedNodes.add(nextNode.id);
        logger.info(`🔗 Nodo ${nextNode.id} marcado como procesado (combinado)`);
        
        // IMPORTANTE: Continuar con el siguiente nodo después del nodo combinado
        const nextAfterCombined = getNextNodeId(nextNode, edges, Object.values(nodes));
        if (nextAfterCombined) {
          logger.info(`🔗 Continuando con el nodo después del combinado: ${nextAfterCombined}`);
          return buildFlowChain(nextAfterCombined, flowChain, nodes, edges, processedNodes);
        }
        
      } else {
        // Comportamiento normal para messageNode
        // Agregar callback para procesar sales funnel si el nodo tiene salesStageId
        if (currentNode.salesStageId || currentNode.data?.salesStageId) {
          const stageId = currentNode.salesStageId || currentNode.data?.salesStageId;
          logger.info(`[TEMPLATE CONVERTER] Nodo ${currentNode.id} tiene salesStageId: ${stageId}`);
          const nodeData = { 
            salesStageId: stageId,
            type: currentNode.type,
            id: currentNode.id
          };
          flowChain = flowChain.addAnswer(messageContent, null, async (ctx, { state }) => {
            await createSalesFunnelCallback(nodeData)(ctx, { state });
            
            // IMPORTANTE: También actualizar el estado global
            if (state && typeof state.update === 'function') {
              await state.update({
                currentLeadStage: stageId
              });
              logger.info(`[TEMPLATE CONVERTER] Estado actualizado con currentLeadStage: ${stageId}`);
              
              // También guardar en el fix
              const sessionContext = getSessionContext(ctx.from);
              if (sessionContext?.sessionId) {
                setSessionStage(sessionContext.sessionId, stageId);
              }
            }
          });
        } else {
          logger.info(`[TEMPLATE CONVERTER] Nodo ${currentNode.id} NO tiene salesStageId`);
          flowChain = flowChain.addAnswer(messageContent);
        }
      }
      break;
      
    case 'inputNode':
    case 'input-node':
    case 'input':
      const prompt = currentNode.metadata?.question || 
                    currentNode.data?.question || 
                    currentNode.content || 
                    '¿Cuál es tu respuesta?';
      const variableName = currentNode.metadata?.variableName || 
                          currentNode.data?.variableName || 
                          'userInput';
      
      logger.info(`Agregando input: ${prompt} -> ${variableName}`);
      flowChain = flowChain.addAnswer(prompt, { capture: true }, async (ctx: any, { state }: any) => {
        // Asegurar que tenantId y sessionId se mantengan en el estado
        const metadata = ctx?._metadata || {};
        await state.update({ 
          [variableName]: ctx.body,
          tenantId: state.tenantId || metadata.tenantId,
          sessionId: state.sessionId || metadata.sessionId
        });
        logger.info(`Variable ${variableName} actualizada con: ${ctx.body}`);
        
        // Procesar sales funnel si el nodo tiene salesStageId
        if (currentNode.salesStageId || currentNode.data?.salesStageId) {
          const stageId = currentNode.salesStageId || currentNode.data?.salesStageId;
          const nodeData = { 
            salesStageId: stageId 
          };
          await createSalesFunnelCallback(nodeData)(ctx, { state });
          
          // También actualizar el estado global
          await state.update({
            currentLeadStage: stageId
          });
          logger.info(`[INPUT NODE] Estado actualizado con currentLeadStage: ${stageId}`);
          
          // También guardar en el fix
          const sessionContext = getSessionContext(ctx.from);
          if (sessionContext?.sessionId) {
            setSessionStage(sessionContext.sessionId, stageId);
          }
        }
      });
      break;
      
    case 'buttonsNode':
    case 'buttons-node':
    case 'buttons':
      const text = currentNode.metadata?.message || 
                  currentNode.data?.message || 
                  currentNode.content || 
                  '¿Qué deseas hacer?';
      const buttons = currentNode.metadata?.buttons || 
                     currentNode.data?.buttons || 
                     [];
      
      logger.info(`Agregando botones: ${text} con ${buttons.length} opciones`);
      
      // Verificar si debe esperar respuesta (por defecto sí)
      const waitForResponse = currentNode.metadata?.waitForResponse !== false && 
                             currentNode.data?.waitForResponse !== false;
      
      if (buttons.length > 0) {
        // Generar keywords únicos para cada botón y agregarlos a los metadatos
        const buttonsFormatted = buttons.map((btn: any, index: number) => {
          return { 
            body: btn.text || btn.label || btn.body
          };
        });
        
        const answerOptions: any = { 
          buttons: buttonsFormatted
        };
        
        // Solo agregar capture si waitForResponse es true
        if (waitForResponse) {
          answerOptions.capture = true;
          
          // Agregar callback para procesar sales funnel si tiene salesStageId
          if (currentNode.salesStageId || currentNode.data?.salesStageId) {
            const nodeData = { 
              salesStageId: currentNode.salesStageId || currentNode.data?.salesStageId 
            };
            flowChain = flowChain.addAnswer(text, answerOptions, createSalesFunnelCallback(nodeData));
          } else {
            flowChain = flowChain.addAnswer(text, answerOptions);
          }
        } else {
          // Si no espera respuesta, solo mostrar los botones
          if (currentNode.salesStageId || currentNode.data?.salesStageId) {
            const nodeData = { 
              salesStageId: currentNode.salesStageId || currentNode.data?.salesStageId 
            };
            flowChain = flowChain.addAnswer(text, answerOptions, createSalesFunnelCallback(nodeData));
          } else {
            flowChain = flowChain.addAnswer(text, answerOptions);
          }
        }
      }
      
      // NO continuar el flujo secuencial, los botones manejarán sus propios flujos
      return flowChain;
      
    case 'conditionNode':
    case 'condition-node':
    case 'condition':
      logger.info(`Procesando condición - continuando con flujo por defecto`);
      // Para condiciones, simplemente continuar con el flujo por defecto
      break;
      
    case 'categories':
    case 'categoriesNode':
    case 'categories-node':
      logger.info(`Procesando nodo categories: ${nodeId}`);
      
      const categoriesMessage = currentNode.data?.message || "Por favor selecciona una categoría:";
      
      // Usar implementación simple sin async para evitar timeouts
      flowChain = flowChain.addAnswer(
        categoriesMessage + "\n\n• Residencial\n• Comercial\n• Industrial",
        { capture: true }, 
        async (ctx: any, { state }: any) => {
          logger.info(`[categoriesNode] Usuario seleccionó: ${ctx.body}`);
          
          // Mapear respuesta del usuario a categoría válida
          const userInput = ctx.body.toLowerCase();
          let selectedCategory = '';
          
          if (userInput.includes('residencial') || userInput === '1') {
            selectedCategory = 'Residencial';
          } else if (userInput.includes('comercial') || userInput === '2') {
            selectedCategory = 'Comercial';
          } else if (userInput.includes('industrial') || userInput === '3') {
            selectedCategory = 'Industrial';
          } else {
            selectedCategory = 'Residencial'; // Default
          }
          
          await state.update({ 
            categories_selected: selectedCategory,
            category_name: selectedCategory 
          });
          
          logger.info(`[categoriesNode] Categoría seleccionada: ${selectedCategory}`);
        }
      );
      break;

    case 'products':
    case 'productsNode':
    case 'products-node':
      logger.info(`Procesando nodo products: ${nodeId}`);
      
      const productsMessage = currentNode.data?.message || "Selecciona un producto/servicio:";
      
      // Usar implementación simple sin botones para evitar timeouts
      flowChain = flowChain.addAnswer(
        productsMessage + "\n\n• Venta de Propiedades\n• Alquiler de Propiedades\n• Asesoría Inmobiliaria",
        { capture: true }, 
        async (ctx: any, { state }: any) => {
          logger.info(`[productsNode] Usuario seleccionó: ${ctx.body}`);
          
          // Mapear respuesta del usuario a producto válido
          const userInput = ctx.body.toLowerCase();
          let selectedProduct = '';
          
          if (userInput.includes('venta') || userInput === '1') {
            selectedProduct = 'Venta de Propiedades';
          } else if (userInput.includes('alquiler') || userInput === '2') {
            selectedProduct = 'Alquiler de Propiedades';
          } else if (userInput.includes('asesor') || userInput === '3') {
            selectedProduct = 'Asesoría Inmobiliaria';
          } else {
            selectedProduct = 'Venta de Propiedades'; // Default
          }
          
          await state.update({ 
            products_list: selectedProduct,
            servicio_seleccionado: selectedProduct
          });
          
          logger.info(`[productsNode] Producto seleccionado: ${selectedProduct}`);
        }
      );
      break;

    case 'check-availability':
    case 'checkAvailabilityNode':
    case 'check-availability-node':
      logger.info(`Procesando nodo check-availability: ${nodeId}`);
      // Mapear a messageNode con lógica de disponibilidad
      const availabilityMessage = currentNode.data?.message || "🔍 Verificando disponibilidad...\n\n✅ ¡Excelente! Tenemos disponibilidad para el servicio seleccionado.";
      
      flowChain = flowChain.addAnswer(availabilityMessage, null, async (ctx: any, { state, flowDynamic }: any) => {
        // Simular verificación exitosa
        await state.update({ availability: "available" });
        logger.info(`Check availability completado para: ${ctx.from}`);
      });
      break;

    case 'book-appointment':
    case 'bookAppointmentNode':
    case 'book-appointment-node':
      logger.info(`Procesando nodo book-appointment: ${nodeId}`);
      // Mapear a messageNode con funcionalidad de agendamiento
      const appointmentMessage = currentNode.data?.message || "📅 ¡Perfecto! Vamos a agendar tu cita.\n\n¿Qué fecha prefieres para tu cita?";
      
      flowChain = flowChain.addAnswer(appointmentMessage, { capture: true }, async (ctx: any, { state }: any) => {
        // Capturar la fecha preferida
        await state.update({ fecha_preferida: ctx.body });
        logger.info(`Fecha preferida capturada: ${ctx.body}`);
      });
      break;

    case 'endNode':
    case 'end-node':
    case 'end':
      // Nodo final, no necesita procesamiento adicional
      logger.info(`Nodo final alcanzado: ${nodeId}`);
      return flowChain;
      
    default:
      logger.warn(`Tipo de nodo no reconocido: ${currentNode.type}`);
  }
  
  // Buscar el siguiente nodo y continuar la cadena
  const nextNodeId = getNextNodeId(currentNode, edges, nodes);
  if (nextNodeId) {
    return buildFlowChain(nextNodeId, flowChain, nodes, edges, processedNodes);
  }
  
  return flowChain;
}

/**
 * Obtiene el ID del siguiente nodo
 */
function getNextNodeId(
  node: any, 
  edges: ReactFlowEdge[], 
  nodes: Record<string, any>
): string | undefined {
  // Primero, buscar en la propiedad 'next' del nodo (formato API)
  if (node.next) {
    if (typeof node.next === 'string') {
      logger.info(`Siguiente nodo desde propiedad next: ${node.next}`);
      return node.next;
    } else if (Array.isArray(node.next) && node.next.length > 0) {
      // Si es un array (como en buttonsNode), tomar el primero o el default
      const defaultNext = node.next.find(n => n.condition?.value === 'default');
      if (defaultNext) {
        logger.info(`Siguiente nodo desde array next (default): ${defaultNext.nextNodeId}`);
        return defaultNext.nextNodeId;
      }
      // Si no hay default, tomar el primero
      const firstNext = node.next[0].nextNodeId || node.next[0];
      logger.info(`Siguiente nodo desde array next (primero): ${firstNext}`);
      return firstNext;
    }
  }
  
  // Si no hay 'next', buscar en edges (formato ReactFlow)
  if (edges && edges.length > 0) {
    // Buscar edge que sale de este nodo
    const outgoingEdge = edges.find(edge => edge.source === node.id);
    if (outgoingEdge) {
      logger.info(`Siguiente nodo desde edges: ${outgoingEdge.target}`);
      return outgoingEdge.target;
    }
    
    // Si el nodo es un botón, puede tener múltiples salidas con sourceHandle
    if (node.type === 'buttonsNode' || node.type === 'buttons-node') {
      // Buscar el handle por defecto (generalmente handle-0)
      const defaultEdge = edges.find(edge => 
        edge.source === node.id && 
        (edge.sourceHandle === 'handle-0' || !edge.sourceHandle)
      );
      if (defaultEdge) {
        logger.info(`Siguiente nodo desde botón con handle: ${defaultEdge.target}`);
        return defaultEdge.target;
      }
    }
  }
  
  logger.info(`No se encontró siguiente nodo para ${node.id}`);
  return undefined;
}

/**
 * Procesa un nodo directamente sin crear un flujo
 */
async function processNodeDirectly(
  node: any,
  ctx: any,
  helpers: { state: any; flowDynamic: any; provider?: any },
  sessionKey?: string
): Promise<void> {
  logger.info(`Procesando nodo directamente: ${node.id} de tipo ${node.type}`);
  
  const { state, flowDynamic, provider } = helpers;
  
  // Obtener contexto de sesión del almacén global
  const sessionContext = getSessionContext(ctx.from) || {};
  const tenantId = sessionContext.tenantId || 'default';
  const sessionId = sessionContext.sessionId || 'default';
  
  const currentSessionKey = sessionKey || `${tenantId}:${ctx.from}:${sessionId}`;
  logger.info(`[processNodeDirectly] Usando sessionKey: ${currentSessionKey} - tenantId: ${tenantId}, sessionId: ${sessionId}`);
  
  // Para debugging
  logger.info(`[processNodeDirectly] Contexto disponible:`, {
    state_tenantId: state?.tenantId,
    state_sessionId: state?.sessionId,
    ctx_metadata: ctx?._metadata,
    provider_tenantId: helpers.provider?.tenantId,
    ctx_sessionId: ctx?._sessionId
  });
  
  switch (node.type) {
    case 'messageNode':
    case 'message-node':
    case 'message':
      const messageContent = node.content || 
                           node.metadata?.message || 
                           node.data?.message || 
                           'Mensaje sin contenido';
      logger.info(`[processNodeDirectly] Enviando mensaje: "${messageContent}"`);
      
      // Encolar el mensaje
      enqueueMessage(currentSessionKey, { body: messageContent });
      
      // Usar un objeto simple con body para asegurar que se capture correctamente
      await flowDynamic({ body: messageContent });
      break;
      
    case 'inputNode':
    case 'input-node':
    case 'input':
      const prompt = node.metadata?.question || 
                    node.data?.question || 
                    node.content || 
                    '¿Cuál es tu respuesta?';
      const variableName = node.metadata?.variableName || 
                          node.data?.variableName || 
                          'userInput';
      
      await state.update({ waitingFor: variableName });
      await flowDynamic(prompt);
      break;
      
    case 'buttonsNode':
    case 'buttons-node':
    case 'buttons':
      const buttonMessage = node.content || 
                           node.metadata?.message || 
                           node.data?.message || 
                           'Selecciona una opción:';
      const buttons = node.metadata?.buttons || 
                     node.data?.buttons || 
                     [];
      
      logger.info(`Procesando nodo de botones con ${buttons.length} opciones`);
      logger.info(`Mensaje de botones: "${buttonMessage}"`);
      logger.info(`Botones:`, JSON.stringify(buttons));
      
      if (buttons.length > 0) {
        // Formatear los botones correctamente
        const buttonsFormatted = buttons.map((btn: any) => ({ 
          body: btn.text || btn.label || btn.body
        }));
        
        // Enviar el mensaje y los botones juntos
        logger.info(`Enviando mensaje con botones vía flowDynamic`);
        const messageWithButtons = {
          body: buttonMessage,
          buttons: buttonsFormatted
        };
        logger.info(`Objeto completo a enviar:`, JSON.stringify(messageWithButtons));
        
        // Encolar el mensaje con botones
        enqueueMessage(currentSessionKey, messageWithButtons);
        
        await flowDynamic(messageWithButtons);
      } else {
        await flowDynamic(buttonMessage);
      }
      break;
      
    case 'endNode':
    case 'end-node':
    case 'end':
      // Nodo final, no hacer nada
      break;
      
    default:
      logger.warn(`Tipo de nodo no reconocido para procesamiento directo: ${node.type}`);
  }
}

// Exportar función de conversión
export default convertTemplateToBuilderbotFlow;