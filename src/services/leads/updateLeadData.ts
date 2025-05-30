import { getSupabaseClient } from '../supabase';
import logger from '../../utils/logger';

/**
 * Actualiza los datos de un lead existente
 */
export async function updateLeadData(
  leadId: string,
  updateData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`[UPDATE LEAD] Actualizando lead ${leadId} con datos:`, updateData);
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();
    
    if (error) {
      logger.error(`[UPDATE LEAD] Error al actualizar lead ${leadId}:`, error);
      return { success: false, error: error.message };
    }
    
    logger.info(`[UPDATE LEAD] Lead ${leadId} actualizado exitosamente`);
    return { success: true };
    
  } catch (error) {
    logger.error(`[UPDATE LEAD] Error inesperado al actualizar lead ${leadId}:`, error);
    return { success: false, error: String(error) };
  }
}