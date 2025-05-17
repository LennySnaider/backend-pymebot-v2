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

export default router;