/**
 * src/services/templateService.ts
 *
 * Servicio para gestionar plantillas de flujos y modificaciones limitadas para tenants.
 * Proporciona funciones para crear, instanciar y modificar plantillas de flujos.
 * @version 1.1.2
 * @updated 2025-04-27
 */

import {
  Flow, // Usado internamente?
  FlowNode,
  FlowTemplate,
  TenantFlowUpdateData, // Usado en updateFlowLimited
  EditPermission,
  NodeType,
  FlowCreateData, // Importar tipo para creación
} from "../models/flow.types";
import {
  getSupabaseClient,
  getTemplateById,
  ChatbotTemplateBase,
} from "./supabase"; // Importar ChatbotTemplateBase y getTemplateById
import { FlowService } from "./flowService";
import { validateFlow } from "./flowValidator";
import { logAuditAction, AuditActionType } from "./auditService";
import logger from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

// Flujos máximos por tenant
const MAX_TENANT_FLOWS = 5;

/**
 * Clase para gestionar plantillas de flujos y modificaciones de tenants
 */
export class TemplateService {
  private flowService: FlowService;

  constructor() {
    this.flowService = new FlowService();
  }

  /**
   * Verifica si un string es un UUID válido
   * @param str String a verificar
   * @returns true si es un UUID válido
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Obtiene todas las plantillas disponibles
   * @returns Lista de plantillas disponibles
   */
  async getTemplates(): Promise<FlowTemplate[]> {
    try {
      const supabase = getSupabaseClient();

      const { data: templates, error } = await supabase
        .from("flow_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        logger.error(`Error al obtener plantillas: ${error.message}`);
        return [];
      }

      return templates.map((template) => ({
        ...template,
        createdAt: new Date(template.created_at),
        updatedAt: new Date(template.updated_at),
      }));
    } catch (error) {
      logger.error("Error al obtener plantillas:", error);
      return [];
    }
  }

