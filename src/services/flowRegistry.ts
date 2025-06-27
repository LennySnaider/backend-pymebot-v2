/**
 * Sistema de gestión de flujos para builderbot
 * Maneja el registro y procesamiento de flujos dinámicos
 */

import { v4 as uuidv4 } from "uuid";
import { createBot, createFlow, MemoryDB } from "@builderbot/bot";
import { saveConversationState, getConversationState } from "./conversationState";
import logger from "../utils/logger";
import { convertTemplateToBuilderbotFlow } from "./templateConverter";
import { replaceVariables } from "../utils/variableReplacer";
import { getOrCreateSessionBot, sessionBots } from './flowRegistryPatch';
import { setCurrentSession, getSessionVariables } from './flowRegistryVariablePatch';
import { dequeueMessages } from './buttonNavigationQueue';
import { setSessionContext } from './sessionContext';
import * as systemVariablesLoader from '../utils/systemVariablesLoader';
import { findLeadByPhone, createLeadIfNotExists } from "./leadLookupService";
import { getSessionStage } from "./flowRegistrySalesFix";
import { WebProvider } from "../provider/webProvider";

// Estado local para flujos persistentes entre mensajes
interface ExtendedFlowState {
  flowId: string;
  currentNodeId: string;
  history: Array<{
    timestamp: string;
    message: string;
    from: string;
    nodeId?: string;
  }>;
  tenantId: string;
  userId: string;
  variables: Record<string, any>;
  sessionStarted: Date;
  lastActivity: Date;
  metadata: {
    templateId?: string;
    templateType?: string;
    version?: string;
  };
  data: Record<string, any>;
  startedAt: Date;
  lastUpdatedAt: Date;
  sessionId: string;
  context: Record<string, any>;
  leadId?: string;
}

const _localFlowStates: Record<string, ExtendedFlowState> = {};

// Tipos para compatibilidad con builderbot
export interface FlowAdapter {
  handleMsg: (ctx: { from: string; body: string }) => Promise<any>;
  flows?: any;
}

// Verificar y actualizar imports
interface TFlowLocal {
  id: number;
  ctx: string;
  ref: (provider: any, state: any) => void;
  endFlow: boolean;
  keyword: string[];
  answer: string;
  options?: any;
  json?: any;
  gotoFlow?: string;
  skipMiddlewares: boolean;
  childFlow?: TFlowLocal[];
  fromFlow?: TFlowLocal;
  flowSerialize?: any;
  resSerialize?: any;
  callbacks: Array<(ctx: any, options: any) => Promise<void>>;
}

// Flujo especial para captura de leads con fallback
const leadCaptureFlow = async (): Promise<FlowAdapter | null> => {
  try {
    // Intentar cargar el flujo lead-capture
    const leadModule = await import("../flows/lead-capture.flow");
    
    if (leadModule.default) {
      logger.info("Flujo lead-capture cargado exitosamente");
      return { 
        flows: leadModule.default,
        handleMsg: async () => {
          // Esta función no se usa realmente, solo el flujo
          return { answer: [] };
        }
      };
    }
    
    logger.warn("Módulo lead-capture no tiene export default, creando adaptador genérico");
    
    // Intentamos crear un adaptador genérico
    return {
      handleMsg: async () => {
        logger.warn("handleMsg genérico llamado - el flujo puede no funcionar correctamente");
        return {
          answer: "Lo siento, no puedo procesar tu mensaje en este momento.",
          media: [],
          buttons: [],
          delay: 0
        };
      },
      flows: []
    };
  } catch (error) {
    logger.error("Error al cargar flujo lead-capture:", error);
    return null;
  }
};

// Función helper para crear un adaptador de flujo
function createFlowAdapter(flowClass: any, flows: TFlowLocal[]): FlowAdapter {
  return {
    handleMsg: async () => {
      // Implementación básica de handleMsg usando los flujos
      // Esta es una simulación simple del procesamiento de flujos
      return {
        answer: [{ body: "Procesando mensaje..." }]
      };
    },
    flows: flows as any
  };
}

// Almacén central para flujos
export class FlowRegistry {
  private static flows: Map<string, any> = new Map();  // Cambiar a any para soportar FlowClass
  private static templates: Map<string, any> = new Map();
  private static bots: Map<string, any> = new Map();

  static async initialize() {
    logger.info("Iniciando FlowRegistry");
    
    // Registrar flujos predefinidos
    await this.registerPredefinedFlows();
    
    logger.info("FlowRegistry inicializado con éxito");
  }

