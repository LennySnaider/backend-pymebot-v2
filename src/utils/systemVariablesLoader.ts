/**
 * src/utils/systemVariablesLoader.ts
 *
 * Servicio para cargar variables del sistema desde Supabase o caché local.
 * Proporciona variables del sistema y de tenant específicas para usar en plantillas.
 *
 * @version 1.0.0
 * @created 2025-05-14
 */

import logger from './logger';
import { getSupabaseAdminClient } from '../services/supabase';

// Variables globales del sistema (valores por defecto)
const DEFAULT_SYSTEM_VARIABLES = {
  // Variables de negocio
  nombre_negocio: 'AgentProp',
  company_name: 'AgentProp',
  nombre_empresa: 'AgentProp',
  sitio_web: 'https://agentprop.com',
  telefono_contacto: '555-123-4567',
  email_contacto: 'info@agentprop.com',
  direccion: 'Calle Principal 123, Ciudad',
  
  // Horarios
  horario_atencion: 'Lunes a Viernes de 9:00 a 18:00',
  business_hours: 'Monday to Friday, 9:00 AM to 6:00 PM',
  
  // Variables para respuestas
  saludo_inicial: '¡Hola! Bienvenido a AgentProp.',
  firma: 'Equipo de AgentProp',
  
  // Valores para respuestas condicionales
  si_disponible: 'Sí, tenemos disponibilidad',
  no_disponible: 'Lo sentimos, no hay disponibilidad',
  
  // Información de productos/servicios
  servicios: 'Gestión de propiedades, venta, alquiler y asesoría inmobiliaria',
  
  // Variables para plantillas específicas
  template_name: 'Plantilla Estándar',
  template_version: '1.0.0',
  template_author: 'Equipo de AgentProp'
};

// Caché de variables del sistema por tenant
const systemVariablesCache: Record<string, Record<string, any>> = {};
const cacheExpirations: Record<string, number> = {};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Carga las variables del sistema para un tenant específico desde Supabase
 * Si la caché es válida, devuelve los valores en caché
 *
 * @param tenantId ID del tenant
 * @returns Variables del sistema para el tenant
 */
export async function getSystemVariablesForTenant(tenantId: string): Promise<Record<string, any>> {
  try {
    // Verificar si la caché es válida
    const now = Date.now();
    if (
      systemVariablesCache[tenantId] &&
      cacheExpirations[tenantId] &&
      cacheExpirations[tenantId] > now
    ) {
      logger.debug(`Usando variables del sistema en caché para tenant ${tenantId}`);
      return { ...DEFAULT_SYSTEM_VARIABLES, ...systemVariablesCache[tenantId] };
    }
    
    // Cargar variables reales desde Supabase
    const tenantVariables = await loadTenantVariablesFromSupabase(tenantId);
    
    // Actualizar la caché
    systemVariablesCache[tenantId] = tenantVariables;
    cacheExpirations[tenantId] = now + CACHE_TTL_MS;
    
    logger.info(`Variables del sistema cargadas para tenant ${tenantId}`);
    
    // Devolver combinación de variables por defecto y específicas del tenant
    return { ...DEFAULT_SYSTEM_VARIABLES, ...tenantVariables };
  } catch (error) {
    logger.error(`Error al cargar variables del sistema para tenant ${tenantId}: ${error}`);
    // En caso de error, devolvemos solo los valores por defecto
    return { ...DEFAULT_SYSTEM_VARIABLES };
  }
}

/**
 * Versión simplificada para pruebas - obtiene solo variables del sistema
 */
export async function getTenantSystemVariables(
  tenantId: string = 'default'
): Promise<Record<string, any>> {
  return getSystemVariablesForTenant(tenantId);
}

/**
 * Carga las variables específicas de un tenant desde Supabase
 */
async function loadTenantVariablesFromSupabase(tenantId: string): Promise<Record<string, any>> {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Primero intentamos cargar desde tenant_variables
    const { data: tenantVars, error: varsError } = await supabase
      .from('tenant_variables')
      .select('variable_name, variable_value')
      .eq('tenant_id', tenantId);
    
    if (varsError) {
      logger.error(`Error al cargar variables del tenant ${tenantId}:`, varsError);
    }
    
    // Si tenemos variables, las convertimos a un objeto
    const variables: Record<string, any> = {};
    
    if (tenantVars && tenantVars.length > 0) {
      tenantVars.forEach(v => {
        variables[v.variable_name] = v.variable_value;
      });
    }
    
    // Si no hay variables en tenant_variables o faltan algunas clave,
    // intentamos cargar desde la tabla tenants directamente
    if (!variables.nombre_negocio || !variables.company_name) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('name, website, contact_email, phone_number, city, address')
        .eq('id', tenantId)
        .single();
      
      if (tenantError) {
        logger.error(`Error al cargar datos del tenant ${tenantId}:`, tenantError);
      }
      
      if (tenantData) {
        // Mapeamos los datos del tenant a variables del sistema
        variables.nombre_negocio = variables.nombre_negocio || tenantData.name;
        variables.company_name = variables.company_name || tenantData.name;
        variables.nombre_empresa = variables.nombre_empresa || tenantData.name;
        variables.business_name = variables.business_name || tenantData.name;
        variables.sitio_web = variables.sitio_web || tenantData.website;
        variables.website = variables.website || tenantData.website;
        variables.email_contacto = variables.email_contacto || tenantData.contact_email;
        variables.contact_email = variables.contact_email || tenantData.contact_email;
        variables.telefono_contacto = variables.telefono_contacto || tenantData.phone_number;
        variables.contact_phone = variables.contact_phone || tenantData.phone_number;
        variables.ciudad = variables.ciudad || tenantData.city;
        variables.city = variables.city || tenantData.city;
        variables.direccion = variables.direccion || tenantData.address;
        variables.address = variables.address || tenantData.address;
      }
    }
    
    logger.info(`Variables cargadas para tenant ${tenantId}:`, Object.keys(variables));
    return variables;
    
  } catch (error) {
    logger.error(`Error crítico al cargar variables para tenant ${tenantId}:`, error);
    // En caso de error, devolvemos valores por defecto
    return {
      nombre_negocio: 'Empresa',
      company_name: 'Company',
      nombre_empresa: 'Empresa',
      sitio_web: 'https://ejemplo.com',
      telefono_contacto: '555-555-5555',
      email_contacto: 'info@ejemplo.com'
    };
  }
}

/**
 * Limpia la caché para pruebas o reinicio
 */
export function clearSystemVariablesCache(): void {
  Object.keys(systemVariablesCache).forEach(key => {
    delete systemVariablesCache[key];
    delete cacheExpirations[key];
  });
  
  logger.info('Caché de variables del sistema limpiada');
}

export default {
  getSystemVariablesForTenant,
  getTenantSystemVariables,
  clearSystemVariablesCache
};