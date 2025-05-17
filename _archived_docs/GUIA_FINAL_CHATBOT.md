# Guía Final del Sistema Chatbot - PymeBot v2

## 🏗️ Arquitectura del Sistema

El sistema PymeBot v2 es una plataforma completa de chatbot builder con integración de BuilderBot, voz, y personalización visual.

### Componentes Principales

1. **Frontend (v2-frontend-pymebot)**
   - Next.js 15 con App Router
   - Constructor visual de flujos de chatbot
   - Panel de administración
   - Chat web integrado

2. **Backend (v2-backend-pymebot)**
   - Express.js con TypeScript
   - Integración con BuilderBot
   - API REST para gestión de chatbots
   - Sistema de variables dinámicas

3. **Base de Datos (Supabase)**
   - PostgreSQL con Row Level Security
   - Almacenamiento de templates y flujos
   - Gestión multi-tenant

4. **Integración de Voz (voiceAgentBot)**
   - Text-to-Speech con MiniMax
   - Speech-to-Text con AssemblyAI/MiniMax
   - Streaming de audio

## 📋 Estado Actual del Sistema

### ✅ Funcionalidades Operativas

1. **Comunicación Frontend-Backend**
   - Endpoint correcto: `/api/text/chatbot` (sin autenticación)
   - Proxy funcional en `/api/chatbot/integrated-message`
   - Manejo de respuestas con normalización de formato

2. **Procesamiento de Mensajes**
   - Primera respuesta funciona correctamente
   - Variables del sistema se reemplazan dinámicamente
   - Mensaje de bienvenida garantizado

3. **Base de Datos**
   - Estructura de templates definida
   - Sistema de activación de templates por tenant
   - Variables del sistema y por tenant

### ❌ Problemas Conocidos

1. **Pérdida de Contexto de Conversación**
   - El bot no mantiene el estado entre mensajes
   - Segunda respuesta falla con error genérico
   - El sistema no persiste la sesión correctamente

2. **Template ID Incorrecto**
   - Frontend envía template_id igual al tenant_id
   - Backend debe corregirlo en cada solicitud
   - Templates múltiples se activan incorrectamente

## 🔧 Correcciones Recientes

### 1. Problema de Autenticación (401)

**Problema**: El frontend llamaba a `/api/text/chat` que requiere autenticación.

**Solución**:
```typescript
// Cambio en frontend
const CHATBOT_ENDPOINT = `${BACKEND_URL}/api/text/chatbot`; // Sin autenticación
```

### 2. Mensajes Duplicados

**Problema**: Los mensajes se duplicaban en las respuestas del bot.

**Solución**:
```typescript
// En flowRegistry.ts
// Comentado: interceptedMessages.push(...provider.queuedMessages);
```

### 3. Template ID Erróneo

**Problema**: Frontend enviaba el tenant_id como template_id.

**Solución temporaria**:
```typescript
// En chatbot.ts
const templateQuery = await getTenantTemplatesWithFlows(tenantId);
const template = activeTemplate ? activeTemplate : templateQuery.templates[0];
```

### 4. Búsqueda en Tabla Incorrecta

**Problema**: El sistema buscaba templates en la tabla "flows" inexistente.

**Solución**:
```typescript
// En supabase.ts
let activationsQuery = supabase.from("tenant_chatbot_activations")
```

## 🚀 Configuración de Desarrollo

### Backend Setup

```bash
cd v2-backend-pymebot
npm install
npm run dev  # Puerto 3090
```

### Frontend Setup

```bash
cd v2-frontend-pymebot
npm install
npm run dev  # Puerto 3000
```

### Variables de Entorno

**Backend (.env)**:
```env
PORT=3090
NODE_ENV=development
SUPABASE_URL=tu_url_supabase
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_KEY=tu_service_key
ENABLE_WHATSAPP=true
```

**Frontend (.env.local)**:
```env
BACKEND_API_URL=http://localhost:3090
DEFAULT_TENANT_ID=afa60b0a-3046-4607-9c48-266af6e1d322
```

## 📡 Flujo de Mensajes

1. **Usuario → Frontend**
   - Mensaje enviado en chat web
   - POST a `/api/chatbot/integrated-message`

2. **Frontend → Backend**
   - Proxy al backend
   - POST a `${BACKEND_URL}/api/text/chatbot`

3. **Backend → BuilderBot**
   - Procesamiento del mensaje
   - Ejecución del flujo
   - Reemplazo de variables

4. **BuilderBot → Usuario**
   - Respuesta procesada
   - Normalización de formato
   - Envío al frontend

## 🔍 Próximos Pasos

### 1. Corregir Gestión de Sesiones

```typescript
// Implementar en stateManager.ts
async function getOrCreateSession(userId: string, tenantId: string) {
  const key = `${tenantId}:${userId}`;
  
  // Buscar sesión existente
  let session = sessions.get(key);
  
  if (!session) {
    // Crear nueva sesión
    session = await createNewSession(userId, tenantId);
    sessions.set(key, session);
  }
  
  return session;
}
```

### 2. Arreglar Template ID en Frontend

```typescript
// En integrated-message/route.ts
const correctTemplateId = await getActiveTemplateForTenant(tenantId);
```

### 3. Implementar Persistencia de Estado

```sql
-- Tabla para sesiones activas
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  state JSONB DEFAULT '{}',
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🌟 Características Avanzadas

### Sistema de Variables

Variables disponibles:
- `{{business_name}}` - Nombre del negocio
- `{{business_hours}}` - Horario de atención
- `{{nombre_usuario}}` - Nombre del usuario (capturado)
- `{{email_usuario}}` - Email del usuario (capturado)

### Tipos de Nodos

1. **Message Node**: Envía mensajes
2. **Input Node**: Captura datos del usuario
3. **Condition Node**: Lógica condicional
4. **AI Node**: Respuestas con IA
5. **Business Nodes**: Citas, inventario, etc.

### Modos de Chat

- `standard`: Flujo normal con BuilderBot
- `direct-welcome`: Solo mensaje de bienvenida
- `auto-flow`: Selección automática de flujo

## 🔒 Consideraciones de Seguridad

1. **Autenticación**
   - Endpoints públicos vs protegidos
   - Validación de tenant_id
   - Sanitización de entradas

2. **Base de Datos**
   - Row Level Security activo
   - Políticas por tenant
   - Validación de esquemas

3. **API Keys**
   - Nunca exponer en el frontend
   - Usar variables de entorno
   - Rotar periódicamente

## 📚 Documentación Adicional

- [CLAUDE.md](../CLAUDE.md) - Guía para AI assistant
- [BUILDERBOT_DOCUMENTATION.md](./BUILDERBOT_DOCUMENTATION.md) - Docs de BuilderBot
- [SOLUCION_CHATBOT.md](./SOLUCION_CHATBOT.md) - Soluciones comunes

## 🎯 Conclusión

El sistema PymeBot v2 está funcionando parcialmente. Las correcciones implementadas resuelven los problemas de autenticación y duplicación de mensajes, pero queda pendiente la gestión correcta de sesiones para mantener el contexto de conversación. 

La arquitectura es sólida y extensible, permitiendo futuras mejoras como:
- Análisis de conversaciones
- Integración con más canales
- Mejoras en el constructor visual
- Optimización de flujos

Para soporte adicional o contribuciones, revisar los scripts de prueba en el directorio raíz y la documentación específica de cada componente.