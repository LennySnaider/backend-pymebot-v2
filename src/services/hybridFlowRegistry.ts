/**
 * HYBRID FLOW REGISTRY SERVICE
 * 
 * PROPÓSITO: Registry híbrido que coexiste con flowRegistry.ts actual
 * BASADO EN: Análisis del flowRegistry actual y patrones del v1-reference
 * PRESERVA: Sistema actual 100% intacto - solo agrega capacidades híbridas
 * TRANSPARENTE: Funcionamiento idéntico al flowRegistry con mejoras opcionales
 * 
 * FUNCIONALIDADES HÍBRIDAS:
 * - Detección automática de templates problemáticos
 * - Routing inteligente entre sistema actual vs módulos híbridos
 * - Captura mejorada con persistencia entre requests
 * - Sesiones robustas con recovery automático
 * - Navegación dinámica con preservación de contexto
 * - Fallback transparente en caso de errores
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import { v4 as uuidv4 } from "uuid";
import { createBot, createFlow, MemoryDB } from "@builderbot/bot";
import { saveConversationState, getConversationState } from "./conversationState";
import logger from "../utils/logger";
import { convertTemplateToBuilderbotFlow } from "./templateConverter";
import { replaceVariables } from "../utils/variableReplacer";
import { getOrCreateSessionBot, sessionBots } from './flowRegistryPatch';
import { setCurrentSession, getSessionVariables } from './flowRegistryVariablePatch';
import { dequeueMessages } from './buttonNavigationQueue';
import { setSessionContext } from './sessionContext';
import * as systemVariablesLoader from '../utils/systemVariablesLoader';
import { findLeadByPhone, createLeadIfNotExists } from "./leadLookupService";
import { getSessionStage } from "./flowRegistrySalesFix";
import { WebProvider } from "../provider/webProvider";

// IMPORTAR MÓDULOS HÍBRIDOS
import TemplateDetectorService from '../utils/templateDetector';
import SystemRouterService from '../utils/systemRouter';
import FallbackManagerService from '../utils/fallbackManager';
import HybridTemplateManagerService from '../utils/hybridTemplateManager';
import HybridMetricsCollectorService from '../utils/hybridMetricsCollector';
import { EnhancedDataCapture } from './enhancedDataCapture';
import ImprovedSessionManagerService from './improvedSessionManager';
import DynamicNavigationService from './dynamicNavigation';

import type { 
  RoutingDecision, 
  RoutingContext,
  FallbackReason 
} from '../utils/systemRouter';
import type { ChatbotTemplate } from '../types/Template';

// INTERFACES PARA SISTEMA HÍBRIDO

interface HybridFlowState extends ExtendedFlowState {
  isHybridSession: boolean;
  hybridModulesUsed: string[];
  originalSystemFallbackAvailable: boolean;
  hybridMetadata: HybridSessionMetadata;
}

interface HybridSessionMetadata {
  detectionAnalysis?: any;
  routingDecision?: RoutingDecision;
  performanceMetrics: HybridPerformanceMetrics;
  fallbackHistory: FallbackEvent[];
  moduleActivity: Record<string, ModuleActivityInfo>;
}

interface HybridPerformanceMetrics {
  sessionStartTime: string;
  lastResponseTime: number;
  totalMessageCount: number;
  hybridMessageCount: number;
  errorCount: number;
  captureSuccessCount: number;
  captureFailureCount: number;
  fallbackCount: number;
}

interface FallbackEvent {
  timestamp: string;
  reason: FallbackReason;
  fromSystem: 'hybrid' | 'current';
  toSystem: 'hybrid' | 'current';
  errorDetails?: any;
  recoverySuccess: boolean;
}

interface ModuleActivityInfo {
  moduleName: string;
  activationTime: string;
  lastUsed: string;
  operationCount: number;
  errorCount: number;
  successRate: number;
}

// IMPORTAR INTERFACES DEL SISTEMA ACTUAL PARA COMPATIBILIDAD
interface ExtendedFlowState {
  flowId: string;
  currentNodeId: string;
  history: Array<{
    timestamp: string;
    message: string;
    from: string;
    nodeId?: string;
  }>;
  tenantId: string;
  userId: string;
  variables: Record<string, any>;
  sessionStarted: Date;
  lastActivity: Date;
  metadata: {
    templateId?: string;
    templateType?: string;
    version?: string;
  };
  data: Record<string, any>;
  startedAt: Date;
  lastUpdatedAt: Date;
  sessionId: string;
  context: Record<string, any>;
  leadId?: string;
}

export interface FlowAdapter {
  handleMsg: (ctx: { from: string; body: string }) => Promise<any>;
  flows?: any;
}

// ESTADO LOCAL HÍBRIDO
const _hybridFlowStates: Record<string, HybridFlowState> = {};

/**
 * CLASE PRINCIPAL DE REGISTRY HÍBRIDO
 */
