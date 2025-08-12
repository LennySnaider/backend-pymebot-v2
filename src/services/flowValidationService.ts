/**
 * FLOW VALIDATION SERVICE
 * 
 * PROPÓSITO: Validación exhaustiva de flujos antes de navegación
 * BASADO EN: Patrones de validación del v1-reference que previenen errores
 * PRESERVA: Sistema de leads 100% intacto
 * PREVIENE: Navegación a nodos inválidos que causan "Mensajes capturados: 0"
 * 
 * PATRONES EXTRAÍDOS DEL V1-REFERENCE:
 * - Validación de estructura de flujo antes de ejecutar
 * - Verificación de dependencias y requisitos de nodos
 * - Validación de datos requeridos para navegación
 * - Comprobación de permisos y contexto de tenant
 * - Verificación de integridad de template
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import type { 
  NavigationNode, 
  NavigationContext,
  FlowValidationResult
} from './dynamicNavigation';

// INTERFACES PARA VALIDACIÓN DE FLUJOS

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  priority: ValidationPriority;
  category: ValidationCategory;
  isBlocking: boolean;
  validate: (context: ValidationContext) => Promise<ValidationRuleResult>;
}

interface ValidationContext {
  fromNode?: NavigationNode;
  toNode: NavigationNode;
  navigationContext: NavigationContext;
  template?: FlowTemplate;
  metadata: ValidationMetadata;
}

interface ValidationMetadata {
  userId: string;
  tenantId: string;
  sessionId?: string;
  templateId?: string;
  requestId: string;
  timestamp: string;
  navigationType: 'user_input' | 'button_click' | 'condition' | 'auto' | 'api';
  previousValidations: string[];
}

interface ValidationRuleResult {
  isValid: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, any>;
  suggestedAction?: string;
  canProceed: boolean;
  requiresUserConfirmation?: boolean;
}

interface FlowTemplate {
  id: string;
  name: string;
  version: string;
  tenantId: string;
  nodes: NavigationNode[];
  connections: FlowConnection[];
  metadata: TemplateMetadata;
  validationRules?: string[];
}

interface FlowConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditions?: ConnectionCondition[];
  metadata?: Record<string, any>;
}

interface ConnectionCondition {
  field: string;
  operator: string;
  value: any;
  required: boolean;
}

interface TemplateMetadata {
  createdAt: string;
  updatedAt: string;
  version: string;
  isActive: boolean;
  leadStages?: string[]; // CRÍTICO: Para preservar sistema de leads
  requiredVariables?: string[];
  supportedPlatforms?: string[];
  complexity: 'simple' | 'medium' | 'complex';
}

type ValidationPriority = 'low' | 'medium' | 'high' | 'critical';
type ValidationCategory = 
  | 'structure' 
  | 'data' 
  | 'permissions' 
  | 'context' 
  | 'leads' 
  | 'business_logic' 
  | 'performance' 
  | 'security';

interface ValidationConfiguration {
  enableAllValidations: boolean;
  strictMode: boolean;
  allowWarningsToBlock: boolean;
  skipValidationForTrustedSources: boolean;
  enableCaching: boolean;
  cacheExpiration: number;
  enableMetrics: boolean;
  categories: {
    [K in ValidationCategory]: {
      enabled: boolean;
      level: 'strict' | 'moderate' | 'lenient';
    };
  };
}

interface ValidationReport {
  isValid: boolean;
  canProceed: boolean;
  overallSeverity: 'error' | 'warning' | 'info' | 'success';
  executionTime: number;
  rulesExecuted: number;
  errors: ValidationRuleResult[];
  warnings: ValidationRuleResult[];
  info: ValidationRuleResult[];
  recommendations: string[];
  metadata: {
    validationId: string;
    timestamp: string;
    context: ValidationMetadata;
  };
}

/**
 * SERVICIO PRINCIPAL DE VALIDACIÓN DE FLUJOS
 */
