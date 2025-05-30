#!/usr/bin/env node

/**
 * Test resumido del sales funnel
 */

const API_BASE = 'http://localhost:3090';
const PHONE = `+549119999${Math.floor(Math.random() * 10000)}`;
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const SESSION_ID = `test-${Date.now()}`;

let leadId = null;

async function sendMessage(message) {
  const response = await fetch(`${API_BASE}/api/text/integrated-message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: PHONE,
      tenant_id: TENANT_ID,
      message: message,
      session_id: SESSION_ID,
      template_id: '0654268d-a65a-4e59-83a2-e99d4d393273'
    })
  });

  const data = await response.json();
  return data.data?.message || 'Error';
}

async function checkServerLog() {
  const { execSync } = await import('child_process');
  
  // Buscar el lead ID
  if (!leadId) {
    const leadLog = execSync(`grep -i "Lead creado.*${PHONE}" /Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot/server.log || true`).toString();
    const match = leadLog.match(/ID ([a-f0-9-]+)/);
    if (match) leadId = match[1];
  }
  
  if (!leadId) return null;
  
  // Buscar el último estado
  const stageLog = execSync(`grep -i "movido exitosamente.*${leadId}" /Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot/server.log | tail -1 || true`).toString();
  const stageMatch = stageLog.match(/etapa (\w+)/);
  return stageMatch ? stageMatch[1] : null;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🚀 Test de Sales Funnel');
console.log('📱 Teléfono:', PHONE);
console.log('');

// Esperar servidor
await wait(5000);

// Test flow
console.log('1️⃣ Enviando saludo inicial...');
await sendMessage('hola');
await wait(1000);

let stage = await checkServerLog();
console.log(`   Lead creado: ${leadId || 'No'}`);
console.log(`   Etapa: ${stage || 'desconocida'}`);
console.log('');

console.log('2️⃣ Enviando nombre...');
await sendMessage('Juan Test');
await wait(1000);

stage = await checkServerLog();
console.log(`   Etapa: ${stage || 'desconocida'}`);
console.log(`   ✅ Cambió a prospecting: ${stage === 'prospecting' ? 'Sí' : 'No'}`);
console.log('');

console.log('3️⃣ Enviando email...');
await sendMessage('juan@test.com');
await wait(1000);

console.log('4️⃣ Enviando teléfono...');
await sendMessage('+5491187654321');
await wait(1000);

stage = await checkServerLog();
console.log(`   Etapa final: ${stage || 'desconocida'}`);
console.log(`   ✅ Cambió a qualification: ${stage === 'qualification' ? 'Sí' : 'No'}`);
console.log('');

console.log('🎉 Test completado');
console.log('');

// Resumen
if (leadId) {
  const summary = execSync(`grep -E "movido exitosamente.*${leadId}" /Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot/server.log || true`).toString();
  console.log('📊 Resumen de cambios:');
  summary.split('\n').filter(line => line.trim()).forEach(line => {
    const match = line.match(/etapa (\w+) \(original: (\w+)\)/);
    if (match) {
      console.log(`   ${match[2]} → ${match[1]}`);
    }
  });
}