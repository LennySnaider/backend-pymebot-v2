import logger from "../utils/logger";
import { config } from "../config";
import systemVariablesLoader from "../utils/systemVariablesLoader";

interface ChatResponse {
  text: string;
  tokens?: number;
  tokensUsed?: number;
  state?: any;
  error?: string;
}

/**
 * Procesa un mensaje de chat
 */
export async function processMessage(
  message: string,
  userId: string,
  tenantId: string,
  skipBuiltinResponse = false,
  sessionId?: string,
  botId?: string,
  templateConfig?: any,
  prevResponse?: string,
  prevTokensUsed?: number
): Promise<ChatResponse> {
  try {
    logger.info(`Processing message: "${message}" for user ${userId} in tenant ${tenantId}`);
    
    // Si tenemos una respuesta previa, usarla
    if (prevResponse) {
      logger.info(`Using previous response from BuilderBot`);
      
      // Obtener variables del sistema
      const systemVars = await systemVariablesLoader.getSystemVariablesForTenant(tenantId);
      
      let finalText = prevResponse;
      
      // Reemplazar variables del sistema
      if (systemVars) {
        for (const [key, value] of Object.entries(systemVars)) {
          const placeholder = `{{${key}}}`;
          finalText = finalText.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }
      
      return {
        text: finalText,
        tokensUsed: prevTokensUsed || 0
      };
    }
    
    // Si no hay respuesta previa, usar un mensaje más informativo
    logger.warn(`No se encontró plantilla activa para el tenant ${tenantId}. Usando mensaje por defecto.`);
    return {
      text: "Hola! Parece que no hay una plantilla de chat configurada para este servicio. Por favor, contacta al administrador para activar una plantilla de chatbot.",
      tokensUsed: 15
    };
    
  } catch (error) {
    logger.error(`Error processing message: ${error}`);
    return {
      text: "Ha ocurrido un error al procesar tu mensaje.",
      error: error instanceof Error ? error.message : 'Unknown error',
      tokensUsed: 5
    };
  }
}

/**
 * Procesa un mensaje con BuilderBot
 * @deprecated Usar processFlowMessage de flowRegistry en su lugar
 */
export async function processMessageWithBuilderBot(
  message: string,
  userId: string,
  tenantId: string,
  templateId: string
): Promise<ChatResponse> {
  logger.warn('processMessageWithBuilderBot is deprecated. Use processFlowMessage instead.');
  
  return {
    text: "Esta función está deprecada. Por favor contacta al administrador.",
    tokensUsed: 5
  };
}