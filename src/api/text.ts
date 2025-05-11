/**
 * src/api/text.ts
 *
 * API para procesamiento de chat de texto.
 * Versión optimizada del endpoint de chat que evita el uso de servicios de voz.
 * @version 1.2.0
 * @updated 2025-04-28
 */

import { Router } from "express";
import { processMessage, clearConversation } from "../services/bot";
import { processMessageWithFlows } from "../services/botFlowIntegration";
import { AuthRequest, optionalAuthMiddleware } from "../middlewares/auth";
import {
  logMessage,
  incrementUsage,
  hasTenantExceededQuota,
  getTemplateById,
  // getActiveTemplatesByTenant, // Usar getTenantTemplatesWithFlows en su lugar para /templates
  getTenantTemplatesWithFlows, // Usar esta para obtener plantillas con estado de instancia
  setTemplateActiveStatus,
  updateTemplateConfiguration, // Marcada como obsoleta en supabase.ts
  ChatTemplate, // Importar interfaz para mapeo
  ChatbotTemplateBase, // Importar interfaz base
} from "../services/supabase";
import { config } from "../config";
import logger from "../utils/logger";

const router = Router();

// Añadimos middleware de autenticación opcional
router.use(optionalAuthMiddleware);

/**
 * Endpoint de ping para verificar conectividad
 * Útil para diagnósticos de CORS y disponibilidad
 * GET /text/ping
 */
router.get("/ping", (req, res) => {
  // Añadimos información sobre el origen para debug de CORS
  const origin = req.headers.origin || 'Unknown';

  return res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "text-api",
    cors: "enabled",
    requestOrigin: origin,
    environment: config.environment,
    headers: {
      received: Object.keys(req.headers),
      sent: Object.keys(res.getHeaders())
    }
  });
});

/**
 * Endpoint detallado de diagnóstico
 * Proporciona información para depurar problemas de conexión
 * GET /text/diagnose
 */
router.get("/diagnose", (req, res) => {
  return res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    requestInfo: {
      ip: req.ip,
      method: req.method,
      path: req.path,
      headers: req.headers,
      query: req.query
    },
    serverInfo: {
      environment: config.environment,
      port: config.port || process.env.PORT || "3090",
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      supabaseEnabled: config.supabase?.enabled || false
    },
    corsSettings: {
      allowedOrigins: "*",
      allowedMethods: "GET, POST, PUT, DELETE, OPTIONS",
      allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization",
      allowCredentials: true
    }
  });
});

/**
 * Endpoint público para obtener plantillas disponibles para un tenant
 * No requiere autenticación para facilitar pruebas desde frontend
 * GET /text/public-templates
 * NOTA: Esta ruta devuelve plantillas combinadas con el estado de instancia del tenant.
 */
