#!/usr/bin/env node

/**
 * Script para probar la integración del sales funnel
 */

const API_BASE = 'http://localhost:3090';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer test-token'
};

// Usar lead_test1 como identificador
const PHONE_NUMBER = 'lead_test1';
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const TEMPLATE_ID = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';
const SESSION_ID = 'test-session-' + Date.now();
const LEAD_ID = 'test1';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(message) {
  try {
    const response = await fetch(`${API_BASE}/api/text/integrated-message`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        user_id: PHONE_NUMBER,
        tenant_id: TENANT_ID,
        message: message,
        session_id: SESSION_ID,
        template_id: TEMPLATE_ID,
        leadId: LEAD_ID
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error en respuesta: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    console.log('Respuesta:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    return null;
  }
}

async function checkLeadStage() {
  try {
    // Usar el endpoint de supabase directamente
    const response = await fetch(`${API_BASE}/api/supabase/leads/${LEAD_ID}?tenant_id=${TENANT_ID}`, {
      method: 'GET',
      headers: HEADERS
    });

    if (!response.ok) {
      console.error(`Error al obtener información del lead: ${response.status}`);
      return null;
    }

    const lead = await response.json();
    console.log('Estado actual del lead:', lead.sales_funnel_stage);
    return lead.sales_funnel_stage;
  } catch (error) {
    console.error('Error al verificar el estado del lead:', error);
    return null;
  }
}

async function testSalesFunnelFlow() {
  console.log('=== Prueba de Sales Funnel ===');
  console.log('Usando template: Flujo basico lead');
  console.log('Lead ID:', LEAD_ID);
  console.log('');

  // Paso 1: Verificar estado inicial
  console.log('1. Verificando estado inicial del lead...');
  let stage = await checkLeadStage();
  console.log(`Estado inicial: ${stage || 'no configurado'}`);
  console.log('');

  // Paso 2: Enviar mensaje inicial
  console.log('2. Enviando mensaje inicial...');
  await sendMessage('hola');
  await sleep(2000);

  // Paso 3: Verificar si cambió a "prospecting"
  console.log('3. Verificando cambio a "prospecting"...');
  stage = await checkLeadStage();
  console.log(`Estado después de saludo: ${stage}`);
  
  if (stage !== 'prospecting') {
    console.error('❌ ERROR: El lead no cambió a "prospecting"');
  } else {
    console.log('✅ Éxito: Lead cambió a "prospecting"');
  }
  console.log('');

  // Paso 4: Ingresar nombre
  console.log('4. Ingresando nombre...');
  await sendMessage('Juan Pérez');
  await sleep(2000);

  // Paso 5: Verificar cambio a "qualification"
  console.log('5. Verificando cambio a "qualification"...');
  stage = await checkLeadStage();
  console.log(`Estado después de nombre: ${stage}`);
  
  if (stage !== 'qualification') {
    console.error('❌ ERROR: El lead no cambió a "qualification"');
  } else {
    console.log('✅ Éxito: Lead cambió a "qualification"');
  }
  console.log('');

  // Paso 6: Ingresar empresa  
  console.log('6. Ingresando empresa...');
  await sendMessage('Mi Empresa SA');
  await sleep(2000);

  // Paso 7: Verificar cambio a "opportunity"
  console.log('7. Verificando cambio a "opportunity"...');
  stage = await checkLeadStage();
  console.log(`Estado después de empresa: ${stage}`);
  
  if (stage !== 'opportunity') {
    console.error('❌ ERROR: El lead no cambió a "opportunity"');
  } else {
    console.log('✅ Éxito: Lead cambió a "opportunity"');
  }

  console.log('\n=== Prueba completada ===');
}

// Ejecutar la prueba
testSalesFunnelFlow().catch(console.error);