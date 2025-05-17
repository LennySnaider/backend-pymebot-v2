/**
 * src/models/flow.types.ts
 *
 * Tipos para el sistema de flujos visuales.
 * Define la estructura de datos para representar flujos de conversación.
 * @version 1.3.0
 * @updated 2025-04-27
 */

/**
 * Tipos de nodos disponibles en el flujo
 */
export enum NodeType {
  // Nodos básicos
  MESSAGE = 'message',     // Mensaje simple
  CONDITION = 'condition', // Condición de bifurcación
  ACTION = 'action',       // Acción a ejecutar
  
  // Nodos avanzados
  INPUT = 'input',         // Solicitud de entrada
  API_CALL = 'api_call',   // Llamada a API externa
  INTENT = 'intent',       // Detección de intención
  ENTITY = 'entity',       // Extracción de entidad
  FALLBACK = 'fallback',   // Respuesta de respaldo
  
  // Nodos de interactividad
  BUTTONS = 'buttons',     // Botones de selección
  LIST = 'list',           // Lista de opciones
  
  // Nodos específicos para Voice Chat
  VOICE_RESPONSE = 'voice_response', // Respuesta de voz
  SPEECH_TO_TEXT = 'speech_to_text', // Conversión de voz a texto
  TEXT_TO_SPEECH = 'text_to_speech', // Conversión de texto a voz
  AI_VOICE_AGENT = 'ai_voice_agent', // Agente de voz IA
  END = 'end',             // Fin de conversación
  
  // Nodos del Constructor Visual
  START = 'startNode',     // Nodo inicial
  END_NODE = 'endNode',    // Nodo final
  MESSAGE_NODE = 'messageNode', // Nodo de mensaje (alternativo)
  AI_NODE = 'aiNode',      // Nodo de IA
  CONDITION_NODE = 'conditionNode', // Nodo de condición (alternativo)
  INPUT_NODE = 'inputNode', // Nodo de entrada (alternativo)
  BUTTONS_NODE = 'buttonsNode', // Nodo de botones (alternativo)
  LIST_NODE = 'listNode',  // Nodo de lista (alternativo)
  TTS_NODE = 'ttsNode',    // Nodo de text-to-speech (alternativo)
  STT_NODE = 'sttNode',    // Nodo de speech-to-text (alternativo)
}

/**
 * Tipos de roles en un mensaje
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  BOT = 'bot',
}

/**
 * Tipos de condiciones para bifurcaciones
 */
export enum ConditionType {
  CONTAINS = 'contains',           // El texto contiene una palabra o frase
  EQUALS = 'equals',               // El texto es exactamente igual
  REGEX = 'regex',                 // El texto cumple una expresión regular
  INTENT_IS = 'intent_is',         // La intención detectada es específica
  ENTITY_EXISTS = 'entity_exists', // Existe una entidad determinada
  ENTITY_VALUE = 'entity_value',   // Una entidad tiene un valor específico
  CONTEXT_HAS = 'context_has',     // El contexto tiene una variable
  CONTEXT_VALUE = 'context_value', // Una variable de contexto tiene valor específico
  SENTIMENT_IS = 'sentiment_is',   // Análisis de sentimiento
  ENTITY_PRESENT = 'entity_present', // Identificar entidades
  DEFAULT = 'default',             // Condición por defecto siempre se cumple
}

/**
 * Representa una condición para transiciones condicionales
 */
export interface Condition {
  type: ConditionType;
  value: string;
  caseSensitive?: boolean;
}

/**
 * Representa una transición condicional a otro nodo
 */
export interface ConditionalNext {
  condition: Condition;
  nextNodeId: string;
}

/**
 * Metadatos para nodos de mensaje
 */
export interface MessageNodeMetadata {
  role: MessageRole;
  delay?: number;
  typing?: boolean;
}

/**
 * Metadatos para nodos de condición
 */
export interface ConditionNodeMetadata {
  conditions: Condition[];
}

/**
 * Metadatos para nodos de acción
 */
export interface ActionNodeMetadata {
  actionType: string;
  parameters?: Record<string, any>;
}

/**
 * Metadatos para nodos de llamada a API
 */
export interface ApiCallNodeMetadata {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  resultVariable?: string;
}

/**
 * Metadatos para nodos de voz
 */
export interface VoiceNodeMetadata {
  voiceId?: string;      // ID de la voz a utilizar
  language?: string;     // Idioma para STT/TTS
  speed?: number;        // Velocidad de la voz (0.5-2.0)
  pitch?: number;        // Tono de la voz (0.5-2.0)
  audioFormat?: string;  // Formato de audio
}

/**
 * Metadatos para nodos de IA
 */
export interface AINodeMetadata {
  prompt: string;         // Prompt para la IA
  model: string;          // Modelo de IA a utilizar
  temperature: number;    // Temperatura (creatividad) del modelo
  maxTokens: number;      // Tokens máximos de respuesta
  responseVariableName?: string; // Nombre de la variable donde se guarda la respuesta
}

