/**
 * src/provider/webProvider.ts
 *
 * Proveedor para comunicación vía API web.
 * Permite integrar Builderbot con aplicaciones web o móviles.
 * Soporta configuración de plantillas y personalización de comportamiento.
 * 
 * ACTUALIZACIÓN V2: Integración con ImprovedSessionManager
 * - Soporte para sesiones persistentes
 * - Cache inteligente de contexto
 * - Preservación de estado entre requests
 * - Optimización para arquitectura multi-tenant
 * 
 * @version 2.0.0
 * @updated 2025-06-26
 */

import { ProviderClass } from "@builderbot/bot";
import { EventEmitter } from "events";
import { config } from "../config";
import logger from "../utils/logger";
import ImprovedSessionManager from "../services/improvedSessionManager";
import type { PersistentSession, SessionContextData } from "../services/improvedSessionManager";

/**
 * Proveedor personalizado para comunicación vía API web
 * Intercepta mensajes y los maneja sin enviarlos por WhatsApp
 * 
 * INTEGRACIÓN V2: Usa ImprovedSessionManager para persistencia
 */
export class WebProvider extends ProviderClass {
  declare vendor: EventEmitter;
  globalVendorArgs: any = {};
  busEvents = (): { event: string; func: Function; }[] => [];
  queueMessage: string | null = null;
  queuedMessages: string[] = []; // Para capturar todos los mensajes
  userId: string;
  tenantId: string;
  sessionId?: string;  // ID de sesión persistente
  templateConfig: Record<string, any> | null = null;
  messageMetadata: Record<string, any> = {};
  
  // NUEVAS PROPIEDADES V2: GESTIÓN DE SESIONES PERSISTENTES
  private sessionManager: ImprovedSessionManager;
  private currentSession: PersistentSession | null = null;
  private contextData: SessionContextData | null = null;
  private sessionInitialized: boolean = false;

  /**
   * Constructor del proveedor web con gestión de sesiones persistentes
   * @param userId ID del usuario
   * @param tenantId ID del tenant
   * @param sessionId ID de la sesión (opcional, se genera/recupera automáticamente)
   */
  constructor(userId: string, tenantId: string, sessionId?: string) {
    super();
    this.userId = userId;
    this.tenantId = tenantId;
    this.sessionId = sessionId;
    this.vendor = new EventEmitter();
    
    // Inicializar gestión de sesiones persistentes
    this.sessionManager = ImprovedSessionManager.getInstance();
    
    logger.info(`WebProvider V2 inicializado para usuario ${userId} de tenant ${tenantId}${sessionId ? ` con sesión ${sessionId}` : ' (sesión auto-gestionada)'}`);
    
    // Inicializar sesión persistente de forma asíncrona (no bloquear constructor)
    this.initializePersistentSession().catch(error => {
      logger.error(`[WebProvider] Error inicializando sesión persistente:`, error);
    });
  }

  /**
   * MÉTODO V2: Inicializar sesión persistente
   * Obtiene o crea una sesión persistente para el usuario/tenant
   */
  private async initializePersistentSession(): Promise<void> {
    try {
      logger.info(`[WebProvider] Inicializando sesión persistente para ${this.userId}@${this.tenantId}`);
      
      // Obtener o crear sesión persistente
      this.currentSession = await this.sessionManager.getOrCreateSession(
        this.userId,
        this.tenantId,
        {
          platform: 'web',
          priority: 'normal',
          forceNew: false, // Reutilizar sesión existente si está disponible
          metadata: {
            userAgent: 'WebProvider-V2',
            tags: ['web_provider', 'persistent_session']
          }
        }
      );

      // Actualizar sessionId si no estaba definido
      if (!this.sessionId) {
        this.sessionId = this.currentSession.sessionId;
      }

      // Cargar contexto de sesión
      this.contextData = await this.sessionManager.getSessionContext(this.currentSession.sessionId);
      
      this.sessionInitialized = true;
      logger.info(`[WebProvider] Sesión persistente inicializada: ${this.currentSession.sessionId}`);
      
    } catch (error) {
      logger.error(`[WebProvider] Error inicializando sesión persistente:`, error);
      // Continuar sin sesión persistente (fallback al comportamiento original)
      this.sessionInitialized = false;
    }
  }

  /**
   * MÉTODO V2: Asegurar que la sesión esté inicializada
   * Espera hasta que la sesión persistente esté lista
   */
  private async ensureSessionInitialized(): Promise<void> {
    if (this.sessionInitialized && this.currentSession) {
      return;
    }

    // Esperar hasta que la sesión esté inicializada (con timeout)
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo
    
    while (!this.sessionInitialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.sessionInitialized) {
      logger.warn(`[WebProvider] Timeout esperando inicialización de sesión, continuando sin persistencia`);
    }
  }

