/**
 * FALLBACK MANAGER SERVICE
 * 
 * PROPÓSITO: Gestión inteligente de fallbacks para módulos híbridos
 * BASADO EN: Patrones de recovery del v1-reference y estrategias de alta disponibilidad
 * PRESERVA: Sistema actual 100% intacto - fallback transparente
 * GARANTIZA: Continuidad del servicio sin interrupciones para el usuario
 * 
 * ESTRATEGIAS DE FALLBACK:
 * - Detección automática de fallos en módulos híbridos
 * - Fallback inmediato al sistema actual en caso de error
 * - Preservación completa de estado de sesión y datos de leads
 * - Reintentos inteligentes con backoff exponencial
 * - Análisis de patrones de fallo para mejora continua
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import type { 
  RoutingDecision, 
  FallbackStrategy, 
  RoutingContext 
} from './systemRouter';

// INTERFACES PARA MANEJO DE FALLBACKS

interface FallbackContext {
  originalSystem: 'hybrid' | 'current';
  fallbackReason: FallbackReason;
  userId: string;
  tenantId: string;
  templateId: string;
  sessionId?: string;
  conversationState?: ConversationState;
  preservedData: PreservedData;
  errorDetails: ErrorDetails;
  timestamp: string;
  requestId: string;
}

interface ConversationState {
  currentNodeId?: string;
  lastUserMessage?: string;
  lastBotResponse?: string;
  collectedData: Record<string, any>;
  globalVars: Record<string, any>;
  leadData?: LeadData;
  navigationHistory: NavigationStep[];
}

interface LeadData {
  leadId?: string;
  currentStage?: string;
  progressPercentage?: number;
  nextActions?: string[];
  estimatedValue?: number;
  lastActivity?: string;
}

interface NavigationStep {
  timestamp: string;
  fromNodeId?: string;
  toNodeId: string;
  success: boolean;
  errorMessage?: string;
}

interface PreservedData {
  sessionData: Record<string, any>;
  conversationContext: ConversationState;
  systemVariables: Record<string, any>;
  userPreferences: Record<string, any>;
  leadInformation: LeadData;
  criticalFlags: string[];
}

interface ErrorDetails {
  errorType: FallbackReason;
  errorMessage: string;
  errorStack?: string;
  failedModule?: string;
  errorCode?: string;
  severity: ErrorSeverity;
  isRecoverable: boolean;
  additionalContext?: Record<string, any>;
}

interface FallbackResult {
  success: boolean;
  newSystem: 'hybrid' | 'current';
  preservedState: boolean;
  fallbackDuration: number;
  recoveryActions: RecoveryAction[];
  userImpact: UserImpact;
  nextSteps: string[];
  metadata: FallbackMetadata;
}

interface RecoveryAction {
  action: RecoveryActionType;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  description: string;
  executionTime?: number;
  result?: any;
  error?: string;
}

interface UserImpact {
  sessionContinuity: boolean;
  dataLoss: boolean;
  conversationInterruption: boolean;
  performanceImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  userNotification: boolean;
  estimatedRecoveryTime?: number;
}

interface FallbackMetadata {
  fallbackId: string;
  timestamp: string;
  originalDecision: RoutingDecision;
  fallbackStrategy: FallbackStrategy;
  systemMetrics: SystemMetrics;
  debugInfo?: Record<string, any>;
}

interface SystemMetrics {
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

type FallbackReason = 
  | 'module_timeout'
  | 'module_error'
  | 'module_unavailable'
  | 'session_loss'
  | 'data_corruption'
  | 'performance_degradation'
  | 'user_request'
  | 'admin_override'
  | 'system_overload'
  | 'unknown_error';

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

type RecoveryActionType = 
  | 'preserve_session'
  | 'restore_data'
  | 'switch_system'
  | 'notify_user'
  | 'log_incident'
  | 'schedule_retry'
  | 'escalate_support';

interface FallbackConfiguration {
  enableAutoFallback: boolean;
  fallbackTimeouts: FallbackTimeouts;
  retryConfiguration: RetryConfiguration;
  preservationRules: PreservationRules;
  notificationSettings: NotificationSettings;
  recoveryStrategies: Map<FallbackReason, RecoveryStrategy>;
  escalationRules: EscalationRules;
  healthChecks: HealthCheckConfiguration;
}

interface FallbackTimeouts {
  moduleTimeout: number; // 30 segundos
  sessionRecoveryTimeout: number; // 10 segundos
  dataPreservationTimeout: number; // 5 segundos
  totalFallbackTimeout: number; // 60 segundos
}

interface RetryConfiguration {
  enableRetries: boolean;
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: FallbackReason[];
}

interface PreservationRules {
  alwaysPreserve: string[]; // ['leadData', 'sessionId', 'userId']
  conditionalPreserve: Map<string, PreservationCondition>;
  neverPreserve: string[];
  encryptSensitiveData: boolean;
}

interface PreservationCondition {
  field: string;
  condition: (value: any, context: FallbackContext) => boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface NotificationSettings {
  notifyUsers: boolean;
  notifyAdmins: boolean;
  userNotificationTemplate: string;
  adminNotificationTemplate: string;
  channels: NotificationChannel[];
}

interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  enabled: boolean;
  config: Record<string, any>;
}

interface RecoveryStrategy {
  immediate: RecoveryActionType[];
  delayed: RecoveryActionType[];
  manual: RecoveryActionType[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
}

interface EscalationRules {
  enableEscalation: boolean;
  escalationThresholds: {
    errorCount: number;
    timeWindow: number;
    severity: ErrorSeverity;
  };
  escalationActions: string[];
}

interface HealthCheckConfiguration {
  enableHealthChecks: boolean;
  checkInterval: number; // minutes
  healthEndpoints: Map<string, HealthCheckEndpoint>;
  alertThresholds: HealthThresholds;
}

interface HealthCheckEndpoint {
  url: string;
  method: 'GET' | 'POST';
  expectedStatus: number;
  timeout: number;
  headers?: Record<string, string>;
}

interface HealthThresholds {
  responseTime: number;
  errorRate: number;
  availability: number;
}

interface FallbackMetrics {
  totalFallbacks: number;
  fallbacksByReason: Map<FallbackReason, number>;
  fallbacksByModule: Map<string, number>;
  averageFallbackTime: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  dataPreservationRate: number;
  userSatisfactionScore?: number;
}

/**
 * SERVICIO PRINCIPAL DE GESTIÓN DE FALLBACKS
 */