export class HybridFlowRegistry {
  private static instance: HybridFlowRegistry;
  private static flows: Map<string, any> = new Map();
  private static templates: Map<string, any> = new Map();
  private static bots: Map<string, any> = new Map();
  
  // SERVICIOS HÍBRIDOS
  private templateDetector: TemplateDetectorService;
  private systemRouter: SystemRouterService;
  private fallbackManager: FallbackManagerService;
  private hybridTemplateManager: HybridTemplateManagerService;
  private metricsCollector: HybridMetricsCollectorService;
  private enhancedCapture: typeof EnhancedDataCapture;
  private sessionManager: ImprovedSessionManagerService;
  private dynamicNavigation: DynamicNavigationService;

  private constructor() {
    // INICIALIZAR SERVICIOS HÍBRIDOS
    this.templateDetector = TemplateDetectorService.getInstance();
    this.systemRouter = SystemRouterService.getInstance();
    this.fallbackManager = FallbackManagerService.getInstance();
    this.hybridTemplateManager = HybridTemplateManagerService.getInstance();
    this.metricsCollector = HybridMetricsCollectorService.getInstance();
    this.enhancedCapture = EnhancedDataCapture;
    this.sessionManager = ImprovedSessionManagerService.getInstance();
    this.dynamicNavigation = DynamicNavigationService.getInstance();
    
    logger.info('[HybridFlowRegistry] Servicios híbridos inicializados');
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(): HybridFlowRegistry {
    if (!HybridFlowRegistry.instance) {
      HybridFlowRegistry.instance = new HybridFlowRegistry();
    }
    return HybridFlowRegistry.instance;
  }

  /**
   * MÉTODO: Inicializar registry híbrido
   */
  static async initialize() {
    logger.info("[HybridFlowRegistry] Iniciando Hybrid Flow Registry");
    
    const instance = HybridFlowRegistry.getInstance();
    
    // REGISTRAR FLUJOS PREDEFINIDOS (COMPATIBILIDAD CON SISTEMA ACTUAL)
    await this.registerPredefinedFlows();
    
    logger.info("[HybridFlowRegistry] Hybrid Flow Registry inicializado con éxito");
  }

  /**
   * MÉTODO: Registrar flujos predefinidos (IDÉNTICO AL ORIGINAL)
   */
  private static async registerPredefinedFlows() {
    try {
      // FLUJO PRINCIPAL DE CAPTURA DE LEADS (COMPATIBILIDAD)
      const leadFlow = await this.loadLeadCaptureFlow(); 
      if (leadFlow) {
        logger.info("[HybridFlowRegistry] Flujo 'lead-capture' cargado, creando adaptador...");
        this.flows.set('lead-capture', leadFlow);
        logger.info("[HybridFlowRegistry] Flujo 'lead-capture' registrado");
      } else {
        logger.error("[HybridFlowRegistry] No se pudo cargar el flujo 'lead-capture'");
      }
      
      // FLUJO PYMEBOT V1 (COMPATIBILIDAD)
      try {
        const pymebotModule = await import("../flows/pymebot-v1.flow");
        const pymebotFlow = await pymebotModule.pymebotV1Flow();
        if (pymebotFlow) {
          this.flows.set('default-template-1', pymebotFlow);
          this.flows.set('pymebot-v1', pymebotFlow);
          logger.info("[HybridFlowRegistry] Flujos PymeBot V1 registrados");
        }
      } catch (error) {
        logger.error("[HybridFlowRegistry] Error al cargar flujo PymeBot V1:", error);
      }

      logger.info(`[HybridFlowRegistry] Total de flujos registrados: ${this.flows.size}`);
    } catch (error) {
      logger.error("[HybridFlowRegistry] Error al registrar flujos predefinidos:", error);
    }
  }

  /**
   * MÉTODO: Cargar flujo de captura de leads (IDÉNTICO AL ORIGINAL)
   */
  private static async loadLeadCaptureFlow(): Promise<FlowAdapter | null> {
    try {
      const leadModule = await import("../flows/lead-capture.flow");
      
      if (leadModule.default) {
        logger.info("[HybridFlowRegistry] Flujo lead-capture cargado exitosamente");
        return { 
          flows: leadModule.default,
          handleMsg: async () => ({ answer: [] })
        };
      }
      
      logger.warn("[HybridFlowRegistry] Módulo lead-capture no tiene export default, creando adaptador genérico");
      
      return {
        handleMsg: async () => {
          logger.warn("[HybridFlowRegistry] handleMsg genérico llamado - el flujo puede no funcionar correctamente");
          return {
            answer: "Lo siento, no puedo procesar tu mensaje en este momento.",
            media: [],
            buttons: [],
            delay: 0
          };
        },
        flows: []
      };
    } catch (error) {
      logger.error("[HybridFlowRegistry] Error al cargar flujo lead-capture:", error);
      return null;
    }
  }

  /**
   * MÉTODO PRINCIPAL: Procesar mensaje con sistema híbrido
   */
  async processHybridFlowMessage(
    phoneFrom: string,
    messageBody: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    options?: {
      provider?: any;
      shouldClearState?: boolean;
      initialData?: Record<string, any>;
    }
  ): Promise<any> {
    const startTime = Date.now();
    logger.info(`[HybridFlowRegistry] 🚀 Procesando mensaje híbrido desde ${phoneFrom}: "${messageBody}"`);
    
    try {
      // PASO 1: DETERMINAR SI USAR SISTEMA HÍBRIDO O ACTUAL
      const routingDecision = await this.determineSystemToUse(
        templateId,
        tenantId,
        phoneFrom,
        sessionId,
        messageBody
      );

      // PASO 2: REGISTRAR MÉTRICAS DE ROUTING
      this.metricsCollector.recordEvent(
        'conversation_start',
        routingDecision.systemToUse,
        templateId || 'unknown',
        tenantId,
        { responseTime: Date.now() - startTime },
        { platform: 'web', routingDecision }
      );

      // PASO 3: PROCESAR SEGÚN EL SISTEMA DETERMINADO
      if (routingDecision.shouldUseHybrid) {
        logger.info(`[HybridFlowRegistry] ✨ Usando sistema HÍBRIDO (confianza: ${Math.round(routingDecision.confidence * 100)}%)`);
        return await this.processWithHybridSystem(
          phoneFrom,
          messageBody,
          tenantId,
          sessionId,
          templateId,
          routingDecision,
          options
        );
      } else {
        logger.info(`[HybridFlowRegistry] 🔄 Usando sistema ACTUAL (razón: ${routingDecision.reasoning.primaryFactors[0]})`);
        return await this.processWithCurrentSystem(
          phoneFrom,
          messageBody,
          tenantId,
          sessionId,
          templateId,
          options
        );
      }

    } catch (error) {
      logger.error(`[HybridFlowRegistry] ❌ Error en procesamiento híbrido:`, error);
      
      // FALLBACK AUTOMÁTICO AL SISTEMA ACTUAL
      logger.info(`[HybridFlowRegistry] 🔧 Ejecutando fallback al sistema actual`);
      return await this.executeEmergencyFallback(
        phoneFrom,
        messageBody,
        tenantId,
        sessionId,
        templateId,
        error,
        options
      );
    }
  }

  /**
   * MÉTODO: Determinar qué sistema usar
   */
  private async determineSystemToUse(
    templateId: string | null,
    tenantId: string,
    userId: string,
    sessionId: string,
    messageBody: string
  ): Promise<RoutingDecision> {
    try {
      // Si no hay templateId, usar sistema actual
      if (!templateId) {
        return this.systemRouter.createCurrentSystemDecision(
          { id: 'no-template' } as ChatbotTemplate,
          { templateId: 'no-template', tenantId, userId, sessionId, requestId: uuidv4() },
          'No hay templateId especificado'
        );
      }

      // VERIFICAR SI ESTÁ CONFIGURADO PARA USAR MÓDULOS HÍBRIDOS
      const shouldUseHybrid = this.hybridTemplateManager.shouldUseHybridModules(
        templateId,
        tenantId,
        { userId, platform: 'web' }
      );

      if (shouldUseHybrid.shouldUse) {
        return {
          shouldUseHybrid: true,
          systemToUse: 'hybrid',
          confidence: 0.9,
          reasoning: {
            primaryFactors: [shouldUseHybrid.reason],
            detectedIssues: [],
            riskAssessment: 'Medio: configurado para usar módulos híbridos',
            expectedBenefits: ['Mejor captura de datos', 'Sesiones persistentes'],
            potentialRisks: ['Complejidad adicional']
          },
          recommendedModules: shouldUseHybrid.modules,
          fallbackStrategy: {
            enableAutoFallback: true,
            fallbackTriggers: [],
            maxRetries: 2,
            fallbackTimeout: 30000,
            preserveUserSession: true,
            notifyOnFallback: true
          },
          metadata: {
            routingTimestamp: new Date().toISOString(),
            routingVersion: '1.0.0',
            templateId,
            tenantId,
            userId,
            requestId: uuidv4()
          }
        };
      }

      // ANÁLISIS AUTOMÁTICO DEL TEMPLATE
      // Primero necesitamos obtener el template para analizarlo
      let template: ChatbotTemplate | null = null;
      try {
        // Intentar cargar el template desde el sistema
        // Esto es una aproximación - en implementación real sería desde la base de datos
        template = {
          id: templateId,
          name: `Template ${templateId}`,
          tenant_id: tenantId,
          template_data: '{}', // Se cargaría de la BD
          version: '1.0',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      } catch (error) {
        logger.warn(`[HybridFlowRegistry] No se pudo cargar template ${templateId} para análisis:`, error);
      }

      if (template) {
        // USAR SISTEMA ROUTER PARA DECISIÓN INTELIGENTE
        const routingContext: RoutingContext = {
          templateId,
          tenantId,
          userId,
          sessionId,
          requestId: uuidv4(),
          platform: 'web'
        };

        return await this.systemRouter.routeRequest(template, routingContext);
      }

      // FALLBACK: Usar sistema actual si no se puede analizar
      return this.systemRouter.createCurrentSystemDecision(
        { id: templateId } as ChatbotTemplate,
        { templateId, tenantId, userId, sessionId, requestId: uuidv4() },
        'No se pudo analizar el template'
      );

    } catch (error) {
      logger.error(`[HybridFlowRegistry] Error determinando sistema a usar:`, error);
      
      // FALLBACK DE EMERGENCIA
      return this.systemRouter.createCurrentSystemDecision(
        { id: templateId || 'error' } as ChatbotTemplate,
        { templateId: templateId || 'error', tenantId, userId, sessionId, requestId: uuidv4() },
        `Error en análisis: ${error}`
      );
    }
  }

  /**
   * MÉTODO: Procesar con sistema híbrido
   */
  private async processWithHybridSystem(
    phoneFrom: string,
    messageBody: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    routingDecision: RoutingDecision,
    options?: any
  ): Promise<any> {
    const startTime = Date.now();
    logger.info(`[HybridFlowRegistry] 🎯 Iniciando procesamiento híbrido con módulos: ${routingDecision.recommendedModules.join(', ')}`);

    try {
      // CREAR O RECUPERAR ESTADO HÍBRIDO
      const hybridState = await this.getOrCreateHybridState(
        phoneFrom,
        tenantId,
        sessionId,
        templateId,
        routingDecision
      );

      // PROCESAR CON MÓDULOS HÍBRIDOS SEGÚN RECOMENDACIÓN
      const modules = routingDecision.recommendedModules;
      let processedResponse: any = null;

      // MÓDULO 1: ENHANCED DATA CAPTURE
      if (modules.includes('enhancedDataCapture')) {
        logger.info(`[HybridFlowRegistry] 📥 Aplicando Enhanced Data Capture`);
        
        try {
          const captureResult = await this.enhancedCapture.captureWithPersistence({
            nodeId: 'hybrid-capture',
            tenantId: tenantId,
            keywords: [messageBody],
            sessionTTL: 300000,
            responseTimeout: 30000,
            preserveLeadVars: true
          });

          if (captureResult.success) {
            // Actualizar estado con datos capturados
            hybridState.variables = { ...hybridState.variables, ...captureResult.capturedData };
            logger.info(`[HybridFlowRegistry] ✅ Datos capturados exitosamente:`, captureResult.capturedData);
          }
        } catch (error) {
          logger.warn(`[HybridFlowRegistry] ⚠️ Error en Enhanced Data Capture:`, error);
          // Continuar con el procesamiento
        }
      }

      // MÓDULO 2: IMPROVED SESSION MANAGER
      if (modules.includes('improvedSessionManager')) {
        logger.info(`[HybridFlowRegistry] 🔄 Aplicando Improved Session Manager`);
        
        try {
          const sessionResult = await this.sessionManager.maintainSessionContext(
            phoneFrom,
            sessionId,
            tenantId,
            hybridState.context
          );

          if (sessionResult.success) {
            // Actualizar contexto con datos de sesión
            hybridState.context = { ...hybridState.context, ...sessionResult.preservedContext };
            logger.info(`[HybridFlowRegistry] ✅ Contexto de sesión mantenido`);
          }
        } catch (error) {
          logger.warn(`[HybridFlowRegistry] ⚠️ Error en Improved Session Manager:`, error);
        }
      }

      // MÓDULO 3: DYNAMIC NAVIGATION
      if (modules.includes('dynamicNavigation')) {
        logger.info(`[HybridFlowRegistry] 🧭 Aplicando Dynamic Navigation`);
        
        try {
          const navigationResult = await this.dynamicNavigation.enhancedGotoFlow(
            hybridState.currentNodeId,
            'next', // Se determinaría dinámicamente
            hybridState.context,
            {
              templateId: templateId || undefined,
              preserveState: true,
              validationDepth: 'standard'
            }
          );

          if (navigationResult.success) {
            hybridState.currentNodeId = navigationResult.targetNodeId;
            logger.info(`[HybridFlowRegistry] ✅ Navegación dinámica a nodo: ${navigationResult.targetNodeId}`);
          }
        } catch (error) {
          logger.warn(`[HybridFlowRegistry] ⚠️ Error en Dynamic Navigation:`, error);
        }
      }

      // PROCESAR CON SISTEMA ACTUAL MEJORADO
      // Importar la función original para delegar el procesamiento real
      const { processFlowMessage } = await import('./flowRegistry');
      
      processedResponse = await processFlowMessage(
        phoneFrom,
        messageBody,
        tenantId,
        sessionId,
        templateId,
        {
          ...options,
          initialData: {
            ...options?.initialData,
            ...hybridState.variables,
            isHybridSession: true
          }
        }
      );

      // ACTUALIZAR MÉTRICAS DE ÉXITO
      this.metricsCollector.recordEvent(
        'message_received',
        'hybrid',
        templateId || 'unknown',
        tenantId,
        {
          responseTime: Date.now() - startTime,
          processingTime: Date.now() - startTime,
          captureSuccess: true,
          modulesUsed: modules
        }
      );

      // ACTUALIZAR ESTADO HÍBRIDO
      hybridState.lastActivity = new Date();
      hybridState.lastUpdatedAt = new Date();
      hybridState.hybridMetadata.performanceMetrics.lastResponseTime = Date.now() - startTime;
      hybridState.hybridMetadata.performanceMetrics.totalMessageCount++;
      hybridState.hybridMetadata.performanceMetrics.hybridMessageCount++;

      // GUARDAR ESTADO
      await this.saveHybridState(phoneFrom, tenantId, sessionId, hybridState);

      logger.info(`[HybridFlowRegistry] ✅ Procesamiento híbrido completado en ${Date.now() - startTime}ms`);
      
      return {
        ...processedResponse,
        _hybridInfo: {
          isHybridResponse: true,
          modulesUsed: modules,
          processingTime: Date.now() - startTime,
          confidence: routingDecision.confidence
        }
      };

    } catch (error) {
      logger.error(`[HybridFlowRegistry] ❌ Error en procesamiento híbrido:`, error);
      
      // EJECUTAR FALLBACK AL SISTEMA ACTUAL
      return await this.executeFallbackToCurrentSystem(
        phoneFrom,
        messageBody,
        tenantId,
        sessionId,
        templateId,
        'hybrid_processing_error',
        error,
        options
      );
    }
  }

  /**
   * MÉTODO: Procesar con sistema actual (DELEGACIÓN TRANSPARENTE)
   */
  private async processWithCurrentSystem(
    phoneFrom: string,
    messageBody: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    options?: any
  ): Promise<any> {
    logger.info(`[HybridFlowRegistry] 🔄 Delegando al sistema actual`);
    
    try {
      // DELEGAR COMPLETAMENTE AL SISTEMA ACTUAL
      const { processFlowMessage } = await import('./flowRegistry');
      
      const response = await processFlowMessage(
        phoneFrom,
        messageBody,
        tenantId,
        sessionId,
        templateId,
        options
      );

      // REGISTRAR MÉTRICAS PARA COMPARACIÓN
      this.metricsCollector.recordEvent(
        'message_received',
        'current',
        templateId || 'unknown',
        tenantId,
        {
          responseTime: 100, // Estimado
          captureSuccess: true
        }
      );

      return {
        ...response,
        _hybridInfo: {
          isHybridResponse: false,
          systemUsed: 'current',
          reason: 'Routing determinó usar sistema actual'
        }
      };

    } catch (error) {
      logger.error(`[HybridFlowRegistry] ❌ Error en sistema actual:`, error);
      throw error; // Re-throw para que se maneje en el nivel superior
    }
  }

  /**
   * MÉTODO: Ejecutar fallback al sistema actual
   */
  private async executeFallbackToCurrentSystem(
    phoneFrom: string,
    messageBody: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    reason: FallbackReason,
    error: any,
    options?: any
  ): Promise<any> {
    logger.warn(`[HybridFlowRegistry] 🔧 Ejecutando fallback al sistema actual - Razón: ${reason}`);

    try {
      // EJECUTAR FALLBACK CON FALLBACK MANAGER
      const fallbackResult = await this.fallbackManager.executeFallback(
        {
          templateId: templateId || 'unknown',
          tenantId,
          userId: phoneFrom,
          sessionId,
          requestId: uuidv4()
        },
        reason,
        {
          errorType: reason,
          errorMessage: error?.message || 'Error desconocido',
          errorStack: error?.stack,
          severity: 'medium',
          isRecoverable: true
        },
        {
          preserveSession: true,
          notifyUser: false
        }
      );

      if (fallbackResult.success) {
        logger.info(`[HybridFlowRegistry] ✅ Fallback ejecutado exitosamente`);
        
        // PROCESAR CON SISTEMA ACTUAL
        const { processFlowMessage } = await import('./flowRegistry');
        
        const response = await processFlowMessage(
          phoneFrom,
          messageBody,
          tenantId,
          sessionId,
          templateId,
          options
        );

        // REGISTRAR MÉTRICA DE FALLBACK
        this.metricsCollector.recordEvent(
          'fallback_executed',
          'current',
          templateId || 'unknown',
          tenantId,
          {
            fallbackReason: reason,
            fallbackSuccess: true
          }
        );

        return {
          ...response,
          _hybridInfo: {
            isHybridResponse: false,
            systemUsed: 'current',
            fallbackExecuted: true,
            fallbackReason: reason
          }
        };

      } else {
        logger.error(`[HybridFlowRegistry] ❌ Fallback falló:`, fallbackResult);
        throw new Error(`Fallback falló: ${fallbackResult.nextSteps.join(', ')}`);
      }

    } catch (fallbackError) {
      logger.error(`[HybridFlowRegistry] ❌ Error crítico en fallback:`, fallbackError);
      
      // ÚLTIMO RECURSO: RESPUESTA DE EMERGENCIA
      return {
        answer: [{ body: "Lo siento, estoy experimentando dificultades técnicas. Por favor, inténtalo de nuevo en unos momentos." }],
        media: [],
        buttons: [],
        delay: 0,
        _hybridInfo: {
          isHybridResponse: false,
          systemUsed: 'emergency',
          emergencyMode: true,
          originalError: error?.message
        }
      };
    }
  }

  /**
   * MÉTODO: Ejecutar fallback de emergencia
   */
  private async executeEmergencyFallback(
    phoneFrom: string,
    messageBody: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    error: any,
    options?: any
  ): Promise<any> {
    logger.error(`[HybridFlowRegistry] 🚨 MODO DE EMERGENCIA ACTIVADO`);

    try {
      // ACTIVAR MODO DE EMERGENCIA EN SYSTEM ROUTER
      this.systemRouter.activateEmergencyMode(`Error crítico en HybridFlowRegistry: ${error?.message}`);

      // INTENTAR PROCESAR CON SISTEMA ACTUAL COMO ÚLTIMO RECURSO
      const { processFlowMessage } = await import('./flowRegistry');
      
      return await processFlowMessage(
        phoneFrom,
        messageBody,
        tenantId,
        sessionId,
        templateId,
        options
      );

    } catch (emergencyError) {
      logger.error(`[HybridFlowRegistry] ❌ FALLA TOTAL DEL SISTEMA:`, emergencyError);
      
      // RESPUESTA DE EMERGENCIA HARD-CODED
      return {
        answer: [{ body: "Sistema temporalmente no disponible. Por favor, contacta con soporte." }],
        media: [],
        buttons: [],
        delay: 0,
        _hybridInfo: {
          systemUsed: 'emergency',
          totalFailure: true,
          errors: [error?.message, emergencyError?.message]
        }
      };
    }
  }

  /**
   * MÉTODO: Obtener o crear estado híbrido
   */
  private async getOrCreateHybridState(
    phoneFrom: string,
    tenantId: string,
    sessionId: string,
    templateId: string | null,
    routingDecision: RoutingDecision
  ): Promise<HybridFlowState> {
    const stateKey = `${tenantId}:${phoneFrom}`;
    
    let existingState = _hybridFlowStates[stateKey];
    
    if (!existingState) {
      // INTENTAR RECUPERAR ESTADO GUARDADO
      try {
        const savedState = await getConversationState(tenantId, phoneFrom, sessionId);
        if (savedState?.data && savedState.data.isHybridSession) {
          existingState = savedState.data as HybridFlowState;
          logger.info(`[HybridFlowRegistry] Estado híbrido recuperado de BD`);
        }
      } catch (error) {
        logger.warn(`[HybridFlowRegistry] No se pudo recuperar estado híbrido:`, error);
      }
    }

    if (!existingState) {
      // CREAR NUEVO ESTADO HÍBRIDO
      existingState = {
        flowId: templateId || 'lead-capture',
        currentNodeId: 'start',
        history: [],
        tenantId,
        userId: phoneFrom,
        variables: {},
        sessionStarted: new Date(),
        lastActivity: new Date(),
        metadata: {
          templateId,
          templateType: templateId ? 'template' : 'predefined',
          version: '1.0.0'
        },
        data: {},
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
        sessionId,
        context: {},
        
        // PROPIEDADES HÍBRIDAS
        isHybridSession: true,
        hybridModulesUsed: routingDecision.recommendedModules,
        originalSystemFallbackAvailable: true,
        hybridMetadata: {
          detectionAnalysis: routingDecision.metadata.debugInfo,
          routingDecision,
          performanceMetrics: {
            sessionStartTime: new Date().toISOString(),
            lastResponseTime: 0,
            totalMessageCount: 0,
            hybridMessageCount: 0,
            errorCount: 0,
            captureSuccessCount: 0,
            captureFailureCount: 0,
            fallbackCount: 0
          },
          fallbackHistory: [],
          moduleActivity: {}
        }
      };

      logger.info(`[HybridFlowRegistry] Nuevo estado híbrido creado`);
    }

    // GUARDAR EN CACHÉ LOCAL
    _hybridFlowStates[stateKey] = existingState;

    return existingState;
  }

  /**
   * MÉTODO: Guardar estado híbrido
   */
  private async saveHybridState(
    phoneFrom: string,
    tenantId: string,
    sessionId: string,
    state: HybridFlowState
  ): Promise<void> {
    try {
      await saveConversationState(tenantId, phoneFrom, sessionId, state);
      logger.debug(`[HybridFlowRegistry] Estado híbrido guardado para sesión ${tenantId}:${phoneFrom}`);
    } catch (error) {
      logger.error(`[HybridFlowRegistry] Error guardando estado híbrido:`, error);
    }
  }

  /**
   * MÉTODOS PÚBLICOS PARA COMPATIBILIDAD CON SISTEMA ACTUAL
   */

  static registerTemplate(id: string, template: any) {
    this.templates.set(id, template);
    logger.info(`[HybridFlowRegistry] Plantilla '${id}' registrada`);
  }

  static registerFlow(id: string, flow: any) {
    this.flows.set(id, flow);
    logger.info(`[HybridFlowRegistry] Flujo '${id}' registrado`);
  }

  static getFlow(id: string): any {
    return this.flows.get(id);
  }

  static clearCache() {
    this.flows.clear();
    this.templates.clear();
    logger.info("[HybridFlowRegistry] Caché híbrido limpiado");
  }

  static listFlows(): string[] {
    return Array.from(this.flows.keys());
  }

  /**
   * MÉTODO: Obtener métricas del sistema híbrido
   */
  getMetrics() {
    return this.metricsCollector.getAggregatedMetrics('all', 'hybrid', new Date(Date.now() - 24*60*60*1000), new Date());
  }

  /**
   * MÉTODO: Limpiar estados antiguos
   */
  static cleanupOldHybridStates(maxAgeHours: number = 24): number {
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    let cleaned = 0;
    
    for (const [key, state] of Object.entries(_hybridFlowStates)) {
      if (state.lastUpdatedAt) {
        const stateAge = now - new Date(state.lastUpdatedAt).getTime();
        if (stateAge > maxAge) {
          delete _hybridFlowStates[key];
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      logger.info(`[HybridFlowRegistry] Limpiados ${cleaned} estados híbridos antiguos`);
    }

    return cleaned;
  }

  /**
   * MÉTODO: Destruir instancia
   */
  destroy(): void {
    // LIMPIAR ESTADOS
    Object.keys(_hybridFlowStates).forEach(key => delete _hybridFlowStates[key]);
    
    // DESTRUIR SERVICIOS
    this.templateDetector.destroy();
    this.systemRouter.destroy();
    this.fallbackManager.destroy();
    this.hybridTemplateManager.destroy();
    this.metricsCollector.destroy();
    // this.enhancedCapture.destroy(); // EnhancedDataCapture es una clase estática, no necesita destroy
    this.sessionManager.destroy();
    this.dynamicNavigation.destroy();

    logger.info(`[HybridFlowRegistry] Instancia híbrida destruida`);
  }
}

// FUNCIÓN PRINCIPAL DE COMPATIBILIDAD: Wrapper para usar con sistema híbrido
export async function processHybridFlowMessage(
  phoneFrom: string,
  messageBody: string,
  tenantId: string,
  sessionId: string,
  templateId: string | null,
  options?: {
    provider?: any;
    shouldClearState?: boolean;
    initialData?: Record<string, any>;
  }
): Promise<any> {
  const hybridRegistry = HybridFlowRegistry.getInstance();
  return await hybridRegistry.processHybridFlowMessage(
    phoneFrom,
    messageBody,
    tenantId,
    sessionId,
    templateId,
    options
  );
}

// FUNCIONES DE COMPATIBILIDAD CON SISTEMA ACTUAL
export function registerNewHybridTemplate(templateId: string, flow: any) {
  try {
    logger.info(`[HybridFlowRegistry] Registrando nueva plantilla híbrida: ${templateId}`);
    
    if (!flow || typeof flow !== 'object') {
      logger.error(`[HybridFlowRegistry] Plantilla híbrida ${templateId} inválida`);
      return;
    }

    if (typeof flow.handleMsg === 'function') {
      HybridFlowRegistry.registerFlow(templateId, flow as FlowAdapter);
    } else {
      HybridFlowRegistry.registerTemplate(templateId, flow);
    }

    logger.info(`[HybridFlowRegistry] Plantilla híbrida ${templateId} registrada exitosamente`);
  } catch (error) {
    logger.error(`[HybridFlowRegistry] Error al registrar plantilla híbrida ${templateId}:`, error);
  }
}

export async function getHybridBotInstance(tenantId: string, templateId: string, sessionId?: string) {
  // Para compatibilidad, delegar al sistema actual
  const { getBotInstance } = await import('./flowRegistry');
  return getBotInstance(tenantId, templateId, sessionId);
}

// CONFIGURAR LIMPIEZA PERIÓDICA
setInterval(() => {
  HybridFlowRegistry.cleanupOldHybridStates();
}, 30 * 60 * 1000); // Cada 30 minutos

// INICIALIZAR AL IMPORTAR
HybridFlowRegistry.initialize().catch(error => {
  logger.error("[HybridFlowRegistry] Error al inicializar Hybrid Flow Registry:", error);
});

// EXPORT POR DEFECTO
export default HybridFlowRegistry;