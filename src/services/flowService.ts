/**
 * src/services/flowService.ts
 *
 * Servicio para la gestión de flujos conversacionales.
 * Se encarga de coordinar la carga, validación y ejecución de flujos dinámicos.
 * Incluye soporte para plantillas personalizadas y métricas de consumo.
 * @version 1.3.0
 * @updated 2025-04-26
 */

import {
  RuntimeFlow,
  FlowState,
  FlowCreateData,
  FlowUpdateData,
  Flow,
  FlowNode, // Añadir FlowNode
} from "../models/flow.types";
import { validateFlow } from "./flowValidator";
import { processFlowMessage } from "./flowProcessor";
import * as FlowRepository from "./flowRepository";
import logger from "../utils/logger";

// Interfaz para métricas de procesamiento
export interface ProcessingMetrics {
  tokensUsed: number; // Tokens utilizados
  processingTimeMs: number; // Tiempo de procesamiento en ms
  nodesVisited?: number; // Nodos visitados durante el procesamiento
}

/**
 * Clase que gestiona los flujos conversacionales
 */
export class FlowService {
  // Caché de flujos para evitar consultas repetidas
  private flowCache: Map<string, RuntimeFlow> = new Map();

  // TTL para la caché en milisegundos (5 minutos por defecto)
  private cacheTTL: number = 5 * 60 * 1000;

