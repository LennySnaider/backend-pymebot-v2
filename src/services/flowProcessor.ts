/**
 * src/services/flowProcessor.ts
 *
 * Procesador de flujos conversacionales.
 * Ejecuta la lógica de los flujos y procesa los nodos.
 * Incluye soporte para plantillas personalizadas y métricas de tokens.
 * @version 1.3.0
 * @updated 2025-04-27
 */

import {
  FlowNode,
  NodeType,
  RuntimeFlow,
  FlowState,
  NodeProcessResult,
  Condition,
  ConditionalNext,
  ConditionType,
} from "../models/flow.types";
import logger from "../utils/logger";

// Tipo para el callback de notificación de nodos
type NodeVisitCallback = (nodeId: string) => void;

// Interfaz para las métricas de procesamiento
interface ProcessMetrics {
  tokensUsed: number; // Tokens utilizados
  nodesVisited: number; // Número de nodos visitados
  processingTimeMs: number; // Tiempo de procesamiento en milisegundos
}

/**
 * Procesa un mensaje de usuario a través de un flujo
 * @param flow Flujo a utilizar
 * @param message Mensaje de usuario
 * @param userId ID del usuario
 * @param sessionId ID de sesión
 * @param prevState Estado previo del flujo (opcional)
 * @param onNodeVisit Callback para notificar cada nodo visitado (opcional)
 * @returns Respuesta generada, estado actualizado y métricas
 */
