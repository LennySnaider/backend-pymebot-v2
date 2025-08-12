/**
 * HYBRID METRICS COLLECTOR SERVICE
 * 
 * PROPÓSITO: Recolección y análisis de métricas del sistema híbrido vs actual
 * BASADO EN: Patrones de telemetría del v1-reference y mejores prácticas de monitoreo
 * PRESERVA: Sistema actual 100% intacto - solo observabilidad
 * TRANSPARENTE: Métricas no afectan funcionalidad, solo para análisis
 * 
 * MÉTRICAS RECOLECTADAS:
 * - Rendimiento comparativo entre sistemas
 * - Tasas de éxito y error por sistema
 * - Tiempo de respuesta y throughput
 * - Utilización de recursos y costos
 * - Satisfacción del usuario y calidad de servicio
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import type { HybridModuleName } from './templateDetector';
import type { RoutingDecision } from './systemRouter';

// INTERFACES PARA RECOLECCIÓN DE MÉTRICAS

interface MetricEvent {
  eventId: string;
  timestamp: string;
  eventType: MetricEventType;
  system: SystemType;
  templateId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  data: EventData;
  context: EventContext;
}

interface EventData {
  // Métricas de rendimiento
  responseTime?: number;
  processingTime?: number;
  queueTime?: number;
  
  // Métricas de funcionalidad
  captureSuccess?: boolean;
  navigationSuccess?: boolean;
  sessionMaintained?: boolean;
  
  // Métricas de calidad
  errorOccurred?: boolean;
  errorType?: string;
  errorSeverity?: 'low' | 'medium' | 'high' | 'critical';
  
  // Métricas de uso
  modulesUsed?: HybridModuleName[];
  fallbackOccurred?: boolean;
  fallbackReason?: string;
  originalError?: string;
  retryAttempts?: number;
  
  // Datos adicionales
  messageCount?: number;
  dataSize?: number;
  nodeCount?: number;
  customMetrics?: Record<string, any>;
}

interface EventContext {
  platform?: 'web' | 'whatsapp' | 'telegram' | 'api';
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  userAgent?: string;
  location?: string;
  language?: string;
  routingDecision?: RoutingDecision;
  systemLoad?: SystemLoadMetrics;
}

interface SystemLoadMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  queueLength: number;
  timestamp: string;
}

type MetricEventType = 
  | 'conversation_start'
  | 'conversation_end'
  | 'message_sent'
  | 'message_received'
  | 'capture_attempt'
  | 'capture_success'
  | 'capture_failure'
  | 'navigation_start'
  | 'navigation_success'
  | 'navigation_failure'
  | 'session_created'
  | 'session_resumed'
  | 'session_expired'
  | 'error_occurred'
  | 'fallback_triggered'
  | 'module_used'
  | 'performance_sample';

type SystemType = 'current' | 'hybrid';

interface MetricsAggregation {
  timeRange: TimeRange;
  systems: SystemMetrics;
  comparison: ComparisonMetrics;
  insights: MetricInsight[];
  recommendations: MetricRecommendation[];
  metadata: AggregationMetadata;
}

interface TimeRange {
  startDate: string;
  endDate: string;
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  timezone: string;
}

interface SystemMetrics {
  current: SystemPerformanceMetrics;
  hybrid: SystemPerformanceMetrics;
}

interface SystemPerformanceMetrics {
  // Métricas básicas
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  
  // Métricas de rendimiento
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Métricas de calidad
  errorRate: number;
  captureSuccessRate: number;
  sessionRetentionRate: number;
  fallbackRate: number;
  
  // Métricas de uso
  throughputPerSecond: number;
  concurrentUsers: number;
  averageSessionDuration: number;
  
  // Métricas de recursos
  averageCpuUsage: number;
  averageMemoryUsage: number;
  resourceCostEstimate: number;
  
  // Distribución por templates
  templateDistribution: Map<string, TemplateMetrics>;
  
  // Distribución por tenants
  tenantDistribution: Map<string, TenantMetrics>;
  
  // Distribución por módulos (solo híbrido)
  moduleUsage?: Map<HybridModuleName, ModuleMetrics>;
}

interface TemplateMetrics {
  templateId: string;
  templateName: string;
  requests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  userSatisfaction?: number;
}

interface TenantMetrics {
  tenantId: string;
  requests: number;
  successRate: number;
  averageResponseTime: number;
  activeUsers: number;
  systemPreference: SystemType;
}

interface ModuleMetrics {
  moduleName: HybridModuleName;
  usageCount: number;
  successRate: number;
  averagePerformanceImpact: number;
  errorReduction: number;
}

interface ComparisonMetrics {
  performanceImprovement: number; // Porcentaje de mejora híbrido vs actual
  reliabilityImprovement: number; // Mejora en tasa de éxito
  efficiencyGain: number; // Mejora en uso de recursos
  userSatisfactionDelta: number; // Diferencia en satisfacción
  costEffectiveness: number; // Costo-beneficio
  
  // Comparaciones detalladas
  responseTimeComparison: MetricComparison;
  errorRateComparison: MetricComparison;
  captureRateComparison: MetricComparison;
  sessionRetentionComparison: MetricComparison;
  resourceUsageComparison: MetricComparison;
}

interface MetricComparison {
  metric: string;
  currentValue: number;
  hybridValue: number;
  improvementPercentage: number;
  significanceLevel: 'low' | 'medium' | 'high' | 'very_high';
  trend: 'improving' | 'stable' | 'degrading';
  recommendation: string;
}

interface MetricInsight {
  type: InsightType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  impact: string;
  evidenceData: Record<string, any>;
  confidence: number; // 0-1
}

interface MetricRecommendation {
  id: string;
  category: RecommendationCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedTimeToImplement: number; // días
  requiredResources: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

type InsightType = 
  | 'performance_anomaly'
  | 'usage_pattern'
  | 'error_cluster'
  | 'capacity_warning'
  | 'optimization_opportunity'
  | 'user_behavior_change'
  | 'system_degradation'
  | 'cost_optimization';

type RecommendationCategory = 
  | 'performance'
  | 'reliability'
  | 'cost_optimization'
  | 'user_experience'
  | 'system_configuration'
  | 'capacity_planning'
  | 'error_reduction'
  | 'feature_adoption';

interface AggregationMetadata {
  aggregationId: string;
  generatedAt: string;
  dataPoints: number;
  completeness: number; // 0-1, porcentaje de datos disponibles
  confidence: number; // 0-1, confianza en los resultados
  version: string;
  processingDuration: number;
}

interface MetricsConfiguration {
  collectionEnabled: boolean;
  samplingRate: number; // 0-1, porcentaje de eventos a recolectar
  retentionPeriod: number; // días
  aggregationIntervals: number[]; // minutos
  enableRealTimeAlerts: boolean;
  alertThresholds: AlertThresholds;
  enableDetailedProfiling: boolean;
  enableUserBehaviorTracking: boolean;
  enableCostTracking: boolean;
  excludeTenants?: string[];
  excludeTemplates?: string[];
}

interface AlertThresholds {
  errorRateThreshold: number;
  responseTimeThreshold: number;
  fallbackRateThreshold: number;
  resourceUsageThreshold: number;
  userSatisfactionThreshold: number;
}

interface MetricsQuery {
  timeRange: TimeRange;
  systems?: SystemType[];
  tenants?: string[];
  templates?: string[];
  eventTypes?: MetricEventType[];
  aggregations: AggregationType[];
  filters?: MetricFilter[];
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
}

interface MetricFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: any;
}

type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'p50' | 'p95' | 'p99';

/**
 * SERVICIO PRINCIPAL DE RECOLECCIÓN DE MÉTRICAS
 */
