/**
 * Script para registrar el flujo simple en el FlowRegistry
 * Este flujo demuestra el patrón correcto de BuilderBot
 */

const { createBot, createProvider, createFlow } = require('@builderbot/bot');
const { WebWhatsAppProvider } = require('@builderbot/provider-web-whatsapp');
const { MemoryDB } = require('@builderbot/database-memory');

// Importar nuestro flujo simple
const { welcomeFlow, mainFlow } = require('./src/flows/simple-working-flow.cjs');

async function registerSimpleFlow() {
  console.log('🚀 Registrando flujo simple...');
  
  try {
    // Crear el provider (usando memory para testing)
    const provider = createProvider(WebWhatsAppProvider);
    
    // Crear la base de datos
    const database = new MemoryDB();
    
    // Crear el flujo
    const adapterFlow = createFlow([welcomeFlow, mainFlow]);
    
    // Crear el bot
    const bot = createBot({
      flow: adapterFlow,
      provider,
      database,
    });
    
    console.log('✅ Flujo simple registrado exitosamente');
    console.log('📝 El flujo incluye:');
    console.log('   - Responde a "hola", "inicio", "start"');
    console.log('   - Captura nombre y teléfono');
    console.log('   - Muestra categorías y productos');
    console.log('   - Usa el patrón correcto de EVENTS.ACTION');
    
    // Retornar el bot para uso en el sistema
    return bot;
    
  } catch (error) {
    console.error('❌ Error registrando flujo simple:', error);
    throw error;
  }
}

// Exportar para uso en otros archivos
module.exports = {
  registerSimpleFlow,
  welcomeFlow,
  mainFlow
};

// Si se ejecuta directamente, registrar el flujo
if (require.main === module) {
  registerSimpleFlow()
    .then(() => {
      console.log('🎉 Flujo simple listo para usar');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}