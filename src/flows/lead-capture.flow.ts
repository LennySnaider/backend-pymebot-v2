import { addKeyword, createFlow } from "@builderbot/bot";

// console.log("🚀 Cargando lead-capture.flow.ts");

// Variables para controlar el estado del flujo
const flowState = new Map();

// Flujo que maneja toda la conversación  
const leadCaptureFlowDefinition = addKeyword(['INICIO', 'HOLA', 'LEAD', 'hola', 'Hola', 'HOLA'])
  .addAction(
    async (ctx, { flowDynamic, state }) => {
      const phoneNumber = ctx.from;
      const message = ctx.body.toLowerCase();
      
      // console.log(`🔵 [lead-capture] Mensaje recibido de ${phoneNumber}: ${message}`);
      
      // Obtenemos o inicializamos el estado
      const currentState = flowState.get(phoneNumber) || {
        step: 'welcome',
        data: {}
      };
      
      // console.log(`Estado actual para ${phoneNumber}:`, currentState);
      
      // Manejamos según el paso actual
      switch (currentState.step) {
        case 'welcome':
          // Si es el primer mensaje (hola), enviamos bienvenida y preguntamos nombre
          if (['hola', 'inicio', 'lead'].includes(message)) {
            await flowDynamic('👋 Hola, soy el asistente virtual de {{company_name}}. ¿En qué puedo ayudarte hoy?');
            await flowDynamic('Por favor, dime tu nombre completo para poder atenderte mejor.');
            flowState.set(phoneNumber, { step: 'waitingName', data: {} });
          }
          break;
          
        case 'waitingName':
          // Capturamos el nombre
          currentState.data.name = ctx.body;
          await flowDynamic(`Mucho gusto ${currentState.data.name}. ¿Cuál es tu correo electrónico?`);
          flowState.set(phoneNumber, { ...currentState, step: 'waitingEmail' });
          break;
          
        case 'waitingEmail':
          // Capturamos el email
          currentState.data.email = ctx.body;
          await flowDynamic([
            `Perfecto ${currentState.data.name}, he registrado tu información:`,
            `📧 Email: ${currentState.data.email}`,
            '',
            '¿En qué más puedo ayudarte?'
          ]);
          // Reiniciamos el estado para la próxima interacción
          flowState.set(phoneNumber, { step: 'completed', data: currentState.data });
          break;
          
        case 'completed':
          // Ya completamos la captura
          await flowDynamic('Gracias por tu información. ¿Hay algo más en lo que pueda ayudarte?');
          break;
          
        default:
          await flowDynamic('No entiendo tu mensaje. ¿Puedes decir "hola" para empezar?');
      }
    }
  );

const leadCaptureFlow = createFlow([leadCaptureFlowDefinition]);

export default leadCaptureFlow;