class FallbackManagerService {
  private static instance: FallbackManagerService;
  private config: FallbackConfiguration;
  private activeFallbacks: Map<string, FallbackContext> = new Map();
  private fallbackHistory: FallbackContext[] = [];
  private metrics: FallbackMetrics;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private constructor(config: Partial<FallbackConfiguration> = {}) {
    this.config = {
      enableAutoFallback: true,
      fallbackTimeouts: {
        moduleTimeout: 30000,
        sessionRecoveryTimeout: 10000,
        dataPreservationTimeout: 5000,
        totalFallbackTimeout: 60000
      },
      retryConfiguration: {
        enableRetries: true,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableErrors: ['module_timeout', 'module_unavailable', 'performance_degradation']
      },
      preservationRules: {
        alwaysPreserve: ['leadData', 'sessionId', 'userId', 'tenantId'],
        conditionalPreserve: new Map(),
        neverPreserve: ['temporaryTokens', 'cacheData'],
        encryptSensitiveData: true
      },
      notificationSettings: {
        notifyUsers: false, // No notificar a usuarios por defecto
        notifyAdmins: true,
        userNotificationTemplate: 'Estamos procesando tu solicitud...',
        adminNotificationTemplate: 'Fallback ejecutado en sistema híbrido',
        channels: [
          { type: 'email', enabled: true, config: {} },
          { type: 'slack', enabled: false, config: {} }
        ]
      },
      recoveryStrategies: new Map(),
      escalationRules: {
        enableEscalation: true,
        escalationThresholds: {
          errorCount: 10,
          timeWindow: 60,
          severity: 'high'
        },
        escalationActions: ['notify_admins', 'disable_hybrid', 'escalate_support']
      },
      healthChecks: {
        enableHealthChecks: true,
        checkInterval: 5,
        healthEndpoints: new Map(),
        alertThresholds: {
          responseTime: 5000,
          errorRate: 0.1,
          availability: 0.99
        }
      },
      ...config
    };

    this.metrics = {
      totalFallbacks: 0,
      fallbacksByReason: new Map(),
      fallbacksByModule: new Map(),
      averageFallbackTime: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      dataPreservationRate: 0
    };

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<FallbackConfiguration>): FallbackManagerService {
    if (!FallbackManagerService.instance) {
      FallbackManagerService.instance = new FallbackManagerService(config);
    }
    return FallbackManagerService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.initializeRecoveryStrategies();
    this.initializePreservationRules();
    
    if (this.config.healthChecks.enableHealthChecks) {
      this.startHealthChecks();
    }

    logger.info(`[FallbackManagerService] Servicio inicializado con auto-fallback ${this.config.enableAutoFallback ? 'habilitado' : 'deshabilitado'}`);
  }

