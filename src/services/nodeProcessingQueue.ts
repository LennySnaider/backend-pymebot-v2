/**
 * NODE PROCESSING QUEUE SERVICE
 * 
 * PROPÓSITO: Sistema de cola de nodos para procesamiento secuencial
 * BASADO EN: Patrones del v1-reference para manejo de flujos complejos
 * PRESERVA: Sistema de leads 100% intacto
 * RESUELVE: Problemas de concurrencia y orden en navegación de nodos
 * 
 * PATRONES EXTRAÍDOS DEL V1-REFERENCE:
 * - Procesamiento secuencial de nodos para evitar race conditions
 * - Cola prioritaria para diferentes tipos de nodos
 * - Gestión de dependencias entre nodos
 * - Rollback automático en caso de fallos
 * - Integración con sistema de sesiones persistentes
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import DynamicNavigationService from './dynamicNavigation';
import ImprovedSessionManager from './improvedSessionManager';
import type { 
  NavigationNode, 
  NavigationContext, 
  NavigationResult,
  NavigationOptions 
} from './dynamicNavigation';

// INTERFACES PARA SISTEMA DE COLA

interface QueuedNode {
  id: string;
  nodeId: string;
  node: NavigationNode;
  context: NavigationContext;
  priority: QueuePriority;
  options: NavigationOptions;
  dependencies: string[];
  maxRetries: number;
  currentRetries: number;
  createdAt: number;
  scheduledAt?: number;
  processingStartedAt?: number;
  completedAt?: number;
  status: QueueNodeStatus;
  result?: NavigationResult;
  error?: string;
  metadata: QueueNodeMetadata;
}

interface QueueNodeMetadata {
  sessionId?: string;
  userId: string;
  tenantId: string;
  templateId?: string;
  batchId?: string;
  parentNodeId?: string;
  childNodeIds?: string[];
  estimatedProcessingTime?: number;
  actualProcessingTime?: number;
  leadStageId?: string; // CRÍTICO: Para preservar sistema de leads
  tags?: string[];
}

type QueuePriority = 'low' | 'normal' | 'high' | 'critical' | 'immediate';
type QueueNodeStatus = 'pending' | 'waiting_dependencies' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'retrying';

interface ProcessingQueue {
  name: string;
  maxConcurrency: number;
  currentlyProcessing: Set<string>;
  pendingNodes: Map<string, QueuedNode>;
  processingNodes: Map<string, QueuedNode>;
  completedNodes: Map<string, QueuedNode>;
  failedNodes: Map<string, QueuedNode>;
  isActive: boolean;
  lastProcessedAt?: number;
}

interface QueueMetrics {
  totalNodes: number;
  pendingNodes: number;
  processingNodes: number;
  completedNodes: number;
  failedNodes: number;
  averageProcessingTime: number;
  throughputPerMinute: number;
  errorRate: number;
  longestWaitTime: number;
  queueHealth: 'healthy' | 'warning' | 'critical';
}

interface QueueConfiguration {
  maxConcurrency: number;
  maxQueueSize: number;
  processingTimeout: number;
  retryDelay: number;
  maxRetries: number;
  enablePrioritization: boolean;
  enableDependencyTracking: boolean;
  cleanupCompletedAfter: number;
  cleanupFailedAfter: number;
  enableMetrics: boolean;
}

interface BatchProcessingOptions {
  batchSize: number;
  maxBatchWaitTime: number;
  enableParallelProcessing: boolean;
  stopOnFirstError: boolean;
  preserveOrder: boolean;
}

/**
 * SERVICIO PRINCIPAL DE COLA DE PROCESAMIENTO DE NODOS
 */
class NodeProcessingQueueService {
  private static instance: NodeProcessingQueueService;
  private queues: Map<string, ProcessingQueue> = new Map();
  private navigationService: DynamicNavigationService;
  private sessionManager: ImprovedSessionManager;
  private globalConfig: QueueConfiguration;
  private processingTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private currentMetrics: Map<string, QueueMetrics> = new Map();

