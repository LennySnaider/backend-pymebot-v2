import { Response } from "express";
import { randomUUID } from "crypto";
import {
  processMessage,
  processMessageWithBuilderBot,
} from "../services/chatbotService";
import logger from "../utils/logger";
import { AuthRequest } from "../types/auth";
import { config } from "../config";
import {
  isUserRegistered,
  createNewConversation,
  incrementUsage,
  hasTenantExceededQuota,
  logMessage,
  getTemplateById,
  getTenantTemplatesWithFlows,
} from "../services/supabase";
import providerService from "../services/providerService";
import { processSalesFunnelActions } from "../services/salesFunnelService";

// Interface general para respuestas de bot
interface BotResponse {
  text?: string;
  answer?: Array<{ body: string }> | string;
  response?: string | object;
  message?: string;
  tokensUsed?: number;
  media?: any[];
  buttons?: any[];
  state?: any;
  metrics?: {
    tokensUsed?: number;
  };
}

/**
 * Maneja las solicitudes de chat de texto sin autenticación completa
 * Solo valida tenant_id
 * @param req Express request con AuthRequest type
 * @param res Express response  
 * @returns Respuesta JSON con el mensaje del bot
 */
export async function handleTextChatNoAuth(req: AuthRequest, res: Response) {
  try {
    // Extraer solo tenant_id de la petición
    const tenantId = req.body.tenant_id || config.multitenant.defaultTenant;
    
    // Verificación básica solo de tenant_id
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        error: "tenant_id es requerido"
      });
    }

    // Llamar al handler principal
    return handleChatRequest(req, res);
  } catch (error) {
    logger.error("Error en handleTextChatNoAuth:", error);
    
    return res.status(500).json({
      error: "Error interno del servidor",
      message: config.debug ? (error as Error).message : undefined,
    });
  }
}

/**
 * Maneja las solicitudes de chat de texto con autenticación Supabase
 * @param req Express request con AuthRequest type
 * @param res Express response
 * @returns Respuesta JSON con el mensaje del bot
 */
export async function handleTextChat(req: AuthRequest, res: Response) {
  try {
    // Validar que tengamos los datos del usuario desde el middleware
    if (!req.user) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Token de autenticación inválido o expirado",
      });
    }

    // Validar formato de la petición
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Formato de solicitud inválido",
        message: "El cuerpo de la solicitud debe ser un objeto JSON válido",
      });
    }

    // Llamar al handler principal
    return handleChatRequest(req, res);
  } catch (error) {
    logger.error("Error en handleTextChat:", error);
    
    return res.status(500).json({
      error: "Error interno del servidor",
      message: config.debug ? (error as Error).message : undefined,
    });
  }
}

/**
 * Maneja las solicitudes de chat de texto integradas (WebChat)
 * @param req Express request con AuthRequest type
 * @param res Express response
 * @returns Respuesta JSON con el mensaje del bot
 */
