/**
 * src/flows/info.flow.ts
 *
 * Flujo para responder preguntas y procesar consultas de información.
 * Maneja cualquier entrada que no sea un comando específico.
 * @version 1.0.0
 * @updated 2024-04-16
 */

import { addKeyword } from "@builderbot/bot";

/**
 * Respuestas estáticas para preguntas comunes
 * Permite responder rápidamente sin procesar cada vez
 */
const STATIC_RESPONSES = {
  "¿cómo estás?":
    "Estoy muy bien, gracias por preguntar. ¿En qué puedo ayudarte hoy?",
  "¿quién eres?":
    "Soy un asistente virtual de voz creado para ayudarte con información y responder a tus preguntas.",
  "¿qué puedes hacer?":
    "Puedo responder preguntas, proporcionar información, y ayudarte a resolver dudas. Solo necesitas preguntarme lo que necesitas saber.",
  gracias:
    "¡De nada! Estoy aquí para ayudarte. Si tienes más preguntas, no dudes en consultarme.",
  ayuda:
    "Por supuesto, puedo ayudarte. Solo dime qué información necesitas o qué pregunta tienes y haré lo posible por responderte.",
};

/**
 * Flujo principal para manejar preguntas y consultas
 * Se activa con cualquier texto que no sea capturado por otros flujos
 */
export const infoFlow = addKeyword([".*"], {
  sensitive: false,
})
  .addAction(async (ctx, { flowDynamic }) => {
    // Normalizamos el texto (minúsculas, sin acentos)
    const normalizedText = ctx.body
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Revisamos si hay una respuesta estática disponible
    for (const [key, value] of Object.entries(STATIC_RESPONSES)) {
      const normalizedKey = key
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (normalizedText.includes(normalizedKey)) {
        await flowDynamic(value);
        return;
      }
    }

    // Si no es una pregunta estática, procesamos la consulta
    let response = "Estoy analizando tu pregunta...";

    // En este punto, normalmente consultaríamos a una IA o base de conocimientos
    // para obtener una respuesta personalizada, pero para este ejemplo usamos una respuesta genérica
    response = `Gracias por tu pregunta sobre "${ctx.body}". \n\nEstoy procesando la información para darte la mejor respuesta posible.`;

    // Respondemos al usuario
    await flowDynamic(response);
  })
  .addAnswer(
    [
      "¿Hay algo más en lo que pueda ayudarte?",
      "",
      "Si necesitas información específica, solo pregúntame.",
    ],
    { delay: 1500 }
  );

export default infoFlow;
