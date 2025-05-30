/**
 * src/api/properties.ts
 *
 * API para gestionar propiedades inmobiliarias.
 * Proporciona endpoints para listar, filtrar y obtener detalles de propiedades
 * con soporte para múltiples tenants.
 *
 * @version 1.0.0
 * @created 2025-05-20
 */

import express from "express";
import { authMiddleware } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";
import logger from "../utils/logger";
import propertyService from "../services/propertyService";
import { getValidTenantUuid } from "../services/supabase";

const router = express.Router();

// Middleware de autenticación
router.use(authMiddleware);

/**
 * GET /api/properties
 * Obtiene propiedades para el tenant autenticado
 * Query params:
 * - type: filtrar por tipo de propiedad (opcional)
 * - limit: número máximo de resultados (opcional, default: 10)
 * - featured: si es true, devuelve solo propiedades destacadas (opcional)
 */
router.get("/", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenantId = req.user.tenantId;
    const type = req.query.type ? String(req.query.type) : '';
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
    const featured = req.query.featured === "true";

    logger.info(`Obteniendo propiedades para tenant: ${tenantId}, tipo: ${type || 'todos'}, featured: ${featured}`);
    
    let properties;
    if (featured) {
      properties = await propertyService.getFeaturedProperties(tenantId, limit);
    } else {
      properties = await propertyService.getPropertiesByTenant(tenantId, type, limit);
    }
    
    return res.json({
      properties,
      count: properties.length,
      tenant_id: tenantId
    });
  } catch (error) {
    logger.error("Error en GET /properties:", error);
    return res.status(500).json({ 
      error: "Error al obtener propiedades",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

/**
 * GET /api/properties/:id
 * Obtiene detalles de una propiedad específica
 */
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenantId = req.user.tenantId;
    const propertyId = req.params.id;

    logger.info(`Obteniendo propiedad con ID: ${propertyId} para tenant: ${tenantId}`);
    
    const property = await propertyService.getPropertyById(propertyId, tenantId);
    
    if (!property) {
      return res.status(404).json({
        error: "Propiedad no encontrada",
        message: `No se encontró la propiedad con ID ${propertyId}`
      });
    }
    
    return res.json(property);
  } catch (error) {
    logger.error(`Error en GET /properties/${req.params.id}:`, error);
    return res.status(500).json({ 
      error: "Error al obtener propiedad",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

/**
 * GET /api/properties/resolver/:id
 * Resuelve un ID de propiedad a un ID válido, con fallback a propiedades por defecto
 */
router.get("/resolver/:id", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenantId = req.user.tenantId;
    const propertyId = req.params.id;

    logger.info(`Resolviendo ID de propiedad: ${propertyId} para tenant: ${tenantId}`);
    
    const resolvedId = await propertyService.resolvePropertyId(propertyId, tenantId);
    
    return res.json({
      original_id: propertyId,
      resolved_id: resolvedId,
      tenant_id: tenantId
    });
  } catch (error) {
    logger.error(`Error en GET /properties/resolver/${req.params.id}:`, error);
    return res.status(500).json({ 
      error: "Error al resolver ID de propiedad",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

/**
 * GET /api/properties/public/:tenantId
 * Endpoint sin autenticación para acceso público por tenant_id
 * Útil para componentes como el PropertySelector
 */
router.get("/public/:tenantId", async (req, res) => {
  try {
    const rawTenantId = req.params.tenantId;
    const tenantId = getValidTenantUuid(rawTenantId);
    const type = req.query.type ? String(req.query.type) : '';
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
    const featured = req.query.featured === "true";

    logger.info(`Obteniendo propiedades públicas para tenant: ${tenantId}, tipo: ${type || 'todos'}, featured: ${featured}`);
    
    let properties;
    if (featured) {
      properties = await propertyService.getFeaturedProperties(tenantId, limit);
    } else {
      properties = await propertyService.getPropertiesByTenant(tenantId, type, limit);
    }
    
    return res.json({
      properties,
      count: properties.length,
      tenant_id: tenantId
    });
  } catch (error) {
    logger.error(`Error en GET /properties/public/${req.params.tenantId}:`, error);
    return res.status(500).json({ 
      error: "Error al obtener propiedades públicas",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export default router;