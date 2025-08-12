/**
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO PARA TESTING
 * 
 * PROPÓSITO: Setup de environment variables para tests
 * SEGURIDAD: Variables de test, NO producción
 */

// Variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_KEY = 'test-anon-key';

// Variables específicas del proyecto
process.env.DEFAULT_CHATBOT_ID = 'test-chatbot-123';
process.env.DEFAULT_TENANT_ID = 'test-tenant-456';

// Configuración de timeout para tests
process.env.TEST_TIMEOUT = '30000';

// Deshabilitar logs en testing (opcional)
if (process.env.SILENT_TESTS === 'true') {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}

// Mock de fetch para evitar llamadas reales a APIs
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('OK')
  })
) as jest.Mock;

// Mock de setTimeout y setInterval para control de tiempo
jest.useFakeTimers({
  advanceTimers: true
});

export {};