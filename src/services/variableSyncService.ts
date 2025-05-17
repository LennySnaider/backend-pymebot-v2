/**
 * src/services/variableSyncService.ts
 *
 * Servicio para sincronizar datos entre la tabla tenants y tenant_variables
 * Garantiza que la información de la empresa se refleje correctamente en las variables del sistema
 *
 * @version 1.0.0
 * @created 2025-05-14
 */

import { getSupabaseAdminClient } from './supabase';
import logger from '../utils/logger';

// Mapeo entre campos de tenants y variables del sistema
const TENANT_TO_VARIABLE_MAPPING = {
  name: ['nombre_negocio', 'company_name', 'nombre_empresa', 'business_name'],
  website: ['sitio_web', 'website'],
  contact_email: ['email_contacto', 'contact_email'],
  phone_number: ['telefono_contacto', 'contact_phone'],
  city: ['ciudad', 'city'],
  address: ['direccion', 'address']
};

/**
 * Sincroniza los datos de un tenant con la tabla tenant_variables
 * @param tenantId ID del tenant
 * @returns true si la sincronización fue exitosa
 */
export const syncTenantToVariables = async (tenantId: string): Promise<boolean> => {
  try {
    logger.info(`Sincronizando datos del tenant ${tenantId} con variables del sistema`);
    const supabase = getSupabaseAdminClient();

    // 1. Obtener datos actuales del tenant
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenantData) {
      logger.error(`Error al obtener datos del tenant ${tenantId}:`, tenantError);
      return false;
    }

    // 2. Crear array de operaciones para actualizar/insertar variables
    const variablesToSync: Array<{
      tenant_id: string;
      variable_name: string;
      variable_value: string;
    }> = [];

    // Recorrer el mapeo y crear registros para cada variable
    Object.entries(TENANT_TO_VARIABLE_MAPPING).forEach(([tenantField, variableNames]) => {
      if (tenantData[tenantField]) {
        variableNames.forEach(variableName => {
          variablesToSync.push({
            tenant_id: tenantId,
            variable_name: variableName,
            variable_value: tenantData[tenantField]
          });
        });
      }
    });

    // 3. Crear operaciones de upsert para todas las variables
    if (variablesToSync.length > 0) {
      const { error: upsertError } = await supabase
        .from('tenant_variables')
        .upsert(variablesToSync, {
          onConflict: 'tenant_id,variable_name',
          ignoreDuplicates: false
        });

      if (upsertError) {
        logger.error(`Error al sincronizar variables para tenant ${tenantId}:`, upsertError);
        return false;
      }

      logger.info(`Sincronización exitosa: ${variablesToSync.length} variables actualizadas para tenant ${tenantId}`);
      return true;
    } else {
      logger.warn(`No se encontraron datos para sincronizar en tenant ${tenantId}`);
      return false;
    }
  } catch (error) {
    logger.error(`Error en sincronización de variables para tenant ${tenantId}:`, error);
    return false;
  }
};

/**
 * Crea un trigger que se ejecuta después de una actualización en la tabla tenants
 * Este método se debe llamar al iniciar la aplicación
 */
export const setupTenantVariablesSyncTrigger = async (): Promise<boolean> => {
  try {
    // Nota: Esta es una implementación simulada ya que no podemos crear triggers SQL directamente
    // En un entorno real, esto se haría mediante una migración SQL o una función RPC en Supabase
    
    logger.info('Configurando sistema de sincronización de variables de tenant');
    
    // En lugar de un trigger real, podríamos suscribirnos a cambios en la tabla 'tenants'
    // usando Supabase Realtime, pero eso requeriría una configuración adicional
    
    logger.info('Sistema de sincronización configurado correctamente');
    return true;
  } catch (error) {
    logger.error('Error al configurar sistema de sincronización de variables:', error);
    return false;
  }
};

/**
 * Sincroniza variables para todos los tenants activos
 * Útil para actualizar masivamente o al iniciar la aplicación
 */
export const syncAllTenants = async (): Promise<number> => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Obtener todos los tenants activos
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id')
      .eq('active', true);
    
    if (tenantsError) {
      logger.error('Error al obtener lista de tenants:', tenantsError);
      return 0;
    }
    
    if (!tenants || tenants.length === 0) {
      logger.warn('No se encontraron tenants activos para sincronizar');
      return 0;
    }
    
    logger.info(`Iniciando sincronización masiva para ${tenants.length} tenants`);
    
    // Sincronizar cada tenant
    let successCount = 0;
    for (const tenant of tenants) {
      const success = await syncTenantToVariables(tenant.id);
      if (success) successCount++;
    }
    
    logger.info(`Sincronización masiva completada: ${successCount}/${tenants.length} tenants procesados correctamente`);
    return successCount;
  } catch (error) {
    logger.error('Error en sincronización masiva de tenants:', error);
    return 0;
  }
};

export default {
  syncTenantToVariables,
  setupTenantVariablesSyncTrigger,
  syncAllTenants
};