# Solución: Flujo continuo sin esperar respuestas

## Problema

Después de capturar el teléfono, el bot envía todas las preguntas restantes de una sola vez:
- "Gracias por tus datos..."
- "¿Estás buscando una propiedad para?"
- "¿Qué tipo de propiedad?"
- "¿Cuál es tu presupuesto?"

## Causa

Los nodos de botones (`buttonsNode`) no tienen configurado `capture: true`, por lo que BuilderBot no espera respuesta del usuario y continúa con el flujo.

## Solución

Agregar `capture: true` a los nodos de botones para que BuilderBot espere la respuesta del usuario antes de continuar.

### Cambios en templateConverter.ts

```typescript
// ANTES
flowChain = flowChain.addAnswer(text, { 
  buttons: buttons.map((btn: any) => ({ 
    body: btn.text || btn.label 
  })) 
});

// DESPUÉS
flowChain = flowChain.addAnswer(text, { 
  buttons: buttons.map((btn: any) => ({ 
    body: btn.text || btn.label 
  })),
  capture: true  // Esperar respuesta del usuario
}, async (ctx: any, { state }: any) => {
  const variableName = currentNode.metadata?.variableName || 'userSelection';
  await state.update({ [variableName]: ctx.body });
  logger.info(`Opción seleccionada: ${ctx.body} guardada en ${variableName}`);
});
```

### Cambios en templateConverterV2.ts

Mismo cambio aplicado para mantener consistencia.

## Resultado esperado

1. Usuario ingresa teléfono
2. Bot responde con agradecimiento
3. Bot muestra botones "Comprar/Rentar"
4. **ESPERA respuesta del usuario**
5. Usuario selecciona opción
6. Bot continúa con siguiente pregunta
7. Bot muestra botones "Casa/Depto/Oficina"
8. **ESPERA respuesta del usuario**
9. Etc.

## Flujo correcto

```
Usuario: "654654"
Bot: "Gracias por tus datos, Maria..."
Bot: "¿Estás buscando una propiedad para?" [Comprar] [Rentar]
--- ESPERA ---
Usuario: "Comprar"
Bot: "¿Qué tipo de propiedad?" [Casa] [Depto] [Oficina]
--- ESPERA ---
Usuario: "Casa"
Bot: "¿Cuál es tu presupuesto?"
```

## Archivos modificados

1. `/src/services/templateConverter.ts` - Líneas 241-253
2. `/src/services/templateConverterV2.ts` - Líneas 190-202

## Para probar

1. Reiniciar el servidor
2. Probar el flujo completo
3. Verificar que el bot espera respuestas en cada nodo de botones