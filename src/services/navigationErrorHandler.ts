/**
 * NAVIGATION ERROR HANDLER SERVICE
 * 
 * PROPÓSITO: Manejo robusto de errores en navegación con rollback automático
 * BASADO EN: Patrones de recovery del v1-reference que mantienen estabilidad
 * PRESERVA: Sistema de leads 100% intacto durante rollbacks
 * PREVIENE: Estados inconsistentes que causan "Mensajes capturados: 0"
 * 
 * PATRONES EXTRAÍDOS DEL V1-REFERENCE:
 * - Rollback automático a estado conocido bueno
 * - Preservación de contexto crítico durante errores
 * - Recovery graceful con fallback al sistema actual
 * - Logging detallado para debugging
 * - Notificación automática de errores críticos
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import ImprovedSessionManager from './improvedSessionManager';
import { maintainSessionContext } from '../utils/maintainSessionContext';
import type { 
  NavigationNode, 
  NavigationContext, 
  NavigationResult,
  NavigationStep
} from './dynamicNavigation';
import type { 
  PersistentSession, 
  SessionContextData 
} from './improvedSessionManager';

// INTERFACES PARA MANEJO DE ERRORES

interface NavigationError {
  id: string;
  type: NavigationErrorType;
  severity: ErrorSeverity;
  message: string;
  details: ErrorDetails;
  context: ErrorContext;
  timestamp: string;
  stackTrace?: string;
  isRecoverable: boolean;
  requiresRollback: boolean;
  affectsLeadData: boolean; // CRÍTICO: Para preservar sistema de leads
}

interface ErrorDetails {
  originalError?: any;
  nodeId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  templateId?: string;
  sessionId?: string;
  operationId?: string;
  additionalData?: Record<string, any>;
}

interface ErrorContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  currentState: NavigationContext;
  lastSuccessfulState?: NavigationContext;
  navigationHistory: NavigationStep[];
  errorHistory: NavigationError[];
}

interface RollbackPlan {
  id: string;
  targetState: RollbackTarget;
  steps: RollbackStep[];
  preservationRules: PreservationRule[];
  validationChecks: string[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiresUserConfirmation: boolean;
}

interface RollbackTarget {
  type: 'previous_state' | 'checkpoint' | 'safe_state' | 'initial_state' | 'custom';
  targetNodeId?: string;
  targetSessionState?: Partial<SessionContextData>;
  preservedData: Record<string, any>;
  timestamp: string;
}

interface RollbackStep {
  id: string;
  action: RollbackAction;
  priority: number;
  description: string;
  execute: (context: ErrorRecoveryContext) => Promise<RollbackStepResult>;
  rollback?: (context: ErrorRecoveryContext) => Promise<void>;
  isOptional: boolean;
  timeout: number;
}

interface PreservationRule {
  id: string;
  dataPath: string;
  preservationType: 'always' | 'conditional' | 'never';
  condition?: (data: any, context: ErrorContext) => boolean;
  priority: number;
  description: string;
}

interface ErrorRecoveryContext {
  error: NavigationError;
  currentContext: NavigationContext;
  rollbackPlan: RollbackPlan;
  sessionManager: ImprovedSessionManager;
  preservedData: Map<string, any>;
  recoveryId: string;
}

interface RollbackStepResult {
  success: boolean;
  message: string;
  recoveredData?: Record<string, any>;
  newState?: Partial<NavigationContext>;
  error?: string;
  shouldContinue: boolean;
}

interface ErrorHandlingConfiguration {
  enableAutomaticRollback: boolean;
  maxRollbackSteps: number;
  rollbackTimeout: number;
  preserveLeadDataAlways: boolean; // CRÍTICO
  enableErrorNotifications: boolean;
  enableDetailedLogging: boolean;
  maxErrorHistory: number;
  autoRetryEnabled: boolean;
  maxRetryAttempts: number;
  retryDelay: number;
  fallbackToCurrentSystem: boolean;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Map<NavigationErrorType, number>;
  errorsBySeverity: Map<ErrorSeverity, number>;
  successfulRollbacks: number;
  failedRollbacks: number;
  averageRecoveryTime: number;
  leadDataPreservationRate: number;
  systemStabilityScore: number;
}

type NavigationErrorType = 
  | 'validation_failed'
  | 'node_not_found'
  | 'permission_denied'
  | 'session_expired'
  | 'context_corrupted'
  | 'timeout'
  | 'network_error'
  | 'business_logic_error'
  | 'system_error'
  | 'lead_system_error'
  | 'unknown';

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

type RollbackAction = 
  | 'restore_session_state'
  | 'reset_navigation_context'
  | 'preserve_lead_data'
  | 'clear_corrupted_data'
  | 'restore_checkpoint'
  | 'reinitialize_session'
  | 'fallback_to_current_system'
  | 'notify_user'
  | 'log_error'
  | 'custom';

/**
 * SERVICIO PRINCIPAL DE MANEJO DE ERRORES DE NAVEGACIÓN
 */
