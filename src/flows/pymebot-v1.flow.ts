import { createFlow, addKeyword } from '@builderbot/bot';
import type { BotContext, BotMethods, TFlow } from '@builderbot/bot/dist/types';
import { logger } from '../utils/logger';

/**
 * Flujo PymeBot V1 - Flujo predeterminado de agendamiento de citas
 */

const flowWelcome = addKeyword(['hola', 'inicio', 'empezar', 'hi', 'hello'])
  .addAnswer('🤖 ¡Hola! Soy tu asistente virtual de Pymebot.')
  .addAnswer('Estoy aquí para ayudarte a agendar una cita con nosotros. 😊')
  .addAnswer('Para comenzar, ¿podrías compartirme tu nombre completo? 📝', 
    { capture: true }, 
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const nombre = ctx.body;
      await state.update({ nombre });
      
      logger.info(`[PymeBot V1] Nombre capturado: ${nombre}`);
      
      // Confirmación inmediata
      await flowDynamic(`¡Mucho gusto, ${nombre}! 👋`);
      
      // Continuar con el siguiente paso
      await flowDynamic('¿Cuál es tu número de teléfono? 📱');
    }
  )
  .addAnswer('', 
    { capture: true },
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const telefono = ctx.body;
      await state.update({ telefono });
      
      logger.info(`[PymeBot V1] Teléfono capturado: ${telefono}`);
      
      // Confirmación y siguiente pregunta
      await flowDynamic('¡Perfecto! Ya tengo tu número. 📞');
      await flowDynamic('¿Cuál es tu correo electrónico? 📧');
    }
  )
  .addAnswer('', 
    { capture: true },
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const email = ctx.body;
      await state.update({ email });
      
      logger.info(`[PymeBot V1] Email capturado: ${email}`);
      
      // Obtener todos los datos
      const estadoActual = await state.getMyState();
      const { nombre, telefono } = estadoActual;
      
      // Confirmación final
      await flowDynamic('¡Excelente! He registrado tus datos:');
      await flowDynamic(`✅ Nombre: ${nombre}`);
      await flowDynamic(`✅ Teléfono: ${telefono}`);
      await flowDynamic(`✅ Email: ${email}`);
      
      // Opciones de servicios
      await flowDynamic([
        '¿En qué servicio estás interesado?',
        '',
        '1️⃣ Consultoría',
        '2️⃣ Desarrollo de Software',
        '3️⃣ Soporte Técnico',
        '4️⃣ Otro servicio',
        '',
        'Por favor, escribe el número de tu elección.'
      ]);
    }
  )
  .addAnswer('', 
    { capture: true },
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const opcion = ctx.body;
      let servicio = '';
      
      switch(opcion) {
        case '1':
          servicio = 'Consultoría';
          break;
        case '2':
          servicio = 'Desarrollo de Software';
          break;
        case '3':
          servicio = 'Soporte Técnico';
          break;
        case '4':
          servicio = 'Otro servicio';
          break;
        default:
          servicio = opcion; // Si escriben algo diferente, lo guardamos tal cual
      }
      
      await state.update({ servicio });
      
      logger.info(`[PymeBot V1] Servicio seleccionado: ${servicio}`);
      
      await flowDynamic(`Has seleccionado: *${servicio}* 🎯`);
      
      // Solicitar fecha preferida
      await flowDynamic('¿Qué fecha prefieres para tu cita? (Por ejemplo: mañana, lunes, 25 de enero) 📅');
    }
  )
  .addAnswer('', 
    { capture: true },
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const fecha = ctx.body;
      await state.update({ fecha_preferida: fecha });
      
      logger.info(`[PymeBot V1] Fecha preferida: ${fecha}`);
      
      // Solicitar hora preferida
      await flowDynamic('¿A qué hora te gustaría la cita? (Por ejemplo: 10am, 3pm, tarde) ⏰');
    }
  )
  .addAnswer('', 
    { capture: true },
    async (ctx: BotContext, { state, flowDynamic }: BotMethods) => {
      const hora = ctx.body;
      await state.update({ hora_preferida: hora });
      
      logger.info(`[PymeBot V1] Hora preferida: ${hora}`);
      
      // Obtener todos los datos para el resumen
      const estadoFinal = await state.getMyState();
      const { nombre, telefono, email, servicio, fecha_preferida } = estadoFinal;
      
      // Resumen de la cita
      await flowDynamic('📋 *RESUMEN DE TU SOLICITUD DE CITA*');
      await flowDynamic([
        `👤 *Nombre:* ${nombre}`,
        `📱 *Teléfono:* ${telefono}`,
        `📧 *Email:* ${email}`,
        `🎯 *Servicio:* ${servicio}`,
        `📅 *Fecha preferida:* ${fecha_preferida}`,
        `⏰ *Hora preferida:* ${hora}`
      ]);
      
      await flowDynamic('✅ ¡Tu solicitud ha sido registrada con éxito!');
      await flowDynamic('Uno de nuestros asesores se pondrá en contacto contigo pronto para confirmar tu cita. 📞');
      await flowDynamic('¡Gracias por confiar en PymeBot! 🚀');
    }
  );

// Flujo para manejar cualquier mensaje que no sea el saludo inicial
const flowDefault = addKeyword([''])
  .addAnswer('Lo siento, no pude procesar tu mensaje. 🤔')
  .addAnswer('Para comenzar el proceso de agendamiento, por favor escribe "hola" o "inicio". 👋');

/**
 * Función principal que exporta el flujo PymeBot V1
 */
export const pymebotV1Flow = async (): Promise<{ flows: TFlow[] }> => {
  try {
    return {
      flows: [flowWelcome, flowDefault]
    };
  } catch (error) {
    logger.error('Error al crear flujo PymeBot V1:', error);
    return { flows: [] };
  }
};

export default pymebotV1Flow;