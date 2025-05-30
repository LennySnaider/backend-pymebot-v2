/**
 * Test rápido para verificar que salesStageId se está propagando
 */

import fetch from 'node-fetch';

async function testSalesStage() {
  const BACKEND_URL = 'http://localhost:3090';
  const sessionId = 'test-session-' + Date.now();
  
  console.log('\n=== TEST DE SALESSTAGE ===\n');
  console.log('SessionId:', sessionId);
  
  try {
    // Mensaje de prueba
    const response = await fetch(`${BACKEND_URL}/api/text/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "hola",
        user_id: "test-user",
        session_id: sessionId,
        tenant_id: "afa60b0a-3046-4607-9c48-266af6e1d322",
        template_id: "0654268d-a65a-4e59-83a2-e99d4d393273",
        mode: "auto-flow",
        force_welcome: true,
        is_first_message: true
      })
    });
    
    const data = await response.json();
    
    console.log('\nRespuesta completa:');
    console.log(JSON.stringify(data, null, 2));
    
    // Verificar salesStageId
    const salesStageId = data.data?.metadata?.salesStageId;
    const contextStage = data.data?.metadata?.context?.currentLeadStage;
    
    console.log('\n=== RESULTADOS ===');
    console.log('salesStageId en metadata:', salesStageId || 'NO ENCONTRADO');
    console.log('currentLeadStage en context:', contextStage || 'NO ENCONTRADO');
    
    if (salesStageId || contextStage) {
      console.log('\n✅ ÉXITO: Se encontró el salesStageId');
    } else {
      console.log('\n❌ ERROR: No se encontró salesStageId en la respuesta');
    }
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testSalesStage();