  /**
   * MÉTODO V2: Actualizar contexto de sesión
   * Preserva el estado entre requests
   */
  private async updateSessionContext(contextUpdates: Partial<SessionContextData>): Promise<void> {
    if (!this.currentSession || !this.sessionInitialized) {
      return;
    }

    try {
      // Actualizar contexto local
      if (this.contextData) {
        this.contextData = {
          ...this.contextData,
          ...contextUpdates
        };
      }

      // Persistir cambios
      await this.sessionManager.updateSessionContext(
        this.currentSession.sessionId,
        contextUpdates
      );

      // Actualizar actividad de sesión
      await this.sessionManager.updateSessionActivity(this.currentSession.sessionId, {
        lastActivityAt: new Date().toISOString(),
        contextData: this.contextData
      });

      logger.debug(`[WebProvider] Contexto de sesión actualizado para ${this.currentSession.sessionId}`);
      
    } catch (error) {
      logger.error(`[WebProvider] Error actualizando contexto de sesión:`, error);
    }
  }

  /**
   * MÉTODO V2: Obtener contexto preservado de sesión
   * Recupera datos persistidos entre requests
   */
  async getPreservedContext(): Promise<SessionContextData | null> {
    await this.ensureSessionInitialized();
    
    if (!this.currentSession) {
      return null;
    }

    return this.contextData;
  }

  /**
   * MÉTODO V2: Preservar datos de conversación
   * Guarda información importante para mantener contexto
   */
  async preserveConversationData(data: {
    message?: string;
    response?: string;
    nodeId?: string;
    flowType?: string;
    collectedData?: Record<string, any>;
  }): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const contextUpdates: Partial<SessionContextData> = {};

    // Agregar mensaje a historial de conversación
    if (data.message || data.response) {
      const conversationEntry = {
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: data.message ? 'user' : 'bot' as 'user' | 'bot',
        content: data.message || data.response || '',
        nodeId: data.nodeId
      };

      if (!this.contextData?.conversationHistory) {
        contextUpdates.conversationHistory = [conversationEntry];
      } else {
        contextUpdates.conversationHistory = [
          ...this.contextData.conversationHistory,
          conversationEntry
        ];
      }
    }

    // Actualizar datos recolectados
    if (data.collectedData) {
      contextUpdates.collectedData = {
        ...(this.contextData?.collectedData || {}),
        ...data.collectedData
      };
    }

    // Actualizar navegación de flujo
    if (data.nodeId && data.flowType) {
      const flowEntry = {
        timestamp: new Date().toISOString(),
        fromNodeId: this.contextData?.currentNodeId,
        toNodeId: data.nodeId,
        flowType: data.flowType,
        success: true
      };

      if (!this.contextData?.flowHistory) {
        contextUpdates.flowHistory = [flowEntry];
      } else {
        contextUpdates.flowHistory = [
          ...this.contextData.flowHistory,
          flowEntry
        ];
      }

      contextUpdates.currentNodeId = data.nodeId;
    }

