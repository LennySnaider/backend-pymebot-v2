/**
 * DYNAMIC NAVIGATION SERVICE
 * 
 * PROPÓSITO: Navegación mejorada entre nodos con contexto preservado
 * BASADO EN: Patrones de navegación del v1-reference que funcionan correctamente
 * PRESERVA: Sistema de leads 100% intacto
 * RESUELVE: Problemas de navegación que causan "Mensajes capturados: 0"
 * 
 * PATRONES EXTRAÍDOS DEL V1-REFERENCE:
 * - gotoFlow() que mantiene contexto entre nodos
 * - Cola de procesamiento secuencial
 * - Validación de flujo antes de navegación
 * - Rollback automático en caso de errores
 * - Integración con sistema de sesiones persistentes
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import ImprovedSessionManager from './improvedSessionManager';
import { maintainSessionContext } from '../utils/maintainSessionContext';
import type { 
  PersistentSession, 
  SessionContextData 
} from './improvedSessionManager';

// INTERFACES PARA NAVEGACIÓN DINÁMICA

interface NavigationNode {
  nodeId: string;
  nodeType: 'message' | 'input' | 'button' | 'ai_response' | 'condition' | 'action';
  templateId?: string;
  tenantId: string;
  data: NodeData;
  metadata: NodeMetadata;
}

interface NodeData {
  message?: string;
  buttons?: ButtonData[];
  input?: InputData;
  conditions?: ConditionData[];
  actions?: ActionData[];
  aiConfig?: AIConfig;
  variables?: Record<string, any>;
}

interface ButtonData {
  id: string;
  text: string;
  targetNodeId?: string;
  action?: string;
  value?: any;
}

interface InputData {
  label: string;
  placeholder?: string;
  validation?: ValidationRule[];
  required?: boolean;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'multiselect';
  options?: { value: string; label: string; }[];
}

interface ConditionData {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  value: any;
  targetNodeId: string;
}

interface ActionData {
  type: 'set_variable' | 'call_api' | 'update_lead' | 'send_email' | 'custom';
  config: Record<string, any>;
}

interface AIConfig {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemMessage?: string;
}

interface ValidationRule {
  type: 'required' | 'email' | 'phone' | 'min_length' | 'max_length' | 'regex' | 'custom';
  value?: any;
  message: string;
  function?: string;
}

interface NodeMetadata {
  position?: { x: number; y: number; };
  priority?: number;
  tags?: string[];
  leadStageId?: string; // CRÍTICO: Para integración con sistema de leads
  salesFunnelStep?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NavigationContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  currentNodeId?: string;
  previousNodeId?: string;
  templateId?: string;
  conversationState: ConversationState;
  navigationHistory: NavigationStep[];
  collectedData: Record<string, any>;
  globalVars: Record<string, any>;
  leadData?: LeadContextData;
}

interface ConversationState {
  isWaitingForInput: boolean;
  lastUserMessage?: string;
  lastBotResponse?: string;
  inputType?: string;
  validationErrors?: string[];
  retryCount?: number;
  maxRetries?: number;
}

interface NavigationStep {
  timestamp: string;
  fromNodeId?: string;
  toNodeId: string;
  navigationMethod: 'gotoFlow' | 'conditional' | 'button_click' | 'user_input' | 'auto';
  success: boolean;
  duration?: number;
  errorMessage?: string;
  contextSnapshot?: Partial<NavigationContext>;
}

interface LeadContextData {
  leadId?: string;
  currentStage?: string;
  progressPercentage?: number;
  nextActions?: string[];
  estimatedValue?: number;
}

interface NavigationResult {
  success: boolean;
  targetNodeId?: string;
  nextNode?: NavigationNode;
  error?: string;
  contextUpdates?: Partial<NavigationContext>;
  navigationStep?: NavigationStep;
  requiresUserInput?: boolean;
  botResponse?: string;
}

interface NavigationOptions {
  preserveContext?: boolean;
  validateFlow?: boolean;
  enableRollback?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeout?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  skipValidation?: boolean;
  customData?: Record<string, any>;
}

interface FlowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  canProceed: boolean;
}

/**
 * SERVICIO PRINCIPAL DE NAVEGACIÓN DINÁMICA
 * 
 * PROPÓSITO: Gestionar navegación entre nodos manteniendo contexto
 * PATRÓN: Extraído del v1-reference donde la navegación funciona correctamente
 */
