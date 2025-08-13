/**
 * SYSTEM ROUTER SERVICE
 * 
 * PROPÓSITO: Router inteligente para decidir entre sistema actual vs módulos híbridos
 * BASADO EN: Análisis de detección de templates y patrones del v1-reference
 * PRESERVA: Sistema actual 100% intacto - solo routing condicional
 * TRANSPARENTE: Usuarios no perciben el cambio, funcionalidad es la misma
 * 
 * ESTRATEGIA DE ROUTING:
 * - Análisis automático de templates para determinar mejor sistema
 * - Fallback inmediato al sistema actual en caso de errores
 * - Métricas y logging para monitoreo de efectividad
 * - Configuración granular por tenant, template o usuario
 * - Preservación absoluta del sistema de leads
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import TemplateDetectorService from './templateDetector';
import type { 
  TemplateAnalysisResult, 
  PerformanceMetrics,
  HybridModuleName
} from './templateDetector';
// import type { ChatbotTemplate } from '../types/Template';
type ChatbotTemplate = any;

// INTERFACES PARA ROUTING DE SISTEMAS

interface RoutingDecision {
  shouldUseHybrid: boolean;
  systemToUse: 'current' | 'hybrid';
  confidence: number; // 0-1
  reasoning: RoutingReasoning;
  recommendedModules: HybridModuleName[];
  fallbackStrategy: FallbackStrategy;
  metadata: RoutingMetadata;
}

interface RoutingReasoning {
  primaryFactors: string[];
  detectedIssues: string[];
  riskAssessment: string;
  expectedBenefits: string[];
  potentialRisks: string[];
}

interface FallbackStrategy {
  enableAutoFallback: boolean;
  fallbackTriggers: FallbackTrigger[];
  maxRetries: number;
  fallbackTimeout: number;
  preserveUserSession: boolean;
  notifyOnFallback: boolean;
}

interface FallbackTrigger {
  type: 'error_rate' | 'response_time' | 'capture_failure' | 'session_loss' | 'user_complaint';
  threshold: number;
  timeWindow: number; // minutes
  action: 'immediate' | 'gradual' | 'scheduled';
}

interface RoutingMetadata {
  routingTimestamp: string;
  routingVersion: string;
  analysisId?: string;
  templateId: string;
  tenantId: string;
  userId?: string;
  requestId?: string;
  debugInfo?: Record<string, any>;
}

interface RoutingConfiguration {
  enableHybridRouting: boolean;
  routingStrategy: RoutingStrategy;
  confidenceThreshold: number; // 0.6 por defecto
  globalOverrides: GlobalOverrides;
  tenantOverrides: Map<string, TenantOverrides>;
  templateOverrides: Map<string, TemplateOverrides>;
  userOverrides: Map<string, UserOverrides>;
  performanceMonitoring: PerformanceMonitoringConfig;
  emergencyMode: EmergencyModeConfig;
}

interface GlobalOverrides {
  forceHybridAll: boolean;
  forceCurrentAll: boolean;
  enableABTesting: boolean;
  hybridRolloutPercentage: number; // 0-100
  excludeProduction: boolean;
}

interface TenantOverrides {
  tenantId: string;
  forceHybrid: boolean;
  forceCurrent: boolean;
  customThreshold?: number;
  enabledModules?: HybridModuleName[];
  disabledModules?: HybridModuleName[];
}

interface TemplateOverrides {
  templateId: string;
  forceHybrid: boolean;
  forceCurrent: boolean;
  requiredModules?: HybridModuleName[];
  customReasoning?: string;
}

interface UserOverrides {
  userId: string;
  preferredSystem: 'current' | 'hybrid' | 'auto';
  isTestUser: boolean;
  enableBetaFeatures: boolean;
}

interface PerformanceMonitoringConfig {
  enableMetrics: boolean;
  metricsInterval: number; // minutes
  performanceThresholds: {
    maxResponseTime: number;
    minSuccessRate: number;
    maxErrorRate: number;
  };
  enableAlerts: boolean;
  alertThresholds: {
    errorRateSpike: number;
    responseTimeDegradation: number;
  };
}

interface EmergencyModeConfig {
  enableEmergencyMode: boolean;
  emergencyTriggers: {
    systemErrorRate: number;
    hybridErrorRate: number;
    userComplaints: number;
  };
  emergencyActions: {
    disableHybrid: boolean;
    notifyAdmins: boolean;
    enableMaintenanceMode: boolean;
  };
}

type RoutingStrategy = 
  | 'conservative' // Solo usar híbrido en casos muy claros
  | 'balanced'     // Balance entre estabilidad y mejoras
  | 'aggressive'   // Usar híbrido cuando sea posible
  | 'experimental'; // Probar híbrido extensivamente

interface RoutingMetrics {
  totalRequests: number;
  hybridRequests: number;
  currentRequests: number;
  hybridSuccessRate: number;
  currentSuccessRate: number;
  avgHybridResponseTime: number;
  avgCurrentResponseTime: number;
  fallbackCount: number;
  errorBreakdown: Map<string, number>;
  userSatisfactionScore?: number;
}

interface RoutingContext {
  templateId: string;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  requestId: string;
  userAgent?: string;
  platform?: 'web' | 'whatsapp' | 'telegram' | 'api';
  isTestRequest?: boolean;
  customFlags?: Record<string, any>;
}

/**
 * SERVICIO PRINCIPAL DE ROUTING DE SISTEMAS
 */