class FlowValidationService {
  private static instance: FlowValidationService;
  private validationRules: Map<string, ValidationRule> = new Map();
  private templateCache: Map<string, FlowTemplate> = new Map();
  private validationCache: Map<string, ValidationReport> = new Map();
  private config: ValidationConfiguration;
  private metrics: Map<string, any> = new Map();

  private constructor(config: Partial<ValidationConfiguration> = {}) {
    this.config = {
      enableAllValidations: true,
      strictMode: false,
      allowWarningsToBlock: false,
      skipValidationForTrustedSources: false,
      enableCaching: true,
      cacheExpiration: 300000, // 5 minutos
      enableMetrics: true,
      categories: {
        structure: { enabled: true, level: 'strict' },
        data: { enabled: true, level: 'strict' },
        permissions: { enabled: true, level: 'strict' },
        context: { enabled: true, level: 'moderate' },
        leads: { enabled: true, level: 'strict' }, // CRÍTICO para preservar leads
        business_logic: { enabled: true, level: 'moderate' },
        performance: { enabled: true, level: 'lenient' },
        security: { enabled: true, level: 'strict' }
      },
      ...config
    };

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<ValidationConfiguration>): FlowValidationService {
    if (!FlowValidationService.instance) {
      FlowValidationService.instance = new FlowValidationService(config);
    }
    return FlowValidationService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.registerDefaultValidationRules();
    logger.info(`[FlowValidationService] Servicio inicializado con ${this.validationRules.size} reglas de validación`);
  }

