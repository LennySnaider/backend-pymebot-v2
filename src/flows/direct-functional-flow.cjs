const { addKeyword, addAction, addAnswer, EVENTS } = require('@builderbot/bot');

/**
 * FLUJO FUNCIONAL USANDO EL PATRÓN EXACTO QUE FUNCIONABA
 * Basado en el templateConverter original que sí respondía
 * Usa addAction + addAnswer pattern que garantiza respuesta
 */

// 🔥 PATRÓN FUNCIONAL CONFIRMADO: addAction para setup inicial + addAnswer para captura
const welcomeFlow = addKeyword(['hola', 'HOLA', 'hello', 'HELLO', 'inicio', 'INICIO', 'start', 'START'])
  .addAction(async (ctx, { state, flowDynamic }) => {
    console.log('🎯 [FLUJO FUNCIONAL] addAction ejecutándose - PATRÓN ORIGINAL!');
    
    // Setup inicial de variables como en el templateConverter funcional
    await state.update({
      tenantId: ctx._metadata?.tenantId || 'unknown',
      sessionId: ctx._sessionId || 'unknown-session',
      salesStageId: 'nuevos',
      conversation_status: 'active'
    });
    
    // Enviar mensaje de bienvenida usando flowDynamic como en original
    await flowDynamic('🤖 ¡Hola! Soy tu asistente virtual.\n\nEstoy aquí para ayudarte a agendar una cita con nosotros. 😊');
    
    console.log('🎯 [FLUJO FUNCIONAL] Bienvenida enviada, estado inicial configurado');
  })
  .addAnswer('Para comenzar, ¿podrías compartirme tu nombre completo? 📝', 
    { capture: true }, 
    async (ctx, { state, flowDynamic }) => {
      console.log('🎯 [FLUJO FUNCIONAL] Nombre capturado:', ctx.body);
      
      // Actualizar estado con nombre capturado
      await state.update({ 
        nombre_lead: ctx.body, 
        cliente_nombre: ctx.body,
        has_nombre: true
      });
      
      // Responder dinámicamente
      await flowDynamic(`Perfecto ${ctx.body}! 👋\n\nAhora necesito tu número de teléfono para confirmar la cita. 📱`);
      
      console.log('🎯 [FLUJO FUNCIONAL] Nombre procesado, solicitando teléfono');
    }
  )
  .addAnswer('_Espera tu número de teléfono..._', 
    { capture: true }, 
    async (ctx, { state, flowDynamic }) => {
      console.log('🎯 [FLUJO FUNCIONAL] Teléfono capturado:', ctx.body);
      
      // Actualizar estado con teléfono
      await state.update({ 
        telefono_lead: ctx.body, 
        cliente_telefono: ctx.body,
        has_telefono: true
      });
      
      // Mostrar servicios disponibles
      const serviciosTexto = 'Excelente! Te voy a mostrar nuestros servicios disponibles 🎯\n\n' +
        '1. 📋 Consulta General\n' +
        '2. 🔍 Evaluación Especializada\n' +
        '3. 📞 Asesoría Personalizada\n\n' +
        'Escribe el número de tu elección:';
      
      await flowDynamic(serviciosTexto);
      
      console.log('🎯 [FLUJO FUNCIONAL] Teléfono procesado, servicios mostrados');
    }
  )
  .addAnswer('_Espera tu selección de servicio..._', 
    { capture: true }, 
    async (ctx, { state, flowDynamic }) => {
      console.log('🎯 [FLUJO FUNCIONAL] Servicio seleccionado:', ctx.body);
      
      // Procesar selección de servicio
      const servicios = ['Consulta General', 'Evaluación Especializada', 'Asesoría Personalizada'];
      const opcion = parseInt(ctx.body);
      const servicioSeleccionado = servicios[opcion - 1] || servicios[0];
      
      // Actualizar estado final
      await state.update({ 
        servicio_seleccionado: servicioSeleccionado,
        products_list: servicioSeleccionado,
        flow_completed: true,
        salesStageId: 'interesados'
      });
      
      // Obtener datos del estado para resumen
      const currentState = state.getMyState();
      const nombre = currentState.cliente_nombre || 'Usuario';
      const telefono = currentState.cliente_telefono || 'No especificado';
      
      // Mensaje final de confirmación
      const mensajeFinal = `🎯 *¡Perfecto! Tu información ha sido registrada exitosamente*\n\n` +
        `📋 *Resumen:*\n` +
        `👤 Nombre: ${nombre}\n` +
        `📱 Teléfono: ${telefono}\n` +
        `🏥 Servicio: ${servicioSeleccionado}\n\n` +
        `✅ En breve un agente te contactará para confirmar tu cita.\n\n` +
        `¡Muchas gracias por tu interés!`;
      
      await flowDynamic(mensajeFinal);
      
      console.log('🎯 [FLUJO FUNCIONAL] Flujo completado exitosamente:', {
        nombre,
        telefono, 
        servicio: servicioSeleccionado
      });
    }
  );

module.exports = {
  welcomeFlow,
  mainFlow: welcomeFlow
};