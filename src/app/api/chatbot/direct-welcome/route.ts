/**
 * src/app/api/chatbot/direct-welcome/route.ts
 * 
 * Endpoint optimizado para iniciar conversaciones correctamente con el nodo de bienvenida
 * Garantiza que siempre se muestre el mensaje de bienvenida primero
 * 
 * @version 1.0.0
 * @created 2025-05-13
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById } from '@/services/supabase';
import { findInitialMessage } from '@/services/chatbotUtils';
import { loadConversationState, saveConversationState } from '@/services/stateManager';
import logger from '@/utils/logger';

/**
 * Extrae las variables del mensaje y las guarda en el contexto de estado
 */
function extractVariables(message: string, state: any) {
  // Patrón simple para extraer nombre
  const nombreMatch = message.match(/(?:me\s+llamo|soy|nombre\s+es)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
  if (nombreMatch && nombreMatch[1]) {
    if (!state.variables) state.variables = {};
    state.variables.nombre_usuario = nombreMatch[1];
    state.variables.nombre = nombreMatch[1];
    state.variables.user_name = nombreMatch[1];
    logger.info(`Variable extraída - nombre_usuario: ${nombreMatch[1]}`);
  }
}

/**
 * Reemplaza las variables en el texto usando el objeto de estado
 */
function replaceVariables(text: string, state: any): string {
  if (!text) return '';
  if (!state.variables) return text;

  // Crear objeto con defaults para variables comunes
  const defaults: Record<string, string> = {
    'nombre_usuario': 'Usuario',
    'nombre': 'Usuario',
    'user_name': 'Usuario'
  };

  // Reemplazar todas las variables de la forma {{variable}}
  return text.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    const trimmedName = variableName.trim();
    
    // Primero buscar en las variables del estado
    if (state.variables[trimmedName]) {
      return state.variables[trimmedName];
    }
    // Luego en los defaults
    else if (defaults[trimmedName]) {
      return defaults[trimmedName];
    }
    // Si no se encuentra, mantener igual
    else {
      logger.debug(`Variable ${trimmedName} no encontrada, manteniendo sin cambios`);
      return match;
    }
  });
}

/**
 * Handler principal para procesar mensajes garantizando el welcome message
 */
