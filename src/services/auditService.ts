/**
 * src/services/auditService.ts
 *
 * Servicio para registrar acciones de auditoría.
 * Permite rastrear las acciones del super_admin y los tenants para fines de seguridad y depuración.
 * @version 1.0.0
 * @updated 2025-04-25
 */

import { getSupabaseClient } from "./supabase";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Tipos de acciones que pueden ser auditadas
 */
export enum AuditActionType {
  // Acciones de super_admin
  CREATE_TEMPLATE = "create_template",
  UPDATE_TEMPLATE = "update_template",
  DELETE_TEMPLATE = "delete_template",
  CONVERT_FLOW_TO_TEMPLATE = "convert_flow_to_template",

  // Acciones de tenant
  INSTANTIATE_TEMPLATE = "instantiate_template",
  UPDATE_FLOW_LIMITED = "update_flow_limited",
  ACTIVATE_FLOW = "activate_flow",
  DELETE_FLOW = "delete_flow",

  // Acciones comunes
  CREATE_FLOW = "create_flow",
  UPDATE_FLOW = "update_flow",
  TEST_FLOW = "test_flow",
  TEST_TEMPLATE = "test_template",
}

/**
 * Datos de una acción de auditoría
 */
export interface AuditData {
  action: AuditActionType;
  userId: string;
  tenantId: string;
  resourceId?: string; // ID del flujo o plantilla
  resourceType?: "flow" | "template";
  resourceName?: string; // Nombre del flujo o plantilla
  details?: Record<string, any>; // Detalles adicionales
  role?: string; // Rol del usuario
}

/**
 * Registra una acción de auditoría
 * @param data Datos de la acción
 * @returns true si se registró correctamente
 */
export async function logAuditAction(data: AuditData): Promise<boolean> {
  try {
    // Si Supabase no está habilitado, solo registramos en el log
    if (!config.supabase.enabled) {
      logger.info(
        `[AUDIT] ${data.action} por ${data.userId} (${
          data.role || "unknown"
        }) en tenant ${data.tenantId}${
          data.resourceId
            ? ` - Recurso: ${data.resourceType}/${data.resourceId}`
            : ""
        }`
      );
      return true;
    }

    const supabase = getSupabaseClient();

    // Verificamos si existe la tabla de auditoría
    const { error: tableCheckError } = await supabase
      .from("audit_logs")
      .select("id")
      .limit(1);

    // Si la tabla no existe, creamos un log normal y retornamos
    if (tableCheckError && tableCheckError.code === "PGRST116") {
      logger.warn(
        "Tabla audit_logs no encontrada. Se recomienda crearla para un seguimiento completo."
      );
      logger.info(
        `[AUDIT] ${data.action} por ${data.userId} (${
          data.role || "unknown"
        }) en tenant ${data.tenantId}${
          data.resourceId
            ? ` - Recurso: ${data.resourceType}/${data.resourceId}`
            : ""
        }`
      );
      return true;
    }

    // Insertamos el registro de auditoría
    const { error } = await supabase.from("audit_logs").insert({
      action_type: data.action,
      user_id: data.userId,
      // Manejar el caso del tenant 'default' insertando NULL en lugar de la cadena
      tenant_id: data.tenantId === "default" ? null : data.tenantId,
      resource_id: data.resourceId,
      resource_type: data.resourceType,
      resource_name: data.resourceName,
      details: data.details,
      user_role: data.role,
      ip_address: "N/A", // En una implementación real, se pasaría la IP
      user_agent: "N/A", // En una implementación real, se pasaría el user agent
    });

    if (error) {
      logger.error("Error al registrar acción de auditoría:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error al registrar acción de auditoría:", error);
    return false;
  }
}

/**
 * Consulta acciones de auditoría con filtros
 * @param filters Filtros para la consulta
 * @returns Lista de acciones de auditoría
 */
export async function queryAuditLogs(filters: {
  userId?: string;
  tenantId?: string;
  actionType?: AuditActionType;
  resourceId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): Promise<any[]> {
  try {
    // Si Supabase no está habilitado, retornamos array vacío
    if (!config.supabase.enabled) {
      return [];
    }

    const supabase = getSupabaseClient();

    // Construimos la consulta base
    let query = supabase.from("audit_logs").select("*");

    // Aplicamos filtros
    if (filters.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters.tenantId) {
      query = query.eq("tenant_id", filters.tenantId);
    }

    if (filters.actionType) {
      query = query.eq("action_type", filters.actionType);
    }

    if (filters.resourceId) {
      query = query.eq("resource_id", filters.resourceId);
    }

    if (filters.fromDate) {
      query = query.gte("created_at", filters.fromDate.toISOString());
    }

    if (filters.toDate) {
      query = query.lte("created_at", filters.toDate.toISOString());
    }

    // Ordenamos por fecha descendente y aplicamos límite
    query = query
      .order("created_at", { ascending: false })
      .limit(filters.limit || 100);

    // Ejecutamos la consulta
    const { data, error } = await query;

    if (error) {
      logger.error("Error al consultar logs de auditoría:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error("Error al consultar logs de auditoría:", error);
    return [];
  }
}

/**
 * Crea la tabla de auditoría si no existe
 * Solo debe llamarse durante la configuración inicial
 */
export async function createAuditTable(): Promise<boolean> {
  try {
    // Si Supabase no está habilitado, retornamos false
    if (!config.supabase.enabled) {
      return false;
    }

    const supabase = getSupabaseClient();

    // Verificamos si la tabla ya existe
    const { error: tableCheckError } = await supabase
      .from("audit_logs")
      .select("id")
      .limit(1);

    // Si la tabla ya existe, retornamos true
    if (!tableCheckError) {
      logger.info("Tabla audit_logs ya existe");
      return true;
    }

    // Ejecutamos la creación de la tabla mediante RPC
    // Nota: Esto requiere tener una función RPC configurada en Supabase
    const { error } = await supabase.rpc("create_audit_table");

    if (error) {
      logger.error("Error al crear tabla de auditoría:", error);
      return false;
    }

    logger.info("Tabla audit_logs creada correctamente");
    return true;
  } catch (error) {
    logger.error("Error al crear tabla de auditoría:", error);
    return false;
  }
}
