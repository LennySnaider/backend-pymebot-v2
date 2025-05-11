/**
 * src/services/templateConverter.ts
 * 
 * Servicio para convertir plantillas JSON de flujos visuales
 * en flujos de BuilderBot utilizables en el sistema.
 * 
 * @version 1.0.0
 * @created 2025-05-10
 */

import { addKeyword, addAnswer, createFlow } from "@builderbot/bot";
import { FlowNode, NodeType, ReactFlowData } from "../models/flow.types";
import logger from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

// Tipos para la conversión
interface NodeMap {
  [id: string]: any; // Nodo de BuilderBot
}

interface FlowConversionResult {
  flow: any; // Flujo de BuilderBot
  entryKeywords: string[]; // Palabras clave de entrada
  nodeMap: NodeMap; // Mapa de nodos convertidos
}

/**
 * Convierte una plantilla JSON en un flujo de BuilderBot
 * 
 * @param templateData Datos de la plantilla (JSON o string)
 * @returns Flujo de BuilderBot listo para usar
 */
export const convertTemplateToBuilderbotFlow = (
  templateData: any
): FlowConversionResult | null => {
  try {
    // Si nos dan un string, lo parseamos como JSON
    let templateJson: any;
    if (typeof templateData === 'string') {
      try {
        templateJson = JSON.parse(templateData);
      } catch (parseError) {
        logger.error(`Error al parsear JSON de plantilla: ${parseError}`);
        return null;
      }
    } else {
      templateJson = templateData;
    }

    // Extraemos el react_flow_json si existe
    let reactFlowData: ReactFlowData;
    if (templateJson.react_flow_json) {
      if (typeof templateJson.react_flow_json === 'string') {
        reactFlowData = JSON.parse(templateJson.react_flow_json);
      } else {
        reactFlowData = templateJson.react_flow_json;
      }
    } else if (templateJson.nodes && templateJson.edges) {
      // La plantilla ya está en formato ReactFlowData
      reactFlowData = templateJson;
    } else {
      logger.error('Formato de plantilla inválido, no contiene datos de flujo');
      return null;
    }

    // Validamos la estructura básica
    if (!reactFlowData.nodes || !reactFlowData.edges) {
      logger.error('Datos de flujo inválidos, faltan nodos o conexiones');
      return null;
    }

    // Encontramos el nodo de inicio (startNode)
    const startNode = reactFlowData.nodes.find(node => 
      node.type === 'startNode' || 
      node.type === 'start-node' || 
      node.type === 'START'
    );

    if (!startNode) {
      logger.error('No se encontró nodo de inicio en la plantilla');
      return null;
    }

    // Mapa para rastrear los nodos convertidos
    const nodeMap: NodeMap = {};
    
    // Palabras clave para activar el flujo
    // Usar una lista amplia para aumentar probabilidad de coincidencia
    // IMPORTANTE: BuilderBot usa mayúsculas para las coincidencias
    const entryKeywords = [
      'HOLA', 'OLA', 'INICIO', 'COMENZAR', 'EMPEZAR', 
      'AYUDA', 'HELP', 'INFO', 'INFORMACIÓN',
      'BUENOS DIAS', 'BUENAS TARDES', 'BUENAS NOCHES',
      'START', 'HI', 'HELLO'
    ];
    
    // Si la plantilla tiene un nombre, lo usamos como palabra clave adicional
    if (templateJson.name) {
      entryKeywords.push(templateJson.name.toUpperCase());
    }

    // Creamos el flujo base con el punto de entrada
    // IMPORTANTE: Pasar las palabras clave en mayúsculas
    logger.info(`Configurando palabras clave de entrada: ${entryKeywords.join(', ')}`);
    const baseFlow = addKeyword(entryKeywords);
    nodeMap[startNode.id] = baseFlow;

    // Construimos el grafo de nodos a partir del nodo inicial
    // Usamos un Set para rastrear los nodos procesados y evitar ciclos
    const processedNodes = new Set<string>();
    buildFlowFromNode(startNode.id, reactFlowData, nodeMap, processedNodes);

    // Verificamos si todos los nodos fueron procesados
    const allNodesProcessed = reactFlowData.nodes.every(node =>
      nodeMap[node.id] !== undefined ||
      node.type === 'endNode' ||
      node.type === 'end-node' ||
      node.type === 'END'
    );

    if (!allNodesProcessed) {
      const missingNodes = reactFlowData.nodes
        .filter(node =>
          nodeMap[node.id] === undefined &&
          node.type !== 'endNode' &&
          node.type !== 'end-node' &&
          node.type !== 'END'
        )
        .map(node => `${node.id} (${node.type})`);

      logger.warn(`No se procesaron todos los nodos: ${missingNodes.join(', ')}`);
    }

    // Creamos el flujo final
    const flow = createFlow([baseFlow]);

    // Aseguramos que el flujo tenga los métodos y propiedades necesarios para BuilderBot
    flow.addKeyword = baseFlow.addKeyword;
    flow.addAnswer = baseFlow.addAnswer;
    flow.addAction = baseFlow.addAction;
    flow.flow = baseFlow; // Añadir una referencia al flujo base para compatibilidad

    return {
      flow,
      entryKeywords,
      nodeMap
    };
  } catch (error) {
    logger.error('Error al convertir plantilla a flujo BuilderBot:', error);
    return null;
  }
};

