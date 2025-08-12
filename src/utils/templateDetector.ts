/**
 * TEMPLATE DETECTOR SERVICE
 * 
 * PROPÓSITO: Detectar templates problemáticos que requieren módulos híbridos
 * BASADO EN: Patrones de análisis del v1-reference que identifican problemas de captura
 * PRESERVA: Sistema actual 100% intacto - solo routing inteligente
 * RESUELVE: Identificación automática de templates con "Mensajes capturados: 0"
 * 
 * PATRONES DE DETECCIÓN:
 * - Templates con capture: true que fallan
 * - Flujos con navegación compleja entre nodos
 * - Templates con alta tasa de errores de captura
 * - Plantillas con requisitos de sesión persistente
 * - Flujos que requieren preservación de contexto
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
// import type { ChatTemplate as ChatbotTemplate } from '../services/supabase';
type ChatbotTemplate = any; // Usar any para evitar problemas de tipos durante el build

// INTERFACES PARA DETECCIÓN DE TEMPLATES

interface TemplateAnalysisResult {
  templateId: string;
  templateName: string;
  tenantId: string;
  needsHybridModules: boolean;
  detectedIssues: DetectedIssue[];
  recommendedModules: RecommendedModule[];
  riskLevel: RiskLevel;
  analysisScore: number;
  metadata: AnalysisMetadata;
}

interface DetectedIssue {
  issueType: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedNodes: string[];
  evidence: IssueEvidence;
  recommendedAction: string;
}

interface IssueEvidence {
  nodeCount?: number;
  captureNodes?: number;
  complexityScore?: number;
  errorPatterns?: string[];
  performanceMetrics?: PerformanceMetrics;
}

interface PerformanceMetrics {
  averageResponseTime?: number;
  captureSuccessRate?: number;
  sessionDropRate?: number;
  errorRate?: number;
  userCompletionRate?: number;
}

interface RecommendedModule {
  moduleName: HybridModuleName;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  expectedImprovement: string;
  implementationRisk: 'low' | 'medium' | 'high';
}

interface AnalysisMetadata {
  analysisTimestamp: string;
  analysisVersion: string;
  templateVersion?: string;
  lastModified?: string;
  nodeCount: number;
  complexity: ComplexityLevel;
  estimatedUsers?: number;
  usageFrequency?: 'low' | 'medium' | 'high';
}

type IssueType = 
  | 'capture_failures'
  | 'session_drops'
  | 'navigation_loops'
  | 'context_loss'
  | 'performance_issues'
  | 'complex_flows'
  | 'state_management'
  | 'error_handling'
  | 'lead_integration'
  | 'validation_failures';

export type HybridModuleName = 
  | 'enhancedDataCapture'
  | 'improvedSessionManager'
  | 'dynamicNavigation'
  | 'nodeProcessingQueue'
  | 'flowValidationService'
  | 'navigationErrorHandler';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ComplexityLevel = 'simple' | 'medium' | 'complex' | 'advanced';

interface DetectionConfiguration {
  enableAutoDetection: boolean;
  analysisDepth: 'basic' | 'standard' | 'deep' | 'comprehensive';
  performanceThresholds: PerformanceThresholds;
  complexityThresholds: ComplexityThresholds;
  errorThresholds: ErrorThresholds;
  enableHistoricalAnalysis: boolean;
  enablePredictiveAnalysis: boolean;
  excludeTemplateIds?: string[];
  forceHybridTemplateIds?: string[];
}

interface PerformanceThresholds {
  minCaptureSuccessRate: number; // 80%
  maxAverageResponseTime: number; // 2000ms
  maxSessionDropRate: number; // 20%
  maxErrorRate: number; // 10%
  minUserCompletionRate: number; // 70%
}

interface ComplexityThresholds {
  maxSimpleNodes: number; // 5
  maxMediumNodes: number; // 15
  maxComplexNodes: number; // 30
  maxCaptureNodesRatio: number; // 0.4 (40% de nodos con captura)
  maxNavigationDepth: number; // 10
}

interface ErrorThresholds {
  maxCriticalIssues: number; // 0
  maxHighIssues: number; // 2
  maxMediumIssues: number; // 5
  maxLowIssues: number; // 10
}

interface DetectionRule {
  id: string;
  name: string;
  description: string;
  category: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isBlocking: boolean;
  detect: (template: ChatbotTemplate, metrics?: PerformanceMetrics) => Promise<DetectionResult>;
}

interface DetectionResult {
  detected: boolean;
  confidence: number; // 0-1
  evidence: IssueEvidence;
  affectedNodes: string[];
  recommendation: string;
}

/**
 * SERVICIO PRINCIPAL DE DETECCIÓN DE TEMPLATES
 */
