/**
 * src/utils/compositeTester.ts
 * 
 * Utilidad para probar y demostrar el reemplazo de variables en mensajes compuestos.
 * Esta herramienta ayuda a verificar que las variables se reemplacen correctamente en
 * todos los componentes de un mensaje (texto, medios, botones, listas, etc.).
 * 
 * @version 1.0.0
 * @created 2025-05-14
 */

import { CompositeMessage, processCompositeMessage } from './compositeMessageProcessor';
import logger from './logger';
import { getTenantSystemVariables } from './systemVariablesLoader';

/**
 * Prueba el reemplazo de variables en un mensaje compuesto
 * 
 * @param message Mensaje compuesto a probar
 * @param variables Variables adicionales para el reemplazo
 * @param tenantId ID del tenant
 * @returns El mensaje procesado
 */
export async function testCompositeMessage(
  message: CompositeMessage,
  variables: Record<string, any> = {},
  tenantId: string = 'default'
): Promise<CompositeMessage> {
  try {
    // Obtenemos las variables del sistema para el tenant
    const systemVariables = await getTenantSystemVariables(tenantId);
    
    // Combinamos las variables del sistema con las proporcionadas
    const allVariables = {
      ...systemVariables,
      ...variables
    };
    
    // Procesamos el mensaje compuesto
    const processedMessage = await processCompositeMessage(message, allVariables, tenantId);
    
    // Mostramos la información antes y después
    logger.info('===== PRUEBA DE REEMPLAZO DE VARIABLES EN MENSAJE COMPUESTO =====');
    logger.info('Mensaje original:');
    logger.info(JSON.stringify(message, null, 2));
    logger.info('');
    logger.info('Mensaje procesado:');
    logger.info(JSON.stringify(processedMessage, null, 2));
    logger.info('');
    
    // Evaluamos si hay variables sin reemplazar
    const hasUnreplacedVariables = checkForUnreplacedVariables(processedMessage);
    
    if (hasUnreplacedVariables) {
      logger.warn('⚠️ Se detectaron variables sin reemplazar en el mensaje procesado');
    } else {
      logger.info('✅ Todas las variables fueron reemplazadas correctamente');
    }
    
    return processedMessage;
  } catch (error) {
    logger.error(`Error al probar mensaje compuesto: ${error}`);
    throw error;
  }
}

/**
 * Verifica si hay variables sin reemplazar en el mensaje procesado
 */
function checkForUnreplacedVariables(message: CompositeMessage): boolean {
  // Expresión regular para detectar variables (formatos {{var}} y {var})
  const variableRegex = /\{\{[^}]+\}\}|\{[^{}]+\}/g;
  
  // Verificar texto principal
  const textHasVariables = variableRegex.test(message.text);
  
  // Verificar medios
  let mediaHasVariables = false;
  if (message.media) {
    if (typeof message.media === 'string') {
      mediaHasVariables = variableRegex.test(message.media);
    } else {
      mediaHasVariables = 
        variableRegex.test(message.media.url) ||
        (message.media.caption ? variableRegex.test(message.media.caption) : false) ||
        (message.media.filename ? variableRegex.test(message.media.filename) : false);
    }
  }
  
  // Verificar botones
  let buttonsHaveVariables = false;
  if (message.buttons && message.buttons.length > 0) {
    buttonsHaveVariables = message.buttons.some(button => 
      variableRegex.test(button.text) || 
      (button.value ? variableRegex.test(button.value) : false) ||
      (button.url ? variableRegex.test(button.url) : false)
    );
  }
  
  // Verificar lista
  let listHasVariables = false;
  if (message.list) {
    listHasVariables = 
      (message.list.title ? variableRegex.test(message.list.title) : false) ||
      (message.list.buttonText ? variableRegex.test(message.list.buttonText) : false) ||
      (message.list.items ? message.list.items.some(item => 
        variableRegex.test(item.text) || 
        (item.description ? variableRegex.test(item.description) : false) ||
        (item.value ? variableRegex.test(item.value) : false)
      ) : false);
  }
  
  return textHasVariables || mediaHasVariables || buttonsHaveVariables || listHasVariables;
}

