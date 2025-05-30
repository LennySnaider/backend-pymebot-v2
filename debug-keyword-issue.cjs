#!/usr/bin/env node

const { addKeyword, createFlow, createBot, MemoryDB } = require('@builderbot/bot');

console.log('🔍 [DEBUG KEYWORDS] Analizando problema de keywords...');

// Cargar el flujo actual
try {
  const { welcomeFlow } = require('./src/flows/direct-functional-flow.cjs');
  
  console.log('🔍 [DEBUG KEYWORDS] Flujo cargado');
  
  // Crear flow y verificar estructura
  const flow = createFlow([welcomeFlow]);
  
  console.log('🔍 [DEBUG KEYWORDS] Flow creado');
  console.log('🔍 [DEBUG KEYWORDS] Flow keys:', Object.keys(flow));
  
  // Verificar flowRaw
  if (flow.flowRaw) {
    console.log('🔍 [DEBUG KEYWORDS] flowRaw keys:', Object.keys(flow.flowRaw));
    
    // Verificar primer nodo
    const firstNodeKey = Object.keys(flow.flowRaw)[0];
    const firstNode = flow.flowRaw[firstNodeKey];
    
    console.log('🔍 [DEBUG KEYWORDS] Primer nodo key:', firstNodeKey);
    console.log('🔍 [DEBUG KEYWORDS] Primer nodo ref:', firstNode.ref);
    console.log('🔍 [DEBUG KEYWORDS] Keywords del nodo:', firstNode.ctx?.keyword || 'UNDEFINED');
    console.log('🔍 [DEBUG KEYWORDS] Options del nodo:', firstNode.ctx?.options || 'UNDEFINED');
    
    // Verificar si tiene serialization correcta
    if (flow.flowSerialize) {
      console.log('🔍 [DEBUG KEYWORDS] flowSerialize disponible');
      console.log('🔍 [DEBUG KEYWORDS] flowSerialize type:', typeof flow.flowSerialize);
      
      try {
        const serialized = flow.flowSerialize();
        console.log('🔍 [DEBUG KEYWORDS] Serialized keys:', Object.keys(serialized));
        
        // Buscar keywords en serialized
        Object.keys(serialized).forEach(key => {
          const node = serialized[key];
          if (node.keyword && node.keyword.length > 0) {
            console.log(`🔍 [DEBUG KEYWORDS] Nodo ${key} tiene keywords:`, node.keyword);
          }
        });
        
      } catch (error) {
        console.error('❌ [DEBUG KEYWORDS] Error en serialization:', error.message);
      }
    }
    
    // Crear un test de bot directo
    console.log('🔍 [DEBUG KEYWORDS] Creando bot de test...');
    
    const database = new MemoryDB();
    
    try {
      const testBot = createBot({
        flow: flow,
        database: database
      });
      
      console.log('✅ [DEBUG KEYWORDS] Bot creado exitosamente');
      console.log('🔍 [DEBUG KEYWORDS] Bot keys:', Object.keys(testBot));
      
      // Verificar si el bot puede encontrar el keyword
      if (testBot.flowClass && testBot.flowClass.findBySerialize) {
        console.log('🔍 [DEBUG KEYWORDS] Probando findBySerialize...');
        
        try {
          const result = testBot.flowClass.findBySerialize('hola');
          console.log('🔍 [DEBUG KEYWORDS] findBySerialize("hola") result:', !!result);
          
          if (result) {
            console.log('✅ [DEBUG KEYWORDS] ¡Keyword "hola" ENCONTRADO!');
            console.log('🔍 [DEBUG KEYWORDS] Result ref:', result.ref);
          } else {
            console.log('❌ [DEBUG KEYWORDS] Keyword "hola" NO encontrado');
            
            // Probar otros keywords
            const testKeywords = ['HOLA', 'hello', 'HELLO', 'inicio', 'START'];
            testKeywords.forEach(kw => {
              const res = testBot.flowClass.findBySerialize(kw);
              if (res) {
                console.log(`✅ [DEBUG KEYWORDS] Keyword "${kw}" ENCONTRADO!`);
              }
            });
          }
          
        } catch (error) {
          console.error('❌ [DEBUG KEYWORDS] Error en findBySerialize:', error.message);
        }
      }
      
    } catch (error) {
      console.error('❌ [DEBUG KEYWORDS] Error creando bot:', error.message);
    }
    
  } else {
    console.log('❌ [DEBUG KEYWORDS] No hay flowRaw');
  }
  
} catch (error) {
  console.error('❌ [DEBUG KEYWORDS] Error general:', error.message);
}

console.log('🔍 [DEBUG KEYWORDS] Análisis completado');