/**
 * Construye un flujo de BuilderBot a partir de un nodo específico
 * Con un enfoque mejorado para garantizar que los nodos padre se procesen antes
 *
 * @param currentNodeId ID del nodo actual
 * @param reactFlowData Datos del flujo visual
 * @param nodeMap Mapa de nodos ya convertidos
 * @param processedNodes Set de IDs de nodos ya procesados para evitar ciclos
 * @returns true si se construyó correctamente
 */
const buildFlowFromNode = (
  currentNodeId: string,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap,
  processedNodes: Set<string> = new Set()
): boolean => {
  try {
    // Evitar procesar el mismo nodo múltiples veces (prevenir ciclos)
    if (processedNodes.has(currentNodeId)) {
      return true; // Ya procesado anteriormente
    }

    // Marcar como procesado para esta ejecución
    processedNodes.add(currentNodeId);

    // Obtenemos el nodo actual
    const currentNode = reactFlowData.nodes.find(node => node.id === currentNodeId);
    if (!currentNode) {
      logger.error(`Nodo ${currentNodeId} no encontrado en el flujo`);
      return false;
    }

    // Obtenemos las conexiones salientes de este nodo
    const outgoingEdges = reactFlowData.edges.filter(edge => edge.source === currentNodeId);

    // Si no hay conexiones salientes y no es un nodo final, es un aviso
    if (outgoingEdges.length === 0 &&
        currentNode.type !== 'endNode' &&
        currentNode.type !== 'end-node' &&
        currentNode.type !== 'END') {
      logger.warn(`Nodo ${currentNodeId} (${currentNode.type}) no tiene conexiones salientes y no es un nodo final`);
    }

    // Verificar si el nodo actual ya está en el mapa (puede haber sido añadido por otro nodo)
    if (!nodeMap[currentNodeId]) {
      // Si el nodo es de tipo 'start', ya debería estar en el mapa como el flujo base
      if (currentNode.type === 'startNode' ||
          currentNode.type === 'start-node' ||
          currentNode.type === 'START') {
        if (!nodeMap[currentNodeId]) {
          logger.warn(`Nodo de inicio ${currentNodeId} no encontrado en el mapa, esto no debería suceder`);
        }
      } else {
        // Para otros tipos de nodos, verificamos si tienen un nodo padre
        const incomingEdges = reactFlowData.edges.filter(edge => edge.target === currentNodeId);

        if (incomingEdges.length > 0) {
          // Tomamos el primer nodo padre (la mayoría de nodos tienen un solo padre)
          const parentEdge = incomingEdges[0];
          const parentNodeId = parentEdge.source;

          // Verificamos si el nodo padre ya está procesado
          if (!nodeMap[parentNodeId]) {
            // Si el padre no está procesado, lo procesamos primero
            logger.debug(`Procesando primero el nodo padre ${parentNodeId} para ${currentNodeId}`);
            buildFlowFromNode(parentNodeId, reactFlowData, nodeMap, processedNodes);
          }

          // Ahora que el padre está procesado (o debería estarlo), podemos procesar este nodo
          if (nodeMap[parentNodeId]) {
            // Procesamos este nodo
            handleNodeByType(currentNode, parentEdge, reactFlowData, nodeMap);
          } else {
            logger.error(`Nodo padre ${parentNodeId} sigue sin estar en el mapa, no se puede procesar ${currentNodeId}`);
          }
        } else {
          logger.warn(`Nodo ${currentNodeId} no tiene conexiones entrantes y no es un nodo de inicio`);
        }
      }
    }

    // Ahora que este nodo está (o debería estar) procesado, procesamos sus conexiones salientes
    for (const edge of outgoingEdges) {
      const targetNodeId = edge.target;
      const targetNode = reactFlowData.nodes.find(node => node.id === targetNodeId);

      if (!targetNode) {
        logger.error(`Nodo destino ${targetNodeId} no encontrado en el flujo`);
        continue;
      }

      // Verificamos si el nodo destino ya está en el mapa
      if (!nodeMap[targetNodeId]) {
        // Procesamos el nodo destino según su tipo
        handleNodeByType(targetNode, edge, reactFlowData, nodeMap);
      }

      // Continuamos con el recorrido recursivo
      buildFlowFromNode(targetNodeId, reactFlowData, nodeMap, processedNodes);
    }

    return true;
  } catch (error) {
    logger.error(`Error al construir flujo desde nodo ${currentNodeId}:`, error);
    return false;
  }
};

