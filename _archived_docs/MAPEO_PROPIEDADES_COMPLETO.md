# Mapeo Completo: Frontend (Visual Builder) ↔ Backend (BuilderBot)

## Equivalencias de Propiedades

### 1. Esperar Respuesta del Usuario

**Frontend**:
```json
{
  "waitForResponse": true   // Propiedad del nodo visual
}
```

**Backend (BuilderBot)**:
```javascript
.addAnswer(mensaje, { 
  capture: true            // Equivalente en BuilderBot
})
```

### 2. Mensajes y Prompts

**Frontend**:
```json
{
  "type": "messageNode",
  "data": {
    "message": "Hola {{nombre_usuario}}"
  }
}
```

**Backend**:
```javascript
.addAnswer("Hola {{nombre_usuario}}")
```

### 3. Captura de Variables

**Frontend**:
```json
{
  "type": "inputNode",
  "data": {
    "question": "¿Cuál es tu nombre?",
    "variableName": "nombre_usuario",
    "waitForResponse": true
  }
}
```

**Backend**:
```javascript
.addAnswer("¿Cuál es tu nombre?", { 
  capture: true 
}, async (ctx, { state }) => {
  await state.update({ nombre_usuario: ctx.body });
})
```

### 4. Botones

**Frontend**:
```json
{
  "type": "buttonsNode",
  "data": {
    "message": "Selecciona una opción:",
    "buttons": [
      { "text": "Comprar" },
      { "text": "Rentar" }
    ],
    "waitForResponse": true,
    "variableName": "tipo_compra"
  }
}
```

**Backend**:
```javascript
.addAnswer("Selecciona una opción:", { 
  buttons: [
    { body: "Comprar" },
    { body: "Rentar" }
  ],
  capture: true   // Solo si waitForResponse es true
}, async (ctx, { state }) => {
  await state.update({ tipo_compra: ctx.body });
})
```

## Lógica de Conversión

### templateConverter.ts / templateConverterV2.ts

```typescript
// Para TODOS los tipos de nodos que esperan respuesta:
const waitForResponse = currentNode.metadata?.waitForResponse !== false && 
                       currentNode.data?.waitForResponse !== false;

// Aplicar capture solo si waitForResponse es true
if (waitForResponse) {
  answerOptions.capture = true;
}
```

## Flujo de Control

### Con waitForResponse: true / capture: true
```
Bot: "¿Cuál es tu nombre?"
--- PAUSA: Espera respuesta ---
Usuario: "Maria"
Bot: "Gracias Maria"
```

### Con waitForResponse: false / sin capture
```
Bot: "Mensaje 1"
Bot: "Mensaje 2"  // Continúa inmediatamente
Bot: "Mensaje 3"  // Sin esperar
```

## Variables del Sistema

### Frontend (Visual)
- `{{nombre_usuario}}`
- `{{email_usuario}}`
- `{{company_name}}`

### Backend (Procesamiento)
- Se reemplazan dinámicamente
- Se guardan en el estado con `state.update()`
- Se recuperan del cache de sesión

## Notas Importantes

1. **Por defecto**: Si no se especifica `waitForResponse`, se asume `true`
2. **Variables**: Se capturan con el callback de BuilderBot
3. **Estado**: Se mantiene por sesión usando `sessionBots`
4. **Reemplazo**: Se hace en tiempo real al enviar mensajes

## Resumen

La conversión correcta es:
- `waitForResponse: true` → `capture: true`
- `waitForResponse: false` → Sin `capture`
- `variableName` → Se usa en el callback para `state.update()`
- `message` → Se convierte a primer parámetro de `addAnswer()`