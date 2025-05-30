import { Router } from "express";
import { FlowRegistry } from "../services/flowRegistry";
import logger from "../utils/logger";

const router = Router();

// Limpiar caché de flujos
router.post("/clear-cache", async (req, res) => {
  try {
    FlowRegistry.clearCache();
    logger.info("Caché de flujos limpiado via API");
    res.json({ success: true, message: "Caché limpiado" });
  } catch (error) {
    logger.error("Error al limpiar caché:", error);
    res.status(500).json({ success: false, error: "Error al limpiar caché" });
  }
});

// Limpiar caché específico para un template
router.post("/clear-template/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const { tenantId } = req.body;
    
    // Limpiar caché específico
    FlowRegistry.clearCache();
    
    logger.info(`Caché limpiado para template ${templateId} y tenant ${tenantId || 'default'}`);
    res.json({ 
      success: true, 
      message: `Caché limpiado para template ${templateId}`,
      templateId,
      tenantId: tenantId || 'default'
    });
  } catch (error) {
    logger.error("Error al limpiar caché específico:", error);
    res.status(500).json({ success: false, error: "Error al limpiar caché específico" });
  }
});

export default router;