class HybridMetricsCollectorService {
  private static instance: HybridMetricsCollectorService;
  private config: MetricsConfiguration;
  private eventBuffer: MetricEvent[] = [];
  private aggregationCache: Map<string, MetricsAggregation> = new Map();
  private realTimeMetrics: Map<string, any> = new Map();
  private alertSubscribers: Map<string, (alert: any) => void> = new Map();
  private aggregationTimer: NodeJS.Timeout | null = null;

  private constructor(config: Partial<MetricsConfiguration> = {}) {
    this.config = {
      collectionEnabled: true,
      samplingRate: 1.0, // Recolectar 100% por defecto
      retentionPeriod: 30, // 30 días
      aggregationIntervals: [1, 5, 15, 60], // 1min, 5min, 15min, 1h
      enableRealTimeAlerts: true,
      alertThresholds: {
        errorRateThreshold: 0.05, // 5%
        responseTimeThreshold: 3000, // 3 segundos
        fallbackRateThreshold: 0.1, // 10%
        resourceUsageThreshold: 0.8, // 80%
        userSatisfactionThreshold: 0.7 // 70%
      },
      enableDetailedProfiling: true,
      enableUserBehaviorTracking: false, // Por privacidad
      enableCostTracking: true,
      ...config
    };

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<MetricsConfiguration>): HybridMetricsCollectorService {
    if (!HybridMetricsCollectorService.instance) {
      HybridMetricsCollectorService.instance = new HybridMetricsCollectorService(config);
    }
    return HybridMetricsCollectorService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    if (this.config.collectionEnabled) {
      this.startAggregationTimer();
      logger.info(`[HybridMetricsCollectorService] Servicio inicializado con sampling rate ${this.config.samplingRate * 100}%`);
    } else {
      logger.info(`[HybridMetricsCollectorService] Recolección de métricas deshabilitada`);
    }
  }