  /**
   * MÉTODO PRINCIPAL: Validar navegación de flujo
   */
  async validateFlowNavigation(
    navigationContext: NavigationContext,
    fromNodeId: string | undefined,
    toNodeId: string,
    options: {
      templateId?: string;
      navigationType?: 'user_input' | 'button_click' | 'condition' | 'auto' | 'api';
      skipCache?: boolean;
      customRules?: string[];
    } = {}
  ): Promise<FlowValidationResult> {
    const validationId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info(`[FlowValidationService] Iniciando validación de navegación: ${fromNodeId} -> ${toNodeId}`);

    try {
      // PASO 1: VERIFICAR CACHÉ SI ESTÁ HABILITADO
      if (this.config.enableCaching && !options.skipCache) {
        const cacheKey = this.generateCacheKey(navigationContext, fromNodeId, toNodeId);
        const cachedResult = this.validationCache.get(cacheKey);
        
        if (cachedResult && this.isCacheValid(cachedResult)) {
          logger.debug(`[FlowValidationService] Resultado obtenido del caché para ${cacheKey}`);
          return this.convertReportToResult(cachedResult);
        }
      }

      // PASO 2: PREPARAR CONTEXTO DE VALIDACIÓN
      const validationContext = await this.prepareValidationContext(
        navigationContext,
        fromNodeId,
        toNodeId,
        validationId,
        options
      );

      if (!validationContext) {
        return {
          isValid: false,
          errors: ['Error preparando contexto de validación'],
          warnings: [],
          suggestions: [],
          canProceed: false
        };
      }

      // PASO 3: EJECUTAR VALIDACIONES
      const report = await this.executeValidations(validationContext, options.customRules);

      // PASO 4: ALMACENAR EN CACHÉ SI ESTÁ HABILITADO
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(navigationContext, fromNodeId, toNodeId);
        this.validationCache.set(cacheKey, report);
      }

      // PASO 5: REGISTRAR MÉTRICAS
      if (this.config.enableMetrics) {
        this.recordValidationMetrics(report, Date.now() - startTime);
      }

      logger.info(`[FlowValidationService] Validación completada en ${Date.now() - startTime}ms: ${report.isValid ? 'VÁLIDA' : 'INVÁLIDA'}`);

      return this.convertReportToResult(report);

    } catch (error) {
      logger.error(`[FlowValidationService] Error en validación de flujo:`, error);
      
      return {
        isValid: false,
        errors: [`Error interno de validación: ${error}`],
        warnings: [],
        suggestions: ['Contactar al administrador del sistema'],
        canProceed: false
      };
    }
  }

  /**
   * MÉTODO: Preparar contexto de validación
   */
  private async prepareValidationContext(
    navigationContext: NavigationContext,
    fromNodeId: string | undefined,
    toNodeId: string,
    validationId: string,
    options: any
  ): Promise<ValidationContext | null> {
    try {
      // Obtener template si existe
      const template = options.templateId ? await this.getTemplate(options.templateId) : undefined;
      
      // Encontrar nodos
      const fromNode = fromNodeId ? await this.findNode(fromNodeId, template) : undefined;
      const toNode = await this.findNode(toNodeId, template);

      if (!toNode) {
        logger.error(`[FlowValidationService] Nodo destino no encontrado: ${toNodeId}`);
        return null;
      }

      return {
        fromNode,
        toNode,
        navigationContext,
        template,
        metadata: {
          userId: navigationContext.userId,
          tenantId: navigationContext.tenantId,
          sessionId: navigationContext.sessionId,
          templateId: options.templateId,
          requestId: validationId,
          timestamp: new Date().toISOString(),
          navigationType: options.navigationType || 'auto',
          previousValidations: []
        }
      };

    } catch (error) {
      logger.error(`[FlowValidationService] Error preparando contexto:`, error);
      return null;
    }
  }

  /**
   * MÉTODO: Ejecutar todas las validaciones
   */
  private async executeValidations(
    context: ValidationContext,
    customRules?: string[]
  ): Promise<ValidationReport> {
    const startTime = Date.now();
    const results: ValidationRuleResult[] = [];
    const rulesToExecute = this.selectValidationRules(context, customRules);

    logger.debug(`[FlowValidationService] Ejecutando ${rulesToExecute.length} reglas de validación`);

    // Ejecutar reglas por categoría y prioridad
    const sortedRules = rulesToExecute.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    for (const rule of sortedRules) {
      try {
        const result = await rule.validate(context);
        results.push(result);

        // Si es una regla bloqueante y falla, detener validaciones adicionales en modo estricto
        if (rule.isBlocking && !result.canProceed && this.config.strictMode) {
          logger.warn(`[FlowValidationService] Validación detenida por regla bloqueante: ${rule.name}`);
          break;
        }

      } catch (error) {
        logger.error(`[FlowValidationService] Error ejecutando regla ${rule.name}:`, error);
        
        results.push({
          isValid: false,
          severity: 'error',
          message: `Error ejecutando validación: ${rule.name}`,
          details: { error: String(error) },
          canProceed: false
        });
      }
    }

    // Analizar resultados
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    const info = results.filter(r => r.severity === 'info');

    const isValid = errors.length === 0 && 
                   (!this.config.allowWarningsToBlock || warnings.length === 0);
    
    const canProceed = results.every(r => r.canProceed) || 
                      (!this.config.strictMode && errors.length === 0);

    const overallSeverity = errors.length > 0 ? 'error' :
                           warnings.length > 0 ? 'warning' :
                           info.length > 0 ? 'info' : 'success';

    return {
      isValid,
      canProceed,
      overallSeverity,
      executionTime: Date.now() - startTime,
      rulesExecuted: rulesToExecute.length,
      errors,
      warnings,
      info,
      recommendations: this.generateRecommendations(results, context),
      metadata: {
        validationId: context.metadata.requestId,
        timestamp: new Date().toISOString(),
        context: context.metadata
      }
    };
  }

  /**
   * MÉTODO: Registrar reglas de validación por defecto
   */
  private registerDefaultValidationRules(): void {
    // VALIDACIONES DE ESTRUCTURA
    this.registerValidationRule({
      id: 'node_exists',
      name: 'Verificar existencia de nodo',
      description: 'Verificar que el nodo destino existe y es accesible',
      priority: 'critical',
      category: 'structure',
      isBlocking: true,
      validate: async (context) => {
        if (!context.toNode) {
          return {
            isValid: false,
            severity: 'error',
            message: 'Nodo destino no encontrado',
            canProceed: false,
            suggestedAction: 'Verificar la configuración del template'
          };
        }
        return {
          isValid: true,
          severity: 'info',
          message: 'Nodo destino válido',
          canProceed: true
        };
      }
    });

    this.registerValidationRule({
      id: 'tenant_isolation',
      name: 'Verificar aislamiento de tenant',
      description: 'Verificar que el nodo pertenece al tenant correcto',
      priority: 'critical',
      category: 'security',
      isBlocking: true,
      validate: async (context) => {
        if (context.toNode.tenantId !== context.navigationContext.tenantId) {
          return {
            isValid: false,
            severity: 'error',
            message: `Nodo ${context.toNode.nodeId} no pertenece al tenant ${context.navigationContext.tenantId}`,
            canProceed: false,
            suggestedAction: 'Verificar permisos de acceso'
          };
        }
        return {
          isValid: true,
          severity: 'info',
          message: 'Aislamiento de tenant válido',
          canProceed: true
        };
      }
    });

    // VALIDACIONES DE DATOS
    this.registerValidationRule({
      id: 'required_variables',
      name: 'Verificar variables requeridas',
      description: 'Verificar que todas las variables requeridas están disponibles',
      priority: 'high',
      category: 'data',
      isBlocking: false,
      validate: async (context) => {
        const requiredVars = context.template?.metadata.requiredVariables || [];
        const missingVars: string[] = [];

        for (const varName of requiredVars) {
          if (!context.navigationContext.globalVars[varName] && 
              !context.navigationContext.collectedData[varName]) {
            missingVars.push(varName);
          }
        }

        if (missingVars.length > 0) {
          return {
            isValid: false,
            severity: 'warning',
            message: `Variables requeridas faltantes: ${missingVars.join(', ')}`,
            details: { missingVariables: missingVars },
            canProceed: true,
            suggestedAction: 'Recolectar las variables faltantes antes de continuar'
          };
        }

        return {
          isValid: true,
          severity: 'info',
          message: 'Todas las variables requeridas están disponibles',
          canProceed: true
        };
      }
    });

    // VALIDACIONES DE LEADS (CRÍTICO)
    this.registerValidationRule({
      id: 'lead_progression_integrity',
      name: 'Verificar integridad de progresión de leads',
      description: 'Verificar que la navegación preserva la integridad del sistema de leads',
      priority: 'critical',
      category: 'leads',
      isBlocking: false, // No bloquear, solo advertir
      validate: async (context) => {
        // CRÍTICO: NO tocar el sistema de leads actual
        // Solo validar que los datos de leads se preserven correctamente
        
        if (context.toNode.metadata.leadStageId && context.navigationContext.leadData) {
          const currentStage = context.navigationContext.leadData.currentStage;
          const targetStage = context.toNode.metadata.leadStageId;

          // Verificar que la progresión sea lógica
          if (currentStage && currentStage === targetStage) {
            return {
              isValid: true,
              severity: 'warning',
              message: `Lead ya se encuentra en la etapa ${targetStage}`,
              details: { currentStage, targetStage },
              canProceed: true,
              suggestedAction: 'Verificar lógica de progresión de leads'
            };
          }
        }

        return {
          isValid: true,
          severity: 'info',
          message: 'Integridad de leads preservada',
          canProceed: true
        };
      }
    });

    // VALIDACIONES DE CONTEXTO
    this.registerValidationRule({
      id: 'session_validity',
      name: 'Verificar validez de sesión',
      description: 'Verificar que la sesión es válida y activa',
      priority: 'high',
      category: 'context',
      isBlocking: false,
      validate: async (context) => {
        if (context.navigationContext.sessionId) {
          // En implementación real, verificar con ImprovedSessionManager
          // Por ahora, asumimos que es válida si existe
          return {
            isValid: true,
            severity: 'info',
            message: 'Sesión válida',
            canProceed: true
          };
        }

        return {
          isValid: true,
          severity: 'warning',
          message: 'Navegando sin sesión persistente',
          canProceed: true,
          suggestedAction: 'Considerar establecer sesión persistente'
        };
      }
    });

    // VALIDACIONES DE LÓGICA DE NEGOCIO
    this.registerValidationRule({
      id: 'circular_navigation',
      name: 'Detectar navegación circular',
      description: 'Detectar posibles bucles infinitos en la navegación',
      priority: 'medium',
      category: 'business_logic',
      isBlocking: false,
      validate: async (context) => {
        const history = context.navigationContext.navigationHistory;
        const recentNodes = history.slice(-5).map(step => step.toNodeId);
        const targetNodeId = context.toNode.nodeId;

        const occurrences = recentNodes.filter(nodeId => nodeId === targetNodeId).length;

        if (occurrences >= 2) {
          return {
            isValid: false,
            severity: 'warning',
            message: `Posible navegación circular detectada hacia nodo ${targetNodeId}`,
            details: { recentNodes, occurrences },
            canProceed: true,
            suggestedAction: 'Revisar lógica de navegación para evitar bucles'
          };
        }

        return {
          isValid: true,
          severity: 'info',
          message: 'No se detectó navegación circular',
          canProceed: true
        };
      }
    });

    // VALIDACIONES DE RENDIMIENTO
    this.registerValidationRule({
      id: 'navigation_rate_limit',
      name: 'Verificar límite de tasa de navegación',
      description: 'Verificar que no se excede el límite de navegaciones por minuto',
      priority: 'low',
      category: 'performance',
      isBlocking: false,
      validate: async (context) => {
        const history = context.navigationContext.navigationHistory;
        const lastMinute = Date.now() - 60000;
        
        const recentNavigations = history.filter(step => 
          new Date(step.timestamp).getTime() > lastMinute
        );

        if (recentNavigations.length > 30) { // Máximo 30 navegaciones por minuto
          return {
            isValid: false,
            severity: 'warning',
            message: `Tasa de navegación alta: ${recentNavigations.length} navegaciones en el último minuto`,
            details: { navigationCount: recentNavigations.length },
            canProceed: true,
            suggestedAction: 'Considerar optimizar la lógica de navegación'
          };
        }

        return {
          isValid: true,
          severity: 'info',
          message: 'Tasa de navegación dentro de límites normales',
          canProceed: true
        };
      }
    });

    logger.info(`[FlowValidationService] ${this.validationRules.size} reglas de validación registradas`);
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private selectValidationRules(context: ValidationContext, customRules?: string[]): ValidationRule[] {
    const selectedRules: ValidationRule[] = [];

    // Si se especifican reglas personalizadas, usar solo esas
    if (customRules && customRules.length > 0) {
      for (const ruleId of customRules) {
        const rule = this.validationRules.get(ruleId);
        if (rule) {
          selectedRules.push(rule);
        }
      }
      return selectedRules;
    }

    // Seleccionar reglas basadas en configuración
    for (const rule of this.validationRules.values()) {
      const categoryConfig = this.config.categories[rule.category];
      
      if (categoryConfig && categoryConfig.enabled) {
        selectedRules.push(rule);
      }
    }

    return selectedRules;
  }

  private generateRecommendations(results: ValidationRuleResult[], context: ValidationContext): string[] {
    const recommendations: string[] = [];

    // Agregar recomendaciones específicas de los resultados
    for (const result of results) {
      if (result.suggestedAction && !result.isValid) {
        recommendations.push(result.suggestedAction);
      }
    }

    // Recomendaciones generales basadas en el contexto
    if (context.navigationContext.navigationHistory.length === 0) {
      recommendations.push('Considerar inicializar el historial de navegación');
    }

    if (!context.navigationContext.sessionId) {
      recommendations.push('Considerar establecer sesión persistente para mejor experiencia');
    }

    if (Object.keys(context.navigationContext.collectedData).length === 0) {
      recommendations.push('Verificar que se estén recolectando datos del usuario correctamente');
    }

    return [...new Set(recommendations)]; // Eliminar duplicados
  }

  private async findNode(nodeId: string, template?: FlowTemplate): Promise<NavigationNode | null> {
    if (template) {
      return template.nodes.find(node => node.nodeId === nodeId) || null;
    }

    // En implementación real, buscar en registry de DynamicNavigationService
    // Por ahora, simular búsqueda
    return {
      nodeId,
      nodeType: 'message',
      tenantId: 'default',
      data: { message: 'Nodo simulado' },
      metadata: {}
    } as NavigationNode;
  }

  private async getTemplate(templateId: string): Promise<FlowTemplate | null> {
    // Verificar caché primero
    const cached = this.templateCache.get(templateId);
    if (cached) {
      return cached;
    }

    // En implementación real, obtener de base de datos
    // Por ahora, simular template
    const template: FlowTemplate = {
      id: templateId,
      name: 'Template simulado',
      version: '1.0',
      tenantId: 'default',
      nodes: [],
      connections: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0',
        isActive: true,
        complexity: 'medium'
      }
    };

    this.templateCache.set(templateId, template);
    return template;
  }

  private generateCacheKey(context: NavigationContext, fromNodeId?: string, toNodeId?: string): string {
    return `${context.userId}_${context.tenantId}_${fromNodeId || 'start'}_${toNodeId}_${context.templateId || 'default'}`;
  }

  private isCacheValid(report: ValidationReport): boolean {
    const age = Date.now() - new Date(report.metadata.timestamp).getTime();
    return age < this.config.cacheExpiration;
  }

  private convertReportToResult(report: ValidationReport): FlowValidationResult {
    return {
      isValid: report.isValid,
      errors: report.errors.map(e => e.message),
      warnings: report.warnings.map(w => w.message),
      suggestions: report.recommendations,
      canProceed: report.canProceed
    };
  }

  private recordValidationMetrics(report: ValidationReport, executionTime: number): void {
    const metrics = {
      timestamp: Date.now(),
      executionTime,
      rulesExecuted: report.rulesExecuted,
      isValid: report.isValid,
      severity: report.overallSeverity,
      errorCount: report.errors.length,
      warningCount: report.warnings.length
    };

    // Almacenar métricas (en implementación real, enviar a sistema de métricas)
    this.metrics.set(`validation_${Date.now()}`, metrics);

    // Mantener solo las últimas 1000 métricas
    if (this.metrics.size > 1000) {
      const oldestKey = Array.from(this.metrics.keys())[0];
      this.metrics.delete(oldestKey);
    }
  }

  /**
   * MÉTODOS PÚBLICOS PARA GESTIÓN DE REGLAS
   */

  registerValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
    logger.debug(`[FlowValidationService] Regla de validación registrada: ${rule.id}`);
  }

  unregisterValidationRule(ruleId: string): boolean {
    const removed = this.validationRules.delete(ruleId);
    if (removed) {
      logger.debug(`[FlowValidationService] Regla de validación eliminada: ${ruleId}`);
    }
    return removed;
  }

  getValidationRule(ruleId: string): ValidationRule | null {
    return this.validationRules.get(ruleId) || null;
  }

  getAllValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  updateConfiguration(newConfig: Partial<ValidationConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[FlowValidationService] Configuración actualizada`);
  }

  getValidationMetrics(): any[] {
    return Array.from(this.metrics.values());
  }

  clearCache(): void {
    this.validationCache.clear();
    this.templateCache.clear();
    logger.info(`[FlowValidationService] Cache limpiado`);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.validationRules.clear();
    this.templateCache.clear();
    this.validationCache.clear();
    this.metrics.clear();
    logger.info(`[FlowValidationService] Servicio destruido`);
  }
}

export default FlowValidationService;
export type {
  ValidationRule,
  ValidationContext,
  ValidationRuleResult,
  ValidationConfiguration,
  ValidationReport,
  FlowTemplate,
  ValidationPriority,
  ValidationCategory
};