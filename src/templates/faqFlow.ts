/**
 * backend/src/flows/faqFlow.ts
 * Flujo para manejar todas las interacciones con OpenAI
 * @version 1.1.0
 * @updated 2024-02-01
 */

import { addKeyword } from "@builderbot/bot";
import AIServices from "../services/aiServices";
import { config } from "~/config";
import path from "path";
import fs from "fs";

// Ruta al archivo de prompt
const pathPrompt = path.join(
  process.cwd(),
  "assets/prompts",
  "prompt_OpenAI.txt"
);

// Leemos el prompt base para OpenAI
const prompt = fs.readFileSync(pathPrompt, "utf8");

// Inicializamos el servicio de AI
let aiService: AIServices;

try {
  aiService = new AIServices(config.ApiKey);
} catch (error) {
  console.error("Error al inicializar AIServices:", error);
}

/**
 * Flujo principal para manejar preguntas y respuestas con OpenAI
 */
export const faqFlow = addKeyword(["pregunta", "consulta", "help", "ayuda"])
  .addAction(async (ctx, { flowDynamic, endFlow, state }) => {
    try {
      // Verificamos que el servicio esté inicializado
      if (!aiService) {
        return endFlow(
          "❌ El servicio de AI no está disponible en este momento."
        );
      }

      // Verificamos que haya un mensaje para procesar
      if (!ctx.body || ctx.body.trim().length === 0) {
        return endFlow("Por favor, escribe tu pregunta 🤔");
      }

      // Mostramos indicador de que estamos procesando
      await flowDynamic("Procesando tu pregunta... ⌛");

      // Procesamos la pregunta con OpenAI
      const response = await aiService.chat(prompt, [
        { role: "user", content: ctx.body },
      ]);

      // Enviamos la respuesta al usuario
      await flowDynamic(response);

      // Preguntamos si necesita algo más
      await flowDynamic([
        "¿Hay algo más en lo que pueda ayudarte?",
        "Puedes hacer otra pregunta o escribir 'salir' para terminar.",
      ]);

      // Guardamos el estado para la siguiente interacción
      const currentState = state.getMyState();
      state.update({
        ...currentState,
        lastQuestion: ctx.body,
        lastResponse: response,
      });
    } catch (error) {
      console.error("Error en faqFlow:", error);

      // Manejamos diferentes tipos de errores
      if (error instanceof Error) {
        // Si es un error conocido, usamos su mensaje
        await flowDynamic(`❌ ${error.message}`);
      } else {
        // Para errores desconocidos, mensaje genérico
        await flowDynamic(
          "❌ Lo siento, hubo un error inesperado. Por favor, intenta de nuevo."
        );
      }

      // Ofrecemos volver a intentar
      await flowDynamic([
        "¿Quieres intentar con otra pregunta?",
        "Escribe tu pregunta o 'salir' para terminar.",
      ]);
    }
  })
  // Capturamos la siguiente entrada del usuario
  .addAnswer(
    "...",
    { capture: true },
    async (ctx, { flowDynamic, endFlow, state }) => {
      // Si el usuario quiere salir
      if (ctx.body.toLowerCase() === "salir") {
        return endFlow("👋 ¡Gracias por usar nuestro servicio! Vuelve pronto.");
      }

      // Continuamos con el flujo de preguntas
      try {
        const response = await aiService.chat(prompt, [
          { role: "user", content: ctx.body },
        ]);

        await flowDynamic(response);
        await flowDynamic([
          "¿Alguna otra pregunta?",
          "Puedes hacer otra pregunta o escribir 'salir' para terminar.",
        ]);

        // Actualizamos el estado
        const currentState = state.getMyState();
        state.update({
          ...currentState,
          lastQuestion: ctx.body,
          lastResponse: response,
        });
      } catch (error) {
        console.error("Error en continuación de faqFlow:", error);
        await flowDynamic("❌ Hubo un error. ¿Quieres intentar de nuevo?");
      }
    }
  );
