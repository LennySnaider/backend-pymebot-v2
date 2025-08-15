const { addKeyword } = require('@builderbot/bot');

/**
 * PRUEBA EXTREMADAMENTE SIMPLE PARA DEBUGGING
 * Solo un paso de captura para probar si funciona
 */

const welcomeFlow = addKeyword(['hola', 'HOLA', 'inicio', 'INICIO', 'start', 'START', 'hello', 'HELLO'])
  .addAnswer('🤖 ¡Hola! Soy el asistente de Casa Claudia.')
  .addAnswer(
    '¿Cuál es tu nombre?',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      console.log('🎯 [SIMPLE TEST] ¡CAPTURA FUNCIONÓ! Nombre:', ctx.body);
      await flowDynamic(`¡Hola ${ctx.body}! El flujo SÍ está funcionando correctamente.`);
      await state.update({ 
        nombre: ctx.body,
        testing: 'success'
      });
    }
  )
  .addAnswer(
    '¿Cuál es tu teléfono?',
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      console.log('🎯 [SIMPLE TEST] ¡SEGUNDA CAPTURA! Teléfono:', ctx.body);
      const currentState = await state.getMyState() || {};
      await flowDynamic(`Perfecto ${currentState.nombre}! Tu teléfono ${ctx.body} ha sido registrado.`);
      await flowDynamic('🎉 ¡Test completado exitosamente!');
    }
  );

console.log('📋 [FLOW LOADED] simple-working-flow.cjs cargado con flujo de prueba simple');

module.exports = {
  welcomeFlow,
  mainFlow: welcomeFlow
};