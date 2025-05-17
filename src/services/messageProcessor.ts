/**
 * src/services/messageProcessor.ts
 *
 * Procesador de mensajes para el chatbot.
 * Implementa la lógica para manejar las respuestas del usuario después de nodos interactivos.
 * @version 1.0.0
 * @created 2025-05-14
 */

import { FlowNode, FlowState, RuntimeFlow, NodeType } from "../models/flow.types";
import { processButtonSelection, processListSelection, findNextNodeByHandle } from "./buttonProcessor";
import logger from "../utils/logger";
import { getNextNodeId } from "./flowProcessor";

/**
 * Procesa un mensaje del usuario con el contexto de la conversación
 * Especialmente útil para manejar respuestas a nodos interactivos (botones, listas)
 * 
 * @param message Mensaje del usuario
 * @param state Estado actual de la conversación
 * @param flow Flujo actual
 * @returns El ID del siguiente nodo a procesar, o null si no aplica
 */
export async function processUserMessage(
  message: string,
  state: FlowState,
  flow: RuntimeFlow
): Promise<string | null> {
  try {
    // Guardamos el mensaje en el contexto
    state.context.lastUserMessage = message;
    
    // Caso 1: Estado esperando respuesta a botones
    if (state.context.activeButtons && state.context.buttonNodeId) {
      // Procesamos la selección para identificar el botón elegido
      const selection = processButtonSelection(message, state.context.activeButtons);
      
      if (selection) {
        logger.info(`Usuario seleccionó botón: ${selection.selected} (${selection.handle})`);
        
        // Si hay una variable para guardar la selección, la guardamos
        if (state.context.buttonSelectionVar) {
          state.context[state.context.buttonSelectionVar] = selection.selected;
          // También guardamos el valor si existe
          if (state.context.activeButtons[selection.index].value) {
            state.context[`${state.context.buttonSelectionVar}_value`] = 
              state.context.activeButtons[selection.index].value;
          }
        }
        
        // Buscar el nodo actual
        const currentNode = flow.nodes[state.context.buttonNodeId];
        
        if (currentNode) {
          // Intentar encontrar el siguiente nodo basado en el handle seleccionado
          const nextNodeId = findNextNodeByHandle(currentNode, selection.handle);
          
          if (nextNodeId) {
            logger.info(`Avanzando a nodo ${nextNodeId} basado en selección de botón`);
            return nextNodeId;
          }
        }
      } else {
        logger.warn(`No se pudo identificar una selección de botón para: "${message}"`);
      }
    }
    
    // Caso 2: Estado esperando respuesta a lista
    if (state.context.activeListItems && state.context.listNodeId) {
      // Procesamos la selección para identificar el item elegido
      const selection = processListSelection(message, state.context.activeListItems);
      
      if (selection) {
        logger.info(`Usuario seleccionó item de lista: ${selection.selected} (${selection.handle})`);
        
        // Si hay una variable para guardar la selección, la guardamos
        if (state.context.listSelectionVar) {
          state.context[state.context.listSelectionVar] = selection.selected;
          // También guardamos el valor y descripción si existen
          if (state.context.activeListItems[selection.index].value) {
            state.context[`${state.context.listSelectionVar}_value`] = 
              state.context.activeListItems[selection.index].value;
          }
          if (state.context.activeListItems[selection.index].description) {
            state.context[`${state.context.listSelectionVar}_description`] = 
              state.context.activeListItems[selection.index].description;
          }
        }
        
        // Buscar el nodo actual
        const currentNode = flow.nodes[state.context.listNodeId];
        
        if (currentNode) {
          // Intentar encontrar el siguiente nodo basado en el handle seleccionado
          const nextNodeId = findNextNodeByHandle(currentNode, selection.handle);
          
          if (nextNodeId) {
            logger.info(`Avanzando a nodo ${nextNodeId} basado en selección de lista`);
            return nextNodeId;
          }
        }
      } else {
        logger.warn(`No se pudo identificar una selección de lista para: "${message}"`);
      }
    }
    
    // Caso 3: Procesamiento normal de mensaje
    // Simplemente verificamos si hay un siguiente nodo definido en el estado
    if (state.currentNodeId) {
      const currentNode = flow.nodes[state.currentNodeId];
      
      if (currentNode) {
        const nextNodeId = getNextNodeId(currentNode);
        if (nextNodeId) {
          logger.info(`Avanzando a nodo ${nextNodeId} después de procesar mensaje del usuario`);
          return nextNodeId;
        }
      }
    }
    
    // Si no encontramos un siguiente nodo válido, devolvemos null
    return null;
  } catch (error) {
    logger.error("Error al procesar mensaje del usuario:", error);
    return null;
  }
}

export default {
  processUserMessage,
};