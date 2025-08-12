/**
 * MOCK DE BUILDERBOT PARA TESTING
 * 
 * PROPÓSITO: Simular BuilderBot sin ejecutar flujos reales
 * COMPATIBILIDAD: Mantiene la interfaz de addKeyword, addAction, addAnswer
 */

import { jest } from '@jest/globals';

// Mock de addKeyword
export const addKeyword = jest.fn().mockImplementation((keywords: string[]) => ({
  addAction: jest.fn().mockImplementation((callback: Function) => ({
    addAnswer: jest.fn().mockImplementation((message: string, options: any, callback?: Function) => ({
      addAction: jest.fn().mockReturnThis(),
      addAnswer: jest.fn().mockReturnThis()
    }))
  })),
  
  addAnswer: jest.fn().mockImplementation((message: string, options: any, callback?: Function) => ({
    addAction: jest.fn().mockReturnThis(),
    addAnswer: jest.fn().mockReturnThis()
  }))
}));

// Mock de EVENTS
export const EVENTS = {
  WELCOME: 'WELCOME',
  MEDIA: 'MEDIA',
  LOCATION: 'LOCATION',
  DOCUMENT: 'DOCUMENT',
  VOICE_NOTE: 'VOICE_NOTE'
};

// Mock de MemoryDB
export const MemoryDB = jest.fn().mockImplementation(() => ({
  save: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  delete: jest.fn().mockResolvedValue(true),
  clear: jest.fn().mockResolvedValue(true)
}));

// Mock de Provider (para WhatsApp, Web, etc.)
export const MockProvider = jest.fn().mockImplementation(() => ({
  initProvider: jest.fn().mockResolvedValue(true),
  sendMessage: jest.fn().mockResolvedValue(true),
  on: jest.fn(),
  emit: jest.fn()
}));

// Mock de createBot
export const createBot = jest.fn().mockImplementation((config: any) => ({
  start: jest.fn().mockResolvedValue(true),
  stop: jest.fn().mockResolvedValue(true),
  addKeyword: addKeyword,
  on: jest.fn(),
  emit: jest.fn(),
  provider: new MockProvider(),
  database: new MemoryDB()
}));

// Mock de createFlow
export const createFlow = jest.fn().mockImplementation((flows: any[]) => flows);

// Mock de createProvider
export const createProvider = jest.fn().mockImplementation((ProviderClass: any) => new ProviderClass());

// Helpers para testing de BuilderBot
export const mockFlowContext = (overrides: any = {}) => ({
  from: '1234567890',
  body: 'test message',
  name: 'Test User',
  pushName: 'Test',
  ...overrides
});

export const mockFlowTools = (overrides: any = {}) => ({
  flowDynamic: jest.fn().mockResolvedValue(true),
  state: {
    getMyState: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue(true),
    clear: jest.fn().mockResolvedValue(true)
  },
  gotoFlow: jest.fn().mockResolvedValue(true),
  endFlow: jest.fn().mockResolvedValue(true),
  ...overrides
});

export const mockCaptureFlow = () => {
  const flow = addKeyword(['test']);
  
  return flow
    .addAction(async (ctx: any, tools: any) => {
      // Mock de acción de preparación
      await tools.state.update({ prepared: true });
      await tools.flowDynamic('Test preparation');
    })
    .addAnswer('Test message', { capture: true }, async (ctx: any, tools: any) => {
      // Mock de captura
      await tools.state.update({ captured: ctx.body });
      return tools.gotoFlow(mockNextFlow());
    });
};

export const mockNextFlow = () => addKeyword(['next']).addAnswer('Next flow');

// Reset para limpiar mocks entre tests
export const resetBuilderbotMocks = () => {
  jest.clearAllMocks();
};

export default {
  addKeyword,
  EVENTS,
  MemoryDB,
  MockProvider,
  createBot,
  createFlow,
  createProvider,
  mockFlowContext,
  mockFlowTools,
  mockCaptureFlow,
  mockNextFlow,
  resetBuilderbotMocks
};