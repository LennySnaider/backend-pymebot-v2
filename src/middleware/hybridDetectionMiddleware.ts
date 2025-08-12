/**
 * HYBRID DETECTION MIDDLEWARE
 * 
 * PROPÓSITO: Middleware inteligente que detecta automáticamente cuándo usar módulos híbridos
 * BASADO EN: Análisis de patrones de uso y detección automática de problemas
 * PRESERVA: Sistema actual 100% intacto - solo agrega inteligencia de routing
 * TRANSPARENTE: Funcionamiento completamente invisible para el usuario
 * 
 * FUNCIONALIDADES:
 * - Detección automática en tiempo real de problemas de captura
 * - Análisis de patrones de comportamiento de templates
 * - Switch automático a módulos híbridos cuando sea necesario
 * - Fallback transparente al sistema actual en caso de errores
 * - Métricas en tiempo real de efectividad
 * - Configuración granular por tenant/template/usuario
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import TemplateDetectorService from '../utils/templateDetector';
import SystemRouterService from '../utils/systemRouter';
import HybridTemplateManagerService from '../utils/hybridTemplateManager';
import HybridMetricsCollectorService from '../utils/hybridMetricsCollector';
import FallbackManagerService from '../utils/fallbackManager';

import type { 
  RoutingDecision, 
  RoutingContext 
} from '../utils/systemRouter';
import type { ChatbotTemplate } from '../types/Template';

// INTERFACES PARA MIDDLEWARE

interface HybridMiddlewareConfig {
  enabled: boolean;
  autoDetectionEnabled: boolean;
  fallbackEnabled: boolean;
  metricsEnabled: boolean;
  debugMode: boolean;
  analysisThreshold: number; // 0-1, qué tan sensible es la detección
  detectionRules: DetectionRuleConfig[];
  tenantOverrides: Map<string, TenantMiddlewareConfig>;
}

interface DetectionRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  triggers: DetectionTrigger[];
  actions: DetectionAction[];
}

interface DetectionTrigger {
  type: 'error_rate' | 'response_time' | 'capture_failure' | 'session_drop' | 'user_complaint';
  threshold: number;
  timeWindow: number; // minutos
  sampleSize: number; // mínimo de muestras para activar
}

interface DetectionAction {
  type: 'enable_hybrid' | 'disable_hybrid' | 'notify_admin' | 'collect_metrics' | 'fallback';
  parameters: Record<string, any>;
}

interface TenantMiddlewareConfig {
  tenantId: string;
  hybridEnabled: boolean;
  customThreshold: number;
  excludedTemplates: string[];
  forcedHybridTemplates: string[];
  customRules: DetectionRuleConfig[];
}

interface RequestContext {
  requestId: string;
  timestamp: string;
  tenantId?: string;
  templateId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  platform?: string;
  originalUrl: string;
  method: string;
}

interface DetectionResult {
  shouldUseHybrid: boolean;
  confidence: number;
  reasoning: string[];
  detectedIssues: string[];
  recommendedModules: string[];
  fallbackPlan: string[];
  metadata: any;
}

/**
 * CLASE PRINCIPAL DEL MIDDLEWARE
 */
class HybridDetectionMiddleware {
  private static instance: HybridDetectionMiddleware;
  private config: HybridMiddlewareConfig;
  private templateDetector: TemplateDetectorService;
  private systemRouter: SystemRouterService;
  private hybridTemplateManager: HybridTemplateManagerService;
  private metricsCollector: HybridMetricsCollectorService;
  private fallbackManager: FallbackManagerService;
  
  // CACHE DE DETECCIONES RECIENTES
  private detectionCache: Map<string, DetectionResult> = new Map();
  private performanceCache: Map<string, PerformanceMetrics> = new Map();
  
  // ESTADÍSTICAS EN TIEMPO REAL
  private realtimeStats = {
    totalRequests: 0,
    hybridRequests: 0,
    currentRequests: 0,
    autoDetections: 0,
    fallbacks: 0,
    errors: 0
  };

