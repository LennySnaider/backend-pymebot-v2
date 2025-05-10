/**
 * src/utils/logger.ts
 *
 * Sistema de registro para la aplicación.
 * Proporciona funciones para registrar eventos, errores y métricas.
 * @version 1.0.0
 * @updated 2024-04-16
 */

import fs from "fs";
import path from "path";
import { config } from "../config";

// Niveles de log disponibles
type LogLevel = "debug" | "info" | "warn" | "error";

// Colores para la consola
const colors = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Verde
  warn: "\x1b[33m",  // Amarillo
  error: "\x1b[31m", // Rojo
  reset: "\x1b[0m",  // Reset
};

// Directorio para logs
const LOG_DIR = path.join(process.cwd(), "logs");

// Aseguramos que exista el directorio de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Formatea la fecha actual para logs
 * @returns Fecha formateada
 */
const getFormattedDate = (): string => {
  const now = new Date();
  return now.toISOString();
};

/**
 * Obtiene el nombre del archivo de log para la fecha actual
 * @returns Ruta del archivo de log
 */
const getLogFile = (): string => {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `${date}.log`);
};

/**
 * Escribe un mensaje en el archivo de log
 * @param level Nivel de log
 * @param message Mensaje a registrar
 * @param meta Metadatos adicionales
 */
const writeToFile = (level: LogLevel, message: string, meta?: any): void => {
  try {
    const timestamp = getFormattedDate();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Añadimos metadatos si existen
    if (meta) {
      const metaString = typeof meta === "object" 
        ? JSON.stringify(meta) 
        : String(meta);
      logMessage += ` | ${metaString}`;
    }
    
    // Añadimos salto de línea
    logMessage += "\n";
    
    // Escribimos al archivo asíncronamente (sin bloquear)
    fs.appendFile(getLogFile(), logMessage, (err) => {
      if (err) {
        console.error("Error al escribir en archivo de log:", err);
      }
    });
  } catch (error) {
    console.error("Error en sistema de logs:", error);
  }
};

/**
 * Imprime un mensaje en la consola con colores
 * @param level Nivel de log
 * @param message Mensaje a registrar
 * @param meta Metadatos adicionales
 */
const logToConsole = (level: LogLevel, message: string, meta?: any): void => {
  const timestamp = getFormattedDate();
  const color = colors[level] || colors.reset;
  
  let logMessage = `${color}[${timestamp}] [${level.toUpperCase()}] ${message}${colors.reset}`;
  
  console.log(logMessage);
  
  // Si hay metadatos, los mostramos
  if (meta) {
    console.dir(meta, { depth: 4, colors: true });
  }
};

/**
 * Clase principal para manejo de logs
 */
class Logger {
  /**
   * Registra un mensaje de nivel debug
   * @param message Mensaje a registrar
   * @param meta Metadatos adicionales
   */
  debug(message: string, meta?: any): void {
    // Solo mostramos debug en desarrollo
    if (config.environment === "development") {
      logToConsole("debug", message, meta);
    }
    writeToFile("debug", message, meta);
  }
  
  /**
   * Registra un mensaje de nivel info
   * @param message Mensaje a registrar
   * @param meta Metadatos adicionales
   */
  info(message: string, meta?: any): void {
    logToConsole("info", message, meta);
    writeToFile("info", message, meta);
  }
  
  /**
   * Registra un mensaje de nivel warn
   * @param message Mensaje a registrar
   * @param meta Metadatos adicionales
   */
  warn(message: string, meta?: any): void {
    logToConsole("warn", message, meta);
    writeToFile("warn", message, meta);
  }
  
  /**
   * Registra un mensaje de nivel error
   * @param message Mensaje a registrar
   * @param meta Metadatos adicionales
   */
  error(message: string, meta?: any): void {
    logToConsole("error", message, meta);
    writeToFile("error", message, meta);
  }
  
  /**
   * Registra una excepción con stack trace
   * @param error Error a registrar
   * @param context Contexto adicional
   */
  exception(error: Error, context?: any): void {
    const meta = {
      stack: error.stack,
      ...context
    };
    
    this.error(`Excepción: ${error.message}`, meta);
  }
  
  /**
   * Registra una métrica para análisis
   * @param name Nombre de la métrica
   * @param value Valor de la métrica
   * @param tags Etiquetas adicionales
   */
  metric(name: string, value: number, tags?: Record<string, string>): void {
    const meta = {
      type: "metric",
      name,
      value,
      tags,
      timestamp: Date.now()
    };
    
    this.info(`Métrica: ${name}=${value}`, meta);
  }
  
  /**
   * Registra un evento del sistema
   * @param eventName Nombre del evento
   * @param data Datos del evento
   */
  event(eventName: string, data?: any): void {
    const meta = {
      type: "event",
      event: eventName,
      data,
      timestamp: Date.now()
    };
    
    this.info(`Evento: ${eventName}`, meta);
  }
}

// Exportamos una instancia única
export const logger = new Logger();
export default logger;
