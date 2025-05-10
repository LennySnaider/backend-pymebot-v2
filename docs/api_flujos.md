# Documentación de la API de Flujos

## Introducción

La API de Flujos permite gestionar los flujos conversacionales del chatbot de voz. Proporciona endpoints para crear, leer, actualizar y eliminar flujos, así como funcionalidades adicionales como activación y clonación.

## Autenticación

Todos los endpoints de la API de Flujos requieren autenticación. Se debe incluir un token de autenticación en el encabezado `Authorization` de cada solicitud.

```
Authorization: Bearer <tu_token>
```

## Endpoints

### Obtener todos los flujos

Recupera todos los flujos del tenant actual.

```
GET /api/flows
```

#### Respuesta

```json
{
  "success": true,
  "flows": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Flujo de Bienvenida",
      "description": "Flujo para saludar a los usuarios nuevos",
      "version": "1.0.0",
      "isActive": true,
      "createdAt": "2025-04-22T10:30:00Z",
      "updatedAt": "2025-04-23T15:20:00Z",
      "nodesCount": 5,
      "tags": ["bienvenida", "intro"],
      "category": "general",
      "author": "admin"
    },
    // ... más flujos
  ]
}
```

### Obtener un flujo específico

Recupera un flujo por su ID.

```
GET /api/flows/:id
```

#### Respuesta

```json
{
  "success": true,
  "flow": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Flujo de Bienvenida",
    "description": "Flujo para saludar a los usuarios nuevos",
    "version": "1.0.0",
    "nodes": {
      "node1": {
        "id": "node1",
        "type": "message",
        "content": "¡Bienvenido a nuestro servicio!",
        "metadata": {
          "role": "bot"
        },
        "next": "node2"
      },
      "node2": {
        "id": "node2",
        "type": "message",
        "content": "¿En qué puedo ayudarte hoy?",
        "metadata": {
          "role": "bot"
        }
      }
    },
    "entryNodeId": "node1",
    "tenantId": "tenant123",
    "isActive": true,
    "createdAt": "2025-04-22T10:30:00Z",
    "updatedAt": "2025-04-23T15:20:00Z",
    "tags": ["bienvenida", "intro"],
    "category": "general",
    "author": "admin"
  }
}
```

### Crear un nuevo flujo

Crea un nuevo flujo para el tenant actual.

```
POST /api/flows
```

#### Cuerpo de la solicitud

```json
{
  "name": "Nuevo Flujo",
  "description": "Descripción del nuevo flujo",
  "version": "1.0.0",
  "nodes": {
    "node1": {
      "id": "node1",
      "type": "message",
      "content": "¡Bienvenido a nuestro servicio!",
      "metadata": {
        "role": "bot"
      },
      "next": "node2"
    },
    "node2": {
      "id": "node2",
      "type": "message",
      "content": "¿En qué puedo ayudarte hoy?",
      "metadata": {
        "role": "bot"
      }
    }
  },
  "entryNodeId": "node1",
  "isActive": false,
  "tags": ["bienvenida", "intro"],
  "category": "general"
}
```

#### Respuesta

```json
{
  "success": true,
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Flujo creado correctamente"
}
```

### Actualizar un flujo existente

Actualiza un flujo existente por su ID.

```
PUT /api/flows/:id
```

#### Cuerpo de la solicitud

```json
{
  "name": "Flujo Actualizado",
  "description": "Descripción actualizada",
  "version": "1.1.0",
  "nodes": {
    // Nodos actualizados
  },
  "isActive": true
}
```

#### Respuesta

```json
{
  "success": true,
  "message": "Flujo actualizado correctamente"
}
```

### Eliminar un flujo

Elimina un flujo por su ID. No se pueden eliminar flujos activos.

```
DELETE /api/flows/:id
```

#### Respuesta

```json
{
  "success": true,
  "message": "Flujo eliminado correctamente"
}
```

### Activar un flujo

Activa un flujo (desactivando los demás flujos del tenant).

```
POST /api/flows/:id/activate
```

#### Respuesta

```json
{
  "success": true,
  "message": "Flujo activado correctamente"
}
```

## Modelos de Datos

### Flujo

```typescript
interface Flow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: Record<string, FlowNode>;
  entryNodeId: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  category?: string;
  author?: string;
}
```

### Nodo de Flujo

```typescript
interface FlowNode {
  id: string;
  type: NodeType; // "message", "condition", "action", etc.
  content: string;
  metadata?: NodeMetadata;
  next?: string | ConditionalNext[];
  x?: number; // Posición X en el editor visual
  y?: number; // Posición Y en el editor visual
}
```

### Tipos de Nodos

```typescript
enum NodeType {
  MESSAGE = 'message',     // Mensaje simple
  CONDITION = 'condition', // Condición de bifurcación
  ACTION = 'action',       // Acción a ejecutar
  INPUT = 'input',         // Solicitud de entrada
  API_CALL = 'api_call',   // Llamada a API externa
  INTENT = 'intent',       // Detección de intención
  ENTITY = 'entity',       // Extracción de entidad
  FALLBACK = 'fallback',   // Respuesta de respaldo
}
```

### Tipos de Condiciones

```typescript
enum ConditionType {
  CONTAINS = 'contains',           // El texto contiene una palabra o frase
  EQUALS = 'equals',               // El texto es exactamente igual
  REGEX = 'regex',                 // El texto cumple una expresión regular
  INTENT_IS = 'intent_is',         // La intención detectada es específica
  ENTITY_EXISTS = 'entity_exists', // Existe una entidad determinada
  ENTITY_VALUE = 'entity_value',   // Una entidad tiene un valor específico
  CONTEXT_HAS = 'context_has',     // El contexto tiene una variable
  CONTEXT_VALUE = 'context_value', // Una variable de contexto tiene valor específico
}
```

## Códigos de Error

- **400 Bad Request**: Error en los parámetros de la solicitud o validación fallida
- **401 Unauthorized**: Autenticación requerida o inválida
- **403 Forbidden**: No tiene permiso para acceder al recurso
- **404 Not Found**: Recurso no encontrado
- **409 Conflict**: Conflicto con el estado actual del recurso
- **500 Internal Server Error**: Error interno del servidor

## Ejemplos de Uso

### Ejemplo: Crear un flujo simple

```javascript
// Solicitud
fetch('/api/flows', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token'
  },
  body: JSON.stringify({
    name: "Flujo de Saludo",
    description: "Saluda al usuario y pregunta cómo ayudar",
    version: "1.0.0",
    nodes: {
      "node1": {
        id: "node1",
        type: "message",
        content: "¡Hola! Bienvenido a nuestro servicio.",
        metadata: { role: "bot" },
        next: "node2"
      },
      "node2": {
        id: "node2",
        type: "message",
        content: "¿En qué puedo ayudarte hoy?",
        metadata: { role: "bot" }
      }
    },
    entryNodeId: "node1",
    isActive: false,
    tags: ["bienvenida"],
    category: "general"
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Ejemplo: Activar un flujo

```javascript
// Solicitud
fetch('/api/flows/123e4567-e89b-12d3-a456-426614174000/activate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

## Limitaciones

- No se pueden eliminar flujos que están activos
- Cada tenant solo puede tener un flujo activo a la vez
- El número de nodos por flujo está limitado a 100 para mantener el rendimiento
- El tamaño total de un flujo no debe exceder 5MB