  // Timestamps de cuándo se cargó cada flujo
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    // Iniciamos limpieza periódica de caché
    setInterval(() => this.cleanCache(), this.cacheTTL);
  }

  /**
   * Limpia entradas antiguas de la caché
   */
  private cleanCache(): void {
    const now = Date.now();

    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.cacheTTL) {
        this.flowCache.delete(key);
        this.cacheTimestamps.delete(key);
        logger.debug(`Flujo eliminado de caché: ${key}`);
      }
    }
  }

  /**
   * Limpia toda la caché o una entrada específica
   * @param key Clave específica o null para limpiar todo
   */
  clearCache(key?: string): void {
    if (key) {
      this.flowCache.delete(key);
      this.cacheTimestamps.delete(key);
      logger.debug(`Flujo específico eliminado de caché: ${key}`);
    } else {
      this.flowCache.clear();
      this.cacheTimestamps.clear();
      logger.debug("Caché de flujos completamente limpiada");
    }
  }

  /**
   * Obtiene un flujo de la base de datos por su ID
   * @param flowId ID del flujo a obtener
   * @returns Flujo encontrado o null si no existe
   */
  async getFlowById(flowId: string): Promise<Flow | null> {
    return FlowRepository.getFlowById(flowId);
  }

  /**
   * Obtiene el flujo activo para un tenant específico
   * @param tenantId ID del tenant
   * @returns Flujo activo en formato runtime o null si no hay
   */
  async getFlowByTenant(tenantId: string): Promise<RuntimeFlow | null> {
    try {
      // Verificamos si tenemos el flujo en caché
      const cacheKey = `tenant-${tenantId}`;
      if (this.flowCache.has(cacheKey)) {
        logger.debug(`Flujo encontrado en caché para tenant ${tenantId}`);
        return this.flowCache.get(cacheKey) || null;
      }

      // Obtenemos el flujo activo de la base de datos
      const flow = await FlowRepository.getActiveTenantFlow(tenantId);

      if (!flow) {
        logger.info(`No se encontró flujo activo para tenant ${tenantId}`);
        return null;
      }

      // Convertimos a formato runtime
      const runtimeFlow = FlowRepository.transformToRuntimeFlow(flow);

      // Guardamos en caché
      this.flowCache.set(cacheKey, runtimeFlow);
      this.cacheTimestamps.set(cacheKey, Date.now());

      logger.info(
        `Flujo ${flow.id} (${flow.name}) cargado para tenant ${tenantId}`
      );
      return runtimeFlow;
    } catch (error) {
      logger.error(`Error al obtener flujo para tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Crea un nuevo flujo en la base de datos
   * @param flowData Datos del flujo a crear (sin nodos)
   * @param nodes Nodos del flujo a crear
   * @returns ID del flujo creado o null si falla
   */
  async createFlow(
    flowData: FlowCreateData,
    nodes: Record<string, FlowNode>
  ): Promise<string | null> {
    try {
      // Validamos los datos básicos del flujo (sin nodos aquí)
      // validateFlow(flowData); // La validación podría necesitar los nodos, ajustar si es necesario

      // Creamos el flujo y sus nodos en la base de datos
      const flowId = await FlowRepository.createFlow(flowData, nodes); // Pasar ambos argumentos

      if (flowId) {
        // Invalidamos la caché para este tenant
        const cacheKey = `tenant-${flowData.tenantId}`;
        this.flowCache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }

      return flowId;
    } catch (error) {
      logger.error("Error al crear flujo:", error);
      return null;
    }
  }

  /**
   * Actualiza un flujo existente
   * @param flowId ID del flujo a actualizar
   * @param flowData Datos a actualizar
   * @returns true si la actualización fue exitosa
   */
  async updateFlow(flowId: string, flowData: FlowUpdateData): Promise<boolean> {
    try {
      // Obtenemos primero el flujo completo para validar
      const currentFlow = await this.getFlowById(flowId);
      if (!currentFlow) {
        logger.error(`No se encontró el flujo ${flowId} para actualizar`);
        return false;
      }

      // Creamos una versión completa con los datos actualizados
      const updatedFlow: Flow = {
        ...currentFlow,
        ...flowData,
        nodes: { ...currentFlow.nodes, ...(flowData.nodes || {}) },
      };

      // Validamos el flujo completo
      validateFlow(updatedFlow);

      // Actualizamos el flujo en la base de datos
      const success = await FlowRepository.updateFlow(flowId, flowData);

      if (success) {
        // Invalidamos la caché para este tenant
        const cacheKey = `tenant-${currentFlow.tenantId}`;
        this.flowCache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }

      return success;
    } catch (error) {
      logger.error(`Error al actualizar flujo ${flowId}:`, error);
      return false;
    }
  }

  /**
   * Elimina un flujo y todos sus nodos
   * @param flowId ID del flujo a eliminar
   * @returns true si la eliminación fue exitosa
   */
  async deleteFlow(flowId: string): Promise<boolean> {
    try {
      // Obtenemos primero el flujo para saber su tenant
      const flow = await this.getFlowById(flowId);
      if (!flow) {
        logger.error(`No se encontró el flujo ${flowId} para eliminar`);
        return false;
      }

      // Eliminamos el flujo
      const success = await FlowRepository.deleteFlow(flowId);

      if (success) {
        // Invalidamos la caché para este tenant
        const cacheKey = `tenant-${flow.tenantId}`;
        this.flowCache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }

      return success;
    } catch (error) {
      logger.error(`Error al eliminar flujo ${flowId}:`, error);
      return false;
    }
  }

  /**
   * Activa un flujo y desactiva los demás para un tenant
   * @param flowId ID del flujo a activar
   * @returns true si la activación fue exitosa
   */
  async activateFlow(flowId: string): Promise<boolean> {
    try {
      // Obtenemos el flujo para saber su tenant
      const flow = await this.getFlowById(flowId);
      if (!flow) {
        logger.error(`No se encontró el flujo ${flowId} para activar`);
        return false;
      }

      // Activamos el flujo
      const success = await FlowRepository.activateFlow(flowId, flow.tenantId);

      if (success) {
        // Invalidamos la caché para este tenant
        const cacheKey = `tenant-${flow.tenantId}`;
        this.flowCache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }

      return success;
    } catch (error) {
      logger.error(`Error al activar flujo ${flowId}:`, error);
      return false;
    }
  }

  /**
   * Consulta los flujos de un tenant
   * @param tenantId ID del tenant
   * @returns Lista de flujos encontrados
   */
  async getFlowsByTenant(tenantId: string): Promise<Flow[]> {
    return FlowRepository.getFlowsByTenant(tenantId);
  }

  /**
   * Procesa un mensaje de usuario a través de un flujo
   * @param message Mensaje de usuario
   * @param userId ID del usuario
   * @param sessionId ID de sesión
   * @param tenantId ID del tenant
   * @param prevState Estado previo del flujo (opcional)
   * @param runtimeFlow Flujo en formato runtime para usar directamente (opcional)
   * @param templateConfig Configuración de plantilla (opcional)
   * @returns Respuesta generada, estado actualizado y métricas
   */
  async processMessage(
    message: string,
    userId: string,
    sessionId: string,
    tenantId: string,
    prevState?: FlowState,
    runtimeFlow?: RuntimeFlow,
    templateConfig?: Record<string, any>
  ): Promise<{
    response: string;
    state: FlowState;
    metrics?: ProcessingMetrics;
  }> {
    const startTime = Date.now(); // Mover startTime fuera del try
    try {
      let nodesVisited = 0;
      let tokensUsed = 0;

      // Si se proporciona un flujo runtime directamente, lo usamos
      // Esto es útil para pruebas sin necesidad de guardar el flujo
      const flow = runtimeFlow || (await this.getFlowByTenant(tenantId));

      if (!flow) {
        logger.warn(
          `No hay flujo activo para tenant ${tenantId}, usando respuesta genérica`
        );

        // Creamos un estado básico si no hay uno
        const state = prevState || {
          flowId: "default",
          currentNodeId: "default",
          context: {
            lastUserMessage: message,
            // Incluimos configuración de plantilla si existe
            ...(templateConfig ? { templateConfig } : {}),
          },
          history: [],
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
          userId,
          sessionId,
        };

        // Estimamos tokens usados para la respuesta genérica
        tokensUsed = Math.ceil(message.length / 4) + 20; // 20 tokens fijos para respuesta genérica

        return {
          response:
            "Lo siento, no puedo procesar tu solicitud en este momento.",
          state,
          metrics: {
            tokensUsed,
            processingTimeMs: Date.now() - startTime,
            nodesVisited: 0,
          },
        };
      }

      // Eliminar declaraciones duplicadas
      // let nodesVisited = 0;
      // let tokensUsed = 0;

      // Si tenemos configuración de plantilla, la incluimos en el contexto inicial
      let initialContext = prevState?.context || {};
      if (templateConfig) {
        initialContext = {
          ...initialContext,
          templateConfig,
        };
      }

      // Procesamos el mensaje a través del flujo
      const result = await processFlowMessage(
        flow,
        message,
        userId,
        sessionId,
        prevState ? { ...prevState, context: initialContext } : undefined,
        (nodeId) => {
          // Callback para contar nodos visitados
          nodesVisited++;
          // También podríamos registrar los nodos específicos si es necesario
        }
      );

      // Calculamos tokens usados (basado en longitud si no está disponible)
      // Esta es una aproximación simple, idealmente el flujo debería reportar tokens reales
      tokensUsed =
        result.metrics?.tokensUsed ||
        Math.ceil(message.length / 4) + Math.ceil(result.response.length / 4);

      // Procesamos métricas (si el flujo las proporciona, las usamos)
      const metrics: ProcessingMetrics = {
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
        nodesVisited,
      };

      return {
        response: result.response,
        state: result.state,
        metrics,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("Error al procesar mensaje a través de flujo:", error);

      // Creamos un estado básico si no hay uno
      const state = prevState || {
        flowId: "default",
        currentNodeId: "default",
        context: {
          lastUserMessage: message,
          error: error instanceof Error ? error.message : "Error desconocido",
        },
        history: [],
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
        userId,
        sessionId,
      };

      return {
        response: "Ha ocurrido un error al procesar tu mensaje.",
        state,
        metrics: {
          tokensUsed: 10, // Valor nominal mínimo para errores
          processingTimeMs: processingTime,
          nodesVisited: 0,
        },
      };
    }
  }

  /**
   * Estima los tokens que usaría un mensaje en un flujo específico
   * @param message Mensaje a estimar
   * @param flowId ID del flujo o null para usar flujo activo
   * @param tenantId ID del tenant
   * @returns Estimación de tokens
   */
  async estimateTokens(
    message: string,
    flowId: string | null,
    tenantId: string
  ): Promise<number> {
    try {
      // Si se proporciona flowId, obtenemos ese flujo específico
      let flow: RuntimeFlow | null = null;

      if (flowId) {
        const flowData = await this.getFlowById(flowId);
        if (flowData) {
          flow = FlowRepository.transformToRuntimeFlow(flowData);
        }
      } else {
        // Usamos el flujo activo del tenant
        flow = await this.getFlowByTenant(tenantId);
      }

      if (!flow) {
        // Si no hay flujo, devolvemos una estimación básica
        return Math.ceil(message.length / 4) + 50; // 50 tokens para respuesta típica
      }

      // Aquí implementaríamos una estimación basada en la estructura del flujo
      // Esta es una versión simplificada, idealmente analizaríamos el flujo

      // Contador de nodos
      const nodeCount = Object.keys(flow.nodes).length;

      // Estimamos consumo de tokens por complejidad del flujo
      const baseTokens = Math.ceil(message.length / 4);
      const nodeComplexityFactor = Math.min(1.5, 1 + nodeCount / 100);

      // Multiplicamos por un factor basado en la cantidad de nodos
      return Math.floor(baseTokens * nodeComplexityFactor) + 20;
    } catch (error) {
      logger.error(`Error al estimar tokens: ${error}`);
      // En caso de error, devolvemos una estimación base
      return Math.ceil(message.length / 4) + 30;
    }
  }
}
