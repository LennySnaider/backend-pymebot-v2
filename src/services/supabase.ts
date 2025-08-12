/**
 * src/services/supabase.ts
 *
 * Servicio para la integración con Supabase.
 * Proporciona funciones para interactuar con la base de datos y el sistema de autenticación.
 * @version 1.3.0
 * @updated 2025-04-28
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import logger from "../utils/logger";

// --- Tipos de Datos ---

export interface Tenant {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  api_key?: string;
  max_requests?: number; // Límite de llamadas API (puede estar obsoleto si se usa 'usage')
  max_tokens?: number; // Límite de tokens (puede estar obsoleto si se usa 'usage')
  owner_id?: string;
}

// Interfaz simplificada, ajustar según necesidad
export interface Bot {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  created_at: string;
  active: boolean;
  settings?: Record<string, any>;
}

// Interfaz para mensajes (ajustada para incluir campos observados)
export interface Message {
  id?: string;
  tenant_id: string; // UUID del tenant
  bot_id: string; // UUID del bot/flujo activado
  user_id: string; // UUID del usuario final o 'anonymous'
  session_id: string; // UUID de la sesión de conversación
  content: string;
  content_type: "text" | "audio" | "image";
  role: "user" | "bot" | "system"; // 'system' añadido
  created_at?: string;
  processed?: boolean; // ¿Se procesó el mensaje? (puede ser obsoleto)
  audio_url?: string;
  transcription?: string | null;
  sender_type?: "user" | "bot" | "system"; // Redundante con 'role'?
  template_id?: string; // ID de la plantilla usada (si aplica)
  tokens_used?: number; // Tokens consumidos por este mensaje
}

// Interfaz para representar la tabla chatbot_templates
export interface ChatbotTemplateBase {
  id: string;
  name: string;
  description?: string;
  status?: "draft" | "published";
  created_at: string;
  updated_at: string;
  react_flow_json?: any; // O un tipo más específico si se conoce
  version?: number;
  created_by?: string; // UUID del usuario creador
  // Estructura alternativa para compatibilidad con formato de API
  nodes?: Record<string, any>;
  entryNodeId?: string;
  // Añadir otros campos existentes si son necesarios: bot_type, is_deleted, vertical_id
}

// Interfaz para plantillas combinadas con datos de instancia (para UI)
export interface ChatTemplate {
  id: string; // ID de chatbot_templates
  name: string;
  description?: string;
  created_at: string; // De chatbot_templates
  updated_at: string; // De chatbot_templates
  is_active: boolean; // Estado de la instancia (flows.is_active)
  tenant_id?: string | null; // ID del tenant de la instancia (flows.tenant_id)
  tokens_estimated?: number; // Valor por defecto o calculado
  category?: string; // Valor por defecto o de verticals?
  configuration?: Record<string, any>; // Valor por defecto o de tenant_chatbot_configurations?
  is_public?: boolean; // ¿Basado en status?
  status?: "draft" | "published"; // De chatbot_templates
  flowId?: string | null; // ID de la instancia en 'flows'
  isEnabled?: boolean; // ¿Basado en status 'published'?
  avatarUrl?: string; // Valor por defecto
  // Campos de la plantilla base que podrían ser útiles
  version?: number;
  author?: string; // Mapeado desde created_by
}

// Interfaz para la tabla de acceso (simplificada a esquema real)
export interface TenantTemplateAccess {
  tenant_id: string;
  template_id: string;
  created_at?: string;
}

// Interfaz para la tabla de uso diario
export interface Usage {
  id?: string;
  tenant_id: string;
  date: string; // YYYY-MM-DD
  api_calls?: number;
  audio_seconds?: number;
  unique_users?: number;
  tokens_used?: number;
}

// Interfaz para la tabla de flujos (instancias de plantillas)
export interface Flow {
  id: string; // ID de la instancia del flujo
  name: string; // Nombre de la instancia (puede ser el de la plantilla)
  description?: string;
  version?: string; // Versión de la plantilla instanciada
  entry_node_id?: string; // Nodo de inicio (snake_case como en DB)
  tenant_id: string | null; // UUID del tenant o NULL para 'default'
  is_active: boolean; // Si esta instancia específica está activa
  created_at?: string;
  updated_at?: string;
  tags?: string[];
  category?: string;
  author?: string; // Mapeado desde created_by de la plantilla
  parent_template_id: string; // ID de la plantilla base en chatbot_templates
  edit_permission?: "none" | "content" | "full"; // Nivel de edición permitido
}

// --- Cliente Supabase ---

let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

// Cache para plantillas con TTL de 5 minutos
const templateCache = {
  data: null as ChatTemplate[] | null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutos
  tenantId: null as string | null,
  
  isValid(tenantId: string): boolean {
    return this.data !== null && 
           this.tenantId === tenantId && 
           Date.now() - this.timestamp < this.ttl;
  },
  
  set(tenantId: string, data: ChatTemplate[]) {
    this.data = data;
    this.tenantId = tenantId;
    this.timestamp = Date.now();
  },
  
  clear() {
    this.data = null;
    this.timestamp = 0;
    this.tenantId = null;
  }
};

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      logger.error("Faltan credenciales de Supabase (URL, SERVICE_KEY)");
      throw new Error("Supabase URL o Service Key no configuradas.");
    }
    // Backend usa SERVICE_ROLE_KEY para operaciones del servidor
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);
  }
  return supabaseClient;
};

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdminClient) {
    // Verificar configuración de Supabase
    if (!config.supabase.url || !config.supabase.serviceKey) {
      logger.error("Faltan credenciales de Supabase Admin (URL, SERVICE_KEY)");
      logger.error(`URL value: ${config.supabase.url}`);
      logger.error(`Service Key value: ${config.supabase.serviceKey}`);
      throw new Error("Supabase URL o Service Key no configuradas.");
    }
    supabaseAdminClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        global: {
          fetch: (url, options = {}) => {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(30000), // 30 segundos timeout
            });
          },
        },
      }
    );
  }
  return supabaseAdminClient;
};

// --- Funciones Auxiliares ---

/**
 * Función helper para reintentar consultas a Supabase con manejo de errores
 */
