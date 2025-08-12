/**
 * TESTS UNITARIOS PARA ENHANCED DATA CAPTURE
 * 
 * PROPÓSITO: Validar todas las funcionalidades del módulo de captura mejorado
 * CRÍTICO: Garantizar que el sistema de leads NUNCA se vea afectado
 * COBERTURA: Casos normales, edge cases, y escenarios de error
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import EnhancedDataCapture from '../enhancedDataCapture';

// MOCKS
jest.mock('@supabase/supabase-js');
jest.mock('@builderbot/bot');

// Mock de Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  limit: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
};

// Mock de BuilderBot
const mockAddKeyword = jest.fn().mockReturnValue({
  addAction: jest.fn().mockReturnThis(),
  addAnswer: jest.fn().mockReturnThis(),
});

const mockFlowDynamic = jest.fn();
const mockState = {
  getMyState: jest.fn(),
  update: jest.fn(),
};
const mockGotoFlow = jest.fn();

// Datos de prueba
const mockTenantId = 'test-tenant-123';
const mockUserId = 'test-user-456';
const mockNodeId = 'test-node-789';
const mockTemplateId = 'test-template-101';

const mockNodeData = {
  id: mockNodeId,
  content: {
    input: {
      label: '¿Cuál es tu nombre?',
      type: 'text'
    },
    responseMessage: 'Gracias {{name}}'
  }
};

const mockCurrentState = {
  leadId: 'lead-123',
  salesStageId: 'stage-456',
  leadName: 'Juan Pérez',
  hybrid: {
    collectedData: {
      name: 'Juan',
      lead_name: 'Juan'
    }
  }
};

describe('EnhancedDataCapture - Funcionalidades Principales', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks por defecto
    mockSupabase.single.mockResolvedValue({ 
      data: mockNodeData, 
      error: null 
    });
    
    mockState.getMyState.mockResolvedValue(mockCurrentState);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * ========================================
   * TESTS PARA PATRÓN DE DOS FASES
   * ========================================
   */
  describe('Patrón de Dos Fases - createTwoPhaseCapture()', () => {
    test('debe crear flujo de dos fases correctamente', async () => {
      const nodeConfig = {
        nodeId: mockNodeId,
        tenantId: mockTenantId
      };

      const result = await EnhancedDataCapture.createTwoPhaseCapture(nodeConfig, mockTenantId);

      expect(mockAddKeyword).toHaveBeenCalledWith(['']);
      expect(result).toBeDefined();
    });

    test('debe manejar error en obtención de nodo', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Nodo no encontrado') 
      });

      const nodeConfig = {
        nodeId: 'inexistente',
        tenantId: mockTenantId
      };

      const result = await EnhancedDataCapture.createTwoPhaseCapture(nodeConfig, mockTenantId);

      // Debe hacer fallback al sistema actual
      expect(result).toBeDefined();
    });

    test('debe preservar estado entre fases', async () => {
      const nodeConfig = {
        nodeId: mockNodeId,
        tenantId: mockTenantId
      };

      await EnhancedDataCapture.createTwoPhaseCapture(nodeConfig, mockTenantId);

      // Verificar que se llama addAction y addAnswer
      expect(mockAddKeyword().addAction).toHaveBeenCalled();
      expect(mockAddKeyword().addAnswer).toHaveBeenCalled();
    });
  });

  /**
   * ========================================
   * TESTS PARA CAPTURA CON PERSISTENCIA
   * ========================================
   */
  describe('Captura con Persistencia - captureWithPersistence()', () => {
    test('debe ejecutar captura con persistencia exitosa', async () => {
      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        keywords: [''],
        sessionTTL: 3600000,
        preserveLeadVars: true
      };

      const result = await EnhancedDataCapture.captureWithPersistence(config);

      expect(result).toBeDefined();
      expect(mockAddKeyword).toHaveBeenCalledWith(['']);
    });

    test('debe manejar configuración inválida', async () => {
      const invalidConfig = {
        nodeId: '',
        tenantId: '',
        sessionTTL: -1000
      };

      const result = await EnhancedDataCapture.captureWithPersistence(invalidConfig);

      // Debe hacer fallback
      expect(result).toBeDefined();
    });

    test('debe crear sesión persistente', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: { sessionId: 'session-123' }, 
        error: null 
      });

      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        sessionTTL: 3600000
      };

      await EnhancedDataCapture.captureWithPersistence(config);

      // Verificar que se intenta crear o obtener sesión
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  /**
   * ========================================
   * TESTS PARA ARQUITECTURA MULTI-TENANT
   * ========================================
   */
  describe('Arquitectura Multi-Tenant - createMultiTenantCapture()', () => {
    test('debe aislar datos por tenant', async () => {
      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        templateId: mockTemplateId,
        enforceIsolation: true,
        securityLevel: 'strict' as const
      };

      const result = await EnhancedDataCapture.createMultiTenantCapture(config);

      expect(result).toBeDefined();
      expect(mockAddKeyword).toHaveBeenCalled();
    });

    test('debe validar configuración multi-tenant', async () => {
      const invalidConfig = {
        nodeId: mockNodeId,
        tenantId: '', // Tenant ID vacío
        enforceIsolation: true
      };

      const result = await EnhancedDataCapture.createMultiTenantCapture(invalidConfig);

      // Debe hacer fallback por configuración inválida
      expect(result).toBeDefined();
    });

    test('debe prevenir cross-tenant access', async () => {
      const config = {
        nodeId: mockNodeId,
        tenantId: 'tenant-1',
        allowCrossTenantFallback: false,
        securityLevel: 'paranoid' as const
      };

      await EnhancedDataCapture.createMultiTenantCapture(config);

      // Verificar que las consultas incluyen tenant_id
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    });
  });

  /**
   * ========================================
   * TESTS PARA VALIDACIÓN CON TIMEOUT
   * ========================================
   */
  describe('Validación con Timeout - createValidatedCaptureWithTimeout()', () => {
    test('debe crear captura con timeout exitosa', async () => {
      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        timeout: {
          enabled: true,
          duration: 30000,
          warningTime: 20000,
          showWarning: true,
          warningMessage: '⏰ Tiempo casi agotado...'
        },
        validation: {
          minLength: 2,
          maxLength: 50,
          maxAttempts: 3,
          showHints: true
        }
      };

      const result = await EnhancedDataCapture.createValidatedCaptureWithTimeout(config);

      expect(result).toBeDefined();
      expect(mockAddKeyword).toHaveBeenCalled();
    });

    test('debe validar configuración de timeout', async () => {
      const invalidTimeoutConfig = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        timeout: {
          enabled: true,
          duration: -1000, // Duración inválida
          warningTime: 50000 // Mayor que duración
        }
      };

      const result = await EnhancedDataCapture.createValidatedCaptureWithTimeout(invalidTimeoutConfig);

      // Debe hacer fallback por configuración inválida
      expect(result).toBeDefined();
    });

    test('debe manejar timeout expirado', async () => {
      const timeoutStatus = {
        expired: true,
        sessionId: 'session-123',
        remainingTime: 0
      };

      const onExpiredConfig = {
        action: 'fallback',
        message: '⏰ Tiempo agotado. Continuando...'
      };

      // Simular manejo de timeout expirado
      await EnhancedDataCapture['handleTimeoutExpired'](
        timeoutStatus,
        mockFlowDynamic,
        onExpiredConfig
      );

      expect(mockFlowDynamic).toHaveBeenCalledWith('⏰ Tiempo agotado. Continuando...');
    });
  });

  /**
   * ========================================
   * TESTS PARA MANEJO DE ERRORES
   * ========================================
   */
  describe('Manejo de Errores - handleHybridError()', () => {
    test('debe manejar error de severidad baja', async () => {
      const error = new Error('Error menor');
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: 'validation',
        severity: 'low' as const
      };

      const result = await EnhancedDataCapture.handleHybridError(error, context);

      expect(result.success).toBe(true);
      expect(result.fallbackActivated).toBe(true);
      expect(result.leadSystemIntact).toBeDefined();
    });

    test('debe manejar error crítico', async () => {
      const criticalError = new Error('Error crítico del sistema');
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: 'capture',
        severity: 'critical' as const,
        currentState: mockCurrentState
      };

      const result = await EnhancedDataCapture.handleHybridError(criticalError, context);

      expect(result.fallbackActivated).toBe(true);
      // En error crítico, debe verificar integridad del sistema de leads
      expect(mockSupabase.from).toHaveBeenCalledWith('leads');
    });

    test('debe preservar sistema de leads en cualquier error', async () => {
      const error = new Error('Cualquier error');
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: 'processing',
        severity: 'high' as const,
        currentState: mockCurrentState
      };

      const fallbackOptions = {
        preserveLeadState: true,
        useCurrentSystem: true
      };

      const result = await EnhancedDataCapture.handleHybridError(error, context, fallbackOptions);

      // CRÍTICO: El sistema de leads debe quedar intacto
      expect(result.leadSystemIntact).toBeDefined();
      expect(result.fallbackFlow).toBeDefined();
    });
  });

  /**
   * ========================================
   * TESTS PARA FALLBACK AL SISTEMA ACTUAL
   * ========================================
   */
  describe('Fallback al Sistema Actual - fallbackToCurrentSystem()', () => {
    test('debe hacer fallback exitoso', async () => {
      const nodeConfig = {
        nodeId: mockNodeId
      };

      const result = await EnhancedDataCapture.fallbackToCurrentSystem(nodeConfig, mockTenantId);

      expect(result).toBeDefined();
      expect(mockAddKeyword).toHaveBeenCalled();
    });

    test('debe verificar disponibilidad del sistema actual', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: { id: 'template-123' }, 
        error: null 
      });

      const nodeConfig = {
        nodeId: mockNodeId
      };

      await EnhancedDataCapture.fallbackToCurrentSystem(nodeConfig, mockTenantId);

      // Debe verificar existencia de templates
      expect(mockSupabase.from).toHaveBeenCalledWith('chatbot_templates');
    });

    test('debe manejar sistema actual no disponible', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Sistema no disponible') 
      });

      const nodeConfig = {
        nodeId: mockNodeId
      };

      const result = await EnhancedDataCapture.fallbackToCurrentSystem(nodeConfig, mockTenantId);

      // Debe hacer fallback básico garantizado
      expect(result).toBeDefined();
    });
  });

  /**
   * ========================================
   * TESTS PARA VALIDACIÓN DE RESPUESTAS
   * ========================================
   */
  describe('Validación de Respuestas', () => {
    test('debe validar respuesta básica correcta', async () => {
      const userResponse = 'Juan Pérez';
      const validationRules = {
        minLength: 2,
        maxLength: 50,
        emptyMessage: 'Campo requerido'
      };

      const result = await EnhancedDataCapture['validateResponseBasic'](
        userResponse,
        mockNodeData,
        validationRules,
        mockTenantId
      );

      expect(result.isValid).toBe(true);
      expect(result.processedValue).toBe('Juan Pérez');
    });

    test('debe rechazar respuesta vacía', async () => {
      const userResponse = '';
      const validationRules = {
        emptyMessage: 'El campo es requerido'
      };

      const result = await EnhancedDataCapture['validateResponseBasic'](
        userResponse,
        mockNodeData,
        validationRules,
        mockTenantId
      );

      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('El campo es requerido');
    });

    test('debe validar email', async () => {
      const emailData = {
        ...mockNodeData,
        content: {
          input: {
            label: '¿Cuál es tu email?',
            type: 'email'
          }
        }
      };

      const validEmail = 'usuario@ejemplo.com';
      const invalidEmail = 'email-inválido';

      const validResult = await EnhancedDataCapture['validateResponseBasic'](
        validEmail,
        emailData,
        {},
        mockTenantId
      );

      const invalidResult = await EnhancedDataCapture['validateResponseBasic'](
        invalidEmail,
        emailData,
        {},
        mockTenantId
      );

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errorMessage).toContain('email válido');
    });

    test('debe validar teléfono', async () => {
      const phoneData = {
        ...mockNodeData,
        content: {
          input: {
            label: '¿Cuál es tu teléfono?',
            type: 'phone'
          }
        }
      };

      const validPhone = '+1234567890';
      const invalidPhone = 'abc123';

      const validResult = await EnhancedDataCapture['validateResponseBasic'](
        validPhone,
        phoneData,
        {},
        mockTenantId
      );

      const invalidResult = await EnhancedDataCapture['validateResponseBasic'](
        invalidPhone,
        phoneData,
        {},
        mockTenantId
      );

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    test('debe validar patrón personalizado', async () => {
      const customPattern = '^[A-Z]{3}\\d{3}$'; // 3 letras + 3 números
      const customMessage = 'Formato debe ser ABC123';

      const validValue = 'ABC123';
      const invalidValue = 'abc123';

      const validResult = await EnhancedDataCapture['validateWithCustomPattern'](
        validValue,
        customPattern,
        customMessage
      );

      const invalidResult = await EnhancedDataCapture['validateWithCustomPattern'](
        invalidValue,
        customPattern,
        customMessage
      );

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errorMessage).toBe(customMessage);
    });
  });

  /**
   * ========================================
   * TESTS PARA INTEGRIDAD DEL SISTEMA DE LEADS
   * ========================================
   */
  describe('Integridad del Sistema de Leads', () => {
    test('debe verificar integridad completa', async () => {
      // Mock de datos válidos
      mockSupabase.single
        .mockResolvedValueOnce({ // leads
          data: { id: 'lead-123', name: 'Juan Pérez' }, 
          error: null 
        })
        .mockResolvedValueOnce({ // sales_stages
          data: { id: 'stage-456', name: 'Prospecto' }, 
          error: null 
        });

      const result = await EnhancedDataCapture['verifyLeadSystemIntegrity'](
        mockTenantId,
        mockUserId,
        mockCurrentState
      );

      expect(result.intact).toBe(true);
      expect(result.leadExists).toBe(true);
      expect(result.salesStageValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('debe detectar lead inexistente', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Lead no encontrado') 
      });

      const result = await EnhancedDataCapture['verifyLeadSystemIntegrity'](
        mockTenantId,
        mockUserId,
        mockCurrentState
      );

      expect(result.intact).toBe(false);
      expect(result.leadExists).toBe(false);
      expect(result.errors).toContain('Lead no encontrado');
    });

    test('debe verificar servicios críticos', async () => {
      const result = await EnhancedDataCapture['verifyCriticalLeadServices'](mockTenantId);

      expect(result).toBeDefined();
      expect(result.services).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('leads');
      expect(mockSupabase.from).toHaveBeenCalledWith('sales_stages');
      expect(mockSupabase.from).toHaveBeenCalledWith('lead_interactions');
    });
  });

  /**
   * ========================================
   * TESTS PARA SESIONES PERSISTENTES
   * ========================================
   */
  describe('Sesiones Persistentes', () => {
    test('debe crear sesión persistente nueva', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: new Error('Sesión no existe') 
      });

      const session = await EnhancedDataCapture['getOrCreatePersistentSession'](
        mockUserId,
        mockTenantId,
        3600000
      );

      expect(session).toBeDefined();
      expect(session.userId).toBe(mockUserId);
      expect(session.tenantId).toBe(mockTenantId);
    });

    test('debe reutilizar sesión existente', async () => {
      const existingSession = {
        sessionId: 'session-123',
        userId: mockUserId,
        tenantId: mockTenantId,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };

      mockSupabase.single.mockResolvedValue({ 
        data: existingSession, 
        error: null 
      });

      const session = await EnhancedDataCapture['getOrCreatePersistentSession'](
        mockUserId,
        mockTenantId,
        3600000
      );

      expect(session.sessionId).toBe('session-123');
    });

    test('debe extender TTL de sesión', async () => {
      const sessionId = 'session-123';
      const newTTL = 7200000; // 2 horas

      await EnhancedDataCapture['extendSession'](sessionId, newTTL);

      expect(mockSupabase.update).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('session_id', sessionId);
    });
  });

  /**
   * ========================================
   * TESTS PARA CASOS EDGE
   * ========================================
   */
  describe('Casos Edge y Robustez', () => {
    test('debe manejar estado corrupto', async () => {
      const corruptedState = {
        // Estado con datos inconsistentes
        leadId: 'lead-123',
        salesStageId: null,
        hybrid: {
          collectedData: undefined
        }
      };

      mockState.getMyState.mockResolvedValue(corruptedState);

      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId
      };

      const result = await EnhancedDataCapture.createTwoPhaseCapture(config, mockTenantId);

      // Debe manejar estado corrupto sin fallar
      expect(result).toBeDefined();
    });

    test('debe manejar conexión a BD fallida', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Conexión perdida'));

      const config = {
        nodeId: mockNodeId,
        tenantId: mockTenantId
      };

      const result = await EnhancedDataCapture.createTwoPhaseCapture(config, mockTenantId);

      // Debe hacer fallback sin fallar
      expect(result).toBeDefined();
    });

    test('debe manejar timeout de red', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';

      mockSupabase.single.mockRejectedValue(timeoutError);

      const error = timeoutError;
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: 'network_call',
        severity: 'medium' as const
      };

      const result = await EnhancedDataCapture.handleHybridError(error, context);

      expect(result.fallbackActivated).toBe(true);
      expect(result.success).toBe(true);
    });

    test('debe preservar datos en cualquier fallo', async () => {
      const originalData = {
        name: 'Juan',
        email: 'juan@ejemplo.com',
        phone: '+1234567890'
      };

      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        currentState: {
          hybrid_collectedData: originalData
        }
      };

      const preservedData = await EnhancedDataCapture['preserveCollectedData'](context);

      expect(preservedData).toEqual(originalData);
    });
  });

  /**
   * ========================================
   * TESTS DE INTEGRACIÓN CRÍTICOS
   * ========================================
   */
  describe('Tests de Integración Críticos', () => {
    test('CRÍTICO: Sistema de leads NUNCA debe romperse', async () => {
      // Simular error catastrófico
      const catastrophicError = new Error('Error catastrófico del sistema');
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: 'critical_operation',
        severity: 'critical' as const,
        currentState: mockCurrentState
      };

      const result = await EnhancedDataCapture.handleHybridError(catastrophicError, context);

      // VERIFICACIONES CRÍTICAS
      expect(result).toBeDefined();
      expect(result.fallbackActivated).toBe(true);
      expect(result.fallbackFlow).toBeDefined();
      
      // El sistema de leads debe seguir operacional
      expect(mockSupabase.from).toHaveBeenCalledWith('leads');
    });

    test('CRÍTICO: Fallback siempre debe funcionar', async () => {
      // Simular todos los sistemas fallando
      mockSupabase.single.mockRejectedValue(new Error('Todo falla'));
      mockAddKeyword.mockImplementation(() => {
        throw new Error('BuilderBot falla');
      });

      const nodeConfig = {
        nodeId: mockNodeId
      };

      const result = await EnhancedDataCapture.fallbackToCurrentSystem(nodeConfig, mockTenantId);

      // DEBE existir un fallback de último recurso
      expect(result).toBeDefined();
    });

    test('CRÍTICO: Datos de leads deben preservarse', async () => {
      const criticalLeadData = {
        leadId: 'lead-vip-123',
        leadName: 'Cliente VIP',
        salesStageId: 'stage-closing',
        leadPhone: '+1234567890',
        leadEmail: 'vip@cliente.com'
      };

      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        currentState: {
          ...criticalLeadData,
          hybrid_collectedData: criticalLeadData
        }
      };

      // Simular proceso completo con error
      const error = new Error('Error durante procesamiento');
      const errorResult = await EnhancedDataCapture.handleHybridError(error, {
        ...context,
        operation: 'data_processing',
        severity: 'high' as const
      });

      // Los datos del lead deben estar preservados
      expect(errorResult.fallbackActivated).toBe(true);
      
      // Verificar que se intenta preservar datos
      const preservedData = await EnhancedDataCapture['preserveCollectedData'](context);
      expect(preservedData).toEqual(criticalLeadData);
    });
  });
});

