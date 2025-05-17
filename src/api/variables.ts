/**
 * src/api/variables.ts
 *
 * API para gestión de variables del sistema y sincronización de datos entre tablas
 * Permite sincronizar manualmente información entre tenants y tenant_variables
 *
 * @version 1.0.0
 * @created 2025-05-14
 */

import { Router } from "express";
import { AuthRequest, authMiddleware } from "../middlewares/auth";
import logger from "../utils/logger";
import { syncTenantToVariables, syncAllTenants } from "../services/variableSyncService";

const router = Router();

// Aplicar middleware de autenticación
router.use(authMiddleware);

/**
 * Endpoint para sincronizar manualmente variables para un tenant específico
 * POST /api/variables/sync/:tenantId
 */
router.post("/sync/:tenantId", async (req: AuthRequest, res) => {
  try {
    const { tenantId } = req.params;
    
    // Verificar permisos (solo permitir admins o superadmin)
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: "No tienes permisos para sincronizar variables"
      });
    }
    
    logger.info(`Solicitud de sincronización manual para tenant ${tenantId}`);
    
    // Ejecutar sincronización
    const success = await syncTenantToVariables(tenantId);
    
    return res.json({
      success,
      message: success ? 
        "Variables sincronizadas correctamente" : 
        "Error al sincronizar variables"
    });
  } catch (error) {
    logger.error(`Error en sincronización manual de variables:`, error);
    return res.status(500).json({
      success: false,
      error: "Error interno al sincronizar variables"
    });
  }
});

/**
 * Endpoint para sincronizar manualmente variables para todos los tenants
 * POST /api/variables/sync-all
 */
router.post("/sync-all", async (req: AuthRequest, res) => {
  try {
    // Verificar permisos (solo permitir superadmin)
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: "Solo superadmins pueden sincronizar todos los tenants"
      });
    }
    
    logger.info(`Solicitud de sincronización masiva de variables para todos los tenants`);
    
    // Ejecutar sincronización masiva
    const syncCount = await syncAllTenants();
    
    return res.json({
      success: true,
      count: syncCount,
      message: `Variables sincronizadas para ${syncCount} tenants`
    });
  } catch (error) {
    logger.error(`Error en sincronización masiva de variables:`, error);
    return res.status(500).json({
      success: false,
      error: "Error interno al sincronizar variables"
    });
  }
});

export default router;