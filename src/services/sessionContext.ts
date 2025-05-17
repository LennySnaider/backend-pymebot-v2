/**
 * src/services/sessionContext.ts
 * 
 * Almacena contexto de sesión global para el bot
 * @created 2025-05-16
 */

import logger from "../utils/logger";

// Almacén global para contexto de sesiones
const sessionContextMap: Map<string, any> = new Map();

/**
 * Guarda el contexto de sesión para un usuario
 * @param userId ID del usuario (ctx.from)
 * @param context Objeto con tenantId, sessionId, etc.
 */
export function setSessionContext(userId: string, context: any): void {
  logger.info(`[sessionContext] Guardando contexto para usuario ${userId}:`, context);
  sessionContextMap.set(userId, context);
}

/**
 * Obtiene el contexto de sesión para un usuario
 * @param userId ID del usuario (ctx.from)
 * @returns Contexto de sesión o null
 */
export function getSessionContext(userId: string): any {
  const context = sessionContextMap.get(userId);
  logger.info(`[sessionContext] Recuperando contexto para usuario ${userId}:`, context);
  return context || null;
}

/**
 * Limpia contextos antiguos
 * @param maxAgeMinutes Edad máxima en minutos
 */
export function cleanupOldContexts(maxAgeMinutes: number = 60): void {
  // Por ahora simplemente limpiamos todo
  const size = sessionContextMap.size;
  sessionContextMap.clear();
  logger.info(`[sessionContext] Limpiadas ${size} sesiones`);
}

// Limpiar periódicamente
setInterval(() => {
  cleanupOldContexts(60);
}, 60 * 60 * 1000); // cada hora