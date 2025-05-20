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
const TEMPLATE_ID = '0654268d-a65a-4e59-83a2-e99d4d393273'; // Template activa real
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
    // Acceso directo a la base de datos ya que el endpoint no existe
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = 'https://yiggxpihbkpxsjlabzwj.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2d4cGloYmtweHNqbGFiendqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzQ4MDkxMCwiZXhwIjoyMDMzMDU2OTEwfQ.qJW4lmk-EQiAhN7prHBsEQ95UtxK9XrImh92Ns_CHfU';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Buscar lead directamente
    const { data, error } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', LEAD_ID)
      .eq('tenant_id', TENANT_ID)
      .single();
    
    if (error) {
      console.error('Error al buscar lead:', error);
      
      // Si no existe, intentar buscar por teléfono
      const { data: phoneLeads, error: phoneError } = await supabase
        .from('leads')
        .select('id, stage, phone')
        .eq('tenant_id', TENANT_ID)
        .eq('phone', PHONE_NUMBER)
        .limit(1);
      
      if (phoneError || !phoneLeads?.length) {
        console.error('No se encontró lead por teléfono');
        return null;
      }
      
      console.log('Lead encontrado por teléfono:', phoneLeads[0]);
      return phoneLeads[0].stage;
    }
    
    console.log('Estado actual del lead:', data.stage);
    return data.stage;
  } catch (error) {
    console.error('Error al verificar el estado del lead:', error);
    return null;
  }
}

async function createTestLead() {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = 'https://yiggxpihbkpxsjlabzwj.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2d4cGloYmtweHNqbGFiendqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzQ4MDkxMCwiZXhwIjoyMDMzMDU2OTEwfQ.qJW4lmk-EQiAhN7prHBsEQ95UtxK9XrImh92Ns_CHfU';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Crear lead de prueba
    const { data, error } = await supabase
      .from('leads')
      .insert({
        id: LEAD_ID,
        phone: PHONE_NUMBER,
        tenant_id: TENANT_ID,
        stage: 'new',
        source: 'chatbot_test',
        full_name: 'Test Lead',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Duplicate key
        console.log('Lead ya existe');
        return true;
      }
      console.error('Error al crear lead:', error);
      return false;
    }
    
    console.log('Lead creado:', data);
    return true;
  } catch (error) {
    console.error('Error al crear lead de prueba:', error);
    return false;
  }
}

async function testSalesFunnelFlow() {
  console.log('=== Prueba de Sales Funnel ===');
  console.log('Usando template activa del tenant');
  console.log('Lead ID:', LEAD_ID);
  console.log('');

  // Paso 0: Crear lead de prueba si no existe
  console.log('0. Creando lead de prueba...');
  await createTestLead();
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