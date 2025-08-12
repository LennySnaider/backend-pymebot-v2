/**
 * HYBRID TEMPLATE MANAGER SERVICE
 * 
 * PROPÓSITO: Gestión configurable de templates que usan módulos híbridos
 * BASADO EN: Sistemas de configuración del v1-reference y mejores prácticas
 * PRESERVA: Sistema actual 100% intacto - solo configuración adicional
 * TRANSPARENTE: Gestión centralizada de qué templates usan módulos híbridos
 * 
 * FUNCIONALIDADES:
 * - Lista configurable de templates híbridos por tenant
 * - Configuración granular de módulos por template
 * - Override temporal para testing y rollback
 * - Métricas de uso y rendimiento por template
 * - Sincronización con detectores automáticos
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import type { HybridModuleName } from './templateDetector';
// import type { ChatbotTemplate } from '../types/Template';
type ChatbotTemplate = any;

// INTERFACES PARA GESTIÓN DE TEMPLATES HÍBRIDOS

interface HybridTemplateConfiguration {
  templateId: string;
  templateName: string;
  tenantId: string;
  isHybridEnabled: boolean;
  enabledModules: HybridModuleName[];
  disabledModules: HybridModuleName[];
  configuration: TemplateHybridConfig;
  metadata: TemplateConfigMetadata;
  status: ConfigurationStatus;
}

interface TemplateHybridConfig {
  captureConfig?: CaptureConfiguration;
  sessionConfig?: SessionConfiguration;
  navigationConfig?: NavigationConfiguration;
  queueConfig?: QueueConfiguration;
  validationConfig?: ValidationConfiguration;
  errorHandlingConfig?: ErrorHandlingConfiguration;
  customSettings?: Record<string, any>;
}

interface CaptureConfiguration {
  enableTwoPhaseCapture: boolean;
  captureTimeout: number;
  maxRetries: number;
  fallbackOnTimeout: boolean;
  preserveContext: boolean;
  customValidation?: string[];
}

interface SessionConfiguration {
  enablePersistentSessions: boolean;
  sessionTTL: number;
  cacheStrategy: 'memory' | 'redis' | 'database';
  enableSessionRecovery: boolean;
  cleanupInterval: number;
}

interface NavigationConfiguration {
  enableDynamicNavigation: boolean;
  enableFlowValidation: boolean;
  enableContextPreservation: boolean;
  maxNavigationDepth: number;
  circularNavigationLimit: number;
}

interface QueueConfiguration {
  enableNodeQueue: boolean;
  maxConcurrency: number;
  queueTimeout: number;
  priorityLevels: string[];
  enableDependencyTracking: boolean;
}

interface ValidationConfiguration {
  enablePreNavigation: boolean;
  validationDepth: 'basic' | 'standard' | 'comprehensive';
  enableCustomRules: boolean;
  customRules?: string[];
  strictMode: boolean;
}

interface ErrorHandlingConfiguration {
  enableAutoRecovery: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeout: number;
  enableRollback: boolean;
  preserveLeadData: boolean;
}

interface TemplateConfigMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastModifiedBy: string;
  version: string;
  configurationSource: 'manual' | 'automatic' | 'imported';
  lastAnalysis?: string;
  performanceMetrics?: TemplatePerformanceMetrics;
  usageStatistics?: TemplateUsageStats;
}

interface TemplatePerformanceMetrics {
  averageResponseTime: number;
  captureSuccessRate: number;
  errorRate: number;
  sessionDropRate: number;
  userSatisfactionScore?: number;
  lastUpdated: string;
}

interface TemplateUsageStats {
  totalConversations: number;
  dailyUsage: number;
  peakUsageHours: number[];
  averageConversationLength: number;
  completionRate: number;
}

type ConfigurationStatus = 
  | 'active'           // Configuración activa y en uso
  | 'testing'          // En periodo de prueba
  | 'disabled'         // Temporalmente deshabilitado
  | 'deprecated'       // Marcado para eliminación
  | 'migrating'        // En proceso de migración
  | 'error';           // Error en configuración

interface TenantHybridPolicy {
  tenantId: string;
  tenantName: string;
  globalHybridEnabled: boolean;
  defaultModules: HybridModuleName[];
  restrictedModules: HybridModuleName[];
  autoDetectionEnabled: boolean;
  requiresApproval: boolean;
  maxHybridTemplates: number;
  configurationOverrides: TenantConfigOverrides;
  policyMetadata: TenantPolicyMetadata;
}

interface TenantConfigOverrides {
  forceCaptureModule: boolean;
  forceSessionModule: boolean;
  forceNavigationModule: boolean;
  customTimeouts: Record<string, number>;
  customThresholds: Record<string, number>;
  emergencyFallbackEnabled: boolean;
}

interface TenantPolicyMetadata {
  createdAt: string;
  lastReviewed: string;
  approvedBy: string;
  complianceLevel: 'basic' | 'standard' | 'enterprise';
  riskProfile: 'low' | 'medium' | 'high';
}

interface ConfigurationRule {
  id: string;
  name: string;
  description: string;
  condition: ConfigurationCondition;
  action: ConfigurationAction;
  priority: number;
  isActive: boolean;
  applicableTenants?: string[];
  applicableTemplates?: string[];
}

interface ConfigurationCondition {
  type: 'template_complexity' | 'error_rate' | 'usage_frequency' | 'tenant_policy' | 'custom';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
  value: any;
  field?: string;
}

interface ConfigurationAction {
  type: 'enable_modules' | 'disable_modules' | 'update_config' | 'notify_admin' | 'custom';
  parameters: Record<string, any>;
  description: string;
}

interface BulkOperationRequest {
  operation: 'enable' | 'disable' | 'update' | 'migrate';
  templateIds: string[];
  tenantIds?: string[];
  configuration?: Partial<TemplateHybridConfig>;
  modules?: HybridModuleName[];
  options: BulkOperationOptions;
}

interface BulkOperationOptions {
  validateBeforeApply: boolean;
  createBackup: boolean;
  rollbackOnError: boolean;
  notifyOnCompletion: boolean;
  dryRun: boolean;
}

interface BulkOperationResult {
  operationId: string;
  success: boolean;
  totalTemplates: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedTemplates: number;
  results: TemplateOperationResult[];
  duration: number;
  errors?: string[];
}

interface TemplateOperationResult {
  templateId: string;
  templateName: string;
  success: boolean;
  action: string;
  previousConfig?: HybridTemplateConfiguration;
  newConfig?: HybridTemplateConfiguration;
  error?: string;
}

interface HybridManagerMetrics {
  totalTemplates: number;
  hybridTemplates: number;
  activeTemplates: number;
  testingTemplates: number;
  disabledTemplates: number;
  moduleUsage: Map<HybridModuleName, number>;
  tenantAdoption: Map<string, number>;
  averagePerformanceGain: number;
  errorRateReduction: number;
}

/**
 * SERVICIO PRINCIPAL DE GESTIÓN DE TEMPLATES HÍBRIDOS
 */
