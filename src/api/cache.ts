/**
 * API endpoint para gestión de caché
 */
import { Router } from "express";
import { AuthRequest, authMiddleware } from "../middlewares/auth";
import { clearTemplateCache } from "../services/supabase";
import logger from "../utils/logger";

const router = Router();

// Aplicar middleware de autenticación
router.use(authMiddleware);

/**
 * Limpia el caché de plantillas
 * POST /api/cache/clear-templates
 */
router.post("/clear-templates", async (req: AuthRequest, res) => {
  try {
    logger.info(`Limpiando caché de plantillas por solicitud de usuario ${req.user?.id}`);
    
    // Limpiar el caché
    clearTemplateCache();
    
    return res.json({
      success: true,
      message: "Caché de plantillas limpiado correctamente"
    });
  } catch (error) {
    logger.error("Error al limpiar caché de plantillas:", error);
    return res.status(500).json({
      success: false,
      error: "Error al limpiar caché",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export default router;