async function retrySupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delay = 1000
): Promise<{ data: T | null; error: any }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await queryFn();
      if (!result.error) {
        return result;
      }
      
      if (attempt === retries) {
        return result; // Último intento, devolver el error
      }
      
      logger.warn(`Reintento ${attempt}/${retries} fallido:`, result.error);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    } catch (error) {
      if (attempt === retries) {
        return { data: null, error };
      }
      
      logger.warn(`Reintento ${attempt}/${retries} con error:`, error);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  return { data: null, error: new Error('Max retries exceeded') };
}

/**
 * Convierte el tenant_id "default" a un UUID válido o valida el UUID existente.
 * Devuelve el UUID por defecto configurado si la entrada es inválida o "default".
 * @param tenantId ID del tenant a convertir/validar
 * @returns UUID válido para el tenant
 */
export const getValidTenantUuid = (
  tenantId: string | null | undefined
): string => {
  const defaultUuid =
    config.multitenant.defaultTenantUuid ||
    "00000000-0000-0000-0000-000000000000";
  try {
    if (!tenantId || tenantId === "default") {
      return defaultUuid;
    }
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      logger.warn(
        `tenant_id no es un UUID válido: '${tenantId}', usando UUID por defecto: ${defaultUuid}`
      );
      return defaultUuid;
    }
    return tenantId;
  } catch (error) {
    logger.error(`Error al procesar tenant_id '${tenantId}':`, error);
    return defaultUuid;
  }
};

/**
 * Valida si un ID es un UUID. Si no, devuelve un UUID por defecto.
 * @param id El ID a validar.
 * @param defaultUuid El UUID a devolver si la validación falla.
 * @returns El UUID original si es válido, o el UUID por defecto.
 */
const ensureValidUuid = (
  id: string | null | undefined,
  defaultUuid: string,
  fieldName: string
): string => {
  if (!id) {
    logger.debug(
      `Campo ${fieldName} está vacío, usando UUID por defecto: ${defaultUuid}`
    );
    return defaultUuid;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    logger.warn(
      `Campo ${fieldName} ('${id}') no es un UUID válido, usando UUID por defecto: ${defaultUuid}`
    );
    return defaultUuid;
  }
  return id;
};

// --- Operaciones Principales ---

/**
 * Verifica si un tenant es válido y está activo en la tabla 'tenants'.
 * @param tenantId ID del tenant a verificar
 * @returns true si el tenant es válido y está activo
 */
