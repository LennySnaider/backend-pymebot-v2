/**
 * src/utils/finalReplacer.ts
 * 
 * Procesador final de reemplazo de variables para ser usado como último paso
 * antes de enviar mensajes al usuario.
 * 
 * @version 1.1.0
 * @created 2025-05-14
 * @updated 2025-05-14
 */

import logger from './logger';
import { replaceVariables } from './variableReplacer';
import { replaceVariablesEnhanced } from './variableReplacerFix';
import { getSystemVariablesForTenant } from './systemVariablesLoader';
import { getCriticalVariableValue, isCriticalVariable, getAllCriticalVariables } from './criticalVariables';

/**
 * Procesa un texto final reemplazando todas las variables antes de enviarlo al usuario.
 * Combina todos los sistemas de reemplazo para asegurar que no queden variables sin procesar.
 * 
 * @param text Texto a procesar
 * @param state Estado de la conversación
 * @param tenantId ID del tenant
 * @returns Texto con todas las variables reemplazadas
 */
export async function processFinalText(
  text: string,
  state: Record<string, any> = {},
  tenantId: string
): Promise<string> {
  if (!text) return '';
  
  try {
    // Obtenemos todas las variables del sistema para el tenant
    const systemVariables = await getSystemVariablesForTenant(tenantId);
    
    // Combinamos con variables del estado
    const allVariables = { 
      ...systemVariables, 
      ...state,
      // Si hay un objeto variables en el estado, incluimos sus propiedades directamente
      ...(state.variables || {}),
      // También agregamos propiedades del contexto si existe
      ...(state.context || {})
    };
    
    // Primera pasada: aplicamos el reemplazo estándar
    let processedText = replaceVariables(text, allVariables);
    
    // Segunda pasada: aplicamos el reemplazo mejorado para cualquier variable que quede
    processedText = replaceVariablesEnhanced(processedText, allVariables);
    
    // Tercera pasada: buscamos cualquier variable en formato {{variable}} que no se haya reemplazado
    // y lo intentamos de nuevo con diferentes formatos de nombre
    processedText = processedText.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      
      // Crear variaciones del nombre para intentar diferentes formatos
      const variations = [
        trimmedName,
        trimmedName.replace(/-/g, '_'), // kebab-case a snake_case
        trimmedName.replace(/_/g, '-'), // snake_case a kebab-case
        // camelCase a snake_case
        trimmedName.replace(/([A-Z])/g, '_$1').toLowerCase(),
        // snake_case a camelCase
        trimmedName.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      ];
      
      // Buscar en las variables con todas las variaciones posibles
      for (const varName of variations) {
        if (allVariables[varName] !== undefined) {
          return String(allVariables[varName]);
        }
        
        // Verificar si alguna variación es una variable crítica
        if (isCriticalVariable(varName)) {
          // Obtener el valor de la variable crítica con el sistema de fallback
          const criticalValue = getCriticalVariableValue(varName, state, systemVariables);
          if (criticalValue !== null) {
            return criticalValue;
          }
        }
      }
      
      // Verificar si la variable original es crítica
      if (isCriticalVariable(trimmedName)) {
        const criticalValue = getCriticalVariableValue(trimmedName, state, systemVariables);
        if (criticalValue !== null) {
          logger.info(`Usando valor crítico para variable: ${trimmedName}`);
          return criticalValue;
        }
      }
      
      // Si no hay coincidencia ni valor crítico, devolvemos cadena vacía para limpiar la plantilla
      logger.warn(`Variable no encontrada en procesamiento final: ${trimmedName}`);
      return '';
    });
    
    return processedText;
  } catch (error) {
    logger.error(`Error en procesamiento final de texto: ${error}`);
    // En caso de error, intentamos un reemplazo básico como fallback
    try {
      // Incluimos las variables críticas en el último intento de reemplazo
      const fallbackVariables = {
        ...(state.variables || {}),
        // Incluimos todas las variables críticas como último recurso
        ...getAllCriticalVariables()
      };
      
      // Aplicamos un reemplazo básico con las variables disponibles
      let processedText = replaceVariables(text, fallbackVariables);
      
      // Buscamos cualquier variable que quede sin reemplazar y usamos las críticas si es posible
      processedText = processedText.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const trimmedName = variableName.trim();
        
        // Verificar si es una variable crítica
        if (isCriticalVariable(trimmedName)) {
          logger.info(`Usando valor crítico en fallback para: ${trimmedName}`);
          return getCriticalVariableValue(trimmedName) || '';
        }
        
        // Si no es crítica, eliminamos la variable
        return '';
      });
      
      return processedText;
    } catch (fallbackError) {
      logger.error(`Error también en reemplazo de fallback: ${fallbackError}`);
      return text; // Devolver texto original si todo falla
    }
  }
}

export default {
  processFinalText
};