/**
 * backend/src/provider/index.ts
 * Configuración del provider Baileys para el bot
 * @version 1.0.1
 * @updated 2024-02-01
 */

import { createProvider } from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { config } from "../config";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

// Crear directorio de sesiones si no existe
const SESSION_DIR = join(process.cwd(), "sessions");
if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR, { recursive: true });
}

// Crear directorio para almacenar QR y otros assets
const ASSETS_DIR = join(process.cwd(), "assets");
if (!existsSync(ASSETS_DIR)) {
  mkdirSync(ASSETS_DIR, { recursive: true });
}

// Configuración específica para Baileys
const baileysConfig = {
  useMobile: false, // Deshabilitamos la conexión por código móvil para usar QR
  usePairingCode: false, // No usar código de emparejamiento
  // phoneNumber: config.PHONE_NUMBER, // Comentamos para no usar el método de teléfono

  // Optimizaciones de rendimiento
  experimentalStore: true,
  timeRelease: 10800000,

  // Configuración de almacenamiento de sesión
  sessionDir: SESSION_DIR,

  // Configuración avanzada de Baileys
  options: {
    // Configuración del navegador
    browser: ["BuilderBot", "Chrome", "120.0.0"],

    // Logs solo en desarrollo
    logging: config.environment === "development",

    // Desactivar QR
    qr: true,

    // Configuración de autenticación
    auth: {
      creds: {},
      keys: {}
      // Eliminamos type: "mobile" para permitir QR
    },

    // Configuración específica para conexión QR
    mobile: {
      useQR: true,
      generateUrlInfo: true,
    },

    // Prevenir reconexiones innecesarias
    connectOnInit: true,
    shouldReconnect: () => true,

    // Tipo de conexión
    connection: {
      // Eliminamos type: "mobile" para permitir QR
    },
  },
};

// Crear y exportar el provider
export const provider = createProvider(BaileysProvider, baileysConfig);
