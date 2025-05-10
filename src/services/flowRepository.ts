/**
 * src/services/flowRepository.ts
 *
 * Repositorio para acceso a datos de flujos.
 * Gestiona la comunicación con la base de datos para los flujos.
 * @version 1.1.0
 * @updated 2025-04-28
 */

import {
  Flow,
  FlowNode,
  RuntimeFlow,
  FlowCreateData,
  FlowUpdateData,
} from "../models/flow.types";
import { getSupabaseClient } from "./supabase";
import { config } from "../config"; // Asumiendo que config se usa aquí
import logger from "../utils/logger";

/**
 * Obtiene un flujo de la base de datos por su ID
 * @param flowId ID del flujo a obtener
 * @returns Flujo encontrado o null si no existe
 */
export async function getFlowById(flowId: string): Promise<Flow | null> {
  try {
    const supabase = getSupabaseClient();

    // Consultamos el flujo
    const { data: flow, error } = await supabase
      .from("flows")
      .select("*") // Seleccionar todas las columnas de flows
      .eq("id", flowId)
      .single();

    if (error || !flow) {
      // PGRST116: No rows found - No es un error crítico si se espera que no exista
      if (error && error.code !== "PGRST116") {
        logger.error(`Error al obtener flujo ${flowId}:`, error);
      } else {
        logger.debug(`Flujo ${flowId} no encontrado.`);
      }
      return null;
    }

    // Consultamos los nodos del flujo
    const { data: nodesData, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", flowId);

    if (nodesError) {
      logger.error(`Error al obtener nodos para flujo ${flowId}:`, nodesError);
      // Devolver el flujo sin nodos si fallan los nodos? O null? Depende del caso de uso.
      // Por ahora, devolvemos null si los nodos fallan.
      return null;
    }

    // Convertimos los nodos a un objeto indexado por ID
    const nodesMap: Record<string, FlowNode> = {};
    (nodesData || []).forEach((node) => {
      nodesMap[node.id] = {
        id: node.id,
        type: node.type,
        content: node.content,
        metadata: node.metadata,
        next: node.next, // 'next' puede necesitar procesamiento si es complejo
        x: node.x,
        y: node.y,
        // Asegurarse que FlowNode incluya todos los campos necesarios
      };
    });

    // Construimos el objeto de flujo completo
    // Mapear nombres de columna snake_case a camelCase si es necesario por la interfaz Flow
    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      version: flow.version,
      nodes: nodesMap,
      entryNodeId: flow.entry_node_id, // Mapear a camelCase
      tenantId: flow.tenant_id, // Mapear a camelCase
      isActive: flow.is_active, // Mapear a camelCase
      createdAt: new Date(flow.created_at), // Convertir a Date
      updatedAt: new Date(flow.updated_at), // Convertir a Date
      tags: flow.tags,
      category: flow.category,
      author: flow.author,
      parentTemplateId: flow.parent_template_id, // Mapear a camelCase
      editPermission: flow.edit_permission, // Mapear a camelCase
    };
  } catch (error) {
    logger.error(`Excepción al obtener flujo ${flowId}:`, error);
    return null;
  }
}

/**
 * Elimina un flujo y todos sus nodos
 * @param flowId ID del flujo a eliminar
 * @returns true si la eliminación fue exitosa
 */
export async function deleteFlow(flowId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Borramos primero los nodos (por claves foráneas)
    // No es necesario si la FK tiene ON DELETE CASCADE
    const { error: nodesError } = await supabase
      .from("flow_nodes")
      .delete()
      .eq("flow_id", flowId);

    if (nodesError) {
      logger.error(`Error al eliminar nodos del flujo ${flowId}:`, nodesError);
      // Considerar si continuar o retornar false. Continuamos para intentar borrar el flujo.
    }

    // Borramos el flujo
    const { error, count } = await supabase
      .from("flows")
      .delete()
      .eq("id", flowId);

    if (error) {
      logger.error(`Error al eliminar flujo ${flowId}:`, error);
      return false;
    }
    if (count === 0) {
      logger.warn(`Flujo ${flowId} no encontrado para eliminar.`);
      // Considerar si esto es un éxito o no. Por ahora, true si no hubo error.
    }

    logger.info(`Flujo ${flowId} y/o sus nodos eliminados correctamente`);
    return true;
  } catch (error) {
    logger.error(`Excepción al eliminar flujo ${flowId}:`, error);
    return false;
  }
}

