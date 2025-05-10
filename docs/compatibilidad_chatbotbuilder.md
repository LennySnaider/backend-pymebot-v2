# Compatibilidad del Constructor Visual con el Backend

## Análisis del Chatbot Builder

El Constructor Visual de Flujos de IA (Chatbot Builder) que se muestra en la interfaz de PYMEBOT es una herramienta diseñada exclusivamente para el super_admin. Esta interfaz proporciona una forma visual e intuitiva de crear flujos conversacionales complejos que luego se comparten con los tenants como plantillas.

### Elementos de la Interfaz

Como se observa en la imagen compartida, la interfaz del constructor visual incluye:

1. **Barra de Navegación Superior**: Muestra la ruta actual ("Panel > Herramientas de Admin > Constructor Visual de Chatbot > Editor de Flujo").

2. **Barra de Herramientas**: Incluye opciones como "Vista previa", "Generar con IA" y "Exportar".

3. **Área de Diseño Central**: Espacio donde se arrastran y conectan los nodos para crear el flujo.

4. **Panel Lateral de Tipos de Nodos**: Muestra los diferentes tipos de nodos disponibles:
   - Mensaje: Para enviar texto al usuario
   - Respuesta IA: Para generar respuestas con IA
   - AI Voice Agent: Nodo combinado de IA y voz
   - Condición: Para bifurcar el flujo basado en condiciones
   - Entrada: Para solicitar información al usuario
   - Text-to-Speech: Para convertir texto a voz
   - Speech-to-Text: Para capturar voz del usuario
   - Fin: Para finalizar la conversación

### Compatibilidad con el Backend

El backend que hemos implementado es totalmente compatible con la interfaz del constructor visual:

1. **Modelo de Datos**:
   - Los tipos de nodos en la interfaz (`Message`, `Respuesta AI`, `AI Voice Agent`, etc.) corresponden directamente con los tipos definidos en `NodeType` en nuestro modelo de datos.
   - Las propiedades visuales (posición x,y) se almacenan en el modelo de nodos.
   - El backend soporta todos los metadatos necesarios para cada tipo de nodo.

2. **Formato de Exportación/Importación**:
   - El botón "Exportar" en la interfaz genera un archivo JSON que sigue exactamente el formato que espera nuestra API `/api/flows` para crear flujos.
   - Los flujos creados se pueden convertir en plantillas mediante la API `/api/templates/from-flow/:flowId`.

3. **Generación con IA**:
   - La opción "Generar con IA" en la interfaz puede utilizar nuestro backend para generar estructuras de flujos básicas que luego pueden ser refinadas visualmente.

4. **Nodos de Voz**:
   - El constructor soporta nodos específicos para voz (`AI Voice Agent`, `Text-to-Speech`, `Speech-to-Text`) que se integran perfectamente con nuestro servicio de voz existente mediante la API `/api/voice`.

## Flujo de Trabajo

El flujo de trabajo para la creación y uso de flujos conversacionales es el siguiente:

1. **Super_Admin**:
   - Accede al Constructor Visual de Chatbot mediante la interfaz de PYMEBOT
   - Crea visualmente un flujo arrastrando y conectando nodos
   - Puede utilizar "Generar con IA" para acelerar la creación
   - Guarda el flujo en el sistema mediante la API
   - Convierte el flujo en una plantilla, marcando qué nodos pueden ser editados por los tenants

2. **Tenants**:
   - No tienen acceso al Constructor Visual completo
   - Pueden ver las plantillas disponibles creadas por el super_admin
   - Pueden instanciar las plantillas para crear sus propios flujos
   - Pueden realizar modificaciones limitadas a los nodos marcados como editables
   - Pueden activar o desactivar flujos para su uso

## Limitaciones para Tenants

En lugar del constructor visual completo, los tenants tendrán una interfaz simplificada que les permitirá:

1. Ver una lista de plantillas disponibles
2. Crear instancias a partir de plantillas
3. Editar de forma limitada:
   - El nombre y descripción del flujo
   - El contenido y ciertos metadatos de nodos específicos marcados como editables
   - No pueden modificar la estructura del flujo (añadir/eliminar nodos o cambiar conexiones)

## Mapeo Técnico

| Elemento Visual | Tipo en Backend | Propiedades Principales |
|-----------------|-----------------|-------------------------|
| Mensaje | `NodeType.MESSAGE` | content, metadata.role, metadata.delay |
| Respuesta AI | `NodeType.MESSAGE` (con metadatos específicos) | content, metadata.ai_prompt, metadata.role |
| AI Voice Agent | `NodeType.AI_VOICE_AGENT` | content, metadata.voiceId, metadata.aiPrompt |
| Condición | `NodeType.CONDITION` | next (array de ConditionalNext) |
| Entrada | `NodeType.INPUT` | content, metadata.inputType |
| Text-to-Speech | `NodeType.TEXT_TO_SPEECH` | content, metadata.voiceId, metadata.speed |
| Speech-to-Text | `NodeType.SPEECH_TO_TEXT` | content, metadata.language |
| Fin | `NodeType.END` | content |

## Códigos JSON Generados

El constructor visual genera estructuras JSON que son compatibles con nuestra API. Por ejemplo:

```json
{
  "name": "Flujo de Bienvenida",
  "description": "Saluda al usuario y ofrece opciones",
  "version": "1.0.0",
  "nodes": {
    "node1": {
      "id": "node1",
      "type": "message",
      "content": "¡Bienvenido a nuestro servicio!",
      "metadata": {
        "role": "bot",
        "delay": 500
      },
      "next": "node2",
      "x": 100,
      "y": 200
    },
    "node2": {
      "id": "node2",
      "type": "ai_voice_agent",
      "content": "Como asistente virtual inteligente y amable en forma de voz, mi objetivo es...",
      "metadata": {
        "voiceId": "Calm_Woman",
        "speed": 1.0
      },
      "next": "node3",
      "x": 300,
      "y": 200
    },
    "node3": {
      "id": "node3",
      "type": "condition",
      "content": "Analizando respuesta...",
      "next": [
        {
          "condition": {
            "type": "contains",
            "value": "ayuda",
            "caseSensitive": false
          },
          "nextNodeId": "node4"
        },
        {
          "condition": {
            "type": "contains",
            "value": "información",
            "caseSensitive": false
          },
          "nextNodeId": "node5"
        }
      ],
      "x": 500,
      "y": 200
    },
    // Más nodos...
  },
  "entryNodeId": "node1"
}
```

## Conclusión

El Constructor Visual de Flujos de IA que se muestra en la interfaz de PYMEBOT es perfectamente compatible con la arquitectura de backend que hemos implementado. La separación clara entre las capacidades del super_admin (acceso completo al constructor visual) y los tenants (modificaciones limitadas a través de plantillas) garantiza un sistema flexible pero controlado.

El backend que hemos desarrollado soporta todos los tipos de nodos y funcionalidades que ofrece la interfaz visual, y está diseñado para funcionar de manera óptima con ella, manteniendo al mismo tiempo un control estricto sobre qué pueden modificar los tenants.
