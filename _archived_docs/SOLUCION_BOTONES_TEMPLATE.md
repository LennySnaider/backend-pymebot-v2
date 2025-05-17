# Solución: Botones no mostrados y Template ID incorrecto

## Problema 1: Botones no se muestran

Los botones se enviaban pero no llegaban al frontend.

### Causa
El interceptor en `flowRegistry.ts` no capturaba los botones, solo el texto.

### Solución
1. Capturar las opciones completas del mensaje (que incluyen botones)
2. Extraer botones de las opciones interceptadas
3. Incluirlos en la respuesta final

```typescript
// Capturar mensaje con opciones
interceptedMessages.push({
  body: replacedMessage,
  options: options || {}
});

// Extraer botones
if (msg.options?.options?.buttons) {
  allButtons.push(...msg.options.options.buttons);
}
```

## Problema 2: Template ID incorrecto

Frontend enviaba `3fa60b0a-3046-4607-9c48-266af6e1d399` que no existe.

### Causa
UUID hardcodeado en `public-templates/route.ts` como fallback.

### Solución
Cambiar al ID correcto que existe en la DB:

```typescript
// ANTES
id: "3fa60b0a-3046-4607-9c48-266af6e1d399",

// DESPUÉS
id: "0654268d-a65a-4e59-83a2-e99d4d393273", // ID real del flujo en la DB
```

## Archivos modificados

1. `/src/services/flowRegistry.ts`
   - Líneas 458-478: Interceptor mejorado
   - Líneas 500-531: Extracción de botones

2. `/src/app/api/chatbot/public-templates/route.ts`
   - Línea 104: UUID corregido

## Resultado esperado

1. Los botones aparecerán en el chat como opciones clicables
2. No habrá más errores de "plantilla no encontrada"
3. El flujo completo funcionará correctamente

## Para probar

1. Reiniciar el servidor backend
2. Reiniciar el servidor frontend
3. Probar el chat nuevamente

Los botones deberían aparecer y el error del template desaparecerá.