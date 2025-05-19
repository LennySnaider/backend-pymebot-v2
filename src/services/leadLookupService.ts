/**
 * src/services/leadLookupService.ts
 * 
 * Servicio para buscar leads por número de teléfono
 * 
 * @version 1.0.0
 * @created 2025-05-19
 */

import logger from "../utils/logger";
import { getSupabaseClient } from "./supabase";

/**
 * Busca un lead por número de teléfono
 * @param phoneNumber Número de teléfono del lead
 * @param tenantId ID del tenant
 * @returns ID del lead o null si no se encuentra
 */
export async function findLeadByPhone(
  phoneNumber: string,
  tenantId: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Normalizar el número de teléfono - eliminar caracteres no numéricos
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    
    // Buscar en la tabla leads
    const { data, error } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${phoneNumber},phone.eq.${normalizedPhone}`)
      .single();
    
    if (error) {
      // Si no se encuentra, no es necesariamente un error
      if (error.code === 'PGRST116') {
        logger.info(`No se encontró lead con teléfono ${phoneNumber} para tenant ${tenantId}`);
        return null;
      }
      logger.error(`Error al buscar lead por teléfono: ${error.message}`);
      return null;
    }
    
    if (data) {
      logger.info(`Lead encontrado con ID ${data.id} para teléfono ${phoneNumber}`);
      return data.id;
    }
    
    return null;
  } catch (error) {
    logger.error(`Error en findLeadByPhone: ${error}`);
    return null;
  }
}

/**
 * Crea un nuevo lead si no existe
 * @param phoneNumber Número de teléfono
 * @param tenantId ID del tenant
 * @param additionalData Datos adicionales del lead
 * @returns ID del lead creado o null si hay error
 */
export async function createLeadIfNotExists(
  phoneNumber: string,
  tenantId: string,
  additionalData?: {
    name?: string;
    email?: string;
    source?: string;
  }
): Promise<string | null> {
  try {
    // Primero verificar si ya existe
    const existingLeadId = await findLeadByPhone(phoneNumber, tenantId);
    if (existingLeadId) {
      return existingLeadId;
    }
    
    // Si no existe, crear uno nuevo
    const supabase = getSupabaseClient();
    
    const leadData = {
      phone: phoneNumber,
      tenant_id: tenantId,
      stage: 'nuevos', // Etapa inicial
      source: additionalData?.source || 'chatbot',
      full_name: additionalData?.name || `Lead ${phoneNumber}`,
      email: additionalData?.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id')
      .single();
    
    if (error) {
      logger.error(`Error al crear lead: ${error.message}`);
      return null;
    }
    
    if (data) {
      logger.info(`Lead creado con ID ${data.id} para teléfono ${phoneNumber}`);
      return data.id;
    }
    
    return null;
  } catch (error) {
    logger.error(`Error en createLeadIfNotExists: ${error}`);
    return null;
  }
}

export default {
  findLeadByPhone,
  createLeadIfNotExists
};