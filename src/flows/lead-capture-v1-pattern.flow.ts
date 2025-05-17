import { addKeyword, createFlow, EVENTS } from "@builderbot/bot";

// Estado inicial - detecta palabras clave para iniciar
const leadCaptureStart = addKeyword(['hola', 'inicio', 'lead'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    console.log("🟢 Iniciando flujo lead-capture");
    
    // Limpiar estado previo y establecer nuevo estado
    await state.clear();
    await state.update({ 
      step: 'waiting_name',
      flowActive: true
    });
    
    // Presentar el mensaje de bienvenida
    await flowDynamic('👋 Hola, soy el asistente virtual.');
    await flowDynamic('¿Cuál es tu nombre?');
  });

// Flujo principal que maneja todas las respuestas
const mainFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const currentState = await state.getMyState();
    
    console.log(`🔵 MainFlow recibido: "${ctx.body}", Estado actual:`, currentState);
    
    // Si no hay flujo activo, ignorar
    if (!currentState?.flowActive) {
      console.log("🔴 No hay flujo activo, ignorando mensaje");
      return;
    }
    
    // Procesar según el paso actual
    switch (currentState.step) {
      case 'waiting_name':
        console.log("📝 Capturando nombre:", ctx.body);
        
        // Guardar el nombre y avanzar
        await state.update({ 
          name: ctx.body,
          step: 'waiting_email'
        });
        
        // Responder y preguntar email
        await flowDynamic(`Mucho gusto ${ctx.body}!`);
        await flowDynamic('¿Cuál es tu correo electrónico?');
        break;
        
      case 'waiting_email':
        console.log("📧 Capturando email:", ctx.body);
        
        // Guardar el email y completar
        await state.update({ 
          email: ctx.body,
          step: 'completed',
          flowActive: false
        });
        
        // Confirmar registro
        await flowDynamic([
          'Gracias por tu información. He registrado:',
          `✅ Nombre: ${currentState.name}`,
          `✅ Email: ${ctx.body}`,
          '',
          '¿En qué más puedo ayudarte?'
        ]);
        break;
        
      case 'completed':
        console.log("✅ Flujo completado, ignorando mensaje");
        // Flujo completado, no hacer nada
        break;
        
      default:
        console.log("⚠️ Estado desconocido:", currentState.step);
    }
  });

// Usar el evento ACTION para capturar todos los mensajes
const catchAll = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { state, gotoFlow }) => {
    const currentState = await state.getMyState();
    
    // Si hay un flujo activo, redirigir al mainFlow
    if (currentState?.flowActive) {
      return gotoFlow(mainFlow);
    }
    
    // Si no hay flujo activo y el mensaje no es una palabra clave, ignorar
    console.log("📨 Mensaje recibido sin flujo activo:", ctx.body);
  });

export default createFlow([
  leadCaptureStart,
  mainFlow,
  catchAll
]);