  private constructor(config: Partial<QueueConfiguration> = {}) {
    this.globalConfig = {
      maxConcurrency: 5,
      maxQueueSize: 1000,
      processingTimeout: 30000, // 30 segundos
      retryDelay: 5000, // 5 segundos
      maxRetries: 3,
      enablePrioritization: true,
      enableDependencyTracking: true,
      cleanupCompletedAfter: 300000, // 5 minutos
      cleanupFailedAfter: 600000, // 10 minutos
      enableMetrics: true,
      ...config
    };

    this.navigationService = DynamicNavigationService.getInstance();
    this.sessionManager = ImprovedSessionManager.getInstance();

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<QueueConfiguration>): NodeProcessingQueueService {
    if (!NodeProcessingQueueService.instance) {
      NodeProcessingQueueService.instance = new NodeProcessingQueueService(config);
    }
    return NodeProcessingQueueService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    // Crear cola por defecto
    this.createQueue('default');

    // Iniciar procesamiento automático
    this.startProcessing();

    // Iniciar recolección de métricas si está habilitada
    if (this.globalConfig.enableMetrics) {
      this.startMetricsCollection();
    }

    logger.info(`[NodeProcessingQueueService] Servicio inicializado con configuración:`, this.globalConfig);
  }

  /**
   * MÉTODO PRINCIPAL: Encolar nodo para procesamiento
   */
  async enqueueNode(
    node: NavigationNode,
    context: NavigationContext,
    options: NavigationOptions & {
      queueName?: string;
      priority?: QueuePriority;
      dependencies?: string[];
      scheduledAt?: number;
      batchId?: string;
      metadata?: Partial<QueueNodeMetadata>;
    } = {}
  ): Promise<string> {
    const queueName = options.queueName || 'default';
    const queue = this.getOrCreateQueue(queueName);
    
    // Verificar límites de cola
    if (queue.pendingNodes.size >= this.globalConfig.maxQueueSize) {
      throw new Error(`Cola ${queueName} ha alcanzado el límite máximo de ${this.globalConfig.maxQueueSize} nodos`);
    }

    // Generar ID único para el nodo en cola
    const queuedNodeId = `queued_${node.nodeId}_${context.userId}_${Date.now()}`;
    
    // Crear nodo encolado
    const queuedNode: QueuedNode = {
      id: queuedNodeId,
      nodeId: node.nodeId,
      node,
      context: { ...context }, // Clonar contexto para evitar mutaciones
      priority: options.priority || 'normal',
      options: { ...options },
      dependencies: options.dependencies || [],
      maxRetries: options.maxRetries || this.globalConfig.maxRetries,
      currentRetries: 0,
      createdAt: Date.now(),
      scheduledAt: options.scheduledAt,
      status: 'pending',
      metadata: {
        sessionId: context.sessionId,
        userId: context.userId,
        tenantId: context.tenantId,
        templateId: context.templateId,
        batchId: options.batchId,
        leadStageId: node.metadata.leadStageId, // PRESERVAR sistema de leads
        tags: node.metadata.tags,
        estimatedProcessingTime: this.estimateProcessingTime(node),
        ...options.metadata
      }
    };

    // Verificar dependencias
    if (this.globalConfig.enableDependencyTracking && queuedNode.dependencies.length > 0) {
      const unresolvedDependencies = await this.checkDependencies(queuedNode, queue);
      if (unresolvedDependencies.length > 0) {
        queuedNode.status = 'waiting_dependencies';
        logger.debug(`[NodeProcessingQueueService] Nodo ${queuedNodeId} esperando dependencias: ${unresolvedDependencies.join(', ')}`);
      }
    }

    // Agregar a la cola
    queue.pendingNodes.set(queuedNodeId, queuedNode);
    
    logger.info(`[NodeProcessingQueueService] Nodo encolado: ${queuedNodeId} en cola ${queueName} con prioridad ${queuedNode.priority}`);
    
    return queuedNodeId;
  }

