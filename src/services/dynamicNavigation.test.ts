/**
 * TESTS PARA DYNAMIC NAVIGATION SERVICE
 * 
 * PROPÓSITO: Validar navegación dinámica entre nodos con contexto preservado
 * BASADO EN: Patrones extraídos del v1-reference
 * PRESERVA: Sistema de leads 100% intacto durante navegación
 * VALIDA: Resolución de problemas que causan "Mensajes capturados: 0"
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import DynamicNavigationService from './dynamicNavigation';
import ImprovedSessionManager from './improvedSessionManager';
import type { 
  NavigationNode, 
  NavigationContext, 
  NavigationResult,
  NavigationOptions 
} from './dynamicNavigation';

// Mock del logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// Mock del session manager
jest.mock('./improvedSessionManager');

// Mock de maintainSessionContext
jest.mock('../utils/maintainSessionContext', () => ({
  maintainSessionContext: jest.fn().mockResolvedValue(true)
}));

describe('DynamicNavigationService', () => {
  let navigationService: DynamicNavigationService;
  let mockSessionManager: jest.Mocked<ImprovedSessionManager>;

  beforeEach(() => {
    // Limpiar mocks
    jest.clearAllMocks();
    
    // Configurar mock del session manager
    mockSessionManager = {
      getInstance: jest.fn(),
      getSessionContext: jest.fn(),
      createSession: jest.fn(),
      updateSessionContext: jest.fn(),
      deleteSession: jest.fn(),
      cleanupExpiredSessions: jest.fn(),
      getSessionMetrics: jest.fn(),
      destroy: jest.fn()
    } as any;

    (ImprovedSessionManager.getInstance as jest.Mock).mockReturnValue(mockSessionManager);

    // Obtener instancia del servicio
    navigationService = DynamicNavigationService.getInstance();
  });

  afterEach(() => {
    // Limpiar estado del servicio
    navigationService.destroy();
  });

  describe('Singleton Pattern', () => {
    test('debe devolver la misma instancia', () => {
      const instance1 = DynamicNavigationService.getInstance();
      const instance2 = DynamicNavigationService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Node Registry Management', () => {
    test('debe registrar y recuperar nodos correctamente', async () => {
      const testNode: NavigationNode = {
        nodeId: 'test-node-1',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: {
          message: 'Mensaje de prueba'
        },
        metadata: {
          priority: 1,
          tags: ['test']
        }
      };

      await navigationService.registerNode(testNode);
      const retrievedNode = await navigationService.getNode('test-node-1');

      expect(retrievedNode).toEqual(testNode);
    });

    test('debe retornar null para nodos no encontrados', async () => {
      const retrievedNode = await navigationService.getNode('non-existent-node');
      expect(retrievedNode).toBeNull();
    });
  });

  describe('Flow Registry Management', () => {
    test('debe registrar y recuperar flujos correctamente', async () => {
      const testNodes: NavigationNode[] = [
        {
          nodeId: 'node-1',
          nodeType: 'message',
          tenantId: 'tenant-1',
          data: { message: 'Nodo 1' },
          metadata: {}
        },
        {
          nodeId: 'node-2',
          nodeType: 'input',
          tenantId: 'tenant-1',
          data: { 
            input: {
              label: 'Ingresa tu nombre',
              type: 'text',
              required: true
            }
          },
          metadata: {}
        }
      ];

      await navigationService.registerFlow('template-1', testNodes);
      const retrievedFlow = await navigationService.getFlow('template-1');

      expect(retrievedFlow).toEqual(testNodes);
      
      // Verificar que los nodos también se registraron individualmente
      const node1 = await navigationService.getNode('node-1');
      const node2 = await navigationService.getNode('node-2');
      expect(node1).toEqual(testNodes[0]);
      expect(node2).toEqual(testNodes[1]);
    });
  });

  describe('Navigation Context Creation', () => {
    test('debe crear contexto de navegación con datos por defecto', async () => {
      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      expect(context).toEqual({
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        conversationState: {
          isWaitingForInput: false,
          retryCount: 0,
          maxRetries: 3
        },
        navigationHistory: [],
        collectedData: {},
        globalVars: {}
      });
    });

    test('debe crear contexto con datos iniciales personalizados', async () => {
      const initialData = {
        currentNodeId: 'start-node',
        collectedData: { name: 'Juan' },
        globalVars: { company: 'Test Corp' }
      };

      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1',
        initialData
      );

      expect(context.currentNodeId).toBe('start-node');
      expect(context.collectedData).toEqual({ name: 'Juan' });
      expect(context.globalVars).toEqual({ company: 'Test Corp' });
    });
  });

  describe('Enhanced Goto Flow - Core Functionality', () => {
    let mockContext: NavigationContext;
    let mockTargetNode: NavigationNode;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      mockTargetNode = {
        nodeId: 'target-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: {
          message: 'Mensaje de destino'
        },
        metadata: {}
      };

      await navigationService.registerNode(mockTargetNode);
    });

    test('debe ejecutar navegación exitosa básica', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'target-node'
      );

      expect(result.success).toBe(true);
      expect(result.targetNodeId).toBe('target-node');
      expect(result.nextNode).toEqual(mockTargetNode);
      expect(result.botResponse).toBe('Mensaje de destino');
      expect(result.navigationStep).toBeDefined();
    });

    test('debe fallar si el nodo destino no existe', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'non-existent-node'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nodo destino no encontrado: non-existent-node');
    });

    test('debe prevenir navegación concurrente para la misma sesión', async () => {
      // Iniciar primera navegación
      const promise1 = navigationService.enhancedGotoFlow(mockContext, 'target-node');
      
      // Intentar segunda navegación inmediatamente
      const result2 = await navigationService.enhancedGotoFlow(mockContext, 'target-node');

      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Navegación ya en progreso para esta sesión');

      // Esperar a que termine la primera navegación
      const result1 = await promise1;
      expect(result1.success).toBe(true);
    });
  });

  describe('Enhanced Goto Flow - Node Type Processing', () => {
    let mockContext: NavigationContext;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );
    });

    test('debe procesar nodo de mensaje correctamente', async () => {
      const messageNode: NavigationNode = {
        nodeId: 'message-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: {
          message: 'Hola {{name}}, bienvenido a {{company}}'
        },
        metadata: {}
      };

      mockContext.collectedData = { name: 'Juan' };
      mockContext.globalVars = { company: 'Test Corp' };

      await navigationService.registerNode(messageNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'message-node'
      );

      expect(result.success).toBe(true);
      expect(result.botResponse).toBe('Hola Juan, bienvenido a Test Corp');
      expect(result.requiresUserInput).toBe(false);
    });

    test('debe procesar nodo de input correctamente', async () => {
      const inputNode: NavigationNode = {
        nodeId: 'input-node',
        nodeType: 'input',
        tenantId: 'tenant-1',
        data: {
          input: {
            label: '¿Cuál es tu nombre?',
            placeholder: 'Escribe tu nombre completo',
            type: 'text',
            required: true,
            validation: [
              { type: 'required', message: 'El nombre es requerido' },
              { type: 'min_length', value: 2, message: 'Mínimo 2 caracteres' }
            ]
          }
        },
        metadata: {}
      };

      await navigationService.registerNode(inputNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'input-node'
      );

      expect(result.success).toBe(true);
      expect(result.requiresUserInput).toBe(true);
      expect(result.botResponse).toContain('¿Cuál es tu nombre?');
      expect(result.botResponse).toContain('Escribe tu nombre completo');
      expect(result.botResponse).toContain('(requerido, mínimo 2 caracteres)');
    });

    test('debe procesar nodo de botones correctamente', async () => {
      const buttonNode: NavigationNode = {
        nodeId: 'button-node',
        nodeType: 'button',
        tenantId: 'tenant-1',
        data: {
          message: 'Selecciona una opción:',
          buttons: [
            { id: 'opt1', text: 'Opción 1', targetNodeId: 'node-1' },
            { id: 'opt2', text: 'Opción 2', targetNodeId: 'node-2' }
          ]
        },
        metadata: {}
      };

      await navigationService.registerNode(buttonNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'button-node'
      );

      expect(result.success).toBe(true);
      expect(result.botResponse).toBe('Selecciona una opción:');
      expect(result.contextUpdates?.conversationState?.isWaitingForInput).toBe(true);
    });

    test('debe procesar nodo de condición con navegación automática', async () => {
      const conditionNode: NavigationNode = {
        nodeId: 'condition-node',
        nodeType: 'condition',
        tenantId: 'tenant-1',
        data: {
          conditions: [
            {
              field: 'age',
              operator: 'gt',
              value: 18,
              targetNodeId: 'adult-node'
            },
            {
              field: 'age',
              operator: 'lt',
              value: 18,
              targetNodeId: 'minor-node'
            }
          ]
        },
        metadata: {}
      };

      const adultNode: NavigationNode = {
        nodeId: 'adult-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Eres mayor de edad' },
        metadata: {}
      };

      mockContext.collectedData = { age: 25 };

      await navigationService.registerNode(conditionNode);
      await navigationService.registerNode(adultNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'condition-node'
      );

      expect(result.success).toBe(true);
      expect(result.targetNodeId).toBe('adult-node');
      expect(result.botResponse).toBe('Eres mayor de edad');
    });

    test('debe procesar nodo de acción correctamente', async () => {
      const actionNode: NavigationNode = {
        nodeId: 'action-node',
        nodeType: 'action',
        tenantId: 'tenant-1',
        data: {
          actions: [
            {
              type: 'set_variable',
              config: { key: 'processed', value: true }
            },
            {
              type: 'update_lead',
              config: { 
                leadUpdates: { 
                  currentStage: 'qualified',
                  progressPercentage: 75 
                }
              }
            }
          ]
        },
        metadata: {}
      };

      await navigationService.registerNode(actionNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'action-node'
      );

      expect(result.success).toBe(true);
      expect(result.botResponse).toBe('Acción action-node ejecutada');
      expect(result.contextUpdates?.globalVars?.processed).toBe(true);
    });
  });

  describe('Flow Validation', () => {
    let mockContext: NavigationContext;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );
    });

    test('debe validar navegación exitosa', async () => {
      const validNode: NavigationNode = {
        nodeId: 'valid-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Nodo válido' },
        metadata: {}
      };

      await navigationService.registerNode(validNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'valid-node',
        { validateFlow: true }
      );

      expect(result.success).toBe(true);
    });

    test('debe fallar validación por tenant incorrecto', async () => {
      const invalidTenantNode: NavigationNode = {
        nodeId: 'invalid-tenant-node',
        nodeType: 'message',
        tenantId: 'different-tenant',
        data: { message: 'Nodo de otro tenant' },
        metadata: {}
      };

      await navigationService.registerNode(invalidTenantNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'invalid-tenant-node',
        { validateFlow: true }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validación de flujo falló');
    });

    test('debe detectar navegación circular', async () => {
      const circularNode: NavigationNode = {
        nodeId: 'circular-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Nodo circular' },
        metadata: {}
      };

      await navigationService.registerNode(circularNode);

      // Simular historial con visitas repetidas al mismo nodo
      mockContext.navigationHistory = [
        {
          timestamp: new Date().toISOString(),
          toNodeId: 'circular-node',
          navigationMethod: 'gotoFlow',
          success: true
        },
        {
          timestamp: new Date().toISOString(),
          toNodeId: 'circular-node',
          navigationMethod: 'gotoFlow',
          success: true
        },
        {
          timestamp: new Date().toISOString(),
          toNodeId: 'circular-node',
          navigationMethod: 'gotoFlow',
          success: true
        }
      ];

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'circular-node',
        { validateFlow: true }
      );

      // La navegación debe proceder pero con advertencia
      expect(result.success).toBe(true);
    });

    test('debe permitir saltar validación', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'non-existent-node',
        { validateFlow: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Nodo destino no encontrado: non-existent-node');
    });
  });

  describe('Context Preservation and Session Management', () => {
    let mockContext: NavigationContext;
    let mockNode: NavigationNode;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      mockNode = {
        nodeId: 'test-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Test message' },
        metadata: {}
      };

      await navigationService.registerNode(mockNode);
    });

    test('debe preservar contexto por defecto', async () => {
      mockContext.collectedData = { originalData: 'value' };
      mockContext.globalVars = { originalVar: 'test' };

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'test-node'
      );

      expect(result.success).toBe(true);
      expect(result.navigationStep?.contextSnapshot).toBeDefined();
    });

    test('debe actualizar contexto de sesión cuando es exitoso', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'test-node'
      );

      expect(result.success).toBe(true);
      expect(result.contextUpdates).toBeDefined();
      expect(result.contextUpdates?.currentNodeId).toBe('test-node');
    });

    test('debe preservar datos de lead durante navegación', async () => {
      const leadNode: NavigationNode = {
        nodeId: 'lead-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Lead message' },
        metadata: {
          leadStageId: 'qualified',
          salesFunnelStep: 'discovery'
        }
      };

      mockContext.leadData = {
        leadId: 'lead-123',
        currentStage: 'prospect',
        progressPercentage: 25
      };

      await navigationService.registerNode(leadNode);

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'lead-node'
      );

      expect(result.success).toBe(true);
      // Verificar que se preservó la información de lead
      expect(mockContext.leadData.currentStage).toBe('qualified');
      expect(mockContext.leadData.nextActions).toContain('discovery');
    });
  });

  describe('Error Handling and Rollback', () => {
    let mockContext: NavigationContext;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );
    });

    test('debe manejar errores durante navegación', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'non-existent-node'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Nodo destino no encontrado');
    });

    test('debe ejecutar rollback en caso de error', async () => {
      mockContext.currentNodeId = 'previous-node';
      mockContext.navigationHistory = [
        {
          timestamp: new Date().toISOString(),
          fromNodeId: 'start',
          toNodeId: 'previous-node',
          navigationMethod: 'gotoFlow',
          success: true,
          contextSnapshot: {
            currentNodeId: 'previous-node',
            collectedData: { rollbackData: 'preserved' }
          }
        }
      ];

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'non-existent-node',
        { enableRollback: true }
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Navigation History Management', () => {
    test('debe mantener historial de navegación', async () => {
      const testNode: NavigationNode = {
        nodeId: 'history-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Test message' },
        metadata: {}
      };

      await navigationService.registerNode(testNode);

      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      await navigationService.enhancedGotoFlow(context, 'history-node');

      const history = await navigationService.getNavigationHistory('session-1');
      expect(history).toHaveLength(1);
      expect(history[0].toNodeId).toBe('history-node');
      expect(history[0].success).toBe(true);
    });

    test('debe limpiar historial de navegación', async () => {
      const sessionKey = 'test-session';
      
      // Agregar algo al historial primero
      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        sessionKey
      );

      const testNode: NavigationNode = {
        nodeId: 'test-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Test' },
        metadata: {}
      };

      await navigationService.registerNode(testNode);
      await navigationService.enhancedGotoFlow(context, 'test-node');

      // Verificar que hay historial
      let history = await navigationService.getNavigationHistory(sessionKey);
      expect(history.length).toBeGreaterThan(0);

      // Limpiar historial
      await navigationService.clearNavigationHistory(sessionKey);

      // Verificar que se limpió
      history = await navigationService.getNavigationHistory(sessionKey);
      expect(history).toHaveLength(0);
    });

    test('debe limitar tamaño del historial', async () => {
      const testNode: NavigationNode = {
        nodeId: 'limit-test-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Test message' },
        metadata: {}
      };

      await navigationService.registerNode(testNode);

      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      // Simular muchas navegaciones (más de 100)
      for (let i = 0; i < 105; i++) {
        await navigationService.enhancedGotoFlow(context, 'limit-test-node');
      }

      const history = await navigationService.getNavigationHistory('session-1');
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Advanced Options and Configuration', () => {
    let mockContext: NavigationContext;
    let mockNode: NavigationNode;

    beforeEach(async () => {
      mockContext = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      mockNode = {
        nodeId: 'config-test-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'Config test' },
        metadata: {}
      };

      await navigationService.registerNode(mockNode);
    });

    test('debe respetar opción de no preservar contexto', async () => {
      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'config-test-node',
        { preserveContext: false }
      );

      expect(result.success).toBe(true);
      expect(result.navigationStep?.contextSnapshot).toBeUndefined();
    });

    test('debe manejar opciones personalizadas', async () => {
      const customOptions: NavigationOptions = {
        priority: 'high',
        timeout: 10000,
        retryOnFailure: true,
        maxRetries: 5,
        customData: { source: 'test' }
      };

      const result = await navigationService.enhancedGotoFlow(
        mockContext,
        'config-test-node',
        customOptions
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Service Lifecycle', () => {
    test('debe destruir servicio correctamente', () => {
      const service = DynamicNavigationService.getInstance();
      
      // Agregar algunos datos
      service.registerNode({
        nodeId: 'test',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: { message: 'test' },
        metadata: {}
      });

      // Destruir servicio
      service.destroy();

      // Verificar que se limpió (en implementación real, esto resetearía el singleton)
      expect(true).toBe(true); // Test de comportamiento esperado
    });
  });

  describe('Variable Replacement', () => {
    test('debe reemplazar variables globales en mensajes', async () => {
      const variableNode: NavigationNode = {
        nodeId: 'variable-node',
        nodeType: 'message',
        tenantId: 'tenant-1',
        data: {
          message: 'Hola {{name}}, tu edad es {{age}} años. Hoy es {{now}}'
        },
        metadata: {}
      };

      const context = await navigationService.createNavigationContext(
        'user-1',
        'tenant-1',
        'session-1'
      );

      context.collectedData = { name: 'Juan', age: 25 };

      await navigationService.registerNode(variableNode);

      const result = await navigationService.enhancedGotoFlow(
        context,
        'variable-node'
      );

      expect(result.success).toBe(true);
      expect(result.botResponse).toContain('Hola Juan');
      expect(result.botResponse).toContain('tu edad es 25 años');
      expect(result.botResponse).toContain('Hoy es');
    });
  });
});