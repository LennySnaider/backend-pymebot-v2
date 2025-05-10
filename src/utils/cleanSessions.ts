/**
 * src/utils/cleanSessions.ts
 * 
 * Utilidad para limpiar sesiones antiguas o corruptas de WhatsApp
 * Ayuda a resolver problemas de cifrado y errores de sesión
 * @version 1.0.0
 * @updated 2025-05-08
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config';
import logger from './logger';

/**
 * Limpia todas las sesiones de WhatsApp y archivos asociados
 * Útil cuando hay errores de cifrado o problemas de sesión
 * 
 * @param keepQR Mantener el código QR generado (por defecto: false)
 * @returns True si se limpiaron las sesiones correctamente
 */
export function cleanAllSessions(keepQR = false): boolean {
  try {
    const sessionsDir = config.paths.sessions || './bot_sessions';
    
    if (!fs.existsSync(sessionsDir)) {
      logger.info(`Directorio de sesiones ${sessionsDir} no existe, se creará uno nuevo`);
      fs.mkdirSync(sessionsDir, { recursive: true });
      return true;
    }
    
    // Leer todos los archivos en el directorio
    const files = fs.readdirSync(sessionsDir);
    let removedCount = 0;
    
    for (const file of files) {
      // Si keepQR es true, omitimos archivos QR
      if (keepQR && file.endsWith('.png')) {
        continue;
      }
      
      const filePath = path.join(sessionsDir, file);
      
      // Verificar si es un archivo o directorio
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        // Eliminar el archivo
        fs.unlinkSync(filePath);
        removedCount++;
      } else if (stats.isDirectory()) {
        // Para directorios, podríamos usar fs.rmdirSync con { recursive: true }
        // pero es mejor procesarlos manualmente para mayor control
        cleanDirectoryContents(filePath);
      }
    }
    
    logger.info(`Limpieza de sesiones completada: ${removedCount} archivos eliminados`);
    return true;
  } catch (error) {
    logger.error('Error al limpiar sesiones:', error);
    return false;
  }
}

/**
 * Limpia el contenido de un directorio recursivamente
 * 
 * @param dirPath Ruta al directorio a limpiar
 */
function cleanDirectoryContents(dirPath: string): void {
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        fs.unlinkSync(filePath);
      } else if (stats.isDirectory()) {
        cleanDirectoryContents(filePath);
        // Después de limpiar el directorio, lo eliminamos si está vacío
        fs.rmdirSync(filePath);
      }
    }
  } catch (error) {
    logger.error(`Error al limpiar directorio ${dirPath}:`, error);
  }
}

/**
 * Limpia solo los archivos de sesión más antiguos que cierta edad
 * Útil para mantenimiento periódico sin interrumpir conexiones activas
 * 
 * @param maxAgeHours Edad máxima de archivos a mantener en horas
 * @returns Número de archivos eliminados
 */
export function cleanOldSessions(maxAgeHours = 24): number {
  try {
    const sessionsDir = config.paths.sessions || './bot_sessions';
    
    if (!fs.existsSync(sessionsDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(sessionsDir);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const file of files) {
      // Ignorar archivos especiales
      if (file === 'creds.json' || file === 'baileys_store.json') {
        continue;
      }
      
      const filePath = path.join(sessionsDir, file);
      const stats = fs.statSync(filePath);
      
      // Si el archivo es más antiguo que maxAgeMs
      if (stats.isFile() && now - stats.mtime.getTime() > maxAgeMs) {
        fs.unlinkSync(filePath);
        removedCount++;
      }
    }
    
    logger.info(`Limpieza de sesiones antiguas completada: ${removedCount} archivos eliminados`);
    return removedCount;
  } catch (error) {
    logger.error('Error al limpiar sesiones antiguas:', error);
    return 0;
  }
}

// Exponemos las funciones
export default {
  cleanAllSessions,
  cleanOldSessions
};