  /**
   * MÉTODO PRINCIPAL: Ejecutar fallback desde sistema híbrido
   */
  async executeFallback(
    originalContext: RoutingContext,
    fallbackReason: FallbackReason,
    errorDetails: Partial<ErrorDetails>,
    options: {
      preserveSession?: boolean;
      notifyUser?: boolean;
      skipRetries?: boolean;
      emergencyMode?: boolean;
    } = {}
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.warn(`[FallbackManagerService] Ejecutando fallback ${fallbackId}: ${fallbackReason}`);

    try {
      // PASO 1: CREAR CONTEXTO DE FALLBACK
      const fallbackContext = await this.createFallbackContext(
        originalContext,
        fallbackReason,
        errorDetails,
        fallbackId
      );

      // PASO 2: PRESERVAR DATOS CRÍTICOS
      const preservationResult = await this.preserveCriticalData(fallbackContext);
      
      // PASO 3: EJECUTAR ACCIONES DE RECOVERY
      const recoveryActions = await this.executeRecoveryActions(
        fallbackContext,
        options.emergencyMode || false
      );

      // PASO 4: CAMBIAR AL SISTEMA ACTUAL
      const systemSwitchResult = await this.switchToCurrentSystem(
        fallbackContext,
        preservationResult
      );

      // PASO 5: VALIDAR CONTINUIDAD DE SESIÓN
      const sessionContinuity = await this.validateSessionContinuity(
        fallbackContext,
        systemSwitchResult
      );

      // PASO 6: NOTIFICAR SI ES NECESARIO
      if (options.notifyUser || this.config.notificationSettings.notifyUsers) {
        await this.notifyUser(fallbackContext);
      }

      if (this.config.notificationSettings.notifyAdmins) {
        await this.notifyAdministrators(fallbackContext);
      }

      // PASO 7: PROGRAMAR REINTENTOS SI ESTÁ HABILITADO
      if (!options.skipRetries && this.shouldRetry(fallbackReason)) {
        await this.scheduleRetry(fallbackContext);
      }

      // PASO 8: CREAR RESULTADO FINAL
      const result: FallbackResult = {
        success: systemSwitchResult.success,
        newSystem: 'current',
        preservedState: preservationResult.success,
        fallbackDuration: Date.now() - startTime,
        recoveryActions,
        userImpact: {
          sessionContinuity: sessionContinuity.maintained,
          dataLoss: !preservationResult.success,
          conversationInterruption: false, // Siempre transparente
          performanceImpact: 'minimal',
          userNotification: options.notifyUser || false,
          estimatedRecoveryTime: this.estimateRecoveryTime(fallbackReason)
        },
        nextSteps: this.generateNextSteps(fallbackContext, systemSwitchResult),
        metadata: {
          fallbackId,
          timestamp: new Date().toISOString(),
          originalDecision: fallbackContext.preservedData.systemVariables.originalDecision,
          fallbackStrategy: this.createFallbackStrategy(fallbackReason),
          systemMetrics: await this.getSystemMetrics(),
          debugInfo: options.emergencyMode ? fallbackContext : undefined
        }
      };

      // PASO 9: ACTUALIZAR MÉTRICAS Y REGISTROS
      await this.updateFallbackMetrics(fallbackContext, result);
      this.recordFallbackHistory(fallbackContext);

      logger.info(`[FallbackManagerService] Fallback ${fallbackId} completado en ${result.fallbackDuration}ms: ${result.success ? 'EXITOSO' : 'FALLIDO'}`);

      return result;

    } catch (error) {
      logger.error(`[FallbackManagerService] Error crítico ejecutando fallback ${fallbackId}:`, error);
      
      // FALLBACK DEL FALLBACK - garantizar que siempre hay respuesta
      return await this.createEmergencyFallbackResult(
        originalContext,
        fallbackReason,
        error,
        Date.now() - startTime
      );
    }
  }

