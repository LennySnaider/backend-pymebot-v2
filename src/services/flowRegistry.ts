/**
 * src/services/flowRegistry.ts
 * 
 * Registro central de flujos para la integración con BuilderBot.
 * Proporciona métodos para registrar y recuperar flujos, así como
 * convertir plantillas a flujos de BuilderBot.
 * 
 * @version 1.0.0
 * @created 2025-05-10
 */

import { createFlow, addKeyword } from "@builderbot/bot";
import logger from "../utils/logger";
import { config } from "../config";
import { convertTemplateToBuilderbotFlow } from "./templateConverter";
import { loadConversationState, saveConversationState } from "./stateManager";

// Importamos flowStates desde botFlowIntegration para compartir el estado
// Esto es una dependencia circular que debemos manejar con cuidado
// Creamos una variable local que usaremos como caché
let _localFlowStates: Record<string, any> = {};

// Importación dinámica de flujos predefinidos
// Usamos importación dinámica para evitar ciclos de dependencia
const leadCaptureFlow = async () => {
  try {
    logger.info("Intentando cargar flujo lead-capture.flow");
    const module = await import("../flows/lead-capture.flow");

    // Verificar que el módulo exporta un objeto con handleMsg
    if (module.default && typeof module.default.handleMsg === 'function') {
      logger.info("Flujo lead-capture cargado correctamente, tiene método handleMsg");
      return module.default;
    } else if (module.default) {
      // Si el módulo no tiene handleMsg pero es un flujo válido, construimos un adaptador
      logger.info("Flujo lead-capture no tiene método handleMsg, creando adaptador");

      // Intentamos crear un adaptador si el módulo parece ser un flujo de BuilderBot
      if (typeof module.default.addKeyword === 'function' ||
          typeof module.default.addAnswer === 'function' ||
          Array.isArray(module.default) ||
          (module.default.flows && Array.isArray(module.default.flows))) {

        const { createFlow } = await import("@builderbot/bot");

        // Si es un array de flujos, lo usamos directamente
        if (Array.isArray(module.default)) {
          logger.info("Creando adaptador con array de flujos");
          return createFlow(module.default);
        }
        // Si tiene un campo flows que es array, usamos ese
        else if (module.default.flows && Array.isArray(module.default.flows)) {
          logger.info("Creando adaptador con campo flows");
          return createFlow(module.default.flows);
        }
        // Si es un objeto único con addKeyword, lo envolvemos en un array
        else if (typeof module.default.addKeyword === 'function') {
          logger.info("Creando adaptador con un único flujo addKeyword");
          return createFlow([module.default]);
        }
      }

      logger.warn("No se pudo crear un adaptador para el flujo lead-capture");
    }

    logger.error("El flujo lead-capture no tiene una estructura válida");
    return null;
  } catch (error) {
    logger.error("Error al cargar lead-capture.flow:", error);
    return null;
  }
};

// Registro de flujos disponibles
const flowRegistry: Record<string, any> = {};

// Registro de flujos convertidos desde plantillas
const templateFlowRegistry: Record<string, any> = {};

/**
 * Registra un flujo predefinido en el sistema
 * 
 * @param flowId ID único del flujo
 * @param flow Flujo de BuilderBot
 * @returns true si se registró correctamente
 */
export const registerFlow = (flowId: string, flow: any): boolean => {
  try {
    if (!flowId || !flow) {
      logger.error('ID de flujo o flujo inválido al registrar');
      return false;
    }
    
    // Registramos el flujo
    flowRegistry[flowId] = flow;
    logger.info(`Flujo "${flowId}" registrado correctamente`);
    
    return true;
  } catch (error) {
    logger.error(`Error al registrar flujo ${flowId}:`, error);
    return false;
  }
};

/**
 * Obtiene un flujo por su ID
 * 
 * @param flowId ID del flujo
 * @returns Flujo de BuilderBot o null si no existe
 */
export const getFlow = (flowId: string): any => {
  try {
    // Primero buscamos en flujos predefinidos
    if (flowRegistry[flowId]) {
      return flowRegistry[flowId];
    }
    
    // Luego en flujos convertidos de plantillas
    if (templateFlowRegistry[flowId]) {
      return templateFlowRegistry[flowId];
    }
    
    // Por último, intentamos el método para cargar flujos dinámicos
    if (flowId === 'lead-capture') {
      return leadCaptureFlow;
    }
    
    logger.warn(`Flujo "${flowId}" no encontrado en el registro`);
    return null;
  } catch (error) {
    logger.error(`Error al obtener flujo ${flowId}:`, error);
    return null;
  }
};

/**
 * Convertir y registrar una plantilla como flujo de BuilderBot
 * 
 * @param templateId ID de la plantilla
 * @param templateData Datos de la plantilla
 * @returns true si se convirtió y registró correctamente
 */
export const registerTemplateAsFlow = (
  templateId: string,
  templateData: any,
  additionalData: Record<string, any> = {}
): boolean => {
  try {
    // Convertimos la plantilla a flujo de BuilderBot
    const conversionResult = convertTemplateToBuilderbotFlow(templateData);
    
    if (!conversionResult) {
      logger.error(`Error al convertir plantilla ${templateId} a flujo BuilderBot`);
      return false;
    }
    
    // Registramos el flujo convertido con datos adicionales
    templateFlowRegistry[templateId] = {
      ...conversionResult.flow,
      // Añadimos datos adicionales al objeto del flujo
      originalJson: additionalData.originalJson,
      configuration: additionalData.configuration
    };
    
    logger.info(`Plantilla "${templateId}" convertida y registrada como flujo`);
    logger.debug(`Palabras clave de entrada: ${conversionResult.entryKeywords.join(', ')}`);
    
    return true;
  } catch (error) {
    logger.error(`Error al registrar plantilla ${templateId} como flujo:`, error);
    return false;
  }
};

/**
 * Obtiene un adaptador de flujo completo para BuilderBot
 * incluyendo todos los flujos registrados
 * 
 * @returns Adaptador de flujo de BuilderBot
 */
export const getFlowAdapter = (): any => {
  try {
    // Recopilamos todos los flujos disponibles
    const allFlows = [
      ...Object.values(flowRegistry),
      ...Object.values(templateFlowRegistry)
    ];
    
    if (allFlows.length === 0) {
      logger.warn('No hay flujos registrados para crear el adaptador');
      // Devolvemos un adaptador vacío - no usar flujos de fallback
      return createFlow([]);
    }
    
    // Creamos el adaptador de flujo con todos los flujos
    const flowAdapter = createFlow(allFlows);
    
    logger.info(`Adaptador de flujo creado con ${allFlows.length} flujos`);
    return flowAdapter;
  } catch (error) {
    logger.error('Error al crear adaptador de flujo:', error);
    
    // Devolvemos un adaptador vacío - no usar flujos de fallback
    return createFlow([]);
  }
};

/**
 * Procesa un mensaje utilizando el flujo adecuado
 * 
 * @param message Mensaje del usuario
 * @param userId ID del usuario
 * @param sessionId ID de la sesión
 * @param tenantId ID del tenant
 * @param templateId ID de la plantilla a usar (opcional)
 * @returns Respuesta generada, estado actualizado y métricas
 */