class SystemRouterService {
  private static instance: SystemRouterService;
  private templateDetector: TemplateDetectorService;
  private config: RoutingConfiguration;
  private metrics: RoutingMetrics;
  private emergencyMode: boolean = false;
  private routingCache: Map<string, RoutingDecision> = new Map();
  private performanceData: Map<string, PerformanceMetrics> = new Map();

  private constructor(config: Partial<RoutingConfiguration> = {}) {
    this.config = {
      enableHybridRouting: true,
      routingStrategy: 'balanced',
      confidenceThreshold: 0.6,
      globalOverrides: {
        forceHybridAll: false,
        forceCurrentAll: false,
        enableABTesting: false,
        hybridRolloutPercentage: 100,
        excludeProduction: false
      },
      tenantOverrides: new Map(),
      templateOverrides: new Map(),
      userOverrides: new Map(),
      performanceMonitoring: {
        enableMetrics: true,
        metricsInterval: 5,
        performanceThresholds: {
          maxResponseTime: 3000,
          minSuccessRate: 0.95,
          maxErrorRate: 0.05
        },
        enableAlerts: true,
        alertThresholds: {
          errorRateSpike: 0.15,
          responseTimeDegradation: 2.0
        }
      },
      emergencyMode: {
        enableEmergencyMode: false, // DESHABILITADO: Evita falsos positivos durante bootstrap
        emergencyTriggers: {
          systemErrorRate: 0.2,
          hybridErrorRate: 0.3,
          userComplaints: 10
        },
        emergencyActions: {
          disableHybrid: true,
          notifyAdmins: true,
          enableMaintenanceMode: false
        }
      },
      ...config
    };

    this.metrics = {
      totalRequests: 0,
      hybridRequests: 0,
      currentRequests: 0,
      hybridSuccessRate: 0,
      currentSuccessRate: 0,
      avgHybridResponseTime: 0,
      avgCurrentResponseTime: 0,
      fallbackCount: 0,
      errorBreakdown: new Map()
    };

    this.templateDetector = TemplateDetectorService.getInstance();
    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<RoutingConfiguration>): SystemRouterService {
    if (!SystemRouterService.instance) {
      SystemRouterService.instance = new SystemRouterService(config);
    }
    return SystemRouterService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.startPerformanceMonitoring();
    logger.info(`[SystemRouterService] Servicio inicializado con estrategia ${this.config.routingStrategy}`);
  }

