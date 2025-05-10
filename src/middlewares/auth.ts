/**
 * src/middlewares/auth.ts
 *
 * Middleware de autenticación con Supabase.
 * Verifica y decodifica JWT para extraer información del usuario y tenant.
 * @version 1.2.0
 * @updated 2025-04-27
 */

import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { createClient } from "@supabase/supabase-js";
import logger from "../utils/logger";

// Cliente de Supabase para verificación de tokens
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey || config.supabase.anonKey
);

/**
 * Interfaz extendida de Request para incluir información de usuario
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId?: string;
    role?: string;
    email?: string;
  };
}

/**
 * Middleware que verifica el token JWT de Supabase
 * y extrae información del usuario y tenant
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verificación especial para token de prueba en desarrollo (añadido automáticamente)
    if (process.env.NODE_ENV !== 'production' && 
        req.headers.authorization?.startsWith('Bearer ey') && 
        req.headers.authorization.includes('.')) {
      // Para propósitos de prueba, aceptamos el token sin verificar la firma
      try {
        const token = req.headers.authorization.split(' ')[1];
        const [_, payloadB64] = token.split('.');
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        
        // Asignar información del usuario desde el payload
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          tenantId: payload.tenant_id
        };
        
        logger.info('Autenticación con token de prueba:', req.user);
        return next();
      } catch (error) {
        logger.error('Error al procesar token de prueba:', error);
      }
    }

    // Si Supabase no está habilitado, continuamos sin autenticación
    if (!config.supabase.enabled) {
      // Usamos valores por defecto o del cuerpo
      req.user = {
        id: req.body.user_id || "anonymous",
        tenantId: req.body.tenant_id || config.multitenant.defaultTenant,
        role: req.body.role || "super_admin", // Otorgamos rol de super_admin en modo no-supabase
      };
      logger.info('Supabase no habilitado, usando usuario predeterminado', req.user);
      return next();
    }

    // Obtenemos el token de autorización
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Si estamos en desarrollo, permitimos solicitudes sin token con super_admin
      if (config.environment === "development") {
        logger.warn("Solicitud sin token de autenticación en modo desarrollo");
        req.user = {
          id: req.body.user_id || "anonymous",
          tenantId: req.body.tenant_id || config.multitenant.defaultTenant,
          role: "super_admin", // En modo desarrollo, asignamos permisos elevados por defecto
        };
        return next();
      }
      
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere token de autenticación",
      });
    }

    // Extraemos el token
    const token = authHeader.split(" ")[1];

    // Verificamos el token con Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.error("Error al verificar token:", error);
      
      // En modo desarrollo, continuamos con un usuario por defecto
      if (config.environment === "development") {
        logger.warn("Token inválido pero continuando en modo desarrollo");
        req.user = {
          id: "anonymous",
          tenantId: config.multitenant.defaultTenant,
          role: "super_admin",
        };
        return next();
      }
      
      return res.status(401).json({
        error: "Token inválido",
        message: error?.message || "No se pudo verificar la autenticación",
      });
    }

    // Decodificamos el token para obtener claims personalizados (como tenant_id)
    const decodedToken = parseJwt(token);

    // Extraemos información importante
    req.user = {
      id: data.user.id,
      email: data.user.email,
      // Intentamos obtener el tenant_id del token o usamos el valor por defecto
      tenantId: decodedToken.tenant_id || 
                req.body.tenant_id || 
                config.multitenant.defaultTenant,
      role: decodedToken.role || "user",
    };

    logger.debug('Usuario autenticado correctamente:', req.user);
    
    // Continuamos con la solicitud
    next();
  } catch (err) {
    logger.error("Error en middleware de autenticación:", err);
    
    // En modo desarrollo, continuamos con un usuario por defecto en caso de error
    if (config.environment === "development") {
      logger.warn("Error de autenticación pero continuando en modo desarrollo");
      req.user = {
        id: "anonymous",
        tenantId: config.multitenant.defaultTenant,
        role: "super_admin",
      };
      return next();
    }
    
    return res.status(500).json({
      error: "Error interno de autenticación",
      message: err instanceof Error ? err.message : "Error desconocido",
    });
  }
};

/**
 * Middleware simplificado que no requiere autenticación pero extrae
 * información de usuario y tenant si está disponible
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Obtenemos el token de autorización si existe
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ") || !config.supabase.enabled) {
      // Usamos valores del cuerpo o por defecto
      req.user = {
        id: req.body.user_id || "anonymous",
        tenantId: req.body.tenant_id || config.multitenant.defaultTenant,
        role: config.environment === "development" ? "super_admin" : "user", // Super admin en desarrollo
      };
      return next();
    }

    // Si hay token, intentamos verificarlo
    const token = authHeader.split(" ")[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      // En caso de error, usamos valores por defecto
      req.user = {
        id: req.body.user_id || "anonymous",
        tenantId: req.body.tenant_id || config.multitenant.defaultTenant,
        role: config.environment === "development" ? "super_admin" : "user", // Super admin en desarrollo
      };
    } else {
      // Si el token es válido, extraemos la información
      const decodedToken = parseJwt(token);
      req.user = {
        id: data.user.id,
        email: data.user.email,
        tenantId: decodedToken.tenant_id || 
                 req.body.tenant_id || 
                 config.multitenant.defaultTenant,
        role: decodedToken.role || "user",
      };
    }

    // Continuamos con la solicitud
    next();
  } catch (err) {
    // En caso de error, usamos valores por defecto
    req.user = {
      id: req.body.user_id || "anonymous",
      tenantId: req.body.tenant_id || config.multitenant.defaultTenant,
      role: config.environment === "development" ? "super_admin" : "user", // Super admin en desarrollo
    };
    next();
  }
};

/**
 * Middleware que verifica si el usuario tiene rol de administrador
 */
export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Verificamos que exista un usuario autenticado
  if (!req.user) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación",
    });
  }

  // Verificamos que el usuario tenga rol de administrador
  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    // En modo desarrollo, permitimos el acceso incluso sin rol adecuado
    if (config.environment === "development") {
      logger.warn(`Usuario sin rol admin/super_admin accediendo a ruta protegida en modo desarrollo: ${req.user.role}`);
      next();
      return;
    }
    
    return res.status(403).json({
      error: "Acceso denegado",
      message: "Se requiere rol de administrador",
    });
  }

  // Si todo está bien, continuamos
  next();
};

/**
 * Middleware que verifica si el usuario tiene rol de super_admin
 */
export const superAdminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Verificamos que exista un usuario autenticado
  if (!req.user) {
    return res.status(401).json({
      error: "No autorizado",
      message: "Se requiere autenticación",
    });
  }

  // Verificamos que el usuario tenga rol de super_admin
  if (req.user.role !== "super_admin") {
    // En modo desarrollo, permitimos el acceso incluso sin rol adecuado
    if (config.environment === "development") {
      logger.warn(`Usuario sin rol super_admin accediendo a ruta protegida en modo desarrollo: ${req.user.role}`);
      next();
      return;
    }
    
    return res.status(403).json({
      error: "Acceso denegado",
      message: "Se requiere rol de super_admin",
    });
  }

  // Si todo está bien, continuamos
  next();
};

/**
 * Función auxiliar para decodificar un token JWT
 * @param token Token JWT a decodificar
 * @returns Payload decodificado del token
 */
function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, "base64")
        .toString()
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch (e) {
    logger.error("Error al decodificar JWT:", e);
    return {};
  }
}
