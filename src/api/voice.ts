/**
 * src/api/voice.ts
 *
 * API para procesamiento de voz (STT y TTS).
 * Maneja la transcripción, procesamiento y síntesis de voz.
 * @version 2.0.0
 * @updated 2025-04-17
 */

// Función auxiliar para generar un UUID v4 aleatorio (o fallback a un UUID fijo)
function generateUUID(): string {
  // Formato UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // donde x=hex aleatorio, y=hex aleatorio entre 8-B
  try {
    const hexChars = '0123456789abcdef';
    let uuid = '';
    
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // Versión 4
      } else if (i === 19) {
        uuid += hexChars[(Math.random() * 4) | 8]; // '8', '9', 'a', o 'b'
      } else {
        uuid += hexChars[Math.floor(Math.random() * 16)];
      }
    }
    
    return uuid;
  } catch (e) {
    // En caso de error, devolver un UUID fijo
    return "11111111-1111-4111-a111-111111111111";
  }
}

import { Router } from "express";
import fileUpload from "express-fileupload";
import { transcribeAudio, base64ToBuffer } from "../services/stt";
import { synthesizeSpeech, saveAudioFile } from "../services/tts";
import { synthesizeSpeechStreamWithMiniMax } from "../services/minimax-tts-stream";
import {
  processMessageWithFlows,
  clearFlowState,
} from "../services/botFlowIntegration";
import { AuthRequest, optionalAuthMiddleware } from "../middlewares/auth";
import {
  logMessage,
  incrementUsage,
  hasTenantExceededQuota,
} from "../services/supabase";
import { config } from "../config";
import logger from "../utils/logger";
import { createInterface } from "readline";

const router = Router();

// Configuración de fileUpload para esta ruta
router.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    useTempFiles: false,
    abortOnLimit: true,
  })
);

// Añadimos middleware de autenticación opcional
router.use(optionalAuthMiddleware);

/**
 * Middleware para verificar cuotas de tenant
 */
const checkTenantQuota = async (req: AuthRequest, res: any, next: any) => {
  try {
    if (!config.supabase.enabled || !config.multitenant.enabled) {
      return next(); // Si no está habilitado Supabase o multitenant, siempre permitimos
    }

    // Manejo garantizado del tenant_id para evitar errores de UUID
    let tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    if (
      tenantId === "default" ||
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId
      )
    ) {
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.debug(`Middleware: usando UUID para tenant default: ${tenantId}`);
    }

    // Verificamos si ha excedido su cuota
    const hasExceeded = await hasTenantExceededQuota(tenantId);

    if (hasExceeded) {
      return res.status(429).json({
        error: "Cuota excedida",
        message: "Has alcanzado el límite de peticiones para hoy",
      });
    }

    next();
  } catch (error) {
    logger.error("Error al verificar cuota:", error);
    next(); // En caso de error, permitimos continuar
  }
};

/**
 * Endpoint para conversación por voz completa
 * Recibe audio, transcribe, procesa con el bot y devuelve audio de respuesta
 */