/**
 * Activa un flujo y desactiva los demás para un tenant
 * @param flowId ID del flujo a activar
 * @param tenantId ID del tenant propietario (puede ser null para 'default')
 * @returns true si la activación fue exitosa
 */
export async function activateFlow(
  flowId: string,
  tenantId: string | null // Permitir null para tenant 'default'
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Primero desactivamos todos los flujos del tenant
    let deactivateQuery = supabase.from("flows").update({ is_active: false });
    if (tenantId === null) {
      deactivateQuery = deactivateQuery.is("tenant_id", null);
    } else {
      deactivateQuery = deactivateQuery.eq("tenant_id", tenantId);
    }
    const { error: deactivateError } = await deactivateQuery;

    if (deactivateError) {
      logger.error(
        `Error al desactivar flujos para tenant ${tenantId ?? "default"}:`,
        deactivateError
      );
      return false;
    }

    // Activamos el flujo solicitado
    const { error, count } = await supabase
      .from("flows")
      .update({ is_active: true })
      .eq("id", flowId);
    // Podríamos añadir .eq("tenant_id", tenantId) si queremos doble verificación

    if (error) {
      logger.error(`Error al activar flujo ${flowId}:`, error);
      return false;
    }
    if (count === 0) {
      logger.warn(`Flujo ${flowId} no encontrado para activar.`);
      return false; // No se activó nada
    }

    logger.info(
      `Flujo ${flowId} activado correctamente para tenant ${
        tenantId ?? "default"
      }`
    );
    return true;
  } catch (error) {
    logger.error(`Excepción al activar flujo ${flowId}:`, error);
    return false;
  }
}

/**
 * Consulta los flujos de un tenant
 * @param tenantId ID del tenant (puede ser null para 'default')
 * @returns Lista de flujos encontrados
 */
