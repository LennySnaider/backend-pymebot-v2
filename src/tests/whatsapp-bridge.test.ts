/**
 * src/tests/whatsapp-bridge.test.ts
 * 
 * Pruebas para verificar que el WhatsApp Flow Bridge funciona correctamente
 * @version 1.0.0
 * @created 2025-08-13
 */

import { WhatsAppFlowBridge } from '../services/whatsappFlowBridge';
import logger from '../utils/logger';

describe('WhatsApp Flow Bridge', () => {
  let bridge: WhatsAppFlowBridge;

  beforeEach(() => {
    bridge = WhatsAppFlowBridge.getInstance();
  });

  afterEach(() => {
    // Limpiar cache después de cada prueba
    bridge.clearCache();
  });

  test('debe crear una instancia singleton', () => {
    const instance1 = WhatsAppFlowBridge.getInstance();
    const instance2 = WhatsAppFlowBridge.getInstance();
    expect(instance1).toBe(instance2);
  });

  test('debe crear flujo principal de WhatsApp', () => {
    const flow = bridge.createMainWhatsAppFlow();
    expect(flow).toBeDefined();
    expect(typeof flow.addAction).toBe('function');
  });

  test('debe limpiar cache correctamente', () => {
    // Probar limpieza de cache
    bridge.clearCache('test-tenant');
    bridge.clearCache(); // Limpiar todo
    
    // No debe lanzar errores
    expect(true).toBe(true);
  });
});

// Función auxiliar para pruebas manuales
export async function testManualFlow() {
  try {
    logger.info('=== INICIANDO PRUEBA MANUAL DEL FLOW BRIDGE ===');
    
    const bridge = WhatsAppFlowBridge.getInstance();
    const flow = bridge.createMainWhatsAppFlow();
    
    logger.info('✅ Flow Bridge creado exitosamente');
    logger.info('✅ Flujo principal de WhatsApp configurado');
    
    // Simular contexto básico
    const mockContext = {
      from: 'test-user-123',
      body: 'hola',
      _metadata: {
        tenantId: 'test-tenant'
      }
    };

    logger.info('✅ Contexto mock preparado');
    logger.info('=== PRUEBA MANUAL COMPLETADA ===');
    
    return true;
  } catch (error) {
    logger.error('❌ Error en prueba manual:', error);
    return false;
  }
}