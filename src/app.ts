/**
 * src/app.ts
 *
 * Archivo principal de la aplicación que configura el servidor Express,
 * integra los servicios de voz y gestiona la conexión con WhatsApp.
 * @version 1.4.0
 * @updated 2025-04-26
 */

import express from "express";
import { createBot, createFlow, MemoryDB } from "@builderbot/bot";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Obtenemos el equivalente a __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { config } from "./config";
import voiceRouter from "./api/voice";
import textRouter from "./api/text"; // Importamos el nuevo router de texto
import flowsRouter from "./api/flows";
import templatesRouter from "./api/templates";
import businessRouter from "./api/business"; // Importamos el router de business
import appointmentsRouter from "./api/appointments"; // Importamos el router de appointments
import flowDiagnosticRouter from "./api/flow-diagnostic"; // Router para diagnóstico de flujos
import adminRouter from "./api/admin"; // Router para funciones administrativas
import templatesDiagnosticRouter from "./api/templates-diagnostic"; // Router para diagnóstico de plantillas
import systemRouter from "./api/system"; // Router para información del sistema
import connectionTestRouter from "./api/connection-test"; // Router para pruebas de conexión
import builderbotRouter from "./api/builderbot-integration"; // Importamos router de integración con BuilderBot
import logger from "./utils/logger";
import { initWhatsAppProvider } from "./provider/whatsappProvider";
import { FlowService } from "./services/flowService";
import { cleanAllSessions } from "./utils/cleanSessions";
// import { preRenderCommonPhrases } from "./services/tts";  // Comentado temporalmente

// Los flujos predeterminados han sido desactivados para forzar el uso de plantillas configuradas
// import welcomeFlow from "./flows/welcome.flow.js";
// import infoFlow from "./flows/info.flow.js";

