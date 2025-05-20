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
 * @param leadId ID del lead (opcional) para búsqueda directa
 * @returns ID del lead o null si no se encuentra
 */
export async function findLeadByPhone(
  phoneNumber: string,
  tenantId: string,
  leadId?: string
): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    // Si se proporciona un ID explícito, buscar primero por este ID
    if (leadId) {
      logger.info(`Buscando lead por ID directo: ${leadId}`);
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('id')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (!leadError && leadData) {
        logger.info(`Lead encontrado con ID directo ${leadData.id}`);
        return leadData.id;
      } else {
        logger.info(`Lead no encontrado por ID directo: ${leadId}`);
      }
    }
    
    // Normalizar el número de teléfono - eliminar caracteres no numéricos
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    
    // Buscar en la tabla leads por teléfono
    logger.info(`Buscando lead por teléfono: ${phoneNumber} o ${normalizedPhone}`);
    const { data, error } = await supabase
      .from('leads')
      .select('id, metadata')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${phoneNumber},phone.eq.${normalizedPhone}`)
      .maybeSingle();
    
    if (!error && data) {
      logger.info(`Lead encontrado con ID ${data.id} para teléfono ${phoneNumber}`);
      return data.id;
    }
    
    // Si no se encuentra por teléfono, buscar en metadata por versiones normalizadas de teléfono
    logger.info(`Intentando búsqueda por metadata para teléfono: ${phoneNumber}`);
    try {
      const { data: metadataResults, error: metadataError } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .or(
          `metadata->>'phone'.eq.${phoneNumber},` +
          `metadata->>'original_phone'.eq.${phoneNumber},` +
          `metadata->>'phone'.eq.${normalizedPhone},` +
          `metadata->>'original_phone'.eq.${normalizedPhone}`
        )
        .maybeSingle();
      
      if (!metadataError && metadataResults) {
        logger.info(`Lead encontrado vía metadata con ID ${metadataResults.id} para teléfono ${phoneNumber}`);
        return metadataResults.id;
      }
    } catch (metaErr) {
      logger.error(`Error al buscar lead en metadata: ${metaErr}`);
    }
    
    // También intentar buscar por metadata general (usando contains)
    try {
      const metadataQuery = { phone: phoneNumber };
      const { data: metadataContainsResults, error: metadataContainsError } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('tenant_id', tenantId)
        .contains('metadata', metadataQuery)
        .maybeSingle();
      
      if (!metadataContainsError && metadataContainsResults) {
        logger.info(`Lead encontrado vía metadata.contains con ID ${metadataContainsResults.id} para teléfono ${phoneNumber}`);
        return metadataContainsResults.id;
      }
    } catch (metaContainsErr) {
      logger.error(`Error al buscar lead con contains en metadata: ${metaContainsErr}`);
    }
    
    logger.info(`No se encontró lead para teléfono ${phoneNumber} (tenant ${tenantId})`);
    return null;
  } catch (error) {
    logger.error(`Error en findLeadByPhone: ${error}`);
    return null;
  }
}

/**
 * Crea un nuevo lead si no existe o actualiza uno existente
 * @param phoneNumber Número de teléfono
 * @param tenantId ID del tenant
 * @param additionalData Datos adicionales del lead
 * @returns ID del lead creado/actualizado o null si hay error
 */
export async function createLeadIfNotExists(
  phoneNumber: string,
  tenantId: string,
  additionalData?: {
    name?: string;
    email?: string;
    source?: string;
    leadId?: string; // Permitir especificar un ID conocido
    metadata?: Record<string, any>; // Metadata adicional
  }
): Promise<string | null> {
  try {
    logger.info(`Creando/actualizando lead para teléfono ${phoneNumber} (tenant ${tenantId})`);
    
    // Verificar si ya existe por ID explícito (si se proporciona) o por teléfono
    const existingLeadId = await findLeadByPhone(
      phoneNumber, 
      tenantId, 
      additionalData?.leadId
    );
    
    const supabase = getSupabaseClient();
    
    if (existingLeadId) {
      logger.info(`Lead existente encontrado con ID: ${existingLeadId}, actualizando información`);
      
      // Actualizar lead existente con nueva información
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Solo actualizar campos que vienen en additionalData
      if (additionalData?.name) updateData.full_name = additionalData.name;
      if (additionalData?.email) updateData.email = additionalData.email;
      if (additionalData?.source) updateData.source = additionalData.source;
      
      // Si hay metadata en additionalData, combinarla con la metadata existente
      if (additionalData?.metadata) {
        // Primero obtener la metadata existente
        const { data: existingData, error: fetchError } = await supabase
          .from('leads')
          .select('metadata')
          .eq('id', existingLeadId)
          .eq('tenant_id', tenantId)
          .single();
        
        if (!fetchError && existingData) {
          // Combinar la metadata existente con la nueva
          const existingMetadata = existingData.metadata || {};
          updateData.metadata = {
            ...existingMetadata,
            ...additionalData.metadata,
            // Asegurar que estos campos siempre estén presentes
            original_lead_id: existingLeadId,
            original_phone: phoneNumber,
            last_updated: new Date().toISOString()
          };
        } else {
          // Si no hay metadata existente, usar solo la nueva
          updateData.metadata = {
            ...additionalData.metadata,
            original_lead_id: existingLeadId,
            original_phone: phoneNumber,
            created_at: new Date().toISOString()
          };
        }
      }
      
      const { error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', existingLeadId)
        .eq('tenant_id', tenantId);
      
      if (updateError) {
        logger.error(`Error al actualizar lead: ${updateError.message}`);
      } else {
        logger.info(`Lead ${existingLeadId} actualizado exitosamente`);
      }
      
      return existingLeadId;
    }
    
    // Si no existe, crear uno nuevo
    logger.info(`No se encontró lead existente, creando nuevo para teléfono ${phoneNumber}`);
    
    // Preparar metadata combinada
    const combinedMetadata = {
      chatbot_origin: true,
      original_phone: phoneNumber,
      created_at: new Date().toISOString(),
      ...(additionalData?.metadata || {})
    };
    
    // Si se proporciona un ID específico, guardarlo en metadata
    if (additionalData?.leadId) {
      combinedMetadata.original_lead_id = additionalData.leadId;
    }
    
    const leadData = {
      phone: phoneNumber,
      tenant_id: tenantId,
      stage: 'nuevos', // Etapa inicial 
      source: additionalData?.source || 'chatbot',
      full_name: additionalData?.name || `Lead ${phoneNumber}`,
      email: additionalData?.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: combinedMetadata
    };
    
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id')
      .single();
    
    if (error) {
      logger.error(`Error al crear lead: ${error.message}`);
      
      // Si hay un error por violación RLS, intentar con función rpc
      if (error.code === '42501') {
        logger.info(`Intentando crear lead con función RPC debido a error RLS`);
        
        try {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('create_or_update_lead', {
              p_phone: phoneNumber,
              p_tenant_id: tenantId,
              p_name: additionalData?.name || `Lead ${phoneNumber}`,
              p_email: additionalData?.email || '',
              p_source: additionalData?.source || 'chatbot',
              p_metadata: combinedMetadata
            });
            
          if (rpcError) {
            logger.error(`Error al crear lead con RPC: ${rpcError.message}`);
            return null;
          }
          
          if (rpcData) {
            logger.info(`Lead creado con RPC, ID: ${rpcData}`);
            return rpcData;
          }
        } catch (rpcErr) {
          logger.error(`Error al llamar función RPC: ${rpcErr}`);
        }
      }
      
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