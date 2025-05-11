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
    // Función para verificar si un valor puede ser un mensaje válido
    const isValidMessage = (value: any): boolean => {
      return value && typeof value === 'string' && value.trim() !== '';
    };

    // Función para extraer cualquier mensaje de flowData directamente
    const extractDirectMessages = (data: any): string | null => {
      // Campos comunes donde puede estar el mensaje inicial
      const messageFields = [
        'initialMessage', 'greeting', 'welcomeMessage', 'defaultMessage',
        'welcomeText', 'message', 'text', 'content', 'defaultGreeting'
      ];

      // Buscar en campos directos
      for (const field of messageFields) {
        if (isValidMessage(data[field])) {
          logger.debug(`Mensaje encontrado en flowData.${field}: "${data[field]}"`);
          diagnostics.contentSearchAttempts.push({
            source: `direct_field_${field}`,
            result: data[field]
          });
          return data[field];
        }
      }

      // Buscar en campos anidados comunes
      const nestedObjects = ['data', 'configuration', 'settings', 'params', 'meta', 'props', 'options', 'config'];
      for (const objName of nestedObjects) {
        if (data[objName] && typeof data[objName] === 'object') {
          for (const field of messageFields) {
            if (isValidMessage(data[objName][field])) {
              logger.debug(`Mensaje encontrado en flowData.${objName}.${field}: "${data[objName][field]}"`);
              diagnostics.contentSearchAttempts.push({
                source: `nested_field_${objName}.${field}`,
                result: data[objName][field]
              });
              return data[objName][field];
            }
          }
        }
      }

      return null;
    };

    // MÉTODO 0: Intentar extraer mensajes directamente de flowData
    // Hacemos esto primero porque es rápido y en algunos formatos la configuración
    // está directamente en el objeto flowData
    const directMessage = extractDirectMessages(flowData);
    if (directMessage) {
      diagnostics.messageSource = 'direct_flow_data';
      diagnostics.extractionMethod = 'direct_attribute';
      return {
        message: directMessage,
        diagnostics
      };
    }

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
      // Si no es un formato reconocido pero tiene propiedad 'nodes' como objeto
      if (flowData.nodes && typeof flowData.nodes === 'object' && !Array.isArray(flowData.nodes)) {
        // Convertir objeto nodes a array (formato de nodos por ID)
        diagnostics.flowStructure = 'nodes_by_id';
        nodes = Object.entries(flowData.nodes).map(([id, nodeData]) => ({
          id,
          ...nodeData as any
        }));

        // Intentar extraer conexiones
        if (flowData.edges && Array.isArray(flowData.edges)) {
          edges = flowData.edges;
        } else {
          // Sin conexiones definidas explícitamente
          edges = [];
        }
      } else {
        // Formato desconocido
        logger.warn('findInitialMessage: Formato de flujo desconocido');
        logger.debug(`Claves en flowData: ${Object.keys(flowData).join(', ')}`);
        diagnostics.flowStructure = 'unknown';
        return { message: null, diagnostics };
      }
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

    // Registramos los primeros 3 nodos para depuración
    if (nodes.length > 0) {
      logger.debug(`Primeros nodos encontrados:`);
      nodes.slice(0, 3).forEach((node, idx) => {
        logger.debug(`  Nodo ${idx + 1}: id=${node.id}, type=${node.type || node.data?.type || 'unknown'}`);
        if (node.data) {
          logger.debug(`    Keys: ${Object.keys(node.data).join(', ')}`);
        }
      });
    }

    // MÉTODO 1: Buscar desde el nodo de inicio siguiendo las conexiones
    // Primero identificamos el nodo de inicio (tipo "startNode" o similar)
    const startNodes = nodes.filter(node => {
      const nodeType = node.type || node.data?.type || node.data?.nodeType || '';
      return nodeType.toLowerCase().includes('start') ||
             nodeType.toLowerCase() === 'entry' ||
             nodeType.toLowerCase() === 'inicial';
    });

    if (startNodes.length > 0) {
      // Preferimos un nodo que específicamente se llame 'startNode'
      const primaryStartNode = startNodes.find(node =>
        node.type === 'startNode' ||
        node.type === 'start' ||
        node.data?.type === 'startNode' ||
        node.data?.nodeType === 'start'
      ) || startNodes[0];

      diagnostics.startNodeId = primaryStartNode.id;
      logger.debug(`Nodo de inicio encontrado: ${primaryStartNode.id} (tipo: ${primaryStartNode.type || primaryStartNode.data?.type || 'unknown'})`);

      // Buscamos conexiones que salen del nodo de inicio
      const startNodeConnections = edges.filter(edge => edge.source === primaryStartNode.id);

      if (startNodeConnections.length > 0) {
        logger.debug(`Conexiones desde nodo de inicio: ${startNodeConnections.length}`);

        // Exploramos hasta 3 niveles de conexiones desde el inicio
        // para encontrar el primer nodo de mensaje
        const exploreConnections = (sourceNodeId: string, depth: number = 0, maxDepth: number = 3): string | null => {
          if (depth > maxDepth) return null;

          const outgoingConnections = edges.filter(edge => edge.source === sourceNodeId);

          for (const connection of outgoingConnections) {
            const targetNode = nodes.find(node => node.id === connection.target);
            if (!targetNode) continue;

            // Verificar si es un nodo de mensaje o tiene contenido
            const isMessageNode =
              targetNode.type === 'messageNode' ||
              targetNode.type === 'message' ||
              targetNode.data?.type === 'messageNode' ||
              targetNode.data?.nodeType === 'message';

            const nodeContent = extractNodeContent(targetNode);

            if (nodeContent) {
              // Si es un nodo de mensaje, priorizar
              if (isMessageNode) {
                logger.debug(`Mensaje encontrado en nodo conectado de tipo mensaje: ${targetNode.id}`);
                diagnostics.firstMessageNodeId = targetNode.id;
                return nodeContent;
              }

              // Si no es de mensaje pero tiene contenido, guardar pero seguir buscando
              logger.debug(`Contenido encontrado en nodo conectado (no-mensaje): ${targetNode.id}`);
              diagnostics.contentSearchAttempts.push({
                source: `node_${targetNode.id}`,
                result: nodeContent
              });

              // Si estamos en profundidad > 0, aceptar este contenido
              if (depth > 0) {
                return nodeContent;
              }
            }

            // Explorar recursivamente
            const nestedContent = exploreConnections(targetNode.id, depth + 1, maxDepth);
            if (nestedContent) return nestedContent;
          }

          return null;
        };

        // Explorar conexiones desde el nodo inicio
        const exploredContent = exploreConnections(primaryStartNode.id);
        if (exploredContent) {
          diagnostics.messageSource = 'node_connection_exploration';
          diagnostics.extractionMethod = 'connection_path';
          return {
            message: exploredContent,
            diagnostics
          };
        }
      }
    }

    // MÉTODO 2: Buscar el primer nodo de mensaje existente
    const messageNodes = nodes.filter(node =>
      node.type === 'messageNode' ||
      node.type === 'message' ||
      node.data?.type === 'messageNode' ||
      node.data?.nodeType === 'message'
    );

    if (messageNodes.length > 0) {
      logger.debug(`Encontrados ${messageNodes.length} nodos de tipo mensaje`);

      // Intentar encontrar un mensaje en cada nodo de mensaje
      for (const messageNode of messageNodes) {
        diagnostics.firstMessageNodeId = messageNode.id;
        const messageContent = extractNodeContent(messageNode);

        if (messageContent) {
          logger.debug(`Mensaje encontrado en nodo de tipo mensaje ${messageNode.id}: "${messageContent.substring(0, 50)}..."`);
          diagnostics.messageSource = 'message_node';
          diagnostics.extractionMethod = 'direct_search';
          return {
            message: messageContent,
            diagnostics
          };
        }
      }
    }

    // MÉTODO 3: Buscar cualquier nodo que tenga un atributo "content" o similar
    logger.debug(`Buscando contenido en cualquier nodo...`);
    for (const node of nodes) {
      const nodeContent = extractNodeContent(node);
      if (nodeContent) {
        logger.debug(`Contenido encontrado en nodo ${node.id} (tipo: ${node.type || node.data?.type || 'unknown'}): "${nodeContent.substring(0, 50)}..."`);
        diagnostics.messageSource = 'node_with_content';
        diagnostics.extractionMethod = 'content_attribute_search';
        return {
          message: nodeContent,
          diagnostics
        };
      }
    }

    // MÉTODO 4: Buscar en flowData un atributo anidado que pueda contener el mensaje
    // Búsqueda recursiva de textos que parezcan mensaje
    const findPotentialMessage = (obj: any, path: string = ''): string | null => {
      if (!obj || typeof obj !== 'object') return null;

      // Buscar en propiedades directas
      for (const key in obj) {
        // Ignorar propiedades que probablemente no son mensajes
        if (['id', 'type', 'position', 'nodes', 'edges', 'elements'].includes(key)) {
          continue;
        }

        const value = obj[key];

        // Si es un string de longitud razonable, podría ser un mensaje
        if (isValidMessage(value) && typeof value === 'string' && value.length > 10 && value.length < 1000) {
          // Filtramos valores que sean código JSON, XML o similar
          if (!(value.startsWith('{') && value.endsWith('}')) &&
              !(value.startsWith('[') && value.endsWith(']')) &&
              !(value.includes('</') && value.includes('>'))) {

            // Si la clave parece indicar un mensaje, priorizamos
            if (key.toLowerCase().includes('message') ||
                key.toLowerCase().includes('text') ||
                key.toLowerCase().includes('greeting') ||
                key.toLowerCase().includes('welcome')) {
              logger.debug(`Posible mensaje encontrado en ${path}${key}: "${value.substring(0, 50)}..."`);
              return value;
            }

            // Guardar pero seguir buscando
            diagnostics.contentSearchAttempts.push({
              source: `recursive_${path}${key}`,
              result: value
            });
          }
        }

        // Buscar recursivamente en objetos anidados
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nestedResult = findPotentialMessage(value, `${path}${key}.`);
          if (nestedResult) return nestedResult;
        }
      }

      return null;
    };

    // Intento final - búsqueda recursiva profunda
    const potentialMessage = findPotentialMessage(flowData);
    if (potentialMessage) {
      diagnostics.messageSource = 'deep_search';
      diagnostics.extractionMethod = 'recursive_exploration';
      return {
        message: potentialMessage,
        diagnostics
      };
    }

    // Si tenemos intentos previos guardados, usamos el primero como último recurso
    if (diagnostics.contentSearchAttempts.length > 0) {
      const bestAttempt = diagnostics.contentSearchAttempts.find(attempt => attempt.result !== null);
      if (bestAttempt && bestAttempt.result) {
        logger.debug(`Usando mejor intento previo como respaldo: ${bestAttempt.source}`);
        diagnostics.messageSource = 'fallback_attempt';
        diagnostics.extractionMethod = 'best_effort';
        return {
          message: bestAttempt.result,
          diagnostics
        };
      }
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
export function extractNodeContent(node: ReactFlowNode): string | null {
  // Intentamos diferentes ubicaciones donde podría estar el contenido
  // Array de intentos para incluir en el diagnóstico si es necesario
  const attempts: Array<{path: string, result: string | null}> = [];

  // Función auxiliar para verificar si un valor es una cadena válida
  const isValidString = (value: any): boolean => {
    return value && typeof value === 'string' && value.trim() !== '';
  };

  // Función para extraer contenido de un objeto anidado
  const getNestedContent = (obj: any, prefix: string = ''): string | null => {
    if (!obj || typeof obj !== 'object') return null;

    // Lista de claves comunes para buscar
    const commonKeys = [
      'content', 'message', 'text', 'label', 'value', 'prompt',
      'greeting', 'response', 'initialMessage', 'welcomeMessage',
      'welcomeText', 'defaultText', 'initialPrompt', 'defaultMessage'
    ];

    // Revisar cada clave común
    for (const key of commonKeys) {
      if (isValidString(obj[key])) {
        logger.debug(`Encontrado contenido en ${prefix}${key}: "${obj[key]}"`);
        return obj[key];
      }
    }

    // Buscar en subobjetos comunes
    const subObjects = ['data', 'configuration', 'settings', 'props', 'params', 'config', 'options'];
    for (const subKey of subObjects) {
      if (obj[subKey] && typeof obj[subKey] === 'object') {
        const nestedContent = getNestedContent(obj[subKey], `${prefix}${subKey}.`);
        if (nestedContent) return nestedContent;
      }
    }

    return null;
  };

  // Lista completa de rutas posibles donde buscar el contenido
  const contentPaths = [
    // Rutas en node.data
    { path: 'data.content', value: node.data?.content },
    { path: 'data.message', value: node.data?.message },
    { path: 'data.label', value: node.data?.label },
    { path: 'data.text', value: node.data?.text },
    { path: 'data.value', value: node.data?.value },
    { path: 'data.prompt', value: node.data?.prompt },
    { path: 'data.greeting', value: node.data?.greeting },
    { path: 'data.response', value: node.data?.response },
    { path: 'data.initialMessage', value: node.data?.initialMessage },
    { path: 'data.welcomeMessage', value: node.data?.welcomeMessage },
    { path: 'data.welcomeText', value: node.data?.welcomeText },
    { path: 'data.defaultMessage', value: node.data?.defaultMessage },

    // Rutas en node (propiedades directas)
    { path: 'content', value: node.content },
    { path: 'message', value: node.message },
    { path: 'label', value: node.label },
    { path: 'text', value: node.text },
    { path: 'value', value: node.value },
    { path: 'prompt', value: node.prompt },
    { path: 'greeting', value: node.greeting },
    { path: 'initialMessage', value: node.initialMessage },

    // Rutas anidadas en node.data.data
    { path: 'data.data.content', value: node.data?.data?.content },
    { path: 'data.data.message', value: node.data?.data?.message },
    { path: 'data.data.text', value: node.data?.data?.text },
    { path: 'data.data.value', value: node.data?.data?.value },
    { path: 'data.data.greeting', value: node.data?.data?.greeting },
    { path: 'data.data.initialMessage', value: node.data?.data?.initialMessage },

    // Rutas en configuration
    { path: 'data.configuration.content', value: node.data?.configuration?.content },
    { path: 'data.configuration.message', value: node.data?.configuration?.message },
    { path: 'data.configuration.text', value: node.data?.configuration?.text },
    { path: 'data.configuration.initialMessage', value: node.data?.configuration?.initialMessage },
    { path: 'data.configuration.welcomeMessage', value: node.data?.configuration?.welcomeMessage },
    { path: 'data.configuration.greeting', value: node.data?.configuration?.greeting },

    // Rutas en settings
    { path: 'data.settings.content', value: node.data?.settings?.content },
    { path: 'data.settings.message', value: node.data?.settings?.message },
    { path: 'data.settings.text', value: node.data?.settings?.text },
    { path: 'data.settings.initialMessage', value: node.data?.settings?.initialMessage },
    { path: 'data.settings.welcomeMessage', value: node.data?.settings?.welcomeMessage },
    { path: 'data.settings.greeting', value: node.data?.settings?.greeting },

    // Rutas en props (usado en algunos formatos)
    { path: 'data.props.content', value: node.data?.props?.content },
    { path: 'data.props.message', value: node.data?.props?.message },
    { path: 'data.props.text', value: node.data?.props?.text },
    { path: 'data.props.initialMessage', value: node.data?.props?.initialMessage },
    { path: 'data.props.welcomeMessage', value: node.data?.props?.welcomeMessage },

    // Rutas en params (usado en algunos formatos)
    { path: 'data.params.content', value: node.data?.params?.content },
    { path: 'data.params.message', value: node.data?.params?.message },
    { path: 'data.params.text', value: node.data?.params?.text },

    // Rutas en options (usado en algunos formatos)
    { path: 'data.options.content', value: node.data?.options?.content },
    { path: 'data.options.message', value: node.data?.options?.message },
    { path: 'data.options.text', value: node.data?.options?.text },

    // Rutas en config (usado en algunos formatos)
    { path: 'data.config.content', value: node.data?.config?.content },
    { path: 'data.config.message', value: node.data?.config?.message },
    { path: 'data.config.text', value: node.data?.config?.text },
  ];

  // Probar cada ruta en orden
  for (const {path, value} of contentPaths) {
    if (isValidString(value)) {
      attempts.push({path, result: value});

      // Si el contenido es muy largo, agregar un log de depuración
      if (value.length > 100) {
        logger.debug(`Contenido encontrado en ${path} (${value.length} caracteres): "${value.substring(0, 100)}..."`);
      } else {
        logger.debug(`Contenido encontrado en ${path}: "${value}"`);
      }

      return value;
    }
  }

  // Si no encontramos por rutas específicas, intentamos búsqueda recursiva
  if (node.data) {
    const recursiveContent = getNestedContent(node.data, 'data.');
    if (recursiveContent) {
      return recursiveContent;
    }
  }

  // Último intento: Buscar cualquier propiedad que parezca ser un mensaje
  if (node.data && typeof node.data === 'object') {
    for (const key in node.data) {
      if (isValidString(node.data[key]) &&
          // Solo considerar propiedades que parezcan contener texto de mensaje
          (key.includes('message') || key.includes('text') || key.includes('content') ||
           key.includes('greeting') || key.includes('prompt') || key.includes('response'))) {
        logger.debug(`Contenido encontrado en propiedad data.${key}: "${node.data[key]}"`);
        return node.data[key];
      }
    }
  }

  // Log de depuración con todos los intentos
  logger.debug(`extractNodeContent: No se encontró contenido en nodo ${node.id} (tipo: ${node.type || 'desconocido'})`);

  // Para nodos de tipo mensaje, mostramos más detalle
  if (node.type === "messageNode" || node.type === "message" || node.data?.type === "messageNode" || node.data?.nodeType === "message") {
    logger.debug(`Estructura completa del nodo ${node.id}: ${JSON.stringify(node, null, 2)}`);
  }
  // Para el resto, solo mostramos las claves principales
  else if (node.data) {
    logger.debug(`Estructura de node.data: ${JSON.stringify(Object.keys(node.data))}`);
  }

  // Si no pudimos encontrar el contenido con ninguno de los métodos anteriores,
  // podemos intentar recorrer recursivamente el nodo buscando cualquier string
  // que parezca un mensaje (como último recurso)
  const findAnyPotentialMessage = (obj: any, path: string = ''): string | null => {
    if (!obj || typeof obj !== 'object') return null;

    // Buscar en propiedades directas
    for (const key in obj) {
      // Ignorar propiedades que probablemente no son mensajes
      if (['id', 'type', 'position', 'selected', 'dragging', 'sourcePosition', 'targetPosition'].includes(key)) {
        continue;
      }

      const value = obj[key];

      // Si es un string de longitud razonable, podría ser un mensaje
      if (isValidString(value) && value.length > 10 && value.length < 500) {
        logger.debug(`Posible mensaje encontrado en ${path}${key}: "${value}"`);
        return value;
      }

      // Buscar recursivamente en objetos anidados
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nestedResult = findAnyPotentialMessage(value, `${path}${key}.`);
        if (nestedResult) return nestedResult;
      }
    }

    return null;
  };

  // Intentar encontrar cualquier mensaje como último recurso
  return findAnyPotentialMessage(node);
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