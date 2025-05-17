/**
 * src/utils/variableReplacerFix.ts
 * 
 * Versión mejorada del reemplazador de variables que soporta múltiples formatos
 * Esta versión soluciona el problema con variables que no se muestran correctamente
 * 
 * @version 1.0.1
 * @created 2025-05-14
 */

import logger from './logger';
import { replaceVariables as originalReplaceVariables } from './variableReplacer';

// Exportar la función original para asegurar compatibilidad
export { replaceVariables } from './variableReplacer';

/**
 * Reemplaza todas las variables en un texto usando el objeto de estado y valores por defecto
 * Esta versión maneja tanto formato {{variable}} como {variable}
 * 
 * @param text Texto en el que reemplazar las variables
 * @param variables Objeto con las variables a reemplazar
 * @param defaults Valores por defecto adicionales (opcionales)
 * @returns Texto con las variables reemplazadas
 */
export function replaceVariablesEnhanced(
  text: string, 
  variables: Record<string, any> = {}, 
  defaults: Record<string, string> = {}
): string {
  if (!text) return '';
  
  try {
    // Primera pasada: reemplazar variables con formato {{variable}}
    const firstPass = originalReplaceVariables(text, variables, defaults);
    
    // Segunda pasada: reemplazar variables con formato {variable}
    const secondPass = replaceSimpleFormat(firstPass, variables, defaults);
    
    // Tercera pasada: un último intento para cualquier variable que aún quede en formato {{}}
    return secondPass.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      
      // Caso especial para variables críticas
      if (trimmedName === 'company_name' || trimmedName === 'nombre_empresa' || trimmedName === 'nombre_negocio') {
        if (variables['company_name']) return variables['company_name'];
        if (variables['nombre_empresa']) return variables['nombre_empresa'];
        if (variables['nombre_negocio']) return variables['nombre_negocio'];
        return defaults['company_name'] || defaults['nombre_empresa'] || 'nuestra empresa';
      }
      
      if (trimmedName === 'nombre_usuario' || trimmedName === 'nombre' || trimmedName === 'user_name') {
        if (variables['nombre_usuario']) return variables['nombre_usuario'];
        if (variables['nombre']) return variables['nombre'];
        if (variables['user_name']) return variables['user_name'];
        return defaults['nombre_usuario'] || defaults['nombre'] || 'Usuario';
      }
      
      // Intentar una búsqueda más agresiva en todo el objeto
      for (const [key, value] of Object.entries(variables)) {
        if (typeof value === 'string' && 
            (key.toLowerCase().includes(trimmedName.toLowerCase()) || 
             trimmedName.toLowerCase().includes(key.toLowerCase()))) {
          return value;
        }
      }
      
      // Si todo falla, devolver un valor por defecto o vacío
      return '';
    });
  } catch (error) {
    logger.error(`Error en reemplazo de variables mejorado: ${error}`);
    // Intentar con el método original como fallback
    try {
      return originalReplaceVariables(text, variables, defaults);
    } catch (secondError) {
      // Como último recurso, devolver el texto original
      return text;
    }
  }
}

/**
 * Reemplaza variables con formato {variable} (sin dobles llaves)
 * Para compatibilidad con el formato usado en flowProcessor.ts
 */
function replaceSimpleFormat(
  text: string,
  variables: Record<string, any> = {},
  defaults: Record<string, string> = {}
): string {
  if (!text) return '';
  
  // Combinar variables con valores por defecto
  const allVars = { ...defaults, ...variables };
  
  // Reemplazar todas las variables de la forma {variable}
  return text.replace(/\{([^{}]+)\}/g, (match, variableName) => {
    const trimmedName = variableName.trim();
    
    // Buscar en diferentes formatos (camelCase, snake_case, kebab-case)
    const possibleNames = [
      trimmedName,
      trimmedName.replace(/-/g, '_'), // kebab-case a snake_case
      trimmedName.replace(/_/g, '-'), // snake_case a kebab-case
      // camelCase a snake_case
      trimmedName.replace(/([A-Z])/g, '_$1').toLowerCase(),
      // snake_case a camelCase
      trimmedName.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
    ];
    
    // Buscar en las variables disponibles
    for (const name of possibleNames) {
      if (allVars[name] !== undefined) {
        // Convertir a string (por si es un número u otro tipo)
        return String(allVars[name]);
      }
    }
    
    // Si no se encuentra, mantener la variable tal cual
    logger.debug(`Variable no encontrada en formato simple: ${trimmedName}`);
    return match; // Mantener sin cambios
  });
}

/**
 * Versión unificada que procesa todos los formatos de variables a la vez
 * Recomendada para uso futuro en toda la aplicación
 */
export function replaceAllVariableFormats(
  text: string,
  variables: Record<string, any> = {},
  defaults: Record<string, string> = {}
): string {
  if (!text) return '';
  
  try {
    // Combinar variables con valores por defecto
    const allVars = { ...defaults, ...variables };
    
    // Reemplazar tanto {{variable}} como {variable} en una sola operación
    return text.replace(/\{\{([^{}]+)\}\}|\{([^{}]+)\}/g, (match, doubleFormat, singleFormat) => {
      // Determinar qué formato coincidió y extraer el nombre
      const variableName = doubleFormat || singleFormat;
      const trimmedName = variableName.trim();
      
      // Crear lista de posibles nombres en diferentes formatos
      const possibleNames = [
        trimmedName,
        trimmedName.replace(/-/g, '_'), // kebab-case a snake_case
        trimmedName.replace(/_/g, '-'), // snake_case a kebab-case
        // camelCase a snake_case
        trimmedName.replace(/([A-Z])/g, '_$1').toLowerCase(),
        // snake_case a camelCase
        trimmedName.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      ];
      
      // Buscar en las variables disponibles
      for (const name of possibleNames) {
        if (allVars[name] !== undefined) {
          // Convertir a string (por si es un número u otro tipo)
          return String(allVars[name]);
        }
      }
      
      // Si no se encuentra, mantener la variable tal cual
      logger.debug(`Variable no encontrada en formato unificado: ${trimmedName}`);
      return match; // Mantener sin cambios
    });
  } catch (error) {
    logger.error(`Error en reemplazo unificado de variables: ${error}`);
    return text; // Devolver texto original en caso de error
  }
}