/**
 * Procesa un nodo según su tipo específico
 * 
 * @param node Nodo a procesar
 * @param incomingEdge Conexión entrante a este nodo
 * @param reactFlowData Datos del flujo completo
 * @param nodeMap Mapa de nodos convertidos
 */
const handleNodeByType = (
  node: any,
  incomingEdge: any,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap
): void => {
  const parentNodeId = incomingEdge.source;
  const parentNode = nodeMap[parentNodeId];
  
  if (!parentNode) {
    logger.error(`Nodo padre ${parentNodeId} no encontrado en el mapa, no se puede procesar ${node.id}`);
    return;
  }

  // Extraemos la información del nodo
  const nodeId = node.id;
  const nodeType = node.type;
  const nodeData = node.data || {};
  const nodeLabel = nodeData.label || '';
  
  // Extraemos el contenido del mensaje de las posibles ubicaciones
  let messageContent = '';
  if (nodeData.message) {
    messageContent = nodeData.message;
  } else if (nodeData.content) {
    messageContent = nodeData.content;
  } else if (nodeData.text) {
    messageContent = nodeData.text;
  } else if (nodeData.prompt) {
    messageContent = nodeData.prompt;
  } else if (nodeData.question) {
    messageContent = nodeData.question;
  } else if (nodeData.greeting) {
    messageContent = nodeData.greeting;
  }

  // Manejamos el nodo según su tipo
  switch (nodeType) {
    case 'messageNode':
    case 'message':
      // Nodo de mensaje simple
      handleMessageNode(nodeId, messageContent, nodeData, parentNode, reactFlowData, nodeMap);
      break;
      
    case 'inputNode':
    case 'input':
      // Nodo de entrada de usuario
      handleInputNode(nodeId, messageContent, nodeData, parentNode, reactFlowData, nodeMap);
      break;
      
    case 'conditionalNode':
    case 'conditionNode':
    case 'condition':
      // Nodo condicional
      handleConditionalNode(nodeId, messageContent, nodeData, parentNode, incomingEdge, reactFlowData, nodeMap);
      break;
      
    case 'aiNode':
    case 'ai':
      // Nodo de IA
      handleAINode(nodeId, messageContent, nodeData, parentNode, reactFlowData, nodeMap);
      break;
      
    case 'endNode':
    case 'end':
      // Nodo final - no hace falta procesarlo
      break;
      
    default:
      logger.warn(`Tipo de nodo no soportado directamente: ${nodeType}`);
      // Intentamos un tratamiento genérico como nodo de mensaje
      handleMessageNode(nodeId, messageContent || `[${nodeType}] ${nodeLabel}`, nodeData, parentNode, reactFlowData, nodeMap);
  }
};

/**
 * Procesa un nodo de mensaje
 */
