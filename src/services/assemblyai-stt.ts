/**
 * src/services/assemblyai-stt.ts
 *
 * Servicio para la transcripción de audio usando AssemblyAI.
 * Alternativa a MiniMax para la conversión de audio en texto.
 * @version 2.0.0
 * @updated 2025-04-28
 */

import { AssemblyAI } from 'assemblyai';
import { config } from '../config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import logger from '../utils/logger';

/**
 * Detecta el formato del audio basado en sus primeros bytes
 * @param buffer Buffer de audio a analizar
 * @returns Formato detectado o undefined si no se reconoce
 */
const detectAudioFormat = (buffer: Buffer): string | undefined => {
  // Verificamos los primeros bytes para identificar el formato

  // OGG header: "OggS"
  if (buffer.length > 4 && buffer.toString('ascii', 0, 4) === 'OggS') {
    return 'audio/ogg';
  }

  // MP3 header: "ID3" o comienza con 0xFF 0xFB
  if (
    (buffer.length > 3 && buffer.toString('ascii', 0, 3) === 'ID3') ||
    (buffer.length > 2 &&
      buffer[0] === 0xff &&
      (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2))
  ) {
    return 'audio/mp3';
  }

  // WAV header: "RIFF" + "WAVE"
  if (
    buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'audio/wav';
  }

  // Si no podemos detectar, asumimos ogg por ser común en WhatsApp
  return 'audio/ogg';
};

/**
 * Guarda temporalmente el buffer de audio en un archivo para procesamiento
 * @param audioBuffer Buffer de audio para guardar
 * @param fileExtension Extensión del archivo (mp3, wav, ogg)
 * @returns Ruta del archivo temporal
 */
const saveTempAudioFile = (
  audioBuffer: Buffer,
  fileExtension: string
): string => {
  // Aseguramos que la extensión sea compatible con AssemblyAI
  // Si el formato no es reconocido, lo convertimos a .wav por ser más estándar
  let safeExtension = fileExtension.toLowerCase();
  
  // Lista de extensiones compatibles con AssemblyAI
  const compatibleExtensions = ['mp3', 'mp4', 'wav', 'ogg', 'm4a', 'flac'];
  
  if (!compatibleExtensions.includes(safeExtension)) {
    console.warn(`Extensión '${safeExtension}' no está en la lista de formatos compatibles con AssemblyAI. Usando .mp3 como alternativa.`);
    safeExtension = 'mp3';
  }
  
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `audio_${Date.now()}.${safeExtension}`);
  fs.writeFileSync(tempFile, audioBuffer);
  
  console.log(`Archivo temporal guardado: ${tempFile} (${audioBuffer.length} bytes)`);
  return tempFile;
};

/**
 * Transcribe audio usando llamada directa a la API de AssemblyAI (sin SDK)
 * @param audioBuffer Buffer del audio a transcribir
 * @param language Código de idioma
 * @returns Texto transcrito
 */
