const { addKeyword } = require('@builderbot/bot');

// Test: Combinar mensaje + lista en un solo nodo
const testCombinedFlow = addKeyword("testcombinado").addAnswer(
    "Mucho gusto {{nombre_usuario}}! Gracias por tu mensaje", // Mensaje inicial
    { capture: true }, // Esperar respuesta del usuario 
    async (ctx, { state, flowDynamic, provider }) => {
        console.log('[TEST] Ejecutando callback combinado...');
        console.log('[TEST] Provider disponible:', !!provider);
        console.log('[TEST] flowDynamic disponible:', !!flowDynamic);
        
        // Intentar enviar la lista inmediatamente después del mensaje
        const list = {
            body: {
                text: "Ahora selecciona una opción:",
            },
            action: {
                button: "Ver opciones",
                sections: [{
                    rows: [
                        { id: "opt1", title: "Opción 1", description: "Primera opción" },
                        { id: "opt2", title: "Opción 2", description: "Segunda opción" },
                        { id: "opt3", title: "Opción 3", description: "Tercera opción" }
                    ]
                }]
            }
        };
        
        try {
            // Probar diferentes métodos para enviar la lista
            if (provider && typeof provider.sendList === 'function') {
                await provider.sendList(ctx.from, list);
                console.log('[TEST] Lista enviada con provider.sendList');
            } else if (flowDynamic) {
                await flowDynamic(list);
                console.log('[TEST] Lista enviada con flowDynamic');
            } else {
                console.log('[TEST] No se pudo enviar la lista - sin métodos disponibles');
            }
            
            // Guardar la respuesta del usuario
            await state.update({ 
                respuesta_lista: ctx.body,
                nombre_usuario: state.nombre_usuario || 'Usuario'
            });
            
        } catch (error) {
            console.error('[TEST] Error enviando lista:', error);
        }
    }
);

module.exports = { testCombinedFlow };