  /**
   * Obtiene una plantilla específica por su ID
   * @param templateId ID de la plantilla
   * @returns Plantilla encontrada o null si no existe
   */
  async getTemplateById(templateId: string): Promise<FlowTemplate | null> {
    try {
      logger.info(`Cargando plantilla con ID: ${templateId}`);
      const supabase = getSupabaseClient();

      // Primero intentamos buscar en flow_templates (tabla principal)
      let { data: template, error } = await supabase
        .from("flow_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      // Si no encontramos en la tabla principal, intentamos en chatbot_templates
      if (error || !template) {
        const { data: chatbotTemplate, error: chatbotError } = await supabase
          .from("chatbot_templates")
          .select("*")
          .eq("id", templateId)
          .single();

        if (chatbotError || !chatbotTemplate) {
          logger.error(
            `Error al obtener plantilla ${templateId}: ${
              error?.message || chatbotError?.message || "No encontrada"
            }`
          );
          return null;
        }

        template = chatbotTemplate;
      }

      // Logging para depuración
      logger.info(`Plantilla ${templateId} encontrada. Comenzando procesamiento`);

      // Verificamos si la plantilla tiene react_flow_json
      if (template.react_flow_json) {
        logger.info(`Plantilla ${templateId} tiene react_flow_json`);

        // Verificamos si podemos parsear react_flow_json si es string
        if (typeof template.react_flow_json === 'string') {
          try {
            const flowData = JSON.parse(template.react_flow_json);
            logger.info(`react_flow_json parseado como JSON. Tiene ${flowData.nodes?.length || 0} nodos y ${flowData.edges?.length || 0} conexiones`);
          } catch (parseError) {
            logger.error(`Error al parsear react_flow_json como JSON: ${parseError}`);
          }
        } else {
          logger.info(`react_flow_json ya es un objeto. Tiene ${template.react_flow_json.nodes?.length || 0} nodos y ${template.react_flow_json.edges?.length || 0} conexiones`);
        }
      } else {
        logger.warn(`Plantilla ${templateId} NO tiene react_flow_json`);
      }

      // Procesamos la plantilla para asegurar que tenga la estructura correcta
      return this.processTemplateData(template, templateId);
    } catch (error) {
      logger.error(`Error al obtener plantilla ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Procesa los datos de la plantilla para adaptarlos a la estructura requerida
   * @param template Datos crudos de la plantilla
   * @param templateId ID de la plantilla para logs
   * @returns Plantilla procesada
   */
  private processTemplateData(
    template: any,
    templateId: string
  ): FlowTemplate | null {
    try {
      // Si la plantilla viene del chatbotbuilder, tendrá react_flow_json
      if (template.react_flow_json) {
        // Extraemos los nodos y las conexiones
        const { nodes: reactNodes, edges } = template.react_flow_json;

        // Convertimos los nodos de ReactFlow a nuestro formato
        const nodes: Record<string, FlowNode> = {};

        // Buscamos el nodo de inicio
        let entryNodeId = "";

        for (const node of reactNodes) {
          // Verificamos el tipo de nodo
          if (
            node.type === "startNode" ||
            node.type === "start-node" ||
            node.type === "START"
          ) {
            entryNodeId = node.id;
          }

          // Intentar extraer el contenido del mensaje de múltiples campos posibles
          let nodeContent = "";

          // Primero verificamos campos en node.data directamente
          if (node.data) {
            nodeContent = node.data.message || node.data.prompt || node.data.label ||
                         node.data.content || node.data.text || node.data.value ||
                         node.data.greeting || node.data.response || "";

            // Si no encontramos nada, buscamos en estructuras anidadas comunes
            if (!nodeContent && node.data.data) {
              nodeContent = node.data.data.message || node.data.data.content ||
                           node.data.data.text || node.data.data.value || "";
            }

            // Buscar en campos de configuración específicos
            if (!nodeContent && node.data.configuration) {
              nodeContent = node.data.configuration.message || node.data.configuration.content ||
                           node.data.configuration.text || node.data.configuration.initialMessage || "";
            }

            // Buscar en campos de settings específicos
            if (!nodeContent && node.data.settings) {
              nodeContent = node.data.settings.message || node.data.settings.content ||
                           node.data.settings.text || node.data.settings.initialMessage || "";
            }
          }

          // Si aún no encontramos contenido, buscamos en los campos directos del nodo
          if (!nodeContent) {
            nodeContent = node.message || node.prompt || node.label ||
                         node.content || node.text || node.value || "";
          }

          // Logging para depuración
          if (node.type === "messageNode" || node.type === "message" ||
              node.data?.type === "messageNode" || node.data?.nodeType === "message") {
            logger.debug(`Extrayendo contenido para nodo mensaje ${node.id}: "${nodeContent || "NO ENCONTRADO"}"`);
            if (!nodeContent) {
              logger.debug(`Estructura del nodo mensaje: ${JSON.stringify(node)}`);
            }
          }

          nodes[node.id] = {
            id: node.id,
            type: this.mapNodeType(node.type),
            content: nodeContent,
            metadata: {
              ...node.data,
              x: node.position?.x,
              y: node.position?.y,
            },
            // Conexiones se procesarán después
          };
        }

        // Procesamos las conexiones
        for (const edge of edges) {
          const sourceNode = nodes[edge.source];
          if (sourceNode) {
            if (!sourceNode.next) {
              sourceNode.next = edge.target;
            } else if (Array.isArray(sourceNode.next)) {
              // Si ya es un array, añadimos la nueva conexión
              sourceNode.next.push({
                condition: { type: "contains", value: edge.label || "" },
                nextNodeId: edge.target,
              });
            } else {
              // Si era un string, lo convertimos en array
              const prevNext = sourceNode.next;
              sourceNode.next = [
                {
                  condition: { type: "contains", value: "default" },
                  nextNodeId: prevNext,
                },
                {
                  condition: { type: "contains", value: edge.label || "" },
                  nextNodeId: edge.target,
                },
              ];
            }
          }
        }

        // Si no encontramos un nodo de entrada, usamos el primero
        if (!entryNodeId && reactNodes.length > 0) {
          entryNodeId = reactNodes[0].id;
          logger.warn(
            `Plantilla ${templateId} no tiene nodo de inicio definido, asignando el primero: ${entryNodeId}`
          );
        }

        // Creamos la plantilla con la estructura correcta
        return {
          id: template.id,
          name: template.name,
          description: template.description || "",
          version: template.version || "1.0.0",
          nodes,
          entryNodeId,
          category: template.category || "general",
          tags: template.tags || [],
          author: template.author || "system",
          editableNodes: template.editable_nodes || [],
          createdAt: new Date(template.created_at),
          updatedAt: new Date(template.updated_at),
        };
      }

      // Si no es del chatbotbuilder, procesamos la estructura estándar
      // Aseguramos que entryNodeId esté definido
      if (!template.entry_node_id && template.nodes) {
        // Si no hay entryNodeId definido, tomamos el primer nodo como entrada
        const nodeIds = Object.keys(template.nodes);
        if (nodeIds.length > 0) {
          template.entry_node_id = nodeIds[0];
          logger.warn(
            `Plantilla ${templateId} no tiene nodo de entrada definido, se asignó automáticamente: ${template.entry_node_id}`
          );
        }
      }

      return {
        ...template,
        entryNodeId: template.entry_node_id, // Aseguramos que esto esté mapeado correctamente
        editableNodes: template.editable_nodes || [],
        createdAt: new Date(template.created_at),
        updatedAt: new Date(template.updated_at),
      };
    } catch (error) {
      logger.error(
        `Error al procesar datos de plantilla ${templateId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Mapea los tipos de nodo de ReactFlow a nuestros tipos
   * @param reactFlowType Tipo de nodo en ReactFlow
   * @returns Tipo de nodo para nuestro sistema
   */
  private mapNodeType(reactFlowType: string): string {
    // Mapa de tipos de ReactFlow a nuestros tipos
    const typeMap: Record<string, string> = {
      startNode: NodeType.START,
      "start-node": NodeType.START,
      messageNode: NodeType.MESSAGE,
      "message-node": NodeType.MESSAGE,
      aiNode: NodeType.AI_NODE,
      "ai-node": NodeType.AI_NODE,
      aiVoiceAgentNode: NodeType.AI_VOICE_AGENT,
      "ai-voice-agent": NodeType.AI_VOICE_AGENT,
      ai_voice_agent: NodeType.AI_VOICE_AGENT,
      AgenteVozIA: NodeType.AI_VOICE_AGENT,
      conditionNode: NodeType.CONDITION,
      "condition-node": NodeType.CONDITION,
      inputNode: NodeType.INPUT,
      "input-node": NodeType.INPUT,
      ttsNode: NodeType.TEXT_TO_SPEECH,
      "tts-node": NodeType.TEXT_TO_SPEECH,
      sttNode: NodeType.SPEECH_TO_TEXT,
      "stt-node": NodeType.SPEECH_TO_TEXT,
      endNode: NodeType.END,
      "end-node": NodeType.END,
    };

    return typeMap[reactFlowType] || reactFlowType;
  }

  /**
   * Convierte un flujo existente en una plantilla
   * @param flowId ID del flujo a convertir
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario (debe ser super_admin)
   * @param editableNodes IDs de nodos que los tenants pueden editar
   * @returns ID de la plantilla creada o null si falla
   */
  async convertFlowToTemplate(
    flowId: string,
    userId: string = "system",
    userRole: string = "super_admin",
    editableNodes: string[] = []
  ): Promise<string | null> {
    try {
      // Obtenemos el flujo a convertir
      const flow = await this.flowService.getFlowById(flowId);

      if (!flow) {
        logger.error(
          `Flujo ${flowId} no encontrado para convertir a plantilla`
        );
        return null;
      }

      // Verificamos que sea el super_admin quien realiza la operación
      if (userRole !== "super_admin") {
        logger.error(
          `Usuario ${userId} con rol ${userRole} intentó convertir flujo a plantilla sin permiso`
        );
        return null;
      }

      // Creamos el registro de plantilla
      const supabase = getSupabaseClient();

      // Aseguramos que los nodos editables existen en el flujo
      const validEditableNodes = editableNodes.filter(
        (nodeId) => flow.nodes[nodeId]
      );

      const { data: template, error } = await supabase
        .from("flow_templates")
        .insert({
          name: flow.name,
          description: flow.description,
          version: flow.version,
          nodes: flow.nodes,
          entry_node_id: flow.entryNodeId,
          category: flow.category,
          tags: flow.tags,
          author: flow.author || userRole,
          editable_nodes: validEditableNodes,
          // Aseguramos que is_active se establezca correctamente al crear
          is_active: false, // Por defecto, las plantillas nuevas no están activas
        })
        .select("id")
        .single();

      if (error || !template) {
        logger.error(
          `Error al crear plantilla: ${error?.message || "Error desconocido"}`
        );
        return null;
      }

      // Registrar acción de auditoría
      await logAuditAction({
        action: AuditActionType.CONVERT_FLOW_TO_TEMPLATE,
        userId,
        tenantId: flow.tenantId,
        resourceId: template.id,
        resourceType: "template",
        resourceName: flow.name,
        details: {
          flowId,
          editableNodes: validEditableNodes,
          nodeCount: Object.keys(flow.nodes).length,
        },
        role: userRole,
      });

      logger.info(`Flujo ${flowId} convertido a plantilla ${template.id}`);
      return template.id;
    } catch (error) {
      logger.error(`Error al convertir flujo ${flowId} a plantilla:`, error);
      return null;
    }
  }

  /**
   * Instancia una plantilla para un tenant específico
   * @param templateId ID de la plantilla
   * @param tenantId ID del tenant
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario
   * @param customName Nombre personalizado (opcional)
   * @returns ID del flujo creado o null si falla
   */
  async instantiateTemplate(
    templateId: string,
    tenantId: string,
    userId: string = "system",
    userRole: string = "tenant_user",
    customName?: string
  ): Promise<string | null> {
    try {
      // Verificamos que el tenant sea un UUID válido
      if (tenantId === "default" || !this.isValidUUID(tenantId)) {
        // Generamos un UUID para usar como tenant ID en desarrollo
        const devTenantId = uuidv4();
        logger.warn(
          `Tenant ID '${tenantId}' no válido, usando UUID generado: ${devTenantId}`
        );
        tenantId = devTenantId;
      }

      // Verificamos que el tenant no exceda el límite de flujos
      const tenantFlows = await this.flowService.getFlowsByTenant(tenantId);

      if (tenantFlows.length >= MAX_TENANT_FLOWS) {
        logger.error(
          `El tenant ${tenantId} ha alcanzado el límite de ${MAX_TENANT_FLOWS} flujos`
        );
        return null;
      }

      // Obtenemos la plantilla base (asegúrate que getTemplateById devuelva react_flow_json, version, created_by)
      const template: ChatbotTemplateBase | null = await this.getTemplateById(
        templateId
      ); // Tipar explícitamente

      if (!template || !template.react_flow_json) {
        // Verificar que react_flow_json exista
        logger.error(
          `Plantilla ${templateId} no encontrada o no tiene react_flow_json`
        );
        return null;
      }

      // Extraer nodos y entryNodeId del JSON
      // Asumimos que react_flow_json tiene una estructura como { nodes: {...}, edges: [...], viewport: {...} }
      // y que puede tener un entryNodeId definido o lo inferimos.
      const flowJson = template.react_flow_json as any; // Usar 'as any' o definir un tipo adecuado
      const templateNodes = flowJson?.nodes || {};
      let entryNodeId = flowJson?.entryNodeId; // Intentar obtenerlo del JSON

      // Verificamos que exista un nodo de entrada o lo asignamos/creamos
      if (!entryNodeId || !templateNodes[entryNodeId]) {
        logger.warn(
          `Plantilla ${templateId} no tiene entryNodeId definido en react_flow_json o el nodo no existe.`
        );
        if (Object.keys(templateNodes).length > 0) {
          entryNodeId = Object.keys(templateNodes)[0]; // Asignar el primero como entrada
          logger.warn(
            `Asignando primer nodo como entrada automáticamente: ${entryNodeId}`
          );
        } else {
          // Crear nodo predeterminado si no hay ninguno
          const defaultNodeId = `default-node-${uuidv4().substring(0, 8)}`;
          templateNodes[defaultNodeId] = {
            id: defaultNodeId,
            type: NodeType.MESSAGE, // Asegúrate que NodeType esté definido
            content: "Hola, ¿en qué puedo ayudarte?",
            metadata: { role: "bot" },
          };
          entryNodeId = defaultNodeId;
          logger.warn(
            `Creando nodo predeterminado como entrada: ${defaultNodeId}`
          );
        }
      }

      // Copiamos los nodos (ya no necesitamos marcar editables aquí, eso es de la plantilla)
      const nodesToInsert: Record<string, FlowNode> = {};
      for (const nodeId in templateNodes) {
        // Podríamos añadir validación o transformación si fuera necesario
        nodesToInsert[nodeId] = { ...templateNodes[nodeId] };
      }

      // Creamos un nuevo flujo basado en la plantilla
      // Asegurarse que FlowCreateData esté definido y requiera los campos necesarios
      const flowData: FlowCreateData = {
        name: customName || `${template.name || "Flow"} - Instance`, // Asegurar que name exista
        description: template.description,
        version: template.version?.toString() ?? "1", // Usar versión de plantilla o default '1'
        // nodes: nodesToInsert, // 'nodes' no es una columna en la tabla 'flows', se guardan en 'flow_nodes'
        entry_node_id: entryNodeId, // Columna en 'flows'
        tenant_id: tenantId, // Columna en 'flows'
        is_active: false, // No activamos automáticamente (columna en 'flows')
        tags: [], // Default vacío, 'tags' no viene de la plantilla base
        category: "General", // Default, 'category' no viene de la plantilla base
        author: template.created_by || "system", // Usar created_by o default 'system' (columna en 'flows')
        parent_template_id: templateId, // Referencia a la plantilla original (columna en 'flows')
        edit_permission: EditPermission.CONTENT_ONLY, // Por defecto (columna en 'flows')
        // 'isTemplate' no es una columna en 'flows'
      };

      // Creamos el flujo y sus nodos (asumiendo que createFlow maneja ambas cosas)
      // flowService.createFlow necesita recibir los nodos aparte o manejar la inserción en flow_nodes
      const flowId = await this.flowService.createFlow(flowData, nodesToInsert); // Pasar nodos como argumento separado

      if (!flowId) {
        logger.error(
          `Error al instanciar plantilla ${templateId} para tenant ${tenantId}`
        );
        return null;
      }

      // Registrar acción de auditoría
      await logAuditAction({
        action: AuditActionType.INSTANTIATE_TEMPLATE,
        userId,
        tenantId,
        resourceId: flowId,
        resourceType: "flow",
        resourceName: flowData.name,
        details: {
          templateId,
          templateName: template.name,
          customName: !!customName,
        },
        role: userRole,
      });

      logger.info(
        `Plantilla ${templateId} instanciada como flujo ${flowId} para tenant ${tenantId}`
      );
      return flowId;
    } catch (error) {
      logger.error(`Error al instanciar plantilla ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Establece la plantilla activa
   * @param templateId ID de la plantilla a activar
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario (debe ser super_admin)
   * @returns true si la operación fue exitosa
   */
  setActiveTemplate = async (
    templateId: string,
    userId: string = "system",
    userRole: string = "super_admin"
  ): Promise<boolean> => {
    try {
      // Verificamos que sea el super_admin quien realiza la operación
      if (userRole !== "super_admin") {
        logger.error(
          `Usuario ${userId} con rol ${userRole} intentó establecer plantilla activa sin permiso`
        );
        return false;
      }

      const supabase = getSupabaseClient();

      // Desactivamos todas las plantillas
      const { error: deactivateError } = await supabase
        .from("flow_templates")
        .update({ is_active: false })
        .neq("id", templateId); // No desactivar la que estamos activando

      if (deactivateError) {
        logger.error(
          `Error al desactivar otras plantillas: ${deactivateError.message}`
        );
        // Continuamos de todos modos, intentaremos activar la seleccionada
      }

      // Activamos la plantilla seleccionada
      const { error: activateError } = await supabase
        .from("flow_templates")
        .update({ is_active: true })
        .eq("id", templateId);

      if (activateError) {
        logger.error(
          `Error al activar plantilla ${templateId}: ${activateError.message}`
        );
        return false;
      }

      // Registrar acción de auditoría
      await logAuditAction({
        action: AuditActionType.SET_ACTIVE_TEMPLATE,
        userId,
        tenantId: "system", // Las plantillas no tienen tenant específico
        resourceId: templateId,
        resourceType: "template",
        resourceName: templateId, // No tenemos el nombre aquí, solo el ID
        details: {},
        role: userRole,
      });

      logger.info(`Plantilla ${templateId} establecida como activa`);
      return true;
    } catch (error) {
      logger.error(
        `Error al establecer plantilla ${templateId} como activa:`,
        error
      );
      return false;
    }
  };

  /**
   * Permite a un tenant realizar modificaciones limitadas a un flujo
   * @param flowId ID del flujo a modificar
   * @param tenantId ID del tenant
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario
   * @param updateData Datos a actualizar
   * @returns true si la actualización fue exitosa
   */
  async updateFlowLimited(
    flowId: string,
    tenantId: string,
    userId: string = "system",
    userRole: string = "tenant_user",
    updateData: TenantFlowUpdateData
  ): Promise<boolean> {
    try {
      // Obtenemos el flujo actual
      const flow = await this.flowService.getFlowById(flowId);

      if (!flow) {
        logger.error(`Flujo ${flowId} no encontrado`);
        return false;
      }

      // Verificamos que el flujo pertenezca al tenant
      if (flow.tenantId !== tenantId) {
        logger.error(`El flujo ${flowId} no pertenece al tenant ${tenantId}`);
        return false;
      }

      // Variables para auditoría
      const modifiedNodes: string[] = [];

      // Si se incluyen nodos a actualizar, verificamos que solo se modifiquen nodos editables
      if (updateData.nodes) {
        const updatedNodes: Record<string, FlowNode> = { ...flow.nodes };

        for (const nodeId in updateData.nodes) {
          // Verificamos que el nodo exista y sea editable
          if (!flow.nodes[nodeId]) {
            logger.error(`El nodo ${nodeId} no existe en el flujo ${flowId}`);
            return false;
          }

          if (!flow.nodes[nodeId].isEditable) {
            logger.error(`El nodo ${nodeId} no es editable por el tenant`);
            return false;
          }

          // Solo permitimos actualizar el contenido y ciertos metadatos
          updatedNodes[nodeId] = {
            ...flow.nodes[nodeId],
            content:
              updateData.nodes[nodeId].content || flow.nodes[nodeId].content,
            // Permitimos actualizar solo ciertos campos de metadata (ejemplos)
            metadata: {
              ...flow.nodes[nodeId].metadata,
              ...(updateData.nodes[nodeId].metadata?.role
                ? { role: updateData.nodes[nodeId].metadata.role }
                : {}),
              ...(updateData.nodes[nodeId].metadata?.delay
                ? { delay: updateData.nodes[nodeId].metadata.delay }
                : {}),
            },
          };

          // Registramos el nodo modificado para auditoría
          modifiedNodes.push(nodeId);
        }

        // Actualizamos el flujo con los nodos modificados
        const success = await this.flowService.updateFlow(flowId, {
          name: updateData.name,
          description: updateData.description,
          nodes: updatedNodes,
          isActive: updateData.isActive,
        });

        if (success) {
          // Registrar acción de auditoría
          await logAuditAction({
            action: AuditActionType.UPDATE_FLOW_LIMITED,
            userId,
            tenantId,
            resourceId: flowId,
            resourceType: "flow",
            resourceName: updateData.name || flow.name,
            details: {
              modifiedNodes,
              nameChanged: !!updateData.name,
              descriptionChanged: !!updateData.description,
              activationChanged: updateData.isActive !== undefined,
            },
            role: userRole,
          });
        }

        return success;
      } else {
        // Si no hay nodos para actualizar, actualizamos solo metadatos básicos
        const success = await this.flowService.updateFlow(flowId, {
          name: updateData.name,
          description: updateData.description,
          isActive: updateData.isActive,
        });

        if (success) {
          // Registrar acción de auditoría
          await logAuditAction({
            action: AuditActionType.UPDATE_FLOW_LIMITED,
            userId,
            tenantId,
            resourceId: flowId,
            resourceType: "flow",
            resourceName: updateData.name || flow.name,
            details: {
              nameChanged: !!updateData.name,
              descriptionChanged: !!updateData.description,
              activationChanged: updateData.isActive !== undefined,
            },
            role: userRole,
          });
        }

        return success;
      }
    } catch (error) {
      logger.error(
        `Error al actualizar flujo ${flowId} de forma limitada:`,
        error
      );
      return false;
    }
  }

  /**
   * Elimina una plantilla (solo super_admin)
   * @param templateId ID de la plantilla
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario (debe ser super_admin)
   * @returns true si la eliminación fue exitosa
   */
  async deleteTemplate(
    templateId: string,
    userId: string = "system",
    userRole: string = "super_admin"
  ): Promise<boolean> {
    try {
      // Verificamos que sea el super_admin quien realiza la operación
      if (userRole !== "super_admin") {
        logger.error(
          `Usuario ${userId} con rol ${userRole} intentó eliminar plantilla sin permiso`
        );
        return false;
      }

      const supabase = getSupabaseClient();

      // Primero obtenemos la plantilla para registrar en auditoría
      const { data: template, error: templateError } = await supabase
        .from("flow_templates")
        .select("name")
        .eq("id", templateId)
        .single();

      if (templateError) {
        logger.error(
          `Error al obtener plantilla ${templateId}: ${templateError.message}`
        );
        // Si no se encuentra, consideramos que ya está eliminada o el ID es incorrecto
        return templateError.code === "PGRST116"; // 'PGRST116' = 'Row not found'
      }

      // Verificamos si hay flujos que usan esta plantilla
      const { data: flows, error: checkError } = await supabase
        .from("flows")
        .select("id")
        .eq("parent_template_id", templateId);

      if (checkError) {
        logger.error(
          `Error al verificar flujos asociados a plantilla ${templateId}: ${checkError.message}`
        );
        return false;
      }

      // Si hay flujos que usan esta plantilla, advertimos pero no impedimos la eliminación
      if (flows && flows.length > 0) {
        logger.warn(
          `La plantilla ${templateId} tiene ${flows.length} flujos derivados.`
        );
      }

      // Eliminamos la plantilla
      const { error } = await supabase
        .from("flow_templates")
        .delete()
        .eq("id", templateId);

      if (error) {
        logger.error(
          `Error al eliminar plantilla ${templateId}: ${error.message}`
        );
        return false;
      }

      // Registrar acción de auditoría
      await logAuditAction({
        action: AuditActionType.DELETE_TEMPLATE,
        userId,
        tenantId: "system", // Las plantillas no tienen tenant específico
        resourceId: templateId,
        resourceType: "template",
        resourceName: template?.name || "Unknown",
        details: {
          derivedFlows: flows?.length || 0,
        },
        role: userRole,
      });

      logger.info(`Plantilla ${templateId} eliminada correctamente`);
      return true;
    } catch (error) {
      logger.error(`Error al eliminar plantilla ${templateId}:`, error);
      return false;
    }
  }

  /**
   * Establece el estado "enabled" (is_active) de una plantilla
   * @param templateId ID de la plantilla a actualizar
   * @param isEnabled Nuevo estado "enabled" de la plantilla
   * @param userId ID del usuario que realiza la acción
   * @param userRole Rol del usuario (debe ser super_admin)
   * @returns true si la operación fue exitosa
   */
  setTemplateEnabled = async (
    templateId: string,
    isEnabled: boolean,
    userId: string = "system",
    userRole: string = "super_admin"
  ): Promise<boolean> => {
    try {
      // Verificamos que sea el super_admin quien realiza la operación
      if (userRole !== "super_admin") {
        logger.error(
          `Usuario ${userId} con rol ${userRole} intentó establecer el estado "enabled" de la plantilla sin permiso`
        );
        return false;
      }

      const supabase = getSupabaseClient();

      // Actualizamos el estado "is_active" de la plantilla
      const { error } = await supabase
        .from("flow_templates")
        .update({ is_active: isEnabled })
        .eq("id", templateId);

      if (error) {
        logger.error(
          `Error al establecer el estado "enabled" de la plantilla ${templateId}: ${error.message}`
        );
        return false;
      }

      // Registrar acción de auditoría
      await logAuditAction({
        action: AuditActionType.SET_TEMPLATE_ENABLED,
        userId,
        tenantId: "system", // Las plantillas no tienen tenant específico
        resourceId: templateId,
        resourceType: "template",
        resourceName: templateId, // No tenemos el nombre aquí, solo el ID
        details: {
          isEnabled,
        },
        role: userRole,
      });

      logger.info(
        `Estado "enabled" de la plantilla ${templateId} establecido correctamente a ${isEnabled}`
      );
      return true;
    } catch (error) {
      logger.error(
        `Error al establecer el estado "enabled" de la plantilla ${templateId}:`,
        error
      );
      return false;
    }
  };
}
