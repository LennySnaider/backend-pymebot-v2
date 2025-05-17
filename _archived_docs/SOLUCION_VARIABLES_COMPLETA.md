# Solución Completa: Variables de BuilderBot

## Problema

Las variables capturadas por BuilderBot no se reemplazan correctamente en los mensajes. Aunque el bot captura el nombre ("Fernando"), el mensaje dice "Gracias Usuario" en lugar de "Gracias Fernando".

## Diagnóstico

1. BuilderBot actualiza las variables en un estado separado con `state.update({ nombre_usuario: "Fernando" })`
2. El flowRegistry usa un estado diferente para reemplazar variables
3. Los estados no están sincronizados

## Solución Implementada

### 1. Interceptor de Logger (flowRegistryVariablePatch.ts)

```typescript
// Intercepta las actualizaciones de variables a través del logger
logger.info = function(...args: any[]) {
  originalLoggerInfo(...args);
  
  // Detectar: "Variable nombre_usuario actualizada con: Fernando"
  const message = args[0];
  if (message.includes('Variable') && message.includes('actualizada con:')) {
    // Capturar variable y guardarla en cache por sesión
  }
}
```

### 2. Cache de Variables por Sesión

```typescript
// Cache global
export const sessionVariablesCache: Map<string, Record<string, any>> = new Map();

// Establecer sesión actual
export function setCurrentSession(sessionId: string): void

// Obtener variables capturadas
export function getSessionVariables(sessionId: string): Record<string, any>
```

### 3. Integración en flowRegistry

```typescript
// Establecer sesión para captura
setCurrentSession(sessionId);

// Reemplazar variables combinando estado y capturas
const capturedVariables = getSessionVariables(sessionId);
const mergedVariables = { ...state.variables, ...capturedVariables };
const replacedMessage = replaceVariables(message, mergedVariables);
```

## Flujo de Funcionamiento

1. Usuario envía "Fernando"
2. BuilderBot ejecuta `state.update({ nombre_usuario: "Fernando" })`
3. Logger registra: "Variable nombre_usuario actualizada con: Fernando"
4. Interceptor captura la variable y la guarda en cache
5. Al enviar mensaje "Gracias {{nombre_usuario}}", se recupera del cache
6. Se reemplaza correctamente: "Gracias Fernando"

## Archivos Creados/Modificados

1. **flowRegistryVariablePatch.ts** - Interceptor de variables
2. **flowRegistry.ts** - Integración con el cache de variables

## Resultado Esperado

- Las variables capturadas por BuilderBot se reemplazan correctamente
- Los mensajes personalizados muestran los valores reales
- Se mantiene la compatibilidad con el sistema existente

## Nota Técnica

Esta es una solución de "parche" que intercepta el logger. Una solución más robusta requeriría modificar BuilderBot directamente para compartir el estado con flowRegistry, pero eso está fuera del alcance actual.