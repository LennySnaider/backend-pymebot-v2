/**
 * backend/src/flows/mainFlow.ts
 * Flujo principal del bot que maneja la bienvenida y redirección
 * @version 1.1.0
 * @updated 2024-02-01
 */

import { addKeyword } from "@builderbot/bot";
import { faqFlow } from "./faqFlow";

/**
 * Flujo principal que se activa con palabras clave de saludo
 * y gestiona la entrada al flujo de FAQ
 */
export const mainFlow = addKeyword(["hola", "ola", "hello", "hi"]).addAnswer(
  [
    "👋 ¡Hola! Soy tu asistente virtual.",
    "Estoy aquí para ayudarte con cualquier pregunta que tengas.",
    "",
    "💭 Para comenzar, simplemente escribe tu pregunta.",
  ],
  { capture: true },
  async (ctx, { flowDynamic, gotoFlow }) => {
    // Si el usuario envió un mensaje, lo procesamos con el faqFlow
    if (ctx.body.trim().length > 0) {
      return gotoFlow(faqFlow);
    }

    await flowDynamic("Por favor, escribe tu pregunta 🤔");
    return gotoFlow(faqFlow);
  }
);