export async function processFlowMessage(
  flow: RuntimeFlow,
  message: string,
  userId: string,
  sessionId: string,
  prevState?: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<{
  response: string;
  state: FlowState;
  metrics?: ProcessMetrics;
}> {
  try {
    const startTime = Date.now();
    let nodesVisited = 0;
    let tokensUsed = 0;

    // Creamos un callback para contar nodos si no se proporcionó uno
    const nodeVisitCallback = (nodeId: string) => {
      nodesVisited++;
      // También llamamos al callback proporcionado si existe
      if (onNodeVisit) onNodeVisit(nodeId);
      logger.debug(`Visitando nodo: ${nodeId}`);
    };

    // Si no hay estado previo, comenzamos desde el nodo de entrada
    const state = prevState || {
      flowId: flow.id,
      currentNodeId: flow.entryNodeId,
      context: {},
      history: [],
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      userId,
      sessionId,
    };

    // Actualizamos el contexto con el nuevo mensaje
    state.context.lastUserMessage = message;
    state.lastUpdatedAt = new Date();

    logger.info(
      `Procesando mensaje "${message}" en flujo ${flow.id}, nodo inicial ${state.currentNodeId}`
    );
    logger.info(
      `Flujo tiene ${
        Object.keys(flow.nodes).length
      } nodos, con nodo de entrada: ${flow.entryNodeId}`
    );

    // Procesamos el flujo
    const result = await processNode(flow, state, nodeVisitCallback);

    // Estimamos los tokens usados basados en el mensaje y la respuesta
    if (result.metrics?.tokensUsed) {
      tokensUsed = result.metrics.tokensUsed;
    } else {
      // Estimación básica: tokens de entrada + tokens de salida
      const inputTokens = Math.ceil(message.length / 4);
      const outputTokens = Math.ceil((result.response || "").length / 4);

      // Sumamos un costo base por nodo visitado
      tokensUsed = inputTokens + outputTokens + nodesVisited * 5;
    }

    // Creamos las métricas de procesamiento
    const metrics: ProcessMetrics = {
      tokensUsed,
      nodesVisited,
      processingTimeMs: Date.now() - startTime,
    };

    logger.info(
      `Respuesta generada: "${result.response?.substring(
        0,
        50
      )}..." (${nodesVisited} nodos visitados)`
    );

    return {
      response:
        result.response ||
        "Lo siento, no pude procesar tu solicitud correctamente.",
      state,
      metrics,
    };
  } catch (error) {
    logger.error("Error al procesar mensaje a través de flujo:", error);

    // Creamos un estado básico si no hay uno
    const state = prevState || {
      flowId: flow.id,
      currentNodeId: flow.entryNodeId,
      context: { lastUserMessage: message },
      history: [],
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      userId,
      sessionId,
    };

    return {
      response: "Ha ocurrido un error al procesar tu mensaje.",
      state,
      metrics: {
        tokensUsed: 10, // Valor nominal para errores
        nodesVisited: 0,
        processingTimeMs: 0,
      },
    };
  }
}

/**
 * Procesa un nodo específico del flujo
 * @param flow Flujo a utilizar
 * @param state Estado actual del flujo
 * @param onNodeVisit Callback para notificar cada nodo visitado
 * @returns Resultado del procesamiento
 */
export async function processNode(
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  try {
    // Obtenemos el nodo actual
    let node = flow.nodes[state.currentNodeId];

    if (!node) {
      logger.error(
        `Nodo ${state.currentNodeId} no encontrado en flujo ${flow.id}, buscando nodo alternativo`
      );

      // Estrategia 1: Intentar usar el nodo de entrada explícito
      if (flow.entryNodeId && flow.nodes[flow.entryNodeId]) {
        logger.info(`Redirigiendo al nodo de entrada ${flow.entryNodeId} como fallback`);
        state.currentNodeId = flow.entryNodeId;
        node = flow.nodes[flow.entryNodeId];
      }
      // Estrategia 2: Buscar cualquier nodo de tipo "startNode"
      else {
        const startNode = Object.values(flow.nodes).find(n =>
          n.type === 'startNode' || n.type === 'start');

        if (startNode) {
          logger.info(`Redirigiendo al nodo de inicio encontrado ${startNode.id} como fallback`);
          state.currentNodeId = startNode.id;
          node = startNode;
        }
        // Estrategia 3: Buscar cualquier nodo de tipo "messageNode"
        else {
          const messageNode = Object.values(flow.nodes).find(n =>
            n.type === 'messageNode' || n.type === 'message');

          if (messageNode) {
            logger.info(`Redirigiendo a nodo de mensaje ${messageNode.id} como último recurso`);
            state.currentNodeId = messageNode.id;
            node = messageNode;
          }
        }
      }

      // Si aún no hay nodo, devolvemos error
      if (!node) {
        logger.error(`No se encontró ningún nodo alternativo en flujo ${flow.id}`);
        return {
          response: "Lo siento, ocurrió un error en el flujo de conversación. Estamos trabajando para solucionarlo.",
          error: `Nodo ${state.currentNodeId} no encontrado y no hay nodos alternativos disponibles`,
        };
      }
    }

    logger.info(`Procesando nodo ${node.id} de tipo ${node.type}`);

    // Notificamos visita del nodo si hay callback
    if (onNodeVisit) onNodeVisit(node.id);

    // Si hay configuración de plantilla en el contexto, la aplicamos al nodo
    applyTemplateConfig(node, state.context);

    // Normalización de tipos de nodos entre el Constructor Visual y el backend
    const nodeType = normalizeNodeType(node.type);
    logger.debug(
      `Tipo de nodo normalizado: ${nodeType} (original: ${node.type})`
    );

    // Procesamos según el tipo de nodo
    switch (nodeType) {
      case NodeType.MESSAGE:
      case NodeType.MESSAGE_NODE:
        return processMessageNode(node, flow, state, onNodeVisit);

      case NodeType.CONDITION:
      case NodeType.CONDITION_NODE:
        return processConditionNode(node, flow, state, onNodeVisit);

      case NodeType.ACTION:
        return processActionNode(node, flow, state, onNodeVisit);

      case NodeType.API_CALL:
        return processApiCallNode(node, flow, state, onNodeVisit);

      case NodeType.INPUT:
      case NodeType.INPUT_NODE:
        return processInputNode(node, flow, state, onNodeVisit);

      case NodeType.START:
        // Para el nodo inicial, simplemente pasamos al siguiente nodo
        logger.info(`Procesando nodo de inicio ${node.id}`);
        return processStartNode(node, flow, state, onNodeVisit);

      case NodeType.END:
      case NodeType.END_NODE:
        // Para el nodo final, devolvemos el mensaje de fin
        logger.info(`Procesando nodo final ${node.id}`);
        return processEndNode(node, flow, state);

      case NodeType.AI_NODE:
      case NodeType.AI_VOICE_AGENT:
        // Procesamos nodos de IA y les aplicamos las plantillas
        logger.info(`Procesando nodo de IA ${node.id} (${nodeType})`);
        return processAINode(node, flow, state, onNodeVisit);

      case NodeType.TEXT_TO_SPEECH:
      case NodeType.TTS_NODE:
        // Para nodos de text-to-speech, procesamos el texto y seguimos
        logger.info(`Procesando nodo TTS ${node.id}`);
        return processTTSNode(node, flow, state, onNodeVisit);

      case NodeType.SPEECH_TO_TEXT:
      case NodeType.STT_NODE:
        // Para nodos de speech-to-text, usamos el mensaje de usuario como entrada
        logger.info(`Procesando nodo STT ${node.id}`);
        return processSTTNode(node, flow, state, onNodeVisit);

      default:
        logger.warn(
          `Tipo de nodo no implementado específicamente: ${node.type} (normalizado: ${nodeType})`
        );

        // Si hay un siguiente nodo, continuamos a él a pesar de no procesar este
        const nextNodeId = getNextNodeId(node);
        if (nextNodeId) {
          logger.info(`Pasando al siguiente nodo: ${nextNodeId}`);
          state.currentNodeId = nextNodeId;
          return processNode(flow, state, onNodeVisit);
        }

        return {
          response:
            node.content ||
            `Este tipo de nodo (${node.type}) aún no está implementado completamente, pero estamos trabajando en ello.`,
          nextNodeId: getNextNodeId(node),
        };
    }
  } catch (error) {
    logger.error(`Error al procesar nodo ${state.currentNodeId}:`, error);
    return {
      response: "Error interno al procesar el flujo.",
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Aplica la configuración de la plantilla a un nodo
 * @param node Nodo a modificar
 * @param context Contexto con la configuración de plantilla
 */
function applyTemplateConfig(
  node: FlowNode,
  context: Record<string, any>
): void {
  // Verificamos si hay configuración de plantilla
  if (!context.templateConfig) return;

  logger.debug(`Aplicando configuración de plantilla a nodo ${node.id}`);
  const templateConfig = context.templateConfig;

  // Aplicamos configuraciones específicas según el tipo de nodo
  if (node.type === NodeType.AI_NODE || node.type === NodeType.AI_VOICE_AGENT) {
    // Para nodos de IA, podemos aplicar configuraciones específicas

    // Aplicar configuración de modelo si existe en la plantilla
    if (templateConfig.aiModel && node.metadata) {
      node.metadata.model = templateConfig.aiModel;
    }

    // Aplicar configuración de temperatura
    if (templateConfig.temperature !== undefined && node.metadata) {
      node.metadata.temperature = templateConfig.temperature;
    }

    // Aplicar configuración de sistema/prompt
    if (templateConfig.systemPrompt && node.metadata) {
      // Puede ser una sustitución o un prefijo/sufijo según la configuración
      if (templateConfig.promptMode === "replace") {
        node.metadata.systemPrompt = templateConfig.systemPrompt;
      } else if (templateConfig.promptMode === "prefix") {
        node.metadata.systemPrompt =
          templateConfig.systemPrompt + (node.metadata.systemPrompt || "");
      } else if (templateConfig.promptMode === "suffix") {
        node.metadata.systemPrompt =
          (node.metadata.systemPrompt || "") + templateConfig.systemPrompt;
      }
    }

    // Aplicar instrucciones personalizadas
    if (templateConfig.instructions && node.content) {
      // Podemos añadir instrucciones al contenido del nodo
      if (templateConfig.instructionMode === "replace") {
        node.content = templateConfig.instructions;
      } else if (templateConfig.instructionMode === "prefix") {
        node.content = templateConfig.instructions + "\n\n" + node.content;
      } else if (templateConfig.instructionMode === "suffix") {
        node.content = node.content + "\n\n" + templateConfig.instructions;
      }
    }
  }

  // Para otros tipos de nodos, podemos aplicar configuraciones genéricas
  if (templateConfig.nodeOverrides && templateConfig.nodeOverrides[node.id]) {
    const override = templateConfig.nodeOverrides[node.id];

    // Aplicar sobrescrituras específicas para este nodo
    if (override.content !== undefined) {
      node.content = override.content;
    }

    if (override.metadata !== undefined && node.metadata) {
      node.metadata = { ...node.metadata, ...override.metadata };
    }
  }
}

/**
 * Normaliza el tipo de nodo entre el Constructor Visual y el backend
 * @param nodeType Tipo de nodo original
 * @returns Tipo de nodo normalizado
 */
function normalizeNodeType(nodeType: string): NodeType {
  // Mapa de conversión de tipos de nodos
  const typeMap: Record<string, NodeType> = {
    // Tipos básicos
    message: NodeType.MESSAGE,
    messageNode: NodeType.MESSAGE_NODE,
    condition: NodeType.CONDITION,
    conditionNode: NodeType.CONDITION_NODE,
    action: NodeType.ACTION,
    input: NodeType.INPUT,
    inputNode: NodeType.INPUT_NODE,
    api_call: NodeType.API_CALL,
    // Tipos de inicio/fin
    startNode: NodeType.START,
    endNode: NodeType.END_NODE,
    end: NodeType.END,
    // Tipos de IA
    aiNode: NodeType.AI_NODE,
    ai_voice_agent: NodeType.AI_VOICE_AGENT,
    aiVoiceAgentNode: NodeType.AI_VOICE_AGENT,
    AgenteVozIA: NodeType.AI_VOICE_AGENT,
    "agente-voz-ia": NodeType.AI_VOICE_AGENT,
    // Tipos de voz
    ttsNode: NodeType.TTS_NODE,
    text_to_speech: NodeType.TEXT_TO_SPEECH,
    sttNode: NodeType.STT_NODE,
    speech_to_text: NodeType.SPEECH_TO_TEXT,
  };

  // Devolver el tipo normalizado si existe, o el original si no
  return typeMap[nodeType] || (nodeType as NodeType);
}

/**
 * Procesa un nodo de tipo inicio
 */
export async function processStartNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Los nodos de inicio simplemente pasan al siguiente nodo
  logger.info(`Procesando nodo de inicio ${node.id}`);

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);
  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`Inicio: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  // Si no hay siguiente nodo (raro para un nodo de inicio), devolvemos un mensaje genérico
  return {
    response: node.content || "Bienvenido al sistema de chat.",
  };
}

/**
 * Procesa un nodo de tipo fin
 */
export async function processEndNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState
): Promise<NodeProcessResult> {
  // Agregamos el mensaje de fin a la historia
  state.history.push(node.content);
  logger.info(`Procesando nodo final ${node.id}: "${node.content}"`);

  // Devolvemos el mensaje del nodo final
  return {
    response: node.content || "Fin de la conversación.",
  };
}

/**
 * Procesa un nodo de tipo mensaje
 */
export async function processMessageNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Agregamos el mensaje a la historia
  state.history.push(node.content);
  logger.info(
    `Procesando nodo de mensaje ${node.id}: "${node.content.substring(
      0,
      50
    )}..."`
  );

  // Obtenemos el siguiente nodo (si existe)
  const nextNodeId = getNextNodeId(node);

  // En el caso de mensajes, siempre devolvemos la respuesta del mensaje actual
  // Y guardamos el siguiente nodo para procesarlo en la próxima interacción
  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(
      `Mensaje: Guardando próximo nodo ${nextNodeId} para siguiente interacción`
    );

    // Devolvemos el contenido del mensaje ACTUAL, no seguimos procesando
    return {
      response: node.content,
      nextNodeId: nextNodeId,
    };
  }

  // Si no hay siguiente nodo, devolvemos la respuesta
  return {
    response: node.content,
  };
}