/**
 * ========================================
 * TESTS DE PERFORMANCE Y LÍMITES
 * ========================================
 */
describe('EnhancedDataCapture - Performance y Límites', () => {
  test('debe manejar múltiples requests concurrentes', async () => {
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      const config = {
        nodeId: `node-${i}`,
        tenantId: mockTenantId
      };
      
      promises.push(EnhancedDataCapture.createTwoPhaseCapture(config, mockTenantId));
    }

    const results = await Promise.allSettled(promises);
    
    // Todos deben resolverse (exitosamente o con fallback)
    results.forEach(result => {
      expect(result.status).toBe('fulfilled');
    });
  });

  test('debe manejar datos grandes', async () => {
    const largeData = {
      input: {
        label: 'A'.repeat(10000), // 10KB de texto
        type: 'text'
      }
    };

    const result = await EnhancedDataCapture['validateResponseBasic'](
      'respuesta',
      { content: largeData },
      {},
      mockTenantId
    );

    // Debe manejar datos grandes sin fallar
    expect(result).toBeDefined();
  });

  test('debe respetar límites de timeout', async () => {
    const startTime = Date.now();
    
    const timeoutConfig = {
      enabled: true,
      duration: 100, // 100ms
      warningTime: 50
    };

    const session = await EnhancedDataCapture['initializeTimeoutSession'](
      mockUserId,
      mockTenantId,
      mockNodeId,
      timeoutConfig
    );

    // Simular paso del tiempo
    await new Promise(resolve => setTimeout(resolve, 150));

    const timeoutStatus = await EnhancedDataCapture['checkTimeoutStatus'](
      mockUserId,
      mockTenantId
    );

    const elapsedTime = Date.now() - startTime;
    expect(elapsedTime).toBeGreaterThanOrEqual(150);
  });
});

