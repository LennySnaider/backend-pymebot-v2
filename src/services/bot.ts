/**
 * src/services/bot.ts
 *
 * Servicio para procesar mensajes con BuilderBot.
 * Gestiona los flujos conversacionales con soporte multitenant.
 * @version 2.0.0
 * @updated 2025-04-17
 */

import { createBot, createFlow, MemoryDB } from "@builderbot/bot";
import { config } from "../config";
import logger from "../utils/logger";
import { WebProvider } from "../provider/webProvider";
import {
  getProvider,
  switchWhatsAppProvider,
} from "../provider/providerFactory";

// Los flujos predeterminados han sido desactivados para forzar el uso de plantillas configuradas
// import welcomeFlow from "../flows/welcome.flow";
// import infoFlow from "../flows/info.flow";

// Caché de instancias de bot por tenant
const botInstances: Record<string, any> = {};
const providerInstances: Record<string, WebProvider> = {};

/**
 * Obtiene o crea un proveedor web para un usuario y tenant
 * @param userId ID de usuario
 * @param tenantId ID de tenant
 * @returns Instancia de proveedor web
 */
const getWebProvider = (userId: string, tenantId: string): WebProvider => {
  const key = `${tenantId}-${userId}`;

  if (!providerInstances[key]) {
    providerInstances[key] = new WebProvider(userId, tenantId);
  }

  return providerInstances[key];
};

/**
 * Obtiene la instancia de bot para un tenant específico
 * @param tenantId ID del tenant
 * @param userId ID de usuario (para contexto)
 * @returns Instancia de bot configurada
 */
const getBotInstance = (tenantId: string, userId: string): any => {
  // Si ya existe una instancia para este tenant, la devolvemos
  if (botInstances[tenantId]) {
    return botInstances[tenantId];
  }

  logger.info(`Creando nueva instancia de bot para tenant: ${tenantId}`);

  // Obtenemos el proveedor web personalizado
  const provider = getWebProvider(userId, tenantId);

  // Creamos un flujo vacío ya que los flujos predeterminados han sido desactivados
  const flow = createFlow([]);

  // Configuramos la base de datos con MemoryDB (compatible con keyPrefix)
  const database = new MemoryDB({
    // Usamos un prefijo para aislar datos por tenant
    keyPrefix: `${tenantId}-`,
  });

  // Creamos el bot con nuestro provider personalizado
  const bot = createBot({
    flow,
    database,
    provider, // Usamos nuestro provider personalizado
  });

  // Guardamos la instancia en caché
  botInstances[tenantId] = bot;

  return bot;
};

/**
 * Procesa un mensaje de texto usando BuilderBot
 * @param text Texto del mensaje a procesar
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @returns Promesa con el texto de respuesta
 */
export const processMessage = async (
  text: string,
  userId: string,
  tenantId: string = config.multitenant.defaultTenant,
  skipBuiltinResponse: boolean = false,
  sessionId?: string,
  botId?: string,
  templateConfig?: any
): Promise<string | { text: string; tokensUsed: number }> => {
  try {
    logger.info(
      `Procesando mensaje para usuario ${userId} de tenant ${tenantId}: "${text}"`
    );

    // Ahora que los flujos predeterminados están desactivados, retornamos un mensaje de error
    // indicando que se debe usar una plantilla configurada
    logger.warn("Se intentó procesar un mensaje sin plantilla configurada");

    return {
      text: "⚠️ ERROR: No se ha configurado ninguna plantilla de chatbot. Por favor, seleccione una plantilla válida para utilizar el servicio.",
      tokensUsed: 0
    };

  } catch (error) {
    logger.error("Error al procesar mensaje con BuilderBot:", error);
    throw new Error(
      "Error al procesar mensaje: " +
        (error instanceof Error ? error.message : "Error desconocido")
    );
  }
};

/**
 * Limpia la conversación para un usuario y tenant específicos
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 */
export const clearConversation = async (
  userId: string,
  tenantId: string = config.multitenant.defaultTenant
): Promise<void> => {
  // Eliminamos la instancia del proveedor para forzar un nuevo contexto
  const key = `${tenantId}-${userId}`;
  if (providerInstances[key]) {
    delete providerInstances[key];
    logger.info(`Conversación reiniciada para ${userId} en tenant ${tenantId}`);
  }
};

/**
 * Cambia el proveedor de WhatsApp entre Baileys y Meta
 * @param provider Nombre del proveedor ('baileys' o 'meta')
 */
export const changeWhatsAppProvider = async (
  provider: "baileys" | "meta"
): Promise<void> => {
  // Utilizamos la función del factory para cambiar el proveedor
  await switchWhatsAppProvider(provider);
  logger.info(`Proveedor de WhatsApp cambiado a: ${provider}`);
};
