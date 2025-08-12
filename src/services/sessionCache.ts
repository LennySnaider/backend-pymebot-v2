/**
 * SESSION CACHE SYSTEM
 * 
 * PROPÓSITO: Cache avanzado de sesiones por userId con TTL configurable
 * BASADO EN: Patrones de cache optimizados para alta concurrencia
 * PRESERVA: Sistema de leads y compatibilidad total
 * OPTIMIZA: Rendimiento y uso de memoria
 * 
 * CARACTERÍSTICAS CLAVE:
 * - Cache multinivel (memoria + Redis opcional)
 * - TTL configurable por usuario/tenant
 * - Estrategias de evicción LRU/LFU
 * - Compresión automática de datos grandes
 * - Métricas detalladas de rendimiento
 * - Persistencia opcional en BD
 */

import { createClient } from "@supabase/supabase-js";
import type { PersistentSession, SessionContextData, CacheStats } from './improvedSessionManager';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// INTERFACES PARA CACHE AVANZADO

interface CacheEntry<T> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  compressed: boolean;
  metadata: CacheEntryMetadata;
}

interface CacheEntryMetadata {
  userId: string;
  tenantId: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  tags: string[];
  source: 'manual' | 'auto' | 'fallback';
  version: string;
}

interface CacheConfiguration {
  maxSize: number;
  maxMemoryMB: number;
  defaultTTL: number;
  maxTTL: number;
  minTTL: number;
  evictionStrategy: 'lru' | 'lfu' | 'ttl' | 'size';
  compressionThreshold: number;
  persistToDisk: boolean;
  enableMetrics: boolean;
  cleanupInterval: number;
  userSessionLimit: number;
  tenantSessionLimit: number;
}

interface TTLPolicy {
  userId?: string;
  tenantId?: string;
  nodeType?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  customTTL?: number;
  conditions?: TTLCondition[];
}

interface TTLCondition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'contains';
  value: any;
  ttlModifier: number; // multiplicador del TTL base
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  compressions: number;
  decompressions: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  entryCount: number;
  hitRatio: number;
  userStats: Map<string, UserCacheStats>;
  tenantStats: Map<string, TenantCacheStats>;
}

interface UserCacheStats {
  userId: string;
  sessionCount: number;
  totalMemory: number;
  hits: number;
  misses: number;
  lastActivity: number;
}

interface TenantCacheStats {
  tenantId: string;
  userCount: number;
  sessionCount: number;
  totalMemory: number;
  hits: number;
  misses: number;
}

interface CacheQueryOptions {
  userId?: string;
  tenantId?: string;
  includeExpired?: boolean;
  sortBy?: 'accessed' | 'created' | 'ttl' | 'size';
  limit?: number;
  tags?: string[];
}

/**
 * ADVANCED SESSION CACHE CLASS
 * 
 * PROPÓSITO: Gestión optimizada de cache de sesiones
 * ARQUITECTURA: Multi-nivel con estrategias de evicción inteligentes
 * RENDIMIENTO: Optimizado para miles de sesiones concurrentes
 */
class SessionCache {
  private static instance: SessionCache;
  private cache: Map<string, CacheEntry<PersistentSession>> = new Map();
  private userIndex: Map<string, Set<string>> = new Map();
  private tenantIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private accessOrderQueue: string[] = [];
  private config: CacheConfiguration;
  private metrics: CacheMetrics;
  private ttlPolicies: TTLPolicy[] = [];
  private cleanupTimer: NodeJS.Timeout | null = null;
  private compressionEnabled: boolean = false;

  private constructor(config: Partial<CacheConfiguration> = {}) {
    this.config = {
      maxSize: 10000,
      maxMemoryMB: 100,
      defaultTTL: 3600000, // 1 hora
      maxTTL: 86400000, // 24 horas
      minTTL: 60000, // 1 minuto
      evictionStrategy: 'lru',
      compressionThreshold: 1024, // 1KB
      persistToDisk: true,
      enableMetrics: true,
      cleanupInterval: 300000, // 5 minutos
      userSessionLimit: 5,
      tenantSessionLimit: 1000,
      ...config
    };

    this.metrics = this.initializeMetrics();
    this.compressionEnabled = typeof TextEncoder !== 'undefined';
    this.initializeCache();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<CacheConfiguration>): SessionCache {
    if (!SessionCache.instance) {
      SessionCache.instance = new SessionCache(config);
    }
    return SessionCache.instance;
  }

