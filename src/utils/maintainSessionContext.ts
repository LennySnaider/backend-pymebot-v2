/**
 * MAINTAIN SESSION CONTEXT UTILITY
 * 
 * PROPÓSITO: Función utilitaria para preservar estado de sesión entre interacciones
 * BASADO EN: Patrones del v1-reference para mantenimiento de contexto
 * PRESERVA: Sistema de leads 100% intacto
 * INTEGRA: Con ImprovedSessionManager y WebProvider V2
 * 
 * CARACTERÍSTICAS CLAVE:
 * - Preservación automática de contexto entre requests
 * - Sincronización con leads system sin interferir
 * - Gestión inteligente de variables temporales vs persistentes
 * - Optimización de rendimiento con cache
 * - Limpieza automática de datos obsoletos
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from './logger';
import ImprovedSessionManager from '../services/improvedSessionManager';
import type { 
  PersistentSession, 
  SessionContextData, 
  LeadSessionData 
} from '../services/improvedSessionManager';

// INTERFACES PARA CONTEXTO DE SESIÓN

interface SessionContextOptions {
  userId: string;
  tenantId: string;
  sessionId?: string;
  nodeId?: string;
  templateId?: string;
  preserveLeadData?: boolean;
  forceRefresh?: boolean;
}

interface ContextMaintenance {
  preserveFields: string[];
  clearFields: string[];
  updateFields: Record<string, any>;
  leadDataUpdates?: Partial<LeadSessionData>;
}

interface SessionSnapshot {
  timestamp: string;
  sessionId: string;
  contextData: SessionContextData;
  metadata: {
    nodeId?: string;
    templateId?: string;
    interactionCount: number;
    lastUpdate: string;
  };
}

/**
 * FUNCIÓN PRINCIPAL: maintainSessionContext
 * 
 * PROPÓSITO: Preservar y gestionar el contexto de sesión automáticamente
 * PATRÓN: Extraído del v1-reference donde el contexto persiste entre flows
 */
export async function maintainSessionContext(
  options: SessionContextOptions,
  maintenance?: ContextMaintenance
): Promise<SessionContextData | null> {
  try {
    logger.info(`[maintainSessionContext] Manteniendo contexto para ${options.userId}@${options.tenantId}`);
    
    const sessionManager = ImprovedSessionManager.getInstance();
    
    // PASO 1: OBTENER O CREAR SESIÓN PERSISTENTE
    const session = await sessionManager.getOrCreateSession(
      options.userId,
      options.tenantId,
      {
        nodeId: options.nodeId,
        templateId: options.templateId,
        platform: 'web',
        priority: 'normal',
        forceNew: false, // Reutilizar sesión existente
        metadata: {
          tags: ['context_maintenance', 'auto_preserved']
        }
      }
    );

    // PASO 2: OBTENER CONTEXTO ACTUAL
    let currentContext = await sessionManager.getSessionContext(session.sessionId);
    
    if (!currentContext) {
      // Inicializar contexto vacío si no existe
      currentContext = {
        collectedData: {},
        globalVars: {},
        conversationHistory: [],
        flowHistory: [],
        temporaryData: {},
        currentNodeId: options.nodeId
      };
    }

    // PASO 3: APLICAR MANTENIMIENTO DE CONTEXTO SI SE ESPECIFICA
    if (maintenance) {
      currentContext = await applyContextMaintenance(currentContext, maintenance);
    }

    // PASO 4: PRESERVAR DATOS DE LEADS SI ESTÁ HABILITADO
    if (options.preserveLeadData !== false) {
      await preserveLeadSystemIntegration(session, currentContext, maintenance?.leadDataUpdates);
    }

    // PASO 5: ACTUALIZAR CONTEXTO EN SESIÓN PERSISTENTE
    await sessionManager.updateSessionContext(session.sessionId, currentContext);

    // PASO 6: ACTUALIZAR ACTIVIDAD DE SESIÓN
    await sessionManager.updateSessionActivity(session.sessionId, {
      lastActivityAt: new Date().toISOString(),
      nodeId: options.nodeId,
      contextData: currentContext
    });

    logger.info(`[maintainSessionContext] Contexto mantenido exitosamente para sesión ${session.sessionId}`);
    return currentContext;

  } catch (error) {
    logger.error(`[maintainSessionContext] Error manteniendo contexto:`, error);
    return null;
  }
}

