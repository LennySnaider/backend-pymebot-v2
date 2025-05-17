# Documentación de Flujos BuilderBot

## Problema Identificado

### Síntomas
1. **Timeout de 60 segundos**: El frontend reportaba timeout al esperar respuesta del backend
2. **Ejecución completa del flujo**: Al detectar palabra clave, el flujo ejecutaba todos los pasos sin esperar respuestas
3. **Respuestas incorrectas**: Las respuestas no correspondían con el estado actual del flujo

### Causa Raíz
- Patrón incorrecto en la implementación de flujos
- Falta de manejo de estado entre mensajes
- El flujo ejecutaba todo en una sola llamada

## Solución Implementada

### 1. Patrón Correcto de Flujos (Basado en v1)

```typescript
// PATRÓN INCORRECTO - Ejecuta todo de una vez
const badFlow = addKeyword(['hola'])
  .addAnswer('¿Nombre?', { capture: true })
  .addAnswer('¿Email?', { capture: true })
  .addAnswer('Gracias');

// PATRÓN CORRECTO - Espera respuestas usando estado
const goodFlow = addKeyword(['hola'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    await state.update({ step: 'waiting_name' });
    await flowDynamic('¿Nombre?');
  });

const captureFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const currentState = await state.getMyState();
    
    switch (currentState.step) {
      case 'waiting_name':
        await state.update({ 
          name: ctx.body,
          step: 'waiting_email'
        });
        await flowDynamic('¿Email?');
        break;
        
      case 'waiting_email':
        await state.update({ 
          email: ctx.body,
          step: 'completed'
        });
        await flowDynamic('Gracias');
        break;
    }
  });
```

### 2. Mejoras en el Endpoint

```typescript
// Añadir timeout para evitar colgarse
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 5000)
);

botResponse = await Promise.race([
  processMessageWithFlows(userId, text, tenantId),
  timeoutPromise
]);
```

### 3. Manejo de Estado

- Usar `state.update()` para guardar el progreso
- Verificar el estado actual antes de procesar
- Limpiar estado al iniciar nuevo flujo

## Funciones Clave de BuilderBot

### addKeyword
```typescript
addKeyword(['hola', 'inicio'])
// Define palabras clave que activan el flujo
```

### addAction
```typescript
.addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
  // Ejecuta lógica sin enviar mensaje
  // Útil para manejar estado y navegación
})
```

### addAnswer
```typescript
.addAnswer('Mensaje', { capture: true }, async (ctx, { state }) => {
  // Envía mensaje y opcionalmente captura respuesta
})
```

### flowDynamic
```typescript
await flowDynamic('Mensaje dinámico');
await flowDynamic(['Línea 1', 'Línea 2']);
// Envía mensajes de forma dinámica
```

### state
```typescript
await state.update({ key: 'value' });
const currentState = await state.getMyState();
await state.clear();
// Maneja el estado de la conversación
```

### gotoFlow
```typescript
return gotoFlow(otherFlow);
// Navega a otro flujo
```

## Flujo Ejemplo: Lead Capture

```typescript
const leadCaptureStart = addKeyword(['hola'])
  .addAction(async (ctx, { flowDynamic, state }) => {
    await state.clear();
    await state.update({ 
      step: 'waiting_name',
      flowActive: true 
    });
    
    await flowDynamic('👋 Hola, soy el asistente virtual.');
    await flowDynamic('¿Cuál es tu nombre?');
  });

const mainFlow = addKeyword(EVENTS.ACTION)
  .addAction(async (ctx, { flowDynamic, state }) => {
    const currentState = await state.getMyState();
    
    if (!currentState?.flowActive) return;
    
    switch (currentState.step) {
      case 'waiting_name':
        await state.update({ 
          name: ctx.body,
          step: 'waiting_email'
        });
        
        await flowDynamic(`Mucho gusto ${ctx.body}!`);
        await flowDynamic('¿Cuál es tu correo electrónico?');
        break;
        
      case 'waiting_email':
        await state.update({ 
          email: ctx.body,
          step: 'completed',
          flowActive: false
        });
        
        await flowDynamic([
          'Gracias. He registrado:',
          `✅ Nombre: ${currentState.name}`,
          `✅ Email: ${ctx.body}`
        ]);
        break;
    }
  });
```

## Mejores Prácticas

1. **Usa `addAction` en lugar de `addAnswer` con capture**
   - Más control sobre el flujo
   - Mejor manejo de estado

2. **Maneja el estado explícitamente**
   - Guarda el paso actual
   - Verifica estado antes de procesar

3. **Usa `EVENTS.ACTION` para capturar todos los mensajes**
   - Permite procesar cualquier entrada
   - Flexible para flujos complejos

4. **Añade logs para debugging**
   ```typescript
   console.log("🔵 Estado actual:", currentState);
   ```

5. **Implementa timeout en endpoints**
   - Evita que el frontend se cuelgue
   - Proporciona mejor UX

## Referencias

- [BuilderBot Docs](https://builderbot.app/docs)
- [Funciones BuilderBot](../functions.png)
- [Código v1 de referencia](../../v1-backend-pymebot/src/flows/)