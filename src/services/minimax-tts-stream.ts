/**
 * src/services/minimax-tts-stream.ts
 *
 * Servicio para la síntesis de voz en streaming usando MiniMax.
 * Implementa conversión de texto a audio en tiempo real con optimizaciones.
 * @version 1.1.0
 * @updated 2025-04-27
 */

import axios from "axios";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Sintetiza voz en streaming a partir de un texto usando la API de MiniMax.
 * @param text Texto a convertir en voz
 * @param voiceId ID de la voz a utilizar (opcional)
 * @returns ReadableStream para enviar como respuesta chunked
 */
export const synthesizeSpeechStreamWithMiniMax = async (
  text: string,
  voiceId: string = config.minimax.voice
): Promise<NodeJS.ReadableStream> => {
  if (!config.minimax.apiKey || !config.minimax.groupId) {
    throw new Error(
      "Faltan credenciales de MiniMax (MINIMAX_API_KEY, MINIMAX_GROUP_ID)"
    );
  }
  
  // Validación y normalización del texto
  let textToSynthesize = "";
  if (typeof text === "string") {
    textToSynthesize = text.trim();
  } else if (text && typeof text === "object" && text.text) {
    textToSynthesize = text.text.trim();
  }
  
  // Si el texto está vacío, usar un mensaje por defecto
  if (!textToSynthesize) {
    logger.error(`Error: Texto vacío o inválido para síntesis de stream. Valor recibido: ${JSON.stringify(text)}`);
    textToSynthesize = "Lo siento, ha ocurrido un error en la generación del mensaje.";
    logger.info(`Usando texto de respaldo para stream: "${textToSynthesize}"`);
  }
  
  // Si el texto es largo, utilizamos una pequeña optimización para entregar
  // un fragmento inicial más rápido (primer saludo/reconocimiento)
  let preStreamText = "";
  if (textToSynthesize.length > 60) {
    // Encontramos el primer punto o coma para separar la primera frase
    const firstSentenceEnd = textToSynthesize.search(/[.,!?;:]/);
    if (firstSentenceEnd > 0 && firstSentenceEnd < 60) {
      preStreamText = textToSynthesize.substring(0, firstSentenceEnd + 1);
      textToSynthesize = textToSynthesize.substring(firstSentenceEnd + 1).trim();
    }
  }
  
  // Configuramos la URL de la API
  const url = `${config.minimax.apiUrl.tts}?GroupId=${config.minimax.groupId}`;
  
  // Configuramos los parámetros para la solicitud
  const payload = {
    text: textToSynthesize,
    model: "speech-02-hd",
    stream: true,
    subtitle_enable: false,
    voice_setting: {
      voice_id: voiceId,
      speed: 1.05, // Ligeramente más rápido para mejorar los tiempos de respuesta
      vol: 1,
      pitch: 0,
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
    },
  };
  
  logger.info(`Iniciando stream TTS MiniMax: ${url}`);
  
  // Registra el texto de forma segura
  if (textToSynthesize && textToSynthesize.length > 0) {
    const displayText = textToSynthesize.length > 30 
      ? textToSynthesize.substring(0, 30) + '...' 
      : textToSynthesize;
    logger.debug(`Texto para streaming: "${displayText}"`);
  } else {
    logger.warn("No hay texto para streaming o está vacío");
  }  
  // Configuramos timeout basado en la configuración
  const timeout = config.minimax.streaming.timeout || 30000;
  
  // Realizamos la solicitud con el timeout adecuado
  const response = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.minimax.apiKey}`,
      Accept: "text/event-stream",
    },
    responseType: "stream",
    timeout: timeout,
  });
  
  return response.data;
};

// Exportamos la función principal
export default synthesizeSpeechStreamWithMiniMax;