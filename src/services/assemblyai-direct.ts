/**
 * src/services/assemblyai-direct.ts
 *
 * Implementación directa de la API de AssemblyAI utilizando axios.
 * Basada en la documentación oficial para mayor fiabilidad.
 * @version 1.0.0
 * @updated 2025-04-28
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { config } from '../config';
import logger from '../utils/logger';

// URL base y configuración
const BASE_URL = 'https://api.assemblyai.com/v2';
const POLLING_INTERVAL = 1000; // 1 segundo entre intentos de polling
const MAX_POLLING_ATTEMPTS = 60; // 60 segundos máximo de espera

/**
 * Transcribe un archivo de audio usando la API directa de AssemblyAI
 * @param audioBuffer Buffer del archivo de audio
 * @param language Código de idioma (solo soportados: 'en', 'es', etc)
 * @returns Texto transcrito
 */
export const transcribeAudioWithAssemblyAIDirect = async (
  audioBuffer: Buffer,
  language: string = 'es'
): Promise<string> => {
  try {
    // Log inicial
    logger.info('Iniciando transcripción con AssemblyAI (llamada directa)...');
    
    // Verificar API key
    if (!config.assemblyai.apiKey) {
      throw new Error('API key de AssemblyAI no configurada');
    }
    
    // Log seguro de API key (oculta parcialmente)
    if (config.assemblyai.apiKey.length >= 10) {
      const apiPrefix = config.assemblyai.apiKey.substring(0, 5);
      const apiSuffix = config.assemblyai.apiKey.substring(config.assemblyai.apiKey.length - 4);
      logger.info(`Usando API Key: ${apiPrefix}...${apiSuffix}`);
    }
    
    logger.info(`Entorno de ejecución: Node.js ${process.version}`);
    
    // Verificar buffer de audio
    if (!audioBuffer || audioBuffer.length < 100) {
      throw new Error(`Buffer de audio inválido o demasiado pequeño: ${audioBuffer ? audioBuffer.length : 0} bytes`);
    }
    
    // Guardar archivo temporal
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `audio_${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);
    logger.info(`Archivo temporal guardado: ${tempFile} (${audioBuffer.length} bytes)`);
    
    // Configurar headers con autorización
    const headers = {
      authorization: config.assemblyai.apiKey,
      'content-type': 'application/json',
    };
    
    try {
      // 1. SUBIR ARCHIVO
      logger.info('Subiendo archivo a AssemblyAI usando llamada directa...');
      const fileData = fs.readFileSync(tempFile);
      const uploadResponse = await axios.post(`${BASE_URL}/upload`, fileData, {
        headers: {
          authorization: config.assemblyai.apiKey,
          'content-type': 'application/octet-stream',
        },
      });
      
      // Verificar respuesta de subida
      if (!uploadResponse.data || !uploadResponse.data.upload_url) {
        throw new Error('Error al subir el archivo: no se recibió URL');
      }
      
      const audioUrl = uploadResponse.data.upload_url;
      logger.info(`Archivo subido correctamente, URL: ${audioUrl.substring(0, 40)}...`);
      
      // 2. INICIAR TRANSCRIPCIÓN
      logger.info('Iniciando transcripción...');
      const transcriptionData = {
        audio_url: audioUrl,
        language_code: language,
      };
      
      const transcriptionResponse = await axios.post(
        `${BASE_URL}/transcript`, 
        transcriptionData, 
        { headers }
      );
      
      if (!transcriptionResponse.data || !transcriptionResponse.data.id) {
        throw new Error('Error al iniciar la transcripción: no se recibió ID');
      }
      
      const transcriptId = transcriptionResponse.data.id;
      logger.info(`Transcripción iniciada con ID: ${transcriptId}`);
      
      // 3. POLLING PARA OBTENER RESULTADOS
      logger.info('Esperando resultados...');
      const pollingEndpoint = `${BASE_URL}/transcript/${transcriptId}`;
      
      let attempts = 0;
      while (attempts < MAX_POLLING_ATTEMPTS) {
        attempts++;
        
        const pollingResponse = await axios.get(pollingEndpoint, { headers });
        const transcriptionResult = pollingResponse.data;
        
        if (transcriptionResult.status === 'completed') {
          logger.info('Transcripción completada exitosamente');
          
          // Limpieza del archivo temporal
          try { fs.unlinkSync(tempFile); } catch (e) { /* ignorar error */ }
          
          if (!transcriptionResult.text) {
            return ''; // Devolver string vacío si no hay texto
          }
          
          logger.info(`Transcripción completada: "${transcriptionResult.text}"`);
          return transcriptionResult.text;
        } else if (transcriptionResult.status === 'error') {
          logger.error(`Error en la transcripción: ${transcriptionResult.error}`);
          throw new Error(`Transcripción fallida: ${transcriptionResult.error}`);
        } else {
          logger.info(`Estado actual: ${transcriptionResult.status}, esperando...`);
          // Esperar antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        }
      }
      
      throw new Error(`Timeout después de ${MAX_POLLING_ATTEMPTS} intentos`);
    } catch (apiError) {
      // Limpieza del archivo temporal en caso de error
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignorar error */ }
      throw apiError;
    }
  } catch (error) {
    logger.error('Error en transcripción directa AssemblyAI:', error);
    throw new Error(
      'Error al transcribir audio con llamada directa: ' +
      (error instanceof Error ? error.message : 'Error desconocido')
    );
  }
};

export default transcribeAudioWithAssemblyAIDirect;