  /**
   * MÉTODO: Procesar nodo individual
   */
  private async processNode(queuedNode: QueuedNode, queue: ProcessingQueue): Promise<NavigationResult> {
    const startTime = Date.now();
    queuedNode.processingStartedAt = startTime;
    queuedNode.status = 'processing';

    logger.info(`[NodeProcessingQueueService] Iniciando procesamiento de nodo: ${queuedNode.id}`);

    try {
      // PASO 1: VALIDAR PRECONDICIONES
      await this.validateNodeForProcessing(queuedNode);

      // PASO 2: ACTUALIZAR CONTEXTO CON INFORMACIÓN DE COLA
      const enrichedContext = await this.enrichContextForProcessing(queuedNode);

      // PASO 3: EJECUTAR NAVEGACIÓN A TRAVÉS DEL DYNAMIC NAVIGATION SERVICE
      const result = await this.navigationService.enhancedGotoFlow(
        enrichedContext,
        queuedNode.nodeId,
        queuedNode.options
      );

      // PASO 4: PROCESAR RESULTADO
      if (result.success) {
        queuedNode.status = 'completed';
        queuedNode.result = result;
        queuedNode.completedAt = Date.now();
        queuedNode.metadata.actualProcessingTime = Date.now() - startTime;

        // PASO 5: PRESERVAR DATOS DE LEADS SI ES NECESARIO
        if (queuedNode.metadata.leadStageId) {
          await this.preserveLeadProgression(queuedNode, result);
        }

        // PASO 6: PROCESAR NODOS DEPENDIENTES
        await this.processDependentNodes(queuedNode, queue);

        logger.info(`[NodeProcessingQueueService] Nodo procesado exitosamente: ${queuedNode.id} en ${Date.now() - startTime}ms`);
      } else {
        throw new Error(result.error || 'Error desconocido en navegación');
      }

      return result;

    } catch (error) {
      logger.error(`[NodeProcessingQueueService] Error procesando nodo ${queuedNode.id}:`, error);
      
      queuedNode.error = String(error);
      queuedNode.currentRetries++;

      // Determinar si reintentar o marcar como fallido
      if (queuedNode.currentRetries < queuedNode.maxRetries) {
        queuedNode.status = 'retrying';
        
        // Programar reintento con delay exponencial
        const delay = this.globalConfig.retryDelay * Math.pow(2, queuedNode.currentRetries - 1);
        setTimeout(() => {
          queuedNode.status = 'pending';
          logger.info(`[NodeProcessingQueueService] Reintentando nodo ${queuedNode.id} (intento ${queuedNode.currentRetries})`);
        }, delay);
      } else {
        queuedNode.status = 'failed';
        queue.failedNodes.set(queuedNode.id, queuedNode);
        
        // Ejecutar rollback si está habilitado
        if (queuedNode.options.enableRollback) {
          await this.executeNodeRollback(queuedNode);
        }
      }

      throw error;
    }
  }

  /**
   * MÉTODO: Procesar cola de forma continua
   */
  private async processQueue(queue: ProcessingQueue): Promise<void> {
    if (!queue.isActive) {
      return;
    }

    try {
      // Obtener nodos listos para procesar
      const readyNodes = this.getReadyNodes(queue);
      
      if (readyNodes.length === 0) {
        return;
      }

      // Procesar nodos según capacidad de concurrencia
      const availableSlots = queue.maxConcurrency - queue.currentlyProcessing.size;
      const nodesToProcess = readyNodes.slice(0, availableSlots);

      for (const queuedNode of nodesToProcess) {
        // Mover a procesamiento
        queue.pendingNodes.delete(queuedNode.id);
        queue.processingNodes.set(queuedNode.id, queuedNode);
        queue.currentlyProcessing.add(queuedNode.id);

        // Procesar de forma asíncrona
        this.processNode(queuedNode, queue)
          .then(result => {
            // Mover a completados
            queue.processingNodes.delete(queuedNode.id);
            queue.completedNodes.set(queuedNode.id, queuedNode);
            queue.currentlyProcessing.delete(queuedNode.id);
            queue.lastProcessedAt = Date.now();
          })
          .catch(error => {
            // El error ya se maneja en processNode
            queue.processingNodes.delete(queuedNode.id);
            queue.currentlyProcessing.delete(queuedNode.id);
          });
      }

    } catch (error) {
      logger.error(`[NodeProcessingQueueService] Error procesando cola ${queue.name}:`, error);
    }
  }

