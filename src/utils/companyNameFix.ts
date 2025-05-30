/**
 * src/utils/companyNameFix.ts
 * 
 * Utilidad para asegurar que la variable company_name siempre se reemplace correctamente
 * Soluciona el problema específico con esta variable en plantillas
 * 
 * @version 1.0.0
 * @created 2025-05-14
 */

import { getSupabaseAdminClient } from "../services/supabase";
import logger from "./logger";

/**
 * Cache para almacenar nombres de empresas por tenant_id
 * Evita múltiples llamadas a la BD para el mismo tenant
 */
const companyNameCache: Record<string, {
  name: string,
  timestamp: number
}> = {};

// Tiempo de caducidad de la caché: 10 minutos
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Obtiene el nombre de empresa para un tenant específico,
 * con optimizaciones de caché para evitar múltiples consultas
 * @param tenantId ID del tenant
 * @returns Nombre de la empresa o valor por defecto
 */
export async function getCompanyNameForTenant(tenantId: string): Promise<string> {
  try {
    // Verificar si tenantId es válido
    if (!tenantId || typeof tenantId !== 'string') {
      logger.warn('tenantId inválido o faltante, usando valor por defecto');
      return 'nuestra empresa';
    }

    // Si tenemos un valor en caché válido, usarlo
    if (companyNameCache[tenantId] && 
        Date.now() - companyNameCache[tenantId].timestamp < CACHE_TTL) {
      logger.debug(`Usando nombre de empresa en caché para tenant ${tenantId}: ${companyNameCache[tenantId].name}`);
      return companyNameCache[tenantId].name;
    }

    // Si no hay valor en caché o ha expirado, consultamos la BD
    const supabase = getSupabaseAdminClient();
    
    // DOBLE VERIFICACIÓN: Intentar las dos tablas en paralelo para máxima eficiencia
    const [varResult, tenantResult] = await Promise.all([
      // Consulta a tenant_variables
      supabase
        .from('tenant_variables')
        .select('variable_value')
        .eq('tenant_id', tenantId)
        .eq('variable_name', 'company_name')
        .maybeSingle(),
        
      // Consulta a tenants
      supabase
        .from('tenants')
        .select('company_name, display_name, name')
        .eq('id', tenantId)
        .maybeSingle()
    ]);
    
    // Primero verificar tenant_variables que es más específica
    if (varResult.data && varResult.data.variable_value) {
      const companyName = varResult.data.variable_value;
      // Guardamos en caché
      companyNameCache[tenantId] = {
        name: companyName,
        timestamp: Date.now()
      };
      logger.info(`Nombre de empresa obtenido de tenant_variables: ${companyName}`);
      return companyName;
    }
    
    // Luego revisar la tabla tenants
    if (tenantResult.data) {
      // Usar el primer valor que exista en orden de prioridad
      const companyName = tenantResult.data.company_name || 
                        tenantResult.data.display_name || 
                        tenantResult.data.name || 
                        'nuestra empresa';
      
      // Guardamos en caché
      companyNameCache[tenantId] = {
        name: companyName,
        timestamp: Date.now()
      };
      
      logger.info(`Nombre de empresa obtenido de tabla tenants: ${companyName}`);
      return companyName;
    }
    
    // ESTRATEGIA DE ÚLTIMO RECURSO: Consultar directamente la configuración del bot
    try {
      const { data: configData } = await supabase
        .from('chatbot_configs')
        .select('config_value')
        .eq('tenant_id', tenantId)
        .eq('config_key', 'company_name')
        .maybeSingle();
        
      if (configData && configData.config_value) {
        const companyName = configData.config_value;
        // Guardamos en caché
        companyNameCache[tenantId] = {
          name: companyName,
          timestamp: Date.now()
        };
        logger.info(`Nombre de empresa obtenido de chatbot_configs: ${companyName}`);
        return companyName;
      }
    } catch (configError) {
      logger.warn(`Error al consultar chatbot_configs: ${configError}`);
    }
    
    // Si no encontramos ningún valor, usamos el default
    logger.warn(`No se encontró nombre de empresa para tenant ${tenantId}, usando valor por defecto`);
    
    // Guardamos el valor por defecto en caché para evitar consultas repetidas
    companyNameCache[tenantId] = {
      name: 'nuestra empresa',
      timestamp: Date.now()
    };
    
    return 'nuestra empresa';
    
  } catch (error) {
    logger.error(`Error al obtener nombre de empresa para tenant ${tenantId}:`, error);
    return 'nuestra empresa';
  }
}

