/**
 * TESTS DE CARGA PARA COMPARACIÓN DE RENDIMIENTO
 * 
 * PROPÓSITO: Validar que sistema híbrido tenga rendimiento igual o mejor que sistema actual
 * CRÍTICO: Evidencia cuantitativa de que híbrido NO degrada performance
 * METODOLOGÍA: A/B testing bajo diferentes cargas de trabajo simultáneas
 * MÉTRICAS: Tiempo respuesta, throughput, uso memoria, tasa de captura, tasa de error
 * 
 * ESCENARIOS DE CARGA:
 * - Carga ligera: 10 usuarios simultáneos por 1 minuto
 * - Carga media: 50 usuarios simultáneos por 3 minutos  
 * - Carga alta: 100 usuarios simultáneos por 5 minutos
 * - Carga pico: 200 usuarios simultáneos por 2 minutos
 * - Carga sostenida: 30 usuarios por 10 minutos
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { performance } from 'perf_hooks';

// IMPORTS DEL SISTEMA ACTUAL
import { processFlowMessage } from '../../services/flowRegistry';
import { convertTemplateToBuilderbotFlow } from '../../services/templateConverter';

// IMPORTS DEL SISTEMA HÍBRIDO
import HybridFlowRegistry from '../../services/hybridFlowRegistry';
import hybridDetectionMiddleware from '../../middleware/hybridDetectionMiddleware';
import HybridMetricsCollectorService from '../../utils/hybridMetricsCollector';

// UTILIDADES PARA TESTING DE CARGA
interface LoadTestConfig {
  concurrentUsers: number;
  durationMinutes: number;
  messagesPerUser: number;
  targetSystem: 'current' | 'hybrid' | 'both';
  scenario: string;
}

interface LoadTestResult {
  scenario: string;
  system: 'current' | 'hybrid';
  config: LoadTestConfig;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    throughputPerSecond: number;
    errorRate: number;
    captureSuccessRate: number;
    memoryUsage: {
      initial: NodeJS.MemoryUsage;
      peak: NodeJS.MemoryUsage;
      final: NodeJS.MemoryUsage;
    };
    cpuUsage: {
      initial: NodeJS.CpuUsage;
      final: NodeJS.CpuUsage;
    };
  };
  timestamps: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  errors: any[];
}

interface UserSimulation {
  userId: string;
  tenantId: string;
  sessionId: string;
  messageCount: number;
  responses: any[];
  errors: any[];
  responseTimes: number[];
}

// MOCKS
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../services/supabase', () => ({
  getTemplateById: jest.fn().mockResolvedValue({
    id: 'load-test-template',
    template_data: JSON.stringify({
      nodes: [
        { id: 'start', type: 'messageNode', data: { message: 'Hola' } },
        { id: 'input1', type: 'inputNode', data: { message: '¿Cuál es tu nombre?', capture: true } },
        { id: 'input2', type: 'inputNode', data: { message: '¿Cuál es tu email?', capture: true } },
        { id: 'end', type: 'messageNode', data: { message: 'Gracias' } }
      ]
    })
  }),
  saveConversationState: jest.fn(),
  getConversationState: jest.fn()
}));

describe('Tests de Carga - Comparación de Rendimiento', () => {
  let hybridFlowRegistry: HybridFlowRegistry;
  let metricsCollector: HybridMetricsCollectorService;
  
  // CONFIGURACIONES DE CARGA
  const loadTestConfigs: LoadTestConfig[] = [
    {
      concurrentUsers: 10,
      durationMinutes: 1,
      messagesPerUser: 5,
      targetSystem: 'both',
      scenario: 'Carga Ligera'
    },
    {
      concurrentUsers: 50,
      durationMinutes: 3,
      messagesPerUser: 10,
      targetSystem: 'both',
      scenario: 'Carga Media'
    },
    {
      concurrentUsers: 100,
      durationMinutes: 5,
      messagesPerUser: 15,
      targetSystem: 'both',
      scenario: 'Carga Alta'
    },
    {
      concurrentUsers: 200,
      durationMinutes: 2,
      messagesPerUser: 8,
      targetSystem: 'both',
      scenario: 'Carga Pico'
    },
    {
      concurrentUsers: 30,
      durationMinutes: 10,
      messagesPerUser: 25,
      targetSystem: 'both',
      scenario: 'Carga Sostenida'
    }
  ];

  // MENSAJES DE PRUEBA REALISTAS
  const testMessages = [
    'hola',
    'quiero información',
    'mi nombre es Juan Pérez',
    'juan.perez@email.com',
    'estoy interesado en sus productos',
    'necesito una cotización',
    'cuando pueden contactarme',
    'mi presupuesto es de 10000',
    'sí, acepto los términos',
    'gracias por la información'
  ];

  beforeAll(async () => {
    // INICIALIZAR SERVICIOS
    hybridFlowRegistry = HybridFlowRegistry.getInstance();
    metricsCollector = HybridMetricsCollectorService.getInstance();

    // CONFIGURAR MIDDLEWARE HÍBRIDO
    hybridDetectionMiddleware.enableMiddleware({
      autoDetectionEnabled: true,
      fallbackEnabled: true,
      metricsEnabled: true,
      debugMode: false // Desactivar debug para no impactar rendimiento
    });

    console.log('🚀 Tests de carga inicializados');
  });

  afterAll(async () => {
    // LIMPIAR SERVICIOS
    hybridDetectionMiddleware.disableMiddleware();
    metricsCollector.clearMetrics();
    
    console.log('🧹 Limpieza de tests de carga completada');
  });

  beforeEach(() => {
    // LIMPIAR MÉTRICAS ENTRE TESTS
    metricsCollector.clearMetrics();
  });

  describe('1. Tests de Carga Comparativa', () => {
    test.each(loadTestConfigs)('$scenario: $concurrentUsers usuarios por $durationMinutes minutos', async (config) => {
      console.log(`\n🏁 Iniciando ${config.scenario}: ${config.concurrentUsers} usuarios concurrentes`);

      const results: LoadTestResult[] = [];

      // TEST CON SISTEMA ACTUAL
      if (config.targetSystem === 'current' || config.targetSystem === 'both') {
        console.log(`📊 Ejecutando ${config.scenario} con Sistema Actual...`);
        const currentResult = await executeLoadTest(config, 'current');
        results.push(currentResult);
      }

      // TEST CON SISTEMA HÍBRIDO
      if (config.targetSystem === 'hybrid' || config.targetSystem === 'both') {
        console.log(`📊 Ejecutando ${config.scenario} con Sistema Híbrido...`);
        const hybridResult = await executeLoadTest(config, 'hybrid');
        results.push(hybridResult);
      }

      // ANÁLISIS COMPARATIVO
      if (results.length === 2) {
        const comparison = compareLoadTestResults(results[0], results[1]);
        console.log(`\n📈 Análisis ${config.scenario}:`);
        console.log(comparison);
        
        // VERIFICACIONES DE RENDIMIENTO
        expect(comparison.hybridFaster).toBeDefined();
        expect(comparison.performanceImprovement).toBeDefined();
        
        // EL SISTEMA HÍBRIDO NO DEBE SER SIGNIFICATIVAMENTE MÁS LENTO (>20%)
        expect(comparison.performanceImprovement).toBeGreaterThan(-20);
      }

      // VERIFICAR QUE NO HAY DEGRADACIÓN SEVERA
      results.forEach(result => {
        expect(result.metrics.errorRate).toBeLessThan(0.05); // <5% de errores
        expect(result.metrics.averageResponseTime).toBeLessThan(5000); // <5 segundos promedio
        expect(result.metrics.successfulRequests).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Tests de Estrés y Límites', () => {
    test('debe manejar picos súbitos de carga sin colapsar', async () => {
      const stressConfig: LoadTestConfig = {
        concurrentUsers: 300,
        durationMinutes: 1,
        messagesPerUser: 3,
        targetSystem: 'both',
        scenario: 'Estrés Súbito'
      };

      console.log('⚡ Test de estrés: 300 usuarios súbitos');

      // EJECUTAR TEST DE ESTRÉS
      const currentResult = await executeLoadTest(stressConfig, 'current');
      const hybridResult = await executeLoadTest(stressConfig, 'hybrid');

      // VERIFICAR QUE AMBOS SISTEMAS SOBREVIVEN AL ESTRÉS
      expect(currentResult.metrics.errorRate).toBeLessThan(0.10); // <10% errores bajo estrés
      expect(hybridResult.metrics.errorRate).toBeLessThan(0.10);
      
      expect(currentResult.metrics.successfulRequests).toBeGreaterThan(stressConfig.concurrentUsers);
      expect(hybridResult.metrics.successfulRequests).toBeGreaterThan(stressConfig.concurrentUsers);

      console.log(`✅ Ambos sistemas sobrevivieron al test de estrés`);
    });

    test('debe mantener rendimiento durante carga prolongada', async () => {
      const enduranceConfig: LoadTestConfig = {
        concurrentUsers: 25,
        durationMinutes: 15,
        messagesPerUser: 30,
        targetSystem: 'both',
        scenario: 'Resistencia Prolongada'
      };

      console.log('🏃‍♂️ Test de resistencia: 25 usuarios por 15 minutos');

      const currentResult = await executeLoadTest(enduranceConfig, 'current');
      const hybridResult = await executeLoadTest(enduranceConfig, 'hybrid');

      // VERIFICAR ESTABILIDAD A LARGO PLAZO
      expect(currentResult.metrics.errorRate).toBeLessThan(0.03); // <3% errores en carga prolongada
      expect(hybridResult.metrics.errorRate).toBeLessThan(0.03);

      // VERIFICAR QUE NO HAY MEMORY LEAKS SIGNIFICATIVOS
      const currentMemoryGrowth = currentResult.metrics.memoryUsage.final.heapUsed - currentResult.metrics.memoryUsage.initial.heapUsed;
      const hybridMemoryGrowth = hybridResult.metrics.memoryUsage.final.heapUsed - hybridResult.metrics.memoryUsage.initial.heapUsed;

      expect(currentMemoryGrowth).toBeLessThan(100 * 1024 * 1024); // <100MB growth
      expect(hybridMemoryGrowth).toBeLessThan(100 * 1024 * 1024);

      console.log(`✅ Ambos sistemas mantuvieron estabilidad durante 15 minutos`);
    });
  });

  describe('3. Tests de Rendimiento Específicos', () => {
    test('debe comparar tiempo de respuesta bajo diferentes cargas', async () => {
      const responseTimeTests = [
        { users: 1, expected: '<100ms' },
        { users: 10, expected: '<200ms' },
        { users: 50, expected: '<500ms' },
        { users: 100, expected: '<1000ms' }
      ];

      for (const test of responseTimeTests) {
        console.log(`⏱️ Test de tiempo de respuesta: ${test.users} usuarios`);

        const config: LoadTestConfig = {
          concurrentUsers: test.users,
          durationMinutes: 1,
          messagesPerUser: 3,
          targetSystem: 'both',
          scenario: `Tiempo Respuesta ${test.users} usuarios`
        };

        const currentResult = await executeLoadTest(config, 'current');
        const hybridResult = await executeLoadTest(config, 'hybrid');

        console.log(`Sistema Actual: ${currentResult.metrics.averageResponseTime.toFixed(2)}ms promedio`);
        console.log(`Sistema Híbrido: ${hybridResult.metrics.averageResponseTime.toFixed(2)}ms promedio`);

        // VERIFICAR TIEMPOS RAZONABLES
        expect(currentResult.metrics.averageResponseTime).toBeLessThan(2000);
        expect(hybridResult.metrics.averageResponseTime).toBeLessThan(2000);
      }
    });

    test('debe medir throughput (requests por segundo)', async () => {
      const throughputConfig: LoadTestConfig = {
        concurrentUsers: 50,
        durationMinutes: 2,
        messagesPerUser: 10,
        targetSystem: 'both',
        scenario: 'Medición Throughput'
      };

      const currentResult = await executeLoadTest(throughputConfig, 'current');
      const hybridResult = await executeLoadTest(throughputConfig, 'hybrid');

      console.log(`📈 Throughput Sistema Actual: ${currentResult.metrics.throughputPerSecond.toFixed(2)} req/seg`);
      console.log(`📈 Throughput Sistema Híbrido: ${hybridResult.metrics.throughputPerSecond.toFixed(2)} req/seg`);

      // VERIFICAR THROUGHPUT MÍNIMO
      expect(currentResult.metrics.throughputPerSecond).toBeGreaterThan(1);
      expect(hybridResult.metrics.throughputPerSecond).toBeGreaterThan(1);

      // EL THROUGHPUT HÍBRIDO NO DEBE SER SIGNIFICATIVAMENTE MENOR
      const throughputRatio = hybridResult.metrics.throughputPerSecond / currentResult.metrics.throughputPerSecond;
      expect(throughputRatio).toBeGreaterThan(0.8); // Al menos 80% del throughput actual
    });
  });

  describe('4. Tests de Memoria y Recursos', () => {
    test('debe monitorear uso de memoria durante carga', async () => {
      const memoryConfig: LoadTestConfig = {
        concurrentUsers: 75,
        durationMinutes: 5,
        messagesPerUser: 12,
        targetSystem: 'both',
        scenario: 'Monitoreo Memoria'
      };

      const currentResult = await executeLoadTest(memoryConfig, 'current');
      const hybridResult = await executeLoadTest(memoryConfig, 'hybrid');

      // ANÁLISIS DE MEMORIA
      const currentMemoryDelta = currentResult.metrics.memoryUsage.peak.heapUsed - currentResult.metrics.memoryUsage.initial.heapUsed;
      const hybridMemoryDelta = hybridResult.metrics.memoryUsage.peak.heapUsed - hybridResult.metrics.memoryUsage.initial.heapUsed;

      console.log(`💾 Uso de memoria Sistema Actual: ${(currentMemoryDelta / 1024 / 1024).toFixed(2)}MB`);
      console.log(`💾 Uso de memoria Sistema Híbrido: ${(hybridMemoryDelta / 1024 / 1024).toFixed(2)}MB`);

      // VERIFICAR QUE NO HAY MEMORY LEAKS EXCESIVOS
      expect(currentMemoryDelta).toBeLessThan(200 * 1024 * 1024); // <200MB
      expect(hybridMemoryDelta).toBeLessThan(250 * 1024 * 1024); // <250MB (permisivo para híbrido)

      // VERIFICAR LIBERACIÓN DE MEMORIA POST-TEST
      const currentFinalMemory = currentResult.metrics.memoryUsage.final.heapUsed;
      const hybridFinalMemory = hybridResult.metrics.memoryUsage.final.heapUsed;

      expect(currentFinalMemory).toBeLessThan(currentResult.metrics.memoryUsage.peak.heapUsed);
      expect(hybridFinalMemory).toBeLessThan(hybridResult.metrics.memoryUsage.peak.heapUsed);
    });
  });

  // FUNCIONES AUXILIARES

  async function executeLoadTest(config: LoadTestConfig, system: 'current' | 'hybrid'): Promise<LoadTestResult> {
    const startTime = performance.now();
    const initialMemory = process.memoryUsage();
    const initialCpu = process.cpuUsage();
    
    const result: LoadTestResult = {
      scenario: config.scenario,
      system,
      config,
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughputPerSecond: 0,
        errorRate: 0,
        captureSuccessRate: 0,
        memoryUsage: {
          initial: initialMemory,
          peak: initialMemory,
          final: initialMemory
        },
        cpuUsage: {
          initial: initialCpu,
          final: process.cpuUsage()
        }
      },
      timestamps: {
        startTime,
        endTime: 0,
        duration: 0
      },
      errors: []
    };

    const users: UserSimulation[] = [];
    const allPromises: Promise<void>[] = [];

    // CREAR USUARIOS SIMULADOS
    for (let i = 0; i < config.concurrentUsers; i++) {
      const user: UserSimulation = {
        userId: `+${1000000000 + i}`,
        tenantId: `tenant-load-test-${i % 10}`,
        sessionId: `session-${Date.now()}-${i}`,
        messageCount: 0,
        responses: [],
        errors: [],
        responseTimes: []
      };
      users.push(user);

      // EJECUTAR SIMULACIÓN DE USUARIO
      const userPromise = simulateUser(user, config, system, result);
      allPromises.push(userPromise);
    }

    // MONITOREO DE MEMORIA DURANTE EJECUCIÓN
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > result.metrics.memoryUsage.peak.heapUsed) {
        result.metrics.memoryUsage.peak = currentMemory;
      }
    }, 1000);

    // ESPERAR TODAS LAS SIMULACIONES
    await Promise.all(allPromises);

    // LIMPIAR MONITOREO
    clearInterval(memoryMonitor);

    // CALCULAR MÉTRICAS FINALES
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    const finalCpu = process.cpuUsage(initialCpu);

    const allResponseTimes = users.flatMap(user => user.responseTimes);
    allResponseTimes.sort((a, b) => a - b);

    result.timestamps.endTime = endTime;
    result.timestamps.duration = endTime - startTime;
    result.metrics.memoryUsage.final = finalMemory;
    result.metrics.cpuUsage.final = finalCpu;

    if (allResponseTimes.length > 0) {
      result.metrics.averageResponseTime = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
      result.metrics.minResponseTime = allResponseTimes[0];
      result.metrics.maxResponseTime = allResponseTimes[allResponseTimes.length - 1];
      result.metrics.p95ResponseTime = allResponseTimes[Math.floor(allResponseTimes.length * 0.95)];
      result.metrics.p99ResponseTime = allResponseTimes[Math.floor(allResponseTimes.length * 0.99)];
    }

    result.metrics.totalRequests = users.reduce((sum, user) => sum + user.messageCount, 0);
    result.metrics.successfulRequests = users.reduce((sum, user) => sum + user.responses.length, 0);
    result.metrics.failedRequests = users.reduce((sum, user) => sum + user.errors.length, 0);
    result.metrics.errorRate = result.metrics.totalRequests > 0 ? result.metrics.failedRequests / result.metrics.totalRequests : 0;
    result.metrics.throughputPerSecond = result.metrics.totalRequests / (result.timestamps.duration / 1000);
    result.metrics.captureSuccessRate = result.metrics.successfulRequests / Math.max(result.metrics.totalRequests, 1);

    return result;
  }

  async function simulateUser(user: UserSimulation, config: LoadTestConfig, system: 'current' | 'hybrid', result: LoadTestResult): Promise<void> {
    const endTime = Date.now() + (config.durationMinutes * 60 * 1000);
    const messageInterval = (config.durationMinutes * 60 * 1000) / config.messagesPerUser;

    while (Date.now() < endTime && user.messageCount < config.messagesPerUser) {
      try {
        const message = testMessages[user.messageCount % testMessages.length];
        const requestStart = performance.now();

        let response;
        if (system === 'current') {
          response = await processFlowMessage(
            user.userId,
            message,
            user.tenantId,
            user.sessionId,
            'load-test-template'
          );
        } else {
          response = await hybridFlowRegistry.processHybridFlowMessage(
            user.userId,
            message,
            user.tenantId,
            user.sessionId,
            'load-test-template'
          );
        }

        const requestEnd = performance.now();
        const responseTime = requestEnd - requestStart;

        user.responses.push(response);
        user.responseTimes.push(responseTime);
        user.messageCount++;

        // PEQUEÑA PAUSA ENTRE MENSAJES
        await new Promise(resolve => setTimeout(resolve, Math.random() * messageInterval));

      } catch (error) {
        user.errors.push(error);
        result.errors.push({ userId: user.userId, error: error?.message || 'Unknown error' });
        user.messageCount++;
      }
    }
  }

  function compareLoadTestResults(currentResult: LoadTestResult, hybridResult: LoadTestResult) {
    const responseTimeDiff = hybridResult.metrics.averageResponseTime - currentResult.metrics.averageResponseTime;
    const throughputDiff = hybridResult.metrics.throughputPerSecond - currentResult.metrics.throughputPerSecond;
    const errorRateDiff = hybridResult.metrics.errorRate - currentResult.metrics.errorRate;
    
    const performanceImprovement = ((currentResult.metrics.averageResponseTime - hybridResult.metrics.averageResponseTime) / currentResult.metrics.averageResponseTime) * 100;

    return {
      scenario: currentResult.scenario,
      hybridFaster: responseTimeDiff < 0,
      performanceImprovement: performanceImprovement,
      responseTimeDifference: responseTimeDiff,
      throughputImprovement: throughputDiff,
      errorRateChange: errorRateDiff,
      summary: {
        current: {
          avgResponseTime: `${currentResult.metrics.averageResponseTime.toFixed(2)}ms`,
          throughput: `${currentResult.metrics.throughputPerSecond.toFixed(2)} req/s`,
          errorRate: `${(currentResult.metrics.errorRate * 100).toFixed(2)}%`,
          memoryUsage: `${(currentResult.metrics.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`
        },
        hybrid: {
          avgResponseTime: `${hybridResult.metrics.averageResponseTime.toFixed(2)}ms`,
          throughput: `${hybridResult.metrics.throughputPerSecond.toFixed(2)} req/s`,
          errorRate: `${(hybridResult.metrics.errorRate * 100).toFixed(2)}%`,
          memoryUsage: `${(hybridResult.metrics.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)}MB`
        }
      }
    };
  }
});

export default {};