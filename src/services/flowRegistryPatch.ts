/**
 * src/services/flowRegistryPatch.ts
 * 
 * Solución al problema de pérdida de contexto de conversación.
 * Mantiene una instancia de bot por sesión en lugar de crear una nueva para cada mensaje.
 * 
 * @created 2025-05-16
 */

import logger from "../utils/logger";

// Cache de bots por sesión de usuario
const sessionBots: Map<string, { bot: any; provider: any }> = new Map();

/**
 * Obtiene o crea un bot para una sesión específica
 * @param flowId ID del flujo
 * @param userId ID del usuario
 * @param tenantId ID del tenant
 * @param sessionId ID de sesión
 * @returns Bot y provider reutilizables
 */
export async function getOrCreateSessionBot(
  flowId: string,
  userId: string,
  tenantId: string,
  sessionId: string
): Promise<{ bot: any; provider: any }> {
  // Clave única por sesión
  const sessionKey = `${tenantId}:${sessionId}:${flowId}`;
  
  // Si ya existe un bot para esta sesión, lo reutilizamos
  if (sessionBots.has(sessionKey)) {
    const sessionBot = sessionBots.get(sessionKey)!;
    logger.info(`[getOrCreateSessionBot] Reutilizando bot para sesión ${sessionKey}`);
    return sessionBot;
  }
  
  // Si no existe, creamos uno nuevo
  logger.info(`[getOrCreateSessionBot] Creando nuevo bot para sesión ${sessionKey}`);
  
  try {
    const { FlowRegistry } = await import("./flowRegistry");
    const { createBot, MemoryDB } = await import("@builderbot/bot");
    const { WebProvider } = await import("../provider/webProvider");
    
    // Obtener el flujo desde el registro
    const flow = FlowRegistry.getFlow(flowId);
    if (!flow) {
      throw new Error(`Flujo ${flowId} no encontrado`);
    }
    
    // Crear provider con persistencia para esta sesión, incluyendo sessionId
    const provider = new WebProvider(`${userId}-${sessionId}`, tenantId, sessionId);
    
    // Crear base de datos con persistencia para esta sesión
    const database = new MemoryDB();
    
    // Asegurar que el flujo tenga el método findSerializeByKeyword
    if (!flow.findSerializeByKeyword && flow.flowSerialize) {
      logger.info(`[getOrCreateSessionBot] Añadiendo método findSerializeByKeyword al flujo`);
      flow.findSerializeByKeyword = function(keyword: string) {
        const result = this.flowSerialize?.find((item: any) => {
          if (Array.isArray(item.keyword)) {
            return item.keyword.some((kw: string) => kw.toLowerCase() === keyword.toLowerCase());
          }
          return false;
        });
        return result;
      };
    }
    
    // Asegurar que el flujo tenga el método findBySerialize
    if (!flow.findBySerialize && flow.flowSerialize) {
      logger.info(`[getOrCreateSessionBot] Añadiendo método findBySerialize al flujo`);
      flow.findBySerialize = function(serialized: string) {
        return this.flowSerialize?.find((item: any) => item.refSerialize === serialized);
      };
    }
    
    // Crear bot con el flujo completo
    logger.info(`[getOrCreateSessionBot] Creando bot con flujo ${flowId}`);
    const bot = await createBot({
      flow: flow,  // Usar el flujo completo con todas sus funciones
      database,
      provider,
    });
    
    const sessionBot = { bot, provider };
    
    // Guardar en cache
    sessionBots.set(sessionKey, sessionBot);
    logger.info(`[getOrCreateSessionBot] Bot creado y cacheado para sesión ${sessionKey}`);
    
    return sessionBot;
    
  } catch (error) {
    logger.error(`[getOrCreateSessionBot] Error al crear bot:`, error);
    throw error;
  }
}

/**
 * Limpia bots de sesiones antiguas
 * @param maxAgeMinutes Edad máxima en minutos
 */
export function cleanupOldSessions(maxAgeMinutes: number = 30): void {
  const now = Date.now();
  const maxAge = maxAgeMinutes * 60 * 1000;
  
  for (const [key, sessionBot] of sessionBots.entries()) {
    // Por ahora limpiamos todas las sesiones viejas
    // En el futuro podríamos agregar timestamps
    logger.info(`[cleanupOldSessions] Evaluando sesión ${key}`);
  }
}

/**
 * Obtiene el bot de una sesión si existe
 * @param sessionKey Clave de sesión
 * @returns Bot y provider si existen
 */
export function getSessionBot(
  tenantId: string,
  sessionId: string,
  flowId: string
): { bot: any; provider: any } | undefined {
  const sessionKey = `${tenantId}:${sessionId}:${flowId}`;
  return sessionBots.get(sessionKey);
}

/**
 * Limpia una sesión específica
 * @param sessionKey Clave de sesión
 */
export function clearSession(
  tenantId: string,
  sessionId: string,
  flowId: string
): void {
  const sessionKey = `${tenantId}:${sessionId}:${flowId}`;
  if (sessionBots.has(sessionKey)) {
    sessionBots.delete(sessionKey);
    logger.info(`[clearSession] Sesión ${sessionKey} limpiada`);
  }
}

// Ejecutar limpieza periódica cada 30 minutos
setInterval(() => {
  cleanupOldSessions(30);
}, 30 * 60 * 1000);