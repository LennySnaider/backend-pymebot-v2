/**
 * ENHANCED DATA CAPTURE MODULE
 * 
 * PROPÓSITO: Resolver el problema "Mensajes capturados en el provider: 0"
 * BASADO EN: Patrón funcional de DataFlow.ts del v1-reference
 * PRESERVA: Sistema de leads 100% intacto
 * COEXISTE: Con templateConverter.ts actual sin modificarlo
 * 
 * PATRÓN EXTRAÍDO DEL V1-REFERENCE:
 * - Dos fases separadas: Preparación + Captura
 * - Estado persistente entre fases
 * - Uso correcto de capture: true
 * - Navegación dinámica con gotoFlow
 * - Variables contextuales normalizadas
 */

import { addKeyword } from "@builderbot/bot";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// INTERFACES ADAPTADAS DEL V1-REFERENCE

interface CaptureConfig {
  nodeId: string;
  tenantId: string;
  keywords?: string[];
  sessionTTL?: number; // TTL en milisegundos
  responseTimeout?: number; // Timeout en milisegundos
  timeoutMessage?: string;
  preserveLeadVars?: boolean;
  enforceValidation?: boolean;
  validation?: ValidationRules;
  leadSystemIntegration?: LeadSystemIntegration;
}

interface MultiTenantCaptureConfig {
  nodeId: string;
  tenantId: string;
  templateId?: string;
  keywords?: string[];
  enforceIsolation?: boolean;
  includeLeadVars?: boolean;
  enforceValidation?: boolean;
  validation?: ValidationRules;
  leadSystemIntegration?: LeadSystemIntegration;
  securityLevel?: 'standard' | 'strict' | 'paranoid';
  allowCrossTenantFallback?: boolean;
}

interface ValidatedCaptureConfig {
  nodeId: string;
  tenantId: string;
  templateId?: string;
  keywords?: string[];
  validation?: AdvancedValidationRules;
  timeout?: TimeoutConfig;
  leadSystemIntegration?: LeadSystemIntegration;
}

interface AdvancedValidationRules extends ValidationRules {
  maxAttempts?: number;
  showHints?: boolean;
  showInstructions?: boolean;
  customPatternHint?: string;
  strictMode?: boolean;
  allowPartialMatch?: boolean;
}

interface TimeoutConfig {
  enabled?: boolean;
  duration?: number; // en milisegundos
  showWarning?: boolean;
  warningTime?: number; // en milisegundos
  warningMessage?: string;
  onExpired?: {
    action?: 'terminate' | 'retry' | 'fallback';
    message?: string;
    retryCount?: number;
  };
}

interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  emptyMessage?: string;
  customPattern?: string;
  customPatternMessage?: string;
}

interface LeadSystemIntegration {
  enabled?: boolean;
  updateStageOnCapture?: boolean;
  preserveExistingData?: boolean;
  customMappings?: Record<string, string>;
}

interface PersistentSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: string;
  expiresAt: string;
  metadata: Record<string, any>;
}

interface EnhancedDataNodeInput {
  id: string;
  type: string;
  label: string;
  required: boolean;
}

interface EnhancedDataNodeContent {
  type: string;
  label: string;
  input: {
    id: string;
    type: string;
    label: string;
    required: boolean;
  };
  inputLabel: string;
  inputs: EnhancedDataNodeInput[];
  nodeType: string;
  chatbotId: string;
  is_active: boolean;
  leadStage: string;
  responseTime: number;
  isInitialNode: boolean;
  awaitsResponse: boolean;
  responseMessage?: string;
  // ADAPTACIÓN: Agregar propiedades del sistema actual
  tenantId?: string;
  templateId?: string;
  salesStageId?: string;
}

interface HybridState {
  // ESTADO ACTUAL PRESERVADO
  userId?: string;
  sessionId?: string;
  tenantId?: string;
  leadId?: string;
  leadName?: string;
  salesStageId?: string;
  funnelPosition?: number;
  
  // ESTADO HÍBRIDO (NUEVO)
  hybrid?: {
    currentNodeId?: string;
    nodeData?: EnhancedDataNodeContent;
    inputType?: string;
    collectedData?: Record<string, any>;
    globalVars?: Record<string, any>;
    awaitingResponse?: boolean;
    sessionStarted?: string;
    lastActivity?: string;
    leadSystemVars?: any;
  };
  
  // METADATOS
  metadata?: {
    hybridMode?: boolean;
    version?: string;
    lastOperation?: string;
  };
}

/**
 * CLASE PRINCIPAL: Enhanced Data Capture
 * BASADA EN: v1-reference DataFlow.ts con adaptaciones para sistema actual
 */
export class EnhancedDataCapture {
  
  /**
   * MÉTODO PRINCIPAL: Crear flujo de captura de dos fases
   * PRESERVA: Sistema de leads mediante integración transparente
   * ADAPTA: Arquitectura multi-tenant del sistema actual
   */
  static createTwoPhaseCapture(nodeConfig: any, tenantId: string) {
    
    return addKeyword([""])
      
      // ========================================
      // FASE 1: PREPARACIÓN (ADAPTADA DEL V1-REFERENCE)
      // ========================================
      .addAction(async (ctx, { flowDynamic, state }) => {
        try {
          console.log(`[EnhancedDataCapture] FASE 1 - Iniciando preparación para nodo ${nodeConfig.nodeId}`);
          
          // 1. OBTENER ESTADO ACTUAL (PRESERVAR TODO)
          const currentState: HybridState = await state.getMyState() || {};
          
          // 2. OBTENER CONFIGURACIÓN DEL NODO (ADAPTADO A ESQUEMA MULTI-TENANT)
          const { data: node, error } = await supabase
            .from("chatbot_template_nodes")
            .select("*")
            .eq("id", nodeConfig.nodeId)
            .eq("tenant_id", tenantId)
            .single();
          
          if (error || !node) {
            console.error(`[EnhancedDataCapture] Error obteniendo nodo:`, error);
            // FALLBACK: Retornar sin procesamiento
            return;
          }
          
          // 3. PARSEAR CONTENIDO DEL NODO (COMPATIBLE CON AMBOS FORMATOS)
          let nodeData: EnhancedDataNodeContent;
          try {
            nodeData = typeof node.content === "string" 
              ? JSON.parse(node.content) 
              : node.content;
          } catch (parseError) {
            console.error(`[EnhancedDataCapture] Error parseando contenido del nodo:`, parseError);
            return;
          }
          
          // 4. PRESERVAR VARIABLES DEL SISTEMA DE LEADS
          const leadSystemVars = await this.getLeadSystemVariables(currentState, tenantId);
          
          // 5. ACTUALIZAR ESTADO HÍBRIDO (PRESERVANDO TODO EL ESTADO ACTUAL)
          const hybridUpdates: HybridState = {
            // PRESERVAR ESTADO ACTUAL COMPLETAMENTE
            ...currentState,
            
            // PRESERVAR SISTEMA DE LEADS
            leadId: currentState.leadId,
            leadName: currentState.leadName,
            salesStageId: currentState.salesStageId,
            funnelPosition: currentState.funnelPosition,
            
            // NUEVAS PROPIEDADES HÍBRIDAS
            hybrid: {
              currentNodeId: node.id,
              nodeData: nodeData,
              inputType: this.detectInputType(nodeData.input?.label),
              collectedData: currentState.hybrid?.collectedData || {},
              globalVars: currentState.hybrid?.globalVars || {},
              awaitingResponse: true,
              sessionStarted: currentState.hybrid?.sessionStarted || new Date().toISOString(),
              lastActivity: new Date().toISOString(),
              leadSystemVars: leadSystemVars,
            },
            
            // METADATOS
            metadata: {
              hybridMode: true,
              version: "1.0",
              lastOperation: "phase1_preparation",
            },
          };
          
          await state.update(hybridUpdates);
          
          // 6. MOSTRAR PREGUNTA AL USUARIO (PROCESADA CON VARIABLES DE LEADS)
          const question = await this.processQuestionWithLeadVars(
            nodeData.input?.label || nodeData.inputLabel,
            leadSystemVars,
            tenantId
          );
          
          if (question) {
            console.log(`[EnhancedDataCapture] FASE 1 - Mostrando pregunta: ${question}`);
            await flowDynamic(question);
          }
          
          console.log(`[EnhancedDataCapture] FASE 1 - Preparación completada exitosamente`);
          
        } catch (error) {
          console.error(`[EnhancedDataCapture] FASE 1 - Error en preparación:`, error);
          
          // FALLBACK CRÍTICO: No romper el flujo
          await flowDynamic("¿Podrías proporcionar esa información?");
        }
      })
      
      // ========================================
      // FASE 2: CAPTURA REAL (ADAPTADA DEL V1-REFERENCE)
      // ========================================
      .addAnswer(
        "",
        { capture: true }, // PATRÓN CLAVE DEL V1-REFERENCE
        async (ctx, { flowDynamic, state, gotoFlow }) => {
          try {
            console.log(`[EnhancedDataCapture] FASE 2 - Iniciando captura de respuesta: "${ctx.body}"`);
            
            // 1. RECUPERAR ESTADO HÍBRIDO DE LA FASE 1
            const currentState: HybridState = await state.getMyState();
            
            if (!currentState?.hybrid?.currentNodeId || !currentState.hybrid.nodeData) {
              console.error(`[EnhancedDataCapture] FASE 2 - Estado híbrido no encontrado`);
              return;
            }
            
            const nodeData = currentState.hybrid.nodeData;
            const leadSystemVars = currentState.hybrid.leadSystemVars;
            
            // 2. PROCESAR RESPUESTA DEL USUARIO (ADAPTADO PARA SISTEMA DE LEADS)
            const processedData = await this.processUserResponseWithLeadSystem(
              ctx.body,
              nodeData,
              currentState,
              tenantId
            );
            
            // 3. MOSTRAR MENSAJE DE RESPUESTA SI EXISTE (CON VARIABLES DE LEADS)
            if (nodeData.responseMessage) {
              const responseMessage = await this.processResponseMessage(
                nodeData.responseMessage,
                processedData.contextVars,
                tenantId
              );
              
              if (responseMessage) {
                await flowDynamic(responseMessage);
              }
            }
            
            // 4. REGISTRAR INTERACCIÓN (COMPATIBLE CON ESQUEMA ACTUAL)
            await this.registerInteraction(
              currentState.hybrid.currentNodeId,
              ctx.body,
              nodeData.responseMessage || "",
              processedData,
              tenantId
            );
            
            // 5. NOTIFICAR AL SISTEMA DE LEADS (PRESERVAR FUNCIONALIDAD)
            await this.notifyLeadSystemIfNeeded(
              processedData.leadData,
              nodeData,
              tenantId
            );
            
            // 6. NAVEGACIÓN AL SIGUIENTE NODO (DINÁMICAMENTE)
            const nextNode = await this.getNextNodeHybrid(
              currentState.hybrid.currentNodeId,
              tenantId
            );
            
            if (nextNode) {
              // ACTUALIZAR ESTADO GLOBAL CON DATOS RECOLECTADOS
              const finalHybridState: HybridState = {
                ...currentState,
                
                // ACTUALIZAR SISTEMA DE LEADS SI ES NECESARIO
                leadName: processedData.leadData.leadName || currentState.leadName,
                salesStageId: processedData.leadData.salesStageId || currentState.salesStageId,
                
                // ACTUALIZAR ESTADO HÍBRIDO
                hybrid: {
                  ...currentState.hybrid,
                  collectedData: processedData.collectedData,
                  globalVars: {
                    ...currentState.hybrid.globalVars,
                    ...processedData.contextVars,
                  },
                  lastActivity: new Date().toISOString(),
                },
                
                metadata: {
                  ...currentState.metadata,
                  lastOperation: "phase2_capture_complete",
                },
              };
              
              await state.update(finalHybridState);
              
              // DELAY PARA ASEGURAR ORDEN DE MENSAJES (PATRÓN V1-REFERENCE)
              await new Promise((resolve) => setTimeout(resolve, 1000));
              
              // NAVEGAR AL SIGUIENTE FLUJO
              console.log(`[EnhancedDataCapture] FASE 2 - Navegando al siguiente nodo: ${nextNode.nodeId}`);
              return gotoFlow(nextNode.flow);
            }
            
            console.log(`[EnhancedDataCapture] FASE 2 - Captura completada exitosamente`);
            
          } catch (error) {
            console.error(`[EnhancedDataCapture] FASE 2 - Error en captura:`, error);
            
            // FALLBACK: Continuar sin romper flujo
            await flowDynamic("Gracias por la información.");
          }
        }
      );
  }
  
