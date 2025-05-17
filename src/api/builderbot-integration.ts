/**
 * src/api/builderbot-integration.ts
 *
 * API endpoints para la integración con BuilderBot.
 * Maneja el procesamiento de mensajes conversacionales y flujos.
 *
 * @version 1.2.0
 * @updated 2025-05-16
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { TenantAuthRequest } from "../types/auth";
import { authMiddleware } from "../middlewares/auth";
import logger from "../utils/logger";
import { processFlowMessage, registerNewTemplate } from "../services/flowRegistry";
import { loadConversationState, getActiveSessions, finalizeSession } from "../services/stateManager";
import { logAuditAction, AuditActionType } from "../services/auditService";
import { processFinalText } from "../utils/finalReplacer";

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

/**
 * Procesa un mensaje con BuilderBot
 * POST /builderbot/message
 */
router.post("/message", async (req: TenantAuthRequest, res: Response) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { 
      userId,
      sessionId = uuidv4(),
      message,
      templateId
    } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId and message are required',
        correlationId
      });
    }
    
    logger.info(`[${correlationId}] Processing BuilderBot message`, {
      tenantId: req.user!.tenantId,
      userId,
      sessionId,
      messageLength: message.length,
      templateId
    });
    
    // Registrar inicio de acción de auditoría
    const auditId = await logAuditAction({
      tenantId: req.user!.tenantId!,
      userId: req.user!.id,
      actionType: AuditActionType.PROCESS_MESSAGE,
      description: `Processing message with BuilderBot`,
      metadata: {
        correlationId,
        sessionId,
        userId,
        messagePreview: message.substring(0, 50)
      }
    });
    
    // Cargar estado de conversación
    const existingState = await loadConversationState(
      req.user!.tenantId!,
      userId,
      sessionId
    );
    
    let response: any;
    
    try {
      // Procesar mensaje con BuilderBot
      response = await processFlowMessage(
        userId,
        message,
        req.user!.tenantId!,
        sessionId,
        templateId,
        existingState ? { initialData: existingState.data } : undefined
      );
      
    } catch (flowError) {
      logger.error(`[${correlationId}] Flow processing error`, flowError);
      throw flowError;
    }
    
    // Procesar texto final con reemplazos (si aplica)
    if (response && response.answer) {
      const processedAnswers = [];
      for (const answer of response.answer) {
        if (answer.body) {
          const processedText = await processFinalText(
            answer.body,
            req.user!.tenantId!,
            userId,
            sessionId
          );
          processedAnswers.push({ ...answer, body: processedText });
        } else {
          processedAnswers.push(answer);
        }
      }
      response.answer = processedAnswers;
    }
    
    // Registrar fin exitoso
    await logAuditAction({
      tenantId: req.user!.tenantId!,
      userId: req.user!.id,
      actionType: AuditActionType.PROCESS_MESSAGE_SUCCESS,
      description: `Message processed successfully`,
      metadata: {
        correlationId,
        sessionId,
        responseType: response ? 'success' : 'empty',
        processingTime: Date.now() - startTime,
        parentActionId: auditId
      }
    });
    
    logger.info(`[${correlationId}] Message processed successfully`, {
      processingTime: Date.now() - startTime,
      responsePresent: !!response
    });
    
    return res.status(200).json({
      success: true,
      correlationId,
      sessionId,
      response,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    logger.error(`[${correlationId}] Error processing BuilderBot message`, error);
    
    // Registrar error en auditoría
    await logAuditAction({
      tenantId: req.user!.tenantId!,
      userId: req.user!.id,
      actionType: AuditActionType.PROCESS_MESSAGE_ERROR,
      description: 'Error processing message',
      metadata: {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: Date.now() - startTime
      }
    });
    
    return res.status(500).json({
      error: 'Processing error',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * Obtener sesiones activas del usuario
 * GET /builderbot/sessions/:userId
 */
router.get("/sessions/:userId", async (req: TenantAuthRequest, res: Response) => {
  const correlationId = uuidv4();
  
  try {
    const { userId } = req.params;
    
    logger.info(`[${correlationId}] Getting active sessions`, {
      tenantId: req.user!.tenantId,
      userId
    });
    
    const sessions = await getActiveSessions(
      req.user!.tenantId!,
      userId
    );
    
    return res.status(200).json({
      success: true,
      correlationId,
      userId,
      sessions,
      count: sessions.length
    });
    
  } catch (error) {
    logger.error(`[${correlationId}] Error getting sessions`, error);
    
    return res.status(500).json({
      error: 'Session retrieval error',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
});

/**
 * Finalizar una sesión de conversación
 * POST /builderbot/sessions/:sessionId/finalize
 */
router.post("/sessions/:sessionId/finalize", async (req: TenantAuthRequest, res: Response) => {
  const correlationId = uuidv4();
  
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required',
        correlationId
      });
    }
    
    logger.info(`[${correlationId}] Finalizing session`, {
      tenantId: req.user!.tenantId,
      sessionId,
      userId
    });
    
    await finalizeSession(
      req.user!.tenantId!,
      userId,
      sessionId
    );
    
    // Registrar acción de auditoría
    await logAuditAction({
      tenantId: req.user!.tenantId!,
      userId: req.user!.id,
      actionType: AuditActionType.SESSION_FINALIZED,
      description: 'Conversation session finalized',
      metadata: {
        correlationId,
        sessionId,
        userId
      }
    });
    
    return res.status(200).json({
      success: true,
      correlationId,
      sessionId,
      message: 'Session finalized successfully'
    });
    
  } catch (error) {
    logger.error(`[${correlationId}] Error finalizing session`, error);
    
    return res.status(500).json({
      error: 'Session finalization error',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
});

/**
 * Registrar una nueva plantilla de flujo
 * POST /builderbot/templates/register
 */
router.post("/templates/register", async (req: TenantAuthRequest, res: Response) => {
  const correlationId = uuidv4();
  
  try {
    const { templateId, flow } = req.body;
    
    if (!templateId || !flow) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'templateId and flow are required',
        correlationId
      });
    }
    
    logger.info(`[${correlationId}] Registering new template`, {
      tenantId: req.user!.tenantId,
      templateId
    });
    
    // Registrar la plantilla
    registerNewTemplate(templateId, flow);
    
    // Registrar acción de auditoría
    await logAuditAction({
      tenantId: req.user!.tenantId!,
      userId: req.user!.id,
      actionType: AuditActionType.TEMPLATE_REGISTERED,
      description: 'New flow template registered',
      metadata: {
        correlationId,
        templateId,
        flowType: typeof flow
      }
    });
    
    return res.status(200).json({
      success: true,
      correlationId,
      templateId,
      message: 'Template registered successfully'
    });
    
  } catch (error) {
    logger.error(`[${correlationId}] Error registering template`, error);
    
    return res.status(500).json({
      error: 'Template registration error',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId
    });
  }
});

export default router;