const { addKeyword } = require('@builderbot/bot');

// Flujo de prueba para validar listas
const flowGrado = addKeyword("testlista").addAction(
    async (ctx, { provider }) => {
      const list = {
        body: {
          text: "Por favor, elige un *grado* para poder continuar. 🤗",
        },
        action: {
          button: "Ver opciones",
          sections: [
            {
              rows: [
                { id: "grado_1_id", title: "3 años", description: "INICIAL" },
                { id: "grado_2_id", title: "4 años", description: "INICIAL" },
                { id: "grado_3_id", title: "5 años", description: "INICIAL" },
                { id: "grado_4_id", title: "1° grado", description: "PRIMARIA" },
                { id: "grado_5_id", title: "1° grado", description: "SECUNDARIA" }
              ],
            },
          ],
        },
      };
      
      console.log('Enviando lista con provider.sendList...');
      
      // Enviar la lista de grados al usuario
      if (provider && typeof provider.sendList === 'function') {
        await provider.sendList(ctx.from, list);
        console.log('Lista enviada correctamente');
      } else {
        console.log('provider.sendList no disponible');
        console.log('Provider disponible:', !!provider);
        console.log('Métodos del provider:', provider ? Object.getOwnPropertyNames(provider) : 'N/A');
      }
    }
  );

module.exports = { flowGrado };