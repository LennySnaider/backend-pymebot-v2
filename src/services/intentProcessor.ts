/**
 * src/services/intentProcessor.ts
 * 
 * Procesador de intenciones para manejar preguntas contextuales
 * durante el flujo de conversación
 * 
 * @version 1.0.0
 * @created 2025-05-15
 */

import logger from "../utils/logger";

interface IntentMatch {
  intent: string;
  confidence: number;
  response?: string;
}

/**
 * Detecta si el mensaje del usuario es una pregunta contextual
 * sobre información que ya fue capturada
 */
export function detectContextualQuestion(message: string, state: Record<string, any>): IntentMatch | null {
  const lowerMessage = message.toLowerCase();
  
  // Patrones para detectar preguntas sobre el nombre
  const nameQuestions = [
    /¿cu[aá]l es mi nombre/i,
    /¿c[oó]mo me llamo/i,
    /¿qui[eé]n soy/i,
    /mi nombre es/i,
    /¿sabes mi nombre/i,
    /¿recuerdas mi nombre/i
  ];
  
  // Patrones para detectar preguntas sobre el email
  const emailQuestions = [
    /¿cu[aá]l es mi (correo|email)/i,
    /¿qu[eé] (correo|email) (tengo|use|di)/i,
    /mi (correo|email) es/i
  ];
  
  // Patrones para detectar preguntas sobre el teléfono
  const phoneQuestions = [
    /¿cu[aá]l es mi (tel[eé]fono|n[uú]mero)/i,
    /¿qu[eé] (tel[eé]fono|n[uú]mero) (tengo|use|di)/i,
    /mi (tel[eé]fono|n[uú]mero) es/i
  ];
  
  // Verificar preguntas sobre el nombre
  for (const pattern of nameQuestions) {
    if (pattern.test(lowerMessage)) {
      logger.info(`Detectada pregunta contextual sobre nombre`);
      
      const nombre = state.variables?.nombre_usuario || state.nombre_usuario || state.nombre;
      if (nombre) {
        return {
          intent: 'ask_name',
          confidence: 0.9,
          response: `Tu nombre es ${nombre}.`
        };
      } else {
        return {
          intent: 'ask_name',
          confidence: 0.9,
          response: `Aún no me has dicho tu nombre. ¿Cómo te llamas?`
        };
      }
    }
  }
  
  // Verificar preguntas sobre el email
  for (const pattern of emailQuestions) {
    if (pattern.test(lowerMessage)) {
      logger.info(`Detectada pregunta contextual sobre email`);
      
      const email = state.variables?.email_usuario || state.email_usuario || state.email;
      if (email) {
        return {
          intent: 'ask_email',
          confidence: 0.9,
          response: `Tu correo electrónico es ${email}.`
        };
      } else {
        return {
          intent: 'ask_email',
          confidence: 0.9,
          response: `Aún no me has proporcionado tu correo electrónico.`
        };
      }
    }
  }
  
  // Verificar preguntas sobre el teléfono
  for (const pattern of phoneQuestions) {
    if (pattern.test(lowerMessage)) {
      logger.info(`Detectada pregunta contextual sobre teléfono`);
      
      const telefono = state.variables?.telefono_usuario || state.telefono_usuario || state.telefono;
      if (telefono) {
        return {
          intent: 'ask_phone',
          confidence: 0.9,
          response: `Tu número de teléfono es ${telefono}.`
        };
      } else {
        return {
          intent: 'ask_phone',
          confidence: 0.9,
          response: `Aún no me has proporcionado tu número de teléfono.`
        };
      }
    }
  }
  
  return null;
}

/**
 * Procesa el mensaje considerando posibles intenciones contextuales
 */
export function processMessageWithIntent(
  message: string, 
  state: Record<string, any>,
  defaultProcessor: (msg: string) => Promise<any>
): Promise<any> {
  // Primero verificamos si es una pregunta contextual
  const contextualIntent = detectContextualQuestion(message, state);
  
  if (contextualIntent && contextualIntent.response) {
    logger.info(`Respondiendo a pregunta contextual: ${contextualIntent.intent}`);
    return Promise.resolve({
      response: contextualIntent.response,
      state: state,
      metrics: { tokensUsed: Math.ceil(contextualIntent.response.length / 4) }
    });
  }
  
  // Si no es una pregunta contextual, procesamos normalmente
  return defaultProcessor(message);
}