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
import { ExtendedFlowState } from "../models/extendedFlow.types";
import {
  processButtonsNode,
  processListNode,
} from "./buttonProcessor";
import logger from "../utils/logger";
import { replaceVariablesEnhanced } from "../utils/variableReplacerFix";
import { processFinalText } from "../utils/finalReplacer";
import { processCompositeMessage, parseMessageWithEmbeddedMedia, CompositeMessage } from "../utils/compositeMessageProcessor";

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
  state: FlowState | ExtendedFlowState;
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
    const state: ExtendedFlowState = prevState || {
      flowId: flow.id,
      currentNodeId: flow.entryNodeId,
      context: {},
      history: [],
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      userId,
      sessionId,
      variables: {},
      tenantId: 'default'
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

    // Asegurarnos de procesar las variables en la respuesta final
    const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
    let finalResponse = result.response || "Lo siento, no pude procesar tu solicitud correctamente.";
    
    try {
      // Procesamos el texto final para asegurar que todas las variables sean reemplazadas
      finalResponse = await processFinalText(finalResponse, {
        ...state,
        ...state.context,
        ...(state.variables || {})
      }, tenantId);
      logger.debug(`Variables procesadas en respuesta final`);
    } catch (error) {
      logger.error(`Error al procesar variables en respuesta final: ${error}`);
      // Seguimos con la respuesta original si hay error
    }
    
    return {
      response: finalResponse,
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

    // Incluso en caso de error, intentamos procesar las variables en la respuesta
    const tenantId = (state as ExtendedFlowState).tenantId || (state.context && state.context.tenantId) || 'default';
    let errorResponse = "Ha ocurrido un error al procesar tu mensaje.";
    
    try {
      // Procesamos el texto de error para asegurar que todas las variables sean reemplazadas
      errorResponse = await processFinalText(errorResponse, {
        ...state,
        ...state.context,
        ...((state as ExtendedFlowState).variables || {})
      }, tenantId);
    } catch (secondError) {
      // Ignoramos errores al procesar el mensaje de error
    }
    
    return {
      response: errorResponse,
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
  state: ExtendedFlowState,
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
        // Incluso en los mensajes de error, procesamos las variables
        const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
        let errorMessage = "Lo siento, ocurrió un error en el flujo de conversación. Estamos trabajando para solucionarlo.";
        
        try {
          errorMessage = await processFinalText(errorMessage, {
            ...state,
            ...state.context,
            ...(state.variables || {})
          }, tenantId);
        } catch (processingError) {
          // Si hay error al procesar, usamos el mensaje original
        }
        
        return {
          response: errorMessage,
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

      case NodeType.BUTTONS:
      case NodeType.BUTTONS_NODE:
        // Para nodos de botones, presentamos opciones al usuario
        logger.info(`Procesando nodo de botones ${node.id}`);
        return processButtonsNode(node, flow, state, onNodeVisit);
        
      case NodeType.LIST:
      case NodeType.LIST_NODE:
        // Para nodos de lista, presentamos una lista de opciones al usuario
        logger.info(`Procesando nodo de lista ${node.id}`);
        return processListNode(node, flow, state, onNodeVisit);

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
    // Procesar variables en mensaje de error
    let errorMessage = "Error interno al procesar el flujo.";
    const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
    
    try {
      errorMessage = await processFinalText(errorMessage, {
        ...state,
        ...state.context,
        ...(state.variables || {})
      }, tenantId);
    } catch (processingError) {
      // Si hay error al procesar, usamos el mensaje original
    }
    
    return {
      response: errorMessage,
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
  state: ExtendedFlowState,
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
  // Procesar las variables en el mensaje de bienvenida
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let welcomeMessage = node.content || "Bienvenido al sistema de chat.";
  
  try {
    welcomeMessage = await processFinalText(welcomeMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    logger.error(`Error al procesar variables en nodo de inicio: ${error}`);
    // Seguimos con el contenido original si hay error
  }
  
  return {
    response: welcomeMessage,
  };
}

/**
 * Procesa un nodo de tipo fin
 */
export async function processEndNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState
): Promise<NodeProcessResult> {
  // Agregamos el mensaje de fin a la historia
  state.history.push(node.content);
  logger.info(`Procesando nodo final ${node.id}: "${node.content}"`);

  // Procesamos las variables en el mensaje final
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let finalContent = node.content || "Fin de la conversación.";
  
  try {
    // Asegurarnos de que las variables se reemplacen correctamente
    finalContent = await processFinalText(finalContent, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    logger.error(`Error al procesar variables en nodo final: ${error}`);
    // Seguimos con el contenido original si hay error
  }
  
  // Devolvemos el mensaje del nodo final
  return {
    response: finalContent,
  };
}

/**
 * Procesa un nodo de tipo mensaje
 */
export async function processMessageNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  let messageContent = node.content;
  let mediaUrl = (node.metadata as any)?.media || (node.metadata as any)?.imageUrl || (node.metadata as any)?.audioUrl || (node.metadata as any)?.videoUrl;
  let mediaType = (node.metadata as any)?.mediaType;
  let mediaCaption = (node.metadata as any)?.caption || (node.metadata as any)?.mediaCaption;

  // Verificar si el nodo está en modo "auto" para generación dinámica
  const isAutoMode = node.metadata?.mode === "auto";

  // Si está en modo "auto" y hay plantilla/prompt, generar contenido
  if (isAutoMode && node.metadata?.template) {
    try {
      logger.info(`Nodo de mensaje ${node.id} en modo AUTO - Generando contenido dinámico`);

      // Construir mensaje con variables del contexto
      const template = node.metadata.template as string;
      
      // Combinamos todas las variables de estado.context y otras fuentes
      const allVariables = {
        ...state.context,
        ...state,
        ...(state.variables || {}),
      };
      
      // Procesamos el template usando todas las variables disponibles
      // Utilizamos replaceVariablesEnhanced para mejor manejo de variables
      messageContent = replaceVariablesEnhanced(template, allVariables);

      // Si no pudo reemplazar placeholders, usar plantilla original
      if (!messageContent || messageContent.trim() === "") {
        messageContent = template;
      }

      logger.info(`Mensaje dinámico generado: "${messageContent.substring(0, 50)}..."`);
    } catch (templateError) {
      logger.error(`Error al generar mensaje dinámico: ${templateError}`);
      // Mantener el contenido original en caso de error
    }
  }
  // Si el contenido está vacío, proporcionar un valor por defecto contextual
  else if (!messageContent || messageContent.trim() === "") {
    const userMessage = state.context.lastUserMessage || "";
    messageContent = `He recibido tu mensaje${userMessage ? `: "${userMessage.substring(0, 30)}..."` : ""}. ¿Cómo puedo ayudarte?`;
    logger.warn(`Nodo mensaje ${node.id} con contenido vacío, usando respuesta genérica`);
  }
  
  // Verificamos si hay medios embebidos en el mensaje
  const parsedMessage = parseMessageWithEmbeddedMedia(messageContent);
  if (parsedMessage.type === 'composite' && parsedMessage.media && !mediaUrl) {
    // Si hay medios embebidos en el mensaje y no hay medios explícitos, usamos los embebidos
    if (typeof parsedMessage.media === 'string') {
      mediaUrl = parsedMessage.media;
    } else {
      mediaUrl = parsedMessage.media.url;
      mediaType = parsedMessage.media.type;
      mediaCaption = parsedMessage.media.caption;
    }
    // Actualizamos el mensaje sin la referencia al medio
    messageContent = parsedMessage.text;
  }

  // Creamos un mensaje compuesto con el contenido y los medios
  const compositeMessage: CompositeMessage = {
    text: messageContent,
    type: mediaUrl ? 'composite' : 'text'
  };
  
  // Si hay medios, los agregamos al mensaje compuesto
  if (mediaUrl) {
    compositeMessage.media = {
      url: mediaUrl,
      type: mediaType as any,
      caption: mediaCaption
    };
  }
  
  // Si hay botones definidos, los agregamos al mensaje compuesto
  if ((node.metadata as any)?.buttons && Array.isArray((node.metadata as any).buttons) && (node.metadata as any).buttons.length > 0) {
    compositeMessage.buttons = (node.metadata as any).buttons;
    compositeMessage.type = 'buttons';
  }

  // Procesamos el mensaje compuesto para asegurar que todas las variables sean reemplazadas
  // Obtenemos el tenantId del estado si está disponible
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let processedCompositeMessage: CompositeMessage;
  
  try {
    // Procesamos el mensaje compuesto de forma asíncrona
    processedCompositeMessage = await processCompositeMessage(compositeMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
    
    // Actualizamos el mensaje procesado
    messageContent = processedCompositeMessage.text;
    
    // Agregamos el mensaje procesado a la historia
    state.history.push(messageContent);
    logger.info(
      `Procesando nodo de mensaje ${node.id}: "${messageContent.substring(0, 50)}..."`
    );
  } catch (error) {
    logger.error(`Error al procesar mensaje compuesto en nodo ${node.id}:`, error);
    // En caso de error, seguimos con el mensaje original
    processedCompositeMessage = compositeMessage;
    state.history.push(messageContent);
  }

  // Obtenemos el siguiente nodo (si existe)
  const nextNodeId = getNextNodeId(node);

  // Verificar si el nodo debe esperar respuesta del usuario
  const waitForResponse = (node.metadata as any)?.waitForResponse === true;
  
  // Si el nodo está configurado para no esperar respuesta y hay un siguiente nodo, 
  // procesamos automáticamente el siguiente nodo (auto-flow)
  if (nextNodeId && !waitForResponse) {
    logger.info(`Nodo de mensaje ${node.id} configurado para auto-flow. Continuando a nodo ${nextNodeId}`);
    state.currentNodeId = nextNodeId;
    
    // Primero respondemos con el mensaje actual
    // Esto es importante para mantener la conversación fluida
    let result: NodeProcessResult = {
      response: messageContent,
      context: {
        responseType: processedCompositeMessage.type,
        messageData: processedCompositeMessage
      }
    };
    
    // Luego procesamos recursivamente el siguiente nodo
    // Esto permitirá encadenar múltiples nodos automáticos
    try {
      // Cambiamos al siguiente nodo
      state.currentNodeId = nextNodeId;
      
      // Procesamos el siguiente nodo
      const nextResult = await processNode(flow, state, onNodeVisit);
      
      // Si el siguiente nodo generó una respuesta, la concatenamos
      if (nextResult.response) {
        result.response = `${messageContent}\n\n${nextResult.response}`;
      }
      
      // Propagamos cualquier otro resultado del nodo siguiente
      result.nextNodeId = nextResult.nextNodeId;
      result.metrics = nextResult.metrics;
      result.shouldWait = nextResult.shouldWait;
      
      // Combinamos los contextos
      if (nextResult.context) {
        result.context = {
          ...result.context,
          ...nextResult.context
        };
      }
      
      return result;
    }
    catch (error) {
      logger.error(`Error en auto-flow después de nodo ${node.id}:`, error);
      // Si hay error en el auto-flow, al menos devolvemos el mensaje actual
      return {
        response: messageContent,
        error: `Error en auto-flow: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        context: {
          responseType: processedCompositeMessage.type,
          messageData: processedCompositeMessage
        }
      };
    }
  }
  // Si el nodo debe esperar respuesta o no hay siguiente nodo
  else {
    state.currentNodeId = nextNodeId || node.id;
    logger.debug(
      `Mensaje: ${waitForResponse ? 'Esperando respuesta del usuario' : 'No hay siguiente nodo'}`
    );

    // Devolvemos el contenido del mensaje procesado
    return {
      response: messageContent,
      nextNodeId: nextNodeId,
      shouldWait: waitForResponse,
      context: {
        responseType: processedCompositeMessage.type,
        messageData: processedCompositeMessage
      }
    };
  }
}

/**
 * Función auxiliar para reemplazar placeholders en plantillas de mensajes
 * Ejemplo: "Hola {nombre}, tu cita es el {fecha}" -> "Hola Juan, tu cita es el 15/05/2025"
 * Utiliza la función mejorada replaceVariablesEnhanced para soportar todos los formatos de variables
 * @deprecated Use replaceVariablesEnhanced from variableReplacerFix.ts instead
 */
function replacePlaceholders(template: string, context: Record<string, any>): string {
  if (!template) return '';
  
  try {
    // Utilizar directamente la función mejorada
    return replaceVariablesEnhanced(template, context);
  } catch (error) {
    logger.error(`Error al reemplazar placeholders: ${error}`);
    return template; // Devolver plantilla original en caso de error
  }
}

/**
 * Procesa un nodo de tipo condición
 */
export async function processConditionNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
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
  // Procesar variables en el mensaje por defecto
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let defaultMessage = "No entendí tu solicitud. ¿Podrías reformularla?";
  
  try {
    defaultMessage = await processFinalText(defaultMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    // Si hay error al procesar, usamos el mensaje original
  }
  
  return {
    response: defaultMessage,
  };
}

/**
 * Procesa un nodo de tipo acción
 */
export async function processActionNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
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

  // Procesar variables en el mensaje de acción
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let actionMessage = "Acción ejecutada correctamente.";
  
  try {
    actionMessage = await processFinalText(actionMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    // Si hay error al procesar, usamos el mensaje original
  }
  
  return {
    response: actionMessage,
  };
}

/**
 * Procesa un nodo de tipo llamada a API
 */
export async function processApiCallNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
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

  // Procesar variables en el mensaje de API
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let apiMessage = "Llamada a API completada.";
  
  try {
    apiMessage = await processFinalText(apiMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    // Si hay error al procesar, usamos el mensaje original
  }
  
  return {
    response: apiMessage,
  };
}

/**
 * Procesa un nodo de tipo entrada
 */
export async function processInputNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
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

  // Procesar variables en el mensaje de entrada
  const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
  let inputMessage = node.content;
  
  try {
    inputMessage = await processFinalText(inputMessage, {
      ...state,
      ...state.context,
      ...(state.variables || {})
    }, tenantId);
  } catch (error) {
    logger.error(`Error al procesar variables en nodo de entrada: ${error}`);
    // Seguimos con el contenido original si hay error
  }
  
  // Si no hay siguiente nodo, devolvemos la pregunta como respuesta
  return {
    response: inputMessage,
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
  state: ExtendedFlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  try {
    logger.info(
      `Procesando nodo de IA ${
        node.id
      } con contenido: "${node.content?.substring(0, 30)}..."`
    );

    // Información básica para métricas
    const userMessage = state.context.lastUserMessage || "";
    const nodeContent = node.content || "";

    // Verificar si el nodo está configurado para usar el modo "auto" de OpenAI
    const isAutoMode =
      node.metadata?.mode === "auto" ||
      ((!nodeContent || nodeContent.trim() === "Respuesta AI") &&
      node.metadata?.prompt && typeof node.metadata.prompt === 'string');

    // Inicializar variables para métricas
    let inputTokens = Math.ceil(userMessage.length / 4);
    let promptTokens = Math.ceil(nodeContent.length / 4);
    let systemPromptTokens = 0;
    let outputTokens = 0;
    let responseText = nodeContent;

    // Si hay un prompt de sistema en los metadatos, lo contamos
    if (node.metadata?.systemPrompt) {
      systemPromptTokens = Math.ceil(node.metadata.systemPrompt.length / 4);
    }

    // Configuración para API de IA
    const aiSettings = {
      model: node.metadata?.model || "gpt-4o-mini",
      temperature: node.metadata?.temperature || 0.7,
      systemPrompt: node.metadata?.systemPrompt || "",
      prompt: node.metadata?.prompt || "",
      maxTokens: node.metadata?.maxTokens || 500
    };

    // INTEGRACIÓN CON OPENAI - Llamada real a la API en modo "auto"
    if (isAutoMode) {
      try {
        logger.info(`Nodo IA ${node.id} configurado en modo AUTO - Llamando a OpenAI`);

        // Importamos dinámicamente para evitar ciclos de dependencia
        const AIServices = (await import('../services/aiServices')).default;

        // Verificamos que tengamos la API Key configurada
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("API Key de OpenAI no configurada en variables de entorno");
        }

        // Inicializamos el servicio de IA
        const aiService = new AIServices(process.env.OPENAI_API_KEY);

        // Construir el prompt completo
        let prompt = aiSettings.systemPrompt || "";
        if (aiSettings.prompt) {
          prompt += "\n\n" + aiSettings.prompt;
        }

        // Si no hay un prompt configurado, crear uno genérico
        if (!prompt || prompt.trim() === "") {
          prompt = "Eres un asistente virtual amable y útil. Responde de manera concisa y profesional.";
        }

        // Crear el historial de mensajes para la API
        const messages = [
          { role: "user", content: userMessage }
        ];

        // Obtenemos respuesta real de OpenAI
        responseText = await aiService.chat(prompt, messages);
        logger.info(`OpenAI respondió con éxito: "${responseText.substring(0, 50)}..."`);

        // Calcular tokens de salida
        outputTokens = Math.ceil(responseText.length / 4);
      } catch (openaiError) {
        logger.error(`Error al llamar a OpenAI: ${openaiError}`);

        // En caso de error, caemos a una respuesta fallback
        responseText = `Lo siento, estoy teniendo problemas para procesar tu solicitud. ¿Podrías intentarlo de nuevo?`;

        // También intentamos generar una respuesta contextual como backup
        if (userMessage) {
          responseText += ` He recibido tu mensaje: "${userMessage.substring(0, 30)}..."`;
        }
      }
    }
    // MODO ESTÁTICO - Usar el contenido predefinido del nodo
    else {
      // Si el contenido está vacío o es exactamente "Respuesta AI", generamos una respuesta genérica
      if (!responseText || responseText.trim() === "" || responseText.trim() === "Respuesta AI") {
        logger.warn(`Nodo IA ${node.id} tiene contenido vacío o es solo "Respuesta AI". Usando respuesta alternativa.`);
        // Usar el prompt como respuesta si está disponible
        if (node.metadata?.prompt && typeof node.metadata.prompt === 'string' && node.metadata.prompt.trim() !== '') {
          responseText = `Respuesta generada según tu solicitud: "${state.context.lastUserMessage}"`;
          logger.info(`Usando respuesta generada basada en el prompt`);
        } else {
          // Fallback a una respuesta genérica informativa
          responseText = `He recibido tu mensaje: "${state.context.lastUserMessage}". ¿En qué más puedo ayudarte?`;
          logger.info(`Usando respuesta genérica de fallback`);
        }
      }
      logger.info(`Nodo IA ${node.id} usando contenido estático predefinido`);
    }

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

    // Actualizamos tokens de salida si no se calcularon antes
    if (outputTokens === 0) {
      outputTokens = Math.ceil(responseText.length / 4);
    }

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

    // Procesamos el texto final para asegurar que todas las variables sean reemplazadas
    // Obtenemos el tenantId del estado si está disponible
    const tenantId = (state as ExtendedFlowState).tenantId || (state.context && state.context.tenantId) || 'default';
    
    try {
      // Procesamos el texto final de forma asíncrona
      const processedText = await processFinalText(responseText, {
        ...state,
        ...state.context,
        ...((state as ExtendedFlowState).variables || {})
      }, tenantId);
      
      // Actualizamos el texto procesado
      responseText = processedText;
    } catch (error) {
      logger.error(`Error al procesar texto final en nodo IA ${node.id}:`, error);
      // En caso de error, seguimos con el texto original
    }

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