  /**
   * MÉTODO PRINCIPAL: Decidir qué sistema usar
   */
  async routeRequest(
    template: ChatbotTemplate,
    context: RoutingContext,
    options: {
      forceAnalysis?: boolean;
      includeDebugInfo?: boolean;
      skipCache?: boolean;
    } = {}
  ): Promise<RoutingDecision> {
    const startTime = Date.now();
    logger.info(`[SystemRouterService] Routing request para template ${template.name} (${template.id})`);

    try {
      // PASO 1: VERIFICAR MODO DE EMERGENCIA
      if (this.emergencyMode) {
        return this.createEmergencyDecision(template, context, 'Modo de emergencia activo');
      }

      // PASO 2: VERIFICAR SI EL ROUTING HÍBRIDO ESTÁ HABILITADO
      if (!this.config.enableHybridRouting) {
        return this.createCurrentSystemDecision(template, context, 'Routing híbrido deshabilitado');
      }

      // PASO 3: VERIFICAR OVERRIDES GLOBALES
      const globalOverride = this.checkGlobalOverrides(context);
      if (globalOverride) {
        return globalOverride;
      }

      // PASO 4: VERIFICAR OVERRIDES ESPECÍFICOS
      const specificOverride = this.checkSpecificOverrides(template, context);
      if (specificOverride) {
        return specificOverride;
      }

      // PASO 5: VERIFICAR CACHÉ SI NO ES ANÁLISIS FORZADO
      if (!options.forceAnalysis && !options.skipCache) {
        const cached = this.getRoutingFromCache(template.id, context);
        if (cached) {
          logger.debug(`[SystemRouterService] Decisión obtenida del caché para template ${template.id}`);
          return cached;
        }
      }

      // PASO 6: ANALIZAR TEMPLATE CON DETECTOR
      const analysisResult = await this.templateDetector.analyzeTemplate(
        template,
        {
          forceAnalysis: options.forceAnalysis,
          includePerformanceData: true,
          performanceMetrics: this.performanceData.get(template.id)
        }
      );

      // PASO 7: TOMAR DECISIÓN BASADA EN ANÁLISIS
      const decision = await this.makeRoutingDecision(
        template,
        context,
        analysisResult,
        options.includeDebugInfo
      );

      // PASO 8: ALMACENAR EN CACHÉ
      this.cacheRoutingDecision(template.id, context, decision);

      // PASO 9: ACTUALIZAR MÉTRICAS
      this.updateRoutingMetrics(decision, Date.now() - startTime);

      logger.info(`[SystemRouterService] Decisión tomada en ${Date.now() - startTime}ms: ${decision.systemToUse.toUpperCase()} (confianza: ${Math.round(decision.confidence * 100)}%)`);

      return decision;

    } catch (error) {
      logger.error(`[SystemRouterService] Error en routing para template ${template.id}:`, error);
      
      // FALLBACK AUTOMÁTICO AL SISTEMA ACTUAL EN CASO DE ERROR
      return this.createCurrentSystemDecision(
        template, 
        context, 
        `Error en routing: ${error}`
      );
    }
  }

  /**
   * MÉTODO: Tomar decisión de routing basada en análisis
   */
  private async makeRoutingDecision(
    template: ChatbotTemplate,
    context: RoutingContext,
    analysisResult: TemplateAnalysisResult,
    includeDebugInfo: boolean = false
  ): Promise<RoutingDecision> {
    const reasoning: RoutingReasoning = {
      primaryFactors: [],
      detectedIssues: [],
      riskAssessment: '',
      expectedBenefits: [],
      potentialRisks: []
    };

    // FACTOR 1: ANÁLISIS DE NECESIDAD DE MÓDULOS HÍBRIDOS
    const needsHybrid = analysisResult.needsHybridModules;
    if (needsHybrid) {
      reasoning.primaryFactors.push('Template requiere módulos híbridos según análisis');
    }

    // FACTOR 2: NIVEL DE CONFIANZA DEL ANÁLISIS
    const analysisConfidence = analysisResult.analysisScore;
    if (analysisConfidence >= this.config.confidenceThreshold) {
      reasoning.primaryFactors.push(`Análisis con alta confianza (${Math.round(analysisConfidence * 100)}%)`);
    }

    // FACTOR 3: NIVEL DE RIESGO
    const riskLevel = analysisResult.riskLevel;
    if (['high', 'critical'].includes(riskLevel)) {
      reasoning.primaryFactors.push(`Nivel de riesgo ${riskLevel} detectado`);
    }

    // FACTOR 4: PROBLEMAS CRÍTICOS DETECTADOS
    const criticalIssues = analysisResult.detectedIssues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      reasoning.detectedIssues = criticalIssues.map(issue => issue.description);
      reasoning.primaryFactors.push(`${criticalIssues.length} problemas críticos detectados`);
    }

