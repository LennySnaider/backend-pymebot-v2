/**
 * Test del arreglo del formato de lista
 * Prueba la plantilla TESTE_2025-05-22 con el nuevo formato de lista
 */

import { processFlowMessage } from './src/services/flowRegistry';
import logger from './src/utils/logger';

// Habilitar logs para ver detalles
logger.level = 'info';

async function testListaFix() {
  console.log('=== TEST LISTA FIX ===\n');
  
  const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const templateId = 'lista'; // Template con lista
  const phoneFrom = '+521234567890';
  const sessionId = 'test-lista-' + Date.now();
  
  console.log('Configuración:');
  console.log('- Tenant:', tenantId);
  console.log('- Template:', templateId);
  console.log('- Usuario:', phoneFrom);
  console.log('\n--- Iniciando conversación ---\n');
  
  try {
    // Mensaje 1: Activar flow
    console.log('Usuario: "hola"');
    const response1 = await processFlowMessage(
      phoneFrom,
      'hola',
      tenantId,
      sessionId,
      templateId
    );
    console.log('Bot:', response1?.message || 'Sin respuesta');
    console.log('---');
    
    // Mensaje 2: Responder con nombre
    console.log('Usuario: "Juan"');
    const response2 = await processFlowMessage(
      phoneFrom,
      'Juan',
      tenantId,
      sessionId,
      templateId
    );
    console.log('Bot:', response2?.message || 'Sin respuesta');
    console.log('---');
    
    // Mensaje 3: Probar selección de lista (debería mostrar botones)
    console.log('Usuario: "1"');
    const response3 = await processFlowMessage(
      phoneFrom,
      '1',
      tenantId,
      sessionId,
      templateId
    );
    console.log('Bot:', response3?.message || 'Sin respuesta');
    console.log('---');
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testListaFix();