export async function getFlowsByTenant(
  tenantId: string | null
): Promise<Flow[]> {
  try {
    const supabase = getSupabaseClient();

    let query = supabase.from("flows").select("*"); // Seleccionar todas las columnas de flows
    if (tenantId === null) {
      query = query.is("tenant_id", null);
    } else {
      query = query.eq("tenant_id", tenantId);
    }
    const { data: flowsData, error } = await query.order("updated_at", {
      ascending: false,
    });

    if (error) {
      logger.error(
        `Error al obtener flujos para tenant ${tenantId ?? "default"}:`,
        error
      );
      return [];
    }

    if (!flowsData || flowsData.length === 0) {
      return [];
    }

    // Para cada flujo, cargamos sus nodos
    const result: Flow[] = [];
    const flowIds = flowsData.map((f) => f.id);

    const { data: allNodesData, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("*")
      .in("flow_id", flowIds);

    if (nodesError) {
      logger.error(
        `Error al obtener nodos para flujos del tenant ${
          tenantId ?? "default"
        }:`,
        nodesError
      );
      // Devolver flujos sin nodos en caso de error?
      // Por ahora, continuamos y los flujos no tendrán nodos.
    }

    const nodesByFlowId: Record<string, FlowNode[]> = {};
    (allNodesData || []).forEach((node) => {
      if (!nodesByFlowId[node.flow_id]) {
        nodesByFlowId[node.flow_id] = [];
      }
      nodesByFlowId[node.flow_id].push({
        id: node.id,
        type: node.type,
        content: node.content,
        metadata: node.metadata,
        next: node.next,
        x: node.x,
        y: node.y,
      });
    });

    for (const flow of flowsData) {
      const nodesMap: Record<string, FlowNode> = {};
      (nodesByFlowId[flow.id] || []).forEach((node) => {
        nodesMap[node.id] = node;
      });

      result.push({
        id: flow.id,
        name: flow.name,
        description: flow.description,
        version: flow.version,
        nodes: nodesMap,
        entryNodeId: flow.entry_node_id,
        tenantId: flow.tenant_id,
        isActive: flow.is_active,
        createdAt: new Date(flow.created_at),
        updatedAt: new Date(flow.updated_at),
        tags: flow.tags,
        category: flow.category,
        author: flow.author,
        parentTemplateId: flow.parent_template_id,
        editPermission: flow.edit_permission,
      });
    }

    return result;
  } catch (error) {
    logger.error(
      `Excepción al obtener flujos para tenant ${tenantId ?? "default"}:`,
      error
    );
    return [];
  }
}

/**
 * Actualiza un flujo existente y sus nodos.
 * @param flowId ID del flujo a actualizar
 * @param flowData Datos a actualizar en la tabla 'flows'
 * @param nodesToUpdate Nodos a actualizar/insertar en 'flow_nodes'
 * @returns true si la actualización fue exitosa
 */
export async function updateFlow(
  flowId: string,
  flowData: FlowUpdateData, // Usar FlowUpdateData que es Partial<Flow>
  nodesToUpdate?: Record<string, Partial<FlowNode>> // Nodos son opcionales
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // 1. Actualizar datos del flujo en la tabla 'flows'
    const updateFlowPayload: any = {
      updated_at: new Date().toISOString(),
    };
    // Mapear camelCase a snake_case para la DB
    if (flowData.name !== undefined) updateFlowPayload.name = flowData.name;
    if (flowData.description !== undefined)
      updateFlowPayload.description = flowData.description;
    if (flowData.version !== undefined)
      updateFlowPayload.version = flowData.version;
    if (flowData.entryNodeId !== undefined)
      updateFlowPayload.entry_node_id = flowData.entryNodeId;
    if (flowData.isActive !== undefined)
      updateFlowPayload.is_active = flowData.isActive;
    if (flowData.tags !== undefined) updateFlowPayload.tags = flowData.tags;
    if (flowData.category !== undefined)
      updateFlowPayload.category = flowData.category;
    if (flowData.author !== undefined)
      updateFlowPayload.author = flowData.author;
    if (flowData.editPermission !== undefined)
      updateFlowPayload.edit_permission = flowData.editPermission;
    // No actualizar tenant_id ni parent_template_id

    if (Object.keys(updateFlowPayload).length > 1) {
      // >1 porque siempre incluye updated_at
      const { error: flowUpdateError } = await supabase
        .from("flows")
        .update(updateFlowPayload)
        .eq("id", flowId);

      if (flowUpdateError) {
        logger.error(`Error al actualizar flujo ${flowId}:`, flowUpdateError);
        return false;
      }
    }

    // 2. Actualizar/Insertar nodos en 'flow_nodes'
    if (nodesToUpdate && Object.keys(nodesToUpdate).length > 0) {
      const upsertPayload = Object.entries(nodesToUpdate).map(
        ([nodeId, nodeData]) => ({
          id: nodeId, // ID del nodo
          flow_id: flowId, // ID del flujo
          // Incluir solo los campos que se quieren actualizar/insertar
          ...(nodeData.type && { type: nodeData.type }),
          ...(nodeData.content && { content: nodeData.content }),
          ...(nodeData.metadata && { metadata: nodeData.metadata }),
          ...(nodeData.next && { next: nodeData.next }),
          ...(nodeData.x && { x: nodeData.x }),
          ...(nodeData.y && { y: nodeData.y }),
        })
      );

      const { error: nodesUpsertError } = await supabase
        .from("flow_nodes")
        .upsert(upsertPayload, { onConflict: "id, flow_id" }); // Upsert basado en la clave primaria compuesta

      if (nodesUpsertError) {
        logger.error(
          `Error al hacer upsert de nodos para flujo ${flowId}:`,
          nodesUpsertError
        );
        // Considerar si revertir la actualización del flujo si los nodos fallan
        return false;
      }
    }

    logger.info(`Flujo ${flowId} actualizado correctamente`);
    return true;
  } catch (error) {
    logger.error(`Excepción al actualizar flujo ${flowId}:`, error);
    return false;
  }
}

/**
 * Convierte un flujo completo a su versión de runtime (simplificado)
 * @param flow Flujo completo
 * @returns Flujo en formato runtime
 */