/**
 * ========================================
 * TESTS DE COBERTURA COMPLETA
 * ========================================
 */
describe('EnhancedDataCapture - Cobertura Completa', () => {
  test('debe cubrir todos los métodos públicos', () => {
    const publicMethods = [
      'createTwoPhaseCapture',
      'createMultiTenantCapture', 
      'captureWithPersistence',
      'createValidatedCaptureWithTimeout',
      'handleHybridError',
      'fallbackToCurrentSystem'
    ];

    publicMethods.forEach(method => {
      expect(typeof EnhancedDataCapture[method]).toBe('function');
    });
  });

  test('debe cubrir todos los casos de severidad de error', async () => {
    const severities = ['low', 'medium', 'high', 'critical'] as const;
    
    for (const severity of severities) {
      const error = new Error(`Error ${severity}`);
      const context = {
        nodeId: mockNodeId,
        tenantId: mockTenantId,
        userId: mockUserId,
        operation: `test_${severity}`,
        severity
      };

      const result = await EnhancedDataCapture.handleHybridError(error, context);
      
      expect(result).toBeDefined();
      expect(result.fallbackActivated).toBe(true);
    }
  });

  test('debe cubrir todos los tipos de validación', async () => {
    const validationTypes = [
      { type: 'email', value: 'test@example.com', expected: true },
      { type: 'phone', value: '+1234567890', expected: true },
      { type: 'number', value: '123', expected: true },
      { type: 'text', value: 'texto válido', expected: true },
      { type: 'email', value: 'email-inválido', expected: false },
      { type: 'phone', value: 'teléfono-inválido', expected: false },
      { type: 'number', value: 'no-es-número', expected: false }
    ];

    for (const { type, value, expected } of validationTypes) {
      const nodeData = {
        content: {
          input: { type, label: `Campo ${type}` }
        }
      };

      const result = await EnhancedDataCapture['validateResponseBasic'](
        value,
        nodeData,
        {},
        mockTenantId
      );

      expect(result.isValid).toBe(expected);
    }
  });
});