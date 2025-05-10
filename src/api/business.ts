/**
 * src/api/business.ts
 *
 * API para gestionar información de negocio como horarios, 
 * excepciones y configuración relacionada.
 * @version 1.0.0
 * @created 2025-07-05
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { authMiddleware } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";
import logger from "../utils/logger";

// Cliente de Supabase
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey || config.supabase.anonKey
);

const router = express.Router();

// Middleware de autenticación
router.use(authMiddleware);

/**
 * GET /api/business/hours
 * Obtiene horarios regulares y excepciones del negocio
 */
router.get("/hours", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenant_id = req.user.tenantId;
    const location_id = req.query.location_id ? String(req.query.location_id) : null;
    const include_exceptions = req.query.include_exceptions === "true";

    logger.info(`Obteniendo horarios para tenant: ${tenant_id}, location: ${location_id || 'default'}`);
    
    // Consultar horarios regulares
    const { data: regularHours, error: regularError } = await supabase
      .from("tenant_business_hours")
      .select("*")
      .eq("tenant_id", tenant_id)
      .is("location_id", location_id);

    if (regularError) {
      logger.error(`Error al obtener horarios regulares: ${regularError.message}`, regularError);
      throw regularError;
    }

    logger.debug(`Encontrados ${regularHours?.length || 0} horarios regulares`);

    // Si se solicitan excepciones, consultarlas
    let exceptions = [];
    if (include_exceptions) {
      const startDate = req.query.start_date ? String(req.query.start_date) : undefined;
      const endDate = req.query.end_date ? String(req.query.end_date) : undefined;

      let query = supabase
        .from("tenant_business_hours_exceptions")
        .select("*")
        .eq("tenant_id", tenant_id)
        .is("location_id", location_id);

      if (startDate) {
        query = query.gte("exception_date", startDate);
      }

      if (endDate) {
        query = query.lte("exception_date", endDate);
      }

      const { data: exceptionsData, error: exceptionsError } = await query;

      if (exceptionsError) {
        logger.error(`Error al obtener excepciones: ${exceptionsError.message}`, exceptionsError);
        throw exceptionsError;
      }

      exceptions = exceptionsData || [];
      logger.debug(`Encontradas ${exceptions.length} excepciones`);
    }

    // Devolver datos formateados
    return res.json({
      regular_hours: regularHours || [],
      exceptions: include_exceptions ? exceptions : undefined,
    });
  } catch (error) {
    logger.error("Error en GET /business/hours:", error);
    return res.status(500).json({ 
      error: "Error al obtener horarios de negocio",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export default router;