    await this.updateSessionContext(contextUpdates);
  }

  /**
   * Configura el proveedor con la configuración de una plantilla
   * @param config Configuración de la plantilla
   */
  setTemplateConfiguration(config: Record<string, any>): void {
    this.templateConfig = config;
    logger.debug(`Configuración de plantilla aplicada para usuario ${this.userId}`, config);
  }

  /**
   * Método para enviar mensajes (lo interceptamos para devolverlos en vez de enviarlos)
   * @param userId ID del usuario
   * @param message Mensaje a enviar
   * @param options Opciones adicionales
   * @returns true si se procesó correctamente
   */
  async sendMessage(userId: string, message: any, options?: any): Promise<any> {
    logger.info(`[WebProvider] sendMessage llamado`);
    logger.info(`[WebProvider] userId: ${userId}`);
    logger.info(`[WebProvider] mensaje:`, JSON.stringify(message));
    logger.info(`[WebProvider] tipo de mensaje: ${typeof message}`);
    logger.info(`[WebProvider] this.userId: ${this.userId}`);
    
    // Solo procesamos si el userId coincide
    // El this.userId puede tener el formato userId-sessionId, extraemos solo el userId base
    const baseUserId = this.userId.includes('-') && this.sessionId 
      ? this.userId.replace(`-${this.sessionId}`, '') 
      : this.userId;
    
    if (userId !== this.userId && userId !== baseUserId) {
      logger.warn(`[WebProvider] userId no coincide (recibido: ${userId}, esperado: ${this.userId} o ${baseUserId}), ignorando mensaje`);
      return true as any;
    }
    
    // Si el mensaje es un objeto con body y buttons
    if (typeof message === 'object' && message !== null) {
      logger.info(`[WebProvider] Mensaje es un objeto con posibles botones`);
      logger.info(`[WebProvider] message.body:`, message.body);
      logger.info(`[WebProvider] message.buttons:`, JSON.stringify(message.buttons));
      
      if (message.body !== undefined) {
        this.queueMessage = message.body;
        this.queuedMessages.push(message.body);
      }
      
      // Guardar botones para el frontend
      if (message.buttons && Array.isArray(message.buttons)) {
        this.messageMetadata.buttons = message.buttons;
      }
      
    } else {
      // Mensaje normal (string)
      this.queueMessage = message;
      this.queuedMessages.push(message);
    }
    
    logger.info(`[WebProvider] Total de mensajes en cola: ${this.queuedMessages.length}`);
    logger.info(`[WebProvider] Mensajes actuales: ${JSON.stringify(this.queuedMessages)}`);
    logger.info(`[WebProvider] Metadata actual:`, JSON.stringify(this.messageMetadata));
    
    // Si hay options, extraemos cualquier metadato relevante
    if (options) {
      logger.info(`[WebProvider] Options recibidas: ${JSON.stringify(options)}`);
      if (options.tokenCount) {
        this.messageMetadata.tokensUsed = options.tokenCount;
      }
    }
    
    return true as any;
  }

  /**
   * Inicializa el proveedor
   * @returns true si se inicializó correctamente
   */
  async init() {
    logger.info(`[WebProvider] Inicializado para tenant ${this.tenantId}`);
    return true;
  }

  /**
   * Obtiene la instancia del proveedor
   * @returns La instancia actual
   */
  async getInstance() {
    return this;
  }

  /**
   * Hook antes de inicializar el servidor HTTP
   */
  async beforeHttpServerInit(): Promise<void> {
    // No necesitamos hacer nada específico
  }

  /**
   * Hook después de inicializar el servidor HTTP
   */
  async afterHttpServerInit(): Promise<void> {
    // No necesitamos hacer nada específico
  }

  /**
   * Envía media (no implementado en web provider)
   */
  async sendMedia(userId: string, mediaUrl: string, text?: string): Promise<any> {
    logger.warn(`[WebProvider] sendMedia no implementado para usuario ${userId}`);
    return this.sendMessage(userId, text || `[Media: ${mediaUrl}]`);
  }

  /**
   * Envía botones
   * @param userId ID del usuario
   * @param buttons Array de botones
   * @param text Texto que acompaña a los botones
   */
  async sendButtons(userId: string, buttons: any[], text?: string): Promise<any> {
    logger.info(`[WebProvider] sendButtons para usuario ${userId}`);
    logger.info(`[WebProvider] Botones:`, JSON.stringify(buttons));
    logger.info(`[WebProvider] Texto:`, text);
    
    // Almacenar botones como metadatos pero sin enviarlos como mensaje
    const messageWithButtons = {
      body: text || '',
      buttons: buttons
    };
    
    // Si hay texto, enviarlo como un mensaje regular
    if (text) {
      await this.sendMessage(userId, text);
    }
    
    // NO enviar los botones como texto JSON
    // Los botones deben estar en los metadatos
    
    return messageWithButtons;
  }

  /**
   * Inicializa el vendor (no necesario para web provider)
   */
  async initVendor(): Promise<any> {
    logger.info(`[WebProvider] initVendor llamado`);
    return this.vendor;
  }

  /**
   * Guarda un archivo (no implementado en web provider)
   */
  async saveFile(path: string, content: any): Promise<string> {
    logger.warn(`[WebProvider] saveFile no implementado`);
    return path;
  }

  /**
   * Envía un mensaje simulado al bot para procesamiento con sesiones persistentes
   * @param message Mensaje a procesar
   * @returns Respuesta del bot
   */
  async handleIncomingMessage(message: string): Promise<string> {
    logger.info(`[WebProvider V2] handleIncomingMessage: "${message}"`);
    
    // PASO 1: Asegurar que la sesión persistente esté inicializada
    await this.ensureSessionInitialized();
    
    // PASO 2: Preservar mensaje de entrada en contexto de sesión
    await this.preserveConversationData({
      message,
      nodeId: this.contextData?.currentNodeId,
      flowType: 'incoming_message'
    });

    // PASO 3: Reseteamos el estado local para capturar nueva respuesta
    this.queueMessage = null;
    this.queuedMessages = [];
    this.messageMetadata = {};

    // PASO 4: Preparar contexto enriquecido para el mensaje
    const enrichedContext = {
      // Contexto original
      templateConfig: this.templateConfig,
      
      // NUEVO: Contexto de sesión persistente
      sessionId: this.sessionId,
      persistentSession: this.currentSession,
      preservedContext: this.contextData,
      
      // Datos históricos de la conversación
      conversationHistory: this.contextData?.conversationHistory || [],
      collectedData: this.contextData?.collectedData || {},
      currentNodeId: this.contextData?.currentNodeId,
      
      // Metadatos de sesión
      sessionMetadata: {
        userId: this.userId,
        tenantId: this.tenantId,
        platform: 'web',
        sessionInitialized: this.sessionInitialized
      }
    };

    // PASO 5: Emitir evento con contexto enriquecido
    this.emit("message", {
      from: this.userId,
      body: message,
      // CRUCIAL: Contexto enriquecido para que los flows puedan usar datos persistentes
      _metadata: enrichedContext,
      // NUEVO: ID de sesión para tracking
      _sessionId: this.sessionId
    });

    // PASO 6: Esperar respuesta con timeout mejorado
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos
    
    while (this.queuedMessages.length === 0 && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    logger.info(`[WebProvider V2] Mensajes capturados: ${this.queuedMessages.length}`);
    logger.info(`[WebProvider V2] Mensajes: ${JSON.stringify(this.queuedMessages)}`);

    // PASO 7: Procesar respuesta obtenida
    let finalResponse: string;
    
    if (this.queuedMessages.length === 0) {
      finalResponse = "Lo siento, no he podido procesar tu mensaje en este momento.";
      logger.warn(`[WebProvider V2] No se capturaron mensajes para usuario ${this.userId}`);
    } else {
      // Concatenar todas las respuestas
      finalResponse = this.queuedMessages.join('\n');
    }

    // PASO 8: Preservar respuesta en contexto de sesión
    await this.preserveConversationData({
      response: finalResponse,
      nodeId: this.contextData?.currentNodeId,
      flowType: 'bot_response'
    });

    logger.info(`[WebProvider V2] Respuesta final para ${this.userId}: "${finalResponse}"`);
    
    return finalResponse;
  }

  /**
   * Obtiene metadatos del último mensaje procesado (MEJORADO V2)
   * @returns Objeto con metadatos (tokens, sesión, etc.)
   */
  getMessageMetadata(): Record<string, any> {
    return { 
      ...this.messageMetadata,
      // NUEVO V2: Información de sesión
      sessionId: this.sessionId,
      sessionInitialized: this.sessionInitialized,
      hasPersistedContext: !!this.contextData,
      conversationLength: this.contextData?.conversationHistory?.length || 0
    };
  }

  /**
   * Obtiene todas las respuestas capturadas
   * @returns Array de mensajes
   */
  getAllResponses(): string[] {
    return this.queuedMessages;
  }

  /**
   * Limpia la cola de mensajes
   */
  clearQueue(): void {
    this.queuedMessages = [];
    this.queueMessage = null;
  }

  /**
   * Registrar un listener de eventos
   * @param eventName Nombre del evento
   * @param callback Función callback
   */
  on(eventName: string, callback: (...args: any[]) => void) {
    logger.info(`[WebProvider] Registrando listener para evento: ${eventName}`);
    this.vendor.on(eventName, callback);
  }

  /**
   * Emitir un evento a través del vendor
   * @param eventName Nombre del evento
   * @param args Argumentos del evento
   */
  emit(eventName: string, ...args: any[]) {
    logger.info(`[WebProvider] Emitiendo evento: ${eventName}`);
    this.vendor.emit(eventName, ...args);
  }

  /**
   * Método para simular un mensaje recibido (útil para pruebas)
   * @param message Mensaje a simular
   */
  simulateIncomingMessage(message: { from: string; body: string }) {
    this.emit('message', message);
  }

  /**
   * MÉTODO V2: Obtener información completa de sesión
   * Permite acceso a toda la información de sesión persistente
   */
  async getSessionInfo(): Promise<{
    sessionId?: string;
    userId: string;
    tenantId: string;
    initialized: boolean;
    contextData: SessionContextData | null;
    conversationLength: number;
    lastActivity?: string;
  }> {
    await this.ensureSessionInitialized();
    
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      tenantId: this.tenantId,
      initialized: this.sessionInitialized,
      contextData: this.contextData,
      conversationLength: this.contextData?.conversationHistory?.length || 0,
      lastActivity: this.currentSession?.lastActivityAt
    };
  }

  /**
   * MÉTODO V2: Forzar creación de nueva sesión
   * Útil para reiniciar conversación desde cero
   */
  async createNewSession(): Promise<string | null> {
    try {
      // Terminar sesión actual si existe
      if (this.currentSession) {
        await this.sessionManager.endSession(this.currentSession.sessionId, 'user_reset');
      }

      // Crear nueva sesión
      this.currentSession = await this.sessionManager.getOrCreateSession(
        this.userId,
        this.tenantId,
        {
          platform: 'web',
          priority: 'normal',
          forceNew: true, // Forzar nueva sesión
          metadata: {
            userAgent: 'WebProvider-V2-Reset',
            tags: ['web_provider', 'new_session', 'user_reset']
          }
        }
      );

      this.sessionId = this.currentSession.sessionId;
      this.contextData = await this.sessionManager.getSessionContext(this.currentSession.sessionId);
      this.sessionInitialized = true;

      logger.info(`[WebProvider V2] Nueva sesión creada: ${this.sessionId}`);
      return this.sessionId;
      
    } catch (error) {
      logger.error(`[WebProvider V2] Error creando nueva sesión:`, error);
      return null;
    }
  }

  /**
   * MÉTODO V2: Limpiar contexto de sesión
   * Mantiene la sesión pero limpia el historial
   */
  async clearSessionContext(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const clearedContext: Partial<SessionContextData> = {
      collectedData: {},
      conversationHistory: [],
      flowHistory: [],
      temporaryData: {},
      currentNodeId: undefined
    };

    await this.updateSessionContext(clearedContext);
    logger.info(`[WebProvider V2] Contexto de sesión limpiado para ${this.sessionId}`);
  }

  /**
   * Cierra la conexión del proveedor (MEJORADO V2)
   * Preserva sesión para futuras conexiones
   */
  async close() {
    logger.info(`[WebProvider V2] Cerrando conexión para ${this.userId}`);
    
    // NUEVO V2: Actualizar sesión antes de cerrar
    if (this.currentSession && this.sessionInitialized) {
      try {
        await this.sessionManager.updateSessionActivity(this.currentSession.sessionId, {
          lastActivityAt: new Date().toISOString(),
          metadata: {
            ...this.currentSession.metadata,
            tags: [...(this.currentSession.metadata.tags || []), 'connection_closed']
          }
        });
        
        logger.info(`[WebProvider V2] Sesión ${this.sessionId} actualizada antes del cierre`);
      } catch (error) {
        logger.error(`[WebProvider V2] Error actualizando sesión al cerrar:`, error);
      }
    }
    
    // Limpiar referencias locales pero NO terminar la sesión persistente
    this.currentSession = null;
    this.contextData = null;
    this.sessionInitialized = false;
    
    return true;
  }
}

