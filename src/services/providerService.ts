/**
 * src/services/providerService.ts
 *
 * Service for managing WhatsApp provider operations
 * Handles button sending, media messages, and other provider-specific functionality
 * @version 1.0.0
 * @created 2025-05-15
 */

import { BaileysProvider } from "@builderbot/provider-baileys";
import { createProvider, ProviderClass } from "@builderbot/bot";
import logger from "../utils/logger";
import { config } from "../config";

// Singleton instance of the provider
let providerInstance: ProviderClass | null = null;

/**
 * Set the provider instance (used when initialized elsewhere)
 */
export const setProvider = (provider: ProviderClass): void => {
  providerInstance = provider;
  logger.info("Provider instance set in providerService");
};

/**
 * Initialize the WhatsApp provider
 */
export const initializeProvider = async (): Promise<ProviderClass> => {
  try {
    if (providerInstance) {
      logger.info("Provider already initialized, returning existing instance");
      return providerInstance;
    }

    logger.info("Initializing WhatsApp provider...");
    
    // Create Baileys provider instance using createProvider
    providerInstance = createProvider(BaileysProvider, {
      name: "bot",
      // phoneNumber: config.whatsapp?.phoneNumber, // No existe en la configuración
    });

    // Wait for the provider to be ready
    await new Promise((resolve) => {
      providerInstance!.on("ready", () => {
        logger.info("WhatsApp provider is ready");
        resolve(true);
      });
    });

    return providerInstance;
  } catch (error) {
    logger.error("Error initializing WhatsApp provider:", error);
    throw error;
  }
};

/**
 * Get the provider instance
 */
export const getProvider = (): ProviderClass | null => {
  if (!providerInstance) {
    logger.warn("Provider not initialized");
  }
  return providerInstance;
};

/**
 * Send buttons directly through the provider
 * @param to Phone number to send to
 * @param buttons Array of button objects
 * @param message Text message to accompany buttons
 */
export const sendButtons = async (
  to: string,
  buttons: Array<{ body: string; id?: string }>,
  message: string
): Promise<boolean> => {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Provider not initialized");
    }

    logger.info(`Sending buttons to ${to}: ${JSON.stringify({ message, buttons })}`);

    // Use the provider's sendButtons method
    // sendButtons no existe en ProviderClass, usamos sendMessage
    await provider.sendMessage(to, JSON.stringify({ message, buttons }));
    
    logger.info(`Buttons sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Error sending buttons to ${to}:`, error);
    return false;
  }
};

/**
 * Send a list message directly through the provider
 * @param to Phone number to send to
 * @param list List configuration
 * @param message Header message
 */
export const sendList = async (
  to: string,
  list: {
    header?: string;
    body: string;
    footer?: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  },
  message: string
): Promise<boolean> => {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Provider not initialized");
    }

    logger.info(`Sending list to ${to}: ${JSON.stringify({ message, list })}`);

    // Use the provider's sendList method
    // sendList no existe en ProviderClass, usamos sendMessage
    await provider.sendMessage(to, JSON.stringify({ list }));
    
    logger.info(`List sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Error sending list to ${to}:`, error);
    return false;
  }
};

/**
 * Send a text message directly through the provider
 * @param to Phone number to send to
 * @param message Text message to send
 */
export const sendText = async (
  to: string,
  message: string
): Promise<boolean> => {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Provider not initialized");
    }

    logger.info(`Sending text to ${to}: ${message}`);

    // Use the provider's sendText method
    // sendText no existe en ProviderClass, usamos sendMessage
    await provider.sendMessage(to, message);
    
    logger.info(`Text sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Error sending text to ${to}:`, error);
    return false;
  }
};

/**
 * Send media with text directly through the provider
 * @param to Phone number to send to
 * @param mediaUrl URL of the media file
 * @param message Caption for the media
 */
export const sendMedia = async (
  to: string,
  mediaUrl: string,
  message?: string
): Promise<boolean> => {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("Provider not initialized");
    }

    logger.info(`Sending media to ${to}: ${mediaUrl} with caption: ${message}`);

    // Use the provider's sendMedia method
    // sendMedia no existe en ProviderClass, usamos sendMessage
    await provider.sendMessage(to, JSON.stringify({ media: mediaUrl, caption: message }));
    
    logger.info(`Media sent successfully to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Error sending media to ${to}:`, error);
    return false;
  }
};

export default {
  initializeProvider,
  getProvider,
  sendButtons,
  sendList,
  sendText,
  sendMedia,
};