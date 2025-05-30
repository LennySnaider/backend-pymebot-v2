#!/usr/bin/env node

const { addKeyword, createFlow } = require('@builderbot/bot');

console.log('🧪 [TEST SIMPLE] Probando BuilderBot básico...');

// Crear flujo simple para test
const simpleFlow = addKeyword(['test', 'prueba'])
  .addAction(async (ctx, { state }) => {
    console.log('🎯 [TEST SIMPLE] ¡addAction ejecutado!');
    console.log('🎯 [TEST SIMPLE] ctx.from:', ctx.from);
    console.log('🎯 [TEST SIMPLE] ctx.body:', ctx.body);
  })
  .addAnswer('¡Hola! Este es un test simple de BuilderBot.');

// Crear el flujo
const flow = createFlow([simpleFlow]);

console.log('🧪 [TEST SIMPLE] Flujo creado:');
console.log('flowRaw:', typeof flow.flowRaw);
console.log('allCallbacks:', typeof flow.allCallbacks);
console.log('flowSerialize:', typeof flow.flowSerialize);

console.log('🧪 [TEST SIMPLE] Test completado');