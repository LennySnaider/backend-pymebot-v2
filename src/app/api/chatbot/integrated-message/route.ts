/**
 * src/app/api/chatbot/integrated-message/route.ts
 * 
 * Endpoint integrado para procesamiento de mensajes del chatbot
 * Unifica todas las mejoras y optimizaciones para solucionar los problemas
 * 
 * @version 1.0.1
 * @updated 2025-05-14
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById, logMessage, incrementUsage } from '@/services/supabase';
import { findInitialMessage, extractNodeContent } from '@/services/chatbotUtils';
import { loadConversationState, saveConversationState } from '@/services/stateManager';
import { replaceVariables, extractVariablesFromMessage, updateStateWithVariables } from '@/utils/variableReplacer';
import { getSystemVariablesForTenant, processTextWithSystemVariables } from '@/utils/systemVariablesLoader';
import { forceReplaceCompanyName, fixButtonNodeSelection } from '@/utils/companyNameFix';
import logger from '@/utils/logger';
import { config } from '@/config';
import { processSalesFunnelActions } from '@/services/salesFunnelService';

// ESTRUCTURAS PARA MANEJO DE NODOS Y FLUJOS
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
  bot_id?: string;
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
  confirmation_message?: string;
  buttonOptions?: Array<{label: string, value: string}>;
  specialButtonNode?: string; // Para trackear nodos especiales como buttonsNode-1747166931506
}

/**
 * Busca el nodo de bienvenida en un flujo
 */
function findWelcomeNode(nodes: FlowNode[]): FlowNode | undefined {
  // Intentamos varios patrones para identificar el nodo de bienvenida
  return nodes.find(node => 
    node.id === 'messageNode-welcome' || 
    node.id.toLowerCase().includes('welcome') ||
    node.id.toLowerCase().includes('inicio') ||
    node.id.toLowerCase().includes('bienvenida') ||
    (node.data?.title && (
      node.data.title.toLowerCase().includes('welcome') ||
      node.data.title.toLowerCase().includes('bienvenida')
    ))
  );
}

/**
 * Busca las conexiones que salen de un nodo
 */
function findOutgoingConnections(nodeId: string, edges: FlowEdge[]): FlowEdge[] {
  return edges.filter(edge => edge.source === nodeId);
}

/**
 * Procesa el flujo del chatbot avanzando al siguiente nodo
 */