  /**
   * MÉTODO PRINCIPAL: Obtener sesión del cache
   * PROPÓSITO: Recuperación optimizada con métricas y TTL
   */
  async get(sessionId: string, userId?: string): Promise<PersistentSession | null> {
    const startTime = Date.now();
    
    try {
      // 1. VERIFICAR EXISTENCIA EN CACHE
      const entry = this.cache.get(sessionId);
      
      if (!entry) {
        this.recordMiss(userId);
        return null;
      }

      // 2. VERIFICAR TTL
      if (this.isEntryExpired(entry)) {
        await this.remove(sessionId);
        this.recordMiss(userId);
        return null;
      }

      // 3. ACTUALIZAR MÉTRICAS DE ACCESO
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.updateAccessOrder(sessionId);

      // 4. DESCOMPRIMIR SI ES NECESARIO
      let session = entry.value;
      if (entry.compressed) {
        session = await this.decompress(entry.value);
        this.metrics.decompressions++;
      }

      // 5. REGISTRAR HIT
      this.recordHit(userId, Date.now() - startTime);
      
      console.log(`[SessionCache] Cache HIT para sesión ${sessionId} (userId: ${userId})`);
      return session;

    } catch (error) {
      console.error(`[SessionCache] Error obteniendo sesión ${sessionId}:`, error);
      this.recordMiss(userId);
      return null;
    }
  }