/**
 * Reemplaza forzadamente la variable {{company_name}} en un texto
 * Se asegura que esta variable nunca quede sin reemplazar
 * @param text Texto donde reemplazar
 * @param tenantId ID del tenant
 * @param defaultValue Valor por defecto opcional
 * @returns Texto con la variable reemplazada
 */
export async function forceReplaceCompanyName(
  text: string,
  tenantId: string,
  defaultValue: string = 'nuestra empresa'
): Promise<string> {
  // Validación inicial
  if (!text) {
    return '';
  }
  
  // Si no contiene la variable, regresamos el texto original
  if (!text.includes('{{company_name}}')) {
    return text;
  }
  
  try {
    // Obtener nombre de empresa
    const companyName = await getCompanyNameForTenant(tenantId);
    
    if (!companyName || companyName === 'nuestra empresa') {
      logger.warn(`⚠️ No se encontró un nombre de empresa específico para tenant ${tenantId}. Usando valor por defecto.`);
    }
    
    // Reemplazar todas las ocurrencias
    const result = text.replace(/\{\{company_name\}\}/g, companyName || defaultValue);
    
    // Verificación de seguridad: Si por algún motivo no se reemplazó la variable
    if (result.includes('{{company_name}}')) {
      logger.error(`⚠️ ALERTA: La variable company_name no fue reemplazada en: "${text.substring(0, 50)}..."`);
      // Intentar un último reemplazo directo
      return result.replace(/\{\{company_name\}\}/g, defaultValue);
    }
    
    logger.info(`Variable company_name reemplazada forzadamente con: ${companyName || defaultValue}`);
    return result;
  } catch (error) {
    logger.error(`Error al reemplazar forzadamente company_name:`, error);
    
    // En caso de error, hacemos un reemplazo simple con el valor por defecto
    return text.replace(/\{\{company_name\}\}/g, defaultValue);
  }
}

/**
 * Versión síncrona para forzar reemplazo en situaciones donde no se puede usar await
 */
export function forceReplaceCompanyNameSync(
  text: string,
  cachedCompanyName: string = ''
): string {
  // Validación inicial
  if (!text) {
    return '';
  }
  
  // Si no contiene la variable, regresamos el texto original
  if (!text.includes('{{company_name}}')) {
    return text;
  }
  
  // Usar valor en caché o valor por defecto
  const companyName = cachedCompanyName || 'nuestra empresa';
  
  // Reemplazar todas las ocurrencias
  return text.replace(/\{\{company_name\}\}/g, companyName);
}

/**
 * Corregir problema de botones para nodo 'buttonsNode-1747166931506'
 * Función diseñada específicamente para resolver el problema con este nodo
 * @param message Mensaje de respuesta del usuario
 * @param isTargetNode Booleano que indica si estamos en el nodo problemático
 * @returns Índice de la opción seleccionada (0 para Sí, 1 para No) o -1 si no se pudo determinar
 */
