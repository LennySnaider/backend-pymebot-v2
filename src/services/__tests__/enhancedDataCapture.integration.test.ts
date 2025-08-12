/**
 * TESTS DE INTEGRACIÓN PARA ENHANCED DATA CAPTURE
 * 
 * PROPÓSITO: Validar integración completa con sistema de leads
 * CRÍTICO: Garantizar que NUNCA se rompa la funcionalidad existente
 * ENFOQUE: Casos reales de uso con datos del sistema actual
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import EnhancedDataCapture from '../enhancedDataCapture';

// MOCKS realistas del sistema actual
const mockRealLeadData = {
  id: 'lead-real-123',
  name: 'Cliente Real',
  phone: '+5218180001234',
  email: 'cliente@empresa.com',
  tenant_id: 'tenant-real-456',
  sales_stage_id: 'stage-prospecto-789',
  created_at: '2025-01-09T10:00:00.000Z',
  updated_at: '2025-01-09T10:30:00.000Z',
  lead_source: 'whatsapp_chat',
  status: 'active'
};

const mockRealSalesStage = {
  id: 'stage-prospecto-789',
  name: 'Prospecto',
  order: 1,
  tenant_id: 'tenant-real-456',
  color: '#3B82F6',
  is_active: true
};

const mockRealChatbotTemplate = {
  id: 'template-agendamiento-101',
  name: 'PymeBot V1 - Agendamiento Completo',
  tenant_id: 'tenant-real-456',
  is_active: true,
  content: {
    nodes: [
      {
        id: 'node-bienvenida',
        type: 'message',
        content: {
          message: 'Hola! Soy {{business_name}}. ¿En qué puedo ayudarte?'
        }
      },
      {
        id: 'node-nombre',
        type: 'input',
        content: {
          input: {
            label: '¿Cuál es tu nombre?',
            type: 'text'
          },
          responseMessage: 'Perfecto {{name}}, es un gusto conocerte.'
        }
      }
    ]
  }
};

const mockSupabaseReal = {
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

describe('EnhancedDataCapture - Integración con Sistema Real', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup con datos reales del sistema
    mockSupabaseReal.single
      .mockResolvedValueOnce({ data: mockRealLeadData, error: null })
      .mockResolvedValueOnce({ data: mockRealSalesStage, error: null })
      .mockResolvedValueOnce({ data: mockRealChatbotTemplate, error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * ========================================
   * TESTS DE INTEGRACIÓN CON LEADS REALES
   * ========================================
   */
  describe('Integración con Sistema de Leads Real', () => {
    test('debe procesar lead existente sin alterar datos', async () => {
      const realState = {
        leadId: mockRealLeadData.id,
        leadName: mockRealLeadData.name,
        leadPhone: mockRealLeadData.phone,
        salesStageId: mockRealLeadData.sales_stage_id,
        tenantId: mockRealLeadData.tenant_id
      };

      const integrity = await EnhancedDataCapture['verifyLeadSystemIntegrity'](
        mockRealLeadData.tenant_id,
        'user-whatsapp-123',
        realState
      );

      expect(integrity.intact).toBe(true);
      expect(integrity.leadExists).toBe(true);
      expect(integrity.leadData.id).toBe(mockRealLeadData.id);
      expect(integrity.salesStageValid).toBe(true);
    });

    test('debe manejar progresión real de etapas de ventas', async () => {
      const salesStages = [
        { id: 'stage-1', name: 'Prospecto', order: 1 },
        { id: 'stage-2', name: 'Calificado', order: 2 },
        { id: 'stage-3', name: 'Propuesta', order: 3 },
        { id: 'stage-4', name: 'Cierre', order: 4 }
      ];

      for (const stage of salesStages) {
        mockSupabaseReal.single.mockResolvedValueOnce({ 
          data: { ...mockRealSalesStage, ...stage }, 
          error: null 
        });

        const stateWithStage = {
          ...mockRealLeadData,
          salesStageId: stage.id
        };

        const integrity = await EnhancedDataCapture['verifyLeadSystemIntegrity'](
          mockRealLeadData.tenant_id,
          'user-123',
          stateWithStage
        );

        expect(integrity.intact).toBe(true);
        expect(integrity.salesStageValid).toBe(true);
      }
    });

    test('debe preservar interacciones del lead', async () => {
      const realInteractions = [
        {
          id: 'interaction-1',
          lead_id: mockRealLeadData.id,
          interaction_type: 'whatsapp_message',
          content: 'Hola, me interesa información',
          timestamp: '2025-01-09T10:00:00.000Z'
        },
        {
          id: 'interaction-2', 
          lead_id: mockRealLeadData.id,
          interaction_type: 'bot_response',
          content: 'Hola! Soy PymeBot. ¿En qué puedo ayudarte?',
          timestamp: '2025-01-09T10:00:30.000Z'
        }
      ];

      mockSupabaseReal.single.mockResolvedValue({ 
        data: realInteractions, 
        error: null 
      });

      await EnhancedDataCapture['restoreLeadInteractions'](
        'user-123',
        mockRealLeadData.tenant_id,
        { leadId: mockRealLeadData.id }
      );

      // Verificar que se intenta restaurar interacciones
      expect(mockSupabaseReal.from).toHaveBeenCalled();
    });
  });

  /**
   * ========================================
   * TESTS CON TEMPLATES REALES
   * ========================================
   */
  describe('Integración con Templates Reales', () => {
    test('debe procesar template de agendamiento completo', async () => {
      const templateNode = {
        id: 'node-nombre',
        type: 'input',
        content: {
          input: {
            label: '¿Cuál es tu nombre completo?',
            type: 'text'
          },
          responseMessage: 'Perfecto {{name}}, vamos a agendar tu cita.'
        }
      };

      mockSupabaseReal.single.mockResolvedValue({ 
        data: templateNode, 
        error: null 
      });

      const config = {
        nodeId: templateNode.id,
        tenantId: mockRealLeadData.tenant_id,
        templateId: mockRealChatbotTemplate.id
      };

      const result = await EnhancedDataCapture.createTwoPhaseCapture(config, mockRealLeadData.tenant_id);

      expect(result).toBeDefined();
      expect(mockSupabaseReal.eq).toHaveBeenCalledWith('tenant_id', mockRealLeadData.tenant_id);
    });

    test('debe manejar variables del sistema real', async () => {
      const realVariables = {
        business_name: 'Mi Empresa PymeBot',
        businessName: 'Mi Empresa PymeBot',
        name: 'Juan Carlos',
        lead_name: 'Juan Carlos',
        phone: '+5218180001234',
        email: 'juan@empresa.com'
      };

      const questionWithVars = 'Hola {{name}}, bienvenido a {{business_name}}. ¿En qué podemos ayudarte?';
      const expectedResult = 'Hola Juan Carlos, bienvenido a Mi Empresa PymeBot. ¿En qué podemos ayudarte?';

      const processedQuestion = EnhancedDataCapture['replaceVariables'](questionWithVars, realVariables);

      expect(processedQuestion).toBe(expectedResult);
    });

    test('debe detectar tipos de input correctamente', async () => {
      const inputTypes = [
        { label: '¿Cuál es tu nombre?', expected: 'name' },
        { label: '¿Cómo te llamas?', expected: 'name' },
        { label: '¿Cuál es tu teléfono?', expected: 'other' },
        { label: '¿Tu email?', expected: 'other' },
        { label: 'Dime tu nombre completo', expected: 'name' }
      ];

      inputTypes.forEach(({ label, expected }) => {
        const result = EnhancedDataCapture['detectInputType'](label);
        expect(result).toBe(expected);
      });
    });
  });

  /**
   * ========================================
   * TESTS DE FLUJO COMPLETO REAL
   * ========================================
   */
  describe('Flujo Completo de Conversación Real', () => {
    test('debe manejar flujo completo de captura de nombre', async () => {
      // PASO 1: Preparación
      const nodeData = {
        id: 'node-nombre',
        content: {
          input: {
            label: '¿Cuál es tu nombre?',
            type: 'text'
          },
          responseMessage: 'Perfecto {{name}}, continuemos.'
        }
      };

      mockSupabaseReal.single.mockResolvedValue({ data: nodeData, error: null });

      const config = {
        nodeId: nodeData.id,
        tenantId: mockRealLeadData.tenant_id,
        preserveLeadVars: true
      };

      // PASO 2: Crear captura
      const captureFlow = await EnhancedDataCapture.captureWithPersistence(config);
      expect(captureFlow).toBeDefined();

      // PASO 3: Simular respuesta del usuario
      const userResponse = 'María González';
      const currentState = {
        hybrid_nodeData: nodeData,
        hybrid_inputType: 'name',
        hybrid_leadSystemVars: {
          businessName: 'Mi Empresa'
        },
        leadId: mockRealLeadData.id,
        tenantId: mockRealLeadData.tenant_id
      };

      // PASO 4: Procesar respuesta
      const processedData = await EnhancedDataCapture['processUserResponseWithLeadSystem'](
        userResponse,
        nodeData,
        currentState,
        mockRealLeadData.tenant_id
      );

      expect(processedData.collectedData.name).toBe('María González');
      expect(processedData.collectedData.lead_name).toBe('María González');
      expect(processedData.contextVars.name).toBe('María González');
    });

    test('debe manejar flujo con validación y timeout', async () => {
      const nodeWithValidation = {
        id: 'node-telefono',
        content: {
          input: {
            label: '¿Cuál es tu número de teléfono?',
            type: 'phone'
          },
          responseMessage: 'Gracias, nos comunicaremos al {{phone}}'
        }
      };

      mockSupabaseReal.single.mockResolvedValue({ 
        data: nodeWithValidation, 
        error: null 
      });

      const config = {
        nodeId: nodeWithValidation.id,
        tenantId: mockRealLeadData.tenant_id,
        validation: {
          minLength: 10,
          maxLength: 15,
          showHints: true,
          maxAttempts: 3
        },
        timeout: {
          enabled: true,
          duration: 30000,
          warningTime: 20000,
          showWarning: true
        }
      };

      const result = await EnhancedDataCapture.createValidatedCaptureWithTimeout(config);
      expect(result).toBeDefined();

      // Probar validación de teléfono
      const validPhone = '+5218180001234';
      const invalidPhone = 'abc123';

      const validResult = await EnhancedDataCapture['validateResponseBasic'](
        validPhone,
        nodeWithValidation,
        config.validation,
        mockRealLeadData.tenant_id
      );

      const invalidResult = await EnhancedDataCapture['validateResponseBasic'](
        invalidPhone,
        nodeWithValidation,
        config.validation,
        mockRealLeadData.tenant_id
      );

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    test('debe manejar error durante captura real', async () => {
      // Simular error de base de datos
      mockSupabaseReal.single.mockRejectedValue(new Error('Error de conexión a BD'));

      const error = new Error('Error durante captura de datos');
      const context = {
        nodeId: 'node-nombre',
        tenantId: mockRealLeadData.tenant_id,
        userId: 'user-whatsapp-123',
        operation: 'data_capture',
        severity: 'high' as const,
        currentState: {
          leadId: mockRealLeadData.id,
          leadName: mockRealLeadData.name,
          salesStageId: mockRealLeadData.sales_stage_id
        }
      };

      const result = await EnhancedDataCapture.handleHybridError(error, context, {
        preserveLeadState: true,
        useCurrentSystem: true,
        showUserMessage: false,
        logError: true
      });

      // CRÍTICO: Lead debe seguir intacto
      expect(result.fallbackActivated).toBe(true);
      expect(result.success).toBe(true);
      expect(result.fallbackFlow).toBeDefined();
    });
  });

  /**
   * ========================================
   * TESTS DE COMPATIBILIDAD CON SISTEMA ACTUAL
   * ========================================
   */
  describe('Compatibilidad con Sistema Actual', () => {
    test('debe coexistir con templateConverter.ts actual', async () => {
      // Simular que templateConverter está funcionando
      const currentSystemWorking = true;
      
      mockSupabaseReal.single.mockResolvedValue({ 
        data: mockRealChatbotTemplate, 
        error: null 
      });

      if (currentSystemWorking) {
        const nodeConfig = { nodeId: 'node-test' };
        const result = await EnhancedDataCapture.fallbackToCurrentSystem(
          nodeConfig, 
          mockRealLeadData.tenant_id
        );

        expect(result).toBeDefined();
        expect(mockSupabaseReal.from).toHaveBeenCalledWith('chatbot_templates');
      }
    });

    test('debe mantener formato de estado compatible', async () => {
      const currentSystemState = {
        nodeId: 'node-current',
        leadId: mockRealLeadData.id,
        leadName: mockRealLeadData.name,
        salesStageId: mockRealLeadData.sales_stage_id,
        collectedData: {
          name: 'Cliente',
          phone: '+1234567890'
        },
        globalVars: {
          business_name: 'Mi Empresa',
          lead_name: 'Cliente'
        }
      };

      // El sistema híbrido debe entender el estado actual
      const hybridState = await EnhancedDataCapture['createPersistentHybridState'](
        currentSystemState,
        mockRealChatbotTemplate.content.nodes[0],
        { businessName: 'Mi Empresa' },
        { sessionId: 'session-123' },
        { nodeId: 'node-test', tenantId: mockRealLeadData.tenant_id }
      );

      expect(hybridState.leadId).toBe(mockRealLeadData.id);
      expect(hybridState.salesStageId).toBe(mockRealLeadData.sales_stage_id);
      expect(hybridState.hybrid_leadSystemVars).toBeDefined();
    });

    test('debe respetar aislamiento por tenant', async () => {
      const tenant1 = 'tenant-empresa-1';
      const tenant2 = 'tenant-empresa-2';

      // Datos del tenant 1
      mockSupabaseReal.eq.mockImplementation((field, value) => {
        if (field === 'tenant_id' && value === tenant1) {
          return {
            single: () => Promise.resolve({ 
              data: { ...mockRealLeadData, tenant_id: tenant1 }, 
              error: null 
            })
          };
        }
        if (field === 'tenant_id' && value === tenant2) {
          return {
            single: () => Promise.resolve({ 
              data: null, 
              error: new Error('No encontrado') 
            })
          };
        }
        return mockSupabaseReal;
      });

      const config1 = {
        nodeId: 'node-test',
        tenantId: tenant1,
        enforceIsolation: true
      };

      const config2 = {
        nodeId: 'node-test', 
        tenantId: tenant2,
        enforceIsolation: true
      };

      const result1 = await EnhancedDataCapture.createMultiTenantCapture(config1);
      const result2 = await EnhancedDataCapture.createMultiTenantCapture(config2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      
      // Verificar que se enforza aislamiento
      expect(mockSupabaseReal.eq).toHaveBeenCalledWith('tenant_id', tenant1);
      expect(mockSupabaseReal.eq).toHaveBeenCalledWith('tenant_id', tenant2);
    });
  });

  /**
   * ========================================
   * TESTS DE ESCENARIOS CRÍTICOS REALES
   * ========================================
   */
  describe('Escenarios Críticos del Sistema Real', () => {
    test('CRÍTICO: Lead en proceso de cierre NO debe perderse', async () => {
      const criticalLead = {
        ...mockRealLeadData,
        sales_stage_id: 'stage-cierre',
        value: 50000, // Lead de alto valor
        status: 'hot_lead'
      };

      // Simular error durante proceso crítico
      const criticalError = new Error('Error durante proceso de cierre');
      const context = {
        nodeId: 'node-confirmacion-cierre',
        tenantId: criticalLead.tenant_id,
        userId: 'user-sales-agent',
        operation: 'closing_process',
        severity: 'critical' as const,
        currentState: {
          leadId: criticalLead.id,
          salesStageId: criticalLead.sales_stage_id,
          leadValue: criticalLead.value,
          hybrid_collectedData: {
            confirmacion_compra: 'Sí, quiero proceder',
            metodo_pago: 'Transferencia'
          }
        }
      };

      const result = await EnhancedDataCapture.handleHybridError(criticalError, context, {
        preserveLeadState: true,
        useCurrentSystem: true,
        logError: true
      });

      // VERIFICACIONES CRÍTICAS
      expect(result.fallbackActivated).toBe(true);
      expect(result.success).toBe(true);
      
      // Los datos del lead crítico deben estar preservados
      const preservedData = await EnhancedDataCapture['preserveCollectedData'](context);
      expect(preservedData.confirmacion_compra).toBe('Sí, quiero proceder');
      expect(preservedData.metodo_pago).toBe('Transferencia');
    });

    test('CRÍTICO: Sistema debe recuperarse de caída de BD', async () => {
      // Simular caída completa de base de datos
      mockSupabaseReal.single.mockRejectedValue(new Error('Connection refused'));
      mockSupabaseReal.from.mockImplementation(() => {
        throw new Error('Database unavailable');
      });

      const nodeConfig = { nodeId: 'node-cualquiera' };
      
      // El sistema DEBE seguir funcionando con fallback
      const result = await EnhancedDataCapture.fallbackToCurrentSystem(
        nodeConfig, 
        'cualquier-tenant'
      );

      expect(result).toBeDefined();
      // Debe existir un flujo básico funcional
    });

    test('CRÍTICO: Múltiples usuarios concurrentes', async () => {
      const users = [
        { id: 'user-1', leadId: 'lead-1' },
        { id: 'user-2', leadId: 'lead-2' },
        { id: 'user-3', leadId: 'lead-3' },
        { id: 'user-4', leadId: 'lead-4' },
        { id: 'user-5', leadId: 'lead-5' }
      ];

      const promises = users.map(async (user) => {
        const config = {
          nodeId: `node-${user.id}`,
          tenantId: mockRealLeadData.tenant_id
        };

        return EnhancedDataCapture.createTwoPhaseCapture(config, mockRealLeadData.tenant_id);
      });

      const results = await Promise.allSettled(promises);

      // TODOS deben resolverse exitosamente
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
        }
      });
    });

    test('CRÍTICO: Datos sensibles nunca deben loggearse', async () => {
      const sensitiveData = {
        password: 'password123',
        credit_card: '4111111111111111',
        ssn: '123-45-6789',
        api_key: 'sk-1234567890abcdef'
      };

      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const error = new Error('Error con datos sensibles');
      const context = {
        nodeId: 'node-payment',
        tenantId: mockRealLeadData.tenant_id,
        userId: 'user-123',
        operation: 'payment_processing',
        severity: 'high' as const,
        currentState: {
          hybrid_collectedData: sensitiveData
        }
      };

      await EnhancedDataCapture.handleHybridError(error, context);

      // Verificar que datos sensibles NO aparecen en logs
      const allLogCalls = [
        ...logSpy.mock.calls.flat(),
        ...errorSpy.mock.calls.flat()
      ];

      allLogCalls.forEach(call => {
        const logString = JSON.stringify(call);
        expect(logString).not.toContain('password123');
        expect(logString).not.toContain('4111111111111111'); 
        expect(logString).not.toContain('123-45-6789');
        expect(logString).not.toContain('sk-1234567890abcdef');
      });

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});

/**
 * ========================================
 * TESTS DE RENDIMIENTO EN CONDICIONES REALES
 * ========================================
 */
describe('EnhancedDataCapture - Rendimiento Real', () => {
  test('debe manejar picos de tráfico', async () => {
    const startTime = Date.now();
    const concurrent = 50; // 50 usuarios concurrentes
    
    const promises = Array.from({ length: concurrent }, (_, i) => {
      const config = {
        nodeId: `node-${i}`,
        tenantId: `tenant-${i % 5}` // 5 tenants diferentes
      };
      
      return EnhancedDataCapture.createTwoPhaseCapture(config, config.tenantId);
    });

    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    
    // Todos deben completarse en tiempo razonable
    expect(endTime - startTime).toBeLessThan(5000); // Menos de 5 segundos
    
    // Todos deben resolverse
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBe(concurrent);
  });

  test('debe optimizar consultas a BD', async () => {
    let queryCount = 0;
    
    mockSupabaseReal.from.mockImplementation((table) => {
      queryCount++;
      return mockSupabaseReal;
    });

    const config = {
      nodeId: 'node-optimizado',
      tenantId: mockRealLeadData.tenant_id
    };

    await EnhancedDataCapture.createTwoPhaseCapture(config, mockRealLeadData.tenant_id);

    // Debe minimizar número de consultas
    expect(queryCount).toBeLessThan(10);
  });

  test('debe manejar memoria eficientemente', async () => {
    const largeSessions = Array.from({ length: 100 }, (_, i) => ({
      sessionId: `session-${i}`,
      data: 'x'.repeat(1000) // 1KB por sesión
    }));

    // Simular creación de muchas sesiones
    for (const session of largeSessions) {
      await EnhancedDataCapture['getOrCreatePersistentSession'](
        session.sessionId,
        mockRealLeadData.tenant_id,
        3600000
      );
    }

    // El sistema debe seguir respondiendo
    const config = {
      nodeId: 'node-memory-test',
      tenantId: mockRealLeadData.tenant_id
    };

    const result = await EnhancedDataCapture.createTwoPhaseCapture(config, mockRealLeadData.tenant_id);
    expect(result).toBeDefined();
  });
});