export const transcribeAudioWithAssemblyAI = async (
  audioBuffer: Buffer,
  language: string = 'es'
): Promise<string> => {
  try {
    console.log('Iniciando transcripción con AssemblyAI (llamada directa)...');

    // Verificamos clave API
    if (!config.assemblyai.apiKey) {
      throw new Error('Falta credencial de AssemblyAI (ASSEMBLYAI_API_KEY)');
    }
    
    // Log básico de API key (oculta parcialmente por seguridad)
    if (config.assemblyai.apiKey.length >= 10) {
      const apiPrefix = config.assemblyai.apiKey.substring(0, 5);
      const apiSuffix = config.assemblyai.apiKey.substring(config.assemblyai.apiKey.length - 4);
      console.log(`Usando API Key: ${apiPrefix}...${apiSuffix}`);
    } else {
      console.log('La API key parece estar en formato incorrecto');
    }
    
    console.log(`Entorno de ejecución: Node.js ${process.version}`);
    
    // Validación del buffer
    if (!audioBuffer || audioBuffer.length < 100) {
      throw new Error(`Buffer de audio inválido o demasiado pequeño: ${audioBuffer ? audioBuffer.length : 0} bytes`);
    }

    // Guardar archivo temporal
    const tempDir = os.tmpdir();
    // Usar siempre mp3 como formato por compatibilidad
    const tempFile = path.join(tempDir, `audio_${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);
    console.log(`Archivo temporal guardado: ${tempFile} (${audioBuffer.length} bytes)`);

    // PASO 1: Subir el archivo directamente usando axios
    console.log('Subiendo archivo a AssemblyAI usando llamada directa...');
    
    // Leer el archivo como stream
    const fileStream = fs.createReadStream(tempFile);
    
    // Realizar la subida
    const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload',
      fileStream,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Authorization': config.assemblyai.apiKey
        },
        maxContentLength: Infinity, // Para archivos grandes
        maxBodyLength: Infinity
      }
    );

    if (!uploadResponse.data || !uploadResponse.data.upload_url) {
      console.error('Respuesta de subida inválida:', uploadResponse.data);
      throw new Error('No se pudo obtener URL de subida');
    }

    const audioUrl = uploadResponse.data.upload_url;
    console.log(`Archivo subido correctamente, URL: ${audioUrl.substring(0, 40)}...`);
    
    // PASO 2: Iniciar la transcripción
    console.log('Iniciando transcripción...');
    
    const transcriptionParams = {
      audio_url: audioUrl,
      language_code: language === 'es' ? 'es' : 'en',
      punctuate: true,
      format_text: true
    };
    
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      transcriptionParams,
      {
        headers: {
          'Authorization': config.assemblyai.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!transcriptResponse.data || !transcriptResponse.data.id) {
      console.error('Respuesta de transcripción inválida:', transcriptResponse.data);
      throw new Error('No se pudo iniciar la transcripción');
    }
    
    const transcriptId = transcriptResponse.data.id;
    console.log(`Transcripción iniciada con ID: ${transcriptId}`);
    
    // PASO 3: Esperar a que la transcripción se complete
    console.log('Esperando resultados...');
    
    // Función para verificar el estado
    const checkTranscriptionStatus = async (id: string): Promise<string> => {
      const pollingResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: {
            'Authorization': config.assemblyai.apiKey
          }
        }
      );
      
      const status = pollingResponse.data.status;
      
      if (status === 'completed') {
        console.log('Transcripción completada exitosamente');
        return pollingResponse.data.text || '';
      } else if (status === 'error') {
        throw new Error(`Error en transcripción: ${pollingResponse.data.error || 'Error desconocido'}`);
      } else {
        // Aún procesando, esperar y reintentar
        console.log(`Estado actual: ${status}, esperando...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
        return checkTranscriptionStatus(id);  // Llamada recursiva
      }
    };
    
    // Iniciar la verificación de estado
    const transcriptText = await checkTranscriptionStatus(transcriptId);
    
    // Limpieza del archivo temporal
    try { fs.unlinkSync(tempFile); } catch (e) { /* Ignorar error */ }
    
    if (!transcriptText) {
      throw new Error('Transcripción vacía recibida');
    }
    
    console.log(`Transcripción completada: "${transcriptText.substring(0, 50)}"${transcriptText.length > 50 ? '...' : ''}`);
    return transcriptText;
    
  } catch (error) {
    console.error('Error en transcripción:', error);
    throw new Error(
      'Error al transcribir audio: ' +
        (error instanceof Error ? error.message : 'Error desconocido')
    );
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
    console.error('Error al convertir audio de WhatsApp:', error);
    throw new Error(
      'Error al procesar nota de voz: ' +
        (error instanceof Error ? error.message : 'Error desconocido')
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
  if (base64Audio.includes('base64,')) {
    base64Audio = base64Audio.split('base64,')[1];
  }

  return Buffer.from(base64Audio, 'base64');
};
