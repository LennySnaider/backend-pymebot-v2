/**
 * src/services/minimax-tts.ts
 *
 * Servicio para la síntesis de voz usando MiniMax.
 * Implementa la conversión de texto a audio (TTS) usando la API de MiniMax.
 * @version 1.0.0
 * @updated 2025-04-17
 */

import axios from "axios";
import { config } from "../config";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import logger from "../utils/logger";

/**
 * Espera un número específico de milisegundos
 * @param ms Milisegundos a esperar
 * @returns Promesa que se resuelve después del tiempo especificado
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Descarga un archivo generado por una tarea asincrónica
 * @param fileId ID del archivo a descargar
 * @param taskToken Token de autenticación de la tarea
 * @returns Buffer con el contenido del archivo
 */
const downloadTaskFile = async (
  fileId: string | number,
  taskToken: string
): Promise<Buffer> => {
  try {
    // URL para descargar el archivo
    const downloadUrl = `https://api.minimax.chat/v1/t2a_file?GroupId=${config.minimax.groupId}&file_id=${fileId}`;

    logger.info(`Descargando archivo ${fileId} desde ${downloadUrl}...`);

    // Realizamos la petición para descargar el archivo
    const response = await axios({
      method: "get",
      url: downloadUrl,
      headers: {
        Authorization: `Bearer ${config.minimax.apiKey}`,
        "Task-Token": taskToken,
      },
      responseType: "arraybuffer",
    });

    // Verificamos la respuesta
    if (!response.data || response.data.byteLength === 0) {
      throw new Error("No se recibió contenido al descargar el archivo");
    }

    logger.info(
      `Archivo descargado correctamente: ${response.data.byteLength} bytes`
    );
    return Buffer.from(response.data);
  } catch (error) {
    logger.error("Error al descargar archivo:", error);
    throw new Error(`Error al descargar archivo: ${error.message}`);
  }
};

/**
 * Obtiene el resultado de una tarea asíncrona de síntesis de voz
 * @param taskId ID de la tarea asíncrona
 * @param taskToken Token de autenticación para la tarea
 * @param maxAttempts Número máximo de intentos (por defecto: 30)
 * @param delayMs Retraso entre intentos en milisegundos (por defecto: 1000)
 * @returns Buffer con el audio generado
 */