async function processFlow(
  message: string, 
  state: FlowState, 
  flowData: any,
  isNewConversation: boolean
): Promise<{ 
  response: string, 
  state: FlowState,
  multipleResponses?: string[] 
}> {
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
    
    // INICIAR NUEVA CONVERSACIÓN - comenzamos siempre por la bienvenida
    if (isNewConversation) {
      logger.info(`NUEVA CONVERSACIÓN: Iniciando flujo desde punto de bienvenida`);
      
      // Buscamos primero un nodo específico de bienvenida
      const welcomeNode = findWelcomeNode(nodes);
      
      if (welcomeNode) {
        logger.info(`Usando nodo de bienvenida: ${welcomeNode.id}`);
        
        // Extraemos el contenido del nodo
        const welcomeContent = extractNodeContent(welcomeNode);
        if (welcomeContent) {
          // SOLUCIÓN DIRECTA: Reemplazar company_name usando la nueva utilidad
          let processedContent = welcomeContent;
          
          // Primero verificamos si contiene la variable company_name
          if (welcomeContent.includes('{{company_name}}')) {
            try {
              // Usamos nuestra utilidad especializada
              processedContent = await forceReplaceCompanyName(welcomeContent, state.tenant_id);
              logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en mensaje de bienvenida`);
            } catch (companyNameError) {
              // Si falla, usamos el método normal
              processedContent = replaceVariables(welcomeContent, state.variables);
              logger.error(`Error al reemplazar company_name: ${companyNameError}`);
            }
          } else {
            // Si no contiene la variable problemática, usar el método normal
            processedContent = replaceVariables(welcomeContent, state.variables);
          }
          
          // Guardamos el nodo actual y la respuesta en el estado
          state.currentNodeId = welcomeNode.id;
          state.last_response = processedContent;
          
          // Inicializamos la lista de nodos visitados
          state.visitedNodes = [welcomeNode.id];
          
          // Buscamos el siguiente nodo después de la bienvenida
          const outEdges = findOutgoingConnections(welcomeNode.id, edges);
          
          // Si hay un nodo siguiente, lo configuramos para la próxima interacción
          if (outEdges.length > 0) {
            const nextNodeId = outEdges[0].target;
            const nextNode = nodes.find(node => node.id === nextNodeId);
            
            if (nextNode) {
              const nextNodeType = nextNode.type || nextNode.data?.type;
              
              // Determinamos si debemos continuar automáticamente
              if (nextNodeType === 'inputNode' && nextNode.data?.question) {
                // Si es un nodo de entrada, preparamos la pregunta como mensaje adicional
                // para enviarla de inmediato junto con la bienvenida
                
                // Extraemos la pregunta
                const questionContent = nextNode.data.question;
                
                // SOLUCIÓN DIRECTA: Reemplazar también company_name en la pregunta
                let processedQuestion = questionContent;
                if (questionContent.includes('{{company_name}}')) {
                  try {
                    processedQuestion = await forceReplaceCompanyName(questionContent, state.tenant_id);
                    logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en pregunta`);
                  } catch (companyNameError) {
                    processedQuestion = replaceVariables(questionContent, state.variables);
                    logger.error(`Error al reemplazar company_name en pregunta: ${companyNameError}`);
                  }
                } else {
                  processedQuestion = replaceVariables(questionContent, state.variables);
                }
                
                // Configuramos el estado para esperar respuesta
                state.currentNodeId = nextNodeId;
                state.waitingForInput = true;
                state.waitingNodeId = nextNodeId;
                state.expectedVariable = nextNode.data.variableName;
                state.visitedNodes.push(nextNodeId);
                
                // Devolvemos tanto la bienvenida como la pregunta
                return {
                  response: processedContent,
                  state,
                  multipleResponses: [processedContent, processedQuestion]
                };
              } else if (nextNodeType === 'messageNode') {
                // Si es otro nodo de mensaje, no hacemos nada especial
                // La próxima interacción lo procesará
                logger.info(`Próximo nodo después de bienvenida es un mensaje: ${nextNodeId}`);
              }
            }
          }
          
          // Si no continuamos automáticamente, devolvemos solo la bienvenida
          return {
            response: processedContent,
            state
          };
        }
      } else {
        // Si no hay nodo de bienvenida específico, buscamos el nodo inicial
        logger.info(`No se encontró nodo de bienvenida, buscando nodo de inicio`);
        
        const startNode = nodes.find(node => 
          node.type === 'startNode' || 
          node.type === 'start' || 
          node.data?.type === 'startNode'
        );
        
        if (startNode) {
          // Configuramos el nodo inicial
          state.currentNodeId = startNode.id;
          state.visitedNodes = [startNode.id];
          
          // Buscamos el primer nodo después del inicio
          const outEdges = findOutgoingConnections(startNode.id, edges);
          
          if (outEdges.length > 0) {
            const firstNodeId = outEdges[0].target;
            const firstNode = nodes.find(node => node.id === firstNodeId);
            
            if (firstNode) {
              // Configuramos el primer nodo real como actual
              state.currentNodeId = firstNodeId;
              state.visitedNodes.push(firstNodeId);
              
              // Extraemos el contenido según el tipo de nodo
              const nodeType = firstNode.type || firstNode.data?.type;
              
              if (nodeType === 'messageNode' || nodeType === 'message') {
                const nodeContent = extractNodeContent(firstNode);
                if (nodeContent) {
                  // SOLUCIÓN DIRECTA: Reemplazar company_name
                  let processedContent = nodeContent;
                  if (nodeContent.includes('{{company_name}}')) {
                    try {
                      processedContent = await forceReplaceCompanyName(nodeContent, state.tenant_id);
                      logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en primer nodo`);
                    } catch (companyNameError) {
                      processedContent = replaceVariables(nodeContent, state.variables);
                      logger.error(`Error al reemplazar company_name en primer nodo: ${companyNameError}`);
                    }
                  } else {
                    processedContent = replaceVariables(nodeContent, state.variables);
                  }
                  
                  state.last_response = processedContent;
                  
                  // Buscamos el siguiente nodo para posible auto-flow
                  const nextOutEdges = findOutgoingConnections(firstNodeId, edges);
                  
                  if (nextOutEdges.length > 0) {
                    const nextNodeId = nextOutEdges[0].target;
                    const nextNode = nodes.find(node => node.id === nextNodeId);
                    
                    if (nextNode) {
                      const nextNodeType = nextNode.type || nextNode.data?.type;
                      
                      // Auto-flow para nodos de input
                      if (nextNodeType === 'inputNode' && nextNode.data?.question) {
                        // Extraemos la pregunta
                        const questionContent = nextNode.data.question;
                        
                        // SOLUCIÓN DIRECTA: Reemplazar company_name en la pregunta
                        let processedQuestion = questionContent;
                        if (questionContent.includes('{{company_name}}')) {
                          try {
                            processedQuestion = await forceReplaceCompanyName(questionContent, state.tenant_id);
                            logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en pregunta de auto-flow`);
                          } catch (companyNameError) {
                            processedQuestion = replaceVariables(questionContent, state.variables);
                            logger.error(`Error al reemplazar company_name en pregunta de auto-flow: ${companyNameError}`);
                          }
                        } else {
                          processedQuestion = replaceVariables(questionContent, state.variables);
                        }
                        
                        // Configuramos el estado para esperar respuesta
                        state.currentNodeId = nextNodeId;
                        state.waitingForInput = true;
                        state.waitingNodeId = nextNodeId;
                        state.expectedVariable = nextNode.data.variableName;
                        state.visitedNodes.push(nextNodeId);
                        
                        // Devolvemos tanto el mensaje inicial como la pregunta
                        return {
                          response: processedContent,
                          state,
                          multipleResponses: [processedContent, processedQuestion]
                        };
                      }
                    }
                  }
                  
                  // Si no hay auto-flow, devolvemos solo el mensaje
                  return {
                    response: processedContent,
                    state
                  };
                }
              } else if (nodeType === 'inputNode') {
                // Si el primer nodo real es de entrada, configuramos para esperar respuesta
                const question = firstNode.data?.question || 
                                firstNode.data?.prompt || 
                                "¿En qué puedo ayudarte?";
                                
                // SOLUCIÓN DIRECTA: Reemplazar company_name en la pregunta
                let processedQuestion = question;
                if (question.includes('{{company_name}}')) {
                  try {
                    processedQuestion = await forceReplaceCompanyName(question, state.tenant_id);
                    logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en pregunta de entrada`);
                  } catch (companyNameError) {
                    processedQuestion = replaceVariables(question, state.variables);
                    logger.error(`Error al reemplazar company_name en pregunta de entrada: ${companyNameError}`);
                  }
                } else {
                  processedQuestion = replaceVariables(question, state.variables);
                }
                
                state.waitingForInput = true;
                state.waitingNodeId = firstNodeId;
                state.expectedVariable = firstNode.data?.variableName;
                state.last_response = processedQuestion;
                
                return {
                  response: processedQuestion,
                  state
                };
              }
            }
          }
        }
      }
      
      // Si no encontramos nodo inicial adecuado, usamos un mensaje por defecto
      logger.warn('No se pudo determinar un punto de inicio adecuado en el flujo');
      return {
        response: "¡Hola! Soy el asistente virtual. ¿En qué puedo ayudarte hoy?",
        state
      };
    }
    
    // CONTINUACIÓN DE CONVERSACIÓN
    
    // Si esperamos respuesta y tenemos variable esperada, guardamos el valor
    if (state.waitingForInput && state.expectedVariable) {
      state.variables[state.expectedVariable] = message;
      logger.info(`Guardando "${message}" en variable ${state.expectedVariable}`);
      // Limpiamos los flags de espera
      state.waitingForInput = false;
      state.waitingNodeId = undefined;
    }
    // Si estamos esperando una selección de botones
    else if (state.waitingForInput && state.waitingNodeId && state.buttonOptions) {
      // SOLUCIÓN DIRECTA PARA NODO PROBLEMÁTICO
      // Detectar si estamos procesando el nodo problemático buttonsNode-1747166931506
      const isTargetNode = state.waitingNodeId === 'buttonsNode-1747166931506';
      let selectedOption = null;
      let selectedIndex = -1;
      
      // Para el nodo específico problemático, usar nuestra utilidad especializada
      if (isTargetNode) {
        // Aplicar solución específica para este nodo
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Aplicando fix para nodo buttonsNode-1747166931506`);
        selectedIndex = fixButtonNodeSelection(message, true);
        
        if (selectedIndex >= 0 && selectedIndex < state.buttonOptions.length) {
          selectedOption = state.buttonOptions[selectedIndex];
          logger.info(`Solución directa seleccionó opción ${selectedIndex + 1}: ${selectedOption.label || selectedOption.value}`);
        }
      } else {
        // Para otros nodos, seguir con detección normal
        // Intenta encontrar la opción seleccionada
        const userResponse = message.toLowerCase().trim();
        const buttons = state.buttonOptions;
        
        // 1. Buscar por coincidencia exacta
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          const buttonLabel = String(button.label || "").toLowerCase();
          const buttonValue = String(button.value || "").toLowerCase();
          
          if (userResponse === buttonLabel || userResponse === buttonValue) {
            selectedOption = button;
            selectedIndex = i;
            logger.info(`Coincidencia exacta con botón ${i + 1}: ${button.label || button.value}`);
            break;
          }
        }
        
        // 2. Buscar por número (si respondió con el número de la opción)
        if (selectedIndex === -1) {
          const numMatch = /^(\d+)$/.exec(userResponse);
          if (numMatch && numMatch[1]) {
            const num = parseInt(numMatch[1], 10);
            if (num > 0 && num <= buttons.length) {
              selectedIndex = num - 1; // Ajustar al índice base-0
              selectedOption = buttons[selectedIndex];
              logger.info(`Seleccionada opción ${num} por número`);
            }
          }
        }
        
        // 3. Buscar por coincidencia parcial
        if (selectedIndex === -1) {
          for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const buttonLabel = String(button.label || "").toLowerCase();
            const buttonValue = String(button.value || "").toLowerCase();
            
            if (buttonLabel.includes(userResponse) || 
                userResponse.includes(buttonLabel) ||
                buttonValue.includes(userResponse) ||
                userResponse.includes(buttonValue)) {
              selectedOption = button;
              selectedIndex = i;
              logger.info(`Coincidencia parcial con botón ${i + 1}: ${button.label || button.value}`);
              break;
            }
          }
        }
      }
      
      // Si encontramos una opción, guardamos el valor seleccionado
      if (selectedOption) {
        // Guardar la selección en el estado
        state.variables.lastButtonSelection = selectedOption.value;
        state.variables.lastButtonLabel = selectedOption.label;
        state.variables.lastUserResponse = message; // También guardar texto original
        
        // SOLUCIÓN DIRECTA para buttonsNode-1747166931506
        if (state.waitingNodeId === 'buttonsNode-1747166931506') {
          // Verificamos que existe el nodo en la definición del flujo
          const buttonNode = nodes.find(node => node.id === 'buttonsNode-1747166931506');
          if (!buttonNode) {
            logger.error(`⚠️ ERROR CRÍTICO: Nodo buttonsNode-1747166931506 no encontrado en la definición del flujo`);
          }
          
          // Obtenemos el nombre de handle normalizado usando nuestra utilidad
          const sourceHandleId = getSourceHandleId('buttonsNode-1747166931506', selectedIndex);
          
          // PRIMERA ESTRATEGIA: Buscar conexión exacta con sourceHandle específico
          let targetEdge = edges.find(edge => 
            edge.source === 'buttonsNode-1747166931506' && 
            edge.sourceHandle === sourceHandleId);
          
          // SEGUNDA ESTRATEGIA: Si no encontramos conexión exacta, intentar sin el prefijo "handle-"
          if (!targetEdge) {
            targetEdge = edges.find(edge => 
              edge.source === 'buttonsNode-1747166931506' && 
              edge.sourceHandle === `${selectedIndex}`);
            
            if (targetEdge) {
              logger.info(`⚠️ Encontrada conexión usando sourceHandle="${selectedIndex}" (sin prefijo handle-)`);
            }
          }
          
          // TERCERA ESTRATEGIA: Intenta diferentes formatos de sourceHandle
          if (!targetEdge) {
            // Probar con "sourceHandle" en diferentes formatos
            const alternativeHandles = [
              `button-${selectedIndex}`, 
              `option-${selectedIndex}`, 
              `source-${selectedIndex}`,
              `${selectedIndex}`
            ];
            
            for (const handleFormat of alternativeHandles) {
              targetEdge = edges.find(edge => 
                edge.source === 'buttonsNode-1747166931506' && 
                edge.sourceHandle === handleFormat);
              
              if (targetEdge) {
                logger.info(`⚠️ Encontrada conexión usando formato alternativo sourceHandle="${handleFormat}"`);
                break;
              }
            }
          }
          
          // Si encontramos alguna conexión específica, la usamos
          if (targetEdge) {
            const nextNodeId = targetEdge.target;
            // Actualizar nodo actual
            state.currentNodeId = nextNodeId;
            if (!state.visitedNodes) state.visitedNodes = [];
            state.visitedNodes.push(nextNodeId);
            
            // Limpiar estado específico del nodo problemático
            state.specialButtonNode = undefined;
            
            logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición exitosa a ${nextNodeId} usando sourceHandle-${selectedIndex}`);
          } else {
            // CUARTA ESTRATEGIA: Buscar todas las conexiones salientes y seleccionar la adecuada
            const outEdges = findOutgoingConnections(state.waitingNodeId, edges);
            
            logger.warn(`⚠️ No se encontró conexión específica. Hay ${outEdges.length} conexiones salientes desde el nodo problemático`);
            
            // Conexiones más específicas según la selección
            if (selectedIndex === 0) { // Para "Sí"
              // Si es "Sí", buscamos el nodo que tenga que ver con citas o fechas
              const dateNodeEdge = outEdges.find(edge => {
                const target = nodes.find(node => node.id === edge.target);
                return target && (
                  target.id.toLowerCase().includes('fecha') || 
                  target.id.toLowerCase().includes('date') ||
                  target.id.toLowerCase().includes('hora') ||
                  target.id.toLowerCase().includes('time') ||
                  target.id.toLowerCase().includes('cita') ||
                  target.id.toLowerCase().includes('appointment')
                );
              });
              
              if (dateNodeEdge) {
                const nextNodeId = dateNodeEdge.target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a nodo de fecha/cita ${nextNodeId} para opción "Sí"`);
              }
              // Si no encontramos nodo de fecha, usamos el índice si es posible
              else if (outEdges.length > selectedIndex) {
                const nextNodeId = outEdges[selectedIndex].target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a nodo ${nextNodeId} usando índice ${selectedIndex}`);
              }
              // Si todo lo demás falla, usamos la primera conexión
              else if (outEdges.length > 0) {
                const nextNodeId = outEdges[0].target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a primer nodo disponible ${nextNodeId} para opción "Sí"`);
              }
            } 
            else if (selectedIndex === 1) { // Para "No"
              // Si es "No", buscamos el nodo que tenga que ver con "no cita" o despedida
              const noAppointmentEdge = outEdges.find(edge => {
                const target = nodes.find(node => node.id === edge.target);
                return target && (
                  target.id.toLowerCase().includes('no-cita') || 
                  target.id.toLowerCase().includes('nocita') ||
                  target.id.toLowerCase().includes('no_cita') ||
                  target.id.toLowerCase().includes('despedida') ||
                  target.id.toLowerCase().includes('farewell')
                );
              });
              
              if (noAppointmentEdge) {
                const nextNodeId = noAppointmentEdge.target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a nodo de no-cita ${nextNodeId} para opción "No"`);
              }
              // Si no hay nodo especial de no-cita, intentamos con el índice
              else if (outEdges.length > selectedIndex) {
                const nextNodeId = outEdges[selectedIndex].target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a nodo ${nextNodeId} usando índice ${selectedIndex} para "No"`);
              }
              // Si todo lo demás falla, buscamos cualquier conexión que no sea la primera
              else if (outEdges.length > 1) {
                const nextNodeId = outEdges[1].target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a segunda conexión ${nextNodeId} para opción "No"`);
              }
              // Si sólo hay una conexión, la usamos
              else if (outEdges.length > 0) {
                const nextNodeId = outEdges[0].target;
                state.currentNodeId = nextNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(nextNodeId);
                
                logger.info(`⚠️ SOLUCIÓN DIRECTA: Transición a única conexión disponible ${nextNodeId} para "No"`);
              }
            }
            
            // Si después de todo no hemos encontrado un próximo nodo, usar estrategia de último recurso
            if (!state.currentNodeId || state.currentNodeId === 'buttonsNode-1747166931506') {
              // USAR INFORMACIÓN PRECARGADA si está disponible
              if (selectedIndex === 0 && state.variables.tempYesNodeId) {
                state.currentNodeId = state.variables.tempYesNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(state.variables.tempYesNodeId);
                
                logger.info(`⚠️ ÚLTIMO RECURSO: Usando nodo precargado para "Sí": ${state.variables.tempYesNodeId}`);
              }
              else if (selectedIndex === 1 && state.variables.tempNoNodeId) {
                state.currentNodeId = state.variables.tempNoNodeId;
                if (!state.visitedNodes) state.visitedNodes = [];
                state.visitedNodes.push(state.variables.tempNoNodeId);
                
                logger.info(`⚠️ ÚLTIMO RECURSO: Usando nodo precargado para "No": ${state.variables.tempNoNodeId}`);
              }
              else {
                // IDENTIFICACIÓN DIRECTA DE NODOS OBJETIVO SEGÚN EL FLUJO
                const targetInputFechaNode = nodes.find(node => node.id === 'inputNode-fecha');
                const targetNoCitaNode = nodes.find(node => node.id === 'messageNode-no-cita');
                
                if (selectedIndex === 0 && targetInputFechaNode) {
                  state.currentNodeId = targetInputFechaNode.id;
                  if (!state.visitedNodes) state.visitedNodes = [];
                  state.visitedNodes.push(targetInputFechaNode.id);
                  
                  logger.info(`⚠️ ÚLTIMO RECURSO: Forzando transición a inputNode-fecha para opción "Sí"`);
                }
                else if (selectedIndex === 1 && targetNoCitaNode) {
                  state.currentNodeId = targetNoCitaNode.id;
                  if (!state.visitedNodes) state.visitedNodes = [];
                  state.visitedNodes.push(targetNoCitaNode.id);
                  
                  logger.info(`⚠️ ÚLTIMO RECURSO: Forzando transición a messageNode-no-cita para opción "No"`);
                }
                else {
                  logger.error(`⚠️ FALLO CRÍTICO: No se pudo determinar siguiente nodo para buttonsNode-1747166931506`);
                  
                  // Último esfuerzo: Intento buscar nodos por nombre parcial
                  const allNodes = nodes.filter(node => 
                    (selectedIndex === 0 && (
                      node.id.toLowerCase().includes('fecha') ||
                      node.id.toLowerCase().includes('cita') ||
                      node.id.toLowerCase().includes('hora')
                    )) || 
                    (selectedIndex === 1 && (
                      node.id.toLowerCase().includes('no-cita') ||
                      node.id.toLowerCase().includes('nocita') ||
                      node.id.toLowerCase().includes('despedida')
                    ))
                  );
                  
                  if (allNodes.length > 0) {
                    state.currentNodeId = allNodes[0].id;
                    if (!state.visitedNodes) state.visitedNodes = [];
                    state.visitedNodes.push(allNodes[0].id);
                    
                    logger.info(`⚠️ ÚLTIMO RECURSO DESESPERADO: Usando nodo ${allNodes[0].id} encontrado por nombre parcial`);
                  }
                }
              }
            }
          }
          
          // Limpiar flags de estado del botón problemático
          state.specialButtonNode = undefined;
        } else {
          // Para otros nodos, usar el enfoque estándar
          const outEdges = findOutgoingConnections(state.waitingNodeId, edges);
          
          // Si hay más conexiones que el índice seleccionado, usar esa específica
          if (outEdges.length > selectedIndex) {
            const nextNodeId = outEdges[selectedIndex].target;
            
            // Actualizar nodo actual
            state.currentNodeId = nextNodeId;
            if (!state.visitedNodes) state.visitedNodes = [];
            state.visitedNodes.push(nextNodeId);
            
            logger.info(`Transición a nodo ${nextNodeId} basada en selección de botón ${selectedIndex + 1}`);
          }
          // De lo contrario, usar la primera conexión disponible
          else if (outEdges.length > 0) {
            const nextNodeId = outEdges[0].target;
            
            // Actualizar nodo actual
            state.currentNodeId = nextNodeId;
            if (!state.visitedNodes) state.visitedNodes = [];
            state.visitedNodes.push(nextNodeId);
            
            logger.info(`Transición a nodo ${nextNodeId} usando primera conexión disponible`);
          }
        }
      } else {
        logger.warn(`No se pudo determinar selección de botón para: "${message}"`);
        
        // SOLUCIÓN DIRECTA: Si el nodo es buttonsNode-1747166931506 y no hubo selección, forzar opción por defecto
        if (state.waitingNodeId === 'buttonsNode-1747166931506') {
          logger.info(`⚠️ SOLUCIÓN DIRECTA: Forzando selección por defecto para nodo problema`);
          
          // MÚLTIPLES ESTRATEGIAS PARA ENCONTRAR EL CAMINO CORRECTO
          
          // 1. Intento con handle-0 estándar
          let targetEdge = edges.find(edge => 
            edge.source === 'buttonsNode-1747166931506' && 
            edge.sourceHandle === 'handle-0'); // Para "Sí"
          
          // 2. Intento con sourceHandle alternativo si no funciona
          if (!targetEdge) {
            // Probar diferentes formatos de handle
            const alternativeHandles = ['0', 'button-0', 'option-0', 'source-0'];
            
            for (const handleFormat of alternativeHandles) {
              targetEdge = edges.find(edge => 
                edge.source === 'buttonsNode-1747166931506' && 
                edge.sourceHandle === handleFormat);
              
              if (targetEdge) {
                logger.info(`⚠️ Encontrada conexión con formato alternativo "${handleFormat}" para "Sí"`);
                break;
              }
            }
          }
          
          // 3. Buscar un edge sin sourceHandle específico
          if (!targetEdge) {
            targetEdge = edges.find(edge => 
              edge.source === 'buttonsNode-1747166931506' && 
              !edge.sourceHandle); // Cualquier edge sin sourceHandle
            
            if (targetEdge) {
              logger.info(`⚠️ Encontrada conexión sin sourceHandle específico`);
            }
          }
          
          // 4. Buscar explícitamente el nodo para la opción "Sí" por su ID
          if (!targetEdge) {
            // Identificar todas las conexiones salientes
            const outEdges = findOutgoingConnections('buttonsNode-1747166931506', edges);
            
            if (outEdges.length > 0) {
              // Buscar un targetNode que sea de fecha/hora/cita (para "Sí")
              const dateEdge = outEdges.find(edge => {
                const targetNode = nodes.find(node => node.id === edge.target);
                return targetNode && (
                  targetNode.id.toLowerCase().includes('fecha') || 
                  targetNode.id.toLowerCase().includes('date') ||
                  targetNode.id.toLowerCase().includes('hora') ||
                  targetNode.id.toLowerCase().includes('time') ||
                  targetNode.id.toLowerCase().includes('cita') ||
                  targetNode.id.toLowerCase().includes('appointment')
                );
              });
              
              if (dateEdge) {
                targetEdge = dateEdge;
                logger.info(`⚠️ Identificado nodo de fecha/cita como target para opción "Sí"`);
              } else {
                // Si no encontramos un nodo específico, usamos la primera conexión
                targetEdge = outEdges[0];
                logger.info(`⚠️ Usando primera conexión como fallback para opción "Sí"`);
              }
            }
          }
          
          // 5. ÚLTIMO RECURSO: Buscar directamente por ID del nodo target o usar info precargada
          if (!targetEdge) {
            // Primera opción: Usar información precargada si está disponible
            if (state.variables.tempYesNodeId) {
              state.currentNodeId = state.variables.tempYesNodeId;
              if (!state.visitedNodes) state.visitedNodes = [];
              state.visitedNodes.push(state.variables.tempYesNodeId);
              
              logger.info(`⚠️ ESTRATEGIA FINAL: Usando nodo precargado para opción por defecto: ${state.variables.tempYesNodeId}`);
              
              // Guardar selección simulada en el estado
              if (state.buttonOptions && state.buttonOptions.length > 0) {
                state.variables.lastButtonSelection = state.buttonOptions[0].value;
                state.variables.lastButtonLabel = state.buttonOptions[0].label;
              }
              
              // Limpiar flags de espera
              state.waitingForInput = false;
              state.waitingNodeId = undefined;
              
              // Ya establecimos el nodo, no necesitamos continuar
              return {
                response: 'Perfecto, vamos a agendar tu cita. Por favor, indícame qué fecha te gustaría.',
                state
              };
            }
            
            // Segunda opción: Búsqueda directa por ID
            const targetInputFechaNode = nodes.find(node => node.id === 'inputNode-fecha');
            
            if (targetInputFechaNode) {
              state.currentNodeId = targetInputFechaNode.id;
              if (!state.visitedNodes) state.visitedNodes = [];
              state.visitedNodes.push(targetInputFechaNode.id);
              
              logger.info(`⚠️ ESTRATEGIA FINAL: Forzando transición directa a inputNode-fecha para opción por defecto`);
              
              // Guardar selección simulada en el estado
              if (state.buttonOptions && state.buttonOptions.length > 0) {
                state.variables.lastButtonSelection = state.buttonOptions[0].value;
                state.variables.lastButtonLabel = state.buttonOptions[0].label;
              }
              
              // Limpiar flags de espera
              state.waitingForInput = false;
              state.waitingNodeId = undefined;
              
              // Ya establecimos el nodo, no necesitamos continuar
              return {
                response: 'Perfecto, vamos a agendar tu cita. Por favor, indícame qué fecha te gustaría.',
                state
              };
            }
            
            // Tercera opción: Búsqueda por nombre parcial
            const dateNodes = nodes.filter(node => 
              node.id.toLowerCase().includes('fecha') || 
              node.id.toLowerCase().includes('date') ||
              node.id.toLowerCase().includes('hora') ||
              node.id.toLowerCase().includes('time') ||
              node.id.toLowerCase().includes('cita') ||
              node.id.toLowerCase().includes('appointment')
            );
            
            if (dateNodes.length > 0) {
              state.currentNodeId = dateNodes[0].id;
              if (!state.visitedNodes) state.visitedNodes = [];
              state.visitedNodes.push(dateNodes[0].id);
              
              logger.info(`⚠️ ÚLTIMO RECURSO DESESPERADO: Encontrado nodo "${dateNodes[0].id}" por búsqueda parcial`);
              
              // Guardar selección simulada en el estado
              if (state.buttonOptions && state.buttonOptions.length > 0) {
                state.variables.lastButtonSelection = state.buttonOptions[0].value;
                state.variables.lastButtonLabel = state.buttonOptions[0].label;
              }
              
              // Limpiar flags de espera
              state.waitingForInput = false;
              state.waitingNodeId = undefined;
              
              // Ya establecimos el nodo, no necesitamos continuar
              return {
                response: 'Perfecto, vamos a agendar tu cita. Por favor, indícame los detalles que necesitas.',
                state
              };
            }
          }
            
          // Usar el targetEdge si lo encontramos
          if (targetEdge) {
            const nextNodeId = targetEdge.target;
            state.currentNodeId = nextNodeId;
            if (!state.visitedNodes) state.visitedNodes = [];
            state.visitedNodes.push(nextNodeId);
            logger.info(`⚠️ SOLUCIÓN DIRECTA: Asumiendo opción por defecto (Sí) y avanzando a ${nextNodeId}`);
            
            // Guardar selección simulada en el estado
            if (state.buttonOptions && state.buttonOptions.length > 0) {
              state.variables.lastButtonSelection = state.buttonOptions[0].value;
              state.variables.lastButtonLabel = state.buttonOptions[0].label;
            }
            
            // Limpiar flags específicos del nodo problemático
            state.specialButtonNode = undefined;
          } else {
            // Si después de todos los intentos no encontramos una transición,
            // enviamos una respuesta especial explicando el problema
            logger.error(`⚠️ FALLO CRÍTICO: No se pudo determinar la transición para el nodo problemático`);
            
            // Preparar un mensaje de error descriptivo
            return {
              response: "Disculpa, estamos experimentando dificultades técnicas para procesar tu solicitud de cita. Por favor, intenta escribir 'Quiero agendar una cita' o ponte en contacto con nuestro soporte.",
              state
            };
          }
        } else {
          // Para otros nodos, mantenemos el estado de espera para que el usuario vuelva a intentar
          return {
            response: 'Por favor selecciona una de las opciones disponibles.',
            state
          };
        }
      }
      
      // Limpiamos los flags de espera
      state.waitingForInput = false;
      state.waitingNodeId = undefined;
    }
    
    // Si no hay nodo actual (algo raro pasó), reiniciamos en el nodo de inicio
    if (!state.currentNodeId) {
      logger.warn('No hay nodo actual, reiniciando en nodo de inicio');
      const startNode = nodes.find(node => 
        node.type === 'startNode' || 
        node.type === 'start' || 
        node.data?.type === 'startNode'
      );
      
      if (startNode) {
        state.currentNodeId = startNode.id;
        if (!state.visitedNodes) state.visitedNodes = [];
        state.visitedNodes.push(startNode.id);
      } else {
        logger.error('No se pudo encontrar un nodo de inicio');
        return {
          response: "Lo siento, hay un problema con el flujo de conversación. Por favor, contacta a soporte.",
          state
        };
      }
    }
    
    // Buscamos el nodo actual
    const currentNode = nodes.find(node => node.id === state.currentNodeId);
    
    if (!currentNode) {
      logger.error(`No se encontró el nodo actual: ${state.currentNodeId}`);
      return {
        response: "Lo siento, hay un problema con el flujo de conversación. Por favor, contacta a soporte.",
        state
      };
    }
    
    // Procesamos según el tipo de nodo
    const nodeType = currentNode.type || currentNode.data?.type || 'unknown';
    logger.info(`Procesando nodo ${currentNode.id} de tipo ${nodeType}`);
    
    let response = '';
    let nextNodeId: string | undefined;
    
    // NODO MENSAJE - muestra un mensaje al usuario
    if (nodeType === 'messageNode' || nodeType === 'message') {
      // Extraer contenido del nodo
      const content = extractNodeContent(currentNode);
      if (content) {
        try {
          // SOLUCIÓN DIRECTA: Verificar si hay {{company_name}} y reemplazar directamente
          if (content.includes('{{company_name}}')) {
            response = await forceReplaceCompanyName(content, state.tenant_id);
            logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en nodo de mensaje ${currentNode.id}`);
          } else {
            // Reemplazar variables con variables del sistema y del estado
            response = await processTextWithSystemVariables(content, state.variables, state.tenant_id);
          }
          logger.info(`Nodo de mensaje ${currentNode.id}: "${response.substring(0, 50)}..."`);
        } catch (varError) {
          // Fallback al método simple
          response = replaceVariables(content, state.variables);
          logger.warn(`Error al procesar variables avanzadas para ${currentNode.id}, usando método simple: ${varError}`);
        }
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
      const waitForResponse = currentNode.data?.waitForResponse === true;
      
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
      
      // Verificación especial para nodos de confirmación de cita
      if (currentNode.id === 'messageNode-cita-confirmada' || 
          currentNode.id.toLowerCase().includes('cita') ||
          currentNode.id.toLowerCase().includes('confirm')) {
        // Guardamos como mensaje de confirmación
        state.confirmation_message = response;
      }
    }
    // NODO INPUT - solicita información al usuario
    else if (nodeType === 'inputNode' || nodeType === 'input') {
      // Extraer pregunta del nodo
      const question = currentNode.data?.question || 
                      currentNode.data?.prompt || 
                      "¿Podrías proporcionar más información?";
      
      // SOLUCIÓN DIRECTA: Verificar si hay {{company_name}} y reemplazar directamente
      if (question.includes('{{company_name}}')) {
        response = await forceReplaceCompanyName(question, state.tenant_id);
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en nodo de input ${currentNode.id}`);
      } else {
        // Reemplazar variables normalmente
        response = replaceVariables(question, state.variables);
      }
      
      // Configurar para esperar respuesta
      state.waitingForInput = true;
      state.waitingNodeId = currentNode.id;
      state.expectedVariable = currentNode.data?.variableName;
      
      logger.info(`Nodo de entrada ${currentNode.id}: "${response.substring(0, 50)}..."`);
      logger.info(`Configurado para guardar respuesta en variable: ${state.expectedVariable}`);
    }
    // NODO CONDICIÓN - evalúa condiciones y dirige el flujo
    else if (nodeType === 'conditionNode' || nodeType === 'condition') {
      // Extraer la condición y opciones
      const condition = currentNode.data?.condition || '';
      const options = currentNode.data?.options || [];
      
      logger.info(`Nodo de condición ${currentNode.id} con ${options.length} opciones`);
      
      // Determinar qué camino tomar
      let selectedOptionIndex = 0; // Por defecto, la primera opción
      
      // Si tenemos la última respuesta del usuario, intentamos hacer coincidencia
      const userResponse = message.toLowerCase().trim();
      
      if (options.length > 0) {
        // Buscar coincidencias exactas con opciones
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          const optionValue = (option.value || '').toLowerCase();
          const optionLabel = (option.label || '').toLowerCase();
          
          if (userResponse === optionValue ||
              userResponse === optionLabel ||
              userResponse === String(i + 1)) {
            selectedOptionIndex = i;
            logger.info(`Coincidencia exacta con opción ${i + 1}: ${option.label || option.value}`);
            break;
          }
        }
        
        // Si no hay coincidencia exacta, buscar por palabras clave
        if (selectedOptionIndex === 0) {
          // Palabras de afirmación y negación
          const affirmativeWords = ['si', 'sí', 'yes', 'confirmo', 'correcto', 'ok', 'claro'];
          const negativeWords = ['no', 'negativo', 'incorrecto', 'nada'];
          
          if (affirmativeWords.some(word => userResponse.includes(word))) {
            // Con afirmación usamos la primera opción (ya es 0 por defecto)
            logger.info(`Respuesta afirmativa, seleccionada opción 1`);
          } else if (negativeWords.some(word => userResponse.includes(word)) && options.length > 1) {
            // Con negación usamos la segunda opción (1)
            selectedOptionIndex = 1;
            logger.info(`Respuesta negativa, seleccionada opción 2`);
          } else {
            // Buscar coincidencias parciales
            for (let i = 0; i < options.length; i++) {
              const option = options[i];
              const optionValue = (option.value || '').toLowerCase();
              const optionLabel = (option.label || '').toLowerCase();
              
              if (userResponse.includes(optionValue) ||
                  optionValue.includes(userResponse) ||
                  userResponse.includes(optionLabel) ||
                  optionLabel.includes(userResponse)) {
                selectedOptionIndex = i;
                logger.info(`Coincidencia parcial con opción ${i + 1}: ${option.label || option.value}`);
                break;
              }
            }
          }
        }
      }
      
      // Buscar la conexión para la opción seleccionada
      const outEdges = findOutgoingConnections(currentNode.id, edges);
      
      if (outEdges.length > 0) {
        // Si el índice seleccionado está fuera de rango, usamos el primero
        const edgeIndex = selectedOptionIndex < outEdges.length ? selectedOptionIndex : 0;
        nextNodeId = outEdges[edgeIndex].target;
        logger.info(`Nodo condición: Usando conexión ${edgeIndex} hacia ${nextNodeId}`);
      } else {
        logger.warn(`Nodo condición ${currentNode.id} sin conexiones salientes`);
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
      
      // SOLUCIÓN DIRECTA: Verificar si hay {{company_name}} y reemplazar directamente
      if (endMessage.includes('{{company_name}}')) {
        response = await forceReplaceCompanyName(endMessage, state.tenant_id);
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en nodo final ${currentNode.id}`);
      } else {
        // Reemplazar variables normalmente
        response = replaceVariables(endMessage, state.variables);
      }
      
      // Guardar como mensaje de despedida
      state.endMessage = response;
      
      logger.info(`Nodo final ${currentNode.id}: "${response.substring(0, 50)}..."`);
    }
    // NODO DE BOTONES - presenta opciones al usuario
    else if (nodeType === 'buttonsNode' || 
            nodeType === 'optionsNode' || 
            currentNode.data?.buttons || 
            currentNode.data?.options) {
      
      // SOLUCIÓN DIRECTA: Si es el nodo problemático, marcarlo especialmente
      if (currentNode.id === 'buttonsNode-1747166931506') {
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Detectado nodo problemático buttonsNode-1747166931506`);
        // Marcar para tratamiento especial
        state.specialButtonNode = currentNode.id;
      }
      
      // Extraer mensaje y opciones del nodo
      const buttonPrompt = currentNode.data?.message || 
                          currentNode.data?.prompt || 
                          "Selecciona una opción:";
      
      // Obtener los botones u opciones (soporte para múltiples formatos)
      const buttons = currentNode.data?.buttons || 
                     currentNode.data?.options || 
                     [];
      
      // SOLUCIÓN DIRECTA: Verificar si hay {{company_name}} y reemplazar directamente
      if (buttonPrompt.includes('{{company_name}}')) {
        response = await forceReplaceCompanyName(buttonPrompt, state.tenant_id);
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en nodo de botones ${currentNode.id}`);
      } else {
        // Preparar mensaje con opciones usando variables del sistema
        try {
          response = await processTextWithSystemVariables(buttonPrompt, state.variables, state.tenant_id);
        } catch (varError) {
          response = replaceVariables(buttonPrompt, state.variables);
          logger.warn(`Error al procesar variables avanzadas para nodo de botones, usando método simple: ${varError}`);
        }
      }
      
      // Añadir opciones al mensaje para clientes que no soporten botones
      if (buttons.length > 0) {
        response += "\n\n";
        buttons.forEach((button, index) => {
          response += `${index + 1}. ${button.label || button.text || button.value}\n`;
        });
      }
      
      // Guardar las opciones en el estado para referencia futura
      state.buttonOptions = buttons.map(b => ({
        label: b.label || b.text || b.value,
        value: b.value || b.label || b.text
      }));
      
      // Configurar estado para esperar selección del usuario
      state.waitingForInput = true;
      state.waitingNodeId = currentNode.id;
      
      // CRUCIAL: Asegurar que last_response se actualice para evitar que se reemplace con la respuesta antigua
      state.last_response = response;
      
      logger.info(`Nodo de botones ${currentNode.id} preparado con ${buttons.length} opciones`);
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
      try {
        // Revisamos si el siguiente nodo es un nodo de botones o interactivo
        const nextNode = nodes.find(node => node.id === nextNodeId);
        
        if (nextNode && (
          nextNode.type === 'buttonsNode' || 
          nextNode.data?.type === 'buttonsNode' ||
          nextNode.type === 'optionsNode' || 
          nextNode.data?.type === 'optionsNode' ||
          (nextNode.data?.buttons && Array.isArray(nextNode.data.buttons))
        )) {
          // Si es un nodo de botones, lo marcamos para mostrar opciones al usuario
          logger.info(`Detectado nodo de botones o opciones: ${nextNodeId}`);
          
          // SOLUCIÓN DIRECTA: Si es el nodo problemático, marcarlo especialmente
          if (nextNode.id === 'buttonsNode-1747166931506') {
            logger.info(`⚠️ SOLUCIÓN DIRECTA: Detectado nodo problemático buttonsNode-1747166931506 como próximo nodo`);
            // Marcar para tratamiento especial
            state.specialButtonNode = nextNode.id;
            
            // PRECONFIGURACIÓN DE CONECTIVIDAD: Analizar y almacenar información crítica
            // Esto ayuda a prevenir problemas si perdemos el edge en otras partes del código
            try {
              // Verificar todas las conexiones salientes
              const targetEdges = edges.filter(edge => edge.source === 'buttonsNode-1747166931506');
              logger.info(`Encontradas ${targetEdges.length} conexiones salientes para nodo problemático`);
              
              // Verificar el nodo de "Sí" (debería ser inputNode-fecha)
              const yesTargetInfo = targetEdges.find(edge => 
                edge.sourceHandle === 'handle-0' || 
                edge.sourceHandle === '0' || 
                edge.id.includes('handle-0'));
                
              if (yesTargetInfo) {
                // Guardar en variables temporales para asegurar que tengamos la información
                state.variables.tempYesNodeId = yesTargetInfo.target;
                logger.info(`Pre-configurada la transición "Sí" a ${yesTargetInfo.target}`);
              } else {
                // Búsqueda alternativa: Buscar por ID del nodo destino
                const fechaNode = nodes.find(node => node.id === 'inputNode-fecha');
                if (fechaNode) {
                  state.variables.tempYesNodeId = fechaNode.id;
                  logger.info(`Pre-configurada la transición "Sí" a inputNode-fecha (búsqueda directa)`);
                }
              }
              
              // Verificar el nodo de "No" (debería ser messageNode-no-cita)
              const noTargetInfo = targetEdges.find(edge => 
                edge.sourceHandle === 'handle-1' || 
                edge.sourceHandle === '1' || 
                edge.id.includes('handle-1'));
                
              if (noTargetInfo) {
                // Guardar en variables temporales
                state.variables.tempNoNodeId = noTargetInfo.target;
                logger.info(`Pre-configurada la transición "No" a ${noTargetInfo.target}`);
              } else {
                // Búsqueda alternativa: Buscar por ID del nodo destino
                const noCitaNode = nodes.find(node => node.id === 'messageNode-no-cita');
                if (noCitaNode) {
                  state.variables.tempNoNodeId = noCitaNode.id;
                  logger.info(`Pre-configurada la transición "No" a messageNode-no-cita (búsqueda directa)`);
                }
              }
            } catch (error) {
              logger.error(`Error en pre-configuración de nodo problemático: ${error}`);
            }
          }
          
          // Extraer mensaje y opciones del nodo
          const buttonPrompt = nextNode.data?.message || nextNode.data?.prompt || "Selecciona una opción:";
          const buttons = nextNode.data?.buttons || [];
          
          // SOLUCIÓN DIRECTA: Verificar si hay {{company_name}} y reemplazar directamente
          let buttonOptions = buttonPrompt;
          if (buttonPrompt.includes('{{company_name}}')) {
            buttonOptions = await forceReplaceCompanyName(buttonPrompt, state.tenant_id);
            logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazada variable company_name en próximo nodo de botones ${nextNode.id}`);
          } else {
            // Preparar mensaje con opciones
            buttonOptions = replaceVariables(buttonPrompt, state.variables);
          }
          
          // Añadir opciones al mensaje
          if (buttons.length > 0) {
            buttonOptions += "\n\n";
            buttons.forEach((button, index) => {
              buttonOptions += `${index + 1}. ${button.label || button.text || button.value}\n`;
            });
          }
          
          // Configurar estado para esperar selección del usuario
          state.currentNodeId = nextNodeId;
          state.waitingForInput = true;
          state.waitingNodeId = nextNodeId;
          state.buttonOptions = buttons.map(b => ({
            label: b.label || b.text || b.value,
            value: b.value || b.label || b.text
          }));
          
          // Registramos el nodo como visitado
          if (!state.visitedNodes) state.visitedNodes = [];
          state.visitedNodes.push(nextNodeId);
          
          // Devolver respuesta actual seguida del mensaje de botones
          return {
            response: response ? response + "\n\n" + buttonOptions : buttonOptions,
            state,
            multipleResponses: response ? [response, buttonOptions] : undefined
          };
        }
        
        // Actualizamos el nodo actual
        state.currentNodeId = nextNodeId;
        
        // Registramos el nodo como visitado
        if (!state.visitedNodes) state.visitedNodes = [];
        state.visitedNodes.push(nextNodeId);
        
        // Recursividad controlada: procesamos el siguiente nodo
        // Máximo 5 nodos en una secuencia para evitar bucles infinitos
        if (state.visitedNodes.filter(id => id === nextNodeId).length <= 3) { // Máximo 3 repeticiones del mismo nodo
          // Procesamos el siguiente nodo con mensaje vacío (no es input del usuario)
          const result = await processFlow('', state, flowData, false);
          
          // Si el nodo actual generó una respuesta, la concatenamos
          if (response) {
            // Si ambos tienen respuesta, procesamos según el caso
            if (result.response) {
              // Si hay múltiples respuestas, las mantenemos separadas
              if (result.multipleResponses) {
                result.multipleResponses.unshift(response);
              } else {
                // Si es un nodo de confirmación seguido de despedida, los mantenemos separados
                if (state.confirmation_message && state.endMessage) {
                  result.multipleResponses = [state.confirmation_message, state.endMessage];
                } else {
                  // Unimos con salto de línea
                  result.response = response + "\n\n" + result.response;
                }
              }
            } else {
              result.response = response;
            }
          }
          
          return result;
        } else {
          logger.warn(`Posible bucle infinito detectado en nodo ${nextNodeId}`);
          // Si detectamos posible bucle, devolvemos la respuesta actual
          return {
            response,
            state
          };
        }
      } catch (nextNodeError) {
        logger.error(`Error al procesar el siguiente nodo ${nextNodeId}:`, nextNodeError);
        // En caso de error, seguimos con la respuesta actual
        return {
          response,
          state
        };
      }
    }
    
    // Guardamos la respuesta en el estado
    state.last_response = response;
    
    // Procesar acciones del sales funnel si hay un lead_id
    if (state.lead_id && currentNode) {
      try {
        logger.info(`Procesando sales funnel para lead ${state.lead_id} en nodo ${currentNode.id}`);
        
        // Asegurar estructura para compatibilidad
        const flowState = {
          ...state,
          leadId: state.lead_id,  // Asegurar que leadId esté disponible
          tenantId: state.tenant_id
        };
        
        // Verificar si el nodo tiene metadata del sales funnel
        const nodeMetadata = currentNode.data || currentNode.metadata || {};
        logger.info(`Metadata del nodo: ${JSON.stringify(nodeMetadata)}`);
        
        await processSalesFunnelActions(currentNode, flowState);
      } catch (salesFunnelError) {
        logger.error(`Error al procesar sales funnel: ${salesFunnelError}`);
        // No interrumpimos el flujo principal si falla el sales funnel
      }
    }
    
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
 * Handler principal para procesar mensajes del chatbot
 */
export async function POST(request: NextRequest) {
  try {
    // Extraemos datos de la petición
    const data = await request.json();
    const { text, user_id, tenant_id, session_id, template_id, bot_id, lead_id } = data;
    
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
    const botId = bot_id || 'default';
    
    logger.info(`Procesando mensaje para usuario ${user_id}, tenant ${tenant_id}, sesión ${sessionId}`);
    logger.info(`Mensaje: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    // Registramos el inicio del procesamiento para medir tiempo
    const startTime = Date.now();
    
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
        bot_id: botId,
        lead_id: lead_id || null, // Agregar lead_id al estado
        variables: {},
        message_count: 0,
        started_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      };
      logger.info(`Creando nuevo estado de conversación para sesión ${sessionId}`);
    } else {
      // Si el estado existe, actualizamos el lead_id si viene en la petición
      if (lead_id && !state.lead_id) {
        state.lead_id = lead_id;
        logger.info(`Actualizando lead_id en estado existente: ${lead_id}`);
      }
    }
    
    // Incrementamos contador de mensajes
    state.message_count = (state.message_count || 0) + 1;
    state.last_user_message = text;
    state.last_updated_at = new Date().toISOString();
    
    // Inicializamos el objeto de variables si no existe
    if (!state.variables) state.variables = {};
    
    // 1. SOLUCIÓN DIRECTA: Carga inmediata de la variable company_name
    try {
      // Obtener directamente el nombre de la empresa usando nuestra utilidad especializada
      const companyName = await forceReplaceCompanyName("{{company_name}}", tenant_id);
      
      // La función forceReplaceCompanyName devuelve el texto reemplazado, así que extraemos solo el valor
      if (companyName && companyName !== "{{company_name}}") {
        // Si se reemplazó correctamente, guardamos en las variables
        state.variables.company_name = companyName;
        state.variables.nombre_empresa = companyName;
        state.variables.nombre_negocio = companyName;
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Establecida variable company_name=${companyName}`);
      }
    } catch (companyNameError) {
      logger.error(`Error al cargar company_name directamente: ${companyNameError}`);
    }
    
    // 2. También cargar el resto de variables del sistema
    try {
      const systemVariables = await getSystemVariablesForTenant(tenant_id);
      // Añadirlas al estado (permitiendo que variables ya establecidas tengan prioridad)
      state.variables = { ...systemVariables, ...state.variables };
      logger.info(`Cargadas ${Object.keys(systemVariables).length} variables del sistema para tenant ${tenant_id}`);
    } catch (sysVarError) {
      logger.error(`Error al cargar variables del sistema para tenant ${tenant_id}:`, sysVarError);
    }
    
    // 3. Extraer variables del mensaje y actualizar estado
    const extractedVariables = extractVariablesFromMessage(text);
    state = updateStateWithVariables(state, extractedVariables);
    
    // Registrar mensaje del usuario en base de datos si está habilitado
    if (config.supabase.enabled) {
      try {
        await logMessage({
          tenant_id,
          bot_id: botId,
          user_id,
          session_id: sessionId,
          content: text,
          content_type: 'text',
          role: 'user',
          processed: true,
          audio_url: '',
          transcription: null,
          sender_type: 'user',
          template_id: template_id
        });
      } catch (logError) {
        logger.error('Error al registrar mensaje del usuario:', logError);
        // Continuamos aunque falle el registro
      }
    }
    
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
            
          logger.info(`Flujo cargado desde plantilla ${template_id}: ${flowData.nodes?.length || 0} nodos y ${flowData.edges?.length || 0} conexiones`);
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
              message: '¡Hola {{nombre_usuario}}! Soy el asistente virtual de {{company_name}}. ¿En qué puedo ayudarte?'
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
              message: 'Gracias por tu consulta. Un asesor de {{company_name}} se pondrá en contacto contigo pronto.'
            }
          },
          {
            id: 'messageNode-despedida',
            type: 'messageNode',
            data: {
              message: '¡Gracias por contactarnos, {{nombre_usuario}}! Estamos a tu disposición para cualquier otra consulta.'
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
      logger.info(`Usando flujo de respaldo para template_id=${template_id || 'default'}`);
    }
    
    // Procesar el mensaje con el flujo
    const result = await processFlow(text, state, flowData, isNewConversation);
    
    // Extraemos respuesta y estado actualizado
    let response = result.response;
    const updatedState = result.state;
    
    // SOLUCIÓN DIRECTA: Verificar si hay variables sin sustituir en la respuesta final
    // Esto asegura que no queden variables sin reemplazar, especialmente company_name
    if (response && response.includes('{{company_name}}')) {
      try {
        const replacedResponse = await forceReplaceCompanyName(response, tenant_id);
        logger.info(`⚠️ SOLUCIÓN DIRECTA: Reemplazando company_name en respuesta final`);
        response = replacedResponse;
      } catch (finalReplaceError) {
        logger.error(`Error en reemplazo final de company_name: ${finalReplaceError}`);
      }
    }
    
    // Verificamos si tenemos respuestas múltiples para enviar
    let responseMessages = result.multipleResponses || [response];
    
    // SOLUCIÓN DIRECTA: Verificar todas las respuestas múltiples para variables sin sustituir
    responseMessages = await Promise.all(responseMessages.map(async (msg) => {
      if (msg && msg.includes('{{company_name}}')) {
        try {
          return await forceReplaceCompanyName(msg, tenant_id);
        } catch (error) {
          logger.error(`Error al reemplazar company_name en mensaje múltiple: ${error}`);
          return msg;
        }
      }
      return msg;
    }));
    
    // Guardamos el estado actualizado DE FORMA ASÍNCRONA (no bloqueante)
    // Esto evita que la llamada a Supabase bloquee la respuesta HTTP
    setImmediate(async () => {
      try {
        await saveConversationState(tenant_id, user_id, sessionId, updatedState);
        logger.info(`Estado guardado en BD para sesión ${sessionId} (asíncrono)`);
      } catch (saveError) {
        logger.error(`Error al guardar estado en BD (asíncrono): ${saveError}`);
      }
    });
    
    // Registramos respuesta(s) del bot en base de datos
    if (config.supabase.enabled) {
      try {
        // Registramos cada mensaje por separado
        for (const message of responseMessages) {
          await logMessage({
            tenant_id,
            bot_id: botId,
            user_id,
            session_id: sessionId,
            content: message,
            content_type: 'text',
            role: 'bot',
            processed: true,
            audio_url: '',
            transcription: null,
            sender_type: 'bot',
            template_id: template_id,
            tokens_used: Math.ceil(message.length / 4) // Estimación simple
          });
        }
        
        // Incrementamos contador de uso
        const totalTokens = responseMessages.reduce((sum, msg) => sum + Math.ceil(msg.length / 4), 0);
        await incrementUsage(tenant_id, totalTokens);
      } catch (logError) {
        logger.error('Error al registrar respuesta del bot:', logError);
        // Continuamos aunque falle el registro
      }
    }
    
    // Calcular tiempo de procesamiento
    const processingTime = Date.now() - startTime;
    
    // Calculamos tokens usados (estimación simple)
    const tokensUsed = Math.ceil(response.length / 4);
    
    // Preparamos la respuesta para el cliente
    if (responseMessages.length > 1) {
      // Si hay múltiples mensajes, los enviamos como array
      return NextResponse.json({
        success: true,
        messages: responseMessages,
        is_multi_message: true,
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
    } else {
      // Respuesta normal con un solo mensaje
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
    }
    
  } catch (error) {
    logger.error("Error en endpoint integrated-message:", error);
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