export const isTenantValid = async (tenantId: string): Promise<boolean> => {
  try {
    const supabase = getSupabaseAdminClient();
    const validTenantId = getValidTenantUuid(tenantId);

    // Si el ID validado es el default, asumimos que no es un tenant real "activo"
    if (
      validTenantId ===
      (config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000")
    ) {
      logger.debug(
        `isTenantValid: Usando UUID por defecto, considerando inválido/inactivo.`
      );
      return false;
    }

    const { data, error } = await supabase
      .from("tenants")
      .select("active") // 'active' es la columna en la tabla tenants
      .eq("id", validTenantId)
      .single();

    if (error) {
      // Si el error es "No rows found", el tenant no existe
      if (error.code === "PGRST116") {
        logger.warn(`Tenant ${validTenantId} no encontrado.`);
        return false;
      }
      logger.error(`Error al verificar tenant ${validTenantId}:`, error);
      return false;
    }

    return data?.active === true;
  } catch (error) {
    logger.error(
      `Excepción al verificar validez de tenant ${tenantId}:`,
      error
    );
    return false;
  }
};

/**
 * Registra un mensaje en la tabla 'messages'.
 * Asegura que todos los UUIDs (tenant_id, bot_id, session_id, user_id) sean válidos.
 * @param message Mensaje a registrar
 * @returns ID del mensaje registrado o null si falla
 */
export const logMessage = async (
  message: Omit<Message, "id" | "created_at">
): Promise<string | null> => {
  try {
    if (!config.supabase.enabled) {
      logger.debug("Supabase deshabilitado, no se registrará el mensaje.");
      return null;
    }

    const supabase = getSupabaseAdminClient();
    const messageToInsert = { ...message };

    // Validar y asignar UUIDs
    messageToInsert.tenant_id = getValidTenantUuid(messageToInsert.tenant_id);
    // Asumimos que bot_id debe ser un UUID de un flujo existente
    messageToInsert.bot_id = ensureValidUuid(
      messageToInsert.bot_id,
      "00000000-0000-0000-0000-000000000000",
      "bot_id"
    );
    messageToInsert.session_id = ensureValidUuid(
      messageToInsert.session_id,
      "22222222-2222-4222-a222-222222222222",
      "session_id"
    );
    // Permitimos 'anonymous' como user_id válido, pero si no, debe ser UUID
    if (messageToInsert.user_id !== "anonymous") {
      messageToInsert.user_id = ensureValidUuid(
        messageToInsert.user_id,
        "33333333-3333-4333-a333-333333333333",
        "user_id"
      );
    }

    logger.debug(
      `Registrando mensaje para tenant: ${messageToInsert.tenant_id}, bot: ${messageToInsert.bot_id}, session: ${messageToInsert.session_id}, user: ${messageToInsert.user_id}`
    );

    // Añadir timeout para evitar colgados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos máximo
    
    const { data, error } = await supabase
      .from("messages") // Asegúrate que la tabla se llame 'messages'
      .insert(messageToInsert)
      .select("id")
      .single();
      
    clearTimeout(timeoutId);

    if (error) {
      logger.error("Error al registrar mensaje:", {
        message: error.message,
        details: error.details,
        code: error.code,
      });
      return null;
    }

    logger.debug(`Mensaje registrado con ID: ${data.id}`);
    return data.id;
  } catch (error) {
    logger.error("Excepción al registrar mensaje:", error);
    return null;
  }
};

/**
 * Incrementa el contador de uso diario para un tenant en la tabla 'usage'.
 * Utiliza una función RPC para manejo atómico.
 * @param tenantId ID del tenant
 * @param tokensUsed Tokens utilizados (o segundos de audio si aplica)
 */
export const incrementUsage = async (
  tenantId: string,
  tokensUsed: number = 0 // Default a 0 si solo contamos llamadas API
): Promise<void> => {
  try {
    if (!config.supabase.enabled) {
      logger.debug("Supabase deshabilitado, no se incrementará el uso.");
      return;
    }

    const supabase = getSupabaseAdminClient();
    const today = new Date().toISOString().split("T")[0];
    const tenantIdForDb = getValidTenantUuid(tenantId);

    // No registrar uso para el tenant por defecto
    if (
      tenantIdForDb ===
      (config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000")
    ) {
      logger.debug("No se registra uso para el tenant por defecto.");
      return;
    }

    logger.debug(
      `incrementUsage: Intentando incrementar uso para tenant ${tenantIdForDb} en fecha ${today}`
    );

    // Usar RPC para upsert y atomic increment
    // Asegúrate que la función RPC 'increment_usage' exista en tu base de datos
    const { error: rpcError } = await supabase.rpc("increment_usage", {
      p_tenant_id: tenantIdForDb,
      p_date: today,
      p_api_calls_increment: 1, // Siempre incrementamos 1 llamada
      p_tokens_increment: tokensUsed,
    });

    if (rpcError) {
      logger.error(
        `Error al llamar RPC increment_usage para tenant ${tenantIdForDb}:`,
        rpcError
      );
    } else {
      logger.debug(`Uso incrementado vía RPC para tenant ${tenantIdForDb}`);
    }
  } catch (error) {
    logger.error(
      `Excepción al incrementar uso para tenant ${tenantId}:`,
      error
    );
  }
};

/**
 * Verifica si un tenant ha excedido su cuota de uso diario o mensual (si existe tabla tenant_limits).
 * @param tenantId ID del tenant a verificar
 * @returns true si el tenant ha excedido su cuota
 */
export const hasTenantExceededQuota = async (
  tenantId: string
): Promise<boolean> => {
  try {
    if (!config.supabase.enabled) {
      logger.debug("Supabase deshabilitado, cuota no verificada (permitido).");
      return false;
    }

    const supabase = getSupabaseAdminClient();
    const tenantIdForDb = getValidTenantUuid(tenantId);

    // No aplicar cuota al tenant por defecto
    if (
      tenantIdForDb ===
      (config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000")
    ) {
      logger.debug("No se aplica cuota para el tenant por defecto.");
      return false;
    }

    logger.debug(
      `hasTenantExceededQuota: Verificando cuota para tenant ${tenantIdForDb}`
    );

    // Intentar obtener límites de la tabla tenant_limits (si existe)
    // Esta parte asume que tienes una tabla 'tenant_limits' con la estructura mencionada
    // Si no la tienes, esta consulta fallará o devolverá error 'relation does not exist'
    let limitsData: {
      daily_limit: number | null;
      monthly_limit: number | null;
      used_today: number;
      used_this_month: number;
    } | null = null;
    try {
      const { data: limits, error: limitsError } = await supabase
        .from("tenant_limits")
        .select("daily_limit, monthly_limit, used_today, used_this_month")
        .eq("tenant_id", tenantIdForDb)
        .single();

      if (limitsError && limitsError.code !== "PGRST116") {
        // PGRST116 = no rows found
        logger.error(
          `Error al obtener límites (tenant_limits) para tenant ${tenantIdForDb}:`,
          limitsError
        );
        // Continuar para verificar límites legados si existen
      } else if (limits) {
        limitsData = limits;
      }
    } catch (e) {
      logger.warn(
        "Error al consultar 'tenant_limits', puede que la tabla no exista. Verificando límites legados.",
        e
      );
    }

    if (limitsData) {
      // Usar datos de tenant_limits
      const exceededDaily =
        limitsData.daily_limit !== null &&
        limitsData.used_today >= limitsData.daily_limit;
      const exceededMonthly =
        limitsData.monthly_limit !== null &&
        limitsData.used_this_month >= limitsData.monthly_limit;

      if (exceededDaily || exceededMonthly) {
        logger.warn(
          `Tenant ${tenantIdForDb} ha excedido la cuota (tenant_limits). Diario: ${
            limitsData.used_today
          }/${limitsData.daily_limit ?? "inf"}, Mensual: ${
            limitsData.used_this_month
          }/${limitsData.monthly_limit ?? "inf"}`
        );
        return true;
      }
      logger.debug(`Tenant ${tenantIdForDb} dentro de cuota (tenant_limits).`);
    } else {
      // Si no hay datos de tenant_limits, verificar límites en 'tenants' (legado)
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("max_requests, max_tokens") // Asumiendo que estos son límites diarios
        .eq("id", tenantIdForDb)
        .single();

      if (tenantError || !tenantData) {
        // Si el error es 'No rows found', el tenant no existe, no debería tener cuota.
        if (tenantError?.code === "PGRST116") {
          logger.debug(
            `Tenant ${tenantIdForDb} no encontrado en tabla 'tenants' (legado).`
          );
          return false;
        }
        logger.error(
          `Error al obtener datos del tenant ${tenantIdForDb} (legado):`,
          tenantError
        );
        return false; // Permitir si hay error al obtener datos del tenant
      }

      if (tenantData.max_requests === null && tenantData.max_tokens === null) {
        logger.debug(
          `Tenant ${tenantIdForDb} no tiene límites configurados (legado).`
        );
        return false; // No hay límites, no excede
      }

      // Obtener uso de hoy de la tabla 'usage' (legado)
      const today = new Date().toISOString().split("T")[0];
      const { data: usageData, error: usageError } = await supabase
        .from("usage")
        .select("api_calls, tokens_used")
        .eq("tenant_id", tenantIdForDb)
        .eq("date", today)
        .maybeSingle(); // Usar maybeSingle para manejar el caso de 0 uso hoy

      if (usageError && usageError.code !== "PGRST116") {
        logger.error(
          `Error al obtener uso diario (legado) para tenant ${tenantIdForDb}:`,
          usageError
        );
        return false; // Permitir en caso de error
      }

      const usageApiCalls = usageData?.api_calls ?? 0;
      const usageTokensUsed = usageData?.tokens_used ?? 0;

      const exceededApiCalls =
        tenantData.max_requests !== null &&
        usageApiCalls >= tenantData.max_requests;
      const exceededTokens =
        tenantData.max_tokens !== null &&
        usageTokensUsed >= tenantData.max_tokens;

      if (exceededApiCalls || exceededTokens) {
        logger.warn(
          `Tenant ${tenantIdForDb} ha excedido la cuota diaria (legado). Llamadas: ${usageApiCalls}/${
            tenantData.max_requests ?? "inf"
          }, Tokens: ${usageTokensUsed}/${tenantData.max_tokens ?? "inf"}`
        );
        return true;
      }
      logger.debug(`Tenant ${tenantIdForDb} dentro de cuota (legado).`);
    }

    return false; // No excedió ninguna cuota verificada
  } catch (error) {
    logger.error(`Excepción al verificar cuota de tenant ${tenantId}:`, error);
    return false; // Permitir por defecto en caso de excepción
  }
};

/**
 * Obtiene las plantillas base (chatbot_templates) a las que un tenant tiene acceso.
 * El acceso se determina si la plantilla está en tenant_template_access para ese tenant.
 * @param tenantId ID del tenant
 * @returns Lista de plantillas base accesibles, mapeadas a ChatTemplate (con defaults)
 */
export const getActiveTemplatesByTenant = async (
  tenantId: string
): Promise<ChatTemplate[]> => {
  try {
    if (!config.supabase.enabled) {
      logger.debug("Supabase deshabilitado, no se obtendrán plantillas.");
      return [];
    }

    const supabase = getSupabaseAdminClient();
    const validTenantId = getValidTenantUuid(tenantId);
    logger.debug(
      `getActiveTemplatesByTenant: Buscando plantillas para tenant_id válido: ${validTenantId}`
    );

    // No buscar plantillas para el tenant por defecto directamente aquí
    if (
      validTenantId ===
      (config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000")
    ) {
      logger.debug(
        "getActiveTemplatesByTenant: Tenant por defecto, devolviendo vacío (usar getTenantTemplatesWithFlows para 'default')."
      );
      return [];
    }

    // 1. Obtener los IDs de las plantillas a las que el tenant tiene acceso
    const { data: accessData, error: accessError } = await supabase
      .from("tenant_template_access")
      .select("template_id")
      .eq("tenant_id", validTenantId);

    if (accessError) {
      logger.error(
        `Error al obtener acceso a plantillas para tenant ${validTenantId}:`,
        accessError
      );
      return [];
    }

    const accessibleTemplateIds = accessData.map(
      (access) => access.template_id
    );
    if (accessibleTemplateIds.length === 0) {
      logger.debug(
        `Tenant ${validTenantId} no tiene acceso explícito a ninguna plantilla.`
      );
      // Considerar si las plantillas públicas deberían incluirse aquí.
      // Por ahora, si no hay acceso explícito, devolvemos vacío.
      return [];
    }
    logger.debug(
      `Tenant ${validTenantId} tiene acceso a plantillas: ${accessibleTemplateIds.join(
        ", "
      )}`
    );

    // 2. Obtener los detalles de esas plantillas desde chatbot_templates
    const { data: templatesData, error: templatesError } = await supabase
      .from("chatbot_templates")
      .select(
        `
        id, name, description, status, created_at, updated_at, version, created_by
      `
      ) // Seleccionar columnas existentes relevantes
      .in("id", accessibleTemplateIds);
    // Podríamos añadir .eq("status", "published") si solo queremos las publicadas aquí

    if (templatesError) {
      logger.error(
        `Error al obtener detalles de plantillas accesibles para tenant ${validTenantId}:`,
        templatesError
      );
      return [];
    }

    // 3. Mapear al formato ChatTemplate (interfaz de UI)
    return (templatesData || []).map((template): ChatTemplate => {
      const isPublished = template.status === "published";
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.created_at,
        updated_at: template.updated_at,
        status: template.status as "draft" | "published",
        is_active: isPublished, // Estado base de la plantilla
        tenant_id: null, // Las plantillas base no tienen tenant_id
        tokens_estimated: 500, // Default - ¿De dónde obtener este valor?
        category: "General", // Default - ¿De dónde obtener este valor?
        configuration: {}, // Default - ¿De dónde obtener este valor?
        is_public: isPublished, // Asumimos publicada = pública por ahora
        // Campos de UI/Instancia se llenarán después
        flowId: null,
        isEnabled: isPublished, // Habilitada si está publicada
        avatarUrl: "/img/avatars/thumb-placeholder.jpg", // Default - ¿De dónde obtener este valor?
        version: template.version,
        author: template.created_by, // Usar created_by si existe
      };
    });
  } catch (error) {
    logger.error(
      `Excepción al obtener plantillas para tenant ${tenantId}:`,
      error
    );
    return [];
  }
};

/**
 * Obtiene todas las plantillas publicadas y las enriquece con la información
 * de la instancia de flujo (si existe) para un tenant específico.
 * @param tenantId ID del tenant ('default' para flujos sin tenant_id)
 * @returns Lista de plantillas combinadas con su flowId y estado de instancia.
 */
export const getTenantTemplatesWithFlows = async (
  tenantId: string
): Promise<ChatTemplate[]> => {
  try {
    // Verificar cache primero
    if (templateCache.isValid(tenantId)) {
      logger.debug(`Devolviendo plantillas desde cache para tenant ${tenantId}`);
      return templateCache.data!;
    }
    
    if (!config.supabase.enabled) {
      logger.debug(
        "Supabase deshabilitado, no se obtendrán plantillas/flujos."
      );
      return [];
    }

    const supabase = getSupabaseAdminClient();
    // Usamos NULL para representar al tenant 'default' en la base de datos
    const tenantFilter =
      tenantId === "default" ? null : getValidTenantUuid(tenantId); // Validar UUID aquí también
    logger.debug(
      `getTenantTemplatesWithFlows: Buscando flujos para tenant_filter: ${
        tenantFilter === null ? "NULL" : tenantFilter
      }`
    );

    // 1. Obtener todas las plantillas base publicadas desde chatbot_templates
    // Optimización: Sin retry y con timeout corto
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos máximo
    
    let publishedTemplates: any[] = [];
    let templateError: any = null;
    
    try {
      const { data, error } = await supabase
        .from("chatbot_templates")
        .select(
          "id, name, description, status, created_at, updated_at, version, created_by"
        )
        .eq("status", "published")
        .abortSignal(controller.signal);
      
      clearTimeout(timeoutId);
      publishedTemplates = data || [];
      templateError = error;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as any).name === 'AbortError') {
        logger.warn("Timeout al obtener plantillas, usando fallback");
      } else {
        logger.error("Error en consulta a chatbot_templates:", error);
      }
      templateError = error;
    }

    if (templateError) {
      logger.error("Error al obtener plantillas publicadas:", templateError);
      // Retornar un template básico en caso de error para no dejar el chat sin funcionalidad
      return [{
        id: "fallback-template",
        name: "Template Básico",
        description: "Template básico disponible cuando hay problemas de conectividad",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        tenant_id: tenantFilter,
        tokens_estimated: 0,
        category: "basic",
        configuration: {},
        is_public: true,
        status: "published",
        flowId: null,
        isEnabled: true,
        avatarUrl: "",
        version: 1,
        author: "system"
      }];
    }
    if (!publishedTemplates || (Array.isArray(publishedTemplates) && publishedTemplates.length === 0)) {
      logger.debug("No se encontraron plantillas publicadas.");
      return [];
    }
    logger.debug(
      `Se encontraron ${publishedTemplates.length} plantillas publicadas.`
    );

    // 2. Obtener todas las activaciones para el tenant actual desde la tabla tenant_chatbot_activations
    // Optimización: Con timeout corto y sin esperar si falla
    let tenantActivations: any[] = [];
    
    const activationController = new AbortController();
    const activationTimeoutId = setTimeout(() => activationController.abort(), 10000); // 10 segundos máximo
    
    try {
      let activationsQuery = supabase
        .from("tenant_chatbot_activations")
        .select("id, template_id, is_active, tenant_id")
        .abortSignal(activationController.signal);

      if (tenantFilter === null) {
        // Si es tenant default, buscar plantillas sin activación específica
        activationsQuery = activationsQuery.is("tenant_id", null);
      } else {
        activationsQuery = activationsQuery.eq("tenant_id", tenantFilter);
      }
      
      const { data, error } = await activationsQuery;
      clearTimeout(activationTimeoutId);
      
      if (error) {
        logger.warn(`Error al obtener activaciones (no crítico): ${error.message}`);
      } else {
        tenantActivations = data || [];
      }
    } catch (error) {
      clearTimeout(activationTimeoutId);
      logger.warn("Timeout o error al obtener activaciones, continuando sin activaciones");
    }

    logger.debug(
      `Se encontraron ${tenantActivations?.length ?? 0} activaciones para el tenant.`
    );

    // 3. Combinar resultados: Mapear plantillas publicadas y añadir datos de activación si existe
    const results = publishedTemplates.map((template): ChatTemplate => {
      const activation = tenantActivations?.find(
        (
          act: {
            id: string;
            template_id: string;
            is_active: boolean;
            tenant_id: string;
          }
        ) => act.template_id === template.id
      );

      const isPublished = template.status === "published";

      // Mapear al tipo ChatTemplate esperado por el frontend
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.created_at,
        updated_at: template.updated_at,
        status: template.status as "draft" | "published",
        // 'is_active' aquí representa si la activación del tenant está activa
        is_active: activation?.is_active ?? false,
        isEnabled: isPublished, // Habilitada si la plantilla base está publicada
        flowId: activation?.id || null, // ID de la activación
        tenant_id: activation?.tenant_id ?? null, // ID del tenant de la activación
        tokens_estimated: 500, // Default
        category: "General", // Default
        configuration: {}, // Default
        is_public: isPublished, // Asumir publicada = pública por ahora
        avatarUrl: "/img/avatars/thumb-placeholder.jpg", // Default
        version: template.version,
        author: template.created_by, // Usar created_by si existe
      };
    });

    logger.debug(
      `Plantillas combinadas con activaciones para tenant ${tenantId}: ${results.length} resultados.`
    );
    
    // Guardar en cache
    templateCache.set(tenantId, results);
    
    return results;
  } catch (error) {
    logger.error(
      `Excepción al obtener plantillas y flujos para tenant ${tenantId}:`,
      error
    );
    return [];
  }
};