    // FACTOR 5: ESTRATEGIA DE ROUTING CONFIGURADA
    const shouldUseHybridBasedOnStrategy = this.shouldUseHybridBasedOnStrategy(
      analysisResult,
      context
    );

    // DECISIÓN FINAL
    const shouldUseHybrid = needsHybrid && 
                           analysisConfidence >= this.config.confidenceThreshold &&
                           shouldUseHybridBasedOnStrategy;

    // CALCULAR CONFIANZA EN LA DECISIÓN
    const confidence = this.calculateDecisionConfidence(
      analysisResult,
      shouldUseHybrid,
      context
    );

    // DETERMINAR MÓDULOS RECOMENDADOS
    const recommendedModules = shouldUseHybrid 
      ? analysisResult.recommendedModules
        .filter(module => module.priority !== 'low')
        .map(module => module.moduleName)
      : [];

    // CONFIGURAR ESTRATEGIA DE FALLBACK
    const fallbackStrategy = this.createFallbackStrategy(analysisResult, context);

    // EVALUAR BENEFICIOS Y RIESGOS
    if (shouldUseHybrid) {
      reasoning.expectedBenefits = [
        'Mejora en tasa de captura de respuestas',
        'Reducción de errores de navegación',
        'Mejor preservación de contexto',
        'Manejo robusto de errores'
      ];
      reasoning.potentialRisks = [
        'Complejidad adicional en debugging',
        'Posible impacto en rendimiento inicial',
        'Curva de aprendizaje para el equipo'
      ];
    } else {
      reasoning.expectedBenefits = [
        'Estabilidad comprobada del sistema actual',
        'Simplicidad en mantenimiento',
        'Menor superficie de error'
      ];
      reasoning.potentialRisks = [
        'Persistencia de problemas de captura existentes',
        'Limitaciones en flujos complejos'
      ];
    }

    reasoning.riskAssessment = this.assessOverallRisk(analysisResult, shouldUseHybrid);

    const decision: RoutingDecision = {
      shouldUseHybrid,
      systemToUse: shouldUseHybrid ? 'hybrid' : 'current',
      confidence,
      reasoning,
      recommendedModules,
      fallbackStrategy,
      metadata: {
        routingTimestamp: new Date().toISOString(),
        routingVersion: '1.0.0',
        analysisId: `analysis_${Date.now()}`,
        templateId: template.id,
        tenantId: template.tenant_id,
        userId: context.userId,
        requestId: context.requestId,
        debugInfo: includeDebugInfo ? {
          analysisResult,
          strategy: this.config.routingStrategy,
          thresholds: this.config.performanceMonitoring.performanceThresholds
        } : undefined
      }
    };

