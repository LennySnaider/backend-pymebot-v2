/**
 * src/utils/compositeMessageProcessor.ts
 * 
 * Procesador de mensajes compuestos que combina texto con medios.
 * Asegura que las variables sean reemplazadas correctamente en todos los componentes.
 * 
 * @version 1.0.0
 * @created 2025-05-14
 */

import logger from './logger';
import { replaceAllVariableFormats } from './variableReplacerFix';
import { processFinalText } from './finalReplacer';

/**
 * Estructura para mensajes compuestos
 */
export interface CompositeMessage {
  text: string;
  media?: string | MediaContent;
  delay?: number;
  buttons?: Button[];
  list?: ListContent;
  type?: 'text' | 'media' | 'buttons' | 'list' | 'composite';
}

/**
 * Estructura para contenido multimedia
 */
export interface MediaContent {
  url: string;
  type?: 'image' | 'video' | 'audio' | 'document' | 'file';
  filename?: string;
  caption?: string;
}

/**
 * Estructura para botones
 */
export interface Button {
  text: string;
  value?: string;
  handle?: string;
  url?: string;
}

/**
 * Estructura para listas
 */
export interface ListContent {
  title?: string;
  buttonText?: string;
  items: ListItem[];
}

/**
 * Estructura para elementos de lista
 */
export interface ListItem {
  text: string;
  description?: string;
  value?: string;
  handle?: string;
}

/**
 * Procesa un mensaje compuesto reemplazando todas las variables en todos sus componentes
 * 
 * @param message Mensaje compuesto a procesar
 * @param variables Variables disponibles para reemplazo
 * @param tenantId ID del tenant para acceder a sus variables
 * @returns Mensaje compuesto con todas las variables reemplazadas
 */
export async function processCompositeMessage(
  message: CompositeMessage,
  variables: Record<string, any>,
  tenantId: string
): Promise<CompositeMessage> {
  try {
    const result: CompositeMessage = { ...message };
    
    // Procesar texto principal
    if (result.text) {
      result.text = await processFinalText(result.text, variables, tenantId);
    }
    
    // Procesar medios si existen
    if (result.media) {
      if (typeof result.media === 'string') {
        // Si media es una URL directa, procesamos las variables en la URL
        result.media = await processFinalText(result.media, variables, tenantId);
      } else {
        // Si es un objeto de contenido multimedia, procesamos todos sus campos
        const mediaContent: MediaContent = { ...result.media };
        
        // Procesar URL
        if (mediaContent.url) {
          mediaContent.url = await processFinalText(mediaContent.url, variables, tenantId);
        }
        
        // Procesar leyenda/caption si existe
        if (mediaContent.caption) {
          mediaContent.caption = await processFinalText(mediaContent.caption, variables, tenantId);
        }
        
        // Procesar nombre de archivo si existe
        if (mediaContent.filename) {
          mediaContent.filename = await processFinalText(mediaContent.filename, variables, tenantId);
        }
        
        result.media = mediaContent;
      }
    }
    
    // Procesar botones si existen
    if (result.buttons && Array.isArray(result.buttons)) {
      result.buttons = await Promise.all(result.buttons.map(async (button) => {
        const processedButton = { ...button };
        
        // Procesar texto del botón
        if (processedButton.text) {
          processedButton.text = await processFinalText(processedButton.text, variables, tenantId);
        }
        
        // Procesar valor si existe
        if (processedButton.value) {
          processedButton.value = await processFinalText(processedButton.value, variables, tenantId);
        }
        
        // Procesar URL si existe
        if (processedButton.url) {
          processedButton.url = await processFinalText(processedButton.url, variables, tenantId);
        }
        
        return processedButton;
      }));
    }
    
    // Procesar lista si existe
    if (result.list) {
      const listContent: ListContent = { ...result.list };
      
      // Procesar título
      if (listContent.title) {
        listContent.title = await processFinalText(listContent.title, variables, tenantId);
      }
      
      // Procesar texto del botón
      if (listContent.buttonText) {
        listContent.buttonText = await processFinalText(listContent.buttonText, variables, tenantId);
      }
      
      // Procesar elementos de la lista
      if (listContent.items && Array.isArray(listContent.items)) {
        listContent.items = await Promise.all(listContent.items.map(async (item) => {
          const processedItem = { ...item };
          
          // Procesar texto del elemento
          if (processedItem.text) {
            processedItem.text = await processFinalText(processedItem.text, variables, tenantId);
          }
          
          // Procesar descripción si existe
          if (processedItem.description) {
            processedItem.description = await processFinalText(processedItem.description, variables, tenantId);
          }
          
          // Procesar valor si existe
          if (processedItem.value) {
            processedItem.value = await processFinalText(processedItem.value, variables, tenantId);
          }
          
          return processedItem;
        }));
      }
      
      result.list = listContent;
    }
    
    return result;
  } catch (error) {
    logger.error(`Error al procesar mensaje compuesto: ${error}`);
    // En caso de error, devolvemos el mensaje original para evitar perder datos
    return message;
  }
}