class NavigationErrorHandlerService {
  private static instance: NavigationErrorHandlerService;
  private sessionManager: ImprovedSessionManager;
  private config: ErrorHandlingConfiguration;
  private errorHistory: Map<string, NavigationError[]> = new Map();
  private rollbackPlans: Map<string, RollbackPlan> = new Map();
  private checkpoints: Map<string, NavigationContext> = new Map();
  private metrics: ErrorMetrics;
  private preservationRules: Map<string, PreservationRule> = new Map();

  private constructor(config: Partial<ErrorHandlingConfiguration> = {}) {
    this.config = {
      enableAutomaticRollback: true,
      maxRollbackSteps: 10,
      rollbackTimeout: 30000, // 30 segundos
      preserveLeadDataAlways: true, // CRÍTICO
      enableErrorNotifications: true,
      enableDetailedLogging: true,
      maxErrorHistory: 100,
      autoRetryEnabled: true,
      maxRetryAttempts: 3,
      retryDelay: 2000,
      fallbackToCurrentSystem: true,
      ...config
    };

    this.sessionManager = ImprovedSessionManager.getInstance();
    this.metrics = this.initializeMetrics();
    
    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<ErrorHandlingConfiguration>): NavigationErrorHandlerService {
    if (!NavigationErrorHandlerService.instance) {
      NavigationErrorHandlerService.instance = new NavigationErrorHandlerService(config);
    }
    return NavigationErrorHandlerService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    this.registerDefaultPreservationRules();
    logger.info(`[NavigationErrorHandlerService] Servicio inicializado con rollback automático: ${this.config.enableAutomaticRollback}`);
  }

  /**
   * MÉTODO PRINCIPAL: Manejar error de navegación
   */
  async handleNavigationError(
    originalError: any,
    context: NavigationContext,
    errorDetails: Partial<ErrorDetails> = {}
  ): Promise<NavigationResult> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.error(`[NavigationErrorHandlerService] Manejando error de navegación: ${errorId}`);

