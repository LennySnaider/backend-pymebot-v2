/**
 * src/flows/nodes/InputFlow.ts
 * 
 * Nodo modular para captura de datos del usuario
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 * PROPÓSITO: Capturar y validar datos específicos del usuario
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../../utils/logger';
import { processSalesFunnelActions } from '../../services/salesFunnelService';
import { replaceVariables } from '../../utils/variableReplacer';

/**
 * Tipos de validación soportados
 */
interface ValidationRules {
  type: 'text' | 'email' | 'phone' | 'number' | 'name' | 'custom';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customValidator?: (value: string) => boolean;
  errorMessage?: string;
}

/**
 * Configuración del nodo de entrada
 */
interface InputNodeData {
  message: string;
  variableName: string;
  validation?: ValidationRules;
  placeholder?: string;
  retryMessage?: string;
  successMessage?: string;
  maxRetries?: number;
}

/**
 * Flujo de entrada de datos
 * Captura datos específicos y los guarda en globalVars
 */
const createInputFlow = () => {
  return addKeyword(['INPUT', 'input', 'ENTRADA', 'entrada', 'CAPTURA', 'captura'])
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
      try {
        logger.info(`[InputFlow] Iniciando flujo de entrada para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const tenantId = currentState.tenantId || ctx._metadata?.tenantId;
        const nodeData: InputNodeData = currentState.nodeData || {};
        
        logger.info(`[InputFlow] TenantId: ${tenantId}, NodeData:`, nodeData);
        
        // Validar configuración del nodo
        if (!nodeData.message || !nodeData.variableName) {
          logger.error(`[InputFlow] Configuración incompleta del nodo de entrada`);
          await flowDynamic(['Error: Configuración del formulario incompleta.']);
          return;
        }
        
        // Procesar mensaje con variables
        let message = nodeData.message;
        if (currentState.globalVars) {
          message = await replaceVariables(message, currentState.globalVars, tenantId, currentState.sessionId);
        }
        
        // Agregar placeholder si existe
        if (nodeData.placeholder) {
          message += `\n\n💡 Ejemplo: ${nodeData.placeholder}`;
        }
        
        // Agregar instrucciones de validación si existen
        if (nodeData.validation) {
          const validation = nodeData.validation;
          let validationHint = '';
          
          switch (validation.type) {
            case 'email':
              validationHint = '📧 Por favor ingresa un email válido';
              break;
            case 'phone':
              validationHint = '📱 Por favor ingresa un número de teléfono válido';
              break;
            case 'number':
              validationHint = '🔢 Por favor ingresa solo números';
              break;
            case 'name':
              validationHint = '👤 Por favor ingresa tu nombre completo';
              break;
          }
          
          if (validation.minLength && validation.maxLength) {
            validationHint += ` (${validation.minLength}-${validation.maxLength} caracteres)`;
          } else if (validation.minLength) {
            validationHint += ` (mínimo ${validation.minLength} caracteres)`;
          } else if (validation.maxLength) {
            validationHint += ` (máximo ${validation.maxLength} caracteres)`;
          }
          
          if (validationHint) {
            message += `\n\n${validationHint}`;
          }
        }
        
        // Actualizar estado para indicar que esperamos respuesta
        await state.update({
          ...currentState,
          awaitingResponse: true,
          awaitingInput: true,
          inputConfig: nodeData,
          retryCount: 0,
          globalVars: {
            ...currentState.globalVars,
            lastInputField: nodeData.variableName,
            lastInputMessage: message
          }
        });
        
        // Mostrar mensaje al usuario
        await flowDynamic([message]);
        
        logger.info(`[InputFlow] Mensaje enviado, esperando respuesta para variable: ${nodeData.variableName}`);
        
      } catch (error) {
        logger.error(`[InputFlow] Error en addAction:`, error);
        await flowDynamic(['Lo siento, ocurrió un error. Por favor intenta nuevamente.']);
      }
    })
    .addAnswer('Esperando tu respuesta...', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow }) => {
      try {
        logger.info(`[InputFlow] Respuesta recibida de ${ctx.from}: "${ctx.body}"`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const inputConfig: InputNodeData = currentState.inputConfig || {};
        const userResponse = ctx.body?.trim() || '';
        const retryCount = currentState.retryCount || 0;
        const maxRetries = inputConfig.maxRetries || 3;
        
        // Validar entrada
        const validationResult = validateInput(userResponse, inputConfig.validation);
        
        if (!validationResult.isValid) {
          logger.warn(`[InputFlow] Validación fallida: ${validationResult.error}`);
          
          if (retryCount >= maxRetries) {
            logger.error(`[InputFlow] Máximo de reintentos alcanzado para ${inputConfig.variableName}`);
            await flowDynamic(['Has excedido el número máximo de intentos. Continuemos con el siguiente paso.']);
            
            // Guardar valor vacío y continuar
            await state.update({
              ...currentState,
              awaitingResponse: false,
              awaitingInput: false,
              globalVars: {
                ...currentState.globalVars,
                [inputConfig.variableName]: '',
                [`${inputConfig.variableName}_failed`]: true
              }
            });
          } else {
            // Incrementar contador de reintentos y pedir nuevamente
            const retryMessage = inputConfig.retryMessage || validationResult.error || 'Por favor intenta nuevamente.';
            await flowDynamic([retryMessage]);
            
            await state.update({
              ...currentState,
              retryCount: retryCount + 1
            });
            
            return; // Mantener el flujo en espera
          }
        } else {
          logger.info(`[InputFlow] Entrada válida recibida para ${inputConfig.variableName}: ${userResponse}`);
          
          // Guardar valor en globalVars
          await state.update({
            ...currentState,
            awaitingResponse: false,
            awaitingInput: false,
            globalVars: {
              ...currentState.globalVars,
              [inputConfig.variableName]: userResponse,
              [`${inputConfig.variableName}_validated`]: true,
              lastCapturedValue: userResponse
            }
          });
          
          // Mostrar mensaje de éxito si existe
          if (inputConfig.successMessage) {
            const successMessage = await replaceVariables(
              inputConfig.successMessage.replace('{{value}}', userResponse),
              currentState.globalVars,
              currentState.tenantId,
              currentState.sessionId
            );
            await flowDynamic([successMessage]);
          }
          
          logger.info(`[InputFlow] Valor guardado exitosamente: ${inputConfig.variableName} = ${userResponse}`);
        }
        
        // Procesar acciones del sales funnel (CRÍTICO - NO MODIFICAR)
        if (currentState.nodeData?.salesStageId) {
          try {
            await processSalesFunnelActions(
              ctx.from,
              currentState.nodeData.salesStageId,
              currentState.tenantId,
              ctx,
              { state }
            );
            logger.info(`[InputFlow] Sales funnel procesado para stage: ${currentState.nodeData.salesStageId}`);
          } catch (salesError) {
            logger.error(`[InputFlow] Error procesando sales funnel:`, salesError);
          }
        }
        
        // Navegar al siguiente nodo si existe
        if (currentState.nodeData?.edges && currentState.nodeData.edges.length > 0) {
          const nextEdge = currentState.nodeData.edges[0];
          const nextNode = nextEdge.targetNode;
          
          if (nextNode) {
            logger.info(`[InputFlow] Navegando al siguiente nodo: ${nextNode.id} (${nextNode.type})`);
            
            // Actualizar estado con el siguiente nodo
            await state.update({
              ...currentState,
              currentNodeId: nextNode.id,
              nodeData: {
                ...nextNode,
                edges: currentState.templateData?.edges?.filter(edge => edge.source === nextNode.id)?.map(edge => ({
                  ...edge,
                  targetNode: currentState.templateData?.nodes?.[edge.target]
                })) || []
              }
            });
            
            // Determinar flujo siguiente (lógica similar a mainFlow)
            const nextNodeType = nextNode.type?.toLowerCase();
            if (shouldUseModularFlow(nextNodeType)) {
              const nextFlow = getModularFlow(nextNodeType);
              if (nextFlow) {
                return gotoFlow(nextFlow);
              }
            }
          }
        }
        
        logger.info(`[InputFlow] Flujo de entrada completado para ${inputConfig.variableName}`);
        
      } catch (error) {
        logger.error(`[InputFlow] Error en addAnswer:`, error);
        await flowDynamic(['Lo siento, ocurrió un error procesando tu respuesta.']);
      }
    });
};

/**
 * Valida la entrada del usuario según las reglas especificadas
 */
function validateInput(value: string, validation?: ValidationRules): { isValid: boolean; error?: string } {
  if (!validation) {
    return { isValid: true };
  }
  
  // Verificar si es requerido
  if (validation.required && (!value || value.trim().length === 0)) {
    return { isValid: false, error: validation.errorMessage || 'Este campo es obligatorio.' };
  }
  
  // Si está vacío y no es requerido, es válido
  if (!value || value.trim().length === 0) {
    return { isValid: true };
  }
  
  const trimmedValue = value.trim();
  
  // Verificar longitud mínima
  if (validation.minLength && trimmedValue.length < validation.minLength) {
    return { 
      isValid: false, 
      error: validation.errorMessage || `Debe tener al menos ${validation.minLength} caracteres.` 
    };
  }
  
  // Verificar longitud máxima
  if (validation.maxLength && trimmedValue.length > validation.maxLength) {
    return { 
      isValid: false, 
      error: validation.errorMessage || `No puede tener más de ${validation.maxLength} caracteres.` 
    };
  }
  
  // Validaciones por tipo
  switch (validation.type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedValue)) {
        return { isValid: false, error: validation.errorMessage || 'Por favor ingresa un email válido.' };
      }
      break;
      
    case 'phone':
      const phoneRegex = /^[\d\s\-\+\(\)]{8,15}$/;
      if (!phoneRegex.test(trimmedValue.replace(/\s/g, ''))) {
        return { isValid: false, error: validation.errorMessage || 'Por favor ingresa un número de teléfono válido.' };
      }
      break;
      
    case 'number':
      if (isNaN(Number(trimmedValue))) {
        return { isValid: false, error: validation.errorMessage || 'Por favor ingresa solo números.' };
      }
      break;
      
    case 'name':
      const nameRegex = /^[a-zA-ZÀ-ÿ\s]{2,}$/;
      if (!nameRegex.test(trimmedValue)) {
        return { isValid: false, error: validation.errorMessage || 'Por favor ingresa un nombre válido.' };
      }
      break;
      
    case 'custom':
      if (validation.customValidator && !validation.customValidator(trimmedValue)) {
        return { isValid: false, error: validation.errorMessage || 'El valor ingresado no es válido.' };
      }
      break;
  }
  
  // Verificar patrón personalizado
  if (validation.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(trimmedValue)) {
      return { isValid: false, error: validation.errorMessage || 'El formato ingresado no es válido.' };
    }
  }
  
  return { isValid: true };
}

/**
 * Helper functions para compatibilidad con mainFlow
 */
function shouldUseModularFlow(nodeType: string): boolean {
  const modularNodeTypes = [
    'categories', 'categoriesnode', 'categories-node',
    'products', 'productsnode', 'products-node', 
    'message', 'messagenode', 'message-node',
    'input', 'inputnode', 'input-node',
    'buttons', 'buttonsnode', 'buttons-node'
  ];
  
  return modularNodeTypes.includes(nodeType.toLowerCase());
}

function getModularFlow(nodeType: string): any {
  // Esta función será implementada en mainFlow.ts
  // Por ahora retornamos null para evitar dependencias circulares
  return null;
}

export default createInputFlow;