export const processFlowMessage = async (
  message: string,
  userId: string,
  sessionId: string,
  tenantId: string,
  templateId?: string
): Promise<{
  response: string;
  state: Record<string, any>;
  metrics?: { tokensUsed: number };
}> => {
  try {
    logger.info(`Procesando mensaje para usuario ${userId}, tenant ${tenantId}, sesión ${sessionId}`);

    // Intentamos cargar el estado anterior
    let prevState: Record<string, any> | null = null;
    let isFirstInteraction = false; // Marcador para saber si es la primera interacción o no

    // Primero intentamos usar memoria local para garantizar consistencia
    const stateKey = `${tenantId}-${userId}-${sessionId}`;

    // Intentamos obtener el estado desde botFlowIntegration de forma segura
    try {
      // Primero verificamos nuestra caché local
      if (!_localFlowStates[stateKey]) {
        // Si no está en nuestra caché, intentamos obtenerlo de botFlowIntegration
        const { flowStates } = await import('./botFlowIntegration');
        if (flowStates && flowStates[stateKey]) {
          // Si existe en botFlowIntegration, lo guardamos en nuestra caché
          _localFlowStates[stateKey] = flowStates[stateKey];
          logger.debug(`Estado recuperado de botFlowIntegration.flowStates para sesión ${sessionId}`);
        }
      }
    } catch (importError) {
      logger.warn(`No se pudo importar flowStates desde botFlowIntegration: ${importError}`);
    }

    // Usamos nuestra variable local
    const inMemoryState = _localFlowStates[stateKey];

    if (inMemoryState) {
      // Si tenemos estado en memoria, lo usamos directamente
      logger.info(`Usando estado en memoria para sesión ${sessionId}`);
      prevState = inMemoryState;

      // Verificamos si el estado tiene información de nodo actual
      if (prevState.currentNodeId || prevState.current_node_id) {
        logger.info(`Estado en memoria tiene nodo actual: ${prevState.currentNodeId || prevState.current_node_id}`);
        isFirstInteraction = false;
      } else {
        logger.info(`Estado en memoria sin nodo actual, tratando como primera interacción`);
        isFirstInteraction = true;
      }
    } else {
      // Si no hay estado en memoria, intentamos cargar desde base de datos
      try {
        logger.info(`Intentando cargar estado desde BD para sesión ${sessionId}`);
        prevState = await loadConversationState(tenantId, userId, sessionId);

        // Verificamos si el estado previo existe y tiene información de nodo actual
        if (prevState && (prevState.currentNodeId || prevState.current_node_id)) {
          logger.info(`Estado cargado desde BD para sesión ${sessionId}. Nodo actual: ${prevState.currentNodeId || prevState.current_node_id}`);
          isFirstInteraction = false;

          // Guardamos en memoria para futuras referencias
          _localFlowStates[stateKey] = prevState;

          // También intentamos sincronizar con botFlowIntegration
          try {
            const { flowStates } = await import('./botFlowIntegration');
            if (flowStates) {
              flowStates[stateKey] = prevState;
              logger.debug(`Estado sincronizado con botFlowIntegration.flowStates para sesión ${sessionId}`);
            }
          } catch (syncError) {
            logger.warn(`No se pudo sincronizar con botFlowIntegration: ${syncError}`);
          }
        } else {
          logger.info(`No se encontró información de nodo actual en el estado de BD, tratando como primera interacción`);
          isFirstInteraction = true;
        }
      } catch (stateError) {
        logger.warn(`Error al cargar estado previo: ${stateError}. Usando estado básico.`);
        isFirstInteraction = true;
        prevState = {
          flow_id: templateId || 'default',
          session_id: sessionId,
          tenant_id: tenantId,
          user_id: userId,
          started_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString()
        };
      }
    }

    // Determinamos qué flujo usar
    let flowId = templateId;

    // Si no hay templateId pero hay estado previo, intentamos usar el flujo del estado
    if (!flowId && prevState && prevState.flow_id) {
      flowId = prevState.flow_id;
      logger.info(`Usando flowId ${flowId} del estado anterior`);
    }

    // Si aún no tenemos flujo, usamos el predeterminado
    if (!flowId) {
      flowId = config.flows?.defaultFlow || 'lead-capture';
      logger.info(`Usando flowId predeterminado: ${flowId}`);
    }

    // Verificamos si el flujo ya está cargado
    let flow = getFlow(flowId);

    // Si el flujo no está cargado, intentamos cargarlo dinámicamente
    if (!flow) {
      logger.info(`Flujo ${flowId} no está en el registro, intentando carga dinámica...`);
      const loadSuccess = await loadFlowForTenant(flowId, tenantId);

      if (loadSuccess) {
        // Intentamos obtener el flujo nuevamente después de cargarlo
        flow = getFlow(flowId);
        logger.info(`Flujo ${flowId} cargado dinámicamente con éxito`);
      } else {
        logger.error(`No se pudo cargar el flujo ${flowId} para tenant ${tenantId}`);
      }
    }

    // Si aún no tenemos el flujo, devolvemos un error
    if (!flow) {
      logger.error(`Flujo ${flowId} no encontrado, notificando error al usuario`);
      return {
        response: "Lo siento, la plantilla de flujo solicitada no está disponible en este momento. Por favor contacta al soporte técnico.",
        state: prevState || {},
        metrics: { tokensUsed: 0 }
      };
    }

    // Preparamos el estado inicial si no existe
    let initialState = prevState || {
      flow_id: flowId,
      session_id: sessionId,
      tenant_id: tenantId,
      user_id: userId,
      started_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString()
    };

    // Actualizamos el mensaje actual en el estado
    initialState.last_user_message = message;
    initialState.last_updated_at = new Date().toISOString();

    // Usamos nuestro nuevo marcador isFirstInteraction para decidir cómo procesar el mensaje
    // También verificamos el mensaje_count como respaldo
    const isFirstMessage = isFirstInteraction ||
                           !prevState ||
                           Object.keys(prevState).length === 0 ||
                           !prevState.message_count;

    // Si es el primer mensaje, lo tratamos especial con "HOLA"
    // De lo contrario, avanzamos en el flujo con el mensaje real del usuario
    const processMessage = isFirstMessage ? "HOLA" : message;

    // Registramos el número de mensajes en la conversación
    if (isFirstMessage) {
      logger.info('Primer mensaje en la sesión, activando flujo con "HOLA"');
      initialState.message_count = 1; // Iniciamos contador de mensajes
      initialState.initialized = true;
      // Establecer el nodo inicial (importante para la siguiente interacción)
      initialState.currentNodeId = 'start-node';
      initialState.current_node_id = 'start-node'; // Para compatibilidad con diferentes formatos
    } else {
      // Si no es el primer mensaje, incrementamos el contador y usamos el mensaje real
      initialState.message_count = (initialState.message_count || 0) + 1;
      logger.info(`Mensaje subsiguiente (#${initialState.message_count}): "${message}"`);
    }

    // Procesamos el mensaje según el tipo de flujo
    let response = "";
    let state = initialState;
    let metrics = { tokensUsed: 0 };

    // SOLUCIÓN DIRECTA: Verificar si hay una posible conversación esperando respuesta
    logger.info(`Comprobando estado para respuesta en progreso: ${JSON.stringify({
      isFirstMessage,
      waitingForInput: state.waitingForInput,
      waitingNodeId: state.waitingNodeId,
      currentNodeId: state.currentNodeId || state.current_node_id
    })}`);

    // FORZAR LA BÚSQUEDA DEL MENSAJE SIGUIENTE CUANDO DETECTAMOS ESTE PATRÓN
    // Este bloque se ejecuta SIEMPRE que sea un segundo mensaje o posterior
    if (!isFirstMessage) {
      // Buscar el nodo actual/anterior que podría estar esperando respuesta
      // Si waitingNodeId no está disponible, usamos currentNodeId o current_node_id como fallback
      const nodeToUse = state.waitingNodeId || state.currentNodeId || state.current_node_id;

      logger.info(`*** MODO PROCESO RÁPIDO ***: Procesando respuesta para nodo: ${nodeToUse}`);

      try {
        // Guardamos la respuesta del usuario
        if (!state.variables) state.variables = {};
        state.variables.lastUserResponse = message;
        state.lastUserResponse = message;

        // Si el estado tiene una variable esperada, usamos ese nombre de variable
        if (state.expectedVariable) {
          state.variables[state.expectedVariable] = message;
          logger.info(`Guardando respuesta "${message}" en variable esperada: ${state.expectedVariable}`);
        }

        logger.info(`Procesando respuesta "${message}" para nodo ${nodeToUse}`);

        // Para obtener el flujo inmediatamente
        const flowInstance = typeof flow === 'function' ? await flow() : flow;
        if (!flowInstance || !flowInstance.originalJson) {
          throw new Error("No se pudo obtener la estructura del flujo");
        }

        const flowJson = flowInstance.originalJson;
        if (!flowJson || !flowJson.nodes || !flowJson.edges) {
          throw new Error("Estructura de flujo inválida para procesar respuesta");
        }

        // 1. Identificamos el nodo actual/anterior
        const currentNode = flowJson.nodes.find(n => n.id === nodeToUse);
        if (!currentNode) {
          throw new Error(`No se encontró el nodo actual: ${nodeToUse}`);
        }

        // Verificamos si este nodo requiere respuesta
        // Si lo hace, procesamos la respuesta
        // Si no, simplemente avanzamos al siguiente
        const requiresResponse = currentNode.data?.waitForResponse === true ||
                               currentNode.data?.capture === true ||
                               currentNode.data?.waitResponse === true ||
                               currentNode.data?.requireResponse === true ||
                               state.waitingForInput === true;

        // Loguear detalles para depuración
        logger.info(`Nodo ${nodeToUse} ${requiresResponse ? 'requiere' : 'no requiere'} respuesta del usuario`);
        logger.info(`Datos del nodo: waitForResponse=${currentNode.data?.waitForResponse}, capture=${currentNode.data?.capture}`);

        // 2. Buscamos las conexiones que salen de este nodo
        const outEdges = flowJson.edges.filter(e => e.source === nodeToUse);
        if (outEdges.length === 0) {
          throw new Error(`El nodo ${nodeToUse} no tiene conexiones salientes`);
        }

        // 3. Avanzamos al siguiente nodo
        const nextNodeId = outEdges[0].target;
        const nextNode = flowJson.nodes.find(n => n.id === nextNodeId);
        if (!nextNode) {
          throw new Error(`No se encontró el nodo siguiente: ${nextNodeId}`);
        }

        logger.info(`Avanzando de nodo ${nodeToUse} a nodo ${nextNodeId} (tipo: ${nextNode.type || nextNode.data?.type})`);

        // 4. Actualizamos el estado para reflejar el avance
        state.currentNodeId = nextNodeId;
        state.current_node_id = nextNodeId;

        // 5. Limpiamos las banderas de espera, ya que hemos procesado la respuesta
        state.waitingForInput = false;
        state.waitingNodeId = null;
        state.expectedVariable = null;

        // 6. Extraemos el contenido del siguiente nodo
        const utils = await import('./chatbotUtils');
        if (nextNode.type === 'messageNode' || nextNode.data?.type === 'messageNode') {
          const nextNodeContent = utils.extractNodeContent(nextNode);
          if (nextNodeContent) {
            // Procesar variables si hay contenido
            let processedContent = nextNodeContent;
            // Reemplazar variables en el contenido
            if (state.variables) {
              Object.entries(state.variables).forEach(([key, value]) => {
                if (typeof value === 'string') {
                  const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                  processedContent = processedContent.replace(pattern, value);
                }
              });
            }

            // Caso especial para variable de nombre
            if (state.variables.nombre_usuario) {
              processedContent = processedContent.replace(/{{nombre_usuario}}/g, state.variables.nombre_usuario);
            } else if (state.variables.nombre) {
              processedContent = processedContent.replace(/{{nombre_usuario}}/g, state.variables.nombre);
              processedContent = processedContent.replace(/{{nombre}}/g, state.variables.nombre);
            }

            response = processedContent;
            logger.info(`Nueva respuesta: "${response.substring(0, 50)}..."`);

            // Verificar si este nodo también espera respuesta
            const newNodeRequiresResponse = nextNode.data?.waitForResponse === true ||
                                           nextNode.data?.capture === true ||
                                           nextNode.data?.waitResponse === true ||
                                           nextNode.data?.requireResponse === true;

            if (newNodeRequiresResponse) {
              logger.info(`El nuevo nodo ${nextNodeId} también espera respuesta del usuario`);
              state.waitingForInput = true;
              state.waitingNodeId = nextNodeId;
              state.expectedVariable = nextNode.data?.variableName || null;
            } else {
              // AUTO FLOW: Si el nodo NO requiere respuesta del usuario, continuamos automáticamente
              // al siguiente nodo para implementar el "auto flow"
              logger.info(`El nodo ${nextNodeId} no requiere respuesta del usuario, buscando auto-flow al siguiente nodo`);

              try {
                // Buscamos las conexiones que salen de este nodo
                const nextOutEdges = flowJson.edges.filter(e => e.source === nextNodeId);

                if (nextOutEdges.length > 0) {
                  const autoFlowNodeId = nextOutEdges[0].target;
                  const autoFlowNode = flowJson.nodes.find(n => n.id === autoFlowNodeId);

                  if (autoFlowNode) {
                    logger.info(`Auto-flow: Avanzando al nodo ${autoFlowNodeId} (tipo: ${autoFlowNode.type || autoFlowNode.data?.type})`);

                    // Si el nodo al que avanzamos es de tipo input, lo configuramos para esperar respuesta
                    if (autoFlowNode.type === 'inputNode' || autoFlowNode.data?.type === 'inputNode') {
                      let question = autoFlowNode.data?.question || autoFlowNode.data?.prompt || "¿Podrías proporcionar más información?";

                      // Procesar variables en la pregunta
                      if (state.variables) {
                        Object.entries(state.variables).forEach(([key, value]) => {
                          if (typeof value === 'string') {
                            const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                            question = question.replace(pattern, value);
                          }
                        });
                      }

                      // Caso especial para variable de nombre
                      if (state.variables.nombre_usuario) {
                        question = question.replace(/{{nombre_usuario}}/g, state.variables.nombre_usuario);
                      } else if (state.variables.nombre) {
                        question = question.replace(/{{nombre_usuario}}/g, state.variables.nombre);
                        question = question.replace(/{{nombre}}/g, state.variables.nombre);
                      }

                      // Actualizamos la respuesta para incluir también la pregunta
                      response = response + "\n\n" + question;

                      // Actualizamos el estado para el nuevo nodo
                      state.currentNodeId = autoFlowNodeId;
                      state.current_node_id = autoFlowNodeId;
                      state.waitingForInput = true;
                      state.waitingNodeId = autoFlowNodeId;
                      state.expectedVariable = autoFlowNode.data?.variableName;

                      logger.info(`Auto-flow configurado para esperar respuesta en variable: ${state.expectedVariable}`);
                    }
                    // Si es otro nodo de mensaje, solo actualizamos el estado para la próxima interacción
                    else if (autoFlowNode.type === 'messageNode' || autoFlowNode.data?.type === 'messageNode') {
                      // Solo actualizamos el estado para la próxima interacción, pero no modificamos la respuesta
                      state.currentNodeId = autoFlowNodeId;
                      state.current_node_id = autoFlowNodeId;
                    }
                  }
                }
              } catch (autoFlowError) {
                logger.error(`Error en auto-flow: ${autoFlowError}`);
                // Si hay error, continuamos sin el auto-flow
              }
            }
          }
        } else if (nextNode.type === 'inputNode' || nextNode.data?.type === 'inputNode') {
          // Si es un nodo de entrada, manejamos la pregunta
          let question = nextNode.data?.question || nextNode.data?.prompt || "¿Podrías proporcionar más información?";
          // Procesar variables en la pregunta
          if (state.variables) {
            Object.entries(state.variables).forEach(([key, value]) => {
              if (typeof value === 'string') {
                const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                question = question.replace(pattern, value);
              }
            });
          }

          // Caso especial para variable de nombre
          if (state.variables.nombre_usuario) {
            question = question.replace(/{{nombre_usuario}}/g, state.variables.nombre_usuario);
          } else if (state.variables.nombre) {
            question = question.replace(/{{nombre_usuario}}/g, state.variables.nombre);
            question = question.replace(/{{nombre}}/g, state.variables.nombre);
          }

          response = question;

          // Configurar para esperar la próxima respuesta
          state.waitingForInput = true;
          state.waitingNodeId = nextNodeId;
          state.expectedVariable = nextNode.data?.variableName;

          logger.info(`Configurado para esperar respuesta en variable: ${state.expectedVariable}`);
        }

        // Marcamos que procesamos la respuesta con éxito
        state.responseProcessed = true;
        logger.info("Respuesta procesada correctamente con el modo rápido");

        // Retornamos para evitar el procesamiento normal
        return {
          response,
          state,
          metrics: { tokensUsed: Math.ceil(response.length / 4) }
        };

      } catch (error) {
        // Si ocurre un error, logueamos pero continuamos con el procesamiento normal
        logger.error(`Error en modo de proceso rápido: ${error}`);
        logger.info("Continuando con el método estándar...");
      }
    }

    try {
      // Verificamos primero si tenemos un flujo BuilderBot válido
      const flowInstance = typeof flow === 'function' ? await flow() : flow;
      
      if (!flowInstance) {
        throw new Error(`Flujo ${flowId} no pudo ser instanciado`);
      }
      
      // Agregamos diagnóstico más detallado para depurar la estructura del flujo
      logger.debug(`Estructura del flujo ${flowId}:`, {
        hasProcessMessage: typeof flowInstance.processMessage === 'function',
        hasAddKeyword: typeof flowInstance.addKeyword === 'function',
        hasAddAnswer: typeof flowInstance.addAnswer === 'function',
        hasFlow: !!flowInstance.flow,
        hasFlowAddKeyword: flowInstance.flow && typeof flowInstance.flow.addKeyword === 'function',
        hasFlows: Array.isArray(flowInstance.flows) && flowInstance.flows.length > 0,
        hasCreateFlow: typeof flowInstance.createFlow === 'function',
        hasHandleMsg: typeof flowInstance.handleMsg === 'function',
        flowInstanceType: typeof flowInstance,
        flowConstructor: flowInstance && flowInstance.constructor ? flowInstance.constructor.name : 'unknown'
      });

      // Verificamos si el flujo tiene un método de procesamiento directo
      if (typeof flowInstance.processMessage === 'function') {
        logger.info(`Procesando con método processMessage directo para flujo ${flowId}`);
        const result = await flowInstance.processMessage(
          processMessage,
          userId,
          sessionId,
          initialState
        );

        response = result.response || "";
        state = {
          ...initialState,
          ...result.state
        };
        metrics = result.metrics || { tokensUsed: Math.ceil(response.length / 4) };
      }
      // Si el flujo es un objeto de addKeyword de BuilderBot (validación ampliada)
      else if (
        typeof flowInstance.addKeyword === 'function' ||
        (flowInstance.flow && typeof flowInstance.flow.addKeyword === 'function') ||
        (Array.isArray(flowInstance.flows) && flowInstance.flows.length > 0) ||
        typeof flowInstance.handleMsg === 'function'
      ) {
        logger.info(`Procesando con flujo BuilderBot nativo para ${flowId}`);

        // Asegurarnos de usar el objeto de flujo correcto
        let actualFlow = flowInstance;

        // Buscamos el objeto de flujo utilizable
        if (flowInstance.flow && typeof flowInstance.flow.addKeyword === 'function') {
          actualFlow = flowInstance.flow;
        } else if (Array.isArray(flowInstance.flows) && flowInstance.flows.length > 0) {
          // Si el flujo tiene un array de flujos, usamos el primero
          actualFlow = flowInstance.flows[0];
        }

        // Construimos un adaptador de flujo para este flujo
        let adapter;
        try {
          // Si el flujo ya tiene un método handleMsg, lo usamos directamente
          if (typeof flowInstance.handleMsg === 'function') {
            adapter = flowInstance;
          } else {
            adapter = createFlow([actualFlow]);
          }
        } catch (adapterError) {
          logger.error(`Error al crear adaptador de flujo: ${adapterError}`);
          // Intentamos una alternativa si falla
          adapter = createFlow([{
            keyword: 'HOLA',
            answer: 'Bienvenido al sistema'
          }]);
        }

        try {
          // Intentamos manejar el mensaje
          const result = await adapter.handleMsg({
            from: userId,
            body: processMessage,
            sessionId: sessionId
          }, initialState);

          if (result && result.answer) {
            response = result.answer;
            state = {
              ...initialState,
              last_response: response,
              flow_processed: true
            };
          } else {
            // No hubo respuesta del flujo, registramos el error
            logger.warn(`El flujo ${flowId} no devolvió respuesta para el mensaje "${processMessage}"`);
            if (isFirstMessage) {
              response = "El sistema está procesando su solicitud. Por favor, vuelva a intentarlo en unos momentos.";
            } else {
              response = "Lo siento, no pude entender su mensaje. ¿Podría reformularlo?";
            }
          }
        } catch (flowError) {
          logger.error(`Error al procesar mensaje con adaptador: ${flowError}`);
          response = "Ha ocurrido un error técnico al procesar su mensaje. Por favor, inténtelo nuevamente.";
        }
      }
      // Manejo especial para flujos convertidos desde plantilla visual
      else if (flowInstance.flow && !flowInstance.flow.addKeyword) {
        logger.info(`Detectado flujo convertido desde plantilla visual para ${flowId}`);

        // Simplemente devolvemos una respuesta directa sin intentar usar BuilderBot
        // Esto es una solución temporal hasta que se mejore el conversor de plantillas

        // Si es el primer mensaje, mostramos el mensaje de bienvenida
        if (isFirstMessage) {
          logger.info(`Respondiendo con mensaje de bienvenida para flujo ${flowId}`);
          // Importamos dinámicamente chatbotUtils para evitar ciclos de dependencia
          try {
            // Importación dinámica para evitar ciclos de dependencia
            const { findInitialMessage } = await import('../services/chatbotUtils');

            // Intentar acceder al JSON original de la plantilla a través del campo originalJson
            let flowData;
            if (flowInstance.originalJson) {
              // Si tenemos el JSON original guardado, lo usamos
              flowData = flowInstance.originalJson;
              logger.info('Usando JSON original guardado para extraer mensaje');
            } else if (typeof flowInstance.flow.toJson === 'function') {
              // Si el flujo tiene un método toJson, intentamos usarlo
              try {
                flowData = flowInstance.flow.toJson();
                logger.info('Usando método toJson() para extraer mensaje');
              } catch (jsonError) {
                logger.warn(`Error usando toJson: ${jsonError}`);
                flowData = flowInstance.flow;
              }
            } else {
              // Último recurso: usar el flujo directamente
              flowData = flowInstance.flow;
              logger.warn('Usando objeto de flujo directo para extraer mensaje');
            }

            // Extraer el mensaje inicial del flujo
            logger.debug(`Intentando extraer mensaje inicial de flowData tipo: ${typeof flowData}`);
            if (flowData) {
              logger.debug(`flowData tiene propiedades: ${Object.keys(flowData).join(', ')}`);
            }
            const extractionResult = findInitialMessage(flowData);

            if (extractionResult && extractionResult.message) {
              // Si encontramos un mensaje en el flujo, lo usamos
              response = extractionResult.message;
              logger.info(`Usando mensaje extraído del flujo: "${response}"`);
              logger.debug(`Fuente: ${extractionResult.diagnostics.messageSource}, método: ${extractionResult.diagnostics.extractionMethod}`);

              // Almacenar información sobre el primer nodo de mensaje para seguimiento de estado
              if (extractionResult.diagnostics.firstMessageNodeId) {
                // Guardar el ID del nodo de mensaje en el estado para la próxima interacción
                state.currentNodeId = extractionResult.diagnostics.firstMessageNodeId;
                state.current_node_id = extractionResult.diagnostics.firstMessageNodeId;
                logger.info(`Guardando nodo de mensaje inicial ${state.currentNodeId} en el estado`);
              }
            } else {
              // Si no se pudo extraer un mensaje, mostrar error específico
              response = "⚠️ ERROR: No se pudo extraer un mensaje de bienvenida válido del flujo. Contacte al administrador.";
              logger.error(`Error en la estructura del flujo: No se pudo extraer mensaje inicial`);
            }
          } catch (extractionError) {
            // En caso de error, mostrar mensaje de error específico con detalles
            response = `⚠️ ERROR: Fallo en la extracción del mensaje inicial: ${extractionError.message}`;
            logger.error(`Error crítico al extraer mensaje inicial: ${extractionError}`);
          }

          // Registramos que este mensaje fue generado correctamente
          logger.debug(`MENSAJE FINAL GENERADO (first message): "${response}"`);
        } else {
          // Para mensajes subsiguientes, intentamos avanzar en el flujo
          logger.info(`Procesando mensaje subsiguiente para flujo ${flowId}`);

          // Información detallada del estado para depuración
          logger.info(`DIAGNÓSTICO - Estado: waitingForInput=${state.waitingForInput}, waitingNodeId=${state.waitingNodeId}, currentNodeId=${state.currentNodeId}`);
          logger.info(`DIAGNÓSTICO - Claves en state: ${Object.keys(state).join(', ')}`);

          // SOLUCIÓN DEFINITIVA: Forzar waitingForInput=true si existe waitingNodeId
          // Esto es una solución de último recurso debido a potenciales problemas de persistencia de estado
          if (state.waitingNodeId && !state.waitingForInput) {
            logger.info(`CORRECCIÓN - Restaurando waitingForInput=true ya que existe waitingNodeId=${state.waitingNodeId}`);
            state.waitingForInput = true;
          }

          // Verificar si estamos esperando respuesta para un nodo específico
          if (state.waitingForInput && state.waitingNodeId) {
            logger.info(`Procesando respuesta para nodo que esperaba input: ${state.waitingNodeId}`);

            // Si este nodo tenía algún nombre de variable esperada, guardamos el valor
            if (state.expectedVariable) {
              const variableName = state.expectedVariable;
              logger.info(`Guardando respuesta "${message}" en variable ${variableName}`);

              // Guardar en el objeto de variables y directamente en state
              if (!state.variables) {
                state.variables = {};
              }

              state.variables[variableName] = message;
              state[variableName] = message;
            } else {
              // Si no hay variable esperada pero el nodo esperaba respuesta (waitForResponse=true)
              // simplemente guardamos la respuesta del usuario en una variable genérica
              logger.info(`Guardando respuesta "${message}" en variable lastUserResponse (nodo sin variable específica)`);

              if (!state.variables) {
                state.variables = {};
              }

              state.variables.lastUserResponse = message;
              state.lastUserResponse = message;
            }

            // Guardamos el nodo que esperaba respuesta para referencias futuras
            const previousWaitingNodeId = state.waitingNodeId;

            // Limpiar marcadores de espera para continuar con el flujo
            // Siempre limpiamos, independientemente de si había variable esperada o no
            state.waitingForInput = false;
            state.waitingNodeId = null;
            state.expectedVariable = null;

            logger.info(`Estado de espera limpiado, continuando con el flujo desde nodo ${previousWaitingNodeId}...`);

            // Añadimos un marcador para saber que estamos procesando una respuesta
            // Esto puede ser útil para depuración y para manejar lógica específica
            // en nodos que acaban de recibir respuesta
            state.justReceivedResponse = true;
            state.previousWaitingNodeId = previousWaitingNodeId; // Guardamos referencia del nodo anterior

            // *** PARTE NUEVA: Buscar conexiones salientes del nodo actual para procesar el siguiente nodo ***
            try {
              // Verificamos que tengamos la estructura del flujo
              const flowJson = flowInstance.originalJson;
              if (!flowJson || !flowJson.nodes || !flowJson.edges) {
                throw new Error("No se encontró estructura de flujo válida");
              }

              // Buscar el nodo que estaba esperando respuesta (nodo anterior)
              const currentNode = flowJson.nodes.find(n => n.id === previousWaitingNodeId);
              if (!currentNode) {
                throw new Error(`No se encontró el nodo anterior con ID ${previousWaitingNodeId}`);
              }

              // Buscar conexiones que salen de este nodo
              const outEdges = flowJson.edges.filter(e => e.source === previousWaitingNodeId);
              if (outEdges.length === 0) {
                throw new Error(`El nodo ${previousWaitingNodeId} no tiene conexiones salientes`);
              }

              // Tomar la primera conexión saliente para avanzar
              const nextNodeId = outEdges[0].target;
              const nextNode = flowJson.nodes.find(n => n.id === nextNodeId);

              if (!nextNode) {
                throw new Error(`No se encontró el nodo siguiente con ID ${nextNodeId}`);
              }

              logger.info(`Avanzando al siguiente nodo: ${nextNodeId} (tipo: ${nextNode.type || nextNode.data?.type})`);

              // Establecer el nodo actual para que siga el procesamiento desde ahí
              state.currentNodeId = nextNodeId;
              state.current_node_id = nextNodeId;

              // Importamos chatbotUtils para extraer el contenido del siguiente nodo
              const utils = await import('./chatbotUtils');

              // Extraer contenido según el tipo de nodo
              if (nextNode.type === 'messageNode' || nextNode.data?.type === 'messageNode') {
                // Si es un nodo de mensaje, extraer su contenido
                const nextNodeContent = utils.extractNodeContent(nextNode);

                if (nextNodeContent) {
                  logger.info(`Contenido extraído del siguiente nodo de mensaje: "${nextNodeContent.substring(0, 50)}..."`);
                  response = nextNodeContent;
                } else {
                  throw new Error(`No se pudo extraer contenido del nodo ${nextNodeId}`);
                }
              } else if (nextNode.type === 'inputNode' || nextNode.data?.type === 'inputNode') {
                // Si es un nodo de entrada, extraer la pregunta
                let question = nextNode.data?.question || nextNode.data?.prompt || "¿Podrías proporcionar más información?";
                logger.info(`Nodo de entrada encontrado, usando pregunta original: "${question}"`);

                // Reemplazar variables en la pregunta
                if (!state.variables) {
                  state.variables = {};
                }

                // Procesar variables existentes en el estado
                Object.entries(state).forEach(([key, value]) => {
                  if (typeof value === 'string' && key !== 'last_response' && key !== 'last_user_message') {
                    // Reemplazar {{variable}} con el valor
                    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                    question = question.replace(pattern, value);

                    // Guardar también en variables para consistencia
                    state.variables[key] = value;
                  }
                });

                // Caso especial para variable de nombre
                if (state.nombre_usuario) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre_usuario as string);
                } else if (state.nombre) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre as string);
                  question = question.replace(/{{nombre}}/g, state.nombre as string);
                }

                logger.info(`Pregunta procesada con variables: "${question}"`);
                response = question;

                // También registrar la variable que se está capturando
                const variableName = nextNode.data?.variableName || "unknown_variable";
                logger.info(`Variable a capturar en el siguiente mensaje: ${variableName}`);

                // Actualizar el estado para esperar la respuesta a esta nueva pregunta
                state.waitingForInput = true;
                state.expectedVariable = variableName;
                state.waitingNodeId = nextNodeId;
              } else {
                // Otro tipo de nodo - continuar avanzando
                logger.info(`Tipo de nodo siguiente no manejado directamente: ${nextNode.type || nextNode.data?.type}`);
                // No establecemos respuesta aquí, así que el sistema usará el mensaje anterior
              }

              // Marcar que hemos avanzado el flujo manualmente
              state.manualFlowAdvance = true;
            } catch (error) {
              logger.error(`Error al procesar avance después de nodo con espera: ${error}`);
              // En caso de error, respondemos con un mensaje genérico
              response = "Estoy procesando tu respuesta. ¿Puedes por favor proporcionar más detalles?";
            }
          }

          try {
            // Si ya hemos avanzado el flujo manualmente, omitimos el procesamiento normal
            if (state.manualFlowAdvance) {
              logger.info(`Omitiendo procesamiento normal ya que se ha avanzado el flujo manualmente`);
              // Eliminar la bandera para futuras interacciones
              delete state.manualFlowAdvance;
              // Salimos del bloque try/catch pero continuamos con el guardado del estado
              state.skipRemainingProcessing = true;
              throw new Error("Interrupción controlada - se ha avanzado el flujo manualmente");
            }

            // Obtener el nodo actual desde el estado
            const currentNodeId = state?.currentNodeId || initialState?.current_node_id;
            logger.info(`Nodo actual: ${currentNodeId}`);

            // Obtener el JSON original del flujo que debería tener la estructura completa
            const flowJson = flowInstance.originalJson;

            if (!flowJson || !flowJson.nodes || !flowJson.edges) {
              throw new Error("No se encontró estructura de flujo válida");
            }

            // Verificar tipo de nodo actual para decidir cómo procesar
            const currentNode = flowJson.nodes.find(n => n.id === currentNodeId);

            if (!currentNode) {
              throw new Error(`No se encontró el nodo actual con ID ${currentNodeId}`);
            }

            logger.info(`Tipo de nodo actual: ${currentNode.type}`);

            // MANEJO DE DIFERENTES TIPOS DE NODOS

            // Si es un nodo de mensaje, avanzar al siguiente nodo
            if (currentNode.type === 'messageNode' || currentNode.data?.type === 'messageNode') {
              logger.info(`Procesando avance desde nodo de mensaje ${currentNodeId}`);

              // Verificar si el nodo requiere esperar respuesta del usuario
              const requiresResponse = currentNode.data?.waitForResponse === true ||
                                      currentNode.data?.capture === true ||
                                      currentNode.data?.waitResponse === true ||
                                      currentNode.data?.requireResponse === true;

              // Detallado de depuración para ver valores reales
              logger.info(`DEPURACIÓN ATRIBUTOS - currentNode.data = ${JSON.stringify(currentNode.data || {})}`);
              logger.info(`DEPURACIÓN ATRIBUTOS - waitForResponse = ${currentNode.data?.waitForResponse}, tipo: ${typeof currentNode.data?.waitForResponse}`);
              logger.info(`DEPURACIÓN ATRIBUTOS - capture = ${currentNode.data?.capture}, tipo: ${typeof currentNode.data?.capture}`);
              logger.info(`DEPURACIÓN ATRIBUTOS - waitResponse = ${currentNode.data?.waitResponse}, tipo: ${typeof currentNode.data?.waitResponse}`);
              logger.info(`DEPURACIÓN ATRIBUTOS - requireResponse = ${currentNode.data?.requireResponse}, tipo: ${typeof currentNode.data?.requireResponse}`);

              logger.info(`Nodo ${currentNodeId} ${requiresResponse ? 'requiere' : 'no requiere'} respuesta del usuario`);

              // Si el nodo requiere respuesta, detenemos aquí y esperamos el siguiente mensaje
              if (requiresResponse) {
                // Extraer contenido del nodo actual
                const utils = await import('./chatbotUtils');
                const nodeContent = utils.extractNodeContent(currentNode);

                if (nodeContent) {
                  response = nodeContent;
                  logger.info(`Mensaje del nodo que espera respuesta: "${response.substring(0, 50)}..."`);
                  // No avanzamos al siguiente nodo porque estamos esperando respuesta
                } else {
                  throw new Error(`No se pudo extraer contenido del nodo que espera respuesta ${currentNodeId}`);
                }

                // Registrar que estamos esperando respuesta para este nodo
                state.waitingForInput = true;
                state.waitingNodeId = currentNodeId;

                // Logear el estado completo para depuración
                logger.info(`CONFIGURACIÓN - Estableciendo waitingForInput=true, waitingNodeId=${currentNodeId}`);
                logger.info(`CONFIGURACIÓN - Estado ANTES de la asignación: ${JSON.stringify({
                  waitingForInput: state.waitingForInput,
                  waitingNodeId: state.waitingNodeId,
                  currentNodeId: state.currentNodeId
                })}`);

                // En lugar de retornar inmediatamente, establecemos un flag para evitar procesamiento adicional
                // pero permitimos que se complete el flujo normal de guardado de estado
                logger.info(`Nodo ${currentNodeId} configurado para esperar respuesta del usuario, almacenando estado.`);

                // No podemos usar 'break' aquí porque no estamos en un bucle
                // En su lugar, continuamos con el código pero establecemos una bandera para evitar procesamiento adicional
                state.skipRemainingProcessing = true;
              }

              // Si hemos establecido skipRemainingProcessing, no continuamos con la lógica de este nodo
              if (state.skipRemainingProcessing) {
                logger.info(`Omitiendo procesamiento adicional para nodo ${currentNodeId} ya que está esperando respuesta`);
                // No podemos usar continue o break, así que simplemente saltamos al final de este bloque condicional
                // usando una estructura de else para el resto del código
              } else {

              // Si el nodo no requiere respuesta o ya la recibió, avanzamos al siguiente
              // Buscar conexiones que salen del nodo actual
              const outEdges = flowJson.edges.filter(e => e.source === currentNodeId);

              if (outEdges.length === 0) {
                throw new Error(`El nodo de mensaje ${currentNodeId} no tiene conexiones salientes`);
              }

              // Tomar la primera conexión saliente
              const nextNodeId = outEdges[0].target;
              const nextNode = flowJson.nodes.find(n => n.id === nextNodeId);

              if (!nextNode) {
                throw new Error(`No se encontró el nodo siguiente con ID ${nextNodeId}`);
              }

              logger.info(`Nodo siguiente: ${nextNodeId} (tipo: ${nextNode.type})`);

              // Importamos chatbotUtils para extraer contenido
              const utils = await import('./chatbotUtils');

              // Extraer contenido según el tipo de nodo
              if (nextNode.type === 'inputNode' || nextNode.data?.type === 'inputNode') {
                // Si es un nodo de entrada, extraer la pregunta
                let question = nextNode.data?.question || nextNode.data?.prompt || "¿Podrías proporcionar más información?";
                logger.info(`Nodo de entrada encontrado, usando pregunta original: "${question}"`);

                // IMPORTANTE: Reemplazar variables en la pregunta
                if (!state.variables) {
                  state.variables = {};
                }

                // Procesar variables existentes en el estado
                Object.entries(state).forEach(([key, value]) => {
                  if (typeof value === 'string' && key !== 'last_response' && key !== 'last_user_message') {
                    // Reemplazar {{variable}} con el valor
                    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                    question = question.replace(pattern, value);

                    // Guardar también en variables para consistencia
                    state.variables[key] = value;
                  }
                });

                // Caso especial para variable de nombre
                if (state.nombre_usuario) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre_usuario as string);
                } else if (state.nombre) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre as string);
                  question = question.replace(/{{nombre}}/g, state.nombre as string);
                }

                logger.info(`Pregunta procesada con variables: "${question}"`);
                response = question;

                // También registrar la variable que se está capturando
                const variableName = nextNode.data?.variableName || "unknown_variable";
                logger.info(`Variable a capturar en el siguiente mensaje: ${variableName}`);

                // Actualizar el nodo actual en el estado
                state.currentNodeId = nextNodeId;
                state.current_node_id = nextNodeId; // Para compatibilidad
                state.waitingForInput = true;
                state.expectedVariable = variableName;

              } else if (nextNode.type === 'messageNode' || nextNode.data?.type === 'messageNode') {
                // Si es otro nodo de mensaje, extraer su contenido
                const nextNodeContent = utils.extractNodeContent(nextNode);

                if (nextNodeContent) {
                  logger.info(`Contenido extraído del siguiente nodo de mensaje: "${nextNodeContent.substring(0, 50)}..."`);
                  response = nextNodeContent;

                  // Actualizar el nodo actual en el estado
                  state.currentNodeId = nextNodeId;
                  state.current_node_id = nextNodeId; // Para compatibilidad
                } else {
                  throw new Error(`No se pudo extraer contenido del nodo ${nextNodeId}`);
                }
              } else {
                // Otro tipo de nodo (condición, etc.)
                logger.info(`Tipo de nodo no manejado directamente: ${nextNode.type}`);
                response = "Procesando tu solicitud...";

                // Intentar avanzar al siguiente nodo directamente
                const furtherEdges = flowJson.edges.filter(e => e.source === nextNodeId);

                if (furtherEdges.length > 0) {
                  const furtherNodeId = furtherEdges[0].target;
                  const furtherNode = flowJson.nodes.find(n => n.id === furtherNodeId);

                  if (furtherNode) {
                    logger.info(`Avanzando directo al nodo: ${furtherNodeId} (tipo: ${furtherNode.type})`);

                    // Extraer contenido si es un nodo de mensaje
                    if (furtherNode.type === 'messageNode' || furtherNode.data?.type === 'messageNode') {
                      const furtherContent = utils.extractNodeContent(furtherNode);

                      if (furtherContent) {
                        response = furtherContent;
                        state.currentNodeId = furtherNodeId;
                        state.current_node_id = furtherNodeId;
                      }
                    }
                  }
                }
              }

              } // Cierre del bloque else para skipRemainingProcessing

            }
            // Si es un nodo de entrada, capturar la respuesta del usuario
            else if (currentNode.type === 'inputNode' || currentNode.data?.type === 'inputNode') {
              logger.info(`Procesando respuesta para nodo de entrada ${currentNodeId}`);

              // Obtener el nombre de la variable que se está capturando
              const variableName = currentNode.data?.variableName || "unknown_variable";

              // Guardar la respuesta del usuario en el estado
              logger.info(`Guardando respuesta "${message}" en variable ${variableName}`);
              state[variableName] = message;

              if (!state.variables) {
                state.variables = {};
              }
              state.variables[variableName] = message;

              // Buscar conexiones que salen del nodo de entrada
              const outEdges = flowJson.edges.filter(e => e.source === currentNodeId);

              if (outEdges.length === 0) {
                throw new Error(`El nodo de entrada ${currentNodeId} no tiene conexiones salientes`);
              }

              // Tomar la primera conexión saliente
              const nextNodeId = outEdges[0].target;
              const nextNode = flowJson.nodes.find(n => n.id === nextNodeId);

              if (!nextNode) {
                throw new Error(`No se encontró el nodo siguiente con ID ${nextNodeId}`);
              }

              logger.info(`Avanzando al nodo: ${nextNodeId} (tipo: ${nextNode.type})`);

              // Importamos chatbotUtils para extraer contenido
              const utils = await import('./chatbotUtils');

              // Extraer contenido según el tipo de nodo
              if (nextNode.type === 'messageNode' || nextNode.data?.type === 'messageNode') {
                const nextNodeContent = utils.extractNodeContent(nextNode);

                if (nextNodeContent) {
                  // Reemplazar variables en el texto
                  let processedContent = nextNodeContent;

                  // Recorrer variables guardadas y reemplazar placeholders
                  if (state.variables) {
                    Object.entries(state.variables).forEach(([key, value]) => {
                      // Buscar y reemplazar "{{variable}}" o "{{variable_name}}" con el valor
                      const regexPattern1 = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                      const regexPattern2 = new RegExp(`{{\\s*${key}_\\w+\\s*}}`, 'g');

                      processedContent = processedContent.replace(regexPattern1, value as string);

                      // Para variables con sufijo (como {{nombre_usuario}})
                      if (key === 'nombre') {
                        processedContent = processedContent.replace(/{{nombre_usuario}}/g, value as string);
                      }
                    });
                  }

                  logger.info(`Contenido procesado con variables: "${processedContent.substring(0, 50)}..."`);
                  response = processedContent;

                  // Actualizar el nodo actual en el estado
                  state.currentNodeId = nextNodeId;
                  state.current_node_id = nextNodeId;
                } else {
                  throw new Error(`No se pudo extraer contenido del nodo ${nextNodeId}`);
                }
              } else if (nextNode.type === 'inputNode' || nextNode.data?.type === 'inputNode') {
                // Si el siguiente nodo es de entrada, extraer su pregunta
                let question = nextNode.data?.question || nextNode.data?.prompt || "¿Podrías proporcionar más información?";
                logger.info(`Siguiente nodo es de entrada, usando pregunta original: "${question}"`);

                // IMPORTANTE: Reemplazar variables en la pregunta
                if (!state.variables) {
                  state.variables = {};
                }

                // Procesar variables existentes en el estado
                Object.entries(state).forEach(([key, value]) => {
                  if (typeof value === 'string' && key !== 'last_response' && key !== 'last_user_message') {
                    // Reemplazar {{variable}} con el valor
                    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                    question = question.replace(pattern, value);

                    // Guardar también en variables para consistencia
                    state.variables[key] = value;
                  }
                });

                // Procesar variables específicas desde el objeto variables
                if (state.variables) {
                  Object.entries(state.variables).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                      question = question.replace(pattern, value);
                    }
                  });
                }

                // Caso especial para variable de nombre
                if (state.nombre_usuario) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre_usuario as string);
                } else if (state.nombre) {
                  question = question.replace(/{{nombre_usuario}}/g, state.nombre as string);
                  question = question.replace(/{{nombre}}/g, state.nombre as string);
                }

                logger.info(`Pregunta procesada con variables: "${question}"`);
                response = question;

                // Actualizar el nodo actual en el estado
                state.currentNodeId = nextNodeId;
                state.current_node_id = nextNodeId;
                state.waitingForInput = true;
                state.expectedVariable = nextNode.data?.variableName;
              } else {
                // Otro tipo de nodo (condición, etc.)
                logger.info(`Tipo de nodo siguiente no manejado directamente: ${nextNode.type}`);
                response = "Procesando tu solicitud...";

                // Intentar avanzar al siguiente nodo directamente
                const furtherEdges = flowJson.edges.filter(e => e.source === nextNodeId);

                if (furtherEdges.length > 0) {
                  const furtherNodeId = furtherEdges[0].target;
                  const furtherNode = flowJson.nodes.find(n => n.id === furtherNodeId);

                  if (furtherNode) {
                    logger.info(`Avanzando directo al nodo: ${furtherNodeId} (tipo: ${furtherNode.type})`);

                    // Extraer contenido si es un nodo de mensaje
                    if (furtherNode.type === 'messageNode' || furtherNode.data?.type === 'messageNode') {
                      const furtherContent = utils.extractNodeContent(furtherNode);

                      if (furtherContent) {
                        response = furtherContent;
                        state.currentNodeId = furtherNodeId;
                        state.current_node_id = furtherNodeId;
                      }
                    }
                  }
                }
              }
            }
            // Para otros tipos de nodos, intentar reiniciar
            else {
              logger.warn(`Tipo de nodo actual (${currentNode.type}) no manejado específicamente`);
              throw new Error(`Tipo de nodo no compatible: ${currentNode.type}`);
            }
          } catch (flowError) {
            // Si es una interrupción controlada, solo registramos y continuamos
            if (state.skipRemainingProcessing && flowError.message.includes("Interrupción controlada")) {
              logger.info(`Interrupción controlada del procesamiento normal: ${flowError.message}`);
              // No hacemos nada, simplemente continuamos con la ejecución normal
            } else {
              // Si hay algún error en el manejo del flujo, ofrecer reiniciar
              logger.error(`Error en procesamiento de flujo: ${flowError}`);

              // Como última opción, intentamos reiniciar el flujo desde el inicio
              try {
                const flowJson = flowInstance.originalJson;

                if (flowJson && flowJson.nodes && flowJson.edges) {
                  // Buscar el nodo de inicio
                  const startNode = flowJson.nodes.find(n =>
                    n.type === 'startNode' || n.type === 'start'
                  );

                  if (startNode) {
                    // Buscar conexiones desde el nodo de inicio
                    const startEdges = flowJson.edges.filter(e => e.source === startNode.id);

                    if (startEdges.length > 0) {
                      // Tomar la primera conexión desde el inicio
                      const welcomeNodeId = startEdges[0].target;
                      const welcomeNode = flowJson.nodes.find(n => n.id === welcomeNodeId);

                      if (welcomeNode) {
                        // Importamos chatbotUtils
                        const utils = await import('./chatbotUtils');

                        // Extraer contenido del nodo de bienvenida
                        const welcomeContent = utils.extractNodeContent(welcomeNode);

                        if (welcomeContent) {
                          response = welcomeContent;

                          // Actualizar el nodo actual en el estado
                          state.currentNodeId = welcomeNodeId;
                          state.current_node_id = welcomeNodeId;

                          // Limpiar variables para reiniciar completamente
                          state.variables = {};

                          logger.info(`Reiniciando flujo, usando mensaje: "${response.substring(0, 50)}..."`);
                        }
                      }
                    }
                  }
                }

                // Si no se generó una respuesta en el intento de reinicio
                if (response === "") {
                  response = "Parece que hubo un problema. ¿Te gustaría volver a comenzar la conversación?";
                  logger.warn(`No se pudo reiniciar el flujo, usando respuesta genérica`);
                }
              } catch (resetError) {
                response = "Estoy teniendo dificultades técnicas. Por favor, intenta nuevamente en unos momentos.";
                logger.error(`Error crítico al reiniciar flujo: ${resetError}`);
              }
            }
          }

          // Registramos que este mensaje fue generado correctamente
          logger.debug(`MENSAJE FINAL GENERADO (follow-up): "${response}"`);
        }

        // Guardamos información básica en el estado
        state = {
          ...initialState,
          last_response: response,
          flow_processed: true,
          current_flow_id: flowId,
          last_updated_at: new Date().toISOString()
        };

        // Registramos como éxito para llevar seguimiento
        logger.info(`Respuesta directa generada para flujo ${flowId}`);
      } else {
        // El flujo no tiene una estructura reconocible
        logger.error(`Flujo ${flowId} no tiene un formato válido para procesamiento`);

        // Intentamos recuperar con un flujo básico predeterminado
        try {
          const fallbackFlow = addKeyword(['HOLA', 'INICIO'])
            .addAnswer('Bienvenido al sistema. Estamos experimentando problemas técnicos con el flujo solicitado.');

          const adapter = createFlow([fallbackFlow]);

          const result = await adapter.handleMsg({
            from: userId,
            body: "HOLA",
            sessionId: sessionId
          }, initialState);

          if (result && result.answer) {
            response = result.answer;
          } else {
            response = "⚠️ ERROR: La estructura del flujo es inválida y no puede ser procesada. Por favor contacte al administrador.";
          }
        } catch (fallbackError) {
          logger.error(`Error al usar flujo de respaldo: ${fallbackError}`);
          response = "⚠️ ERROR CRÍTICO: Falló el intento de recuperación del flujo. Detalles: " + (fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
      }
    } catch (processingError) {
      logger.error(`Error en procesamiento de mensaje: ${processingError}`);
      response = "⚠️ ERROR: Error en el procesamiento del mensaje. Detalles: " + (processingError instanceof Error ? processingError.message : String(processingError));
    }
    
    // Registrar valores importantes antes de la actualización final
    logger.info(`ESTADO FINAL - Antes de actualizar: waitingForInput=${state.waitingForInput}, waitingNodeId=${state.waitingNodeId}`);

    // Guardamos valores importantes antes de la actualización
    const preserveWaitingInfo = {
      waitingForInput: state.waitingForInput,
      waitingNodeId: state.waitingNodeId,
      expectedVariable: state.expectedVariable,
      currentNodeId: state.currentNodeId || state.current_node_id
    };

    logger.info(`ESTADO FINAL - Valores a preservar: ${JSON.stringify(preserveWaitingInfo)}`);

    // Actualizamos el estado con los resultados completos
    // Aseguramos que todos los datos importantes se mantienen
    state = {
      ...state,
      last_response: response,
      last_updated_at: new Date().toISOString(),
      // Añadimos información importante que podría faltar
      flow_processed: true,
      flow_id: flowId, // Asegurarnos que el ID de flujo se mantiene
      currentNodeId: state.currentNodeId || state.current_node_id, // Mantener nodo actual
      current_node_id: state.currentNodeId || state.current_node_id, // Duplicar para compatibilidad
      // Garantizar que tenemos todos los campos necesarios para la siguiente interacción
      message_count: state.message_count || initialState.message_count || 1,
    };

    // Restaurar los valores de espera de respuesta explícitamente
    // IMPORTANTE: Siempre restauramos los valores de espera si existen, sin condición
    // Esto es crítico para mantener el estado correcto entre mensajes
    if (preserveWaitingInfo.waitingForInput) {
      state.waitingForInput = preserveWaitingInfo.waitingForInput;
      state.waitingNodeId = preserveWaitingInfo.waitingNodeId;
      state.expectedVariable = preserveWaitingInfo.expectedVariable;
      logger.info(`ESTADO FINAL - Valores de espera restaurados explícitamente`);
    }

    // Asegurarnos que tenemos un ID de nodo actual guardado siempre para
    // permitir el modo rápido funcionar correctamente en el siguiente mensaje
    if (!state.currentNodeId && !state.current_node_id && preserveWaitingInfo.currentNodeId) {
      state.currentNodeId = preserveWaitingInfo.currentNodeId;
      state.current_node_id = preserveWaitingInfo.currentNodeId;
      logger.info(`ESTADO FINAL - Restaurado nodo actual: ${state.currentNodeId}`);
    }

    // Verificar que waitingForInput y waitingNodeId se mantienen correctamente
    logger.info(`ESTADO FINAL - Después de actualizar: waitingForInput=${state.waitingForInput}, waitingNodeId=${state.waitingNodeId}`);

    // Limpiar las banderas de control de flujo que ya no necesitamos
    // para evitar problemas en futuras invocaciones
    if (state.skipRemainingProcessing) {
      logger.debug('Limpiando bandera skipRemainingProcessing para la próxima interacción');
      delete state.skipRemainingProcessing;
    }

    // Estimamos tokens si no se calculó explícitamente
    if (!metrics.tokensUsed) {
      metrics.tokensUsed = Math.ceil(response.length / 4);
    }

    // IMPORTANTE: Primero establecemos correctamente el mensaje actual como última respuesta
    // Este es un paso crucial para asegurar que el estado se mantenga consistente
    state.last_response = response;
    state.last_updated_at = new Date().toISOString();

    // Añadimos log específico para debug
    logger.debug(`[FINAL STATE] Respuesta final: "${response}"`);
    logger.debug(`[FINAL STATE] currentNodeId: ${state.currentNodeId || state.current_node_id || 'no definido'}`);
    logger.debug(`[FINAL STATE] message_count: ${state.message_count}`);

    // Guardamos el estado actualizado
    try {
      // Actualizamos nuestro estado local
      _localFlowStates[stateKey] = state;

      // Intentamos sincronizar con botFlowIntegration
      try {
        const { flowStates } = await import('./botFlowIntegration');
        if (flowStates) {
          flowStates[stateKey] = state;
          logger.info(`Estado final sincronizado con botFlowIntegration para sesión ${sessionId}`);
        }
      } catch (syncError) {
        logger.warn(`No se pudo sincronizar estado final con botFlowIntegration: ${syncError}`);
      }

      // Guardamos en la base de datos
      await saveConversationState(
        tenantId,
        userId,
        sessionId,
        state
      );
      logger.info(`Estado guardado en BD para sesión ${sessionId}`);
    } catch (saveError) {
      logger.warn(`Error al guardar estado: ${saveError}`);
    }

    return {
      response,
      state,
      metrics
    };
  } catch (error) {
    logger.error('Error al procesar mensaje con flujo:', error);

    return {
      response: "⚠️ ERROR CRÍTICO: Ha ocurrido un error inesperado en el procesamiento del flujo. Detalles: " + (error instanceof Error ? error.message : String(error)),
      state: {
        error: true,
        error_message: error instanceof Error ? error.message : 'Error desconocido',
        session_id: sessionId,
        tenant_id: tenantId,
        user_id: userId
      },
      metrics: { tokensUsed: 0 }
    };
  }
};

