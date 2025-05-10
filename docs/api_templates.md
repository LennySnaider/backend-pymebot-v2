# Documentación de la API de Plantillas

## Introducción

La API de Plantillas permite gestionar plantillas de flujos conversacionales creadas por el super_admin y utilizadas por los tenants. Proporciona endpoints para crear, consultar y utilizar plantillas de flujos.

## Descripción del Flujo de Trabajo

1. El **super_admin** crea flujos completos utilizando el Constructor Visual de Flujos
2. El super_admin convierte estos flujos en plantillas, especificando qué nodos pueden ser editados por los tenants
3. Los **tenants** pueden ver las plantillas disponibles y crear instancias de ellas
4. Los tenants solo pueden modificar los nodos específicos que fueron marcados como editables por el super_admin

## Autenticación

Todos los endpoints de la API de Plantillas requieren autenticación. Se debe incluir un token de autenticación en el encabezado `Authorization` de cada solicitud.

```
Authorization: Bearer <tu_token>
```

## Endpoints

### Obtener todas las plantillas

Recupera todas las plantillas disponibles.

```
GET /api/templates
```

#### Respuesta

```json
{
  "success": true,
  "templates": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Plantilla de Bienvenida",
      "description": "Flujo para saludar a los usuarios nuevos",
      "version": "1.0.0",
      "category": "general",
      "tags": ["bienvenida", "intro"],
      "author": "super_admin",
      "nodesCount": 5,
      "createdAt": "2025-04-22T10:30:00Z",
      "updatedAt": "2025-04-23T15:20:00Z"
    },
    // ... más plantillas
  ]
}
```

### Obtener una plantilla específica

Recupera una plantilla por su ID.

```
GET /api/templates/:id
```

#### Respuesta

```json
{
  "success": true,
  "template": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Plantilla de Bienvenida",
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
    "category": "general",
    "tags": ["bienvenida", "intro"],
    "author": "super_admin",
    "editableNodes": ["node2"],
    "createdAt": "2025-04-22T10:30:00Z",
    "updatedAt": "2025-04-23T15:20:00Z"
  }
}
```

### Crear una plantilla desde un flujo existente (solo super_admin)

Convierte un flujo existente en una plantilla que estará disponible para los tenants.

```
POST /api/templates/from-flow/:flowId
```

#### Cuerpo de la solicitud

```json
{
  "editableNodes": ["node2", "node4", "node7"]
}
```

#### Respuesta

```json
{
  "success": true,
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Plantilla creada correctamente"
}
```

### Instanciar una plantilla

Crea un flujo basado en una plantilla existente. El tenant solo podrá editar los nodos marcados como editables por el super_admin.

```
POST /api/templates/:id/instantiate
```

#### Cuerpo de la solicitud

```json
{
  "customName": "Mi Flujo de Bienvenida Personalizado"
}
```

#### Respuesta

```json
{
  "success": true,
  "id": "234e5678-e89b-12d3-a456-426614174000",
  "message": "Plantilla instanciada correctamente"
}
```

### Eliminar una plantilla (solo super_admin)

Elimina una plantilla existente.

```
DELETE /api/templates/:id
```

#### Respuesta

```json
{
  "success": true,
  "message": "Plantilla eliminada correctamente"
}
```

## Restricciones y Limitaciones

- Cada tenant puede tener un máximo de 5 flujos instanciados
- Solo el super_admin puede crear, modificar y eliminar plantillas
- Los tenants solo pueden modificar los nodos específicamente marcados como editables
- No se pueden eliminar plantillas que estén siendo utilizadas por tenants (se muestra una advertencia)

## Ejemplos de Uso

### Ejemplo: Obtener todas las plantillas disponibles

```javascript
// Solicitud
fetch('/api/templates', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token'
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Ejemplo: Instanciar una plantilla

```javascript
// Solicitud
fetch('/api/templates/123e4567-e89b-12d3-a456-426614174000/instantiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your_token'
  },
  body: JSON.stringify({
    customName: "Flujo de Bienvenida para mi Tienda"
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Modificación de Flujos Instanciados por Tenants

Una vez que un tenant ha instanciado una plantilla, puede realizar modificaciones limitadas a través del endpoint específico:

```
PATCH /api/flows/:id/limited
```

### Cuerpo de la solicitud

```json
{
  "name": "Nuevo nombre para mi flujo",
  "description": "Nueva descripción",
  "nodes": {
    "node2": {
      "content": "¡Bienvenido a Tienda XYZ! ¿En qué podemos ayudarte hoy?",
      "metadata": {
        "delay": 1000
      }
    }
  },
  "isActive": true
}
```

Los tenants solo pueden modificar:
1. El nombre y descripción del flujo
2. El contenido y ciertos metadatos (como delay) de nodos marcados como editables
3. El estado de activación del flujo

## Códigos de Error

- **400 Bad Request**: Error en los parámetros de la solicitud
- **401 Unauthorized**: Autenticación requerida o inválida
- **403 Forbidden**: No tiene permiso para acceder al recurso
- **404 Not Found**: Recurso no encontrado
- **409 Conflict**: Conflicto con el estado actual del recurso
- **429 Too Many Requests**: Se ha alcanzado el límite de flujos por tenant
- **500 Internal Server Error**: Error interno del servidor