export async function handleIntegratedChat(req: AuthRequest, res: Response) {
  try {
    logger.info("API Integrated Chat llamada con body:", req.body);
    
    // Validar formato de la petición
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Formato de solicitud inválido",
        message: "El cuerpo de la solicitud debe ser un objeto JSON válido",
      });
    }

    const { 
      user_id,
      tenant_id, 
      message, 
      session_id,
      template_id,
      mode,
      is_first_message
    } = req.body;

    // Nuevo: Permitir modo de operación para diferentes tipos de integración
    const processingMode = mode || req.body.processing_mode || 'standard';
    
    logger.info(`Modo de procesamiento: ${processingMode}`);

    // Validación de campos obligatorios según el modo
    if (!user_id || !tenant_id || !message || !session_id) {
      return res.status(400).json({
        error: "Campos incompletos",
        message: "user_id, tenant_id, message y session_id son requeridos",
      });
    }

    // Verificar si el tenant ha excedido su cuota (solo si está habilitado)
    if (config.supabase.enabled && config.features.quotaValidation) {
      const exceeded = await hasTenantExceededQuota(tenant_id);
      if (exceeded) {
        return res.status(429).json({
          error: "Cuota excedida",
          message: "El tenant ha excedido su cuota de mensajes para el período actual",
        });
      }
    }

    // Crear objeto de solicitud adaptado con los modos correctos
    const chatRequest = req as AuthRequest;
    chatRequest.body = {
      text: message,
      user_id,
      tenant_id,
      session_id,
      template_id: template_id || null,
      // Mapeo de modos para compatibilidad
      mode: processingMode === 'direct' ? 'direct-welcome' : 
            processingMode === 'auto' ? 'auto-flow' : 
            processingMode,
      force_welcome: processingMode === 'direct' || processingMode === 'direct-welcome',
      is_first_message: is_first_message || processingMode === 'auto'
    };
    chatRequest.user = {
      id: user_id,
      tenantId: tenant_id
    };

    // Si no hay template_id, intentar obtener la plantilla activa
    if (!template_id && processingMode !== 'direct') {
      try {
        const activeTemplates = await getTenantTemplatesWithFlows(tenant_id);
        const activeTemplate = activeTemplates.find(t => t.is_active);
        
        if (activeTemplate) {
          logger.info(`Usando plantilla activa: ${activeTemplate.id}`);
          chatRequest.body.template_id = activeTemplate.id;
        } else {
          logger.warn(`No se encontró plantilla activa para tenant ${tenant_id}`);
        }
      } catch (error) {
        logger.error("Error al buscar plantilla activa:", error);
      }
    }

    // Llamar al handler principal con el modo correcto
    logger.info(`Procesando con modo: ${chatRequest.body.mode}, template: ${chatRequest.body.template_id}`);
    return handleChatRequest(chatRequest, res);
    
  } catch (error) {
    logger.error("Error en handleIntegratedChat:", error);
    
    return res.status(500).json({
      error: "Error interno del servidor",
      message: config.debug ? (error as Error).message : undefined,
    });
  }
}

/**
 * Helper function to handle chat requests
 */