class DynamicNavigationService {
  private static instance: DynamicNavigationService;
  private sessionManager: ImprovedSessionManager;
  private navigationQueue: Map<string, NavigationStep[]> = new Map();
  private processingQueue: Set<string> = new Set();
  private nodeRegistry: Map<string, NavigationNode> = new Map();
  private flowRegistry: Map<string, NavigationNode[]> = new Map();

  private constructor() {
    this.sessionManager = ImprovedSessionManager.getInstance();
    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(): DynamicNavigationService {
    if (!DynamicNavigationService.instance) {
      DynamicNavigationService.instance = new DynamicNavigationService();
    }
    return DynamicNavigationService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio
   */
  private initializeService(): void {
    logger.info(`[DynamicNavigationService] Servicio inicializado`);
  }

  /**
   * MÉTODO PRINCIPAL: enhancedGotoFlow
   * PROPÓSITO: Navegación mejorada que mantiene contexto entre nodos
   * PATRÓN: Basado en el gotoFlow del v1-reference que funciona
   */
  async enhancedGotoFlow(
    currentContext: NavigationContext,
    targetNodeId: string,
    options: NavigationOptions = {}
  ): Promise<NavigationResult> {
    const startTime = Date.now();
    logger.info(`[DynamicNavigationService] enhancedGotoFlow: ${currentContext.currentNodeId} -> ${targetNodeId}`);

    try {
      // PASO 1: VALIDAR PRECONDICIONES
      if (this.processingQueue.has(currentContext.sessionId || currentContext.userId)) {
        return {
          success: false,
          error: 'Navegación ya en progreso para esta sesión'
        };
      }

      // PASO 2: MARCAR COMO EN PROCESAMIENTO
      this.processingQueue.add(currentContext.sessionId || currentContext.userId);

      // PASO 3: VALIDAR FLUJO SI ESTÁ HABILITADO
      if (options.validateFlow !== false) {
        const validation = await this.validateFlowNavigation(
          currentContext.currentNodeId,
          targetNodeId,
          currentContext
        );

        if (!validation.canProceed) {
          return {
            success: false,
            error: `Validación de flujo falló: ${validation.errors.join(', ')}`
          };
        }
      }

      // PASO 4: OBTENER NODO DESTINO
      const targetNode = await this.getNode(targetNodeId);
      if (!targetNode) {
        return {
          success: false,
          error: `Nodo destino no encontrado: ${targetNodeId}`
        };
      }

      // PASO 5: PRESERVAR CONTEXTO ACTUAL
      const preservedContext = options.preserveContext !== false 
        ? await this.preserveNavigationContext(currentContext)
        : null;

      // PASO 6: EJECUTAR NAVEGACIÓN
      const navigationResult = await this.executeNavigation(
        currentContext,
        targetNode,
        options,
        preservedContext
      );

      // PASO 7: REGISTRAR PASO DE NAVEGACIÓN
      const navigationStep: NavigationStep = {
        timestamp: new Date().toISOString(),
        fromNodeId: currentContext.currentNodeId,
        toNodeId: targetNodeId,
        navigationMethod: 'gotoFlow',
        success: navigationResult.success,
        duration: Date.now() - startTime,
        errorMessage: navigationResult.error,
        contextSnapshot: preservedContext ? { ...currentContext } : undefined
      };

      await this.recordNavigationStep(currentContext, navigationStep);

      // PASO 8: ACTUALIZAR CONTEXTO DE SESIÓN
      if (navigationResult.success && navigationResult.contextUpdates) {
        await this.updateSessionContext(currentContext, navigationResult.contextUpdates);
      }

      // PASO 9: INTEGRACIÓN CON SISTEMA DE LEADS (SIN TOCARLO)
      if (navigationResult.success && targetNode.metadata.leadStageId) {
        await this.preserveLeadIntegration(currentContext, targetNode);
      }

      return {
        ...navigationResult,
        navigationStep
      };

    } catch (error) {
      logger.error(`[DynamicNavigationService] Error en enhancedGotoFlow:`, error);

      // ROLLBACK SI ESTÁ HABILITADO
      if (options.enableRollback && currentContext.currentNodeId) {
        await this.executeRollback(currentContext, currentContext.currentNodeId);
      }

      return {
        success: false,
        error: `Error en navegación: ${error}`
      };

    } finally {
      // LIMPIAR ESTADO DE PROCESAMIENTO
      this.processingQueue.delete(currentContext.sessionId || currentContext.userId);
    }
  }

  /**
   * MÉTODO: Ejecutar navegación
   */
  private async executeNavigation(
    context: NavigationContext,
    targetNode: NavigationNode,
    options: NavigationOptions,
    preservedContext: Partial<NavigationContext> | null
  ): Promise<NavigationResult> {
    try {
      logger.debug(`[DynamicNavigationService] Ejecutando navegación a nodo ${targetNode.nodeId} tipo ${targetNode.nodeType}`);

      // Preparar actualizaciones de contexto
      const contextUpdates: Partial<NavigationContext> = {
        previousNodeId: context.currentNodeId,
        currentNodeId: targetNode.nodeId,
        conversationState: {
          ...context.conversationState,
          isWaitingForInput: this.nodeRequiresInput(targetNode),
          inputType: this.getInputType(targetNode)
        }
      };

      // Procesar según tipo de nodo
      let botResponse: string | undefined;
      let requiresUserInput = false;

      switch (targetNode.nodeType) {
        case 'message':
          botResponse = await this.processMessageNode(targetNode, context);
          break;

        case 'input':
          botResponse = await this.processInputNode(targetNode, context);
          requiresUserInput = true;
          break;

        case 'button':
          botResponse = await this.processButtonNode(targetNode, context);
          break;

        case 'ai_response':
          botResponse = await this.processAIResponseNode(targetNode, context);
          break;

        case 'condition':
          const conditionResult = await this.processConditionNode(targetNode, context);
          if (conditionResult.nextNodeId) {
            // Navegación condicional automática
            return await this.enhancedGotoFlow(context, conditionResult.nextNodeId, options);
          }
          break;

        case 'action':
          await this.processActionNode(targetNode, context);
          botResponse = `Acción ${targetNode.nodeId} ejecutada`;
          break;

        default:
          botResponse = `Procesando nodo ${targetNode.nodeType}`;
      }

      return {
        success: true,
        targetNodeId: targetNode.nodeId,
        nextNode: targetNode,
        contextUpdates,
        requiresUserInput,
        botResponse
      };

    } catch (error) {
      logger.error(`[DynamicNavigationService] Error ejecutando navegación:`, error);
      return {
        success: false,
        error: String(error)
      };
    }
  }

  /**
   * MÉTODOS DE PROCESAMIENTO POR TIPO DE NODO
   */

  private async processMessageNode(node: NavigationNode, context: NavigationContext): Promise<string> {
    let message = node.data.message || 'Mensaje no definido';
    
    // Reemplazar variables en el mensaje
    message = await this.replaceVariables(message, context);
    
    logger.debug(`[DynamicNavigationService] Procesando nodo mensaje: ${message}`);
    return message;
  }

  private async processInputNode(node: NavigationNode, context: NavigationContext): Promise<string> {
    const inputData = node.data.input;
    if (!inputData) {
      return 'Error: Configuración de input no encontrada';
    }

    let prompt = inputData.label;
    if (inputData.placeholder) {
      prompt += `\n${inputData.placeholder}`;
    }

    // Agregar información de validación si existe
    if (inputData.validation && inputData.validation.length > 0) {
      const validationHints = inputData.validation
        .map(rule => this.getValidationHint(rule))
        .filter(Boolean)
        .join(', ');
      
      if (validationHints) {
        prompt += `\n(${validationHints})`;
      }
    }

    logger.debug(`[DynamicNavigationService] Procesando nodo input: ${prompt}`);
    return await this.replaceVariables(prompt, context);
  }

  private async processButtonNode(node: NavigationNode, context: NavigationContext): Promise<string> {
    const buttons = node.data.buttons || [];
    
    if (buttons.length === 0) {
      return 'Selecciona una opción:';
    }

    let message = node.data.message || 'Selecciona una opción:';
    message = await this.replaceVariables(message, context);

    // Agregar botones al contexto para que el provider los maneje
    context.conversationState.lastBotResponse = message;

    logger.debug(`[DynamicNavigationService] Procesando nodo botones con ${buttons.length} opciones`);
    return message;
  }

  private async processAIResponseNode(node: NavigationNode, context: NavigationContext): Promise<string> {
    const aiConfig = node.data.aiConfig;
    if (!aiConfig) {
      return 'Error: Configuración de IA no encontrada';
    }

    try {
      // Preparar prompt con contexto
      let prompt = aiConfig.prompt;
      prompt = await this.replaceVariables(prompt, context);

      // Agregar contexto de conversación
      if (context.conversationState.lastUserMessage) {
        prompt += `\n\nÚltimo mensaje del usuario: ${context.conversationState.lastUserMessage}`;
      }

      // Agregar datos recolectados relevantes
      if (Object.keys(context.collectedData).length > 0) {
        prompt += `\n\nDatos recolectados: ${JSON.stringify(context.collectedData)}`;
      }

      // Simular respuesta de IA (en implementación real, llamar a OpenAI/MiniMax)
      const aiResponse = await this.generateAIResponse(prompt, aiConfig);
      
      logger.debug(`[DynamicNavigationService] Procesando nodo IA: ${aiResponse}`);
      return aiResponse;

    } catch (error) {
      logger.error(`[DynamicNavigationService] Error procesando nodo IA:`, error);
      return 'Lo siento, hubo un error procesando tu solicitud.';
    }
  }

  private async processConditionNode(node: NavigationNode, context: NavigationContext): Promise<{ nextNodeId?: string }> {
    const conditions = node.data.conditions || [];
    
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (result) {
        logger.debug(`[DynamicNavigationService] Condición cumplida, navegando a: ${condition.targetNodeId}`);
        return { nextNodeId: condition.targetNodeId };
      }
    }

    logger.debug(`[DynamicNavigationService] Ninguna condición cumplida`);
    return {};
  }

  private async processActionNode(node: NavigationNode, context: NavigationContext): Promise<void> {
    const actions = node.data.actions || [];
    
    for (const action of actions) {
      try {
        await this.executeAction(action, context);
        logger.debug(`[DynamicNavigationService] Acción ejecutada: ${action.type}`);
      } catch (error) {
        logger.error(`[DynamicNavigationService] Error ejecutando acción ${action.type}:`, error);
      }
    }
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private async replaceVariables(text: string, context: NavigationContext): Promise<string> {
    let result = text;

    // Reemplazar variables globales
    for (const [key, value] of Object.entries(context.globalVars)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Reemplazar datos recolectados
    for (const [key, value] of Object.entries(context.collectedData)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Reemplazar variables de sistema
    result = result.replace(/{{now}}/g, new Date().toLocaleString());
    result = result.replace(/{{userId}}/g, context.userId);
    result = result.replace(/{{tenantId}}/g, context.tenantId);

    return result;
  }

  private getValidationHint(rule: ValidationRule): string {
    switch (rule.type) {
      case 'required':
        return 'requerido';
      case 'email':
        return 'formato de email';
      case 'phone':
        return 'número de teléfono';
      case 'min_length':
        return `mínimo ${rule.value} caracteres`;
      case 'max_length':
        return `máximo ${rule.value} caracteres`;
      default:
        return '';
    }
  }

  private async generateAIResponse(prompt: string, config: AIConfig): Promise<string> {
    // Simulación de respuesta de IA
    // En implementación real, integrar con OpenAI/MiniMax API
    return `Respuesta de IA basada en: "${prompt.substring(0, 50)}..."`;
  }

  private async evaluateCondition(condition: ConditionData, context: NavigationContext): Promise<boolean> {
    const value = this.getValueFromContext(condition.field, context);
    
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'not_contains':
        return !String(value).includes(String(condition.value));
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      default:
        return false;
    }
  }

  private getValueFromContext(field: string, context: NavigationContext): any {
    // Buscar en datos recolectados
    if (context.collectedData[field] !== undefined) {
      return context.collectedData[field];
    }

    // Buscar en variables globales
    if (context.globalVars[field] !== undefined) {
      return context.globalVars[field];
    }

    // Buscar en estado de conversación
    if (field.startsWith('conversation.')) {
      const key = field.replace('conversation.', '');
      return (context.conversationState as any)[key];
    }

    return undefined;
  }

  private async executeAction(action: ActionData, context: NavigationContext): Promise<void> {
    switch (action.type) {
      case 'set_variable':
        const { key, value } = action.config;
        if (key && value !== undefined) {
          context.globalVars[key] = value;
        }
        break;

      case 'update_lead':
        // CRÍTICO: NO tocar el sistema de leads actual
        // Solo preservar la información en el contexto
        if (context.leadData && action.config.leadUpdates) {
          Object.assign(context.leadData, action.config.leadUpdates);
        }
        break;

      case 'call_api':
        // Simular llamada a API externa
        logger.debug(`[DynamicNavigationService] Simulando llamada a API: ${action.config.url}`);
        break;

      default:
        logger.warn(`[DynamicNavigationService] Tipo de acción no implementado: ${action.type}`);
    }
  }

  private nodeRequiresInput(node: NavigationNode): boolean {
    return node.nodeType === 'input' || 
           (node.nodeType === 'button' && node.data.buttons && node.data.buttons.length > 0);
  }

  private getInputType(node: NavigationNode): string | undefined {
    if (node.nodeType === 'input' && node.data.input) {
      return node.data.input.type;
    }
    if (node.nodeType === 'button') {
      return 'button_selection';
    }
    return undefined;
  }

  /**
   * MÉTODOS DE GESTIÓN DE CONTEXTO Y SESIÓN
   */

  private async preserveNavigationContext(context: NavigationContext): Promise<Partial<NavigationContext> | null> {
    try {
      return {
        ...context,
        navigationHistory: [...context.navigationHistory],
        collectedData: { ...context.collectedData },
        globalVars: { ...context.globalVars }
      };
    } catch (error) {
      logger.error(`[DynamicNavigationService] Error preservando contexto:`, error);
      return null;
    }
  }

  private async updateSessionContext(
    context: NavigationContext, 
    updates: Partial<NavigationContext>
  ): Promise<void> {
    if (!context.sessionId) {
      return;
    }

    try {
      await maintainSessionContext({
        userId: context.userId,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        nodeId: updates.currentNodeId,
        preserveLeadData: true
      }, {
        preserveFields: ['leadData', 'collectedData'],
        clearFields: [],
        updateFields: {
          'currentNodeId': updates.currentNodeId,
          'conversationState': updates.conversationState,
          'globalVars': updates.globalVars
        }
      });

    } catch (error) {
      logger.error(`[DynamicNavigationService] Error actualizando contexto de sesión:`, error);
    }
  }

  private async recordNavigationStep(context: NavigationContext, step: NavigationStep): Promise<void> {
    const sessionKey = context.sessionId || context.userId;
    
    if (!this.navigationQueue.has(sessionKey)) {
      this.navigationQueue.set(sessionKey, []);
    }

    const queue = this.navigationQueue.get(sessionKey)!;
    queue.push(step);

    // Mantener solo los últimos 100 pasos para evitar crecimiento descontrolado
    if (queue.length > 100) {
      queue.splice(0, queue.length - 100);
    }

    logger.debug(`[DynamicNavigationService] Paso de navegación registrado: ${step.fromNodeId} -> ${step.toNodeId}`);
  }

  private async preserveLeadIntegration(context: NavigationContext, targetNode: NavigationNode): Promise<void> {
    // CRÍTICO: NO tocar el sistema de leads actual
    // Solo preservar información relevante en el contexto
    if (targetNode.metadata.leadStageId && context.leadData) {
      context.leadData.currentStage = targetNode.metadata.leadStageId;
      
      if (targetNode.metadata.salesFunnelStep) {
        if (!context.leadData.nextActions) {
          context.leadData.nextActions = [];
        }
        context.leadData.nextActions.push(targetNode.metadata.salesFunnelStep);
      }

      logger.debug(`[DynamicNavigationService] Información de lead preservada para etapa: ${targetNode.metadata.leadStageId}`);
    }
  }

  /**
   * MÉTODOS DE VALIDACIÓN Y ROLLBACK
   */

  private async validateFlowNavigation(
    fromNodeId: string | undefined,
    toNodeId: string,
    context: NavigationContext
  ): Promise<FlowValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validar que el nodo destino existe
      const targetNode = await this.getNode(toNodeId);
      if (!targetNode) {
        errors.push(`Nodo destino no encontrado: ${toNodeId}`);
      }

      // Validar que el nodo pertenece al tenant correcto
      if (targetNode && targetNode.tenantId !== context.tenantId) {
        errors.push(`Nodo ${toNodeId} no pertenece al tenant ${context.tenantId}`);
      }

      // Validar navegación circular
      if (this.hasCircularNavigation(context.navigationHistory, toNodeId)) {
        warnings.push(`Posible navegación circular detectada hacia ${toNodeId}`);
      }

      // Validar límites de navegación
      if (context.navigationHistory.length > 50) {
        warnings.push('Historial de navegación muy largo, considerar limpieza');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        canProceed: errors.length === 0
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Error validando navegación: ${error}`],
        warnings,
        suggestions,
        canProceed: false
      };
    }
  }

  private hasCircularNavigation(history: NavigationStep[], targetNodeId: string): boolean {
    const recentSteps = history.slice(-10); // Verificar solo los últimos 10 pasos
    const visitedNodes = recentSteps.map(step => step.toNodeId);
    
    // Detectar si el nodo objetivo ya fue visitado recientemente
    return visitedNodes.filter(nodeId => nodeId === targetNodeId).length > 2;
  }

  private async executeRollback(context: NavigationContext, rollbackNodeId: string): Promise<void> {
    logger.warn(`[DynamicNavigationService] Ejecutando rollback a nodo: ${rollbackNodeId}`);
    
    try {
      // Restaurar contexto previo si existe
      const lastStep = context.navigationHistory
        .slice()
        .reverse()
        .find(step => step.success && step.contextSnapshot);

      if (lastStep && lastStep.contextSnapshot) {
        Object.assign(context, lastStep.contextSnapshot);
        logger.info(`[DynamicNavigationService] Contexto restaurado desde snapshot`);
      }

    } catch (error) {
      logger.error(`[DynamicNavigationService] Error ejecutando rollback:`, error);
    }
  }

  /**
   * MÉTODOS DE GESTIÓN DE NODOS Y REGISTRY
   */

  async registerNode(node: NavigationNode): Promise<void> {
    this.nodeRegistry.set(node.nodeId, node);
    logger.debug(`[DynamicNavigationService] Nodo registrado: ${node.nodeId}`);
  }

  async getNode(nodeId: string): Promise<NavigationNode | null> {
    return this.nodeRegistry.get(nodeId) || null;
  }

  async registerFlow(templateId: string, nodes: NavigationNode[]): Promise<void> {
    this.flowRegistry.set(templateId, nodes);
    
    // Registrar nodos individuales también
    for (const node of nodes) {
      await this.registerNode(node);
    }
    
    logger.info(`[DynamicNavigationService] Flujo registrado: ${templateId} con ${nodes.length} nodos`);
  }

  async getFlow(templateId: string): Promise<NavigationNode[] | null> {
    return this.flowRegistry.get(templateId) || null;
  }

  /**
   * MÉTODOS PÚBLICOS PARA INTEGRACIÓN
   */

  async createNavigationContext(
    userId: string,
    tenantId: string,
    sessionId?: string,
    initialData?: Partial<NavigationContext>
  ): Promise<NavigationContext> {
    return {
      userId,
      tenantId,
      sessionId,
      conversationState: {
        isWaitingForInput: false,
        retryCount: 0,
        maxRetries: 3
      },
      navigationHistory: [],
      collectedData: {},
      globalVars: {},
      ...initialData
    };
  }

  async getNavigationHistory(sessionKey: string): Promise<NavigationStep[]> {
    return this.navigationQueue.get(sessionKey) || [];
  }

  async clearNavigationHistory(sessionKey: string): Promise<void> {
    this.navigationQueue.delete(sessionKey);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.navigationQueue.clear();
    this.processingQueue.clear();
    this.nodeRegistry.clear();
    this.flowRegistry.clear();
    logger.info(`[DynamicNavigationService] Servicio destruido`);
  }
}

export default DynamicNavigationService;
export type {
  NavigationNode,
  NodeData,
  NavigationContext,
  NavigationResult,
  NavigationOptions,
  NavigationStep,
  FlowValidationResult
};