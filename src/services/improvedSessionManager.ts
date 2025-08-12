/**
 * IMPROVED SESSION MANAGER
 * 
 * PROPÓSITO: Gestión avanzada de sesiones persistentes para resolver problema de captura
 * BASADO EN: Análisis del v1-reference donde las sesiones se mantienen correctamente
 * PRESERVA: Sistema de leads 100% intacto
 * COEXISTE: Con webProvider.ts actual sin modificarlo
 * 
 * PATRÓN EXTRAÍDO DEL V1-REFERENCE:
 * - Sesiones que persisten entre múltiples requests
 * - Cache inteligente por userId con TTL configurable
 * - Limpieza automática de sesiones expiradas
 * - Estado contextual preservado entre interacciones
 * - Gestión de memoria optimizada
 */

import { createClient } from "@supabase/supabase-js";
import SessionCache from './sessionCache';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// INTERFACES PARA SESIONES PERSISTENTES

interface PersistentSession {
  sessionId: string;
  userId: string;
  tenantId: string;
  nodeId?: string;
  templateId?: string;
  contextData: SessionContextData;
  metadata: SessionMetadata;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isActive: boolean;
  lastActivityAt: string;
}

interface SessionContextData {
  currentFlow?: string;
  currentNodeId?: string;
  collectedData: Record<string, any>;
  globalVars: Record<string, any>;
  leadData?: LeadSessionData;
  conversationHistory: ConversationMessage[];
  flowHistory: FlowNavigationEntry[];
  validationState?: ValidationSessionState;
  temporaryData: Record<string, any>;
}

interface LeadSessionData {
  leadId?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  salesStageId?: string;
  leadSource?: string;
  interactionCount: number;
  lastInteractionAt: string;
  progressPercentage: number;
}

interface SessionMetadata {
  platform: 'whatsapp' | 'web' | 'api';
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionVersion: string;
  tags: string[];
  priority: 'low' | 'normal' | 'high' | 'critical';
  flags: Record<string, boolean>;
}

interface ConversationMessage {
  messageId: string;
  timestamp: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  nodeId?: string;
  metadata?: Record<string, any>;
}

interface FlowNavigationEntry {
  timestamp: string;
  fromNodeId?: string;
  toNodeId: string;
  flowType: string;
  duration?: number;
  success: boolean;
}

interface ValidationSessionState {
  currentValidation?: string;
  attemptCount: number;
  maxAttempts: number;
  validationHistory: ValidationAttempt[];
  timeoutData?: TimeoutSessionData;
}

interface ValidationAttempt {
  timestamp: string;
  input: string;
  isValid: boolean;
  errorMessage?: string;
  validationType: string;
}

interface TimeoutSessionData {
  startTime: number;
  duration: number;
  warningTime: number;
  warningShown: boolean;
  expired: boolean;
}

interface SessionConfig {
  defaultTTL?: number;
  maxInactivityTime?: number;
  cleanupInterval?: number;
  maxSessionsPerUser?: number;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  cacheSize?: number;
  persistToDisk?: boolean;
}

interface CacheStats {
  hitCount: number;
  missCount: number;
  evictionCount: number;
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  memoryUsage: number;
}

/**
 * IMPROVED SESSION MANAGER CLASS
 * 
 * PROPÓSITO: Gestión completa de sesiones persistentes
 * ARQUITECTURA: Cache en memoria + persistencia en BD
 * RENDIMIENTO: Optimizado para alta concurrencia
 */
class ImprovedSessionManager {
  private static instance: ImprovedSessionManager;
  private sessionCache: SessionCache;
  private legacyCache: Map<string, PersistentSession> = new Map();
  private userSessionIndex: Map<string, Set<string>> = new Map();
  private tenantSessionIndex: Map<string, Set<string>> = new Map();
  private expirationTimers: Map<string, NodeJS.Timeout> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cacheStats: CacheStats;
  private config: SessionConfig;

