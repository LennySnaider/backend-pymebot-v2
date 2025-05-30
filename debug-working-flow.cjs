#!/usr/bin/env node

const { addKeyword, createFlow } = require('@builderbot/bot');

console.log('🔍 [DEBUG WORKING FLOW] Analizando un flujo simple que funciona...');

try {
  // Crear un flujo simple que sabemos que funciona
  const simpleFlow = addKeyword(['test'])
    .addAnswer('Mensaje simple de prueba');
    
  console.log('🔍 [DEBUG WORKING FLOW] simpleFlow creado');
  
  // Crear flow con createFlow
  const workingFlow = createFlow([simpleFlow]);
  
  console.log('🔍 [DEBUG WORKING FLOW] workingFlow creado');
  console.log('🔍 [DEBUG WORKING FLOW] workingFlow keys:', Object.keys(workingFlow));
  
  // Verificar flowSerialize
  console.log('🔍 [DEBUG WORKING FLOW] flowSerialize type:', typeof workingFlow.flowSerialize);
  
  if (typeof workingFlow.flowSerialize === 'function') {
    console.log('✅ [DEBUG WORKING FLOW] flowSerialize ES función');
    
    try {
      const serialized = workingFlow.flowSerialize();
      console.log('🔍 [DEBUG WORKING FLOW] Serialized keys:', Object.keys(serialized));
      
      // Buscar keywords en serialized
      Object.keys(serialized).forEach(key => {
        const node = serialized[key];
        console.log(`🔍 [DEBUG WORKING FLOW] Nodo ${key}:`, {
          keyword: node.keyword || 'NO KEYWORD',
          ref: node.ref || 'NO REF',
          answer: node.answer || 'NO ANSWER'
        });
      });
      
      // Probar findBySerialize
      if (workingFlow.findBySerialize) {
        console.log('🔍 [DEBUG WORKING FLOW] Probando findBySerialize...');
        
        const result = workingFlow.findBySerialize('test');
        if (result) {
          console.log(`✅ [DEBUG WORKING FLOW] Keyword "test" ENCONTRADO! ref: ${result.ref}`);
        } else {
          console.log(`❌ [DEBUG WORKING FLOW] Keyword "test" NO encontrado`);
        }
      }
      
    } catch (error) {
      console.error('❌ [DEBUG WORKING FLOW] Error en serialization:', error.message);
    }
  } else {
    console.log('❌ [DEBUG WORKING FLOW] flowSerialize NO es función:', typeof workingFlow.flowSerialize);
  }
  
  // Comparar estructura de flowRaw
  if (workingFlow.flowRaw) {
    console.log('🔍 [DEBUG WORKING FLOW] flowRaw keys:', Object.keys(workingFlow.flowRaw));
    
    const firstNodeKey = Object.keys(workingFlow.flowRaw)[0];
    const firstNode = workingFlow.flowRaw[firstNodeKey];
    
    console.log('🔍 [DEBUG WORKING FLOW] Primer nodo estructura completa:');
    console.log('  - ref:', firstNode.ref);
    console.log('  - keywords:', firstNode.ctx?.keyword);
    console.log('  - options:', firstNode.ctx?.options);
    console.log('  - answer:', firstNode.ctx?.answer);
    console.log('  - callbacks keys:', firstNode.ctx?.callbacks ? Object.keys(firstNode.ctx.callbacks) : 'NO CALLBACKS');
  }
  
} catch (error) {
  console.error('❌ [DEBUG WORKING FLOW] Error general:', error.message);
  console.error('❌ [DEBUG WORKING FLOW] Stack:', error.stack);
}

console.log('🔍 [DEBUG WORKING FLOW] Análisis completado');