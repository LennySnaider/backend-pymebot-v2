/**
 * src/flows/nodes/MessageFlow.ts
 * 
 * Nodo modular para mostrar mensajes simples
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../../utils/logger';
import { processSalesFunnelActions } from '../../services/salesFunnelService';
import { replaceVariables } from '../../utils/variableReplacer';

/**
 * Flujo de mensaje que NO espera respuesta (navegación automática)
 */
const createNonInteractiveMessageFlow = () => {
  return addKeyword(['MESSAGE_NO_CAPTURE', 'message_no_capture'])
    .addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
      try {
        logger.info(`[MessageFlow] Mostrando mensaje para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const nodeData = currentState.nodeData || {};
        
        // Obtener mensaje del nodo
        let message = nodeData.data?.message || nodeData.message || nodeData.content || 'Mensaje sin contenido';
        
        // SOLUCIÓN: Cargar variables del sistema para el tenant
        const tenantId = currentState.tenantId || currentState.metadata?.tenantId;
        let systemVariables = {};
        
        if (tenantId) {
          try {
            const { getSystemVariablesForTenant } = await import('../../utils/systemVariablesLoader');
            systemVariables = await getSystemVariablesForTenant(tenantId);
            logger.debug(`[MessageFlow] Variables del sistema cargadas para tenant ${tenantId}:`, Object.keys(systemVariables));
          } catch (error) {
            logger.error(`[MessageFlow] Error cargando variables del sistema:`, error);
          }
        }
        
        // Reemplazar variables en el mensaje
        const variables = {
          ...systemVariables,
          ...currentState.globalVars,
          nombre: currentState.globalVars?.name || currentState.globalVars?.lead_name || '',
          nombre_lead: currentState.globalVars?.lead_name || currentState.globalVars?.name || '',
          categoria_seleccionada: currentState.selectedCategory || '',
          producto_seleccionado: currentState.selectedProduct || ''
        };
        
        logger.debug(`[MessageFlow] Variables combinadas para reemplazo:`, Object.keys(variables));
        message = replaceVariables(message, variables);
        
        // IMPORTANTE: Procesar acciones del sales funnel si el nodo tiene salesStageId
        if (nodeData.salesStageId) {
          logger.info(`[MessageFlow] Procesando sales funnel con stageId: ${nodeData.salesStageId}`);
          await processSalesFunnelActions(
            {
              id: nodeData.id,
              type: 'message',
              content: nodeData.message || nodeData.content || '',
              metadata: { salesStageId: nodeData.salesStageId },
              data: { salesStageId: nodeData.salesStageId }
            },
            currentState as any
          );
        }
        
        // Enviar mensaje al usuario
        await flowDynamic([message]);
        
        // CORRECCIÓN: Verificar correctamente si debe esperar respuesta
        // Si capture está explícitamente en false, NO debe esperar respuesta
        // Si waitForResponse está explícitamente en false, NO debe esperar respuesta
        // Por defecto, los nodos de mensaje SÍ esperan respuesta
        const shouldWaitForResponse = !(nodeData.data?.capture === false || 
                                      nodeData.capture === false || 
                                      nodeData.data?.waitForResponse === false || 
                                      nodeData.waitForResponse === false);

        logger.info(`[MessageFlow] Configuración del nodo:`, {
          nodeId: nodeData.id,
          'data.capture': nodeData.data?.capture,
          'capture': nodeData.capture,
          'data.waitForResponse': nodeData.data?.waitForResponse,
          'waitForResponse': nodeData.waitForResponse,
          'shouldWaitForResponse': shouldWaitForResponse
        });

        // DETERMINAR NAVEGACIÓN AUTOMÁTICA
        logger.info(`[MessageFlow] El nodo NO espera respuesta, navegando automáticamente...`);
        
        // Determinar siguiente flujo basado en edges del nodo
        const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
        if (nextEdge && nextEdge.targetNode) {
          const nextNodeType = nextEdge.targetNode.type?.toLowerCase();
          logger.info(`[MessageFlow] Navegando automáticamente a: ${nextEdge.targetNode.id} (${nextNodeType})`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...currentState,
            nodeData: nextEdge.targetNode,
            previousNodeId: nodeData.id,
            currentNodeId: nextEdge.targetNode.id
          });
          
          // Navegar según el tipo de nodo usando gotoFlow disponible en este contexto
          try {
            switch (nextNodeType) {
              case 'categories':
              case 'categoriesnode':
                const CategoriesFlow = (await import('./CategoriesFlow')).default;
                return gotoFlow(CategoriesFlow);
                
              case 'products':
              case 'productsnode':
                const ProductsFlow = (await import('./ProductsFlow')).default;
                return gotoFlow(ProductsFlow);
                
              case 'buttons':
              case 'buttonsnode':
                const ButtonsFlow = (await import('./ButtonsFlow')).default;
                return gotoFlow(ButtonsFlow);
                
              case 'input':
              case 'inputnode':
                const InputFlow = (await import('./InputFlow')).default;
                return gotoFlow(InputFlow);
                
              case 'message':
              case 'messagenode':
                // CORRECCIÓN: Evitar dependencia circular usando import dinámico
                const MessageFlowModule = await import('./MessageFlow');
                return gotoFlow(MessageFlowModule.default);
                
              default:
                logger.warn(`[MessageFlow] Tipo de nodo no reconocido para navegación automática: ${nextNodeType}`);
            }
          } catch (error) {
            logger.error(`[MessageFlow] Error en navegación automática:`, error);
          }
        }
        
        logger.info(`[MessageFlow] Navegación automática completada`);
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAction:`, error);
        await flowDynamic(['Ocurrió un error al mostrar el mensaje.']);
      }
    });
};