export function transformToRuntimeFlow(
  flow: Flow
): RuntimeFlow & { toJson: () => any } {
  const runtimeFlow = {
    id: flow.id,
    name: flow.name,
    version: flow.version,
    nodes: flow.nodes,
    entryNodeId: flow.entryNodeId,
    tenantId: flow.tenantId,
    // Añadimos el método toJson esperado por @builderbot/bot
    toJson: function () {
      return {
        id: this.id,
        name: this.name,
        nodes: this.nodes,
        entryNodeId: this.entryNodeId,
      };
    },
  };
  return runtimeFlow;
}

/**
 * Crea un nuevo flujo y sus nodos en la base de datos.
 * @param flowData Datos del flujo a crear (sin nodos)
 * @param nodes Nodos del flujo a crear
 * @returns ID del flujo creado o null si falla
 */
export async function createFlow(
  flowData: FlowCreateData,
  nodes: Record<string, FlowNode> // Aceptar nodos como segundo argumento
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();

    // 1. Crear el registro en la tabla de flujos
    // Mapear camelCase a snake_case para la inserción si es necesario por FlowCreateData vs tabla
    const flowInsertPayload = {
      name: flowData.name,
      description: flowData.description,
      version: flowData.version,
      entry_node_id: flowData.entryNodeId, // Usar camelCase de FlowCreateData
      tenant_id: flowData.tenantId, // Usar camelCase de FlowCreateData
      is_active: flowData.isActive, // Usar camelCase de FlowCreateData
      tags: flowData.tags,
      category: flowData.category,
      author: flowData.author,
      parent_template_id: flowData.parentTemplateId, // Usar camelCase de FlowCreateData
      edit_permission: flowData.editPermission, // Usar camelCase de FlowCreateData
      // created_at y updated_at se manejan por defecto en la DB
    };

    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .insert(flowInsertPayload)
      .select("id")
      .single();

    if (flowError || !flow) {
      logger.error("Error al crear registro de flujo:", flowError);
      return null;
    }

    const flowId = flow.id;

    // 2. Preparar los nodos para insertar en flow_nodes
    const nodesToInsert = Object.values(nodes).map((node) => ({
      id: node.id, // ID del nodo
      flow_id: flowId, // Asociar con el flujo recién creado
      type: node.type,
      content: node.content,
      metadata: node.metadata,
      next: node.next, // Asegurarse que el formato sea compatible con la DB (JSONB?)
      x: node.x,
      y: node.y,
    }));

    // 3. Insertar los nodos
    if (nodesToInsert.length > 0) {
      const { error: nodesError } = await supabase
        .from("flow_nodes")
        .insert(nodesToInsert);

      if (nodesError) {
        logger.error(
          `Error al crear nodos para el flujo ${flowId}:`,
          nodesError
        );
        // Si falla la inserción de nodos, eliminamos el flujo creado para consistencia
        logger.warn(
          `Intentando eliminar flujo ${flowId} debido a error al crear nodos.`
        );
        await supabase.from("flows").delete().eq("id", flowId);
        return null; // Retornar null porque la creación completa falló
      }
    } else {
      logger.warn(`Flujo ${flowId} creado sin nodos.`);
    }

    logger.info(
      `Flujo ${flowId} creado correctamente con ${nodesToInsert.length} nodos.`
    );
    return flowId; // Devolver el ID del flujo creado
  } catch (error) {
    logger.error("Excepción al crear flujo:", error);
    return null;
  }
}

/**
 * Obtiene el flujo activo para un tenant específico
 * @param tenantId ID del tenant (puede ser null para 'default')
 * @returns Flujo activo o null si no hay
 */
