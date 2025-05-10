/**
 * src/services/chatbotUtils.ts
 *
 * Utilidades para el manejo de chatbots y flujos de conversación
 * Ofrece funciones para extraer mensajes iniciales y analizar estructuras de flujos
 * @version 1.0.1
 * @updated 2025-05-10
 */

import logger from '../utils/logger';
import { ReactFlowNode, ReactFlowEdge, ReactFlowData } from '../models/flow.types';

// Interfaz para la respuesta de findInitialMessage
interface MessageExtractionResult {
  message: string | null;
  diagnostics: {
    messageSource: string;
    startNodeId?: string;
    firstMessageNodeId?: string;
    nodesAnalyzed: number;
    edgesAnalyzed: number;
    extractionMethod: string;
    flowStructure?: string;
    rawContent?: string;     // Contenido crudo extraído antes de procesamiento
    nodes?: Array<{id: string, type: string, content?: string}>;  // Lista simplificada de nodos
    contentSearchAttempts?: Array<{source: string, result: string | null}>;  // Intentos de extracción
  };
}

// Interfaz que representa la estructura del flujo desde ReactFlow
interface FlowData {
  nodes?: ReactFlowNode[];
  edges?: ReactFlowEdge[];
  elements?: any[];  // Para compatibilidad con versiones antiguas
  [key: string]: any;
}

/**
 * Encuentra el mensaje inicial en un flujo conversacional
 * Analiza la estructura de nodos y conexiones para encontrar el primer mensaje mostrado al usuario
 * 
 * @param flowData Datos del flujo (estructura ReactFlow)
 * @returns Mensaje extraído y diagnóstico detallado del proceso
 */