export async function POST(request: NextRequest) {
  try {
    // Extraemos datos de la petición
    const data = await request.json();
    const { text, user_id, tenant_id, session_id, template_id } = data;

    // Validamos datos requeridos
    if (!text || !user_id || !tenant_id) {
      return NextResponse.json(
        { 
          error: 'Datos incompletos',
          message: 'Se requieren text, user_id y tenant_id' 
        },
        { status: 400 }
      );
    }

    // Generar ID de sesión si no viene en la petición
    const sessionId = session_id || `session-${user_id}-${Date.now()}`;
    logger.info(`Procesando mensaje para usuario ${user_id}, tenant ${tenant_id}, sesión ${sessionId}`);

    // Intentamos cargar el estado de conversación existente
    let state = await loadConversationState(tenant_id, user_id, sessionId);
    const isNewConversation = !state;

    // Si no existe estado, creamos uno nuevo
    if (!state) {
      state = {
        flow_id: template_id || 'default',
        session_id: sessionId,
        tenant_id,
        user_id,
        variables: {},
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        message_count: 0
      };
      logger.info(`Creando nuevo estado de conversación para sesión ${sessionId}`);
    }

    // Incrementamos contador de mensajes
    state.message_count = (state.message_count || 0) + 1;
    state.last_user_message = text;
    state.last_updated_at = new Date().toISOString();

    // Extraer variables del mensaje
    extractVariables(text, state);

    // Si es una nueva conversación, GARANTIZAMOS que se inicie con mensaje de bienvenida
    if (isNewConversation) {
      logger.info(`Nueva conversación detectada, procesando mensaje de bienvenida para template ${template_id || 'default'}`);
      
      // Verificamos si hay un template específico a usar
      let welcomeMessage = "¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?";
      
      if (template_id) {
        try {
          // Obtener la plantilla
          const template = await getTemplateById(template_id);
          
          if (template && template.react_flow_json) {
            // Extraer el mensaje inicial del template
            let flowJson = typeof template.react_flow_json === 'string' 
              ? JSON.parse(template.react_flow_json) 
              : template.react_flow_json;
            
            const extractResult = findInitialMessage(flowJson);
            
            if (extractResult && extractResult.message) {
              welcomeMessage = extractResult.message;
              logger.info(`Mensaje de bienvenida extraído del template: "${welcomeMessage.substring(0, 50)}..."`);
            } else {
              logger.warn(`No se pudo extraer mensaje inicial de la plantilla ${template_id}, usando mensaje por defecto`);
            }
          } else {
            logger.warn(`La plantilla ${template_id} no existe o no tiene react_flow_json`);
          }
        } catch (error) {
          logger.error(`Error al obtener plantilla ${template_id}:`, error);
        }
      }
      
      // Reemplazamos variables en el mensaje de bienvenida
      welcomeMessage = replaceVariables(welcomeMessage, state);
      
      // Guardar el nodo actual como "messageNode-welcome" para seguir el flujo correctamente
      state.currentNodeId = 'messageNode-welcome';
      state.waitingForInput = true; // Marcamos que esperamos respuesta después del welcome
      
      // Guardar el estado actualizado DE FORMA ASÍNCRONA (no bloqueante)
      // Esto evita que la llamada a Supabase bloquee la respuesta HTTP
      setImmediate(async () => {
        try {
          await saveConversationState(tenant_id, user_id, sessionId, state);
          logger.info(`Estado guardado en BD para sesión ${sessionId} (asíncrono)`);
        } catch (saveError) {
          logger.error(`Error al guardar estado en BD (asíncrono): ${saveError}`);
        }
      });
      
      // Devolver la respuesta de bienvenida
      return NextResponse.json({
        success: true,
        response: welcomeMessage,
        is_new_conversation: true,
        processing_time_ms: 0,
        tokens_used: Math.ceil(welcomeMessage.length / 4), // Estimación simple
        debug: { template_id: template_id || 'default' }
      });
    }
    
    // Si no es nueva conversación, procesamos el mensaje normal
    // Este es un procesamiento simplificado que solo devuelve una respuesta básica
    // En una implementación completa, aquí se procesaría el flujo basado en el estado actual
    
    // Por ahora, solo devolvemos una respuesta simple para pruebas
    const response = `He recibido tu mensaje: "${text}". Estamos procesando tu solicitud.`;
    
    // Actualizar el estado
    state.last_response = response;
    state.last_updated_at = new Date().toISOString();
    
    // Guardar el estado actualizado DE FORMA ASÍNCRONA (no bloqueante)
    // Esto evita que la llamada a Supabase bloquee la respuesta HTTP
    setImmediate(async () => {
      try {
        await saveConversationState(tenant_id, user_id, sessionId, state);
        logger.info(`Estado guardado en BD para sesión ${sessionId} (asíncrono)`);
      } catch (saveError) {
        logger.error(`Error al guardar estado en BD (asíncrono): ${saveError}`);
      }
    });
    
    return NextResponse.json({
      success: true,
      response,
      is_new_conversation: false,
      processing_time_ms: 0,
      tokens_used: Math.ceil(response.length / 4), // Estimación simple
      debug: { template_id: template_id || 'default' }
    });
    
  } catch (error) {
    logger.error("Error en endpoint direct-welcome:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Error al procesar mensaje",
        fallback_response: "Lo siento, estoy experimentando dificultades técnicas. Por favor, inténtalo de nuevo."
      },
      { status: 200 } // Devolvemos 200 para que el frontend muestre el fallback
    );
  }
}