const handleMessageNode = (
  nodeId: string,
  message: string,
  nodeData: any,
  parentNode: any,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap
): void => {
  try {
    // Verificar que tenemos un mensaje válido
    if (!message || message.trim() === '') {
      message = nodeData.label || `Mensaje del nodo ${nodeId}`;
      logger.warn(`Nodo de mensaje ${nodeId} sin contenido, usando valor por defecto: "${message}"`);
    }

    // Creamos el nodo de respuesta con el mensaje
    const delay = nodeData.delay || 0;
    const options = delay > 0 ? { delay: delay * 1000 } : undefined;

    // Verificamos si hay multimedia
    let mediaOptions = undefined;
    if (nodeData.media || nodeData.imageUrl || nodeData.audioUrl || nodeData.videoUrl) {
      mediaOptions = {
        media: nodeData.media || nodeData.imageUrl || nodeData.audioUrl || nodeData.videoUrl
      };
    }

    // Mezclamos todas las opciones
    const finalOptions = { ...options, ...mediaOptions };

    // Verificar que el nodo padre es válido antes de añadir la respuesta
    if (!parentNode || typeof parentNode.addAnswer !== 'function') {
      logger.error(`Nodo padre inválido para ${nodeId}, no se puede añadir respuesta`);
      return;
    }

    // Añadimos la respuesta al nodo padre
    let messageNode;
    try {
      if (Object.keys(finalOptions).length > 0) {
        messageNode = parentNode.addAnswer(message, finalOptions);
      } else {
        messageNode = parentNode.addAnswer(message);
      }
    } catch (addError) {
      logger.error(`Error al añadir respuesta a nodo ${nodeId}: ${addError}`);
      return;
    }

    // Guardamos el nodo en el mapa
    nodeMap[nodeId] = messageNode;

    logger.debug(`Nodo de mensaje ${nodeId} procesado correctamente y guardado en el mapa`);
  } catch (error) {
    logger.error(`Error al procesar nodo de mensaje ${nodeId}:`, error);
  }
};

/**
 * Procesa un nodo de entrada (input)
 */
const handleInputNode = (
  nodeId: string,
  question: string,
  nodeData: any,
  parentNode: any,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap
): void => {
  try {
    // Verificar que tenemos una pregunta válida
    if (!question || question.trim() === '') {
      question = nodeData.label || nodeData.title || `Ingrese su respuesta (${nodeId})`;
      logger.warn(`Nodo de entrada ${nodeId} sin pregunta, usando: "${question}"`);
    }

    // Verificar que el nodo padre es válido
    if (!parentNode || (typeof parentNode.addAnswer !== 'function' && typeof parentNode.addAction !== 'function')) {
      logger.error(`Nodo padre inválido para ${nodeId}, no se puede procesar nodo de entrada`);
      return;
    }

    // Obtenemos el nombre de la variable donde guardar la respuesta
    // Extraer del ID cualquier nombre explícito (ej: inputNode-nombre -> nombre)
    let variableName;
    if (nodeId.includes('-')) {
      const parts = nodeId.split('-');
      if (parts.length >= 2 && parts[0].toLowerCase().includes('input')) {
        variableName = parts[1];
      } else {
        variableName = `var_${nodeId.replace(/[-]/g, '_')}`;
      }
    } else {
      variableName = nodeData.variableName || `var_${nodeId.replace(/[-]/g, '_')}`;
    }

    logger.debug(`Procesando nodo de entrada ${nodeId}, guardará en variable: ${variableName}`);

    // Primero enviamos la pregunta usando addAction
    let questionNode;
    try {
      // Primero enviamos la pregunta
      questionNode = parentNode.addAction(async (ctx, { flowDynamic }) => {
        await flowDynamic(question);
      });

      // Luego capturamos la respuesta con addAction y capture: true
      const inputNode = questionNode.addAction({ capture: true }, async (ctx, { flowDynamic, state }) => {
        try {
          // Guardamos la respuesta en el estado
          const userResponse = ctx.body;
          const stateUpdate: Record<string, any> = {
            [`${variableName}`]: userResponse,
            last_node_id: nodeId
          };

          await state.update(stateUpdate);
          logger.debug(`Respuesta de usuario guardada en variable ${variableName}: "${userResponse}"`);

          // Procesamos los nodos conectados a este
          const outgoingEdges = reactFlowData.edges.filter(edge => edge.source === nodeId);

          if (outgoingEdges.length > 0) {
            const nextNodeId = outgoingEdges[0].target;
            const nextNode = reactFlowData.nodes.find(node => node.id === nextNodeId);

            if (nextNode) {
              // Extraemos el contenido del siguiente nodo
              let nextContent = extractNodeContent(nextNode);

              // Si no hay contenido explícito pero hay una etiqueta, la usamos
              if (!nextContent && nextNode.data?.label) {
                nextContent = nextNode.data.label;
              }

              // Reemplazamos variables en el texto si hay contenido
              if (nextContent) {
                const currentState = await state.get();
                const processedContent = replaceStateVariables(nextContent, currentState);

                // Enviamos el contenido procesado
                await flowDynamic(processedContent);
                logger.debug(`Enviado mensaje de siguiente nodo ${nextNodeId} después de entrada`);
              }
            }
          }
        } catch (handlerError) {
          logger.error(`Error en handler de nodo input ${nodeId}:`, handlerError);
        }
      });

      // Guardamos el nodo en el mapa
      nodeMap[nodeId] = inputNode;
      logger.debug(`Nodo de entrada ${nodeId} procesado y guardado en el mapa`);
    } catch (addError) {
      logger.error(`Error al añadir nodo de entrada ${nodeId}: ${addError}`);
      return;
    }
  } catch (error) {
    logger.error(`Error al procesar nodo de input ${nodeId}:`, error);
  }
};

