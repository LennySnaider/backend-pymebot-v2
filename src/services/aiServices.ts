/**
 * backend/src/services/aiServices.ts
 * Servicio de AI con modelo especificado
 * @version 1.0.1
 * @updated 2024-02-01
 */

import OpenAI from "openai";
import { type ChatCompletionMessageParam } from "openai/resources/chat";
import { config } from "~/config";

class AIServices {
  private static apiKey: string;
  private openAI: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API Key no proporcionada");
    }
    AIServices.apiKey = apiKey;
    this.openAI = new OpenAI({
      apiKey: AIServices.apiKey,
    });
  }

  async chat(
    prompt: string,
    messages: { role: string; content: string }[]
  ): Promise<string> {
    try {
      // Validaciones
      if (!prompt || !messages.length) {
        throw new Error("Prompt o mensajes no proporcionados");
      }

      // Formateamos los mensajes
      const formattedMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: prompt,
          name: "system",
        },
        ...messages.map((msg) => ({
          ...msg,
          role: msg.role as "user" | "assistant",
          name: msg.role as "user" | "assistant",
        })),
      ];

      // Llamada a OpenAI con modelo específico
      const completion = await this.openAI.chat.completions.create({
        model: "gpt-4o-mini", // Especificamos el modelo directamente
        messages: formattedMessages,
        temperature: config.openai.temperature ?? 0.7,
        max_tokens: config.openai.maxTokens ?? 500,
        presence_penalty: config.openai.presencePenalty ?? 0,
        frequency_penalty: config.openai.frequencyPenalty ?? 0,
      });

      const answer = completion.choices[0].message?.content;
      if (!answer) {
        throw new Error("No se recibió respuesta de OpenAI");
      }

      return answer;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        switch (error.status) {
          case 400:
            throw new Error("Error en la solicitud a OpenAI: " + error.message);
          case 401:
            throw new Error("Error de autenticación con OpenAI");
          case 429:
            throw new Error("Se ha excedido el límite de llamadas a OpenAI");
          case 500:
            throw new Error("Error en los servidores de OpenAI");
          default:
            throw new Error(
              `Error de OpenAI: ${error.status} ${error.message}`
            );
        }
      }

      if (error instanceof Error) {
        throw error;
      }

      console.error("Error al conectar con OpenAI:", error);
      throw new Error("Error inesperado al procesar la solicitud");
    }
  }
}

export default AIServices;