/**
 * Versión sincrónica para reemplazo de variables en mensajes compuestos
 * (útil cuando no necesitamos acceder a variables del sistema)
 * 
 * @param message Mensaje compuesto a procesar
 * @param variables Variables disponibles para reemplazo
 * @returns Mensaje compuesto con variables reemplazadas
 */
export function processCompositeMessageSync(
  message: CompositeMessage,
  variables: Record<string, any>
): CompositeMessage {
  try {
    const result: CompositeMessage = { ...message };
    
    // Procesar texto principal
    if (result.text) {
      result.text = replaceAllVariableFormats(result.text, variables);
    }
    
    // Procesar medios si existen
    if (result.media) {
      if (typeof result.media === 'string') {
        // Si media es una URL directa, procesamos las variables en la URL
        result.media = replaceAllVariableFormats(result.media, variables);
      } else {
        // Si es un objeto de contenido multimedia, procesamos todos sus campos
        const mediaContent: MediaContent = { ...result.media };
        
        // Procesar URL
        if (mediaContent.url) {
          mediaContent.url = replaceAllVariableFormats(mediaContent.url, variables);
        }
        
        // Procesar leyenda/caption si existe
        if (mediaContent.caption) {
          mediaContent.caption = replaceAllVariableFormats(mediaContent.caption, variables);
        }
        
        // Procesar nombre de archivo si existe
        if (mediaContent.filename) {
          mediaContent.filename = replaceAllVariableFormats(mediaContent.filename, variables);
        }
        
        result.media = mediaContent;
      }
    }
    
    // Procesar botones si existen
    if (result.buttons && Array.isArray(result.buttons)) {
      result.buttons = result.buttons.map((button) => {
        const processedButton = { ...button };
        
        // Procesar texto del botón
        if (processedButton.text) {
          processedButton.text = replaceAllVariableFormats(processedButton.text, variables);
        }
        
        // Procesar valor si existe
        if (processedButton.value) {
          processedButton.value = replaceAllVariableFormats(processedButton.value, variables);
        }
        
        // Procesar URL si existe
        if (processedButton.url) {
          processedButton.url = replaceAllVariableFormats(processedButton.url, variables);
        }
        
        return processedButton;
      });
    }
    
    // Procesar lista si existe
    if (result.list) {
      const listContent: ListContent = { ...result.list };
      
      // Procesar título
      if (listContent.title) {
        listContent.title = replaceAllVariableFormats(listContent.title, variables);
      }
      
      // Procesar texto del botón
      if (listContent.buttonText) {
        listContent.buttonText = replaceAllVariableFormats(listContent.buttonText, variables);
      }
      
      // Procesar elementos de la lista
      if (listContent.items && Array.isArray(listContent.items)) {
        listContent.items = listContent.items.map((item) => {
          const processedItem = { ...item };
          
          // Procesar texto del elemento
          if (processedItem.text) {
            processedItem.text = replaceAllVariableFormats(processedItem.text, variables);
          }
          
          // Procesar descripción si existe
          if (processedItem.description) {
            processedItem.description = replaceAllVariableFormats(processedItem.description, variables);
          }
          
          // Procesar valor si existe
          if (processedItem.value) {
            processedItem.value = replaceAllVariableFormats(processedItem.value, variables);
          }
          
          return processedItem;
        });
      }
      
      result.list = listContent;
    }
    
    return result;
  } catch (error) {
    logger.error(`Error al procesar mensaje compuesto de forma sincrónica: ${error}`);
    // En caso de error, devolvemos el mensaje original para evitar perder datos
    return message;
  }
}