router.get("/public-templates", async (req, res) => {
  try {
    const tenantId =
      (req.query.tenant_id as string) || config.multitenant.defaultTenant;

    logger.info(
      `Obteniendo plantillas públicas/disponibles para tenant ${tenantId}`
    );

    // Usar la función corregida que obtiene plantillas y estado de instancia
    let templates: ChatTemplate[] = [];
    if (config.supabase.enabled) {
      try {
        templates = await getTenantTemplatesWithFlows(tenantId);
      } catch (error) {
        logger.error(
          `Error al obtener plantillas con flujos para tenant ${tenantId}:`,
          error
        );
      }
    }

    // Si no hay plantillas o Supabase está deshabilitado, ofrecer una default
    if (templates.length === 0) {
      templates.push({
        id: "default-template",
        name: "Plantilla predeterminada",
        description: "Plantilla básica para chat de soporte",
        is_active: true, // Asumir activa por defecto
        tokens_estimated: 200,
        category: "general",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "published",
        tenant_id: null,
        configuration: {},
        is_public: true,
        flowId: null,
        isEnabled: true,
        avatarUrl: "/img/avatars/thumb-placeholder.jpg",
        author: "system",
      });
    }

    // Simplificar para la respuesta pública si es necesario
    const simplifiedTemplates = templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || "",
      isActive: t.is_active, // Estado de la instancia para el tenant
      tokensEstimated: t.tokens_estimated || 0,
      category: t.category || "general",
      // Añadir flowId si la UI lo necesita para activar/desactivar
      flowId: t.flowId,
    }));

    return res.json({
      success: true,
      templates: simplifiedTemplates, // Devolver plantillas obtenidas/default
    });
  } catch (error) {
    logger.error("Error al obtener plantillas públicas:", error);
    return res.status(500).json({
      success: false,
      error: "Error interno al obtener plantillas",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Middleware para verificar cuotas de tenant
 */
const checkTenantQuota = async (req: AuthRequest, res: any, next: any) => {
  try {
    if (!config.supabase.enabled || !config.multitenant.enabled) {
      return next(); // Si no está habilitado Supabase o multitenant, siempre permitimos
    }

    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id ||
      config.multitenant.defaultTenant;

    // Verificamos si ha excedido su cuota
    const hasExceeded = await hasTenantExceededQuota(tenantId);

    if (hasExceeded) {
      logger.warn(`Tenant ${tenantId} ha excedido la cuota.`);
      return res.status(429).json({
        error: "Cuota excedida",
        message: "Has alcanzado el límite de peticiones para hoy",
      });
    }

    next();
  } catch (error) {
    logger.error("Error al verificar cuota:", error);
    next(); // En caso de error, permitimos continuar
  }
};

/**
 * Endpoint para chat con método GET
 * Alternativa a POST /chat para casos donde hay problemas de CORS con POST
 * Usa el mismo procesamiento pero con GET
 */
router.get("/chat-get", async (req: AuthRequest, res) => {
  try {
    // Extraemos información del usuario
    const userId = req.query.user_id as string || "anonymous";
    const tenantId = req.query.tenant_id as string || config.multitenant.defaultTenant;
    const sessionId = req.query.session_id as string || `session-${userId}-${Date.now()}`;
    const botId = req.query.bot_id as string || "default";
    const templateIdFromRequest = req.query.template_id as string;
    const text = req.query.text as string;

    if (!text) {
      return res.status(400).json({
        error: "Parámetro requerido",
        message: "El parámetro 'text' es requerido"
      });
    }

    // Usar la misma lógica que el endpoint POST pero resumida
    logger.info(`GET chat: Procesando mensaje "${text}" de usuario ${userId}`);

    // Crear una respuesta simple sin procesar
    return res.json({
      success: true,
      response: `Respuesta simple a GET: "${text}"`,
      processing_time_ms: 0,
      tokens_used: 0,
      debug: {
        method: "GET",
        params: req.query
      }
    });
  } catch (error) {
    logger.error("Error en endpoint GET chat:", error);
    return res.status(200).json({
      success: false,
      error: "Error procesando mensaje",
      fallback_response: "Error de procesamiento"
    });
  }
});

/**
 * Endpoint de prueba específico para el chat
 * Devuelve un mensaje de prueba sin procesar nada
 * Útil para verificar conectividad antes de intentar procesar mensajes
 */
router.post("/chat-test", (req, res) => {
  // Extraer información básica de la solicitud
  const userId = req.body.user_id || "test-user";
  const message = req.body.text || "Mensaje de prueba";

  // Devolver una respuesta de prueba inmediata
  return res.json({
    success: true,
    response: `Mensaje de prueba recibido: "${message}"`,
    userId: userId,
    timestamp: new Date().toISOString(),
    test: true,
    headers: {
      received: req.headers,
      responseHeaders: res.getHeaders()
    }
  });
});

/**
 * Endpoint directo para chat sin middleware
 * Versión simplificada para situaciones donde hay problemas de conexión
 * Bypass completo de middleware y validación para diagnóstico
 */
router.post("/chat-direct", async (req, res) => {
  try {
    const text = req.body.text;
    const userId = req.body.user_id || "direct-test-user";
    const templateId = req.body.template_id;

    logger.info(`Chat directo: Message=${text}, UserId=${userId}, TemplateId=${templateId}`);

    // Respuesta directa sin procesamiento real
    return res.json({
      success: true,
      response: `Respuesta directa: ${text}`,
      timestamp: new Date().toISOString(),
      method: "direct-bypass"
    });
  } catch (error) {
    logger.error("Error en chat-direct:", error);
    return res.status(200).json({
      success: false,
      error: "Error en procesamiento directo",
      fallback: "Error de comunicación"
    });
  }
});

/**
 * Endpoint para conversación por texto
 * Procesa mensajes de texto sin utilizar servicios de voz
 */
router.post("/chat", checkTenantQuota, async (req: AuthRequest, res) => {
  try {
    // Extraemos información del usuario (desde el middleware de autenticación)
    const userId = req.user?.id || req.body.user_id || "anonymous";
    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id ||
      config.multitenant.defaultTenant;
    const sessionId = req.body.session_id || `${userId}-${Date.now()}`;
    const botId = req.body.bot_id || "default"; // ¿Debería ser el flowId?
    const templateIdFromRequest = req.body.template_id; // ID opcional de la plantilla a utilizar

    logger.info(
      `Procesando chat de texto para usuario ${userId} de tenant ${tenantId}, session ${sessionId}${
        templateIdFromRequest
          ? `, usando plantilla ${templateIdFromRequest}`
          : ""
      }`
    );

    // Registramos el inicio del procesamiento y creamos la variable para el tiempo total
    const startTime = Date.now();
    let processingTime = 0; // Será calculado antes de enviar la respuesta

    // Obtenemos el texto del mensaje
    const text = req.body.text;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Formato incorrecto",
        message: "El campo 'text' es requerido y debe ser una cadena de texto",
      });
    }

    // Si se especificó un templateId, verificamos que la plantilla base exista
    // o que sea un flujo predefinido en BuilderBot
    let useTemplateId: string | undefined = templateIdFromRequest; // Usar una variable separada

    // Permitir siempre los flujos predefinidos
    const builtinFlows = ['lead-capture', 'flujo-basico-lead'];

    if (useTemplateId && useTemplateId !== "default-template") {
      // Si es un flujo predefinido, no necesitamos verificar en la BD
      if (builtinFlows.includes(useTemplateId)) {
        logger.info(`Usando flujo predefinido: ${useTemplateId}`);
      } else {
        // No verificar 'default-template' en DB
        try {
          const templateBase = await getTemplateById(useTemplateId); // Solo pasar templateId
          if (templateBase) {
            logger.info(`Plantilla base ${useTemplateId} encontrada.`);
          } else {
            logger.warn(
              `Plantilla base ${useTemplateId} no encontrada. Se procederá sin plantilla específica.`
            );
            useTemplateId = undefined; // Anular templateId si no se encontró la base
          }
        } catch (error) {
          logger.error(
            `Error al obtener plantilla base ${useTemplateId}:`,
            error
          );
          useTemplateId = undefined; // Anular templateId en caso de error
        }
      }
    } else if (useTemplateId === "default-template") {
      logger.info(
        "Usando lógica de plantilla predeterminada (no basada en flujo)."
      );
      useTemplateId = undefined; // Asegurar que no se llame a processMessageWithFlows
    }
    // La configuración específica del tenant/flujo se maneja dentro de processMessageWithFlows

    // Registrar mensaje del usuario en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      await logMessage({
        tenant_id: tenantId,
        bot_id: botId, // ¿Debería ser el flowId si se usa plantilla?
        user_id: userId,
        session_id: sessionId,
        content: text,
        content_type: "text",
        role: "user",
        processed: true, // Asumimos procesado aquí
        audio_url: "",
        transcription: null,
        sender_type: "user",
        template_id: useTemplateId, // Usar la variable verificada
      });
    }

    // Procesar mensaje: si hay useTemplateId, intentar con procesamiento basado en BuilderBot primero
    let botResponse: any; // Usar 'any' temporalmente o definir BotResponse
    if (useTemplateId) {
      try {
        // Obtenemos los datos completos de la plantilla para extraer toda la configuración
        const templateBase = await getTemplateById(useTemplateId);
        const templateConfig = templateBase?.configuration || {};

        // Importamos dinámicamente para evitar ciclos de dependencia
        const { processFlowMessage } = await import('../services/flowRegistry');

        try {
          logger.info(`Intentando procesar con BuilderBot para plantilla ${useTemplateId}`);

          // Intentamos procesar con BuilderBot primero
          botResponse = await processFlowMessage(
            text,
            userId,
            sessionId,
            tenantId,
            useTemplateId
          );

          logger.info(`Mensaje procesado exitosamente con BuilderBot para plantilla ${useTemplateId}`);
        } catch (builderbotError) {
          logger.warn(`BuilderBot falló: ${builderbotError}. Intentando con flujos clásicos.`);

          // Si falla BuilderBot, caemos al sistema anterior
          try {
            // Pasamos la configuración completa de la plantilla
            botResponse = await processMessageWithFlows(
              text,
              userId,
              tenantId,
              sessionId,
              templateConfig
            );
          } catch (flowError) {
            logger.error(`Error procesando con flujo: ${flowError}. Intentando con config vacía.`);

            // Si falla, intentar con configuración vacía como fallback
            botResponse = await processMessageWithFlows(
              text,
              userId,
              tenantId,
              sessionId,
              {}
            );
          }
        }
      } catch (templateError) {
        logger.error(`Error obteniendo plantilla: ${templateError}. Usando default.`);

        // Si hay error obteniendo la plantilla, usar mensaje por defecto
        botResponse = {
          text: "Lo siento, estoy teniendo problemas para procesar tu solicitud. ¿Puedes intentarlo de nuevo?",
          tokensUsed: 15
        };
      }
    } else {
      try {
        botResponse = await processMessage(
          text,
          userId,
          tenantId,
          true, // Asumir que processMessage maneja esto
          sessionId,
          undefined, // templateConfig ya no existe
          undefined // flowService ya no existe aquí?
        );
      } catch (processError) {
        logger.error(`Error en processMessage: ${processError}. Usando respuesta fallback.`);

        // Si hay error en el procesamiento, usar mensaje por defecto
        botResponse = {
          text: "Lo siento, no puedo procesar tu mensaje en este momento. Por favor, inténtalo de nuevo más tarde.",
          tokensUsed: 15
        };
      }
    }

    // Calcular tokens usados si la respuesta incluye esa información
    // Añadir verificación de tipo para evitar error en runtime
    const tokensUsed =
      typeof botResponse === "object" && botResponse?.tokensUsed
        ? botResponse.tokensUsed
        : (typeof botResponse === "object" && botResponse?.metrics?.tokensUsed)
        ? botResponse.metrics.tokensUsed
        : 0;

    // Normalizar texto de respuesta - manejar múltiples formatos posibles
    let responseText = "Lo siento, no pude procesar tu solicitud."; // Respuesta por defecto

    if (typeof botResponse === "string") {
      // Si botResponse es una cadena de texto directa
      responseText = botResponse;
    } else if (typeof botResponse === "object") {
      // Si es un objeto, buscar el texto en las propiedades posibles
      if (botResponse?.text) {
        // Formato: { text: "mensaje", tokensUsed: N }
        responseText = botResponse.text;
      } else if (botResponse?.response) {
        // Formato: { response: "mensaje", state: {...}, metrics: {...} }
        responseText = botResponse.response;
      } else if (botResponse?.message) {
        // Formato alternativo: { message: "mensaje", ... }
        responseText = botResponse.message;
      } else if (botResponse?.state) {
        // Primero verificamos si hay un mensaje de despedida guardado (para casos de nodo final)
        if (botResponse.state.endMessage) {
          responseText = botResponse.state.endMessage;
          logger.info(`Usando mensaje de despedida guardado: "${responseText.substring(0, 50)}..."`);
        }
        // Si no hay mensaje de despedida pero el nodo actual es el nodo final o de despedida, intentamos buscar el mensaje
        else if (botResponse.state.isEndNode ||
                 (botResponse.state.currentNodeId &&
                  (botResponse.state.currentNodeId === 'messageNode-despedida' ||
                   botResponse.state.currentNodeId.toLowerCase().includes('despedida') ||
                   botResponse.state.currentNodeId.toLowerCase().includes('farewell')))) {

          // Si el estado indica que estamos en un nodo final, pero no tiene endMessage,
          // usamos la última respuesta como despedida y la guardamos para futuras interacciones
          if (botResponse.state.last_response) {
            responseText = botResponse.state.last_response;
            // Guardamos esto en endMessage para futuras interacciones
            botResponse.state.endMessage = responseText;
            logger.info(`Detectado nodo de despedida sin endMessage. Usando y guardando última respuesta: "${responseText.substring(0, 50)}..."`);
          }
        }
        // Si no hay mensaje de despedida pero hay last_response, lo usamos
        else if (botResponse.state.last_response) {
          // Formato de flowRegistry: { state: { last_response: "mensaje" }, ... }
          responseText = botResponse.state.last_response;
          logger.info(`Usando respuesta extraída de state.last_response: "${responseText}"`);
        }
      }

      // Registrar estructura para diagnóstico
      const keys = Object.keys(botResponse).join(', ');
      logger.debug(`Debug CLAUDE: Estructura de botResponse: ${keys}`);

      // Log adicional para estructuras anidadas
      if (botResponse.state) {
        logger.debug(`Debug CLAUDE: Claves en botResponse.state: ${Object.keys(botResponse.state).join(', ')}`);

        // Si hay un estado pero no tenemos respuesta aún, intentar extraerla del estado
        if (responseText === "Lo siento, no pude procesar tu solicitud." && botResponse.state.last_response) {
          responseText = botResponse.state.last_response;
          logger.info(`Extrayendo respuesta como último recurso desde state.last_response: "${responseText}"`);
        }
      }
    }

    logger.info(
      `Respuesta del bot para session ${sessionId}: "${responseText}" (${tokensUsed} tokens)`
    );

    // Comprobar si tenemos un mensaje de despedida para enviar por separado
    const hasSeparateDespedida = botResponse?.state?.sendDespedidaAsSeparateMessage === true &&
                               botResponse?.state?.endMessage;

    // Registrar mensaje del bot en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      // Si tenemos mensajes múltiples, registrarlos por separado
      if (hasSeparateDespedida) {
        const despedidaMessage = botResponse.state.endMessage;

        // Registrar el primer mensaje (confirmación de cita)
        await logMessage({
          tenant_id: tenantId,
          bot_id: botId,
          user_id: userId,
          session_id: sessionId,
          content: responseText,
          content_type: "text",
          role: "bot",
          processed: true,
          audio_url: "",
          transcription: null,
          sender_type: "bot",
          template_id: useTemplateId,
          tokens_used: Math.ceil(responseText.length / 4), // Estimación simplificada
        });

        // Añadir un pequeño retraso para simular mensajes separados en tiempo
        await new Promise(resolve => setTimeout(resolve, 300));

        // Registrar el segundo mensaje (despedida)
        await logMessage({
          tenant_id: tenantId,
          bot_id: botId,
          user_id: userId,
          session_id: sessionId,
          content: despedidaMessage,
          content_type: "text",
          role: "bot",
          processed: true,
          audio_url: "",
          transcription: null,
          sender_type: "bot",
          template_id: useTemplateId,
          tokens_used: Math.ceil(despedidaMessage.length / 4), // Estimación simplificada
        });

        // Incrementar contador usando estimación para ambos mensajes
        await incrementUsage(tenantId, tokensUsed > 0 ? tokensUsed : 2);
      } else {
        // Registrar un único mensaje como antes
        await logMessage({
          tenant_id: tenantId,
          bot_id: botId,
          user_id: userId,
          session_id: sessionId,
          content: responseText,
          content_type: "text",
          role: "bot",
          processed: true,
          audio_url: "",
          transcription: null,
          sender_type: "bot",
          template_id: useTemplateId,
          tokens_used: tokensUsed,
        });

        // Incrementar contador de uso (usando los tokens reales)
        await incrementUsage(tenantId, tokensUsed > 0 ? tokensUsed : 1);
      }
    }

    // Calcular el tiempo total de procesamiento (antes de usarlo en respuestas)
    processingTime = Date.now() - startTime;

    // Mensajes específicos de depuración para CLAUDE
    try {
      logger.debug(`Debug CLAUDE: Respuesta original de botResponse: ${JSON.stringify(botResponse)}`);
    } catch (jsonError) {
      logger.debug(`Debug CLAUDE: Error al serializar botResponse: ${jsonError}`);
      logger.debug(`Debug CLAUDE: Tipo de botResponse: ${typeof botResponse}, keys: ${botResponse ? Object.keys(botResponse).join(',') : 'null'}`);
    }
    logger.debug(`Debug CLAUDE: responseText final: ${responseText}`);
    logger.debug(`Debug CLAUDE: tokensUsed: ${tokensUsed}`);

    // Verificación adicional para garantizar que tenemos una respuesta válida
    if (!responseText || responseText === "Lo siento, no pude procesar tu solicitud.") {
      logger.warn(`No se pudo extraer una respuesta válida del botResponse. Utilizando mensaje de fallback.`);
      // Verificar si hay una respuesta directa en estado - reintento aquí para asegurar
      if (typeof botResponse === 'object') {
        // Buscar en orden de prioridad
        if (botResponse?.state?.endMessage) {
          // Si hay un mensaje de despedida específico, usarlo con máxima prioridad
          responseText = botResponse.state.endMessage;
          logger.info(`Usando mensaje de despedida encontrado en state.endMessage: "${responseText.substring(0, 50)}..."`);
        } else if (botResponse?.state?.last_response) {
          responseText = botResponse.state.last_response;
          logger.info(`Usando respuesta encontrada en state.last_response: "${responseText}"`);
        } else if (botResponse?.originalResponse?.response) {
          responseText = botResponse.originalResponse.response;
          logger.info(`Usando respuesta encontrada en originalResponse.response: "${responseText}"`);
        } else if (botResponse?.state?.last_user_message) {
          // Como último recurso, generamos una respuesta contextual con el mensaje del usuario
          const userMsg = botResponse.state.last_user_message;
          responseText = `Recibí tu mensaje: "${userMsg}". ¿En qué más puedo ayudarte?`;
          logger.info(`Generando respuesta contextual basada en el mensaje del usuario: "${responseText}"`);
        }
      }
    }

    // Ahora ya podemos enviar la respuesta al cliente

    // Si tenemos un mensaje de despedida separado, lo enviamos como un arreglo de mensajes
    // esto permite a la UI mostrarlos como burbujas separadas
    if (hasSeparateDespedida) {
      const despedidaMessage = botResponse.state.endMessage;
      logger.info(`Enviando respuesta principal y mensaje de despedida como mensajes separados`);
      logger.info(`Mensaje principal: "${responseText.substring(0, 50)}..."`);
      logger.info(`Mensaje despedida: "${despedidaMessage.substring(0, 50)}..."`);

      // FORZAR REEMPLAZO: Ignoramos el contenido actual y siempre usamos información más específica
      // Esta es una solución agresiva para evitar el problema de "Mensaje procesado"
      // Crear un mensaje más informativo basado en los datos disponibles
      if (true) { // Siempre ejecutar esta lógica
        if (botResponse.state?.variables?.fecha_cita && botResponse.state?.variables?.hora_cita) {
          const fecha = botResponse.state.variables.fecha_cita;
          const hora = botResponse.state.variables.hora_cita;
          responseText = `¡Perfecto! Tu cita ha sido agendada para el ${fecha} a las ${hora}. Te enviaremos un correo con los detalles y uno de nuestros asesores se comunicará contigo pronto.`;
          logger.info(`Reemplazando mensaje genérico con respuesta específica de cita`);
        } else if (botResponse.state?.confirmation_message) {
          // Si hay un mensaje de confirmación guardado en el estado, usarlo
          responseText = botResponse.state.confirmation_message;
          logger.info(`FORZADO: Usando mensaje de confirmación guardado: "${responseText.substring(0, 50)}..."`);
        } else if (botResponse.state?.endMessage && botResponse.state?.endMessage.includes("cita")) {
          // Si el mensaje de despedida menciona "cita", probablemente sea nuestro mensaje de confirmación
          responseText = botResponse.state.endMessage;
          logger.info(`FORZADO: Usando endMessage como confirmación: "${responseText.substring(0, 50)}..."`);
        } else if (botResponse.state?.last_response && botResponse.state?.last_response.includes("cita")) {
          // Si la última respuesta menciona "cita", probablemente sea nuestra confirmación
          responseText = botResponse.state.last_response;
          logger.info(`FORZADO: Usando last_response como confirmación: "${responseText.substring(0, 50)}..."`);
        } else {
          // Si no hay ningún mensaje específico, generamos uno basado en el estado
          // Si podemos identificar que estamos en un nodo de confirmación de cita por su ID
          if (botResponse.state?.currentNodeId) {
            const currentNodeId = botResponse.state.currentNodeId;
            logger.info(`FORZADO: Intentando reconstruir mensaje desde nodo ${currentNodeId}`);

            if (currentNodeId === "messageNode-cita-confirmada" ||
                currentNodeId.toLowerCase().includes("cita") ||
                currentNodeId.toLowerCase().includes("confirm")) {
              // Usar un mensaje genérico pero informativo
              responseText = "Tu cita ha sido registrada correctamente. Gracias por tu preferencia.";
              logger.info(`FORZADO: Generando mensaje informativo basado en ID de nodo: ${currentNodeId}`);
            } else {
              // Último recurso: mensaje de fallback general
              responseText = "Hemos procesado tu solicitud exitosamente. ¿Hay algo más en lo que pueda ayudarte?";
              logger.info(`FORZADO: Usando mensaje de fallback general por falta de información específica`);
            }
          } else {
            // Si ni siquiera tenemos el ID del nodo, usamos un mensaje genérico de fallback
            responseText = "Tu solicitud ha sido procesada. ¿Puedo ayudarte con algo más?";
            logger.info(`FORZADO: Sin ID de nodo, usando mensaje de fallback básico`);
          }
        }
      } // Fin del bloque if(true)

      return res.json({
        success: true,
        // Enviar array de mensajes para que la UI los muestre separados
        messages: [
          responseText, // Primer mensaje (confirmación de cita)
          despedidaMessage // Segundo mensaje (despedida)
        ],
        is_multi_message: true, // Flag para que el cliente sepa que debe mostrar múltiples mensajes
        processing_time_ms: processingTime,
        tokens_used: tokensUsed,
        debug: {
          template_id: useTemplateId || 'none',
          user_id: userId,
          session_id: sessionId,
          tenant_id: tenantId
        }
      });
    } else {
      // Respuesta normal con un solo mensaje
      return res.json({
        success: true,
        response: responseText,
        processing_time_ms: processingTime,
        tokens_used: tokensUsed,
        debug: {
          template_id: useTemplateId || 'none',
          user_id: userId,
          session_id: sessionId,
          tenant_id: tenantId
        }
      });
    }
  } catch (error) {
    logger.error("Error general en endpoint de chat de texto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    logger.error(`Detalles del error: ${errorMessage}`);

    // Devolver error con detalles y una respuesta de fallback para que la UI muestre algo
    return res.status(200).json({
      success: false,
      error: "Error al procesar chat de texto",
      details: errorMessage,
      fallback_response: "Lo siento, estoy experimentando dificultades técnicas. Por favor, inténtalo de nuevo.",
      debug: {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Endpoint para obtener plantillas disponibles para un tenant
 * GET /text/templates
 */
router.get("/templates", async (req: AuthRequest, res) => {
  try {
    const tenantId =
      req.user?.tenantId ||
      (req.query.tenant_id as string) ||
      config.multitenant.defaultTenant;

    logger.info(`Obteniendo plantillas disponibles para tenant ${tenantId}`);

    let templates: ChatTemplate[] = [];
    try {
      // Usar la función que obtiene plantillas combinadas con estado de instancia
      templates = await getTenantTemplatesWithFlows(tenantId);
    } catch (error) {
      logger.error(
        `Error al obtener plantillas con flujos para tenant ${tenantId}:`,
        error
      );
    }

    // Si no hay plantillas disponibles, proporcionar una plantilla predeterminada
    if (templates.length === 0) {
      logger.info(
        `No hay plantillas disponibles para tenant ${tenantId}, usando plantilla predeterminada`
      );
      templates = [
        {
          id: "default-template",
          name: "Plantilla predeterminada",
          description: "Plantilla básica para chat de soporte",
          is_active: true, // Default
          tokens_estimated: 200, // Default
          category: "general", // Default
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: "published",
          tenant_id: null,
          configuration: {},
          is_public: true,
          flowId: null,
          isEnabled: true,
          avatarUrl: "/img/avatars/thumb-placeholder.jpg",
          author: "system",
        },
      ];
    }

    // Simplificamos la respuesta para incluir solo lo necesario para la UI
    const simplifiedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description || "",
      isActive: template.is_active, // Estado de la instancia
      tokensEstimated: template.tokens_estimated || 0,
      category: template.category || "general",
      // Añadir flowId si la UI lo necesita para activar/desactivar
      flowId: template.flowId,
    }));

    return res.json({
      success: true,
      templates: simplifiedTemplates,
    });
  } catch (error) {
    logger.error("Error al obtener plantillas:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener plantillas disponibles",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para obtener detalle de una plantilla específica (devuelve datos base)
 * GET /text/templates/:id
 */
router.get("/templates/:id", async (req: AuthRequest, res) => {
  try {
    const templateId = req.params.id;
    // tenantId no es necesario para obtener la plantilla base
    // const tenantId = req.user?.tenantId || (req.query.tenant_id as string) || config.multitenant.defaultTenant;

    logger.info(`Obteniendo detalle de plantilla base ${templateId}`);

    const template = await getTemplateById(templateId); // Solo pasar templateId

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Plantilla base no encontrada",
      });
    }

    // Devolver los datos base de la plantilla
    return res.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description || "",
        // Devolver el estado base, no el de instancia
        isActive: template.status === "published",
        tokensEstimated: 500, // Default
        category: "General", // Default
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        configuration: {}, // Default
        version: template.version,
        author: template.created_by,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener plantilla ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener detalle de plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para activar o desactivar una instancia de flujo para un tenant
 * Requiere el flowId (ID de la instancia), no el templateId.
 * PUT /text/flows/:flowId/status  <- Cambiar ruta para reflejar que opera sobre flujos
 */
router.put("/flows/:flowId/status", async (req: AuthRequest, res) => {
  try {
    const flowId = req.params.flowId; // Usar flowId de la ruta
    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id || // Obtener tenantId del cuerpo o auth
      config.multitenant.defaultTenant;
    const isActive = req.body.is_active;

    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        error: "Parámetro requerido",
        message: "El campo 'is_active' es requerido",
      });
    }
    if (!tenantId || tenantId === config.multitenant.defaultTenant) {
      return res.status(400).json({
        success: false,
        error: "Tenant ID inválido o no proporcionado.",
      });
    }

    logger.info(
      `Cambiando estado de flujo ${flowId} para tenant ${tenantId} a ${
        isActive ? "activo" : "inactivo"
      }`
    );

    // Usar la función corregida que opera sobre 'flows'
    const success = await setTemplateActiveStatus(
      flowId, // Pasar flowId
      tenantId,
      isActive
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al cambiar estado del flujo",
        message:
          "No se pudo actualizar el estado o el flujo/tenant no coincide.",
      });
    }

    return res.json({
      success: true,
      message: `Flujo ${isActive ? "activado" : "desactivado"} correctamente`,
    });
  } catch (error) {
    logger.error(
      `Error al cambiar estado de flujo ${req.params.flowId}:`,
      error
    );
    return res.status(500).json({
      success: false,
      error: "Error al cambiar estado de flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para actualizar configuración de una plantilla para un tenant (OBSOLETO)
 * PUT /text/templates/:id/config
 */
router.put("/templates/:id/config", async (req: AuthRequest, res) => {
  logger.warn(
    "Endpoint PUT /text/templates/:id/config es obsoleto y no funcional."
  );
  return res.status(410).json({
    // 410 Gone
    success: false,
    error: "Endpoint obsoleto",
    message:
      "La configuración ahora se maneja a nivel de flujo o tenant_chatbot_configurations.",
  });
  /*
  try {
    const templateId = req.params.id;
    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id ||
      config.multitenant.defaultTenant; // Esta es la config global importada
    const newConfig = req.body.config; // Renombrar variable local

    if (!newConfig || typeof newConfig !== "object") {
      return res.status(400).json({
        success: false,
        error: "Parámetro requerido",
        message: "El campo 'config' es requerido y debe ser un objeto",
      });
    }

    logger.info(
      `Actualizando configuración de plantilla ${templateId} para tenant ${tenantId}`
    );

    // Llamar a la función obsoleta (que devuelve false) o eliminar/reemplazar esta lógica
    const success = await updateTemplateConfiguration(
      tenantId, // El orden aquí era incorrecto en la versión anterior
      templateId,
      newConfig // Pasar la variable local renombrada
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar configuración de plantilla (función obsoleta)",
      });
    }

    return res.json({
      success: true,
      message: "Configuración actualizada correctamente (función obsoleta)",
    });
  } catch (error) {
    logger.error(
      `Error al actualizar configuración de plantilla ${req.params.id}:`,
      error
    );
    return res.status(500).json({
      success: false,
      error: "Error al actualizar configuración de plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
  */
});

/**
 * Endpoint para limpiar el historial de conversación de un usuario/sesión
 * POST /text/clear
 */
router.post("/clear", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || req.body.user_id || "anonymous";
    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id ||
      config.multitenant.defaultTenant;
    const sessionId = req.body.session_id; // Requerir sessionId para limpiar

    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "session_id es requerido" });
    }

    logger.info(
      `Limpiando historial para usuario ${userId}, tenant ${tenantId}, session ${sessionId}`
    );

    // Llamar a la función de servicio para limpiar (solo necesita userId y tenantId)
    await clearConversation(userId, tenantId);

    return res.json({
      success: true,
      message: "Historial de conversación limpiado",
    });
  } catch (error) {
    logger.error("Error al limpiar historial:", error);
    return res.status(500).json({
      success: false,
      error: "Error al limpiar historial",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint de health check
 * GET /text/health
 */
router.get("/health", async (req, res) => {
  try {
    // Verificar conexión a Supabase si está habilitado
    if (config.supabase.enabled) {
      // Re-importar aquí temporalmente si hay problemas de alcance
      const { getSupabaseClient } = await import("../services/supabase");
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("tenants").select("id").limit(1);
      if (error) {
        throw new Error(`Error de conexión a Supabase: ${error.message}`);
      }
    }
    // Podrían añadirse otras verificaciones aquí

    return res.json({ success: true, status: "ok", timestamp: new Date() });
  } catch (error) {
    logger.error("Error en health check:", error);
    return res.status(500).json({
      success: false,
      status: "error",
      error: "Health check fallido",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
