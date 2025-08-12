/**
 * HYBRID SYSTEM LOGGER
 * 
 * PROPÓSITO: Sistema de logging especializado para debugging del sistema híbrido
 * BASADO EN: Mejores prácticas de observabilidad y debugging de sistemas distribuidos
 * PRESERVA: Sistema de logging actual 100% intacto
 * TRANSPARENTE: Logging detallado sin afectar rendimiento en producción
 * 
 * FUNCIONALIDADES:
 * - Logging estructurado con contexto detallado
 * - Correlación de requests a través de todo el flujo híbrido
 * - Métricas de performance en tiempo real
 * - Debug traces para troubleshooting
 * - Alertas automáticas por anomalías
 * - Export de logs para análisis externo
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import logger from './logger'; // Logger actual del sistema
import { performance } from 'perf_hooks';

// INTERFACES PARA LOGGING HÍBRIDO

interface HybridLogContext {
  requestId: string;
  traceId: string;
  sessionId?: string;
  tenantId?: string;
  templateId?: string;
  userId?: string;
  component: HybridComponent;
  operation: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface HybridLogEntry {
  level: LogLevel;
  message: string;
  context: HybridLogContext;
  data?: any;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: PerformanceMetrics;
  tags?: string[];
}

interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

interface DebugTrace {
  traceId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  operations: TraceOperation[];
  result: 'success' | 'error' | 'fallback';
  metadata: Record<string, any>;
}

interface TraceOperation {
  component: HybridComponent;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  input?: any;
  output?: any;
  error?: any;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'trace' | 'performance';

type HybridComponent = 
  | 'templateDetector'
  | 'systemRouter' 
  | 'fallbackManager'
  | 'hybridTemplateManager'
  | 'metricsCollector'
  | 'enhancedDataCapture'
  | 'improvedSessionManager'
  | 'dynamicNavigation'
  | 'nodeProcessingQueue'
  | 'hybridFlowRegistry'
  | 'templateConverter'
  | 'flowRegistry'
  | 'middleware'
  | 'api'
  | 'general';

interface LoggingConfiguration {
  enabled: boolean;
  level: LogLevel;
  enablePerformanceMetrics: boolean;
  enableTracing: boolean;
  enableStructuredLogging: boolean;
  enableConsoleOutput: boolean;
  enableFileOutput: boolean;
  enableExternalExport: boolean;
  maxLogEntries: number;
  rotationInterval: number; // minutos
  components: Record<HybridComponent, boolean>;
  filters: LogFilter[];
}

interface LogFilter {
  id: string;
  enabled: boolean;
  component?: HybridComponent;
  level?: LogLevel;
  pattern?: string;
  action: 'include' | 'exclude' | 'highlight';
}

/**
 * CLASE PRINCIPAL DEL LOGGER HÍBRIDO
 */
class HybridLogger {
  private static instance: HybridLogger;
  private config: LoggingConfiguration;
  private logEntries: HybridLogEntry[] = [];
  private activeTraces: Map<string, DebugTrace> = new Map();
  private performanceMap: Map<string, PerformanceMetrics> = new Map();

  private constructor() {
    // CONFIGURACIÓN POR DEFECTO
    this.config = {
      enabled: true,
      level: 'info',
      enablePerformanceMetrics: true,
      enableTracing: true,
      enableStructuredLogging: true,
      enableConsoleOutput: true,
      enableFileOutput: false,
      enableExternalExport: false,
      maxLogEntries: 10000,
      rotationInterval: 60, // 1 hora
      components: {
        templateDetector: true,
        systemRouter: true,
        fallbackManager: true,
        hybridTemplateManager: true,
        metricsCollector: true,
        enhancedDataCapture: true,
        improvedSessionManager: true,
        dynamicNavigation: true,
        nodeProcessingQueue: true,
        hybridFlowRegistry: true,
        templateConverter: true,
        flowRegistry: true,
        middleware: true,
        api: true,
        general: true
      },
      filters: []
    };

    // CONFIGURAR LIMPIEZA PERIÓDICA
    this.startLogRotation();

    logger.info('[HybridLogger] Logger híbrido inicializado');
  }

