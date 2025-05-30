/**
 * src/services/stateManager.ts
 * 
 * Servicio para la gestión del estado de conversaciones
 * Proporciona funciones para guardar, cargar y sincronizar
 * estados entre diferentes plantillas y flujos.
 * 
 * @version 1.0.0
 * @created 2025-05-10
 */

import { getSupabaseAdminClient } from "./supabase";
import logger from "../utils/logger";
import { config } from "../config";

// Reexportar la función getSupabaseAdminClient para que otros módulos puedan acceder a ella
export { getSupabaseAdminClient };

// Cache local para estados cuando Supabase falla
// Esta cache nos permite mantener el estado entre mensajes aun cuando hay errores de conectividad
const localStateCache: Map<string, { state: Record<string, any>, lastUpdated: Date }> = new Map();

// Tiempo de vida de la cache (30 minutos)
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Guarda el estado de una conversación en Supabase
 * 
 * @param tenantId ID del tenant
 * @param userId ID del usuario
 * @param sessionId ID de la sesión
 * @param state Estado a guardar
 * @returns true si se guardó correctamente
 */
export const saveConversationState = async (
  tenantId: string,
  userId: string,
  sessionId: string,
  state: Record<string, any>
): Promise<boolean> => {
  try {
    // Validamos parámetros
    if (!tenantId || !userId || !sessionId) {
      logger.error('Parámetros inválidos al guardar estado de conversación');
      return false;
    }

    // Generamos la clave para la cache
    const cacheKey = `${tenantId}_${userId}_${sessionId}`;
    
    // Siempre guardamos en cache local, independientemente de Supabase
    localStateCache.set(cacheKey, {
      state: { ...state }, // Copia del estado
      lastUpdated: new Date()
    });
    logger.debug(`Estado guardado en cache local para sesión ${sessionId}`);

    // Verificar si estamos en modo memoria (sin conexión a DB)
    if (!config.supabase.enabled) {
      logger.warn('Supabase no está habilitado, guardando estado en memoria únicamente');
      // No fallamos, pero retornamos true para indicar "éxito"
      return true;
    }

    try {
      const supabase = getSupabaseAdminClient();

      // Aseguramos que el user_id esté dentro del state_data para mantenerlo ahí
      if (!state.user_id) {
        state.user_id = userId;
      }

      // Actualizamos el timestamp antes de guardar
      state.last_updated_at = new Date().toISOString();

      // Usamos la función RPC para guardar el estado con validación de tenant_id incorporada
      // IMPORTANTE: Hacemos la llamada asíncrona para no bloquear las respuestas HTTP
      setImmediate(async () => {
        try {
          const { data, error } = await supabase
            .rpc('save_conversation_state', {
              p_tenant_id: tenantId,
              p_session_id: sessionId,
              p_state_data: state
            });

          if (error) {
            logger.error(`Error al guardar estado de conversación en background: ${error.message}`);
          } else {
            logger.debug(`Estado guardado correctamente en background para sesión ${sessionId}`);
          }
        } catch (asyncError) {
          logger.error(`Error asíncrono al guardar estado: ${asyncError}`);
        }
      });

      // Retornamos true inmediatamente ya que el guardado en cache local ya se hizo
      return true;
    } catch (dbError) {
      // Mejorar el log del error
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      
      // Si es error 520 o similar, lo logueamos como warning, no como error crítico
      if (errorMessage.includes('520') || errorMessage.includes('<!DOCTYPE html>')) {
        logger.warn(`Error de conectividad con Supabase al guardar estado: Error 520. Sesión: ${sessionId}`);
      } else {
        logger.error(`Error en operación de base de datos: ${errorMessage}`);
      }
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Si es error 520 o similar, lo logueamos como warning, no como error crítico
    if (errorMessage.includes('520') || errorMessage.includes('<!DOCTYPE html>')) {
      logger.warn(`Error de conectividad con Supabase al guardar estado: Error 520. Sesión: ${sessionId}`);
    } else {
      logger.error(`Error al guardar estado de conversación: ${errorMessage}`);
    }
    return false;
  }
};

/**
 * Carga el estado de una conversación desde Supabase
 *
 * @param tenantId ID del tenant
 * @param userId ID del usuario
 * @param sessionId ID de la sesión
 * @returns Estado de la conversación o null si no existe
 */
export const loadConversationState = async (
  tenantId: string,
  userId: string,
  sessionId: string
): Promise<Record<string, any> | null> => {
  try {
    // Validamos parámetros
    if (!tenantId || !userId || !sessionId) {
      logger.error('Parámetros inválidos al cargar estado de conversación');
      return null;
    }

    // Generamos la clave para la cache
    const cacheKey = `${tenantId}_${userId}_${sessionId}`;
    
    // Primero intentamos cargar desde cache local
    const cachedEntry = localStateCache.get(cacheKey);
    if (cachedEntry) {
      const cacheAge = Date.now() - cachedEntry.lastUpdated.getTime();
      if (cacheAge < CACHE_TTL_MS) {
        logger.info(`Estado cargado desde cache local para sesión ${sessionId} (edad: ${Math.round(cacheAge / 1000)}s)`);
        return cachedEntry.state;
      } else {
        logger.debug(`Cache expirada para sesión ${sessionId}, eliminando...`);
        localStateCache.delete(cacheKey);
      }
    }

    // Verificar si estamos en modo memoria (sin conexión a DB)
    if (!config.supabase.enabled) {
      logger.warn('Supabase no está habilitado, no se puede cargar estado de BD');
      // Retornamos un estado base para evitar errores
      return {
        flow_id: 'default',
        session_id: sessionId,
        tenant_id: tenantId,
        user_id: userId,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      };
    }

    try {
      const supabase = getSupabaseAdminClient();

      // Usamos la función RPC para cargar el estado con validación de tenant_id incorporada
      const { data, error } = await supabase
        .rpc('load_conversation_state', {
          p_tenant_id: tenantId,
          p_session_id: sessionId
        });

      if (error) {
        logger.error(`Error al cargar estado de conversación: ${error.message}`);
        return null;
      }

      if (!data) {
        logger.info(`No se encontró estado para la sesión ${sessionId}`);
        return null;
      }

      // MEJORA: Verificar y asegurar consistencia de valores críticos
      // Esto ayuda a garantizar que los valores importantes como waitingForInput,
      // waitingNodeId, etc. se mantengan correctamente entre peticiones
      const enhancedData = ensureStateConsistency(data);

      // Actualizamos la cache local con el estado recién cargado
      localStateCache.set(cacheKey, {
        state: { ...enhancedData },
        lastUpdated: new Date()
      });
      logger.debug(`Estado cargado correctamente para sesión ${sessionId} y actualizado en cache local`);
      
      return enhancedData;
    } catch (dbError) {
      logger.error('Error en operación de base de datos:', dbError);
      return null;
    }
  } catch (error) {
    // Error mejorado con más detalle
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error al cargar estado de conversación: ${errorMessage}`);
    
    // Si el error es de conexión HTTP (como el error 520), retornamos un estado básico
    if (errorMessage.includes('520') || errorMessage.includes('Error') || errorMessage.includes('timeout')) {
      logger.warn(`Error de conectividad con Supabase. Retornando estado base para sesión ${sessionId}`);
      return {
        flow_id: 'default',
        session_id: sessionId,
        tenant_id: tenantId,
        user_id: userId,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        // Importante: indicamos que no pudimos cargar el estado real
        state_load_failed: true
      };
    }
    
    return null;
  }
};

/**
 * Función utilitaria para asegurar la consistencia del estado
 * Garantiza que los valores críticos sean consistentes
 *
 * @param state Estado cargado de la base de datos
 * @returns Estado con consistencia garantizada
 */
function ensureStateConsistency(state: Record<string, any>): Record<string, any> {
  if (!state) return {};

  try {
    // Copiar el estado para no modificar el original
    const enhancedState = { ...state };

    // Asegurar que si waitingNodeId existe, waitingForInput también está a true
    if (enhancedState.waitingNodeId && enhancedState.waitingForInput !== true) {
      logger.info(`Corrigiendo inconsistencia: waitingNodeId=${enhancedState.waitingNodeId} pero waitingForInput no está establecido`);
      enhancedState.waitingForInput = true;
    }

    // Garantizar que currentNodeId y current_node_id sean consistentes (ambos tienen el mismo valor)
    if (enhancedState.currentNodeId && !enhancedState.current_node_id) {
      enhancedState.current_node_id = enhancedState.currentNodeId;
    } else if (!enhancedState.currentNodeId && enhancedState.current_node_id) {
      enhancedState.currentNodeId = enhancedState.current_node_id;
    }

    // Si waitingNodeId existe pero currentNodeId no, usar waitingNodeId como fallback
    if (enhancedState.waitingNodeId && !enhancedState.currentNodeId && !enhancedState.current_node_id) {
      enhancedState.currentNodeId = enhancedState.waitingNodeId;
      enhancedState.current_node_id = enhancedState.waitingNodeId;
      logger.info(`Estableciendo currentNodeId=${enhancedState.currentNodeId} a partir de waitingNodeId`);
    }

    // Asegurar que variables existe (para evitar null pointer)
    if (!enhancedState.variables) {
      enhancedState.variables = {};
    }

    return enhancedState;
  } catch (error) {
    logger.error('Error al asegurar consistencia del estado:', error);
    return state; // Devolver el estado original en caso de error
  }
}

/**
 * Fusiona variables de estado de una plantilla a otra
 * Permite transferir datos contextuales entre diferentes flujos
 * 
 * @param targetState Estado destino (se modificará)
 * @param sourceState Estado origen (se extraerán variables)
 * @param variablesToMerge Lista de variables a fusionar específicamente (opcional)
 * @returns Estado fusionado
 */
export const mergeFlowStates = (
  targetState: Record<string, any>,
  sourceState: Record<string, any>,
  variablesToMerge?: string[]
): Record<string, any> => {
  try {
    // Si no hay estado objetivo, creamos uno nuevo
    if (!targetState) targetState = {};
    
    // Si no hay estado origen, devolvemos el destino sin cambios
    if (!sourceState) return targetState;
    
    // Si se especificaron variables concretas, solo transferimos esas
    if (variablesToMerge && variablesToMerge.length > 0) {
      for (const variable of variablesToMerge) {
        if (sourceState[variable] !== undefined) {
          targetState[variable] = sourceState[variable];
        }
      }
      return targetState;
    }
    
    // De lo contrario, transferimos todas las variables de contexto comunes
    const commonVariables = [
      'nombre_usuario',
      'email_usuario',
      'telefono_usuario',
      'compra_renta',
      'tipo_propiedad',
      'presupuesto',
      'lead_status',
      'lead_qualification_date',
      'appointment_scheduled',
      'appointment_date',
      'appointment_time',
      'preferencias',
      'ubicacion',
      'etapa_compra'
    ];
    
    for (const variable of commonVariables) {
      if (sourceState[variable] !== undefined) {
        targetState[variable] = sourceState[variable];
      }
    }
    
    return targetState;
  } catch (error) {
    logger.error('Error al fusionar estados:', error);
    return targetState; // Devolvemos el estado sin cambios
  }
};

/**
 * Obtiene listado de todas las sesiones activas para un tenant
 * Útil para monitoreo y análisis de conversaciones
 * 
 * @param tenantId ID del tenant
 * @returns Lista de sesiones activas
 */
export const getActiveSessions = async (
  tenantId: string
): Promise<any[]> => {
  try {
    if (!tenantId) {
      logger.error('ID de tenant inválido al obtener sesiones activas');
      return [];
    }

    // Si Supabase no está habilitado, retornar lista vacía
    if (!config.supabase.enabled) {
      logger.warn('Supabase no está habilitado, no se pueden obtener sesiones activas');
      return [];
    }

    const supabase = getSupabaseAdminClient();

    // Crear una consulta personalizada para obtener las sesiones activas
    // con la función get_valid_tenant_uuid para convertir el tenant_id
    const { data, error } = await supabase
      .rpc('get_active_sessions', {
        p_tenant_id: tenantId
      });

    if (error) {
      logger.error(`Error al obtener sesiones activas: ${error.message}`);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error al obtener sesiones activas:', error);
    return [];
  }
};

/**
 * Marca una sesión como inactiva/finalizada
 * Útil para limpiar sesiones antiguas o finalizadas
 * 
 * @param tenantId ID del tenant
 * @param userId ID del usuario
 * @param sessionId ID de la sesión
 * @returns true si se marcó correctamente
 */
export const finalizeSession = async (
  tenantId: string,
  userId: string,
  sessionId: string
): Promise<boolean> => {
  try {
    if (!tenantId || !userId || !sessionId) {
      logger.error('Parámetros inválidos al finalizar sesión');
      return false;
    }

    // Si Supabase no está habilitado, retornar éxito (no hay nada que hacer)
    if (!config.supabase.enabled) {
      logger.warn('Supabase no está habilitado, no se puede finalizar la sesión');
      return true;
    }

    const supabase = getSupabaseAdminClient();

    // Usar la función RPC para finalizar la sesión con validación de tenant_id incorporada
    const { data, error } = await supabase
      .rpc('finalize_session', {
        p_tenant_id: tenantId,
        p_session_id: sessionId
      });

    if (error) {
      logger.error(`Error al finalizar sesión: ${error.message}`);
      return false;
    }

    logger.debug(`Sesión ${sessionId} finalizada correctamente`);
    return true;
  } catch (error) {
    logger.error('Error al finalizar sesión:', error);
    return false;
  }
};

/**
 * Exporta variables de un estado para usar en otra plantilla
 * 
 * @param state Estado a exportar
 * @param variablesToExport Variables específicas a exportar
 * @returns Objeto con variables exportadas
 */
export const exportStateVariables = (
  state: Record<string, any>,
  variablesToExport: string[]
): Record<string, any> => {
  try {
    const exportedVariables: Record<string, any> = {};
    
    for (const variable of variablesToExport) {
      if (state[variable] !== undefined) {
        exportedVariables[variable] = state[variable];
      }
    }
    
    return exportedVariables;
  } catch (error) {
    logger.error('Error al exportar variables de estado:', error);
    return {};
  }
};

/**
 * Crea una sesión continuada a partir de una sesión existente
 * Permite continuar una conversación en otro flujo manteniendo el contexto
 * 
 * @param originalTenantId Tenant original
 * @param originalUserId Usuario original
 * @param originalSessionId Sesión original
 * @param targetFlowId ID del flujo destino
 * @returns ID de la nueva sesión o null si hubo error
 */
export const continueChatInNewFlow = async (
  originalTenantId: string,
  originalUserId: string,
  originalSessionId: string,
  targetFlowId: string
): Promise<string | null> => {
  try {
    // Cargamos el estado original
    const originalState = await loadConversationState(
      originalTenantId, 
      originalUserId, 
      originalSessionId
    );
    
    if (!originalState) {
      logger.error(`No se encontró estado para continuar la sesión ${originalSessionId}`);
      return null;
    }
    
    // Creamos una nueva sesión
    const newSessionId = `session-${originalUserId}-${Date.now()}-${targetFlowId}`;
    
    // Preparamos el nuevo estado conservando las variables importantes
    const newState = {
      flow_id: targetFlowId,
      session_id: newSessionId,
      tenant_id: originalTenantId,
      user_id: originalUserId,
      continued_from: originalSessionId,
      started_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      
      // Variables importantes del estado anterior
      nombre_usuario: originalState.nombre_usuario,
      email_usuario: originalState.email_usuario,
      telefono_usuario: originalState.telefono_usuario,
      
      // Variables de lead si existen
      lead_status: originalState.lead_status,
      compra_renta: originalState.compra_renta,
      tipo_propiedad: originalState.tipo_propiedad,
      presupuesto: originalState.presupuesto,
      
      // Variables de cita si existen
      appointment_scheduled: originalState.appointment_scheduled,
      appointment_date: originalState.appointment_date,
      appointment_time: originalState.appointment_time
    };
    
    // Guardamos el nuevo estado
    const saveSuccess = await saveConversationState(
      originalTenantId,
      originalUserId,
      newSessionId,
      newState
    );
    
    if (!saveSuccess) {
      logger.error('Error al guardar el nuevo estado continuado');
      return null;
    }
    
    logger.info(`Creada nueva sesión ${newSessionId} continuando desde ${originalSessionId}`);
    return newSessionId;
  } catch (error) {
    logger.error('Error al continuar chat en nuevo flujo:', error);
    return null;
  }
};

/**
 * Migrar variables comunes a una nueva versión de plantilla
 * 
 * @param tenantId ID del tenant
 * @param oldTemplateId ID de la plantilla antigua
 * @param newTemplateId ID de la plantilla nueva
 * @returns Número de sesiones migradas
 */
export const migrateVariablesToNewTemplate = async (
  tenantId: string,
  oldTemplateId: string,
  newTemplateId: string
): Promise<number> => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Buscamos sesiones activas con la plantilla antigua
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('id, session_id, state_data')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('state_data', { flow_id: oldTemplateId });
    
    if (error) {
      logger.error(`Error al buscar sesiones para migrar: ${error.message}`);
      return 0;
    }
    
    if (!data || data.length === 0) {
      logger.info(`No hay sesiones para migrar de plantilla ${oldTemplateId} a ${newTemplateId}`);
      return 0;
    }
    
    // Contador de migraciones exitosas
    let migratedCount = 0;
    
    // Para cada sesión, actualizamos el flow_id y mantenemos las variables
    for (const session of data) {
      try {
        const originalState = session.state_data;
        
        // Actualizamos el ID del flujo
        originalState.flow_id = newTemplateId;
        originalState.migrated_from = oldTemplateId;
        originalState.migration_date = new Date().toISOString();
        
        // Guardamos el estado actualizado
        const { error: updateError } = await supabase
          .from('conversation_sessions')
          .update({
            state_data: originalState,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        if (updateError) {
          logger.error(`Error al migrar sesión ${session.session_id}: ${updateError.message}`);
          continue;
        }
        
        migratedCount++;
      } catch (sessionError) {
        logger.error(`Error al procesar sesión individual para migración: ${sessionError}`);
        continue;
      }
    }
    
    logger.info(`Migradas ${migratedCount} sesiones de ${data.length} encontradas`);
    return migratedCount;
  } catch (error) {
    logger.error('Error al migrar variables a nueva plantilla:', error);
    return 0;
  }
};