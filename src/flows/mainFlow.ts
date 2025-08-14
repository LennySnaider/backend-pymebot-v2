/**
 * src/flows/mainFlow.ts
 * 
 * Orquestador principal de flujos modulares
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../utils/logger';
import * as ModularFlows from './nodes';

/**
 * Crea el flujo principal que actúa como orquestador
 * @param templateData Datos de la plantilla React Flow
 * @param tenantId ID del tenant
 */
export function createMainFlow(templateData: any, tenantId: string) {
  return addKeyword(['INICIO', 'inicio', 'START', 'start', 'hola', 'hi', 'hello'])
    .addAction(async (ctx, { state, gotoFlow }) => {
      try {
        logger.info(`[MainFlow] Iniciando flujo principal para usuario: ${ctx.from}, tenant: ${tenantId}`);
        
        // Determinar nodo inicial del template
        const nodes = templateData.nodes || {};
        const edges = templateData.edges || [];
        
        // Buscar nodo inicial (nodo sin edges entrantes)
        const nodeIds = Object.keys(nodes);
        const targetNodeIds = new Set(edges.map(edge => edge.target));
        const initialNodeId = nodeIds.find(id => !targetNodeIds.has(id));
        
        if (!initialNodeId) {
          logger.error(`[MainFlow] No se pudo determinar nodo inicial para template`);
          return;
        }
        
        const initialNode = nodes[initialNodeId];
        logger.info(`[MainFlow] Nodo inicial determinado: ${initialNodeId} (${initialNode.type})`);
        
        // Preparar información de edges para el nodo - INCLUIR TODOS LOS EDGES
        const allEdgesWithTargetNodes = edges.map(edge => ({
          ...edge,
          targetNode: nodes[edge.target]
        }));
        
        const nodeEdges = edges.filter(edge => edge.source === initialNodeId).map(edge => ({
          ...edge,
          targetNode: nodes[edge.target]
        }));
        
        logger.info(`[MainFlow] Edges preparados:`, {
          totalEdges: edges.length,
          nodeEdges: nodeEdges.length,
          allEdgesCount: allEdgesWithTargetNodes.length,
          nodeEdgesDetail: nodeEdges.map(e => ({ source: e.source, target: e.target, targetType: e.targetNode?.type }))
        });
        
        // Inicializar estado global con estructura V1
        const initialState = {
          tenantId: tenantId,
          templateId: templateData.id,
          currentNodeId: initialNodeId,
          nodeData: {
            ...initialNode,
            edges: allEdgesWithTargetNodes // CRÍTICO: Usar TODOS los edges con targetNodes
          },
          globalVars: {
            // Variables iniciales que pueden ser utilizadas por cualquier nodo
            tenantId: tenantId,
            templateId: templateData.id,
            startTime: new Date().toISOString()
          },
          awaitingResponse: false,
          // Preservar contexto para el sistema de leads
          _metadata: ctx._metadata || {},
          sessionId: ctx._sessionId || ctx._metadata?.sessionId,
          leadId: ctx.leadId || ctx._metadata?.leadId
        };
        
        await state.update(initialState);
        
        logger.info(`[MainFlow] Estado inicial configurado:`, {
          tenantId,
          nodeId: initialNodeId,
          nodeType: initialNode.type,
          hasEdges: nodeEdges.length > 0
        });
        
        // Determinar si el nodo inicial usa arquitectura modular
        const nodeType = initialNode.type?.toLowerCase();
        
        if (shouldUseModularFlow(nodeType)) {
          logger.info(`[MainFlow] Usando flujo modular para nodo tipo: ${nodeType}`);
          
          const modularFlow = getModularFlow(nodeType);
          if (modularFlow) {
            return gotoFlow(modularFlow);
          } else {
            logger.error(`[MainFlow] No se encontró flujo modular para tipo: ${nodeType}`);
          }
        } else {
          logger.info(`[MainFlow] Nodo tipo ${nodeType} no usa arquitectura modular, buscando siguiente nodo...`);
          
          // Si el nodo inicial no es modular, buscar el primer nodo modular en la cadena
          const nextEdge = nodeEdges.find(edge => edge.targetNode);
          if (nextEdge && nextEdge.targetNode) {
            const nextNodeType = nextEdge.targetNode.type?.toLowerCase();
            logger.info(`[MainFlow] Verificando siguiente nodo: ${nextEdge.targetNode.id} (${nextNodeType})`);
            
            if (shouldUseModularFlow(nextNodeType)) {
              logger.info(`[MainFlow] Navegando al flujo modular: ${nextNodeType}`);
              
              // Actualizar estado con el siguiente nodo
              await state.update({
                ...initialState,
                currentNodeId: nextEdge.targetNode.id,
                nodeData: {
                  ...nextEdge.targetNode,
                  edges: allEdgesWithTargetNodes // CRÍTICO: Usar TODOS los edges para permitir navegación
                }
              });
              
              const modularFlow = getModularFlow(nextNodeType);
              if (modularFlow) {
                return gotoFlow(modularFlow);
              }
            }
          }
          
          logger.warn(`[MainFlow] No se encontró flujo modular, usando fallback`);
        }
        
      } catch (error) {
        logger.error(`[MainFlow] Error en mainFlow:`, error);
      }
    });
}

/**
 * Verifica si un nodo debe usar la arquitectura modular
 */
function shouldUseModularFlow(nodeType: string): boolean {
  const modularNodeTypes = [
    'categories', 'categoriesnode', 'categories-node',
    'products', 'productsnode', 'products-node', 
    'message', 'messagenode', 'message-node',
    'input', 'inputnode', 'input-node',
    'buttons', 'buttonsnode', 'buttons-node'
  ];
  
  return modularNodeTypes.includes(nodeType.toLowerCase());
}

/**
 * Obtiene el flujo modular correspondiente al tipo de nodo
 */
function getModularFlow(nodeType: string): any {
  switch (nodeType.toLowerCase()) {
    case 'categories':
    case 'categoriesnode':
    case 'categories-node':
      return ModularFlows.CategoriesFlow;
    
    case 'products':
    case 'productsnode':
    case 'products-node':
      return ModularFlows.ProductsFlow;
    
    case 'message':
    case 'messagenode':
    case 'message-node':
      return ModularFlows.MessageFlow;
    
    case 'input':
    case 'inputnode':
    case 'input-node':
      return ModularFlows.InputFlow;
    
    case 'buttons':
    case 'buttonsnode':
    case 'buttons-node':
      return ModularFlows.ButtonsFlow;
    
    default:
      logger.warn(`[MainFlow] Tipo de nodo modular no reconocido: ${nodeType}`);
      return null;
  }
}

/**
 * Crea un flujo de fallback para casos donde no se puede determinar el flujo
 */
export function createFallbackFlow() {
  return addKeyword(['FALLBACK', 'fallback', 'error'])
    .addAnswer('Lo siento, ocurrió un error en el sistema. Por favor intenta nuevamente.', 
      null, 
      async (ctx, { flowDynamic }) => {
        logger.error(`[MainFlow] Flujo de fallback activado para usuario: ${ctx.from}`);
        await flowDynamic(['Si el problema persiste, contacta con soporte.']);
      }
    );
}