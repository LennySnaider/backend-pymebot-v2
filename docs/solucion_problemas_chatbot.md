# Solución a Problemas del Chatbot

*Versión 1.0 - Actualizado: 11 de mayo de 2025*

## Problemas Solucionados

### 1. Visualización incorrecta de mensajes múltiples

**Problema:** El chatbot mostraba "Mensaje procesado" en lugar del mensaje real de confirmación de cita o el mensaje de despedida.

**Solución implementada:** 
- Se modificó el manejo de respuestas en el backend para mejorar el formato de mensajes múltiples.
- Se actualizó `src/services/botFlowIntegration.ts` para manejar correctamente mensajes de tipo múltiple.
- Se mejoró el procesamiento en `src/api/text.ts` para asegurar que los mensajes se envíen correctamente al frontend.

**Detalles técnicos (Backend):**
El problema principal estaba en cómo el backend manejaba los mensajes de tipo múltiple. Cuando se detectaba una secuencia de mensajes (como confirmación de cita seguida de un mensaje de despedida), el sistema usaba un formato con `is_multi_message` y un array de `messages`, pero el frontend no estaba procesando correctamente este formato.

Cambios específicos:
1. Se mejoró el manejo de estado en `flowRegistry.ts` para rastrear correctamente mensajes múltiples
2. Se implementó mejor manejo de respuestas en `botFlowIntegration.ts`
3. Se agregaron verificaciones adicionales en `text.ts` para garantizar que los mensajes se envíen correctamente

**Archivos modificados en el backend:**
- `src/services/botFlowIntegration.ts`
- `src/services/flowRegistry.ts`
- `src/api/text.ts`

### 2. Procesamiento de nodos con waitForResponse=true

**Problema:** Algunos nodos del chatbot que requerían respuesta del usuario (`waitForResponse=true`) no procesaban correctamente el flujo después de recibir la respuesta.

**Solución implementada:**
- Se corrigió el procesamiento de nodos para mantener el estado de espera correctamente.
- Se implementó una mejor gestión del estado `waitingForInput` y `waitingNodeId`.
- Se mejoró la detección y almacenamiento de respuestas del usuario.

### 3. Auto-flow entre nodos

**Problema:** El chatbot no avanzaba automáticamente entre nodos cuando no se requería respuesta del usuario.

**Solución implementada:**
- Se desarrolló un sistema de auto-flow que permite avanzar automáticamente entre nodos.
- Se agregó soporte para detectar nodos de despedida y manejarlos adecuadamente.
- Se implementó una estrategia para enviar mensajes separados cuando es necesario.

## Problemas Pendientes

### 1. Comportamiento de reinicio al final de conversación

**Problema:** En algunos casos, al finalizar completamente un flujo conversacional, el chatbot reinicia desde el principio en lugar de mantener el contexto.

**Estado:** Pendiente de solución en Fase 3

### 2. Problemas con persistencia de estado al cambiar entre nodos

**Problema:** Ocasionalmente, al cambiar entre ciertos tipos de nodos, se puede perder parte del estado o variables del contexto.

**Estado:** Parcialmente resuelto, pendiente de optimización en Fase 3

## Mejores Prácticas Implementadas

### 1. Manejo de Respuestas Múltiples en el Backend

```typescript
// En botFlowIntegration.ts
// Si detectamos que es un nodo final o de despedida
if (result.state?.isEndNode && result.state?.endMessage) {
  // Guardar para enviar como mensajes separados
  result.state.sendDespedidaAsSeparateMessage = true;
  
  // Enviar los mensajes como un array
  return {
    response: result.response,
    state: result.state,
    metrics: result.metrics
  };
}
```

### 2. Manejo de Mensajes Separados en API

```typescript
// En text.ts
// Comprobar si tenemos un mensaje de despedida para enviar por separado
if (botResponse?.state?.sendDespedidaAsSeparateMessage === true &&
    botResponse?.state?.endMessage) {
    
    const despedidaMessage = botResponse.state.endMessage;
    
    // Enviar los mensajes como array
    return res.json({
        success: true,
        is_multi_message: true,
        messages: [
            responseText,  // Confirmación de cita
            despedidaMessage // Mensaje de despedida
        ],
        processing_time_ms: processingTime,
        tokens_used: tokensUsed
    });
}
```

### 3. Auto-flow Entre Nodos

Implementación de avance automático entre nodos:

```typescript
// Si el nodo actual no requiere respuesta del usuario
if (!currentNode.waitForResponse) {
    // Buscar siguiente nodo y avanzar automáticamente
    const nextNode = findNextNode(currentNode);
    if (nextNode) {
        // Procesar automáticamente el siguiente nodo
        await processNode(nextNode);
    }
}
```

## Integración con Variables del Sistema

Para una integración correcta con variables del sistema:

1. Asegurarse de que las variables se almacenen correctamente en el estado del flujo
2. Verificar que los reemplazos de variables funcionen en todos los tipos de nodos
3. Mantener consistencia en el formato de nombres de variables

## Recomendaciones para Desarrolladores Backend

1. **Pruebas de estado persistente**: Verificar que el estado se mantenga correctamente entre mensajes.
2. **Logs detallados**: Mantener logs descriptivos para facilitar la depuración.
3. **Validación de formatos de respuesta**: Asegurar que las respuestas del backend sigan un formato consistente.
4. **Manejo de errores**: Implementar recuperación adecuada en caso de errores en el procesamiento.

## Documentación Relacionada

- [Arquitectura del Chatbot](../ARQUITECTURA_CHATBOT.md)
- [Guía de BuilderBot](../GUIA_BUILDERBOT.md)
- [Solución a Problemas del Chatbot (Frontend)](../../v2-frontend-pymebot/docs/solucion_problemas_chatbot.md)

---

*Documento creado: 11 de mayo de 2025*
*Última actualización: 11 de mayo de 2025*