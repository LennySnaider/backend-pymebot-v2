/**
 * Convertidor simple de templates con soporte para branching de botones
 * Usando keywords para cada rama
 */

import { createFlow, addKeyword } from '@builderbot/bot';
import logger from '../utils/logger';

export async function convertTemplateWithBranching(templateId: string): Promise<any> {
  try {
    logger.info(`Iniciando conversión con branching para plantilla: ${templateId}`);
    
    // Cargar la plantilla
    const { getTemplateById } = await import('./supabase');
    const template = await getTemplateById(templateId);
    
    if (!template?.react_flow_json) {
      throw new Error('Plantilla no válida');
    }
    
    const { nodes: nodeArray = [], edges = [] } = template.react_flow_json;
    
    // Convertir array de nodos a mapa
    const nodes: Record<string, any> = {};
    nodeArray.forEach((node: any) => {
      nodes[node.id] = node;
    });
    
    // Encontrar el nodo inicial
    const startNode = nodeArray.find((n: any) => n.type === 'startNode');
    if (!startNode) {
      throw new Error('No se encontró nodo inicial');
    }
    
    // Crear todos los flujos
    const flows: any[] = [];
    const processedNodes = new Set<string>();
    
    // Flujo principal
    const mainFlow = createMainFlow(startNode, nodes, edges, processedNodes);
    flows.push(mainFlow);
    
    // Crear flujos para cada rama de botones
    nodeArray.forEach((node: any) => {
      if (node.type === 'buttonsNode') {
        const buttons = node.data?.buttons || [];
        buttons.forEach((btn: any, index: number) => {
          const edge = edges.find((e: any) => 
            e.source === node.id && e.sourceHandle === `handle-${index}`
          );
          
          if (edge) {
            const branchFlow = createBranchFlow(
              btn.text || btn.label,
              edge.target,
              nodes,
              edges,
              processedNodes
            );
            flows.push(branchFlow);
          }
        });
      }
    });
    
    return createFlow(flows);
    
  } catch (error) {
    logger.error('Error en conversión:', error);
    throw error;
  }
}

function createMainFlow(startNode: any, nodes: any, edges: any[], processedNodes: Set<string>) {
  let flow = addKeyword(['hola', 'HOLA', 'inicio', 'INICIO']);
  
  // Obtener el primer nodo después del inicio
  const firstEdge = edges.find(e => e.source === startNode.id);
  if (firstEdge) {
    flow = processNode(firstEdge.target, flow, nodes, edges, processedNodes);
  }
  
  return flow;
}

function createBranchFlow(keyword: string, startNodeId: string, nodes: any, edges: any[], processedNodes: Set<string>) {
  logger.info(`Creando flujo para rama: ${keyword} desde nodo ${startNodeId}`);
  let flow = addKeyword([keyword]);
  return processNode(startNodeId, flow, nodes, edges, processedNodes);
}

function processNode(nodeId: string, flow: any, nodes: any, edges: any[], processedNodes: Set<string>): any {
  if (processedNodes.has(nodeId)) {
    return flow;
  }
  
  const node = nodes[nodeId];
  if (!node) {
    return flow;
  }
  
  processedNodes.add(nodeId);
  
  switch (node.type) {
    case 'messageNode':
      const message = node.data?.message || '';
      flow = flow.addAnswer(message);
      break;
      
    case 'inputNode':
      const question = node.data?.question || '';
      const variableName = node.data?.variableName || 'input';
      flow = flow.addAnswer(question, { capture: true }, async (ctx: any, { state }: any) => {
        await state.update({ [variableName]: ctx.body });
      });
      break;
      
    case 'buttonsNode':
      const text = node.data?.message || '';
      const buttons = node.data?.buttons || [];
      const waitForResponse = node.data?.waitForResponse !== false;
      
      if (buttons.length > 0 && waitForResponse) {
        const buttonsFormatted = buttons.map((btn: any) => ({ 
          body: btn.text || btn.label 
        }));
        
        flow = flow.addAnswer(text, { 
          buttons: buttonsFormatted,
          capture: true
        });
        
        // Los botones manejarán sus propias ramas, no continuar
        return flow;
      } else {
        flow = flow.addAnswer(text);
      }
      break;
  }
  
  // Continuar con el siguiente nodo
  const nextEdge = edges.find(e => e.source === nodeId && !e.sourceHandle);
  if (nextEdge) {
    return processNode(nextEdge.target, flow, nodes, edges, processedNodes);
  }
  
  return flow;
}

export default convertTemplateWithBranching;