    return decision;
  }

  /**
   * MÉTODO: Evaluar si usar híbrido basado en estrategia
   */
  private shouldUseHybridBasedOnStrategy(
    analysisResult: TemplateAnalysisResult,
    context: RoutingContext
  ): boolean {
    const strategy = this.config.routingStrategy;
    const riskLevel = analysisResult.riskLevel;
    const analysisScore = analysisResult.analysisScore;

    switch (strategy) {
      case 'conservative':
        // Solo usar híbrido en casos muy claros y de bajo riesgo
        return riskLevel === 'critical' && analysisScore > 0.8;

      case 'balanced':
        // Balance entre estabilidad y mejoras
        return (riskLevel === 'critical' || 
                (riskLevel === 'high' && analysisScore > 0.7) ||
                (riskLevel === 'medium' && analysisScore > 0.8));

      case 'aggressive':
        // Usar híbrido cuando sea posible
        return riskLevel !== 'low' && analysisScore > 0.5;

      case 'experimental':
        // Probar híbrido extensivamente
        return analysisScore > 0.3;

      default:
        return false;
    }
  }

  /**
   * MÉTODO: Calcular confianza en la decisión
   */
  private calculateDecisionConfidence(
    analysisResult: TemplateAnalysisResult,
    shouldUseHybrid: boolean,
    context: RoutingContext
  ): number {
    let confidence = analysisResult.analysisScore;

    // AJUSTAR BASADO EN FACTORES ADICIONALES
    
    // Factor: Historial de rendimiento del template
    const performanceHistory = this.performanceData.get(analysisResult.templateId);
    if (performanceHistory) {
      if (performanceHistory.captureSuccessRate < 0.8) {
        confidence += 0.2; // Más confianza en usar híbrido
      }
      if (performanceHistory.errorRate > 0.1) {
        confidence += 0.15;
      }
    }

    // Factor: Complejidad del template
    if (analysisResult.metadata.complexity === 'advanced') {
      confidence += 0.1;
    }

    // Factor: Número de problemas críticos
    const criticalIssues = analysisResult.detectedIssues.filter(i => i.severity === 'critical');
    confidence += criticalIssues.length * 0.1;

    // Factor: Consistencia con estrategia
    if (shouldUseHybrid && this.config.routingStrategy === 'aggressive') {
      confidence += 0.1;
    }
    if (!shouldUseHybrid && this.config.routingStrategy === 'conservative') {
      confidence += 0.1;
    }

    // Factor: Usuario de prueba
    if (context.isTestRequest) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * MÉTODO: Crear estrategia de fallback
   */
  private createFallbackStrategy(
    analysisResult: TemplateAnalysisResult,
    context: RoutingContext
  ): FallbackStrategy {
    const fallbackTriggers: FallbackTrigger[] = [
      {
        type: 'error_rate',
        threshold: 0.15,
        timeWindow: 5,
        action: 'immediate'
      },
      {
        type: 'response_time',
        threshold: 5000,
        timeWindow: 3,
        action: 'gradual'
      },
      {
        type: 'capture_failure',
        threshold: 0.3,
        timeWindow: 10,
        action: 'immediate'
      }
    ];

    // Ajustar triggers basado en nivel de riesgo
    if (analysisResult.riskLevel === 'critical') {
      fallbackTriggers.forEach(trigger => {
        trigger.threshold *= 0.7; // Más sensible a problemas
        trigger.timeWindow = Math.max(trigger.timeWindow - 2, 1);
      });
    }

    return {
      enableAutoFallback: true,
      fallbackTriggers,
      maxRetries: 2,
      fallbackTimeout: 30000,
      preserveUserSession: true,
      notifyOnFallback: true
    };
  }

  /**
   * MÉTODO: Evaluar riesgo general
   */
  private assessOverallRisk(
    analysisResult: TemplateAnalysisResult,
    shouldUseHybrid: boolean
  ): string {
    if (shouldUseHybrid) {
      switch (analysisResult.riskLevel) {
        case 'critical':
          return 'Alto: Template tiene problemas críticos, pero módulos híbridos pueden resolverlos';
        case 'high':
          return 'Medio-Alto: Problemas significativos detectados, módulos híbridos recomendados';
        case 'medium':
          return 'Medio: Template funcionaría mejor con módulos híbridos';
        case 'low':
          return 'Bajo: Template estable, módulos híbridos opcionales';
        default:
          return 'Desconocido';
      }
    } else {
      return 'Bajo: Sistema actual adecuado para este template';
    }
  }

  /**
   * MÉTODOS DE OVERRIDE Y CONFIGURACIÓN
   */

  private checkGlobalOverrides(context: RoutingContext): RoutingDecision | null {
    const global = this.config.globalOverrides;

    if (global.forceCurrentAll) {
      return this.createCurrentSystemDecision(
        { id: context.templateId } as ChatbotTemplate,
        context,
        'Override global: forzar sistema actual'
      );
    }

    if (global.forceHybridAll) {
      return this.createHybridSystemDecision(
        { id: context.templateId } as ChatbotTemplate,
        context,
        'Override global: forzar sistema híbrido'
      );
    }

    if (global.excludeProduction && !context.isTestRequest) {
      return this.createCurrentSystemDecision(
        { id: context.templateId } as ChatbotTemplate,
        context,
        'Override global: excluir producción'
      );
    }

    // A/B Testing
    if (global.enableABTesting) {
      const shouldUseHybrid = this.shouldUseHybridForABTesting(
        context,
        global.hybridRolloutPercentage
      );
      
      if (shouldUseHybrid) {
        return this.createHybridSystemDecision(
          { id: context.templateId } as ChatbotTemplate,
          context,
          'A/B Testing: asignado a grupo híbrido'
        );
      } else {
        return this.createCurrentSystemDecision(
          { id: context.templateId } as ChatbotTemplate,
          context,
          'A/B Testing: asignado a grupo actual'
        );
      }
    }

    return null;
  }

  private checkSpecificOverrides(
    template: ChatbotTemplate,
    context: RoutingContext
  ): RoutingDecision | null {
    // Override por template
    const templateOverride = this.config.templateOverrides.get(template.id);
    if (templateOverride) {
      if (templateOverride.forceHybrid) {
        return this.createHybridSystemDecision(
          template,
          context,
          templateOverride.customReasoning || 'Override de template: forzar híbrido'
        );
      }
      if (templateOverride.forceCurrent) {
        return this.createCurrentSystemDecision(
          template,
          context,
          'Override de template: forzar actual'
        );
      }
    }

    // Override por tenant
    const tenantOverride = this.config.tenantOverrides.get(template.tenant_id);
    if (tenantOverride) {
      if (tenantOverride.forceHybrid) {
        return this.createHybridSystemDecision(
          template,
          context,
          'Override de tenant: forzar híbrido'
        );
      }
      if (tenantOverride.forceCurrent) {
        return this.createCurrentSystemDecision(
          template,
          context,
          'Override de tenant: forzar actual'
        );
      }
    }

    // Override por usuario
    if (context.userId) {
      const userOverride = this.config.userOverrides.get(context.userId);
      if (userOverride) {
        if (userOverride.preferredSystem === 'hybrid') {
          return this.createHybridSystemDecision(
            template,
            context,
            'Override de usuario: preferencia híbrido'
          );
        }
        if (userOverride.preferredSystem === 'current') {
          return this.createCurrentSystemDecision(
            template,
            context,
            'Override de usuario: preferencia actual'
          );
        }
      }
    }

    return null;
  }

  private shouldUseHybridForABTesting(
    context: RoutingContext,
    rolloutPercentage: number
  ): boolean {
    // Usar hash del userId o sessionId para distribución consistente
    const hashInput = context.userId || context.sessionId || context.requestId;
    const hash = this.simpleHash(hashInput);
    return (hash % 100) < rolloutPercentage;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * MÉTODOS AUXILIARES DE DECISIÓN
   */

  private createCurrentSystemDecision(
    template: Partial<ChatbotTemplate>,
    context: RoutingContext,
    reason: string
  ): RoutingDecision {
    return {
      shouldUseHybrid: false,
      systemToUse: 'current',
      confidence: 1.0,
      reasoning: {
        primaryFactors: [reason],
        detectedIssues: [],
        riskAssessment: 'Bajo: usando sistema probado',
        expectedBenefits: ['Estabilidad del sistema actual'],
        potentialRisks: []
      },
      recommendedModules: [],
      fallbackStrategy: {
        enableAutoFallback: false,
        fallbackTriggers: [],
        maxRetries: 0,
        fallbackTimeout: 0,
        preserveUserSession: true,
        notifyOnFallback: false
      },
      metadata: {
        routingTimestamp: new Date().toISOString(),
        routingVersion: '1.0.0',
        templateId: template.id || context.templateId,
        tenantId: template.tenant_id || context.tenantId,
        userId: context.userId,
        requestId: context.requestId
      }
    };
  }

  private createHybridSystemDecision(
    template: Partial<ChatbotTemplate>,
    context: RoutingContext,
    reason: string
  ): RoutingDecision {
    return {
      shouldUseHybrid: true,
      systemToUse: 'hybrid',
      confidence: 0.9,
      reasoning: {
        primaryFactors: [reason],
        detectedIssues: [],
        riskAssessment: 'Medio: usando módulos híbridos configurados',
        expectedBenefits: ['Mejoras específicas según configuración'],
        potentialRisks: ['Complejidad adicional']
      },
      recommendedModules: ['enhancedDataCapture', 'improvedSessionManager', 'dynamicNavigation'],
      fallbackStrategy: {
        enableAutoFallback: true,
        fallbackTriggers: [
          {
            type: 'error_rate',
            threshold: 0.1,
            timeWindow: 5,
            action: 'immediate'
          }
        ],
        maxRetries: 2,
        fallbackTimeout: 30000,
        preserveUserSession: true,
        notifyOnFallback: true
      },
      metadata: {
        routingTimestamp: new Date().toISOString(),
        routingVersion: '1.0.0',
        templateId: template.id || context.templateId,
        tenantId: template.tenant_id || context.tenantId,
        userId: context.userId,
        requestId: context.requestId
      }
    };
  }

  private createEmergencyDecision(
    template: ChatbotTemplate,
    context: RoutingContext,
    reason: string
  ): RoutingDecision {
    return {
      shouldUseHybrid: false,
      systemToUse: 'current',
      confidence: 1.0,
      reasoning: {
        primaryFactors: [reason, 'Fallback automático por seguridad'],
        detectedIssues: ['Modo de emergencia activo'],
        riskAssessment: 'Crítico: usando fallback de emergencia',
        expectedBenefits: ['Estabilidad garantizada del sistema'],
        potentialRisks: []
      },
      recommendedModules: [],
      fallbackStrategy: {
        enableAutoFallback: false,
        fallbackTriggers: [],
        maxRetries: 0,
        fallbackTimeout: 0,
        preserveUserSession: true,
        notifyOnFallback: true
      },
      metadata: {
        routingTimestamp: new Date().toISOString(),
        routingVersion: '1.0.0',
        templateId: template.id,
        tenantId: template.tenant_id,
        userId: context.userId,
        requestId: context.requestId,
        debugInfo: { emergencyMode: true }
      }
    };
  }

  /**
   * MÉTODOS DE CACHÉ Y MÉTRICAS
   */

  private getRoutingFromCache(templateId: string, context: RoutingContext): RoutingDecision | null {
    const cacheKey = `${templateId}_${context.tenantId}_${context.userId || 'anon'}`;
    return this.routingCache.get(cacheKey) || null;
  }

  private cacheRoutingDecision(
    templateId: string,
    context: RoutingContext,
    decision: RoutingDecision
  ): void {
    const cacheKey = `${templateId}_${context.tenantId}_${context.userId || 'anon'}`;
    this.routingCache.set(cacheKey, decision);

    // Limpiar caché después de 1 hora
    setTimeout(() => {
      this.routingCache.delete(cacheKey);
    }, 3600000);
  }

  private updateRoutingMetrics(decision: RoutingDecision, responseTime: number): void {
    this.metrics.totalRequests++;
    
    if (decision.shouldUseHybrid) {
      this.metrics.hybridRequests++;
    } else {
      this.metrics.currentRequests++;
    }

    // Actualizar métricas de tiempo de respuesta (simulado)
    if (decision.shouldUseHybrid) {
      this.metrics.avgHybridResponseTime = 
        (this.metrics.avgHybridResponseTime + responseTime) / 2;
    } else {
      this.metrics.avgCurrentResponseTime = 
        (this.metrics.avgCurrentResponseTime + responseTime) / 2;
    }
  }

  private startPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring.enableMetrics) {
      return;
    }

    setInterval(() => {
      this.checkPerformanceThresholds();
      this.checkEmergencyTriggers();
    }, this.config.performanceMonitoring.metricsInterval * 60000);

    logger.debug(`[SystemRouterService] Monitoreo de rendimiento iniciado`);
  }

  private checkPerformanceThresholds(): void {
    const thresholds = this.config.performanceMonitoring.performanceThresholds;
    
    if (this.metrics.avgHybridResponseTime > thresholds.maxResponseTime) {
      logger.warn(`[SystemRouterService] Tiempo de respuesta híbrido alto: ${this.metrics.avgHybridResponseTime}ms`);
    }

    if (this.metrics.hybridSuccessRate < thresholds.minSuccessRate) {
      logger.warn(`[SystemRouterService] Tasa de éxito híbrido baja: ${this.metrics.hybridSuccessRate}`);
    }
  }

  private checkEmergencyTriggers(): void {
    if (!this.config.emergencyMode.enableEmergencyMode) {
      return;
    }

    const triggers = this.config.emergencyMode.emergencyTriggers;
    const actions = this.config.emergencyMode.emergencyActions;

    // Verificar tasa de error del sistema híbrido
    const hybridErrorRate = 1 - this.metrics.hybridSuccessRate;
    if (hybridErrorRate > triggers.hybridErrorRate) {
      logger.error(`[SystemRouterService] EMERGENCIA: Tasa de error híbrido crítica: ${hybridErrorRate}`);
      
      if (actions.disableHybrid) {
        this.activateEmergencyMode('Tasa de error híbrido crítica');
      }
    }
  }

  /**
   * MÉTODOS PÚBLICOS PARA GESTIÓN
   */

  activateEmergencyMode(reason: string): void {
    this.emergencyMode = true;
    logger.error(`[SystemRouterService] MODO DE EMERGENCIA ACTIVADO: ${reason}`);
    
    // Notificar a administradores si está configurado
    if (this.config.emergencyMode.emergencyActions.notifyAdmins) {
      this.notifyAdministrators(`Modo de emergencia activado: ${reason}`);
    }
  }

  deactivateEmergencyMode(): void {
    this.emergencyMode = false;
    logger.info(`[SystemRouterService] Modo de emergencia desactivado`);
  }

  setTenantOverride(
    tenantId: string,
    override: Omit<TenantOverrides, 'tenantId'>
  ): void {
    this.config.tenantOverrides.set(tenantId, { tenantId, ...override });
    logger.info(`[SystemRouterService] Override configurado para tenant ${tenantId}`);
  }

  setTemplateOverride(
    templateId: string,
    override: Omit<TemplateOverrides, 'templateId'>
  ): void {
    this.config.templateOverrides.set(templateId, { templateId, ...override });
    logger.info(`[SystemRouterService] Override configurado para template ${templateId}`);
  }

  setUserOverride(
    userId: string,
    override: Omit<UserOverrides, 'userId'>
  ): void {
    this.config.userOverrides.set(userId, { userId, ...override });
    logger.info(`[SystemRouterService] Override configurado para usuario ${userId}`);
  }

  getRoutingMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  getConfiguration(): RoutingConfiguration {
    return { ...this.config };
  }

  updateConfiguration(newConfig: Partial<RoutingConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[SystemRouterService] Configuración actualizada`);
  }

  clearRoutingCache(): void {
    this.routingCache.clear();
    logger.info(`[SystemRouterService] Caché de routing limpiado`);
  }

  setPerformanceData(templateId: string, metrics: PerformanceMetrics): void {
    this.performanceData.set(templateId, metrics);
  }

  private notifyAdministrators(message: string): void {
    // En implementación real, enviar notificación por email, Slack, etc.
    logger.error(`[SystemRouterService] NOTIFICACIÓN ADMIN: ${message}`);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.routingCache.clear();
    this.performanceData.clear();
    logger.info(`[SystemRouterService] Servicio destruido`);
  }
}

export default SystemRouterService;
export type {
  RoutingDecision,
  RoutingContext,
  RoutingConfiguration,
  RoutingMetrics,
  FallbackStrategy,
  TenantOverrides,
  TemplateOverrides,
  UserOverrides
};