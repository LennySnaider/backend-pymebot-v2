/**
 * src/api/flows.ts
 *
 * API para la gestión de flujos conversacionales.
 * Proporciona endpoints para crear, consultar, actualizar y eliminar flujos.
 * Diferentes permisos para super_admin y tenants.
 * @version 1.2.1
 * @updated 2025-04-27
 */

import { Router } from "express";
import { FlowService } from "../services/flowService";
import { TemplateService } from "../services/templateService";
import { AuthRequest, authMiddleware, superAdminMiddleware } from "../middlewares/auth";
import { validateFlow } from "../services/flowValidator";
import { logAuditAction, AuditActionType } from "../services/auditService";
import { config } from "../config";
import logger from "../utils/logger";

const router = Router();
const flowService = new FlowService();
const templateService = new TemplateService();

// Todos los endpoints de flujos requieren autenticación
router.use(authMiddleware);

/**
 * Obtiene todos los flujos de un tenant
 * GET /flows
 */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    
    logger.info(`Obteniendo flujos para tenant ${tenantId}`);
    const flows = await flowService.getFlowsByTenant(tenantId);
    
    // Simplificamos la respuesta para no enviar todos los nodos
    const simplifiedFlows = flows.map(flow => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      version: flow.version,
      isActive: flow.isActive,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      nodesCount: Object.keys(flow.nodes).length,
      tags: flow.tags,
      category: flow.category,
      author: flow.author,
      parentTemplateId: flow.parentTemplateId,
    }));
    
    return res.json({
      success: true,
      flows: simplifiedFlows,
    });
  } catch (error) {
    logger.error("Error al obtener flujos:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener flujos",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Obtiene un flujo específico por su ID
 * GET /flows/:id
 */
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const isSuperAdmin = req.user?.role === 'super_admin';
    
    const flow = await flowService.getFlowById(id);
    
    if (!flow) {
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    // Verificamos que el flujo pertenezca al tenant (excepto super_admin)
    if (!isSuperAdmin && flow.tenantId !== tenantId) {
      // En modo desarrollo, mostramos una advertencia pero permitimos el acceso
      if (config.environment === "development") {
        logger.warn(`Usuario con tenant ${tenantId} accediendo a flujo de tenant ${flow.tenantId} en modo desarrollo`);
      } else {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para acceder a este flujo",
        });
      }
    }
    
    return res.json({
      success: true,
      flow,
    });
  } catch (error) {
    logger.error(`Error al obtener flujo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Crea un nuevo flujo (solo super_admin)
 * POST /flows
 */
router.post("/", superAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.body.tenantId || (req.user?.tenantId || config.multitenant.defaultTenant);
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'super_admin';
    const flowData = req.body;
    
    // Aseguramos que el flujo pertenezca al tenant
    flowData.tenantId = tenantId;
    
    // Validamos el flujo
    try {
      validateFlow(flowData);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: "Validación fallida",
        details: validationError instanceof Error ? validationError.message : "Error de validación",
      });
    }
    
    // Extraemos los nodos del flowData
    const { nodes, ...flowDataWithoutNodes } = flowData;
    
    // Creamos el flujo con los datos y nodos separados
    const flowId = await flowService.createFlow(flowDataWithoutNodes, nodes || {});
    
    if (!flowId) {
      return res.status(500).json({
        success: false,
        error: "Error al crear flujo",
      });
    }
    
    // Registrar acción de auditoría
    await logAuditAction({
      action: AuditActionType.CREATE_FLOW,
      userId,
      tenantId,
      resourceId: flowId,
      resourceType: 'flow',
      resourceName: flowData.name,
      details: {
        nodeCount: Object.keys(flowData.nodes).length,
        isActive: flowData.isActive
      },
      role: userRole
    });
    
    // Si se especificó como activo, lo activamos
    if (flowData.isActive) {
      await flowService.activateFlow(flowId);
    }
    
    return res.status(201).json({
      success: true,
      id: flowId,
      message: "Flujo creado correctamente",
    });
  } catch (error) {
    logger.error("Error al crear flujo:", error);
    return res.status(500).json({
      success: false,
      error: "Error al crear flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Actualiza un flujo existente (solo super_admin)
 * PUT /flows/:id
 */
router.put("/:id", superAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'super_admin';
    const flowData = req.body;
    
    // Verificamos que el flujo exista
    const existingFlow = await flowService.getFlowById(id);
    
    if (!existingFlow) {
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    // Actualizamos el flujo
    const success = await flowService.updateFlow(id, flowData);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar flujo",
      });
    }
    
    // Registrar acción de auditoría
    await logAuditAction({
      action: AuditActionType.UPDATE_FLOW,
      userId,
      tenantId: existingFlow.tenantId,
      resourceId: id,
      resourceType: 'flow',
      resourceName: flowData.name || existingFlow.name,
      details: {
        nodeCount: flowData.nodes ? Object.keys(flowData.nodes).length : Object.keys(existingFlow.nodes).length,
        nameChanged: !!flowData.name,
        nodesChanged: !!flowData.nodes,
        activationChanged: flowData.isActive !== undefined
      },
      role: userRole
    });
    
    // Si se especificó como activo, lo activamos
    if (flowData.isActive) {
      await flowService.activateFlow(id);
    }
    
    return res.json({
      success: true,
      message: "Flujo actualizado correctamente",
    });
  } catch (error) {
    logger.error(`Error al actualizar flujo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Actualiza un flujo con modificaciones limitadas (para tenants)
 * PATCH /flows/:id/limited
 */
router.patch("/:id/limited", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'tenant_user';
    const updateData = req.body;
    
    // Verificamos que el flujo exista y pertenezca al tenant
    const existingFlow = await flowService.getFlowById(id);
    
    if (!existingFlow) {
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    if (existingFlow.tenantId !== tenantId && userRole !== 'super_admin') {
      // En modo desarrollo, mostramos una advertencia pero permitimos el acceso
      if (config.environment === "development") {
        logger.warn(`Usuario con tenant ${tenantId} actualizando flujo de tenant ${existingFlow.tenantId} en modo desarrollo`);
      } else {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para modificar este flujo",
        });
      }
    }
    
    // Realizamos las modificaciones limitadas
    const success = await templateService.updateFlowLimited(
      id, 
      existingFlow.tenantId, // Importante: usamos el tenantId original del flujo
      userId,
      userRole,
      updateData
    );
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al actualizar flujo",
      });
    }
    
    // Si se especificó como activo, lo activamos
    if (updateData.isActive) {
      await flowService.activateFlow(id);
    }
    
    return res.json({
      success: true,
      message: "Flujo actualizado correctamente",
    });
  } catch (error) {
    logger.error(`Error al actualizar flujo ${req.params.id} con modificaciones limitadas:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al actualizar flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Elimina un flujo (solo super_admin puede eliminar cualquier flujo,
 * los tenants solo pueden eliminar sus propios flujos)
 * DELETE /flows/:id
 */
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'tenant_user';
    const isSuperAdmin = userRole === 'super_admin';
    
    // Verificamos que el flujo exista
    const existingFlow = await flowService.getFlowById(id);
    
    if (!existingFlow) {
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    // Verificamos permisos
    if (!isSuperAdmin && existingFlow.tenantId !== tenantId) {
      // En modo desarrollo, mostramos una advertencia pero permitimos el acceso
      if (config.environment === "development") {
        logger.warn(`Usuario con tenant ${tenantId} eliminando flujo de tenant ${existingFlow.tenantId} en modo desarrollo`);
      } else {
        return res.status(403).json({
          success: false,
          error: "No tienes permiso para eliminar este flujo",
        });
      }
    }
    
    // No permitimos eliminar flujos activos
    if (existingFlow.isActive) {
      return res.status(400).json({
        success: false,
        error: "No se puede eliminar un flujo activo",
      });
    }
    
    // Eliminamos el flujo
    const success = await flowService.deleteFlow(id);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar flujo",
      });
    }
    
    // Registrar acción de auditoría
    await logAuditAction({
      action: AuditActionType.DELETE_FLOW,
      userId,
      tenantId: existingFlow.tenantId,
      resourceId: id,
      resourceType: 'flow',
      resourceName: existingFlow.name,
      role: userRole
    });
    
    return res.json({
      success: true,
      message: "Flujo eliminado correctamente",
    });
  } catch (error) {
    logger.error(`Error al eliminar flujo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al eliminar flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Activa un flujo (desactivando los demás)
 * POST /flows/:id/activate
 */
router.post("/:id/activate", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'tenant_user';
    const isSuperAdmin = userRole === 'super_admin';
    
    logger.info(`Intentando activar flujo ${id} por usuario ${userId} con rol ${userRole}`);
    
    // Verificamos que el flujo exista
    const existingFlow = await flowService.getFlowById(id);
    
    if (!existingFlow) {
      logger.error(`Flujo ${id} no encontrado para activar`);
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    // Verificamos permisos - solo en producción
    if (!isSuperAdmin && existingFlow.tenantId !== tenantId && config.environment !== "development") {
      logger.error(`Usuario con tenant ${tenantId} intentando activar flujo de tenant ${existingFlow.tenantId}`);
      return res.status(403).json({
        success: false,
        error: "No tienes permiso para activar este flujo",
      });
    }
    
    // En modo desarrollo, permitimos activar cualquier flujo
    if (config.environment === "development" && existingFlow.tenantId !== tenantId) {
      logger.warn(`Usuario con tenant ${tenantId} activando flujo de tenant ${existingFlow.tenantId} en modo desarrollo`);
    }
    
    // Activamos el flujo
    const success = await flowService.activateFlow(id);
    
    if (!success) {
      logger.error(`Error al activar flujo ${id}`);
      return res.status(500).json({
        success: false,
        error: "Error al activar flujo",
      });
    }
    
    // Registrar acción de auditoría
    await logAuditAction({
      action: AuditActionType.ACTIVATE_FLOW,
      userId,
      tenantId: existingFlow.tenantId,
      resourceId: id,
      resourceType: 'flow',
      resourceName: existingFlow.name,
      role: userRole
    });
    
    logger.info(`Flujo ${id} activado correctamente por usuario ${userId}`);
    
    return res.json({
      success: true,
      message: "Flujo activado correctamente",
    });
  } catch (error) {
    logger.error(`Error al activar flujo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al activar flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Prueba un flujo específico con un mensaje sin activarlo
 * POST /flows/:id/test
 */
router.post("/:id/test", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const userId = req.user?.id || 'unknown';
    const userRole = req.user?.role || 'tenant_user';
    const isSuperAdmin = userRole === 'super_admin';
    const { message, state: prevState } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Se requiere un mensaje para probar el flujo",
      });
    }
    
    // Verificamos que el flujo exista
    const existingFlow = await flowService.getFlowById(id);
    
    if (!existingFlow) {
      return res.status(404).json({
        success: false,
        error: "Flujo no encontrado",
      });
    }
    
    // Verificamos permisos
    if (!isSuperAdmin && existingFlow.tenantId !== tenantId && config.environment !== "development") {
      return res.status(403).json({
        success: false,
        error: "No tienes permiso para probar este flujo",
      });
    }
    
    // Convertimos a formato runtime
    const runtimeFlow = {
      id: existingFlow.id,
      name: existingFlow.name,
      version: existingFlow.version,
      nodes: existingFlow.nodes,
      entryNodeId: existingFlow.entryNodeId,
      tenantId: existingFlow.tenantId,
    };
    
    // Reutilizamos la sesión si existe un estado previo, o creamos una nueva
    let sessionId;
    let previousState;
    
    if (prevState) {
      // Si recibimos un estado previo, lo reutilizamos para mantener la conversación
      logger.debug(`Reutilizando estado previo con nodo actual: ${prevState.currentNodeId}`);
      sessionId = prevState.sessionId || `test-session-${Date.now()}`;
      
      // Convertimos el estado previo a formato interno
      previousState = {
        flowId: prevState.flowId || runtimeFlow.id,
        currentNodeId: prevState.currentNodeId,
        context: prevState.context || {},
        history: prevState.history || [],
        startedAt: new Date(prevState.startedAt) || new Date(),
        lastUpdatedAt: new Date(),
        userId,
        sessionId
      };
    } else {
      // Si no hay estado previo, iniciamos una nueva sesión
      logger.debug('Iniciando nueva sesión de prueba');
      sessionId = `test-session-${Date.now()}`;
    }
    
    // Procesamos el mensaje con el estado previo si existe
    const { response, state } = await flowService.processMessage(
      message,
      userId,
      sessionId,
      existingFlow.tenantId,
      previousState, // Pasamos el estado previo o undefined
      runtimeFlow
    );
    
    logger.debug(`Mensaje procesado. Nodo actual: ${state.currentNodeId}`);
    
    // Registrar acción de auditoría
    await logAuditAction({
      action: AuditActionType.TEST_FLOW,
      userId,
      tenantId: existingFlow.tenantId,
      resourceId: id,
      resourceType: 'flow',
      resourceName: existingFlow.name,
      details: {
        message,
        nodeVisited: state.currentNodeId,
        prevNodeId: prevState?.currentNodeId
      },
      role: userRole
    });
    
    return res.json({
      success: true,
      message: message,
      response: response,
      state: {
        flowId: state.flowId,
        currentNodeId: state.currentNodeId,
        history: state.history,
        context: state.context,
        sessionId: state.sessionId,
        startedAt: state.startedAt,
        lastUpdatedAt: state.lastUpdatedAt
      },
    });
  } catch (error) {
    logger.error(`Error al probar flujo ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al probar flujo",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