/**
 * Procesa un nodo de tipo condición
 */
export async function processConditionNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Obtenemos las condiciones a evaluar y el mensaje del usuario
  const userMessage = state.context.lastUserMessage || "";
  const next = node.next as ConditionalNext[];

  logger.info(
    `Procesando nodo de condición ${node.id} para mensaje: "${userMessage}"`
  );

  if (!Array.isArray(next)) {
    logger.error(
      `Nodo condición ${node.id} no tiene transiciones condicionales válidas`
    );
    return {
      error: "Configuración inválida de nodo de condición",
      response: "Lo siento, hay un error en la configuración del flujo.",
    };
  }

  logger.debug(`Evaluando ${next.length} condiciones posibles`);

  // Evaluamos cada condición
  for (const conditional of next) {
    logger.debug(
      `Evaluando condición para nodo destino: ${conditional.nextNodeId}`
    );

    if (evaluateCondition(conditional.condition, userMessage, state.context)) {
      // Si la condición se cumple, pasamos al siguiente nodo
      logger.info(
        `Condición cumplida, avanzando a nodo: ${conditional.nextNodeId}`
      );
      state.currentNodeId = conditional.nextNodeId;
      return processNode(flow, state, onNodeVisit);
    }
  }

  // Si ninguna condición se cumplió, no hay siguiente nodo
  logger.info(
    `Ninguna condición cumplida en nodo ${node.id}, devolviendo respuesta por defecto`
  );
  return {
    response: "No entendí tu solicitud. ¿Podrías reformularla?",
  };
}

