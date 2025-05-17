/**
 * src/tests/compositeMessageVariables.test.ts
 * 
 * Prueba para verificar el reemplazo correcto de variables en mensajes compuestos.
 * 
 * @version 1.0.0
 * @created 2025-05-14
 */

import { processCompositeMessage, CompositeMessage } from '../utils/compositeMessageProcessor';

// Simulación básica del entorno para pruebas independientes
async function main() {
  console.log('Iniciando pruebas de reemplazo de variables en mensajes compuestos...\n');

  // Variables simuladas para las pruebas
  const variables = {
    nombre_usuario: 'Juan Pérez',
    email: 'juan@example.com',
    telefono: '555-123-4567',
    fecha_cita: '15 de mayo de 2025',
    hora_cita: '14:30',
    nombre_negocio: 'AgentProp Inmobiliaria',
    imagen_perfil: 'https://example.com/imgs/juan-perez.jpg',
    documento_url: 'https://example.com/docs/contrato-{{nombre_usuario}}.pdf',
    propiedad_referencia: 'PROP-12345',
    precio: '$150,000',
    ubicacion: 'Avda. Principal 123',
    area: '120m²',
    habitaciones: '3',
    baños: '2',
    estacionamientos: '1',
    descripcion: 'Hermoso apartamento con vista al mar'
  };

  // Tenantid simulado
  const tenantId = 'tenant-test-001';

  console.log('1. Prueba de mensaje de texto simple con variables:');
  const textMessage: CompositeMessage = {
    text: 'Hola {{nombre_usuario}}, bienvenido a {{nombre_negocio}}. Tu cita está programada para el {{fecha_cita}} a las {{hora_cita}}.',
    type: 'text'
  };

  try {
    const processedTextMessage = await processCompositeMessage(textMessage, variables, tenantId);
    console.log('Original:', textMessage.text);
    console.log('Procesado:', processedTextMessage.text);
    console.log('Resultado:', processedTextMessage.text.includes('Juan Pérez') ? '✅ CORRECTO' : '❌ ERROR');
    console.log('');
  } catch (error) {
    console.error('Error en prueba 1:', error);
  }

  console.log('2. Prueba de mensaje con imagen y variables en el texto y URL:');
  const mediaMessage: CompositeMessage = {
    text: 'Hola {{nombre_usuario}}, aquí está tu perfil.',
    media: {
      url: '{{imagen_perfil}}',
      type: 'image',
      caption: 'Foto de perfil de {{nombre_usuario}}'
    },
    type: 'composite'
  };

  try {
    const processedMediaMessage = await processCompositeMessage(mediaMessage, variables, tenantId);
    console.log('Original - Texto:', mediaMessage.text);
    console.log('Original - URL:', typeof mediaMessage.media === 'object' ? mediaMessage.media.url : mediaMessage.media);
    console.log('Original - Caption:', typeof mediaMessage.media === 'object' ? mediaMessage.media.caption : 'N/A');
    
    console.log('Procesado - Texto:', processedMediaMessage.text);
    console.log('Procesado - URL:', typeof processedMediaMessage.media === 'object' ? processedMediaMessage.media.url : processedMediaMessage.media);
    console.log('Procesado - Caption:', typeof processedMediaMessage.media === 'object' ? processedMediaMessage.media.caption : 'N/A');
    
    const urlCorrect = typeof processedMediaMessage.media === 'object' && 
                      processedMediaMessage.media.url === 'https://example.com/imgs/juan-perez.jpg';
    const captionCorrect = typeof processedMediaMessage.media === 'object' && 
                          processedMediaMessage.media.caption?.includes('Juan Pérez');
    
    console.log('Resultado URL:', urlCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('Resultado Caption:', captionCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('');
  } catch (error) {
    console.error('Error en prueba 2:', error);
  }

  console.log('3. Prueba de mensaje con documento y variables recursivas en URL:');
  const documentMessage: CompositeMessage = {
    text: 'Aquí está tu contrato, {{nombre_usuario}}.',
    media: {
      url: '{{documento_url}}',
      type: 'document',
      filename: 'Contrato-{{nombre_usuario}}.pdf'
    },
    type: 'composite'
  };

  try {
    const processedDocMessage = await processCompositeMessage(documentMessage, variables, tenantId);
    console.log('Original - URL:', typeof documentMessage.media === 'object' ? documentMessage.media.url : documentMessage.media);
    console.log('Procesado - URL:', typeof processedDocMessage.media === 'object' ? processedDocMessage.media.url : processedDocMessage.media);
    
    // Verificar que la variable dentro de la URL también fue procesada
    const correctUrl = typeof processedDocMessage.media === 'object' && 
                       processedDocMessage.media.url === 'https://example.com/docs/contrato-Juan Pérez.pdf';
    
    console.log('Resultado URL con variable anidada:', correctUrl ? '✅ CORRECTO' : '❌ ERROR');
    console.log('');
  } catch (error) {
    console.error('Error en prueba 3:', error);
  }

  console.log('4. Prueba de mensaje con botones y variables:');
  const buttonMessage: CompositeMessage = {
    text: '{{nombre_usuario}}, ¿te gustaría programar una visita a la propiedad?',
    buttons: [
      { text: 'Sí, programar visita para el {{fecha_cita}}', value: 'programar_visita' },
      { text: 'No, gracias', value: 'rechazar' },
      { text: 'Más información sobre {{propiedad_referencia}}', value: 'info_{{propiedad_referencia}}' }
    ],
    type: 'buttons'
  };

  try {
    const processedButtonMessage = await processCompositeMessage(buttonMessage, variables, tenantId);
    console.log('Original - Botón 1:', buttonMessage.buttons?.[0].text);
    console.log('Original - Botón 3 value:', buttonMessage.buttons?.[2].value);
    
    console.log('Procesado - Botón 1:', processedButtonMessage.buttons?.[0].text);
    console.log('Procesado - Botón 3 value:', processedButtonMessage.buttons?.[2].value);
    
    const button1Correct = processedButtonMessage.buttons?.[0].text.includes('15 de mayo de 2025');
    const button3ValueCorrect = processedButtonMessage.buttons?.[2].value === 'info_PROP-12345';
    
    console.log('Resultado Botón 1:', button1Correct ? '✅ CORRECTO' : '❌ ERROR');
    console.log('Resultado Botón 3 Value:', button3ValueCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('');
  } catch (error) {
    console.error('Error en prueba 4:', error);
  }

  console.log('5. Prueba de mensaje con lista y variables:');
  const listMessage: CompositeMessage = {
    text: 'Detalles de la propiedad {{propiedad_referencia}}:',
    list: {
      title: 'Propiedad en {{ubicacion}}',
      buttonText: 'Ver detalles',
      items: [
        { text: 'Precio: {{precio}}', value: 'precio' },
        { text: 'Área: {{area}}', value: 'area' },
        { text: 'Habitaciones: {{habitaciones}}', value: 'habitaciones' },
        { text: 'Baños: {{baños}}', value: 'baños' },
        { text: 'Estacionamientos: {{estacionamientos}}', value: 'estacionamientos' }
      ]
    },
    type: 'list'
  };

  try {
    const processedListMessage = await processCompositeMessage(listMessage, variables, tenantId);
    console.log('Original - Título:', listMessage.list?.title);
    console.log('Original - Item 1:', listMessage.list?.items[0].text);
    
    console.log('Procesado - Título:', processedListMessage.list?.title);
    console.log('Procesado - Item 1:', processedListMessage.list?.items[0].text);
    
    const titleCorrect = processedListMessage.list?.title === 'Propiedad en Avda. Principal 123';
    const itemCorrect = processedListMessage.list?.items[0].text === 'Precio: $150,000';
    
    console.log('Resultado Título:', titleCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('Resultado Item 1:', itemCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('');
  } catch (error) {
    console.error('Error en prueba 5:', error);
  }

  console.log('6. Prueba de mensaje compuesto complejo con múltiples componentes:');
  const complexMessage: CompositeMessage = {
    text: '¡Hola {{nombre_usuario}}! Encontramos una propiedad que podría interesarte.',
    media: {
      url: 'https://example.com/properties/{{propiedad_referencia}}.jpg',
      type: 'image',
      caption: 'Propiedad {{propiedad_referencia}} - {{descripcion}}'
    },
    buttons: [
      { text: 'Ver más fotos', value: 'fotos_{{propiedad_referencia}}' },
      { text: 'Agendar visita para el {{fecha_cita}}', value: 'visita' },
      { text: 'Contactar asesor', value: 'asesor' }
    ],
    type: 'composite'
  };

  try {
    const processedComplexMessage = await processCompositeMessage(complexMessage, variables, tenantId);
    console.log('Original - Texto:', complexMessage.text);
    console.log('Original - URL:', typeof complexMessage.media === 'object' ? complexMessage.media.url : complexMessage.media);
    console.log('Original - Botón 2:', complexMessage.buttons?.[1].text);
    
    console.log('Procesado - Texto:', processedComplexMessage.text);
    console.log('Procesado - URL:', typeof processedComplexMessage.media === 'object' ? processedComplexMessage.media.url : processedComplexMessage.media);
    console.log('Procesado - Botón 2:', processedComplexMessage.buttons?.[1].text);
    
    const textCorrect = processedComplexMessage.text.includes('Juan Pérez');
    const urlCorrect = typeof processedComplexMessage.media === 'object' && 
                      processedComplexMessage.media.url.includes('PROP-12345');
    const buttonCorrect = processedComplexMessage.buttons?.[1].text.includes('15 de mayo de 2025');
    
    console.log('Resultado Texto:', textCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('Resultado URL:', urlCorrect ? '✅ CORRECTO' : '❌ ERROR');
    console.log('Resultado Botón 2:', buttonCorrect ? '✅ CORRECTO' : '❌ ERROR');
  } catch (error) {
    console.error('Error en prueba 6:', error);
  }

  console.log('\nPruebas completadas.');
}

// Ejecutar las pruebas
main().catch(error => {
  console.error('Error en las pruebas:', error);
});

export {};