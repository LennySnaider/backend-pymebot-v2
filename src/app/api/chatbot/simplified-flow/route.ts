/**
 * src/app/api/chatbot/simplified-flow/route.ts
 * 
 * Endpoint simplificado para procesamiento de flujos de chatbot
 * Esta versión garantiza el correcto funcionamiento de los flujos
 * solucionando problemas de inicio y reemplazo de variables
 * 
 * @version 1.0.0
 * @created 2025-05-13
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById } from '@/services/supabase';
import { findInitialMessage, extractNodeContent } from '@/services/chatbotUtils';
import { loadConversationState, saveConversationState } from '@/services/stateManager';
import logger from '@/utils/logger';

// ESTRUCTURAS SIMPLIFICADAS PARA MANEJO DE NODOS
interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface FlowState {
  flow_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  currentNodeId?: string;
  waitingForInput?: boolean;
  waitingNodeId?: string;
  expectedVariable?: string;
  variables: Record<string, any>;
  message_count: number;
  started_at: string;
  last_updated_at: string;
  last_user_message?: string;
  last_response?: string;
  isEndNode?: boolean;
  endMessage?: string;
  visitedNodes?: string[];
}

/**
 * Extrae las variables del mensaje y las guarda en el contexto de estado
 */
function extractVariables(message: string, state: FlowState) {
  // Patrón simple para extraer nombre
  const nombreMatch = message.match(/(?:me\s+llamo|soy|nombre\s+es)\s+([A-Za-zÀ-ÖØ-öø-ÿ]+)/i);
  if (nombreMatch && nombreMatch[1]) {
    state.variables.nombre_usuario = nombreMatch[1];
    state.variables.nombre = nombreMatch[1];
    state.variables.user_name = nombreMatch[1];
    logger.info(`Variable extraída - nombre_usuario: ${nombreMatch[1]}`);
  }
  
  // Patrones para fecha y hora (para citas)
  const fechaMatch = message.match(/(?:el|día|fecha)\s+([0-9]{1,2}\s+de\s+[a-zA-Z]+|[0-9]{1,2}\/[0-9]{1,2}(?:\/[0-9]{2,4})?)/i);
  if (fechaMatch && fechaMatch[1]) {
    state.variables.fecha_cita = fechaMatch[1];
    logger.info(`Variable extraída - fecha_cita: ${fechaMatch[1]}`);
  }
  
  const horaMatch = message.match(/(?:a las|hora)\s+([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm|hrs|horas)?)/i);
  if (horaMatch && horaMatch[1]) {
    state.variables.hora_cita = horaMatch[1];
    logger.info(`Variable extraída - hora_cita: ${horaMatch[1]}`);
  }
}

/**
 * Reemplaza las variables en el texto usando el objeto de estado
 */