/**
 * Procesa un nodo de tipo acción
 */
export async function processActionNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Por ahora, simplemente pasamos al siguiente nodo
  // En una implementación más completa, ejecutaríamos la acción correspondiente
  logger.info(`Ejecutando acción del nodo ${node.id}`);

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);

  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`Acción: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  return {
    response: "Acción ejecutada correctamente.",
  };
}

/**
 * Procesa un nodo de tipo llamada a API
 */
export async function processApiCallNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Esto podría ampliarse con una implementación real de llamadas a API
  logger.info(`Ejecutando llamada a API del nodo ${node.id}`);

  // Simulamos respuesta de API
  state.context.apiResponse = {
    success: true,
    data: { message: "Respuesta simulada de API" },
  };

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);

  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`API: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  return {
    response: "Llamada a API completada.",
  };
}

/**
 * Procesa un nodo de tipo entrada
 */
export async function processInputNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // Guardamos la pregunta en la historia
  state.history.push(node.content);
  logger.info(`Procesando nodo de entrada ${node.id}: "${node.content}"`);

  // Si hay un nombre de variable en los metadatos, guardamos el mensaje del usuario
  if (node.metadata?.variableName) {
    const varName = node.metadata.variableName as string;
    state.context[varName] = state.context.lastUserMessage;
    logger.debug(`Entrada: Guardando mensaje en variable ${varName}`);
  }

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);

  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`Entrada: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  // Si no hay siguiente nodo, devolvemos la pregunta como respuesta
  return {
    response: node.content,
  };
}

/**
 * Procesa un nodo de Text-to-Speech
 */
export async function processTTSNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // En un sistema real aquí convertiríamos texto a voz
  logger.info(
    `Procesando nodo TTS ${node.id}: "${node.content.substring(0, 30)}..."`
  );

  // Agregamos los metadatos del TTS al contexto para que el frontend lo procese
  state.context.ttsData = {
    text: node.content,
    voice: node.metadata?.voice || "default",
    rate: node.metadata?.rate || 1.0,
    delay: node.metadata?.delay || 0,
  };

  // Agregamos el mensaje a la historia
  state.history.push(node.content);

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);

  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`TTS: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  return {
    response: node.content,
  };
}

