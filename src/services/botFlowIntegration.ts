/**
 * src/services/botFlowIntegration.ts
 *
 * Servicio para integrar los flujos dinámicos con el servicio de bot existente.
 * Proporciona funciones para procesar mensajes usando flujos visuales con soporte
 * para plantillas y personalización de comportamiento.
 * @version 1.2.0
 * @updated 2025-05-10
 */

import { FlowService } from "./flowService";
import { FlowState } from "../models/flow.types";
import logger from "../utils/logger";
import config from "../config";

// Estructura para respuestas con metadatos
export interface FlowResponse {
  text: string;           // Texto de la respuesta
  tokensUsed?: number;    // Tokens utilizados (opcional)
}

// Inicializamos el servicio de flujos dinámicos
const flowService = new FlowService();

// Caché de estados de flujos dinámicos por usuario y tenant
const flowStates: Record<string, FlowState> = {};

/**
 * Procesa un mensaje con el sistema de flujos dinámicos
 * @param message Mensaje a procesar
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de sesión opcional
 * @param templateConfig Configuración de plantilla opcional
 * @returns Respuesta generada por el flujo con metadatos
 */
export const processMessageWithFlows = async (
  message: string,
  userId: string,
  tenantId: string,
  sessionId: string = `session-${userId}-${Date.now()}`,
  templateConfig?: Record<string, any>
): Promise<FlowResponse | string> => {
  try {
  // Garantizar que tenantId sea siempre un UUID válido
  const validTenantId = tenantId === "default" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) ?
    (config.multitenant.defaultTenantUuid || "00000000-0000-0000-0000-000000000000") : tenantId;
    
  // Clave para el estado en caché con el UUID válido
  const stateKey = `${validTenantId}-${userId}-${sessionId}`;
  
  // Obtenemos el estado previo si existe
  const prevState = flowStates[stateKey];
  
  // Marcamos el tiempo de inicio para calcular tokens
  const startTime = Date.now();

      // Si hay configuración de plantilla pero no hay flujo, usamos respuesta de la plantilla
      if (templateConfig && !prevState) {
        // Extraer el mensaje inicial desde la plantilla, priorizando el mensaje real del flujo
        // NO usamos un mensaje default hardcodeado, sino que intentamos extraerlo de múltiples fuentes
        let greeting = null; // Inicializamos sin mensaje por defecto para forzar la extracción

        try {
          // IMPORTANTE: Primero vamos a ver si hay datos de flujo y loggear información detallada
          if (templateConfig.react_flow_json) {
            logger.debug(`✓ La plantilla tiene datos de react_flow_json`);

            try {
              // Importación dinámica para evitar ciclos de dependencia
              const { findInitialMessage } = await import('../services/chatbotUtils');

              // Parsear el flowJson si es necesario
              let flowJson;
              if (typeof templateConfig.react_flow_json === 'string') {
                logger.debug(`✓ react_flow_json es string, intentando parsear como JSON`);
                try {
                  flowJson = JSON.parse(templateConfig.react_flow_json);
                  logger.debug(`✓ JSON parseado correctamente, longitud: ${JSON.stringify(flowJson).length} bytes`);
                } catch (parseError) {
                  logger.error(`❌ ERROR al parsear react_flow_json: ${parseError}`);
                  throw new Error(`Error al parsear JSON: ${parseError}`);
                }
              } else {
                logger.debug(`✓ react_flow_json ya es un objeto`);
                flowJson = templateConfig.react_flow_json;
              }

              // Verificar rápidamente la estructura del flowJson
              if (flowJson.nodes) {
                logger.debug(`✓ flowJson tiene array 'nodes' con ${flowJson.nodes.length} elementos`);
              } else if (flowJson.elements) {
                logger.debug(`✓ flowJson tiene array 'elements' con ${flowJson.elements.length} elementos`);
              } else {
                logger.warn(`⚠️ flowJson no tiene ni 'nodes' ni 'elements', estructura inválida`);
              }

              // Intentar extraer el mensaje
              logger.debug(`Ejecutando findInitialMessage...`);
              const extractResult = findInitialMessage(flowJson);

              // Analizar resultado
              if (extractResult && extractResult.message) {
                greeting = extractResult.message;
                logger.info(`✅ MENSAJE EXTRAÍDO CON ÉXITO DEL FLUJO: "${greeting}"`);
                logger.info(`Método de extracción: ${extractResult.diagnostics.extractionMethod}, fuente: ${extractResult.diagnostics.messageSource}`);

                // Guardar el mensaje extraído para futuras referencias
                templateConfig.initialMessage = greeting;

                // Guardamos info de diagnóstico
                logger.debug(`Análisis de flujo: ${JSON.stringify({
                  nodesCount: extractResult.diagnostics.nodesAnalyzed,
                  edgesCount: extractResult.diagnostics.edgesAnalyzed,
                  startNodeId: extractResult.diagnostics.startNodeId,
                  messageNodeId: extractResult.diagnostics.firstMessageNodeId,
                  flowStructure: extractResult.diagnostics.flowStructure
                })}`);
              } else {
                logger.error(`❌ NO SE PUDO EXTRAER MENSAJE DEL FLUJO!`);

                // Información detallada del diagnóstico
                if (extractResult?.diagnostics) {
                  logger.error(`Diagnóstico: ${JSON.stringify({
                    estructura: extractResult.diagnostics.flowStructure,
                    nodos: extractResult.diagnostics.nodesAnalyzed,
                    conexiones: extractResult.diagnostics.edgesAnalyzed,
                    método: extractResult.diagnostics.extractionMethod,
                    fuente: extractResult.diagnostics.messageSource,
                    nodoInicio: extractResult.diagnostics.startNodeId,
                    nodoMensaje: extractResult.diagnostics.firstMessageNodeId
                  })}`);

                  // Si hay nodos, mostramos info de diagnóstico
                  if (extractResult.diagnostics.nodes && extractResult.diagnostics.nodes.length > 0) {
                    logger.error(`Primeros nodos encontrados: ${JSON.stringify(extractResult.diagnostics.nodes.slice(0, 3))}`);
                  } else {
                    logger.error(`No se encontraron nodos en el flujo`);
                  }
                } else {
                  logger.error(`No hay información de diagnóstico disponible`);
                }
              }
            } catch (extractionError) {
              logger.error(`❌ ERROR GRAVE al procesar react_flow_json: ${extractionError}`);
              logger.error(`Stack: ${extractionError?.stack}`);
            }
          }

          // Si no hay react_flow_json o no se pudo extraer, intentamos opciones alternativas
          // Primero buscamos en la configuración
          if (!greeting) {
            // Revisar campos específicos en la configuración (cualquiera de los dos)
            if (templateConfig.initialMessage) {
              greeting = templateConfig.initialMessage;
              logger.info(`✅ Usando mensaje de templateConfig.initialMessage: "${greeting}"`);
            }
            // Si no hay initialMessage pero hay greeting
            else if (templateConfig.greeting) {
              greeting = templateConfig.greeting;
              logger.info(`✅ Usando mensaje de templateConfig.greeting: "${greeting}"`);
            }

            // Intentar buscar en otros campos comunes
            else if (templateConfig.welcomeMessage) {
              greeting = templateConfig.welcomeMessage;
              logger.info(`✅ Usando mensaje de templateConfig.welcomeMessage: "${greeting}"`);
            }
            else if (templateConfig.message) {
              greeting = templateConfig.message;
              logger.info(`✅ Usando mensaje de templateConfig.message: "${greeting}"`);
            }
            // Buscar en campos anidados comunes
            else if (templateConfig.bot && templateConfig.bot.greeting) {
              greeting = templateConfig.bot.greeting;
              logger.info(`✅ Usando mensaje de templateConfig.bot.greeting: "${greeting}"`);
            }
            else if (templateConfig.settings && templateConfig.settings.greeting) {
              greeting = templateConfig.settings.greeting;
              logger.info(`✅ Usando mensaje de templateConfig.settings.greeting: "${greeting}"`);
            }
          }

          // Si aún no tenemos un mensaje, recurrimos a un default como último recurso
          if (!greeting) {
            // Mensaje por defecto con formato adecuado y más amigable
            greeting = "👋 Hola, bienvenido. ¿En qué puedo ayudarte hoy?";
            logger.info(`⚠️ No se encontró ningún mensaje en la plantilla. Usando mensaje por defecto: "${greeting}"`);
          }
        } catch (extractError) {
          logger.error(`❌ ERROR al extraer mensaje de plantilla: ${extractError}`);
          // Mensaje por defecto en caso de error, evitando mensajes muy específicos
          greeting = "👋 Hola, bienvenido. ¿En qué puedo ayudarte hoy?";
          logger.info(`Usando mensaje por defecto debido a error: "${greeting}"`);
        }

        // Intentamos obtener el flujo activo para el tenant para usar el nodo de entrada correcto
        let entryNodeId = 'start-node'; // Nuevo valor por defecto más común en los flujos ReactFlow

        try {
          // Intentamos obtener el flujo activo para usar su nodo de entrada
          const activeFlow = await flowService.getFlowByTenant(validTenantId);
          if (activeFlow && activeFlow.entryNodeId) {
            entryNodeId = activeFlow.entryNodeId;
            logger.info(`Usando nodo de entrada real del flujo: ${entryNodeId}`);
          } else if (activeFlow && activeFlow.nodes) {
            // Buscar nodo de tipo 'startNode' si no hay entryNodeId explícito
            const startNode = Object.values(activeFlow.nodes).find(
              node => node.type === 'startNode' || node.type === 'start'
            );

            if (startNode) {
              entryNodeId = startNode.id;
              logger.info(`Encontrado nodo de inicio por tipo: ${entryNodeId}`);
            } else {
              logger.warn(`No se encontró nodo de inicio en el flujo, usando valor por defecto: ${entryNodeId}`);
            }
          } else {
            logger.warn(`No se encontró un flujo activo, usando nodo de entrada por defecto: ${entryNodeId}`);
          }
        } catch (flowError) {
          logger.warn(`Error al intentar obtener el flujo activo: ${flowError}`);
        }

        // Creamos un estado básico con el nodo de entrada correcto
        const newState: FlowState = {
          flowId: 'default',
          currentNodeId: entryNodeId,
          context: {
            lastUserMessage: message,
            templateConfig
          },
          history: [],
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
          userId,
          sessionId,
        };

        // Guardamos el estado en caché
        flowStates[stateKey] = newState;

        return {
          text: greeting,
          tokensUsed: Math.ceil(message.length / 4) + Math.ceil(greeting.length / 4)
        };
      }
    
    // Procesamos el mensaje con el flujo, incluyendo la configuración de plantilla
    const { response, state, metrics } = await flowService.processMessage(
      message,
      userId,
      sessionId,
      validTenantId, // Usamos el tenant UUID válido
      prevState,
      undefined, // flow por defecto
      templateConfig // Configuración de plantilla
    );
    
    // Guardamos el estado actualizado
    flowStates[stateKey] = state;
    
    // Si tenemos métricas de tokens, las devolvemos
    if (metrics && typeof metrics.tokensUsed === 'number') {
      return {
        text: response,
        tokensUsed: metrics.tokensUsed
      };
    }
    
    // Si no hay métricas, estimamos basado en longitud
    // Este método es impreciso pero proporciona alguna métrica
    const estimatedTokens = Math.ceil(message.length / 4) + Math.ceil(response.length / 4);
    
    return {
      text: response,
      tokensUsed: estimatedTokens
    };
  } catch (error) {
    logger.error("Error al procesar mensaje con flujos dinámicos:", error);
    return {
      text: "Lo siento, ocurrió un error al procesar tu mensaje.",
      tokensUsed: 10 // Valor nominal mínimo para errores
    };
  }
};

