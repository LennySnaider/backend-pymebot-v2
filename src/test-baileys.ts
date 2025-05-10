import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import logger from "./utils/logger"; // Reutilizamos el logger existente

async function connectToWhatsApp() {
  logger.info("Iniciando conexión directa con Baileys...");

  const sessionDir = path.join(process.cwd(), "sessions_test"); // Usamos un directorio de sesión separado para la prueba
  logger.info(`Directorio de sesión para prueba: ${sessionDir}`);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      // can provide additional config here
      printQRInTerminal: true, // Intentamos imprimir QR en terminal también
      auth: state,
      logger: logger as any, // Pasamos nuestro logger (casteado a any si es necesario)
      // browser: ['MiBot', 'Chrome', '1.0.0'] // Opcional: Simular navegador
    });

    logger.info("Socket creado. Escuchando eventos connection.update...");

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      logger.info(
        "Evento connection.update recibido:",
        JSON.stringify(update, null, 2)
      );

      if (qr) {
        logger.info(
          `****** QR Recibido (primeros 30 chars): ${qr.substring(
            0,
            30
          )}... ******`
        );
        // Aquí podríamos generar el archivo PNG si quisiéramos
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;
        logger.warn(
          `Conexión cerrada debido a: ${lastDisconnect?.error}, reconectar: ${shouldReconnect}`
        );
        // Lógica de reconexión si es necesario
        if (shouldReconnect) {
          // connectToWhatsApp(); // Podríamos intentar reconectar
        }
      } else if (connection === "open") {
        logger.info("****** Conexión abierta ******");
      }
    });

    sock.ev.on("creds.update", saveCreds);

    logger.info("Listeners de eventos configurados.");
  } catch (error) {
    logger.error("Error durante la conexión directa con Baileys:", error);
  }
}

connectToWhatsApp();