/**
 * Procesa un nodo de Speech-to-Text
 */
export async function processSTTNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  // En un sistema real esperaríamos la entrada de voz
  logger.info(`Procesando nodo STT ${node.id}`);

  // Usamos el texto del mensaje como si fuera la transcripción de voz
  const userMessage = state.context.lastUserMessage || "";

  // Si hay un nombre de variable en los metadatos, guardamos la transcripción
  if (node.metadata?.variableName) {
    const varName = node.metadata.variableName as string;
    state.context[varName] = userMessage;
    logger.debug(`STT: Guardando transcripción en variable ${varName}`);
  }

  // Obtenemos el siguiente nodo
  const nextNodeId = getNextNodeId(node);

  if (nextNodeId) {
    state.currentNodeId = nextNodeId;
    logger.debug(`STT: Avanzando al nodo ${nextNodeId}`);
    return processNode(flow, state, onNodeVisit);
  }

  return {
    response: node.content || "¿Puedes repetir lo que dijiste?",
  };
}

/**
 * Procesa un nodo de tipo IA
 * Aquí es donde se aplicarían las configuraciones de plantilla más importantes
 */
export async function processAINode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: FlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  try {
    // En una implementación real, aquí llamaríamos a una API de IA
    // Por ahora, usamos el contenido del nodo como respuesta

    logger.info(
      `Procesando nodo de IA ${
        node.id
      } con contenido: "${node.content?.substring(0, 30)}..."`
    );

    // Información básica para métricas
    const userMessage = state.context.lastUserMessage || "";
    const nodeContent = node.content || "";

    // Estimamos tokens usados: entrada + salida + sistema
    const inputTokens = Math.ceil(userMessage.length / 4);
    const promptTokens = Math.ceil(nodeContent.length / 4);
    let systemPromptTokens = 0;

    // Si hay un prompt de sistema en los metadatos, lo contamos
    if (node.metadata?.systemPrompt) {
      systemPromptTokens = Math.ceil(node.metadata.systemPrompt.length / 4);
    }

    // Usamos la configuración del nodo (en una implementación real se usaría para la API)
    const aiSettings = {
      model: node.metadata?.model || "default-model",
      temperature: node.metadata?.temperature || 0.7,
      systemPrompt: node.metadata?.systemPrompt || "",
    };

    // CAMBIO IMPORTANTE: Usamos el contenido del nodo como respuesta
    // En lugar de generar una respuesta genérica
    let responseText = nodeContent;

    // Si es un nodo de Agente de Voz IA, incluimos información adicional para el frontend
    if (node.type === NodeType.AI_VOICE_AGENT) {
      state.context.voiceAgentData = {
        text: responseText,
        voice: node.metadata?.voice || "default",
        rate: node.metadata?.rate || 1.0,
        delay: node.metadata?.delay || 0,
        provider: node.metadata?.provider || "default",
      };
      logger.debug(`Nodo IA con voz: configurando parámetros de voz`);
    }

    // Si hay un nombre de variable en los metadatos, guardamos la respuesta
    if (node.metadata?.responseVariableName) {
      const varName = node.metadata.responseVariableName as string;
      state.context[varName] = responseText;
      logger.debug(`IA: Guardando respuesta en variable ${varName}`);
    }

    // Simulamos tokens de salida
    const outputTokens = Math.ceil(responseText.length / 4);

    // Totales de tokens para métricas
    const totalTokens =
      inputTokens + outputTokens + promptTokens + systemPromptTokens;

    // Guardamos en historia la respuesta generada
    state.history.push(responseText);

    // Obtenemos el siguiente nodo
    const nextNodeId = getNextNodeId(node);

    if (nextNodeId) {
      state.currentNodeId = nextNodeId;
      logger.debug(
        `IA: Guardando próximo nodo ${nextNodeId} para siguiente interacción`
      );

      return {
        response: responseText,
        nextNodeId,
        metrics: {
          tokensUsed: totalTokens,
        },
      };
    }

    logger.info(
      `Nodo IA ${node.id} respondió: "${responseText.substring(0, 50)}..."`
    );

    return {
      response: responseText,
      metrics: {
        tokensUsed: totalTokens,
      },
    };
  } catch (error) {
    logger.error(`Error al procesar nodo de IA ${node.id}:`, error);

    return {
      response: "Lo siento, hubo un error al procesar la respuesta de IA.",
      error: error instanceof Error ? error.message : "Error desconocido",
      metrics: {
        tokensUsed: 15, // Valor nominal para errores
      },
    };
  }
}