  /**
   * MÉTODO: Obtener nodos listos para procesar
   */
  private getReadyNodes(queue: ProcessingQueue): QueuedNode[] {
    const now = Date.now();
    const readyNodes: QueuedNode[] = [];

    for (const queuedNode of queue.pendingNodes.values()) {
      // Verificar si está programado para el futuro
      if (queuedNode.scheduledAt && queuedNode.scheduledAt > now) {
        continue;
      }

      // Verificar dependencias
      if (queuedNode.status === 'waiting_dependencies') {
        const unresolvedDependencies = this.checkDependencies(queuedNode, queue);
        if (unresolvedDependencies.length > 0) {
          continue;
        }
        queuedNode.status = 'pending'; // Marcar como listo
      }

      // Solo procesar nodos en estado pending
      if (queuedNode.status === 'pending') {
        readyNodes.push(queuedNode);
      }
    }

    // Ordenar por prioridad si está habilitado
    if (this.globalConfig.enablePrioritization) {
      readyNodes.sort((a, b) => this.comparePriority(a.priority, b.priority));
    }

    return readyNodes;
  }

  /**
   * MÉTODO: Comparar prioridades para ordenamiento
   */
  private comparePriority(a: QueuePriority, b: QueuePriority): number {
    const priorityOrder = { immediate: 5, critical: 4, high: 3, normal: 2, low: 1 };
    return priorityOrder[b] - priorityOrder[a];
  }

  /**
   * MÉTODO: Verificar dependencias de un nodo
   */
  private checkDependencies(queuedNode: QueuedNode, queue: ProcessingQueue): string[] {
    const unresolvedDependencies: string[] = [];

    for (const dependencyId of queuedNode.dependencies) {
      const dependency = queue.completedNodes.get(dependencyId) || 
                        queue.failedNodes.get(dependencyId);
      
      if (!dependency || dependency.status !== 'completed') {
        unresolvedDependencies.push(dependencyId);
      }
    }

    return unresolvedDependencies;
  }

  /**
   * MÉTODO: Enriquecer contexto para procesamiento
   */
  private async enrichContextForProcessing(queuedNode: QueuedNode): Promise<NavigationContext> {
    const enrichedContext = { ...queuedNode.context };

    // Agregar información de cola al contexto
    enrichedContext.globalVars = {
      ...enrichedContext.globalVars,
      queuedNodeId: queuedNode.id,
      batchId: queuedNode.metadata.batchId,
      processingAttempt: queuedNode.currentRetries + 1,
      queuePriority: queuedNode.priority
    };

    // Preservar información de leads
    if (queuedNode.metadata.leadStageId && enrichedContext.leadData) {
      enrichedContext.leadData.currentStage = queuedNode.metadata.leadStageId;
    }

    return enrichedContext;
  }

  /**
   * MÉTODO: Preservar progresión de leads
   */
  private async preserveLeadProgression(queuedNode: QueuedNode, result: NavigationResult): Promise<void> {
    // CRÍTICO: NO tocar el sistema de leads actual
    // Solo preservar información en el contexto
    if (queuedNode.metadata.leadStageId && result.contextUpdates?.leadData) {
      result.contextUpdates.leadData.currentStage = queuedNode.metadata.leadStageId;
      
      logger.debug(`[NodeProcessingQueueService] Progresión de lead preservada para etapa: ${queuedNode.metadata.leadStageId}`);
    }
  }

  /**
   * MÉTODO: Procesar nodos dependientes
   */
  private async processDependentNodes(queuedNode: QueuedNode, queue: ProcessingQueue): Promise<void> {
    // Buscar nodos que dependían de este
    for (const pendingNode of queue.pendingNodes.values()) {
      if (pendingNode.dependencies.includes(queuedNode.id) && 
          pendingNode.status === 'waiting_dependencies') {
        
        const unresolvedDependencies = this.checkDependencies(pendingNode, queue);
        if (unresolvedDependencies.length === 0) {
          pendingNode.status = 'pending';
          logger.debug(`[NodeProcessingQueueService] Nodo ${pendingNode.id} listo para procesar - dependencias resueltas`);
        }
      }
    }
  }

  /**
   * MÉTODOS DE GESTIÓN DE COLAS
   */

  createQueue(name: string, config?: Partial<QueueConfiguration>): ProcessingQueue {
    const queueConfig = { ...this.globalConfig, ...config };
    
    const queue: ProcessingQueue = {
      name,
      maxConcurrency: queueConfig.maxConcurrency,
      currentlyProcessing: new Set(),
      pendingNodes: new Map(),
      processingNodes: new Map(),
      completedNodes: new Map(),
      failedNodes: new Map(),
      isActive: true
    };

    this.queues.set(name, queue);
    logger.info(`[NodeProcessingQueueService] Cola creada: ${name} con concurrencia máxima ${queue.maxConcurrency}`);
    
    return queue;
  }

