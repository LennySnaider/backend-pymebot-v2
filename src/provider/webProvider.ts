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
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Proveedor personalizado para comunicación vía API web
 * Intercepta mensajes y los maneja sin enviarlos por WhatsApp
 */
export class WebProvider extends ProviderClass {
  queueMessage: string | null = null;
  userId: string;
  tenantId: string;
  templateConfig: Record<string, any> | null = null;
  messageMetadata: Record<string, any> = {};

  /**
   * Constructor del proveedor web
   * @param userId ID del usuario
   * @param tenantId ID del tenant
   */
  constructor(userId: string, tenantId: string) {
    super();
    this.userId = userId;
    this.tenantId = tenantId;
    logger.info(`WebProvider inicializado para usuario ${userId} de tenant ${tenantId}`);
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
  async sendMessage(userId: string, message: string, options?: any) {
    logger.info(`[WebProvider] Mensaje para ${userId}: ${message}`);
    
    // Guardamos el mensaje y cualquier metadato adicional
    this.queueMessage = message;
    
    // Si hay options, extraemos cualquier metadato relevante
    if (options) {
      if (options.tokenCount) {
        this.messageMetadata.tokensUsed = options.tokenCount;
      }
    }
    
    return true;
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
   * Envía un mensaje simulado al bot para procesamiento
   * @param message Mensaje a procesar
   * @returns Respuesta del bot
   */
  async handleIncomingMessage(message: string): Promise<string> {
    // Reseteamos el estado
    this.queueMessage = null;
    this.messageMetadata = {};

    // Si tenemos configuración de plantilla, la añadimos al contexto
    const additionalContext = this.templateConfig ? { templateConfig: this.templateConfig } : undefined;

    // Emitimos un evento simulado de mensaje con contexto adicional
    await this.emit("message", {
      from: this.userId,
      body: message,
      // Añadimos datos de contexto para que flow pueda usarlos
      // Usamos metadatos para no interferir con la estructura core
      _metadata: additionalContext
    });

    // Esperamos hasta que tengamos respuesta (con timeout)
    let attempts = 0;
    while (!this.queueMessage && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.queueMessage) {
      return "Lo siento, no he podido procesar tu mensaje en este momento.";
    }

    return this.queueMessage;
  }

  /**
   * Obtiene metadatos del último mensaje procesado
   * @returns Objeto con metadatos (tokens, etc.)
   */
  getMessageMetadata(): Record<string, any> {
    return { ...this.messageMetadata };
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
 * @returns Instancia del proveedor web
 */
export const createWebProvider = (
  userId: string,
  tenantId: string = config.multitenant.defaultTenant
): WebProvider => {
  return new WebProvider(userId, tenantId);
};

export default WebProvider;