export function findInitialMessage(flowData: FlowData): MessageExtractionResult {
  // Objeto para almacenar diagnósticos
  const diagnostics = {
    messageSource: 'no_message_found',
    nodesAnalyzed: 0,
    edgesAnalyzed: 0,
    extractionMethod: 'none',
    flowStructure: 'unknown',
    contentSearchAttempts: [] as Array<{source: string, result: string | null}>,
    nodes: [] as Array<{id: string, type: string, content?: string}>
  };

  // Validamos que tengamos datos de flujo
  if (!flowData) {
    logger.warn('findInitialMessage: No se proporcionaron datos de flujo');
    return { message: null, diagnostics };
  }

  try {
    // Normalizamos la estructura para trabajar con ella
    let nodes: ReactFlowNode[] = [];
    let edges: ReactFlowEdge[] = [];

    // Detectamos el formato del flujo
    if (Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
      // Formato estándar ReactFlow
      nodes = flowData.nodes;
      edges = flowData.edges;
      diagnostics.flowStructure = 'standard_reactflow';
    } else if (Array.isArray(flowData.elements)) {
      // Formato antiguo con "elements"
      diagnostics.flowStructure = 'legacy_elements';
      
      // Separamos elementos en nodos y conexiones
      const nodeElements = flowData.elements.filter(el => el.type !== 'edge');
      const edgeElements = flowData.elements.filter(el => el.type === 'edge');
      
      nodes = nodeElements.map(el => ({
        id: el.id,
        type: el.type,
        position: el.position || { x: 0, y: 0 },
        data: el.data || {}
      }));
      
      edges = edgeElements.map(el => ({
        id: el.id,
        source: el.source,
        target: el.target,
        label: el.label
      }));
    } else if (typeof flowData === 'string') {
      // Intentamos parsear si es un string
      try {
        const parsed = JSON.parse(flowData);
        return findInitialMessage(parsed);
      } catch (e) {
        logger.error('findInitialMessage: Error al parsear string JSON', e);
        diagnostics.extractionMethod = 'parse_error';
        return { message: null, diagnostics };
      }
    } else {
      // Formato desconocido
      logger.warn('findInitialMessage: Formato de flujo desconocido');
      return { message: null, diagnostics };
    }

    // Contabilizamos para diagnóstico
    diagnostics.nodesAnalyzed = nodes.length;
    diagnostics.edgesAnalyzed = edges.length;

    // Guardamos información simplificada de los nodos para diagnóstico
    diagnostics.nodes = nodes.map(node => {
      const content = extractNodeContent(node);
      return {
        id: node.id,
        type: node.type || (node.data?.type || node.data?.nodeType || 'unknown'),
        content: content ? content.substring(0, 50) + (content.length > 50 ? '...' : '') : undefined
      };
    });

    // MÉTODO 1: Buscar desde el nodo de inicio siguiendo las conexiones
    // Primero identificamos el nodo de inicio (tipo "startNode")
    const startNode = nodes.find(node => 
      node.type === 'startNode' || 
      node.type === 'start' || 
      node.data?.type === 'startNode' || 
      node.data?.nodeType === 'start'
    );

    if (startNode) {
      diagnostics.startNodeId = startNode.id;

      // Buscamos conexiones que salen del nodo de inicio
      const startNodeConnections = edges.filter(edge => edge.source === startNode.id);
      
      if (startNodeConnections.length > 0) {
        // Seguimos la primera conexión
        const firstConnection = startNodeConnections[0];
        
        // Buscamos el nodo conectado
        const connectedNode = nodes.find(node => node.id === firstConnection.target);
        
        if (connectedNode) {
          // Verificamos si es un nodo de mensaje
          if (
            connectedNode.type === 'messageNode' || 
            connectedNode.type === 'message' || 
            connectedNode.data?.type === 'messageNode' ||
            connectedNode.data?.nodeType === 'message'
          ) {
            // Extraemos el mensaje
            const messageContent = extractNodeContent(connectedNode);
            
            if (messageContent) {
              diagnostics.messageSource = 'first_connected_node';
              diagnostics.firstMessageNodeId = connectedNode.id;
              diagnostics.extractionMethod = 'start_node_connection';
              return { 
                message: messageContent, 
                diagnostics 
              };
            }
          }
          
          // Si no es un nodo de mensaje, pero tiene texto en su contenido
          const connectedNodeContent = extractNodeContent(connectedNode);
          if (connectedNodeContent) {
            diagnostics.messageSource = 'connected_non_message_node';
            diagnostics.extractionMethod = 'content_extraction';
            return { 
              message: connectedNodeContent, 
              diagnostics 
            };
          }
        }
      }
    }

    // MÉTODO 2: Buscar el primer nodo de mensaje existente
    const firstMessageNode = nodes.find(node => 
      node.type === 'messageNode' || 
      node.type === 'message' || 
      node.data?.type === 'messageNode' ||
      node.data?.nodeType === 'message'
    );

    if (firstMessageNode) {
      diagnostics.firstMessageNodeId = firstMessageNode.id;
      const messageContent = extractNodeContent(firstMessageNode);
      
      if (messageContent) {
        diagnostics.messageSource = 'first_message_node';
        diagnostics.extractionMethod = 'direct_search';
        return { 
          message: messageContent, 
          diagnostics 
        };
      }
    }

    // MÉTODO 3: Buscar cualquier nodo que tenga un atributo "content" o "label"
    for (const node of nodes) {
      const nodeContent = extractNodeContent(node);
      if (nodeContent) {
        diagnostics.messageSource = 'node_with_content';
        diagnostics.extractionMethod = 'content_attribute_search';
        return { 
          message: nodeContent, 
          diagnostics 
        };
      }
    }

    // MÉTODO 4: Buscar en flowData un atributo llamado "initialMessage" o "greeting"
    if (flowData.initialMessage) {
      diagnostics.messageSource = 'flow_initial_message_attribute';
      diagnostics.extractionMethod = 'direct_attribute';
      return { 
        message: flowData.initialMessage, 
        diagnostics 
      };
    }
    
    if (flowData.greeting) {
      diagnostics.messageSource = 'flow_greeting_attribute';
      diagnostics.extractionMethod = 'direct_attribute';
      return { 
        message: flowData.greeting, 
        diagnostics 
      };
    }

    // Si llegamos aquí, no encontramos ningún mensaje
    logger.warn('findInitialMessage: No se encontró un mensaje inicial válido');
    return { message: null, diagnostics };
    
  } catch (error) {
    logger.error('Error al extraer mensaje inicial:', error);
    diagnostics.extractionMethod = 'error';
    return { message: null, diagnostics };
  }
}

