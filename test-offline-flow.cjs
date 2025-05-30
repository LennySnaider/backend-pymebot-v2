#!/usr/bin/env node

const { addKeyword, createFlow } = require('@builderbot/bot');

console.log('🔄 [TEST OFFLINE] Creando flujo funcional sin dependencias de Supabase...');

try {
  // Crear un flujo funcional simple que no requiera Supabase
  const offlineFlow = addKeyword(['hola', 'HOLA', 'test', 'prueba'])
    .addAction(async (ctx, { state, flowDynamic }) => {
      console.log('🎯 [OFFLINE FLOW] addAction ejecutándose!');
      console.log('🎯 [OFFLINE FLOW] Usuario:', ctx.from);
      console.log('🎯 [OFFLINE FLOW] Mensaje:', ctx.body);
      
      // Setup inicial sin Supabase
      await state.update({
        tenantId: 'offline-test',
        sessionId: ctx.from + '-offline',
        conversation_status: 'active',
        template_intercepted: 'offline-flow'
      });
      
      await flowDynamic('🤖 ¡Hola! Soy tu asistente virtual (MODO OFFLINE).\\n\\nEstoy aquí para ayudarte a agendar una cita. 😊');
      
      console.log('🎯 [OFFLINE FLOW] Mensaje de bienvenida enviado');
    })
    .addAnswer('Para comenzar, ¿podrías compartirme tu nombre completo? 📝', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log('🎯 [OFFLINE FLOW] Nombre capturado:', ctx.body);
        
        await state.update({ 
          nombre_lead: ctx.body, 
          cliente_nombre: ctx.body,
          has_nombre: true
        });
        
        await flowDynamic(`Perfecto ${ctx.body}! 👋\\n\\nAhora necesito tu número de teléfono para confirmar la cita. 📱`);
      }
    )
    .addAnswer('Escribir número de teléfono:', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log('🎯 [OFFLINE FLOW] Teléfono capturado:', ctx.body);
        
        await state.update({ 
          telefono_lead: ctx.body, 
          cliente_telefono: ctx.body,
          has_telefono: true
        });
        
        await flowDynamic('Excelente! Te voy a mostrar nuestros servicios disponibles 🎯\\n\\n1. 📋 Consulta General\\n2. 🔍 Evaluación Especializada\\n3. 📞 Asesoría Personalizada\\n\\nEscribe el número de tu elección:');
      }
    )
    .addAnswer('Seleccionar servicio (1-3):', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log('🎯 [OFFLINE FLOW] Servicio seleccionado:', ctx.body);
        
        const servicios = ['Consulta General', 'Evaluación Especializada', 'Asesoría Personalizada'];
        const servicioSeleccionado = servicios[parseInt(ctx.body) - 1] || servicios[0];
        
        await state.update({ 
          servicio_seleccionado: servicioSeleccionado,
          products_list: servicioSeleccionado
        });
        
        // Obtener datos del estado
        const currentState = state.getMyState();
        
        await flowDynamic(`🎯 *¡Perfecto! Tu información ha sido registrada exitosamente*\\n\\n📋 *Resumen:*\\n👤 Nombre: ${currentState.cliente_nombre}\\n📱 Teléfono: ${currentState.cliente_telefono}\\n🏥 Servicio: ${servicioSeleccionado}\\n\\n✅ En breve un agente te contactará para confirmar tu cita.\\n\\n¡Muchas gracias por tu interés!`);
        
        console.log('🎯 [OFFLINE FLOW] Flujo completado exitosamente!');
        console.log('🎯 [OFFLINE FLOW] Estado final:', currentState);
      }
    );
    
  console.log('✅ [TEST OFFLINE] offlineFlow creado');
  
  // Crear flow completo
  const functionalFlow = createFlow([offlineFlow]);
  
  console.log('✅ [TEST OFFLINE] functionalFlow creado');
  console.log('🔍 [TEST OFFLINE] functionalFlow keys:', Object.keys(functionalFlow));
  
  // Verificar serialization
  if (functionalFlow.flowSerialize && typeof functionalFlow.flowSerialize === 'function') {
    console.log('✅ [TEST OFFLINE] flowSerialize ES función');
    
    try {
      const serialized = functionalFlow.flowSerialize();
      console.log('🔍 [TEST OFFLINE] Serialized keys:', Object.keys(serialized));
      
      // Buscar keywords
      Object.keys(serialized).forEach(key => {
        const node = serialized[key];
        if (node.keyword && node.keyword.length > 0) {
          console.log(`✅ [TEST OFFLINE] Nodo ${key} tiene keywords:`, node.keyword);
        }
      });
      
      // Probar findBySerialize
      if (functionalFlow.findBySerialize) {
        console.log('🔍 [TEST OFFLINE] Probando findBySerialize...');
        
        const testKeywords = ['hola', 'HOLA', 'test', 'prueba'];
        testKeywords.forEach(kw => {
          try {
            const result = functionalFlow.findBySerialize(kw);
            if (result) {
              console.log(`✅ [TEST OFFLINE] Keyword "${kw}" ENCONTRADO! ref: ${result.ref}`);
            } else {
              console.log(`❌ [TEST OFFLINE] Keyword "${kw}" NO encontrado`);
            }
          } catch (error) {
            console.log(`❌ [TEST OFFLINE] Error buscando "${kw}":`, error.message);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ [TEST OFFLINE] Error en serialization:', error.message);
    }
  }
  
  // Exportar para uso en templateConverter
  module.exports = {
    offlineFlow,
    functionalFlow
  };
  
  // También exportar como ES modules para compatibilidad
  if (typeof exports !== 'undefined') {
    exports.offlineFlow = offlineFlow;
    exports.functionalFlow = functionalFlow;
  }
  
  console.log('✅ [TEST OFFLINE] Flujo offline listo para usar');
  
} catch (error) {
  console.error('❌ [TEST OFFLINE] Error general:', error.message);
  console.error('❌ [TEST OFFLINE] Stack:', error.stack);
}