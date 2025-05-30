#!/usr/bin/env node

/**
 * Script para probar la integración del sales funnel con lead creation
 */

const API_BASE = 'http://localhost:3090';
const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer test-token'
};

// Usar número de teléfono válido
const PHONE_NUMBER = '+5491123456789';
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const TEMPLATE_ID = '0654268d-a65a-4e59-83a2-e99d4d393273';
const SESSION_ID = 'test-session-' + Date.now();

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
        template_id: TEMPLATE_ID
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
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = 'https://yiggxpihbkpxsjlabzwj.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2d4cGloYmtweHNqbGFiendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0ODA5MTAsImV4cCI6MjAzMzA1NjkxMH0.mJiA3c_u4nG-aVs6WCvGGpTaaTGH1wp5v3qcAkPKcGQ';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Buscar lead por teléfono
    const { data, error } = await supabase
      .from('leads')
      .select('id, stage, phone, full_name')
      .eq('tenant_id', TENANT_ID)
      .or(`phone.eq.${PHONE_NUMBER},phone.eq.${PHONE_NUMBER.replace(/\D/g, '')}`)
      .single();
    
    if (error) {
      console.error('Error al buscar lead:', error);
      return null;
    }
    
    console.log(`Lead encontrado: ${data.id}`);
    console.log(`Estado actual: ${data.stage}`);
    return data;
  } catch (error) {
    console.error('Error al verificar el estado del lead:', error);
    return null;
  }
}

async function testSalesFunnelFlow() {
  console.log('=== Prueba de Sales Funnel ===');
  console.log('Usando template activa del tenant');
  console.log('Teléfono:', PHONE_NUMBER);
  console.log('');

  // Paso 1: Enviar mensaje inicial para crear lead
  console.log('1. Enviando mensaje inicial para crear lead...');
  await sendMessage('hola');
  await sleep(3000);

  // Paso 2: Verificar estado inicial
  console.log('2. Verificando estado inicial del lead...');
  let lead = await checkLeadStage();
  if (!lead) {
    console.error('❌ Error: No se creó el lead');
    return;
  }
  console.log(`Estado inicial: ${lead.stage}`);
  
  if (lead.stage !== 'new' && lead.stage !== 'nuevos') {
    console.error(`❌ ERROR: El lead no está en estado inicial, está en: ${lead.stage}`);
  } else {
    console.log('✅ Lead creado correctamente en estado inicial');
  }
  console.log('');

  // Paso 3: Ingresar nombre
  console.log('3. Ingresando nombre para cambiar a prospecting...');
  await sendMessage('Juan Pérez');
  await sleep(3000);

  // Paso 4: Verificar cambio a "prospecting"
  console.log('4. Verificando cambio a "prospecting"...');
  lead = await checkLeadStage();
  console.log(`Estado después de nombre: ${lead.stage}`);
  
  if (lead.stage !== 'prospecting' && lead.stage !== 'prospectando') {
    console.error(`❌ ERROR: El lead no cambió a "prospecting", está en: ${lead.stage}`);
  } else {
    console.log('✅ Éxito: Lead cambió a "prospecting"');
  }
  console.log('');

  // Paso 5: Ingresar email
  console.log('5. Ingresando email...');
  await sendMessage('juan@email.com');
  await sleep(3000);

  // Paso 6: Ingresar teléfono
  console.log('6. Ingresando teléfono...');  
  await sendMessage('+5491198765432');
  await sleep(3000);

  // Paso 7: Verificar que esté en calificación
  console.log('7. Verificando cambio a "qualification"...');
  lead = await checkLeadStage();
  console.log(`Estado después del flujo de contacto: ${lead.stage}`);
  
  if (lead.stage !== 'qualification' && lead.stage !== 'calificacion') {
    console.error(`❌ ERROR: El lead no cambió a "qualification", está en: ${lead.stage}`);
  } else {
    console.log('✅ Éxito: Lead cambió a "qualification"');
  }

  console.log('\n=== Prueba completada ===');
}

// Ejecutar la prueba
testSalesFunnelFlow().catch(console.error);