  private static async registerPredefinedFlows() {
    try {
      // Flujo principal de captura de leads
      const leadFlow = await leadCaptureFlow(); 
      if (leadFlow) {
        logger.info("Flujo 'lead-capture' cargado, creando adaptador...");
        
        // Registrar el flujo completo
        this.flows.set('lead-capture', leadFlow);
        logger.info("Flujo 'lead-capture' registrado");
      } else {
        logger.error("No se pudo cargar el flujo 'lead-capture'");
      }
      
      // Flujo PymeBot V1
      try {
        const pymebotModule = await import("../flows/pymebot-v1.flow");
        const pymebotFlow = await pymebotModule.pymebotV1Flow();
        if (pymebotFlow) {
          // Registrar como default-template-1 (PymeBot V1)
          this.flows.set('default-template-1', pymebotFlow);
          logger.info("Flujo 'default-template-1' (PymeBot V1) registrado");
          
          // También registrar como pymebot-v1 para acceso directo
          this.flows.set('pymebot-v1', pymebotFlow);
          logger.info("Flujo 'pymebot-v1' registrado");
        }
      } catch (error) {
        logger.error("Error al cargar flujo PymeBot V1:", error);
      }

      logger.info(`Total de flujos registrados: ${this.flows.size}`);
    } catch (error) {
      logger.error("Error al registrar flujos predefinidos:", error);
    }
  }

  /**
   * Registra una plantilla manualmente
   */
  static registerTemplate(id: string, template: any) {
    this.templates.set(id, template);
    logger.info(`Plantilla '${id}' registrada en FlowRegistry`);
  }

  /**
   * Registra un flujo de BuilderBot
   */
  static registerFlow(id: string, flow: any) {
    this.flows.set(id, flow);
    logger.info(`Flujo '${id}' registrado en FlowRegistry`);
  }

  /**
   * Obtiene un flujo por su ID
   */
  static getFlow(id: string): any {
    return this.flows.get(id);
  }
  
  /**
   * Crea un bot temporal para procesar un mensaje específico
   */
  static async createTemporaryBot(flowId: string, userId: string, tenantId: string, sessionId: string): Promise<{ bot: any; provider: any }> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flujo ${flowId} no encontrado`);
    }
    
    try {
      const { createBot, MemoryDB } = await import("@builderbot/bot");
      const { WebProvider } = await import("../provider/webProvider");
      
      // Debug logging para ver la estructura del flujo
      logger.info(`[createTemporaryBot] Creando bot para flujo ${flowId}`);
      logger.info(`[createTemporaryBot] Tipo de flujo: ${typeof flow}`);
      logger.info(`[createTemporaryBot] Propiedades del flujo:`, Object.keys(flow));
      
      // Verificar si el flujo tiene la estructura esperada de BuilderBot
      if (flow.flowRaw && flow.allCallbacks && flow.flowSerialize) {
        logger.info(`[createTemporaryBot] Flujo tiene estructura completa de BuilderBot`);
      } else {
        logger.warn(`[createTemporaryBot] Flujo puede no tener estructura completa de BuilderBot`);
      }
      
      // Crear un provider específico para este usuario con sessionId
      const provider = new WebProvider(userId, tenantId, sessionId);
      const database = new MemoryDB();
      
      // Parchear el método findSerializeByKeyword si está roto
      if (flow.flowSerialize) {
        logger.info(`[createTemporaryBot] Parcheando findSerializeByKeyword para flujo ${flowId}`);
        // Guardar referencia al flowSerialize
        const flowSerializeRef = flow.flowSerialize;
        
        flow.findSerializeByKeyword = function(keyword: string) {
          logger.info(`[findSerializeByKeyword] Buscando keyword: "${keyword}"`);
          const result = flowSerializeRef?.find((item: any) => {
            if (Array.isArray(item.keyword)) {
              const found = item.keyword.some((kw: string) => kw.toLowerCase() === keyword.toLowerCase());
              if (found) {
                logger.info(`[findSerializeByKeyword] ¡Keyword encontrada! item.keyword: ${JSON.stringify(item.keyword)}`);
              }
              return found;
            }
            return false;
          });
          logger.info(`[findSerializeByKeyword] Resultado: ${result ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
          return result;
        };
        
