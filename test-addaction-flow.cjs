#!/usr/bin/env node

const { addKeyword, createFlow, createBot, MemoryDB, createProvider } = require('@builderbot/bot');

console.log('🧪 [TEST ADDACTION] Probando el flujo addAction directamente...');

// Simular contexto mínimo
const mockCtx = {
  body: 'hola',
  from: 'test-user',
  _metadata: { tenantId: 'test-tenant' },
  _sessionId: 'test-session'
};

// Mock de state
const mockState = {
  data: {},
  update: async function(newData) {
    Object.assign(this.data, newData);
    console.log('🔧 [MOCK STATE] Estado actualizado:', this.data);
  },
  getMyState: function() {
    return this.data;
  }
};

// Mock de flowDynamic
const mockFlowDynamic = async function(message) {
  console.log('📤 [MOCK FLOW] Mensaje dinámico:', message);
};

// Función async principal
async function testAddActionFlow() {
  // Cargar el flujo actualizado
  console.log('🧪 [TEST ADDACTION] Cargando flujo funcional...');

  try {
    const { welcomeFlow } = require('./src/flows/direct-functional-flow.cjs');
    
    console.log('🧪 [TEST ADDACTION] Flujo cargado correctamente');
    console.log('🧪 [TEST ADDACTION] Tipo de welcomeFlow:', typeof welcomeFlow);
    
    // Crear el bot con el flujo
    const flow = createFlow([welcomeFlow]);
    console.log('🧪 [TEST ADDACTION] Flow creado:', typeof flow);
    
    // Verificar estructura
    console.log('🧪 [TEST ADDACTION] Flow properties:', Object.keys(flow));
    
    // Probar addAction manualmente simulando la ejecución
    console.log('🧪 [TEST ADDACTION] Simulando ejecución del addAction...');
    
    // Buscar callbacks en el flujo
    const flowRaw = flow.flowRaw || {};
    console.log('🧪 [TEST ADDACTION] flowRaw keys:', Object.keys(flowRaw));
    
    if (flowRaw && Object.keys(flowRaw).length > 0) {
      const firstNode = Object.values(flowRaw)[0];
      console.log('🧪 [TEST ADDACTION] Primer nodo ref:', firstNode.ref);
      
      // Buscar callback en callbacks del nodo
      if (firstNode && firstNode.ctx && firstNode.ctx.callbacks) {
        const callbacks = firstNode.ctx.callbacks;
        console.log('🧪 [TEST ADDACTION] Callbacks disponibles:', Object.keys(callbacks));
        
        // Buscar el primer callback que tenga addAction (debe ser async)
        const callbackKey = Object.keys(callbacks).find(key => 
          callbacks[key].constructor.name === 'AsyncFunction'
        );
        
        if (callbackKey) {
          console.log('🧪 [TEST ADDACTION] Ejecutando callback:', callbackKey);
          
          try {
            await callbacks[callbackKey](mockCtx, {
              state: mockState,
              flowDynamic: mockFlowDynamic
            });
            
            console.log('✅ [TEST ADDACTION] ¡Callback ejecutado exitosamente!');
            console.log('✅ [TEST ADDACTION] Estado final:', mockState.data);
            
          } catch (error) {
            console.error('❌ [TEST ADDACTION] Error en callback:', error);
          }
        } else {
          console.log('⚠️ [TEST ADDACTION] No se encontró callback async');
        }
      } else {
        console.log('⚠️ [TEST ADDACTION] No se encontraron callbacks en el nodo');
      }
    } else {
      console.log('⚠️ [TEST ADDACTION] flowRaw vacío o indefinido');
    }
    
  } catch (error) {
    console.error('❌ [TEST ADDACTION] Error cargando flujo:', error);
  }

  console.log('🧪 [TEST ADDACTION] Test completado');
}

// Ejecutar el test
testAddActionFlow();