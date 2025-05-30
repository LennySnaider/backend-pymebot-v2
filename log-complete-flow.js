/**
 * Script para simular el flujo completo y verificar dónde se pierde el salesStageId
 */

import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';

async function simulateCompleteFlow() {
  const BACKEND_URL = 'http://localhost:3090';
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const userId = '08f89f3e-7441-4c99-96e4-745d813b9d09';
  const sessionId = 'd8da389a-2806-4e4d-98c6-92ac88d5ffc3';
  
  try {
    console.log('=== SIMULACIÓN DE FLUJO COMPLETO ===\n');
    
    // Primer mensaje: "hola"
    console.log('1. Enviando primer mensaje: "hola"');
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
    console.log('Respuesta 1:', JSON.stringify(data1, null, 2));
    
    // Verificar si hay salesStageId
    const salesStageId1 = data1.data?.metadata?.salesStageId;
    console.log(`salesStageId en respuesta 1: ${salesStageId1 || 'NO ENCONTRADO'}\n`);
    
    // Segundo mensaje: "Caro" (nombre)
    console.log('2. Enviando segundo mensaje: "Caro"');
    const response2 = await fetch(`${BACKEND_URL}/api/text/chatbot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: "Caro",
        user_id: userId,
        session_id: sessionId,
        tenant_id: tenantId,
        template_id: templateId,
        mode: "auto-flow",
        force_welcome: false
      })
    });
    
    const data2 = await response2.json();
    console.log('Respuesta 2:', JSON.stringify(data2, null, 2));
    
    // Verificar si hay salesStageId
    const salesStageId2 = data2.data?.metadata?.salesStageId;
    console.log(`salesStageId en respuesta 2: ${salesStageId2 || 'NO ENCONTRADO'}\n`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Función para activar logs detallados
async function enableDetailedLogs() {
  console.log('\n=== ACTIVANDO LOGS DETALLADOS ===');
  console.log('Para ver logs detallados, ejecuta el backend con:');
  console.log('DEBUG=* npm run dev');
  console.log('\nO específicamente para sales funnel:');
  console.log('DEBUG=*sales* npm run dev');
}

enableDetailedLogs();
simulateCompleteFlow();