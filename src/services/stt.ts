/**
 * src/services/stt.ts
 *
 * Servicio para la transcripción de audio usando AssemblyAI.
 * Implementa la conversión de audio a texto (STT).
 * @version 2.0.0
 * @updated 2025-04-17
 */

import { config } from "../config";
import fs from "fs";
import logger from "../utils/logger";
import { transcribeAudioWithAssemblyAI } from "./assemblyai-stt";
import { transcribeAudioWithAssemblyAIDirect } from "./assemblyai-direct";

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
 * Transcribe un buffer de audio a texto usando AssemblyAI
 * @param audioBuffer Buffer del archivo de audio a transcribir
 * @param language Código de idioma (opcional)
 * @returns Texto transcrito del audio
 */
export const transcribeAudio = async (
  audioBuffer: Buffer,
  language: string = "es"
): Promise<string> => {
  // Detectamos el formato del audio una sola vez
  const contentType = detectAudioFormat(audioBuffer);
  const fileExtension = contentType?.split("/")[1] || "ogg";

  // Verificamos que la clave de AssemblyAI esté configurada
  if (!config.assemblyai.apiKey) {
    throw new Error("Falta credencial de AssemblyAI (ASSEMBLYAI_API_KEY)");
  }

  try {
    // Usamos la implementación directa con axios que sigue la documentación oficial
    logger.info("Iniciando transcripción con AssemblyAI...");
    return await transcribeAudioWithAssemblyAIDirect(audioBuffer, language);
  } catch (error) {
    logger.error("Error al transcribir audio con AssemblyAI (llamada directa):", error);
    
    // Si la llamada directa falla, intentamos con el SDK como fallback
    try {
      logger.warn("Intentando con SDK como alternativa...");
      return await transcribeAudioWithAssemblyAI(audioBuffer, language);
    } catch (sdkError) {
      logger.error("Error también con SDK de AssemblyAI:", sdkError);
      
      // Si ambos métodos fallan, usamos un texto genérico
      logger.warn("Usando texto genérico como fallback para mantener la conversación activa");
      return "Mensaje de voz recibido";
    }
  }
};

/**
 * Convierte una nota de voz de WhatsApp a formato compatible con API
 * @param filePath Ruta del archivo de audio a convertir
 * @returns Buffer con el audio convertido
 */
export const convertWhatsAppAudio = async (
  filePath: string
): Promise<Buffer> => {
  try {
    // Leemos el archivo
    const audioBuffer = fs.readFileSync(filePath);
    return audioBuffer;
  } catch (error) {
    logger.error("Error al convertir audio de WhatsApp:", error);
    throw new Error(
      "Error al procesar nota de voz: " +
        (error instanceof Error ? error.message : "Error desconocido")
    );
  }
};

/**
 * Convierte un audio en base64 a buffer para procesamiento
 * @param base64Audio Cadena base64 del audio (puede incluir data URI)
 * @returns Buffer con el audio
 */
export const base64ToBuffer = (base64Audio: string): Buffer => {
  // Si es un data URI, extraemos solo la parte base64
  if (base64Audio.includes("base64,")) {
    base64Audio = base64Audio.split("base64,")[1];
  }

  return Buffer.from(base64Audio, "base64");
};