/**
 * Flujo de mensaje que SÍ espera respuesta (interactivo)
 */
const createInteractiveMessageFlow = () => {
  return addKeyword(['MESSAGE_WITH_CAPTURE', 'message_with_capture'])
    .addAction(async (ctx, { flowDynamic, state }) => {
      try {
        logger.info(`[MessageFlow] Mostrando mensaje interactivo para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const nodeData = currentState.nodeData || {};
        
        // Obtener mensaje del nodo
        let message = nodeData.data?.message || nodeData.message || nodeData.content || 'Mensaje sin contenido';
        
        // SOLUCIÓN: Cargar variables del sistema para el tenant
        const tenantId = currentState.tenantId || currentState.metadata?.tenantId;
        let systemVariables = {};
        
        if (tenantId) {
          try {
            const { getSystemVariablesForTenant } = await import('../../utils/systemVariablesLoader');
            systemVariables = await getSystemVariablesForTenant(tenantId);
            logger.debug(`[MessageFlow] Variables del sistema cargadas para tenant ${tenantId}:`, Object.keys(systemVariables));
          } catch (error) {
            logger.error(`[MessageFlow] Error cargando variables del sistema:`, error);
          }
        }
        
        // Reemplazar variables en el mensaje
        const variables = {
          ...systemVariables,
          ...currentState.globalVars,
          nombre: currentState.globalVars?.name || currentState.globalVars?.lead_name || '',
          nombre_lead: currentState.globalVars?.lead_name || currentState.globalVars?.name || '',
          categoria_seleccionada: currentState.selectedCategory || '',
          producto_seleccionado: currentState.selectedProduct || ''
        };
        
        logger.debug(`[MessageFlow] Variables combinadas para reemplazo:`, Object.keys(variables));
        message = replaceVariables(message, variables);
        
        // IMPORTANTE: Procesar acciones del sales funnel si el nodo tiene salesStageId
        if (nodeData.salesStageId) {
          logger.info(`[MessageFlow] Procesando sales funnel con stageId: ${nodeData.salesStageId}`);
          await processSalesFunnelActions(
            {
              id: nodeData.id,
              type: 'message',
              content: nodeData.message || nodeData.content || '',
              metadata: { salesStageId: nodeData.salesStageId },
              data: { salesStageId: nodeData.salesStageId }
            },
            currentState as any
          );
        }
        
        // Enviar mensaje al usuario
        await flowDynamic([message]);
        
        logger.info(`[MessageFlow] El nodo ESPERA respuesta. Configurando estado para captura...`);
        await state.update({
          ...currentState,
          awaitingResponse: true,
          currentNodeType: 'message',
          currentNodeId: nodeData.id,
          lastMessageSent: message,
          waitingForUserInput: true
        });
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAction interactivo:`, error);
        await flowDynamic(['Ocurrió un error al mostrar el mensaje.']);
      }
    })
    .addAnswer('', { capture: true }, async (ctx, { state, gotoFlow }) => {
      try {
        logger.info(`[MessageFlow] Respuesta del usuario: ${ctx.body}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const nodeData = currentState.nodeData || {};
        
        // Actualizar estado
        await state.update({
          ...currentState,
          awaitingResponse: false,
          userResponse: ctx.body
        });
        
        // Determinar siguiente flujo basado en edges del nodo
        const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
        if (nextEdge && nextEdge.targetNode) {
          logger.info(`[MessageFlow] Navegando al siguiente nodo: ${nextEdge.targetNode.type}`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...state.getMyState(),
            nodeData: nextEdge.targetNode,
            previousNodeId: nodeData.id,
            currentNodeId: nextEdge.targetNode.id
          });
          
          // Navegar según el tipo de nodo
          const nextNodeType = nextEdge.targetNode.type?.toLowerCase();
          switch (nextNodeType) {
            case 'categories':
            case 'categoriesnode':
              const CategoriesFlow = (await import('./CategoriesFlow')).default;
              return gotoFlow(CategoriesFlow);
            case 'products':
            case 'productsnode':
              const ProductsFlow = (await import('./ProductsFlow')).default;
              return gotoFlow(ProductsFlow);
            case 'buttons':
            case 'buttonsnode':
              const ButtonsFlow = (await import('./ButtonsFlow')).default;
              return gotoFlow(ButtonsFlow);
            case 'input':
            case 'inputnode':
              const InputFlow = (await import('./InputFlow')).default;
              return gotoFlow(InputFlow);
            case 'message':
            case 'messagenode':
              const MessageFlowModule = await import('./MessageFlow');
              return gotoFlow(MessageFlowModule.default);
            default:
              logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextNodeType}`);
          }
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAnswer:`, error);
      }
    });
};

/**
 * Flujo principal que decide dinámicamente cuál usar
 */
const createMessageFlow = () => {
  return addKeyword(['MESSAGE', 'message', 'MENSAJE', 'mensaje'])
    .addAction(async (ctx, { state, gotoFlow }) => {
      try {
        logger.info(`[MessageFlow] Determinando tipo de flujo para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const nodeData = currentState.nodeData || {};
        
        // CORRECCIÓN: Verificar correctamente si debe esperar respuesta
        const shouldWaitForResponse = !(nodeData.data?.capture === false || 
                                      nodeData.capture === false || 
                                      nodeData.data?.waitForResponse === false || 
                                      nodeData.waitForResponse === false);

        logger.info(`[MessageFlow] Configuración del nodo:`, {
          nodeId: nodeData.id,
          'data.capture': nodeData.data?.capture,
          'capture': nodeData.capture,
          'data.waitForResponse': nodeData.data?.waitForResponse,
          'waitForResponse': nodeData.waitForResponse,
          'shouldWaitForResponse': shouldWaitForResponse
        });
        
        if (!shouldWaitForResponse) {
          logger.info(`[MessageFlow] Usando flujo NO interactivo (sin capture)`);
          const nonInteractiveFlow = createNonInteractiveMessageFlow();
          return gotoFlow(nonInteractiveFlow);
        } else {
          logger.info(`[MessageFlow] Usando flujo interactivo (con capture)`);
          const interactiveFlow = createInteractiveMessageFlow();
          return gotoFlow(interactiveFlow);
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error determinando tipo de flujo:`, error);
      }
    });
};

// CORRECCIÓN: Exportar la función en lugar de ejecutarla inmediatamente para evitar dependencias circulares
const MessageFlow = createMessageFlow();
export default MessageFlow;

// Exportar también los flujos específicos para uso interno
export { createNonInteractiveMessageFlow, createInteractiveMessageFlow };