/**
 * Obtiene los detalles de una plantilla base específica por ID.
 * @param templateId ID de la plantilla
 * @returns Detalles de la plantilla base o null si no se encuentra.
 */
export const getTemplateById = async (
  templateId: string
): Promise<ChatbotTemplateBase | null> => {
  // Ya no se marca como obsoleta, es necesaria para instanciar
  try {
    if (!config.supabase.enabled) return null;
    const supabase = getSupabaseAdminClient();

    // Obtener la plantilla base por ID con los campos necesarios con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
    
    try {
      const { data, error } = await supabase
        .from("chatbot_templates")
        .select(
          `
          id, name, description, status, created_at, updated_at,
          react_flow_json, version, created_by
        `
        ) // Seleccionar campos reales
        .eq("id", templateId)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeoutId);

      if (error || !data) {
        logger.error(
          `Error al obtener plantilla base ${templateId} o no encontrada:`,
          error
        );
        return await getLocalFallbackTemplate(templateId);
      }

      // Devolver directamente los datos (coinciden con ChatbotTemplateBase)
      return data as ChatbotTemplateBase;
    } catch (abortError) {
      clearTimeout(timeoutId);
      logger.warn(`Timeout al obtener plantilla ${templateId}, usando fallback local`);
      return await getLocalFallbackTemplate(templateId);
    }
  } catch (error) {
    logger.error(`Excepción al obtener plantilla base ${templateId}:`, error);
    return await getLocalFallbackTemplate(templateId);
  }
};

