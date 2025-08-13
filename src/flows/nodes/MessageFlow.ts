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
        
        // Logs informativos para debugging si es necesario (comentados para producción)
        // logger.info(`[MessageFlow] currentState:`, Object.keys(currentState));
        // logger.info(`[MessageFlow] nodeData.data?.message:`, nodeData.data?.message);
        
        // Obtener mensaje del nodo - CORREGIDO para buscar en nodeData.data.message
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
        
        // Reemplazar variables en el mensaje - SOLUCIÓN: Incluir variables del sistema
        const variables = {
          ...systemVariables, // PRIMERO las variables del sistema
          ...currentState.globalVars, // Luego las variables de contexto
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
              try {
                const { gotoFlow } = await import('@builderbot/bot');
                switch (nextEdge.targetNode.type?.toLowerCase()) {
                  case 'categories':
                  case 'categoriesnode':
                    const CategoriesFlow = (await import('./CategoriesFlow')).default;
                    return gotoFlow(CategoriesFlow);
                  case 'products':
                  case 'productsnode':
                    const ProductsFlow = (await import('./ProductsFlow')).default;
                    return gotoFlow(ProductsFlow);
                  case 'input':
                  case 'inputnode':
                    const InputFlow = (await import('./InputFlow')).default;
                    return gotoFlow(InputFlow);
                  default:
                    logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
                }
              } catch (error) {
                logger.error(`[MessageFlow] Error en navegación automática:`, error);
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