/**
 * src/services/buttonNavigationQueue.ts
 * 
 * Cola de mensajes para manejar la navegación de botones
 * @created 2025-05-16
 */

import logger from "../utils/logger";

// Estructura para almacenar mensajes pendientes por sesión
const messageQueues: Map<string, any[]> = new Map();

/**
 * Añade un mensaje a la cola para una sesión específica
 * @param sessionKey Clave de sesión (tenantId:phoneFrom:sessionId)
 * @param message Mensaje a encolar
 */
export function enqueueMessage(sessionKey: string, message: any): void {
  logger.info(`[buttonNavigationQueue] Encolando mensaje para sesión ${sessionKey}:`, JSON.stringify(message));
  
  const queue = messageQueues.get(sessionKey) || [];
  queue.push(message);
  messageQueues.set(sessionKey, queue);
}

/**
 * Obtiene y limpia todos los mensajes de la cola para una sesión
 * @param sessionKey Clave de sesión
 * @returns Array de mensajes
 */
export function dequeueMessages(sessionKey: string): any[] {
  const messages = messageQueues.get(sessionKey) || [];
  logger.info(`[buttonNavigationQueue] Decolando ${messages.length} mensajes para sesión ${sessionKey}`);
  
  // Limpiar la cola
  messageQueues.delete(sessionKey);
  
  return messages;
}

/**
 * Verifica si hay mensajes en la cola para una sesión
 * @param sessionKey Clave de sesión
 * @returns true si hay mensajes
 */
export function hasMessages(sessionKey: string): boolean {
  const queue = messageQueues.get(sessionKey);
  return queue ? queue.length > 0 : false;
}

/**
 * Limpia colas antiguas
 * @param maxAgeMinutes Edad máxima en minutos
 */
export function cleanupOldQueues(maxAgeMinutes: number = 30): void {
  // Por ahora simplemente limpiamos todas las colas
  // En el futuro podríamos agregar timestamps
  messageQueues.clear();
  logger.info(`[buttonNavigationQueue] Todas las colas limpiadas`);
}

// Limpiar periódicamente
setInterval(() => {
  cleanupOldQueues(30);
}, 30 * 60 * 1000);