/**
 * Crea una instancia del proveedor web con sesiones persistentes V2
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de la sesión (opcional, se auto-gestiona)
 * @returns Instancia del proveedor web con soporte para sesiones persistentes
 */
export const createWebProvider = (
  userId: string,
  tenantId: string = config.multitenant.defaultTenant,
  sessionId?: string
): WebProvider => {
  const provider = new WebProvider(userId, tenantId, sessionId);
  
  logger.info(`[createWebProvider V2] Proveedor creado para ${userId}@${tenantId} con gestión de sesiones persistentes`);
  
  return provider;
};

/**
 * NUEVA FUNCIÓN V2: Crear proveedor con sesión específica
 * Útil para recuperar una sesión existente específica
 */
export const createWebProviderWithSession = async (
  userId: string,
  tenantId: string,
  sessionId: string
): Promise<WebProvider> => {
  const provider = new WebProvider(userId, tenantId, sessionId);
  
  // Esperar a que la sesión se inicialice
  await provider.getSessionInfo();
  
  logger.info(`[createWebProviderWithSession V2] Proveedor creado con sesión específica ${sessionId}`);
  
  return provider;
};

/**
 * NUEVA FUNCIÓN V2: Crear proveedor con nueva sesión forzada
 * Útil para conversaciones completamente nuevas
 */
export const createWebProviderNewSession = async (
  userId: string,
  tenantId: string
): Promise<WebProvider> => {
  const provider = new WebProvider(userId, tenantId);
  
  // Forzar creación de nueva sesión
  await provider.createNewSession();
  
  logger.info(`[createWebProviderNewSession V2] Proveedor creado con nueva sesión para ${userId}@${tenantId}`);
  
  return provider;
};

export default WebProvider;
