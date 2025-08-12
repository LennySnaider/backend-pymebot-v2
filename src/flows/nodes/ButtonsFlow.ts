/**
 * src/flows/nodes/ButtonsFlow.ts
 * 
 * Nodo modular para mostrar botones interactivos
 * Basado en la arquitectura V1 de PymeBot
 * 
 * IMPORTANTE: NO modificar la lógica de actualización de leads
 * PROPÓSITO: Mostrar opciones como botones y manejar selecciones
 */

import { addKeyword } from '@builderbot/bot';
import logger from '../../utils/logger';
import { processSalesFunnelActions } from '../../services/salesFunnelService';
import { replaceVariables } from '../../utils/variableReplacer';

/**
 * Configuración de un botón individual
 */
interface ButtonConfig {
  id: string;
  text: string;
  value: string;
  description?: string;
  icon?: string;
  action?: 'navigate' | 'variable' | 'custom';
  targetNodeId?: string;
  variableName?: string;
  variableValue?: string;
}

/**
 * Configuración del nodo de botones
 */
interface ButtonsNodeData {
  message: string;
  buttons: ButtonConfig[];
  allowTextInput?: boolean;
  textInputMessage?: string;
  maxSelections?: number;
  layout?: 'vertical' | 'horizontal' | 'grid';
  showNumbers?: boolean;
  timeout?: number;
  defaultSelection?: string;
}

/**
 * Flujo de botones interactivos
 * Muestra opciones como botones y captura la selección del usuario
 */
const createButtonsFlow = () => {
  return addKeyword(['BUTTONS', 'buttons', 'BOTONES', 'botones', 'OPCIONES', 'opciones'])
    .addAction(async (ctx, { flowDynamic, state, provider }) => {
      try {
        logger.info(`[ButtonsFlow] Iniciando flujo de botones para usuario: ${ctx.from}`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const tenantId = currentState.tenantId || ctx._metadata?.tenantId;
        const nodeData: ButtonsNodeData = currentState.nodeData || {};
        
        logger.info(`[ButtonsFlow] TenantId: ${tenantId}, NodeData:`, nodeData);
        
        // Validar configuración del nodo
        if (!nodeData.message || !nodeData.buttons || nodeData.buttons.length === 0) {
          logger.error(`[ButtonsFlow] Configuración incompleta del nodo de botones`);
          await flowDynamic(['Error: No hay opciones disponibles.']);
          return;
        }
        
        // Procesar mensaje con variables
        let message = nodeData.message;
        if (currentState.globalVars) {
          message = await replaceVariables(message, currentState.globalVars, tenantId, currentState.sessionId);
        }
        
        // Verificar si el provider soporta botones nativos
        const supportsNativeButtons = provider?.sendButtons && typeof provider.sendButtons === 'function';
        
        if (supportsNativeButtons) {
          // Usar botones nativos del provider
          logger.info(`[ButtonsFlow] Usando botones nativos del provider`);
          
          const nativeButtons = nodeData.buttons.map(button => ({
            body: button.text,
            payload: button.value || button.id
          }));
          
          try {
            await provider.sendButtons(ctx.from, message, nativeButtons);
            logger.info(`[ButtonsFlow] Botones nativos enviados exitosamente`);
          } catch (buttonError) {
            logger.warn(`[ButtonsFlow] Error con botones nativos, usando fallback:`, buttonError);
            await sendButtonsFallback(flowDynamic, message, nodeData.buttons, nodeData);
          }
        } else {
          // Fallback: mostrar como lista numerada
          logger.info(`[ButtonsFlow] Provider no soporta botones nativos, usando fallback`);
          await sendButtonsFallback(flowDynamic, message, nodeData.buttons, nodeData);
        }
        
        // Actualizar estado para indicar que esperamos respuesta
        await state.update({
          ...currentState,
          awaitingResponse: true,
          awaitingButtons: true,
          buttonsConfig: nodeData,
          validSelections: nodeData.buttons.map(btn => btn.value || btn.id),
          globalVars: {
            ...currentState.globalVars,
            lastButtonsMessage: message,
            availableOptions: nodeData.buttons.map(btn => btn.text).join(', ')
          }
        });
        
        logger.info(`[ButtonsFlow] Botones mostrados, esperando selección del usuario`);
        
      } catch (error) {
        logger.error(`[ButtonsFlow] Error en addAction:`, error);
        await flowDynamic(['Lo siento, ocurrió un error mostrando las opciones.']);
      }
    })
    .addAnswer('Esperando tu selección...', { capture: true }, async (ctx, { state, flowDynamic, gotoFlow }) => {
      try {
        logger.info(`[ButtonsFlow] Selección recibida de ${ctx.from}: "${ctx.body}"`);
        
        // Obtener estado actual
        const currentState = state.getMyState() || {};
        const buttonsConfig: ButtonsNodeData = currentState.buttonsConfig || {};
        const userSelection = ctx.body?.trim() || '';
        const validSelections = currentState.validSelections || [];
        
        // Procesar selección del usuario
        const selectedButton = processUserSelection(userSelection, buttonsConfig.buttons, buttonsConfig);
        
        if (!selectedButton) {
          logger.warn(`[ButtonsFlow] Selección inválida: ${userSelection}`);
          
          // Mostrar opciones válidas
          const validOptions = buttonsConfig.buttons.map((btn, index) => {
            if (buttonsConfig.showNumbers !== false) {
              return `${index + 1}. ${btn.text}`;
            }
            return `• ${btn.text}`;
          }).join('\n');
          
          const errorMessage = buttonsConfig.allowTextInput 
            ? `Opción no válida. Opciones disponibles:\n\n${validOptions}\n\nO escribe tu respuesta personalizada.`
            : `Opción no válida. Por favor selecciona una de estas opciones:\n\n${validOptions}`;
          
          await flowDynamic([errorMessage]);
          return; // Mantener el flujo en espera
        }
        
        logger.info(`[ButtonsFlow] Botón seleccionado:`, selectedButton);
        
        // Guardar selección en globalVars
        const updatedGlobalVars = {
          ...currentState.globalVars,
          lastButtonSelection: selectedButton.value || selectedButton.id,
          lastButtonText: selectedButton.text,
          lastSelectedOption: userSelection
        };
        
        // Procesar acciones del botón seleccionado
        if (selectedButton.action === 'variable' && selectedButton.variableName) {
          updatedGlobalVars[selectedButton.variableName] = selectedButton.variableValue || selectedButton.value || selectedButton.text;
          logger.info(`[ButtonsFlow] Variable actualizada: ${selectedButton.variableName} = ${updatedGlobalVars[selectedButton.variableName]}`);
        }
        
        // Actualizar estado
        await state.update({
          ...currentState,
          awaitingResponse: false,
          awaitingButtons: false,
          globalVars: updatedGlobalVars,
          selectedButton: selectedButton
        });
        
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
            logger.info(`[ButtonsFlow] Sales funnel procesado para stage: ${currentState.nodeData.salesStageId}`);
          } catch (salesError) {
            logger.error(`[ButtonsFlow] Error procesando sales funnel:`, salesError);
          }
        }
        
        // Determinar navegación siguiente
        let nextNodeId = selectedButton.targetNodeId;
        
        // Si no hay targetNodeId específico, usar el primer edge disponible
        if (!nextNodeId && currentState.nodeData?.edges && currentState.nodeData.edges.length > 0) {
          const nextEdge = currentState.nodeData.edges[0];
          nextNodeId = nextEdge.targetNode?.id;
        }
        
        if (nextNodeId) {
          logger.info(`[ButtonsFlow] Navegando al nodo: ${nextNodeId}`);
          
          // Buscar el nodo en el template
          const nextNode = currentState.templateData?.nodes?.[nextNodeId];
          if (nextNode) {
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
            
            // Determinar flujo siguiente
            const nextNodeType = nextNode.type?.toLowerCase();
            if (shouldUseModularFlow(nextNodeType)) {
              const nextFlow = getModularFlow(nextNodeType);
              if (nextFlow) {
                return gotoFlow(nextFlow);
              }
            }
          }
        }
        
        logger.info(`[ButtonsFlow] Flujo de botones completado. Selección: ${selectedButton.text}`);
        
      } catch (error) {
        logger.error(`[ButtonsFlow] Error en addAnswer:`, error);
        await flowDynamic(['Lo siento, ocurrió un error procesando tu selección.']);
      }
    });
};