// Aseguramos que existan los directorios necesarios
[config.paths.sessions, config.paths.qr, config.paths.audio].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Directorio creado: ${dir}`);
  }
});

// Configuración del servidor Express
const app = express();
const PORT = config.port;

// Middlewares básicos
// Configurar CORS para permitir cualquier origen y método
app.use(cors({
  origin: true, // Esto permite cualquier origen
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Middleware específico para OPTIONS preflight
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Configuración de rutas estáticas
app.use("/qr", express.static(config.paths.qr));
app.use("/audio", express.static(config.paths.audio));
app.use(express.static(join(__dirname, "..", "public")));

// Ruta principal para verificar que el servidor está funcionando
app.get("/", (req, res) => {
  res.json({
    message: "v2-backend-pymebot API funcionando",
    status: "ok",
    version: "1.4.1",
    timestamp: new Date().toISOString()
  });
});

// Ruta de salud para verificar que el servidor está funcionando
app.get("/health", (req, res) => {
  const origin = req.headers.origin || "Unknown";

  res.json({
    status: "ok",
    version: "1.4.1",
    timestamp: new Date().toISOString(),
    environment: config.environment,
    origin: origin,
    services: {
      voice: true,
      text: true, // Añadimos el nuevo servicio de texto
      flows: true,
      templates: true,
      whatsapp: config.whatsapp.enabled,
    },
  });
});

// Ruta de verificación simple para CORS
app.get("/cors-test", (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  res.json({
    message: "CORS funcionando correctamente",
    origin: origin,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
});

// Ruta de diagnóstico para probar el sistema
app.get("/api/debug", (req, res) => {
  res.json({
    status: "ok",
    server: {
      version: "1.4.1",
      time: new Date().toISOString(),
      uptime: process.uptime(),
      port: config.port,
      api: {
        text: true,
        voice: true,
        whatsapp: config.whatsapp.enabled
      }
    },
    request: {
      headers: req.headers,
      ip: req.ip,
      method: req.method,
      path: req.path
    }
  });
});

// Registramos las APIs
app.use("/api/voice", voiceRouter);
app.use("/api/text", textRouter);
app.use("/api/flows", flowsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/business", businessRouter); // Registramos la nueva API de business
app.use("/api/appointments", appointmentsRouter); // Registramos la nueva API de appointments
app.use("/api/flow-diagnostic", flowDiagnosticRouter); // Registramos el router de diagnóstico de flujos
app.use("/api/admin", adminRouter); // Registramos el router administrativo
app.use("/api/templates-diagnostic", templatesDiagnosticRouter); // Registramos el router de diagnóstico de plantillas
app.use("/api/system", systemRouter); // Registramos el router de información del sistema
app.use("/api/connection-test", connectionTestRouter); // Registramos el router de prueba de conexión
app.use("/api/builderbot", builderbotRouter); // Registramos el router de integración con BuilderBot

// Inicialización de la aplicación
const main = async () => {
  try {
    logger.info(`Iniciando aplicación en entorno: ${config.environment}`);
    logger.info(`Puerto configurado: ${PORT}`);

    // Desactivando pre-renderizado para enfocarnos en la integración con MiniMax STT
    logger.info("Pre-renderizado desactivado temporalmente");

    // Solo inicializar WhatsApp si está habilitado
    if (config.whatsapp.enabled) {
      logger.info("Iniciando proveedor de WhatsApp...");

      try {
        // Limpiamos las sesiones antiguas o corruptas que puedan causar problemas
        // Esto soluciona errores como "Failed to decrypt message with any known session"
        logger.info("Limpiando sesiones antiguas de WhatsApp...");
        const cleanResult = cleanAllSessions(true); // true = mantener el QR
        logger.info(`Resultado de limpieza de sesiones: ${cleanResult ? 'Éxito' : 'Error'}`);

        const adapterProvider = await initWhatsAppProvider();
        const adapterDB = new MemoryDB();
        const flowService = new FlowService();
        const tenantId = config.multitenant.defaultTenant;

        const dynamicFlow = await flowService.getFlowByTenant(tenantId);
        const adapterFlow = createFlow(
          dynamicFlow ? [dynamicFlow] : []
        );

        // IMPORTANTE: Creamos el bot y capturamos el valor de retorno
        // Esto es crucial para que los eventos de WhatsApp (como el QR) funcionen correctamente
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const botInstance = await createBot({
          flow: adapterFlow,
          provider: adapterProvider,
          database: adapterDB,
        });

        // Inicializamos el servidor HTTP para WhatsApp
        // Primero intentamos usar httpServer del botInstance (método recomendado)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (
          botInstance &&
          typeof (botInstance as any).httpServer === "function"
        ) {
          // No pasamos el puerto porque ya lo configuramos en app.listen más abajo
          (botInstance as any).httpServer();
        } else {
          // Fallback al método alternativo si httpServer no está disponible
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const providerAny = adapterProvider as any;
          if (typeof providerAny.initHttpServer === "function") {
            providerAny.initHttpServer(app);
          }
        }

        logger.info("Proveedor de WhatsApp inicializado correctamente");
      } catch (error) {
        logger.error("Error al inicializar WhatsApp", error);
      }
    } else {
      logger.info("WhatsApp deshabilitado en configuración");
    }

    // Iniciamos el servidor
    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);

      const serverUrl = `http://localhost:${PORT}`;
      logger.info(`[Web]: ${serverUrl}`);
      logger.info(`[API Voice]: ${serverUrl}/api/voice`);
      logger.info(`[API Text]: ${serverUrl}/api/text`);
      logger.info(`[API Flows]: ${serverUrl}/api/flows`);
      logger.info(`[API Templates]: ${serverUrl}/api/templates`);
      logger.info(`[API Business]: ${serverUrl}/api/business`);
      logger.info(`[API Appointments]: ${serverUrl}/api/appointments`);
      logger.info(`[API Flow Diagnostic]: ${serverUrl}/api/flow-diagnostic`);
      logger.info(`[API Admin]: ${serverUrl}/api/admin`);
      logger.info(`[API Templates Diagnostic]: ${serverUrl}/api/templates-diagnostic`);
      logger.info(`[API System]: ${serverUrl}/api/system`);
      logger.info(`[API Connection Test]: ${serverUrl}/api/connection-test`);
      logger.info(`[API BuilderBot]: ${serverUrl}/api/builderbot`);
      logger.info(`[CORS Test]: ${serverUrl}/cors-test`);

      if (config.whatsapp.enabled) {
        logger.info(`[QR]: ${serverUrl}/qr/bot.qr.png`);
      }
    });
  } catch (error) {
    logger.error("Error al iniciar la aplicación", error);
    process.exit(1);
  }
};

// Control de procesos para cierre limpio
process.on("SIGINT", () => {
  logger.info("Recibida señal SIGINT, cerrando aplicación...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Recibida señal SIGTERM, cerrando aplicación...");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error("Excepción no controlada", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Promesa rechazada no controlada", reason);
});

// Iniciamos la aplicación
main();

export default app;