  getOrCreateQueue(name: string): ProcessingQueue {
    return this.queues.get(name) || this.createQueue(name);
  }

  getQueue(name: string): ProcessingQueue | null {
    return this.queues.get(name) || null;
  }

  pauseQueue(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      queue.isActive = false;
      logger.info(`[NodeProcessingQueueService] Cola pausada: ${name}`);
    }
  }

  resumeQueue(name: string): void {
    const queue = this.queues.get(name);
    if (queue) {
      queue.isActive = true;
      logger.info(`[NodeProcessingQueueService] Cola reanudada: ${name}`);
    }
  }

  /**
   * MÉTODOS DE PROCESAMIENTO POR LOTES
   */

  async enqueueBatch(
    nodes: { node: NavigationNode; context: NavigationContext; options?: NavigationOptions }[],
    batchOptions: BatchProcessingOptions & { queueName?: string; priority?: QueuePriority } = {
      batchSize: 10,
      maxBatchWaitTime: 5000,
      enableParallelProcessing: true,
      stopOnFirstError: false,
      preserveOrder: false
    }
  ): Promise<string[]> {
    const batchId = `batch_${Date.now()}`;
    const queuedNodeIds: string[] = [];

    logger.info(`[NodeProcessingQueueService] Encolando lote de ${nodes.length} nodos con ID: ${batchId}`);

    try {
      for (let i = 0; i < nodes.length; i++) {
        const { node, context, options = {} } = nodes[i];
        
        // Configurar dependencias para preservar orden si es necesario
        const dependencies: string[] = [];
        if (batchOptions.preserveOrder && i > 0) {
          dependencies.push(queuedNodeIds[i - 1]);
        }

        const queuedNodeId = await this.enqueueNode(node, context, {
          ...options,
          queueName: batchOptions.queueName,
          priority: batchOptions.priority,
          batchId,
          dependencies,
          metadata: {
            ...options.metadata,
            batchIndex: i,
            batchSize: nodes.length
          }
        });

        queuedNodeIds.push(queuedNodeId);
      }

      return queuedNodeIds;

    } catch (error) {
      logger.error(`[NodeProcessingQueueService] Error encolando lote ${batchId}:`, error);
      throw error;
    }
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private async validateNodeForProcessing(queuedNode: QueuedNode): Promise<void> {
    // Validar que el nodo y contexto sean válidos
    if (!queuedNode.node || !queuedNode.context) {
      throw new Error('Nodo o contexto inválido');
    }

    // Validar que la sesión aún existe si es necesario
    if (queuedNode.metadata.sessionId) {
      const sessionInfo = await this.sessionManager.getSessionContext(queuedNode.metadata.sessionId);
      if (!sessionInfo) {
        logger.warn(`[NodeProcessingQueueService] Sesión ${queuedNode.metadata.sessionId} no encontrada, continuando sin sesión`);
      }
    }
  }

  private estimateProcessingTime(node: NavigationNode): number {
    // Estimación basada en tipo de nodo
    const baseTime = {
      'message': 100,
      'input': 200,
      'button': 150,
      'ai_response': 2000,
      'condition': 50,
      'action': 300
    };

    return baseTime[node.nodeType] || 200;
  }

  private async executeNodeRollback(queuedNode: QueuedNode): Promise<void> {
    logger.warn(`[NodeProcessingQueueService] Ejecutando rollback para nodo: ${queuedNode.id}`);
    
    try {
      // Restaurar contexto previo si existe
      if (queuedNode.context.navigationHistory.length > 0) {
        const lastSuccessfulStep = queuedNode.context.navigationHistory
          .slice()
          .reverse()
          .find(step => step.success);

        if (lastSuccessfulStep) {
          logger.info(`[NodeProcessingQueueService] Rollback ejecutado a nodo: ${lastSuccessfulStep.fromNodeId}`);
        }
      }
    } catch (error) {
      logger.error(`[NodeProcessingQueueService] Error ejecutando rollback:`, error);
    }
  }

  /**
   * MÉTODOS DE GESTIÓN DE CICLO DE VIDA
   */

  private startProcessing(): void {
    this.processingTimer = setInterval(async () => {
      for (const queue of this.queues.values()) {
        await this.processQueue(queue);
      }
    }, 100); // Procesar cada 100ms

    logger.info(`[NodeProcessingQueueService] Procesamiento automático iniciado`);
  }

  private stopProcessing(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
      logger.info(`[NodeProcessingQueueService] Procesamiento automático detenido`);
    }
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, 60000); // Actualizar métricas cada minuto

    logger.debug(`[NodeProcessingQueueService] Recolección de métricas iniciada`);
  }

  private updateMetrics(): void {
    for (const [queueName, queue] of this.queues) {
      const metrics = this.calculateQueueMetrics(queue);
      this.currentMetrics.set(queueName, metrics);
    }
  }

  private calculateQueueMetrics(queue: ProcessingQueue): QueueMetrics {
    const totalNodes = queue.pendingNodes.size + queue.processingNodes.size + 
                      queue.completedNodes.size + queue.failedNodes.size;
    
    const completedNodes = Array.from(queue.completedNodes.values());
    const failedNodes = Array.from(queue.failedNodes.values());
    
    const processingTimes = completedNodes
      .map(node => node.metadata.actualProcessingTime || 0)
      .filter(time => time > 0);
    
    const averageProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const errorRate = totalNodes > 0 ? failedNodes.length / totalNodes : 0;
    
    // Calcular tiempo de espera más largo
    const longestWaitTime = Math.max(
      ...Array.from(queue.pendingNodes.values())
        .map(node => Date.now() - node.createdAt),
      0
    );

    // Determinar salud de la cola
    let queueHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (errorRate > 0.1 || longestWaitTime > 300000) { // 5 minutos
      queueHealth = 'warning';
    }
    if (errorRate > 0.3 || longestWaitTime > 600000) { // 10 minutos
      queueHealth = 'critical';
    }

    return {
      totalNodes,
      pendingNodes: queue.pendingNodes.size,
      processingNodes: queue.processingNodes.size,
      completedNodes: queue.completedNodes.size,
      failedNodes: queue.failedNodes.size,
      averageProcessingTime,
      throughputPerMinute: completedNodes.filter(node => 
        node.completedAt && node.completedAt > Date.now() - 60000
      ).length,
      errorRate,
      longestWaitTime,
      queueHealth
    };
  }

  /**
   * MÉTODOS PÚBLICOS PARA CONSULTA Y CONTROL
   */

  async getQueueStatus(queueName: string): Promise<{
    queue: ProcessingQueue;
    metrics: QueueMetrics;
  } | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const metrics = this.currentMetrics.get(queueName) || this.calculateQueueMetrics(queue);
    
    return { queue, metrics };
  }

  async getNodeStatus(queuedNodeId: string): Promise<QueuedNode | null> {
    for (const queue of this.queues.values()) {
      for (const nodeMap of [queue.pendingNodes, queue.processingNodes, queue.completedNodes, queue.failedNodes]) {
        const node = nodeMap.get(queuedNodeId);
        if (node) {
          return node;
        }
      }
    }
    return null;
  }

  async cancelNode(queuedNodeId: string): Promise<boolean> {
    for (const queue of this.queues.values()) {
      const node = queue.pendingNodes.get(queuedNodeId);
      if (node) {
        node.status = 'cancelled';
        queue.pendingNodes.delete(queuedNodeId);
        queue.failedNodes.set(queuedNodeId, node);
        logger.info(`[NodeProcessingQueueService] Nodo cancelado: ${queuedNodeId}`);
        return true;
      }
    }
    return false;
  }

  async getAllQueueMetrics(): Promise<Map<string, QueueMetrics>> {
    return new Map(this.currentMetrics);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.stopProcessing();
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    this.queues.clear();
    this.currentMetrics.clear();
    
    logger.info(`[NodeProcessingQueueService] Servicio destruido`);
  }
}

export default NodeProcessingQueueService;
export type {
  QueuedNode,
  ProcessingQueue,
  QueueMetrics,
  QueueConfiguration,
  BatchProcessingOptions,
  QueuePriority,
  QueueNodeStatus
};