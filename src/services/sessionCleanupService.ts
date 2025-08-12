/**
 * SESSION CLEANUP SERVICE
 * 
 * PROPÓSITO: Limpieza automática de sesiones expiradas y gestión de memoria
 * BASADO EN: Patrones de limpieza del v1-reference
 * PRESERVA: Sistema de leads intacto
 * OPTIMIZA: Memoria y rendimiento del sistema
 * 
 * CARACTERÍSTICAS CLAVE:
 * - Limpieza automática programada
 * - Múltiples estrategias de limpieza
 * - Métricas detalladas de limpieza
 * - Integración con ImprovedSessionManager
 * - Configuración flexible de políticas
 * - Logging detallado para debugging
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from '../utils/logger';
import ImprovedSessionManager from './improvedSessionManager';
import SessionCache from './sessionCache';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// INTERFACES PARA CONFIGURACIÓN DE LIMPIEZA

interface CleanupConfiguration {
  enabled: boolean;
  intervalMs: number; // Intervalo entre limpiezas automáticas
  maxSessionAge: number; // Edad máxima de sesión en ms
  maxInactivityTime: number; // Tiempo máximo de inactividad en ms
  batchSize: number; // Número de sesiones a procesar por lote
  strategies: CleanupStrategy[];
  preserveLeadSessions: boolean; // Preservar sesiones con datos de leads
  dryRun: boolean; // Modo de prueba sin eliminar realmente
}

interface CleanupStrategy {
  name: string;
  priority: number;
  conditions: CleanupCondition[];
  action: 'delete' | 'archive' | 'compress' | 'extend_ttl';
  gracePeriodMs?: number;
}

interface CleanupCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'not_contains';
  value: any;
  description: string;
}

interface CleanupMetrics {
  totalSessions: number;
  expiredSessions: number;
  inactiveSessions: number;
  sessionsDeleted: number;
  sessionsArchived: number;
  sessionsCompressed: number;
  ttlExtended: number;
  memoryReclaimed: number;
  executionTime: number;
  lastCleanup: string;
  errors: string[];
}

interface CleanupReport {
  startTime: string;
  endTime: string;
  duration: number;
  metrics: CleanupMetrics;
  strategiesExecuted: string[];
  recommendations: string[];
}

/**
 * SERVICIO PRINCIPAL DE LIMPIEZA DE SESIONES
 */
class SessionCleanupService {
  private static instance: SessionCleanupService;
  private config: CleanupConfiguration;
  private sessionManager: ImprovedSessionManager;
  private sessionCache: SessionCache;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastMetrics: CleanupMetrics | null = null;