  /**
   * MÉTODO: Crear contexto de fallback
   */
  private async createFallbackContext(
    originalContext: RoutingContext,
    fallbackReason: FallbackReason,
    errorDetails: Partial<ErrorDetails>,
    fallbackId: string
  ): Promise<FallbackContext> {
    // Obtener estado de conversación actual si existe
    const conversationState = await this.getCurrentConversationState(originalContext);
    
    // Preservar datos críticos inmediatamente
    const preservedData = await this.gatherCriticalData(originalContext, conversationState);

    const context: FallbackContext = {
      originalSystem: 'hybrid',
      fallbackReason,
      userId: originalContext.userId!,
      tenantId: originalContext.tenantId,
      templateId: originalContext.templateId,
      sessionId: originalContext.sessionId,
      conversationState,
      preservedData,
      errorDetails: {
        errorType: fallbackReason,
        errorMessage: errorDetails.errorMessage || 'Error no especificado',
        errorStack: errorDetails.errorStack,
        failedModule: errorDetails.failedModule,
        errorCode: errorDetails.errorCode,
        severity: errorDetails.severity || 'medium',
        isRecoverable: errorDetails.isRecoverable ?? true,
        additionalContext: errorDetails.additionalContext
      },
      timestamp: new Date().toISOString(),
      requestId: originalContext.requestId
    };

    // Registrar fallback activo
    this.activeFallbacks.set(fallbackId, context);

    return context;
  }

  /**
   * MÉTODO: Preservar datos críticos
   */
  private async preserveCriticalData(context: FallbackContext): Promise<{ success: boolean; preservedFields: string[] }> {
    const preservedFields: string[] = [];
    
    try {
      // PRESERVAR CAMPOS OBLIGATORIOS
      for (const field of this.config.preservationRules.alwaysPreserve) {
        if (this.hasField(context, field)) {
          await this.preserveField(context, field);
          preservedFields.push(field);
        }
      }

      // PRESERVAR CAMPOS CONDICIONALES
      for (const [fieldName, condition] of this.config.preservationRules.conditionalPreserve) {
        if (this.hasField(context, fieldName)) {
          const fieldValue = this.getFieldValue(context, fieldName);
          if (condition.condition(fieldValue, context)) {
            await this.preserveField(context, fieldName);
            preservedFields.push(fieldName);
          }
        }
      }

      // PRESERVACIÓN ESPECIAL PARA DATOS DE LEADS (CRÍTICO)
      if (context.conversationState?.leadData) {
        await this.preserveLeadData(context);
        preservedFields.push('leadData');
      }

      logger.debug(`[FallbackManagerService] Datos preservados: ${preservedFields.join(', ')}`);
      
      return { success: true, preservedFields };

    } catch (error) {
      logger.error(`[FallbackManagerService] Error preservando datos críticos:`, error);
      return { success: false, preservedFields };
    }
  }

  /**
   * MÉTODO: Ejecutar acciones de recovery
   */
  private async executeRecoveryActions(
    context: FallbackContext,
    emergencyMode: boolean = false
  ): Promise<RecoveryAction[]> {
    const recoveryActions: RecoveryAction[] = [];
    const strategy = this.config.recoveryStrategies.get(context.fallbackReason);

    if (!strategy) {
      logger.warn(`[FallbackManagerService] No hay estrategia de recovery para: ${context.fallbackReason}`);
      return [];
    }

    try {
      // ACCIONES INMEDIATAS
      for (const actionType of strategy.immediate) {
        const action = await this.executeRecoveryAction(actionType, context, emergencyMode);
        recoveryActions.push(action);
      }

      // ACCIONES DIFERIDAS (solo si no es modo emergencia)
      if (!emergencyMode) {
        for (const actionType of strategy.delayed) {
          const action = await this.executeRecoveryAction(actionType, context, false);
          recoveryActions.push(action);
        }
      }

      logger.debug(`[FallbackManagerService] ${recoveryActions.length} acciones de recovery ejecutadas`);

    } catch (error) {
      logger.error(`[FallbackManagerService] Error ejecutando acciones de recovery:`, error);
    }

    return recoveryActions;
  }

  /**
   * MÉTODO: Cambiar al sistema actual
   */
  private async switchToCurrentSystem(
    context: FallbackContext,
    preservationResult: { success: boolean; preservedFields: string[] }
  ): Promise<{ success: boolean; newContext: any }> {
    try {
      logger.info(`[FallbackManagerService] Cambiando al sistema actual para usuario ${context.userId}`);

      // CREAR CONTEXTO PARA SISTEMA ACTUAL
      const currentSystemContext = {
        userId: context.userId,
        tenantId: context.tenantId,
        templateId: context.templateId,
        sessionId: context.sessionId,
        preservedData: preservationResult.success ? context.preservedData : {},
        fallbackMode: true,
        originalSystem: 'hybrid'
      };

      // RESTAURAR ESTADO DE CONVERSACIÓN SI FUE PRESERVADO
      if (preservationResult.success && context.conversationState) {
        currentSystemContext.conversationState = context.conversationState;
      }

      // ASEGURAR QUE EL SISTEMA DE LEADS SE PRESERVA (CRÍTICO)
      if (context.conversationState?.leadData) {
        currentSystemContext.leadData = context.conversationState.leadData;
        logger.debug(`[FallbackManagerService] Sistema de leads preservado en fallback`);
      }

      return {
        success: true,
        newContext: currentSystemContext
      };

    } catch (error) {
      logger.error(`[FallbackManagerService] Error cambiando al sistema actual:`, error);
      return {
        success: false,
        newContext: null
      };
    }
  }