/**
 * Obtiene una plantilla local como fallback cuando Supabase no responde
 */
async function getLocalFallbackTemplate(templateId: string): Promise<ChatbotTemplateBase | null> {
  try {
    // Si es la plantilla PymeBot V1, usar el JSON local
    if (templateId === 'd5e05ba1-0146-4587-860b-4e984dd0b672') {
      const fs = await import('fs');
      const path = await import('path');
      const templatePath = path.join(process.cwd(), 'pymebot-v1-template.json');
      
      if (fs.existsSync(templatePath)) {
        const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        logger.info(`Usando plantilla local fallback para ${templateId}`);
        
        return {
          id: templateId,
          name: templateData.name,
          description: templateData.description,
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          react_flow_json: templateData.react_flow_json,
          version: templateData.version || 1,
          created_by: 'system'
        } as ChatbotTemplateBase;
      }
    }
    
    logger.warn(`No hay plantilla fallback disponible para ${templateId}`);
    return null;
  } catch (error) {
    logger.error(`Error cargando plantilla fallback:`, error);
    return null;
  }
}

/**
 * Limpia el caché de plantillas para forzar una recarga
 */
export const clearTemplateCache = () => {
  templateCache.clear();
  logger.debug("Cache de plantillas limpiado");
};

/**
 * Establece el estado activo/inactivo de una instancia de flujo para un tenant.
 * @param flowId ID del flujo (instancia) en la tabla 'flows'
 * @param tenantId ID del tenant dueño del flujo
 * @param isActive Nuevo estado activo
 * @returns true si la actualización fue exitosa
 */
