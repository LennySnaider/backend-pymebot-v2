#!/usr/bin/env node

const { addKeyword, createFlow } = require('@builderbot/bot');

console.log('🔍 [DEBUG FLOW] Recreando flujo inline exacto del templateConverter...');

try {
  // Recrear exactamente la misma lógica del templateConverter
  let entryKeywords = ['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START'];
  entryKeywords.push('pruebas');
  entryKeywords.push('PRUEBAS');
  
  console.log('🔍 [DEBUG FLOW] Keywords configurados:', entryKeywords);
  
  // Crear flujo interceptado con keywords dinámicos (EXACTO como en templateConverter)
  const interceptedFlow = addKeyword(entryKeywords)
    .addAction(async (ctx, { state, flowDynamic }) => {
      console.log('🎯 [FLUJO INTERCEPTADO] addAction ejecutándose!');
      
      // Setup inicial de variables
      await state.update({
        tenantId: 'test-tenant',
        sessionId: 'test-session',
        salesStageId: 'nuevos',
        conversation_status: 'active',
        template_intercepted: 'test-template'
      });
      
      // Enviar mensaje de bienvenida
      await flowDynamic('🤖 ¡Hola! Soy tu asistente virtual.\n\nEstoy aquí para ayudarte a agendar una cita con nosotros. 😊');
      
      console.log('🎯 [FLUJO INTERCEPTADO] Bienvenida enviada');
    })
    .addAnswer('Para comenzar, ¿podrías compartirme tu nombre completo? 📝', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log('🎯 [FLUJO INTERCEPTADO] Nombre capturado:', ctx.body);
        
        await state.update({ 
          nombre_lead: ctx.body, 
          cliente_nombre: ctx.body,
          has_nombre: true
        });
        
        await flowDynamic(`Perfecto ${ctx.body}! 👋\n\nAhora necesito tu número de teléfono para confirmar la cita. 📱`);
      }
    );
    
  console.log('🔍 [DEBUG FLOW] interceptedFlow creado');
  console.log('🔍 [DEBUG FLOW] interceptedFlow type:', typeof interceptedFlow);
  
  // Crear flujo usando el interceptedFlow
  const functionalFlow = createFlow([interceptedFlow]);
  
  console.log('🔍 [DEBUG FLOW] functionalFlow creado');
  console.log('🔍 [DEBUG FLOW] functionalFlow keys:', Object.keys(functionalFlow));
  
  // Verificar flowRaw
  if (functionalFlow.flowRaw) {
    console.log('🔍 [DEBUG FLOW] flowRaw keys:', Object.keys(functionalFlow.flowRaw));
    
    // Verificar primer nodo
    const firstNodeKey = Object.keys(functionalFlow.flowRaw)[0];
    const firstNode = functionalFlow.flowRaw[firstNodeKey];
    
    console.log('🔍 [DEBUG FLOW] Primer nodo key:', firstNodeKey);
    console.log('🔍 [DEBUG FLOW] Primer nodo ref:', firstNode.ref);
    console.log('🔍 [DEBUG FLOW] Keywords del nodo:', firstNode.ctx?.keyword || 'UNDEFINED');
    
    // Verificar si tiene serialization correcta
    if (functionalFlow.flowSerialize && typeof functionalFlow.flowSerialize === 'function') {
      console.log('🔍 [DEBUG FLOW] flowSerialize ES función - ejecutando...');
      
      try {
        const serialized = functionalFlow.flowSerialize();
        console.log('🔍 [DEBUG FLOW] Serialized keys:', Object.keys(serialized));
        
        // Buscar keywords en serialized
        Object.keys(serialized).forEach(key => {
          const node = serialized[key];
          if (node.keyword && node.keyword.length > 0) {
            console.log(`🔍 [DEBUG FLOW] Nodo ${key} tiene keywords:`, node.keyword);
          }
        });
        
        // Probar findBySerialize
        if (functionalFlow.findBySerialize) {
          console.log('🔍 [DEBUG FLOW] Probando findBySerialize...');
          
          const testKeywords = ['hola', 'HOLA', 'hello', 'pruebas'];
          testKeywords.forEach(kw => {
            try {
              const result = functionalFlow.findBySerialize(kw);
              if (result) {
                console.log(`✅ [DEBUG FLOW] Keyword "${kw}" ENCONTRADO! ref: ${result.ref}`);
              } else {
                console.log(`❌ [DEBUG FLOW] Keyword "${kw}" NO encontrado`);
              }
            } catch (error) {
              console.log(`❌ [DEBUG FLOW] Error buscando "${kw}":`, error.message);
            }
          });
        } else {
          console.log('❌ [DEBUG FLOW] No hay findBySerialize en functionalFlow');
        }
        
      } catch (error) {
        console.error('❌ [DEBUG FLOW] Error en serialization:', error.message);
      }
    } else {
      console.log('❌ [DEBUG FLOW] flowSerialize no es función:', typeof functionalFlow.flowSerialize);
    }
    
  } else {
    console.log('❌ [DEBUG FLOW] No hay flowRaw');
  }
  
} catch (error) {
  console.error('❌ [DEBUG FLOW] Error general:', error.message);
  console.error('❌ [DEBUG FLOW] Stack:', error.stack);
}

console.log('🔍 [DEBUG FLOW] Análisis completado');