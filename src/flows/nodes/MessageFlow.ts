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
        
        // NAVEGACIÓN AUTOMÁTICA PARA NODOS QUE NO ESPERAN RESPUESTA
        if (!nodeData.waitForResponse && !nodeData.capture) {
          logger.info(`[MessageFlow] El nodo no espera respuesta, navegando automáticamente...`);
          
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
                  // Para mensajes consecutivos, simplemente continúa en el mismo flujo
                  return gotoFlow(createMessageFlow());
                  
                default:
                  logger.warn(`[MessageFlow] Tipo de nodo no reconocido para navegación automática: ${nextNodeType}`);
              }
            } catch (error) {
              logger.error(`[MessageFlow] Error en navegación automática:`, error);
            }
          }
        } else {
          // Si espera respuesta, actualizar estado para captura
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
          try {
            switch (nextEdge.targetNode.type?.toLowerCase()) {
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
              default:
                logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
            }
          } catch (error) {
            logger.error(`[MessageFlow] Error importando flujo:`, error);
          }
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAnswer:`, error);
      }
    });
};

export default createMessageFlow();