  /**
   * MÉTODO PRINCIPAL: Registrar evento métrico
   */
  recordEvent(
    eventType: MetricEventType,
    system: SystemType,
    templateId: string,
    tenantId: string,
    data: Partial<EventData>,
    context: Partial<EventContext> = {}
  ): void {
    if (!this.config.collectionEnabled) {
      return;
    }

    // Aplicar sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    // Verificar exclusiones
    if (this.config.excludeTenants?.includes(tenantId) ||
        this.config.excludeTemplates?.includes(templateId)) {
      return;
    }

    const event: MetricEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      eventType,
      system,
      templateId,
      tenantId,
      userId: context.routingDecision?.metadata.userId,
      sessionId: context.routingDecision?.metadata.templateId,
      requestId: context.routingDecision?.metadata.requestId,
      data: {
        responseTime: data.responseTime,
        processingTime: data.processingTime,
        queueTime: data.queueTime,
        captureSuccess: data.captureSuccess,
        navigationSuccess: data.navigationSuccess,
        sessionMaintained: data.sessionMaintained,
        errorOccurred: data.errorOccurred,
        errorType: data.errorType,
        errorSeverity: data.errorSeverity,
        modulesUsed: data.modulesUsed,
        fallbackOccurred: data.fallbackOccurred,
        retryAttempts: data.retryAttempts,
        messageCount: data.messageCount,
        dataSize: data.dataSize,
        nodeCount: data.nodeCount,
        customMetrics: data.customMetrics
      },
      context: {
        platform: context.platform,
        deviceType: context.deviceType,
        userAgent: context.userAgent,
        location: context.location,
        language: context.language,
        routingDecision: context.routingDecision,
        systemLoad: context.systemLoad
      }
    };

    // Agregar a buffer
    this.eventBuffer.push(event);
    
    // Actualizar métricas en tiempo real
    this.updateRealTimeMetrics(event);
    
    // Verificar alertas
    if (this.config.enableRealTimeAlerts) {
      this.checkAlerts(event);
    }

