import { addKeyword, createFlow } from "@builderbot/bot";

// Flujo simple de captura de leads
const welcomeFlow = addKeyword(['hola', 'HOLA', 'lead', 'inicio'])
  .addAnswer('👋 Hola, soy el asistente virtual de {{company_name}}.')
  .addAnswer('¿Cómo te llamas?', { capture: true }, async (ctx, { flowDynamic, state }) => {
    await state.update({ name: ctx.body });
    // console.log(`Nombre capturado: ${ctx.body}`);
  })
  .addAnswer('¿Cuál es tu correo electrónico?', { capture: true }, async (ctx, { flowDynamic, state }) => {
    await state.update({ email: ctx.body });
    // console.log(`Email capturado: ${ctx.body}`);
  })
  .addAnswer('¡Gracias! He registrado tu información:', null, async (ctx, { flowDynamic, state }) => {
    const name = await state.get('name');
    const email = await state.get('email');
    await flowDynamic([
      `✅ Nombre: ${name}`,
      `✅ Email: ${email}`,
      '',
      '¿En qué más puedo ayudarte?'
    ]);
  });

const mainFlow = createFlow([welcomeFlow]);

export default mainFlow;