/**
 * Carga un flujo específico para un tenant
 * Se llama justo antes de procesar un mensaje
 *
 * @param flowId ID del flujo a cargar (templateId)
 * @param tenantId ID del tenant
 * @returns true si se cargó correctamente
 */
export const loadFlowForTenant = async (
  flowId: string,
  tenantId: string
): Promise<boolean> => {
  try {
    // Si el flujo ya está cargado, retornamos true
    if (flowRegistry[flowId] || templateFlowRegistry[flowId]) {
      logger.debug(`Flujo ${flowId} ya está cargado en el registro`);
      return true;
    }

    logger.info(`Cargando flujo ${flowId} para tenant ${tenantId}`);

    // Primero intentamos con flujos predefinidos
    if (flowId === 'lead-capture' || flowId === 'flujo-basico-lead') {
      try {
        logger.info(`Cargando flujo predefinido ${flowId} (lead-capture.flow.ts)...`);
        const flow = await leadCaptureFlow();

        if (flow) {
          // Verificar que sea un adaptador de flujo válido con handleMsg
          if (typeof flow.handleMsg === 'function') {
            logger.info(`Flujo predefinido ${flowId} tiene método handleMsg, registrando directamente`);
            registerFlow(flowId, flow);
            return true;
          } else if (flow.addKeyword || (flow.flow && flow.flow.addKeyword)) {
            // Si solo tenemos un flujo básico pero no un adaptador completo, creamos el adaptador
            logger.info(`Flujo predefinido ${flowId} no tiene método handleMsg, creando adaptador`);
            const adaptedFlow = typeof flow.addKeyword === 'function'
              ? createFlow([flow])
              : createFlow([flow.flow]);

            registerFlow(flowId, adaptedFlow);
            logger.info(`Flujo predefinido ${flowId} convertido a adaptador y registrado`);
            return true;
          } else {
            logger.warn(`Flujo predefinido ${flowId} no tiene estructura válida para BuilderBot`);
          }
        } else {
          logger.warn(`No se pudo cargar el flujo predefinido ${flowId}`);
        }
      } catch (predefinedError) {
        logger.error(`Error al cargar flujo predefinido ${flowId}:`, predefinedError);
      }
    }

    // Si no es un flujo predefinido, buscamos en la base de datos
    if (config.supabase?.enabled) {
      try {
        const { getSupabaseClient } = await import('./supabase');
        const supabase = getSupabaseClient();

        // Obtener la plantilla específica
        const { data: template, error } = await supabase
          .from('chatbot_templates')
          .select('id, name, react_flow_json, status')
          .eq('id', flowId)
          .single();

        if (error) {
          logger.error(`Error al obtener plantilla ${flowId} desde BD:`, error);
          return false;
        }

        if (!template) {
          logger.warn(`Plantilla ${flowId} no encontrada en la base de datos`);
          return false;
        }

        // Preparar los datos para la conversión y registro
        let reactFlowJson = template.react_flow_json;

        // Si react_flow_json es un string, intentamos parsearlo
        if (typeof reactFlowJson === 'string') {
          try {
            reactFlowJson = JSON.parse(reactFlowJson);
            logger.debug(`JSON parseado correctamente para plantilla ${template.id}`);
          } catch (parseError) {
            logger.error(`Error al parsear JSON para plantilla ${template.id}: ${parseError}`);
            // Si no podemos parsear, seguimos con el string
          }
        }

        // Convertir y registrar la plantilla
        const result = registerTemplateAsFlow(template.id, reactFlowJson, {
          originalJson: reactFlowJson
        });
        if (result) {
          logger.info(`Plantilla ${template.id} (${template.name}) cargada y registrada correctamente para tenant ${tenantId}`);
          return true;
        } else {
          logger.warn(`No se pudo convertir la plantilla ${template.id} a flujo`);
          return false;
        }
      } catch (dbError) {
        logger.error(`Error al cargar plantilla ${flowId} desde BD:`, dbError);
        return false;
      }
    } else {
      logger.warn('Supabase deshabilitado, no se puede cargar la plantilla');
      return false;
    }

    return false;
  } catch (error) {
    logger.error(`Error al cargar flujo ${flowId} para tenant ${tenantId}:`, error);
    return false;
  }
};

