#!/usr/bin/env node

const { spawn } = require('child_process');
const fetch = require('node-fetch');

console.log('🔄 [TEST OFFLINE API] Probando API con flujo offline...');

// Función para esperar un poco
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAPI() {
  try {
    console.log('🔄 [TEST OFFLINE API] Enviando mensaje de prueba...');
    
    const response = await fetch('http://localhost:3090/api/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'hola',
        userId: 'test-offline-user',
        tenantId: 'afa60b0a-3046-4607-9c48-266af6e1d322',
        session_id: 'test-offline-session'
      })
    });
    
    const result = await response.json();
    
    console.log('✅ [TEST OFFLINE API] Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.response && result.response !== 'Lo siento, no pude procesar tu mensaje correctamente...') {
      console.log('✅ [TEST OFFLINE API] El flujo offline está funcionando!');
    } else {
      console.log('❌ [TEST OFFLINE API] El flujo offline no está respondiendo correctamente');
    }
    
  } catch (error) {
    console.error('❌ [TEST OFFLINE API] Error:', error.message);
  }
}

// Ejecutar test
testAPI();