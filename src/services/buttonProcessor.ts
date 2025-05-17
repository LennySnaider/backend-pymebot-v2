/**
 * src/services/buttonProcessor.ts
 *
 * Procesador de nodos de botones y listas.
 * Gestiona la lógica para mostrar y procesar elementos interactivos.
 * @version 1.0.0
 * @created 2025-05-14
 */

import { FlowNode, FlowState, NodeProcessResult, RuntimeFlow, NodeType } from "../models/flow.types";
import { ExtendedFlowState } from "../models/extendedFlow.types";
import { Button, ButtonNodeMetadata, ListItem, ListNodeMetadata, ButtonResponse, ListResponse } from "../models/button.types";
import logger from "../utils/logger";
import { replaceVariablesEnhanced } from "../utils/variableReplacerFix";
import { processFinalText } from "../utils/finalReplacer";
import { processCompositeMessage, CompositeMessage } from "../utils/compositeMessageProcessor";

/**
 * Tipo para el callback de notificación de nodos
 */
type NodeVisitCallback = (nodeId: string) => void;

/**
 * Procesa un nodo de tipo botones
 * @param node Nodo de botones a procesar
 * @param flow Flujo actual
 * @param state Estado actual del flujo
 * @param onNodeVisit Callback para notificar visita del nodo
 * @returns Resultado del procesamiento
 */
