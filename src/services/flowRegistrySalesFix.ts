/**
 * Parche para asegurar que salesStageId se propague correctamente
 */

import logger from "../utils/logger";

// Estructura para mantener el stage actual por sesión
const sessionStages: Record<string, string> = {};

/**
 * Guarda el stage actual para una sesión
 */
export function setSessionStage(sessionId: string, stage: string): void {
  sessionStages[sessionId] = stage;
  logger.info(`[SALES FIX] Stage guardado para sesión ${sessionId}: ${stage}`);
}

/**
 * Obtiene el stage actual para una sesión
 */
export function getSessionStage(sessionId: string): string | undefined {
  const stage = sessionStages[sessionId];
  logger.info(`[SALES FIX] Stage recuperado para sesión ${sessionId}: ${stage || 'ninguno'}`);
  return stage;
}

/**
 * Limpia stages antiguos (más de 1 hora)
 */
export function cleanupOldStages(): void {
  // Por ahora, solo loguear
  logger.info(`[SALES FIX] Limpieza de stages (${Object.keys(sessionStages).length} activos)`);
}

// Limpiar cada 30 minutos
setInterval(cleanupOldStages, 30 * 60 * 1000);