  private constructor(config: Partial<CleanupConfiguration> = {}) {
    this.config = {
      enabled: true,
      intervalMs: 300000, // 5 minutos
      maxSessionAge: 86400000, // 24 horas
      maxInactivityTime: 3600000, // 1 hora
      batchSize: 100,
      strategies: this.getDefaultStrategies(),
      preserveLeadSessions: true,
      dryRun: false,
      ...config
    };

    this.sessionManager = ImprovedSessionManager.getInstance();
    this.sessionCache = SessionCache.getInstance();

    this.initializeService();
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(config?: Partial<CleanupConfiguration>): SessionCleanupService {
    if (!SessionCleanupService.instance) {
      SessionCleanupService.instance = new SessionCleanupService(config);
    }
    return SessionCleanupService.instance;
  }

  /**
   * MÉTODO: Inicializar servicio de limpieza
   */
  private initializeService(): void {
    if (this.config.enabled) {
      this.startAutomaticCleanup();
      logger.info(`[SessionCleanupService] Servicio inicializado con intervalo de ${this.config.intervalMs}ms`);
    } else {
      logger.info(`[SessionCleanupService] Servicio deshabilitado`);
    }
  }

  /**
   * MÉTODO: Iniciar limpieza automática programada
   */
  startAutomaticCleanup(): void {
    if (this.cleanupTimer) {
      this.stopAutomaticCleanup();
    }

    this.cleanupTimer = setInterval(async () => {
      if (!this.isRunning) {
        await this.executeCleanup();
      }
    }, this.config.intervalMs);

    logger.info(`[SessionCleanupService] Limpieza automática iniciada`);
  }

  /**
   * MÉTODO: Detener limpieza automática
   */
  stopAutomaticCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info(`[SessionCleanupService] Limpieza automática detenida`);
    }
  }

  /**
   * MÉTODO PRINCIPAL: Ejecutar proceso de limpieza
   */
  async executeCleanup(): Promise<CleanupReport> {
    if (this.isRunning) {
      logger.warn(`[SessionCleanupService] Limpieza ya en progreso, saltando ejecución`);
      throw new Error('Cleanup already in progress');
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    logger.info(`[SessionCleanupService] Iniciando proceso de limpieza${this.config.dryRun ? ' (DRY RUN)' : ''}`);

    try {
      // Inicializar métricas
      const metrics: CleanupMetrics = {
        totalSessions: 0,
        expiredSessions: 0,
        inactiveSessions: 0,
        sessionsDeleted: 0,
        sessionsArchived: 0,
        sessionsCompressed: 0,
        ttlExtended: 0,
        memoryReclaimed: 0,
        executionTime: 0,
        lastCleanup: startTime,
        errors: []
      };

      const strategiesExecuted: string[] = [];
      const recommendations: string[] = [];

      // PASO 1: Analizar estado actual del sistema
      await this.analyzeSystemState(metrics);

      // PASO 2: Ejecutar estrategias de limpieza en orden de prioridad
      const sortedStrategies = this.config.strategies.sort((a, b) => a.priority - b.priority);
      
      for (const strategy of sortedStrategies) {
        try {
          logger.info(`[SessionCleanupService] Ejecutando estrategia: ${strategy.name}`);
          
          const strategyResult = await this.executeCleanupStrategy(strategy, metrics);
          
          if (strategyResult.success) {
            strategiesExecuted.push(strategy.name);
            logger.info(`[SessionCleanupService] Estrategia ${strategy.name} completada exitosamente`);
          } else {
            metrics.errors.push(`Estrategia ${strategy.name}: ${strategyResult.error}`);
            logger.error(`[SessionCleanupService] Error en estrategia ${strategy.name}:`, strategyResult.error);
          }
          
        } catch (error) {
          const errorMsg = `Error ejecutando estrategia ${strategy.name}: ${error}`;
          metrics.errors.push(errorMsg);
          logger.error(`[SessionCleanupService] ${errorMsg}`);
        }
      }

      // PASO 3: Limpieza final de cache y base de datos
      await this.finalCleanup(metrics);

      // PASO 4: Generar recomendaciones
      recommendations.push(...this.generateRecommendations(metrics));

      // Calcular tiempo total de ejecución
      metrics.executionTime = Date.now() - startTimestamp;
      this.lastMetrics = metrics;

      const report: CleanupReport = {
        startTime,
        endTime: new Date().toISOString(),
        duration: metrics.executionTime,
        metrics,
        strategiesExecuted,
        recommendations
      };

      logger.info(`[SessionCleanupService] Proceso de limpieza completado en ${metrics.executionTime}ms`);
      logger.info(`[SessionCleanupService] Sesiones eliminadas: ${metrics.sessionsDeleted}`);
      logger.info(`[SessionCleanupService] Memoria reclamada: ${(metrics.memoryReclaimed / 1024).toFixed(2)} KB`);

      return report;

    } catch (error) {
      logger.error(`[SessionCleanupService] Error en proceso de limpieza:`, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * MÉTODO: Analizar estado actual del sistema
   */
  private async analyzeSystemState(metrics: CleanupMetrics): Promise<void> {
    try {
      // Obtener estadísticas del cache
      const cacheStats = this.sessionCache.getDetailedStats();
      metrics.totalSessions = cacheStats.cache.entryCount;

      // Contar sesiones expiradas e inactivas
      const now = Date.now();
      let expiredCount = 0;
      let inactiveCount = 0;

      // Analizar sesiones en cache
      for (const sessionEntry of this.sessionCache.cache.values()) {
        const session = sessionEntry.value;
        
        // Verificar expiración
        const expirationTime = new Date(session.expiresAt).getTime();
        if (now > expirationTime) {
          expiredCount++;
        }

        // Verificar inactividad
        const lastActivity = new Date(session.lastActivityAt).getTime();
        if (now - lastActivity > this.config.maxInactivityTime) {
          inactiveCount++;
        }
      }

      metrics.expiredSessions = expiredCount;
      metrics.inactiveSessions = inactiveCount;

      logger.info(`[SessionCleanupService] Estado del sistema:`);
      logger.info(`  - Total de sesiones: ${metrics.totalSessions}`);
      logger.info(`  - Sesiones expiradas: ${metrics.expiredSessions}`);
      logger.info(`  - Sesiones inactivas: ${metrics.inactiveSessions}`);

    } catch (error) {
      logger.error(`[SessionCleanupService] Error analizando estado del sistema:`, error);
      metrics.errors.push(`Error en análisis: ${error}`);
    }
  }

  /**
   * MÉTODO: Ejecutar estrategia específica de limpieza
   */
  private async executeCleanupStrategy(
    strategy: CleanupStrategy,
    metrics: CleanupMetrics
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const candidateSessions = await this.findCandidateSessions(strategy.conditions);
      
      if (candidateSessions.length === 0) {
        logger.debug(`[SessionCleanupService] No hay sesiones candidatas para estrategia ${strategy.name}`);
        return { success: true };
      }

      logger.info(`[SessionCleanupService] Encontradas ${candidateSessions.length} sesiones candidatas para ${strategy.name}`);

      // Procesar en lotes para evitar sobrecarga
      const batches = this.chunkArray(candidateSessions, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processBatch(batch, strategy, metrics);
        
        // Pequeña pausa entre lotes para no saturar el sistema
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * MÉTODO: Encontrar sesiones candidatas para limpieza
   */
  private async findCandidateSessions(conditions: CleanupCondition[]): Promise<string[]> {
    const candidates: string[] = [];
    const now = Date.now();

    try {
      // Evaluar cada sesión en el cache
      for (const [sessionId, sessionEntry] of this.sessionCache.cache.entries()) {
        const session = sessionEntry.value;
        
        // CRÍTICO: Preservar sesiones con datos de leads si está configurado
        if (this.config.preserveLeadSessions && session.contextData?.leadData) {
          continue;
        }

        // Evaluar todas las condiciones
        let meetsAllConditions = true;
        
        for (const condition of conditions) {
          if (!this.evaluateCondition(session, condition, now)) {
            meetsAllConditions = false;
            break;
          }
        }

        if (meetsAllConditions) {
          candidates.push(sessionId);
        }
      }

      return candidates;

    } catch (error) {
      logger.error(`[SessionCleanupService] Error encontrando sesiones candidatas:`, error);
      return [];
    }
  }

  /**
   * MÉTODO: Evaluar condición específica para una sesión
   */
  private evaluateCondition(session: any, condition: CleanupCondition, now: number): boolean {
    try {
      const value = this.getNestedValue(session, condition.field);
      
      switch (condition.operator) {
        case 'gt':
          return this.compareValues(value, condition.value, now) > 0;
        case 'lt':
          return this.compareValues(value, condition.value, now) < 0;
        case 'eq':
          return value === condition.value;
        case 'contains':
          return typeof value === 'string' && value.includes(condition.value);
        case 'not_contains':
          return typeof value === 'string' && !value.includes(condition.value);
        default:
          return false;
      }
    } catch (error) {
      logger.debug(`[SessionCleanupService] Error evaluando condición ${condition.field}:`, error);
      return false;
    }
  }

  /**
   * MÉTODO: Comparar valores para condiciones temporales
   */
  private compareValues(value: any, compareValue: any, now: number): number {
    // Si es una fecha, convertir a timestamp
    if (typeof value === 'string' && value.includes('T')) {
      const timestamp = new Date(value).getTime();
      
      if (typeof compareValue === 'string' && compareValue.startsWith('now-')) {
        const offset = parseInt(compareValue.replace('now-', ''));
        return (now - timestamp) - offset;
      }
      
      return timestamp - compareValue;
    }
    
    return value - compareValue;
  }

  /**
   * MÉTODO: Procesar lote de sesiones
   */
  private async processBatch(
    sessionIds: string[],
    strategy: CleanupStrategy,
    metrics: CleanupMetrics
  ): Promise<void> {
    for (const sessionId of sessionIds) {
      try {
        if (this.config.dryRun) {
          logger.debug(`[SessionCleanupService] DRY RUN - Aplicaría ${strategy.action} a sesión ${sessionId}`);
          continue;
        }

        switch (strategy.action) {
          case 'delete':
            await this.deleteSession(sessionId);
            metrics.sessionsDeleted++;
            break;
            
          case 'archive':
            await this.archiveSession(sessionId);
            metrics.sessionsArchived++;
            break;
            
          case 'compress':
            await this.compressSession(sessionId);
            metrics.sessionsCompressed++;
            break;
            
          case 'extend_ttl':
            await this.extendSessionTTL(sessionId);
            metrics.ttlExtended++;
            break;
        }

        // Estimar memoria reclamada (aproximado)
        metrics.memoryReclaimed += 1024; // 1KB promedio por sesión

      } catch (error) {
        const errorMsg = `Error procesando sesión ${sessionId} con acción ${strategy.action}: ${error}`;
        metrics.errors.push(errorMsg);
        logger.error(`[SessionCleanupService] ${errorMsg}`);
      }
    }
  }

  /**
   * MÉTODOS DE ACCIONES DE LIMPIEZA
   */

  private async deleteSession(sessionId: string): Promise<void> {
    // Eliminar del cache
    await this.sessionCache.remove(sessionId);
    
    // Marcar como inactiva en BD (no eliminar físicamente)
    await supabase
      .from('persistent_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    logger.debug(`[SessionCleanupService] Sesión ${sessionId} eliminada`);
  }

  private async archiveSession(sessionId: string): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    
    if (session) {
      // Mover a tabla de archivo
      await supabase
        .from('archived_sessions')
        .insert({
          session_id: sessionId,
          user_id: session.userId,
          tenant_id: session.tenantId,
          session_data: JSON.stringify(session),
          archived_at: new Date().toISOString()
        });

      // Eliminar de cache activo
      await this.sessionCache.remove(sessionId);
      
      logger.debug(`[SessionCleanupService] Sesión ${sessionId} archivada`);
    }
  }

  private async compressSession(sessionId: string): Promise<void> {
    // Limpiar datos no esenciales pero mantener sesión activa
    const contextData = await this.sessionManager.getSessionContext(sessionId);
    
    if (contextData) {
      const compressedContext = {
        ...contextData,
        conversationHistory: contextData.conversationHistory?.slice(-10) || [], // Solo últimos 10 mensajes
        flowHistory: contextData.flowHistory?.slice(-5) || [], // Solo últimos 5 flujos
        temporaryData: {} // Limpiar datos temporales
      };

      await this.sessionManager.updateSessionContext(sessionId, compressedContext);
      logger.debug(`[SessionCleanupService] Sesión ${sessionId} comprimida`);
    }
  }

  private async extendSessionTTL(sessionId: string): Promise<void> {
    // Extender TTL por 1 hora más
    const newTTL = 3600000; // 1 hora
    await this.sessionCache.updateTTL(sessionId, newTTL);
    
    logger.debug(`[SessionCleanupService] TTL de sesión ${sessionId} extendido`);
  }

  /**
   * MÉTODO: Limpieza final
   */
  private async finalCleanup(metrics: CleanupMetrics): Promise<void> {
    try {
      // Ejecutar limpieza automática del cache
      const expiredCount = await this.sessionCache.cleanupExpired();
      metrics.sessionsDeleted += expiredCount;

      // Limpiar registros antiguos de BD
      if (!this.config.dryRun) {
        const cutoffDate = new Date(Date.now() - this.config.maxSessionAge).toISOString();
        
        await supabase
          .from('persistent_sessions')
          .delete()
          .eq('is_active', false)
          .lt('updated_at', cutoffDate);
      }

      logger.debug(`[SessionCleanupService] Limpieza final completada`);

    } catch (error) {
      logger.error(`[SessionCleanupService] Error en limpieza final:`, error);
      metrics.errors.push(`Error en limpieza final: ${error}`);
    }
  }

  /**
   * MÉTODO: Generar recomendaciones basadas en métricas
   */
  private generateRecommendations(metrics: CleanupMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.expiredSessions > metrics.totalSessions * 0.3) {
      recommendations.push('Considerar reducir el TTL por defecto de las sesiones');
    }

    if (metrics.inactiveSessions > metrics.totalSessions * 0.5) {
      recommendations.push('Considerar reducir el tiempo máximo de inactividad');
    }

    if (metrics.errors.length > 0) {
      recommendations.push('Revisar logs para errores durante la limpieza');
    }

    if (metrics.memoryReclaimed < 1024) {
      recommendations.push('Sistema optimizado, pocas sesiones requirieron limpieza');
    }

    return recommendations;
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private getDefaultStrategies(): CleanupStrategy[] {
    return [
      {
        name: 'delete_expired_sessions',
        priority: 1,
        conditions: [
          {
            field: 'expiresAt',
            operator: 'lt',
            value: 'now',
            description: 'Sesiones que han expirado'
          }
        ],
        action: 'delete'
      },
      {
        name: 'compress_inactive_sessions',
        priority: 2,
        conditions: [
          {
            field: 'lastActivityAt',
            operator: 'lt',
            value: 'now-3600000', // 1 hora de inactividad
            description: 'Sesiones inactivas por más de 1 hora'
          }
        ],
        action: 'compress'
      },
      {
        name: 'archive_old_sessions',
        priority: 3,
        conditions: [
          {
            field: 'createdAt',
            operator: 'lt',
            value: 'now-86400000', // 24 horas
            description: 'Sesiones creadas hace más de 24 horas'
          }
        ],
        action: 'archive',
        gracePeriodMs: 3600000 // 1 hora de gracia
      }
    ];
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o && o[p], obj);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * MÉTODOS PÚBLICOS PARA CONTROL EXTERNO
   */

  async getCleanupStatus(): Promise<{
    isRunning: boolean;
    isEnabled: boolean;
    lastMetrics: CleanupMetrics | null;
    nextCleanup?: string;
  }> {
    return {
      isRunning: this.isRunning,
      isEnabled: this.config.enabled,
      lastMetrics: this.lastMetrics,
      nextCleanup: this.cleanupTimer ? 
        new Date(Date.now() + this.config.intervalMs).toISOString() : 
        undefined
    };
  }

  async executeManualCleanup(): Promise<CleanupReport> {
    logger.info(`[SessionCleanupService] Ejecutando limpieza manual`);
    return await this.executeCleanup();
  }

  updateConfiguration(newConfig: Partial<CleanupConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled && !this.cleanupTimer) {
      this.startAutomaticCleanup();
    } else if (!this.config.enabled && this.cleanupTimer) {
      this.stopAutomaticCleanup();
    }
    
    logger.info(`[SessionCleanupService] Configuración actualizada`, newConfig);
  }

  /**
   * MÉTODO: Destruir servicio
   */
  destroy(): void {
    this.stopAutomaticCleanup();
    this.isRunning = false;
    logger.info(`[SessionCleanupService] Servicio destruido`);
  }
}

export default SessionCleanupService;
export type {
  CleanupConfiguration,
  CleanupStrategy,
  CleanupCondition,
  CleanupMetrics,
  CleanupReport
};