export const setTemplateActiveStatus = async (
  flowId: string,
  tenantId: string,
  isActive: boolean
): Promise<boolean> => {
  try {
    if (!config.supabase.enabled) {
      logger.debug("Supabase deshabilitado, no se cambiará estado activo.");
      return false;
    }
    const supabase = getSupabaseAdminClient(); // Usar admin para actualizar
    const validTenantId = getValidTenantUuid(tenantId);

    // No permitir cambiar estado para el tenant por defecto
    if (
      validTenantId ===
      (config.multitenant.defaultTenantUuid ||
        "00000000-0000-0000-0000-000000000000")
    ) {
      logger.warn(
        "No se puede cambiar el estado activo para el tenant por defecto."
      );
      return false;
    }

    logger.debug(
      `setTemplateActiveStatus: Cambiando estado de flujo ${flowId} para tenant ${validTenantId} a ${isActive}`
    );

    const { error, count } = await supabase
      .from("flows")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", flowId)
      .eq("tenant_id", validTenantId); // Asegurar que solo el dueño modifique

    if (error) {
      logger.error(
        `Error al actualizar estado activo del flujo ${flowId} para tenant ${validTenantId}:`,
        error
      );
      return false;
    }

    if (count === 0) {
      logger.warn(
        `No se encontró el flujo ${flowId} para el tenant ${validTenantId}, no se actualizó el estado.`
      );
      return false;
    }

    logger.info(
      `Estado activo del flujo ${flowId} actualizado a ${isActive} para tenant ${validTenantId}`
    );
    
    // Limpiar caché cuando se cambia el estado de una plantilla
    clearTemplateCache();
    
    return true;
  } catch (error) {
    logger.error(
      `Excepción al actualizar estado activo del flujo ${flowId}:`,
      error
    );
    return false;
  }
};