/**
 * Procesa un nodo condicional
 */
const handleConditionalNode = (
  nodeId: string,
  content: string,
  nodeData: any,
  parentNode: any,
  incomingEdge: any,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap
): void => {
  try {
    // Extraemos la condición
    const condition = nodeData.condition || '';
    const equals = nodeData.equals || '';
    const caseSensitive = nodeData.caseSensitive === true;
    
    // Buscamos las conexiones para los casos true y false
    const edges = reactFlowData.edges.filter(edge => edge.source === nodeId);
    
    // Identificamos qué borde corresponde a cada caso
    let trueEdge, falseEdge;
    
    for (const edge of edges) {
      if (edge.sourceHandle === 'true' || edge.label === 'true' || edge.label === 'Yes' || edge.label === 'Sí') {
        trueEdge = edge;
      } else if (edge.sourceHandle === 'false' || edge.label === 'false' || edge.label === 'No') {
        falseEdge = edge;
      }
    }
    
    // Si no pudimos identificar por handle o label, usamos el primero como true y el segundo como false
    if (!trueEdge && !falseEdge && edges.length >= 2) {
      trueEdge = edges[0];
      falseEdge = edges[1];
    } else if (!trueEdge && edges.length >= 1) {
      trueEdge = edges[0];
    } else if (!falseEdge && edges.length >= 2) {
      falseEdge = edges[1];
    }
    
    // Creamos un nodo que pueda manejar la condición
    const condNode = parentNode.addAction(async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        
        // Evaluamos la condición
        let conditionMet = false;
        
        // Si hay una variable específica que evaluar
        if (condition) {
          const variableValue = currentState[condition] || '';
          
          if (equals) {
            // Comparación exacta
            if (caseSensitive) {
              conditionMet = variableValue === equals;
            } else {
              conditionMet = variableValue.toLowerCase() === equals.toLowerCase();
            }
          } else {
            // Si hay valor en la variable, consideramos true
            conditionMet = !!variableValue;
          }
        } else {
          // Si no hay condición específica, usamos la última respuesta del usuario
          const lastResponse = ctx.body.toLowerCase();
          
          // Verificamos si es afirmativo
          conditionMet = lastResponse.includes('sí') || 
                         lastResponse.includes('si') || 
                         lastResponse === 'si' || 
                         lastResponse === 'sí' ||
                         lastResponse === 'yes' ||
                         lastResponse === 'claro' ||
                         lastResponse === 'por supuesto';
        }
        
        // Según el resultado, seguimos una ruta u otra
        if (conditionMet) {
          // Ruta true
          if (trueEdge) {
            const trueNodeId = trueEdge.target;
            const trueNode = reactFlowData.nodes.find(node => node.id === trueNodeId);
            
            if (trueNode) {
              // Extraemos y enviamos el contenido del nodo true
              const trueContent = extractNodeContent(trueNode);
              
              if (trueContent) {
                // Procesamos variables en el contenido
                const processedContent = replaceStateVariables(trueContent, currentState);
                await flowDynamic(processedContent);
              }
            }
          }
        } else {
          // Ruta false
          if (falseEdge) {
            const falseNodeId = falseEdge.target;
            const falseNode = reactFlowData.nodes.find(node => node.id === falseNodeId);
            
            if (falseNode) {
              // Extraemos y enviamos el contenido del nodo false
              const falseContent = extractNodeContent(falseNode);
              
              if (falseContent) {
                // Procesamos variables en el contenido
                const processedContent = replaceStateVariables(falseContent, currentState);
                await flowDynamic(processedContent);
              }
            }
          }
        }
        
        // Actualizamos el estado con la decisión tomada
        await state.update({
          [`condition_${nodeId}`]: conditionMet,
          last_node_id: nodeId
        });
      } catch (handlerError) {
        logger.error(`Error en handler de nodo condicional ${nodeId}:`, handlerError);
      }
    });
    
    // Guardamos el nodo en el mapa
    nodeMap[nodeId] = condNode;
  } catch (error) {
    logger.error(`Error al procesar nodo condicional ${nodeId}:`, error);
  }
};

