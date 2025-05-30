/**
 * Test directo del endpoint de actualización de stage
 */

import fetch from 'node-fetch';

async function testUpdateStage() {
  const leadId = '08f89f3e-7441-4c99-96e4-745d813b9d09'; // Carolina López
  const newStage = 'prospecting';
  
  console.log(`\n=== TEST DE ACTUALIZACIÓN DE ETAPA ===`);
  console.log(`Lead ID: ${leadId}`);
  console.log(`Nueva etapa: ${newStage}`);
  
  try {
    // Test del endpoint update-stage del chatStore
    const response = await fetch('http://localhost:3000/api/leads/update-stage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leadId: leadId,
        newStage: newStage,
        fromChatbot: true
      })
    });
    
    const data = await response.json();
    
    console.log('\nRespuesta del endpoint:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Actualización exitosa');
    } else {
      console.log('\n❌ Error en la actualización');
    }
    
  } catch (error) {
    console.error('Error en el test:', error);
  }
}

// También probar con el endpoint alternativo con fallback
async function testUpdateStageWithFallback() {
  const leadId = '08f89f3e-7441-4c99-96e4-745d813b9d09'; // Carolina López
  const newStage = 'prospecting';
  
  console.log(`\n=== TEST DE ACTUALIZACIÓN CON FALLBACK ===`);
  
  try {
    const response = await fetch('http://localhost:3000/api/leads/update-stage-with-fallback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        leadId: leadId,
        newStage: newStage,
        leadData: {
          name: 'Carolina López',
          stage: newStage
        }
      })
    });
    
    const data = await response.json();
    
    console.log('\nRespuesta del endpoint con fallback:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error en el test con fallback:', error);
  }
}

async function runTests() {
  await testUpdateStage();
  await testUpdateStageWithFallback();
}

runTests();