/**
 * FUNCIÓN: Aplicar mantenimiento específico al contexto
 */
async function applyContextMaintenance(
  context: SessionContextData,
  maintenance: ContextMaintenance
): Promise<SessionContextData> {
  const updatedContext = { ...context };

  try {
    // PRESERVAR CAMPOS ESPECÍFICOS
    if (maintenance.preserveFields.length > 0) {
      logger.debug(`[maintainSessionContext] Preservando campos: ${maintenance.preserveFields.join(', ')}`);
      // Los campos preservados ya están en el contexto, no necesitamos hacer nada
    }

    // LIMPIAR CAMPOS ESPECÍFICOS
    if (maintenance.clearFields.length > 0) {
      logger.debug(`[maintainSessionContext] Limpiando campos: ${maintenance.clearFields.join(', ')}`);
      
      for (const fieldPath of maintenance.clearFields) {
        clearNestedField(updatedContext, fieldPath);
      }
    }

    // ACTUALIZAR CAMPOS ESPECÍFICOS
    if (Object.keys(maintenance.updateFields).length > 0) {
      logger.debug(`[maintainSessionContext] Actualizando campos:`, maintenance.updateFields);
      
      for (const [fieldPath, value] of Object.entries(maintenance.updateFields)) {
        setNestedField(updatedContext, fieldPath, value);
      }
    }

    return updatedContext;

  } catch (error) {
    logger.error(`[maintainSessionContext] Error aplicando mantenimiento:`, error);
    return context; // Retornar contexto original en caso de error
  }
}

/**
 * FUNCIÓN: Preservar integración con sistema de leads
 * CRÍTICO: NO TOCAR el sistema de leads existente
 */
async function preserveLeadSystemIntegration(
  session: PersistentSession,
  context: SessionContextData,
  leadDataUpdates?: Partial<LeadSessionData>
): Promise<void> {
  try {
    // VERIFICAR SI HAY DATOS DE LEADS EN EL CONTEXTO
    if (!context.leadData && !leadDataUpdates) {
      return; // No hay datos de leads para preservar
    }

    // PRESERVAR DATOS DE LEADS EXISTENTES
    if (context.leadData) {
      logger.debug(`[maintainSessionContext] Preservando datos de lead: ${context.leadData.leadId}`);
      
      // Actualizar contador de interacciones
      context.leadData.interactionCount = (context.leadData.interactionCount || 0) + 1;
      context.leadData.lastInteractionAt = new Date().toISOString();
    }

    // APLICAR ACTUALIZACIONES DE LEADS SI SE PROPORCIONAN
    if (leadDataUpdates) {
      logger.debug(`[maintainSessionContext] Aplicando actualizaciones de lead:`, leadDataUpdates);
      
      context.leadData = {
        ...(context.leadData || {
          interactionCount: 0,
          lastInteractionAt: new Date().toISOString(),
          progressPercentage: 0
        }),
        ...leadDataUpdates
      };
    }

    // IMPORTANTE: NO modificar directamente el sistema de leads
    // Solo preservar los datos en el contexto de sesión
    logger.info(`[maintainSessionContext] Datos de leads preservados sin interferir con el sistema actual`);

  } catch (error) {
    logger.error(`[maintainSessionContext] Error preservando datos de leads:`, error);
    // No propagar el error para no afectar el flujo principal
  }
}

/**
 * FUNCIÓN AUXILIAR: Crear snapshot del contexto de sesión
 */
export async function createSessionSnapshot(
  sessionId: string
): Promise<SessionSnapshot | null> {
  try {
    const sessionManager = ImprovedSessionManager.getInstance();
    const contextData = await sessionManager.getSessionContext(sessionId);
    
    if (!contextData) {
      return null;
    }

    const snapshot: SessionSnapshot = {
      timestamp: new Date().toISOString(),
      sessionId,
      contextData,
      metadata: {
        nodeId: contextData.currentNodeId,
        interactionCount: contextData.conversationHistory?.length || 0,
        lastUpdate: new Date().toISOString()
      }
    };

    logger.debug(`[createSessionSnapshot] Snapshot creado para sesión ${sessionId}`);
    return snapshot;

  } catch (error) {
    logger.error(`[createSessionSnapshot] Error creando snapshot:`, error);
    return null;
  }
}

/**
 * FUNCIÓN AUXILIAR: Restaurar contexto desde snapshot
 */
export async function restoreFromSnapshot(
  sessionId: string,
  snapshot: SessionSnapshot
): Promise<boolean> {
  try {
    const sessionManager = ImprovedSessionManager.getInstance();
    
    // Validar que el snapshot sea para la sesión correcta
    if (snapshot.sessionId !== sessionId) {
      logger.warn(`[restoreFromSnapshot] ID de sesión no coincide: ${snapshot.sessionId} vs ${sessionId}`);
      return false;
    }

    // Restaurar contexto
    await sessionManager.updateSessionContext(sessionId, snapshot.contextData);
    
    // Actualizar actividad
    await sessionManager.updateSessionActivity(sessionId, {
      lastActivityAt: new Date().toISOString(),
      nodeId: snapshot.metadata.nodeId,
      contextData: snapshot.contextData
    });

    logger.info(`[restoreFromSnapshot] Contexto restaurado desde snapshot ${snapshot.timestamp}`);
    return true;

  } catch (error) {
    logger.error(`[restoreFromSnapshot] Error restaurando snapshot:`, error);
    return false;
  }
}

/**
 * FUNCIÓN: Limpiar contexto automáticamente
 * Remueve datos obsoletos y optimiza memoria
 */
export async function cleanupSessionContext(
  sessionId: string,
  options: {
    maxConversationHistory?: number;
    maxFlowHistory?: number;
    clearTemporaryData?: boolean;
    preserveCollectedData?: boolean;
  } = {}
): Promise<boolean> {
  try {
    const sessionManager = ImprovedSessionManager.getInstance();
    const context = await sessionManager.getSessionContext(sessionId);
    
    if (!context) {
      return false;
    }

    const cleanedContext = { ...context };

    // Limpiar historial de conversación si es muy largo
    if (options.maxConversationHistory && 
        cleanedContext.conversationHistory && 
        cleanedContext.conversationHistory.length > options.maxConversationHistory) {
      
      // Mantener solo los mensajes más recientes
      cleanedContext.conversationHistory = cleanedContext.conversationHistory
        .slice(-options.maxConversationHistory);
        
      logger.debug(`[cleanupSessionContext] Historial de conversación limitado a ${options.maxConversationHistory} mensajes`);
    }

    // Limpiar historial de flujos si es muy largo
    if (options.maxFlowHistory && 
        cleanedContext.flowHistory && 
        cleanedContext.flowHistory.length > options.maxFlowHistory) {
      
      cleanedContext.flowHistory = cleanedContext.flowHistory
        .slice(-options.maxFlowHistory);
        
      logger.debug(`[cleanupSessionContext] Historial de flujos limitado a ${options.maxFlowHistory} entradas`);
    }

    // Limpiar datos temporales si está habilitado
    if (options.clearTemporaryData) {
      cleanedContext.temporaryData = {};
      logger.debug(`[cleanupSessionContext] Datos temporales limpiados`);
    }

    // Opcionalmente preservar datos recolectados importantes
    if (!options.preserveCollectedData) {
      // Solo limpiar si explícitamente se dice que no se preserven
      // Por defecto, siempre preservamos los datos recolectados
    }

    // Actualizar contexto limpio
    await sessionManager.updateSessionContext(sessionId, cleanedContext);
    
    logger.info(`[cleanupSessionContext] Contexto de sesión ${sessionId} limpiado exitosamente`);
    return true;

  } catch (error) {
    logger.error(`[cleanupSessionContext] Error limpiando contexto:`, error);
    return false;
  }
}

