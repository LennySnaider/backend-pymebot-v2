/**
 * src/api/builderbot-integration.ts
 * 
 * Punto de integración entre el sistema y BuilderBot.
 * Proporciona rutas para procesar mensajes, gestionar plantillas
 * y conectar con el servicio de flujos.
 * 
 * @version 1.0.0
 * @created 2025-05-10
 */

import { Router } from "express";
import { AuthRequest, authMiddleware } from "../middlewares/auth";
import { config } from "../config";
import logger from "../utils/logger";
import { processFlowMessage, registerTemplateAsFlow } from "../services/flowRegistry";
import { loadConversationState, getActiveSessions, finalizeSession } from "../services/stateManager";
import { logAuditAction, AuditActionType } from "../services/auditService";

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

/**
 * Procesa un mensaje con BuilderBot
 * POST /builderbot/message
 */
router.post("/message", async (req: AuthRequest, res) => {
  try {
    const { message, sessionId, templateId } = req.body;
    const userId = req.user?.id || "unknown";
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    // Validamos parámetros
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Se requiere un mensaje",
      });
    }
    
    // Generamos un sessionId si no se proporciona
    const chatSessionId = sessionId || `session-${userId}-${Date.now()}`;
    
    // Procesamos el mensaje con el flujo adecuado
    const { response, state, metrics } = await processFlowMessage(
      message,
      userId,
      chatSessionId,
      tenantId,
      templateId
    );
    
    // Registramos la actividad
    await logAuditAction({
      action: AuditActionType.CHAT_MESSAGE,
      userId,
      tenantId,
      resourceId: templateId || state.flow_id || "unknown",
      resourceType: "flow",
      details: {
        sessionId: chatSessionId,
        messageLength: message.length,
        responseLength: response.length,
        tokensUsed: metrics?.tokensUsed || 0
      }
    }).catch(err => logger.error("Error al registrar actividad de chat:", err));
    
    return res.json({
      success: true,
      message: message,
      response: response,
      sessionId: chatSessionId,
      state: {
        currentNodeId: state.last_node_id,
        flowId: state.flow_id,
        context: {
          // Incluimos solo variables relevantes para el frontend
          nombre_usuario: state.nombre_usuario,
          email_usuario: state.email_usuario,
          telefono_usuario: state.telefono_usuario,
          compra_renta: state.compra_renta,
          tipo_propiedad: state.tipo_propiedad,
          presupuesto: state.presupuesto,
          confirma_cita: state.confirma_cita,
          fecha_cita: state.fecha_cita,
          hora_cita: state.hora_cita
        }
      },
      metrics: metrics
    });
  } catch (error) {
    logger.error("Error al procesar mensaje con BuilderBot:", error);
    return res.status(500).json({
      success: false,
      error: "Error al procesar mensaje",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Registra una plantilla como flujo de BuilderBot
 * POST /builderbot/register-template
 */
router.post("/register-template", async (req: AuthRequest, res) => {
  try {
    const { templateId, templateData } = req.body;
    const userId = req.user?.id || "unknown";
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    // Validamos parámetros
    if (!templateId || !templateData) {
      return res.status(400).json({
        success: false,
        error: "Se requiere ID de plantilla y datos de plantilla",
      });
    }
    
    // Registramos la plantilla como flujo
    const success = registerTemplateAsFlow(templateId, templateData);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al registrar plantilla como flujo",
      });
    }
    
    // Registramos la actividad
    await logAuditAction({
      action: AuditActionType.TEMPLATE_REGISTERED,
      userId,
      tenantId,
      resourceId: templateId,
      resourceType: "template",
      details: {
        templateName: templateData.name || "Unknown Template"
      }
    }).catch(err => logger.error("Error al registrar actividad de registro de plantilla:", err));
    
    return res.json({
      success: true,
      templateId,
      message: "Plantilla registrada correctamente como flujo",
    });
  } catch (error) {
    logger.error("Error al registrar plantilla como flujo:", error);
    return res.status(500).json({
      success: false,
      error: "Error al registrar plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Obtiene sesiones activas para un tenant
 * GET /builderbot/sessions
 */
router.get("/sessions", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    // Obtenemos las sesiones activas
    const sessions = await getActiveSessions(tenantId);
    
    // Simplificamos los datos para la respuesta
    const simplifiedSessions = sessions.map(session => ({
      sessionId: session.session_id,
      userId: session.user_id,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      flowId: session.state_data?.flow_id || "unknown",
      lastNodeId: session.state_data?.last_node_id || "unknown",
      userData: {
        nombre: session.state_data?.nombre_usuario,
        email: session.state_data?.email_usuario,
        telefono: session.state_data?.telefono_usuario
      }
    }));
    
    return res.json({
      success: true,
      sessions: simplifiedSessions,
    });
  } catch (error) {
    logger.error("Error al obtener sesiones:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener sesiones",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Recupera el estado de una sesión específica
 * GET /builderbot/sessions/:sessionId
 */
router.get("/sessions/:sessionId", async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.query.userId as string;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    // Validamos parámetros
    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Se requiere sessionId y userId",
      });
    }
    
    // Cargamos el estado de la sesión
    const state = await loadConversationState(tenantId, userId, sessionId);
    
    if (!state) {
      return res.status(404).json({
        success: false,
        error: "Sesión no encontrada",
      });
    }
    
    // Simplificamos el estado para la respuesta
    const simplifiedState = {
      flowId: state.flow_id || "unknown",
      lastNodeId: state.last_node_id || "unknown",
      conversationStatus: state.conversation_status || "unknown",
      startedAt: state.started_at,
      lastUpdatedAt: state.last_updated_at,
      userData: {
        nombre: state.nombre_usuario,
        email: state.email_usuario,
        telefono: state.telefono_usuario
      },
      leadData: {
        compraRenta: state.compra_renta,
        tipoPropiedad: state.tipo_propiedad,
        presupuesto: state.presupuesto,
        leadStatus: state.lead_status
      },
      appointmentData: {
        confirma_cita: state.confirma_cita,
        fecha_cita: state.fecha_cita,
        hora_cita: state.hora_cita,
        appointment_scheduled: state.appointment_scheduled
      }
    };
    
    return res.json({
      success: true,
      sessionId,
      state: simplifiedState,
    });
  } catch (error) {
    logger.error(`Error al obtener estado de sesión ${req.params.sessionId}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener estado de sesión",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Finaliza una sesión
 * POST /builderbot/sessions/:sessionId/end
 */
router.post("/sessions/:sessionId/end", async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    // Validamos parámetros
    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "Se requiere sessionId y userId",
      });
    }
    
    // Finalizamos la sesión
    const success = await finalizeSession(tenantId, userId, sessionId);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al finalizar sesión",
      });
    }
    
    // Registramos la actividad
    await logAuditAction({
      action: AuditActionType.CHAT_ENDED,
      userId: req.user?.id || "unknown",
      tenantId,
      resourceId: sessionId,
      resourceType: "session",
      details: {
        chatUserId: userId
      }
    }).catch(err => logger.error("Error al registrar finalización de chat:", err));
    
    return res.json({
      success: true,
      message: "Sesión finalizada correctamente",
    });
  } catch (error) {
    logger.error(`Error al finalizar sesión ${req.params.sessionId}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al finalizar sesión",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;