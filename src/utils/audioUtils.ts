/**
 * src/utils/audioUtils.ts
 *
 * Utilidades para el procesamiento de archivos de audio.
 * Proporciona funciones para convertir, analizar y manipular audio.
 * @version 1.0.0
 * @updated 2024-04-16
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { config } from "../config";

/**
 * Formatos de audio soportados
 */
export enum AudioFormat {
  MP3 = "mp3",
  OGG = "ogg",
  WAV = "wav",
  M4A = "m4a",
}

/**
 * Estructura para información básica de un archivo de audio
 */
export interface AudioInfo {
  format: AudioFormat | string;
  sizeBytes: number;
  mimeType: string;
  filename: string;
  hash: string;
}

/**
 * Genera un hash MD5 para un buffer de audio
 * @param buffer Buffer de audio para calcular el hash
 * @returns String con el hash MD5
 */
export const getAudioHash = (buffer: Buffer): string => {
  return createHash("md5").update(buffer).digest("hex");
};

/**
 * Detecta el formato de audio basado en la firma de bytes
 * @param buffer Buffer de audio a analizar
 * @returns Objeto con la información detectada del audio
 */
export const detectAudioFormat = (buffer: Buffer): AudioInfo => {
  let format: string = "unknown";
  let mimeType: string = "application/octet-stream";
  
  // Verificamos los primeros bytes para identificar el formato
  
  // OGG header: "OggS"
  if (buffer.length > 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    format = AudioFormat.OGG;
    mimeType = "audio/ogg";
  }
  
  // MP3 header: "ID3" o comienza con 0xFF 0xFB
  else if (
    (buffer.length > 3 && buffer.toString('ascii', 0, 3) === 'ID3') ||
    (buffer.length > 2 && buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2))
  ) {
    format = AudioFormat.MP3;
    mimeType = "audio/mp3";
  }
  
  // WAV header: "RIFF" + "WAVE"
  else if (
    buffer.length > 12 && 
    buffer.toString('ascii', 0, 4) === 'RIFF' && 
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    format = AudioFormat.WAV;
    mimeType = "audio/wav";
  }
  
  // M4A/AAC header: "ftyp"
  else if (
    buffer.length > 8 && 
    buffer.toString('ascii', 4, 8) === 'ftyp'
  ) {
    format = AudioFormat.M4A;
    mimeType = "audio/mp4";
  }
  
  // Si no podemos detectar, asumimos ogg por ser común en WhatsApp
  else {
    format = AudioFormat.OGG;
    mimeType = "audio/ogg";
  }
  
  // Generamos un hash para el archivo
  const hash = getAudioHash(buffer);
  
  // Generamos un nombre de archivo basado en el hash
  const filename = `audio_${hash.substring(0, 8)}.${format}`;
  
  return {
    format,
    sizeBytes: buffer.length,
    mimeType,
    filename,
    hash
  };
};

/**
 * Calcula la duración aproximada de un archivo de audio basada en su tamaño
 * @param buffer Buffer de audio
 * @param format Formato del audio (para cálculos más precisos)
 * @returns Duración aproximada en segundos
 */
export const estimateAudioDuration = (
  buffer: Buffer,
  format: string = "ogg"
): number => {
  // Estimaciones muy aproximadas basadas en tamaño
  // Para mayor precisión, se necesitaría un analizador de audio
  switch (format.toLowerCase()) {
    case "mp3":
      // ~128kbps: 16KB por segundo
      return Math.ceil(buffer.length / 16000);
    case "wav":
      // PCM sin comprimir: ~172KB por segundo (16-bit, 44.1kHz, stereo)
      return Math.ceil(buffer.length / 172000);
    case "m4a":
      // ~96kbps: 12KB por segundo
      return Math.ceil(buffer.length / 12000);
    case "ogg":
    default:
      // ~96kbps: 12KB por segundo
      return Math.ceil(buffer.length / 12000);
  }
};

/**
 * Guarda un buffer de audio en disco y devuelve información del archivo
 * @param buffer Buffer con el audio a guardar
 * @param directory Directorio donde guardar (por defecto usa config)
 * @param customFilename Nombre personalizado (opcional)
 * @returns Información del archivo guardado
 */
export const saveAudioBuffer = (
  buffer: Buffer,
  directory: string = config.paths.audio,
  customFilename?: string
): { filePath: string; url: string; info: AudioInfo } => {
  // Detectamos el formato
  const info = detectAudioFormat(buffer);
  
  // Usamos el nombre personalizado si se proporciona
  const filename = customFilename || info.filename;
  
  // Aseguramos que el directorio existe
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  
  // Construimos la ruta completa
  const filePath = path.join(directory, filename);
  
  // Guardamos el archivo
  fs.writeFileSync(filePath, buffer);
  
  // Calculamos la URL relativa
  const urlPath = directory.includes(config.paths.audio) 
    ? `/audio/${filename}` 
    : `/static/${filename}`;
  
  return {
    filePath,
    url: urlPath,
    info
  };
};

/**
 * Convierte una cadena base64 en un buffer de audio
 * @param base64Audio Cadena base64 (puede incluir data URI)
 * @returns Buffer con el audio
 */
export const base64ToAudioBuffer = (base64Audio: string): Buffer => {
  // Si es un data URI, extraemos solo la parte base64
  if (base64Audio.includes("base64,")) {
    base64Audio = base64Audio.split("base64,")[1];
  }
  
  return Buffer.from(base64Audio, "base64");
};

/**
 * Convierte un buffer de audio a base64
 * @param buffer Buffer de audio
 * @param includeDataUri Si se debe incluir el prefijo data URI
 * @returns Cadena base64 del audio
 */
export const audioBufferToBase64 = (
  buffer: Buffer,
  includeDataUri: boolean = false
): string => {
  const base64 = buffer.toString("base64");
  
  if (!includeDataUri) {
    return base64;
  }
  
  // Determinamos el tipo MIME para el data URI
  const info = detectAudioFormat(buffer);
  return `data:${info.mimeType};base64,${base64}`;
};