        // Bind para asegurar contexto
        flow.findSerializeByKeyword = flow.findSerializeByKeyword.bind(flow);
      }
      
      // Si el flujo es un FlowClass, BuilderBot lo usa directamente
      const bot = await createBot({
        flow: flow,
        provider: provider as any,
        database: database
      });
      
      logger.info(`[createTemporaryBot] Bot creado exitosamente`);
      
      return { bot, provider };
    } catch (error) {
      logger.error(`Error creando bot temporal para flujo ${flowId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene o crea un flujo basado en una plantilla
   */
  static async getOrCreateFlowFromTemplate(
    tenantId: string,
    templateId: string,
    templateName?: string
  ): Promise<FlowAdapter | null> {
    const cacheKey = `${tenantId}-${templateId}`;
    
    // Intentar obtener del caché primero
    const cachedFlow = this.flows.get(cacheKey);
    if (cachedFlow) {
      logger.info(`Flujo encontrado en caché: ${cacheKey}`);
      return cachedFlow;
    }

    try {
      // Convertir plantilla a flujo de BuilderBot
      logger.info(`Generando flujo desde plantilla: ${templateId} para tenant: ${tenantId}`);
      const builderbotFlow = await convertTemplateToBuilderbotFlow(
        templateId,
        tenantId
      );

      if (builderbotFlow && builderbotFlow.flow) {
        // Asegurar que sea el FlowClass completo
        const flowAdapter = builderbotFlow.flow;
        
        logger.info(`Flujo creado para plantilla ${templateId}`, {
          hasFlowRaw: !!flowAdapter?.flowRaw,
          hasAllCallbacks: !!flowAdapter?.allCallbacks,
          hasFlowSerialize: !!flowAdapter?.flowSerialize,
          hasFindBySerialize: typeof flowAdapter?.findBySerialize === 'function'
        });

        // Guardar en caché
        this.flows.set(cacheKey, flowAdapter);
        logger.info(`Flujo generado y cacheado: ${cacheKey}`);
        
        return flowAdapter;
      }
    } catch (error) {
      logger.error(`Error al generar flujo desde plantilla ${templateId}:`, error);
    }

    return null;
  }

  /**
   * Limpia el caché de flujos
   */
  static clearCache() {
    this.flows.clear();
    this.templates.clear();
    logger.info("Caché de flujos limpiado");
  }

  /**
   * Lista todos los flujos registrados
   */
  static listFlows(): string[] {
    return Array.from(this.flows.keys());
  }
}

// Registrar desde función externa (para compatibilidad con código existente)
export function registerNewTemplate(templateId: string, flow: any) {
  try {
    logger.info(`Registrando nueva plantilla: ${templateId}`);
    
    // Verificar que el flujo sea válido
    if (!flow || typeof flow !== 'object') {
      logger.error(`Plantilla ${templateId} inválida`);
      return;
    }

    // Si el flow tiene handleMsg, lo registramos como flujo
    if (typeof flow.handleMsg === 'function') {
      FlowRegistry.registerFlow(templateId, flow as FlowAdapter);
    } else {
      // De lo contrario, lo registramos como plantilla
      FlowRegistry.registerTemplate(templateId, flow);
    }

    logger.info(`Plantilla ${templateId} registrada exitosamente`);
  } catch (error) {
    logger.error(`Error al registrar plantilla ${templateId}:`, error);
  }
}

// Obtener instancia del bot para un tenant y plantilla específicos
export async function getBotInstance(tenantId: string, templateId: string, sessionId?: string) {
  return FlowRegistry.createTemporaryBot(templateId, uuidv4(), tenantId, sessionId || uuidv4());
}

// Función principal unificada para procesar mensajes con flujos
export async function processFlowMessage(
  phoneFrom: string,
  messageBody: string,
  tenantId: string,
  sessionId: string,
  templateId: string | null,
  options?: {
    provider?: any;
    shouldClearState?: boolean;
    initialData?: Record<string, any>;
  }
): Promise<any> {
  try {
    const stateKey = `${tenantId}:${phoneFrom}`;
    logger.info(`[flowRegistry] Procesando mensaje desde ${phoneFrom}: "${messageBody}"`);
    
    // Verificar si debemos usar un flujo existente o crear uno nuevo
    let state = _localFlowStates[stateKey] || null;
    
    if (!state || options?.shouldClearState) {
      // Intentar cargar estado existente
      const savedState = await getConversationState(tenantId, phoneFrom, sessionId);
      
      if (savedState && savedState.data && typeof savedState.data === 'object') {
        state = {
          ...savedState.data,
          flowId: savedState.data.flowId || 'lead-capture',
          currentNodeId: savedState.data.currentNodeId || 'start',
          history: savedState.data.history || [],
          metadata: savedState.data.metadata || {},
          tenantId,
          userId: phoneFrom,
          variables: savedState.data.variables || {},
          data: savedState.data.data || {},
          startedAt: savedState.data.startedAt || new Date(),
          lastUpdatedAt: new Date(),
          lastActivity: new Date(),
          sessionStarted: savedState.data.sessionStarted || new Date(),
          sessionId,
          context: savedState.data.context || {}
        } as ExtendedFlowState;
      } else {
        // Crear nuevo estado
        state = {
          flowId: templateId || 'lead-capture',
          currentNodeId: 'start',
          history: [],
          metadata: {
            templateId: templateId || null,
            templateType: templateId ? 'template' : 'predefined',
            version: '1.0.0'
          },
          tenantId,
          userId: phoneFrom,
          variables: {},
          data: {},
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
          sessionId,
          context: {}
        } as ExtendedFlowState;
      }
    }

    // Asegurar que el estado tenga las propiedades requeridas
    if (!state.flowId) {
      state.flowId = 'lead-capture';
    }

    // Asegurar que tenemos un contexto
    if (!state.context) {
      state.context = {};
    }
    
    // Asegurar que el tenantId esté en el estado para procesamiento del sales funnel
    if (!state.tenantId && tenantId) {
      state.tenantId = tenantId;
    }
    
    // También añadirlo al contexto para compatibilidad
    if (!state.context.tenantId && tenantId) {
      state.context.tenantId = tenantId;
    }

    // Aplicar datos iniciales si se proporcionaron
    if (options?.initialData) {
      state.context = { ...state.context, ...options.initialData };
      if (options.initialData.leadId) {
        state.leadId = options.initialData.leadId;
      }
    }

    // Buscar o crear lead para este número de teléfono
    try {
      let leadId = state.context.leadId || state.context.lead_id || options?.initialData?.leadId;
      
      if (!leadId) {
        // Si el phoneFrom es un lead ID (formato lead_XXXX), usarlo directamente
        if (phoneFrom.startsWith('lead_')) {
          leadId = phoneFrom.replace('lead_', '');
          logger.info(`Usando lead ID existente desde identificador: ${leadId}`);
        } else {
          // Solo buscar/crear lead si es un número de teléfono real
          const phonePattern = /^\+?\d{10,}$/; // Patrón simple para números de teléfono
          if (phonePattern.test(phoneFrom.replace(/[\s-()]/g, ''))) {
            // Buscar lead existente por teléfono
            leadId = await findLeadByPhone(phoneFrom, tenantId);
            
            if (!leadId) {
              // Crear nuevo lead si no existe
              logger.info(`Creando nuevo lead para teléfono ${phoneFrom}`);
              leadId = await createLeadIfNotExists(phoneFrom, tenantId, {
                source: 'chatbot',
                name: state.variables?.nombre_usuario || undefined
              });
            }
          } else {
            logger.warn(`phoneFrom "${phoneFrom}" no es un número de teléfono válido, no se creará lead`);
          }
        }
        
        if (leadId) {
          // Guardar leadId en el contexto
          state.context.leadId = leadId;
          state.context.lead_id = leadId; // Guardar en ambos formatos para compatibilidad
          logger.info(`Lead asociado a la conversación: ${leadId}`);
        }
      }
    } catch (error) {
      logger.error(`Error al buscar/crear lead: ${error}`);
      // Continuar sin lead ID
    }

    // Guardar en caché local
    _localFlowStates[stateKey] = state as ExtendedFlowState;

    // Obtener flujo correspondiente
    // Si el flowId es una plantilla (UUID), primero intentamos cargar o crear el flujo
    const flowId = state.flowId;
    
    // Si es un UUID de plantilla y no es un flujo predefinido, intentamos cargar primero
    const builtinFlows = ['lead-capture', 'flujo-basico-lead'];
    let actualFlowId = flowId;
    
    if (!builtinFlows.includes(flowId) && flowId.includes('-')) {
      // Es un UUID, intentar cargar como plantilla con sessionId
      const flowAdapter = await FlowRegistry.getOrCreateFlowFromTemplate(tenantId, flowId);
      if (flowAdapter) {
        FlowRegistry.registerFlow(flowId, flowAdapter);
        logger.info(`Plantilla ${flowId} cargada y registrada`);
      } else {
        logger.warn(`No se pudo cargar plantilla ${flowId}, usando lead-capture como fallback`);
        actualFlowId = 'lead-capture';
        // Actualizar el estado para usar el flow por defecto
        state.flowId = actualFlowId;
      }
    }
    
    // Obtener o crear bot para esta sesión
    const { bot, provider } = await getOrCreateSessionBot(actualFlowId, phoneFrom, tenantId, sessionId);
    if (!bot) {
      throw new Error(`No se pudo crear bot para flujo ${actualFlowId}`);
    }
    
    // Guardar contexto de sesión para acceso en callbacks
    setSessionContext(phoneFrom, { tenantId, sessionId, templateId });

    // Limpiar mensajes anteriores del provider
    provider.queuedMessages = [];
    // Limpiar metadatos anteriores
    provider.messageMetadata = {};
    
    // Procesar el mensaje con el bot
    try {
      logger.info(`[flowRegistry] Enviando mensaje al bot: "${messageBody}"`);
      
      // Establecer la sesión actual para captura de variables
      setCurrentSession(sessionId);
      
      // Si tenemos un provider pasado como opción, usarlo para capturar las respuestas
      const currentProvider = options?.provider || provider;
      
      // Asegurar que el mensaje se envíe con el formato correcto
      const ctx = {
        from: phoneFrom,
        body: messageBody,
        name: phoneFrom
      };
      
      // Para capturar los mensajes enviados por el bot, necesitamos interceptar el sendMessage
      const originalSendMessage = provider.sendMessage.bind(provider);
      const interceptedMessages: any[] = [];
      
      // Interceptar los mensajes enviados
      provider.sendMessage = async (userId: string, message: any, options?: any) => {
        logger.info(`[flowRegistry] Interceptando: ${typeof message}`);
        
        // Si el mensaje es un objeto (puede contener body y buttons)
        if (typeof message === 'object' && message !== null) {
          
          // Reemplazar variables si hay body
          if (message.body) {
            const capturedVariables = getSessionVariables(sessionId);
            
            // Obtener variables del sistema del tenant
            let systemVars = {};
            try {
              systemVars = await systemVariablesLoader.getSystemVariablesForTenant(state.tenantId);
              logger.info(`[flowRegistry] Variables del sistema para tenant ${state.tenantId}:`, systemVars);
            } catch (error) {
              logger.error(`[flowRegistry] Error al obtener variables del sistema:`, error);
            }
            
            // IMPORTANTE: Intentar obtener el estado actual de BuilderBot
            let currentStateVars = {};
            try {
              // Primero intentar obtener variables del estado local (flowRegistry)
              if (state && state.variables) {
                currentStateVars = { ...state.variables };
                logger.info(`[flowRegistry] Variables del estado local (state.variables):`, currentStateVars);
              }
              
              // Luego intentar obtener variables capturadas en la sesión actual
              const sessionCapturedVars = getSessionVariables(sessionId);
              if (sessionCapturedVars && Object.keys(sessionCapturedVars).length > 0) {
                currentStateVars = { ...currentStateVars, ...sessionCapturedVars };
                logger.info(`[flowRegistry] Variables capturadas en la sesión:`, sessionCapturedVars);
              }
              
              // También incluir variables del contexto si existen
              if (state && state.context) {
                currentStateVars = { ...currentStateVars, ...state.context };
                logger.info(`[flowRegistry] Variables del contexto:`, state.context);
              }
              
              // Incluir variables específicas conocidas si no están ya presentes
              const specificVars = ['nombre_lead', 'servicio_seleccionado', 'producto_seleccionado', 'fecha_cita', 'hora_cita'];
              for (const varName of specificVars) {
                if (!currentStateVars[varName] && state && state[varName]) {
                  currentStateVars[varName] = state[varName];
                }
              }
            } catch (error) {
              logger.warn(`[flowRegistry] No se pudo obtener el estado actual:`, error);
            }
            
            // Combinar todas las fuentes de variables
            const mergedVariables = { 
              ...state.variables, // Variables del estado del flowRegistry
              ...currentStateVars, // Variables del estado de BuilderBot
              ...capturedVariables, // Variables capturadas durante la sesión
              ...systemVars // Variables del sistema
            };
            const replacedBody = replaceVariables(message.body, mergedVariables);
            message.body = replacedBody;
            logger.info(`[flowRegistry] Mensaje con variables reemplazadas: "${replacedBody}"`);
          }
          
          // Capturar el mensaje completo con botones si los tiene
          const capturedMessage: any = {
            body: message.body || '',
            buttons: message.buttons || []
          };
          
          interceptedMessages.push(capturedMessage);
          
          // Llamar al original con el formato esperado
          return originalSendMessage(userId, message, options);
        } else {
          // Mensaje es string
          const capturedVariables = getSessionVariables(sessionId);
          
          // Obtener variables del sistema del tenant
          let systemVars = {};
          try {
            systemVars = await systemVariablesLoader.getSystemVariablesForTenant(state.tenantId);
            logger.info(`[flowRegistry] Variables del sistema para tenant ${state.tenantId}:`, systemVars);
          } catch (error) {
            logger.error(`[flowRegistry] Error al obtener variables del sistema:`, error);
          }
          
          const mergedVariables = { ...state.variables, ...capturedVariables, ...systemVars };
          const replacedMessage = replaceVariables(message, mergedVariables);
          // Capturar el mensaje con sus opciones (que incluyen botones)
          const messageData: any = {
            body: replacedMessage,
            options: options || {}
          };
          
          // Buscar botones en las opciones
          if (options?.options?.buttons) {
            messageData.buttons = options.options.buttons;
          }
          
          interceptedMessages.push(messageData);
          
          return originalSendMessage(userId, replacedMessage, options);
        }
      };
      
      // También interceptar sendButtons
      const originalSendButtons = provider.sendButtons?.bind(provider);
      if (originalSendButtons) {
        provider.sendButtons = async (userId: string, buttons: any[], text?: string) => {
          logger.info(`[flowRegistry] Interceptado sendButtons`);
          logger.info(`[flowRegistry] Botones:`, JSON.stringify(buttons));
          
          interceptedMessages.push({
            body: text || '',
            buttons: buttons
          });
          
          return originalSendButtons(userId, buttons, text);
        };
      }
      
      // Interceptar el vendor para capturar llamadas a flowDynamic
      const vendor = provider.vendor;
      if (vendor) {
        const originalEmit = vendor.emit?.bind(vendor);
        if (originalEmit) {
          vendor.emit = (event: string, ...args: any[]) => {
            logger.info(`[flowRegistry] Vendor emit: ${event}`, args);
            return originalEmit(event, ...args);
          };
        }
      }
      
      // CAMBIO IMPORTANTE: Agregar metadata con tenantId, sessionId y leadId
      // Esto permite que el estado tenga acceso a estos valores
      const messageWithMetadata = {
        ...ctx,
        _metadata: {
          tenantId,
          sessionId,
          leadId: state.context?.leadId || state.context?.lead_id || state.leadId
        },
        _sessionId: sessionId,  // Backup para compatibilidad
        leadId: state.context?.leadId || state.context?.lead_id || state.leadId  // También pasar directamente
      };
      
      // También intentar inyectar en el provider para acceso global
      if (provider) {
        provider.tenantId = tenantId;
        provider.sessionId = sessionId;
      }
      
      // DEBUGGING: Verificar que el flujo tenga las keywords antes de enviar el mensaje
      const flowForDebugging = FlowRegistry.getFlow(actualFlowId);
      if (flowForDebugging && flowForDebugging.findSerializeByKeyword) {
        logger.info(`[flowRegistry] 🔍 DEBUGGING: Probando findSerializeByKeyword con "hola"`);
        try {
          const holaResult = flowForDebugging.findSerializeByKeyword('hola');
          logger.info(`[flowRegistry] 🔍 DEBUGGING: findSerializeByKeyword('hola'): ${holaResult ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
          if (holaResult) {
            logger.info(`[flowRegistry] 🔍 DEBUGGING: holaResult details:`, JSON.stringify(holaResult));
          }
          
          // También probar con HOLA
          const HOLAResult = flowForDebugging.findSerializeByKeyword('HOLA');
          logger.info(`[flowRegistry] 🔍 DEBUGGING: findSerializeByKeyword('HOLA'): ${HOLAResult ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
          
          // Listar todas las keywords disponibles si flowSerialize existe
          if (flowForDebugging.flowSerialize && Array.isArray(flowForDebugging.flowSerialize)) {
            const allKeywords = flowForDebugging.flowSerialize.map(item => item.keyword).flat();
            logger.info(`[flowRegistry] 🔍 DEBUGGING: Keywords disponibles en el flujo:`, allKeywords);
            
            // DEBUGGING ADICIONAL: Inspeccionar la estructura de cada item en flowSerialize
            logger.info(`[flowRegistry] 🔍 DEBUGGING: Estructura de flowSerialize (primeros 3 items):`);
            flowForDebugging.flowSerialize.slice(0, 3).forEach((item, index) => {
              logger.info(`[flowRegistry] 🔍 DEBUGGING: Item ${index}:`, {
                keyword: item.keyword,
                keywordType: Array.isArray(item.keyword) ? 'array' : typeof item.keyword,
                ref: item.ref,
                refSerialize: item.refSerialize
              });
            });
            
            // DEBUGGING: Probar manualmente la búsqueda
            const manualResult = flowForDebugging.flowSerialize.find(item => {
              if (Array.isArray(item.keyword)) {
                return item.keyword.some(kw => kw.toLowerCase() === 'hola');
              }
              return false;
            });
            logger.info(`[flowRegistry] 🔍 DEBUGGING: Búsqueda manual de 'hola': ${manualResult ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
            if (manualResult) {
              logger.info(`[flowRegistry] 🔍 DEBUGGING: Resultado manual:`, manualResult);
            }
          }
        } catch (error) {
          logger.error(`[flowRegistry] 🔍 DEBUGGING: Error probando findSerializeByKeyword:`, error);
        }
      } else {
        logger.warn(`[flowRegistry] 🔍 DEBUGGING: Flujo no tiene findSerializeByKeyword o no se encontró`);
      }
      
      // Simular un mensaje entrante a través del provider
      // BuilderBot espera que los mensajes lleguen a través del provider
      logger.info(`[flowRegistry] 🎯 Enviando evento 'message' al provider con mensaje: "${messageBody}"`);
      provider.emit('message', messageWithMetadata);
      
      // Esperar un poco para que el bot procese
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Restaurar el sendMessage original ANTES de verificar los mensajes
      provider.sendMessage = originalSendMessage;
      if (originalSendButtons) {
        provider.sendButtons = originalSendButtons;
      }
      
      // Verificar INMEDIATAMENTE el WebProvider después del timeout
      if (provider && provider.queuedMessages && provider.queuedMessages.length > 0) {
        logger.info(`[flowRegistry] WebProvider tiene ${provider.queuedMessages.length} mensajes después del timeout`);
        
        // Procesar mensajes del WebProvider
        const webProviderMessages = provider.queuedMessages.map(msg => ({
          body: msg,
          buttons: []
        }));
        
        // Capturar los mensajes antes de limpiar la cola
        const capturedProviderMessages = [...provider.queuedMessages];
        
        // Reemplazar variables en los mensajes
        for (const msg of webProviderMessages) {
          try {
            const capturedVariables = getSessionVariables(sessionId);
            let systemVars = {};
            try {
              systemVars = await systemVariablesLoader.getSystemVariablesForTenant(state.tenantId);
            } catch (error) {
              logger.error(`[flowRegistry] Error al obtener variables del sistema:`, error);
            }
            
            // Intentar obtener estado actual del bot para acceder a variables de productos
            let botStateVars = {};
            try {
              const sessionKey = `${tenantId}:${sessionId}:${templateId}`;
              const sessionBot = sessionBots.get(sessionKey);
              logger.info(`[flowRegistry] Buscando bot en cache con key: ${sessionKey}`);
              logger.info(`[flowRegistry] Bot encontrado: ${!!sessionBot}`);
              if (sessionBot && sessionBot.bot) {
                // Intentar múltiples formas de acceder al estado del bot
                let botState = null;
                
                // Método 1: getMyState (si existe)
                if (typeof sessionBot.bot.getMyState === 'function') {
                  try {
                    botState = await sessionBot.bot.getMyState();
                    logger.info(`[flowRegistry] Estado obtenido vía getMyState`);
                  } catch (error) {
                    logger.warn(`[flowRegistry] Error en getMyState:`, error);
                  }
                }
                
                // Método 2: state directo
                if (!botState && sessionBot.bot.state) {
                  botState = sessionBot.bot.state;
                  logger.info(`[flowRegistry] Estado obtenido vía bot.state`);
                }
                
                // Método 3: dbPrefix y memoria
                if (!botState && sessionBot.bot.db && sessionBot.bot.db.listHistory) {
                  try {
                    const dbHistory = await sessionBot.bot.db.listHistory(phoneFrom);
                    if (dbHistory && dbHistory.length > 0) {
                      // Buscar el último estado con variables
                      const lastEntry = dbHistory[dbHistory.length - 1];
                      if (lastEntry && lastEntry.state) {
                        botState = lastEntry.state;
                        logger.info(`[flowRegistry] Estado obtenido vía db.listHistory`);
                      }
                    }
                  } catch (error) {
                    logger.warn(`[flowRegistry] Error accediendo a db.listHistory:`, error);
                  }
                }
                
                // Método 4: Acceso a provider para buscar variables guardadas
                if (!botState && sessionBot.provider && sessionBot.provider._internalState) {
                  botState = sessionBot.provider._internalState;
                  logger.info(`[flowRegistry] Estado obtenido vía provider._internalState`);
                }
                
                if (botState && typeof botState === 'object') {
                  botStateVars = botState;
                  logger.info(`[flowRegistry] Bot vars disponibles: ${Object.keys(botState).join(', ')}`);
                  // Log específico para variables de productos
                  if (botState.product_list_formatted) {
                    logger.info(`[flowRegistry] product_list_formatted encontrada: ${botState.product_list_formatted}`);
                  }
                  if (botState.products_list) {
                    logger.info(`[flowRegistry] products_list encontrada: ${botState.products_list}`);
                  }
                } else {
                  logger.warn(`[flowRegistry] No se pudo obtener el estado del bot`);
                }
              } else {
                logger.warn(`[flowRegistry] Bot no encontrado en caché`);
              }
            } catch (error) {
              logger.warn(`[flowRegistry] Error al obtener estado del bot:`, error);
            }
            
            // IMPORTANTE: Obtener variables del store global de sesión
            let globalSessionVars = {};
            try {
              const { getSessionVariables } = await import("./sessionVariableStore");
              globalSessionVars = getSessionVariables(sessionId);
              logger.info(`[flowRegistry] Variables del store global para sesión ${sessionId}:`, globalSessionVars);
            } catch (error) {
              logger.warn(`[flowRegistry] Error obteniendo variables del store global:`, error);
            }
            
            const mergedVariables = { 
              ...state.variables, 
              ...capturedVariables, 
              ...systemVars,
              ...botStateVars, // Incluir variables del estado del bot
              ...globalSessionVars // IMPORTANTE: Variables del store global (incluye productos)
            };
            msg.body = replaceVariables(msg.body, mergedVariables);
          } catch (error) {
            logger.warn(`[flowRegistry] Error al reemplazar variables:`, error);
          }
        }
        
        // Limpiar la cola del WebProvider para evitar duplicados
        provider.queuedMessages = [];
        
        const sessionStage = getSessionStage(sessionId);
        
        const response = {
          answer: webProviderMessages,
          media: [],
          buttons: [],
          delay: 0,
          context: {
            ...(sessionStage && { currentLeadStage: sessionStage }),
            ...((state as any).currentLeadStage && { currentLeadStage: (state as any).currentLeadStage }),
            ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
          }
        };
        
        logger.info(`[flowRegistry] Enviando ${webProviderMessages.length} msgs desde WebProvider (post-timeout)`);
        
        // IMPORTANTE: Saltarse las verificaciones posteriores ya que ya procesamos los mensajes
        return response;
      }
      
      // Verificar si hay mensajes en la cola de navegación de botones
      const queueKey = `${tenantId}:${phoneFrom}:${sessionId}`;
      const queuedMessages = dequeueMessages(queueKey);
      if (queuedMessages.length > 0) {
        logger.info(`[flowRegistry] ${queuedMessages.length} mensajes encontrados en la cola de navegación`);
        
        // Combinar con los mensajes interceptados
        for (const msg of queuedMessages) {
          if (!interceptedMessages.some(im => im.body === msg.body)) {
            interceptedMessages.push(msg);
          }
        }
      }
      
      // No agregar mensajes del provider ya que ya se interceptaron
      // Esto evita duplicados
      // if (provider.queuedMessages.length > 0) {
      //   interceptedMessages.push(...provider.queuedMessages);
      // }
      
      // FALLBACK: Si no se capturaron mensajes en el timeout, ya se manejó arriba
      
      // Verificar mensajes interceptados (fallback)
      if (interceptedMessages.length > 0) {
        logger.info(`[flowRegistry] Mensajes interceptados: ${interceptedMessages.length}`);
        
        // Extraer botones del último mensaje si los tiene
        const allButtons: any[] = [];
        const messages: any[] = [];
        
        interceptedMessages.forEach(msg => {
          // Si es un string, es un mensaje simple
          if (typeof msg === 'string') {
            messages.push({ body: msg });
          } else if (msg.body) {
            messages.push({ body: msg.body });
            
            // Si tiene botones directamente, capturarlos
            if (msg.buttons && Array.isArray(msg.buttons)) {
              allButtons.push(...msg.buttons);
            }
            // Si tiene botones en las opciones, capturarlos
            else if (msg.options?.options?.buttons && Array.isArray(msg.options.options.buttons)) {
              allButtons.push(...msg.options.options.buttons);
            }
          }
        });
        
        // También capturar botones de los metadatos del provider si existen
        if (provider.messageMetadata?.buttons && Array.isArray(provider.messageMetadata.buttons)) {
          logger.info(`[flowRegistry] Agregando botones de metadatos:`, JSON.stringify(provider.messageMetadata.buttons));
          allButtons.push(...provider.messageMetadata.buttons);
        }
        
        // Obtener el stage de la sesión si está disponible
        const sessionStage = getSessionStage(sessionId);
        
        const response = {
          answer: messages,
          media: [],
          buttons: allButtons,
          delay: 0,
          // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
          context: {
            ...(sessionStage && { currentLeadStage: sessionStage }),
            ...((state as any).currentLeadStage && { currentLeadStage: (state as any).currentLeadStage }),
            ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
          }
        };
        
        logger.info(`[flowRegistry] Devolviendo ${messages.length} mensajes y ${allButtons.length} botones`);
        logger.info(`[flowRegistry] Estado actual del lead: ${state.context?.currentLeadStage}`);
        logger.info(`[flowRegistry] Respuesta completa:`, JSON.stringify(response));
        return response;
      }
      
      // Verificar si el provider tiene mensajes capturados
      const capturedMessages = provider.getAllResponses?.() || provider.queuedMessages || [];
      logger.info(`[flowRegistry] Mensajes capturados en el provider: ${capturedMessages.length}`, capturedMessages);
      
      // Construir respuesta basada en los mensajes capturados
      if (capturedMessages.length > 0) {
        const sessionStage = getSessionStage(sessionId);
        
        // Filtrar mensajes que no tengan variables sin reemplazar
        const filteredMessages = capturedMessages.filter(msg => 
          !(msg.includes('{{') && msg.includes('}}'))
        );
        
        // Si no hay mensajes válidos, usar todos los mensajes
        const finalMessages = filteredMessages.length > 0 ? filteredMessages : capturedMessages;
        
        const response = {
          answer: finalMessages.map(msg => ({ body: msg })),
          media: [],
          buttons: [],
          delay: 0,
          // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
          context: {
            ...(sessionStage && { currentLeadStage: sessionStage }),
            ...((state as any).currentLeadStage && { currentLeadStage: (state as any).currentLeadStage }),
            ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
          }
        };
        
        logger.info(`[flowRegistry] Devolviendo respuesta con ${finalMessages.length} mensajes (filtrados de ${capturedMessages.length})`);
        logger.info(`[flowRegistry] Estado actual del lead: ${state.context?.currentLeadStage}`);
        return response;
      }
      
      
      // Si nada funcionó, devolver un mensaje por defecto
      logger.warn(`[flowRegistry] No se obtuvieron respuestas del bot`);
      const sessionStage = getSessionStage(sessionId);
      
      return {
        answer: [{ body: "Lo siento, no pude procesar tu mensaje." }],
        media: [],
        buttons: [],
        delay: 0,
        // Incluir salesStageId del contexto si está disponible - también chequear estado directo y sesión
        context: {
          ...(sessionStage && { currentLeadStage: sessionStage }),
          ...((state as any).currentLeadStage && { currentLeadStage: (state as any).currentLeadStage }),
          ...(state.context?.currentLeadStage && { currentLeadStage: state.context.currentLeadStage })
        }
      };
      
    } catch (error) {
      logger.error(`[flowRegistry] Error al procesar mensaje con el bot:`, error);
      throw error;
    }
    
  } catch (error) {
    logger.error(`[flowRegistry] Error en processFlowMessage:`, error);
    throw error;
  }
}

// Función para guardar el estado en background
async function saveStateBackground(
  tenantId: string,
  userId: string,
  sessionId: string,
  state: ExtendedFlowState
): Promise<void> {
  try {
    await saveConversationState(tenantId, userId, sessionId, state);
    logger.debug(`Estado guardado correctamente en background para sesión ${tenantId}:${userId}`);
  } catch (error) {
    logger.error("Error al guardar estado en background:", error);
  }
}

// Cleanup function para limpiar estados antiguos
export function cleanupOldStates(maxAgeHours: number = 24): number {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [key, state] of Object.entries(_localFlowStates)) {
    if (state.lastUpdatedAt) {
      const stateAge = now - new Date(state.lastUpdatedAt).getTime();
      if (stateAge > maxAge) {
        delete _localFlowStates[key];
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    logger.info(`Limpiados ${cleaned} estados locales antiguos`);
  }

  return cleaned;
}

// Configurar limpieza periódica
setInterval(() => {
  cleanupOldStates();
}, 30 * 60 * 1000); // Cada 30 minutos

// Exportar funciones de estado para compatibilidad
export const flowStates = _localFlowStates;

// Inicializar al importar
FlowRegistry.initialize().catch(error => {
  logger.error("Error al inicializar FlowRegistry:", error);
});