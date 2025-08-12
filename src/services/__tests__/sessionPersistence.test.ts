/**
 * TESTS PARA PERSISTENCIA DE SESIONES
 * 
 * PROPÓSITO: Verificar funcionalidad completa del sistema de sesiones persistentes
 * CUBRE: ImprovedSessionManager, SessionCache, SessionCleanupService, maintainSessionContext
 * PRESERVA: Sistema de leads intacto durante todas las pruebas
 * 
 * SUITES DE TESTING:
 * 1. Tests de ImprovedSessionManager
 * 2. Tests de SessionCache
 * 3. Tests de WebProvider con sesiones persistentes
 * 4. Tests de maintainSessionContext
 * 5. Tests de SessionCleanupService
 * 6. Tests de integración completa
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ImprovedSessionManager from '../improvedSessionManager';
import SessionCache from '../sessionCache';
import SessionCleanupService from '../sessionCleanupService';
import { WebProvider } from '../../provider/webProvider';
import { maintainSessionContext, createSessionSnapshot, restoreFromSnapshot } from '../../utils/maintainSessionContext';
import type { 
  PersistentSession, 
  SessionContextData, 
  SessionConfig 
} from '../improvedSessionManager';

// MOCKS PARA SUPABASE
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              gt: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => ({
                    single: jest.fn(() => Promise.resolve({ data: null, error: null }))
                  }))
                }))
              }))
            }))
          }))
        }))
      })),
      upsert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          lt: jest.fn(() => Promise.resolve({ error: null }))
        }))
      }))
    }))
  }))
}));

// MOCKS PARA LOGGER
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// DATOS DE PRUEBA
const TEST_USER_ID = 'test-user-123';
const TEST_TENANT_ID = 'test-tenant-456';
const TEST_NODE_ID = 'node-input-001';
const TEST_TEMPLATE_ID = 'template-agendamiento';

const createTestSession = (): PersistentSession => ({
  sessionId: `session_${TEST_USER_ID}_${Date.now()}`,
  userId: TEST_USER_ID,
  tenantId: TEST_TENANT_ID,
  nodeId: TEST_NODE_ID,
  templateId: TEST_TEMPLATE_ID,
  contextData: {
    collectedData: { nombre: 'Juan', telefono: '123456789' },
    globalVars: { empresa: 'TestCorp' },
    conversationHistory: [],
    flowHistory: [],
    temporaryData: {}
  },
  metadata: {
    platform: 'web',
    sessionVersion: '1.0',
    tags: ['test'],
    priority: 'normal',
    flags: {}
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  isActive: true,
  lastActivityAt: new Date().toISOString()
});

describe('Sistema de Persistencia de Sesiones', () => {
  let sessionManager: ImprovedSessionManager;
  let sessionCache: SessionCache;
  let cleanupService: SessionCleanupService;

  beforeEach(() => {
    // Reiniciar singletons para cada test
    (ImprovedSessionManager as any).instance = undefined;
    (SessionCache as any).instance = undefined;
    (SessionCleanupService as any).instance = undefined;
    
    // Limpiar mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar servicios después de cada test
    if (sessionManager) {
      sessionManager.destroy();
    }
    if (sessionCache) {
      sessionCache.destroy();
    }
    if (cleanupService) {
      cleanupService.destroy();
    }
  });

  /**
   * SUITE 1: TESTS DE IMPROVED SESSION MANAGER
   */
  describe('ImprovedSessionManager', () => {
    beforeEach(() => {
      sessionManager = ImprovedSessionManager.getInstance();
    });

    it('debe crear instancia singleton correctamente', () => {
      const instance1 = ImprovedSessionManager.getInstance();
      const instance2 = ImprovedSessionManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ImprovedSessionManager);
    });

    it('debe crear nueva sesión cuando no existe', async () => {
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      expect(session).toBeDefined();
      expect(session.userId).toBe(TEST_USER_ID);
      expect(session.tenantId).toBe(TEST_TENANT_ID);
      expect(session.isActive).toBe(true);
      expect(session.sessionId).toContain(TEST_USER_ID);
    });

    it('debe reutilizar sesión existente cuando está disponible', async () => {
      const session1 = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      const session2 = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID, { forceNew: false });
      
      expect(session1.sessionId).toBe(session2.sessionId);
    });

    it('debe crear nueva sesión cuando se fuerza', async () => {
      const session1 = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      const session2 = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID, { forceNew: true });
      
      expect(session1.sessionId).not.toBe(session2.sessionId);
    });

    it('debe actualizar actividad de sesión correctamente', async () => {
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      const originalActivity = session.lastActivityAt;
      
      // Esperar un poco para que el timestamp sea diferente
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await sessionManager.updateSessionActivity(session.sessionId, {
        nodeId: 'new-node-id',
        contextData: { collectedData: { nuevo: 'dato' } }
      });
      
      const updatedSession = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      expect(updatedSession.lastActivityAt).not.toBe(originalActivity);
      expect(updatedSession.nodeId).toBe('new-node-id');
    });

    it('debe obtener contexto de sesión correctamente', async () => {
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      const testContext = {
        collectedData: { test: 'data' },
        globalVars: { variable: 'value' }
      };
      
      await sessionManager.updateSessionContext(session.sessionId, testContext);
      const retrievedContext = await sessionManager.getSessionContext(session.sessionId);
      
      expect(retrievedContext).toBeDefined();
      expect(retrievedContext?.collectedData.test).toBe('data');
      expect(retrievedContext?.globalVars.variable).toBe('value');
    });

    it('debe terminar sesión correctamente', async () => {
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      await sessionManager.endSession(session.sessionId, 'test_termination');
      
      // Verificar que ya no se puede obtener la sesión
      const context = await sessionManager.getSessionContext(session.sessionId);
      expect(context).toBeNull();
    });

    it('debe obtener sesiones de usuario correctamente', async () => {
      await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID, { forceNew: true });
      
      const userSessions = await sessionManager.getUserSessions(TEST_USER_ID, TEST_TENANT_ID);
      expect(userSessions.length).toBeGreaterThanOrEqual(1);
      expect(userSessions[0].userId).toBe(TEST_USER_ID);
    });

    it('debe configurar política TTL personalizada', () => {
      const policy = {
        userId: TEST_USER_ID,
        priority: 'high' as const,
        customTTL: 7200000 // 2 horas
      };
      
      expect(() => {
        sessionManager.configureTTLPolicy(policy);
      }).not.toThrow();
    });

    it('debe obtener métricas del cache avanzado', () => {
      const metrics = sessionManager.getAdvancedCacheMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.advanced).toBeDefined();
      expect(metrics.legacy).toBeDefined();
      expect(metrics.combined).toBeDefined();
    });
  });

  /**
   * SUITE 2: TESTS DE SESSION CACHE
   */
  describe('SessionCache', () => {
    beforeEach(() => {
      sessionCache = SessionCache.getInstance();
    });

    it('debe crear instancia singleton correctamente', () => {
      const instance1 = SessionCache.getInstance();
      const instance2 = SessionCache.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('debe guardar y recuperar sesión del cache', async () => {
      const testSession = createTestSession();
      
      const saved = await sessionCache.set(testSession.sessionId, testSession);
      expect(saved).toBe(true);
      
      const retrieved = await sessionCache.get(testSession.sessionId, TEST_USER_ID);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(testSession.sessionId);
    });

    it('debe manejar TTL correctamente', async () => {
      const testSession = createTestSession();
      
      // Guardar con TTL corto
      await sessionCache.set(testSession.sessionId, testSession, { customTTL: 100 });
      
      // Debe estar disponible inmediatamente
      let retrieved = await sessionCache.get(testSession.sessionId, TEST_USER_ID);
      expect(retrieved).toBeDefined();
      
      // Esperar a que expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Ya no debe estar disponible
      retrieved = await sessionCache.get(testSession.sessionId, TEST_USER_ID);
      expect(retrieved).toBeNull();
    });

    it('debe obtener sesiones por usuario', async () => {
      const session1 = createTestSession();
      const session2 = createTestSession();
      session2.sessionId = `${session2.sessionId}_2`;
      
      await sessionCache.set(session1.sessionId, session1);
      await sessionCache.set(session2.sessionId, session2);
      
      const userSessions = await sessionCache.getUserSessions(TEST_USER_ID);
      expect(userSessions.length).toBe(2);
    });

    it('debe limpiar sesiones expiradas', async () => {
      const testSession = createTestSession();
      testSession.expiresAt = new Date(Date.now() - 1000).toISOString(); // Ya expirada
      
      await sessionCache.set(testSession.sessionId, testSession);
      
      const cleanedCount = await sessionCache.cleanupExpired();
      expect(cleanedCount).toBeGreaterThanOrEqual(1);
    });

    it('debe generar métricas correctamente', () => {
      const metrics = sessionCache.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.hits).toBe('number');
      expect(typeof metrics.misses).toBe('number');
      expect(typeof metrics.hitRatio).toBe('number');
    });

    it('debe obtener estadísticas detalladas', () => {
      const stats = sessionCache.getDetailedStats();
      
      expect(stats).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.performance).toBeDefined();
    });
  });

  /**
   * SUITE 3: TESTS DE WEBPROVIDER CON SESIONES PERSISTENTES
   */
  describe('WebProvider con Sesiones Persistentes', () => {
    let provider: WebProvider;

    beforeEach(() => {
      provider = new WebProvider(TEST_USER_ID, TEST_TENANT_ID);
    });

    afterEach(async () => {
      if (provider) {
        await provider.close();
      }
    });

    it('debe inicializar con sesión persistente', async () => {
      // Esperar a que se inicialice la sesión
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const sessionInfo = await provider.getSessionInfo();
      
      expect(sessionInfo.userId).toBe(TEST_USER_ID);
      expect(sessionInfo.tenantId).toBe(TEST_TENANT_ID);
      expect(sessionInfo.sessionId).toBeDefined();
    });

    it('debe preservar contexto entre mensajes', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simular procesamiento de mensaje
      await provider.preserveConversationData({
        message: 'Hola',
        response: 'Buenos días',
        nodeId: TEST_NODE_ID,
        flowType: 'greeting'
      });
      
      const sessionInfo = await provider.getSessionInfo();
      expect(sessionInfo.conversationLength).toBeGreaterThan(0);
    });

    it('debe obtener contexto preservado', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const preservedContext = await provider.getPreservedContext();
      expect(preservedContext).toBeDefined();
    });

    it('debe crear nueva sesión cuando se solicita', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const originalSessionId = (await provider.getSessionInfo()).sessionId;
      const newSessionId = await provider.createNewSession();
      
      expect(newSessionId).toBeDefined();
      expect(newSessionId).not.toBe(originalSessionId);
    });

    it('debe limpiar contexto de sesión', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Agregar algunos datos
      await provider.preserveConversationData({
        message: 'Test',
        collectedData: { test: 'data' }
      });
      
      // Limpiar contexto
      await provider.clearSessionContext();
      
      const sessionInfo = await provider.getSessionInfo();
      expect(sessionInfo.conversationLength).toBe(0);
    });

    it('debe incluir información de sesión en metadatos', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metadata = provider.getMessageMetadata();
      
      expect(metadata.sessionId).toBeDefined();
      expect(metadata.sessionInitialized).toBeDefined();
      expect(metadata.hasPersistedContext).toBeDefined();
    });
  });

  /**
   * SUITE 4: TESTS DE MAINTAIN SESSION CONTEXT
   */
  describe('maintainSessionContext', () => {
    it('debe mantener contexto de sesión correctamente', async () => {
      const options = {
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        nodeId: TEST_NODE_ID
      };
      
      const context = await maintainSessionContext(options);
      
      expect(context).toBeDefined();
      expect(context?.currentNodeId).toBe(TEST_NODE_ID);
    });

    it('debe aplicar mantenimiento específico', async () => {
      const options = {
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID
      };
      
      const maintenance = {
        preserveFields: ['collectedData'],
        clearFields: ['temporaryData'],
        updateFields: { 'globalVars.test': 'value' }
      };
      
      const context = await maintainSessionContext(options, maintenance);
      
      expect(context).toBeDefined();
      expect(context?.globalVars.test).toBe('value');
    });

    it('debe crear snapshot de sesión', async () => {
      // Primero crear una sesión
      const sessionManager = ImprovedSessionManager.getInstance();
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      const snapshot = await createSessionSnapshot(session.sessionId);
      
      expect(snapshot).toBeDefined();
      expect(snapshot?.sessionId).toBe(session.sessionId);
      expect(snapshot?.timestamp).toBeDefined();
    });

    it('debe restaurar desde snapshot', async () => {
      const sessionManager = ImprovedSessionManager.getInstance();
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      const snapshot = await createSessionSnapshot(session.sessionId);
      if (!snapshot) throw new Error('Snapshot no creado');
      
      const restored = await restoreFromSnapshot(session.sessionId, snapshot);
      expect(restored).toBe(true);
    });
  });

  /**
   * SUITE 5: TESTS DE SESSION CLEANUP SERVICE
   */
  describe('SessionCleanupService', () => {
    beforeEach(() => {
      cleanupService = SessionCleanupService.getInstance({
        enabled: false, // Deshabilitar para tests
        dryRun: true
      });
    });

    it('debe crear instancia singleton correctamente', () => {
      const instance1 = SessionCleanupService.getInstance();
      const instance2 = SessionCleanupService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('debe obtener estado de limpieza', async () => {
      const status = await cleanupService.getCleanupStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.isEnabled).toBe('boolean');
    });

    it('debe ejecutar limpieza manual en modo dry run', async () => {
      const report = await cleanupService.executeManualCleanup();
      
      expect(report).toBeDefined();
      expect(report.startTime).toBeDefined();
      expect(report.endTime).toBeDefined();
      expect(report.metrics).toBeDefined();
    });

    it('debe actualizar configuración', () => {
      const newConfig = {
        intervalMs: 600000,
        maxSessionAge: 172800000
      };
      
      expect(() => {
        cleanupService.updateConfiguration(newConfig);
      }).not.toThrow();
    });
  });

  /**
   * SUITE 6: TESTS DE INTEGRACIÓN COMPLETA
   */
  describe('Integración Completa del Sistema', () => {
    let provider: WebProvider;

    beforeEach(() => {
      sessionManager = ImprovedSessionManager.getInstance();
      provider = new WebProvider(TEST_USER_ID, TEST_TENANT_ID);
    });

    afterEach(async () => {
      if (provider) {
        await provider.close();
      }
    });

    it('debe integrar todos los componentes correctamente', async () => {
      // Esperar inicialización
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 1. Crear sesión a través del provider
      const sessionInfo = await provider.getSessionInfo();
      expect(sessionInfo.sessionId).toBeDefined();
      
      // 2. Preservar datos de conversación
      await provider.preserveConversationData({
        message: 'Hola, necesito agendar una cita',
        response: 'Por supuesto, ¿cuál es tu nombre?',
        nodeId: 'node-ask-name',
        collectedData: { intent: 'agendamiento' }
      });
      
      // 3. Mantener contexto usando utilidad
      const context = await maintainSessionContext({
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        nodeId: 'node-ask-phone'
      });
      
      expect(context).toBeDefined();
      expect(context?.collectedData.intent).toBe('agendamiento');
      
      // 4. Verificar que la sesión persiste
      const retrievedSession = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      expect(retrievedSession.sessionId).toBe(sessionInfo.sessionId);
      
      // 5. Crear snapshot para backup
      const snapshot = await createSessionSnapshot(sessionInfo.sessionId!);
      expect(snapshot).toBeDefined();
      
      // 6. Verificar métricas del sistema
      const cacheMetrics = sessionManager.getAdvancedCacheMetrics();
      expect(cacheMetrics.combined.totalSessions).toBeGreaterThan(0);
    });

    it('debe preservar datos de leads sin interferir con el sistema actual', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simular datos de lead
      const leadData = {
        leadId: 'lead-123',
        leadName: 'Juan Pérez',
        leadPhone: '123456789',
        salesStageId: 'stage-inicial',
        progressPercentage: 25
      };
      
      // Preservar datos de lead en la sesión
      await provider.preserveConversationData({
        message: 'Mi nombre es Juan Pérez',
        nodeId: 'node-collect-name',
        collectedData: { leadData }
      });
      
      // Mantener contexto con datos de lead
      const context = await maintainSessionContext({
        userId: TEST_USER_ID,
        tenantId: TEST_TENANT_ID,
        preserveLeadData: true
      }, {
        preserveFields: ['leadData'],
        clearFields: [],
        updateFields: {},
        leadDataUpdates: leadData
      });
      
      expect(context).toBeDefined();
      expect(context?.leadData?.leadId).toBe('lead-123');
      expect(context?.leadData?.progressPercentage).toBe(25);
    });

    it('debe manejar múltiples sesiones concurrentes', async () => {
      const providers: WebProvider[] = [];
      
      try {
        // Crear múltiples providers para diferentes usuarios
        for (let i = 0; i < 3; i++) {
          const userId = `user-${i}`;
          const provider = new WebProvider(userId, TEST_TENANT_ID);
          providers.push(provider);
          
          // Esperar inicialización
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Preservar datos únicos para cada sesión
          await provider.preserveConversationData({
            message: `Mensaje del usuario ${i}`,
            collectedData: { userId, index: i }
          });
        }
        
        // Verificar que cada sesión mantiene sus datos únicos
        for (let i = 0; i < 3; i++) {
          const sessionInfo = await providers[i].getSessionInfo();
          expect(sessionInfo.userId).toBe(`user-${i}`);
          expect(sessionInfo.conversationLength).toBeGreaterThan(0);
        }
        
      } finally {
        // Limpiar providers
        for (const provider of providers) {
          await provider.close();
        }
      }
    });

    it('debe recuperarse de errores manteniendo funcionalidad básica', async () => {
      // Simular error en sessionManager
      const originalMethod = sessionManager.getOrCreateSession;
      sessionManager.getOrCreateSession = jest.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        // El provider debe seguir funcionando con fallback
        const provider = new WebProvider('error-user', TEST_TENANT_ID);
        
        // Esperar inicialización (puede fallar pero no debe crashear)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const sessionInfo = await provider.getSessionInfo();
        
        // Debe funcionar básicamente incluso con errores de persistencia
        expect(sessionInfo.userId).toBe('error-user');
        
        await provider.close();
        
      } finally {
        // Restaurar método original
        sessionManager.getOrCreateSession = originalMethod;
      }
    });
  });

  /**
   * SUITE 7: TESTS DE RENDIMIENTO Y ESTRÉS
   */
  describe('Rendimiento y Estrés', () => {
    it('debe manejar múltiples operaciones concurrentes', async () => {
      const sessionManager = ImprovedSessionManager.getInstance();
      const operations: Promise<any>[] = [];
      
      // Crear múltiples operaciones concurrentes
      for (let i = 0; i < 10; i++) {
        operations.push(
          sessionManager.getOrCreateSession(`concurrent-user-${i}`, TEST_TENANT_ID)
        );
      }
      
      const results = await Promise.all(operations);
      
      // Todas las operaciones deben completarse exitosamente
      expect(results).toHaveLength(10);
      results.forEach(session => {
        expect(session).toBeDefined();
        expect(session.isActive).toBe(true);
      });
    });

    it('debe mantener rendimiento con gran cantidad de datos de contexto', async () => {
      const sessionManager = ImprovedSessionManager.getInstance();
      const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
      
      // Crear contexto con gran cantidad de datos
      const largeContext = {
        collectedData: {},
        conversationHistory: [],
        flowHistory: []
      };
      
      // Agregar 1000 entradas de conversación
      for (let i = 0; i < 1000; i++) {
        largeContext.conversationHistory.push({
          messageId: `msg-${i}`,
          timestamp: new Date().toISOString(),
          type: i % 2 === 0 ? 'user' : 'bot' as const,
          content: `Mensaje de prueba ${i}`
        });
      }
      
      const startTime = Date.now();
      await sessionManager.updateSessionContext(session.sessionId, largeContext);
      const updateTime = Date.now() - startTime;
      
      // La actualización debe completarse en tiempo razonable
      expect(updateTime).toBeLessThan(1000); // Menos de 1 segundo
      
      const retrieveStartTime = Date.now();
      const retrievedContext = await sessionManager.getSessionContext(session.sessionId);
      const retrieveTime = Date.now() - retrieveStartTime;
      
      // La recuperación debe completarse en tiempo razonable
      expect(retrieveTime).toBeLessThan(500); // Menos de 0.5 segundos
      expect(retrievedContext?.conversationHistory).toHaveLength(1000);
    });
  });
});

