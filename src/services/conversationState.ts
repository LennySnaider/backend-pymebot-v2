import logger from "../utils/logger";
import { getSupabaseClient } from "./supabase";

export interface ConversationState {
  tenant_id: string;
  user_id: string;
  session_id: string;
  data: any;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Guarda el estado de conversación
 */
export async function saveConversationState(
  tenantId: string,
  userId: string,
  sessionId: string,
  data: any
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('conversation_sessions')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        session_id: sessionId,
        state: data,
        updated_at: new Date()
      }, {
        onConflict: 'session_id'
      });
      
    if (error) {
      logger.error('Error saving conversation state:', error);
      throw error;
    }
    
    logger.debug(`Conversation state saved for session ${sessionId}`);
  } catch (error) {
    logger.error('Error in saveConversationState:', error);
    throw error;
  }
}

/**
 * Obtiene el estado de conversación
 */
export async function getConversationState(
  tenantId: string,
  userId: string,
  sessionId: string
): Promise<ConversationState | null> {
  try {
    logger.info(`[DEBUG CONVERSATION] Obteniendo cliente Supabase...`);
    const supabase = getSupabaseClient();
    logger.info(`[DEBUG CONVERSATION] Cliente Supabase obtenido exitosamente`);
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();
      
    if (error) {
      if (error.code === 'PGRST116') {
        // No se encontró el registro
        return null;
      }
      logger.error('Error getting conversation state:', error);
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    return {
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      session_id: data.session_id,
      data: data.state,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at)
    };
  } catch (error) {
    logger.error('Error in getConversationState:', error);
    throw error;
  }
}

/**
 * Limpia estados de conversación antiguos
 */
export async function cleanupOldConversationStates(
  daysToKeep: number = 7
): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { data, error } = await supabase
      .from('conversation_sessions')
      .delete()
      .lt('updated_at', cutoffDate.toISOString())
      .select('session_id');
      
    if (error) {
      logger.error('Error cleaning up old conversation states:', error);
      throw error;
    }
    
    const deletedCount = data?.length || 0;
    logger.info(`Cleaned up ${deletedCount} old conversation states`);
    
    return deletedCount;
  } catch (error) {
    logger.error('Error in cleanupOldConversationStates:', error);
    throw error;
  }
}