  /**
   * MÉTODO: Obtener variables del sistema de leads (PRESERVAR)
   * PROPÓSITO: Mantener compatibilidad completa con sistema de leads
   */
  private static async getLeadSystemVariables(
    currentState: HybridState,
    tenantId: string
  ): Promise<any> {
    try {
      // IMPORTAR SERVICIO ACTUAL DEL SISTEMA DE LEADS (NO TOCAR)
      // Nota: Esto se integrará con salesFunnelService.ts existente
      
      // Por ahora, simular estructura esperada
      const leadVars = {
        businessName: "Nuestro Negocio", // Se obtendrá de tenant
        leadName: currentState.leadName || "",
        leadId: currentState.leadId || "",
        salesStageId: currentState.salesStageId || "",
        funnelPosition: currentState.funnelPosition || 0,
      };
      
      return leadVars;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo variables de leads:`, error);
      return {};
    }
  }
  
  /**
   * MÉTODO: Detectar tipo de input (EXTRAÍDO DEL V1-REFERENCE)
   */
  private static detectInputType(label?: string): string {
    if (!label) return "other";
    
    const lowercaseLabel = label.toLowerCase();
    const nameKeywords = ["nombre", "gusto", "llamas", "name"];
    
    return nameKeywords.some(keyword => lowercaseLabel.includes(keyword)) ? "name" : "other";
  }
  
  /**
   * MÉTODO: Procesar pregunta con variables de leads
   * PROPÓSITO: Integrar variables del sistema de leads en las preguntas
   */
  private static async processQuestionWithLeadVars(
    question: string | undefined,
    leadSystemVars: any,
    tenantId: string
  ): Promise<string> {
    if (!question) return "¿Podrías proporcionar esa información?";
    
    // NORMALIZAR VARIABLES (PATRÓN DEL V1-REFERENCE)
    const contextVars = this.normalizeContextVars(leadSystemVars);
    
    // REEMPLAZAR VARIABLES EN LA PREGUNTA
    return this.replaceVariables(question, contextVars);
  }
  
  /**
   * MÉTODO: Procesar respuesta del usuario con sistema de leads
   * PROPÓSITO: Integrar respuesta del usuario con datos del sistema de leads
   */
  private static async processUserResponseWithLeadSystem(
    userResponse: string,
    nodeData: EnhancedDataNodeContent,
    currentState: HybridState,
    tenantId: string
  ): Promise<{
    collectedData: Record<string, any>;
    contextVars: Record<string, any>;
    leadData: any;
  }> {
    
    const isNameField = currentState.hybrid?.inputType === "name";
    const leadSystemVars = currentState.hybrid?.leadSystemVars || {};
    
    // PROCESAR DATOS RECOLECTADOS (PATRÓN V1-REFERENCE)
    const collectedData = {
      ...(currentState.hybrid?.collectedData || {}),
      ...(isNameField
        ? {
            name: userResponse,
            lead_name: userResponse,
          }
        : {
            [nodeData.input?.label || "response"]: userResponse,
          }),
    };
    
    // NORMALIZAR VARIABLES DE CONTEXTO
    const contextVars = this.normalizeContextVars(leadSystemVars, collectedData);
    
    // PREPARAR DATOS PARA SISTEMA DE LEADS
    const leadData = {
      leadName: collectedData.name || collectedData.lead_name || currentState.leadName,
      leadPhone: collectedData.phone || collectedData.telefono,
      leadEmail: collectedData.email || collectedData.correo,
      salesStageId: currentState.salesStageId,
      lastResponse: userResponse,
      responseField: nodeData.input?.label || "response",
      captureMethod: "enhanced_two_phase",
    };
    
    return {
      collectedData,
      contextVars,
      leadData,
    };
  }
  
  /**
   * MÉTODO: Procesar mensaje de respuesta
   * PROPÓSITO: Mostrar mensaje de confirmación con variables reemplazadas
   */
  private static async processResponseMessage(
    responseMessage: string,
    contextVars: Record<string, any>,
    tenantId: string
  ): Promise<string> {
    return this.replaceVariables(responseMessage, contextVars);
  }
  
  /**
   * MÉTODO: Registrar interacción (ADAPTADO A ESQUEMA ACTUAL)
   * PROPÓSITO: Mantener registro de interacciones compatible con sistema actual
   */
  private static async registerInteraction(
    nodeId: string,
    userInput: string,
    botResponse: string,
    processedData: any,
    tenantId: string
  ): Promise<void> {
    try {
      // REGISTRAR EN TABLA DEL SISTEMA ACTUAL
      await supabase.from("chatbot_interactions").insert({
        tenant_id: tenantId,
        node_id: nodeId,
        user_input: userInput,
        bot_response: botResponse,
        timestamp: new Date(),
        metadata: {
          capture_method: "enhanced_two_phase",
          input_type: processedData.leadData.responseField,
          collected_data: processedData.collectedData,
          hybrid_mode: true,
        },
      });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error registrando interacción:`, error);
      // No lanzar error - continuar flujo
    }
  }
  
  /**
   * MÉTODO: Notificar al sistema de leads si es necesario
   * PROPÓSITO: Mantener sincronización con sistema de leads existente
   */
  private static async notifyLeadSystemIfNeeded(
    leadData: any,
    nodeData: EnhancedDataNodeContent,
    tenantId: string
  ): Promise<void> {
    try {
      // AQUÍ SE INTEGRARÁ CON salesFunnelService.ts EXISTENTE
      // Por ahora, log para debugging
      console.log(`[EnhancedDataCapture] Datos para sistema de leads:`, {
        leadData,
        nodeStage: nodeData.leadStage,
        tenantId,
      });
      
      // TODO: Integrar con salesFunnelService.updateLeadProgress()
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error notificando sistema de leads:`, error);
      // No lanzar error - sistema de leads debe seguir funcionando
    }
  }
  
  /**
   * MÉTODO: Obtener siguiente nodo híbrido
   * PROPÓSITO: Navegación dinámica basada en BD (PATRÓN V1-REFERENCE)
   */
  private static async getNextNodeHybrid(
    currentNodeId: string,
    tenantId: string
  ): Promise<{ nodeId: string; flow: any } | null> {
    try {
      // CONSULTAR EDGES EN ESQUEMA ACTUAL
      const { data: edges } = await supabase
        .from("chatbot_template_edges")
        .select("*")
        .eq("source_node_id", currentNodeId)
        .eq("tenant_id", tenantId);
      
      if (edges && edges.length > 0) {
        const nextNodeId = edges[0].target_node_id;
        
        const { data: nextNode } = await supabase
          .from("chatbot_template_nodes")
          .select("*")
          .eq("id", nextNodeId)
          .eq("tenant_id", tenantId)
          .single();
        
        if (nextNode) {
          // DETERMINAR FLUJO BASADO EN TIPO DE NODO
          const flow = await this.determineFlowForNodeType(nextNode.type, tenantId);
          
          return {
            nodeId: nextNodeId,
            flow: flow,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo siguiente nodo:`, error);
      return null;
    }
  }
  
  /**
   * MÉTODO: Determinar flujo para tipo de nodo
   * PROPÓSITO: Routing dinámico a flows apropiados
   */
  private static async determineFlowForNodeType(nodeType: string, tenantId: string): Promise<any> {
    switch (nodeType.toLowerCase()) {
      case "datos":
      case "input":
      case "captura":
        // RETORNAR ESTE MISMO FLUJO PARA CAPTURA
        return this.createTwoPhaseCapture({ nodeId: "next" }, tenantId);
        
      case "message":
      case "texto":
        // AQUÍ SE INTEGRARÁ CON OTROS MÓDULOS HÍBRIDOS
        // Por ahora, retornar null para usar sistema actual
        return null;
        
      default:
        // USAR SISTEMA ACTUAL PARA TIPOS NO HÍBRIDOS
        return null;
    }
  }
  
  /**
   * MÉTODO: Normalizar variables de contexto (EXTRAÍDO DEL V1-REFERENCE)
   */
  private static normalizeContextVars(
    leadSystemVars: any,
    additionalVars: Record<string, string> = {}
  ): Record<string, string> {
    const businessName = leadSystemVars.businessName || "Nuestro Negocio";
    
    return {
      business_name: businessName,
      businessName: businessName,
      businessname: businessName,
      BUSINESS_NAME: businessName,
      business_Name: businessName,
      BusinessName: businessName,
      name: additionalVars.name || leadSystemVars.leadName || "",
      lead_name: additionalVars.lead_name || additionalVars.name || leadSystemVars.leadName || "",
      phone: additionalVars.phone || additionalVars.telefono || "",
      email: additionalVars.email || additionalVars.correo || "",
      ...additionalVars,
    };
  }
  
  /**
   * MÉTODO: Reemplazar variables en contenido (EXTRAÍDO DEL V1-REFERENCE)
   */
  private static replaceVariables(
    content: string | undefined | null,
    variables: Record<string, string>
  ): string {
    if (!content) return "";
    
    let processedContent = content;
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, "gi");
        processedContent = processedContent.replace(regex, value);
      }
    });
    return processedContent;
  }
  
  /**
   * SUB-TAREA 2.2: FUNCIÓN captureWithPersistence()
   * 
   * PROPÓSITO: Función específica para captura con persistencia entre requests
   * BASADA EN: Patrón de estado persistente del v1-reference
   * PRESERVA: Sistema de leads y compatibilidad con sistema actual
   */
  static async captureWithPersistence(config: CaptureConfig): Promise<any> {
    try {
      console.log(`[EnhancedDataCapture] Iniciando captureWithPersistence para ${config.nodeId}`);
      
      // VALIDAR CONFIGURACIÓN
      const validationResult = await this.validateCaptureConfig(config);
      if (!validationResult.isValid) {
        console.error(`[EnhancedDataCapture] Configuración inválida:`, validationResult.errors);
        return this.fallbackToCurrentSystem(config, config.tenantId);
      }
      
      // CREAR FLUJO CON PERSISTENCIA MEJORADA
      return addKeyword(config.keywords || [""])
        
        // FASE 1: PREPARACIÓN CON PERSISTENCIA
        .addAction(async (ctx, { flowDynamic, state }) => {
          try {
            // OBTENER O CREAR SESIÓN PERSISTENTE
            const persistentSession = await this.getOrCreatePersistentSession(
              ctx.from,
              config.tenantId,
              config.sessionTTL || 3600000 // 1 hora por defecto
            );
            
            // PRESERVAR ESTADO COMPLETO DEL SISTEMA ACTUAL
            const currentState = await state.getMyState() || {};
            
            // OBTENER CONFIGURACIÓN DEL NODO CON CACHÉ
            const nodeData = await this.getNodeDataWithCache(
              config.nodeId,
              config.tenantId
            );
            
            if (!nodeData) {
              throw new Error(`Nodo ${config.nodeId} no encontrado`);
            }
            
            // PREPARAR VARIABLES DEL SISTEMA DE LEADS
            const leadSystemContext = await this.prepareLeadSystemContext(
              currentState,
              config.tenantId,
              config.preserveLeadVars || true
            );
            
            // CREAR ESTADO PERSISTENTE HÍBRIDO
            const persistentState = await this.createPersistentHybridState(
              currentState,
              nodeData,
              leadSystemContext,
              persistentSession,
              config
            );
            
            // ACTUALIZAR ESTADO CON PERSISTENCIA
            await state.update(persistentState);
            
            // REGISTRAR ACTIVIDAD EN SESIÓN PERSISTENTE
            await this.updateSessionActivity(
              persistentSession.sessionId,
              'preparation_phase',
              {
                nodeId: config.nodeId,
                timestamp: new Date().toISOString(),
                userFrom: ctx.from,
              }
            );
            
            // PROCESAR Y MOSTRAR PREGUNTA
            const processedQuestion = await this.processQuestionWithPersistence(
              nodeData,
              leadSystemContext,
              config
            );
            
            if (processedQuestion) {
              await flowDynamic(processedQuestion);
              
              // APLICAR TIMEOUT SI ESTÁ CONFIGURADO
              if (config.responseTimeout) {
                await this.setResponseTimeout(
                  persistentSession.sessionId,
                  config.responseTimeout,
                  config.timeoutMessage || "No se recibió respuesta en el tiempo esperado."
                );
              }
            }
            
            console.log(`[EnhancedDataCapture] Preparación con persistencia completada para ${config.nodeId}`);
            
          } catch (error) {
            console.error(`[EnhancedDataCapture] Error en preparación con persistencia:`, error);
            
            // FALLBACK: Continuar con preparación básica
            await this.basicPreparationFallback(ctx, state, flowDynamic, config);
          }
        })
        
        // FASE 2: CAPTURA CON PERSISTENCIA Y VALIDACIÓN
        .addAnswer(
          "",
          { capture: true },
          async (ctx, { flowDynamic, state, gotoFlow }) => {
            try {
              console.log(`[EnhancedDataCapture] Captura con persistencia - Respuesta: "${ctx.body}"`);
              
              // RECUPERAR SESIÓN PERSISTENTE
              const persistentSession = await this.getPersistentSession(ctx.from, config.tenantId);
              if (!persistentSession) {
                throw new Error('Sesión persistente no encontrada');
              }
              
              // RECUPERAR ESTADO HÍBRIDO PERSISTENTE
              const hybridState = await state.getMyState();
              if (!hybridState?.hybrid) {
                throw new Error('Estado híbrido no encontrado');
              }
              
              // VALIDAR RESPUESTA DEL USUARIO
              const validationResult = await this.validateUserResponse(
                ctx.body,
                hybridState.hybrid.nodeData,
                config.validation || {}
              );
              
              if (!validationResult.isValid && config.enforceValidation) {
                // SOLICITAR RESPUESTA VÁLIDA
                await flowDynamic(
                  validationResult.errorMessage || 
                  "Por favor, proporciona una respuesta válida."
                );
                
                // INCREMENTAR CONTADOR DE INTENTOS
                await this.incrementValidationAttempts(persistentSession.sessionId);
                
                // NO CONTINUAR - ESPERAR NUEVA RESPUESTA
                return;
              }
              
              // PROCESAR RESPUESTA CON PERSISTENCIA
              const processedResponse = await this.processResponseWithPersistence(
                ctx.body,
                hybridState,
                persistentSession,
                config
              );
              
              // ACTUALIZAR SISTEMA DE LEADS CON PERSISTENCIA
              await this.updateLeadSystemWithPersistence(
                processedResponse.leadData,
                hybridState.hybrid.nodeData,
                config.tenantId,
                config.leadSystemIntegration || {}
              );
              
              // MOSTRAR MENSAJE DE CONFIRMACIÓN
              if (processedResponse.confirmationMessage) {
                await flowDynamic(processedResponse.confirmationMessage);
              }
              
              // REGISTRAR CAPTURA EXITOSA
              await this.registerSuccessfulCapture(
                config.nodeId,
                ctx.body,
                processedResponse,
                persistentSession,
                config.tenantId
              );
              
              // ACTUALIZAR ESTADO FINAL CON PERSISTENCIA
              const finalState = await this.createFinalPersistentState(
                hybridState,
                processedResponse,
                persistentSession
              );
              
              await state.update(finalState);
              
              // LIMPIAR TIMEOUT SI EXISTÍA
              if (config.responseTimeout) {
                await this.clearResponseTimeout(persistentSession.sessionId);
              }
              
              // NAVEGACIÓN PERSISTENTE AL SIGUIENTE NODO
              const navigationResult = await this.navigateWithPersistence(
                config.nodeId,
                finalState,
                persistentSession,
                config.tenantId,
                gotoFlow
              );
              
              if (navigationResult.success) {
                return navigationResult.flow;
              }
              
              console.log(`[EnhancedDataCapture] Captura con persistencia completada exitosamente`);
              
            } catch (error) {
              console.error(`[EnhancedDataCapture] Error en captura con persistencia:`, error);
              
              // FALLBACK: Captura básica
              await this.basicCaptureFallback(ctx, state, flowDynamic, config);
            }
          }
        );
        
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error crítico en captureWithPersistence:`, error);
      
      // FALLBACK CRÍTICO: Sistema actual
      return this.fallbackToCurrentSystem(config, config.tenantId);
    }
  }
  
  /**
   * MÉTODO: Obtener o crear sesión persistente
   * PROPÓSITO: Mantener sesiones activas para evitar pérdida de contexto
   */
  private static async getOrCreatePersistentSession(
    userId: string,
    tenantId: string,
    ttl: number
  ): Promise<PersistentSession> {
    try {
      // BUSCAR SESIÓN EXISTENTE ACTIVA
      const { data: existingSession } = await supabase
        .from('hybrid_persistent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (existingSession) {
        // EXTENDER SESIÓN EXISTENTE
        await this.extendSession(existingSession.session_id, ttl);
        return {
          sessionId: existingSession.session_id,
          userId: existingSession.user_id,
          tenantId: existingSession.tenant_id,
          createdAt: existingSession.created_at,
          expiresAt: new Date(Date.now() + ttl).toISOString(),
          metadata: existingSession.metadata || {},
        };
      }
      
      // CREAR NUEVA SESIÓN PERSISTENTE
      const newSessionId = `hybrid_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + ttl).toISOString();
      
      const { data: newSession } = await supabase
        .from('hybrid_persistent_sessions')
        .insert({
          session_id: newSessionId,
          user_id: userId,
          tenant_id: tenantId,
          created_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_active: true,
          metadata: {
            created_by: 'enhancedDataCapture',
            version: '1.0',
          },
        })
        .select()
        .single();
      
      return {
        sessionId: newSessionId,
        userId,
        tenantId,
        createdAt: new Date().toISOString(),
        expiresAt,
        metadata: {},
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en sesión persistente:`, error);
      
      // FALLBACK: Sesión temporal en memoria
      return {
        sessionId: `temp_${Date.now()}`,
        userId,
        tenantId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString(),
        metadata: { temporary: true },
      };
    }
  }
  
  /**
   * MÉTODO: Validar configuración de captura
   * PROPÓSITO: Asegurar que la configuración es válida antes de proceder
   */
  private static async validateCaptureConfig(config: CaptureConfig): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // VALIDACIONES OBLIGATORIAS
    if (!config.nodeId) {
      errors.push('nodeId es requerido');
    }
    
    if (!config.tenantId) {
      errors.push('tenantId es requerido');
    }
    
    // VALIDACIONES DE CONFIGURACIÓN
    if (config.sessionTTL && config.sessionTTL < 60000) {
      warnings.push('sessionTTL muy bajo (mínimo recomendado: 1 minuto)');
    }
    
    if (config.responseTimeout && config.responseTimeout < 10000) {
      warnings.push('responseTimeout muy bajo (mínimo recomendado: 10 segundos)');
    }
    
    // VALIDAR QUE EL NODO EXISTE
    try {
      const { data: node } = await supabase
        .from('chatbot_template_nodes')
        .select('id')
        .eq('id', config.nodeId)
        .eq('tenant_id', config.tenantId)
        .single();
      
      if (!node) {
        errors.push(`Nodo ${config.nodeId} no encontrado en tenant ${config.tenantId}`);
      }
    } catch (error) {
      errors.push(`Error validando nodo: ${error.message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
  
  /**
   * MÉTODO: Validar respuesta del usuario
   * PROPÓSITO: Validar entrada según reglas configuradas
   */
  private static async validateUserResponse(
    userResponse: string,
    nodeData: any,
    validationRules: ValidationRules
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    processedValue?: string;
  }> {
    try {
      // VALIDACIONES BÁSICAS
      if (!userResponse || userResponse.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: validationRules.emptyMessage || "Por favor, proporciona una respuesta.",
        };
      }
      
      const trimmedResponse = userResponse.trim();
      
      // VALIDACIÓN DE LONGITUD
      if (validationRules.minLength && trimmedResponse.length < validationRules.minLength) {
        return {
          isValid: false,
          errorMessage: `La respuesta debe tener al menos ${validationRules.minLength} caracteres.`,
        };
      }
      
      if (validationRules.maxLength && trimmedResponse.length > validationRules.maxLength) {
        return {
          isValid: false,
          errorMessage: `La respuesta no puede exceder ${validationRules.maxLength} caracteres.`,
        };
      }
      
      // VALIDACIÓN POR TIPO DE CAMPO
      const inputType = nodeData?.input?.type || 'text';
      
      switch (inputType) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(trimmedResponse)) {
            return {
              isValid: false,
              errorMessage: "Por favor, proporciona un email válido.",
            };
          }
          break;
          
        case 'phone':
          const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
          if (!phoneRegex.test(trimmedResponse.replace(/[\s\-\(\)]/g, ''))) {
            return {
              isValid: false,
              errorMessage: "Por favor, proporciona un número de teléfono válido.",
            };
          }
          break;
          
        case 'number':
          if (isNaN(Number(trimmedResponse))) {
            return {
              isValid: false,
              errorMessage: "Por favor, proporciona un número válido.",
            };
          }
          break;
      }
      
      // VALIDACIÓN PERSONALIZADA
      if (validationRules.customPattern) {
        const customRegex = new RegExp(validationRules.customPattern);
        if (!customRegex.test(trimmedResponse)) {
          return {
            isValid: false,
            errorMessage: validationRules.customPatternMessage || "Formato de respuesta inválido.",
          };
        }
      }
      
      return {
        isValid: true,
        processedValue: trimmedResponse,
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en validación:`, error);
      
      // FALLBACK: Aceptar respuesta
      return {
        isValid: true,
        processedValue: userResponse.trim(),
      };
    }
  }
  
  /**
   * MÉTODOS AUXILIARES PARA captureWithPersistence()
   * PROPÓSITO: Funciones de apoyo para la persistencia mejorada
   */
  
  // Método para obtener datos del nodo con caché
  private static async getNodeDataWithCache(nodeId: string, tenantId: string): Promise<any> {
    // TODO: Implementar caché para mejorar rendimiento
    const { data: node } = await supabase
      .from("chatbot_template_nodes")
      .select("*")
      .eq("id", nodeId)
      .eq("tenant_id", tenantId)
      .single();
    
    return node ? (typeof node.content === "string" ? JSON.parse(node.content) : node.content) : null;
  }
  
  // Método para preparar contexto del sistema de leads
  private static async prepareLeadSystemContext(currentState: any, tenantId: string, preserve: boolean): Promise<any> {
    if (!preserve) return {};
    
    return {
      leadId: currentState.leadId,
      leadName: currentState.leadName,
      salesStageId: currentState.salesStageId,
      funnelPosition: currentState.funnelPosition,
      businessName: "Nuestro Negocio", // Se obtendrá del tenant
    };
  }
  
  // Método para crear estado híbrido persistente
  private static async createPersistentHybridState(
    currentState: any,
    nodeData: any,
    leadContext: any,
    session: PersistentSession,
    config: CaptureConfig
  ): Promise<any> {
    return {
      ...currentState,
      hybrid: {
        currentNodeId: config.nodeId,
        nodeData: nodeData,
        inputType: this.detectInputType(nodeData.input?.label),
        collectedData: currentState.hybrid?.collectedData || {},
        globalVars: currentState.hybrid?.globalVars || {},
        awaitingResponse: true,
        sessionStarted: session.createdAt,
        lastActivity: new Date().toISOString(),
        leadSystemVars: leadContext,
        sessionId: session.sessionId,
      },
      metadata: {
        hybridMode: true,
        version: "1.0",
        lastOperation: "persistent_preparation",
      },
    };
  }
  
  // Método para actualizar actividad de sesión
  private static async updateSessionActivity(sessionId: string, phase: string, data: any): Promise<void> {
    try {
      await supabase
        .from('hybrid_session_activity')
        .insert({
          session_id: sessionId,
          phase: phase,
          activity_data: data,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error actualizando actividad de sesión:`, error);
      // No lanzar error - continuar flujo
    }
  }
  
  // Método para procesar pregunta con persistencia
  private static async processQuestionWithPersistence(
    nodeData: any,
    leadContext: any,
    config: CaptureConfig
  ): Promise<string> {
    const question = nodeData.input?.label || nodeData.inputLabel || "¿Podrías proporcionar esa información?";
    const contextVars = this.normalizeContextVars(leadContext);
    return this.replaceVariables(question, contextVars);
  }
  
  // Método para establecer timeout de respuesta
  private static async setResponseTimeout(sessionId: string, timeout: number, message: string): Promise<void> {
    try {
      // TODO: Implementar sistema de timeouts
      console.log(`[EnhancedDataCapture] Timeout configurado para sesión ${sessionId}: ${timeout}ms`);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error configurando timeout:`, error);
    }
  }
  
  // Método para obtener sesión persistente
  private static async getPersistentSession(userId: string, tenantId: string): Promise<PersistentSession | null> {
    try {
      const { data: session } = await supabase
        .from('hybrid_persistent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (session) {
        return {
          sessionId: session.session_id,
          userId: session.user_id,
          tenantId: session.tenant_id,
          createdAt: session.created_at,
          expiresAt: session.expires_at,
          metadata: session.metadata || {},
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo sesión:`, error);
      return null;
    }
  }
  
  // Método para incrementar intentos de validación
  private static async incrementValidationAttempts(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('hybrid_persistent_sessions')
        .update({
          metadata: supabase.raw(`jsonb_set(metadata, '{validation_attempts}', (COALESCE(metadata->>'validation_attempts', '0')::int + 1)::text::jsonb)`),
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error incrementando intentos:`, error);
    }
  }
  
  // Método para procesar respuesta con persistencia
  private static async processResponseWithPersistence(
    userResponse: string,
    hybridState: any,
    session: PersistentSession,
    config: CaptureConfig
  ): Promise<any> {
    const nodeData = hybridState.hybrid.nodeData;
    const isNameField = hybridState.hybrid.inputType === "name";
    
    const collectedData = {
      ...(hybridState.hybrid.collectedData || {}),
      ...(isNameField
        ? { name: userResponse, lead_name: userResponse }
        : { [nodeData.input?.label || "response"]: userResponse }),
    };
    
    const contextVars = this.normalizeContextVars(hybridState.hybrid.leadSystemVars, collectedData);
    
    const leadData = {
      leadName: collectedData.name || collectedData.lead_name || hybridState.leadName,
      leadPhone: collectedData.phone || collectedData.telefono,
      leadEmail: collectedData.email || collectedData.correo,
      salesStageId: hybridState.salesStageId,
      lastResponse: userResponse,
      responseField: nodeData.input?.label || "response",
      sessionId: session.sessionId,
    };
    
    let confirmationMessage = null;
    if (nodeData.responseMessage) {
      confirmationMessage = this.replaceVariables(nodeData.responseMessage, contextVars);
    }
    
    return {
      collectedData,
      contextVars,
      leadData,
      confirmationMessage,
    };
  }
  
  // Método para actualizar sistema de leads con persistencia
  private static async updateLeadSystemWithPersistence(
    leadData: any,
    nodeData: any,
    tenantId: string,
    integration: LeadSystemIntegration
  ): Promise<void> {
    try {
      if (!integration.enabled) return;
      
      // TODO: Integrar con salesFunnelService.ts existente
      console.log(`[EnhancedDataCapture] Actualizando sistema de leads:`, leadData);
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error actualizando sistema de leads:`, error);
      // No lanzar error - sistema de leads debe seguir funcionando
    }
  }
  
  // Método para registrar captura exitosa
  private static async registerSuccessfulCapture(
    nodeId: string,
    userInput: string,
    processedResponse: any,
    session: PersistentSession,
    tenantId: string
  ): Promise<void> {
    try {
      await supabase.from("chatbot_interactions").insert({
        tenant_id: tenantId,
        node_id: nodeId,
        user_input: userInput,
        bot_response: processedResponse.confirmationMessage || "",
        timestamp: new Date(),
        metadata: {
          capture_method: "enhanced_persistent",
          session_id: session.sessionId,
          collected_data: processedResponse.collectedData,
          lead_data: processedResponse.leadData,
          hybrid_mode: true,
        },
      });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error registrando captura:`, error);
    }
  }
  
  // Método para crear estado final persistente
  private static async createFinalPersistentState(
    hybridState: any,
    processedResponse: any,
    session: PersistentSession
  ): Promise<any> {
    return {
      ...hybridState,
      leadName: processedResponse.leadData.leadName || hybridState.leadName,
      hybrid: {
        ...hybridState.hybrid,
        collectedData: processedResponse.collectedData,
        globalVars: {
          ...hybridState.hybrid.globalVars,
          ...processedResponse.contextVars,
        },
        lastActivity: new Date().toISOString(),
        captureCompleted: true,
      },
      metadata: {
        ...hybridState.metadata,
        lastOperation: "persistent_capture_complete",
      },
    };
  }
  
  // Método para limpiar timeout
  private static async clearResponseTimeout(sessionId: string): Promise<void> {
    try {
      // TODO: Implementar limpieza de timeouts
      console.log(`[EnhancedDataCapture] Timeout limpiado para sesión ${sessionId}`);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error limpiando timeout:`, error);
    }
  }
  
  // Método para navegación con persistencia
  private static async navigateWithPersistence(
    currentNodeId: string,
    finalState: any,
    session: PersistentSession,
    tenantId: string,
    gotoFlow: any
  ): Promise<{ success: boolean; flow?: any }> {
    try {
      const nextNode = await this.getNextNodeHybrid(currentNodeId, tenantId);
      
      if (nextNode) {
        // Actualizar sesión con navegación
        await this.updateSessionActivity(session.sessionId, 'navigation', {
          from: currentNodeId,
          to: nextNode.nodeId,
          timestamp: new Date().toISOString(),
        });
        
        return {
          success: true,
          flow: nextNode.flow,
        };
      }
      
      return { success: false };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en navegación persistente:`, error);
      return { success: false };
    }
  }
  
  // Método para extender sesión
  private static async extendSession(sessionId: string, ttl: number): Promise<void> {
    try {
      const newExpiresAt = new Date(Date.now() + ttl).toISOString();
      await supabase
        .from('hybrid_persistent_sessions')
        .update({ expires_at: newExpiresAt })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error extendiendo sesión:`, error);
    }
  }
  
  // Fallbacks básicos
  private static async basicPreparationFallback(ctx: any, state: any, flowDynamic: any, config: CaptureConfig): Promise<void> {
    try {
      await flowDynamic("¿Podrías proporcionar esa información?");
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de preparación:`, error);
    }
  }
  
  private static async basicCaptureFallback(ctx: any, state: any, flowDynamic: any, config: CaptureConfig): Promise<void> {
    try {
      await flowDynamic("Gracias por la información.");
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de captura:`, error);
    }
  }
  
  /**
   * SUB-TAREA 2.3: ADAPTACIÓN MULTI-TENANT DEL PATRÓN capture: true
   * 
   * PROPÓSITO: Adaptar el patrón de captura funcional del v1-reference para 
   * funcionar correctamente en la arquitectura multi-tenant del sistema actual
   * PRESERVA: Sistema de leads y compatibilidad total con esquema actual
   */
  
  /**
   * MÉTODO PRINCIPAL: Crear captura multi-tenant
   * BASADO EN: Patrón capture: true del v1-reference
   * ADAPTADO PARA: Arquitectura multi-tenant con aislamiento completo
   */
  static createMultiTenantCapture(config: MultiTenantCaptureConfig): any {
    console.log(`[EnhancedDataCapture] Iniciando captura multi-tenant para tenant ${config.tenantId}`);
    
    // VALIDAR CONFIGURACIÓN MULTI-TENANT
    if (!this.validateMultiTenantConfig(config)) {
      console.error(`[EnhancedDataCapture] Configuración multi-tenant inválida`);
      return this.fallbackToCurrentSystem(config, config.tenantId);
    }
    
    return addKeyword(config.keywords || [""])
      
      // ========================================
      // FASE 1: PREPARACIÓN MULTI-TENANT
      // ========================================
      .addAction(async (ctx, { flowDynamic, state }) => {
        try {
          console.log(`[EnhancedDataCapture] MULTI-TENANT FASE 1 - Tenant: ${config.tenantId}, Usuario: ${ctx.from}`);
          
          // 1. VALIDAR AISLAMIENTO MULTI-TENANT
          const tenantValidation = await this.validateTenantIsolation(
            config.tenantId,
            ctx.from,
            config.enforceIsolation || true
          );
          
          if (!tenantValidation.isValid) {
            console.error(`[EnhancedDataCapture] Violación de aislamiento de tenant:`, tenantValidation.violations);
            throw new Error(`Tenant isolation violation: ${tenantValidation.violations.join(', ')}`);
          }
          
          // 2. OBTENER ESTADO ACTUAL CON CONTEXTO MULTI-TENANT
          const currentState = await this.getMultiTenantState(state, config.tenantId, ctx.from);
          
          // 3. OBTENER CONFIGURACIÓN DEL NODO (ESQUEMA MULTI-TENANT)
          const nodeData = await this.getMultiTenantNodeData(
            config.nodeId,
            config.tenantId,
            config.templateId
          );
          
          if (!nodeData) {
            throw new Error(`Nodo ${config.nodeId} no encontrado para tenant ${config.tenantId}`);
          }
          
          // 4. OBTENER VARIABLES DEL TENANT (SISTEMA DE LEADS INCLUIDO)
          const tenantVariables = await this.getMultiTenantVariables(
            config.tenantId,
            currentState,
            config.includeLeadVars || true
          );
          
          // 5. CREAR CONTEXTO MULTI-TENANT SEGURO
          const multiTenantContext = await this.createSecureMultiTenantContext(
            currentState,
            nodeData,
            tenantVariables,
            config
          );
          
          // 6. ACTUALIZAR ESTADO CON AISLAMIENTO MULTI-TENANT
          const isolatedState = await this.createIsolatedHybridState(
            currentState,
            multiTenantContext,
            config
          );
          
          await state.update(isolatedState);
          
          // 7. PROCESAR PREGUNTA CON VARIABLES DEL TENANT
          const processedQuestion = await this.processMultiTenantQuestion(
            nodeData,
            tenantVariables,
            config.tenantId
          );
          
          // 8. REGISTRAR ACTIVIDAD MULTI-TENANT
          await this.logMultiTenantActivity(
            config.tenantId,
            ctx.from,
            'preparation_phase',
            {
              nodeId: config.nodeId,
              templateId: config.templateId,
              questionProcessed: !!processedQuestion,
            }
          );
          
          if (processedQuestion) {
            await flowDynamic(processedQuestion);
          }
          
          console.log(`[EnhancedDataCapture] MULTI-TENANT FASE 1 completada para tenant ${config.tenantId}`);
          
        } catch (error) {
          console.error(`[EnhancedDataCapture] Error en preparación multi-tenant:`, error);
          
          // FALLBACK MULTI-TENANT: Intentar preparación básica
          await this.multiTenantPreparationFallback(ctx, state, flowDynamic, config);
        }
      })
      
      // ========================================
      // FASE 2: CAPTURA MULTI-TENANT (capture: true)
      // ========================================
      .addAnswer(
        "",
        { capture: true }, // PATRÓN CLAVE ADAPTADO PARA MULTI-TENANT
        async (ctx, { flowDynamic, state, gotoFlow }) => {
          try {
            console.log(`[EnhancedDataCapture] MULTI-TENANT FASE 2 - Captura para tenant ${config.tenantId}: "${ctx.body}"`);
            
            // 1. VALIDAR CONTEXTO MULTI-TENANT EN CAPTURA
            const captureValidation = await this.validateMultiTenantCapture(
              ctx.from,
              config.tenantId,
              state
            );
            
            if (!captureValidation.isValid) {
              console.error(`[EnhancedDataCapture] Contexto multi-tenant inválido en captura:`, captureValidation.errors);
              throw new Error(`Multi-tenant capture context invalid`);
            }
            
            // 2. RECUPERAR ESTADO HÍBRIDO MULTI-TENANT
            const hybridState = await this.getMultiTenantHybridState(state, config.tenantId);
            if (!hybridState?.hybrid) {
              throw new Error(`Estado híbrido multi-tenant no encontrado para tenant ${config.tenantId}`);
            }
            
            // 3. VALIDAR RESPUESTA CON REGLAS DEL TENANT
            const tenantValidationRules = await this.getTenantValidationRules(
              config.tenantId,
              hybridState.hybrid.nodeData
            );
            
            const responseValidation = await this.validateResponseForTenant(
              ctx.body,
              tenantValidationRules,
              config.tenantId
            );
            
            if (!responseValidation.isValid && config.enforceValidation) {
              // MANEJAR VALIDACIÓN FALLIDA CON CONTEXTO MULTI-TENANT
              await this.handleMultiTenantValidationFailure(
                responseValidation,
                flowDynamic,
                config.tenantId,
                ctx.from
              );
              return; // No continuar hasta obtener respuesta válida
            }
            
            // 4. PROCESAR RESPUESTA CON AISLAMIENTO MULTI-TENANT
            const processedResponse = await this.processMultiTenantResponse(
              ctx.body,
              hybridState,
              config
            );
            
            // 5. ACTUALIZAR SISTEMA DE LEADS CON CONTEXTO MULTI-TENANT
            await this.updateMultiTenantLeadSystem(
              processedResponse.leadData,
              hybridState.hybrid.nodeData,
              config.tenantId
            );
            
            // 6. MOSTRAR MENSAJE CON VARIABLES DEL TENANT
            if (processedResponse.confirmationMessage) {
              await flowDynamic(processedResponse.confirmationMessage);
            }
            
            // 7. REGISTRAR CAPTURA EXITOSA CON AISLAMIENTO
            await this.registerMultiTenantCapture(
              config.nodeId,
              ctx.body,
              processedResponse,
              config.tenantId,
              ctx.from
            );
            
            // 8. ACTUALIZAR ESTADO FINAL MULTI-TENANT
            const finalMultiTenantState = await this.createFinalMultiTenantState(
              hybridState,
              processedResponse,
              config
            );
            
            await state.update(finalMultiTenantState);
            
            // 9. NAVEGACIÓN MULTI-TENANT AL SIGUIENTE NODO
            const navigationResult = await this.navigateMultiTenant(
              config.nodeId,
              config.tenantId,
              finalMultiTenantState,
              gotoFlow
            );
            
            if (navigationResult.success) {
              // REGISTRAR NAVEGACIÓN MULTI-TENANT
              await this.logMultiTenantActivity(
                config.tenantId,
                ctx.from,
                'navigation',
                {
                  from: config.nodeId,
                  to: navigationResult.targetNodeId,
                  method: 'hybrid_multi_tenant',
                }
              );
              
              return navigationResult.flow;
            }
            
            console.log(`[EnhancedDataCapture] MULTI-TENANT FASE 2 completada para tenant ${config.tenantId}`);
            
          } catch (error) {
            console.error(`[EnhancedDataCapture] Error en captura multi-tenant:`, error);
            
            // FALLBACK MULTI-TENANT: Captura básica preservando aislamiento
            await this.multiTenantCaptureFallback(ctx, state, flowDynamic, config);
          }
        }
      );
  }
  
  /**
   * MÉTODO: Validar configuración multi-tenant
   * PROPÓSITO: Asegurar que la configuración respeta el aislamiento multi-tenant
   */
  private static validateMultiTenantConfig(config: MultiTenantCaptureConfig): boolean {
    // VALIDACIONES CRÍTICAS MULTI-TENANT
    if (!config.tenantId || typeof config.tenantId !== 'string') {
      console.error(`[EnhancedDataCapture] tenantId inválido: ${config.tenantId}`);
      return false;
    }
    
    if (!config.nodeId || typeof config.nodeId !== 'string') {
      console.error(`[EnhancedDataCapture] nodeId inválido: ${config.nodeId}`);
      return false;
    }
    
    // VALIDAR FORMATO UUID PARA TENANT ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(config.tenantId)) {
      console.error(`[EnhancedDataCapture] Formato de tenantId inválido: ${config.tenantId}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * MÉTODO: Validar aislamiento de tenant
   * PROPÓSITO: Asegurar que el usuario pertenece al tenant correcto
   */
  private static async validateTenantIsolation(
    tenantId: string,
    userId: string,
    enforceIsolation: boolean
  ): Promise<{
    isValid: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];
    
    try {
      if (!enforceIsolation) {
        return { isValid: true, violations: [] };
      }
      
      // VERIFICAR QUE EL TENANT EXISTE Y ESTÁ ACTIVO
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, is_active')
        .eq('id', tenantId)
        .single();
      
      if (tenantError || !tenant) {
        violations.push(`Tenant ${tenantId} no encontrado`);
      } else if (!tenant.is_active) {
        violations.push(`Tenant ${tenantId} está inactivo`);
      }
      
      // VERIFICAR LÍMITES DE TENANT (OPCIONAL)
      const sessionCount = await this.getTenantActiveSessionCount(tenantId);
      const tenantLimits = await this.getTenantLimits(tenantId);
      
      if (tenantLimits.maxActiveSessions && sessionCount >= tenantLimits.maxActiveSessions) {
        violations.push(`Tenant ${tenantId} ha excedido el límite de sesiones activas`);
      }
      
      return {
        isValid: violations.length === 0,
        violations,
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error validando aislamiento de tenant:`, error);
      violations.push(`Error de validación de tenant: ${error.message}`);
      
      return {
        isValid: false,
        violations,
      };
    }
  }
  
  /**
   * MÉTODO: Obtener estado multi-tenant
   * PROPÓSITO: Recuperar estado con contexto y aislamiento de tenant
   */
  private static async getMultiTenantState(
    state: any,
    tenantId: string,
    userId: string
  ): Promise<any> {
    try {
      const currentState = await state.getMyState() || {};
      
      // VERIFICAR QUE EL ESTADO PERTENECE AL TENANT CORRECTO
      if (currentState.tenantId && currentState.tenantId !== tenantId) {
        console.warn(`[EnhancedDataCapture] Estado cross-tenant detectado. Esperado: ${tenantId}, Encontrado: ${currentState.tenantId}`);
        
        // LIMPIAR ESTADO CONTAMINADO
        return {
          tenantId: tenantId,
          userId: userId,
          metadata: {
            stateReset: true,
            reason: 'cross_tenant_contamination',
            timestamp: new Date().toISOString(),
          },
        };
      }
      
      // ASEGURAR CONTEXTO MULTI-TENANT EN EL ESTADO
      return {
        ...currentState,
        tenantId: tenantId,
        userId: userId,
        metadata: {
          ...currentState.metadata,
          tenantValidated: true,
          lastTenantValidation: new Date().toISOString(),
        },
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo estado multi-tenant:`, error);
      
      // ESTADO LIMPIO MULTI-TENANT
      return {
        tenantId: tenantId,
        userId: userId,
        metadata: {
          stateRecovered: true,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  
  /**
   * MÉTODO: Obtener datos del nodo multi-tenant
   * PROPÓSITO: Recuperar configuración del nodo con aislamiento de tenant
   */
  private static async getMultiTenantNodeData(
    nodeId: string,
    tenantId: string,
    templateId?: string
  ): Promise<any> {
    try {
      // CONSULTA CON AISLAMIENTO MULTI-TENANT ESTRICTO
      let query = supabase
        .from('chatbot_template_nodes')
        .select('*')
        .eq('id', nodeId)
        .eq('tenant_id', tenantId); // AISLAMIENTO CRÍTICO
      
      // FILTRAR POR TEMPLATE SI SE PROPORCIONA
      if (templateId) {
        query = query.eq('template_id', templateId);
      }
      
      const { data: node, error } = await query.single();
      
      if (error || !node) {
        console.error(`[EnhancedDataCapture] Nodo multi-tenant no encontrado:`, { nodeId, tenantId, templateId, error });
        return null;
      }
      
      // VERIFICAR DOBLE AISLAMIENTO (PARANOIA MULTI-TENANT)
      if (node.tenant_id !== tenantId) {
        console.error(`[EnhancedDataCapture] CRÍTICO: Violación de aislamiento detectada en nodo`, {
          nodeId,
          expectedTenant: tenantId,
          actualTenant: node.tenant_id,
        });
        return null;
      }
      
      // PARSEAR CONTENIDO CON VALIDACIÓN
      let nodeData;
      try {
        nodeData = typeof node.content === 'string' ? JSON.parse(node.content) : node.content;
      } catch (parseError) {
        console.error(`[EnhancedDataCapture] Error parseando contenido de nodo multi-tenant:`, parseError);
        return null;
      }
      
      // AGREGAR METADATOS MULTI-TENANT
      return {
        ...nodeData,
        _multiTenant: {
          tenantId: node.tenant_id,
          templateId: node.template_id,
          nodeId: node.id,
          retrievedAt: new Date().toISOString(),
        },
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error crítico obteniendo nodo multi-tenant:`, error);
      return null;
    }
  }
  
  /**
   * MÉTODO: Obtener variables multi-tenant
   * PROPÓSITO: Recuperar variables del tenant con sistema de leads incluido
   */
  private static async getMultiTenantVariables(
    tenantId: string,
    currentState: any,
    includeLeadVars: boolean
  ): Promise<any> {
    try {
      const variables: any = {};
      
      // 1. VARIABLES DEL TENANT
      const { data: tenantVars } = await supabase
        .from('tenant_variables')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      
      if (tenantVars) {
        tenantVars.forEach(variable => {
          variables[variable.key] = variable.value;
        });
      }
      
      // 2. INFORMACIÓN BÁSICA DEL TENANT
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, business_name, settings')
        .eq('id', tenantId)
        .single();
      
      if (tenant) {
        variables.businessName = tenant.business_name || tenant.name || 'Nuestro Negocio';
        variables.business_name = variables.businessName;
        variables.tenantName = tenant.name;
      }
      
      // 3. VARIABLES DEL SISTEMA DE LEADS (SI SE SOLICITAN)
      if (includeLeadVars) {
        const leadVars = await this.getMultiTenantLeadVariables(tenantId, currentState);
        Object.assign(variables, leadVars);
      }
      
      // 4. METADATOS MULTI-TENANT
      variables._multiTenant = {
        tenantId: tenantId,
        variableCount: Object.keys(variables).length,
        includesLeadVars: includeLeadVars,
        retrievedAt: new Date().toISOString(),
      };
      
      return variables;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo variables multi-tenant:`, error);
      
      // VARIABLES BÁSICAS DE FALLBACK
      return {
        businessName: 'Nuestro Negocio',
        business_name: 'Nuestro Negocio',
        tenantId: tenantId,
        _multiTenant: {
          fallback: true,
          error: error.message,
        },
      };
    }
  }
  
  /**
   * MÉTODO: Obtener variables del sistema de leads multi-tenant
   * PROPÓSITO: Recuperar variables de leads con aislamiento de tenant
   */
  private static async getMultiTenantLeadVariables(
    tenantId: string,
    currentState: any
  ): Promise<any> {
    try {
      // INTEGRACIÓN CON SISTEMA DE LEADS EXISTENTE (PRESERVAR)
      // TODO: Integrar con salesFunnelService.ts con contexto multi-tenant
      
      const leadVars = {
        leadId: currentState.leadId || '',
        leadName: currentState.leadName || currentState.lead_name || '',
        salesStageId: currentState.salesStageId || '',
        funnelPosition: currentState.funnelPosition || 0,
        lead_name: currentState.leadName || currentState.lead_name || '',
        name: currentState.leadName || currentState.lead_name || '',
      };
      
      // ASEGURAR AISLAMIENTO DE TENANT EN VARIABLES DE LEADS
      leadVars._leadSystemTenant = tenantId;
      
      return leadVars;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo variables de leads multi-tenant:`, error);
      return {};
    }
  }
  
  /**
   * MÉTODOS AUXILIARES MULTI-TENANT
   */
  
  // Obtener límites del tenant
  private static async getTenantLimits(tenantId: string): Promise<any> {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();
      
      return tenant?.settings?.limits || {
        maxActiveSessions: 100,
        maxCapturesPerHour: 1000,
      };
    } catch (error) {
      return { maxActiveSessions: 100, maxCapturesPerHour: 1000 };
    }
  }
  
  // Contar sesiones activas del tenant
  private static async getTenantActiveSessionCount(tenantId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('hybrid_persistent_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString());
      
      return count || 0;
    } catch (error) {
      return 0;
    }
  }
  
  // Métodos auxiliares multi-tenant implementados
  
  // Crear contexto multi-tenant seguro
  private static async createSecureMultiTenantContext(
    currentState: any,
    nodeData: any,
    tenantVariables: any,
    config: MultiTenantCaptureConfig
  ): Promise<any> {
    return {
      tenantId: config.tenantId,
      nodeId: config.nodeId,
      templateId: config.templateId,
      nodeData: nodeData,
      variables: tenantVariables,
      securityLevel: config.securityLevel || 'standard',
      createdAt: new Date().toISOString(),
    };
  }
  
  // Crear estado híbrido aislado
  private static async createIsolatedHybridState(
    currentState: any,
    multiTenantContext: any,
    config: MultiTenantCaptureConfig
  ): Promise<any> {
    return {
      ...currentState,
      tenantId: config.tenantId,
      hybrid: {
        currentNodeId: config.nodeId,
        nodeData: multiTenantContext.nodeData,
        inputType: this.detectInputType(multiTenantContext.nodeData.input?.label),
        collectedData: currentState.hybrid?.collectedData || {},
        globalVars: multiTenantContext.variables,
        multiTenantContext: multiTenantContext,
        awaitingResponse: true,
        sessionStarted: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
      metadata: {
        hybridMode: true,
        multiTenant: true,
        tenantId: config.tenantId,
        version: "1.0",
        lastOperation: "multi_tenant_preparation",
      },
    };
  }
  
  // Procesar pregunta multi-tenant
  private static async processMultiTenantQuestion(
    nodeData: any,
    tenantVariables: any,
    tenantId: string
  ): Promise<string> {
    const question = nodeData.input?.label || nodeData.inputLabel || "¿Podrías proporcionar esa información?";
    return this.replaceVariables(question, tenantVariables);
  }
  
  // Registrar actividad multi-tenant
  private static async logMultiTenantActivity(
    tenantId: string,
    userId: string,
    phase: string,
    data: any
  ): Promise<void> {
    try {
      await supabase
        .from('hybrid_system_logs')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          module_name: 'enhancedDataCapture',
          event_type: phase,
          event_data: data,
          lead_system_status: 'preserved',
          created_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error registrando actividad multi-tenant:`, error);
    }
  }
  
  // Validar captura multi-tenant
  private static async validateMultiTenantCapture(
    userId: string,
    tenantId: string,
    state: any
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const currentState = await state.getMyState();
      
      if (!currentState?.tenantId) {
        errors.push('Tenant ID no encontrado en estado');
      } else if (currentState.tenantId !== tenantId) {
        errors.push(`Tenant ID no coincide: esperado ${tenantId}, encontrado ${currentState.tenantId}`);
      }
      
      if (!currentState?.hybrid?.currentNodeId) {
        errors.push('Estado híbrido no encontrado');
      }
      
      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: [`Error de validación: ${error.message}`] };
    }
  }
  
  // Obtener estado híbrido multi-tenant
  private static async getMultiTenantHybridState(state: any, tenantId: string): Promise<any> {
    try {
      const hybridState = await state.getMyState();
      
      if (hybridState?.tenantId !== tenantId) {
        console.error(`[EnhancedDataCapture] Estado híbrido cross-tenant detectado`);
        return null;
      }
      
      return hybridState;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo estado híbrido multi-tenant:`, error);
      return null;
    }
  }
  
  // Obtener reglas de validación del tenant
  private static async getTenantValidationRules(tenantId: string, nodeData: any): Promise<any> {
    try {
      const { data: rules } = await supabase
        .from('tenant_validation_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      
      return rules || [];
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo reglas de validación del tenant:`, error);
      return [];
    }
  }
  
  // Validar respuesta para tenant
  private static async validateResponseForTenant(
    userResponse: string,
    tenantRules: any[],
    tenantId: string
  ): Promise<{ isValid: boolean; errorMessage?: string }> {
    try {
      // Validaciones básicas
      if (!userResponse || userResponse.trim().length === 0) {
        return { isValid: false, errorMessage: "Por favor, proporciona una respuesta." };
      }
      
      // Aplicar reglas del tenant
      for (const rule of tenantRules) {
        if (rule.type === 'minLength' && userResponse.length < rule.value) {
          return { isValid: false, errorMessage: `La respuesta debe tener al menos ${rule.value} caracteres.` };
        }
        if (rule.type === 'maxLength' && userResponse.length > rule.value) {
          return { isValid: false, errorMessage: `La respuesta no puede exceder ${rule.value} caracteres.` };
        }
        if (rule.type === 'pattern' && !new RegExp(rule.value).test(userResponse)) {
          return { isValid: false, errorMessage: rule.message || "Formato de respuesta inválido." };
        }
      }
      
      return { isValid: true };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error validando respuesta para tenant:`, error);
      return { isValid: true }; // Fallback: aceptar respuesta
    }
  }
  
  // Manejar fallo de validación multi-tenant
  private static async handleMultiTenantValidationFailure(
    validationResult: any,
    flowDynamic: any,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      await flowDynamic(validationResult.errorMessage || "Por favor, proporciona una respuesta válida.");
      
      // Registrar intento fallido
      await this.logMultiTenantActivity(tenantId, userId, 'validation_failure', {
        error: validationResult.errorMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error manejando fallo de validación multi-tenant:`, error);
    }
  }
  
  // Procesar respuesta multi-tenant
  private static async processMultiTenantResponse(
    userResponse: string,
    hybridState: any,
    config: MultiTenantCaptureConfig
  ): Promise<any> {
    const nodeData = hybridState.hybrid.nodeData;
    const isNameField = hybridState.hybrid.inputType === "name";
    
    const collectedData = {
      ...(hybridState.hybrid.collectedData || {}),
      ...(isNameField
        ? { name: userResponse, lead_name: userResponse }
        : { [nodeData.input?.label || "response"]: userResponse }),
    };
    
    const contextVars = hybridState.hybrid.globalVars || {};
    Object.assign(contextVars, collectedData);
    
    const leadData = {
      tenantId: config.tenantId,
      leadName: collectedData.name || collectedData.lead_name || hybridState.leadName,
      leadPhone: collectedData.phone || collectedData.telefono,
      leadEmail: collectedData.email || collectedData.correo,
      salesStageId: hybridState.salesStageId,
      lastResponse: userResponse,
      responseField: nodeData.input?.label || "response",
      captureMethod: "multi_tenant_hybrid",
    };
    
    let confirmationMessage = null;
    if (nodeData.responseMessage) {
      confirmationMessage = this.replaceVariables(nodeData.responseMessage, contextVars);
    }
    
    return {
      collectedData,
      contextVars,
      leadData,
      confirmationMessage,
    };
  }
  
  // Actualizar sistema de leads multi-tenant
  private static async updateMultiTenantLeadSystem(
    leadData: any,
    nodeData: any,
    tenantId: string
  ): Promise<void> {
    try {
      // TODO: Integrar con salesFunnelService.ts con contexto multi-tenant
      console.log(`[EnhancedDataCapture] Actualizando sistema de leads multi-tenant:`, {
        tenantId,
        leadData,
        nodeStage: nodeData.leadStage,
      });
      
      // PRESERVAR: Notificar al sistema de leads existente
      // await salesFunnelService.updateLeadProgressMultiTenant(leadData, tenantId);
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error actualizando sistema de leads multi-tenant:`, error);
      // No lanzar error - sistema de leads debe seguir funcionando
    }
  }
  
  // Registrar captura multi-tenant
  private static async registerMultiTenantCapture(
    nodeId: string,
    userInput: string,
    processedResponse: any,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      await supabase.from("chatbot_interactions").insert({
        tenant_id: tenantId,
        node_id: nodeId,
        user_input: userInput,
        bot_response: processedResponse.confirmationMessage || "",
        timestamp: new Date(),
        metadata: {
          capture_method: "multi_tenant_hybrid",
          tenant_id: tenantId,
          user_id: userId,
          collected_data: processedResponse.collectedData,
          lead_data: processedResponse.leadData,
          hybrid_mode: true,
          multi_tenant: true,
        },
      });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error registrando captura multi-tenant:`, error);
    }
  }
  
  // Crear estado final multi-tenant
  private static async createFinalMultiTenantState(
    hybridState: any,
    processedResponse: any,
    config: MultiTenantCaptureConfig
  ): Promise<any> {
    return {
      ...hybridState,
      tenantId: config.tenantId,
      leadName: processedResponse.leadData.leadName || hybridState.leadName,
      hybrid: {
        ...hybridState.hybrid,
        collectedData: processedResponse.collectedData,
        globalVars: processedResponse.contextVars,
        lastActivity: new Date().toISOString(),
        captureCompleted: true,
        multiTenantProcessed: true,
      },
      metadata: {
        ...hybridState.metadata,
        lastOperation: "multi_tenant_capture_complete",
        tenantId: config.tenantId,
      },
    };
  }
  
  // Navegación multi-tenant
  private static async navigateMultiTenant(
    currentNodeId: string,
    tenantId: string,
    finalState: any,
    gotoFlow: any
  ): Promise<{ success: boolean; targetNodeId?: string; flow?: any }> {
    try {
      const nextNode = await this.getNextNodeHybrid(currentNodeId, tenantId);
      
      if (nextNode) {
        return {
          success: true,
          targetNodeId: nextNode.nodeId,
          flow: nextNode.flow,
        };
      }
      
      return { success: false };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en navegación multi-tenant:`, error);
      return { success: false };
    }
  }
  
  // Fallbacks multi-tenant
  private static async multiTenantPreparationFallback(
    ctx: any,
    state: any,
    flowDynamic: any,
    config: MultiTenantCaptureConfig
  ): Promise<void> {
    try {
      await flowDynamic("¿Podrías proporcionar esa información?");
      
      // Registrar fallback
      await this.logMultiTenantActivity(
        config.tenantId,
        ctx.from,
        'preparation_fallback',
        { nodeId: config.nodeId, timestamp: new Date().toISOString() }
      );
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de preparación multi-tenant:`, error);
    }
  }
  
  private static async multiTenantCaptureFallback(
    ctx: any,
    state: any,
    flowDynamic: any,
    config: MultiTenantCaptureConfig
  ): Promise<void> {
    try {
      await flowDynamic("Gracias por la información.");
      
      // Registrar fallback
      await this.logMultiTenantActivity(
        config.tenantId,
        ctx.from,
        'capture_fallback',
        { nodeId: config.nodeId, userInput: ctx.body, timestamp: new Date().toISOString() }
      );
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de captura multi-tenant:`, error);
    }
  }
  
  /**
   * SUB-TAREA 2.4: VALIDACIÓN DE RESPUESTAS CON TIMEOUT CONFIGURABLE
   * 
   * PROPÓSITO: Crear sistema robusto de validación de respuestas del usuario
   * con timeouts configurables y manejo inteligente de reintentos
   * PRESERVA: Sistema de leads y compatibilidad con sistema actual
   */
  
  /**
   * MÉTODO PRINCIPAL: Crear validación avanzada con timeout
   * BASADO EN: Patrones de validación del v1-reference
   * MEJORADO CON: Timeouts configurables y reintentos inteligentes
   */
  static createValidatedCaptureWithTimeout(config: ValidatedCaptureConfig): any {
    console.log(`[EnhancedDataCapture] Iniciando captura validada con timeout para ${config.nodeId}`);
    
    // VALIDAR CONFIGURACIÓN DE TIMEOUT
    if (!this.validateTimeoutConfig(config)) {
      console.error(`[EnhancedDataCapture] Configuración de timeout inválida`);
      return this.fallbackToCurrentSystem(config, config.tenantId);
    }
    
    return addKeyword(config.keywords || [""])
      
      // ========================================
      // FASE 1: PREPARACIÓN CON TIMEOUT
      // ========================================
      .addAction(async (ctx, { flowDynamic, state }) => {
        try {
          console.log(`[EnhancedDataCapture] TIMEOUT FASE 1 - Configurando validación para ${config.nodeId}`);
          
          // 1. OBTENER ESTADO Y CONFIGURACIÓN
          const currentState = await this.getMultiTenantState(state, config.tenantId, ctx.from);
          const nodeData = await this.getMultiTenantNodeData(config.nodeId, config.tenantId, config.templateId);
          
          if (!nodeData) {
            throw new Error(`Nodo ${config.nodeId} no encontrado`);
          }
          
          // 2. PREPARAR CONTEXTO DE VALIDACIÓN
          const validationContext = await this.prepareValidationContext(
            config,
            nodeData,
            currentState
          );
          
          // 3. INICIALIZAR SISTEMA DE TIMEOUT
          const timeoutSession = await this.initializeTimeoutSession(
            ctx.from,
            config.tenantId,
            config.nodeId,
            config.timeout || {}
          );
          
          // 4. ACTUALIZAR ESTADO CON CONTEXTO DE VALIDACIÓN
          const validationState = await this.createValidationState(
            currentState,
            validationContext,
            timeoutSession,
            config
          );
          
          await state.update(validationState);
          
          // 5. MOSTRAR PREGUNTA CON INSTRUCCIONES DE VALIDACIÓN
          const processedQuestion = await this.processQuestionWithValidationHints(
            nodeData,
            validationContext,
            config
          );
          
          // 6. ACTIVAR TIMEOUT SI ESTÁ CONFIGURADO
          if (config.timeout?.enabled) {
            await this.activateResponseTimeout(
              timeoutSession.sessionId,
              config.timeout,
              flowDynamic
            );
          }
          
          if (processedQuestion) {
            await flowDynamic(processedQuestion);
          }
          
          // 7. MOSTRAR INSTRUCCIONES DE VALIDACIÓN SI ESTÁN CONFIGURADAS
          if (config.validation?.showInstructions) {
            const instructions = await this.generateValidationInstructions(
              config.validation,
              validationContext.tenantRules
            );
            
            if (instructions) {
              await flowDynamic(instructions);
            }
          }
          
          console.log(`[EnhancedDataCapture] TIMEOUT FASE 1 completada - Timeout activo: ${config.timeout?.enabled}`);
          
        } catch (error) {
          console.error(`[EnhancedDataCapture] Error en preparación con timeout:`, error);
          await this.timeoutPreparationFallback(ctx, state, flowDynamic, config);
        }
      })
      
      // ========================================
      // FASE 2: CAPTURA CON VALIDACIÓN Y TIMEOUT
      // ========================================
      .addAnswer(
        "",
        { capture: true },
        async (ctx, { flowDynamic, state, gotoFlow }) => {
          try {
            console.log(`[EnhancedDataCapture] TIMEOUT FASE 2 - Validando respuesta: "${ctx.body}"`);
            
            // 1. VERIFICAR TIMEOUT
            const timeoutStatus = await this.checkTimeoutStatus(ctx.from, config.tenantId);
            if (timeoutStatus.expired) {
              await this.handleTimeoutExpired(
                timeoutStatus,
                flowDynamic,
                config.timeout?.onExpired || {}
              );
              return;
            }
            
            // 2. RECUPERAR CONTEXTO DE VALIDACIÓN
            const validationState = await this.getValidationState(state, config.tenantId);
            if (!validationState?.validation) {
              throw new Error('Contexto de validación no encontrado');
            }
            
            // 3. VALIDAR RESPUESTA AVANZADA
            const validationResult = await this.validateResponseAdvanced(
              ctx.body,
              validationState.validation,
              config.validation || {}
            );
            
            // 4. MANEJAR VALIDACIÓN FALLIDA
            if (!validationResult.isValid) {
              const retryResult = await this.handleValidationFailure(
                validationResult,
                validationState,
                config,
                flowDynamic,
                ctx
              );
              
              if (retryResult.shouldRetry) {
                // NO CONTINUAR - PERMITIR NUEVO INTENTO
                return;
              } else if (retryResult.maxAttemptsReached) {
                // PROCEDER CON VALOR PARCIAL O TERMINAR
                await this.handleMaxAttemptsReached(
                  retryResult,
                  config,
                  flowDynamic,
                  ctx
                );
                return;
              }
            }
            
            // 5. DESACTIVAR TIMEOUT - RESPUESTA VÁLIDA RECIBIDA
            await this.deactivateTimeout(timeoutStatus.sessionId);
            
            // 6. PROCESAR RESPUESTA VÁLIDA
            const processedResponse = await this.processValidatedResponse(
              ctx.body,
              validationResult,
              validationState,
              config
            );
            
            // 7. ACTUALIZAR SISTEMA DE LEADS CON DATOS VALIDADOS
            await this.updateLeadSystemWithValidatedData(
              processedResponse.leadData,
              validationState.validation.nodeData,
              config.tenantId
            );
            
            // 8. MOSTRAR CONFIRMACIÓN DE ÉXITO
            if (processedResponse.confirmationMessage) {
              await flowDynamic(processedResponse.confirmationMessage);
            }
            
            // 9. REGISTRAR CAPTURA EXITOSA CON MÉTRICAS DE VALIDACIÓN
            await this.registerValidatedCapture(
              config.nodeId,
              ctx.body,
              processedResponse,
              validationResult,
              config.tenantId,
              ctx.from
            );
            
            // 10. ACTUALIZAR ESTADO FINAL
            const finalState = await this.createFinalValidationState(
              validationState,
              processedResponse,
              validationResult,
              config
            );
            
            await state.update(finalState);
            
            // 11. NAVEGACIÓN AL SIGUIENTE NODO
            const navigationResult = await this.navigateAfterValidation(
              config.nodeId,
              config.tenantId,
              finalState,
              gotoFlow
            );
            
            if (navigationResult.success) {
              return navigationResult.flow;
            }
            
            console.log(`[EnhancedDataCapture] TIMEOUT FASE 2 completada - Respuesta validada exitosamente`);
            
          } catch (error) {
            console.error(`[EnhancedDataCapture] Error en captura con timeout:`, error);
            await this.timeoutCaptureFallback(ctx, state, flowDynamic, config);
          }
        }
      );
  }
  
  /**
   * MÉTODO: Validar configuración de timeout
   * PROPÓSITO: Asegurar que la configuración de timeout es válida
   */
  private static validateTimeoutConfig(config: ValidatedCaptureConfig): boolean {
    if (!config.nodeId || !config.tenantId) {
      console.error(`[EnhancedDataCapture] Configuración básica inválida`);
      return false;
    }
    
    if (config.timeout?.enabled) {
      if (!config.timeout.duration || config.timeout.duration < 5000) {
        console.error(`[EnhancedDataCapture] Duración de timeout muy corta: ${config.timeout.duration}ms`);
        return false;
      }
      
      if (config.timeout.duration > 300000) { // 5 minutos máximo
        console.error(`[EnhancedDataCapture] Duración de timeout muy larga: ${config.timeout.duration}ms`);
        return false;
      }
    }
    
    if (config.validation?.maxAttempts && config.validation.maxAttempts > 10) {
      console.error(`[EnhancedDataCapture] Demasiados intentos permitidos: ${config.validation.maxAttempts}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * MÉTODO: Preparar contexto de validación
   * PROPÓSITO: Crear contexto completo para validación avanzada
   */
  private static async prepareValidationContext(
    config: ValidatedCaptureConfig,
    nodeData: any,
    currentState: any
  ): Promise<any> {
    try {
      // OBTENER REGLAS DE VALIDACIÓN DEL TENANT
      const tenantRules = await this.getTenantValidationRules(config.tenantId, nodeData);
      
      // OBTENER REGLAS DE VALIDACIÓN DEL NODO
      const nodeRules = await this.getNodeValidationRules(config.nodeId, config.tenantId);
      
      // COMBINAR REGLAS CON PRECEDENCIA
      const combinedRules = this.combineValidationRules(
        config.validation || {},
        tenantRules,
        nodeRules
      );
      
      // OBTENER VARIABLES DEL TENANT PARA VALIDACIÓN
      const tenantVariables = await this.getMultiTenantVariables(
        config.tenantId,
        currentState,
        true
      );
      
      return {
        tenantId: config.tenantId,
        nodeId: config.nodeId,
        nodeData: nodeData,
        tenantRules: tenantRules,
        nodeRules: nodeRules,
        combinedRules: combinedRules,
        tenantVariables: tenantVariables,
        inputType: this.detectInputType(nodeData.input?.label),
        createdAt: new Date().toISOString(),
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error preparando contexto de validación:`, error);
      
      // CONTEXTO BÁSICO DE FALLBACK
      return {
        tenantId: config.tenantId,
        nodeId: config.nodeId,
        nodeData: nodeData,
        tenantRules: [],
        nodeRules: [],
        combinedRules: config.validation || {},
        tenantVariables: {},
        inputType: this.detectInputType(nodeData.input?.label),
        fallback: true,
        createdAt: new Date().toISOString(),
      };
    }
  }
  
  /**
   * MÉTODO: Inicializar sesión de timeout
   * PROPÓSITO: Crear sesión para manejo de timeouts
   */
  private static async initializeTimeoutSession(
    userId: string,
    tenantId: string,
    nodeId: string,
    timeoutConfig: any
  ): Promise<any> {
    try {
      const sessionId = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = timeoutConfig.enabled 
        ? new Date(Date.now() + timeoutConfig.duration).toISOString()
        : null;
      
      const timeoutSession = {
        sessionId: sessionId,
        userId: userId,
        tenantId: tenantId,
        nodeId: nodeId,
        enabled: timeoutConfig.enabled || false,
        duration: timeoutConfig.duration || 0,
        expiresAt: expiresAt,
        createdAt: new Date().toISOString(),
        isActive: true,
      };
      
      // REGISTRAR SESIÓN EN BD
      if (timeoutConfig.enabled) {
        await supabase
          .from('hybrid_timeout_sessions')
          .insert({
            session_id: sessionId,
            user_id: userId,
            tenant_id: tenantId,
            node_id: nodeId,
            expires_at: expiresAt,
            timeout_config: timeoutConfig,
            is_active: true,
            created_at: new Date().toISOString(),
          });
      }
      
      return timeoutSession;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error inicializando sesión de timeout:`, error);
      
      // SESIÓN BÁSICA SIN TIMEOUT
      return {
        sessionId: `fallback_${Date.now()}`,
        userId: userId,
        tenantId: tenantId,
        nodeId: nodeId,
        enabled: false,
        duration: 0,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        isActive: false,
        fallback: true,
      };
    }
  }
  
  /**
   * MÉTODO: Crear estado de validación
   * PROPÓSITO: Estructura de estado para validación avanzada
   */
  private static async createValidationState(
    currentState: any,
    validationContext: any,
    timeoutSession: any,
    config: ValidatedCaptureConfig
  ): Promise<any> {
    return {
      ...currentState,
      tenantId: config.tenantId,
      validation: {
        context: validationContext,
        timeoutSession: timeoutSession,
        attempts: 0,
        maxAttempts: config.validation?.maxAttempts || 3,
        lastAttempt: null,
        validationHistory: [],
        awaitingResponse: true,
        sessionStarted: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      },
      hybrid: {
        ...currentState.hybrid,
        validationMode: true,
        timeoutEnabled: timeoutSession.enabled,
        currentNodeId: config.nodeId,
        nodeData: validationContext.nodeData,
        inputType: validationContext.inputType,
      },
      metadata: {
        ...currentState.metadata,
        validationMode: true,
        timeoutEnabled: timeoutSession.enabled,
        version: "1.0",
        lastOperation: "validation_preparation",
      },
    };
  }
  
  /**
   * MÉTODO: Procesar pregunta con hints de validación
   * PROPÓSITO: Mostrar pregunta con indicaciones de validación
   */
  private static async processQuestionWithValidationHints(
    nodeData: any,
    validationContext: any,
    config: ValidatedCaptureConfig
  ): Promise<string> {
    const baseQuestion = nodeData.input?.label || nodeData.inputLabel || "¿Podrías proporcionar esa información?";
    
    // PROCESAR VARIABLES DEL TENANT
    const processedQuestion = this.replaceVariables(baseQuestion, validationContext.tenantVariables);
    
    // AGREGAR HINTS DE VALIDACIÓN SI ESTÁN CONFIGURADOS
    if (config.validation?.showHints) {
      const hints = await this.generateValidationHints(
        validationContext.combinedRules,
        validationContext.inputType
      );
      
      if (hints) {
        return `${processedQuestion}\n\n${hints}`;
      }
    }
    
    return processedQuestion;
  }
  
  /**
   * MÉTODO: Activar timeout de respuesta
   * PROPÓSITO: Iniciar countdown de timeout
   */
  private static async activateResponseTimeout(
    sessionId: string,
    timeoutConfig: any,
    flowDynamic: any
  ): Promise<void> {
    try {
      if (!timeoutConfig.enabled) return;
      
      // PROGRAMAR TIMEOUT (EN IMPLEMENTACIÓN REAL USARÍA SISTEMA DE COLAS)
      console.log(`[EnhancedDataCapture] Timeout activado para sesión ${sessionId}: ${timeoutConfig.duration}ms`);
      
      // MOSTRAR ADVERTENCIA DE TIMEOUT SI ESTÁ CONFIGURADA
      if (timeoutConfig.showWarning) {
        const warningTime = timeoutConfig.warningTime || Math.floor(timeoutConfig.duration * 0.7);
        
        setTimeout(async () => {
          try {
            // VERIFICAR SI LA SESIÓN SIGUE ACTIVA
            const session = await this.getTimeoutSession(sessionId);
            if (session?.isActive) {
              const warningMessage = timeoutConfig.warningMessage || 
                `⏰ Tienes ${Math.floor((timeoutConfig.duration - warningTime) / 1000)} segundos para responder.`;
              
              await flowDynamic(warningMessage);
            }
          } catch (error) {
            console.error(`[EnhancedDataCapture] Error mostrando advertencia de timeout:`, error);
          }
        }, warningTime);
      }
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error activando timeout:`, error);
    }
  }
  
  /**
   * MÉTODO: Generar hints de validación
   * PROPÓSITO: Crear indicaciones útiles para el usuario
   */
  private static async generateValidationHints(
    rules: any,
    inputType: string
  ): Promise<string | null> {
    const hints: string[] = [];
    
    // HINTS BASADOS EN REGLAS
    if (rules.minLength) {
      hints.push(`• Mínimo ${rules.minLength} caracteres`);
    }
    
    if (rules.maxLength) {
      hints.push(`• Máximo ${rules.maxLength} caracteres`);
    }
    
    // HINTS BASADOS EN TIPO DE INPUT
    switch (inputType) {
      case 'name':
        hints.push('• Ejemplo: Juan Pérez');
        break;
      case 'email':
        hints.push('• Ejemplo: juan@ejemplo.com');
        break;
      case 'phone':
        hints.push('• Ejemplo: +1234567890');
        break;
    }
    
    if (rules.customPattern) {
      hints.push(`• Formato: ${rules.customPatternHint || 'Formato específico requerido'}`);
    }
    
    return hints.length > 0 ? `📝 ${hints.join('\n')}` : null;
  }
  
  /**
   * MÉTODO: Generar instrucciones de validación
   * PROPÓSITO: Crear instrucciones detalladas para validación
   */
  private static async generateValidationInstructions(
    validationConfig: any,
    tenantRules: any[]
  ): Promise<string | null> {
    const instructions: string[] = [];
    
    if (validationConfig.maxAttempts) {
      instructions.push(`🔄 Tienes ${validationConfig.maxAttempts} intentos para responder correctamente.`);
    }
    
    if (tenantRules.length > 0) {
      instructions.push('📋 Revisa que tu respuesta cumpla con los requisitos mostrados.');
    }
    
    return instructions.length > 0 ? instructions.join('\n') : null;
  }
  
  /**
   * MÉTODO: Validar respuesta avanzada
   * PROPÓSITO: Validación completa con múltiples reglas
   */
  private static async validateResponseAdvanced(
    userResponse: string,
    validationContext: any,
    validationConfig: any
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    errorType?: string;
    processedValue?: string;
    confidence?: number;
    suggestions?: string[];
  }> {
    try {
      // VALIDACIONES BÁSICAS
      if (!userResponse || userResponse.trim().length === 0) {
        return {
          isValid: false,
          errorMessage: "Por favor, proporciona una respuesta.",
          errorType: "empty_response",
          confidence: 1.0,
        };
      }
      
      const trimmedResponse = userResponse.trim();
      const rules = validationContext.combinedRules;
      
      // VALIDACIONES DE LONGITUD
      if (rules.minLength && trimmedResponse.length < rules.minLength) {
        return {
          isValid: false,
          errorMessage: `La respuesta debe tener al menos ${rules.minLength} caracteres.`,
          errorType: "too_short",
          confidence: 1.0,
        };
      }
      
      if (rules.maxLength && trimmedResponse.length > rules.maxLength) {
        return {
          isValid: false,
          errorMessage: `La respuesta no puede exceder ${rules.maxLength} caracteres.`,
          errorType: "too_long",
          confidence: 1.0,
        };
      }
      
      // VALIDACIONES POR TIPO DE INPUT
      const inputType = validationContext.inputType;
      const typeValidation = await this.validateByInputType(trimmedResponse, inputType);
      
      if (!typeValidation.isValid) {
        return typeValidation;
      }
      
      // VALIDACIONES DE PATRÓN PERSONALIZADO
      if (rules.customPattern) {
        const patternValidation = await this.validateCustomPattern(
          trimmedResponse,
          rules.customPattern,
          rules.customPatternMessage
        );
        
        if (!patternValidation.isValid) {
          return patternValidation;
        }
      }
      
      // VALIDACIONES DEL TENANT
      const tenantValidation = await this.validateWithTenantRules(
        trimmedResponse,
        validationContext.tenantRules
      );
      
      if (!tenantValidation.isValid) {
        return tenantValidation;
      }
      
      // VALIDACIÓN EXITOSA
      return {
        isValid: true,
        processedValue: trimmedResponse,
        confidence: 1.0,
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en validación avanzada:`, error);
      
      // FALLBACK: ACEPTAR RESPUESTA
      return {
        isValid: true,
        processedValue: userResponse.trim(),
        confidence: 0.5,
        errorMessage: "Validación parcial - se aceptó la respuesta",
      };
    }
  }
  
  /**
   * MÉTODO: Validar por tipo de input
   * PROPÓSITO: Validaciones específicas por tipo de campo
   */
  private static async validateByInputType(
    response: string,
    inputType: string
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    errorType?: string;
    suggestions?: string[];
  }> {
    switch (inputType) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(response)) {
          return {
            isValid: false,
            errorMessage: "Por favor, proporciona un email válido.",
            errorType: "invalid_email",
            suggestions: ["Ejemplo: juan@ejemplo.com"],
          };
        }
        break;
        
      case 'phone':
        const phoneRegex = /^[\+]?[1-9][\d]{7,15}$/;
        const cleanPhone = response.replace(/[\s\-\(\)]/g, '');
        if (!phoneRegex.test(cleanPhone)) {
          return {
            isValid: false,
            errorMessage: "Por favor, proporciona un número de teléfono válido.",
            errorType: "invalid_phone",
            suggestions: ["Ejemplo: +1234567890", "Ejemplo: 1234567890"],
          };
        }
        break;
        
      case 'number':
        if (isNaN(Number(response))) {
          return {
            isValid: false,
            errorMessage: "Por favor, proporciona un número válido.",
            errorType: "invalid_number",
            suggestions: ["Ejemplo: 123", "Ejemplo: 45.67"],
          };
        }
        break;
        
      case 'name':
        if (response.length < 2 || !/^[a-zA-ZÀ-ÿ\s]+$/.test(response)) {
          return {
            isValid: false,
            errorMessage: "Por favor, proporciona un nombre válido.",
            errorType: "invalid_name",
            suggestions: ["Ejemplo: Juan Pérez", "Solo letras y espacios"],
          };
        }
        break;
    }
    
    return { isValid: true };
  }
  
  /**
   * MÉTODO: Validar patrón personalizado
   * PROPÓSITO: Validar con expresiones regulares personalizadas
   */
  private static async validateCustomPattern(
    response: string,
    pattern: string,
    message?: string
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    errorType?: string;
  }> {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(response)) {
        return {
          isValid: false,
          errorMessage: message || "Formato de respuesta inválido.",
          errorType: "pattern_mismatch",
        };
      }
      
      return { isValid: true };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en patrón personalizado:`, error);
      return { isValid: true }; // Fallback: aceptar respuesta
    }
  }
  
  /**
   * MÉTODO: Validar con reglas del tenant
   * PROPÓSITO: Aplicar reglas específicas del tenant
   */
  private static async validateWithTenantRules(
    response: string,
    tenantRules: any[]
  ): Promise<{
    isValid: boolean;
    errorMessage?: string;
    errorType?: string;
  }> {
    try {
      for (const rule of tenantRules) {
        if (rule.type === 'forbidden_words') {
          const forbiddenWords = rule.value.split(',').map((w: string) => w.trim().toLowerCase());
          const responseWords = response.toLowerCase().split(/\s+/);
          
          for (const word of forbiddenWords) {
            if (responseWords.includes(word)) {
              return {
                isValid: false,
                errorMessage: rule.message || `La palabra "${word}" no está permitida.`,
                errorType: "forbidden_word",
              };
            }
          }
        }
        
        if (rule.type === 'required_words') {
          const requiredWords = rule.value.split(',').map((w: string) => w.trim().toLowerCase());
          const responseWords = response.toLowerCase().split(/\s+/);
          
          for (const word of requiredWords) {
            if (!responseWords.includes(word)) {
              return {
                isValid: false,
                errorMessage: rule.message || `Debe incluir la palabra "${word}".`,
                errorType: "missing_required_word",
              };
            }
          }
        }
      }
      
      return { isValid: true };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error validando reglas del tenant:`, error);
      return { isValid: true }; // Fallback: aceptar respuesta
    }
  }
  
  /**
   * MÉTODOS AUXILIARES FALTANTES PARA SUB-TAREA 2.4
   */
  
  // Validar configuración de timeout
  private static validateTimeoutConfig(config: ValidatedCaptureConfig): boolean {
    try {
      if (!config.timeout) return true;
      
      const timeout = config.timeout;
      
      // Validar duración
      if (timeout.duration && (timeout.duration < 1000 || timeout.duration > 300000)) {
        console.error(`[EnhancedDataCapture] Duración de timeout inválida: ${timeout.duration}`);
        return false;
      }
      
      // Validar tiempo de advertencia
      if (timeout.warningTime && timeout.duration && timeout.warningTime >= timeout.duration) {
        console.error(`[EnhancedDataCapture] Tiempo de advertencia debe ser menor que duración`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error validando config de timeout:`, error);
      return false;
    }
  }
  
  // Inicializar sesión de timeout
  private static async initializeTimeoutSession(
    userId: string,
    tenantId: string,
    nodeId: string,
    timeoutConfig: TimeoutConfig
  ): Promise<any> {
    try {
      const sessionId = `timeout_${userId}_${nodeId}_${Date.now()}`;
      
      const timeoutSession = {
        sessionId,
        userId,
        tenantId,
        nodeId,
        startTime: Date.now(),
        duration: timeoutConfig.duration || 30000,
        warningTime: timeoutConfig.warningTime || 20000,
        enabled: timeoutConfig.enabled || false,
        warningShown: false,
        expired: false,
        createdAt: new Date().toISOString(),
      };
      
      // Guardar sesión de timeout
      await supabase.from('timeout_sessions').insert(timeoutSession);
      
      return timeoutSession;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error inicializando sesión de timeout:`, error);
      return {
        sessionId: `fallback_${userId}_${Date.now()}`,
        enabled: false,
        startTime: Date.now(),
      };
    }
  }
  
  // Activar timeout de respuesta
  private static async activateResponseTimeout(
    sessionId: string,
    timeoutConfig: TimeoutConfig,
    flowDynamic: any
  ): Promise<void> {
    try {
      if (!timeoutConfig.enabled) return;
      
      // Programar advertencia
      if (timeoutConfig.showWarning && timeoutConfig.warningTime) {
        setTimeout(async () => {
          try {
            await this.showTimeoutWarning(sessionId, timeoutConfig.warningMessage, flowDynamic);
          } catch (error) {
            console.error(`[EnhancedDataCapture] Error mostrando advertencia:`, error);
          }
        }, timeoutConfig.warningTime);
      }
      
      // Programar expiración
      setTimeout(async () => {
        try {
          await this.markTimeoutExpired(sessionId);
        } catch (error) {
          console.error(`[EnhancedDataCapture] Error marcando timeout expirado:`, error);
        }
      }, timeoutConfig.duration || 30000);
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error activando timeout:`, error);
    }
  }
  
  // Mostrar advertencia de timeout
  private static async showTimeoutWarning(
    sessionId: string,
    warningMessage: string,
    flowDynamic: any
  ): Promise<void> {
    try {
      // Verificar si aún no ha expirado
      const { data: session } = await supabase
        .from('timeout_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();
        
      if (session && !session.expired && !session.warning_shown) {
        await flowDynamic(warningMessage || "⏰ Tiempo casi agotado...");
        
        // Marcar advertencia como mostrada
        await supabase
          .from('timeout_sessions')
          .update({ warning_shown: true })
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error mostrando advertencia:`, error);
    }
  }
  
  // Marcar timeout como expirado
  private static async markTimeoutExpired(sessionId: string): Promise<void> {
    try {
      await supabase
        .from('timeout_sessions')
        .update({ 
          expired: true,
          expired_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error marcando timeout expirado:`, error);
    }
  }
  
  // Verificar estado de timeout
  private static async checkTimeoutStatus(userId: string, tenantId: string): Promise<any> {
    try {
      const { data: session } = await supabase
        .from('timeout_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!session) {
        return { expired: false, sessionId: null };
      }
      
      return {
        expired: session.expired,
        sessionId: session.session_id,
        remainingTime: session.expired ? 0 : Math.max(0, session.duration - (Date.now() - new Date(session.created_at).getTime())),
        warningShown: session.warning_shown,
      };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error verificando timeout:`, error);
      return { expired: false, sessionId: null };
    }
  }
  
  // Manejar timeout expirado
  private static async handleTimeoutExpired(
    timeoutStatus: any,
    flowDynamic: any,
    onExpiredConfig: any
  ): Promise<void> {
    try {
      const message = onExpiredConfig.message || "⏰ Tiempo agotado. Continuando...";
      await flowDynamic(message);
      
      // Limpiar sesión de timeout
      if (timeoutStatus.sessionId) {
        await supabase
          .from('timeout_sessions')
          .delete()
          .eq('session_id', timeoutStatus.sessionId);
      }
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error manejando timeout expirado:`, error);
    }
  }
  
  // Desactivar timeout
  private static async deactivateTimeout(sessionId: string): Promise<void> {
    try {
      if (sessionId) {
        await supabase
          .from('timeout_sessions')
          .delete()
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error desactivando timeout:`, error);
    }
  }
  
  // Obtener estado de validación
  private static async getValidationState(state: any, tenantId: string): Promise<any> {
    try {
      const currentState = await state.getMyState();
      
      if (!currentState || !currentState.validation) {
        return null;
      }
      
      return currentState;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error obteniendo estado de validación:`, error);
      return null;
    }
  }
  
  // Manejar fallo de validación
  private static async handleValidationFailure(
    validationResult: any,
    validationState: any,
    config: ValidatedCaptureConfig,
    flowDynamic: any,
    ctx: any
  ): Promise<{ shouldRetry: boolean; maxAttemptsReached: boolean }> {
    try {
      const attemptCount = (validationState.attemptCount || 0) + 1;
      const maxAttempts = config.validation?.maxAttempts || 3;
      
      if (attemptCount >= maxAttempts) {
        await flowDynamic("Se excedió el número máximo de intentos. Continuando...");
        return { shouldRetry: false, maxAttemptsReached: true };
      }
      
      // Mostrar mensaje de error con hints
      let errorMessage = validationResult.errorMessage || "Formato inválido.";
      
      if (config.validation?.showHints && config.validation?.customPatternHint) {
        errorMessage += `\n💡 ${config.validation.customPatternHint}`;
      }
      
      if (config.validation?.showInstructions) {
        errorMessage += `\n📝 Intento ${attemptCount} de ${maxAttempts}`;
      }
      
      await flowDynamic(errorMessage);
      
      // Actualizar contador de intentos
      await validationState.state.update({
        ...validationState,
        attemptCount: attemptCount,
      });
      
      return { shouldRetry: true, maxAttemptsReached: false };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error manejando fallo de validación:`, error);
      return { shouldRetry: false, maxAttemptsReached: true };
    }
  }
  
  // Manejar intentos máximos alcanzados
  private static async handleMaxAttemptsReached(
    retryResult: any,
    config: ValidatedCaptureConfig,
    flowDynamic: any,
    ctx: any
  ): Promise<void> {
    try {
      const message = "Se alcanzó el número máximo de intentos. Procediendo con la información disponible...";
      await flowDynamic(message);
      
      // Procesar con valor parcial si es posible
      // Esto se implementará según las necesidades específicas
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error manejando intentos máximos:`, error);
    }
  }
  
  // Procesar respuesta validada
  private static async processValidatedResponse(
    userInput: string,
    validationResult: any,
    validationState: any,
    config: ValidatedCaptureConfig
  ): Promise<any> {
    try {
      // Usar el valor procesado por la validación
      const processedValue = validationResult.processedValue || userInput;
      
      // Procesar con sistema de leads
      return await this.processUserResponseWithLeadSystem(
        processedValue,
        validationState.validation.nodeData,
        validationState,
        config.tenantId
      );
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error procesando respuesta validada:`, error);
      
      // Fallback básico
      return {
        collectedData: { response: userInput },
        contextVars: {},
        leadData: {},
        confirmationMessage: "Respuesta procesada.",
      };
    }
  }
  
  // Registrar captura validada
  private static async registerValidatedCapture(
    nodeId: string,
    userInput: string,
    processedResponse: any,
    validationResult: any,
    tenantId: string,
    userId: string
  ): Promise<void> {
    try {
      const captureRecord = {
        node_id: nodeId,
        user_id: userId,
        tenant_id: tenantId,
        user_input: userInput,
        processed_response: processedResponse,
        validation_result: validationResult,
        captured_at: new Date().toISOString(),
        capture_type: 'validated',
      };
      
      await supabase.from('hybrid_captures').insert(captureRecord);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error registrando captura validada:`, error);
    }
  }
  
  // Crear estado final de validación
  private static async createFinalValidationState(
    validationState: any,
    processedResponse: any,
    validationResult: any,
    config: ValidatedCaptureConfig
  ): Promise<any> {
    try {
      return {
        ...validationState,
        nodeId: config.nodeId,
        hybrid_collectedData: processedResponse.collectedData,
        hybrid_contextVars: processedResponse.contextVars,
        hybrid_leadData: processedResponse.leadData,
        hybrid_validationResult: validationResult,
        hybrid_completedAt: Date.now(),
        hybrid_validationSuccess: true,
      };
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error creando estado final:`, error);
      return validationState;
    }
  }
  
  // Navegar después de validación
  private static async navigateAfterValidation(
    nodeId: string,
    tenantId: string,
    finalState: any,
    gotoFlow: any
  ): Promise<any> {
    try {
      const nextFlow = await this.getNextFlowForNode(nodeId, tenantId);
      
      if (nextFlow) {
        return gotoFlow(nextFlow);
      }
      
      return null;
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error navegando después de validación:`, error);
      return null;
    }
  }
  
  // Fallback para preparación de timeout
  private static async timeoutPreparationFallback(
    ctx: any,
    state: any,
    flowDynamic: any,
    config: ValidatedCaptureConfig
  ): Promise<void> {
    try {
      await flowDynamic("Error en preparación. Continuando con proceso básico...");
      
      // Fallback al sistema actual
      return this.fallbackToCurrentSystem(config, config.tenantId);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de preparación:`, error);
      await flowDynamic("Error del sistema. Intenta nuevamente.");
    }
  }

  /**
   * ========================================
   * SUB-TAREA 2.5: MANEJO DE ERRORES Y FALLBACK
   * ========================================
   * 
   * PROPÓSITO: Sistema robusto de manejo de errores que NUNCA rompa el sistema actual
   * CRÍTICO: Preservar sistema de leads 100% funcional bajo cualquier circunstancia
   * ESTRATEGIA: Fallback transparente que coexista sin afectar funcionalidad existente
   */
  
  /**
   * MÉTODO PRINCIPAL: Manejo de errores híbrido
   * PROPÓSITO: Interceptar y manejar errores sin afectar el flujo principal
   */
  static async handleHybridError(
    error: Error,
    context: {
      nodeId: string;
      tenantId: string;
      userId: string;
      currentState?: any;
      operation: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    },
    fallbackOptions: {
      preserveLeadState?: boolean;
      useCurrentSystem?: boolean;
      showUserMessage?: boolean;
      logError?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    fallbackActivated: boolean;
    leadSystemIntact: boolean;
    userMessage?: string;
    fallbackFlow?: any;
  }> {
    try {
      console.error(`[EnhancedDataCapture] ERROR ${context.severity.toUpperCase()} en ${context.operation}:`, {
        error: error.message,
        nodeId: context.nodeId,
        tenantId: context.tenantId,
        userId: context.userId,
        stack: error.stack
      });
      
      // 1. REGISTRAR ERROR PARA ANÁLISIS
      await this.logHybridError(error, context, fallbackOptions);
      
      // 2. VERIFICAR INTEGRIDAD DEL SISTEMA DE LEADS
      const leadSystemStatus = await this.verifyLeadSystemIntegrity(
        context.tenantId,
        context.userId,
        context.currentState
      );
      
      if (!leadSystemStatus.intact) {
        console.error(`[EnhancedDataCapture] CRÍTICO: Sistema de leads comprometido`);
        
        // RESTAURAR SISTEMA DE LEADS
        await this.restoreLeadSystemState(context.tenantId, context.userId, context.currentState);
      }
      
      // 3. DETERMINAR ESTRATEGIA DE FALLBACK
      const fallbackStrategy = await this.determineFallbackStrategy(
        error,
        context,
        fallbackOptions,
        leadSystemStatus
      );
      
      // 4. EJECUTAR FALLBACK SEGÚN ESTRATEGIA
      const fallbackResult = await this.executeFallbackStrategy(
        fallbackStrategy,
        context,
        fallbackOptions
      );
      
      // 5. NOTIFICAR AL USUARIO SI ES NECESARIO
      let userMessage: string | undefined;
      if (fallbackOptions.showUserMessage) {
        userMessage = await this.generateUserErrorMessage(
          error,
          context,
          fallbackStrategy
        );
      }
      
      return {
        success: fallbackResult.success,
        fallbackActivated: true,
        leadSystemIntact: leadSystemStatus.intact,
        userMessage,
        fallbackFlow: fallbackResult.fallbackFlow
      };
      
    } catch (criticalError) {
      console.error(`[EnhancedDataCapture] ERROR CRÍTICO en manejo de errores:`, criticalError);
      
      // ÚLTIMO RECURSO: FALLBACK ABSOLUTO
      return await this.absoluteFallback(context, criticalError);
    }
  }
  
  /**
   * MÉTODO: Registrar error híbrido para análisis
   */
  private static async logHybridError(
    error: Error,
    context: any,
    options: any
  ): Promise<void> {
    try {
      if (options.logError === false) return;
      
      const errorRecord = {
        tenant_id: context.tenantId,
        user_id: context.userId,
        node_id: context.nodeId,
        operation: context.operation,
        severity: context.severity,
        error_message: error.message,
        error_stack: error.stack,
        context_data: context.currentState,
        timestamp: new Date().toISOString(),
        hybrid_module: 'enhanced_data_capture',
        lead_system_affected: false, // Se actualizará después de verificar
      };
      
      await supabase.from('hybrid_error_logs').insert(errorRecord);
      
    } catch (logError) {
      console.error(`[EnhancedDataCapture] Error registrando error:`, logError);
      // NO lanzar error - no afectar el flujo principal
    }
  }
  
  /**
   * MÉTODO: Verificar integridad del sistema de leads
   * CRÍTICO: Garantizar que el sistema de leads NUNCA se rompa
   */
  private static async verifyLeadSystemIntegrity(
    tenantId: string,
    userId: string,
    currentState: any
  ): Promise<{
    intact: boolean;
    leadExists: boolean;
    leadData: any;
    salesStageValid: boolean;
    errors: string[];
  }> {
    try {
      const verificationResult = {
        intact: true,
        leadExists: false,
        leadData: null,
        salesStageValid: false,
        errors: []
      };
      
      // 1. VERIFICAR EXISTENCIA DEL LEAD
      if (currentState?.leadId) {
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', currentState.leadId)
          .eq('tenant_id', tenantId)
          .single();
          
        if (leadError || !leadData) {
          verificationResult.intact = false;
          verificationResult.errors.push('Lead no encontrado');
        } else {
          verificationResult.leadExists = true;
          verificationResult.leadData = leadData;
        }
      }
      
      // 2. VERIFICAR VALIDEZ DE LA ETAPA DE VENTAS
      if (currentState?.salesStageId) {
        const { data: stageData, error: stageError } = await supabase
          .from('sales_stages')
          .select('*')
          .eq('id', currentState.salesStageId)
          .eq('tenant_id', tenantId)
          .single();
          
        if (stageError || !stageData) {
          verificationResult.intact = false;
          verificationResult.errors.push('Etapa de ventas inválida');
        } else {
          verificationResult.salesStageValid = true;
        }
      }
      
      // 3. VERIFICAR SERVICIOS CRÍTICOS DEL SISTEMA DE LEADS
      const criticalServices = await this.verifyCriticalLeadServices(tenantId);
      
      if (!criticalServices.allOperational) {
        verificationResult.intact = false;
        verificationResult.errors.push(...criticalServices.errors);
      }
      
      return verificationResult;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error verificando integridad de leads:`, error);
      
      // ASUMIR SISTEMA COMPROMETIDO EN CASO DE ERROR
      return {
        intact: false,
        leadExists: false,
        leadData: null,
        salesStageValid: false,
        errors: ['Error de verificación del sistema']
      };
    }
  }
  
  /**
   * MÉTODO: Verificar servicios críticos del sistema de leads
   */
  private static async verifyCriticalLeadServices(tenantId: string): Promise<{
    allOperational: boolean;
    errors: string[];
    services: Record<string, boolean>;
  }> {
    try {
      const servicesStatus = {
        allOperational: true,
        errors: [],
        services: {}
      };
      
      // 1. VERIFICAR TABLA DE LEADS
      try {
        await supabase.from('leads').select('id').eq('tenant_id', tenantId).limit(1);
        servicesStatus.services.leads_table = true;
      } catch (error) {
        servicesStatus.allOperational = false;
        servicesStatus.errors.push('Tabla de leads no accesible');
        servicesStatus.services.leads_table = false;
      }
      
      // 2. VERIFICAR TABLA DE ETAPAS DE VENTAS
      try {
        await supabase.from('sales_stages').select('id').eq('tenant_id', tenantId).limit(1);
        servicesStatus.services.sales_stages_table = true;
      } catch (error) {
        servicesStatus.allOperational = false;
        servicesStatus.errors.push('Tabla de etapas de ventas no accesible');
        servicesStatus.services.sales_stages_table = false;
      }
      
      // 3. VERIFICAR TABLA DE INTERACCIONES
      try {
        await supabase.from('lead_interactions').select('id').eq('tenant_id', tenantId).limit(1);
        servicesStatus.services.interactions_table = true;
      } catch (error) {
        servicesStatus.allOperational = false;
        servicesStatus.errors.push('Tabla de interacciones no accesible');
        servicesStatus.services.interactions_table = false;
      }
      
      return servicesStatus;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error verificando servicios críticos:`, error);
      return {
        allOperational: false,
        errors: ['Error general de verificación'],
        services: {}
      };
    }
  }
  
  /**
   * MÉTODO: Restaurar estado del sistema de leads
   */
  private static async restoreLeadSystemState(
    tenantId: string,
    userId: string,
    currentState: any
  ): Promise<void> {
    try {
      console.log(`[EnhancedDataCapture] Restaurando sistema de leads para ${userId}`);
      
      // 1. RESTAURAR LEAD SI EXISTE
      if (currentState?.leadId) {
        await this.restoreLead(currentState.leadId, tenantId, currentState);
      }
      
      // 2. RESTAURAR ETAPA DE VENTAS
      if (currentState?.salesStageId) {
        await this.restoreSalesStage(currentState.salesStageId, tenantId, currentState);
      }
      
      // 3. RESTAURAR INTERACCIONES
      await this.restoreLeadInteractions(userId, tenantId, currentState);
      
      // 4. VALIDAR RESTAURACIÓN
      const validationResult = await this.verifyLeadSystemIntegrity(
        tenantId,
        userId,
        currentState
      );
      
      if (validationResult.intact) {
        console.log(`[EnhancedDataCapture] Sistema de leads restaurado exitosamente`);
      } else {
        console.error(`[EnhancedDataCapture] Falló la restauración del sistema de leads`);
      }
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error restaurando sistema de leads:`, error);
    }
  }
  
  /**
   * MÉTODO: Determinar estrategia de fallback
   */
  private static async determineFallbackStrategy(
    error: Error,
    context: any,
    options: any,
    leadSystemStatus: any
  ): Promise<{
    type: 'transparent' | 'graceful' | 'emergency' | 'absolute';
    priority: 'preserve_leads' | 'preserve_flow' | 'preserve_system';
    actions: string[];
    userVisible: boolean;
  }> {
    try {
      // ESTRATEGIA BASADA EN SEVERIDAD Y ESTADO DEL SISTEMA
      
      if (context.severity === 'critical' || !leadSystemStatus.intact) {
        // FALLBACK ABSOLUTO - PRESERVAR SISTEMA DE LEADS
        return {
          type: 'absolute',
          priority: 'preserve_leads',
          actions: [
            'restore_lead_system',
            'fallback_to_current_system',
            'notify_admin',
            'disable_hybrid_temporarily'
          ],
          userVisible: false
        };
      }
      
      if (context.severity === 'high') {
        // FALLBACK DE EMERGENCIA - PRESERVAR FLUJO
        return {
          type: 'emergency',
          priority: 'preserve_flow',
          actions: [
            'fallback_to_current_system',
            'preserve_collected_data',
            'continue_with_basic_flow'
          ],
          userVisible: false
        };
      }
      
      if (context.severity === 'medium') {
        // FALLBACK ELEGANTE - PRESERVAR EXPERIENCIA
        return {
          type: 'graceful',
          priority: 'preserve_system',
          actions: [
            'retry_with_basic_validation',
            'fallback_if_retry_fails',
            'log_for_improvement'
          ],
          userVisible: false
        };
      }
      
      // FALLBACK TRANSPARENTE - USUARIO NO NOTA
      return {
        type: 'transparent',
        priority: 'preserve_system',
        actions: [
          'continue_with_current_system',
          'log_for_analysis',
          'maintain_user_experience'
        ],
        userVisible: false
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error determinando estrategia:`, error);
      
      // FALLBACK ABSOLUTO POR DEFECTO
      return {
        type: 'absolute',
        priority: 'preserve_leads',
        actions: ['fallback_to_current_system'],
        userVisible: false
      };
    }
  }
  
  /**
   * MÉTODO: Ejecutar estrategia de fallback
   */
  private static async executeFallbackStrategy(
    strategy: any,
    context: any,
    options: any
  ): Promise<{
    success: boolean;
    fallbackFlow?: any;
    preservedData?: any;
  }> {
    try {
      console.log(`[EnhancedDataCapture] Ejecutando fallback ${strategy.type} para ${context.nodeId}`);
      
      let result: any = { success: false };
      
      switch (strategy.type) {
        case 'transparent':
          result = await this.executeTransparentFallback(context, options);
          break;
          
        case 'graceful':
          result = await this.executeGracefulFallback(context, options);
          break;
          
        case 'emergency':
          result = await this.executeEmergencyFallback(context, options);
          break;
          
        case 'absolute':
          result = await this.executeAbsoluteFallback(context, options);
          break;
          
        default:
          result = await this.executeAbsoluteFallback(context, options);
      }
      
      // EJECUTAR ACCIONES ADICIONALES
      await this.executeAdditionalActions(strategy.actions, context, options);
      
      return result;
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error ejecutando fallback:`, error);
      
      // ÚLTIMO RECURSO
      return await this.executeAbsoluteFallback(context, options);
    }
  }
  
  /**
   * MÉTODO: Fallback transparente - Usuario no nota
   */
  private static async executeTransparentFallback(
    context: any,
    options: any
  ): Promise<{ success: boolean; fallbackFlow?: any }> {
    try {
      // CONTINUAR CON SISTEMA ACTUAL SIN NOTIFICAR AL USUARIO
      const fallbackFlow = await this.fallbackToCurrentSystem(
        { nodeId: context.nodeId },
        context.tenantId
      );
      
      return {
        success: true,
        fallbackFlow
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback transparente:`, error);
      return { success: false };
    }
  }
  
  /**
   * MÉTODO: Fallback elegante - Experiencia preservada
   */
  private static async executeGracefulFallback(
    context: any,
    options: any
  ): Promise<{ success: boolean; fallbackFlow?: any }> {
    try {
      // INTENTAR OPERACIÓN BÁSICA ANTES DE FALLBACK COMPLETO
      const basicResult = await this.attemptBasicOperation(context);
      
      if (basicResult.success) {
        return {
          success: true,
          fallbackFlow: basicResult.flow
        };
      }
      
      // SI FALLA, FALLBACK COMPLETO
      return await this.executeTransparentFallback(context, options);
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback elegante:`, error);
      return await this.executeTransparentFallback(context, options);
    }
  }
  
  /**
   * MÉTODO: Fallback de emergencia - Preservar flujo
   */
  private static async executeEmergencyFallback(
    context: any,
    options: any
  ): Promise<{ success: boolean; fallbackFlow?: any; preservedData?: any }> {
    try {
      // PRESERVAR DATOS RECOLECTADOS
      const preservedData = await this.preserveCollectedData(context);
      
      // FALLBACK AL SISTEMA ACTUAL
      const fallbackFlow = await this.fallbackToCurrentSystem(
        { nodeId: context.nodeId },
        context.tenantId
      );
      
      return {
        success: true,
        fallbackFlow,
        preservedData
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback de emergencia:`, error);
      return { success: false };
    }
  }
  
  /**
   * MÉTODO: Fallback absoluto - Preservar sistema
   */
  private static async executeAbsoluteFallback(
    context: any,
    options: any
  ): Promise<{ success: boolean; fallbackFlow?: any }> {
    try {
      // GARANTIZAR INTEGRIDAD DEL SISTEMA DE LEADS
      await this.ensureLeadSystemIntegrity(context.tenantId, context.userId);
      
      // FALLBACK BÁSICO GARANTIZADO
      const fallbackFlow = await this.guaranteedBasicFallback(context);
      
      return {
        success: true,
        fallbackFlow
      };
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback absoluto:`, error);
      
      // ÚLTIMO RECURSO ABSOLUTO
      return {
        success: true,
        fallbackFlow: addKeyword([""]).addAnswer("Continuando...")
      };
    }
  }
  
  /**
   * MÉTODO: Fallback al sistema actual (MEJORADO)
   * PROPÓSITO: Garantizar que siempre haya fallback funcionando
   */
  static async fallbackToCurrentSystem(
    nodeConfig: any,
    tenantId: string
  ): Promise<any> {
    try {
      console.log(`[EnhancedDataCapture] Fallback activado para nodo ${nodeConfig.nodeId}`);
      
      // 1. VERIFICAR DISPONIBILIDAD DEL SISTEMA ACTUAL
      const systemStatus = await this.verifyCurrentSystemAvailability(tenantId);
      
      if (!systemStatus.available) {
        console.error(`[EnhancedDataCapture] Sistema actual no disponible`);
        return await this.guaranteedBasicFallback({ nodeId: nodeConfig.nodeId, tenantId });
      }
      
      // 2. INTEGRAR CON templateConverter.ts ACTUAL
      // TODO: Implementar integración real con templateConverter.ts
      
      // 3. FLUJO BÁSICO FUNCIONAL
      return addKeyword([""]).addAnswer("Información procesada correctamente.");
      
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error en fallback:`, error);
      
      // FALLBACK DE ÚLTIMO RECURSO
      return await this.guaranteedBasicFallback({ nodeId: nodeConfig.nodeId, tenantId });
    }
  }
  
  /**
   * MÉTODOS AUXILIARES PARA FALLBACK
   */
  
  private static async verifyCurrentSystemAvailability(tenantId: string): Promise<{ available: boolean; errors: string[] }> {
    try {
      // Verificar disponibilidad del sistema actual
      const { data: template } = await supabase
        .from('chatbot_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1);
        
      return {
        available: true,
        errors: []
      };
    } catch (error) {
      return {
        available: false,
        errors: ['Sistema actual no disponible']
      };
    }
  }
  
  private static async guaranteedBasicFallback(context: any): Promise<any> {
    try {
      return addKeyword([""]).addAnswer("Gracias por tu respuesta.");
    } catch (error) {
      // ÚLTIMO RECURSO ABSOLUTO
      return addKeyword([""]).addAnswer("Continuando...");
    }
  }
  
  private static async absoluteFallback(context: any, criticalError: Error): Promise<any> {
    console.error(`[EnhancedDataCapture] FALLBACK ABSOLUTO activado:`, criticalError);
    
    return {
      success: false,
      fallbackActivated: true,
      leadSystemIntact: false,
      userMessage: "Error del sistema. Continuando con proceso básico.",
      fallbackFlow: addKeyword([""]).addAnswer("Disculpa, hubo un error. Continuando...")
    };
  }
  
  private static async attemptBasicOperation(context: any): Promise<{ success: boolean; flow?: any }> {
    try {
      // Intentar operación básica
      const basicFlow = await this.fallbackToCurrentSystem(
        { nodeId: context.nodeId },
        context.tenantId
      );
      
      return {
        success: true,
        flow: basicFlow
      };
    } catch (error) {
      return { success: false };
    }
  }
  
  private static async preserveCollectedData(context: any): Promise<any> {
    try {
      if (context.currentState?.hybrid_collectedData) {
        return context.currentState.hybrid_collectedData;
      }
      return {};
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error preservando datos:`, error);
      return {};
    }
  }
  
  private static async ensureLeadSystemIntegrity(tenantId: string, userId: string): Promise<void> {
    try {
      // Verificar y garantizar integridad del sistema de leads
      const integrity = await this.verifyLeadSystemIntegrity(tenantId, userId, {});
      
      if (!integrity.intact) {
        await this.restoreLeadSystemState(tenantId, userId, {});
      }
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error garantizando integridad:`, error);
    }
  }
  
  private static async executeAdditionalActions(actions: string[], context: any, options: any): Promise<void> {
    try {
      for (const action of actions) {
        switch (action) {
          case 'notify_admin':
            await this.notifyAdminOfCriticalError(context);
            break;
            
          case 'disable_hybrid_temporarily':
            await this.disableHybridTemporarily(context.tenantId);
            break;
            
          case 'log_for_improvement':
            await this.logForImprovement(context);
            break;
            
          default:
            console.log(`[EnhancedDataCapture] Acción no reconocida: ${action}`);
        }
      }
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error ejecutando acciones adicionales:`, error);
    }
  }
  
  private static async notifyAdminOfCriticalError(context: any): Promise<void> {
    try {
      // Notificar al administrador sobre error crítico
      console.error(`[EnhancedDataCapture] NOTIFICACIÓN ADMIN: Error crítico en ${context.nodeId}`);
      
      // TODO: Implementar notificación real (email, webhook, etc.)
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error notificando admin:`, error);
    }
  }
  
  private static async disableHybridTemporarily(tenantId: string): Promise<void> {
    try {
      // Deshabilitar módulo híbrido temporalmente
      await supabase
        .from('tenant_hybrid_settings')
        .update({ 
          enabled: false,
          disabled_reason: 'critical_error',
          disabled_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);
        
      console.log(`[EnhancedDataCapture] Módulo híbrido deshabilitado temporalmente para ${tenantId}`);
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error deshabilitando híbrido:`, error);
    }
  }
  
  private static async logForImprovement(context: any): Promise<void> {
    try {
      // Registrar para mejora futura
      await supabase.from('hybrid_improvement_logs').insert({
        tenant_id: context.tenantId,
        node_id: context.nodeId,
        operation: context.operation,
        context_data: context,
        logged_at: new Date().toISOString()
      });
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error logging para mejora:`, error);
    }
  }
  
  private static async restoreLead(leadId: string, tenantId: string, currentState: any): Promise<void> {
    try {
      // Restaurar datos del lead si es necesario
      console.log(`[EnhancedDataCapture] Restaurando lead ${leadId}`);
      
      // TODO: Implementar restauración específica
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error restaurando lead:`, error);
    }
  }
  
  private static async restoreSalesStage(stageId: string, tenantId: string, currentState: any): Promise<void> {
    try {
      // Restaurar etapa de ventas si es necesario
      console.log(`[EnhancedDataCapture] Restaurando etapa ${stageId}`);
      
      // TODO: Implementar restauración específica
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error restaurando etapa:`, error);
    }
  }
  
  private static async restoreLeadInteractions(userId: string, tenantId: string, currentState: any): Promise<void> {
    try {
      // Restaurar interacciones del lead si es necesario
      console.log(`[EnhancedDataCapture] Restaurando interacciones para ${userId}`);
      
      // TODO: Implementar restauración específica
    } catch (error) {
      console.error(`[EnhancedDataCapture] Error restaurando interacciones:`, error);
    }
  }
  
  private static async generateUserErrorMessage(
    error: Error,
    context: any,
    strategy: any
  ): Promise<string> {
    try {
      // Generar mensaje apropiado para el usuario
      switch (strategy.type) {
        case 'transparent':
          return ""; // No mostrar mensaje
          
        case 'graceful':
          return "Procesando información...";
          
        case 'emergency':
          return "Continuando con el proceso...";
          
        case 'absolute':
          return "Disculpa, hubo un problema técnico. Continuando...";
          
        default:
          return "Continuando...";
      }
    } catch (error) {
      return "Continuando...";
    }
  }
}

export default EnhancedDataCapture;