/**
 * FUNCIÓN: Obtener métricas de contexto de sesión
 */
export async function getSessionContextMetrics(
  sessionId: string
): Promise<{
  conversationLength: number;
  flowHistoryLength: number;
  collectedDataKeys: number;
  temporaryDataSize: number;
  memoryUsage: number;
  lastActivity?: string;
} | null> {
  try {
    const sessionManager = ImprovedSessionManager.getInstance();
    const context = await sessionManager.getSessionContext(sessionId);
    
    if (!context) {
      return null;
    }

    // Calcular tamaño de memoria aproximado
    const memoryUsage = JSON.stringify(context).length * 2; // aproximación UTF-16

    return {
      conversationLength: context.conversationHistory?.length || 0,
      flowHistoryLength: context.flowHistory?.length || 0,
      collectedDataKeys: Object.keys(context.collectedData || {}).length,
      temporaryDataSize: Object.keys(context.temporaryData || {}).length,
      memoryUsage,
      lastActivity: context.conversationHistory?.slice(-1)[0]?.timestamp
    };

  } catch (error) {
    logger.error(`[getSessionContextMetrics] Error obteniendo métricas:`, error);
    return null;
  }
}

/**
 * FUNCIONES AUXILIARES PARA MANIPULACIÓN DE CAMPOS ANIDADOS
 */

function clearNestedField(obj: any, fieldPath: string): void {
  const keys = fieldPath.split('.');
  const lastKey = keys.pop();
  
  if (!lastKey) return;
  
  let current = obj;
  for (const key of keys) {
    if (current[key] === undefined) {
      return; // Campo no existe
    }
    current = current[key];
  }
  
  if (current && typeof current === 'object') {
    delete current[lastKey];
  }
}

function setNestedField(obj: any, fieldPath: string, value: any): void {
  const keys = fieldPath.split('.');
  const lastKey = keys.pop();
  
  if (!lastKey) return;
  
  let current = obj;
  for (const key of keys) {
    if (current[key] === undefined) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
}

/**
 * FUNCIÓN: Validar integridad del contexto
 */
export function validateSessionContext(context: SessionContextData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Validar estructura básica
    if (!context.collectedData || typeof context.collectedData !== 'object') {
      errors.push('collectedData debe ser un objeto');
    }

    if (!context.globalVars || typeof context.globalVars !== 'object') {
      errors.push('globalVars debe ser un objeto');
    }

    if (!Array.isArray(context.conversationHistory)) {
      errors.push('conversationHistory debe ser un array');
    }

    if (!Array.isArray(context.flowHistory)) {
      errors.push('flowHistory debe ser un array');
    }

    // Validaciones de advertencia
    if (context.conversationHistory && context.conversationHistory.length > 1000) {
      warnings.push('Historial de conversación muy largo (>1000 mensajes)');
    }

    if (context.flowHistory && context.flowHistory.length > 500) {
      warnings.push('Historial de flujos muy largo (>500 entradas)');
    }

    // Validar estructura de datos de leads si existe
    if (context.leadData) {
      if (!context.leadData.interactionCount || context.leadData.interactionCount < 0) {
        warnings.push('Contador de interacciones de lead inválido');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Error validando contexto: ${error}`],
      warnings
    };
  }
}

export default maintainSessionContext;
export type {
  SessionContextOptions,
  ContextMaintenance,
  SessionSnapshot
};