export function fixButtonNodeSelection(message: string, isTargetNode: boolean): number {
  // Si no es el nodo problemático, no hacemos nada especial
  if (!isTargetNode) {
    return -1;
  }
  
  // Validación de entrada
  if (!message || typeof message !== 'string') {
    logger.warn('Mensaje inválido para fixButtonNodeSelection, asumiendo opción "Sí" por defecto');
    return 0; // Default a "Sí"
  }
  
  try {
    // Normalizar mensaje: eliminar espacios, acentos, signos de puntuación
    let normalizedMessage = message.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[.,;:¿?¡!]/g, ''); // Eliminar puntuación
    
    // Lista EXTENDIDA de palabras que significan "Sí"
    const affirmativeWords = [
      'si', 'sí', 'yes', 's', 'y', 'afirmativo', 'correcto', 'ok', 'okay',
      'claro', 'seguro', 'por supuesto', 'dale', 'bueno', 'genial', 'va',
      'excelente', '1', 'si quiero', 'confirmo', 'acepto', 'adelante', 
      'procede', 'me gustaria', 'me encantaria', 'quiero', 'deseo',
      'esta bien', 'de acuerdo', 'perfecto', 'porfavor', 'quisiera'
    ];
    
    // Lista EXTENDIDA de palabras que significan "No"
    const negativeWords = [
      'no', 'nop', 'n', 'negativo', 'incorrecto', 'nada', 'nunca', 
      'en este momento no', 'ahora no', 'despues', 'después', 'luego',
      'jamás', 'para nada', 'de ninguna manera', '2', 'no quiero',
      'no necesito', 'no me interesa', 'no gracias', 'paso', 'ahora no'
    ];
    
    // PRIMERA VERIFICACIÓN: Búsqueda exacta de palabras completas
    const messageWords = normalizedMessage.split(/\s+/);
    
    // Verificar si alguna palabra afirmativa está como palabra completa
    for (const word of messageWords) {
      if (affirmativeWords.includes(word)) {
        logger.info(`Respuesta afirmativa exacta detectada (${word}) para nodo buttonsNode-1747166931506, seleccionando opción 0`);
        return 0; // Índice para "Sí"
      }
      if (negativeWords.includes(word)) {
        logger.info(`Respuesta negativa exacta detectada (${word}) para nodo buttonsNode-1747166931506, seleccionando opción 1`);
        return 1; // Índice para "No"
      }
    }
    
    // SEGUNDA VERIFICACIÓN: Frases completas afirmativas
    const affirmativePhrases = [
      'me gustaria agendar', 'quisiera agendar', 'quiero agendar', 'si quiero agendar',
      'programa cita', 'agenda cita', 'quisiera cita', 'quiero cita', 'hacer cita'
    ];
    
    // Frases completas negativas
    const negativePhrases = [
      'no me gustaria agendar', 'no quisiera agendar', 'no quiero agendar', 
      'no quiero cita', 'no necesito cita', 'no es necesario', 'no hace falta'
    ];
    
    // Verificar frases afirmativas
    for (const phrase of affirmativePhrases) {
      if (normalizedMessage.includes(phrase)) {
        logger.info(`Frase afirmativa detectada ("${phrase}") para nodo buttonsNode-1747166931506, seleccionando opción 0`);
        return 0; // Índice para "Sí"
      }
    }
    
    // Verificar frases negativas
    for (const phrase of negativePhrases) {
      if (normalizedMessage.includes(phrase)) {
        logger.info(`Frase negativa detectada ("${phrase}") para nodo buttonsNode-1747166931506, seleccionando opción 1`);
        return 1; // Índice para "No"
      }
    }
    
    // TERCERA VERIFICACIÓN: Palabras individuales en contexto
    // Verificar si alguna palabra afirmativa está en el mensaje
    for (const word of affirmativeWords) {
      // Coincidencia exacta, o rodeada de espacios, o al inicio o fin
      if (normalizedMessage === word || 
          normalizedMessage.includes(` ${word} `) || 
          normalizedMessage.startsWith(`${word} `) || 
          normalizedMessage.endsWith(` ${word}`)) {
        logger.info(`Respuesta afirmativa contextual (${word}) para nodo buttonsNode-1747166931506, seleccionando opción 0`);
        return 0; // Índice para "Sí"
      }
    }
    
    // Verificar si alguna palabra negativa está en el mensaje
    for (const word of negativeWords) {
      if (normalizedMessage === word || 
          normalizedMessage.includes(` ${word} `) || 
          normalizedMessage.startsWith(`${word} `) || 
          normalizedMessage.endsWith(` ${word}`)) {
        logger.info(`Respuesta negativa contextual (${word}) para nodo buttonsNode-1747166931506, seleccionando opción 1`);
        return 1; // Índice para "No"
      }
    }
    
    // ANÁLISIS CONTEXTUAL: Si contiene "cita" o "agendar", probablemente quiere una cita
    if (normalizedMessage.includes('cita') || 
        normalizedMessage.includes('agendar') ||
        normalizedMessage.includes('agenda') ||
        normalizedMessage.includes('programar') ||
        normalizedMessage.includes('reservar') ||
        normalizedMessage.includes('visita')) {
      logger.info(`Análisis contextual positivo para nodo buttonsNode-1747166931506, asumiendo opción 0 (Sí)`);
      return 0;
    }
    
    // Si no encontramos ninguna coincidencia, por defecto asumimos "Sí" para este nodo específico
    logger.info(`No se pudo determinar selección para buttonsNode-1747166931506, asumiendo "Sí" (opción 0) por defecto`);
    return 0;
  } catch (error) {
    logger.error(`Error en fixButtonNodeSelection:`, error);
    return 0; // Por defecto "Sí" en caso de error
  }
}

/**
 * Validación específica de los IDs de sourceHandle para nodos de botones
 * @param nodeId ID del nodo
 * @param selectedIndex Índice seleccionado
 * @returns Identificador normalizado para el sourceHandle
 */
export function getSourceHandleId(nodeId: string, selectedIndex: number): string {
  // Si es el nodo problemático, aseguramos formato correcto
  if (nodeId === 'buttonsNode-1747166931506') {
    return `handle-${selectedIndex}`;
  }
  
  // Para otros nodos, retornamos formato general
  return `handle-${selectedIndex}`;
}