/**
 * Envía botones usando fallback (lista numerada)
 */
async function sendButtonsFallback(
  flowDynamic: any, 
  message: string, 
  buttons: ButtonConfig[], 
  config: ButtonsNodeData
): Promise<void> {
  const showNumbers = config.showNumbers !== false;
  
  let buttonsList = buttons.map((button, index) => {
    let buttonText = '';
    
    if (showNumbers) {
      buttonText = `${index + 1}. `;
    } else {
      buttonText = '• ';
    }
    
    if (button.icon) {
      buttonText += `${button.icon} `;
    }
    
    buttonText += button.text;
    
    if (button.description) {
      buttonText += ` - ${button.description}`;
    }
    
    return buttonText;
  }).join('\n');
  
  let fullMessage = message + '\n\n' + buttonsList;
  
  if (config.allowTextInput) {
    fullMessage += '\n\n💬 O escribe tu respuesta personalizada';
  }
  
  if (showNumbers) {
    fullMessage += '\n\n👆 Responde con el número de tu opción';
  }
  
  await flowDynamic([fullMessage]);
}

/**
 * Procesa la selección del usuario y retorna el botón correspondiente
 */
function processUserSelection(
  userInput: string, 
  buttons: ButtonConfig[], 
  config: ButtonsNodeData
): ButtonConfig | null {
  const normalizedInput = userInput.toLowerCase().trim();
  
  // Intentar coincidencia por número (si se muestran números)
  if (config.showNumbers !== false) {
    const number = parseInt(normalizedInput);
    if (!isNaN(number) && number >= 1 && number <= buttons.length) {
      return buttons[number - 1];
    }
  }
  
  // Intentar coincidencia exacta por valor
  for (const button of buttons) {
    const buttonValue = (button.value || button.id).toLowerCase();
    if (buttonValue === normalizedInput) {
      return button;
    }
  }
  
  // Intentar coincidencia exacta por texto
  for (const button of buttons) {
    if (button.text.toLowerCase() === normalizedInput) {
      return button;
    }
  }
  
  // Intentar coincidencia parcial por texto
  for (const button of buttons) {
    if (button.text.toLowerCase().includes(normalizedInput) || normalizedInput.includes(button.text.toLowerCase())) {
      return button;
    }
  }
  
  // Si permite entrada de texto personalizada, crear botón dinámico
  if (config.allowTextInput) {
    return {
      id: 'custom_input',
      text: userInput,
      value: userInput,
      action: 'variable'
    };
  }
  
  return null;
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

export default createButtonsFlow;