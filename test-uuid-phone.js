
// Test para verificar si el problema es con la creación de leads
console.log('Iniciando test de flujo con captura de email...');

const testFlow = async () => {
  try {
    // Simular el contexto cuando se captura el email
    const ctx = {
      from: '39740726-3e92-4003-8e71-9c372048d22e',
      body: 'test@email.com',
      _metadata: {
        tenantId: 'test-tenant',
        sessionId: 'test-session'
      }
    };
    
    const state = {
      getMyState: async () => ({
        nombre_usuario: 'Maria',
        tenantId: 'test-tenant'
      }),
      update: async (data) => {
        console.log('State update:', data);
      }
    };
    
    // Verificar qué pasa cuando se intenta crear un lead con un UUID como phoneNumber
    console.log('phoneNumber es UUID:', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ctx.from));
    
  } catch (error) {
    console.error('Error en test:', error);
  }
};

testFlow();

