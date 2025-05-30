# Problema de Captura de Respuestas en BuilderBot

**Fecha:** 2025-05-29  
**Estado:** Identificado y documentado  
**Prioridad:** Alta  

## Resumen del Problema

El sistema de plantillas del chatbot está funcionando correctamente en términos de conversión de `templateConverter.ts`, pero existe un problema crítico con la captura de respuestas del usuario en BuilderBot cuando se usan `inputNodes` secuenciales.

## Análisis Técnico Detallado

### ✅ Lo que SÍ funciona

1. **Conversión de plantillas**: El `templateConverter.ts` convierte correctamente las plantillas visuales a flujos de BuilderBot
2. **Secuencia de inputNodes**: Los nodos se procesan en el orden correcto usando la cadena recursiva de `buildFlowChain`
3. **Construcción del flujo**: Se genera un flujo válido con `capture: true` en los inputNodes
4. **Variables del sistema**: Se cargan y reemplazan correctamente (ej: `{{company_name}}` → `Pymebot`)

### ❌ Lo que NO funciona

1. **Captura de respuestas**: BuilderBot no captura las respuestas del usuario después del primer mensaje
2. **Gestión de sesiones**: Cada `userId` diferente crea una sesión nueva, rompiendo el flujo continuo
3. **Estado de conversación**: No se mantiene el contexto de dónde estaba esperando la respuesta

## Logs del Error

```
[INFO] [flowRegistry] Esperando respuestas del bot...
[INFO] [flowRegistry] Mensajes capturados en el provider: 0
[]
[WARN] [flowRegistry] No se obtuvieron respuestas del bot
[INFO] Respuesta del bot: "Lo siento, no pude procesar tu mensaje...."
```

## Causas Identificadas

### 1. **Problema de Sesiones Nuevas**
- **Observado**: Cada request con `userId` diferente crea una nueva sesión
- **Efecto**: El bot reinicia desde el principio en lugar de continuar desde la captura
- **Evidencia**: 
  - Sesión 1: `anon-b06fc0d1-8d9d-4626-9b77-3a41ff2197ce-session`
  - Sesión 2: `anon-27c6210e-7184-4211-b254-28be66e46acb-session`

### 2. **WebProvider No Captura Mensajes**
- **Observado**: `Mensajes capturados en el provider: 0`
- **Efecto**: Las respuestas del usuario no se procesan correctamente
- **Ubicación**: `WebProvider.sendMessage()` y gestión de cola de mensajes

### 3. **Keywords vs Captura**
- **Observado**: BuilderBot busca keywords que coincidan con "Juan Pérez"
- **Problema**: No hay keywords configuradas para respuestas de captura
- **Efecto**: El mensaje se trata como keyword no reconocida

### 4. **Equivalencia waitForResponse ↔ capture**
- **Frontend**: `"waitForResponse": true` en nodos del visual editor
- **Backend**: `capture: true` en BuilderBot `.addAnswer()`
- **Problema**: La conversión funciona, pero la ejecución no

## Flujo Esperado vs Flujo Actual

### ✅ Flujo Esperado
1. Usuario: `"hola"` → Bot inicia flujo
2. Bot: `"¿Cuál es tu nombre?"` (con `capture: true`)
3. Usuario: `"Juan Pérez"` → Bot captura respuesta y continúa
4. Bot: `"Perfecto Juan Pérez! ¿Tu teléfono?"` (siguiente inputNode)

### ❌ Flujo Actual
1. Usuario: `"hola"` → Bot inicia flujo ✅
2. Bot: `"¿Cuál es tu nombre?"` (con `capture: true`) ✅
3. Usuario: `"Juan Pérez"` → **Nueva sesión se crea** ❌
4. Bot: `"Lo siento, no pude procesar tu mensaje"` ❌

## Impacto en Funcionalidades

### Funcionalidades Afectadas
- ✅ **Templates simples** sin inputNodes funcionan
- ❌ **Flujos de captura de leads** no funcionan
- ❌ **Formularios multi-paso** no funcionan
- ❌ **Agendamiento de citas** (que usa múltiples inputs) no funciona