  private constructor() {
    // CONFIGURACIÓN POR DEFECTO (CONSERVADORA)
    this.config = {
      enabled: false, // Por defecto deshabilitado para seguridad
      autoDetectionEnabled: true,
      fallbackEnabled: true,
      metricsEnabled: true,
      debugMode: false,
      analysisThreshold: 0.7, // 70% de confianza mínima
      detectionRules: this.getDefaultDetectionRules(),
      tenantOverrides: new Map()
    };

    // INICIALIZAR SERVICIOS
    this.templateDetector = TemplateDetectorService.getInstance();
    this.systemRouter = SystemRouterService.getInstance();
    this.hybridTemplateManager = HybridTemplateManagerService.getInstance();
    this.metricsCollector = HybridMetricsCollectorService.getInstance();
    this.fallbackManager = FallbackManagerService.getInstance();

    logger.info('[HybridDetectionMiddleware] Middleware inicializado');
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(): HybridDetectionMiddleware {
    if (!HybridDetectionMiddleware.instance) {
      HybridDetectionMiddleware.instance = new HybridDetectionMiddleware();
    }
    return HybridDetectionMiddleware.instance;
  }

  /**
   * MÉTODO: Obtener reglas de detección por defecto
   */
  private getDefaultDetectionRules(): DetectionRuleConfig[] {
    return [
      {
        id: 'high_error_rate',
        name: 'Tasa de Error Alta',
        enabled: true,
        priority: 'critical',
        triggers: [
          {
            type: 'error_rate',
            threshold: 0.15, // 15% de errores
            timeWindow: 5, // en 5 minutos
            sampleSize: 10 // mínimo 10 requests
          }
        ],
        actions: [
          {
            type: 'enable_hybrid',
            parameters: { modules: ['enhancedDataCapture', 'improvedSessionManager'] }
          },
          {
            type: 'notify_admin',
            parameters: { severity: 'high' }
          }
        ]
      },
      {
        id: 'poor_capture_rate',
        name: 'Baja Tasa de Captura',
        enabled: true,
        priority: 'high',
        triggers: [
          {
            type: 'capture_failure',
            threshold: 0.3, // 30% de fallos de captura
            timeWindow: 10, // en 10 minutos
            sampleSize: 5 // mínimo 5 intentos
          }
        ],
        actions: [
          {
            type: 'enable_hybrid',
            parameters: { modules: ['enhancedDataCapture'] }
          }
        ]
      },
      {
        id: 'session_instability',
        name: 'Inestabilidad de Sesiones',
        enabled: true,
        priority: 'medium',
        triggers: [
          {
            type: 'session_drop',
            threshold: 0.25, // 25% de pérdida de sesiones
            timeWindow: 15, // en 15 minutos
            sampleSize: 8 // mínimo 8 sesiones
          }
        ],
        actions: [
          {
            type: 'enable_hybrid',
            parameters: { modules: ['improvedSessionManager'] }
          }
        ]
      },
      {
        id: 'slow_response_time',
        name: 'Tiempo de Respuesta Lento',
        enabled: true,
        priority: 'medium',
        triggers: [
          {
            type: 'response_time',
            threshold: 3000, // 3 segundos
            timeWindow: 5, // en 5 minutos
            sampleSize: 5 // mínimo 5 requests
          }
        ],
        actions: [
          {
            type: 'enable_hybrid',
            parameters: { modules: ['nodeProcessingQueue'] }
          }
        ]
      }
    ];
  }

  /**
   * MÉTODO PRINCIPAL: Middleware de Express
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      try {
        // INCREMENTAR CONTADOR DE REQUESTS
        this.realtimeStats.totalRequests++;

        // VERIFICAR SI EL MIDDLEWARE ESTÁ HABILITADO
        if (!this.config.enabled) {
          if (this.config.debugMode) {
            logger.debug('[HybridDetectionMiddleware] Middleware deshabilitado, pasando al siguiente');
          }
          return next();
        }

        // EXTRAER CONTEXTO DEL REQUEST
        const context = this.extractRequestContext(req);

        if (this.config.debugMode) {
          logger.info(`[HybridDetectionMiddleware] 🔍 Analizando request:`, context);
        }

        // EJECUTAR DETECCIÓN AUTOMÁTICA
        const detectionResult = await this.executeAutoDetection(context, req);

        // AGREGAR RESULTADO AL REQUEST PARA USO POSTERIOR
        (req as any).hybridDetection = detectionResult;

        // REGISTRAR MÉTRICAS
        if (this.config.metricsEnabled) {
          await this.recordMiddlewareMetrics(context, detectionResult, Date.now() - startTime);
        }

        // LOGGING DE DEBUGGING
        if (this.config.debugMode) {
          logger.info(`[HybridDetectionMiddleware] ✅ Detección completada:`, {
            shouldUseHybrid: detectionResult.shouldUseHybrid,
            confidence: detectionResult.confidence,
            reasoning: detectionResult.reasoning,
            processingTime: Date.now() - startTime
          });
        }

        next();

      } catch (error) {
        logger.error(`[HybridDetectionMiddleware] ❌ Error en middleware:`, error);
        this.realtimeStats.errors++;

        // CONTINUAR SIN DETECCIÓN EN CASO DE ERROR
        (req as any).hybridDetection = {
          shouldUseHybrid: false,
          confidence: 0,
          reasoning: [`Error en detección: ${error?.message}`],
          detectedIssues: [],
          recommendedModules: [],
          fallbackPlan: ['Usar sistema actual por error en middleware'],
          metadata: { error: error?.message }
        };

        next(); // Continuar sin fallar
      }
    };
  }

  /**
   * MÉTODO: Extraer contexto del request
   */
  private extractRequestContext(req: Request): RequestContext {
    return {
      requestId: req.headers['x-request-id'] as string || `req_${Date.now()}`,
      timestamp: new Date().toISOString(),
      tenantId: req.body?.tenantId || req.query?.tenantId as string,
      templateId: req.body?.templateId || req.query?.templateId as string,
      userId: req.body?.userId || req.body?.phoneFrom || req.query?.userId as string,
      sessionId: req.body?.sessionId || req.query?.sessionId as string,
      userAgent: req.headers['user-agent'],
      platform: this.detectPlatform(req),
      originalUrl: req.originalUrl,
      method: req.method
    };
  }

  /**
   * MÉTODO: Detectar plataforma del request
   */
  private detectPlatform(req: Request): string {
    const userAgent = req.headers['user-agent']?.toLowerCase() || '';
    
    if (userAgent.includes('whatsapp')) return 'whatsapp';
    if (userAgent.includes('telegram')) return 'telegram';
    if (req.originalUrl.includes('/api/')) return 'api';
    
    return 'web';
  }

  /**
   * MÉTODO: Ejecutar detección automática
   */
  private async executeAutoDetection(context: RequestContext, req: Request): Promise<DetectionResult> {
    try {
      // VERIFICAR CACHÉ PRIMERO
      const cacheKey = `${context.tenantId}:${context.templateId}:${context.userId}`;
      const cached = this.detectionCache.get(cacheKey);
      
      if (cached) {
        if (this.config.debugMode) {
          logger.debug(`[HybridDetectionMiddleware] 📄 Usando resultado del caché`);
        }
        return cached;
      }

      // VERIFICAR OVERRIDE POR TENANT
      const tenantOverride = this.config.tenantOverrides.get(context.tenantId || '');
      if (tenantOverride) {
        return this.processTenantOverride(tenantOverride, context);
      }

      // VERIFICAR SI NO HAY DETECCIÓN AUTOMÁTICA
      if (!this.config.autoDetectionEnabled) {
        return {
          shouldUseHybrid: false,
          confidence: 1.0,
          reasoning: ['Detección automática deshabilitada'],
          detectedIssues: [],
          recommendedModules: [],
          fallbackPlan: ['Usar sistema actual'],
          metadata: { autoDetectionDisabled: true }
        };
      }

      // EJECUTAR ANÁLISIS AUTOMÁTICO
      const analysisResult = await this.performAutomaticAnalysis(context, req);

      // APLICAR REGLAS DE DETECCIÓN
      const rulesResult = await this.applyDetectionRules(context, req);

      // COMBINAR RESULTADOS
      const combinedResult = this.combineDetectionResults(analysisResult, rulesResult, context);

      // GUARDAR EN CACHÉ
      this.detectionCache.set(cacheKey, combinedResult);
      
      // LIMPIAR CACHÉ DESPUÉS DE 5 MINUTOS
      setTimeout(() => {
        this.detectionCache.delete(cacheKey);
      }, 5 * 60 * 1000);

      return combinedResult;

    } catch (error) {
      logger.error(`[HybridDetectionMiddleware] Error en detección automática:`, error);
      
      return {
        shouldUseHybrid: false,
        confidence: 0,
        reasoning: [`Error en análisis: ${error?.message}`],
        detectedIssues: [`Error de detección: ${error?.message}`],
        recommendedModules: [],
        fallbackPlan: ['Usar sistema actual por error'],
        metadata: { error: error?.message }
      };
    }
  }

  /**
   * MÉTODO: Procesar override por tenant
   */
  private processTenantOverride(tenantConfig: TenantMiddlewareConfig, context: RequestContext): DetectionResult {
    const templateId = context.templateId || '';
    
    // Verificar templates excluidos
    if (tenantConfig.excludedTemplates.includes(templateId)) {
      return {
        shouldUseHybrid: false,
        confidence: 1.0,
        reasoning: ['Template excluido en configuración de tenant'],
        detectedIssues: [],
        recommendedModules: [],
        fallbackPlan: ['Usar sistema actual'],
        metadata: { tenantExcluded: true }
      };
    }

    // Verificar templates forzados a híbrido
    if (tenantConfig.forcedHybridTemplates.includes(templateId)) {
      return {
        shouldUseHybrid: true,
        confidence: 1.0,
        reasoning: ['Template configurado para usar módulos híbridos'],
        detectedIssues: [],
        recommendedModules: ['enhancedDataCapture', 'improvedSessionManager'],
        fallbackPlan: ['Fallback al sistema actual si hay errores'],
        metadata: { tenantForced: true }
      };
    }

    // Usar configuración por defecto del tenant
    return {
      shouldUseHybrid: tenantConfig.hybridEnabled,
      confidence: tenantConfig.customThreshold,
      reasoning: [`Configuración de tenant: ${tenantConfig.hybridEnabled ? 'híbrido habilitado' : 'híbrido deshabilitado'}`],
      detectedIssues: [],
      recommendedModules: tenantConfig.hybridEnabled ? ['enhancedDataCapture'] : [],
      fallbackPlan: ['Usar configuración de tenant'],
      metadata: { tenantConfig: true }
    };
  }

  /**
   * MÉTODO: Realizar análisis automático
   */
  private async performAutomaticAnalysis(context: RequestContext, req: Request): Promise<Partial<DetectionResult>> {
    try {
      if (!context.templateId || !context.tenantId) {
        return {
          shouldUseHybrid: false,
          confidence: 0,
          reasoning: ['Faltan templateId o tenantId para análisis']
        };
      }

      // CREAR MOCK DEL TEMPLATE PARA ANÁLISIS
      const templateMock: ChatbotTemplate = {
        id: context.templateId,
        name: `Template ${context.templateId}`,
        tenant_id: context.tenantId,
        template_data: JSON.stringify({}), // En implementación real se cargaría de BD
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // USAR TEMPLATE DETECTOR
      const analysisResult = await this.templateDetector.analyzeTemplate(templateMock);

      return {
        shouldUseHybrid: analysisResult.needsHybridModules && analysisResult.analysisScore >= this.config.analysisThreshold,
        confidence: analysisResult.analysisScore,
        reasoning: [`Análisis automático: score ${Math.round(analysisResult.analysisScore * 100)}%`],
        detectedIssues: analysisResult.detectedIssues.map(issue => issue.description),
        recommendedModules: analysisResult.recommendedModules.map(module => module.moduleName)
      };

    } catch (error) {
      logger.warn(`[HybridDetectionMiddleware] Error en análisis automático:`, error);
      return {
        shouldUseHybrid: false,
        confidence: 0,
        reasoning: [`Error en análisis automático: ${error?.message}`]
      };
    }
  }

  /**
   * MÉTODO: Aplicar reglas de detección
   */
  private async applyDetectionRules(context: RequestContext, req: Request): Promise<Partial<DetectionResult>> {
    try {
      const activeRules = this.config.detectionRules.filter(rule => rule.enabled);
      const triggeredRules: DetectionRuleConfig[] = [];

      for (const rule of activeRules) {
        const isTriggered = await this.evaluateRule(rule, context, req);
        if (isTriggered) {
          triggeredRules.push(rule);
        }
      }

      if (triggeredRules.length === 0) {
        return {
          shouldUseHybrid: false,
          confidence: 0.8,
          reasoning: ['Ninguna regla de detección activada']
        };
      }

      // EVALUAR PRIORIDAD DE REGLAS ACTIVADAS
      const highestPriority = this.getHighestPriority(triggeredRules);
      const recommendedModules = this.extractRecommendedModules(triggeredRules);

      return {
        shouldUseHybrid: true,
        confidence: this.calculateRulesConfidence(triggeredRules),
        reasoning: [`${triggeredRules.length} reglas activadas`, `Prioridad más alta: ${highestPriority}`],
        detectedIssues: triggeredRules.map(rule => rule.name),
        recommendedModules
      };

    } catch (error) {
      logger.warn(`[HybridDetectionMiddleware] Error aplicando reglas:`, error);
      return {
        shouldUseHybrid: false,
        confidence: 0,
        reasoning: [`Error aplicando reglas: ${error?.message}`]
      };
    }
  }

  /**
   * MÉTODO: Evaluar regla específica
   */
  private async evaluateRule(rule: DetectionRuleConfig, context: RequestContext, req: Request): Promise<boolean> {
    try {
      for (const trigger of rule.triggers) {
        const isTriggered = await this.evaluateTrigger(trigger, context, req);
        if (isTriggered) {
          if (this.config.debugMode) {
            logger.debug(`[HybridDetectionMiddleware] 🚨 Regla activada: ${rule.name} (${trigger.type})`);
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.warn(`[HybridDetectionMiddleware] Error evaluando regla ${rule.id}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Evaluar trigger específico
   */
  private async evaluateTrigger(trigger: DetectionTrigger, context: RequestContext, req: Request): Promise<boolean> {
    try {
      // En implementación real, aquí se consultarían métricas reales
      // Por ahora, simularemos la evaluación basada en datos mock

      switch (trigger.type) {
        case 'error_rate':
          // Simular tasa de error del 5%
          const errorRate = 0.05;
          return errorRate > trigger.threshold;

        case 'capture_failure':
          // Simular tasa de fallo de captura del 10%
          const captureFailureRate = 0.10;
          return captureFailureRate > trigger.threshold;

        case 'session_drop':
          // Simular tasa de pérdida de sesión del 8%
          const sessionDropRate = 0.08;
          return sessionDropRate > trigger.threshold;

        case 'response_time':
          // Simular tiempo de respuesta de 2 segundos
          const responseTime = 2000;
          return responseTime > trigger.threshold;

        case 'user_complaint':
          // Simular 0 quejas de usuario
          const userComplaints = 0;
          return userComplaints > trigger.threshold;

        default:
          return false;
      }
    } catch (error) {
      logger.warn(`[HybridDetectionMiddleware] Error evaluando trigger ${trigger.type}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Combinar resultados de detección
   */
  private combineDetectionResults(
    analysisResult: Partial<DetectionResult>,
    rulesResult: Partial<DetectionResult>,
    context: RequestContext
  ): DetectionResult {
    const analysisWeight = 0.6;
    const rulesWeight = 0.4;

    const analysisConfidence = analysisResult.confidence || 0;
    const rulesConfidence = rulesResult.confidence || 0;

    const combinedConfidence = (analysisConfidence * analysisWeight) + (rulesConfidence * rulesWeight);
    const shouldUseHybrid = combinedConfidence >= this.config.analysisThreshold;

    return {
      shouldUseHybrid,
      confidence: combinedConfidence,
      reasoning: [
        ...(analysisResult.reasoning || []),
        ...(rulesResult.reasoning || []),
        `Confianza combinada: ${Math.round(combinedConfidence * 100)}%`
      ],
      detectedIssues: [
        ...(analysisResult.detectedIssues || []),
        ...(rulesResult.detectedIssues || [])
      ],
      recommendedModules: [
        ...new Set([
          ...(analysisResult.recommendedModules || []),
          ...(rulesResult.recommendedModules || [])
        ])
      ],
      fallbackPlan: shouldUseHybrid 
        ? ['Fallback automático al sistema actual en caso de errores'] 
        : ['Usar sistema actual'],
      metadata: {
        analysisResult,
        rulesResult,
        combinedConfidence,
        threshold: this.config.analysisThreshold,
        context
      }
    };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private getHighestPriority(rules: DetectionRuleConfig[]): string {
    const priorities = ['critical', 'high', 'medium', 'low'];
    for (const priority of priorities) {
      if (rules.some(rule => rule.priority === priority)) {
        return priority;
      }
    }
    return 'low';
  }

  private extractRecommendedModules(rules: DetectionRuleConfig[]): string[] {
    const modules = new Set<string>();
    for (const rule of rules) {
      for (const action of rule.actions) {
        if (action.type === 'enable_hybrid' && action.parameters.modules) {
          action.parameters.modules.forEach((module: string) => modules.add(module));
        }
      }
    }
    return Array.from(modules);
  }

  private calculateRulesConfidence(rules: DetectionRuleConfig[]): number {
    if (rules.length === 0) return 0;
    
    const priorityWeights = { critical: 1.0, high: 0.8, medium: 0.6, low: 0.4 };
    const totalWeight = rules.reduce((sum, rule) => sum + priorityWeights[rule.priority], 0);
    
    return Math.min(totalWeight / rules.length, 1.0);
  }

  /**
   * MÉTODO: Registrar métricas del middleware
   */
  private async recordMiddlewareMetrics(
    context: RequestContext,
    detectionResult: DetectionResult,
    processingTime: number
  ): Promise<void> {
    try {
      this.metricsCollector.recordEvent(
        'middleware_detection',
        detectionResult.shouldUseHybrid ? 'hybrid' : 'current',
        context.templateId || 'unknown',
        context.tenantId || 'unknown',
        {
          responseTime: processingTime,
          confidence: detectionResult.confidence,
          detectedIssues: detectionResult.detectedIssues.length,
          recommendedModules: detectionResult.recommendedModules
        },
        {
          platform: context.platform,
          userId: context.userId,
          requestId: context.requestId
        }
      );

      // ACTUALIZAR ESTADÍSTICAS EN TIEMPO REAL
      if (detectionResult.shouldUseHybrid) {
        this.realtimeStats.hybridRequests++;
        this.realtimeStats.autoDetections++;
      } else {
        this.realtimeStats.currentRequests++;
      }

    } catch (error) {
      logger.warn(`[HybridDetectionMiddleware] Error registrando métricas:`, error);
    }
  }

  /**
   * MÉTODOS PÚBLICOS DE CONFIGURACIÓN
   */

  enableMiddleware(config?: Partial<HybridMiddlewareConfig>): void {
    this.config = { ...this.config, enabled: true, ...config };
    logger.info(`[HybridDetectionMiddleware] ✅ Middleware habilitado`, this.config);
  }

  disableMiddleware(): void {
    this.config.enabled = false;
    logger.info(`[HybridDetectionMiddleware] ❌ Middleware deshabilitado`);
  }

  updateConfiguration(newConfig: Partial<HybridMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[HybridDetectionMiddleware] 🔧 Configuración actualizada`);
  }

  getConfiguration(): HybridMiddlewareConfig {
    return { ...this.config };
  }

  setTenantOverride(tenantId: string, config: TenantMiddlewareConfig): void {
    this.config.tenantOverrides.set(tenantId, config);
    logger.info(`[HybridDetectionMiddleware] Override configurado para tenant ${tenantId}`);
  }

  getRealtimeStats() {
    return { ...this.realtimeStats };
  }

  clearCache(): void {
    this.detectionCache.clear();
    this.performanceCache.clear();
    logger.info(`[HybridDetectionMiddleware] Caché limpiado`);
  }

  /**
   * MÉTODO: Destruir middleware
   */
  destroy(): void {
    this.clearCache();
    this.config.enabled = false;
    logger.info(`[HybridDetectionMiddleware] Middleware destruido`);
  }
}

// TIPOS AUXILIARES
interface PerformanceMetrics {
  captureSuccessRate: number;
  averageResponseTime: number;
  sessionDropRate: number;
  errorRate: number;
  userCompletionRate: number;
}

// EXPORTAR INSTANCIA SINGLETON Y TIPOS
const hybridDetectionMiddleware = HybridDetectionMiddleware.getInstance();

export default hybridDetectionMiddleware;
export { HybridDetectionMiddleware };
export type {
  HybridMiddlewareConfig,
  DetectionRuleConfig,
  TenantMiddlewareConfig,
  RequestContext,
  DetectionResult
};