const fetchAsyncResult = async (
  taskId: string | number,
  taskToken: string,
  maxAttempts: number = 30,
  delayMs: number = 1000
): Promise<Buffer> => {
  // Primero intentamos descargar directamente el archivo usando el taskId como fileId
  try {
    logger.info(
      `Intentando descargar directamente el archivo con ID ${taskId}...`
    );
    return await downloadTaskFile(taskId, taskToken);
  } catch (directDownloadError) {
    logger.warn(
      `No se pudo descargar directamente el archivo: ${directDownloadError.message}`
    );
    logger.info("Cambiando a modo polling para verificar estado de tarea...");
  }

  // Si la descarga directa falla, usamos el método de polling
  const queryUrl = `https://api.minimax.chat/v1/t2a_task?GroupId=${config.minimax.groupId}`;

  logger.info(`Consultando estado de tarea asíncrona ${taskId}...`);

  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // Consultamos el estado de la tarea
      const response = await axios.post(
        queryUrl,
        { task_id: taskId },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.minimax.apiKey}`,
            "Task-Token": taskToken,
          },
        }
      );

      // Verificamos respuesta
      if (!response.data) {
        throw new Error(
          "No se recibieron datos en la respuesta de consulta de estado"
        );
      }

      logger.info(
        `Intento ${attempts}/${maxAttempts}: Estado de tarea: ${
          response.data.status || "desconocido"
        }`
      );

      // Si hay un error en la tarea, lanzamos excepción
      if (response.data.error) {
        throw new Error(`Error en tarea asíncrona: ${response.data.error}`);
      }

      // Si la tarea está completada y tenemos información del archivo
      if (response.data.status === "SUCCESS") {
        // Si tenemos el audio directamente en la respuesta
        if (response.data.reply && response.data.reply.audio) {
          logger.info("¡Tarea completada! Obteniendo audio de la respuesta...");

          // El audio viene en formato hexadecimal
          const audioHexString = response.data.reply.audio;

          if (!audioHexString || audioHexString.length === 0) {
            throw new Error("El campo 'audio' está vacío en la respuesta");
          }

          logger.info(
            `Audio recibido en formato hex, longitud: ${audioHexString.length} caracteres`
          );

          // Convertimos la cadena hexadecimal a buffer
          try {
            const audioBuffer = Buffer.from(audioHexString, "hex");
            logger.info(
              `Buffer convertido correctamente: ${audioBuffer.length} bytes`
            );
            return audioBuffer;
          } catch (conversionError) {
            logger.error(
              "Error al convertir hexadecimal a buffer:",
              conversionError
            );
            throw new Error(
              `Error al convertir audio: ${conversionError.message}`
            );
          }
        }
        // Si solo tenemos un file_id, lo descargamos
        else if (response.data.file_id) {
          logger.info("¡Tarea completada! Descargando archivo...");
          return await downloadTaskFile(response.data.file_id, taskToken);
        } else {
          throw new Error(
            "La tarea se completó pero no se encontró ni audio ni file_id en la respuesta"
          );
        }
      }

      // Si la tarea falló
      if (response.data.status === "FAILED") {
        throw new Error(
          `La tarea asíncrona falló: ${response.data.message || "sin detalles"}`
        );
      }

      // Si aún está en progreso, esperamos y volvemos a intentar
      logger.info(
        `Tarea en progreso (${response.data.status}). Esperando ${delayMs}ms antes del siguiente intento...`
      );
      await sleep(delayMs);
    } catch (error) {
      logger.error(
        `Error al consultar estado de tarea (intento ${attempts}/${maxAttempts}):`,
        error
      );

      // Si ya hemos superado el número máximo de intentos, lanzamos el error
      if (attempts >= maxAttempts) {
        throw new Error(
          `Error al obtener resultado después de ${maxAttempts} intentos: ${error.message}`
        );
      }

      // Esperamos un poco más en caso de error antes de reintentar
      await sleep(delayMs * 2);
    }
  }

  throw new Error(
    `Tiempo de espera agotado después de ${maxAttempts} intentos`
  );
};

// Caché en memoria para respuestas TTS frecuentes
interface TTSCacheEntry {
  buffer: Buffer;
  timestamp: number;
  filePath: string;
}

// Mapa para almacenar el caché
const ttsCache: Map<string, TTSCacheEntry> = new Map();

/**
 * Genera una clave de caché basada en los parámetros de la solicitud
 * @param text Texto a sintetizar
 * @param voiceId ID de la voz a utilizar
 * @returns Clave única para el caché
 */
const getCacheKey = (text: string, voiceId: string): string => {
  return createHash("md5").update(`${text}|${voiceId}`).digest("hex");
};

/**
 * Limpia entradas antiguas del caché basadas en el tiempo de expiración
 */
const cleanupCache = (): void => {
  const now = Date.now();
  const expirationTime = config.minimax.cache.expiration * 1000; // Convertir a milisegundos

  for (const [key, entry] of ttsCache.entries()) {
    if (now - entry.timestamp > expirationTime) {
      ttsCache.delete(key);
      logger.info(`Eliminada entrada de caché: ${key}`);
    }
  }
};

/**
 * Sintetiza voz a partir de un texto usando la API de MiniMax
 * @param text Texto a convertir en voz
 * @param voiceId ID de la voz a utilizar (opcional)
 * @param useCache Indica si se debe usar el caché (por defecto: true)
 * @returns Buffer con el audio generado
 */
export const synthesizeSpeechWithMiniMax = async (
  text: string,
  voiceId: string = config.minimax.voice,
  useCache: boolean = config.minimax.cache.enabled
): Promise<Buffer> => {
  // Declarar isAsyncMode al principio de la función
  let isAsyncMode = false;
  // Declarar payload aquí para que esté disponible en todos los bloques
  let payload: any;
  try {
    // Si el caché está habilitado, verificamos si ya tenemos este audio
    if (useCache) {
      const cacheKey = getCacheKey(text, voiceId);

      // Si existe en caché y no ha expirado, lo devolvemos directamente
      if (ttsCache.has(cacheKey)) {
        logger.info(`Usando audio en caché para: "${text}"`);
        return ttsCache.get(cacheKey)!.buffer;
      }

      // Limpiamos el caché ocasionalmente
      if (Math.random() < 0.1) {
        // 10% de probabilidad en cada llamada
        cleanupCache();
      }
    }

    logger.info(`Sintetizando voz para: "${text}"`);

    // Verificamos que las claves estén configuradas
    if (!config.minimax.apiKey || !config.minimax.groupId) {
      throw new Error(
        "Faltan credenciales de MiniMax (MINIMAX_API_KEY, MINIMAX_GROUP_ID)"
      );
    }

    // URL de la API de MiniMax para síntesis de voz
    const url = `${config.minimax.apiUrl.tts}?GroupId=${config.minimax.groupId}`;
    logger.info(`Usando API MiniMax TTS: ${url}`);

    // Verificamos si la URL contiene 'async' para determinar el modo
    // Asignar valor a la variable isAsyncMode declarada al principio
    isAsyncMode = url.includes("async");
    logger.info(`Modo de API: ${isAsyncMode ? "asíncrono" : "sincrónico"}`);

    // Lista de voces disponibles de MiniMax
    const availableVoices = [
      "Wise_Woman",
      "Friendly_Person",
      "Inspirational_girl",
      "Deep_Voice_Man",
      "Calm_Woman",
      "Casual_Guy",
      "Lively_Girl",
      "Patient_Man",
      "Young_Knight",
      "Determined_Man",
      "Lovely_Girl",
      "Decent_Boy",
      "Imposing_Manner",
      "Elegant_Man",
      "Abbess",
      "Sweet_Girl_2",
      "Exuberant_Girl",
    ];

    // Si el voiceId solicitado no está en la lista, usamos 'Friendly_Person' por defecto
    const safeVoiceId = availableVoices.includes(voiceId)
      ? voiceId
      : "Friendly_Person";
    if (voiceId !== safeVoiceId) {
      logger.warn(
        `⚠️ Voz solicitada "${voiceId}" no es válida. Usando "${safeVoiceId}" en su lugar.`
      );
    } else {
      logger.info(`Usando voz: "${safeVoiceId}"`);
    }

    // Configuración común para ambos modos
    // Extraer el texto real, ya sea directamente o desde el objeto
    let textToSynthesize = "";
    
    if (typeof text === "string") {
      textToSynthesize = text;
    } else if (text && typeof text === "object" && (text as any).text) {
      textToSynthesize = (text as any).text;
    }
    
    // Limpiar espacios y validar que hay texto
    textToSynthesize = textToSynthesize.trim();
    
    if (!textToSynthesize) {
      logger.error(`Error: Texto vacío o inválido para sintetizar. Valor recibido: ${JSON.stringify(text)}`);
      // Proporcionar un mensaje de error por defecto cuando no hay texto
      textToSynthesize = "Lo siento, ha ocurrido un error en la generación del mensaje.";
      logger.info(`Usando texto de respaldo: "${textToSynthesize}"`);
    }

    payload = {
      text: textToSynthesize, // Usar la cadena de texto extraída
      model: "speech-02-hd",
      stream: false,
      subtitle_enable: false,
      voice_setting: {
        voice_id: safeVoiceId, // Usamos la voz validada
        speed: 1,
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
    logger.debug("Payload para TTS:", payload);

    logger.info("Realizando solicitud a la API de MiniMax TTS...");

    // Realizamos la petición a MiniMax
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.minimax.apiKey}`,
        Accept: "application/json",
      },
      responseType: "json",
      timeout: 30000, // 30 segundos de timeout
    });

    logger.info(`Respuesta recibida de MiniMax: ${response.status}`);

    // Verificamos que tenemos datos en la respuesta
    if (!response.data) {
      throw new Error("No se recibieron datos en la respuesta de MiniMax");
    }

    logger.debug("Campos en la respuesta:", Object.keys(response.data));

    let audioBuffer;

    // MODO ASÍNCRONO: La API devuelve un task_id y task_token
    if (isAsyncMode) {
      if (!response.data.task_id || !response.data.task_token) {
        logger.error(
          "Respuesta completa:",
          JSON.stringify(response.data, null, 2)
        );
        throw new Error(
          "Respuesta asíncrona incompleta (faltan task_id o task_token)"
        );
      }

      const taskId = response.data.task_id;
      const taskToken = response.data.task_token;

      logger.info(`Tarea asíncrona iniciada con ID: ${taskId}`);

      // Esperamos a que la tarea se complete y obtenemos el resultado
      audioBuffer = await fetchAsyncResult(taskId, taskToken);
    }
    // MODO SINCRÓNICO: La API devuelve el campo 'audio' con el audio en hexadecimal
    else if (response.data.audio) {
      logger.info("Encontrado campo 'audio' directamente en la respuesta JSON");
      const audioHexString = response.data.audio;

      // Verificamos que el campo audio tiene contenido
      if (!audioHexString || audioHexString.length === 0) {
        throw new Error("El campo 'audio' está vacío en la respuesta");
      }

      logger.debug(
        `Audio recibido en formato hex, longitud: ${audioHexString.length} caracteres`
      );

      // Convertimos la cadena hexadecimal a buffer
      try {
        audioBuffer = Buffer.from(audioHexString, "hex");
        logger.info(
          `Buffer convertido correctamente: ${audioBuffer.length} bytes`
        );
      } catch (conversionError) {
        logger.error(
          "Error al convertir hexadecimal a buffer:",
          conversionError
        );
        throw new Error(`Error al convertir audio: ${conversionError.message}`);
      }
    }
    // Verificamos si el audio está en data.data.audio (estructura anidada)
    else if (response.data.data && response.data.data.audio) {
      logger.info("Encontrado campo 'audio' dentro de data.data");
      const audioHexString = response.data.data.audio;

      // Verificamos que el campo audio tiene contenido
      if (!audioHexString || audioHexString.length === 0) {
        throw new Error("El campo 'audio' está vacío en la respuesta");
      }

      logger.debug(
        `Audio recibido en formato hex, longitud: ${audioHexString.length} caracteres`
      );

      // Convertimos la cadena hexadecimal a buffer
      try {
        audioBuffer = Buffer.from(audioHexString, "hex");
        logger.info(
          `Buffer convertido correctamente: ${audioBuffer.length} bytes`
        );
      } catch (conversionError) {
        logger.error(
          "Error al convertir hexadecimal a buffer:",
          conversionError
        );
        throw new Error(`Error al convertir audio: ${conversionError.message}`);
      }
    } else {
      // Si no encontramos ni el campo 'audio' ni los campos para modo asíncrono
      logger.error(
        "Respuesta completa:",
        JSON.stringify(response.data, null, 2)
      );
      throw new Error("Formato de respuesta no reconocido de MiniMax");
    }

    // Comprobamos si tenemos datos en el buffer de audio
    if (!audioBuffer || audioBuffer.byteLength === 0) {
      throw new Error("No se recibieron datos de audio válidos desde MiniMax");
    }

    logger.info(`Síntesis de voz completada: ${audioBuffer.byteLength} bytes`);

    // Verificamos que el audio sea un MP3 válido
    const startsWithID3 =
      audioBuffer.length > 3 &&
      audioBuffer[0] === 0x49 && // 'I'
      audioBuffer[1] === 0x44 && // 'D'
      audioBuffer[2] === 0x33; // '3'

    const startsWithMP3Frame =
      audioBuffer.length > 2 &&
      audioBuffer[0] === 0xff &&
      (audioBuffer[1] & 0xe0) === 0xe0;

    if (!startsWithID3 && !startsWithMP3Frame) {
      logger.warn(
        "⚠️ El audio no parece tener encabezado MP3 válido. Primeros bytes:",
        audioBuffer.slice(0, 20).toString("hex")
      );
    } else {
      logger.info("✅ Audio con formato MP3 válido detectado");
    }

    // Si el caché está habilitado, guardamos el resultado
    if (useCache) {
      const cacheKey = getCacheKey(text, voiceId);

      // Guardamos en el caché
      ttsCache.set(cacheKey, {
        buffer: audioBuffer,
        timestamp: Date.now(),
        filePath: "", // Se establecerá cuando se guarde en disco
      });
    }

    return audioBuffer;
  } catch (error) {
    logger.error("Error al sintetizar voz con MiniMax:", error);

    // Comprobamos si es un error de Axios para obtener más detalles
    if (axios.isAxiosError(error) && error.response) {
      logger.error("Detalles del error de API:", error.response.data);
    }

    // Si estamos en modo sincrónico y falla, intentamos con el endpoint asíncrono como alternativa
    if (!isAsyncMode && config.minimax.apiUrl.tts.includes("t2a_v2")) {
      try {
        logger.warn(
          "⚠️ Error en modo sincrónico, intentando con endpoint asíncrono como alternativa..."
        );

        // URL del endpoint asíncrono
        const asyncUrl = config.minimax.apiUrl.tts.replace(
          "t2a_v2",
          "t2a_async_v2"
        );
        logger.info(
          `Usando URL asíncrona: ${asyncUrl}?GroupId=${config.minimax.groupId}`
        );

        // Realizamos la petición al endpoint asíncrono
        const asyncResponse = await axios.post(
          `${asyncUrl}?GroupId=${config.minimax.groupId}`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${config.minimax.apiKey}`,
              Accept: "application/json",
            },
            responseType: "json",
          }
        );

        // Verificamos que tenemos datos en la respuesta
        if (!asyncResponse.data) {
          throw new Error("No se recibieron datos en la respuesta asíncrona");
        }

        logger.debug(
          "Campos en la respuesta asíncrona:",
          Object.keys(asyncResponse.data)
        );

        // Verificamos que tenemos los campos necesarios
        if (!asyncResponse.data.task_id || !asyncResponse.data.task_token) {
          throw new Error(
            "Respuesta asíncrona incompleta (faltan task_id o task_token)"
          );
        }

        // Obtenemos el resultado asíncrono
        logger.info("Obteniendo resultado de tarea asíncrona...");
        const audioBuffer = await fetchAsyncResult(
          asyncResponse.data.task_id,
          asyncResponse.data.task_token
        );

        logger.info(
          "✅ Recuperación exitosa usando endpoint asíncrono como alternativa"
        );
        return audioBuffer;
      } catch (asyncError) {
        logger.error("Error también en el intento asíncrono:", asyncError);
        // Lanzamos el error original, ya que ambos métodos fallaron
        throw new Error(
          "Error al sintetizar voz (tanto sincrónico como asíncrono): " +
            (error instanceof Error ? error.message : "Error desconocido")
        );
      }
    }
    // Si no pudimos recuperarnos, lanzamos el error original
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
  // Verificamos que el buffer de audio es válido
  if (
    !audioBuffer ||
    !Buffer.isBuffer(audioBuffer) ||
    audioBuffer.length === 0
  ) {
    throw new Error("Buffer de audio inválido o vacío");
  }

  // Logueamos los primeros bytes para diagnóstico
  logger.debug(
    `Guardando audio de ${
      audioBuffer.length
    } bytes. Primeros bytes: ${audioBuffer.slice(0, 16).toString("hex")}`
  );

  // Verificamos que el buffer parece contener un archivo de audio válido
  // MP3 comienza con ID3 o con 0xFF 0xFB
  const startsWithID3 =
    audioBuffer.length > 3 &&
    audioBuffer[0] === 0x49 && // 'I'
    audioBuffer[1] === 0x44 && // 'D'
    audioBuffer[2] === 0x33; // '3'

  const startsWithMP3Frame =
    audioBuffer.length > 2 &&
    audioBuffer[0] === 0xff &&
    (audioBuffer[1] & 0xe0) === 0xe0;

  if (!startsWithID3 && !startsWithMP3Frame) {
    logger.warn(
      "⚠️ Advertencia: El buffer no parece ser un archivo MP3 válido."
    );
    logger.warn(`Primeros bytes: ${audioBuffer.slice(0, 20).toString("hex")}`);
  } else {
    logger.info(
      "✅ Verificación de formato MP3 correcta al guardar el archivo."
    );
  }

  // Crear un nombre de archivo único con la extensión correcta según el formato solicitado en el payload
  const extension = "mp3"; // Debe coincidir con el formato en audio_setting.format
  const filename = `${tenantId}-${userId}-${Date.now()}.${extension}`;
  const filePath = path.join(config.paths.audio, filename);

  // Asegurarnos de que el directorio existe
  if (!fs.existsSync(config.paths.audio)) {
    fs.mkdirSync(config.paths.audio, { recursive: true });
  }

  // Guardar el archivo
  fs.writeFileSync(filePath, audioBuffer);
  logger.info(`Audio guardado en: ${filePath} (${audioBuffer.length} bytes)`);

  // Si tenemos texto y voz, y el caché está habilitado, actualizamos la ruta en caché
  if (text && voiceId && config.minimax.cache.enabled) {
    const cacheKey = getCacheKey(text, voiceId);
    if (ttsCache.has(cacheKey)) {
      const cacheEntry = ttsCache.get(cacheKey)!;
      cacheEntry.filePath = filePath;
    }
  }

  // Devolver la URL relativa para acceder al archivo
  return `/audio/${filename}`;
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
  logger.info(`Pre-renderizando ${phrases.length} frases comunes...`);

  for (const phrase of phrases) {
    try {
      // Verificamos si ya está en caché
      const cacheKey = getCacheKey(phrase, voiceId);

      if (!ttsCache.has(cacheKey)) {
        // Si no está en caché, la sintetizamos
        const audioBuffer = await synthesizeSpeechWithMiniMax(
          phrase,
          voiceId,
          true
        );

        // Guardamos en disco con un nombre predecible
        const safePhrase = phrase
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .substring(0, 30);

        const filename = `cached_${safePhrase}_${voiceId}.mp3`;
        const filePath = path.join(config.paths.audio, "cache", filename);

        // Aseguramos que el directorio de caché existe
        if (!fs.existsSync(path.join(config.paths.audio, "cache"))) {
          fs.mkdirSync(path.join(config.paths.audio, "cache"), {
            recursive: true,
          });
        }

        // Guardamos el archivo
        fs.writeFileSync(filePath, audioBuffer);

        // Actualizamos la entrada de caché con la ruta
        ttsCache.set(cacheKey, {
          buffer: audioBuffer,
          timestamp: Date.now(),
          filePath,
        });

        logger.info(`Pre-renderizada frase: "${phrase}"`);
      }
    } catch (error) {
      logger.error(`Error al pre-renderizar "${phrase}":`, error);
      // Continuamos con la siguiente frase
    }
  }

  logger.info("Pre-renderizado completado");
};

export const synthesizeSpeechStreamWithMiniMax = async (
  text: string,
  voiceId: string = config.minimax.voice
): Promise<NodeJS.ReadableStream> => {
  if (!config.minimax.apiKey || !config.minimax.groupId) {
    throw new Error(
      "Faltan credenciales de MiniMax (MINIMAX_API_KEY, MINIMAX_GROUP_ID)"
    );
  }
  const url = `${config.minimax.apiUrl.tts}?GroupId=${config.minimax.groupId}`;
  const payload = {
    text,
    model: "speech-02-hd",
    stream: true,
    subtitle_enable: false,
    voice_setting: {
      voice_id: voiceId,
      speed: 1,
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
  const response = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.minimax.apiKey}`,
      Accept: "application/json",
    },
    responseType: "stream",
  });
  return response.data;
};
export default synthesizeSpeechWithMiniMax;