export async function processButtonsNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  try {
    // Verificar que el nodo tenga los metadatos necesarios
    if (!node.metadata) {
      logger.error(`Nodo de botones ${node.id} no tiene metadatos definidos`);
      return {
        response: "Error: Nodo de botones mal configurado. Por favor contacta al administrador.",
        error: "Nodo de botones sin metadatos",
      };
    }

    // Extraer botones de los metadatos
    const metadata = node.metadata as ButtonNodeMetadata;
    const buttons = metadata.buttons || [];

    // Si no hay botones, es un error de configuración
    if (!buttons || buttons.length === 0) {
      logger.error(`Nodo de botones ${node.id} no tiene botones configurados`);
      return {
        response: "Error: Nodo de botones sin opciones configuradas. Por favor contacta al administrador.",
        error: "Nodo de botones sin botones configurados",
      };
    }

    // Verificamos que cada botón tenga un handle válido
    for (let i = 0; i < buttons.length; i++) {
      if (!buttons[i].handle) {
        // Si no tiene handle, asignamos uno predeterminado basado en la posición
        buttons[i].handle = `handle-${i}`;
        logger.debug(`Asignando handle predeterminado '${buttons[i].handle}' al botón ${i} (${buttons[i].text})`);
      }
    }

    // Crear mensaje con los botones
    const messageText = node.content || "Por favor selecciona una opción:";
    
    // Verificamos si hay imagen o multimedia para los botones
    const imageUrl = metadata.imageUrl || (node.metadata as any)?.media || (node.metadata as any)?.image;
    
    // Creamos un mensaje compuesto con el texto y los botones
    const compositeMessage: CompositeMessage = {
      text: messageText,
      buttons: buttons,
      type: 'buttons',
    };
    
    // Si hay imagen, la agregamos al mensaje compuesto
    if (imageUrl) {
      compositeMessage.media = {
        url: imageUrl as string,
        type: 'image',
        caption: metadata.subtitle || metadata.title
      };
    }
    
    // Procesamos el mensaje compuesto con todas las variables
    // Obtenemos el tenantId del estado si está disponible
    const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
    
    try {
      // Procesamos el mensaje compuesto de forma asíncrona con todas las variables disponibles
      const processedMessage = await processCompositeMessage(compositeMessage, {
        ...state,
        ...state.context,
        ...((state as ExtendedFlowState).variables || {})
      }, tenantId);
      
      // Crear la estructura de respuesta con botones procesados
      const buttonResponse: ButtonResponse = {
        text: processedMessage.text,
        buttons: processedMessage.buttons?.map((btn, idx) => ({
          ...btn,
          id: (btn as any).id || `btn-${idx}`,
          value: btn.value || btn.text
        })) || [],
        title: metadata.title && processedMessage.buttons && processedMessage.buttons.length > 0 ? 
               processedMessage.buttons[0].text : undefined,
        subtitle: metadata.subtitle,
        imageUrl: typeof processedMessage.media === 'string' ? 
                  processedMessage.media : 
                  processedMessage.media?.url
      };
      
      // Guardar información en el estado para referencia futura
      state.context.activeButtons = buttonResponse.buttons;
      state.context.buttonNodeId = node.id;
      
      // Indicamos que estamos esperando selección del usuario
      const waitForResponse = metadata.waitForResponse !== false; // Por defecto esperamos respuesta
      
      // Registramos la actividad
      logger.info(`Nodo de botones ${node.id} procesado, esperando selección: ${waitForResponse}`);
      
      // Si hay una variable para guardar la selección, la registramos
      if (metadata.storeSelectionAs) {
        state.context.buttonSelectionVar = metadata.storeSelectionAs;
      }
      
      // Guardamos el mensaje procesado en la historia
      state.history.push(buttonResponse.text);
      
      // Devolvemos la respuesta con los botones procesados
      return {
        response: JSON.stringify(buttonResponse),
        shouldWait: waitForResponse,
        context: {
          responseType: 'buttons',
          buttonData: buttonResponse,
          compositeMessage: processedMessage // Incluimos el mensaje compuesto procesado
        },
      };
    } catch (error) {
      logger.error(`Error al procesar mensaje compuesto en botones:`, error);
      // En caso de error, aplicamos un procesamiento básico
      
      // Indicamos que estamos esperando selección del usuario
      const waitForResponse = metadata.waitForResponse !== false; // Por defecto esperamos respuesta
      
      // Preparar todas las variables disponibles
      const allVariables = {
        ...state.context,
        ...state,
        ...((state as ExtendedFlowState).variables || {}),
      };
      
      // Reemplazar variables en el texto del mensaje y de los botones
      const processedText = replaceVariablesEnhanced(messageText, allVariables);
      
      // Procesar variables en cada botón
      const processedButtons: Button[] = buttons.map((button, idx) => ({
        ...button,
        id: (button as any).id || `btn-${idx}`, // Asegurar que tenga ID
        text: replaceVariablesEnhanced(button.text, allVariables),
        value: button.value ? replaceVariablesEnhanced(button.value, allVariables) : button.text,
      }));
      
      // Crear la estructura de respuesta con botones
      const buttonResponse: ButtonResponse = {
        text: processedText,
        buttons: processedButtons,
        title: metadata.title ? replaceVariablesEnhanced(metadata.title, allVariables) : undefined,
        subtitle: metadata.subtitle ? replaceVariablesEnhanced(metadata.subtitle, allVariables) : undefined,
        imageUrl: typeof imageUrl === 'string' ? replaceVariablesEnhanced(imageUrl, allVariables) : undefined,
      };
      
      // Guardamos el texto original en la historia
      state.history.push(processedText);
      
      // Devolvemos la respuesta original
      return {
        response: JSON.stringify(buttonResponse),
        shouldWait: waitForResponse,
        context: {
          responseType: 'buttons',
          buttonData: buttonResponse,
        },
      };
    }
  } catch (error) {
    logger.error(`Error al procesar nodo de botones ${node.id}:`, error);
    return {
      response: "Lo siento, ocurrió un error al procesar las opciones.",
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Procesa un nodo de tipo lista
 * @param node Nodo de lista a procesar
 * @param flow Flujo actual
 * @param state Estado actual del flujo
 * @param onNodeVisit Callback para notificar visita del nodo
 * @returns Resultado del procesamiento
 */
export async function processListNode(
  node: FlowNode,
  flow: RuntimeFlow,
  state: ExtendedFlowState,
  onNodeVisit?: NodeVisitCallback
): Promise<NodeProcessResult> {
  try {
    // Verificar que el nodo tenga los metadatos necesarios
    if (!node.metadata) {
      logger.error(`Nodo de lista ${node.id} no tiene metadatos definidos`);
      return {
        response: "Error: Nodo de lista mal configurado. Por favor contacta al administrador.",
        error: "Nodo de lista sin metadatos",
      };
    }

    // Extraer items de los metadatos
    const metadata = node.metadata as ListNodeMetadata;
    const items = metadata.items || [];

    // Si no hay items, es un error de configuración
    if (!items || items.length === 0) {
      logger.error(`Nodo de lista ${node.id} no tiene items configurados`);
      return {
        response: "Error: Nodo de lista sin opciones configuradas. Por favor contacta al administrador.",
        error: "Nodo de lista sin items configurados",
      };
    }

    // Verificamos que cada item tenga un handle válido (al menos los primeros 5)
    for (let i = 0; i < Math.min(items.length, 5); i++) {
      if (!items[i].handle) {
        // Si no tiene handle, asignamos uno predeterminado basado en la posición
        items[i].handle = `handle-${i}`;
        logger.debug(`Asignando handle predeterminado '${items[i].handle}' al item ${i} (${items[i].text})`);
      }
    }

    // Crear mensaje con la lista
    const messageText = node.content || "Por favor selecciona una opción:";
    
    // Creamos un mensaje compuesto con el texto y la lista
    const compositeMessage: CompositeMessage = {
      text: messageText,
      list: {
        title: metadata.title,
        buttonText: metadata.buttonText || "Ver opciones",
        items: items.map(item => ({
          text: item.text,
          description: item.description,
          value: item.value,
          handle: item.handle
        }))
      },
      type: 'list'
    };
    
    // Procesamos el mensaje compuesto con todas las variables
    // Obtenemos el tenantId del estado si está disponible
    const tenantId = state.tenantId || (state.context && state.context.tenantId) || 'default';
    
    try {
      // Procesamos el mensaje compuesto de forma asíncrona con todas las variables disponibles
      const processedMessage = await processCompositeMessage(compositeMessage, {
        ...state,
        ...state.context,
        ...(state.variables || {})
      }, tenantId);
      
      // Crear la estructura de respuesta con lista procesada
      const listResponse: ListResponse = {
        text: processedMessage.text,
        listItems: processedMessage.list?.items.map((item, idx) => ({
          id: (item as any).id || `item-${idx}`, // Asegurar que tenga ID
          text: item.text,
          description: item.description,
          value: item.value,
          handle: item.handle
        })) || [],
        title: processedMessage.list?.title,
        buttonText: processedMessage.list?.buttonText || "Ver opciones",
        searchable: metadata.searchable
      };
      
      // Guardar información en el estado para referencia futura
      state.context.activeListItems = listResponse.listItems;
      state.context.listNodeId = node.id;
      
      // Indicamos que estamos esperando selección del usuario
      const waitForResponse = metadata.waitForResponse !== false; // Por defecto esperamos respuesta
      
      // Registramos la actividad
      logger.info(`Nodo de lista ${node.id} procesado, esperando selección: ${waitForResponse}`);
      
      // Si hay una variable para guardar la selección, la registramos
      if (metadata.storeSelectionAs) {
        state.context.listSelectionVar = metadata.storeSelectionAs;
      }
      
      // Guardamos el mensaje procesado en la historia
      state.history.push(processedMessage.text);
      
      // Devolvemos la respuesta con la lista procesada
      return {
        response: JSON.stringify(listResponse),
        shouldWait: waitForResponse,
        context: {
          responseType: 'list',
          listData: listResponse,
          compositeMessage: processedMessage // Incluimos el mensaje compuesto procesado
        },
      };
    } catch (error) {
      logger.error(`Error al procesar mensaje compuesto en lista:`, error);
      // En caso de error, aplicamos un procesamiento básico
      
      // Indicamos que estamos esperando selección del usuario
      const waitForResponse = metadata.waitForResponse !== false; // Por defecto esperamos respuesta
      
      // Preparar todas las variables disponibles
      const allVariables = {
        ...state.context,
        ...state,
        ...((state as ExtendedFlowState).variables || {}),
      };
      
      // Reemplazar variables en el texto del mensaje y de los items
      const processedText = replaceVariablesEnhanced(messageText, allVariables);
      
      // Procesar variables en cada item
      const processedItems: ListItem[] = items.map((item, idx) => ({
        ...item,
        id: (item as any).id || `item-${idx}`, // Asegurar que tenga ID
        text: replaceVariablesEnhanced(item.text, allVariables),
        description: item.description ? replaceVariablesEnhanced(item.description, allVariables) : undefined,
        value: item.value ? replaceVariablesEnhanced(item.value, allVariables) : undefined,
      }));
      
      // Crear la estructura de respuesta con lista
      const listResponse: ListResponse = {
        text: processedText,
        listItems: processedItems,
        title: metadata.title ? replaceVariablesEnhanced(metadata.title, allVariables) : undefined,
        buttonText: metadata.buttonText ? replaceVariablesEnhanced(metadata.buttonText, allVariables) : "Ver opciones",
        searchable: metadata.searchable,
      };
      
      // Guardamos el texto original en la historia
      state.history.push(processedText);
      
      // Devolvemos la respuesta original
      return {
        response: JSON.stringify(listResponse),
        shouldWait: waitForResponse,
        context: {
          responseType: 'list',
          listData: listResponse,
        },
      };
    }
  } catch (error) {
    logger.error(`Error al procesar nodo de lista ${node.id}:`, error);
    return {
      response: "Lo siento, ocurrió un error al procesar las opciones de lista.",
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Procesa la selección del usuario para un nodo de botones
 * @param userInput Texto ingresado por el usuario
 * @param buttons Lista de botones disponibles
 * @returns Información sobre la selección (handle, índice, texto seleccionado)
 */
export function processButtonSelection(
  userInput: string,
  buttons: Button[]
): { handle: string; index: number; selected: string } | null {
  try {
    // Normalizar el texto del usuario
    const normalizedInput = userInput.trim().toLowerCase();
    
    // Estrategia 1: Coincidencia exacta de texto o valor (case insensitive)
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (
        button.text.toLowerCase() === normalizedInput ||
        (button.value && button.value.toLowerCase() === normalizedInput)
      ) {
        return {
          handle: button.handle || `handle-${i}`,
          index: i,
          selected: button.text
        };
      }
    }
    
    // Estrategia 2: Buscar por número (si el usuario escribió "1", "2", etc.)
    const numberMatch = normalizedInput.match(/^(\d+)$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1], 10);
      // Los usuarios suelen empezar a contar desde 1, por lo que restamos 1
      const index = number - 1;
      
      if (index >= 0 && index < buttons.length) {
        return {
          handle: buttons[index].handle || `handle-${index}`,
          index: index,
          selected: buttons[index].text
        };
      }
    }
    
    // Estrategia 3: Coincidencia parcial (el texto del usuario está contenido en el botón)
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      if (
        button.text.toLowerCase().includes(normalizedInput) ||
        (button.value && button.value.toLowerCase().includes(normalizedInput))
      ) {
        return {
          handle: button.handle || `handle-${i}`,
          index: i,
          selected: button.text
        };
      }
    }
    
    // Estrategia 4: Análisis de afirmación/negación para botones tipo "Sí"/"No"
    if (buttons.length === 2) {
      // Detectar afirmaciones (Sí, OK, Claro, etc.)
      const affirmativeWords = ["si", "sí", "yes", "ok", "okay", "claro", "por supuesto", "dale", "bueno", "correcto", "confirmar", "confirmo", "acepto"];
      // Detectar negaciones (No, Nope, etc.)
      const negativeWords = ["no", "nope", "negativo", "cancelar", "cancelo", "rechazo", "declino", "nunca"];
      
      const isAffirmative = affirmativeWords.some(word => normalizedInput.includes(word));
      const isNegative = negativeWords.some(word => normalizedInput.includes(word));
      
      if (isAffirmative && !isNegative) {
        // Buscar el botón que parece afirmativo
        for (let i = 0; i < buttons.length; i++) {
          const buttonText = buttons[i].text.toLowerCase();
          if (affirmativeWords.some(word => buttonText.includes(word))) {
            return {
              handle: buttons[i].handle || `handle-${i}`,
              index: i,
              selected: buttons[i].text
            };
          }
        }
        // Si no encontramos un botón afirmativo explícito, tomamos el primero
        return {
          handle: buttons[0].handle || "handle-0",
          index: 0,
          selected: buttons[0].text
        };
      }
      
      if (isNegative && !isAffirmative) {
        // Buscar el botón que parece negativo
        for (let i = 0; i < buttons.length; i++) {
          const buttonText = buttons[i].text.toLowerCase();
          if (negativeWords.some(word => buttonText.includes(word))) {
            return {
              handle: buttons[i].handle || `handle-${i}`,
              index: i,
              selected: buttons[i].text
            };
          }
        }
        // Si no encontramos un botón negativo explícito, tomamos el segundo
        return {
          handle: buttons[1].handle || "handle-1",
          index: 1,
          selected: buttons[1].text
        };
      }
    }
    
    // Si no encontramos una coincidencia, devolvemos null
    return null;
  } catch (error) {
    logger.error("Error al procesar selección de botón:", error);
    return null;
  }
}

/**
 * Procesa la selección del usuario para un nodo de lista
 * @param userInput Texto ingresado por el usuario
 * @param items Lista de items disponibles
 * @returns Información sobre la selección (handle, índice, texto seleccionado)
 */
export function processListSelection(
  userInput: string,
  items: ListItem[]
): { handle: string; index: number; selected: string } | null {
  try {
    // Normalizar el texto del usuario
    const normalizedInput = userInput.trim().toLowerCase();
    
    // Estrategia 1: Coincidencia exacta de texto o valor (case insensitive)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        item.text.toLowerCase() === normalizedInput ||
        (item.value && item.value.toLowerCase() === normalizedInput) ||
        (item.description && item.description.toLowerCase() === normalizedInput)
      ) {
        return {
          handle: item.handle || `handle-${i}`,
          index: i,
          selected: item.text
        };
      }
    }
    
    // Estrategia 2: Buscar por número (si el usuario escribió "1", "2", etc.)
    const numberMatch = normalizedInput.match(/^(\d+)$/);
    if (numberMatch) {
      const number = parseInt(numberMatch[1], 10);
      // Los usuarios suelen empezar a contar desde 1, por lo que restamos 1
      const index = number - 1;
      
      if (index >= 0 && index < items.length) {
        return {
          handle: items[index].handle || `handle-${index}`,
          index: index,
          selected: items[index].text
        };
      }
    }
    
    // Estrategia 3: Coincidencia parcial (el texto del usuario está contenido en el item)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (
        item.text.toLowerCase().includes(normalizedInput) ||
        (item.value && item.value.toLowerCase().includes(normalizedInput)) ||
        (item.description && item.description.toLowerCase().includes(normalizedInput))
      ) {
        return {
          handle: item.handle || `handle-${i}`,
          index: i,
          selected: item.text
        };
      }
    }
    
    // Si llegamos aquí y no encontramos coincidencia, pero tenemos pocos items,
    // usamos el primero como fallback (solo para los primeros 5 que tienen handles)
    if (items.length <= 5) {
      logger.warn(`No se encontró coincidencia para "${userInput}", usando primer item como fallback`);
      return {
        handle: items[0].handle || "handle-0",
        index: 0,
        selected: items[0].text
      };
    }
    
    // Si no encontramos una coincidencia, devolvemos null
    return null;
  } catch (error) {
    logger.error("Error al procesar selección de lista:", error);
    return null;
  }
}