function replaceVariables(text: string, state: FlowState): string {
  if (!text) return '';
  
  // Crear objeto con defaults para variables comunes
  const defaults: Record<string, string> = {
    'nombre_usuario': 'Usuario',
    'nombre': 'Usuario',
    'user_name': 'Usuario',
    'fecha_cita': '[fecha no especificada]',
    'hora_cita': '[hora no especificada]'
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
 * Procesa el flujo del chatbot avanzando al siguiente nodo
 */
async function processFlow(
  message: string, 
  state: FlowState, 
  flowData: any
): Promise<{ response: string, state: FlowState }> {
  try {
    // Verificamos que tengamos datos de flujo válidos
    if (!flowData || !flowData.nodes || !flowData.edges) {
      logger.error('Datos de flujo inválidos');
      return {
        response: 'Lo siento, hay un problema con la configuración del chatbot. Por favor, contacta al soporte.',
        state
      };
    }
    
    const nodes: FlowNode[] = flowData.nodes;
    const edges: FlowEdge[] = flowData.edges;
    
    // Si no hay nodeId actual o no estamos esperando respuesta, buscamos el nodo de inicio
    if (!state.currentNodeId || state.isEndNode) {
      // Buscamos el nodo de inicio (startNode)
      const startNode = nodes.find(node => 
        node.type === 'startNode' || 
        node.type === 'start' || 
        node.data?.type === 'startNode'
      );
      
      if (!startNode) {
        logger.error('No se encontró nodo de inicio en el flujo');
        return {
          response: 'Error: No se encontró punto de inicio en el flujo.',
          state
        };
      }
      
      // Establecemos el nodo actual como el de inicio
      state.currentNodeId = startNode.id;
      logger.info(`Estableciendo nodo inicial: ${startNode.id}`);
      
      // Inicializamos la lista de nodos visitados
      state.visitedNodes = [startNode.id];
    }
    
    // Si esperamos respuesta y tenemos variable esperada, guardamos el valor
    if (state.waitingForInput && state.expectedVariable) {
      state.variables[state.expectedVariable] = message;
      logger.info(`Guardando "${message}" en variable ${state.expectedVariable}`);
      // Limpiamos los flags de espera
      state.waitingForInput = false;
      state.waitingNodeId = undefined;
      state.expectedVariable = undefined;
    }
    
    // Buscamos el nodo actual
    const currentNode = nodes.find(node => node.id === state.currentNodeId);
    
    if (!currentNode) {
      logger.error(`No se encontró el nodo actual: ${state.currentNodeId}`);
      return {
        response: 'Error: No se pudo continuar el flujo de conversación.',
        state
      };
    }
    
    // Procesamos según el tipo de nodo
    const nodeType = currentNode.type || currentNode.data?.type || 'unknown';
    
    // FORZAR BIENVENIDA: Si es el primer mensaje y hay nodo de bienvenida, ir a él
    if (state.message_count === 1 && !state.visitedNodes?.includes('messageNode-welcome')) {
      const welcomeNode = nodes.find(node => 
        node.id === 'messageNode-welcome' || 
        node.id.toLowerCase().includes('welcome')
      );
      
      if (welcomeNode) {
        logger.info(`FORZANDO inicio desde nodo de bienvenida: ${welcomeNode.id}`);
        state.currentNodeId = welcomeNode.id;
        // Agregamos a visitados
        if (!state.visitedNodes) state.visitedNodes = [];
        state.visitedNodes.push(welcomeNode.id);
        
        // Extraemos el contenido del nodo
        const welcomeContent = extractNodeContent(welcomeNode);
        if (welcomeContent) {
          const processedContent = replaceVariables(welcomeContent, state);
          
          // Guardamos la respuesta y actualizamos estado
          state.last_response = processedContent;
          
          // Buscamos el siguiente nodo
          const nextEdge = edges.find(edge => edge.source === welcomeNode.id);
          if (nextEdge) {
            // Guardamos el nodo actual para la próxima interacción
            state.currentNodeId = nextEdge.target;
            
            // Determinamos si esperamos respuesta
            const nextNode = nodes.find(node => node.id === nextEdge.target);
            if (nextNode) {
              const nextNodeType = nextNode.type || nextNode.data?.type;
              if (nextNodeType === 'inputNode' || nextNode.data?.waitForResponse) {
                state.waitingForInput = true;
                state.waitingNodeId = nextNode.id;
                state.expectedVariable = nextNode.data?.variableName;
              }
            }
          }
          
          return {
            response: processedContent,
            state
          };
        }
      }
    }
    
    // PROCESAMIENTO SEGÚN TIPO DE NODO
    let response = '';
    let nextNodeId: string | undefined;
    
    // NODO MENSAJE - muestra un mensaje al usuario
    if (nodeType === 'messageNode' || nodeType === 'message') {
      // Extraer contenido del nodo
      const content = extractNodeContent(currentNode);
      if (content) {
        // Reemplazar variables
        response = replaceVariables(content, state);
        logger.info(`Nodo de mensaje ${currentNode.id}: "${response.substring(0, 50)}..."`);
      } else {
        response = 'Mensaje no disponible';
        logger.warn(`No se pudo extraer contenido del nodo de mensaje ${currentNode.id}`);
      }
      
      // Si es un nodo de despedida, marcarlo
      if (currentNode.id === 'messageNode-despedida' || 
          currentNode.id.toLowerCase().includes('despedida') ||
          currentNode.id.toLowerCase().includes('farewell')) {
        state.endMessage = response;
        state.isEndNode = true;
        logger.info(`Detectado nodo de despedida: ${currentNode.id}`);
      }
      
      // Ver si requiere esperar respuesta
      const waitForResponse = currentNode.data?.waitForResponse || false;
      
      if (waitForResponse) {
        state.waitingForInput = true;
        state.waitingNodeId = currentNode.id;
        logger.info(`Nodo ${currentNode.id} esperando respuesta del usuario`);
      } else {
        // Buscar siguiente nodo
        const nextEdge = edges.find(edge => edge.source === currentNode.id);
        if (nextEdge) {
          nextNodeId = nextEdge.target;
        }
      }
    }
    // NODO INPUT - solicita información al usuario
    else if (nodeType === 'inputNode' || nodeType === 'input') {
      // Extraer pregunta del nodo
      const question = currentNode.data?.question || 
                      currentNode.data?.prompt || 
                      "¿Podrías proporcionar más información?";
      
      // Reemplazar variables
      response = replaceVariables(question, state);
      
      // Configurar para esperar respuesta
      state.waitingForInput = true;
      state.waitingNodeId = currentNode.id;
      state.expectedVariable = currentNode.data?.variableName;
      
      logger.info(`Nodo de entrada ${currentNode.id}: "${response.substring(0, 50)}..."`);
    }
    // NODO CONDICIÓN - evalúa condiciones y dirige el flujo
    else if (nodeType === 'conditionNode' || nodeType === 'condition') {
      // Como no tenemos un evaluador real de condiciones en esta versión simplificada,
      // simplemente tomamos la primera salida
      const nextEdge = edges.find(edge => edge.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        logger.info(`Nodo de condición ${currentNode.id}: usando primera salida hacia ${nextNodeId}`);
      } else {
        logger.warn(`Nodo de condición ${currentNode.id} sin salidas definidas`);
        response = "No se pudo determinar cómo continuar.";
      }
    }
    // NODO FINAL - finaliza la conversación
    else if (nodeType === 'endNode' || nodeType === 'end') {
      // Marcar que es el fin del flujo
      state.isEndNode = true;
      
      // Ver si hay mensaje final específico
      const endMessage = currentNode.data?.message || 
                         "Gracias por tu tiempo. ¡Hasta pronto!";
      
      response = replaceVariables(endMessage, state);
      logger.info(`Nodo final ${currentNode.id}: "${response.substring(0, 50)}..."`);
    }
    // NODO DESCONOCIDO
    else {
      logger.warn(`Tipo de nodo desconocido: ${nodeType} (ID: ${currentNode.id})`);
      
      // Intentamos avanzar al siguiente nodo
      const nextEdge = edges.find(edge => edge.source === currentNode.id);
      if (nextEdge) {
        nextNodeId = nextEdge.target;
        logger.info(`Nodo desconocido ${currentNode.id}: continuando hacia ${nextNodeId}`);
      } else {
        response = "No se pudo procesar este paso. Contacta a soporte.";
      }
    }
    
    // Si hay un nodo siguiente y no estamos esperando respuesta, procesamos ese nodo
    if (nextNodeId && !state.waitingForInput) {
      // Actualizamos el nodo actual
      state.currentNodeId = nextNodeId;
      
      // Registramos el nodo como visitado
      if (!state.visitedNodes) state.visitedNodes = [];
      state.visitedNodes.push(nextNodeId);
      
      // Recursividad controlada: procesamos el siguiente nodo
      // Máximo 5 nodos en una secuencia para evitar bucles infinitos
      if (state.visitedNodes.length < 10) {
        // Procesamos el siguiente nodo con mensaje vacío (no es input del usuario)
        const result = await processFlow('', state, flowData);
        
        // Si el nodo actual generó una respuesta, la concatenamos
        if (response) {
          // Si ambos tienen respuesta, ponemos un salto de línea entre ellas
          if (result.response) {
            result.response = response + "\n\n" + result.response;
          } else {
            result.response = response;
          }
        }
        
        return result;
      } else {
        logger.warn(`Posible bucle infinito detectado después de ${state.visitedNodes.length} nodos`);
      }
    }
    
    // Guardamos la respuesta en el estado
    state.last_response = response;
    
    return { response, state };
  } catch (error) {
    logger.error('Error al procesar flujo:', error);
    return {
      response: 'Ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.',
      state
    };
  }
}

/**
 * Handler principal para procesar mensajes usando el flujo simplificado
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
        message_count: 0,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      };
      logger.info(`Creando nuevo estado de conversación para sesión ${sessionId}`);
    }
    
    // Incrementamos contador de mensajes
    state.message_count = (state.message_count || 0) + 1;
    state.last_user_message = text;
    state.last_updated_at = new Date().toISOString();
    
    // Inicializamos el objeto de variables si no existe
    if (!state.variables) state.variables = {};
    
    // Extraer variables del mensaje
    extractVariables(text, state);
    
    // Obtener la plantilla para usar el flujo
    let flowData: any = null;
    
    if (template_id) {
      try {
        // Obtener la plantilla
        const template = await getTemplateById(template_id);
        
        if (template && template.react_flow_json) {
          // Parsear el flujo si es necesario
          flowData = typeof template.react_flow_json === 'string' 
            ? JSON.parse(template.react_flow_json) 
            : template.react_flow_json;
            
          logger.info(`Flujo cargado desde plantilla ${template_id}: ${flowData.nodes?.length || 0} nodos`);
        } else {
          logger.warn(`La plantilla ${template_id} no existe o no tiene react_flow_json`);
        }
      } catch (error) {
        logger.error(`Error al obtener plantilla ${template_id}:`, error);
      }
    }
    
    // Si no tenemos datos de flujo, usamos un flujo básico de respaldo
    if (!flowData) {
      flowData = {
        nodes: [
          {
            id: 'startNode',
            type: 'startNode',
            data: {}
          },
          {
            id: 'messageNode-welcome',
            type: 'messageNode',
            data: {
              message: '¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte?'
            }
          },
          {
            id: 'inputNode1',
            type: 'inputNode',
            data: {
              question: '¿Cómo puedo ayudarte hoy?',
              variableName: 'consulta'
            }
          },
          {
            id: 'messageNode-response',
            type: 'messageNode',
            data: {
              message: 'Gracias por tu consulta. Un asesor se pondrá en contacto contigo pronto.'
            }
          },
          {
            id: 'messageNode-despedida',
            type: 'messageNode',
            data: {
              message: '¡Gracias por contactarnos! Estamos a tu disposición para cualquier otra consulta.'
            }
          },
          {
            id: 'endNode',
            type: 'endNode',
            data: {}
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'startNode',
            target: 'messageNode-welcome'
          },
          {
            id: 'edge-2',
            source: 'messageNode-welcome',
            target: 'inputNode1'
          },
          {
            id: 'edge-3',
            source: 'inputNode1',
            target: 'messageNode-response'
          },
          {
            id: 'edge-4',
            source: 'messageNode-response',
            target: 'messageNode-despedida'
          },
          {
            id: 'edge-5',
            source: 'messageNode-despedida',
            target: 'endNode'
          }
        ]
      };
      logger.info(`Usando flujo de respaldo`);
    }
    
    // Hora de inicio para medir tiempo de procesamiento
    const startTime = Date.now();
    
    // Procesar el mensaje con el flujo
    const { response, state: updatedState } = await processFlow(text, state, flowData);
    
    // Guardar el estado actualizado DE FORMA ASÍNCRONA (no bloqueante)
    // Esto evita que la llamada a Supabase bloquee la respuesta HTTP
    setImmediate(async () => {
      try {
        await saveConversationState(tenant_id, user_id, sessionId, updatedState);
        logger.info(`Estado guardado en BD para sesión ${sessionId} (asíncrono)`);
      } catch (saveError) {
        logger.error(`Error al guardar estado en BD (asíncrono): ${saveError}`);
      }
    });
    
    // Calcular tiempo de procesamiento
    const processingTime = Date.now() - startTime;
    
    // Calculamos tokens usados (estimación simple)
    const tokensUsed = Math.ceil(response.length / 4);
    
    // Preparamos y devolvemos la respuesta
    return NextResponse.json({
      success: true,
      response,
      is_new_conversation: isNewConversation,
      processing_time_ms: processingTime,
      tokens_used: tokensUsed,
      debug: { 
        template_id: template_id || 'default',
        currentNode: updatedState.currentNodeId,
        waitingForInput: updatedState.waitingForInput,
        isEndNode: updatedState.isEndNode,
        messageCount: updatedState.message_count
      }
    });
    
  } catch (error) {
    logger.error("Error en endpoint simplified-flow:", error);
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