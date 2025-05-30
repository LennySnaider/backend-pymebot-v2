#!/usr/bin/env node

const { addKeyword, createFlow } = require('@builderbot/bot');

console.log('🧪 [TEST KEYWORDS] Probando keywords directamente...');

// Test 1: Keywords simples
const simpleFlow = addKeyword(['hola'])
  .addAction(async (ctx, { state }) => {
    console.log('🎯 [TEST KEYWORDS] ¡Keyword "hola" detectado!');
  })
  .addAnswer('Respuesta simple para hola');

// Test 2: Keywords múltiples como el interceptado
const multipleFlow = addKeyword(['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START', 'pymebot v1 - agendamiento completo', 'PYMEBOT V1 - AGENDAMIENTO COMPLETO'])
  .addAction(async (ctx, { state }) => {
    console.log('🎯 [TEST KEYWORDS] ¡Keywords múltiples detectados!');
  })
  .addAnswer('Respuesta múltiple para keywords');

console.log('🧪 [TEST KEYWORDS] Creando flujos...');
const simpleBuilt = createFlow([simpleFlow]);
const multipleBuilt = createFlow([multipleFlow]);

console.log('🧪 [TEST KEYWORDS] Flujos creados:');
console.log('Simple - flowRaw:', typeof simpleBuilt.flowRaw);
console.log('Multiple - flowRaw:', typeof multipleBuilt.flowRaw);

// Verificar estructura interna
console.log('🧪 [TEST KEYWORDS] Keywords en simple:', simpleFlow.keyword);
console.log('🧪 [TEST KEYWORDS] Keywords en multiple:', multipleFlow.keyword);

console.log('🧪 [TEST KEYWORDS] Test completado');