class HybridTemplateManagerService {
  private static instance: HybridTemplateManagerService;
  private templateConfigurations: Map<string, HybridTemplateConfiguration> = new Map();
  private tenantPolicies: Map<string, TenantHybridPolicy> = new Map();
  private configurationRules: Map<string, ConfigurationRule> = new Map();
  private performanceMetrics: Map<string, TemplatePerformanceMetrics> = new Map();
  private usageStatistics: Map<string, TemplateUsageStats> = new Map();
  private bulkOperations: Map<string, BulkOperationResult> = new Map();
  private metrics: HybridManagerMetrics;

  private constructor() {
    this.metrics = {
      totalTemplates: 0,
      hybridTemplates: 0,
      activeTemplates: 0,
      testingTemplates: 0,
      disabledTemplates: 0,
      moduleUsage: new Map(),
      tenantAdoption: new Map(),
      averagePerformanceGain: 0,
      errorRateReduction: 0
    };

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(): HybridTemplateManagerService {
    if (!HybridTemplateManagerService.instance) {
      HybridTemplateManagerService.instance = new HybridTemplateManagerService();
    }
    return HybridTemplateManagerService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.loadDefaultConfigurations();
    this.loadDefaultTenantPolicies();
    this.loadDefaultConfigurationRules();
    logger.info(`[HybridTemplateManagerService] Servicio inicializado`);
  }

  /**
   * MÉTODO PRINCIPAL: Configurar template para usar módulos híbridos
   */
  async configureHybridTemplate(
    templateId: string,
    configuration: Partial<HybridTemplateConfiguration>,
    options: {
      validateTemplate?: boolean;
      createBackup?: boolean;
      notifyTenant?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    configuration?: HybridTemplateConfiguration;
    warnings?: string[];
    errors?: string[];
  }> {
    logger.info(`[HybridTemplateManagerService] Configurando template híbrido: ${templateId}`);

    try {
      // PASO 1: VALIDAR TEMPLATE SI ES REQUERIDO
      if (options.validateTemplate) {
        const validation = await this.validateTemplateForHybrid(templateId);
        if (!validation.isValid) {
          return {
            success: false,
            errors: validation.errors
          };
        }
      }

      // PASO 2: OBTENER CONFIGURACIÓN EXISTENTE O CREAR NUEVA
      const existingConfig = this.templateConfigurations.get(templateId);
      const newConfig = await this.mergeConfiguration(existingConfig, configuration);

      // PASO 3: VALIDAR CONFIGURACIÓN
      const configValidation = await this.validateConfiguration(newConfig);
      if (!configValidation.isValid) {
        return {
          success: false,
          errors: configValidation.errors
        };
      }

      // PASO 4: VERIFICAR POLÍTICAS DE TENANT
      const policyCheck = await this.checkTenantPolicy(newConfig);
      if (!policyCheck.allowed) {
        return {
          success: false,
          errors: [`Política de tenant no permite la configuración: ${policyCheck.reason}`]
        };
      }

      // PASO 5: CREAR BACKUP SI ES REQUERIDO
      if (options.createBackup && existingConfig) {
        await this.createConfigurationBackup(templateId, existingConfig);
      }

      // PASO 6: APLICAR CONFIGURACIÓN (SI NO ES DRY RUN)
      if (!options.dryRun) {
        await this.applyConfiguration(templateId, newConfig);
        
        // Actualizar métricas
        this.updateMetrics(newConfig);
        
        // Notificar si es requerido
        if (options.notifyTenant) {
          await this.notifyTenantConfigurationChange(newConfig);
        }
      }

      return {
        success: true,
        configuration: newConfig,
        warnings: configValidation.warnings
      };

    } catch (error) {
      logger.error(`[HybridTemplateManagerService] Error configurando template ${templateId}:`, error);
      return {
        success: false,
        errors: [`Error interno: ${error}`]
      };
    }
  }

  /**
   * MÉTODO: Obtener configuración de template híbrido
   */
  getHybridTemplateConfiguration(templateId: string): HybridTemplateConfiguration | null {
    return this.templateConfigurations.get(templateId) || null;
  }

  /**
   * MÉTODO: Verificar si template debe usar módulos híbridos
   */
  shouldUseHybridModules(
    templateId: string,
    tenantId: string,
    context?: { userId?: string; platform?: string }
  ): {
    shouldUse: boolean;
    modules: HybridModuleName[];
    reason: string;
    configuration?: HybridTemplateConfiguration;
  } {
    // VERIFICAR CONFIGURACIÓN ESPECÍFICA DEL TEMPLATE
    const templateConfig = this.templateConfigurations.get(templateId);
    if (templateConfig) {
      if (templateConfig.isHybridEnabled && templateConfig.status === 'active') {
        return {
          shouldUse: true,
          modules: templateConfig.enabledModules,
          reason: 'Configuración específica del template',
          configuration: templateConfig
        };
      }
      
      if (templateConfig.status === 'disabled') {
        return {
          shouldUse: false,
          modules: [],
          reason: 'Template deshabilitado para módulos híbridos'
        };
      }
    }

    // VERIFICAR POLÍTICA DEL TENANT
    const tenantPolicy = this.tenantPolicies.get(tenantId);
    if (tenantPolicy) {
      if (!tenantPolicy.globalHybridEnabled) {
        return {
          shouldUse: false,
          modules: [],
          reason: 'Políticas de tenant deshabilitan módulos híbridos'
        };
      }

      // Usar módulos por defecto del tenant
      if (tenantPolicy.defaultModules.length > 0) {
        return {
          shouldUse: true,
          modules: tenantPolicy.defaultModules,
          reason: 'Configuración por defecto del tenant'
        };
      }
    }

    // APLICAR REGLAS DE CONFIGURACIÓN AUTOMÁTICA
    const ruleResult = this.applyConfigurationRules(templateId, tenantId, context);
    if (ruleResult.shouldApply) {
      return {
        shouldUse: true,
        modules: ruleResult.modules,
        reason: `Regla automática: ${ruleResult.ruleName}`
      };
    }

    // POR DEFECTO, NO USAR MÓDULOS HÍBRIDOS
    return {
      shouldUse: false,
      modules: [],
      reason: 'Sin configuración específica, usando sistema actual'
    };
  }

  /**
   * MÉTODO: Listar templates híbridos por tenant
   */
  getHybridTemplatesByTenant(
    tenantId: string,
    filter?: {
      status?: ConfigurationStatus[];
      modules?: HybridModuleName[];
      includeMetrics?: boolean;
    }
  ): HybridTemplateConfiguration[] {
    const templates = Array.from(this.templateConfigurations.values())
      .filter(config => config.tenantId === tenantId);

    let filteredTemplates = templates;

    // Filtrar por status
    if (filter?.status) {
      filteredTemplates = filteredTemplates.filter(config => 
        filter.status!.includes(config.status)
      );
    }

    // Filtrar por módulos
    if (filter?.modules) {
      filteredTemplates = filteredTemplates.filter(config =>
        filter.modules!.some(module => config.enabledModules.includes(module))
      );
    }

    // Incluir métricas si es requerido
    if (filter?.includeMetrics) {
      filteredTemplates.forEach(config => {
        const metrics = this.performanceMetrics.get(config.templateId);
        const usage = this.usageStatistics.get(config.templateId);
        
        if (metrics) {
          config.metadata.performanceMetrics = metrics;
        }
        if (usage) {
          config.metadata.usageStatistics = usage;
        }
      });
    }

    return filteredTemplates;
  }

  /**
   * MÉTODO: Operaciones en lote
   */
  async executeBulkOperation(request: BulkOperationRequest): Promise<BulkOperationResult> {
    const operationId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info(`[HybridTemplateManagerService] Ejecutando operación en lote ${operationId}: ${request.operation}`);

    const result: BulkOperationResult = {
      operationId,
      success: false,
      totalTemplates: request.templateIds.length,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedTemplates: 0,
      results: [],
      duration: 0,
      errors: []
    };

    try {
      // VALIDAR OPERACIÓN SI ES REQUERIDO
      if (request.options.validateBeforeApply) {
        const validation = await this.validateBulkOperation(request);
        if (!validation.isValid) {
          result.errors = validation.errors;
          return result;
        }
      }

      // CREAR BACKUP SI ES REQUERIDO
      if (request.options.createBackup) {
        await this.createBulkBackup(request.templateIds);
      }

      // EJECUTAR OPERACIÓN EN CADA TEMPLATE
      for (const templateId of request.templateIds) {
        try {
          const templateResult = await this.executeTemplateOperation(
            templateId,
            request,
            request.options.dryRun
          );

          result.results.push(templateResult);

          if (templateResult.success) {
            result.successfulUpdates++;
          } else {
            result.failedUpdates++;
          }

        } catch (error) {
          logger.error(`[HybridTemplateManagerService] Error en template ${templateId}:`, error);
          
          result.results.push({
            templateId,
            templateName: 'Desconocido',
            success: false,
            action: request.operation,
            error: String(error)
          });
          
          result.failedUpdates++;

          // Si está configurado para rollback en error, detener operación
          if (request.options.rollbackOnError) {
            await this.rollbackBulkOperation(operationId, result.results);
            result.errors!.push('Operación revertida debido a errores');
            break;
          }
        }
      }

      result.duration = Date.now() - startTime;
      result.success = result.failedUpdates === 0;

      // Notificar si es requerido
      if (request.options.notifyOnCompletion) {
        await this.notifyBulkOperationCompletion(result);
      }

      // Almacenar resultado para consulta posterior
      this.bulkOperations.set(operationId, result);

      logger.info(`[HybridTemplateManagerService] Operación en lote completada: ${result.successfulUpdates}/${result.totalTemplates} exitosos`);

      return result;

    } catch (error) {
      logger.error(`[HybridTemplateManagerService] Error en operación en lote ${operationId}:`, error);
      
      result.duration = Date.now() - startTime;
      result.errors = [`Error crítico: ${error}`];
      
      return result;
    }
  }

  /**
   * MÉTODO: Gestión de políticas de tenant
   */
  async setTenantHybridPolicy(
    tenantId: string,
    policy: Partial<TenantHybridPolicy>
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const existingPolicy = this.tenantPolicies.get(tenantId);
      const newPolicy: TenantHybridPolicy = {
        tenantId,
        tenantName: policy.tenantName || 'Desconocido',
        globalHybridEnabled: policy.globalHybridEnabled ?? true,
        defaultModules: policy.defaultModules || [],
        restrictedModules: policy.restrictedModules || [],
        autoDetectionEnabled: policy.autoDetectionEnabled ?? true,
        requiresApproval: policy.requiresApproval ?? false,
        maxHybridTemplates: policy.maxHybridTemplates || 100,
        configurationOverrides: policy.configurationOverrides || {
          forceCaptureModule: false,
          forceSessionModule: false,
          forceNavigationModule: false,
          customTimeouts: {},
          customThresholds: {},
          emergencyFallbackEnabled: true
        },
        policyMetadata: {
          createdAt: existingPolicy?.policyMetadata.createdAt || new Date().toISOString(),
          lastReviewed: new Date().toISOString(),
          approvedBy: policy.policyMetadata?.approvedBy || 'system',
          complianceLevel: policy.policyMetadata?.complianceLevel || 'standard',
          riskProfile: policy.policyMetadata?.riskProfile || 'medium'
        }
      };

      this.tenantPolicies.set(tenantId, newPolicy);
      logger.info(`[HybridTemplateManagerService] Política híbrida configurada para tenant ${tenantId}`);

      return { success: true };

    } catch (error) {
      logger.error(`[HybridTemplateManagerService] Error configurando política para tenant ${tenantId}:`, error);
      return { success: false, errors: [String(error)] };
    }
  }

  /**
   * MÉTODO: Actualizar métricas de rendimiento
   */
  updateTemplatePerformanceMetrics(
    templateId: string,
    metrics: Partial<TemplatePerformanceMetrics>
  ): void {
    const existing = this.performanceMetrics.get(templateId);
    const updated: TemplatePerformanceMetrics = {
      averageResponseTime: metrics.averageResponseTime ?? existing?.averageResponseTime ?? 0,
      captureSuccessRate: metrics.captureSuccessRate ?? existing?.captureSuccessRate ?? 0,
      errorRate: metrics.errorRate ?? existing?.errorRate ?? 0,
      sessionDropRate: metrics.sessionDropRate ?? existing?.sessionDropRate ?? 0,
      userSatisfactionScore: metrics.userSatisfactionScore ?? existing?.userSatisfactionScore,
      lastUpdated: new Date().toISOString()
    };

    this.performanceMetrics.set(templateId, updated);
    
    // Actualizar configuración del template si existe
    const config = this.templateConfigurations.get(templateId);
    if (config) {
      config.metadata.performanceMetrics = updated;
      config.metadata.updatedAt = new Date().toISOString();
    }
  }

  /**
   * MÉTODO: Obtener métricas del manager
   */
  getManagerMetrics(): HybridManagerMetrics {
    this.updateManagerMetrics();
    return { ...this.metrics };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private loadDefaultConfigurations(): void {
    // En implementación real, cargar desde base de datos
    logger.debug(`[HybridTemplateManagerService] Configuraciones por defecto cargadas`);
  }

  private loadDefaultTenantPolicies(): void {
    // Política por defecto para nuevos tenants
    const defaultPolicy: TenantHybridPolicy = {
      tenantId: 'default',
      tenantName: 'Política Por Defecto',
      globalHybridEnabled: true,
      defaultModules: ['enhancedDataCapture', 'improvedSessionManager'],
      restrictedModules: [],
      autoDetectionEnabled: true,
      requiresApproval: false,
      maxHybridTemplates: 50,
      configurationOverrides: {
        forceCaptureModule: false,
        forceSessionModule: false,
        forceNavigationModule: false,
        customTimeouts: {},
        customThresholds: {},
        emergencyFallbackEnabled: true
      },
      policyMetadata: {
        createdAt: new Date().toISOString(),
        lastReviewed: new Date().toISOString(),
        approvedBy: 'system',
        complianceLevel: 'standard',
        riskProfile: 'medium'
      }
    };

    this.tenantPolicies.set('default', defaultPolicy);
  }

  private loadDefaultConfigurationRules(): void {
    // Regla: Templates complejos deben usar navegación dinámica
    this.configurationRules.set('complex_templates', {
      id: 'complex_templates',
      name: 'Templates Complejos',
      description: 'Templates con más de 10 nodos deben usar navegación dinámica',
      condition: {
        type: 'template_complexity',
        operator: 'greater_than',
        value: 10,
        field: 'nodeCount'
      },
      action: {
        type: 'enable_modules',
        parameters: { modules: ['dynamicNavigation', 'flowValidationService'] },
        description: 'Habilitar navegación dinámica y validación'
      },
      priority: 1,
      isActive: true
    });

    // Regla: Templates con alta tasa de error deben usar todos los módulos
    this.configurationRules.set('high_error_rate', {
      id: 'high_error_rate',
      name: 'Alta Tasa de Error',
      description: 'Templates con más de 10% de error necesitan módulos híbridos',
      condition: {
        type: 'error_rate',
        operator: 'greater_than',
        value: 0.1,
        field: 'errorRate'
      },
      action: {
        type: 'enable_modules',
        parameters: { 
          modules: [
            'enhancedDataCapture',
            'improvedSessionManager',
            'dynamicNavigation',
            'navigationErrorHandler'
          ]
        },
        description: 'Habilitar todos los módulos de recovery'
      },
      priority: 2,
      isActive: true
    });
  }

  private async validateTemplateForHybrid(templateId: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // En implementación real, validar template desde base de datos
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  private async mergeConfiguration(
    existing: HybridTemplateConfiguration | undefined,
    partial: Partial<HybridTemplateConfiguration>
  ): Promise<HybridTemplateConfiguration> {
    const now = new Date().toISOString();

    return {
      templateId: partial.templateId || existing?.templateId || '',
      templateName: partial.templateName || existing?.templateName || '',
      tenantId: partial.tenantId || existing?.tenantId || '',
      isHybridEnabled: partial.isHybridEnabled ?? existing?.isHybridEnabled ?? true,
      enabledModules: partial.enabledModules || existing?.enabledModules || [],
      disabledModules: partial.disabledModules || existing?.disabledModules || [],
      configuration: {
        ...existing?.configuration,
        ...partial.configuration
      },
      metadata: {
        createdAt: existing?.metadata.createdAt || now,
        updatedAt: now,
        createdBy: existing?.metadata.createdBy || 'system',
        lastModifiedBy: partial.metadata?.lastModifiedBy || 'system',
        version: this.incrementVersion(existing?.metadata.version),
        configurationSource: partial.metadata?.configurationSource || 'manual',
        lastAnalysis: partial.metadata?.lastAnalysis,
        performanceMetrics: existing?.metadata.performanceMetrics,
        usageStatistics: existing?.metadata.usageStatistics
      },
      status: partial.status || existing?.status || 'active'
    };
  }

  private incrementVersion(currentVersion?: string): string {
    if (!currentVersion) return '1.0.0';
    
    const parts = currentVersion.split('.').map(Number);
    parts[2]++; // Incrementar patch version
    
    return parts.join('.');
  }

  private async validateConfiguration(config: HybridTemplateConfiguration): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar campos requeridos
    if (!config.templateId) {
      errors.push('Template ID es requerido');
    }

    if (!config.tenantId) {
      errors.push('Tenant ID es requerido');
    }

    if (config.enabledModules.length === 0 && config.isHybridEnabled) {
      warnings.push('Template híbrido habilitado pero sin módulos especificados');
    }

    // Validar conflictos entre módulos habilitados y deshabilitados
    const conflicts = config.enabledModules.filter(module => 
      config.disabledModules.includes(module)
    );

    if (conflicts.length > 0) {
      errors.push(`Conflicto en módulos: ${conflicts.join(', ')} están habilitados y deshabilitados`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async checkTenantPolicy(config: HybridTemplateConfiguration): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const policy = this.tenantPolicies.get(config.tenantId) || 
                   this.tenantPolicies.get('default');

    if (!policy) {
      return { allowed: true };
    }

    // Verificar si los módulos híbridos están habilitados globalmente
    if (!policy.globalHybridEnabled) {
      return {
        allowed: false,
        reason: 'Módulos híbridos deshabilitados por política de tenant'
      };
    }

    // Verificar módulos restringidos
    const restrictedModules = config.enabledModules.filter(module =>
      policy.restrictedModules.includes(module)
    );

    if (restrictedModules.length > 0) {
      return {
        allowed: false,
        reason: `Módulos restringidos por política: ${restrictedModules.join(', ')}`
      };
    }

    // Verificar límite de templates híbridos
    const currentHybridCount = Array.from(this.templateConfigurations.values())
      .filter(c => c.tenantId === config.tenantId && c.isHybridEnabled).length;

    if (currentHybridCount >= policy.maxHybridTemplates) {
      return {
        allowed: false,
        reason: `Límite de templates híbridos alcanzado (${policy.maxHybridTemplates})`
      };
    }

    return { allowed: true };
  }

  private async createConfigurationBackup(
    templateId: string,
    config: HybridTemplateConfiguration
  ): Promise<void> {
    // En implementación real, almacenar backup en base de datos
    logger.debug(`[HybridTemplateManagerService] Backup creado para template ${templateId}`);
  }

  private async applyConfiguration(
    templateId: string,
    config: HybridTemplateConfiguration
  ): Promise<void> {
    this.templateConfigurations.set(templateId, config);
    logger.info(`[HybridTemplateManagerService] Configuración aplicada para template ${templateId}`);
  }

  private applyConfigurationRules(
    templateId: string,
    tenantId: string,
    context?: { userId?: string; platform?: string }
  ): {
    shouldApply: boolean;
    modules: HybridModuleName[];
    ruleName?: string;
  } {
    // En implementación real, evaluar reglas contra métricas del template
    return {
      shouldApply: false,
      modules: []
    };
  }

  private async executeTemplateOperation(
    templateId: string,
    request: BulkOperationRequest,
    dryRun: boolean
  ): Promise<TemplateOperationResult> {
    const config = this.templateConfigurations.get(templateId);
    
    const result: TemplateOperationResult = {
      templateId,
      templateName: config?.templateName || 'Desconocido',
      success: false,
      action: request.operation,
      previousConfig: config
    };

    try {
      switch (request.operation) {
        case 'enable':
          if (!dryRun) {
            await this.enableHybridForTemplate(templateId, request.modules || []);
          }
          result.success = true;
          break;

        case 'disable':
          if (!dryRun) {
            await this.disableHybridForTemplate(templateId);
          }
          result.success = true;
          break;

        case 'update':
          if (!dryRun && request.configuration) {
            await this.updateTemplateConfiguration(templateId, request.configuration);
          }
          result.success = true;
          break;

        default:
          throw new Error(`Operación no soportada: ${request.operation}`);
      }

      if (!dryRun) {
        result.newConfig = this.templateConfigurations.get(templateId);
      }

    } catch (error) {
      result.error = String(error);
    }

    return result;
  }

  private async enableHybridForTemplate(
    templateId: string,
    modules: HybridModuleName[]
  ): Promise<void> {
    const config = this.templateConfigurations.get(templateId);
    if (config) {
      config.isHybridEnabled = true;
      config.enabledModules = [...new Set([...config.enabledModules, ...modules])];
      config.status = 'active';
      config.metadata.updatedAt = new Date().toISOString();
    }
  }

  private async disableHybridForTemplate(templateId: string): Promise<void> {
    const config = this.templateConfigurations.get(templateId);
    if (config) {
      config.isHybridEnabled = false;
      config.status = 'disabled';
      config.metadata.updatedAt = new Date().toISOString();
    }
  }

  private async updateTemplateConfiguration(
    templateId: string,
    newConfig: Partial<TemplateHybridConfig>
  ): Promise<void> {
    const config = this.templateConfigurations.get(templateId);
    if (config) {
      config.configuration = { ...config.configuration, ...newConfig };
      config.metadata.updatedAt = new Date().toISOString();
    }
  }

  private updateMetrics(config: HybridTemplateConfiguration): void {
    this.metrics.totalTemplates++;
    
    if (config.isHybridEnabled) {
      this.metrics.hybridTemplates++;
    }

    switch (config.status) {
      case 'active':
        this.metrics.activeTemplates++;
        break;
      case 'testing':
        this.metrics.testingTemplates++;
        break;
      case 'disabled':
        this.metrics.disabledTemplates++;
        break;
    }

    // Actualizar uso de módulos
    config.enabledModules.forEach(module => {
      const current = this.metrics.moduleUsage.get(module) || 0;
      this.metrics.moduleUsage.set(module, current + 1);
    });

    // Actualizar adopción por tenant
    const tenantCount = this.metrics.tenantAdoption.get(config.tenantId) || 0;
    this.metrics.tenantAdoption.set(config.tenantId, tenantCount + 1);
  }

  private updateManagerMetrics(): void {
    // Recalcular métricas basadas en estado actual
    this.metrics.totalTemplates = this.templateConfigurations.size;
    this.metrics.hybridTemplates = Array.from(this.templateConfigurations.values())
      .filter(c => c.isHybridEnabled).length;
    
    this.metrics.activeTemplates = Array.from(this.templateConfigurations.values())
      .filter(c => c.status === 'active').length;
  }

  private async validateBulkOperation(request: BulkOperationRequest): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (request.templateIds.length === 0) {
      errors.push('Lista de templates vacía');
    }

    if (request.templateIds.length > 100) {
      errors.push('Máximo 100 templates por operación en lote');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async createBulkBackup(templateIds: string[]): Promise<void> {
    logger.debug(`[HybridTemplateManagerService] Backup en lote creado para ${templateIds.length} templates`);
  }

  private async rollbackBulkOperation(
    operationId: string,
    results: TemplateOperationResult[]
  ): Promise<void> {
    logger.warn(`[HybridTemplateManagerService] Ejecutando rollback para operación ${operationId}`);
    
    // Revertir cambios exitosos
    for (const result of results) {
      if (result.success && result.previousConfig) {
        this.templateConfigurations.set(result.templateId, result.previousConfig);
      }
    }
  }

  private async notifyTenantConfigurationChange(config: HybridTemplateConfiguration): Promise<void> {
    logger.info(`[HybridTemplateManagerService] Notificación enviada a tenant ${config.tenantId} por cambio en template ${config.templateId}`);
  }

  private async notifyBulkOperationCompletion(result: BulkOperationResult): Promise<void> {
    logger.info(`[HybridTemplateManagerService] Operación en lote ${result.operationId} completada: ${result.successfulUpdates}/${result.totalTemplates} exitosos`);
  }

  /**
   * MÉTODOS PÚBLICOS ADICIONALES
   */

  getTenantPolicy(tenantId: string): TenantHybridPolicy | null {
    return this.tenantPolicies.get(tenantId) || this.tenantPolicies.get('default') || null;
  }

  getBulkOperationResult(operationId: string): BulkOperationResult | null {
    return this.bulkOperations.get(operationId) || null;
  }

  exportTemplateConfigurations(tenantId?: string): HybridTemplateConfiguration[] {
    const configurations = Array.from(this.templateConfigurations.values());
    
    if (tenantId) {
      return configurations.filter(config => config.tenantId === tenantId);
    }
    
    return configurations;
  }

  async importTemplateConfigurations(
    configurations: HybridTemplateConfiguration[],
    options: {
      overwriteExisting?: boolean;
      validateBeforeImport?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    try {
      for (const config of configurations) {
        const exists = this.templateConfigurations.has(config.templateId);
        
        if (exists && !options.overwriteExisting) {
          result.skipped++;
          continue;
        }

        if (options.validateBeforeImport) {
          const validation = await this.validateConfiguration(config);
          if (!validation.isValid) {
            result.errors.push(`Template ${config.templateId}: ${validation.errors.join(', ')}`);
            continue;
          }
        }

        this.templateConfigurations.set(config.templateId, config);
        result.imported++;
      }

      result.success = result.errors.length === 0;
      
      logger.info(`[HybridTemplateManagerService] Importación completada: ${result.imported} importados, ${result.skipped} omitidos`);

    } catch (error) {
      result.errors.push(`Error durante importación: ${error}`);
    }

    return result;
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.templateConfigurations.clear();
    this.tenantPolicies.clear();
    this.configurationRules.clear();
    this.performanceMetrics.clear();
    this.usageStatistics.clear();
    this.bulkOperations.clear();
    
    logger.info(`[HybridTemplateManagerService] Servicio destruido`);
  }
}

export default HybridTemplateManagerService;
export type {
  HybridTemplateConfiguration,
  TenantHybridPolicy,
  ConfigurationRule,
  BulkOperationRequest,
  BulkOperationResult,
  HybridManagerMetrics,
  TemplateHybridConfig,
  ConfigurationStatus
};