async function handleChatRequest(req: AuthRequest, res: Response) {
  try {
    // Extraemos información del usuario (desde el middleware de autenticación)
    // Generar UUID válido para usuarios anónimos
    const generateAnonymousId = () => {
      return `anon-${randomUUID()}`;
    };
    
    // SOLUCIÓN: Priorizar session_id para mantener persistencia de sesión
    let userId: string;
    let sessionId: string;
    
    if (req.body.session_id) {
      // Si se proporciona session_id, usarlo como base para generar userId consistente
      sessionId = req.body.session_id;
      // Extraer userId del session_id o usar uno consistente
      userId = req.user?.id || req.body.user_id || sessionId.replace('-session', '');
    } else {
      // Si no hay session_id, generar userId y crear session_id basado en él
      userId = req.user?.id || req.body.user_id || generateAnonymousId();
      sessionId = `${userId}-session`;
    }
    
    const tenantId =
      req.user?.tenantId ||
      req.body.tenant_id ||
      config.multitenant.defaultTenant;
    const botId = req.body.bot_id || "default"; // ¿Debería ser el flowId?
    const templateIdFromRequest = req.body.template_id; // ID opcional de la plantilla a utilizar

    logger.info(
      `Procesando chat de texto para usuario ${userId} de tenant ${tenantId}, session ${sessionId}${
        templateIdFromRequest
          ? `, usando plantilla ${templateIdFromRequest}`
          : ""
      }`
    );
    
    // Verificar si se debe forzar el reinicio
    const forceTemplateReset = req.body.force_template_reset === true;
    
    // Limpiar la caché si la plantilla CAMBIA o se fuerza el reinicio
    if (templateIdFromRequest && templateIdFromRequest !== "default-template") {
      const { getSessionContext, setSessionContext } = await import("../services/sessionContext");
      
      // Obtener el contexto actual
      const currentContext = getSessionContext(userId);
      const currentTemplateId = currentContext?.templateId;
      
      // Limpiar si la plantilla es diferente O si se fuerza el reinicio
      if (currentTemplateId !== templateIdFromRequest || forceTemplateReset) {
        const { clearSessionBot } = await import("../services/flowRegistryPatch");
        const { FlowRegistry } = await import("../services/flowRegistry");
        
        const reason = forceTemplateReset ? '(forzado por frontend)' : '(cambio detectado)';
        logger.info(`Plantilla cambió de ${currentTemplateId} a ${templateIdFromRequest} ${reason}, limpiando caché...`);
        
        // Limpiar bot de sesión
        clearSessionBot(tenantId, sessionId);
        
        // Limpiar caché de flujos
        FlowRegistry.clearCache();
        
        // Actualizar contexto de sesión con nueva plantilla
        setSessionContext(userId, {
          tenantId,
          sessionId,
          templateId: templateIdFromRequest
        });
        
        logger.info(`Caché completa limpiada y contexto actualizado para cambio de plantilla a ${templateIdFromRequest}`);
      } else {
        logger.debug(`Plantilla ${templateIdFromRequest} ya está activa, manteniendo sesión actual`);
      }
    }

    // Registramos el inicio del procesamiento y creamos la variable para el tiempo total
    const startTime = Date.now();
    let processingTime = 0; // Será calculado antes de enviar la respuesta

    // Obtenemos el texto del mensaje y el modo de procesamiento
    const text = req.body.text;
    const mode = req.body.mode || 'standard'; // Valores posibles: standard, direct-welcome, auto-flow
    const forceWelcome = req.body.force_welcome || mode === 'direct-welcome' || mode === 'auto-flow';
    const autoStartFlow = mode === 'auto-flow';
    
    // Registrar el modo de operación para depuración
    logger.debug(`Chat endpoint: modo=${mode}, forceWelcome=${forceWelcome}, autoStartFlow=${autoStartFlow}`);

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
              `Plantilla base ${useTemplateId} no encontrada. Buscando plantilla activa para el tenant.`
            );
            // Si no se encuentra la plantilla solicitada, buscar una plantilla activa para el tenant
            const activeTemplates = await getTenantTemplatesWithFlows(tenantId);
            const activeTemplate = activeTemplates.find(t => t.is_active);
            
            if (activeTemplate) {
              useTemplateId = activeTemplate.id;
              logger.info(`Usando plantilla activa para el tenant: ${useTemplateId}`);
            } else {
              logger.warn(`No se encontró ninguna plantilla activa para el tenant ${tenantId}`);
              useTemplateId = undefined; // Anular templateId si no se encontró
            }
          }
        } catch (error) {
          // Si el error es de sintaxis UUID inválida, buscar plantilla activa
          if (error instanceof Error && error.message.includes('invalid input syntax for type uuid')) {
            logger.warn(`Template ID '${useTemplateId}' no es un UUID válido. Buscando plantilla activa para el tenant.`);
            try {
              const activeTemplates = await getTenantTemplatesWithFlows(tenantId);
              const activeTemplate = activeTemplates.find(t => t.is_active);
              
              if (activeTemplate) {
                useTemplateId = activeTemplate.id;
                logger.info(`Usando plantilla activa para el tenant: ${useTemplateId}`);
              } else {
                logger.warn(`No se encontró ninguna plantilla activa para el tenant ${tenantId}`);
                useTemplateId = undefined;
              }
            } catch (templateError) {
              logger.error(`Error al buscar plantilla activa:`, templateError);
              useTemplateId = undefined;
            }
          } else {
            logger.error(
              `Error al obtener plantilla base ${useTemplateId}:`,
              error
            );
            useTemplateId = undefined; // Anular templateId en caso de error
          }
        }
      }
    } else if (useTemplateId === "default-template") {
      logger.info(
        "Usando lógica de plantilla predeterminada (no basada en flujo)."
      );
      useTemplateId = undefined; // Asegurar que no se llame a processMessageWithFlows
    }
    
    // Si no tenemos templateId y no es un caso específico, buscar plantilla activa
    if (!useTemplateId && templateIdFromRequest && !['default-template', undefined, null].includes(templateIdFromRequest)) {
      logger.info(`Intentando encontrar plantilla activa para el tenant ${tenantId}`);
      try {
        const activeTemplates = await getTenantTemplatesWithFlows(tenantId);
        const activeTemplate = activeTemplates.find(t => t.is_active);
        
        if (activeTemplate) {
          useTemplateId = activeTemplate.id;
          logger.info(`Usando plantilla activa para el tenant: ${useTemplateId}`);
        }
      } catch (error) {
        logger.error(`Error al buscar plantilla activa para fallback:`, error);
      }
    }
    
    // Si no tenemos templateId, buscar automáticamente plantilla activa
    if (!useTemplateId) {
      logger.info(`No se especificó template_id. Buscando plantilla activa para el tenant ${tenantId}`);
      try {
        const activeTemplates = await getTenantTemplatesWithFlows(tenantId);
        const activeTemplate = activeTemplates.find(t => t.is_active);
        
        if (activeTemplate) {
          useTemplateId = activeTemplate.id;
          logger.info(`Usando plantilla activa encontrada: ${useTemplateId}`);
        } else {
          logger.warn(`No se encontró ninguna plantilla activa para el tenant ${tenantId}`);
        }
      } catch (error) {
        logger.error(`Error al buscar plantilla activa automáticamente:`, error);
      }
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
    let botResponse: BotResponse = {
      text: "ERROR: No se pudo procesar el mensaje correctamente"
    };
    
    // Añadir parámetros adicionales para los diferentes modos de procesamiento
    const processingOptions = {
      forceWelcome: forceWelcome,  // Para modo direct-welcome
      autoStartFlow: autoStartFlow, // Para modo auto-flow
      isFirstMessage: req.body.is_first_message || autoStartFlow // Forzar como primer mensaje si es auto-flow
    };
    
    if (useTemplateId) {
      try {
        // Importamos dinámicamente para evitar ciclos de dependencia
        const { processFlowMessage } = await import('../services/flowRegistry');

        logger.info(`Intentando procesar con BuilderBot para plantilla ${useTemplateId}`);

        // Obtener el provider para capturar respuestas
        const provider = providerService.getProvider();
        
        // Procesar con BuilderBot
        botResponse = await processFlowMessage(
          userId, 
          text, 
          tenantId, 
          sessionId,
          useTemplateId,
          {
            initialData: {
              leadId: req.body.lead_id,
              leadCreated: !!req.body.lead_id
            }
          }
        );

        logger.info(`Mensaje procesado exitosamente con BuilderBot para plantilla ${useTemplateId}`);
        
      } catch (builderbotError) {
        logger.error(`ERROR: No se pudo procesar el mensaje con BuilderBot:`, builderbotError);
        
        // Si falla BuilderBot, devolver un mensaje de error claro
        botResponse = {
          answer: [{
            body: "ERROR: No se pudo procesar el mensaje correctamente"
          }]
        };
      }
    } else {
      try {
        botResponse = await processMessage(
          text,
          userId,
          tenantId,
          true, // skipBuiltinResponse
          sessionId,
          undefined, // botId
          undefined  // templateConfig
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

    // Normalizar la respuesta del bot
    let responseText = "";
    let tokensUsed = 0;
    let buttons: any[] = [];
    let media: any[] = [];
    let salesStageId: string | undefined = undefined;
    
    // Extraer respuesta según el formato
    if (botResponse?.answer) {
      // Formato BuilderBot
      if (Array.isArray(botResponse.answer)) {
        responseText = botResponse.answer.map(a => a.body || '').join('\n');
      } else if (typeof botResponse.answer === 'string') {
        responseText = botResponse.answer;
      }
      
      // Extraer botones si existen
      if (botResponse.buttons && Array.isArray(botResponse.buttons)) {
        buttons = botResponse.buttons;
      }
      
      // Extraer media si existe
      if (botResponse.media && Array.isArray(botResponse.media)) {
        media = botResponse.media;
      }
      
      // Extraer salesStageId si existe en el contexto
      if ((botResponse as any).context?.currentLeadStage) {
        salesStageId = (botResponse as any).context.currentLeadStage;
        logger.info(`[text.ts] SalesStageId encontrado en contexto: ${salesStageId}`);
      }
    } else if (botResponse?.text) {
      responseText = botResponse.text;
    } else if (botResponse?.response) {
      responseText = typeof botResponse.response === 'string' 
        ? botResponse.response 
        : JSON.stringify(botResponse.response);
    } else if (botResponse?.message) {
      responseText = botResponse.message;
    }
    
    // Si no hay respuesta, usar mensaje de error
    if (!responseText) {
      responseText = "ERROR: No se pudo procesar el mensaje correctamente";
    }
    
    // Extraer tokens usados
    if (botResponse?.tokensUsed) {
      tokensUsed = botResponse.tokensUsed;
    } else if (botResponse?.metrics?.tokensUsed) {
      tokensUsed = botResponse.metrics.tokensUsed;
    }
    
    logger.info(`Respuesta del bot para session ${sessionId}: "${responseText.substring(0, 100)}..." (${tokensUsed} tokens)`);
    

    // Siempre llamar al procesamiento con SupaDB
    const finalResponse = await processMessage(
      text,
      userId,
      tenantId,
      true, // skipBuiltinResponse
      sessionId,
      useTemplateId || botId,
      undefined, // templateConfig
      responseText, // Pasar la respuesta como prevResponse
      tokensUsed
    );

    // Calcular tiempo de procesamiento
    processingTime = Date.now() - startTime;

    // Registrar respuesta del bot en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      await logMessage({
        tenant_id: tenantId,
        bot_id: useTemplateId || botId,
        user_id: userId,
        session_id: sessionId,
        content: finalResponse.text,
        content_type: "text",
        role: "bot",
        processed: true,
        audio_url: "",
        transcription: null,
        sender_type: "bot",
        template_id: useTemplateId,
      });
    }

    // Incrementar contador de uso (si está habilitado)
    if (config.supabase.enabled && config.features.usageTracking) {
      try {
        await incrementUsage(tenantId);
      } catch (error) {
        logger.error(`Error al incrementar uso para tenant ${tenantId}:`, error);
        // No fallar la petición por esto
      }
    }

    // Devolver respuesta al cliente, incluyendo salesStageId si está disponible
    const response = {
      success: true,
      data: {
        message: finalResponse.text,
        metadata: {
          processingTime,
          templateId: useTemplateId,
          sessionId,
          ...(tokensUsed > 0 && { tokensUsed }),
          ...(buttons.length > 0 && { buttons }),
          ...(media.length > 0 && { media }),
          // Incluir salesStageId del contexto si está disponible (desde botResponse)
          ...(salesStageId && { salesStageId }),
          // También chequear en finalResponse por si acaso
          ...((finalResponse as any).metadata?.currentLeadStage && { salesStageId: (finalResponse as any).metadata.currentLeadStage }),
          ...((finalResponse as any).metadata?.salesStageId && { salesStageId: (finalResponse as any).metadata.salesStageId }),
          ...((finalResponse as any).context?.currentLeadStage && { salesStageId: (finalResponse as any).context.currentLeadStage }),
          ...((finalResponse as any).currentLeadStage && { salesStageId: (finalResponse as any).currentLeadStage })
        },
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    logger.error("Error en handleChatRequest:", error);
    
    // Calcular tiempo de procesamiento incluso en caso de error
    const processingTime = Date.now() - (req as any).startTime || 0;
    
    return res.status(500).json({
      error: "Error interno del servidor",
      message: config.debug ? (error as Error).message : undefined,
      metadata: {
        processingTime,
      },
    });
  }
}

export default { handleTextChat, handleTextChatNoAuth, handleIntegratedChat };