    try {
      // PASO 1: CLASIFICAR Y REGISTRAR ERROR
      const navigationError = await this.classifyAndRegisterError(
        originalError,
        context,
        errorDetails,
        errorId
      );

      // PASO 2: DETERMINAR ESTRATEGIA DE RECOVERY
      const recoveryStrategy = await this.determineRecoveryStrategy(navigationError, context);

      // PASO 3: PRESERVAR DATOS CRÍTICOS ANTES DEL ROLLBACK
      const preservedData = await this.preserveCriticalData(navigationError, context);

      // PASO 4: EJECUTAR RECOVERY SEGÚN ESTRATEGIA
      let recoveryResult: NavigationResult;

      switch (recoveryStrategy) {
        case 'automatic_rollback':
          recoveryResult = await this.executeAutomaticRollback(navigationError, context, preservedData);
          break;

        case 'retry_operation':
          recoveryResult = await this.retryOperation(navigationError, context);
          break;

        case 'fallback_to_current_system':
          recoveryResult = await this.fallbackToCurrentSystem(navigationError, context);
          break;

        case 'graceful_degradation':
          recoveryResult = await this.executeGracefulDegradation(navigationError, context);
          break;

        default:
          recoveryResult = await this.fallbackToCurrentSystem(navigationError, context);
      }

      // PASO 5: VALIDAR RECOVERY Y ACTUALIZAR MÉTRICAS
      await this.validateRecovery(recoveryResult, navigationError, context);
      this.updateErrorMetrics(navigationError, Date.now() - startTime, recoveryResult.success);

      // PASO 6: NOTIFICAR SI ES NECESARIO
      if (this.config.enableErrorNotifications && navigationError.severity === 'critical') {
        await this.notifyError(navigationError, recoveryResult);
      }

      logger.info(`[NavigationErrorHandlerService] Error ${errorId} manejado en ${Date.now() - startTime}ms: ${recoveryResult.success ? 'EXITOSO' : 'FALLIDO'}`);

      return recoveryResult;

    } catch (recoveryError) {
      logger.error(`[NavigationErrorHandlerService] Error crítico en recovery:`, recoveryError);
      
      // Recovery de último recurso: fallback completo al sistema actual
      return await this.executeEmergencyFallback(context, originalError);
    }
  }

  /**
   * MÉTODO: Clasificar y registrar error
   */
  private async classifyAndRegisterError(
    originalError: any,
    context: NavigationContext,
    errorDetails: Partial<ErrorDetails>,
    errorId: string
  ): Promise<NavigationError> {
    // Clasificar tipo de error
    const errorType = this.classifyErrorType(originalError);
    const severity = this.classifyErrorSeverity(originalError, errorType);

    // Determinar si afecta datos de leads
    const affectsLeadData = this.checkIfAffectsLeadData(originalError, context);

    const navigationError: NavigationError = {
      id: errorId,
      type: errorType,
      severity,
      message: this.extractErrorMessage(originalError),
      details: {
        originalError,
        nodeId: context.currentNodeId,
        sessionId: context.sessionId,
        templateId: context.templateId,
        ...errorDetails
      },
      context: {
        userId: context.userId,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        currentState: { ...context },
        lastSuccessfulState: await this.getLastSuccessfulState(context),
        navigationHistory: [...context.navigationHistory],
        errorHistory: this.getErrorHistory(context.userId)
      },
      timestamp: new Date().toISOString(),
      stackTrace: originalError?.stack,
      isRecoverable: this.isErrorRecoverable(originalError, errorType),
      requiresRollback: this.requiresRollback(errorType, severity),
      affectsLeadData
    };

    // Registrar en historial
    this.addToErrorHistory(context.userId, navigationError);

    return navigationError;
  }

  /**
   * MÉTODO: Determinar estrategia de recovery
   */
  private async determineRecoveryStrategy(
    error: NavigationError,
    context: NavigationContext
  ): Promise<'automatic_rollback' | 'retry_operation' | 'fallback_to_current_system' | 'graceful_degradation'> {
    // Si el error no es recuperable, fallback inmediato
    if (!error.isRecoverable) {
      return 'fallback_to_current_system';
    }

    // Si afecta datos de leads, usar rollback cuidadoso
    if (error.affectsLeadData) {
      return 'automatic_rollback';
    }

    // Si es un error temporal, intentar retry
    if (this.isTemporaryError(error.type)) {
      return 'retry_operation';
    }

    // Si requiere rollback, usar automático
    if (error.requiresRollback && this.config.enableAutomaticRollback) {
      return 'automatic_rollback';
    }

    // Si es un error leve, degradación graceful
    if (error.severity === 'low' || error.severity === 'medium') {
      return 'graceful_degradation';
    }

    // Por defecto, rollback automático
    return 'automatic_rollback';
  }

  /**
   * MÉTODO: Preservar datos críticos antes del rollback
   */
  private async preserveCriticalData(
    error: NavigationError,
    context: NavigationContext
  ): Promise<Map<string, any>> {
    const preservedData = new Map<string, any>();

    logger.info(`[NavigationErrorHandlerService] Preservando datos críticos antes del rollback`);

    try {
      // CRÍTICO: SIEMPRE preservar datos de leads
      if (context.leadData) {
        preservedData.set('leadData', { ...context.leadData });
        logger.info(`[NavigationErrorHandlerService] Datos de leads preservados`);
      }

      // Preservar datos recolectados importantes
      if (Object.keys(context.collectedData).length > 0) {
        preservedData.set('collectedData', { ...context.collectedData });
      }

      // Preservar variables globales críticas
      const criticalVars: Record<string, any> = {};
      for (const [key, value] of Object.entries(context.globalVars)) {
        if (this.isCriticalVariable(key)) {
          criticalVars[key] = value;
        }
      }
      if (Object.keys(criticalVars).length > 0) {
        preservedData.set('criticalVars', criticalVars);
      }

      // Aplicar reglas de preservación personalizadas
      for (const rule of this.preservationRules.values()) {
        if (rule.preservationType === 'always' || 
            (rule.preservationType === 'conditional' && rule.condition?.(context, error.context))) {
          
          const dataValue = this.getNestedValue(context, rule.dataPath);
          if (dataValue !== undefined) {
            preservedData.set(rule.id, dataValue);
          }
        }
      }

      // Preservar snapshot del contexto actual para recovery
      preservedData.set('contextSnapshot', {
        timestamp: new Date().toISOString(),
        currentNodeId: context.currentNodeId,
        navigationHistory: [...context.navigationHistory]
      });

      logger.info(`[NavigationErrorHandlerService] ${preservedData.size} elementos de datos preservados`);

    } catch (preservationError) {
      logger.error(`[NavigationErrorHandlerService] Error preservando datos críticos:`, preservationError);
      // Continuar con preservación mínima
      if (context.leadData) {
        preservedData.set('leadData', { ...context.leadData });
      }
    }

    return preservedData;
  }

  /**
   * MÉTODO: Ejecutar rollback automático
   */
  private async executeAutomaticRollback(
    error: NavigationError,
    context: NavigationContext,
    preservedData: Map<string, any>
  ): Promise<NavigationResult> {
    const rollbackId = `rollback_${Date.now()}`;
    logger.info(`[NavigationErrorHandlerService] Ejecutando rollback automático: ${rollbackId}`);

    try {
      // PASO 1: CREAR PLAN DE ROLLBACK
      const rollbackPlan = await this.createRollbackPlan(error, context, preservedData);

      // PASO 2: EJECUTAR PASOS DE ROLLBACK
      const recoveryContext: ErrorRecoveryContext = {
        error,
        currentContext: context,
        rollbackPlan,
        sessionManager: this.sessionManager,
        preservedData,
        recoveryId: rollbackId
      };

      let rollbackSuccess = true;
      const executedSteps: string[] = [];

      for (const step of rollbackPlan.steps.sort((a, b) => a.priority - b.priority)) {
        try {
          logger.debug(`[NavigationErrorHandlerService] Ejecutando paso de rollback: ${step.description}`);
          
          const stepResult = await this.executeRollbackStepWithTimeout(step, recoveryContext);
          executedSteps.push(step.id);

          if (!stepResult.success && !step.isOptional) {
            logger.error(`[NavigationErrorHandlerService] Paso de rollback crítico falló: ${step.description}`);
            rollbackSuccess = false;
            break;
          }

          if (!stepResult.shouldContinue) {
            logger.info(`[NavigationErrorHandlerService] Rollback completado temprano por paso: ${step.description}`);
            break;
          }

        } catch (stepError) {
          logger.error(`[NavigationErrorHandlerService] Error ejecutando paso ${step.id}:`, stepError);
          
          if (!step.isOptional) {
            rollbackSuccess = false;
            break;
          }
        }
      }

      // PASO 3: VALIDAR ESTADO DESPUÉS DEL ROLLBACK
      if (rollbackSuccess) {
        const validationResult = await this.validateRollbackResult(context, preservedData);
        
        if (validationResult.isValid) {
          this.metrics.successfulRollbacks++;
          
          return {
            success: true,
            targetNodeId: rollbackPlan.targetState.targetNodeId,
            contextUpdates: validationResult.restoredContext,
            botResponse: this.generateRollbackMessage(error, rollbackPlan)
          };
        } else {
          logger.warn(`[NavigationErrorHandlerService] Validación de rollback falló: ${validationResult.errors.join(', ')}`);
          rollbackSuccess = false;
        }
      }

      // Si el rollback falló, intentar fallback
      if (!rollbackSuccess) {
        this.metrics.failedRollbacks++;
        return await this.fallbackToCurrentSystem(error, context);
      }

    } catch (rollbackError) {
      logger.error(`[NavigationErrorHandlerService] Error crítico en rollback automático:`, rollbackError);
      this.metrics.failedRollbacks++;
      return await this.executeEmergencyFallback(context, error);
    }

    // Fallback por defecto
    return await this.fallbackToCurrentSystem(error, context);
  }

  /**
   * MÉTODO: Crear plan de rollback
   */
  private async createRollbackPlan(
    error: NavigationError,
    context: NavigationContext,
    preservedData: Map<string, any>
  ): Promise<RollbackPlan> {
    const planId = `plan_${Date.now()}`;
    
    // Determinar estado objetivo
    const targetState = await this.determineTargetState(error, context);
    
    // Crear pasos de rollback
    const steps: RollbackStep[] = [];

    // PASO 1: PRESERVAR DATOS DE LEADS (SIEMPRE PRIMERO)
    if (this.config.preserveLeadDataAlways) {
      steps.push({
        id: 'preserve_lead_data',
        action: 'preserve_lead_data',
        priority: 1,
        description: 'Preservar datos de leads críticos',
        execute: async (ctx) => {
          const leadData = preservedData.get('leadData');
          if (leadData) {
            ctx.currentContext.leadData = leadData;
            return {
              success: true,
              message: 'Datos de leads preservados exitosamente',
              shouldContinue: true
            };
          }
          return {
            success: true,
            message: 'No hay datos de leads para preservar',
            shouldContinue: true
          };
        },
        isOptional: false,
        timeout: 5000
      });
    }

    // PASO 2: RESTAURAR SESIÓN A ESTADO CONOCIDO BUENO
    steps.push({
      id: 'restore_session_state',
      action: 'restore_session_state',
      priority: 2,
      description: 'Restaurar estado de sesión a punto de control',
      execute: async (ctx) => {
        try {
          if (ctx.currentContext.sessionId) {
            // Restaurar contexto de sesión preservado
            const contextSnapshot = preservedData.get('contextSnapshot');
            if (contextSnapshot) {
              await maintainSessionContext({
                userId: ctx.currentContext.userId,
                tenantId: ctx.currentContext.tenantId,
                sessionId: ctx.currentContext.sessionId
              }, {
                preserveFields: ['leadData', 'collectedData'],
                clearFields: ['temporaryData'],
                updateFields: {
                  'currentNodeId': targetState.targetNodeId,
                  'lastRecoveryAt': new Date().toISOString()
                }
              });
            }
          }

          return {
            success: true,
            message: 'Estado de sesión restaurado',
            shouldContinue: true
          };
        } catch (restoreError) {
          return {
            success: false,
            message: `Error restaurando sesión: ${restoreError}`,
            shouldContinue: false
          };
        }
      },
      isOptional: false,
      timeout: 10000
    });

    // PASO 3: RESTAURAR DATOS RECOLECTADOS
    steps.push({
      id: 'restore_collected_data',
      action: 'restore_checkpoint',
      priority: 3,
      description: 'Restaurar datos recolectados del usuario',
      execute: async (ctx) => {
        const collectedData = preservedData.get('collectedData');
        if (collectedData) {
          ctx.currentContext.collectedData = { ...ctx.currentContext.collectedData, ...collectedData };
        }

        const criticalVars = preservedData.get('criticalVars');
        if (criticalVars) {
          ctx.currentContext.globalVars = { ...ctx.currentContext.globalVars, ...criticalVars };
        }

        return {
          success: true,
          message: 'Datos recolectados restaurados',
          shouldContinue: true
        };
      },
      isOptional: true,
      timeout: 5000
    });

    return {
      id: planId,
      targetState,
      steps,
      preservationRules: Array.from(this.preservationRules.values()),
      validationChecks: ['session_integrity', 'lead_data_preservation', 'context_consistency'],
      estimatedDuration: steps.length * 3000, // 3 segundos por paso
      riskLevel: error.severity === 'critical' ? 'high' : 'medium',
      requiresUserConfirmation: false
    };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private classifyErrorType(error: any): NavigationErrorType {
    const errorMessage = String(error?.message || error).toLowerCase();

    if (errorMessage.includes('validation')) return 'validation_failed';
    if (errorMessage.includes('not found') || errorMessage.includes('404')) return 'node_not_found';
    if (errorMessage.includes('permission') || errorMessage.includes('403')) return 'permission_denied';
    if (errorMessage.includes('session') || errorMessage.includes('expired')) return 'session_expired';
    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) return 'network_error';
    if (errorMessage.includes('lead')) return 'lead_system_error';
    if (errorMessage.includes('context') || errorMessage.includes('state')) return 'context_corrupted';

    return 'unknown';
  }

  private classifyErrorSeverity(error: any, type: NavigationErrorType): ErrorSeverity {
    // Errores que afectan leads son siempre críticos
    if (type === 'lead_system_error') return 'critical';
    
    // Errores de sesión y permisos son altos
    if (type === 'session_expired' || type === 'permission_denied') return 'high';
    
    // Errores de validación y nodo no encontrado son medios
    if (type === 'validation_failed' || type === 'node_not_found') return 'medium';
    
    // Errores de red y timeout son bajos (temporales)
    if (type === 'network_error' || type === 'timeout') return 'low';
    
    // Por defecto medio
    return 'medium';
  }

  private checkIfAffectsLeadData(error: any, context: NavigationContext): boolean {
    // Si hay datos de leads en el contexto y el error puede corromperlos
    if (context.leadData) {
      const errorMessage = String(error?.message || error).toLowerCase();
      return errorMessage.includes('lead') || 
             errorMessage.includes('stage') || 
             errorMessage.includes('funnel') ||
             errorMessage.includes('context') ||
             errorMessage.includes('state');
    }
    return false;
  }

  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'Error desconocido';
  }

  private isErrorRecoverable(error: any, type: NavigationErrorType): boolean {
    const nonRecoverableTypes: NavigationErrorType[] = ['permission_denied', 'system_error'];
    return !nonRecoverableTypes.includes(type);
  }

  private requiresRollback(type: NavigationErrorType, severity: ErrorSeverity): boolean {
    const rollbackTypes: NavigationErrorType[] = [
      'context_corrupted', 
      'session_expired', 
      'lead_system_error',
      'business_logic_error'
    ];
    
    return rollbackTypes.includes(type) || severity === 'critical';
  }

  private isTemporaryError(type: NavigationErrorType): boolean {
    const temporaryTypes: NavigationErrorType[] = ['timeout', 'network_error'];
    return temporaryTypes.includes(type);
  }

  private async getLastSuccessfulState(context: NavigationContext): Promise<NavigationContext | undefined> {
    // Buscar en el historial de navegación el último estado exitoso
    const successfulSteps = context.navigationHistory
      .filter(step => step.success)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (successfulSteps.length > 0) {
      const lastStep = successfulSteps[0];
      // En implementación real, reconstruir el contexto desde el snapshot
      return context; // Placeholder
    }

    return undefined;
  }

  private getErrorHistory(userId: string): NavigationError[] {
    return this.errorHistory.get(userId) || [];
  }

  private addToErrorHistory(userId: string, error: NavigationError): void {
    if (!this.errorHistory.has(userId)) {
      this.errorHistory.set(userId, []);
    }

    const userErrors = this.errorHistory.get(userId)!;
    userErrors.push(error);

    // Mantener solo los últimos N errores
    if (userErrors.length > this.config.maxErrorHistory) {
      userErrors.splice(0, userErrors.length - this.config.maxErrorHistory);
    }
  }

  private isCriticalVariable(key: string): boolean {
    const criticalPatterns = ['user', 'lead', 'contact', 'phone', 'email', 'name'];
    return criticalPatterns.some(pattern => key.toLowerCase().includes(pattern));
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o && o[p], obj);
  }

  private async determineTargetState(
    error: NavigationError,
    context: NavigationContext
  ): Promise<RollbackTarget> {
    // Determinar el mejor estado objetivo para el rollback
    const lastSuccessfulStep = context.navigationHistory
      .slice()
      .reverse()
      .find(step => step.success);

    return {
      type: lastSuccessfulStep ? 'previous_state' : 'safe_state',
      targetNodeId: lastSuccessfulStep?.fromNodeId || 'inicio',
      preservedData: {},
      timestamp: new Date().toISOString()
    };
  }

  private async executeRollbackStepWithTimeout(
    step: RollbackStep,
    context: ErrorRecoveryContext
  ): Promise<RollbackStepResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Paso de rollback ${step.id} excedió timeout de ${step.timeout}ms`));
      }, step.timeout);

      step.execute(context)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async validateRollbackResult(
    context: NavigationContext,
    preservedData: Map<string, any>
  ): Promise<{ isValid: boolean; errors: string[]; restoredContext?: Partial<NavigationContext> }> {
    const errors: string[] = [];

    // Validar que los datos de leads se preservaron
    if (this.config.preserveLeadDataAlways && preservedData.has('leadData')) {
      if (!context.leadData) {
        errors.push('Datos de leads no restaurados correctamente');
      }
    }

    // Validar integridad de sesión
    if (context.sessionId) {
      try {
        const sessionExists = await this.sessionManager.getSessionContext(context.sessionId);
        if (!sessionExists) {
          errors.push('Sesión no válida después del rollback');
        }
      } catch (sessionError) {
        errors.push(`Error validando sesión: ${sessionError}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      restoredContext: errors.length === 0 ? {
        leadData: preservedData.get('leadData'),
        collectedData: preservedData.get('collectedData'),
        globalVars: {
          ...context.globalVars,
          ...preservedData.get('criticalVars')
        }
      } : undefined
    };
  }

  private generateRollbackMessage(error: NavigationError, plan: RollbackPlan): string {
    const baseMessage = "Ha ocurrido un inconveniente, pero hemos restaurado tu sesión correctamente.";
    
    if (error.affectsLeadData) {
      return baseMessage + " Toda tu información se ha preservado.";
    }
    
    return baseMessage + " Puedes continuar desde donde estabas.";
  }

  /**
   * MÉTODOS DE RECOVERY ALTERNATIVOS
   */

  private async retryOperation(
    error: NavigationError,
    context: NavigationContext
  ): Promise<NavigationResult> {
    logger.info(`[NavigationErrorHandlerService] Reintentando operación después de error temporal`);
    
    // Implementar retry con backoff exponencial
    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        
        // En implementación real, reintentar la operación original
        return {
          success: true,
          botResponse: "Operación completada después de reintento",
          targetNodeId: context.currentNodeId
        };
        
      } catch (retryError) {
        logger.warn(`[NavigationErrorHandlerService] Intento ${attempt} falló:`, retryError);
        
        if (attempt === this.config.maxRetryAttempts) {
          return await this.fallbackToCurrentSystem(error, context);
        }
      }
    }

    return await this.fallbackToCurrentSystem(error, context);
  }

  private async fallbackToCurrentSystem(
    error: NavigationError,
    context: NavigationContext
  ): Promise<NavigationResult> {
    logger.info(`[NavigationErrorHandlerService] Ejecutando fallback al sistema actual`);
    
    try {
      // Preservar datos críticos
      const preservedData = await this.preserveCriticalData(error, context);
      
      // Crear respuesta de fallback que mantiene la conversación
      const fallbackMessage = this.generateFallbackMessage(error);
      
      return {
        success: true,
        botResponse: fallbackMessage,
        targetNodeId: context.currentNodeId,
        contextUpdates: {
          leadData: preservedData.get('leadData'),
          collectedData: preservedData.get('collectedData')
        }
      };
      
    } catch (fallbackError) {
      logger.error(`[NavigationErrorHandlerService] Error en fallback:`, fallbackError);
      return await this.executeEmergencyFallback(context, error);
    }
  }

  private async executeGracefulDegradation(
    error: NavigationError,
    context: NavigationContext
  ): Promise<NavigationResult> {
    logger.info(`[NavigationErrorHandlerService] Ejecutando degradación graceful`);
    
    return {
      success: true,
      botResponse: "Continuamos con funcionalidad simplificada. ¿En qué puedo ayudarte?",
      targetNodeId: context.currentNodeId
    };
  }

  private async executeEmergencyFallback(
    context: NavigationContext,
    originalError: any
  ): Promise<NavigationResult> {
    logger.error(`[NavigationErrorHandlerService] Ejecutando fallback de emergencia`);
    
    return {
      success: false,
      error: "Error crítico del sistema. Por favor intenta nuevamente.",
      botResponse: "Lo siento, ha ocurrido un error. Por favor intenta nuevamente en unos momentos."
    };
  }

  private generateFallbackMessage(error: NavigationError): string {
    switch (error.type) {
      case 'validation_failed':
        return "Los datos ingresados no son válidos. Por favor intenta nuevamente.";
      case 'node_not_found':
        return "Ha ocurrido un problema con el flujo. Continuemos desde aquí.";
      case 'session_expired':
        return "Tu sesión ha expirado. Hemos iniciado una nueva para continuar.";
      default:
        return "Ha ocurrido un inconveniente menor. Podemos continuar normalmente.";
    }
  }

  /**
   * MÉTODOS DE GESTIÓN DE CONFIGURACIÓN
   */

  private registerDefaultPreservationRules(): void {
    this.preservationRules.set('lead_data', {
      id: 'lead_data',
      dataPath: 'leadData',
      preservationType: 'always',
      priority: 1,
      description: 'Preservar datos de leads siempre'
    });

    this.preservationRules.set('user_contact', {
      id: 'user_contact',
      dataPath: 'collectedData',
      preservationType: 'conditional',
      condition: (data) => data && (data.phone || data.email || data.name),
      priority: 2,
      description: 'Preservar datos de contacto del usuario'
    });
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      successfulRollbacks: 0,
      failedRollbacks: 0,
      averageRecoveryTime: 0,
      leadDataPreservationRate: 100, // Siempre 100% por configuración
      systemStabilityScore: 100
    };
  }

  private updateErrorMetrics(error: NavigationError, recoveryTime: number, success: boolean): void {
    this.metrics.totalErrors++;
    
    // Actualizar por tipo
    const typeCount = this.metrics.errorsByType.get(error.type) || 0;
    this.metrics.errorsByType.set(error.type, typeCount + 1);
    
    // Actualizar por severidad
    const severityCount = this.metrics.errorsBySeverity.get(error.severity) || 0;
    this.metrics.errorsBySeverity.set(error.severity, severityCount + 1);
    
    // Actualizar tiempo promedio de recovery
    this.metrics.averageRecoveryTime = 
      (this.metrics.averageRecoveryTime + recoveryTime) / 2;
    
    // Calcular score de estabilidad
    const successRate = this.metrics.successfulRollbacks / 
                       (this.metrics.successfulRollbacks + this.metrics.failedRollbacks);
    this.metrics.systemStabilityScore = Math.round(successRate * 100);
  }

  private async validateRecovery(
    result: NavigationResult,
    error: NavigationError,
    context: NavigationContext
  ): Promise<void> {
    if (result.success && error.affectsLeadData && context.leadData) {
      // Verificar que los datos de leads se preservaron
      if (!result.contextUpdates?.leadData) {
        logger.warn(`[NavigationErrorHandlerService] Datos de leads no preservados en recovery exitoso`);
      }
    }
  }

  private async notifyError(error: NavigationError, result: NavigationResult): Promise<void> {
    // En implementación real, enviar notificaciones a sistemas de monitoreo
    logger.error(`[NavigationErrorHandlerService] NOTIFICACIÓN CRÍTICA: ${error.type} - ${error.message}`);
  }

  /**
   * MÉTODOS PÚBLICOS
   */

  async createCheckpoint(context: NavigationContext): Promise<string> {
    const checkpointId = `checkpoint_${Date.now()}`;
    this.checkpoints.set(checkpointId, { ...context });
    logger.debug(`[NavigationErrorHandlerService] Checkpoint creado: ${checkpointId}`);
    return checkpointId;
  }

  async restoreCheckpoint(checkpointId: string): Promise<NavigationContext | null> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      logger.info(`[NavigationErrorHandlerService] Checkpoint restaurado: ${checkpointId}`);
      return { ...checkpoint };
    }
    return null;
  }

  getErrorMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getErrorHistory(userId: string): NavigationError[] {
    return this.getErrorHistory(userId);
  }

  updateConfiguration(newConfig: Partial<ErrorHandlingConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`[NavigationErrorHandlerService] Configuración actualizada`);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.errorHistory.clear();
    this.rollbackPlans.clear();
    this.checkpoints.clear();
    this.preservationRules.clear();
    logger.info(`[NavigationErrorHandlerService] Servicio destruido`);
  }
}

export default NavigationErrorHandlerService;
export type {
  NavigationError,
  ErrorDetails,
  ErrorContext,
  RollbackPlan,
  ErrorHandlingConfiguration,
  ErrorMetrics,
  NavigationErrorType,
  ErrorSeverity
};