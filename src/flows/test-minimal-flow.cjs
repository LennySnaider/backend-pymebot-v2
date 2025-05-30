const { addKeyword, EVENTS } = require('@builderbot/bot');

/**
 * Flujo mínimo para debugging de interceptación
 */

// Flujo de bienvenida ultra simple
const welcomeFlow = addKeyword(['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'start'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    console.log('🎯 [MINIMAL] ¡ÉXITO! El flujo interceptado funciona');
    console.log('🎯 [MINIMAL] Usuario escribió:', ctx.body);
    console.log('🎯 [MINIMAL] Metadata:', JSON.stringify(ctx._metadata, null, 2));
    
    try {
      await flowDynamic('🎉 ¡Hola! El flujo interceptado FUNCIONA correctamente.');
      await flowDynamic('Esto demuestra que el sistema de interceptación está operativo.');
      
      console.log('🎯 [MINIMAL] Mensajes enviados exitosamente');
      
    } catch (error) {
      console.error('❌ [MINIMAL] Error enviando mensajes:', error);
    }
  });

module.exports = {
  welcomeFlow,
  mainFlow: welcomeFlow  // Por simplicidad, usar el mismo flujo
};