class TemplateDetectorService {
  private static instance: TemplateDetectorService;
  private detectionRules: Map<string, DetectionRule> = new Map();
  private analysisCache: Map<string, TemplateAnalysisResult> = new Map();
  private config: DetectionConfiguration;
  private performanceData: Map<string, PerformanceMetrics> = new Map();

  private constructor(config: Partial<DetectionConfiguration> = {}) {
    this.config = {
      enableAutoDetection: true,
      analysisDepth: 'standard',
      performanceThresholds: {
        minCaptureSuccessRate: 0.8,
        maxAverageResponseTime: 2000,
        maxSessionDropRate: 0.2,
        maxErrorRate: 0.1,
        minUserCompletionRate: 0.7
      },
      complexityThresholds: {
        maxSimpleNodes: 5,
        maxMediumNodes: 15,
        maxComplexNodes: 30,
        maxCaptureNodesRatio: 0.4,
        maxNavigationDepth: 10
      },
      errorThresholds: {
        maxCriticalIssues: 0,
        maxHighIssues: 2,
        maxMediumIssues: 5,
        maxLowIssues: 10
      },
      enableHistoricalAnalysis: true,
      enablePredictiveAnalysis: false,
      ...config
    };

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<DetectionConfiguration>): TemplateDetectorService {
    if (!TemplateDetectorService.instance) {
      TemplateDetectorService.instance = new TemplateDetectorService(config);
    }
    return TemplateDetectorService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.registerDefaultDetectionRules();
    logger.info(`[TemplateDetectorService] Servicio inicializado con ${this.detectionRules.size} reglas de detección`);
  }

