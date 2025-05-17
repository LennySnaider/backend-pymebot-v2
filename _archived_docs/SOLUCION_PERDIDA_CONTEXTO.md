# Solución: Pérdida de Contexto de Conversación

## Problema Identificado

El sistema crea un nuevo bot temporal para cada mensaje en lugar de mantener uno por sesión, lo que causa:

1. Pérdida del estado de conversación
2. No reconocimiento de respuestas a preguntas previas
3. Fallo en la captura de variables

### Flujo actual con problema:

```
Usuario: "hola"
→ Crear Bot1 → Respuesta: "¿Cuál es tu nombre?"
→ Bot1 es destruido ❌

Usuario: "Maria"
→ Crear Bot2 → No sabe que esperaba un nombre ❌
→ Respuesta genérica: "No pude procesar tu mensaje"
```

### Flujo deseado:

```
Usuario: "hola"
→ Crear/Obtener Bot para sesión123 → Respuesta: "¿Cuál es tu nombre?"
→ Bot permanece en memoria ✅

Usuario: "Maria"
→ Reusar Bot de sesión123 → Reconoce captura activa ✅
→ Guarda nombre, continúa flujo
```

## Solución Implementada

### 1. Crear gestión de bots por sesión

**Archivo: `src/services/flowRegistryPatch.ts`**

```typescript
// Cache de bots por sesión
const sessionBots: Map<string, { bot: any; provider: any }> = new Map();

// Obtener o crear bot para sesión
export async function getOrCreateSessionBot(
  flowId: string,
  userId: string,
  tenantId: string,
  sessionId: string
): Promise<{ bot: any; provider: any }>
```

### 2. Modificar flowRegistry.ts

**En la función `processFlowMessage`**, cambiar:

```typescript
// ANTES - Crea bot nuevo siempre
const { bot, provider } = await FlowRegistry.createTemporaryBot(actualFlowId, phoneFrom, tenantId);

// DESPUÉS - Reutiliza bot de sesión
const { bot, provider } = await getOrCreateSessionBot(actualFlowId, phoneFrom, tenantId, sessionId);
```

### 3. Implementación del cambio

```typescript
// En src/services/flowRegistry.ts, línea ~429
import { getOrCreateSessionBot } from './flowRegistryPatch';

// Cambiar:
// const { bot, provider } = await FlowRegistry.createTemporaryBot(actualFlowId, phoneFrom, tenantId);

// Por:
const { bot, provider } = await getOrCreateSessionBot(actualFlowId, phoneFrom, tenantId, sessionId);
```

## Cambios necesarios

### Modificar flowRegistry.ts

1. Importar la función de gestión de sesiones:
```typescript
import { getOrCreateSessionBot } from './flowRegistryPatch';
```

2. En la función `processFlowMessage` (alrededor de la línea 428):
```typescript
// Reemplazar la línea:
const { bot, provider } = await FlowRegistry.createTemporaryBot(actualFlowId, phoneFrom, tenantId);

// Por:
const { bot, provider } = await getOrCreateSessionBot(actualFlowId, phoneFrom, tenantId, sessionId);
```

## Ventajas de la solución

1. **Mantiene el contexto**: El bot recuerda el estado entre mensajes
2. **Eficiencia**: No se crean bots innecesarios
3. **Gestión de memoria**: Limpieza automática de sesiones antiguas
4. **Escalable**: Funciona para múltiples sesiones concurrentes

## Próximos pasos

1. Aplicar el cambio en `flowRegistry.ts`
2. Probar la conversación completa
3. Verificar que las capturas funcionan correctamente
4. Monitorear el uso de memoria con sesiones prolongadas

## Código de prueba

Para verificar que funciona:

```bash
# Primer mensaje
curl -X POST http://localhost:3090/api/text/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "text": "hola",
    "user_id": "test-user",
    "session_id": "test-session",
    "tenant_id": "afa60b0a-3046-4607-9c48-266af6e1d322",
    "template_id": "0654268d-a65a-4e59-83a2-e99d4d393273"
  }'

# Segundo mensaje (debería capturar el nombre)
curl -X POST http://localhost:3090/api/text/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Maria",
    "user_id": "test-user",
    "session_id": "test-session",
    "tenant_id": "afa60b0a-3046-4607-9c48-266af6e1d322",
    "template_id": "0654268d-a65a-4e59-83a2-e99d4d393273"
  }'
```