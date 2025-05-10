/**
 * src/provider/providerFactory.ts
 *
 * Factory para crear proveedores de manera dinámica.
 * Permite seleccionar y cambiar entre diferentes proveedores.
 * @version 1.0.0
 * @updated 2025-04-17
 */

import { ProviderClass } from "@builderbot/bot";
import { config } from "../config";
import logger from "../utils/logger";
import { initWhatsAppProvider, WhatsAppProviderType } from "./whatsappProvider";
import { WebProvider } from "./webProvider";

// Tipos de proveedores disponibles
export type ProviderType = "web" | "whatsapp";

// Cache de instancias de proveedores
const providerInstances: Record<string, ProviderClass> = {};

/**
 * Obtiene una instancia de proveedor según el tipo especificado
 * @param type Tipo de proveedor a utilizar
 * @param options Opciones adicionales para el proveedor
 * @returns Instancia del proveedor
 */
export const getProvider = async (
  type: ProviderType,
  options: any = {}
): Promise<ProviderClass> => {
  // Generamos una clave única para este proveedor
  const cacheKey = `${type}-${JSON.stringify(options)}`;

  // Si ya existe una instancia para esta configuración, la devolvemos
  if (providerInstances[cacheKey]) {
    logger.info(`Usando proveedor existente: ${type}`);
    return providerInstances[cacheKey];
  }

  logger.info(`Inicializando proveedor: ${type}`);

  let provider: ProviderClass;

  // Creamos el proveedor según el tipo
  try {
    switch (type) {
      case "web":
        // Instanciamos el proveedor web para aplicaciones cliente
        provider = new WebProvider(
          options.userId || "anonymous",
          options.tenantId || config.multitenant.defaultTenant
        );
        break;

      case "whatsapp":
        // Instanciamos el proveedor de WhatsApp (Baileys o Meta)
        provider = await initWhatsAppProvider({
          name: options.name || config.whatsapp.sessionName,
          sessionDir: options.sessionDir || config.paths.sessions,
          qrPath: options.qrPath || `${config.paths.qr}/bot.qr.png`,
        });
        break;

      default:
        throw new Error(`Tipo de proveedor no soportado: ${type}`);
    }

    // Guardamos la instancia en caché
    providerInstances[cacheKey] = provider;

    return provider;
  } catch (error) {
    logger.error(`Error al inicializar proveedor ${type}:`, error);
    throw new Error(
      `Error al inicializar proveedor ${type}: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`
    );
  }
};

/**
 * Cambia el proveedor WhatsApp entre Baileys y Meta
 * @param whatsappType Tipo de proveedor WhatsApp ('baileys' o 'meta')
 * @param options Opciones adicionales
 */
export const switchWhatsAppProvider = async (
  whatsappType: WhatsAppProviderType,
  options: any = {}
): Promise<void> => {
  // Actualizamos la configuración
  config.whatsapp.provider = whatsappType;

  // Eliminamos todas las instancias de WhatsApp del caché
  for (const key of Object.keys(providerInstances)) {
    if (key.startsWith("whatsapp-")) {
      delete providerInstances[key];
    }
  }

  // La próxima vez que se solicite un proveedor WhatsApp,
  // se creará una nueva instancia con la configuración actualizada
  logger.info(`Configuración de proveedor WhatsApp cambiada a: ${whatsappType}`);
};