/**
 * Actualiza la configuración específica de un tenant para una plantilla (obsoleto?).
 * Esta función es incorrecta según el esquema actual y debería ser eliminada o rediseñada.
 * @param tenantId ID del tenant
 * @param templateId ID de la plantilla base
 * @param configuration Nueva configuración
 * @returns false (función obsoleta/incorrecta)
 */
export const updateTemplateConfiguration = async (
  tenantId: string,
  templateId: string,
  configuration: Record<string, any>
): Promise<boolean> => {
  logger.warn(
    "Llamada a función obsoleta/incorrecta: updateTemplateConfiguration. La configuración debe asociarse a la instancia del flujo o a tenant_chatbot_configurations."
  );
  // La configuración específica del tenant para un chatbot activado
  // debería estar en 'tenant_chatbot_configurations' asociada a 'tenant_chatbot_activations.id'
  // O, si la configuración modifica el *flujo* instanciado, debería actualizarse en la tabla 'flows'.
  logger.error(
    "updateTemplateConfiguration no implementada correctamente según el esquema actual."
  );
  return false; // Indicar fallo ya que la lógica es incorrecta
};

/**
 * Verifica si un usuario está registrado
 */
export const isUserRegistered = async (
  tenantId: string,
  phoneNumber: string
): Promise<boolean> => {
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (error) {
      logger.error("Error verificando usuario:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    logger.error("Error en isUserRegistered:", error);
    return false;
  }
};

/**
 * Crea una nueva conversación
 */
export const createNewConversation = async (
  tenantId: string,
  phoneNumber: string,
  metadata?: Record<string, any>
): Promise<string | null> => {
  try {
    const supabase = getSupabaseAdminClient();
    
    // Crear o actualizar usuario con timeout
    const userController = new AbortController();
    const userTimeoutId = setTimeout(() => userController.abort(), 15000);
    
    const { data: userData, error: userError } = await supabase
      .from("tenant_users")
      .upsert({
        tenant_id: tenantId,
        phone_number: phoneNumber,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'tenant_id,phone_number',
        ignoreDuplicates: false
      })
      .select("id")
      .single();
      
    clearTimeout(userTimeoutId);

    if (userError) {
      logger.error("Error creando/actualizando usuario:", userError);
      return null;
    }

    // Crear nueva conversación con timeout
    const convController = new AbortController();
    const convTimeoutId = setTimeout(() => convController.abort(), 15000);
    
    const { data: conversationData, error: convError } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        user_id: userData.id,
        is_active: true,
        metadata: metadata || {},
        last_message_at: new Date().toISOString()
      })
      .select("id")
      .single();
      
    clearTimeout(convTimeoutId);

    if (convError) {
      logger.error("Error creando conversación:", convError);
      return null;
    }

    return conversationData.id;
  } catch (error) {
    logger.error("Error en createNewConversation:", error);
    return null;
  }
};