### Funcionalidades NO Afectadas
- ✅ **Mensajes simples** funcionan
- ✅ **Botones estáticos** funcionan
- ✅ **Variables del sistema** funcionan
- ✅ **Conversión de plantillas** funciona

## Configuración Técnica Verificada

### InputNode en templateConverter.ts
```typescript
// ✅ CORRECTO: Se construye con capture: true
flowChain = flowChain.addAnswer(prompt, { capture: true }, async (ctx: any, { state, flowDynamic }: any) => {
  await state.update({ 
    [variableName]: ctx.body,
    tenantId: state.tenantId || metadata.tenantId,
    sessionId: state.sessionId || metadata.sessionId
  });
  // ✅ CORRECTO: NO llama processNextNodeInCallback
});
```

### Template Visual (Frontend)
```json
{
  "type": "inputNode",
  "data": {
    "question": "¿Cuál es tu nombre?",
    "variableName": "nombre_lead",
    "waitForResponse": true  // ✅ Equivale a capture: true
  }
}
```

## Análisis de Logs Críticos

### ✅ Conversión Exitosa
```
[INFO] Agregando input: Para comenzar, ¿Podrías compartirme tu nombre completo? 📝 -> nombre_lead
[INFO] Siguiente nodo desde edges: inputNode-phone
[INFO] Procesando nodo inputNode-phone de tipo inputNode
```

### ❌ Captura Fallida
```
[INFO] [flowRegistry] Esperando respuestas del bot...
[INFO] [buttonNavigationQueue] Decolando 0 mensajes para sesión
[INFO] [flowRegistry] Mensajes capturados en el provider: 0
[WARN] [flowRegistry] No se obtuvieron respuestas del bot
```

## Estado del Código

### ✅ templateConverter.ts - CORRECTO
- La construcción de flujos funciona perfectamente
- Los inputNodes se procesan secuencialmente
- No hay llamadas conflictivas a `processNextNodeInCallback`
- La cadena recursiva `buildFlowChain` funciona como se esperaba

### ❌ Gestión de Sesiones - PROBLEMÁTICO
- Ubicación: `/src/services/flowService.ts` y `/src/api/text.ts`
- Problema: Cada userId genera una nueva sesión
- Efecto: Se pierde el contexto de captura

### ❌ WebProvider - PROBLEMÁTICO
- Ubicación: `/src/provider/webProvider.ts`
- Problema: No captura mensajes del usuario correctamente
- Efecto: Las respuestas no se procesan

## Soluciones Requeridas

### 1. Mantener Persistencia de Sesión
- **Implementar**: Reutilizar sesiones existentes por userId
- **Modificar**: `getOrCreateSessionBot()` en flowService
- **Objetivo**: Mantener estado de conversación

### 2. Corregir WebProvider
- **Investigar**: Por qué no captura mensajes
- **Verificar**: Cola de mensajes y eventos
- **Objetivo**: Capturar respuestas del usuario

### 3. Configurar Keywords para Captura
- **Analizar**: Sistema de keywords en BuilderBot
- **Implementar**: Manejo especial para respuestas de captura
- **Objetivo**: Procesar cualquier texto como respuesta válida

### 4. Testing Sistemático
- **Probar**: Con misma sesión mantenida
- **Verificar**: Flujo completo de múltiples inputNodes
- **Documentar**: Casos de éxito y falla

## Próximos Pasos

1. **Inmediato**: Investigar gestión de sesiones en flowService
2. **Crítico**: Revisar WebProvider y captura de mensajes
3. **Testing**: Probar con misma sesión mantenida
4. **Documentar**: Solución final implementada

## Archivos Involucrados

- ✅ `/src/services/templateConverter.ts` - Funciona correctamente
- ❌ `/src/services/flowService.ts` - Gestión de sesiones problemática
- ❌ `/src/provider/webProvider.ts` - Captura de mensajes falla
- ❌ `/src/api/text.ts` - Endpoint que maneja las conversaciones
- ❌ `/src/api/textRouter.ts` - Router de endpoints de texto

---

**Conclusión**: El problema original del `templateConverter.ts` está resuelto. El problema actual es de infraestructura de BuilderBot y gestión de sesiones, no de conversión de plantillas.