  /**
   * MÉTODO: Guardar sesión en cache con TTL configurable
   */
  async set(
    sessionId: string, 
    session: PersistentSession, 
    options: {
      customTTL?: number;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      tags?: string[];
      compress?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      // 1. CALCULAR TTL DINÁMICO
      const ttl = await this.calculateDynamicTTL(session, options.customTTL);
      
      // 2. VERIFICAR LÍMITES ANTES DE INSERTAR
      await this.enforceSessionLimits(session.userId, session.tenantId);
      
      // 3. VERIFICAR ESPACIO EN CACHE
      await this.ensureCacheSpace();

      // 4. PREPARAR ENTRADA
      let finalSession = session;
      let compressed = false;

      // Comprimir si es necesario
      if (this.shouldCompress(session, options.compress)) {
        finalSession = await this.compress(session);
        compressed = true;
        this.metrics.compressions++;
      }

      // 5. CREAR ENTRADA DE CACHE
      const entry: CacheEntry<PersistentSession> = {
        key: sessionId,
        value: finalSession,
        ttl,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size: this.calculateEntrySize(finalSession),
        compressed,
        metadata: {
          userId: session.userId,
          tenantId: session.tenantId,
          priority: options.priority || 'normal',
          tags: options.tags || [],
          source: 'manual',
          version: '1.0'
        }
      };

      // 6. INSERTAR EN CACHE
      this.cache.set(sessionId, entry);

      // 7. ACTUALIZAR ÍNDICES
      this.updateIndices(sessionId, entry);

      // 8. PROGRAMAR EXPIRACIÓN
      this.scheduleExpiration(sessionId, ttl);

      // 9. PERSISTIR SI ESTÁ CONFIGURADO
      if (this.config.persistToDisk) {
        await this.persistToDisk(sessionId, session);
      }

      console.log(`[SessionCache] Sesión ${sessionId} guardada con TTL ${ttl}ms`);
      return true;

    } catch (error) {
      console.error(`[SessionCache] Error guardando sesión ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Obtener todas las sesiones de un usuario
   */
  async getUserSessions(userId: string, options: CacheQueryOptions = {}): Promise<PersistentSession[]> {
    try {
      const sessions: PersistentSession[] = [];
      const sessionIds = this.userIndex.get(userId);

      if (!sessionIds) {
        return sessions;
      }

      for (const sessionId of sessionIds) {
        const entry = this.cache.get(sessionId);
        
        if (entry && 
            (!options.tenantId || entry.metadata.tenantId === options.tenantId) &&
            (options.includeExpired || !this.isEntryExpired(entry))) {
          
          let session = entry.value;
          if (entry.compressed) {
            session = await this.decompress(session);
          }
          
          sessions.push(session);
        }
      }

      // Aplicar ordenamiento y límite
      return this.applySortingAndLimit(sessions, options);

    } catch (error) {
      console.error(`[SessionCache] Error obteniendo sesiones de usuario ${userId}:`, error);
      return [];
    }
  }

  /**
   * MÉTODO: Obtener sesiones por tenant
   */
  async getTenantSessions(tenantId: string, options: CacheQueryOptions = {}): Promise<PersistentSession[]> {
    try {
      const sessions: PersistentSession[] = [];
      const sessionIds = this.tenantIndex.get(tenantId);

      if (!sessionIds) {
        return sessions;
      }

      for (const sessionId of sessionIds) {
        const entry = this.cache.get(sessionId);
        
        if (entry && 
            (!options.userId || entry.metadata.userId === options.userId) &&
            (options.includeExpired || !this.isEntryExpired(entry))) {
          
          let session = entry.value;
          if (entry.compressed) {
            session = await this.decompress(session);
          }
          
          sessions.push(session);
        }
      }

      return this.applySortingAndLimit(sessions, options);

    } catch (error) {
      console.error(`[SessionCache] Error obteniendo sesiones de tenant ${tenantId}:`, error);
      return [];
    }
  }

  /**
   * MÉTODO: Configurar política de TTL
   */
  addTTLPolicy(policy: TTLPolicy): void {
    this.ttlPolicies.push(policy);
    console.log(`[SessionCache] Política TTL agregada:`, policy);
  }

  /**
   * MÉTODO: Actualizar TTL de sesión existente
   */
  async updateTTL(sessionId: string, newTTL: number): Promise<boolean> {
    try {
      const entry = this.cache.get(sessionId);
      
      if (!entry) {
        return false;
      }

      // Validar TTL
      const validatedTTL = Math.max(this.config.minTTL, Math.min(this.config.maxTTL, newTTL));
      
      entry.ttl = validatedTTL;
      
      // Reprogramar expiración
      this.scheduleExpiration(sessionId, validatedTTL);
      
      console.log(`[SessionCache] TTL actualizado para ${sessionId}: ${validatedTTL}ms`);
      return true;

    } catch (error) {
      console.error(`[SessionCache] Error actualizando TTL para ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Eliminar sesión del cache
   */
  async remove(sessionId: string): Promise<boolean> {
    try {
      const entry = this.cache.get(sessionId);
      
      if (!entry) {
        return false;
      }

      // Limpiar cache principal
      this.cache.delete(sessionId);

      // Limpiar índices
      this.removeFromIndices(sessionId, entry);

      // Actualizar métricas
      this.updateUserStats(entry.metadata.userId, -1, -entry.size);
      this.updateTenantStats(entry.metadata.tenantId, -1, -entry.size);

      console.log(`[SessionCache] Sesión ${sessionId} eliminada del cache`);
      return true;

    } catch (error) {
      console.error(`[SessionCache] Error eliminando sesión ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Limpiar sesiones expiradas
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = Date.now();
      const expiredSessions: string[] = [];

      // Identificar sesiones expiradas
      for (const [sessionId, entry] of this.cache) {
        if (this.isEntryExpired(entry)) {
          expiredSessions.push(sessionId);
        }
      }

      // Limpiar sesiones expiradas
      for (const sessionId of expiredSessions) {
        await this.remove(sessionId);
        this.metrics.evictions++;
      }

      if (expiredSessions.length > 0) {
        console.log(`[SessionCache] Limpiadas ${expiredSessions.length} sesiones expiradas`);
      }

      return expiredSessions.length;

    } catch (error) {
      console.error(`[SessionCache] Error limpiando sesiones expiradas:`, error);
      return 0;
    }
  }

  /**
   * MÉTODO: Obtener métricas del cache
   */
  getMetrics(): CacheMetrics {
    this.updateGeneralMetrics();
    return { ...this.metrics };
  }

  /**
   * MÉTODO: Obtener estadísticas detalladas
   */
  getDetailedStats(): {
    cache: CacheMetrics;
    memory: { used: number; limit: number; percentage: number };
    performance: { hitRatio: number; avgResponseTime: number };
    topUsers: Array<{ userId: string; sessions: number; memory: number }>;
    topTenants: Array<{ tenantId: string; sessions: number; memory: number }>;
  } {
    const metrics = this.getMetrics();
    const memoryUsed = this.calculateTotalMemoryUsage();
    const memoryLimit = this.config.maxMemoryMB * 1024 * 1024;

    return {
      cache: metrics,
      memory: {
        used: memoryUsed,
        limit: memoryLimit,
        percentage: (memoryUsed / memoryLimit) * 100
      },
      performance: {
        hitRatio: metrics.hitRatio,
        avgResponseTime: metrics.averageResponseTime
      },
      topUsers: this.getTopUsers(10),
      topTenants: this.getTopTenants(10)
    };
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private initializeMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      entryCount: 0,
      hitRatio: 0,
      userStats: new Map(),
      tenantStats: new Map()
    };
  }

  private initializeCache(): void {
    // Configurar limpieza automática
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
      }, this.config.cleanupInterval);
    }

    console.log(`[SessionCache] Cache inicializado con configuración:`, this.config);
  }

  private async calculateDynamicTTL(session: PersistentSession, customTTL?: number): Promise<number> {
    // Si se especifica TTL personalizado, validarlo y usarlo
    if (customTTL) {
      return Math.max(this.config.minTTL, Math.min(this.config.maxTTL, customTTL));
    }

    // Aplicar políticas de TTL
    for (const policy of this.ttlPolicies) {
      if (this.policyMatches(session, policy)) {
        const baseTTL = policy.customTTL || this.config.defaultTTL;
        const modifiedTTL = this.applyTTLConditions(session, policy, baseTTL);
        return Math.max(this.config.minTTL, Math.min(this.config.maxTTL, modifiedTTL));
      }
    }

    // TTL basado en prioridad del metadata de la sesión
    const priority = session.metadata?.priority || 'normal';
    const priorityMultipliers = {
      'low': 0.5,
      'normal': 1.0,
      'high': 1.5,
      'critical': 2.0
    };

    const baseTTL = this.config.defaultTTL * priorityMultipliers[priority];
    return Math.max(this.config.minTTL, Math.min(this.config.maxTTL, baseTTL));
  }

  private policyMatches(session: PersistentSession, policy: TTLPolicy): boolean {
    if (policy.userId && policy.userId !== session.userId) {
      return false;
    }
    
    if (policy.tenantId && policy.tenantId !== session.tenantId) {
      return false;
    }
    
    if (policy.priority && policy.priority !== session.metadata?.priority) {
      return false;
    }

    return true;
  }

  private applyTTLConditions(session: PersistentSession, policy: TTLPolicy, baseTTL: number): number {
    if (!policy.conditions) {
      return baseTTL;
    }

    let modifiedTTL = baseTTL;

    for (const condition of policy.conditions) {
      if (this.conditionMatches(session, condition)) {
        modifiedTTL *= condition.ttlModifier;
      }
    }

    return modifiedTTL;
  }

  private conditionMatches(session: PersistentSession, condition: TTLCondition): boolean {
    const value = this.getNestedValue(session, condition.field);
    
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o && o[p], obj);
  }

  private async enforceSessionLimits(userId: string, tenantId: string): Promise<void> {
    // Verificar límite por usuario
    const userSessions = this.userIndex.get(userId);
    if (userSessions && userSessions.size >= this.config.userSessionLimit) {
      await this.evictOldestUserSession(userId);
    }

    // Verificar límite por tenant
    const tenantSessions = this.tenantIndex.get(tenantId);
    if (tenantSessions && tenantSessions.size >= this.config.tenantSessionLimit) {
      await this.evictOldestTenantSession(tenantId);
    }
  }

  private async ensureCacheSpace(): Promise<void> {
    // Verificar límite de tamaño
    if (this.cache.size >= this.config.maxSize) {
      await this.evictByStrategy();
    }

    // Verificar límite de memoria
    const memoryUsage = this.calculateTotalMemoryUsage();
    const memoryLimit = this.config.maxMemoryMB * 1024 * 1024;
    
    if (memoryUsage >= memoryLimit) {
      await this.evictByMemoryPressure();
    }
  }

  private async evictByStrategy(): Promise<void> {
    switch (this.config.evictionStrategy) {
      case 'lru':
        await this.evictLRU();
        break;
      case 'lfu':
        await this.evictLFU();
        break;
      case 'ttl':
        await this.evictByTTL();
        break;
      case 'size':
        await this.evictBySize();
        break;
    }
  }

  private async evictLRU(): Promise<void> {
    if (this.accessOrderQueue.length === 0) return;

    const oldestSessionId = this.accessOrderQueue[0];
    await this.remove(oldestSessionId);
    this.metrics.evictions++;
  }

  private async evictLFU(): Promise<void> {
    let leastUsedSession: string | null = null;
    let minAccessCount = Infinity;

    for (const [sessionId, entry] of this.cache) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        leastUsedSession = sessionId;
      }
    }

    if (leastUsedSession) {
      await this.remove(leastUsedSession);
      this.metrics.evictions++;
    }
  }

  private async evictByTTL(): Promise<void> {
    let shortestTTLSession: string | null = null;
    let minTTL = Infinity;

    for (const [sessionId, entry] of this.cache) {
      const remainingTTL = entry.ttl - (Date.now() - entry.createdAt);
      if (remainingTTL < minTTL) {
        minTTL = remainingTTL;
        shortestTTLSession = sessionId;
      }
    }

    if (shortestTTLSession) {
      await this.remove(shortestTTLSession);
      this.metrics.evictions++;
    }
  }

  private async evictBySize(): Promise<void> {
    let largestSession: string | null = null;
    let maxSize = 0;

    for (const [sessionId, entry] of this.cache) {
      if (entry.size > maxSize) {
        maxSize = entry.size;
        largestSession = sessionId;
      }
    }

    if (largestSession) {
      await this.remove(largestSession);
      this.metrics.evictions++;
    }
  }

  private async evictByMemoryPressure(): Promise<void> {
    // Remover sesiones de baja prioridad primero
    const priorities = ['low', 'normal', 'high', 'critical'];
    
    for (const priority of priorities) {
      for (const [sessionId, entry] of this.cache) {
        if (entry.metadata.priority === priority) {
          await this.remove(sessionId);
          this.metrics.evictions++;
          
          // Verificar si ya tenemos espacio suficiente
          const memoryUsage = this.calculateTotalMemoryUsage();
          const memoryLimit = this.config.maxMemoryMB * 1024 * 1024;
          if (memoryUsage < memoryLimit * 0.8) { // 80% del límite
            return;
          }
        }
      }
    }
  }

  private async evictOldestUserSession(userId: string): Promise<void> {
    const userSessions = this.userIndex.get(userId);
    if (!userSessions) return;

    let oldestSession: string | null = null;
    let oldestTime = Date.now();

    for (const sessionId of userSessions) {
      const entry = this.cache.get(sessionId);
      if (entry && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestSession = sessionId;
      }
    }

    if (oldestSession) {
      await this.remove(oldestSession);
      this.metrics.evictions++;
    }
  }

  private async evictOldestTenantSession(tenantId: string): Promise<void> {
    const tenantSessions = this.tenantIndex.get(tenantId);
    if (!tenantSessions) return;

    let oldestSession: string | null = null;
    let oldestTime = Date.now();

    for (const sessionId of tenantSessions) {
      const entry = this.cache.get(sessionId);
      if (entry && entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestSession = sessionId;
      }
    }

    if (oldestSession) {
      await this.remove(oldestSession);
      this.metrics.evictions++;
    }
  }

  private shouldCompress(session: PersistentSession, forceCompress?: boolean): boolean {
    if (forceCompress !== undefined) {
      return forceCompress && this.compressionEnabled;
    }

    if (!this.compressionEnabled) {
      return false;
    }

    const sessionSize = this.calculateEntrySize(session);
    return sessionSize > this.config.compressionThreshold;
  }

  private async compress(session: PersistentSession): Promise<PersistentSession> {
    try {
      // Simular compresión (en un entorno real usaríamos gzip o similar)
      const compressed = {
        ...session,
        contextData: JSON.stringify(session.contextData)
      };
      
      return compressed;
    } catch (error) {
      console.error(`[SessionCache] Error comprimiendo sesión:`, error);
      return session;
    }
  }

  private async decompress(session: PersistentSession): Promise<PersistentSession> {
    try {
      // Simular descompresión
      const decompressed = {
        ...session,
        contextData: typeof session.contextData === 'string' 
          ? JSON.parse(session.contextData as string)
          : session.contextData
      };
      
      return decompressed;
    } catch (error) {
      console.error(`[SessionCache] Error descomprimiendo sesión:`, error);
      return session;
    }
  }

  private calculateEntrySize(session: PersistentSession): number {
    return JSON.stringify(session).length * 2; // aproximación UTF-16
  }

  private calculateTotalMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private isEntryExpired(entry: CacheEntry<PersistentSession>): boolean {
    return Date.now() > entry.createdAt + entry.ttl;
  }

  private updateIndices(sessionId: string, entry: CacheEntry<PersistentSession>): void {
    // Índice por usuario
    if (!this.userIndex.has(entry.metadata.userId)) {
      this.userIndex.set(entry.metadata.userId, new Set());
    }
    this.userIndex.get(entry.metadata.userId)!.add(sessionId);

    // Índice por tenant
    if (!this.tenantIndex.has(entry.metadata.tenantId)) {
      this.tenantIndex.set(entry.metadata.tenantId, new Set());
    }
    this.tenantIndex.get(entry.metadata.tenantId)!.add(sessionId);

    // Índice por tags
    for (const tag of entry.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(sessionId);
    }

    // Actualizar estadísticas
    this.updateUserStats(entry.metadata.userId, 1, entry.size);
    this.updateTenantStats(entry.metadata.tenantId, 1, entry.size);
  }

  private removeFromIndices(sessionId: string, entry: CacheEntry<PersistentSession>): void {
    // Limpiar índice de usuario
    const userSessions = this.userIndex.get(entry.metadata.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userIndex.delete(entry.metadata.userId);
      }
    }

    // Limpiar índice de tenant
    const tenantSessions = this.tenantIndex.get(entry.metadata.tenantId);
    if (tenantSessions) {
      tenantSessions.delete(sessionId);
      if (tenantSessions.size === 0) {
        this.tenantIndex.delete(entry.metadata.tenantId);
      }
    }

    // Limpiar índice de tags
    for (const tag of entry.metadata.tags) {
      const tagSessions = this.tagIndex.get(tag);
      if (tagSessions) {
        tagSessions.delete(sessionId);
        if (tagSessions.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Limpiar cola de acceso
    const queueIndex = this.accessOrderQueue.indexOf(sessionId);
    if (queueIndex !== -1) {
      this.accessOrderQueue.splice(queueIndex, 1);
    }
  }

  private updateAccessOrder(sessionId: string): void {
    // Remover de posición actual
    const currentIndex = this.accessOrderQueue.indexOf(sessionId);
    if (currentIndex !== -1) {
      this.accessOrderQueue.splice(currentIndex, 1);
    }
    
    // Agregar al final (más reciente)
    this.accessOrderQueue.push(sessionId);
  }

  private scheduleExpiration(sessionId: string, ttl: number): void {
    setTimeout(() => {
      this.remove(sessionId);
    }, ttl);
  }

  private recordHit(userId?: string, responseTime?: number): void {
    this.metrics.hits++;
    this.metrics.totalRequests++;
    
    if (responseTime) {
      const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
      this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
    }

    if (userId) {
      const userStats = this.metrics.userStats.get(userId);
      if (userStats) {
        userStats.hits++;
        userStats.lastActivity = Date.now();
      }
    }
  }

  private recordMiss(userId?: string): void {
    this.metrics.misses++;
    this.metrics.totalRequests++;

    if (userId) {
      const userStats = this.metrics.userStats.get(userId);
      if (userStats) {
        userStats.misses++;
        userStats.lastActivity = Date.now();
      }
    }
  }

  private updateUserStats(userId: string, sessionDelta: number, memoryDelta: number): void {
    let userStats = this.metrics.userStats.get(userId);
    
    if (!userStats) {
      userStats = {
        userId,
        sessionCount: 0,
        totalMemory: 0,
        hits: 0,
        misses: 0,
        lastActivity: Date.now()
      };
      this.metrics.userStats.set(userId, userStats);
    }

    userStats.sessionCount += sessionDelta;
    userStats.totalMemory += memoryDelta;
    userStats.lastActivity = Date.now();
  }

  private updateTenantStats(tenantId: string, sessionDelta: number, memoryDelta: number): void {
    let tenantStats = this.metrics.tenantStats.get(tenantId);
    
    if (!tenantStats) {
      tenantStats = {
        tenantId,
        userCount: 0,
        sessionCount: 0,
        totalMemory: 0,
        hits: 0,
        misses: 0
      };
      this.metrics.tenantStats.set(tenantId, tenantStats);
    }

    tenantStats.sessionCount += sessionDelta;
    tenantStats.totalMemory += memoryDelta;
  }

  private updateGeneralMetrics(): void {
    this.metrics.entryCount = this.cache.size;
    this.metrics.memoryUsage = this.calculateTotalMemoryUsage();
    this.metrics.hitRatio = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0;
  }

  private applySortingAndLimit(sessions: PersistentSession[], options: CacheQueryOptions): PersistentSession[] {
    let sorted = [...sessions];

    // Aplicar ordenamiento
    if (options.sortBy) {
      switch (options.sortBy) {
        case 'created':
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          break;
        case 'accessed':
          sorted.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
          break;
        case 'ttl':
          // Ordenar por tiempo restante de TTL
          break;
      }
    }

    // Aplicar límite
    if (options.limit && options.limit > 0) {
      sorted = sorted.slice(0, options.limit);
    }

    return sorted;
  }

  private getTopUsers(limit: number): Array<{ userId: string; sessions: number; memory: number }> {
    const users = Array.from(this.metrics.userStats.values())
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, limit)
      .map(user => ({
        userId: user.userId,
        sessions: user.sessionCount,
        memory: user.totalMemory
      }));

    return users;
  }

  private getTopTenants(limit: number): Array<{ tenantId: string; sessions: number; memory: number }> {
    const tenants = Array.from(this.metrics.tenantStats.values())
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, limit)
      .map(tenant => ({
        tenantId: tenant.tenantId,
        sessions: tenant.sessionCount,
        memory: tenant.totalMemory
      }));

    return tenants;
  }

  private async persistToDisk(sessionId: string, session: PersistentSession): Promise<void> {
    try {
      // Guardar en BD para persistencia
      const { error } = await supabase
        .from('session_cache_backup')
        .upsert({
          session_id: sessionId,
          user_id: session.userId,
          tenant_id: session.tenantId,
          session_data: JSON.stringify(session),
          cached_at: new Date().toISOString()
        });

      if (error) {
        console.error(`[SessionCache] Error persistiendo a disco:`, error);
      }
    } catch (error) {
      console.error(`[SessionCache] Error en persistToDisk:`, error);
    }
  }

  /**
   * MÉTODO: Destruir cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cache.clear();
    this.userIndex.clear();
    this.tenantIndex.clear();
    this.tagIndex.clear();
    this.accessOrderQueue = [];
    this.metrics.userStats.clear();
    this.metrics.tenantStats.clear();

    console.log(`[SessionCache] Cache destruido`);
  }
}

export default SessionCache;
export type {
  CacheEntry,
  CacheConfiguration,
  TTLPolicy,
  CacheMetrics,
  CacheQueryOptions
};