export const initializeFlowRegistry = async (): Promise<void> => {
  try {
    logger.info('Inicializando registro de flujos básicos...');

    // Registramos solo el flujo lead-capture como predefinido
    // pero no lo cargamos inmediatamente para evitar problemas
    // Se cargará bajo demanda cuando sea necesario
    try {
      // Registrar alias comunes - usamos una función que devuelve el flujo,
      // no directamente el flujo para evitar ciclos de dependencia

      // Crear referencia a la función asíncrona que carga el flujo
      const flowLoader = async () => {
        try {
          const flow = await leadCaptureFlow();

          // Verificar si el flujo tiene handleMsg
          if (typeof flow.handleMsg === 'function') {
            logger.debug('Flujo lead-capture tiene método handleMsg, utilizando directamente');
            return flow;
          } else {
            // Si no lo tiene, crear un adaptador
            logger.debug('Creando adaptador para flujo lead-capture');
            return createFlow([flow]);
          }
        } catch (err) {
          logger.error('Error al cargar flujo lead-capture:', err);
          throw err;
        }
      };

      // Registrar los alias con la función de carga
      registerFlow('lead-capture', flowLoader);
      registerFlow('flujo-basico-lead', flowLoader);
      logger.info('Flujos predefinidos preparados para carga dinámica');
    } catch (err) {
      logger.error('Error al registrar flujos predefinidos:', err);
    }

    logger.info('Registro de flujos básicos inicializado. Los demás flujos se cargarán dinámicamente por tenant.');
  } catch (error) {
    logger.error('Error al inicializar registro de flujos:', error);
  }
};

// Exportamos el registro inicializado
initializeFlowRegistry()
  .catch(err => logger.error('Error durante la inicialización del registro de flujos:', err));