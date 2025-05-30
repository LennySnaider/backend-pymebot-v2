/**
 * Test simple para verificar la conversión de plantilla con lista
 */

import { convertTemplateToBuilderbotFlow } from './src/services/templateConverter.js';

async function testSimple() {
  console.log('=== TEST SIMPLE LISTA ===');
  
  try {
    const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
    const templateId = 'lista';
    
    console.log('Intentando convertir plantilla:', templateId);
    
    const flow = await convertTemplateToBuilderbotFlow(templateId, tenantId);
    console.log('✅ Conversión exitosa');
    console.log('Flow creado:', flow ? 'Sí' : 'No');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimple();