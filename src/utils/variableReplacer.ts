/**
 * src/utils/variableReplacer.ts
 * 
 * Utilidad centralizada para reemplazo de variables en mensajes
 * Proporciona funcionalidad consistente para reemplazar variables en templates
 * 
 * @version 1.0.0
 * @created 2025-05-13
 */

import logger from './logger';

/**
 * Variables por defecto para casos en que no estén definidas
 */
const DEFAULT_VARIABLES: Record<string, string> = {
  // Variables personales
  'nombre_usuario': 'Usuario',
  'nombre': 'Usuario',
  'user_name': 'Usuario',
  'apellido': '',
  'email': '',
  'telefono': '',
  
  // Variables de citas
  'fecha_cita': '[fecha pendiente]',
  'hora_cita': '[hora pendiente]',
  'tipo_cita': 'consulta',
  'lugar_cita': 'nuestras oficinas',
  
  // Variables de negocio
  'nombre_negocio': 'nuestra empresa',
  'company_name': 'nuestra empresa',
  'nombre_empresa': 'nuestra empresa',
  'horario_atencion': 'horario habitual',
  'direccion': 'nuestra ubicación principal',
  'sitio_web': 'nuestro sitio web',
  
  // Variables de producto
  'producto': 'nuestro producto',
  'servicio': 'nuestro servicio',
  'precio': 'precio especial',
  
  // Variables de contexto
  'motivo_contacto': 'su consulta',
  'consulta': 'su mensaje',
  'respuesta': 'nuestra respuesta',
  
  // Variables comunes de la conversación
  'saludo': '¡Hola!',
  'despedida': '¡Gracias por contactarnos!'
};

/**
 * Reemplaza todas las variables en un texto usando el objeto de estado y valores por defecto
 * 
 * @param text Texto en el que reemplazar las variables
 * @param variables Objeto con las variables a reemplazar
 * @param defaults Valores por defecto adicionales (opcionales)
 * @returns Texto con las variables reemplazadas
 */
export function replaceVariables(
  text: string, 
  variables: Record<string, any> = {}, 
  defaults: Record<string, string> = {}
): string {
  if (!text) return '';
  
  logger.debug(`[variableReplacer] Reemplazando variables en texto: "${text.substring(0, 100)}..."`);
  logger.debug(`[variableReplacer] Variables disponibles:`, Object.keys(variables));
  
  // SOLUCIÓN: Priorizar variables reales sobre defaults
  // Combinar defaults PRIMERO, luego variables reales para que sobrescriban
  const allVariables = { ...DEFAULT_VARIABLES, ...defaults, ...variables };
  
  // Reemplazar todas las variables de la forma {{variable}}
  return text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
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
    
    // SOLUCIÓN: Buscar PRIMERO en variables reales (sistema), luego en defaults
    for (const name of possibleNames) {
      if (variables[name] !== undefined && variables[name] !== null && variables[name] !== '') {
        logger.debug(`[variableReplacer] Variable ${trimmedName} encontrada en variables reales: ${variables[name]}`);
        return String(variables[name]);
      }
    }
    
    // Solo si no está en variables reales, buscar en defaults + adicionales
    for (const name of possibleNames) {
      const defaultValue = defaults[name] || DEFAULT_VARIABLES[name];
      if (defaultValue !== undefined) {
        logger.debug(`[variableReplacer] Variable ${trimmedName} usando valor por defecto: ${defaultValue}`);
        return defaultValue;
      }
    }
    
    // Si no se encuentra en ningún lado, loggeamos y mantenemos la variable
    logger.debug(`[variableReplacer] Variable no encontrada: ${trimmedName}, manteniendo como ${match}`);
    return match; // Mantener sin cambios
  });
}

/**
 * Extrae posibles variables del mensaje del usuario
 * 
 * @param message Mensaje del usuario
 * @returns Objeto con las variables extraídas
 */
export function extractVariablesFromMessage(message: string): Record<string, string> {
  const variables: Record<string, string> = {};
  
  // Extraer nombre
  const nombreMatch = message.match(/(?:me\s+llamo|soy|nombre\s+es)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
  if (nombreMatch && nombreMatch[1]) {
    variables.nombre_usuario = nombreMatch[1];
    variables.nombre = nombreMatch[1];
    variables.user_name = nombreMatch[1];
    logger.info(`Variable extraída - nombre: ${nombreMatch[1]}`);
  }
  
  // Extraer apellido
  const apellidoMatch = message.match(/(?:mi\s+)?apellido\s+(?:es\s+)?([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
  if (apellidoMatch && apellidoMatch[1]) {
    variables.apellido = apellidoMatch[1];
    logger.info(`Variable extraída - apellido: ${apellidoMatch[1]}`);
  }
  
  // Extraer email
  const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
  if (emailMatch && emailMatch[1]) {
    variables.email = emailMatch[1];
    logger.info(`Variable extraída - email: ${emailMatch[1]}`);
  }
  
  // Extraer teléfono
  const telefonoMatch = message.match(/(\+?[0-9]{8,15})/);
  if (telefonoMatch && telefonoMatch[1]) {
    variables.telefono = telefonoMatch[1];
    logger.info(`Variable extraída - teléfono: ${telefonoMatch[1]}`);
  }
  
  // Extraer fecha
  const fechaMatch = message.match(/(?:el|día|fecha)\s+([0-9]{1,2}\s+de\s+[a-zA-Z]+|[0-9]{1,2}\/[0-9]{1,2}(?:\/[0-9]{2,4})?)/i);
  if (fechaMatch && fechaMatch[1]) {
    variables.fecha_cita = fechaMatch[1];
    logger.info(`Variable extraída - fecha: ${fechaMatch[1]}`);
  }
  
  // Extraer hora
  const horaMatch = message.match(/(?:a las|hora)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm|hrs|horas)?)/i);
  if (horaMatch && horaMatch[1]) {
    variables.hora_cita = horaMatch[1];
    logger.info(`Variable extraída - hora: ${horaMatch[1]}`);
  }
  
  return variables;
}

/**
 * Actualiza el objeto de estado con nuevas variables extraídas
 * 
 * @param state Estado de la conversación
 * @param newVariables Variables extraídas
 * @returns Estado actualizado
 */
export function updateStateWithVariables(
  state: Record<string, any>, 
  newVariables: Record<string, string>
): Record<string, any> {
  // Crear el objeto variables si no existe
  if (!state.variables) {
    state.variables = {};
  }
  
  // Combinar las variables existentes con las nuevas
  state.variables = {
    ...state.variables,
    ...newVariables
  };
  
  return state;
}