/**
 * Convierte un texto y medios a un mensaje compuesto
 * 
 * @param text Texto del mensaje
 * @param mediaUrl URL del medio (opcional)
 * @param mediaType Tipo de medio (opcional)
 * @param caption Leyenda del medio (opcional)
 * @returns Mensaje compuesto con texto y medios
 */
export function createCompositeMessage(
  text: string,
  mediaUrl?: string,
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'file',
  caption?: string
): CompositeMessage {
  const message: CompositeMessage = { text };
  
  if (mediaUrl) {
    message.media = {
      url: mediaUrl,
      type: mediaType,
      caption: caption || text // Si no hay caption, usamos el texto principal
    };
    message.type = 'composite';
  } else {
    message.type = 'text';
  }
  
  return message;
}

/**
 * Parsea un mensaje para determinar si tiene medios embebidos en el texto y crea un mensaje compuesto
 * Formatos soportados:
 * - ![alt text](https://example.com/image.jpg)
 * - !video[description](https://example.com/video.mp4)
 * - !audio[description](https://example.com/audio.mp3)
 * - !file[filename](https://example.com/document.pdf)
 * 
 * @param messageText Texto del mensaje que puede contener medios embebidos
 * @returns Mensaje compuesto si se detectan medios, o mensaje de texto simple
 */
export function parseMessageWithEmbeddedMedia(messageText: string): CompositeMessage {
  try {
    // Expresiones regulares para detectar medios embebidos
    const imageRegex = /!\[(.*?)\]\((https?:\/\/.*?(?:\.jpg|\.jpeg|\.png|\.gif)(?:\?[^)]*)?)\)/i;
    const videoRegex = /!video\[(.*?)\]\((https?:\/\/.*?(?:\.mp4|\.avi|\.mov|\.webm)(?:\?[^)]*)?)\)/i;
    const audioRegex = /!audio\[(.*?)\]\((https?:\/\/.*?(?:\.mp3|\.wav|\.ogg)(?:\?[^)]*)?)\)/i;
    const fileRegex = /!file\[(.*?)\]\((https?:\/\/.*?(?:\.pdf|\.doc|\.docx|\.txt|\.xlsx|\.pptx|\.zip)(?:\?[^)]*)?)\)/i;
    
    // Verificar si hay una imagen
    const imageMatch = messageText.match(imageRegex);
    if (imageMatch) {
      const [fullMatch, altText, imageUrl] = imageMatch;
      
      // Eliminar la referencia a la imagen del texto
      const cleanText = messageText.replace(fullMatch, '').trim();
      
      return createCompositeMessage(cleanText, imageUrl, 'image', altText);
    }
    
    // Verificar si hay un video
    const videoMatch = messageText.match(videoRegex);
    if (videoMatch) {
      const [fullMatch, description, videoUrl] = videoMatch;
      
      // Eliminar la referencia al video del texto
      const cleanText = messageText.replace(fullMatch, '').trim();
      
      return createCompositeMessage(cleanText, videoUrl, 'video', description);
    }
    
    // Verificar si hay un audio
    const audioMatch = messageText.match(audioRegex);
    if (audioMatch) {
      const [fullMatch, description, audioUrl] = audioMatch;
      
      // Eliminar la referencia al audio del texto
      const cleanText = messageText.replace(fullMatch, '').trim();
      
      return createCompositeMessage(cleanText, audioUrl, 'audio', description);
    }
    
    // Verificar si hay un archivo
    const fileMatch = messageText.match(fileRegex);
    if (fileMatch) {
      const [fullMatch, filename, fileUrl] = fileMatch;
      
      // Eliminar la referencia al archivo del texto
      const cleanText = messageText.replace(fullMatch, '').trim();
      
      return createCompositeMessage(cleanText, fileUrl, 'document', filename);
    }
    
    // Si no hay medios embebidos, devolvemos un mensaje de texto simple
    return { text: messageText, type: 'text' };
  } catch (error) {
    logger.error(`Error al parsear mensaje con medios embebidos: ${error}`);
    // En caso de error, devolvemos un mensaje de texto simple
    return { text: messageText, type: 'text' };
  }
}

export default {
  processCompositeMessage,
  processCompositeMessageSync,
  createCompositeMessage,
  parseMessageWithEmbeddedMedia
};