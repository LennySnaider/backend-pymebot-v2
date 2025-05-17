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
// import { processMessageWithFlows } from "./flowRegistry"; // Comentado para evitar conflicto

// Estructura para respuestas con metadatos
export interface FlowResponse {
  text: string;           // Texto de la respuesta
  tokensUsed?: number;    // Tokens utilizados (opcional)
  originalResponse?: any; // Respuesta original (opcional)
}

// Inicializamos el servicio de flujos dinámicos
const flowService = new FlowService();

// Caché de estados de flujos dinámicos por usuario y tenant
// Exportamos para poder compartir entre módulos
export const flowStates: Record<string, FlowState> = {};

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
  templateConfig?: Record<string, any>,
  options: Record<string, any> = {}
): Promise<FlowResponse | string> => {
  try {
    // Intentar procesar con BuilderBot si la función está disponible
    // Comentado temporalmente - la función processFlowMessage no existe
    /*
    if (typeof processFlowMessage === 'function' && templateConfig?.id) {
      try {
        logger.info(`Intentando procesar mensaje con BuilderBot (templateId: ${templateConfig.id})`);
        const result = await processFlowMessage(
          message,
          userId,
          sessionId,
          tenantId,
          templateConfig.id,
          options // Pasar opciones adicionales
        );

        if (result) {
          logger.info(`Mensaje procesado exitosamente con BuilderBot`);

          // Verificamos si la respuesta tiene los campos correctos
          // y los transformamos al formato esperado por el controlador API

          // Extraer la respuesta evitando el texto genérico "Mensaje procesado"
          let responseText = "Respuesta del asistente";

          // Priorizar la respuesta específica si está disponible
          if (result.response && result.response !== "Mensaje procesado" && result.response !== "Procesando tu solicitud...") {
            responseText = result.response;
          }
          // Si hay un mensaje de confirmación guardado, usarlo como respuesta
          else if (result.state?.confirmation_message) {
            responseText = result.state.confirmation_message;
            logger.info(`Usando state.confirmation_message en lugar de "Mensaje procesado"`);
          }
          // Si hay un mensaje final guardado, usarlo como respuesta
          else if (result.state?.endMessage) {
            responseText = result.state.endMessage;
            logger.info(`Usando state.endMessage en lugar de "Mensaje procesado"`);
          }
          // Si hay una última respuesta guardada, usarla como respuesta
          else if (result.state?.last_response) {
            responseText = result.state.last_response;
            logger.info(`Usando state.last_response en lugar de "Mensaje procesado"`);
          }
          // Verificar datos de confirmación de cita
          else if (result.state?.variables?.fecha_cita && result.state?.variables?.hora_cita) {
            const fecha = result.state.variables.fecha_cita;
            const hora = result.state.variables.hora_cita;
            responseText = `¡Perfecto! Tu cita ha sido agendada para el ${fecha} a las ${hora}. Te enviaremos un correo con los detalles y uno de nuestros asesores se comunicará contigo pronto.`;
            logger.info(`Generando mensaje de confirmación de cita a partir de variables`);
          }

          return {
            text: responseText,
            tokensUsed: result.metrics?.tokensUsed || 0,
            // Incluimos la respuesta original por si se necesita en otro lado
            originalResponse: result
          };
        }
      } catch (builderbotError) {
        logger.warn(`Error al procesar con BuilderBot: ${builderbotError}. Continuando con el flujo normal.`);
        // Continuar con el procesamiento normal si BuilderBot falla
      }
    }
    */

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

          // Si aún no tenemos un mensaje, mostrar un mensaje de error claro
          if (!greeting) {
            // Mensaje de error indicando que no se pudo cargar la plantilla correctamente
            greeting = "⚠️ ERROR: No se pudo cargar el mensaje de bienvenida de la plantilla. Por favor, contacte al administrador o seleccione otra plantilla.";
            logger.error(`⚠️ No se encontró ningún mensaje en la plantilla. Se mostrará mensaje de error.`);
          }
        } catch (extractError) {
          logger.error(`❌ ERROR al extraer mensaje de plantilla: ${extractError}`);
          // Mensaje de error en caso de excepción
          greeting = "⚠️ ERROR: Ocurrió un problema al cargar la plantilla. Por favor, contacte al administrador del sistema o seleccione otra plantilla.";
          logger.error(`Se mostrará mensaje de error debido a excepción al cargar plantilla`);
        }

        // Intentamos obtener el flujo activo para el tenant para usar el nodo de entrada correcto
        let entryNodeId = 'start-node'; // Nuevo valor por defecto más común en los flujos ReactFlow

        try {
          // Intentamos obtener el flujo activo para usar su nodo de entrada
          logger.info(`Buscando flujo activo usando tenant_id: ${validTenantId}`);
          const activeFlow = await flowService.getFlowByTenant(validTenantId);
          
          if (activeFlow) {
            logger.info(`Flujo ${activeFlow.id} (${activeFlow.name}) cargado para tenant ${validTenantId}`);
            
            if (activeFlow.entryNodeId) {
              entryNodeId = activeFlow.entryNodeId;
              logger.info(`Usando nodo de entrada real del flujo: ${entryNodeId}`);
            } else if (activeFlow.nodes) {
              logger.info(`Flujo no tiene entryNodeId definido, buscando nodo de tipo 'startNode'`);
              
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
            }
          } else {
            logger.warn(`No se encontró un flujo activo para tenant ${validTenantId}`);
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
      text: "⚠️ ERROR: No se pudo procesar el mensaje. Verifique que la plantilla seleccionada sea válida y esté correctamente configurada.",
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
  try {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutos

    Object.entries(flowStates).forEach(([key, state]) => {
      try {
        // Verificamos que lastUpdatedAt sea un objeto Date válido
        if (!state || !state.lastUpdatedAt) {
          // Si no hay fecha de actualización, lo eliminamos por seguridad
          delete flowStates[key];
          logger.debug(`Estado de flujo eliminado por falta de lastUpdatedAt: ${key}`);
          return;
        }

        // Convertimos a Date si es un string (por ejemplo, si viene de JSON)
        let lastUpdatedDate: Date;
        if (typeof state.lastUpdatedAt === 'string') {
          lastUpdatedDate = new Date(state.lastUpdatedAt);
        } else if (state.lastUpdatedAt instanceof Date) {
          lastUpdatedDate = state.lastUpdatedAt;
        } else {
          // Si no es ni string ni Date, usamos la fecha actual para evitar errores
          logger.warn(`lastUpdatedAt inválido para estado ${key}, usando fecha actual`);
          lastUpdatedDate = new Date();
        }

        // Obtenemos el timestamp y verificamos si ha expirado
        const lastUpdated = lastUpdatedDate.getTime();
        if (now - lastUpdated > timeout) {
          delete flowStates[key];
          logger.debug(`Estado de flujo eliminado por timeout: ${key}`);
        }
      } catch (itemError) {
        // Si hay un error procesando un estado específico, lo eliminamos y continuamos
        logger.error(`Error procesando estado ${key} durante limpieza: ${itemError}`);
        delete flowStates[key];
      }
    });
  } catch (error) {
    // Capturamos cualquier error para evitar que la aplicación falle
    logger.error(`Error en limpieza de caché de estados: ${error}`);
  }
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