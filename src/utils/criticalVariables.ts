/**
 * src/utils/criticalVariables.ts
 * 
 * Define variables críticas del sistema que siempre deben tener un valor por defecto
 * y proporciona funciones para acceder a ellas de forma segura.
 * 
 * @version 1.0.0
 * @created 2025-05-14
 */

import logger from './logger';

/**
 * Definición de variables críticas del sistema con sus valores por defecto
 */
export const CRITICAL_VARIABLES = {
  // Información de la empresa
  company_name: 'Nuestra empresa',
  business_name: 'Nuestra empresa',
  nombre_empresa: 'Nuestra empresa',
  nombre_negocio: 'Nuestra empresa',
  razon_social: 'Nuestra empresa',
  
  // Información de contacto
  support_phone: '+52 55 1234 5678',
  telefono_soporte: '+52 55 1234 5678',
  telefono_contacto: '+52 55 1234 5678',
  contact_phone: '+52 55 1234 5678',
  
  // Correos de contacto
  support_email: 'soporte@empresa.com',
  email_soporte: 'soporte@empresa.com',
  contact_email: 'contacto@empresa.com',
  email_contacto: 'contacto@empresa.com',
  
  // Horarios
  business_hours: 'Lunes a Viernes de 9:00 a 18:00',
  horario_atencion: 'Lunes a Viernes de 9:00 a 18:00',
  opening_hours: 'Lunes a Viernes de 9:00 a 18:00',
  
  // Ubicación
  business_address: 'Calle Principal #123, Ciudad',
  direccion_negocio: 'Calle Principal #123, Ciudad',
  
  // Nombres de usuario
  user_name: 'Usuario',
  nombre_usuario: 'Usuario',
  nombre: 'Usuario',
  
  // Sitio web
  website: 'www.empresa.com',
  sitio_web: 'www.empresa.com',
  
  // Redes sociales
  facebook: 'facebook.com/empresa',
  instagram: 'instagram.com/empresa',
  twitter: 'twitter.com/empresa',
  whatsapp: '+52 55 1234 5678',
  
  // Información legal
  legal_name: 'Empresa S.A. de C.V.',
  nombre_legal: 'Empresa S.A. de C.V.',
};

// Tipo para las variables críticas
export type CriticalVariableKey = keyof typeof CRITICAL_VARIABLES;

/**
 * Obtiene el valor de una variable crítica, con un sistema de fallback en cascada:
 * 1. Primero intenta obtenerla del estado de la conversación
 * 2. Si no existe, intenta obtenerla de las variables del sistema
 * 3. Si no existe en ninguna parte, usa el valor por defecto
 * 
 * @param variableName Nombre de la variable crítica
 * @param state Estado actual de la conversación
 * @param systemVariables Variables del sistema
 * @returns Valor de la variable, con fallback al valor por defecto
 */
export function getCriticalVariableValue(
  variableName: string,
  state: Record<string, any> = {},
  systemVariables: Record<string, any> = {}
): string {
  // Verificar si es una variable crítica conocida
  const isCriticalVariable = variableName in CRITICAL_VARIABLES;
  
  // Si no es una variable crítica conocida, devolvemos null
  if (!isCriticalVariable) {
    return null;
  }
  
  // Sistema de cascada para buscar el valor
  // 1. Buscar en el estado directo
  if (state[variableName] !== undefined) {
    return String(state[variableName]);
  }
  
  // 2. Buscar en variables anidadas del estado (si existen)
  if (state.variables && state.variables[variableName] !== undefined) {
    return String(state.variables[variableName]);
  }
  
  // 3. Buscar en el contexto del estado (si existe)
  if (state.context && state.context[variableName] !== undefined) {
    return String(state.context[variableName]);
  }
  
  // 4. Buscar en las variables del sistema
  if (systemVariables[variableName] !== undefined) {
    return String(systemVariables[variableName]);
  }
  
  // 5. Usar el valor por defecto si existe
  const defaultValue = CRITICAL_VARIABLES[variableName as CriticalVariableKey];
  if (defaultValue) {
    logger.info(`Usando valor por defecto para variable crítica: ${variableName}`);
    return String(defaultValue);
  }
  
  // Si no hay valor por defecto (no debería ocurrir para variables críticas), devolver cadena vacía
  logger.warn(`Variable crítica sin valor por defecto: ${variableName}`);
  return '';
}

/**
 * Verifica si una variable es crítica (tiene un valor por defecto definido)
 * 
 * @param variableName Nombre de la variable a verificar
 * @returns true si es una variable crítica, false en caso contrario
 */
export function isCriticalVariable(variableName: string): boolean {
  return variableName in CRITICAL_VARIABLES;
}

/**
 * Obtiene todas las variables críticas con sus valores por defecto
 * 
 * @returns Objeto con todas las variables críticas y sus valores por defecto
 */
export function getAllCriticalVariables(): typeof CRITICAL_VARIABLES {
  return { ...CRITICAL_VARIABLES };
}

export default {
  getCriticalVariableValue,
  isCriticalVariable,
  getAllCriticalVariables,
  CRITICAL_VARIABLES
};