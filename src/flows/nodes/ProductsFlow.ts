/**
 * src/flows/nodes/ProductsFlow.ts
 * 
 * Nodo modular para mostrar productos/servicios filtrados por categoría
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../../utils/logger';
import { getTenantProducts } from '../../services/categoriesService';
import { processSalesFunnelActions } from '../../services/salesFunnelService';

/**
 * Flujo de productos
 * Muestra los productos filtrados por la categoría seleccionada previamente
 */
const createProductsFlow = () => {
  return addKeyword(['PRODUCTOS', 'productos', 'PRODUCTS', 'products', 'SERVICIOS', 'servicios'])
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
      try {
        logger.info(`[ProductsFlow] Iniciando flujo de productos para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const tenantId = currentState.tenantId || ctx._metadata?.tenantId;
        const nodeData = currentState.nodeData || {};
        
        // Obtener categoría seleccionada del estado global
        const selectedCategory = currentState.selectedCategory || 
                                currentState.globalVars?.selectedCategory ||
                                currentState.globalVars?.category_name ||
                                '';
        
        logger.info(`[ProductsFlow] TenantId: ${tenantId}, Categoría seleccionada: "${selectedCategory}"`);
        
        // Obtener mensaje del nodo
        const message = nodeData.message || "Selecciona el servicio que necesitas:";
        
        // Obtener productos filtrados por categoría
        const products = await getTenantProducts(tenantId, selectedCategory);
        
        if (!products || products.length === 0) {
          await flowDynamic(['Lo siento, no hay productos disponibles en esta categoría.']);
          return;
        }
        
        // Generar lista de productos con números
        const productsList = products.map((prod, index) => `${index + 1}. ${prod}`).join('\n');
        const fullMessage = message + "\n\n" + productsList;
        
        // Actualizar estado para indicar que esperamos respuesta
        await state.update({
          ...currentState,
          awaitingResponse: true,
          availableProducts: products,
          currentNodeType: 'products',
          currentNodeId: nodeData.id
        });
        
        // Enviar mensaje al usuario
        await flowDynamic([fullMessage]);
        
        logger.info(`[ProductsFlow] Productos mostrados (${products.length}): ${products.join(', ')}`);
        
      } catch (error) {
        logger.error(`[ProductsFlow] Error en addAction:`, error);
        await flowDynamic(['Ocurrió un error al cargar los productos. Por favor intenta nuevamente.']);
      }
    })
    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, gotoFlow }) => {
      try {
        logger.info(`[ProductsFlow] Respuesta del usuario: ${ctx.body}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const products = currentState.availableProducts || [];
        const nodeData = currentState.nodeData || {};
        
        // Mapear respuesta del usuario a producto válido
        const userInput = ctx.body.toLowerCase().trim();
        let selectedProduct = '';
        
        // Intentar mapear por número
        const inputNumber = parseInt(userInput);
        if (!isNaN(inputNumber) && inputNumber >= 1 && inputNumber <= products.length) {
          selectedProduct = products[inputNumber - 1];
        } else {
          // Intentar mapear por texto
          const foundProduct = products.find(prod => 
            prod.toLowerCase().includes(userInput) || userInput.includes(prod.toLowerCase())
          );
          selectedProduct = foundProduct || '';
        }
        
        if (!selectedProduct) {
          await flowDynamic(['Por favor selecciona una opción válida del menú.']);
          await state.update({ ...currentState, awaitingResponse: true });
          return;
        }
        
        logger.info(`[ProductsFlow] Producto seleccionado: ${selectedProduct}`);
        
        // Actualizar estado con el producto seleccionado
        await state.update({
          ...currentState,
          selectedProduct: selectedProduct,
          globalVars: {
            ...currentState.globalVars,
            selectedProduct: selectedProduct,
            products_list: selectedProduct,
            servicio_seleccionado: selectedProduct
          },
          awaitingResponse: false
        });
        
        // IMPORTANTE: Procesar acciones del sales funnel si el nodo tiene salesStageId
        if (nodeData.salesStageId) {
          logger.info(`[ProductsFlow] Procesando sales funnel con stageId: ${nodeData.salesStageId}`);
          await processSalesFunnelActions(
            {
              id: nodeData.id,
              type: 'products',
              content: nodeData.message || '',
              metadata: { salesStageId: nodeData.salesStageId },
              data: { salesStageId: nodeData.salesStageId }
            },
            currentState as any
          );
        }
        
        // Mensaje de confirmación
        await flowDynamic([`Excelente elección! Has seleccionado: ${selectedProduct}`]);
        
        // Determinar siguiente flujo basado en edges del nodo
        const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
        if (nextEdge && nextEdge.targetNode) {
          logger.info(`[ProductsFlow] Navegando al siguiente nodo: ${nextEdge.targetNode.type}`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...state.getMyState(),
            nodeData: nextEdge.targetNode,
            previousNodeId: nodeData.id
          });
          
          // Navegar según el tipo de nodo
          switch (nextEdge.targetNode.type?.toLowerCase()) {
            case 'message':
            case 'messagenode':
              const MessageModule = await import('./MessageFlow');
              const MessageFlow = MessageModule.default || MessageModule;
              return gotoFlow(MessageFlow);
            case 'input':
            case 'inputnode':
              const InputModule = await import('./InputFlow');
              const InputFlow = InputModule.default || InputModule;
              return gotoFlow(InputFlow);
            case 'ai':
            case 'ainode':
              const AIModule = await import('./AIFlow');
              const AIFlow = AIModule.default || AIModule;
              return gotoFlow(AIFlow);
            default:
              logger.warn(`[ProductsFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
          }
        }
        
      } catch (error) {
        logger.error(`[ProductsFlow] Error en addAnswer:`, error);
        await flowDynamic(['Ocurrió un error al procesar tu selección. Por favor intenta nuevamente.']);
      }
    });
};

export default createProductsFlow();