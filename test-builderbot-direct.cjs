// Test directo de BuilderBot para verificar que funciona
const { createBot, createFlow, addKeyword, MemoryDB } = require('@builderbot/bot');

async function testDirectBot() {
    console.log('🧪 Iniciando test directo de BuilderBot...');
    
    try {
        // Crear flujo simple
        const welcomeFlow = addKeyword(['hola', 'test'])
            .addAnswer('🤖 ¡Hola! BuilderBot está funcionando correctamente.')
            .addAnswer('Este es un mensaje de prueba.', { capture: true }, async (ctx, { state }) => {
                console.log('✅ Respuesta capturada:', ctx.body);
                await state.update({ test: ctx.body });
            });
        
        const mainFlow = createFlow([welcomeFlow]);
        
        // Crear provider simple
        class TestProvider {
            constructor() {
                this.vendor = this;
                this.listeners = {};
            }
            
            on(event, callback) {
                if (!this.listeners[event]) {
                    this.listeners[event] = [];
                }
                this.listeners[event].push(callback);
                console.log(`✅ Listener registrado para evento: ${event}`);
            }
            
            emit(event, ...args) {
                console.log(`📤 Emitiendo evento: ${event}`);
                if (this.listeners[event]) {
                    this.listeners[event].forEach(callback => callback(...args));
                }
            }
            
            sendMessage(to, message, options) {
                console.log(`📨 Mensaje enviado a ${to}:`, message);
                return Promise.resolve();
            }
        }
        
        const provider = new TestProvider();
        const database = new MemoryDB();
        
        // Crear bot
        console.log('🔧 Creando bot...');
        const bot = await createBot({
            flow: mainFlow,
            provider: provider,
            database: database
        });
        
        console.log('✅ Bot creado exitosamente');
        console.log('🔍 Bot tiene handleMsg:', typeof bot.handleMsg);
        
        // Simular mensaje
        console.log('\n📥 Simulando mensaje "hola"...');
        provider.emit('message', {
            from: 'test-user',
            body: 'hola',
            name: 'Test User'
        });
        
        // Esperar procesamiento
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('\n✅ Test completado');
        
    } catch (error) {
        console.error('❌ Error en test:', error);
    }
}

// Ejecutar test
testDirectBot();