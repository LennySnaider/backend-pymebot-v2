/**
 * src/config/index.ts
 *
 * Configuración centralizada para la aplicación.
 * Incluye rutas, claves API y parámetros del sistema.
 * @version 2.0.0
 * @updated 2025-04-17
 */

import { join } from "path";
import dotenv from "dotenv";

dotenv.config();

// Variables de entorno verificadas y cargadas correctamente

export const config = {
  // Configuración general
  port: parseInt(process.env.PORT || '3090', 10),
  environment: process.env.NODE_ENV || "development",

  // Rutas de directorios
  paths: {
    sessions: join(process.cwd(), "sessions"),
    qr: join(process.cwd(), "assets", "qr"),
    audio: join(process.cwd(), "assets", "audio"),
  },

  // Configuración de AssemblyAI
  assemblyai: {
    apiKey: process.env.ASSEMBLYAI_API_KEY || "",
  },

  // Configuración de MiniMax
  minimax: {
    apiKey: process.env.MINIMAX_API_KEY || "",
    groupId: process.env.MINIMAX_GROUP_ID || "",
    model: process.env.MINIMAX_MODEL || "speech-02-hd", // Modelo por defecto
    voice: process.env.MINIMAX_VOICE || "Friendly_Person", // Voz por defecto
    // URLs de API
    apiUrl: {
      tts: process.env.MINIMAX_API_URL || "https://api.minimax.chat/v1/t2a_v2",
      stt:
        process.env.MINIMAX_STT_API_URL ||
        "https://api.minimax.chat/v1/audio/transcriptions",
    },
    // Cache configuración
    cache: {
      enabled: process.env.ENABLE_TTS_CACHE === "true",
      expiration: parseInt(process.env.TTS_CACHE_EXPIRATION || "86400"), // 24 horas por defecto
    },
    // Configuración de streaming (para respuestas más rápidas)
    streaming: {
      enabled: process.env.ENABLE_MINIMAX_STREAMING !== "false", // Habilitado por defecto
      bufferSize: parseInt(process.env.MINIMAX_STREAMING_BUFFER || "4096"),
      timeout: parseInt(process.env.MINIMAX_STREAMING_TIMEOUT || "30000"), // 30 segundos por defecto
    },
  },

  // Configuración de WhatsApp
  whatsapp: {
    enabled: process.env.ENABLE_WHATSAPP !== "false",
    sessionName: process.env.WHATSAPP_SESSION_NAME || "bot",
    provider: process.env.WHATSAPP_PROVIDER || "baileys", // "baileys" o "meta"
  },

  // Configuración de OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || "500"),
    presencePenalty: parseFloat(process.env.OPENAI_PRESENCE_PENALTY || "0"),
    frequencyPenalty: parseFloat(process.env.OPENAI_FREQUENCY_PENALTY || "0"),
  },

  // Configuración de Supabase
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    enabled: process.env.ENABLE_SUPABASE === "true",
  },

  // Configuración para múltiples tenants
  multitenant: {
    enabled: process.env.ENABLE_MULTITENANT === "true",
    defaultTenant: process.env.DEFAULT_TENANT_ID || "default",
    // UUID fijo para el tenant por defecto (usar en interacciones con DB que esperan UUID)
    defaultTenantUuid: process.env.DEFAULT_TENANT_UUID || "afa60b0a-3046-4607-9c48-266af6e1d322",
  },
  
  // Características habilitadas
  features: {
    quotaValidation: process.env.ENABLE_QUOTA_VALIDATION === "true",
    usageTracking: process.env.ENABLE_USAGE_TRACKING === "true",
  },
  
  // Modo debug
  debug: process.env.NODE_ENV === "development",
};

export default config;
