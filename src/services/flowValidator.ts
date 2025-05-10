/**
 * src/services/flowValidator.ts
 *
 * Validador de flujos conversacionales.
 * Verifica la integridad y consistencia de los flujos antes de guardarlos.
 * @version 1.1.0
 * @updated 2025-04-27
 */

import { Flow, FlowCreateData, FlowNode, NodeType } from "../models/flow.types";
import logger from "../utils/logger";

/**
 * Valida un flujo para asegurar que es consistente y no tiene errores
 * @param flow Flujo a validar
 * @throws Error si el flujo no es válido
 */
export function validateFlow(flow: Flow | FlowCreateData): void {
  // 1. Verificar que hay nodos
  if (!flow.nodes || Object.keys(flow.nodes).length === 0) {
    logger.warn(`Flujo "${flow.name}" no tiene nodos, se creará un nodo predeterminado`);
    // En lugar de fallar, permitimos flujos sin nodos (se crearán por defecto)
    return;
  }

  // 2. Verificar que el nodo de entrada existe o asignar uno automáticamente
  if (!flow.entryNodeId || !flow.nodes[flow.entryNodeId]) {
    // Si no hay entryNodeId o no es válido, asignamos automáticamente
    const nodeIds = Object.keys(flow.nodes);
    if (nodeIds.length > 0) {
      // Buscamos un nodo de tipo START o el primero disponible
      const startNode = nodeIds.find(
        id => flow.nodes[id].type === NodeType.START || 
             flow.nodes[id].type === 'startNode' || 
             flow.nodes[id].type === 'start-node'
      );
      
      // Si hay un nodo de inicio, lo usamos, de lo contrario tomamos el primero
      const entryNodeId = startNode || nodeIds[0];
      logger.warn(`Nodo de entrada ${flow.entryNodeId || 'no definido'} no válido, asignando ${entryNodeId}`);
      
      // Forzamos la asignación del nodo de entrada
      flow.entryNodeId = entryNodeId;
    } else {
      throw new Error(
        `El flujo no tiene nodos disponibles para usar como entrada`
      );
    }
  }

  // 3. Verificar que todos los nodos tienen IDs únicos
  const nodeIds = new Set<string>();
  for (const nodeId in flow.nodes) {
    if (nodeIds.has(nodeId)) {
      throw new Error(`ID de nodo duplicado: ${nodeId}`);
    }
    nodeIds.add(nodeId);
  }

  // 4. Verificar que todas las referencias a nodos son válidas
  for (const nodeId in flow.nodes) {
    const node = flow.nodes[nodeId];

    // Si tiene next como string, verificar que el nodo existe
    if (typeof node.next === "string" && !flow.nodes[node.next]) {
      logger.warn(
        `El nodo ${nodeId} referencia a un nodo inexistente: ${node.next}. Esta conexión será ignorada.`
      );
      // No lanzamos error, solo advertimos
      node.next = undefined;
    }

    // Si tiene next como array de condicionales, verificar cada uno
    if (Array.isArray(node.next)) {
      const validConditionals = node.next.filter(conditional => {
        if (!flow.nodes[conditional.nextNodeId]) {
          logger.warn(
            `El nodo ${nodeId} tiene una condición que referencia a un nodo inexistente: ${conditional.nextNodeId}. Esta condición será ignorada.`
          );
          return false;
        }
        return true;
      });
      
      // Si hay algún condicional inválido, filtramos solo los válidos
      if (validConditionals.length !== node.next.length) {
        node.next = validConditionals;
      }
    }
  }

  // 5. Verificar la consistencia de los tipos de nodos
  validateNodeTypes(flow.nodes);

  // 6. Verificar que no hay nodos aislados (sin entrada ni salida)
  checkForIsolatedNodes(flow.nodes, flow.entryNodeId);

  logger.info(`Flujo "${flow.name}" validado correctamente`);
}

/**
 * Valida que los tipos de nodos y sus metadatos sean consistentes
 * @param nodes Nodos del flujo
 */