/**
 * Limpia el estado de conversación de flujo para un usuario y tenant
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de sesión opcional
 */
export const clearFlowState = (
  userId: string,
  tenantId: string,
  sessionId?: string
): void => {
  // Si se proporciona un sessionId específico, eliminamos solo ese estado
  if (sessionId) {
    const stateKey = `${tenantId}-${userId}-${sessionId}`;
    delete flowStates[stateKey];
    return;
  }
  
  // Si no, eliminamos todos los estados para este usuario y tenant
  Object.keys(flowStates).forEach(key => {
    if (key.startsWith(`${tenantId}-${userId}`)) {
      delete flowStates[key];
    }
  });
};

/**
 * Verifica si hay un flujo activo para un tenant
 * @param tenantId ID del tenant
 * @returns Promesa que resuelve a true si hay un flujo activo
 */
export const hasDynamicFlow = async (tenantId: string): Promise<boolean> => {
  try {
    const flow = await flowService.getFlowByTenant(tenantId);
    return !!flow;
  } catch (error) {
    logger.error(`Error al verificar flujo para tenant ${tenantId}:`, error);
    return false;
  }
};

/**
 * Limpia la caché de estados viejos (más de 30 minutos)
 * Esta función debería llamarse periódicamente
 */
export const cleanFlowStatesCache = (): void => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutos
  
  Object.entries(flowStates).forEach(([key, state]) => {
    const lastUpdated = state.lastUpdatedAt.getTime();
    if (now - lastUpdated > timeout) {
      delete flowStates[key];
      logger.debug(`Estado de flujo eliminado por timeout: ${key}`);
    }
  });
};

/**
 * Actualiza la configuración de una plantilla en una sesión activa
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de la sesión
 * @param templateConfig Nueva configuración de plantilla
 * @returns true si se actualizó correctamente
 */
export const updateTemplateConfigInSession = (
  userId: string,
  tenantId: string,
  sessionId: string,
  templateConfig: Record<string, any>
): boolean => {
  try {
    // Clave para el estado en caché
    const stateKey = `${tenantId}-${userId}-${sessionId}`;
    
    // Verificamos si existe el estado
    if (!flowStates[stateKey]) {
      logger.warn(`No se encontró estado para la sesión ${sessionId}`);
      return false;
    }
    
    // Actualizamos el contexto con la nueva configuración
    flowStates[stateKey].context = {
      ...flowStates[stateKey].context,
      templateConfig
    };
    
    logger.info(`Configuración de plantilla actualizada para sesión ${sessionId}`);
    return true;
  } catch (error) {
    logger.error(`Error al actualizar configuración de plantilla en sesión ${sessionId}:`, error);
    return false;
  }
};

// Iniciamos limpieza periódica cada 5 minutos
setInterval(cleanFlowStatesCache, 5 * 60 * 1000);
