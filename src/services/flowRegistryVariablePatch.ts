/**
 * src/services/flowRegistryVariablePatch.ts
 * 
 * Parche para interceptar las actualizaciones de variables de BuilderBot
 * y sincronizarlas con el estado del flujo.
 * 
 * @created 2025-05-16
 */

import logger from "../utils/logger";

// Cache global de variables por sesión
export const sessionVariablesCache: Map<string, Record<string, any>> = new Map();

// Interceptor para el logger original
const originalLoggerInfo = logger.info.bind(logger);

// Override del logger para capturar variables actualizadas
logger.info = function(...args: any[]) {
  // Llamar al logger original
  originalLoggerInfo(...args);
  
  // Detectar actualizaciones de variables
  const message = args[0];
  if (typeof message === 'string' && message.includes('Variable') && message.includes('actualizada con:')) {
    // Extraer nombre de variable y valor
    const match = message.match(/Variable (\w+) actualizada con: (.+)/);
    if (match) {
      const [, variableName, value] = match;
      
      // Buscar la sesión actual (esto es un hack temporal)
      // En producción deberíamos pasar el sessionId de alguna manera
      const sessionKeys = Array.from(sessionVariablesCache.keys());
      const currentSession = sessionKeys[sessionKeys.length - 1] || 'default';
      
      // Actualizar el cache
      const currentVars = sessionVariablesCache.get(currentSession) || {};
      currentVars[variableName] = value;
      sessionVariablesCache.set(currentSession, currentVars);
      
      originalLoggerInfo(`[flowRegistryVariablePatch] Variable capturada: ${variableName} = ${value} para sesión ${currentSession}`);
    }
  }
}

/**
 * Establece la sesión actual para captura de variables
 * @param sessionId ID de la sesión
 */
export function setCurrentSession(sessionId: string): void {
  if (!sessionVariablesCache.has(sessionId)) {
    sessionVariablesCache.set(sessionId, {});
  }
}

/**
 * Obtiene las variables de una sesión
 * @param sessionId ID de la sesión
 * @returns Variables capturadas
 */
export function getSessionVariables(sessionId: string): Record<string, any> {
  return sessionVariablesCache.get(sessionId) || {};
}

/**
 * Limpiar sesiones antiguas
 */
export function cleanupSessions(): void {
  // Mantener solo las últimas 100 sesiones
  if (sessionVariablesCache.size > 100) {
    const keys = Array.from(sessionVariablesCache.keys());
    keys.slice(0, keys.length - 100).forEach(key => {
      sessionVariablesCache.delete(key);
    });
  }
}