  private constructor(config: SessionConfig = {}) {
    this.config = {
      defaultTTL: 3600000, // 1 hora
      maxInactivityTime: 1800000, // 30 minutos
      cleanupInterval: 300000, // 5 minutos
      maxSessionsPerUser: 5,
      enableCompression: false,
      enableEncryption: false,
      cacheSize: 10000,
      persistToDisk: true,
      ...config
    };

    this.cacheStats = {
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      memoryUsage: 0
    };

    // Inicializar cache avanzado
    this.sessionCache = SessionCache.getInstance({
      maxSize: this.config.cacheSize,
      defaultTTL: this.config.defaultTTL,
      maxMemoryMB: 50, // 50MB por defecto
      cleanupInterval: this.config.cleanupInterval,
      userSessionLimit: this.config.maxSessionsPerUser,
      persistToDisk: this.config.persistToDisk
    });

    this.initializeManager();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: SessionConfig): ImprovedSessionManager {
    if (!ImprovedSessionManager.instance) {
      ImprovedSessionManager.instance = new ImprovedSessionManager(config);
    }
    return ImprovedSessionManager.instance;
  }

  /**
   * MÉTODO PRINCIPAL: Obtener o crear sesión persistente
   * PROPÓSITO: Evitar creación de sesiones nuevas innecesariamente
   * PATRÓN: Reutilizar sesiones activas o crear nueva solo si es necesario
   */
  async getOrCreateSession(
    userId: string,
    tenantId: string,
    options: {
      nodeId?: string;
      templateId?: string;
      platform?: 'whatsapp' | 'web' | 'api';
      forceNew?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      metadata?: Partial<SessionMetadata>;
    } = {}
  ): Promise<PersistentSession> {
    try {
      console.log(`[ImprovedSessionManager] Obteniendo sesión para ${userId} en tenant ${tenantId}`);

      // 1. VERIFICAR CACHÉ AVANZADO PRIMERO
      if (!options.forceNew) {
        const userSessions = await this.sessionCache.getUserSessions(userId, { tenantId });
        if (userSessions.length > 0) {
          const cachedSession = userSessions[0]; // Tomar la más reciente
          console.log(`[ImprovedSessionManager] Sesión encontrada en caché avanzado: ${cachedSession.sessionId}`);
          
          // Actualizar actividad
          await this.updateSessionActivity(cachedSession.sessionId, {
            lastActivityAt: new Date().toISOString(),
            nodeId: options.nodeId
          });
          
          this.cacheStats.hitCount++;
          return cachedSession;
        }
      }

      // 2. BUSCAR EN BASE DE DATOS
      if (!options.forceNew) {
        const existingSession = await this.getActiveSessionFromDB(userId, tenantId);
        if (existingSession) {
          console.log(`[ImprovedSessionManager] Sesión encontrada en BD: ${existingSession.sessionId}`);
          
          // Cargar en caché avanzado
          await this.sessionCache.set(existingSession.sessionId, existingSession, {
            priority: options.priority || 'normal',
            tags: ['restored_from_db']
          });
          
          // Actualizar actividad
          await this.updateSessionActivity(existingSession.sessionId, {
            lastActivityAt: new Date().toISOString(),
            nodeId: options.nodeId
          });
          
          this.cacheStats.missCount++;
          return existingSession;
        }
      }

      // 3. CREAR NUEVA SESIÓN SOLO SI ES NECESARIO
      console.log(`[ImprovedSessionManager] Creando nueva sesión para ${userId}`);
      const newSession = await this.createNewSession(userId, tenantId, options);
      
      this.cacheStats.totalSessions++;
      this.cacheStats.activeSessions++;
      
      return newSession;

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error obteniendo sesión:`, error);
      
      // FALLBACK: Crear sesión básica temporal
      return await this.createFallbackSession(userId, tenantId, options);
    }
  }

  /**
   * MÉTODO: Obtener sesión activa del caché
   */
  private async getActiveSessionFromCache(
    userId: string,
    tenantId: string
  ): Promise<PersistentSession | null> {
    try {
      const userSessions = this.userSessionIndex.get(userId);
      
      if (!userSessions || userSessions.size === 0) {
        return null;
      }

      // Buscar sesión activa para el tenant
      for (const sessionId of userSessions) {
        const session = this.sessionCache.get(sessionId);
        
        if (session && 
            session.tenantId === tenantId && 
            session.isActive && 
            !this.isSessionExpired(session)) {
          
          return session;
        }
      }

      return null;
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error en caché:`, error);
      return null;
    }
  }

  /**
   * MÉTODO: Obtener sesión activa de BD
   */
  private async getActiveSessionFromDB(
    userId: string,
    tenantId: string
  ): Promise<PersistentSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('persistent_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !session) {
        return null;
      }

      return this.mapDbToSession(session);
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error consultando BD:`, error);
      return null;
    }
  }

  /**
   * MÉTODO: Crear nueva sesión
   */
  private async createNewSession(
    userId: string,
    tenantId: string,
    options: any
  ): Promise<PersistentSession> {
    try {
      // 1. VALIDAR LÍMITES DE SESIONES
      await this.enforceSessionLimits(userId);

      // 2. GENERAR DATOS DE SESIÓN
      const sessionId = `session_${userId}_${tenantId}_${Date.now()}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + this.config.defaultTTL!).toISOString();

      // 3. CREAR ESTRUCTURA DE SESIÓN
      const newSession: PersistentSession = {
        sessionId,
        userId,
        tenantId,
        nodeId: options.nodeId,
        templateId: options.templateId,
        contextData: {
          collectedData: {},
          globalVars: {},
          conversationHistory: [],
          flowHistory: [],
          temporaryData: {}
        },
        metadata: {
          platform: options.platform || 'whatsapp',
          sessionVersion: '1.0',
          tags: ['new'],
          priority: options.priority || 'normal',
          flags: {},
          ...options.metadata
        },
        createdAt: now,
        updatedAt: now,
        expiresAt,
        isActive: true,
        lastActivityAt: now
      };

      // 4. GUARDAR EN BD
      if (this.config.persistToDisk) {
        await this.saveSessionToDB(newSession);
      }

      // 5. CARGAR EN CACHÉ AVANZADO
      await this.sessionCache.set(newSession.sessionId, newSession, {
        priority: options.priority || 'normal',
        tags: ['new_session', ...(options.metadata?.tags || [])],
        customTTL: this.config.defaultTTL
      });

      // 6. CONFIGURAR EXPIRACIÓN (manejado por SessionCache)
      // this.scheduleExpiration(newSession);

      console.log(`[ImprovedSessionManager] Nueva sesión creada: ${sessionId}`);
      return newSession;

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error creando sesión:`, error);
      throw error;
    }
  }

  /**
   * MÉTODO: Crear sesión de fallback
   */
  private async createFallbackSession(
    userId: string,
    tenantId: string,
    options: any
  ): Promise<PersistentSession> {
    const sessionId = `fallback_${userId}_${Date.now()}`;
    const now = new Date().toISOString();

    return {
      sessionId,
      userId,
      tenantId,
      nodeId: options.nodeId,
      templateId: options.templateId,
      contextData: {
        collectedData: {},
        globalVars: {},
        conversationHistory: [],
        flowHistory: [],
        temporaryData: {}
      },
      metadata: {
        platform: options.platform || 'whatsapp',
        sessionVersion: '1.0',
        tags: ['fallback'],
        priority: 'low',
        flags: { isFallback: true }
      },
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 minutos
      isActive: true,
      lastActivityAt: now
    };
  }

  /**
   * MÉTODO: Actualizar actividad de sesión
   */
  async updateSessionActivity(
    sessionId: string,
    updates: {
      lastActivityAt?: string;
      nodeId?: string;
      contextData?: Partial<SessionContextData>;
      metadata?: Partial<SessionMetadata>;
    }
  ): Promise<void> {
    try {
      // 1. ACTUALIZAR CACHÉ
      const cachedSession = this.sessionCache.get(sessionId);
      if (cachedSession) {
        cachedSession.lastActivityAt = updates.lastActivityAt || new Date().toISOString();
        cachedSession.updatedAt = new Date().toISOString();
        
        if (updates.nodeId) {
          cachedSession.nodeId = updates.nodeId;
        }
        
        if (updates.contextData) {
          cachedSession.contextData = {
            ...cachedSession.contextData,
            ...updates.contextData
          };
        }
        
        if (updates.metadata) {
          cachedSession.metadata = {
            ...cachedSession.metadata,
            ...updates.metadata
          };
        }
      }

      // 2. ACTUALIZAR BD SI ES NECESARIO
      if (this.config.persistToDisk && cachedSession) {
        await this.saveSessionToDB(cachedSession);
      }

      // 3. EXTENDER EXPIRACIÓN
      await this.extendSessionExpiration(sessionId);

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error actualizando actividad:`, error);
    }
  }

  /**
   * MÉTODO: Obtener contexto de sesión
   */
  async getSessionContext(sessionId: string): Promise<SessionContextData | null> {
    try {
      const session = this.sessionCache.get(sessionId);
      
      if (session && !this.isSessionExpired(session)) {
        return session.contextData;
      }

      // Buscar en BD si no está en caché
      const dbSession = await this.getSessionFromDB(sessionId);
      if (dbSession) {
        await this.loadSessionToCache(dbSession);
        return dbSession.contextData;
      }

      return null;
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error obteniendo contexto:`, error);
      return null;
    }
  }

  /**
   * MÉTODO: Actualizar contexto de sesión
   */
  async updateSessionContext(
    sessionId: string,
    contextUpdates: Partial<SessionContextData>
  ): Promise<boolean> {
    try {
      await this.updateSessionActivity(sessionId, {
        contextData: contextUpdates,
        lastActivityAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error actualizando contexto:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Terminar sesión
   */
  async endSession(sessionId: string, reason: string = 'manual'): Promise<void> {
    try {
      // 1. MARCAR COMO INACTIVA
      const session = this.sessionCache.get(sessionId);
      if (session) {
        session.isActive = false;
        session.updatedAt = new Date().toISOString();
        session.metadata.tags.push(`ended_${reason}`);
      }

      // 2. GUARDAR ESTADO FINAL
      if (this.config.persistToDisk && session) {
        await this.saveSessionToDB(session);
      }

      // 3. LIMPIAR CACHÉ
      this.removeSessionFromCache(sessionId);

      // 4. CANCELAR TIMERS
      const timer = this.expirationTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.expirationTimers.delete(sessionId);
      }

      this.cacheStats.activeSessions--;
      console.log(`[ImprovedSessionManager] Sesión terminada: ${sessionId} (${reason})`);

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error terminando sesión:`, error);
    }
  }

  /**
   * MÉTODO: Limpiar sesiones expiradas
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = Date.now();
      const expiredSessions: string[] = [];

      // 1. IDENTIFICAR SESIONES EXPIRADAS EN CACHÉ
      for (const [sessionId, session] of this.sessionCache) {
        if (this.isSessionExpired(session) || 
            this.isSessionInactive(session)) {
          expiredSessions.push(sessionId);
        }
      }

      // 2. LIMPIAR SESIONES EXPIRADAS
      for (const sessionId of expiredSessions) {
        await this.endSession(sessionId, 'expired');
      }

      // 3. LIMPIAR BD
      if (this.config.persistToDisk) {
        await supabase
          .from('persistent_sessions')
          .update({ is_active: false })
          .lt('expires_at', new Date().toISOString());
      }

      this.cacheStats.expiredSessions += expiredSessions.length;
      
      if (expiredSessions.length > 0) {
        console.log(`[ImprovedSessionManager] Limpiadas ${expiredSessions.length} sesiones expiradas`);
      }

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error limpiando sesiones:`, error);
    }
  }

  /**
   * MÉTODO: Obtener estadísticas del caché
   */
  getCacheStats(): CacheStats {
    return {
      ...this.cacheStats,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * MÉTODO: Obtener todas las sesiones de un usuario (MEJORADO)
   */
  async getUserSessions(userId: string, tenantId?: string): Promise<PersistentSession[]> {
    try {
      return await this.sessionCache.getUserSessions(userId, { 
        tenantId,
        includeExpired: false,
        sortBy: 'accessed',
        limit: this.config.maxSessionsPerUser
      });
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error obteniendo sesiones de usuario:`, error);
      return [];
    }
  }

  /**
   * MÉTODO: Obtener sesiones por tenant
   */
  async getTenantSessions(tenantId: string, userId?: string): Promise<PersistentSession[]> {
    try {
      return await this.sessionCache.getTenantSessions(tenantId, { 
        userId,
        includeExpired: false,
        sortBy: 'accessed'
      });
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error obteniendo sesiones de tenant:`, error);
      return [];
    }
  }

  /**
   * MÉTODO: Configurar políticas de TTL personalizadas
   */
  configureTTLPolicy(policy: {
    userId?: string;
    tenantId?: string;
    nodeType?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    customTTL?: number;
  }): void {
    this.sessionCache.addTTLPolicy(policy);
    console.log(`[ImprovedSessionManager] Política TTL configurada:`, policy);
  }

  /**
   * MÉTODO: Obtener métricas del cache avanzado
   */
  getAdvancedCacheMetrics(): any {
    const sessionCacheStats = this.sessionCache.getDetailedStats();
    const legacyStats = this.getCacheStats();

    return {
      advanced: sessionCacheStats,
      legacy: legacyStats,
      combined: {
        totalSessions: sessionCacheStats.cache.entryCount + legacyStats.activeSessions,
        hitRatio: sessionCacheStats.performance.hitRatio,
        memoryUsage: sessionCacheStats.memory
      }
    };
  }

  /**
   * MÉTODO: Optimizar cache según patrones de uso
   */
  async optimizeCache(): Promise<void> {
    try {
      const stats = this.sessionCache.getDetailedStats();
      
      // Ajustar políticas TTL basado en patrones de uso
      if (stats.performance.hitRatio < 0.7) {
        console.log(`[ImprovedSessionManager] Hit ratio bajo (${stats.performance.hitRatio}), optimizando...`);
        
        // Aumentar TTL para usuarios activos
        for (const user of stats.topUsers.slice(0, 5)) {
          this.configureTTLPolicy({
            userId: user.userId,
            customTTL: this.config.defaultTTL! * 1.5
          });
        }
      }

      // Limpiar sesiones no utilizadas
      if (stats.memory.percentage > 80) {
        console.log(`[ImprovedSessionManager] Uso de memoria alto (${stats.memory.percentage}%), limpiando...`);
        await this.sessionCache.cleanupExpired();
      }

    } catch (error) {
      console.error(`[ImprovedSessionManager] Error optimizando cache:`, error);
    }
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private initializeManager(): void {
    // Inicializar cleanup automático
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredSessions();
      }, this.config.cleanupInterval);
    }

    console.log(`[ImprovedSessionManager] Inicializado con config:`, this.config);
  }

  private isSessionExpired(session: PersistentSession): boolean {
    return new Date(session.expiresAt) <= new Date();
  }

  private isSessionInactive(session: PersistentSession): boolean {
    const inactiveThreshold = Date.now() - this.config.maxInactivityTime!;
    return new Date(session.lastActivityAt).getTime() < inactiveThreshold;
  }

  private async loadSessionToCache(session: PersistentSession): Promise<void> {
    // Verificar límites de caché
    if (this.sessionCache.size >= this.config.cacheSize!) {
      await this.evictOldestSession();
    }

    // Cargar sesión
    this.sessionCache.set(session.sessionId, session);

    // Actualizar índices
    if (!this.userSessionIndex.has(session.userId)) {
      this.userSessionIndex.set(session.userId, new Set());
    }
    this.userSessionIndex.get(session.userId)!.add(session.sessionId);

    if (!this.tenantSessionIndex.has(session.tenantId)) {
      this.tenantSessionIndex.set(session.tenantId, new Set());
    }
    this.tenantSessionIndex.get(session.tenantId)!.add(session.sessionId);

    // Programar expiración
    this.scheduleExpiration(session);
  }

  private removeSessionFromCache(sessionId: string): void {
    const session = this.sessionCache.get(sessionId);
    
    if (session) {
      // Remover de caché principal
      this.sessionCache.delete(sessionId);

      // Limpiar índices
      const userSessions = this.userSessionIndex.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessionIndex.delete(session.userId);
        }
      }

      const tenantSessions = this.tenantSessionIndex.get(session.tenantId);
      if (tenantSessions) {
        tenantSessions.delete(sessionId);
        if (tenantSessions.size === 0) {
          this.tenantSessionIndex.delete(session.tenantId);
        }
      }
    }
  }

  private async evictOldestSession(): Promise<void> {
    let oldestSession: PersistentSession | null = null;
    let oldestTime = Date.now();

    for (const session of this.sessionCache.values()) {
      const sessionTime = new Date(session.lastActivityAt).getTime();
      if (sessionTime < oldestTime) {
        oldestTime = sessionTime;
        oldestSession = session;
      }
    }

    if (oldestSession) {
      await this.endSession(oldestSession.sessionId, 'evicted');
      this.cacheStats.evictionCount++;
    }
  }

  private scheduleExpiration(session: PersistentSession): void {
    const expirationTime = new Date(session.expiresAt).getTime() - Date.now();
    
    if (expirationTime > 0) {
      const timer = setTimeout(() => {
        this.endSession(session.sessionId, 'expired');
      }, expirationTime);

      this.expirationTimers.set(session.sessionId, timer);
    }
  }

  private async extendSessionExpiration(sessionId: string): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    
    if (session) {
      const newExpirationTime = Date.now() + this.config.defaultTTL!;
      session.expiresAt = new Date(newExpirationTime).toISOString();

      // Reprogramar expiración
      const existingTimer = this.expirationTimers.get(sessionId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      this.scheduleExpiration(session);
    }
  }

  private async enforceSessionLimits(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);
    
    if (userSessions.length >= this.config.maxSessionsPerUser!) {
      // Terminar sesiones más antiguas
      const sortedSessions = userSessions.sort((a, b) => 
        new Date(a.lastActivityAt).getTime() - new Date(b.lastActivityAt).getTime()
      );

      const sessionsToEnd = sortedSessions.slice(0, userSessions.length - this.config.maxSessionsPerUser! + 1);
      
      for (const session of sessionsToEnd) {
        await this.endSession(session.sessionId, 'limit_exceeded');
      }
    }
  }

  private async saveSessionToDB(session: PersistentSession): Promise<void> {
    try {
      const dbSession = this.mapSessionToDb(session);
      
      const { error } = await supabase
        .from('persistent_sessions')
        .upsert(dbSession);

      if (error) {
        console.error(`[ImprovedSessionManager] Error guardando en BD:`, error);
      }
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error en saveSessionToDB:`, error);
    }
  }

  private async getSessionFromDB(sessionId: string): Promise<PersistentSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('persistent_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error || !session) {
        return null;
      }

      return this.mapDbToSession(session);
    } catch (error) {
      console.error(`[ImprovedSessionManager] Error obteniendo de BD:`, error);
      return null;
    }
  }

  private mapSessionToDb(session: PersistentSession): any {
    return {
      session_id: session.sessionId,
      user_id: session.userId,
      tenant_id: session.tenantId,
      node_id: session.nodeId,
      template_id: session.templateId,
      context_data: JSON.stringify(session.contextData),
      metadata: JSON.stringify(session.metadata),
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      expires_at: session.expiresAt,
      is_active: session.isActive,
      last_activity_at: session.lastActivityAt
    };
  }

  private mapDbToSession(dbSession: any): PersistentSession {
    return {
      sessionId: dbSession.session_id,
      userId: dbSession.user_id,
      tenantId: dbSession.tenant_id,
      nodeId: dbSession.node_id,
      templateId: dbSession.template_id,
      contextData: typeof dbSession.context_data === 'string' 
        ? JSON.parse(dbSession.context_data) 
        : dbSession.context_data || {},
      metadata: typeof dbSession.metadata === 'string'
        ? JSON.parse(dbSession.metadata)
        : dbSession.metadata || {},
      createdAt: dbSession.created_at,
      updatedAt: dbSession.updated_at,
      expiresAt: dbSession.expires_at,
      isActive: dbSession.is_active,
      lastActivityAt: dbSession.last_activity_at
    };
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const session of this.sessionCache.values()) {
      totalSize += JSON.stringify(session).length * 2; // aproximación UTF-16
    }
    
    return totalSize;
  }

  /**
   * MÉTODO: Destruir manager
   */
  destroy(): void {
    // Limpiar timers
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const timer of this.expirationTimers.values()) {
      clearTimeout(timer);
    }

    // Limpiar caché
    this.sessionCache.clear();
    this.userSessionIndex.clear();
    this.tenantSessionIndex.clear();
    this.expirationTimers.clear();

    console.log(`[ImprovedSessionManager] Manager destruido`);
  }
}

export default ImprovedSessionManager;
export type {
  PersistentSession,
  SessionContextData,
  LeadSessionData,
  SessionMetadata,
  SessionConfig,
  CacheStats
};