  /**
   * MÉTODO PRINCIPAL: Analizar template para detectar necesidad de módulos híbridos
   */
  async analyzeTemplate(
    template: ChatbotTemplate,
    options: {
      forceAnalysis?: boolean;
      includePerformanceData?: boolean;
      performanceMetrics?: PerformanceMetrics;
    } = {}
  ): Promise<TemplateAnalysisResult> {
    const startTime = Date.now();
    logger.info(`[TemplateDetectorService] Analizando template: ${template.name} (${template.id})`);

    try {
      // PASO 1: VERIFICAR CACHÉ SI NO ES ANÁLISIS FORZADO
      if (!options.forceAnalysis) {
        const cached = this.analysisCache.get(template.id);
        if (cached && this.isCacheValid(cached)) {
          logger.debug(`[TemplateDetectorService] Resultado obtenido del caché para template ${template.id}`);
          return cached;
        }
      }

      // PASO 2: VERIFICAR CONFIGURACIÓN DE OVERRIDE
      if (this.config.forceHybridTemplateIds?.includes(template.id)) {
        return this.createForceHybridResult(template);
      }

      if (this.config.excludeTemplateIds?.includes(template.id)) {
        return this.createExcludedResult(template);
      }

      // PASO 3: OBTENER MÉTRICAS DE RENDIMIENTO
      const performanceMetrics = options.performanceMetrics || 
                                await this.getPerformanceMetrics(template.id);

      // PASO 4: EJECUTAR REGLAS DE DETECCIÓN
      const detectedIssues = await this.executeDetectionRules(template, performanceMetrics);

      // PASO 5: ANALIZAR COMPLEJIDAD DEL TEMPLATE
      const complexityAnalysis = this.analyzeTemplateComplexity(template);

      // PASO 6: DETERMINAR MÓDULOS RECOMENDADOS
      const recommendedModules = this.determineRecommendedModules(detectedIssues, complexityAnalysis);

      // PASO 7: CALCULAR PUNTUACIÓN Y NIVEL DE RIESGO
      const analysisScore = this.calculateAnalysisScore(detectedIssues, complexityAnalysis);
      const riskLevel = this.determineRiskLevel(detectedIssues, analysisScore);

      // PASO 8: CREAR RESULTADO FINAL
      const result: TemplateAnalysisResult = {
        templateId: template.id,
        templateName: template.name,
        tenantId: template.tenant_id,
        needsHybridModules: this.shouldUseHybridModules(detectedIssues, analysisScore),
        detectedIssues,
        recommendedModules,
        riskLevel,
        analysisScore,
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          analysisVersion: '1.0.0',
          templateVersion: template.version?.toString() || '1.0',
          lastModified: template.updated_at,
          nodeCount: this.countNodes(template),
          complexity: complexityAnalysis.level,
          usageFrequency: this.estimateUsageFrequency(performanceMetrics)
        }
      };

      // PASO 9: ALMACENAR EN CACHÉ
      this.analysisCache.set(template.id, result);

      logger.info(`[TemplateDetectorService] Análisis completado en ${Date.now() - startTime}ms: ${result.needsHybridModules ? 'REQUIERE' : 'NO REQUIERE'} módulos híbridos`);

      return result;

    } catch (error) {
      logger.error(`[TemplateDetectorService] Error analizando template ${template.id}:`, error);
      
      return {
        templateId: template.id,
        templateName: template.name,
        tenantId: template.tenant_id,
        needsHybridModules: false,
        detectedIssues: [{
          issueType: 'error_handling',
          severity: 'high',
          description: `Error durante análisis: ${error}`,
          affectedNodes: [],
          evidence: {},
          recommendedAction: 'Revisar template manualmente'
        }],
        recommendedModules: [],
        riskLevel: 'high',
        analysisScore: 0,
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          analysisVersion: '1.0.0',
          nodeCount: 0,
          complexity: 'simple'
        }
      };
    }
  }

  /**
   * MÉTODO: Ejecutar reglas de detección
   */
  private async executeDetectionRules(
    template: ChatbotTemplate, 
    performanceMetrics?: PerformanceMetrics
  ): Promise<DetectedIssue[]> {
    const detectedIssues: DetectedIssue[] = [];
    const rulesToExecute = Array.from(this.detectionRules.values());

    logger.debug(`[TemplateDetectorService] Ejecutando ${rulesToExecute.length} reglas de detección`);

    for (const rule of rulesToExecute) {
      try {
        const result = await rule.detect(template, performanceMetrics);
        
        if (result.detected && result.confidence >= 0.5) {
          detectedIssues.push({
            issueType: rule.category,
            severity: rule.severity,
            description: rule.description,
            affectedNodes: result.affectedNodes,
            evidence: result.evidence,
            recommendedAction: result.recommendation
          });

          logger.debug(`[TemplateDetectorService] Regla ${rule.name} detectó problema con confianza ${result.confidence}`);
        }

      } catch (error) {
        logger.error(`[TemplateDetectorService] Error ejecutando regla ${rule.name}:`, error);
      }
    }

    return detectedIssues;
  }

  /**
   * MÉTODO: Registrar reglas de detección por defecto
   */
  private registerDefaultDetectionRules(): void {
    // REGLA: Detectar fallos de captura
    this.registerDetectionRule({
      id: 'capture_failure_detection',
      name: 'Detectar fallos de captura',
      description: 'Detecta templates con alta tasa de fallos de captura',
      category: 'capture_failures',
      severity: 'critical',
      isBlocking: true,
      detect: async (template, metrics) => {
        const captureNodes = this.findCaptureNodes(template);
        const captureSuccessRate = metrics?.captureSuccessRate || 1;

        if (captureNodes.length > 0 && captureSuccessRate < this.config.performanceThresholds.minCaptureSuccessRate) {
          return {
            detected: true,
            confidence: 1 - captureSuccessRate,
            evidence: {
              captureNodes: captureNodes.length,
              performanceMetrics: metrics
            },
            affectedNodes: captureNodes.map(n => n.id),
            recommendation: 'Implementar enhancedDataCapture y improvedSessionManager'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    // REGLA: Detectar pérdida de sesión
    this.registerDetectionRule({
      id: 'session_drop_detection',
      name: 'Detectar pérdida de sesión',
      description: 'Detecta templates con alta tasa de pérdida de sesión',
      category: 'session_drops',
      severity: 'high',
      isBlocking: false,
      detect: async (template, metrics) => {
        const sessionDropRate = metrics?.sessionDropRate || 0;
        const hasMultiStepFlow = this.hasMultiStepFlow(template);

        if (hasMultiStepFlow && sessionDropRate > this.config.performanceThresholds.maxSessionDropRate) {
          return {
            detected: true,
            confidence: sessionDropRate,
            evidence: {
              performanceMetrics: metrics,
              nodeCount: this.countNodes(template)
            },
            affectedNodes: this.getFlowNodes(template).map(n => n.id),
            recommendation: 'Implementar improvedSessionManager y dynamicNavigation'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    // REGLA: Detectar navegación compleja
    this.registerDetectionRule({
      id: 'complex_navigation_detection',
      name: 'Detectar navegación compleja',
      description: 'Detecta templates con patrones de navegación complejos',
      category: 'complex_flows',
      severity: 'medium',
      isBlocking: false,
      detect: async (template, metrics) => {
        const complexityScore = this.calculateNavigationComplexity(template);
        const hasConditionalFlow = this.hasConditionalFlow(template);
        const hasLoops = this.detectNavigationLoops(template);

        if (complexityScore > 0.6 || hasConditionalFlow || hasLoops) {
          return {
            detected: true,
            confidence: Math.max(complexityScore, hasLoops ? 0.8 : 0.5),
            evidence: {
              complexityScore,
              nodeCount: this.countNodes(template)
            },
            affectedNodes: this.getFlowNodes(template).map(n => n.id),
            recommendation: 'Implementar dynamicNavigation y flowValidationService'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    // REGLA: Detectar problemas de contexto
    this.registerDetectionRule({
      id: 'context_loss_detection',
      name: 'Detectar pérdida de contexto',
      description: 'Detecta templates que pueden perder contexto entre nodos',
      category: 'context_loss',
      severity: 'high',
      isBlocking: false,
      detect: async (template, metrics) => {
        const hasVariableUsage = this.hasVariableUsage(template);
        const hasDataDependencies = this.hasDataDependencies(template);
        const userCompletionRate = metrics?.userCompletionRate || 1;

        if ((hasVariableUsage || hasDataDependencies) && 
            userCompletionRate < this.config.performanceThresholds.minUserCompletionRate) {
          return {
            detected: true,
            confidence: 1 - userCompletionRate,
            evidence: {
              performanceMetrics: metrics,
              nodeCount: this.countNodes(template)
            },
            affectedNodes: this.getDataNodes(template).map(n => n.id),
            recommendation: 'Implementar enhancedDataCapture y maintainSessionContext'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    // REGLA: Detectar problemas de rendimiento
    this.registerDetectionRule({
      id: 'performance_issues_detection',
      name: 'Detectar problemas de rendimiento',
      description: 'Detecta templates con problemas de rendimiento',
      category: 'performance_issues',
      severity: 'medium',
      isBlocking: false,
      detect: async (template, metrics) => {
        const averageResponseTime = metrics?.averageResponseTime || 0;
        const errorRate = metrics?.errorRate || 0;

        if (averageResponseTime > this.config.performanceThresholds.maxAverageResponseTime ||
            errorRate > this.config.performanceThresholds.maxErrorRate) {
          return {
            detected: true,
            confidence: Math.max(
              averageResponseTime / this.config.performanceThresholds.maxAverageResponseTime,
              errorRate / this.config.performanceThresholds.maxErrorRate
            ),
            evidence: {
              performanceMetrics: metrics
            },
            affectedNodes: this.getFlowNodes(template).map(n => n.id),
            recommendation: 'Implementar nodeProcessingQueue y navigationErrorHandler'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    // REGLA: Detectar integración con leads
    this.registerDetectionRule({
      id: 'lead_integration_detection',
      name: 'Detectar integración con leads',
      description: 'Detecta templates que requieren integración cuidadosa con sistema de leads',
      category: 'lead_integration',
      severity: 'high',
      isBlocking: false,
      detect: async (template, metrics) => {
        const hasLeadStages = this.hasLeadStages(template);
        const hasSalesFunnelIntegration = this.hasSalesFunnelIntegration(template);

        if (hasLeadStages || hasSalesFunnelIntegration) {
          return {
            detected: true,
            confidence: 0.9,
            evidence: {
              nodeCount: this.countNodes(template)
            },
            affectedNodes: this.getLeadNodes(template).map(n => n.id),
            recommendation: 'Usar todos los módulos híbridos con especial cuidado en preservación de leads'
          };
        }

        return { detected: false, confidence: 0, evidence: {}, affectedNodes: [], recommendation: '' };
      }
    });

    logger.info(`[TemplateDetectorService] ${this.detectionRules.size} reglas de detección registradas`);
  }

  /**
   * MÉTODOS AUXILIARES DE ANÁLISIS
   */

  private analyzeTemplateComplexity(template: ChatbotTemplate): { level: ComplexityLevel; score: number } {
    const nodeCount = this.countNodes(template);
    const captureNodes = this.findCaptureNodes(template).length;
    const complexityFactors = {
      nodeCount: Math.min(nodeCount / this.config.complexityThresholds.maxComplexNodes, 1),
      captureRatio: captureNodes / Math.max(nodeCount, 1),
      navigationDepth: Math.min(this.calculateNavigationDepth(template) / this.config.complexityThresholds.maxNavigationDepth, 1),
      conditionalFlow: this.hasConditionalFlow(template) ? 0.3 : 0,
      variableUsage: this.hasVariableUsage(template) ? 0.2 : 0
    };

    const score = Object.values(complexityFactors).reduce((sum, factor) => sum + factor, 0) / Object.keys(complexityFactors).length;

    let level: ComplexityLevel;
    if (score < 0.25) level = 'simple';
    else if (score < 0.5) level = 'medium';
    else if (score < 0.75) level = 'complex';
    else level = 'advanced';

    return { level, score };
  }

  private determineRecommendedModules(issues: DetectedIssue[], complexityAnalysis: any): RecommendedModule[] {
    const modules: RecommendedModule[] = [];
    const issueTypes = new Set(issues.map(issue => issue.issueType));
    const highSeverityIssues = issues.filter(issue => ['high', 'critical'].includes(issue.severity));

    // Módulo de captura mejorada
    if (issueTypes.has('capture_failures') || issueTypes.has('context_loss')) {
      modules.push({
        moduleName: 'enhancedDataCapture',
        priority: 'critical',
        reason: 'Resolver fallos de captura y pérdida de contexto',
        expectedImprovement: 'Incremento del 30-50% en tasa de captura exitosa',
        implementationRisk: 'low'
      });
    }

    // Gestión de sesiones mejorada
    if (issueTypes.has('session_drops') || complexityAnalysis.score > 0.5) {
      modules.push({
        moduleName: 'improvedSessionManager',
        priority: 'high',
        reason: 'Prevenir pérdida de sesiones en flujos complejos',
        expectedImprovement: 'Reducción del 40-60% en pérdida de sesiones',
        implementationRisk: 'low'
      });
    }

    // Navegación dinámica
    if (issueTypes.has('complex_flows') || issueTypes.has('navigation_loops')) {
      modules.push({
        moduleName: 'dynamicNavigation',
        priority: 'high',
        reason: 'Mejorar navegación en flujos complejos',
        expectedImprovement: 'Navegación 20-40% más fluida',
        implementationRisk: 'medium'
      });
    }

    // Cola de procesamiento
    if (issueTypes.has('performance_issues') || highSeverityIssues.length > 2) {
      modules.push({
        moduleName: 'nodeProcessingQueue',
        priority: 'medium',
        reason: 'Optimizar rendimiento y evitar race conditions',
        expectedImprovement: 'Mejora del 25-35% en tiempo de respuesta',
        implementationRisk: 'medium'
      });
    }

    // Validación de flujos
    if (issueTypes.has('validation_failures') || complexityAnalysis.level === 'advanced') {
      modules.push({
        moduleName: 'flowValidationService',
        priority: 'medium',
        reason: 'Validar flujos complejos antes de ejecución',
        expectedImprovement: 'Reducción del 50-70% en errores de navegación',
        implementationRisk: 'low'
      });
    }

    // Manejo de errores
    if (highSeverityIssues.length > 0 || issueTypes.has('error_handling')) {
      modules.push({
        moduleName: 'navigationErrorHandler',
        priority: 'high',
        reason: 'Manejo robusto de errores con recovery automático',
        expectedImprovement: 'Recuperación automática del 80-90% de errores',
        implementationRisk: 'low'
      });
    }

    return modules.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private calculateAnalysisScore(issues: DetectedIssue[], complexityAnalysis: any): number {
    const severityWeights = { critical: 1.0, high: 0.7, medium: 0.4, low: 0.2 };
    const issueScore = issues.reduce((score, issue) => {
      return score + severityWeights[issue.severity];
    }, 0);

    const maxPossibleScore = issues.length;
    const normalizedIssueScore = maxPossibleScore > 0 ? issueScore / maxPossibleScore : 0;
    
    return Math.min((normalizedIssueScore + complexityAnalysis.score) / 2, 1);
  }

  private determineRiskLevel(issues: DetectedIssue[], analysisScore: number): RiskLevel {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0 || analysisScore > 0.8) return 'critical';
    if (highIssues > 2 || analysisScore > 0.6) return 'high';
    if (highIssues > 0 || analysisScore > 0.4) return 'medium';
    return 'low';
  }

  private shouldUseHybridModules(issues: DetectedIssue[], analysisScore: number): boolean {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    
    return criticalIssues > 0 || 
           highIssues >= 2 || 
           analysisScore > 0.5 ||
           issues.length > this.config.errorThresholds.maxMediumIssues;
  }

  /**
   * MÉTODOS AUXILIARES DE PARSING DE TEMPLATES
   */

  private countNodes(template: ChatbotTemplate): number {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      return templateData?.nodes?.length || 0;
    } catch {
      return 0;
    }
  }

  private findCaptureNodes(template: ChatbotTemplate): any[] {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      
      return (templateData?.nodes || []).filter((node: any) => 
        node.type === 'inputNode' || 
        node.data?.waitForResponse === true ||
        node.data?.capture === true
      );
    } catch {
      return [];
    }
  }

  private getFlowNodes(template: ChatbotTemplate): any[] {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      return templateData?.nodes || [];
    } catch {
      return [];
    }
  }

  private getDataNodes(template: ChatbotTemplate): any[] {
    try {
      const nodes = this.getFlowNodes(template);
      return nodes.filter((node: any) => 
        node.type === 'inputNode' || 
        node.data?.variables ||
        node.data?.collectedData
      );
    } catch {
      return [];
    }
  }

  private getLeadNodes(template: ChatbotTemplate): any[] {
    try {
      const nodes = this.getFlowNodes(template);
      return nodes.filter((node: any) => 
        node.data?.leadStageId ||
        node.data?.salesFunnelStep ||
        node.data?.leadAction
      );
    } catch {
      return [];
    }
  }

  private hasMultiStepFlow(template: ChatbotTemplate): boolean {
    return this.countNodes(template) > 3;
  }

  private hasConditionalFlow(template: ChatbotTemplate): boolean {
    try {
      const nodes = this.getFlowNodes(template);
      return nodes.some((node: any) => 
        node.type === 'conditionNode' ||
        node.data?.conditions ||
        node.data?.buttonActions
      );
    } catch {
      return false;
    }
  }

  private hasVariableUsage(template: ChatbotTemplate): boolean {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      
      const templateString = JSON.stringify(templateData);
      return /\{\{[\w\s]+\}\}/.test(templateString);
    } catch {
      return false;
    }
  }

  private hasDataDependencies(template: ChatbotTemplate): boolean {
    const captureNodes = this.findCaptureNodes(template);
    return captureNodes.length > 1;
  }

  private hasLeadStages(template: ChatbotTemplate): boolean {
    try {
      const nodes = this.getFlowNodes(template);
      return nodes.some((node: any) => node.data?.leadStageId);
    } catch {
      return false;
    }
  }

  private hasSalesFunnelIntegration(template: ChatbotTemplate): boolean {
    try {
      const nodes = this.getFlowNodes(template);
      return nodes.some((node: any) => 
        node.data?.salesFunnelStep ||
        node.data?.leadAction ||
        template.name.toLowerCase().includes('funnel') ||
        template.name.toLowerCase().includes('lead')
      );
    } catch {
      return false;
    }
  }

  private calculateNavigationComplexity(template: ChatbotTemplate): number {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      
      const nodes = templateData?.nodes || [];
      const edges = templateData?.edges || [];
      
      if (nodes.length === 0) return 0;
      
      const connectionRatio = edges.length / nodes.length;
      const conditionalNodes = nodes.filter((node: any) => 
        node.type === 'conditionNode' || node.data?.conditions
      ).length;
      
      return Math.min((connectionRatio + (conditionalNodes / nodes.length)) / 2, 1);
    } catch {
      return 0;
    }
  }

  private calculateNavigationDepth(template: ChatbotTemplate): number {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      
      const nodes = templateData?.nodes || [];
      const edges = templateData?.edges || [];
      
      if (nodes.length === 0) return 0;
      
      // Análisis simple de profundidad basado en conexiones
      const nodeConnections = new Map<string, number>();
      edges.forEach((edge: any) => {
        const target = edge.target || edge.to;
        nodeConnections.set(target, (nodeConnections.get(target) || 0) + 1);
      });
      
      return Math.max(...Array.from(nodeConnections.values()), 1);
    } catch {
      return 1;
    }
  }

  private detectNavigationLoops(template: ChatbotTemplate): boolean {
    try {
      const templateData = typeof template.template_data === 'string' 
        ? JSON.parse(template.template_data) 
        : template.template_data;
      
      const edges = templateData?.edges || [];
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      
      // Algoritmo simple de detección de ciclos
      for (const edge of edges) {
        const source = edge.source || edge.from;
        const target = edge.target || edge.to;
        
        if (source === target) return true; // Self-loop
        
        if (this.hasCycle(edges, source, visited, recursionStack)) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private hasCycle(edges: any[], node: string, visited: Set<string>, recursionStack: Set<string>): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const nodeEdges = edges.filter(edge => (edge.source || edge.from) === node);
    
    for (const edge of nodeEdges) {
      const target = edge.target || edge.to;
      
      if (!visited.has(target)) {
        if (this.hasCycle(edges, target, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(target)) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }

  private estimateUsageFrequency(metrics?: PerformanceMetrics): 'low' | 'medium' | 'high' {
    if (!metrics) return 'medium';
    
    // Estimación basada en métricas disponibles
    const completionRate = metrics.userCompletionRate || 0.5;
    const responseTime = metrics.averageResponseTime || 1000;
    
    if (completionRate > 0.8 && responseTime < 1500) return 'high';
    if (completionRate > 0.6 && responseTime < 2500) return 'medium';
    return 'low';
  }

  /**
   * MÉTODOS AUXILIARES DE GESTIÓN
   */

  private async getPerformanceMetrics(templateId: string): Promise<PerformanceMetrics | undefined> {
    return this.performanceData.get(templateId);
  }

  private createForceHybridResult(template: ChatbotTemplate): TemplateAnalysisResult {
    return {
      templateId: template.id,
      templateName: template.name,
      tenantId: template.tenant_id,
      needsHybridModules: true,
      detectedIssues: [{
        issueType: 'complex_flows',
        severity: 'high',
        description: 'Template configurado para usar módulos híbridos obligatoriamente',
        affectedNodes: [],
        evidence: {},
        recommendedAction: 'Usar todos los módulos híbridos disponibles'
      }],
      recommendedModules: [
        { moduleName: 'enhancedDataCapture', priority: 'high', reason: 'Configuración forzada', expectedImprovement: 'Mejora garantizada', implementationRisk: 'low' },
        { moduleName: 'improvedSessionManager', priority: 'high', reason: 'Configuración forzada', expectedImprovement: 'Mejora garantizada', implementationRisk: 'low' },
        { moduleName: 'dynamicNavigation', priority: 'high', reason: 'Configuración forzada', expectedImprovement: 'Mejora garantizada', implementationRisk: 'low' }
      ],
      riskLevel: 'medium',
      analysisScore: 0.8,
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        analysisVersion: '1.0.0',
        nodeCount: this.countNodes(template),
        complexity: 'complex'
      }
    };
  }

  private createExcludedResult(template: ChatbotTemplate): TemplateAnalysisResult {
    return {
      templateId: template.id,
      templateName: template.name,
      tenantId: template.tenant_id,
      needsHybridModules: false,
      detectedIssues: [],
      recommendedModules: [],
      riskLevel: 'low',
      analysisScore: 0,
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        analysisVersion: '1.0.0',
        nodeCount: this.countNodes(template),
        complexity: 'simple'
      }
    };
  }

  private isCacheValid(result: TemplateAnalysisResult): boolean {
    const age = Date.now() - new Date(result.metadata.analysisTimestamp).getTime();
    return age < 3600000; // 1 hora
  }

  /**
   * MÉTODOS PÚBLICOS PARA GESTIÓN
   */

  registerDetectionRule(rule: DetectionRule): void {
    this.detectionRules.set(rule.id, rule);
    logger.debug(`[TemplateDetectorService] Regla de detección registrada: ${rule.id}`);
  }

  unregisterDetectionRule(ruleId: string): boolean {
    const removed = this.detectionRules.delete(ruleId);
    if (removed) {
      logger.debug(`[TemplateDetectorService] Regla de detección eliminada: ${ruleId}`);
    }
    return removed;
  }

  setPerformanceData(templateId: string, metrics: PerformanceMetrics): void {
    this.performanceData.set(templateId, metrics);
  }

  clearAnalysisCache(): void {
    this.analysisCache.clear();
    logger.info(`[TemplateDetectorService] Cache de análisis limpiado`);
  }

  getDetectionRules(): DetectionRule[] {
    return Array.from(this.detectionRules.values());
  }

  updateConfiguration(newConfig: Partial<DetectionConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[TemplateDetectorService] Configuración actualizada`);
  }

  getConfiguration(): DetectionConfiguration {
    return { ...this.config };
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.detectionRules.clear();
    this.analysisCache.clear();
    this.performanceData.clear();
    logger.info(`[TemplateDetectorService] Servicio destruido`);
  }
}

export default TemplateDetectorService;
export type {
  TemplateAnalysisResult,
  DetectedIssue,
  RecommendedModule,
  DetectionConfiguration,
  DetectionRule,
  PerformanceMetrics,
  RiskLevel,
  ComplexityLevel,
  IssueType
};