/**
 * Extrae el contenido de un nodo de ReactFlow
 * Maneja diferentes estructuras de nodos para obtener el texto
 * 
 * @param node Nodo del que extraer el contenido
 * @returns Contenido del nodo o null si no se encuentra
 */
function extractNodeContent(node: ReactFlowNode): string | null {
  // Intentamos diferentes ubicaciones donde podría estar el contenido
  // Array de intentos para incluir en el diagnóstico si es necesario
  const attempts: Array<{path: string, result: string | null}> = [];

  // 1. En data.content (estructura más común)
  if (node.data?.content && typeof node.data.content === 'string') {
    attempts.push({path: 'data.content', result: node.data.content});
    return node.data.content;
  }

  // 2. En content directamente en el nodo
  if (node.content && typeof node.content === 'string') {
    attempts.push({path: 'content', result: node.content});
    return node.content;
  }

  // 3. En data.label
  if (node.data?.label && typeof node.data.label === 'string') {
    attempts.push({path: 'data.label', result: node.data.label});
    return node.data.label;
  }

  // 4. En label directamente en el nodo
  if (node.label && typeof node.label === 'string') {
    attempts.push({path: 'label', result: node.label});
    return node.label;
  }

  // 5. En data.data.content (estructura anidada)
  if (node.data?.data?.content && typeof node.data.data.content === 'string') {
    attempts.push({path: 'data.data.content', result: node.data.data.content});
    return node.data.data.content;
  }

  // 6. En data.value (para nodos específicos)
  if (node.data?.value && typeof node.data.value === 'string') {
    attempts.push({path: 'data.value', result: node.data.value});
    return node.data.value;
  }

  // 7. En data.text
  if (node.data?.text && typeof node.data.text === 'string') {
    attempts.push({path: 'data.text', result: node.data.text});
    return node.data.text;
  }

  // 8. En la propiedad 'message' (para algunos nodos de tipo greeting)
  if (node.data?.message && typeof node.data.message === 'string') {
    attempts.push({path: 'data.message', result: node.data.message});
    return node.data.message;
  }

  // 9. En la propiedad 'text' (para algunos nodos de tipo greeting)
  if (node.text && typeof node.text === 'string') {
    attempts.push({path: 'text', result: node.text});
    return node.text;
  }

  // 10. En data.props.content (usado en otros formatos)
  if (node.data?.props?.content && typeof node.data.props.content === 'string') {
    attempts.push({path: 'data.props.content', result: node.data.props.content});
    return node.data.props.content;
  }

  // Guardamos el registro de intentos para diagnóstico si es necesario
  logger.debug(`extractNodeContent: No se encontró contenido en nodo ${node.id}. Intentos: ${JSON.stringify(attempts)}`);

  // No encontramos contenido
  return null;
}

/**
 * Comprueba si un flujo tiene los componentes mínimos necesarios para funcionar
 * 
 * @param flowData Datos del flujo a verificar
 * @returns True si el flujo es válido, false si no lo es
 */
export function isValidFlow(flowData: FlowData): boolean {
  if (!flowData) {
    return false;
  }
  
  // Normalizamos la estructura
  let nodes: any[] = [];
  let edges: any[] = [];
  
  if (Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
    nodes = flowData.nodes;
    edges = flowData.edges;
  } else if (Array.isArray(flowData.elements)) {
    nodes = flowData.elements.filter(el => el.type !== 'edge');
    edges = flowData.elements.filter(el => el.type === 'edge');
  } else {
    return false;
  }
  
  // Verificamos mínimos
  if (nodes.length === 0) {
    return false;
  }
  
  // Debe tener al menos un nodo de inicio
  const hasStartNode = nodes.some(node => 
    node.type === 'startNode' || 
    node.type === 'start' || 
    node.data?.type === 'startNode' || 
    node.data?.nodeType === 'start'
  );
  
  // Y al menos un nodo de mensaje
  const hasMessageNode = nodes.some(node => 
    node.type === 'messageNode' || 
    node.type === 'message' || 
    node.data?.type === 'messageNode' || 
    node.data?.nodeType === 'message'
  );
  
  return hasStartNode && hasMessageNode;
}

