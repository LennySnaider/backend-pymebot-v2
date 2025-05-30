// Flujo directo que funciona - basado en la versión anterior
// Este flujo usa el patrón exacto de la versión que funcionaba

const { createFlow, addKeyword } = require('@builderbot/bot');

console.log('🔄 [WORKING FLOW] Inicializando flujo directo...');

try {
  // Crear flujo principal con keywords específicas
  const workingFlow = addKeyword(['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START'])
    .addAction(async (ctx, { state, flowDynamic }) => {
      console.log(`🎯 [WORKING FLOW] addAction ejecutándose - usuario: ${ctx.from}`);
      
      // Setup inicial de variables
      await state.update({
        tenantId: ctx._metadata?.tenantId || 'default',
        sessionId: ctx._sessionId || 'default',
        salesStageId: 'nuevos',
        conversation_status: 'active',
        initialized: true
      });
      
      // Enviar mensaje de bienvenida
      await flowDynamic('🤖 ¡Hola! Soy tu asistente virtual.\n\nEstoy aquí para ayudarte a agendar una cita con nosotros. 😊');
      
      console.log(`🎯 [WORKING FLOW] Bienvenida enviada`);
    })
    .addAnswer('Para comenzar, ¿podrías compartirme tu nombre completo? 📝', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log(`🎯 [WORKING FLOW] Nombre capturado: ${ctx.body}`);
        
        await state.update({ 
          nombre_lead: ctx.body, 
          cliente_nombre: ctx.body,
          has_nombre: true
        });
        
        await flowDynamic(`Perfecto ${ctx.body}! 👋\n\nAhora necesito tu número de teléfono para confirmar la cita. 📱`);
      }
    )
    .addAnswer('_Espera tu número de teléfono..._', 
      { capture: true }, 
      async (ctx, { state, flowDynamic }) => {
        console.log(`🎯 [WORKING FLOW] Teléfono capturado: ${ctx.body}`);
        
        await state.update({ 
          telefono: ctx.body,
          phone: ctx.body,
          has_telefono: true
        });
        
        // Obtener variables del estado
        const nombre = state.get?.('nombre_lead') || state.nombre_lead || ctx.body;
        const telefono = ctx.body;
        
        const mensajeFinal = 
          `✅ *¡Información recibida correctamente!*\n\n` +
          `📋 *Resumen:*\n` +
          `👤 Nombre: ${nombre}\n` +
          `📱 Teléfono: ${telefono}\n\n` +
          `✅ En breve un agente te contactará para confirmar tu cita.\n\n` +
          `¡Muchas gracias por tu interés!`;
        
        await flowDynamic(mensajeFinal);
        
        console.log(`🎯 [WORKING FLOW] Flujo completado exitosamente`);
      }
    );
  
  // Crear el flujo completo usando createFlow (como en la versión que funcionaba)
  const functionalFlow = createFlow([workingFlow]);
  
  // Asegurar que el flujo tenga los métodos necesarios
  if (!functionalFlow.findSerializeByKeyword && functionalFlow.flowSerialize) {
    functionalFlow.findSerializeByKeyword = function(keyword) {
      const result = this.flowSerialize?.find((item) => {
        if (Array.isArray(item.keyword)) {
          return item.keyword.some((kw) => kw.toLowerCase() === keyword.toLowerCase());
        }
        return false;
      });
      return result;
    };
  }
  
  if (!functionalFlow.findBySerialize && functionalFlow.flowSerialize) {
    functionalFlow.findBySerialize = function(serialized) {
      return this.flowSerialize?.find((item) => item.refSerialize === serialized);
    };
  }
  
  console.log('✅ [WORKING FLOW] Flujo directo creado exitosamente');
  console.log('✅ [WORKING FLOW] Keywords: hola, HOLA, hello, HELLO, inicio, INICIO, start, START');
  
  // Exportar para poder usar en templateConverter
  module.exports = {
    workingFlow,
    functionalFlow
  };
  
  // También exportar como ES modules para compatibilidad
  if (typeof exports !== 'undefined') {
    exports.workingFlow = workingFlow;
    exports.functionalFlow = functionalFlow;
  }
  
  console.log('✅ [WORKING FLOW] Flujo listo para usar');
  
} catch (error) {
  console.error('❌ [WORKING FLOW] Error general:', error.message);
  console.error('❌ [WORKING FLOW] Stack:', error.stack);
}