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
 * Flujo de mensaje simple
 * Muestra un mensaje y continúa al siguiente nodo
 */
const createMessageFlow = () => {
  return addKeyword(['MESSAGE', 'message', 'MENSAJE', 'mensaje'])
    .addAction(async (ctx, { flowDynamic, state }) => {
      try {
        logger.info(`[MessageFlow] Mostrando mensaje para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const nodeData = currentState.nodeData || {};
        
        // Obtener mensaje del nodo
        let message = nodeData.message || nodeData.content || 'Mensaje sin contenido';
        
        // Reemplazar variables en el mensaje
        const variables = {
          ...currentState.globalVars,
          nombre: currentState.globalVars?.name || currentState.globalVars?.lead_name || '',
          nombre_lead: currentState.globalVars?.lead_name || currentState.globalVars?.name || '',
          categoria_seleccionada: currentState.selectedCategory || '',
          producto_seleccionado: currentState.selectedProduct || ''
        };
        
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
            currentState
          );
        }
        
        // Enviar mensaje al usuario
        await flowDynamic([message]);
        
        // Si el nodo no espera respuesta, continuar automáticamente
        if (!nodeData.waitForResponse) {
          logger.info(`[MessageFlow] El nodo no espera respuesta, continuando...`);
          
          // Determinar siguiente flujo basado en edges del nodo
          const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
          if (nextEdge && nextEdge.targetNode) {
            logger.info(`[MessageFlow] Navegando automáticamente al siguiente nodo: ${nextEdge.targetNode.type}`);
            
            // Actualizar estado con información del siguiente nodo
            await state.update({
              ...currentState,
              nodeData: nextEdge.targetNode,
              previousNodeId: nodeData.id
            });
            
            // Simular navegación automática
            setTimeout(async () => {
              const { gotoFlow } = require('@builderbot/bot');
              switch (nextEdge.targetNode.type?.toLowerCase()) {
                case 'categories':
                case 'categoriesnode':
                  const CategoriesFlow = require('./CategoriesFlow').default;
                  return gotoFlow(CategoriesFlow);
                case 'products':
                case 'productsnode':
                  const ProductsFlow = require('./ProductsFlow').default;
                  return gotoFlow(ProductsFlow);
                case 'input':
                case 'inputnode':
                  const InputFlow = require('./InputFlow').default;
                  return gotoFlow(InputFlow);
                default:
                  logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
              }
            }, 100);
          }
        } else {
          // Si espera respuesta, actualizar estado
          await state.update({
            ...currentState,
            awaitingResponse: true,
            currentNodeType: 'message',
            currentNodeId: nodeData.id
          });
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAction:`, error);
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
          awaitingResponse: false
        });
        
        // Determinar siguiente flujo basado en edges del nodo
        const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
        if (nextEdge && nextEdge.targetNode) {
          logger.info(`[MessageFlow] Navegando al siguiente nodo: ${nextEdge.targetNode.type}`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...state.getMyState(),
            nodeData: nextEdge.targetNode,
            previousNodeId: nodeData.id
          });
          
          // Navegar según el tipo de nodo
          switch (nextEdge.targetNode.type?.toLowerCase()) {
            case 'categories':
            case 'categoriesnode':
              const CategoriesFlow = require('./CategoriesFlow').default;
              return gotoFlow(CategoriesFlow);
            case 'products':
            case 'productsnode':
              const ProductsFlow = require('./ProductsFlow').default;
              return gotoFlow(ProductsFlow);
            default:
              logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
          }
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAnswer:`, error);
      }
    });
};

export default createMessageFlow();