  /**
   * MÉTODO: Obtener instancia singleton
   */
  static getInstance(): HybridLogger {
    if (!HybridLogger.instance) {
      HybridLogger.instance = new HybridLogger();
    }
    return HybridLogger.instance;
  }

  /**
   * MÉTODOS PRINCIPALES DE LOGGING
   */

  debug(
    component: HybridComponent,
    operation: string,
    message: string,
    context: Partial<HybridLogContext> = {},
    data?: any
  ): void {
    this.log('debug', component, operation, message, context, data);
  }

  info(
    component: HybridComponent,
    operation: string,
    message: string,
    context: Partial<HybridLogContext> = {},
    data?: any
  ): void {
    this.log('info', component, operation, message, context, data);
  }

  warn(
    component: HybridComponent,
    operation: string,
    message: string,
    context: Partial<HybridLogContext> = {},
    data?: any
  ): void {
    this.log('warn', component, operation, message, context, data);
  }

  error(
    component: HybridComponent,
    operation: string,
    message: string,
    error: Error | any,
    context: Partial<HybridLogContext> = {},
    data?: any
  ): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : { message: String(error) };

    this.log('error', component, operation, message, context, data, errorData);
  }

  performance(
    component: HybridComponent,
    operation: string,
    message: string,
    metrics: PerformanceMetrics,
    context: Partial<HybridLogContext> = {}
  ): void {
    this.log('performance', component, operation, message, context, undefined, undefined, metrics);
  }

  trace(
    component: HybridComponent,
    operation: string,
    message: string,
    context: Partial<HybridLogContext> = {},
    data?: any
  ): void {
    this.log('trace', component, operation, message, context, data);
  }

  /**
   * MÉTODO CENTRAL DE LOGGING
   */
  private log(
    level: LogLevel,
    component: HybridComponent,
    operation: string,
    message: string,
    context: Partial<HybridLogContext> = {},
    data?: any,
    error?: any,
    performanceMetrics?: PerformanceMetrics
  ): void {
    try {
      // VERIFICAR SI EL LOGGING ESTÁ HABILITADO
      if (!this.config.enabled || !this.config.components[component]) {
        return;
      }

      // VERIFICAR NIVEL DE LOG
      if (!this.shouldLog(level)) {
        return;
      }

      // CONSTRUIR CONTEXTO COMPLETO
      const fullContext: HybridLogContext = {
        requestId: context.requestId || this.generateId('req'),
        traceId: context.traceId || this.generateId('trace'),
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        templateId: context.templateId,
        userId: context.userId,
        component,
        operation,
        timestamp: new Date().toISOString(),
        metadata: context.metadata
      };

      // CREAR ENTRADA DE LOG
      const logEntry: HybridLogEntry = {
        level,
        message,
        context: fullContext,
        data,
        error,
        performance: performanceMetrics,
        tags: this.generateTags(component, operation, level)
      };

      // APLICAR FILTROS
      if (!this.passesFilters(logEntry)) {
        return;
      }

      // ALMACENAR ENTRADA
      this.storeLogEntry(logEntry);

      // OUTPUT A CONSOLA SI ESTÁ HABILITADO
      if (this.config.enableConsoleOutput) {
        this.outputToConsole(logEntry);
      }

      // OUTPUT A ARCHIVO SI ESTÁ HABILITADO
      if (this.config.enableFileOutput) {
        this.outputToFile(logEntry);
      }

      // EXPORT EXTERNO SI ESTÁ HABILITADO
      if (this.config.enableExternalExport) {
        this.exportExternal(logEntry);
      }

    } catch (loggingError) {
      // FALLBACK AL LOGGER ORIGINAL EN CASO DE ERROR
      logger.error('[HybridLogger] Error en sistema de logging híbrido:', loggingError);
      logger[level](`[${component}] ${operation}: ${message}`, data);
    }
  }

  /**
   * MÉTODOS DE TRACING
   */

  startTrace(
    traceId: string,
    metadata: Record<string, any> = {}
  ): string {
    if (!this.config.enableTracing) {
      return traceId;
    }

    const trace: DebugTrace = {
      traceId,
      startTime: performance.now(),
      operations: [],
      result: 'success',
      metadata
    };

    this.activeTraces.set(traceId, trace);
    
    this.debug('general', 'start_trace', `Trace iniciado: ${traceId}`, { traceId }, metadata);
    
    return traceId;
  }

  addTraceOperation(
    traceId: string,
    component: HybridComponent,
    operation: string,
    status: 'started' | 'completed' | 'error',
    input?: any,
    output?: any,
    error?: any
  ): void {
    if (!this.config.enableTracing) {
      return;
    }

    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return;
    }

    const existingOp = trace.operations.find(op => 
      op.component === component && op.operation === operation && !op.endTime
    );

    if (existingOp && status !== 'started') {
      // COMPLETAR OPERACIÓN EXISTENTE
      existingOp.endTime = performance.now();
      existingOp.duration = existingOp.endTime - existingOp.startTime;
      existingOp.status = status;
      existingOp.output = output;
      existingOp.error = error;
    } else if (status === 'started') {
      // NUEVA OPERACIÓN
      const newOp: TraceOperation = {
        component,
        operation,
        startTime: performance.now(),
        status,
        input
      };
      trace.operations.push(newOp);
    }

    this.trace(component, operation, `Trace operation: ${status}`, { traceId }, { input, output, error });
  }

  endTrace(
    traceId: string,
    result: 'success' | 'error' | 'fallback',
    metadata: Record<string, any> = {}
  ): DebugTrace | null {
    if (!this.config.enableTracing) {
      return null;
    }

    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return null;
    }

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.result = result;
    trace.metadata = { ...trace.metadata, ...metadata };

    this.activeTraces.delete(traceId);

    this.debug('general', 'end_trace', `Trace completado: ${traceId}`, { traceId }, {
      duration: trace.duration,
      result,
      operations: trace.operations.length,
      metadata
    });

    return trace;
  }

  /**
   * MÉTODOS DE PERFORMANCE MONITORING
   */

  startPerformanceMonitoring(operationId: string): string {
    if (!this.config.enablePerformanceMetrics) {
      return operationId;
    }

    const metrics: PerformanceMetrics = {
      startTime: performance.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    this.performanceMap.set(operationId, metrics);
    return operationId;
  }

  endPerformanceMonitoring(operationId: string): PerformanceMetrics | null {
    if (!this.config.enablePerformanceMetrics) {
      return null;
    }

    const metrics = this.performanceMap.get(operationId);
    if (!metrics) {
      return null;
    }

    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage();

    // CALCULAR DIFERENCIAS
    metrics.memoryUsage = {
      rss: endMemory.rss - metrics.memoryUsage!.rss,
      heapTotal: endMemory.heapTotal - metrics.memoryUsage!.heapTotal,
      heapUsed: endMemory.heapUsed - metrics.memoryUsage!.heapUsed,
      external: endMemory.external - metrics.memoryUsage!.external,
      arrayBuffers: endMemory.arrayBuffers - metrics.memoryUsage!.arrayBuffers
    };

    this.performanceMap.delete(operationId);
    return metrics;
  }

  /**
   * MÉTODOS DE ANÁLISIS Y BÚSQUEDA
   */

  searchLogs(filters: {
    component?: HybridComponent;
    operation?: string;
    level?: LogLevel;
    traceId?: string;
    requestId?: string;
    tenantId?: string;
    templateId?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  }): HybridLogEntry[] {
    let results = [...this.logEntries];

    if (filters.component) {
      results = results.filter(entry => entry.context.component === filters.component);
    }

    if (filters.operation) {
      results = results.filter(entry => entry.context.operation.includes(filters.operation));
    }

    if (filters.level) {
      results = results.filter(entry => entry.level === filters.level);
    }

    if (filters.traceId) {
      results = results.filter(entry => entry.context.traceId === filters.traceId);
    }

    if (filters.requestId) {
      results = results.filter(entry => entry.context.requestId === filters.requestId);
    }

    if (filters.tenantId) {
      results = results.filter(entry => entry.context.tenantId === filters.tenantId);
    }

    if (filters.templateId) {
      results = results.filter(entry => entry.context.templateId === filters.templateId);
    }

    if (filters.timeRange) {
      results = results.filter(entry => {
        const entryTime = new Date(entry.context.timestamp);
        return entryTime >= filters.timeRange!.start && entryTime <= filters.timeRange!.end;
      });
    }

    // ORDENAR POR TIMESTAMP DESCENDENTE
    results.sort((a, b) => new Date(b.context.timestamp).getTime() - new Date(a.context.timestamp).getTime());

    // APLICAR LÍMITE
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  getComponentStats(component: HybridComponent): {
    totalLogs: number;
    levelCounts: Record<LogLevel, number>;
    errorRate: number;
    avgDuration: number;
    recentErrors: HybridLogEntry[];
  } {
    const componentLogs = this.logEntries.filter(entry => entry.context.component === component);
    
    const levelCounts: Record<LogLevel, number> = {
      debug: 0, info: 0, warn: 0, error: 0, trace: 0, performance: 0
    };

    let totalDuration = 0;
    let durationsCount = 0;

    componentLogs.forEach(entry => {
      levelCounts[entry.level]++;
      
      if (entry.performance?.duration) {
        totalDuration += entry.performance.duration;
        durationsCount++;
      }
    });

    const errorLogs = componentLogs.filter(entry => entry.level === 'error');
    const recentErrors = errorLogs
      .sort((a, b) => new Date(b.context.timestamp).getTime() - new Date(a.context.timestamp).getTime())
      .slice(0, 5);

    return {
      totalLogs: componentLogs.length,
      levelCounts,
      errorRate: componentLogs.length > 0 ? errorLogs.length / componentLogs.length : 0,
      avgDuration: durationsCount > 0 ? totalDuration / durationsCount : 0,
      recentErrors
    };
  }

  getActiveTraces(): DebugTrace[] {
    return Array.from(this.activeTraces.values());
  }

  exportLogs(
    format: 'json' | 'csv' | 'txt' = 'json',
    filters?: any
  ): string {
    const logs = filters ? this.searchLogs(filters) : this.logEntries;

    switch (format) {
      case 'json':
        return JSON.stringify(logs, null, 2);
      
      case 'csv':
        return this.logsToCSV(logs);
      
      case 'txt':
        return logs.map(entry => 
          `[${entry.context.timestamp}] ${entry.level.toUpperCase()} [${entry.context.component}] ${entry.context.operation}: ${entry.message}`
        ).join('\n');
      
      default:
        return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * MÉTODOS AUXILIARES
   */

  private shouldLog(level: LogLevel): boolean {
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'performance'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex >= configLevelIndex;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTags(component: HybridComponent, operation: string, level: LogLevel): string[] {
    return [
      `component:${component}`,
      `operation:${operation}`,
      `level:${level}`,
      'hybrid-system'
    ];
  }

  private passesFilters(logEntry: HybridLogEntry): boolean {
    if (this.config.filters.length === 0) {
      return true;
    }

    for (const filter of this.config.filters) {
      if (!filter.enabled) continue;

      const matches = this.filterMatches(filter, logEntry);
      
      if (filter.action === 'exclude' && matches) {
        return false;
      }
      
      if (filter.action === 'include' && !matches) {
        return false;
      }
    }

    return true;
  }

  private filterMatches(filter: LogFilter, logEntry: HybridLogEntry): boolean {
    if (filter.component && logEntry.context.component !== filter.component) {
      return false;
    }

    if (filter.level && logEntry.level !== filter.level) {
      return false;
    }

    if (filter.pattern && !logEntry.message.includes(filter.pattern)) {
      return false;
    }

    return true;
  }

  private storeLogEntry(logEntry: HybridLogEntry): void {
    this.logEntries.push(logEntry);

    // MANTENER LÍMITE DE ENTRADAS
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries.splice(0, this.logEntries.length - this.config.maxLogEntries);
    }
  }

  private outputToConsole(logEntry: HybridLogEntry): void {
    const timestamp = new Date(logEntry.context.timestamp).toISOString();
    const prefix = `[${timestamp}] [HYBRID] [${logEntry.context.component.toUpperCase()}]`;
    const message = `${prefix} ${logEntry.context.operation}: ${logEntry.message}`;

    switch (logEntry.level) {
      case 'error':
        logger.error(message, logEntry.data, logEntry.error);
        break;
      case 'warn':
        logger.warn(message, logEntry.data);
        break;
      case 'info':
        logger.info(message, logEntry.data);
        break;
      case 'debug':
      case 'trace':
        logger.debug(message, logEntry.data);
        break;
      case 'performance':
        logger.info(`${message} [Performance: ${logEntry.performance?.duration?.toFixed(2)}ms]`, logEntry.data);
        break;
    }
  }

  private outputToFile(logEntry: HybridLogEntry): void {
    // IMPLEMENTACIÓN FUTURA: Escribir a archivo
    // En implementación real se usaría winston, pino u otro logger con soporte de archivos
  }

  private exportExternal(logEntry: HybridLogEntry): void {
    // IMPLEMENTACIÓN FUTURA: Export a sistemas externos (ELK, Datadog, etc.)
    // En implementación real se enviaría a sistemas de monitoreo externos
  }

  private logsToCSV(logs: HybridLogEntry[]): string {
    const headers = ['timestamp', 'level', 'component', 'operation', 'message', 'requestId', 'traceId', 'tenantId', 'templateId'];
    const rows = logs.map(log => [
      log.context.timestamp,
      log.level,
      log.context.component,
      log.context.operation,
      log.message.replace(/,/g, ';'), // Escapar comas
      log.context.requestId,
      log.context.traceId,
      log.context.tenantId || '',
      log.context.templateId || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private startLogRotation(): void {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - (this.config.rotationInterval * 60 * 1000));
      const initialCount = this.logEntries.length;
      
      this.logEntries = this.logEntries.filter(entry => 
        new Date(entry.context.timestamp) > cutoffTime
      );

      const removedCount = initialCount - this.logEntries.length;
      if (removedCount > 0) {
        this.debug('general', 'log_rotation', `Rotación de logs: ${removedCount} entradas eliminadas`, {}, {
          before: initialCount,
          after: this.logEntries.length,
          cutoffTime: cutoffTime.toISOString()
        });
      }
    }, this.config.rotationInterval * 60 * 1000);
  }

  /**
   * MÉTODOS PÚBLICOS DE CONFIGURACIÓN
   */

  updateConfiguration(newConfig: Partial<LoggingConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[HybridLogger] Configuración actualizada', this.config);
  }

  getConfiguration(): LoggingConfiguration {
    return { ...this.config };
  }

  enableComponent(component: HybridComponent): void {
    this.config.components[component] = true;
    this.info('general', 'config_change', `Logging habilitado para componente: ${component}`);
  }

  disableComponent(component: HybridComponent): void {
    this.config.components[component] = false;
    this.info('general', 'config_change', `Logging deshabilitado para componente: ${component}`);
  }

  addFilter(filter: LogFilter): void {
    this.config.filters.push(filter);
    this.info('general', 'config_change', `Filtro agregado: ${filter.id}`);
  }

  removeFilter(filterId: string): void {
    this.config.filters = this.config.filters.filter(f => f.id !== filterId);
    this.info('general', 'config_change', `Filtro removido: ${filterId}`);
  }

  clearLogs(): void {
    const count = this.logEntries.length;
    this.logEntries = [];
    logger.info(`[HybridLogger] ${count} entradas de log eliminadas`);
  }

  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    entriesByComponent: Record<HybridComponent, number>;
    activeTraces: number;
    memoryUsage: string;
  } {
    const entriesByLevel: Record<LogLevel, number> = {
      debug: 0, info: 0, warn: 0, error: 0, trace: 0, performance: 0
    };

    const entriesByComponent: Record<HybridComponent, number> = {
      templateDetector: 0, systemRouter: 0, fallbackManager: 0,
      hybridTemplateManager: 0, metricsCollector: 0, enhancedDataCapture: 0,
      improvedSessionManager: 0, dynamicNavigation: 0, nodeProcessingQueue: 0,
      hybridFlowRegistry: 0, templateConverter: 0, flowRegistry: 0,
      middleware: 0, api: 0, general: 0
    };

    this.logEntries.forEach(entry => {
      entriesByLevel[entry.level]++;
      entriesByComponent[entry.context.component]++;
    });

    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    return {
      totalEntries: this.logEntries.length,
      entriesByLevel,
      entriesByComponent,
      activeTraces: this.activeTraces.size,
      memoryUsage: `${memoryMB} MB`
    };
  }

  /**
   * MÉTODO: Destruir logger
   */
  destroy(): void {
    this.logEntries = [];
    this.activeTraces.clear();
    this.performanceMap.clear();
    this.config.enabled = false;
    logger.info('[HybridLogger] Logger híbrido destruido');
  }
}

// EXPORTAR INSTANCIA SINGLETON Y CREAR FUNCIONES DE CONVENIENCIA
const hybridLogger = HybridLogger.getInstance();

// FUNCIONES DE CONVENIENCIA PARA USO DIRECTO
export const logDebug = (component: HybridComponent, operation: string, message: string, context?: any, data?: any) => 
  hybridLogger.debug(component, operation, message, context, data);

export const logInfo = (component: HybridComponent, operation: string, message: string, context?: any, data?: any) => 
  hybridLogger.info(component, operation, message, context, data);

export const logWarn = (component: HybridComponent, operation: string, message: string, context?: any, data?: any) => 
  hybridLogger.warn(component, operation, message, context, data);

export const logError = (component: HybridComponent, operation: string, message: string, error: any, context?: any, data?: any) => 
  hybridLogger.error(component, operation, message, error, context, data);

export const logPerformance = (component: HybridComponent, operation: string, message: string, metrics: PerformanceMetrics, context?: any) => 
  hybridLogger.performance(component, operation, message, metrics, context);

export const logTrace = (component: HybridComponent, operation: string, message: string, context?: any, data?: any) => 
  hybridLogger.trace(component, operation, message, context, data);

// FUNCIONES DE TRACING
export const startTrace = (traceId: string, metadata?: any) => hybridLogger.startTrace(traceId, metadata);
export const addTraceOperation = (traceId: string, component: HybridComponent, operation: string, status: any, input?: any, output?: any, error?: any) => 
  hybridLogger.addTraceOperation(traceId, component, operation, status, input, output, error);
export const endTrace = (traceId: string, result: any, metadata?: any) => hybridLogger.endTrace(traceId, result, metadata);

// FUNCIONES DE PERFORMANCE
export const startPerformanceMonitoring = (operationId: string) => hybridLogger.startPerformanceMonitoring(operationId);
export const endPerformanceMonitoring = (operationId: string) => hybridLogger.endPerformanceMonitoring(operationId);

export default hybridLogger;
export { HybridLogger };
export type {
  HybridLogContext,
  HybridLogEntry,
  PerformanceMetrics,
  DebugTrace,
  LoggingConfiguration,
  HybridComponent,
  LogLevel
};