/**
 * Extrae los IDs de todos los nodos de un tipo específico
 * 
 * @param flowData Datos del flujo
 * @param nodeType Tipo de nodo a buscar
 * @returns Array de IDs de nodos del tipo especificado
 */
export function getNodeIdsByType(flowData: FlowData, nodeType: string): string[] {
  if (!flowData) {
    return [];
  }
  
  // Normalizamos la estructura
  let nodes: any[] = [];
  
  if (Array.isArray(flowData.nodes)) {
    nodes = flowData.nodes;
  } else if (Array.isArray(flowData.elements)) {
    nodes = flowData.elements.filter(el => el.type !== 'edge');
  } else {
    return [];
  }
  
  // Filtramos y extraemos IDs
  return nodes
    .filter(node => 
      node.type === nodeType || 
      node.data?.type === nodeType || 
      node.data?.nodeType === nodeType
    )
    .map(node => node.id);
}

/**
 * Realiza un diagnóstico completo de un flujo para depuración
 * 
 * @param flowData Datos del flujo a diagnosticar
 * @returns Objeto con información de diagnóstico
 */
export function diagnoseFlow(flowData: FlowData): Record<string, any> {
  if (!flowData) {
    return { error: 'No flow data provided' };
  }
  
  try {
    // Normalizamos la estructura
    let nodes: any[] = [];
    let edges: any[] = [];
    
    if (Array.isArray(flowData.nodes) && Array.isArray(flowData.edges)) {
      nodes = flowData.nodes;
      edges = flowData.edges;
    } else if (Array.isArray(flowData.elements)) {
      nodes = flowData.elements.filter(el => el.type !== 'edge');
      edges = flowData.elements.filter(el => el.type === 'edge');
    } else {
      return { error: 'Unsupported flow structure' };
    }
    
    // Resultados de extracción de mensaje inicial
    const messageExtractionResult = findInitialMessage(flowData);
    
    // Conteo de tipos de nodos
    const nodeTypeCounts: Record<string, number> = {};
    nodes.forEach(node => {
      const nodeType = node.type || node.data?.type || node.data?.nodeType || 'unknown';
      nodeTypeCounts[nodeType] = (nodeTypeCounts[nodeType] || 0) + 1;
    });
    
    // Verificación de conexiones
    const disconnectedNodes = nodes.filter(node => {
      const nodeId = node.id;
      const hasIncomingConnection = edges.some(edge => edge.target === nodeId);
      const hasOutgoingConnection = edges.some(edge => edge.source === nodeId);
      
      // Un nodo está desconectado si no tiene conexiones entrantes ni salientes
      // (excepto el nodo de inicio que no necesita conexiones entrantes)
      const isStartNode = node.type === 'startNode' || node.type === 'start' || 
                          node.data?.type === 'startNode' || node.data?.nodeType === 'start';
      
      return !hasOutgoingConnection || (!hasIncomingConnection && !isStartNode);
    }).map(node => node.id);
    
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes: nodeTypeCounts,
      initialMessage: messageExtractionResult,
      disconnectedNodes,
      isValid: isValidFlow(flowData),
      startNodes: getNodeIdsByType(flowData, 'startNode').concat(getNodeIdsByType(flowData, 'start')),
      messageNodes: getNodeIdsByType(flowData, 'messageNode').concat(getNodeIdsByType(flowData, 'message')),
    };
    
  } catch (error) {
    logger.error('Error al diagnosticar flujo:', error);
    return { error: 'Error processing flow', details: error instanceof Error ? error.message : String(error) };
  }
}