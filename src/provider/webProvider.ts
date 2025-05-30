/**
 * src/provider/webProvider.ts
 *
 * Proveedor para comunicación vía API web.
 * Permite integrar Builderbot con aplicaciones web o móviles.
 * Soporta configuración de plantillas y personalización de comportamiento.
 * @version 1.1.0
 * @updated 2025-04-26
 */

import { ProviderClass } from "@builderbot/bot";
import { EventEmitter } from "events";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Proveedor personalizado para comunicación vía API web
 * Intercepta mensajes y los maneja sin enviarlos por WhatsApp
 */
export class WebProvider extends ProviderClass {
  declare vendor: EventEmitter;
  globalVendorArgs: any = {};
  busEvents = (): { event: string; func: Function; }[] => [];
  queueMessage: string | null = null;
  queuedMessages: string[] = []; // Para capturar todos los mensajes
  userId: string;
  tenantId: string;
  sessionId?: string;  // Añadir propiedad para sessionId
  templateConfig: Record<string, any> | null = null;
  messageMetadata: Record<string, any> = {};

  /**
   * Constructor del proveedor web
   * @param userId ID del usuario
   * @param tenantId ID del tenant
   * @param sessionId ID de la sesión (opcional)
   */
  constructor(userId: string, tenantId: string, sessionId?: string) {
    super();
    this.userId = userId;
    this.tenantId = tenantId;
    this.sessionId = sessionId;
    this.vendor = new EventEmitter();
    logger.info(`WebProvider inicializado para usuario ${userId} de tenant ${tenantId}${sessionId ? ` con sesión ${sessionId}` : ''}`);
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
   * Envía un mensaje simulado al bot para procesamiento
   * @param message Mensaje a procesar
   * @returns Respuesta del bot
   */
  async handleIncomingMessage(message: string): Promise<string> {
    logger.info(`[WebProvider] handleIncomingMessage: "${message}"`);
    
    // Reseteamos el estado
    this.queueMessage = null;
    this.queuedMessages = [];
    this.messageMetadata = {};

    // Si tenemos configuración de plantilla, la añadimos al contexto
    const additionalContext = this.templateConfig ? { templateConfig: this.templateConfig } : undefined;

    // Emitimos un evento simulado de mensaje con contexto adicional
    this.emit("message", {
      from: this.userId,
      body: message,
      // Añadimos datos de contexto para que flow pueda usarlos
      // Usamos metadatos para no interferir con la estructura core
      _metadata: additionalContext
    });

    // Esperamos hasta que tengamos respuesta (con timeout)
    let attempts = 0;
    while (this.queuedMessages.length === 0 && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    logger.info(`[WebProvider] Mensajes capturados: ${this.queuedMessages.length}`);
    logger.info(`[WebProvider] Mensajes: ${JSON.stringify(this.queuedMessages)}`);

    if (this.queuedMessages.length === 0) {
      return "Lo siento, no he podido procesar tu mensaje en este momento.";
    }

    // Concatenar todas las respuestas
    return this.queuedMessages.join('\n');
  }

  /**
   * Obtiene metadatos del último mensaje procesado
   * @returns Objeto con metadatos (tokens, etc.)
   */
  getMessageMetadata(): Record<string, any> {
    return { ...this.messageMetadata };
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
  on(eventName: string, callback: Function) {
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
   * Cierra la conexión del proveedor
   */
  async close() {
    logger.info(`[WebProvider] Cerrando conexión para ${this.userId}`);
    return true;
  }
}

/**
 * Crea una instancia del proveedor web
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de la sesión (opcional)
 * @returns Instancia del proveedor web
 */
export const createWebProvider = (
  userId: string,
  tenantId: string = config.multitenant.defaultTenant,
  sessionId?: string
): WebProvider => {
  return new WebProvider(userId, tenantId, sessionId);
};

export default WebProvider;
