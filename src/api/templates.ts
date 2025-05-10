/**
 * src/api/templates.ts
 *
 * API para la gestión de plantillas de flujos.
 * Proporciona endpoints para crear, consultar y utilizar plantillas.
 * @version 1.2.1
 * @updated 2025-04-27
 */

import { Router } from "express";
import { TemplateService } from "../services/templateService";
import { FlowService } from "../services/flowService";
import {
  AuthRequest,
  authMiddleware,
  superAdminMiddleware,
} from "../middlewares/auth";
import { config } from "../config";
import logger from "../utils/logger";

const router = Router();
const templateService = new TemplateService();
const flowService = new FlowService();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

/**
 * Obtiene las plantillas disponibles para el tenant actual (incluyendo públicas)
 * y el ID del flujo instanciado si existe.
 * GET /templates/tenant
 */
router.get("/tenant", async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    // Llamamos a la nueva función que obtiene plantillas y flowId
    const { getTenantTemplatesWithFlows } = await import(
      "../services/supabase"
    ); // Importar la función
    const templatesWithFlows = await getTenantTemplatesWithFlows(tenantId);

    // Mapeamos para asegurar la estructura esperada por el frontend (ChatTemplate)
    const frontendTemplates = templatesWithFlows.map((t) => ({
      id: t.id, // ID de la plantilla (flow_templates.id)
      name: t.name,
      description: t.description,
      avatarUrl: t.avatar_url || "/img/avatars/thumb-placeholder.jpg", // Usar un placeholder si no hay avatar
      isActive: t.isActive, // Estado activo del flujo instanciado (si existe) o de la plantilla
      isEnabled: true, // Asumir habilitado si se lista (la lógica de habilitación está en otro lado)
      tokenCost: t.tokens_estimated || 500, // Usar estimación o un default
      flowId: t.flowId, // ID del flujo instanciado (flows.id)
    }));

    return res.json({
      success: true,
      templates: frontendTemplates // Devolver la lista mapeada
    });
  } catch (error) {
    logger.error(
      `Error al obtener plantillas para tenant ${req.user?.tenantId}:`,
      error
    );
    return res.status(500).json({
      success: false,
      error: "Error al obtener plantillas del tenant",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Obtiene todas las plantillas disponibles
 * GET /templates
 */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const templates = await templateService.getTemplates();

    // Simplificamos la respuesta para no enviar todos los nodos
    const simplifiedTemplates = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
      category: template.category,
      tags: template.tags,
      author: template.author,
      nodesCount: Object.keys(template.nodes).length,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));

    return res.json({
      success: true,
      templates: simplifiedTemplates,
    });
  } catch (error) {
    logger.error("Error al obtener plantillas:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener plantillas",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Obtiene una plantilla específica por su ID
 * GET /templates/:id
 */
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const template = await templateService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Plantilla no encontrada",
      });
    }

    return res.json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error(`Error al obtener plantilla ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Crea una plantilla a partir de un flujo existente (solo super_admin)
 * POST /templates/from-flow/:flowId
 */
router.post(
  "/from-flow/:flowId",
  superAdminMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { flowId } = req.params;
      const { editableNodes } = req.body;
      const userId = req.user?.id || "unknown";
      const userRole = req.user?.role || "super_admin";

      // Convertimos el flujo a plantilla
      const templateId = await templateService.convertFlowToTemplate(
        flowId,
        userId,
        userRole,
        editableNodes
      );

      if (!templateId) {
        return res.status(500).json({
          success: false,
          error: "Error al crear plantilla",
        });
      }

      return res.status(201).json({
        success: true,
        id: templateId,
        message: "Plantilla creada correctamente",
      });
    } catch (error) {
      logger.error(
        `Error al crear plantilla desde flujo ${req.params.flowId}:`,
        error
      );
      return res.status(500).json({
        success: false,
        error: "Error al crear plantilla",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Establece la plantilla activa
 * POST /templates/set-active
 */
router.post(
  "/set-active",
  superAdminMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { templateId } = req.body;
      const userId = req.user?.id || "unknown";
      const userRole = req.user?.role || "super_admin";

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: "Se requiere el ID de la plantilla",
        });
      }

      // Establecemos la plantilla activa
      const success = await templateService.setActiveTemplate(
        templateId,
        userId,
        userRole
      );

      if (!success) {
        return res.status(500).json({
          success: false,
          error: "Error al establecer la plantilla activa",
        });
      }

      return res.json({
        success: true,
        message: "Plantilla activa establecida correctamente",
      });
    } catch (error) {
      logger.error("Error al establecer la plantilla activa:", error);
      return res.status(500).json({
        success: false,
        error: "Error al establecer la plantilla activa",
        details: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Establece el estado "enabled" de una plantilla
 * POST /templates/set-enabled
 */
router.post(
  "/set-enabled",
  superAdminMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { templateId, isEnabled } = req.body;
      const userId = req.user?.id || "unknown";
      const userRole = req.user?.role || "super_admin";

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: "Se requiere el ID de la plantilla",
        });
      }

      // Establecemos el estado "enabled" de la plantilla
      const success = await templateService.setTemplateEnabled(
        templateId,
        isEnabled,
        userId,
        userRole
      );

      if (!success) {
        return res.status(500).json({
          success: false,
          error:
            "Error al establecer el estado 'enabled' de la plantilla",
        });
      }

      return res.json({
        success: true,
        message:
          "Estado 'enabled' de la plantilla establecido correctamente",
      });
    } catch (error) {
      logger.error(
        "Error al establecer el estado 'enabled' de la plantilla:",
        error
      );
      return res.status(500).json({
        success: false,
        error:
          "Error al establecer el estado 'enabled' de la plantilla",
        details:
          error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Instancia una plantilla para un tenant
 * POST /templates/:id/instantiate
 */
router.post("/:id/instantiate", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { customName } = req.body;
    const tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    const userId = req.user?.id || "unknown";
    const userRole = req.user?.role || "tenant_user";

    // Instanciamos la plantilla
    const flowId = await templateService.instantiateTemplate(
      id,
      tenantId,
      userId,
      userRole,
      customName
    );

    if (!flowId) {
      return res.status(500).json({
        success: false,
        error: "Error al instanciar plantilla",
      });
    }

    return res.status(201).json({
      success: true,
      id: flowId,
      message: "Plantilla instanciada correctamente",
    });
  } catch (error) {
    logger.error(`Error al instanciar plantilla ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al instanciar plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Prueba una plantilla con un mensaje (sin instanciarla)
 * POST /templates/:id/test
 */
router.post("/:id/test", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user?.id || "unknown";
    const userRole = req.user?.role || "tenant_user";

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Se requiere un mensaje para probar la plantilla",
      });
    }

    // Obtenemos la plantilla
    const template = await templateService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: "Plantilla no encontrada",
      });
    }

    // Creamos un flujo runtime temporal para procesar el mensaje
    const runtimeFlow = {
      id: template.id,
      name: template.name,
      version: template.version,
      nodes: template.nodes,
      entryNodeId: template.entryNodeId,
      tenantId: "test",
    };

    // Generamos un ID de sesión de prueba
    const sessionId = `test-session-${Date.now()}`;

    // Procesamos el mensaje
    const { response, state } = await flowService.processMessage(
      message,
      userId,
      sessionId,
      "test",
      undefined,
      runtimeFlow // Pasamos el flujo runtime directamente
    );

    return res.json({
      success: true,
      message: message,
      response: response,
      state: {
        currentNodeId: state.currentNodeId,
        history: state.history,
        context: state.context,
      },
    });
  } catch (error) {
    logger.error(`Error al probar plantilla ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al probar plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Elimina una plantilla (solo super_admin)
 * DELETE /templates/:id
 */
router.delete("/:id", superAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || "unknown";
    const userRole = req.user?.role || "super_admin";

    // Eliminamos la plantilla
    const success = await templateService.deleteTemplate(id, userId, userRole);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: "Error al eliminar plantilla",
      });
    }

    return res.json({
      success: true,
      message: "Plantilla eliminada correctamente",
    });
  } catch (error) {
    logger.error(`Error al eliminar plantilla ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: "Error al eliminar plantilla",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
