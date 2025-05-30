const { addKeyword, EVENTS } = require('@builderbot/bot');

/**
 * Flujo simple que funciona correctamente con BuilderBot
 * Basado en el patrón correcto de la documentación
 */

// Flujo principal que responde a "hola"
const welcomeFlow = addKeyword(['hola', 'HOLA', 'inicio', 'INICIO', 'start', 'START', 'hello', 'HELLO'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    console.log('🚀 [WELCOME] Usuario escribió:', ctx.body);
    console.log('🚀 [WELCOME] Este flujo interceptado SÍ FUNCIONA!');
    console.log('🚀 [WELCOME] Metadata:', ctx._metadata);
    console.log('🚀 [WELCOME] SessionId:', ctx._sessionId);
    
    // Limpiar estado anterior
    await state.clear();
    
    // Establecer estado inicial
    await state.update({ 
      step: 'waiting_name',
      flowActive: true,
      tenantId: ctx._metadata?.tenantId || 'default',
      sessionId: ctx._sessionId || 'default'
    });
    
    // Enviar mensajes de bienvenida
    await flowDynamic('🤖 ¡Hola! Soy tu asistente virtual de Casa Claudia.');
    await flowDynamic('Estoy aquí para ayudarte a agendar una cita con nosotros. 😊');
    await flowDynamic('Para comenzar, ¿podrías compartirme tu nombre completo? 📝');
    
    console.log('✅ [WELCOME] Flujo iniciado, esperando nombre...');
  });

// Flujo principal que captura todas las respuestas del usuario
const mainFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, state }) => {
    console.log('🔥 [MAIN] EVENTS.ACTION capturado! Mensaje:', ctx.body);
    console.log('🔥 [MAIN] Metadata:', ctx._metadata);
    
    const currentState = await state.getMyState();
    console.log('🔥 [MAIN] Estado actual:', currentState);
    
    // Solo procesar si el flujo está activo
    if (!currentState?.flowActive) {
      console.log('❌ [MAIN] Flujo no activo, ignorando:', ctx.body);
      return;
    }
    
    console.log('🔄 [MAIN] Procesando paso:', currentState.step, 'Mensaje:', ctx.body);
    
    switch (currentState.step) {
      case 'waiting_name':
        // Capturar nombre
        await state.update({ 
          name: ctx.body,
          step: 'waiting_phone',
          nombre_lead: ctx.body // Para compatibilidad con variables existentes
        });
        
        console.log('✅ [NAME] Nombre capturado:', ctx.body);
        await flowDynamic(`Mucho gusto ${ctx.body}! 👋`);
        await flowDynamic('Ahora necesito tu número de teléfono para confirmar la cita. 📱');
        break;
        
      case 'waiting_phone':
        // Capturar teléfono
        await state.update({ 
          phone: ctx.body,
          step: 'show_categories',
          telefono: ctx.body // Para compatibilidad
        });
        
        console.log('✅ [PHONE] Teléfono capturado:', ctx.body);
        await flowDynamic('Excelente! Te voy a mostrar nuestros servicios disponibles 🎯');
        await flowDynamic([
          '📁 *Categorías disponibles:*',
          '',
          '1. 🏠 Inmobiliaria',
          '2. 🏥 Servicios Médicos', 
          '3. 🎯 General',
          '',
          '*Escribe el número de tu opción preferida:*'
        ]);
        break;
        
      case 'show_categories':
        // Procesar selección de categoría
        let selectedCategory = 'General';
        const response = ctx.body.toLowerCase().trim();
        
        if (response === '1' || response.includes('inmobiliaria')) {
          selectedCategory = 'Inmobiliaria';
        } else if (response === '2' || response.includes('médicos') || response.includes('salud')) {
          selectedCategory = 'Servicios Médicos';
        } else if (response === '3' || response.includes('general')) {
          selectedCategory = 'General';
        }
        
        await state.update({ 
          categoria: selectedCategory,
          step: 'show_products',
          selected_category: selectedCategory
        });
        
        console.log('✅ [CATEGORY] Categoría seleccionada:', selectedCategory);
        await flowDynamic(`Has seleccionado: *${selectedCategory}*`);
        
        // Mostrar productos según categoría
        let productos = [];
        if (selectedCategory === 'Inmobiliaria') {
          productos = [
            '1. Compra de Casa - $300,000 (60 min)',
            '2. Renta de Apartamento - $800/mes (45 min)', 
            '3. Venta de Propiedad - Comisión 3% (90 min)',
            '4. Evaluación de Propiedad - $150 (30 min)'
          ];
        } else if (selectedCategory === 'Servicios Médicos') {
          productos = [
            '1. Consulta General - $80 (30 min)',
            '2. Consulta Especializada - $120 (45 min)',
            '3. Tratamiento Preventivo - $60 (25 min)',
            '4. Evaluación Completa - $200 (60 min)'
          ];
        } else {
          productos = [
            '1. Servicio Básico - $50 (30 min)',
            '2. Servicio Premium - $100 (60 min)',
            '3. Consultoría - $80 (45 min)',
            '4. Evaluación - $70 (40 min)'
          ];
        }
        
        await flowDynamic([
          '🛍️ *Servicios disponibles:*',
          '',
          ...productos,
          '',
          '*Escribe el número del servicio que te interesa:*'
        ]);
        break;
        
      case 'show_products':
        // Procesar selección de producto
        const productIndex = parseInt(ctx.body) - 1;
        const currentCategory = currentState.categoria || 'General';
        
        let selectedProduct = 'Servicio seleccionado';
        
        // Mapear producto según categoría y número
        if (currentCategory === 'Inmobiliaria') {
          const inmobiliariaProducts = ['Compra de Casa', 'Renta de Apartamento', 'Venta de Propiedad', 'Evaluación de Propiedad'];
          selectedProduct = inmobiliariaProducts[productIndex] || inmobiliariaProducts[0];
        } else if (currentCategory === 'Servicios Médicos') {
          const medicoProducts = ['Consulta General', 'Consulta Especializada', 'Tratamiento Preventivo', 'Evaluación Completa'];
          selectedProduct = medicoProducts[productIndex] || medicoProducts[0];
        } else {
          const generalProducts = ['Servicio Básico', 'Servicio Premium', 'Consultoría', 'Evaluación'];
          selectedProduct = generalProducts[productIndex] || generalProducts[0];
        }
        
        await state.update({ 
          producto: selectedProduct,
          step: 'completed',
          flowActive: false,
          selected_product: selectedProduct
        });
        
        console.log('✅ [PRODUCT] Producto seleccionado:', selectedProduct);
        
        // Mensaje final
        const userName = currentState.name || 'Cliente';
        const userPhone = currentState.phone || 'No especificado';
        
        await flowDynamic([
          '🎯 *¡Perfecto! Información registrada:*',
          '',
          `👤 Nombre: ${userName}`,
          `📱 Teléfono: ${userPhone}`,
          `📁 Categoría: ${currentCategory}`,
          `🛍️ Servicio: ${selectedProduct}`,
          '',
          '¡Muchas gracias por tu interés en Casa Claudia! 🙏',
          'Uno de nuestros asesores se contactará contigo pronto.',
          '',
          '¡Que tengas un excelente día! 😊'
        ]);
        
        console.log('🎉 [COMPLETED] Flujo completado exitosamente');
        break;
        
      default:
        console.log('⚠️ [MAIN] Estado desconocido:', currentState.step);
        await flowDynamic('Lo siento, algo salió mal. Escribe "hola" para reiniciar.');
        await state.clear();
        break;
    }
  });

module.exports = {
  welcomeFlow,
  mainFlow
};