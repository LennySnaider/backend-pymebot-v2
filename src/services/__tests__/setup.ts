/**
 * SETUP PARA TESTS DE ENHANCED DATA CAPTURE
 * 
 * PROPÓSITO: Configurar entorno de testing global
 * INCLUYE: Mocks, configuración, helpers
 */

import { jest } from '@jest/globals';

// Configuración global de timeouts
jest.setTimeout(30000);

// Mock global de console para capturar logs sin interferir con tests
const originalConsole = global.console;

beforeEach(() => {
  // Setup antes de cada test
  jest.clearAllMocks();
  
  // Mock de console para tests que necesitan verificar logs
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
});

afterEach(() => {
  // Cleanup después de cada test
  jest.restoreAllMocks();
  
  // Restaurar console original
  global.console = originalConsole;
});

// Helper para crear datos de prueba consistentes
export const createMockData = () => ({
  tenantId: 'test-tenant-123',
  userId: 'test-user-456', 
  nodeId: 'test-node-789',
  templateId: 'test-template-101',
  leadId: 'test-lead-202',
  salesStageId: 'test-stage-303',
  
  nodeData: {
    id: 'test-node-789',
    content: {
      input: {
        label: '¿Cuál es tu nombre?',
        type: 'text'
      },
      responseMessage: 'Gracias {{name}}'
    }
  },
  
  leadData: {
    id: 'test-lead-202',
    name: 'Juan Pérez',
    phone: '+5218180001234',
    email: 'juan@test.com',
    tenant_id: 'test-tenant-123',
    sales_stage_id: 'test-stage-303'
  },
  
  currentState: {
    leadId: 'test-lead-202',
    salesStageId: 'test-stage-303',
    leadName: 'Juan Pérez',
    hybrid: {
      collectedData: {
        name: 'Juan',
        lead_name: 'Juan'
      }
    }
  }
});

// Helper para aserciones comunes
export const expectValidFallback = (result: any) => {
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
};

export const expectLeadSystemIntact = (integrityResult: any) => {
  expect(integrityResult).toBeDefined();
  expect(typeof integrityResult.intact).toBe('boolean');
  expect(Array.isArray(integrityResult.errors)).toBe(true);
};

export const expectValidErrorHandling = (errorResult: any) => {
  expect(errorResult).toBeDefined();
  expect(typeof errorResult.success).toBe('boolean');
  expect(typeof errorResult.fallbackActivated).toBe('boolean');
  expect(typeof errorResult.leadSystemIntact).toBe('boolean');
};

// Mock factories para datos complejos
export const createMockSupabaseResponse = (data: any = null, error: any = null) => ({
  data,
  error
});

export const createMockBuilderbotFlow = () => ({
  addAction: jest.fn().mockReturnThis(),
  addAnswer: jest.fn().mockReturnThis()
});

// Helpers para async testing
export const waitForPromises = () => new Promise(resolve => setImmediate(resolve));

export const mockAsyncFunction = <T>(returnValue: T, delay: number = 0) => {
  return jest.fn().mockImplementation(() => 
    new Promise(resolve => setTimeout(() => resolve(returnValue), delay))
  );
};

// Configuración para tests de integración
export const integrationTestConfig = {
  timeout: 10000,
  retries: 3,
  parallel: false
};

// Export para uso en tests
export default {
  createMockData,
  expectValidFallback,
  expectLeadSystemIntact,
  expectValidErrorHandling,
  createMockSupabaseResponse,
  createMockBuilderbotFlow,
  waitForPromises,
  mockAsyncFunction,
  integrationTestConfig
};