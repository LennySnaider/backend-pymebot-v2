/**
 * src/flows/welcome.flow.ts
 *
 * Flujo de bienvenida que inicia la conversación y detecta saludos.
 * Proporciona una introducción al bot y explica sus capacidades.
 * @version 1.0.0
 * @updated 2024-04-16
 */

import { addKeyword } from "@builderbot/bot";
import { infoFlow } from "./info.flow";

/**
 * Palabras clave que activan el flujo de bienvenida
 * Incluye variaciones comunes de saludos en español
 */
const WELCOME_KEYWORDS = [
  "hola",
  "ola",
  "hello",
  "hi",
  "buenos días",
  "buenas tardes",
  "buenas noches",
  "saludos",
  "qué tal",
  "buen día",
  "inicio",
  "empezar",
  "ayuda",
];

/**
 * Flujo de bienvenida que se activa con palabras clave de saludo
 * Proporciona una breve introducción y guía al usuario
 */
export const welcomeFlow = addKeyword(WELCOME_KEYWORDS, {
  sensitive: false, // No distingue mayúsculas/minúsculas
})
  .addAnswer(
    ["¡Gracias por tu mensaje! ¿En qué puedo ayudarte hoy?"],
    { delay: 1000 },
    async (ctx, { flowDynamic, gotoFlow }) => {
      // Registramos el inicio de conversación
      console.log(`Nueva conversación iniciada con usuario: ${ctx.from}`);

      // Si el usuario envió un mensaje además del saludo, lo procesamos
      if (ctx.body && !WELCOME_KEYWORDS.includes(ctx.body.toLowerCase())) {
        // Si contiene una pregunta, redirigimos al flujo de información
        if (
          ctx.body.includes("?") ||
          ctx.body.includes("¿") ||
          ctx.body.length > 15
        ) {
          return gotoFlow(infoFlow);
        }
      }
    }
  )
  .addAnswer(
    "Si necesitas información específica, solo pregúntame. Estoy aquí para ayudarte. 😊",
    { delay: 1500 }
  );

export default welcomeFlow;
