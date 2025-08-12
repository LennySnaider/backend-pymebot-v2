/**
 * src/flows/nodes/CategoriesFlow.ts
 * 
 * Nodo modular para mostrar categorías de productos/servicios
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../../utils/logger';
import { getTenantProductCategories } from '../../services/categoriesService';
import { processSalesFunnelActions } from '../../services/salesFunnelService';

/**
 * Flujo de categorías
 * Muestra las categorías disponibles y captura la selección del usuario
 */
const createCategoriesFlow = () => {
  return addKeyword(['CATEGORIAS', 'categorias', 'CATEGORIES', 'categories'])
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
      try {
        logger.info(`[CategoriesFlow] Iniciando flujo de categorías para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const tenantId = currentState.tenantId || ctx._metadata?.tenantId;
        const nodeData = currentState.nodeData || {};
        
        logger.info(`[CategoriesFlow] TenantId: ${tenantId}, NodeData:`, nodeData);
        
        // Obtener mensaje del nodo
        const message = nodeData.message || "Por favor selecciona una categoría:";
        
        // Obtener categorías dinámicas
        const categories = await getTenantProductCategories(tenantId, 'bienes_raices');
        
        if (!categories || categories.length === 0) {
          await flowDynamic(['Lo siento, no hay categorías disponibles en este momento.']);
          return;
        }
        
        // Generar lista de categorías con números
        const categoriesList = categories.map((cat, index) => `${index + 1}. ${cat}`).join('\n');
        const fullMessage = message + "\n\n" + categoriesList;
        
        // Actualizar estado para indicar que esperamos respuesta
        await state.update({
          ...currentState,
          awaitingResponse: true,
          availableCategories: categories,
          currentNodeType: 'categories',
          currentNodeId: nodeData.id
        });
        
        // Enviar mensaje al usuario
        await flowDynamic([fullMessage]);
        
        logger.info(`[CategoriesFlow] Categorías mostradas: ${categories.join(', ')}`);
        
      } catch (error) {
        logger.error(`[CategoriesFlow] Error en addAction:`, error);
        await flowDynamic(['Ocurrió un error al cargar las categorías. Por favor intenta nuevamente.']);
      }
    })
    .addAnswer('', { capture: true }, async (ctx, { flowDynamic, state, gotoFlow }) => {
      try {
        logger.info(`[CategoriesFlow] Respuesta del usuario: ${ctx.body}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const categories = currentState.availableCategories || [];
        const nodeData = currentState.nodeData || {};
        
        // Mapear respuesta del usuario a categoría válida
        const userInput = ctx.body.toLowerCase().trim();
        let selectedCategory = '';
        
        // Intentar mapear por número
        const inputNumber = parseInt(userInput);
        if (!isNaN(inputNumber) && inputNumber >= 1 && inputNumber <= categories.length) {
          selectedCategory = categories[inputNumber - 1];
        } else {
          // Intentar mapear por texto
          const foundCategory = categories.find(cat => 
            cat.toLowerCase().includes(userInput) || userInput.includes(cat.toLowerCase())
          );
          selectedCategory = foundCategory || '';
        }
        
        if (!selectedCategory) {
          await flowDynamic(['Por favor selecciona una opción válida del menú.']);
          await state.update({ ...currentState, awaitingResponse: true });
          return;
        }
        
        logger.info(`[CategoriesFlow] Categoría seleccionada: ${selectedCategory}`);
        
        // Actualizar estado con la categoría seleccionada
        await state.update({
          ...currentState,
          selectedCategory: selectedCategory,
          globalVars: {
            ...currentState.globalVars,
            selectedCategory: selectedCategory,
            category_name: selectedCategory,
            categories_selected: selectedCategory
          },
          awaitingResponse: false
        });
        
        // IMPORTANTE: Procesar acciones del sales funnel si el nodo tiene salesStageId
        if (nodeData.salesStageId) {
          logger.info(`[CategoriesFlow] Procesando sales funnel con stageId: ${nodeData.salesStageId}`);
          await processSalesFunnelActions(
            {
              id: nodeData.id,
              type: 'categories',
              content: nodeData.message || '',
              metadata: { salesStageId: nodeData.salesStageId },
              data: { salesStageId: nodeData.salesStageId }
            },
            currentState
          );
        }
        
        // Mensaje de confirmación
        await flowDynamic([`Perfecto! Has seleccionado: ${selectedCategory}`]);
        
        // Determinar siguiente flujo basado en edges del nodo
        const nextEdge = nodeData.edges?.find(edge => edge.source === nodeData.id);
        if (nextEdge && nextEdge.targetNode) {
          logger.info(`[CategoriesFlow] Navegando al siguiente nodo: ${nextEdge.targetNode.type}`);
          
          // Actualizar estado con información del siguiente nodo
          await state.update({
            ...state.getMyState(),
            nodeData: nextEdge.targetNode,
            previousNodeId: nodeData.id
          });
          
          // Navegar según el tipo de nodo
          switch (nextEdge.targetNode.type?.toLowerCase()) {
            case 'products':
            case 'productsnode':
            case 'products-node':
              const ProductsFlow = require('./ProductsFlow').default;
              return gotoFlow(ProductsFlow);
            case 'message':
            case 'messagenode':
              const MessageFlow = require('./MessageFlow').default;
              return gotoFlow(MessageFlow);
            default:
              logger.warn(`[CategoriesFlow] Tipo de nodo no reconocido: ${nextEdge.targetNode.type}`);
          }
        }
        
      } catch (error) {
        logger.error(`[CategoriesFlow] Error en addAnswer:`, error);
        await flowDynamic(['Ocurrió un error al procesar tu selección. Por favor intenta nuevamente.']);
      }
    });
};

export default createCategoriesFlow();