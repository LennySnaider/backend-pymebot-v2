/**
 * src/services/tts.ts
 *
 * Servicio para la síntesis de voz usando MiniMax.
 * Convierte texto en audio para respuestas habladas.
 * @version 2.0.0
 * @updated 2025-04-17
 */

import { config } from "../config";
import logger from "../utils/logger";
import {
  synthesizeSpeechWithMiniMax,
  saveAudioFile as saveMiniMaxAudioFile,
  preRenderCommonPhrases as preRenderMiniMaxPhrases,
} from "./minimax-tts";

/**
 * Sintetiza voz a partir de un texto usando la API de MiniMax
 * @param text Texto a convertir en voz
 * @param voiceId ID de la voz a utilizar (opcional)
 * @param useCache Indica si se debe usar el caché (por defecto: true)
 * @returns Buffer con el audio generado
 */
export const synthesizeSpeech = async (
  text: string,
  voiceId: string = config.minimax.voice,
  useCache: boolean = config.minimax.cache.enabled
): Promise<Buffer> => {
  try {
    // Verificamos que las credenciales estén configuradas
    if (!config.minimax.apiKey || !config.minimax.groupId) {
      throw new Error(
        "Faltan credenciales de MiniMax (MINIMAX_API_KEY, MINIMAX_GROUP_ID)"
      );
    }

    // Delegamos la síntesis a MiniMax
    return await synthesizeSpeechWithMiniMax(text, voiceId, useCache);
  } catch (error) {
    logger.error("Error al sintetizar voz:", error);
    throw new Error(
      "Error al sintetizar voz: " +
        (error instanceof Error ? error.message : "Error desconocido")
    );
  }
};

/**
 * Guarda un audio sintetizado y devuelve la URL para acceder a él
 * @param audioBuffer Buffer con el audio a guardar
 * @param tenantId ID del tenant (para organización)
 * @param userId ID del usuario (para organización)
 * @param text Texto que se sintetizó (para caché)
 * @param voiceId ID de la voz utilizada (para caché)
 * @returns URL relativa para acceder al audio
 */
export const saveAudioFile = (
  audioBuffer: Buffer,
  tenantId: string = "default",
  userId: string = "anonymous",
  text?: string,
  voiceId?: string
): string => {
  return saveMiniMaxAudioFile(audioBuffer, tenantId, userId, text, voiceId);
};

/**
 * Pre-renderiza un conjunto de frases comunes para respuestas rápidas
 * @param phrases Array de frases a pre-renderizar
 * @param voiceId ID de la voz a utilizar
 */
export const preRenderCommonPhrases = async (
  phrases: string[],
  voiceId: string = config.minimax.voice
): Promise<void> => {
  return preRenderMiniMaxPhrases(phrases, voiceId);
};