/**
 * Evalúa una condición contra un mensaje de usuario
 */
export function evaluateCondition(
  condition: Condition,
  message: string,
  context: Record<string, any>
): boolean {
  try {
    // Aseguramos que message y value sean strings
    const messageStr = String(message || "");
    const valueStr = String(condition.value || "");

    // Normalizamos el mensaje si no es case sensitive
    const normalizedMessage = condition.caseSensitive
      ? messageStr
      : messageStr.toLowerCase();

    const normalizedValue = condition.caseSensitive
      ? valueStr
      : valueStr.toLowerCase();

    // Añadimos logging para depuración
    logger.debug(
      `Evaluando condición: ${condition.type}, buscando "${normalizedValue}" en "${normalizedMessage}"`
    );

    switch (condition.type) {
      case ConditionType.CONTAINS:
        const result = normalizedMessage.includes(normalizedValue);
        logger.debug(`Resultado de condición CONTAINS: ${result}`);
        return result;

      case ConditionType.EQUALS:
        return normalizedMessage === normalizedValue;

      case ConditionType.REGEX:
        return new RegExp(valueStr).test(messageStr);

      case ConditionType.CONTEXT_HAS:
        return valueStr in context;

      case ConditionType.CONTEXT_VALUE:
        // Formato esperado: "variable=valor"
        const [variable, value] = valueStr.split("=");
        return context[variable] === value;

      case ConditionType.INTENT_IS:
        // Requeriría integración con sistema de NLU
        // Por ahora devolvemos false
        logger.warn(`Condición INTENT_IS no implementada`);
        return false;

      case ConditionType.SENTIMENT_IS:
        // Requeriría integración con análisis de sentimiento
        logger.warn(`Condición SENTIMENT_IS no implementada`);
        return false;

      case ConditionType.ENTITY_PRESENT:
        // Requeriría integración con extracción de entidades
        logger.warn(`Condición ENTITY_PRESENT no implementada`);
        return false;

      case ConditionType.DEFAULT:
        // Condición por defecto, siempre se cumple
        logger.debug(`Condición DEFAULT: siempre verdadera`);
        return true;

      default:
        logger.warn(`Tipo de condición desconocido: ${condition.type}`);
        return false;
    }
  } catch (error) {
    logger.error(`Error al evaluar condición: ${error}`);
    return false;
  }
}

