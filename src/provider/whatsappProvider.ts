/**
 * src/provider/whatsappProvider.ts
 *
 * Servicio para gestionar proveedores de WhatsApp.
 * Permite cambiar entre Baileys y Meta API fácilmente.
 * @version 1.0.0
 * @updated 2024-04-16
 */

import { createProvider, ProviderClass } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { TwilioProvider } from "@builderbot/provider-twilio";
import { config } from "../config";
import logger from "../utils/logger";
import path from "path";
import fs from "fs";
import qrImage from "qr-image"; // Importamos qr-image para generar el QR manualmente

// Tipos de proveedores soportados
export type WhatsAppProviderType = "baileys" | "meta" | "twilio";

// Opciones para inicializar el proveedor
export interface WhatsAppProviderOptions {
  name?: string;
  sessionDir?: string;
  qrPath?: string;
}

// Estado global del proveedor
let activeProvider: ProviderClass | null = null;
let activeProviderType: WhatsAppProviderType = "baileys";

/**
 * Inicializa el proveedor de WhatsApp según la configuración
 * @param options Opciones adicionales
 * @returns Instancia del proveedor
 */
export const initWhatsAppProvider = async (
  options: WhatsAppProviderOptions = {}
): Promise<ProviderClass> => {
  // Si ya hay un proveedor activo, lo devolvemos
  if (activeProvider) {
    logger.info(
      `Usando proveedor de WhatsApp existente: ${activeProviderType}`
    );
    return activeProvider;
  }

  // Configuramos opciones con valores por defecto
  const providerOptions = {
    name: options.name || config.whatsapp.sessionName,
    sessionDir: options.sessionDir || config.paths.sessions,
    qrPath: options.qrPath || path.join(config.paths.qr, "bot.qr.png"),
  };

  // Determinamos el tipo de proveedor
  const providerType = config.whatsapp.provider as WhatsAppProviderType;
  activeProviderType = providerType;

  logger.info(
    `Inicializando proveedor de WhatsApp: ${providerType}`,
    providerOptions
  );

  try {
    // Inicializamos según el tipo
    if (providerType === "baileys") {
      // Aseguramos que el directorio de sesiones existe
      if (!fs.existsSync(providerOptions.sessionDir)) {
        fs.mkdirSync(providerOptions.sessionDir, { recursive: true });
      }

      // Inicializamos Baileys
      // Inicializamos el proveedor Baileys
      activeProvider = createProvider(BaileysProvider, {
        name: providerOptions.name,
        sessionDir: providerOptions.sessionDir,
        qrPath: providerOptions.qrPath,
      });

      // Añadir listeners de eventos y generación manual del QR
      if (activeProvider) {
        // Listener para el evento require_action (QR)
        activeProvider.on("require_action", (data) => {
          // Si recibimos un QR, lo generamos manualmente
          if (data && data.payload && data.payload.qr) {
            const qrString = data.payload.qr;

            // Generamos y guardamos el QR manualmente
            try {
              const qrPath = path.join(config.paths.qr, "bot.qr.png");

              // Aseguramos que el directorio existe
              const qrDir = path.dirname(qrPath);
              if (!fs.existsSync(qrDir)) {
                fs.mkdirSync(qrDir, { recursive: true });
              }

              // Generamos el QR como PNG
              const qrPng = qrImage.image(qrString, { type: "png" });
              const qrFile = fs.createWriteStream(qrPath);
              qrPng.pipe(qrFile);

              qrFile.on("error", (err) => {
                logger.error(`Error al guardar QR manualmente: ${err}`);
              });
            } catch (error) {
              logger.error(`Error al generar QR manualmente: ${error}`);
            }
          }
        });

        // Otros eventos importantes
        activeProvider.on("ready", () => {
          logger.info("Conexión con WhatsApp establecida");
        });

        activeProvider.on("error", (err) => {
          logger.error("Error en el proveedor de WhatsApp:", err);
        });

        activeProvider.on("auth_failure", (err) => {
          logger.error("Fallo de autenticación en WhatsApp:", err);
        });
      }

      return activeProvider;
    }

    // Twilio provider
    else if (providerType === "twilio") {
      logger.info("Configurando proveedor Twilio para WhatsApp");
      
      // Debug de variables de entorno
      logger.info(`TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET'}`);
      logger.info(`TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET'}`);
      logger.info(`TWILIO_PHONE_NUMBER: ${process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_PHONE_NUMBER : 'NOT SET'}`);
      
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        throw new Error("Faltan credenciales de Twilio en las variables de entorno");
      }
      
      // Para Twilio, necesitamos pasar el número sin el prefijo 'whatsapp:'
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER?.replace('whatsapp:', '') || '';
      
      activeProvider = createProvider(TwilioProvider, {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: twilioNumber,
        publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3090}`,
      });

      activeProviderType = "twilio";
      logger.info("Proveedor Twilio configurado exitosamente");
      return activeProvider;
    }

    // Meta provider (implementación futura)
    else if (providerType === "meta") {
      // Para implementar cuando se tenga acceso a Meta API
      throw new Error("Proveedor Meta no implementado aún");
    }

    // Proveedor desconocido
    else {
      throw new Error(`Tipo de proveedor desconocido: ${providerType}`);
    }
  } catch (error) {
    logger.error(`Error al inicializar proveedor de WhatsApp: ${error}`, error);
    throw error;
  }
};

/**
 * Cambia el proveedor de WhatsApp en tiempo de ejecución
 * @param providerType Tipo de proveedor a utilizar
 * @param options Opciones adicionales
 * @returns Promesa que resuelve cuando se completa el cambio
 */
export const changeWhatsAppProvider = async (
  providerType: WhatsAppProviderType,
  options: WhatsAppProviderOptions = {}
): Promise<void> => {
  // Si ya estamos usando este proveedor, no hacemos nada
  if (activeProviderType === providerType && activeProvider) {
    logger.info(`Ya se está utilizando el proveedor: ${providerType}`);
    return;
  }

  logger.info(`Cambiando proveedor de WhatsApp a: ${providerType}`);

  try {
    // Cerramos el proveedor actual si existe
    if (activeProvider) {
      // Intentamos cerrar limpiamente
      try {
        const instance = await activeProvider.getInstance(); // Usamos await directamente
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (instance && typeof (instance as any).close === "function") {
          // Volvemos a 'as any' con disable
          // Verificamos el método
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (instance as any).close?.(); // Volvemos a 'as any' con disable y await
        }
      } catch (error) {
        logger.warn(`Error al cerrar proveedor actual: ${error}`);
      }

      activeProvider = null;
    }

    // Actualizamos la configuración
    config.whatsapp.provider = providerType;

    // Inicializamos el nuevo proveedor
    await initWhatsAppProvider(options);

    logger.info(
      `Proveedor de WhatsApp cambiado exitosamente a: ${providerType}`
    );
  } catch (error) {
    logger.error(`Error al cambiar proveedor de WhatsApp: ${error}`, error);
    throw error;
  }
};

/**
 * Obtiene el proveedor activo actual
 * @returns Información sobre el proveedor activo
 */
export const getActiveProvider = (): {
  type: WhatsAppProviderType;
  instance: ProviderClass | null;
} => {
  return {
    type: activeProviderType,
    instance: activeProvider,
  };
};

/**
 * Cierra la conexión del proveedor activo
 * @returns Promesa que resuelve cuando se completa el cierre
 */
export const closeWhatsAppProvider = async (): Promise<void> => {
  if (!activeProvider) {
    return;
  }

  logger.info(`Cerrando proveedor de WhatsApp: ${activeProviderType}`);

  try {
    // Intentamos cerrar limpiamente
    const instance = await activeProvider.getInstance(); // Usamos await directamente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (instance && typeof (instance as any).close === "function") {
      // Volvemos a 'as any' con disable
      // Verificamos el método
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (instance as any).close?.(); // Volvemos a 'as any' con disable y await
    }

    activeProvider = null;
    logger.info(`Proveedor de WhatsApp cerrado exitosamente`);
  } catch (error) {
    logger.error(`Error al cerrar proveedor de WhatsApp: ${error}`, error);
    throw error;
  }
};