router.post("/chat", checkTenantQuota, async (req: AuthRequest, res) => {
  try {
    // Extraemos información del usuario (desde el middleware de autenticación)
    let userId = req.user?.id || "anonymous";
    
    // Asegurarnos de que userId sea un UUID válido (importante para la base de datos)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      // Si userId no es un UUID válido, usamos un UUID fijo para usuarios anónimos
      userId = "33333333-3333-4333-a333-333333333333";
      logger.info(`Usando UUID fijo para usuario anónimo: ${userId}`);
    }

    // Manejo garantizado del tenant_id para evitar errores de UUID
    let tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    // SIEMPRE convertimos a UUID válido sin importar la condición
    if (tenantId === "default" || !tenantId) {
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.info(`Usando UUID fijo para tenant default: ${tenantId}`);
    } else if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId
      )
    ) {
      // Si no es un UUID válido, usar el UUID por defecto
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.warn(`Tenant ID no válido, usando UUID por defecto: ${tenantId}`);
    }

    logger.info(
      `Procesando chat de voz para usuario ${userId} de tenant ${tenantId}`
    );

    // Variables para la entrada del usuario
    let userInputText: string | undefined; // Hacerla undefined inicialmente
    let inputType: "audio" | "text" = "text"; // Default to text
    let audioBuffer: Buffer | null = null;
    let audioFormat: string = "audio/ogg";
    let audioSize: number = 0;
    let transcription: string | null = null; // Variable para guardar la transcripción si hay audio

    // Registramos el inicio del procesamiento
    const startTime = Date.now();

    // Generar o usar un sessionId válido (UUID) - MOVIDO AQUI ANTES DE USARLO
    let sessionId = req.body.session_id;
    if (
      !sessionId ||
      !sessionId.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    ) {
      // Si no hay sessionId válido, generamos uno
      sessionId = generateUUID();
      logger.info(`Generando UUID nuevo para session: ${sessionId}`);
    }

    // 1. Determinar el tipo de entrada (audio o texto)
    if (req.files && req.files.audio) {
      // Procesamos el audio como archivo subido
      const audioFile = req.files.audio as fileUpload.UploadedFile;
      audioBuffer = audioFile.data;
      audioSize = audioBuffer.length;
      inputType = "audio";
      if (audioFile.mimetype) {
        audioFormat = audioFile.mimetype;
      }
      logger.info(
        `Recibido archivo de audio: ${audioFile.name}, tamaño: ${audioBuffer.length} bytes, formato: ${audioFormat}`
      );
    } else if (req.body.audio_base64) {
      // Procesamos audio en base64
      audioBuffer = base64ToBuffer(req.body.audio_base64);
      audioSize = audioBuffer.length;
      inputType = "audio";
      logger.info(`Recibido audio base64, tamaño: ${audioBuffer.length} bytes`);
    } else if (req.body.text) {
      // Procesamos entrada de texto
      userInputText = req.body.text;
      inputType = "text";
      transcription = userInputText; // Usamos el texto de entrada como 'transcripción' para consistencia
      logger.info(`Recibido texto: "${userInputText}"`);
    } else {
      // No se proporcionó ni audio ni texto
      return res.status(400).json({
        error: "No se proporcionó entrada (ni audio ni texto)",
      });
    }

    // 2. Transcribir si la entrada fue audio
    if (inputType === "audio" && audioBuffer) {
      // Iniciamos temprano la transcripción para reducir latencia
      const transcriptionPromise = transcribeAudio(
        audioBuffer,
        req.body.language || "es"
      );

      // Si es un usuario que ya ha hablado, mientras esperamos la transcripción,
      // podemos indicar que estamos procesando
      if (req.body.session_id && req.body.has_previous_messages) {
        logger.info(
          "Usuario con sesión existente, se inicia procesamiento inmediato"
        );
      }

      // Ahora esperamos la transcripción
      try {
        transcription = await transcriptionPromise;
        userInputText = transcription; // El texto a procesar por el bot es la transcripción
        logger.info(`Transcripción: "${transcription}"`);
      } catch (transcriptionError) {
        logger.error("Error durante la transcripción:", transcriptionError);

        // En lugar de fallar, usamos un texto genérico y continuamos el flujo
        transcription = "Mensaje de voz recibido";
        userInputText = transcription;
        logger.warn(
          `Usando texto predeterminado tras error de transcripción: "${transcription}"`
        );
      }
    }

    // Si después de intentar obtener la entrada, no tenemos texto, hay un error
    if (userInputText === undefined) {
      // Comprobar si es undefined
      logger.error(
        "No se pudo obtener el texto de entrada (ni de audio ni de texto directo)."
      );
      return res.status(500).json({
        success: false,
        error: "Error interno al procesar la entrada.",
      });
    }

    // 3. Registrar mensaje del usuario en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      await logMessage({
        tenant_id: tenantId,
        bot_id: req.body.bot_id
          ? req.body.bot_id
          : "00000000-0000-0000-0000-000000000000", // NUNCA usar "default" como UUID
        user_id: userId,
        session_id: sessionId, // Usar el UUID válido para session_id
        content: userInputText, // Usamos el texto procesado (transcripción o texto directo)
        content_type: inputType, // 'audio' o 'text'
        role: "user",
        processed: true,
        audio_url: "", // No guardamos el audio del usuario por defecto
        transcription: inputType === "audio" ? transcription : null, // Guardamos transcripción solo si hubo audio
        sender_type: "user", // Added sender_type
      });
    }

    // 4. Procesar el mensaje con el bot, pasando el sessionId si existe
    // Procesar mensaje con flujos dinámicos directamente
    const flowResponse = await processMessageWithFlows(
      userInputText,
      userId,
      tenantId,
      sessionId
    );

    // flowResponse puede ser objeto con text y tokensUsed o string
    // Normalizar la respuesta para tener una estructura consistente
    const botResponseText =
      typeof flowResponse === "object" && flowResponse.text
        ? flowResponse.text
        : typeof flowResponse === "string"
        ? flowResponse
        : "Lo siento, no he podido procesar tu mensaje."; // Respuesta por defecto

    const botResponse = { text: botResponseText };

    logger.info(
      `Respuesta del bot para session ${
        sessionId || "nueva"
      }: "${botResponse.text.substring(0, 100)}${
        botResponse.text.length > 100 ? "..." : ""
      }"`
    );

    // 5. Sintetizar la respuesta del bot a voz
    const voiceId = req.body.voice_id || config.minimax.voice;
    // Activamos streaming por defecto para respuestas más rápidas (a menos que se desactive explícitamente)
    const useStreaming =
      req.query.stream !== "false" &&
      config.minimax.streaming.enabled !== false;

    if (useStreaming) {
      // Verificar que tenemos texto válido antes de sintetizar
      if (!botResponse.text) {
        logger.error("Texto de respuesta vacío o inválido para streaming");
        return res.status(500).json({
          success: false,
          error: "Error al generar respuesta del bot para streaming",
          details: "Respuesta vacía o inválida",
        });
      }

      logger.info(
        `Usando modo streaming para síntesis de voz: "${botResponse.text.substring(
          0,
          30
        )}..."`
      );

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Transfer-Encoding", "chunked");

      try {
        const remoteStream = await synthesizeSpeechStreamWithMiniMax(
          botResponse.text,
          voiceId
        );

        const rl = createInterface({ input: remoteStream });

        // Contador para medir la latencia inicial
        const streamStartTime = Date.now();
        let firstChunkReceived = false;

        rl.on("line", (line: string) => {
          if (line.startsWith("data:")) {
            const payload = line.replace(/^data:\s*/, "");
            try {
              const json = JSON.parse(payload);
              const audioHex = json.reply?.audio || json.data?.audio;

              if (audioHex) {
                // Medimos el tiempo hasta el primer fragmento de audio
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  const initialLatency = Date.now() - streamStartTime;
                  logger.info(
                    `Primer fragmento de audio recibido en ${initialLatency}ms`
                  );
                }

                const buf = Buffer.from(audioHex, "hex");
                res.write(buf);
              }
            } catch (err) {
              // Solo registramos errores significativos, no líneas vacías
              if (line.length > 10) {
                logger.debug(
                  `Error al procesar línea de stream: ${err.message}`
                );
              }
            }
          }
        });

        rl.on("close", () => {
          logger.info(
            `Stream de audio completado en ${Date.now() - streamStartTime}ms`
          );
          res.end();
        });

        return;
      } catch (streamError) {
        logger.error(
          "Error en modo streaming, volviendo al modo no-streaming:",
          streamError
        );
        // Continuamos con el modo no-streaming como fallback
      }
    }
    // Verificar que tenemos texto válido antes de sintetizar
    if (!botResponse.text) {
      logger.error("Texto de respuesta vacío o inválido");
      return res.status(500).json({
        success: false,
        error: "Error al generar respuesta del bot",
        details: "Respuesta vacía o inválida",
      });
    }

    const audioResponse = await synthesizeSpeech(botResponse.text, voiceId);

    // Guardamos el audio y obtenemos la URL
    const audioUrl = saveAudioFile(
      audioResponse,
      tenantId,
      userId,
      botResponse.text,
      voiceId
    );

    // 6. Registrar mensaje del bot en Supabase (si está habilitado)
    if (config.supabase.enabled) {
      await logMessage({
        tenant_id: tenantId,
        bot_id: req.body.bot_id
          ? req.body.bot_id
          : "00000000-0000-0000-0000-000000000000", // NUNCA usar "default" como UUID
        user_id: userId,
        session_id: sessionId, // Usar el UUID válido para session_id
        content: botResponse.text, // Respuesta textual del bot
        content_type: "audio", // La respuesta siempre incluye audio
        role: "bot",
        processed: true,
        audio_url: audioUrl, // URL del audio generado
        transcription: botResponse.text, // Usamos la respuesta como 'transcripción' para el bot
        sender_type: "bot", // Added sender_type
      });

      // 7. Incrementar contador de uso (basado en segundos de audio de entrada si hubo)
      if (inputType === "audio") {
        const audioSeconds = Math.ceil(audioSize / 16000); // Aproximadamente 16KB por segundo
        await incrementUsage(tenantId, audioSeconds);
      } else {
        // Podríamos definir un costo fijo por mensaje de texto si es necesario
        await incrementUsage(tenantId, 1); // Ejemplo: Contar como 1 segundo por mensaje de texto
      }
    }

    // 8. Calcular el tiempo total de procesamiento
    const processingTime = Date.now() - startTime;

    // 9. Devolver la respuesta
    return res.json({
      success: true,
      transcription: transcription || userInputText, // Devolvemos transcripción si hubo audio, o el texto de entrada si no
      response: botResponse.text,
      audio_url: audioUrl,
      processing_time_ms: processingTime,
    });
  } catch (error) {
    logger.error("Error general en endpoint de chat:", error);
    return res.status(500).json({
      success: false,
      error: "Error al procesar chat de voz",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para probar solo transcripción
 * Útil para depuración y pruebas
 */
router.post("/transcribe", checkTenantQuota, async (req: AuthRequest, res) => {
  try {
    // Extraemos información del usuario
    const userId = req.user?.id || "anonymous";

    // Manejo garantizado del tenant_id para evitar errores de UUID
    let tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    if (
      tenantId === "default" ||
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId
      )
    ) {
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.info(
        `Usando UUID fijo para tenant default en /clear: ${tenantId}`
      );
    }

    let audioBuffer: Buffer;

    // Verificamos si se envió un archivo o base64
    if (!req.files || !req.files.audio) {
      const { audio_base64 } = req.body;

      if (!audio_base64) {
        return res.status(400).json({
          error: "No se proporcionó audio (ni como archivo ni como base64)",
        });
      }

      audioBuffer = base64ToBuffer(audio_base64);
    } else {
      const audioFile = req.files.audio as fileUpload.UploadedFile;
      audioBuffer = audioFile.data;
    }

    // Obtenemos el idioma si se especificó
    const language = req.body.language || "es";

    // Realizamos la transcripción
    const transcription = await transcribeAudio(audioBuffer, language);

    // Incrementamos contador de uso si Supabase está habilitado
    if (config.supabase.enabled) {
      await incrementUsage(tenantId);
    }

    return res.json({
      success: true,
      transcription,
    });
  } catch (error) {
    logger.error("Error en endpoint de transcripción:", error);
    return res.status(500).json({
      success: false,
      error: "Error al transcribir audio",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para probar solo síntesis de voz
 * Útil para depuración y pruebas
 */
router.post("/tts", checkTenantQuota, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || "anonymous";

    // Manejo garantizado del tenant_id para evitar errores de UUID
    let tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    if (
      tenantId === "default" ||
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId
      )
    ) {
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.info(
        `Usando UUID fijo para tenant default en /transcribe: ${tenantId}`
      );
    }

    const { text, voice_id } = req.body;

    logger.info(
      `Endpoint TTS - Petición recibida: texto="${text}", voice_id=${
        voice_id || "default"
      }`
    );
    // Streaming chunked si se solicita
    if (req.query.stream === "true") {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Transfer-Encoding", "chunked");
      const remoteStream = await synthesizeSpeechStreamWithMiniMax(
        text,
        voice_id
      );
      const rl = createInterface({ input: remoteStream });
      rl.on("line", (line: string) => {
        if (line.startsWith("data:")) {
          const payload = line.replace(/^data:\s*/, "");
          try {
            const json = JSON.parse(payload);
            const audioHex = json.reply?.audio || json.data?.audio;
            if (audioHex) {
              const buf = Buffer.from(audioHex, "hex");
              res.write(buf);
            }
          } catch {
            // ignorar errores de parsing
          }
        }
      });
      rl.on("close", () => res.end());
      return;
    }

    if (!text) {
      return res
        .status(400)
        .json({ error: "No se proporcionó texto para sintetizar" });
    }

    // Configuración de MiniMax a utilizar
    logger.info(
      `Usando configuración MiniMax: ${config.minimax.apiUrl.tts}?GroupId=${config.minimax.groupId}`
    );

    try {
      // Sintetizamos el texto
      logger.info("Llamando a synthesizeSpeech...");
      const audioBuffer = await synthesizeSpeech(text, voice_id);
      logger.info(`Audio generado: ${audioBuffer.length} bytes`);

      // Guardamos el archivo
      logger.info("Guardando archivo de audio...");
      const audioUrl = saveAudioFile(
        audioBuffer,
        tenantId,
        userId,
        text,
        voice_id
      );
      logger.info(`Archivo guardado en: ${audioUrl}`);

      // Incrementamos contador de uso si Supabase está habilitado
      if (config.supabase.enabled) {
        await incrementUsage(tenantId);
      }

      return res.json({
        success: true,
        text,
        audio_url: audioUrl,
        audio_size: audioBuffer.length,
        debug_info: {
          // Incluimos información de depuración en la respuesta
          first_bytes: audioBuffer.slice(0, 20).toString("hex"),
          content_type: "audio/mp3", // El formato conforme al payload
          api_url: `${config.minimax.apiUrl.tts}?GroupId=${config.minimax.groupId}`,
        },
      });
    } catch (synthError) {
      logger.error("Error al sintetizar voz:", synthError);
      return res.status(500).json({
        success: false,
        error: "Error al sintetizar voz",
        details:
          synthError instanceof Error
            ? synthError.message
            : "Error desconocido",
      });
    }
  } catch (error) {
    logger.error("Error en endpoint de síntesis de voz:", error);
    return res.status(500).json({
      success: false,
      error: "Error al sintetizar voz",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para limpiar conversación
 * Permite reiniciar el contexto del chat
 */
router.post("/clear", async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id || "anonymous";

    // Manejo garantizado del tenant_id para evitar errores de UUID
    let tenantId = req.user?.tenantId || config.multitenant.defaultTenant;
    if (
      tenantId === "default" ||
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId
      )
    ) {
      tenantId =
        config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000";
      logger.info(
        `Usando UUID fijo para tenant default en /clear: ${tenantId}`
      );
    }

    // Limpiamos la conversación usando clearFlowState
    await clearFlowState(userId, tenantId);

    return res.json({
      success: true,
      message: "Conversación reiniciada correctamente",
    });
  } catch (error) {
    logger.error("Error al limpiar conversación:", error);
    return res.status(500).json({
      success: false,
      error: "Error al reiniciar conversación",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para obtener las voces disponibles
 * Útil para interfaces que permiten seleccionar voz
 */
router.get("/voices", async (req, res) => {
  try {
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

    // Agrupamos por categorías
    const voicesByCategory = {
      male: [
        "Deep_Voice_Man",
        "Casual_Guy",
        "Patient_Man",
        "Young_Knight",
        "Determined_Man",
        "Decent_Boy",
        "Elegant_Man",
      ],
      female: [
        "Wise_Woman",
        "Inspirational_girl",
        "Calm_Woman",
        "Lively_Girl",
        "Lovely_Girl",
        "Abbess",
        "Sweet_Girl_2",
        "Exuberant_Girl",
      ],
      neutral: ["Friendly_Person", "Imposing_Manner"],
    };

    return res.json({
      success: true,
      default_voice: config.minimax.voice,
      voices: availableVoices,
      voices_by_category: voicesByCategory,
    });
  } catch (error) {
    logger.error("Error al obtener voces disponibles:", error);
    return res.status(500).json({
      success: false,
      error: "Error al obtener voces disponibles",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Endpoint para verificar estado del servicio
 * Útil para monitoreo y healthchecks
 */
router.get("/health", async (req, res) => {
  try {
    return res.json({
      status: "ok",
      version: "2.0.0",
      timestamp: new Date().toISOString(),
      services: {
        stt: {
          provider: "assemblyai",
          status: "active",
        },
        tts: {
          provider: "minimax",
          status: "active",
        },
        bot: {
          engine: "builderbot",
          status: "active",
        },
        database: {
          type: config.supabase.enabled ? "supabase" : "local",
          status: "active",
        },
      },
    });
  } catch (error) {
    logger.error("Error en health check:", error);
    return res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