/**
 * Procesa un nodo de IA
 */
const handleAINode = (
  nodeId: string,
  prompt: string,
  nodeData: any,
  parentNode: any,
  reactFlowData: ReactFlowData,
  nodeMap: NodeMap
): void => {
  try {
    // Extraemos los parámetros del nodo de IA
    const model = nodeData.model || 'gpt-3.5-turbo';
    const temperature = nodeData.temperature || 0.7;
    const maxTokens = nodeData.maxTokens || 500;
    const variableName = nodeData.variableName || nodeData.responseVariableName || `ai_response_${nodeId}`;
    
    // Importamos dinámicamente el servicio de IA (para evitar ciclos de dependencia)
    const aiNode = parentNode.addAction(async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        
        // Procesamos el prompt reemplazando variables
        const processedPrompt = replaceStateVariables(prompt, currentState);
        
        // Llamamos al servicio de IA
        const { generateResponse } = await import('../services/aiServices');
        
        const aiResponse = await generateResponse(
          processedPrompt,
          {
            model,
            temperature,
            maxTokens,
            userId: ctx.from,
            tenantId: currentState.tenant_id || 'default',
            sessionId: currentState.session_id || `session-${ctx.from}-${Date.now()}`
          }
        );
        
        // Guardamos la respuesta en el estado
        await state.update({
          [variableName]: aiResponse,
          last_node_id: nodeId
        });
        
        // Enviamos la respuesta
        await flowDynamic(aiResponse);
        
        // Procesamos los nodos conectados a este
        const outgoingEdges = reactFlowData.edges.filter(edge => edge.source === nodeId);
        
        if (outgoingEdges.length > 0) {
          const nextNodeId = outgoingEdges[0].target;
          const nextNode = reactFlowData.nodes.find(node => node.id === nextNodeId);
          
          if (nextNode) {
            const nextContent = extractNodeContent(nextNode);
            
            if (nextContent) {
              // Actualizamos el estado para incluir la nueva respuesta de IA
              const updatedState = await state.get();
              
              // Procesamos variables en el contenido
              const processedContent = replaceStateVariables(nextContent, updatedState);
              
              // Pequeña pausa para separar mensajes
              setTimeout(async () => {
                await flowDynamic(processedContent);
              }, 1000);
            }
          }
        }
      } catch (handlerError) {
        logger.error(`Error en handler de nodo AI ${nodeId}:`, handlerError);
        await flowDynamic("Lo siento, no pude generar una respuesta en este momento. ¿Puedes intentar nuevamente?");
      }
    });
    
    // Guardamos el nodo en el mapa
    nodeMap[nodeId] = aiNode;
  } catch (error) {
    logger.error(`Error al procesar nodo de IA ${nodeId}:`, error);
  }
};

/**
 * Extrae el contenido de un nodo
 */
const extractNodeContent = (node: any): string => {
  if (!node || !node.data) return '';
  
  return node.data.message || 
         node.data.content || 
         node.data.text || 
         node.data.prompt || 
         node.data.question || 
         node.data.greeting || 
         '';
};

/**
 * Reemplaza variables en un texto
 */
const replaceStateVariables = (text: string, state: Record<string, any>): string => {
  if (!text) return '';
  
  let processedText = text;
  
  // Reemplazamos todas las variables en formato {{variable}}
  const variableRegex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = variableRegex.exec(text)) !== null) {
    const varName = match[1].trim();
    if (state[varName] !== undefined) {
      processedText = processedText.replace(
        match[0],
        String(state[varName])
      );
    }
  }
  
  return processedText;
};