/**
 * src/services/flowRegistryVariableFix.ts
 * 
 * Solución al problema de variables no reemplazadas correctamente.
 * Sincroniza las variables capturadas por BuilderBot con el estado del flujo.
 * 
 * @created 2025-05-16
 */

import logger from "../utils/logger";

// Cache para variables capturadas por sesión
const sessionVariables: Map<string, Record<string, any>> = new Map();

/**
 * Intercepta y guarda las variables capturadas por BuilderBot
 * @param sessionId ID de la sesión
 * @param variables Variables capturadas
 */
export function saveSessionVariables(
  sessionId: string,
  variables: Record<string, any>
): void {
  const current = sessionVariables.get(sessionId) || {};
  const updated = { ...current, ...variables };
  sessionVariables.set(sessionId, updated);
  logger.info(`[saveSessionVariables] Variables guardadas para sesión ${sessionId}:`, updated);
}

/**
 * Obtiene las variables capturadas para una sesión
 * @param sessionId ID de la sesión
 * @returns Variables capturadas
 */
export function getSessionVariables(sessionId: string): Record<string, any> {
  const variables = sessionVariables.get(sessionId) || {};
  logger.info(`[getSessionVariables] Variables recuperadas para sesión ${sessionId}:`, variables);
  return variables;
}

/**
 * Intercepta el state.update de BuilderBot
 * @param originalState Estado original
 * @param sessionId ID de sesión
 * @returns Estado con interceptor
 */
export function createStateInterceptor(originalState: any, sessionId: string): any {
  const stateProxy = new Proxy(originalState, {
    get(target, prop) {
      if (prop === 'update') {
        return async (newData: Record<string, any>) => {
          // Guardar las variables en nuestro cache
          saveSessionVariables(sessionId, newData);
          
          // Llamar al método original
          if (target.update) {
            return target.update(newData);
          }
          
          // Si no existe el método update, actualizar directamente
          Object.assign(target, newData);
          return target;
        };
      }
      return target[prop];
    }
  });
  
  return stateProxy;
}

/**
 * Combina variables del estado con las capturadas
 * @param stateVariables Variables del estado
 * @param sessionId ID de sesión
 * @returns Variables combinadas
 */
export function mergeWithSessionVariables(
  stateVariables: Record<string, any>,
  sessionId: string
): Record<string, any> {
  const capturedVariables = getSessionVariables(sessionId);
  const merged = { ...stateVariables, ...capturedVariables };
  
  logger.info(`[mergeWithSessionVariables] Variables combinadas para sesión ${sessionId}:`, merged);
  return merged;
}

/**
 * Limpia variables de sesiones antiguas
 * @param maxAgeMinutes Edad máxima en minutos
 */
export function cleanupOldSessionVariables(maxAgeMinutes: number = 30): void {
  // Por ahora solo limpiar el cache completo si es muy grande
  if (sessionVariables.size > 1000) {
    sessionVariables.clear();
    logger.info('[cleanupOldSessionVariables] Cache de variables limpiado');
  }
}

// Ejecutar limpieza periódica
setInterval(() => {
  cleanupOldSessionVariables(30);
}, 30 * 60 * 1000);