    logger.debug(`[HybridMetricsCollectorService] Evento registrado: ${eventType} en sistema ${system}`);
  }

  /**
   * MÉTODO: Obtener agregación de métricas
   */
  async getMetricsAggregation(
    query: MetricsQuery,
    options: {
      useCache?: boolean;
      includeInsights?: boolean;
      includeRecommendations?: boolean;
    } = {}
  ): Promise<MetricsAggregation> {
    const cacheKey = this.generateCacheKey(query);
    
    // Verificar caché si está habilitado
    if (options.useCache && this.aggregationCache.has(cacheKey)) {
      const cached = this.aggregationCache.get(cacheKey)!;
      const age = Date.now() - new Date(cached.metadata.generatedAt).getTime();
      
      // Usar caché si es menor a 5 minutos
      if (age < 300000) {
        logger.debug(`[HybridMetricsCollectorService] Agregación obtenida del caché`);
        return cached;
      }
    }

    const startTime = Date.now();
    logger.info(`[HybridMetricsCollectorService] Generando agregación de métricas`);

    try {
      // PASO 1: FILTRAR EVENTOS POR QUERY
      const filteredEvents = this.filterEvents(query);
      
      // PASO 2: AGREGAR MÉTRICAS POR SISTEMA
      const systemMetrics = await this.aggregateSystemMetrics(filteredEvents, query);
      
      // PASO 3: GENERAR MÉTRICAS COMPARATIVAS
      const comparisonMetrics = this.generateComparisonMetrics(systemMetrics);
      
      // PASO 4: GENERAR INSIGHTS SI ES REQUERIDO
      const insights = options.includeInsights 
        ? await this.generateInsights(systemMetrics, comparisonMetrics)
        : [];
      
      // PASO 5: GENERAR RECOMENDACIONES SI ES REQUERIDO
      const recommendations = options.includeRecommendations
        ? await this.generateRecommendations(systemMetrics, comparisonMetrics, insights)
        : [];

      const aggregation: MetricsAggregation = {
        timeRange: query.timeRange,
        systems: systemMetrics,
        comparison: comparisonMetrics,
        insights,
        recommendations,
        metadata: {
          aggregationId: this.generateAggregationId(),
          generatedAt: new Date().toISOString(),
          dataPoints: filteredEvents.length,
          completeness: this.calculateCompleteness(filteredEvents, query),
          confidence: this.calculateConfidence(filteredEvents),
          version: '1.0.0',
          processingDuration: Date.now() - startTime
        }
      };

      // Almacenar en caché
      this.aggregationCache.set(cacheKey, aggregation);

      logger.info(`[HybridMetricsCollectorService] Agregación generada en ${aggregation.metadata.processingDuration}ms con ${aggregation.metadata.dataPoints} datos`);

      return aggregation;

    } catch (error) {
      logger.error(`[HybridMetricsCollectorService] Error generando agregación:`, error);
      throw error;
    }
  }

  /**
   * MÉTODO: Obtener métricas en tiempo real
   */
  getRealTimeMetrics(): {
    hybrid: Partial<SystemPerformanceMetrics>;
    current: Partial<SystemPerformanceMetrics>;
    lastUpdated: string;
  } {
    const hybridMetrics = this.realTimeMetrics.get('hybrid') || {};
    const currentMetrics = this.realTimeMetrics.get('current') || {};

    return {
      hybrid: hybridMetrics,
      current: currentMetrics,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * MÉTODO: Registrar métricas de sesión completa
   */
  recordSessionMetrics(
    sessionId: string,
    system: SystemType,
    templateId: string,
    tenantId: string,
    sessionData: {
      startTime: string;
      endTime: string;
      messageCount: number;
      captureAttempts: number;
      captureSuccesses: number;
      errorCount: number;
      fallbackCount: number;
      modulesUsed?: HybridModuleName[];
      userSatisfaction?: number;
    }
  ): void {
    const duration = new Date(sessionData.endTime).getTime() - new Date(sessionData.startTime).getTime();
    
    this.recordEvent('conversation_end', system, templateId, tenantId, {
      responseTime: duration,
      captureSuccess: sessionData.captureSuccesses > 0,
      errorOccurred: sessionData.errorCount > 0,
      fallbackOccurred: sessionData.fallbackCount > 0,
      messageCount: sessionData.messageCount,
      modulesUsed: sessionData.modulesUsed,
      customMetrics: {
        sessionDuration: duration,
        captureAttempts: sessionData.captureAttempts,
        captureSuccesses: sessionData.captureSuccesses,
        errorCount: sessionData.errorCount,
        fallbackCount: sessionData.fallbackCount,
        userSatisfaction: sessionData.userSatisfaction
      }
    });
  }

  /**
   * MÉTODO: Registrar métricas de rendimiento
   */
  recordPerformanceMetrics(
    system: SystemType,
    templateId: string,
    tenantId: string,
    performanceData: {
      responseTime: number;
      processingTime: number;
      queueTime?: number;
      memoryUsage: number;
      cpuUsage: number;
      activeConnections: number;
    }
  ): void {
    this.recordEvent('performance_sample', system, templateId, tenantId, {
      responseTime: performanceData.responseTime,
      processingTime: performanceData.processingTime,
      queueTime: performanceData.queueTime,
      customMetrics: {
        memoryUsage: performanceData.memoryUsage,
        cpuUsage: performanceData.cpuUsage,
        activeConnections: performanceData.activeConnections
      }
    });
  }

  /**
   * MÉTODOS AUXILIARES DE AGREGACIÓN
   */

  private filterEvents(query: MetricsQuery): MetricEvent[] {
    let events = [...this.eventBuffer];

    // Filtrar por rango de tiempo
    const startTime = new Date(query.timeRange.startDate).getTime();
    const endTime = new Date(query.timeRange.endDate).getTime();
    
    events = events.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= startTime && eventTime <= endTime;
    });

    // Filtrar por sistemas
    if (query.systems) {
      events = events.filter(event => query.systems!.includes(event.system));
    }

    // Filtrar por tenants
    if (query.tenants) {
      events = events.filter(event => query.tenants!.includes(event.tenantId));
    }

    // Filtrar por templates
    if (query.templates) {
      events = events.filter(event => query.templates!.includes(event.templateId));
    }

    // Filtrar por tipos de evento
    if (query.eventTypes) {
      events = events.filter(event => query.eventTypes!.includes(event.eventType));
    }

    // Aplicar filtros personalizados
    if (query.filters) {
      for (const filter of query.filters) {
        events = events.filter(event => this.applyFilter(event, filter));
      }
    }

    return events;
  }

  private async aggregateSystemMetrics(
    events: MetricEvent[],
    query: MetricsQuery
  ): Promise<SystemMetrics> {
    const hybridEvents = events.filter(e => e.system === 'hybrid');
    const currentEvents = events.filter(e => e.system === 'current');

    return {
      hybrid: await this.calculateSystemPerformanceMetrics(hybridEvents, 'hybrid'),
      current: await this.calculateSystemPerformanceMetrics(currentEvents, 'current')
    };
  }

  private async calculateSystemPerformanceMetrics(
    events: MetricEvent[],
    system: SystemType
  ): Promise<SystemPerformanceMetrics> {
    const responseTimes = events
      .filter(e => e.data.responseTime !== undefined)
      .map(e => e.data.responseTime!);

    const captureEvents = events.filter(e => 
      e.eventType === 'capture_attempt' || e.eventType === 'capture_success'
    );

    const errorEvents = events.filter(e => e.data.errorOccurred);
    const fallbackEvents = events.filter(e => e.data.fallbackOccurred);

    // Calcular métricas básicas
    const totalRequests = events.length;
    const successfulRequests = events.filter(e => !e.data.errorOccurred).length;
    const failedRequests = errorEvents.length;

    // Calcular métricas de rendimiento
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    const p50ResponseTime = this.calculatePercentile(sortedResponseTimes, 50);
    const p95ResponseTime = this.calculatePercentile(sortedResponseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(sortedResponseTimes, 99);

    // Calcular métricas de calidad
    const errorRate = totalRequests > 0 ? errorEvents.length / totalRequests : 0;
    const captureSuccessRate = captureEvents.length > 0
      ? captureEvents.filter(e => e.eventType === 'capture_success').length / captureEvents.length
      : 0;
    const fallbackRate = totalRequests > 0 ? fallbackEvents.length / totalRequests : 0;

    // Calcular distribuciones
    const templateDistribution = this.calculateTemplateDistribution(events);
    const tenantDistribution = this.calculateTenantDistribution(events);
    const moduleUsage = system === 'hybrid' ? this.calculateModuleUsage(events) : undefined;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      captureSuccessRate,
      sessionRetentionRate: 0.95, // Placeholder
      fallbackRate,
      throughputPerSecond: this.calculateThroughput(events),
      concurrentUsers: this.calculateConcurrentUsers(events),
      averageSessionDuration: this.calculateAverageSessionDuration(events),
      averageCpuUsage: this.calculateResourceUsage(events, 'cpuUsage'),
      averageMemoryUsage: this.calculateResourceUsage(events, 'memoryUsage'),
      resourceCostEstimate: this.estimateResourceCost(events),
      templateDistribution,
      tenantDistribution,
      moduleUsage
    };
  }

  private generateComparisonMetrics(systemMetrics: SystemMetrics): ComparisonMetrics {
    const { current, hybrid } = systemMetrics;

    const performanceImprovement = this.calculateImprovement(
      current.averageResponseTime,
      hybrid.averageResponseTime,
      'lower_is_better'
    );

    const reliabilityImprovement = this.calculateImprovement(
      current.errorRate,
      hybrid.errorRate,
      'lower_is_better'
    );

    const captureRateImprovement = this.calculateImprovement(
      current.captureSuccessRate,
      hybrid.captureSuccessRate,
      'higher_is_better'
    );

    return {
      performanceImprovement,
      reliabilityImprovement,
      efficiencyGain: (performanceImprovement + reliabilityImprovement) / 2,
      userSatisfactionDelta: 0, // Placeholder
      costEffectiveness: this.calculateCostEffectiveness(current, hybrid),
      responseTimeComparison: {
        metric: 'Response Time',
        currentValue: current.averageResponseTime,
        hybridValue: hybrid.averageResponseTime,
        improvementPercentage: performanceImprovement,
        significanceLevel: this.calculateSignificance(performanceImprovement),
        trend: 'improving',
        recommendation: this.generatePerformanceRecommendation(performanceImprovement)
      },
      errorRateComparison: {
        metric: 'Error Rate',
        currentValue: current.errorRate,
        hybridValue: hybrid.errorRate,
        improvementPercentage: reliabilityImprovement,
        significanceLevel: this.calculateSignificance(reliabilityImprovement),
        trend: 'improving',
        recommendation: this.generateReliabilityRecommendation(reliabilityImprovement)
      },
      captureRateComparison: {
        metric: 'Capture Success Rate',
        currentValue: current.captureSuccessRate,
        hybridValue: hybrid.captureSuccessRate,
        improvementPercentage: captureRateImprovement,
        significanceLevel: this.calculateSignificance(captureRateImprovement),
        trend: 'improving',
        recommendation: this.generateCaptureRecommendation(captureRateImprovement)
      },
      sessionRetentionComparison: {
        metric: 'Session Retention',
        currentValue: current.sessionRetentionRate,
        hybridValue: hybrid.sessionRetentionRate,
        improvementPercentage: 0,
        significanceLevel: 'low',
        trend: 'stable',
        recommendation: 'Continuar monitoreando retención de sesiones'
      },
      resourceUsageComparison: {
        metric: 'Resource Usage',
        currentValue: (current.averageCpuUsage + current.averageMemoryUsage) / 2,
        hybridValue: (hybrid.averageCpuUsage + hybrid.averageMemoryUsage) / 2,
        improvementPercentage: 0,
        significanceLevel: 'medium',
        trend: 'stable',
        recommendation: 'Optimizar uso de recursos en módulos híbridos'
      }
    };
  }

  private async generateInsights(
    systemMetrics: SystemMetrics,
    comparisonMetrics: ComparisonMetrics
  ): Promise<MetricInsight[]> {
    const insights: MetricInsight[] = [];

    // Insight sobre mejora de rendimiento
    if (comparisonMetrics.performanceImprovement > 20) {
      insights.push({
        type: 'optimization_opportunity',
        severity: 'info',
        title: 'Significativa mejora en rendimiento',
        description: `El sistema híbrido muestra una mejora del ${comparisonMetrics.performanceImprovement.toFixed(1)}% en tiempo de respuesta`,
        impact: 'Mejor experiencia de usuario y mayor eficiencia operacional',
        evidenceData: {
          currentResponseTime: systemMetrics.current.averageResponseTime,
          hybridResponseTime: systemMetrics.hybrid.averageResponseTime,
          improvement: comparisonMetrics.performanceImprovement
        },
        confidence: 0.9
      });
    }

    // Insight sobre reducción de errores
    if (comparisonMetrics.reliabilityImprovement > 30) {
      insights.push({
        type: 'error_cluster',
        severity: 'warning',
        title: 'Reducción significativa de errores',
        description: `El sistema híbrido reduce la tasa de error en ${comparisonMetrics.reliabilityImprovement.toFixed(1)}%`,
        impact: 'Mayor confiabilidad y menos interrupciones del servicio',
        evidenceData: {
          currentErrorRate: systemMetrics.current.errorRate,
          hybridErrorRate: systemMetrics.hybrid.errorRate,
          reduction: comparisonMetrics.reliabilityImprovement
        },
        confidence: 0.85
      });
    }

    // Insight sobre uso de recursos
    if (systemMetrics.hybrid.averageMemoryUsage > systemMetrics.current.averageMemoryUsage * 1.2) {
      insights.push({
        type: 'capacity_warning',
        severity: 'warning',
        title: 'Mayor uso de memoria en sistema híbrido',
        description: 'Los módulos híbridos requieren más memoria que el sistema actual',
        impact: 'Posible necesidad de optimización o aumento de recursos',
        evidenceData: {
          currentMemoryUsage: systemMetrics.current.averageMemoryUsage,
          hybridMemoryUsage: systemMetrics.hybrid.averageMemoryUsage,
          increase: ((systemMetrics.hybrid.averageMemoryUsage / systemMetrics.current.averageMemoryUsage) - 1) * 100
        },
        confidence: 0.75
      });
    }

    return insights;
  }

  private async generateRecommendations(
    systemMetrics: SystemMetrics,
    comparisonMetrics: ComparisonMetrics,
    insights: MetricInsight[]
  ): Promise<MetricRecommendation[]> {
    const recommendations: MetricRecommendation[] = [];

    // Recomendación basada en mejora de rendimiento
    if (comparisonMetrics.performanceImprovement > 15) {
      recommendations.push({
        id: 'expand_hybrid_adoption',
        category: 'performance',
        priority: 'high',
        title: 'Expandir adopción de sistema híbrido',
        description: 'Los datos muestran mejoras significativas. Considerar habilitar módulos híbridos en más templates.',
        expectedImpact: `Mejora estimada del ${comparisonMetrics.performanceImprovement.toFixed(1)}% en rendimiento general`,
        implementationComplexity: 'medium',
        estimatedTimeToImplement: 7,
        requiredResources: ['equipo técnico', 'período de testing'],
        riskLevel: 'low'
      });
    }

    // Recomendación basada en reducción de errores
    if (comparisonMetrics.reliabilityImprovement > 20) {
      recommendations.push({
        id: 'prioritize_error_prone_templates',
        category: 'reliability',
        priority: 'critical',
        title: 'Priorizar templates con alta tasa de error',
        description: 'Migrar templates con mayor tasa de error al sistema híbrido para mejorar confiabilidad.',
        expectedImpact: `Reducción estimada del ${comparisonMetrics.reliabilityImprovement.toFixed(1)}% en errores`,
        implementationComplexity: 'low',
        estimatedTimeToImplement: 3,
        requiredResources: ['configuración de templates'],
        riskLevel: 'low'
      });
    }

    return recommendations;
  }

  /**
   * MÉTODOS AUXILIARES DE CÁLCULO
   */

  private calculateImprovement(currentValue: number, hybridValue: number, direction: 'higher_is_better' | 'lower_is_better'): number {
    if (currentValue === 0) return 0;
    
    const change = ((currentValue - hybridValue) / currentValue) * 100;
    
    return direction === 'lower_is_better' ? change : -change;
  }

  private calculateSignificance(improvement: number): 'low' | 'medium' | 'high' | 'very_high' {
    const abs = Math.abs(improvement);
    if (abs < 5) return 'low';
    if (abs < 15) return 'medium';
    if (abs < 30) return 'high';
    return 'very_high';
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
  }

  private calculateTemplateDistribution(events: MetricEvent[]): Map<string, TemplateMetrics> {
    const distribution = new Map<string, TemplateMetrics>();
    
    const templateGroups = this.groupBy(events, 'templateId');
    
    for (const [templateId, templateEvents] of templateGroups) {
      const requests = templateEvents.length;
      const errors = templateEvents.filter(e => e.data.errorOccurred).length;
      const responseTimes = templateEvents
        .filter(e => e.data.responseTime !== undefined)
        .map(e => e.data.responseTime!);
      
      distribution.set(templateId, {
        templateId,
        templateName: `Template ${templateId}`,
        requests,
        successRate: requests > 0 ? (requests - errors) / requests : 0,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0,
        errorRate: requests > 0 ? errors / requests : 0
      });
    }
    
    return distribution;
  }

  private calculateTenantDistribution(events: MetricEvent[]): Map<string, TenantMetrics> {
    const distribution = new Map<string, TenantMetrics>();
    
    const tenantGroups = this.groupBy(events, 'tenantId');
    
    for (const [tenantId, tenantEvents] of tenantGroups) {
      const requests = tenantEvents.length;
      const errors = tenantEvents.filter(e => e.data.errorOccurred).length;
      const responseTimes = tenantEvents
        .filter(e => e.data.responseTime !== undefined)
        .map(e => e.data.responseTime!);
      
      const uniqueUsers = new Set(tenantEvents.map(e => e.userId).filter(Boolean)).size;
      
      distribution.set(tenantId, {
        tenantId,
        requests,
        successRate: requests > 0 ? (requests - errors) / requests : 0,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0,
        activeUsers: uniqueUsers,
        systemPreference: 'hybrid' // Placeholder
      });
    }
    
    return distribution;
  }

  private calculateModuleUsage(events: MetricEvent[]): Map<HybridModuleName, ModuleMetrics> {
    const usage = new Map<HybridModuleName, ModuleMetrics>();
    
    const moduleEvents = events.filter(e => e.data.modulesUsed && e.data.modulesUsed.length > 0);
    
    const allModules: HybridModuleName[] = [
      'enhancedDataCapture',
      'improvedSessionManager',
      'dynamicNavigation',
      'nodeProcessingQueue',
      'flowValidationService',
      'navigationErrorHandler'
    ];
    
    for (const module of allModules) {
      const moduleUsageEvents = moduleEvents.filter(e => 
        e.data.modulesUsed?.includes(module)
      );
      
      const usageCount = moduleUsageEvents.length;
      const errors = moduleUsageEvents.filter(e => e.data.errorOccurred).length;
      
      usage.set(module, {
        moduleName: module,
        usageCount,
        successRate: usageCount > 0 ? (usageCount - errors) / usageCount : 0,
        averagePerformanceImpact: 0, // Placeholder
        errorReduction: 0 // Placeholder
      });
    }
    
    return usage;
  }

  private calculateThroughput(events: MetricEvent[]): number {
    if (events.length === 0) return 0;
    
    const sortedEvents = events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const firstEvent = new Date(sortedEvents[0].timestamp);
    const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
    const durationSeconds = (lastEvent.getTime() - firstEvent.getTime()) / 1000;
    
    return durationSeconds > 0 ? events.length / durationSeconds : 0;
  }

  private calculateConcurrentUsers(events: MetricEvent[]): number {
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean));
    return uniqueUsers.size;
  }

  private calculateAverageSessionDuration(events: MetricEvent[]): number {
    const sessionEvents = events.filter(e => 
      e.eventType === 'conversation_start' || e.eventType === 'conversation_end'
    );
    
    const sessionDurations = sessionEvents
      .filter(e => e.data.customMetrics?.sessionDuration)
      .map(e => e.data.customMetrics!.sessionDuration);
    
    return sessionDurations.length > 0 
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length 
      : 0;
  }

  private calculateResourceUsage(events: MetricEvent[], metric: string): number {
    const resourceEvents = events.filter(e => 
      e.data.customMetrics && e.data.customMetrics[metric] !== undefined
    );
    
    if (resourceEvents.length === 0) return 0;
    
    const values = resourceEvents.map(e => e.data.customMetrics![metric]);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private estimateResourceCost(events: MetricEvent[]): number {
    // Estimación simple basada en eventos procesados
    const baseCostPerEvent = 0.001; // $0.001 por evento
    return events.length * baseCostPerEvent;
  }

  private calculateCostEffectiveness(current: SystemPerformanceMetrics, hybrid: SystemPerformanceMetrics): number {
    const costDifference = hybrid.resourceCostEstimate - current.resourceCostEstimate;
    const benefitScore = (hybrid.captureSuccessRate - current.captureSuccessRate) * 100 +
                        (current.errorRate - hybrid.errorRate) * 100;
    
    return costDifference > 0 ? benefitScore / costDifference : benefitScore;
  }

  private generatePerformanceRecommendation(improvement: number): string {
    if (improvement > 20) return 'Expandir uso de módulos híbridos';
    if (improvement > 10) return 'Continuar monitoreando y optimizar';
    return 'Evaluar costo-beneficio de módulos híbridos';
  }

  private generateReliabilityRecommendation(improvement: number): string {
    if (improvement > 30) return 'Migrar templates críticos al sistema híbrido';
    if (improvement > 15) return 'Priorizar templates con alta tasa de error';
    return 'Analizar causas específicas de errores';
  }

  private generateCaptureRecommendation(improvement: number): string {
    if (improvement > 25) return 'Habilitar módulo de captura mejorada en todos los templates';
    if (improvement > 10) return 'Implementar gradualmente en templates problemáticos';
    return 'Analizar patrones de fallo de captura';
  }

  /**
   * MÉTODOS AUXILIARES GENERALES
   */

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(query: MetricsQuery): string {
    return `metrics_${JSON.stringify(query)}`.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private generateAggregationId(): string {
    return `agg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private groupBy<T>(array: T[], key: keyof T): Map<any, T[]> {
    const groups = new Map();
    
    for (const item of array) {
      const groupKey = item[key];
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(item);
    }
    
    return groups;
  }

  private calculateCompleteness(events: MetricEvent[], query: MetricsQuery): number {
    // Estimación simple de completitud basada en densidad de eventos
    const expectedEvents = this.estimateExpectedEvents(query);
    return expectedEvents > 0 ? Math.min(events.length / expectedEvents, 1) : 1;
  }

  private calculateConfidence(events: MetricEvent[]): number {
    // Confianza basada en cantidad de datos
    if (events.length > 1000) return 0.95;
    if (events.length > 500) return 0.85;
    if (events.length > 100) return 0.75;
    if (events.length > 50) return 0.65;
    return 0.5;
  }

  private estimateExpectedEvents(query: MetricsQuery): number {
    const duration = new Date(query.timeRange.endDate).getTime() - 
                    new Date(query.timeRange.startDate).getTime();
    const hours = duration / (1000 * 60 * 60);
    
    // Estimación: ~100 eventos por hora por template activo
    return Math.floor(hours * 100);
  }

  private applyFilter(event: MetricEvent, filter: MetricFilter): boolean {
    const value = this.getEventFieldValue(event, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return value === filter.value;
      case 'not_equals':
        return value !== filter.value;
      case 'greater_than':
        return Number(value) > Number(filter.value);
      case 'less_than':
        return Number(value) < Number(filter.value);
      case 'contains':
        return String(value).includes(String(filter.value));
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value);
      default:
        return true;
    }
  }

  private getEventFieldValue(event: MetricEvent, field: string): any {
    const parts = field.split('.');
    let value: any = event;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private updateRealTimeMetrics(event: MetricEvent): void {
    const systemKey = event.system;
    const current = this.realTimeMetrics.get(systemKey) || {};
    
    // Actualizar contadores básicos
    current.totalRequests = (current.totalRequests || 0) + 1;
    
    if (event.data.errorOccurred) {
      current.errorCount = (current.errorCount || 0) + 1;
    } else {
      current.successCount = (current.successCount || 0) + 1;
    }
    
    // Actualizar tiempo de respuesta promedio
    if (event.data.responseTime) {
      const currentAvg = current.averageResponseTime || 0;
      const currentCount = current.responseTimeCount || 0;
      
      current.averageResponseTime = (currentAvg * currentCount + event.data.responseTime) / (currentCount + 1);
      current.responseTimeCount = currentCount + 1;
    }
    
    // Actualizar tasa de captura
    if (event.eventType === 'capture_success' || event.eventType === 'capture_failure') {
      current.captureAttempts = (current.captureAttempts || 0) + 1;
      if (event.eventType === 'capture_success') {
        current.captureSuccesses = (current.captureSuccesses || 0) + 1;
      }
      current.captureSuccessRate = current.captureSuccesses / current.captureAttempts;
    }
    
    current.lastUpdated = event.timestamp;
    this.realTimeMetrics.set(systemKey, current);
  }

  private checkAlerts(event: MetricEvent): void {
    // Verificar umbrales de alerta
    const metrics = this.realTimeMetrics.get(event.system);
    if (!metrics) return;
    
    // Alert por alta tasa de error
    if (metrics.errorCount && metrics.totalRequests) {
      const errorRate = metrics.errorCount / metrics.totalRequests;
      if (errorRate > this.config.alertThresholds.errorRateThreshold) {
        this.triggerAlert('high_error_rate', {
          system: event.system,
          errorRate,
          threshold: this.config.alertThresholds.errorRateThreshold
        });
      }
    }
    
    // Alert por tiempo de respuesta alto
    if (metrics.averageResponseTime > this.config.alertThresholds.responseTimeThreshold) {
      this.triggerAlert('high_response_time', {
        system: event.system,
        responseTime: metrics.averageResponseTime,
        threshold: this.config.alertThresholds.responseTimeThreshold
      });
    }
  }

  private triggerAlert(alertType: string, data: any): void {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      data
    };
    
    logger.warn(`[HybridMetricsCollectorService] ALERTA: ${alertType}`, alert);
    
    // Notificar suscriptores
    for (const callback of this.alertSubscribers.values()) {
      try {
        callback(alert);
      } catch (error) {
        logger.error(`[HybridMetricsCollectorService] Error notificando alerta:`, error);
      }
    }
  }

  private startAggregationTimer(): void {
    // Procesar buffer cada 5 minutos
    this.aggregationTimer = setInterval(() => {
      this.processEventBuffer();
    }, 300000);
    
    logger.debug(`[HybridMetricsCollectorService] Timer de agregación iniciado`);
  }

  private processEventBuffer(): void {
    if (this.eventBuffer.length === 0) return;
    
    logger.debug(`[HybridMetricsCollectorService] Procesando ${this.eventBuffer.length} eventos del buffer`);
    
    // En implementación real, persistir eventos en base de datos
    // Por ahora, mantener en memoria con límite
    if (this.eventBuffer.length > 10000) {
      this.eventBuffer = this.eventBuffer.slice(-5000); // Mantener solo los últimos 5000
    }
    
    // Limpiar caché de agregaciones antiguas
    this.cleanupAggregationCache();
  }

  private cleanupAggregationCache(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hora
    
    for (const [key, aggregation] of this.aggregationCache) {
      const age = now - new Date(aggregation.metadata.generatedAt).getTime();
      if (age > maxAge) {
        this.aggregationCache.delete(key);
      }
    }
  }

  /**
   * MÉTODOS PÚBLICOS PARA GESTIÓN
   */

  subscribeToAlerts(subscriberId: string, callback: (alert: any) => void): void {
    this.alertSubscribers.set(subscriberId, callback);
    logger.debug(`[HybridMetricsCollectorService] Suscriptor ${subscriberId} registrado para alertas`);
  }

  unsubscribeFromAlerts(subscriberId: string): void {
    this.alertSubscribers.delete(subscriberId);
    logger.debug(`[HybridMetricsCollectorService] Suscriptor ${subscriberId} eliminado`);
  }

  updateConfiguration(newConfig: Partial<MetricsConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[HybridMetricsCollectorService] Configuración actualizada`);
  }

  getConfiguration(): MetricsConfiguration {
    return { ...this.config };
  }

  clearEventBuffer(): void {
    this.eventBuffer = [];
    logger.info(`[HybridMetricsCollectorService] Buffer de eventos limpiado`);
  }

  getEventBufferSize(): number {
    return this.eventBuffer.length;
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    this.eventBuffer = [];
    this.aggregationCache.clear();
    this.realTimeMetrics.clear();
    this.alertSubscribers.clear();
    
    logger.info(`[HybridMetricsCollectorService] Servicio destruido`);
  }
}

export default HybridMetricsCollectorService;
export type {
  MetricEvent,
  MetricsAggregation,
  MetricsQuery,
  SystemPerformanceMetrics,
  ComparisonMetrics,
  MetricInsight,
  MetricRecommendation,
  MetricsConfiguration
};