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

    // Registramos el inicio del procesamiento
    const startTime = Date.now();

    // Obtenemos el texto del mensaje
    const text = req.body.text;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Formato incorrecto",
        message: "El campo 'text' es requerido y debe ser una cadena de texto",
      });
    }

    // Si se especificó un templateId, verificamos que la plantilla base exista
    let useTemplateId: string | undefined = templateIdFromRequest; // Usar una variable separada
    if (useTemplateId && useTemplateId !== "default-template") {
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

    // Procesar mensaje: si hay useTemplateId, usar flujos dinámicos, si no, bot estático
    // Asegúrate que processMessageWithFlows y processMessage estén definidos y devuelvan un tipo consistente
    // Por ejemplo: type BotResponse = { text: string; tokensUsed?: number; /* otros campos */ } | string;
    let botResponse: any; // Usar 'any' temporalmente o definir BotResponse
    if (useTemplateId) {
      try {
        // Obtenemos los datos completos de la plantilla para extraer toda la configuración
        const templateBase = await getTemplateById(useTemplateId);
        const templateConfig = templateBase?.configuration || {};

        logger.info(`Procesando mensaje con flujo usando plantilla ${useTemplateId}`);

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
        : 0;
    // Normalizar texto de respuesta
    const responseText =
      typeof botResponse === "object" && botResponse?.text
        ? botResponse.text
        : typeof botResponse === "string"
        ? botResponse
        : "Lo siento, no pude procesar tu solicitud."; // Respuesta por defecto

    logger.info(
      `Respuesta del bot para session ${sessionId}: "${responseText}" (${tokensUsed} tokens)`
    );

    // Registrar mensaje del bot en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      await logMessage({
        tenant_id: tenantId,
        bot_id: botId, // ¿Debería ser el flowId?
        user_id: userId, // El user_id aquí debería ser el del bot? O mantener el del usuario?
        session_id: sessionId,
        content: responseText,
        content_type: "text",
        role: "bot",
        processed: true,
        audio_url: "",
        transcription: null,
        sender_type: "bot",
        template_id: useTemplateId, // Usar la variable verificada
        tokens_used: tokensUsed,
      });

      // Incrementar contador de uso (usando los tokens reales)
      await incrementUsage(tenantId, tokensUsed > 0 ? tokensUsed : 1);
    }

    // Calcular el tiempo total de procesamiento
    const processingTime = Date.now() - startTime;

    // Devolver la respuesta con información adicional para diagnóstico
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
