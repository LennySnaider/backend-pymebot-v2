/**
 * Test de progresión de etapas del sales funnel
 */

import fetch from 'node-fetch';

async function testStageProgression() {
  const BACKEND_URL = 'http://localhost:3090';
  const sessionId = 'test-progression-' + Date.now();
  const userId = 'test-user-' + Date.now();
  const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  
  console.log('\n=== TEST DE PROGRESIÓN DE ETAPAS ===\n');
  console.log('SessionId:', sessionId);
  console.log('UserId:', userId);
  
  try {
    // 1. Mensaje inicial - debe estar en "nuevos"
    console.log('\n1. Enviando mensaje inicial: "hola"');
    const response1 = await fetch(`${BACKEND_URL}/api/text/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "hola",
        user_id: userId,
        session_id: sessionId,
        tenant_id: tenantId,
        template_id: templateId,
        mode: "auto-flow",
        force_welcome: true,
        is_first_message: true
      })
    });
    
    const data1 = await response1.json();
    console.log('Respuesta 1 - salesStageId:', data1.data?.metadata?.salesStageId);
    
    // 2. Responder con nombre - debe cambiar a "prospectando"
    console.log('\n2. Enviando nombre: "Carolina"');
    const response2 = await fetch(`${BACKEND_URL}/api/text/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "Carolina",
        user_id: userId,
        session_id: sessionId,
        tenant_id: tenantId,
        template_id: templateId,
        mode: "auto-flow",
        force_welcome: false
      })
    });
    
    const data2 = await response2.json();
    console.log('Respuesta 2 - salesStageId:', data2.data?.metadata?.salesStageId);
    
    // 3. Responder con email - debe mantenerse en "prospectando"
    console.log('\n3. Enviando email: "carolina@test.com"');
    const response3 = await fetch(`${BACKEND_URL}/api/text/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "carolina@test.com",
        user_id: userId,
        session_id: sessionId,
        tenant_id: tenantId,
        template_id: templateId,
        mode: "auto-flow",
        force_welcome: false
      })
    });
    
    const data3 = await response3.json();
    console.log('Respuesta 3 - salesStageId:', data3.data?.metadata?.salesStageId);
    
    // Resumen de progresión
    console.log('\n=== RESUMEN DE PROGRESIÓN ===');
    console.log('Etapa 1:', data1.data?.metadata?.salesStageId || 'NO ENCONTRADO');
    console.log('Etapa 2:', data2.data?.metadata?.salesStageId || 'NO ENCONTRADO');
    console.log('Etapa 3:', data3.data?.metadata?.salesStageId || 'NO ENCONTRADO');
    
    // Verificar progresión correcta
    const stage1 = data1.data?.metadata?.salesStageId;
    const stage2 = data2.data?.metadata?.salesStageId;
    const stage3 = data3.data?.metadata?.salesStageId;
    
    if (stage1 === 'nuevos' && stage2 === 'prospectando' && stage3 === 'prospectando') {
      console.log('\n✅ ÉXITO: La progresión de etapas funciona correctamente');
    } else {
      console.log('\n❌ ERROR: La progresión de etapas no es correcta');
    }
    
  } catch (error) {
    console.error('Error en la prueba:', error);
  }
}

testStageProgression();