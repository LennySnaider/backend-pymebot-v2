/**
 * src/services/propertiesProductsService.ts
 * Servicio para obtener propiedades como productos para el chatbot
 * @version 1.0.0
 * @created 2025-01-30
 */

import { getSupabaseClient } from './supabase';
import logger from '../utils/logger';

export interface Property {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  property_type?: string;
  address?: string;
  is_active: boolean;
  metadata?: any;
}

/**
 * Obtiene las propiedades activas de un tenant formateadas como productos
 */
export async function getPropertiesAsProducts(
  tenantId: string,
  limit: number = 10
): Promise<string[]> {
  try {
    logger.info(`[getPropertiesAsProducts] Obteniendo propiedades para tenant: ${tenantId}`);
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(limit);
    
    if (error) {
      logger.error(`[getPropertiesAsProducts] Error obteniendo propiedades:`, error);
      return [];
    }
    
    if (!data || data.length === 0) {
      logger.info(`[getPropertiesAsProducts] No se encontraron propiedades para tenant ${tenantId}`);
      return [];
    }
    
    // Formatear las propiedades para el chatbot
    const formattedProperties = data.map(property => {
      let propertyText = property.name;
      
      if (property.property_type) {
        propertyText += ` (${property.property_type})`;
      }
      
      if (property.price) {
        propertyText += ` - ${property.currency || '$'}${property.price}`;
      }
      
      if (property.address) {
        propertyText += ` - ${property.address}`;
      }
      
      return propertyText;
    });
    
    logger.info(`[getPropertiesAsProducts] Propiedades formateadas: ${formattedProperties.length}`);
    return formattedProperties;
    
  } catch (error) {
    logger.error('[getPropertiesAsProducts] Error general:', error);
    return [];
  }
}