/**
 * Crea ejemplos de mensajes compuestos para pruebas
 */
export function createExampleMessages(): Record<string, CompositeMessage> {
  return {
    textOnly: {
      text: 'Hola {{nombre_usuario}}, bienvenido a {{nombre_negocio}}.',
      type: 'text'
    },
    textWithMedia: {
      text: 'Hola {{nombre_usuario}}, aquí está tu documento.',
      media: {
        url: '{{documento_url}}',
        type: 'document',
        caption: 'Documento para {{nombre_usuario}}'
      },
      type: 'composite'
    },
    textWithButtons: {
      text: '{{nombre_usuario}}, ¿te gustaría agendar una cita para el {{fecha_cita}}?',
      buttons: [
        { text: 'Sí, confirmar para el {{fecha_cita}}', value: 'agendar_{{fecha_cita}}' },
        { text: 'No, gracias', value: 'rechazar' }
      ],
      type: 'buttons'
    },
    textWithList: {
      text: 'Estos son los servicios disponibles para {{nombre_usuario}}:',
      list: {
        title: 'Servicios de {{nombre_negocio}}',
        buttonText: 'Ver servicios',
        items: [
          { text: 'Asesoría ({{precio_asesoria}})', value: 'asesoria', handle: 'handle-0' },
          { text: 'Consultoría ({{precio_consultoria}})', value: 'consultoria', handle: 'handle-1' },
          { text: 'Acompañamiento ({{precio_acompanamiento}})', value: 'acompanamiento', handle: 'handle-2' }
        ]
      },
      type: 'list'
    },
    complexMessage: {
      text: 'Hola {{nombre_usuario}}, te mostramos la propiedad {{propiedad_codigo}}:',
      media: {
        url: 'https://example.com/properties/{{propiedad_codigo}}.jpg',
        type: 'image',
        caption: '{{propiedad_nombre}} - {{propiedad_ubicacion}}'
      },
      buttons: [
        { text: 'Ver más fotos', value: 'fotos_{{propiedad_codigo}}' },
        { text: 'Solicitar visita para el {{fecha_disponible}}', value: 'visita_{{propiedad_codigo}}' },
        { text: 'Contactar a {{agente_nombre}}', value: 'contactar_agente' }
      ],
      type: 'composite'
    }
  };
}

/**
 * Variables de ejemplo para pruebas
 */
export function getExampleVariables(): Record<string, any> {
  return {
    nombre_usuario: 'Juan Pérez',
    email_usuario: 'juan@example.com',
    telefono_usuario: '555-123-4567',
    nombre_negocio: 'Inmobiliaria AgentProp',
    fecha_cita: '15 de mayo de 2025',
    hora_cita: '14:30',
    documento_url: 'https://example.com/docs/contrato-template.pdf',
    precio_asesoria: '$50',
    precio_consultoria: '$100',
    precio_acompanamiento: '$150',
    propiedad_codigo: 'PROP-12345',
    propiedad_nombre: 'Apartamento Sunset Bay',
    propiedad_ubicacion: 'Avda. del Mar 123',
    fecha_disponible: '20 de mayo de 2025',
    agente_nombre: 'María González'
  };
}

/**
 * Ejecuta todas las pruebas y devuelve resultados
 */
export async function runAllTests(tenantId: string = 'default'): Promise<Record<string, CompositeMessage>> {
  const examples = createExampleMessages();
  const variables = getExampleVariables();
  const results: Record<string, CompositeMessage> = {};
  
  logger.info('Ejecutando todas las pruebas de reemplazo de variables...\n');
  
  for (const [name, message] of Object.entries(examples)) {
    try {
      logger.info(`\n----- PRUEBA: ${name} -----`);
      results[name] = await testCompositeMessage(message, variables, tenantId);
    } catch (error) {
      logger.error(`Error en prueba ${name}: ${error}`);
      results[name] = message; // En caso de error, guardamos el mensaje original
    }
  }
  
  logger.info('\nPruebas completadas.');
  return results;
}

export default {
  testCompositeMessage,
  createExampleMessages,
  getExampleVariables,
  runAllTests
};