// --- Funciones RPC (Asegúrate que existan en Supabase SQL Editor) ---

/*
-- Función para incrementar uso en la tabla 'usage' (upsert atómico)
CREATE OR REPLACE FUNCTION increment_usage(
    p_tenant_id UUID,
    p_date DATE,
    p_api_calls_increment INT DEFAULT 1,
    p_tokens_increment INT DEFAULT 0
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.usage (tenant_id, date, api_calls, tokens_used, audio_seconds, unique_users)
    VALUES (p_tenant_id, p_date, p_api_calls_increment, p_tokens_increment, 0, 1) -- Asume 1 nuevo usuario único en inserción, ajustar si es necesario
    ON CONFLICT (tenant_id, date)
    DO UPDATE SET
        api_calls = public.usage.api_calls + EXCLUDED.api_calls,
        tokens_used = COALESCE(public.usage.tokens_used, 0) + EXCLUDED.tokens_used;
        -- unique_users podría requerir lógica más compleja para actualizarse correctamente
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- SECURITY DEFINER si es llamada por roles sin permiso directo de upsert
*/

/*
-- Función para incrementar límites en 'tenant_limits' (si se usa esa tabla)
CREATE OR REPLACE FUNCTION increment_tenant_limits(
    p_tenant_id UUID,
    p_usage_increment INT DEFAULT 1 -- Podría ser tokens, llamadas, etc. según cómo midas el límite
)
RETURNS void AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_month_start DATE := date_trunc('month', v_today)::DATE;
    v_last_reset DATE;
    v_row_exists BOOLEAN;
BEGIN
    -- Verificar si el registro existe
    SELECT EXISTS (SELECT 1 FROM public.tenant_limits WHERE tenant_id = p_tenant_id) INTO v_row_exists;

    -- Si no existe, insertar con valores iniciales (ajustar límites por defecto)
    IF NOT v_row_exists THEN
        INSERT INTO public.tenant_limits (tenant_id, daily_limit, monthly_limit, used_today, used_this_month, last_reset)
        VALUES (p_tenant_id, 1000, 10000, 0, 0, v_today); -- Poner límites por defecto aquí
    END IF;

    -- Obtener la fecha del último reseteo
    SELECT last_reset INTO v_last_reset
    FROM public.tenant_limits
    WHERE tenant_id = p_tenant_id;

    -- Resetear contadores si es necesario
    IF v_last_reset IS NULL OR v_last_reset < v_today THEN
        UPDATE public.tenant_limits
        SET used_today = 0,
            last_reset = v_today -- Actualizar fecha de reseteo diario
        WHERE tenant_id = p_tenant_id;
        -- Si el mes también cambió, resetear mensual (ya cubierto si last_reset < v_today y v_today es el primer día del mes)
        IF v_last_reset IS NULL OR v_last_reset < v_month_start THEN
             UPDATE public.tenant_limits
             SET used_this_month = 0
             -- last_reset ya se actualizó arriba
             WHERE tenant_id = p_tenant_id;
        END IF;
    END IF;

    -- Incrementar contadores
    UPDATE public.tenant_limits
    SET used_today = used_today + p_usage_increment,
        used_this_month = used_this_month + p_usage_increment
    WHERE tenant_id = p_tenant_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
