/**
 * Store global para variables de sesión del chatbot
 * Permite acceso a variables generadas durante la ejecución de callbacks
 */

import logger from "../utils/logger";

// Store global para variables por sesión
const sessionVariableStore: Map<string, Record<string, any>> = new Map();

/**
 * Guarda una variable en la sesión
 */
export function setSessionVariable(sessionId: string, key: string, value: any): void {
  const sessionKey = `session_${sessionId}`;
  
  if (!sessionVariableStore.has(sessionKey)) {
    sessionVariableStore.set(sessionKey, {});
  }
  
  const sessionVars = sessionVariableStore.get(sessionKey)!;
  sessionVars[key] = value;
  
  logger.info(`[sessionVariableStore] Variable '${key}' guardada para sesión ${sessionId}: ${value}`);
}

/**
 * Obtiene una variable de la sesión
 */
export function getSessionVariable(sessionId: string, key: string): any {
  const sessionKey = `session_${sessionId}`;
  const sessionVars = sessionVariableStore.get(sessionKey);
  
  if (sessionVars && sessionVars[key] !== undefined) {
    logger.info(`[sessionVariableStore] Variable '${key}' encontrada para sesión ${sessionId}: ${sessionVars[key]}`);
    return sessionVars[key];
  }
  
  logger.warn(`[sessionVariableStore] Variable '${key}' no encontrada para sesión ${sessionId}`);
  return undefined;
}

/**
 * Obtiene todas las variables de una sesión
 */
export function getSessionVariables(sessionId: string): Record<string, any> {
  const sessionKey = `session_${sessionId}`;
  const sessionVars = sessionVariableStore.get(sessionKey);
  
  if (sessionVars) {
    logger.info(`[sessionVariableStore] Variables encontradas para sesión ${sessionId}: ${Object.keys(sessionVars).join(', ')}`);
    return { ...sessionVars };
  }
  
  logger.info(`[sessionVariableStore] No hay variables para sesión ${sessionId}`);
  return {};
}

/**
 * Guarda múltiples variables en la sesión
 */
export function setSessionVariables(sessionId: string, variables: Record<string, any>): void {
  const sessionKey = `session_${sessionId}`;
  
  if (!sessionVariableStore.has(sessionKey)) {
    sessionVariableStore.set(sessionKey, {});
  }
  
  const sessionVars = sessionVariableStore.get(sessionKey)!;
  Object.assign(sessionVars, variables);
  
  logger.info(`[sessionVariableStore] Variables guardadas para sesión ${sessionId}: ${Object.keys(variables).join(', ')}`);
}

/**
 * Limpia las variables de una sesión
 */
export function clearSessionVariables(sessionId: string): void {
  const sessionKey = `session_${sessionId}`;
  sessionVariableStore.delete(sessionKey);
  logger.info(`[sessionVariableStore] Variables limpiadas para sesión ${sessionId}`);
}

/**
 * Limpia sesiones antiguas (llamar periódicamente)
 */
export function cleanupOldSessions(maxAgeMinutes: number = 60): number {
  // Por simplicidad, limpiar todas las sesiones por ahora
  // En el futuro se puede implementar con timestamps
  const beforeCount = sessionVariableStore.size;
  sessionVariableStore.clear();
  const cleanedCount = beforeCount;
  
  if (cleanedCount > 0) {
    logger.info(`[sessionVariableStore] Limpiadas ${cleanedCount} sesiones`);
  }
  
  return cleanedCount;
}

// Limpieza periódica cada 30 minutos
setInterval(() => {
  cleanupOldSessions(30);
}, 30 * 60 * 1000);