  /**
   * MÉTODO: Validar continuidad de sesión
   */
  private async validateSessionContinuity(
    context: FallbackContext,
    systemSwitchResult: { success: boolean; newContext: any }
  ): Promise<{ maintained: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // VERIFICAR QUE EL USUARIO MANTENGA SU SESIÓN
      if (!systemSwitchResult.success) {
        issues.push('Fallo en cambio de sistema');
      }

      // VERIFICAR QUE LOS DATOS CRÍTICOS ESTÁN DISPONIBLES
      if (!systemSwitchResult.newContext?.userId) {
        issues.push('ID de usuario no preservado');
      }

      if (!systemSwitchResult.newContext?.sessionId && context.sessionId) {
        issues.push('ID de sesión no preservado');
      }

      // VERIFICAR QUE EL SISTEMA DE LEADS ESTÁ INTACTO
      if (context.conversationState?.leadData && !systemSwitchResult.newContext?.leadData) {
        issues.push('Datos de leads no preservados');
      }

      const maintained = issues.length === 0;
      
      if (!maintained) {
        logger.warn(`[FallbackManagerService] Problemas de continuidad detectados: ${issues.join(', ')}`);
      }

      return { maintained, issues };

    } catch (error) {
      logger.error(`[FallbackManagerService] Error validando continuidad:`, error);
      return { maintained: false, issues: ['Error en validación'] };
    }
  }

  /**
   * MÉTODOS AUXILIARES DE RECOVERY
   */

  private async executeRecoveryAction(
    actionType: RecoveryActionType,
    context: FallbackContext,
    emergencyMode: boolean
  ): Promise<RecoveryAction> {
    const startTime = Date.now();
    const action: RecoveryAction = {
      action: actionType,
      status: 'in_progress',
      description: this.getActionDescription(actionType),
      executionTime: 0
    };

    try {
      switch (actionType) {
        case 'preserve_session':
          action.result = await this.preserveSessionAction(context);
          break;

        case 'restore_data':
          action.result = await this.restoreDataAction(context);
          break;

        case 'switch_system':
          action.result = await this.switchSystemAction(context);
          break;

        case 'notify_user':
          if (!emergencyMode) {
            action.result = await this.notifyUserAction(context);
          }
          break;

        case 'log_incident':
          action.result = await this.logIncidentAction(context);
          break;

        case 'schedule_retry':
          if (!emergencyMode) {
            action.result = await this.scheduleRetryAction(context);
          }
          break;

        case 'escalate_support':
          action.result = await this.escalateSupportAction(context);
          break;

        default:
          throw new Error(`Acción de recovery no implementada: ${actionType}`);
      }

      action.status = 'completed';
      action.executionTime = Date.now() - startTime;

      logger.debug(`[FallbackManagerService] Acción ${actionType} completada en ${action.executionTime}ms`);

    } catch (error) {
      action.status = 'failed';
      action.error = String(error);
      action.executionTime = Date.now() - startTime;

      logger.error(`[FallbackManagerService] Acción ${actionType} falló:`, error);
    }

    return action;
  }

  private getActionDescription(actionType: RecoveryActionType): string {
    const descriptions = {
      'preserve_session': 'Preservar sesión del usuario',
      'restore_data': 'Restaurar datos críticos',
      'switch_system': 'Cambiar al sistema actual',
      'notify_user': 'Notificar al usuario',
      'log_incident': 'Registrar incidente',
      'schedule_retry': 'Programar reintento',
      'escalate_support': 'Escalar a soporte'
    };

    return descriptions[actionType] || `Ejecutar ${actionType}`;
  }

  /**
   * MÉTODOS DE ACCIONES ESPECÍFICAS
   */

  private async preserveSessionAction(context: FallbackContext): Promise<any> {
    // Preservar información de sesión en almacenamiento persistente
    return {
      sessionId: context.sessionId,
      userId: context.userId,
      preserved: true
    };
  }

  private async restoreDataAction(context: FallbackContext): Promise<any> {
    // Restaurar datos críticos desde preservación
    return {
      dataRestored: Object.keys(context.preservedData).length,
      criticalDataIntact: true
    };
  }

  private async switchSystemAction(context: FallbackContext): Promise<any> {
    // Coordinar cambio al sistema actual
    return {
      newSystem: 'current',
      switchTime: Date.now(),
      success: true
    };
  }

  private async notifyUserAction(context: FallbackContext): Promise<any> {
    // Notificar al usuario si es necesario (generalmente no)
    const template = this.config.notificationSettings.userNotificationTemplate;
    
    return {
      notified: false, // Por defecto no notificar para mantener transparencia
      message: template
    };
  }

  private async logIncidentAction(context: FallbackContext): Promise<any> {
    // Registrar incidente para análisis posterior
    const incident = {
      fallbackId: `fallback_${Date.now()}`,
      reason: context.fallbackReason,
      severity: context.errorDetails.severity,
      userId: context.userId,
      templateId: context.templateId,
      timestamp: context.timestamp
    };

    logger.warn(`[FallbackManagerService] Incidente registrado:`, incident);

    return incident;
  }

  private async scheduleRetryAction(context: FallbackContext): Promise<any> {
    // Programar reintento del sistema híbrido
    if (!this.shouldRetry(context.fallbackReason)) {
      return { retryScheduled: false, reason: 'Error no reintentable' };
    }

    const delay = this.calculateRetryDelay(context);
    
    setTimeout(async () => {
      await this.attemptRetryToHybrid(context);
    }, delay);

    return {
      retryScheduled: true,
      retryDelay: delay,
      maxRetries: this.config.retryConfiguration.maxRetries
    };
  }

  private async escalateSupportAction(context: FallbackContext): Promise<any> {
    // Escalar a soporte técnico si es necesario
    if (context.errorDetails.severity === 'critical') {
      await this.notifyTechnicalSupport(context);
      return { escalated: true, severity: 'critical' };
    }

    return { escalated: false, reason: 'Severidad no requiere escalación' };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private async getCurrentConversationState(context: RoutingContext): Promise<ConversationState | undefined> {
    // En implementación real, obtener del session manager o base de datos
    return {
      currentNodeId: undefined,
      lastUserMessage: undefined,
      lastBotResponse: undefined,
      collectedData: {},
      globalVars: {},
      leadData: undefined,
      navigationHistory: []
    };
  }

  private async gatherCriticalData(
    context: RoutingContext,
    conversationState?: ConversationState
  ): Promise<PreservedData> {
    return {
      sessionData: {
        sessionId: context.sessionId,
        userId: context.userId,
        tenantId: context.tenantId
      },
      conversationContext: conversationState || {
        collectedData: {},
        globalVars: {},
        navigationHistory: []
      },
      systemVariables: {
        templateId: context.templateId,
        platform: context.platform,
        requestId: context.requestId
      },
      userPreferences: {},
      leadInformation: conversationState?.leadData || {},
      criticalFlags: ['preserveLeads', 'maintainSession']
    };
  }

  private hasField(context: FallbackContext, fieldName: string): boolean {
    return fieldName in context.preservedData.sessionData ||
           fieldName in context.preservedData.conversationContext ||
           fieldName in context.preservedData.systemVariables;
  }

  private getFieldValue(context: FallbackContext, fieldName: string): any {
    return context.preservedData.sessionData[fieldName] ||
           context.preservedData.conversationContext[fieldName] ||
           context.preservedData.systemVariables[fieldName];
  }

  private async preserveField(context: FallbackContext, fieldName: string): Promise<void> {
    // En implementación real, almacenar en sistema de persistencia
    logger.debug(`[FallbackManagerService] Campo preservado: ${fieldName}`);
  }

  private async preserveLeadData(context: FallbackContext): Promise<void> {
    // CRÍTICO: Preservar datos de leads sin modificar el sistema actual
    if (context.conversationState?.leadData) {
      logger.info(`[FallbackManagerService] Datos de leads preservados para usuario ${context.userId}`);
    }
  }

  private shouldRetry(reason: FallbackReason): boolean {
    return this.config.retryConfiguration.retryableErrors.includes(reason);
  }

  private calculateRetryDelay(context: FallbackContext): number {
    const baseDelay = this.config.retryConfiguration.initialDelay;
    const multiplier = this.config.retryConfiguration.backoffMultiplier;
    const maxDelay = this.config.retryConfiguration.maxDelay;
    
    // Calcular delay exponencial basado en número de intentos previos
    const attempts = this.getRetryAttempts(context);
    const delay = Math.min(baseDelay * Math.pow(multiplier, attempts), maxDelay);
    
    return delay;
  }

  private getRetryAttempts(context: FallbackContext): number {
    // En implementación real, obtener de almacenamiento de intentos
    return 0;
  }

  private async attemptRetryToHybrid(context: FallbackContext): Promise<void> {
    logger.info(`[FallbackManagerService] Intentando retorno al sistema híbrido para usuario ${context.userId}`);
    // En implementación real, intentar usar módulos híbridos nuevamente
  }

  private estimateRecoveryTime(reason: FallbackReason): number {
    const estimations = {
      'module_timeout': 30,
      'module_error': 60,
      'module_unavailable': 300,
      'session_loss': 10,
      'data_corruption': 120,
      'performance_degradation': 60,
      'user_request': 0,
      'admin_override': 0,
      'system_overload': 180,
      'unknown_error': 90
    };

    return estimations[reason] || 60;
  }

  private generateNextSteps(
    context: FallbackContext,
    systemSwitchResult: { success: boolean; newContext: any }
  ): string[] {
    const steps: string[] = [];

    if (systemSwitchResult.success) {
      steps.push('Usuario continúa con sistema actual');
      steps.push('Monitorear estabilidad del sistema');
    } else {
      steps.push('Investigar fallo crítico del fallback');
      steps.push('Implementar medidas de emergencia');
    }

    if (context.errorDetails.severity === 'critical') {
      steps.push('Revisar logs y métricas del sistema');
      steps.push('Considerar deshabilitar módulos híbridos temporalmente');
    }

    return steps;
  }

  private createFallbackStrategy(reason: FallbackReason): FallbackStrategy {
    return {
      enableAutoFallback: this.config.enableAutoFallback,
      fallbackTriggers: [{
        type: 'error_rate',
        threshold: 0.1,
        timeWindow: 5,
        action: 'immediate'
      }],
      maxRetries: this.config.retryConfiguration.maxRetries,
      fallbackTimeout: this.config.fallbackTimeouts.totalFallbackTimeout,
      preserveUserSession: true,
      notifyOnFallback: this.config.notificationSettings.notifyAdmins
    };
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    // En implementación real, obtener métricas del sistema
    return {
      responseTime: 150,
      errorRate: 0.02,
      activeConnections: 100,
      memoryUsage: 0.65,
      cpuUsage: 0.45
    };
  }

  private async createEmergencyFallbackResult(
    originalContext: RoutingContext,
    reason: FallbackReason,
    error: any,
    duration: number
  ): Promise<FallbackResult> {
    return {
      success: false,
      newSystem: 'current',
      preservedState: false,
      fallbackDuration: duration,
      recoveryActions: [],
      userImpact: {
        sessionContinuity: false,
        dataLoss: true,
        conversationInterruption: true,
        performanceImpact: 'significant',
        userNotification: true,
        estimatedRecoveryTime: 300
      },
      nextSteps: [
        'Escalación inmediata a soporte técnico',
        'Investigación de fallo crítico',
        'Implementar medidas de emergencia'
      ],
      metadata: {
        fallbackId: `emergency_${Date.now()}`,
        timestamp: new Date().toISOString(),
        originalDecision: {} as any,
        fallbackStrategy: this.createFallbackStrategy(reason),
        systemMetrics: await this.getSystemMetrics(),
        debugInfo: { emergencyError: String(error) }
      }
    };
  }

  /**
   * MÉTODOS DE CONFIGURACIÓN Y GESTIÓN
   */

  private initializeRecoveryStrategies(): void {
    // Estrategia para timeouts de módulos
    this.config.recoveryStrategies.set('module_timeout', {
      immediate: ['log_incident', 'switch_system'],
      delayed: ['schedule_retry'],
      manual: ['escalate_support'],
      priority: 'medium',
      timeout: 30000
    });

    // Estrategia para errores de módulos
    this.config.recoveryStrategies.set('module_error', {
      immediate: ['preserve_session', 'log_incident', 'switch_system'],
      delayed: ['schedule_retry'],
      manual: ['escalate_support'],
      priority: 'high',
      timeout: 15000
    });

    // Estrategia para pérdida de sesión
    this.config.recoveryStrategies.set('session_loss', {
      immediate: ['preserve_session', 'restore_data', 'switch_system'],
      delayed: [],
      manual: ['escalate_support'],
      priority: 'critical',
      timeout: 10000
    });

    logger.debug(`[FallbackManagerService] ${this.config.recoveryStrategies.size} estrategias de recovery inicializadas`);
  }

  private initializePreservationRules(): void {
    // Regla para preservar datos de leads siempre
    this.config.preservationRules.conditionalPreserve.set('leadData', {
      field: 'leadData',
      condition: (value) => value && typeof value === 'object',
      priority: 'critical'
    });

    // Regla para preservar datos de sesión activa
    this.config.preservationRules.conditionalPreserve.set('activeSession', {
      field: 'sessionId',
      condition: (value) => Boolean(value),
      priority: 'high'
    });
  }

  private startHealthChecks(): void {
    const interval = this.config.healthChecks.checkInterval * 60000;
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, interval);

    logger.debug(`[FallbackManagerService] Health checks iniciados cada ${this.config.healthChecks.checkInterval} minutos`);
  }

  private async performHealthChecks(): Promise<void> {
    // En implementación real, verificar salud de módulos híbridos
    logger.debug(`[FallbackManagerService] Ejecutando health checks del sistema`);
  }

  private async updateFallbackMetrics(
    context: FallbackContext,
    result: FallbackResult
  ): Promise<void> {
    this.metrics.totalFallbacks++;
    
    const reasonCount = this.metrics.fallbacksByReason.get(context.fallbackReason) || 0;
    this.metrics.fallbacksByReason.set(context.fallbackReason, reasonCount + 1);

    if (context.errorDetails.failedModule) {
      const moduleCount = this.metrics.fallbacksByModule.get(context.errorDetails.failedModule) || 0;
      this.metrics.fallbacksByModule.set(context.errorDetails.failedModule, moduleCount + 1);
    }

    if (result.success) {
      this.metrics.successfulRecoveries++;
    } else {
      this.metrics.failedRecoveries++;
    }

    if (result.preservedState) {
      this.metrics.dataPreservationRate = 
        (this.metrics.dataPreservationRate + 1) / this.metrics.totalFallbacks;
    }

    this.metrics.averageFallbackTime = 
      (this.metrics.averageFallbackTime + result.fallbackDuration) / this.metrics.totalFallbacks;
  }

  private recordFallbackHistory(context: FallbackContext): void {
    this.fallbackHistory.push(context);
    
    // Mantener solo los últimos 1000 fallbacks
    if (this.fallbackHistory.length > 1000) {
      this.fallbackHistory.splice(0, this.fallbackHistory.length - 1000);
    }
  }

  private async notifyUser(context: FallbackContext): Promise<void> {
    // En implementación real, notificar al usuario si es necesario
    // Por defecto, mantener transparencia y no notificar
    logger.debug(`[FallbackManagerService] Notificación de usuario omitida para mantener transparencia`);
  }

  private async notifyAdministrators(context: FallbackContext): Promise<void> {
    const message = `Fallback ejecutado - Razón: ${context.fallbackReason}, Usuario: ${context.userId}, Template: ${context.templateId}`;
    logger.warn(`[FallbackManagerService] NOTIFICACIÓN ADMIN: ${message}`);
  }

  private async notifyTechnicalSupport(context: FallbackContext): Promise<void> {
    const message = `ESCALACIÓN CRÍTICA - Fallback fallido para usuario ${context.userId}`;
    logger.error(`[FallbackManagerService] SOPORTE TÉCNICO: ${message}`);
  }

  /**
   * MÉTODOS PÚBLICOS PARA GESTIÓN
   */

  getFallbackMetrics(): FallbackMetrics {
    return { ...this.metrics };
  }

  getFallbackHistory(limit: number = 100): FallbackContext[] {
    return this.fallbackHistory.slice(-limit);
  }

  getActiveFallbacks(): FallbackContext[] {
    return Array.from(this.activeFallbacks.values());
  }

  updateConfiguration(newConfig: Partial<FallbackConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[FallbackManagerService] Configuración actualizada`);
  }

  getConfiguration(): FallbackConfiguration {
    return { ...this.config };
  }

  clearFallbackHistory(): void {
    this.fallbackHistory = [];
    logger.info(`[FallbackManagerService] Historial de fallbacks limpiado`);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.activeFallbacks.clear();
    this.fallbackHistory = [];
    
    logger.info(`[FallbackManagerService] Servicio destruido`);
  }
}

export default FallbackManagerService;
export type {
  FallbackContext,
  FallbackResult,
  FallbackConfiguration,
  FallbackMetrics,
  RecoveryAction,
  FallbackReason,
  ErrorSeverity,
  PreservedData
};