/**
 * Metadatos para el agente de voz IA
 */
export interface AIVoiceAgentNodeMetadata extends AINodeMetadata {
  voice: string;          // Voz a utilizar
  rate: number;           // Velocidad de reproducción
  outputVariableName?: string; // Variable donde se guarda el audio
  provider: string;       // Proveedor del servicio
  delay: number;          // Retraso antes de responder
}

/**
 * Metadatos para nodos de ReactFlow
 */
export interface ReactFlowNodeMetadata {
  x?: number;             // Posición X en el editor visual
  y?: number;             // Posición Y en el editor visual
  label?: string;         // Etiqueta visual del nodo
  // Datos específicos del tipo de nodo
  [key: string]: any;
}

/**
 * Metadatos extendidos para nodos (propiedades opcionales usadas en procesamiento)
 */
export interface ExtendedNodeMetadata {
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  variableName?: string;
  voice?: string;
  rate?: number;
  delay?: number;
  responseVariableName?: string;
  provider?: string;
  // Nuevas propiedades para modo auto
  mode?: "auto" | "static";   // Permite diferenciar entre nodos automáticos y estáticos
  prompt?: string;            // Contenido para enviar a la API de IA
  template?: string;          // Plantilla con variables para nodos de mensaje
  maxTokens?: number;         // Máximo de tokens para respuestas de IA
  useKnowledgeBase?: boolean; // Indica si se debe incluir la base de conocimiento
}

/**
 * Unión de todos los tipos de metadatos posibles
 */
export type NodeMetadata = (
  MessageNodeMetadata |
  ConditionNodeMetadata |
  ActionNodeMetadata |
  ApiCallNodeMetadata |
  VoiceNodeMetadata |
  AINodeMetadata |
  AIVoiceAgentNodeMetadata |
  ReactFlowNodeMetadata
) & ExtendedNodeMetadata;

/**
 * Representa un nodo en el flujo de conversación
 */
export interface FlowNode {
  id: string;
  type: NodeType | string; // String para admitir tipos personalizados
  content: string;
  metadata?: NodeMetadata;
  next?: string | ConditionalNext[];
  nextNodeId?: string;
  x?: number; // Posición X en el editor visual
  y?: number; // Posición Y en el editor visual
  isEditable?: boolean; // Indica si el tenant puede editar este nodo
}

/**
 * Permisos de edición para tenants
 */
export enum EditPermission {
  NONE = 'none',           // No se puede editar
  CONTENT_ONLY = 'content', // Solo se puede editar el contenido
  FULL = 'full',            // Se puede editar todo
}

/**
 * Representa un flujo completo de conversación
 */
export interface Flow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: Record<string, FlowNode>;
  entryNodeId: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  category?: string;
  author?: string;
  isTemplate?: boolean; // Indica si es una plantilla creada por super_admin
  parentTemplateId?: string; // ID de la plantilla original si es una instancia
  editPermission?: EditPermission; // Nivel de edición permitido para tenants
}

/**
 * Datos para crear un nuevo flujo
 */
export type FlowCreateData = Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Datos para actualizar un flujo existente
 */
export type FlowUpdateData = Partial<Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Datos limitados para que un tenant actualice un flujo
 */
export interface TenantFlowUpdateData {
  name?: string;
  description?: string;
  nodes?: Record<string, Pick<FlowNode, 'id' | 'content' | 'metadata'>>;
  isActive?: boolean;
}

/**
 * Estructura para flujos en tiempo de ejecución
 * Esta es la versión de un flujo optimizada para usar durante la conversación
 */
export interface RuntimeFlow {
  id: string;
  name: string;
  version: string;
  nodes: Record<string, FlowNode>;
  entryNodeId: string;
  tenantId: string;
}

/**
 * Estado de un flujo durante la ejecución
 */
export interface FlowState {
  flowId: string;
  currentNodeId: string;
  context: Record<string, any>;
  history: string[];
  startedAt: Date;
  lastUpdatedAt: Date;
  userId: string;
  sessionId: string;
}

/**
 * Resultado de procesar un nodo en el flujo
 */
export interface NodeProcessResult {
  nextNodeId?: string;
  response?: string;
  metrics?: { tokensUsed: number; };
  shouldWait?: boolean;
  context?: Record<string, any>;
  error?: string;
}

/**
 * Representa una plantilla de flujo
 */
export interface FlowTemplate {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: Record<string, FlowNode>;
  entryNodeId: string;
  category?: string;
  tags?: string[];
  author?: string;
  editableNodes?: string[]; // IDs de nodos que los tenants pueden editar
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Estructura de nodo del ReactFlow
 */
export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: any;
}

/**
 * Estructura de conexión del ReactFlow
 */
export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
  animated?: boolean;
}

/**
 * Estructura completa del ReactFlow
 */
export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}