/**
 * Función auxiliar para encontrar la conexión correcta basada en el handle
 * @param node Nodo actual
 * @param handle Handle seleccionado (ej: "handle-0")
 * @returns ID del siguiente nodo o null si no se encuentra
 */
export function findNextNodeByHandle(
  node: FlowNode, 
  handle: string
): string | null {
  try {
    // Si el nodo tiene un field edges con las conexiones
    if ((node.metadata as any)?.edges && Array.isArray((node.metadata as any).edges)) {
      for (const edge of (node.metadata as any).edges) {
        if (edge.sourceHandle === handle) {
          return edge.target;
        }
      }
    }
    
    // Si el nodo tiene conexiones en formato next[] con nextNodeId
    if (Array.isArray(node.next)) {
      const buttons = (node.metadata as ButtonNodeMetadata)?.buttons || [];
      
      // Si tenemos un handle específico, buscamos en el array por índice
      const match = handle.match(/handle-(\d+)/);
      if (match) {
        const index = parseInt(match[1], 10);
        if (index >= 0 && index < node.next.length) {
          return node.next[index].nextNodeId;
        }
      }
      
      // Si no encontramos por índice, intentamos buscar por handle explícito
      for (let i = 0; i < node.next.length; i++) {
        if ((node.next[i] as any).handle === handle || (node.next[i] as any).sourceHandle === handle) {
          return node.next[i].nextNodeId;
        }
      }
    }
    
    // Si no encontramos una conexión específica, devolvemos el siguiente nodo genérico
    if (typeof node.next === "string") {
      return node.next;
    }
    
    if (node.nextNodeId) {
      return node.nextNodeId;
    }
    
    // Si no hay conexión, retornamos null
    return null;
  } catch (error) {
    logger.error(`Error al buscar siguiente nodo por handle ${handle}:`, error);
    return null;
  }
}

export default {
  processButtonsNode,
  processListNode,
  processButtonSelection,
  processListSelection,
  findNextNodeByHandle,
};