#!/usr/bin/env node

/**
 * Test completo de sales funnel
 */

const API_BASE = 'http://localhost:3090';
const HEADERS = {
  'Content-Type': 'application/json'
};

const PHONE = `+549119999${Math.floor(Math.random() * 10000)}`; // Random phone
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const SESSION_ID = `test-${Date.now()}`;

async function sendMessage(message) {
  const response = await fetch(`${API_BASE}/api/text/integrated-message`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      user_id: PHONE,
      tenant_id: TENANT_ID,
      message: message,
      session_id: SESSION_ID,
      template_id: '0654268d-a65a-4e59-83a2-e99d4d393273'
    })
  });

  const data = await response.json();
  console.log(`\n> Usuario: ${message}`);
  console.log(`< Bot: ${data.data?.message || 'Error'}`);
  return data;
}

async function getLeadInfo() {
  // Primero obtenemos los logs del servidor
  const { spawn } = await import('child_process');
  const grep = spawn('grep', ['-i', 'lead.*' + PHONE.slice(-4), '/Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot/server.log']);
  
  return new Promise((resolve) => {
    let output = '';
    grep.stdout.on('data', (data) => {
      output += data;
    });
    
    grep.on('close', () => {
      // Buscar lead ID en los logs
      const leadIdMatch = output.match(/Lead (creado|asociado).*ID ([a-f0-9-]+)/i);
      if (leadIdMatch) {
        const leadId = leadIdMatch[2];
        
        // Buscar información de stages
        const stageMatches = output.match(/stage[^:]*: *(\w+)/gi);
        const lastStage = stageMatches ? stageMatches[stageMatches.length - 1].split(':')[1].trim() : null;
        
        resolve({ leadId, stage: lastStage });
      } else {
        resolve(null);
      }
    });
  });
}

// Esperar a que el servidor esté listo
console.log('Esperando que el servidor esté listo...');
await new Promise(resolve => setTimeout(resolve, 5000));

console.log('=== Test Sales Funnel ===');
console.log(`Teléfono: ${PHONE}`);
console.log(`Session: ${SESSION_ID}`);

// Paso 1: Mensaje inicial
await sendMessage('hola');
await new Promise(r => setTimeout(r, 1000));

// Verificar lead
let leadInfo = await getLeadInfo();
console.log(`\nLead creado: ${leadInfo?.leadId || 'No encontrado'}`);
console.log(`Estado actual: ${leadInfo?.stage || 'Desconocido'}\n`);

// Paso 2: Nombre
await sendMessage('Juan Test');
await new Promise(r => setTimeout(r, 1000));

// Paso 3: Email
await sendMessage('juan@test.com');
await new Promise(r => setTimeout(r, 1000));

// Paso 4: Teléfono
await sendMessage('+5491187654321');
await new Promise(r => setTimeout(r, 1000));

// Verificar cambios
leadInfo = await getLeadInfo();
console.log(`\nEstado final: ${leadInfo?.stage || 'Desconocido'}`);

// Revisar logs de sales funnel
console.log('\n=== Logs de Sales Funnel ===');
const salesLogs = spawn('grep', ['-E', 'SALES FUNNEL.*' + PHONE.slice(-4) + '|stage.*' + PHONE.slice(-4), '/Users/masi/Documents/chatbot-builderbot-supabase/v2-backend-pymebot/server.log']);

salesLogs.stdout.on('data', (data) => {
  console.log(data.toString());
});

await new Promise(r => setTimeout(r, 2000));
console.log('\n=== Fin del test ===');