/**
 * Obtiene el ID del siguiente nodo
 * @param node Nodo actual
 * @returns ID del siguiente nodo o null si no hay
 */
export function getNextNodeId(node: FlowNode): string | null {
  // Si es un nodo con next simple (string)
  if (typeof node.next === "string") {
    return node.next;
  }

  // Si es un nodo con next como array de objetos con nextNodeId
  if (Array.isArray(node.next) && node.next.length > 0) {
    // Si no son condicionales, tomamos el primero
    if (node.next[0].nextNodeId && !node.next[0].condition) {
      return node.next[0].nextNodeId;
    }

    // Si son condicionales, no podemos decidir aquí
    if (node.next[0].condition) {
      return null;
    }
  }

  // Si hay nextNodeId en el objeto principal
  if (node.nextNodeId) {
    return node.nextNodeId;
  }

  // No hay siguiente nodo
  return null;
}

/**
 * Permite ejecutar un flujo completo con un conjunto de mensajes
 * Útil para pruebas y simulaciones
 */
export async function simulateConversation(
  flow: RuntimeFlow,
  messages: string[],
  userId: string = "test-user",
  sessionId: string = "test-session"
): Promise<{
  responses: string[];
  finalState: FlowState;
  metrics: ProcessMetrics;
}> {
  let state: FlowState | undefined;
  const responses: string[] = [];
  let totalTokens = 0;
  let totalNodes = 0;
  let totalTime = 0;

  // Procesamos cada mensaje
  for (const message of messages) {
    const result = await processFlowMessage(
      flow,
      message,
      userId,
      sessionId,
      state
    );

    // Guardamos respuesta y estado
    responses.push(result.response);
    state = result.state;

    // Acumulamos métricas
    if (result.metrics) {
      totalTokens += result.metrics.tokensUsed;
      totalNodes += result.metrics.nodesVisited;
      totalTime += result.metrics.processingTimeMs;
    }
  }

  // Devolvemos respuestas, estado final y métricas acumuladas
  return {
    responses,
    finalState: state!,
    metrics: {
      tokensUsed: totalTokens,
      nodesVisited: totalNodes,
      processingTimeMs: totalTime,
    },
  };
}

export default {
  processFlowMessage,
  processNode,
  simulateConversation,
};