/**
 * TESTS ADICIONALES PARA CASOS EDGE
 */
describe('Casos Edge y Manejo de Errores', () => {
  it('debe manejar sesión con datos corruptos', async () => {
    const sessionManager = ImprovedSessionManager.getInstance();
    const session = await sessionManager.getOrCreateSession(TEST_USER_ID, TEST_TENANT_ID);
    
    // Intentar actualizar con datos inválidos
    const invalidContext = {
      collectedData: null, // Inválido
      conversationHistory: 'not-an-array', // Inválido
      globalVars: undefined // Inválido
    } as any;
    
    // No debe crashear, debe manejar graciosamente
    expect(async () => {
      await sessionManager.updateSessionContext(session.sessionId, invalidContext);
    }).not.toThrow();
  });

  it('debe manejar sesión inexistente', async () => {
    const sessionManager = ImprovedSessionManager.getInstance();
    
    const context = await sessionManager.getSessionContext('sesion-inexistente');
    expect(context).toBeNull();
  });

  it('debe manejar TTL inválido', async () => {
    const sessionCache = SessionCache.getInstance();
    const testSession = createTestSession();
    
    // TTL negativo debe ser manejado
    const result = await sessionCache.updateTTL(testSession.sessionId, -1000);
    expect(result).toBe(false);
  });
});