function validateNodeTypes(nodes: Record<string, FlowNode>): void {
  for (const nodeId in nodes) {
    const node = nodes[nodeId];

    // Normalizar el tipo de nodo
    node.type = normalizeNodeType(node.type);

    // Validar según el tipo de nodo
    switch (node.type) {
      case NodeType.MESSAGE:
      case NodeType.MESSAGE_NODE:
        // Los nodos de mensaje pueden tener next como string o undefined
        if (
          node.next &&
          typeof node.next !== "string" &&
          !Array.isArray(node.next)
        ) {
          logger.warn(
            `Nodo de mensaje ${nodeId} tiene un formato de next inválido. Se restablecerá.`
          );
          node.next = undefined;
        }
        break;

      case NodeType.CONDITION:
      case NodeType.CONDITION_NODE:
        // Los nodos de condición deben tener next como array
        if (!Array.isArray(node.next) || node.next.length === 0) {
          logger.warn(
            `Nodo de condición ${nodeId} debe tener al menos una condición en next. Se restablecerá.`
          );
          // Creamos una condición por defecto
          node.next = [
            {
              condition: { type: 'contains', value: '*' },
              nextNodeId: nodeId // Bucle hasta que se corrija
            }
          ];
        }
        break;

      case NodeType.ACTION:
        // Los nodos de acción deben tener metadatos con actionType
        if (!node.metadata || !("actionType" in node.metadata)) {
          logger.warn(
            `Nodo de acción ${nodeId} debe tener un metadata.actionType definido. Se añadirá un valor por defecto.`
          );
          node.metadata = {
            ...node.metadata,
            actionType: 'default'
          };
        }
        break;

      case NodeType.AI_NODE:
      case NodeType.AI_VOICE_AGENT:
        // Los nodos de IA deben tener prompt y model
        if (!node.metadata || !node.metadata.prompt || !node.metadata.model) {
          logger.warn(
            `Nodo de IA ${nodeId} debe tener metadata.prompt y metadata.model definidos. Se añadirán valores por defecto.`
          );
          node.metadata = {
            ...node.metadata,
            prompt: node.metadata?.prompt || "Eres un asistente amable y útil.",
            model: node.metadata?.model || "gpt-4o",
            temperature: node.metadata?.temperature || 0.7,
            maxTokens: node.metadata?.maxTokens || 500
          };
        }
        break;

      case NodeType.API_CALL:
        // Los nodos de API deben tener metadatos con url y method
        if (
          !node.metadata ||
          !("url" in node.metadata) ||
          !("method" in node.metadata)
        ) {
          logger.warn(
            `Nodo de API ${nodeId} debe tener metadata.url y metadata.method definidos. Se añadirán valores por defecto.`
          );
          node.metadata = {
            ...node.metadata,
            url: node.metadata?.url || "https://api.example.com",
            method: node.metadata?.method || "GET"
          };
        }
        break;
    }
  }
}

/**
 * Normaliza el tipo de nodo para manejar diferentes formatos
 * @param type Tipo de nodo a normalizar
 * @returns Tipo de nodo normalizado
 */
function normalizeNodeType(type: string): string {
  // Mapa de tipos equivalentes
  const typeMap: Record<string, string> = {
    'startNode': NodeType.START,
    'start-node': NodeType.START,
    'messageNode': NodeType.MESSAGE_NODE,
    'message-node': NodeType.MESSAGE_NODE,
    'aiNode': NodeType.AI_NODE,
    'ai-node': NodeType.AI_NODE,
    'aiVoiceAgentNode': NodeType.AI_VOICE_AGENT,
    'ai-voice-agent': NodeType.AI_VOICE_AGENT,
    'ai_voice_agent': NodeType.AI_VOICE_AGENT,
    'AgenteVozIA': NodeType.AI_VOICE_AGENT,
    'agenteVozIA': NodeType.AI_VOICE_AGENT,
    'conditionNode': NodeType.CONDITION_NODE,
    'condition-node': NodeType.CONDITION_NODE,
    'inputNode': NodeType.INPUT_NODE,
    'input-node': NodeType.INPUT_NODE,
    'ttsNode': NodeType.TTS_NODE,
    'tts-node': NodeType.TTS_NODE,
    'sttNode': NodeType.STT_NODE,
    'stt-node': NodeType.STT_NODE,
    'endNode': NodeType.END_NODE,
    'end-node': NodeType.END_NODE,
  };

  // Si está en el mapa, lo normalizamos
  return typeMap[type] || type;
}

/**
 * Verifica que no haya nodos aislados en el flujo
 * @param nodes Nodos del flujo
 * @param entryNodeId ID del nodo de entrada
 */
function checkForIsolatedNodes(
  nodes: Record<string, FlowNode>,
  entryNodeId: string
): void {
  // Creamos un conjunto de nodos alcanzables
  const reachableNodes = new Set<string>();

  // Función recursiva para marcar nodos como alcanzables
  function markReachable(nodeId: string): void {
    // Si ya lo procesamos, evitamos ciclos infinitos
    if (reachableNodes.has(nodeId)) return;

    // Marcamos el nodo como alcanzable
    reachableNodes.add(nodeId);

    // Obtenemos el nodo
    const node = nodes[nodeId];
    if (!node) return;

    // Procesamos los siguientes nodos
    if (typeof node.next === "string") {
      markReachable(node.next);
    } else if (Array.isArray(node.next)) {
      for (const conditional of node.next) {
        markReachable(conditional.nextNodeId);
      }
    }
  }

  // Comenzamos desde el nodo de entrada
  markReachable(entryNodeId);

  // Verificamos si todos los nodos son alcanzables
  for (const nodeId in nodes) {
    if (!reachableNodes.has(nodeId)) {
      // Esto es una advertencia, no un error crítico
      logger.warn(
        `Advertencia: Nodo ${nodeId} no es alcanzable desde el nodo de entrada`
      );
    }
  }
}

/**
 * Valida la sintaxis de una expresión regular
 * @param pattern Patrón de expresión regular
 * @returns true si la sintaxis es válida
 */
export function validateRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Valida una URL
 * @param url URL a validar
 * @returns true si la URL es válida
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}