export async function getActiveTenantFlow(
  tenantId: string | null
): Promise<Flow | null> {
  try {
    const supabase = getSupabaseClient();

    logger.info(
      `Buscando flujo activo usando tenant_id: ${tenantId ?? "NULL"}`
    );

    // Consultamos el flujo activo para este tenant
    let query = supabase.from("flows").select("*").eq("is_active", true);

    if (tenantId === null) {
      query = query.is("tenant_id", null);
    } else {
      // Asegurarse que tenantId sea un UUID válido si no es null
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          tenantId
        )
      ) {
        logger.error(
          `getActiveTenantFlow: tenantId '${tenantId}' no es un UUID válido.`
        );
        return null;
      }
      query = query.eq("tenant_id", tenantId);
    }

    const { data: flowData, error } = await query
      .order("updated_at", { ascending: false }) // Si hay varios activos, tomar el más reciente?
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        logger.info(
          `No se encontró flujo activo para tenant ${tenantId ?? "default"}`
        );
        return null;
      }
      logger.error(
        `Error al obtener flujo activo para tenant ${tenantId ?? "default"}:`,
        error
      );
      return null;
    }

    if (!flowData) {
      // Doble check por si single() devuelve null sin error
      logger.info(
        `No se encontró flujo activo para tenant ${
          tenantId ?? "default"
        } (data null).`
      );
      return null;
    }

    // Consultamos los nodos del flujo encontrado
    const { data: nodesData, error: nodesError } = await supabase
      .from("flow_nodes")
      .select("*")
      .eq("flow_id", flowData.id);

    if (nodesError) {
      logger.error(
        `Error al obtener nodos para flujo activo ${flowData.id}:`,
        nodesError
      );
      return null; // No devolver flujo si no se pueden cargar los nodos
    }

    const nodesMap: Record<string, FlowNode> = {};
    (nodesData || []).forEach((node) => {
      nodesMap[node.id] = {
        id: node.id,
        type: node.type,
        content: node.content,
        metadata: node.metadata,
        next: node.next,
        x: node.x,
        y: node.y,
      };
    });

    // Construir y devolver el objeto Flow completo
    return {
      id: flowData.id,
      name: flowData.name,
      description: flowData.description,
      version: flowData.version,
      nodes: nodesMap,
      entryNodeId: flowData.entry_node_id, // Mapear a camelCase
      tenantId: flowData.tenant_id, // Mapear a camelCase
      isActive: flowData.is_active, // Mapear a camelCase
      createdAt: new Date(flowData.created_at), // Convertir a Date
      updatedAt: new Date(flowData.updated_at), // Convertir a Date
      tags: flowData.tags,
      category: flowData.category,
      author: flowData.author,
      parentTemplateId: flowData.parent_template_id, // Mapear a camelCase
      editPermission: flowData.edit_permission, // Mapear a camelCase
    };
  } catch (error) {
    logger.error(
      `Excepción al obtener flujo activo para tenant ${tenantId ?? "default"}:`,
      error
    );
    return null;
  }
}

// Añadir aquí cualquier otra función de repositorio necesaria...
// Por ejemplo, una función para actualizar solo nodos:
/**
 * Actualiza nodos específicos de un flujo.
 * @param flowId ID del flujo
 * @param nodesToUpdate Objeto con los nodos a actualizar/insertar (parcial)
 * @returns true si fue exitoso
 */
export async function updateFlowNodes(
  flowId: string,
  nodesToUpdate: Record<string, Partial<FlowNode>>
): Promise<boolean> {
  try {
    if (Object.keys(nodesToUpdate).length === 0) {
      logger.debug(
        `updateFlowNodes: No hay nodos para actualizar en flujo ${flowId}`
      );
      return true; // No hay nada que hacer, éxito.
    }
    const supabase = getSupabaseClient();

    const upsertPayload = Object.entries(nodesToUpdate).map(
      ([nodeId, nodeData]) => ({
        id: nodeId,
        flow_id: flowId,
        ...(nodeData.type && { type: nodeData.type }),
        ...(nodeData.content && { content: nodeData.content }),
        ...(nodeData.metadata && { metadata: nodeData.metadata }),
        ...(nodeData.next && { next: nodeData.next }),
        ...(nodeData.x && { x: nodeData.x }),
        ...(nodeData.y && { y: nodeData.y }),
      })
    );

    const { error: nodesUpsertError } = await supabase
      .from("flow_nodes")
      .upsert(upsertPayload, { onConflict: "id, flow_id" });

    if (nodesUpsertError) {
      logger.error(
        `Error al hacer upsert de nodos para flujo ${flowId} en updateFlowNodes:`,
        nodesUpsertError
      );
      return false;
    }
    logger.info(`Nodos actualizados correctamente para flujo ${flowId}`);
    return true;
  } catch (error) {
    logger.error(`Excepción en updateFlowNodes para flujo ${flowId}:`, error);
    return false;
  }
}
