/**
 * src/services/templateConverterV2.ts
 * 
 * Servicio mejorado para convertir plantillas visuales a flujos de BuilderBot
 * @version 2.0.0
 */

import { createFlow, addKeyword, addAnswer } from '@builderbot/bot';
import logger from '../utils/logger';
import { replaceVariables } from '../utils/variableReplacer';

/**
 * Convierte una plantilla de flujo visual a un flujo de BuilderBot
 * @param templateId ID de la plantilla
 * @returns Flujo compatible con BuilderBot
 */
export async function convertTemplateToBuilderbotFlow(
  templateId: string
): Promise<{ flow: any; entryKeywords: string[]; nodeMap: Record<string, any> }> {
  try {
    logger.info(`Iniciando conversión de plantilla V2: ${templateId}`);
    
    // Cargar la plantilla desde la base de datos
    const { getTemplateById } = await import('./supabase');
    const template = await getTemplateById(templateId);
    
    if (!template) {
      logger.error(`Plantilla no encontrada: ${templateId}`);
      throw new Error(`Plantilla ${templateId} no encontrada`);
    }
    
    // Extraer nodos y edges
    let nodes: Record<string, any> = {};
    let edges: any[] = [];
    let startNodeId: string | undefined;
    
    if (template.react_flow_json && typeof template.react_flow_json === 'object') {
      const templateJson = template.react_flow_json;
      
      if (templateJson.nodes && templateJson.edges && Array.isArray(templateJson.nodes)) {
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
    
    // Configurar palabras clave de entrada
    let entryKeywords = ['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START'];
    const startNode = nodes[startNodeId];
    
    if (startNode?.metadata?.keywords) {
      const customKeywords = Array.isArray(startNode.metadata.keywords) 
        ? startNode.metadata.keywords
        : startNode.metadata.keywords.split(',').map((kw: string) => kw.trim());
      
      customKeywords.forEach((kw: string) => {
        entryKeywords.push(kw.toLowerCase());
        entryKeywords.push(kw.toUpperCase());
      });
    }
    
    if (template.name) {
      entryKeywords.push(template.name.toLowerCase());
      entryKeywords.push(template.name.toUpperCase());
    }
    
    logger.info(`Configurando palabras clave de entrada: ${entryKeywords.join(', ')}`);
    
    // Construir el flujo completo de manera lineal
    let flowChain = addKeyword(entryKeywords as [string, ...string[]]);
    
    // Obtener el primer nodo después del inicio
    const firstNodeId = getNextNodeId(startNode, edges);
    
    if (firstNodeId) {
      // Construir toda la cadena de flujo
      flowChain = buildFlowChain(firstNodeId, flowChain, nodes, edges, new Set<string>());
    } else {
      // Si no hay siguiente nodo, agregar mensaje por defecto
      flowChain = flowChain.addAnswer('Hola, ¿en qué puedo ayudarte?');
    }
    
    // Crear el flujo final
    const createdFlow = createFlow([flowChain]);
    
    logger.info(`Flujo V2 creado exitosamente`);
    
    return {
      flow: createdFlow,
      entryKeywords,
      nodeMap: { [startNodeId]: flowChain }
    };
    
  } catch (error) {
    logger.error('Error al convertir plantilla a flujo BuilderBot V2:', error);
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
  edges: any[],
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
      flowChain = flowChain.addAnswer(messageContent);
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
        await state.update({ [variableName]: ctx.body });
        logger.info(`Variable ${variableName} actualizada con: ${ctx.body}`);
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
        const answerOptions: any = { 
          buttons: buttons.map((btn: any) => ({ 
            body: btn.text || btn.label 
          }))
        };
        
        // Solo agregar capture si waitForResponse es true
        if (waitForResponse) {
          answerOptions.capture = true;
          
          flowChain = flowChain.addAnswer(text, answerOptions, async (ctx: any, { state }: any) => {
            // Guardar la respuesta del usuario en una variable si es necesario
            const variableName = currentNode.metadata?.variableName || 
                               currentNode.data?.variableName || 
                               'userSelection';
            await state.update({ [variableName]: ctx.body });
            logger.info(`Opción seleccionada: ${ctx.body} guardada en ${variableName}`);
          });
        } else {
          // Si no espera respuesta, solo mostrar los botones
          flowChain = flowChain.addAnswer(text, answerOptions);
        }
      }
      break;
      
    case 'conditionNode':
    case 'condition-node':
    case 'condition':
      logger.info(`Procesando condición - continuando con flujo por defecto`);
      // Para condiciones, simplemente continuar con el flujo por defecto
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
  const nextNodeId = getNextNodeId(currentNode, edges);
  if (nextNodeId) {
    return buildFlowChain(nextNodeId, flowChain, nodes, edges, processedNodes);
  }
  
  return flowChain;
}

/**
 * Obtiene el ID del siguiente nodo
 */
function getNextNodeId(node: any, edges: any[]): string | undefined {
  // Buscar en edges (formato ReactFlow)
  if (edges && edges.length > 0) {
    const outgoingEdge = edges.find(edge => edge.source === node.id);
    if (outgoingEdge) {
      logger.info(`Siguiente nodo desde edges: ${outgoingEdge.target}`);
      return outgoingEdge.target;
    }
  }
  
  logger.info(`No se encontró siguiente nodo para ${node.id}`);
  return undefined;
}