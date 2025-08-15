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
 * Muestra un mensaje y maneja navegación automática basada en capture
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
        
        // Enviar mensaje al usuario SIEMPRE
        await flowDynamic([message]);
        
        // CORRECCIÓN CRÍTICA: Verificar si debe navegar automáticamente
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
          'shouldWaitForResponse': shouldWaitForResponse,
          'hasEdges': !!(nodeData.edges?.length),
          'edgesCount': nodeData.edges?.length || 0
        });

        // NAVEGACIÓN AUTOMÁTICA: Solo si NO debe esperar respuesta
        if (!shouldWaitForResponse) {
          logger.info(`[MessageFlow] El nodo NO espera respuesta, navegando automáticamente...`);
          
          // Determinar siguiente flujo basado en edges del nodo
          const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
          if (nextEdge && nextEdge.targetNode) {
            const nextNodeType = nextEdge.targetNode.type?.toLowerCase();
            logger.info(`[MessageFlow] Edge encontrado - navegando automáticamente a: ${nextEdge.targetNode.id} (${nextNodeType})`);
            
            // Actualizar estado con información del siguiente nodo
            await state.update({
              ...currentState,
              nodeData: {
                ...nextEdge.targetNode,
                edges: nodeData.edges // Preservar edges para próximas navegaciones
              },
              previousNodeId: nodeData.id,
              currentNodeId: nextEdge.targetNode.id
            });
            
            // Navegar según el tipo de nodo usando gotoFlow
            try {
              switch (nextNodeType) {
                case 'categories':
                case 'categoriesnode':
                  const CategoriesModule = await import('./CategoriesFlow');
                  const CategoriesFlow = CategoriesModule.default || CategoriesModule;
                  return gotoFlow(CategoriesFlow);
                  
                case 'products':
                case 'productsnode':
                  const ProductsModule = await import('./ProductsFlow');
                  const ProductsFlow = ProductsModule.default || ProductsModule;
                  return gotoFlow(ProductsFlow);
                  
                case 'buttons':
                case 'buttonsnode':
                  const ButtonsModule = await import('./ButtonsFlow');
                  const ButtonsFlow = ButtonsModule.default || ButtonsModule;
                  return gotoFlow(ButtonsFlow);
                  
                case 'input':
                case 'inputnode':
                  const InputModule = await import('./InputFlow');
                  const InputFlow = InputModule.default || InputModule;
                  return gotoFlow(InputFlow);
                  
                case 'message':
                case 'messagenode':
                  // CORRECCIÓN: Para nodos de mensaje, continúa sin capture en lugar de navegar circularmente
                  logger.info(`[MessageFlow] Nodo de mensaje detectado, terminando flujo sin navegación circular`);
                  return;
                  
                default:
                  logger.warn(`[MessageFlow] Tipo de nodo no reconocido para navegación automática: ${nextNodeType}`);
                  // Si no reconoce el tipo, continuar con el flujo normal sin captura
              }
            } catch (error) {
              logger.error(`[MessageFlow] Error en navegación automática:`, error);
            }
          } else {
            logger.warn(`[MessageFlow] No se encontró edge válido para navegación automática. nodeData.edges:`, nodeData.edges);
          }
          
          // IMPORTANTE: Si no espera respuesta y no pudo navegar, terminar el flujo aquí
          logger.info(`[MessageFlow] Terminando flujo sin capture - mensaje enviado`);
          return;
        }
        
        // CONFIGURAR PARA ESPERAR RESPUESTA
        logger.info(`[MessageFlow] El nodo SÍ espera respuesta, configurando para capture...`);
        await state.update({
          ...currentState,
          awaitingResponse: true,
          currentNodeType: 'message',
          currentNodeId: nodeData.id,
          lastMessageSent: message,
          waitingForUserInput: true
        });
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAction:`, error);
        await flowDynamic(['Ocurrió un error al mostrar el mensaje.']);
      }
    })
    .addAnswer('', { capture: true }, async (ctx, { state, gotoFlow }) => {
      try {
        logger.info(`[MessageFlow] Respuesta del usuario recibida: ${ctx.body}`);
        
        // Obtener estado actual en runtime
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
          logger.info(`[MessageFlow] Navegando al siguiente nodo después de respuesta: ${nextEdge.targetNode.type}`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...state.getMyState(),
            nodeData: {
              ...nextEdge.targetNode,
              edges: nodeData.edges // Preservar edges
            },
            previousNodeId: nodeData.id,
            currentNodeId: nextEdge.targetNode.id
          });
          
          // Navegar según el tipo de nodo
          const nextNodeType = nextEdge.targetNode.type?.toLowerCase();
          switch (nextNodeType) {
            case 'categories':
            case 'categoriesnode':
              const CategoriesModule2 = await import('./CategoriesFlow');
              const CategoriesFlow2 = CategoriesModule2.default || CategoriesModule2;
              return gotoFlow(CategoriesFlow2);
            case 'products':
            case 'productsnode':
              const ProductsModule2 = await import('./ProductsFlow');
              const ProductsFlow2 = ProductsModule2.default || ProductsModule2;
              return gotoFlow(ProductsFlow2);
            case 'buttons':
            case 'buttonsnode':
              const ButtonsModule2 = await import('./ButtonsFlow');
              const ButtonsFlow2 = ButtonsModule2.default || ButtonsModule2;
              return gotoFlow(ButtonsFlow2);
            case 'input':
            case 'inputnode':
              const InputModule2 = await import('./InputFlow');
              const InputFlow2 = InputModule2.default || InputModule2;
              return gotoFlow(InputFlow2);
            case 'message':
            case 'messagenode':
              // CORRECCIÓN: Para nodos de mensaje, no navegar circularmente
              logger.info(`[MessageFlow] Nodo de mensaje detectado después de respuesta, terminando flujo`);
              return;
            default:
              logger.warn(`[MessageFlow] Tipo de nodo no reconocido: ${nextNodeType}`);
          }
        }
        
      } catch (error) {
        logger.error(`[MessageFlow] Error en addAnswer:`, error);
      }
    });
};

// CORRECCIÓN: Exportar la función en lugar de ejecutarla inmediatamente para evitar dependencias circulares
const MessageFlow = createMessageFlow();
export default MessageFlow;