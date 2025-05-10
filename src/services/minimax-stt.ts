/**
 * src/services/minimax-stt.ts
 *
 * Servicio para la transcripción de audio usando MiniMax.
 * Implementa la conversión de audio a texto (STT) usando la API de MiniMax.
 * @version 1.0.0
 * @updated 2025-04-17
 */

import axios from "axios";
import FormData from "form-data";
import { config } from "../config";
import logger from "../utils/logger";

/**
 * Detecta el formato del audio basado en sus primeros bytes
 * @param buffer Buffer de audio a analizar
 * @returns Formato detectado o undefined si no se reconoce
 */
const detectAudioFormat = (buffer: Buffer): string | undefined => {
  // OGG header: "OggS"
  if (buffer.length > 4 && buffer.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }

  // MP3 header: "ID3" o comienza con 0xFF 0xFB
  if (
    (buffer.length > 3 && buffer.toString("ascii", 0, 3) === "ID3") ||
    (buffer.length > 2 &&
      buffer[0] === 0xff &&
      (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2))
  ) {
    return "audio/mp3";
  }

  // WAV header: "RIFF" + "WAVE"
  if (
    buffer.length > 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }

  // Si no podemos detectar, asumimos ogg por ser común en WhatsApp
  return "audio/ogg";
};

/**
 * Transcribe un buffer de audio a texto usando la API de MiniMax
 * @param audioBuffer Buffer del archivo de audio a transcribir
 * @param language Código de idioma (opcional)
 * @returns Texto transcrito del audio
 */
export const transcribeAudioWithMiniMax = async (
  audioBuffer: Buffer,
  language: string = "es"
): Promise<string> => {
  try {
    logger.info("Iniciando transcripción con MiniMax...");

    // Verificamos que las credenciales estén configuradas
    if (!config.minimax.apiKey || !config.minimax.groupId) {
      throw new Error("Faltan credenciales de MiniMax (API_KEY, GROUP_ID)");
    }

    // Detectamos el formato del audio
    const contentType = detectAudioFormat(audioBuffer);
    const fileExtension = contentType?.split("/")[1] || "ogg";

    logger.info(`Formato de audio detectado: ${contentType}`);

    // Preparamos el formulario para enviar el audio
    const formData = new FormData();
    formData.append("file", audioBuffer, {
      filename: `audio.${fileExtension}`,
      contentType: contentType,
    });
    formData.append("model", config.minimax.model);

    // Si se especifica un idioma, lo añadimos
    if (language) {
      formData.append("language", language);
    }

    // URL de la API de MiniMax para transcripción
    const url = `${config.minimax.apiUrl.stt}?GroupId=${config.minimax.groupId}`;
    logger.info(`Usando API MiniMax STT: ${url}`);

    // Realizamos la petición a MiniMax
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${config.minimax.apiKey}`,
      },
      timeout: 30000, // 30 segundos de timeout
    });

    // Verificamos la respuesta
    if (response.data && response.data.text) {
      logger.info(`Transcripción exitosa con MiniMax: "${response.data.text}"`);
      return response.data.text;
    } else {
      logger.error("Respuesta de MiniMax sin texto:", response.data);
      throw new Error("No se recibió transcripción de la API de MiniMax");
    }
  } catch (error) {
    // Si es un error de Axios, mostramos detalles adicionales
    if (axios.isAxiosError(error) && error.response) {
      logger.error("Error de API MiniMax:", error.response.data);
    }

    logger.error("Error al transcribir audio con MiniMax:", error);
    throw new Error(
      "Error al transcribir audio con MiniMax: " +
        (error instanceof Error ? error.message : "Error desconocido")
    );
  }
};

/**
 * Convierte una nota de voz de WhatsApp a formato compatible con API
 * @param filePath Ruta del archivo de audio a convertir
 * @returns Buffer con el audio convertido
 */
export const convertAudio = (buffer: Buffer): Buffer => {
  // En esta implementación básica simplemente devolvemos el buffer original
  // En una implementación más compleja podríamos transformar el audio si es necesario
  return buffer;
};

export default transcribeAudioWithMiniMax;
