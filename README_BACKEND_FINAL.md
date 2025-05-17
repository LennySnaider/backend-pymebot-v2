# PymeBot v2 Backend - Guía Completa

## 📋 Descripción

Backend del sistema PymeBot v2, un constructor visual de chatbots con integración de BuilderBot, soporte de voz y arquitectura multi-tenant.

## 🏗️ Arquitectura

### Stack Tecnológico
- **Node.js** con **TypeScript**
- **Express.js** para API REST
- **BuilderBot** para flujos conversacionales
- **Supabase** para base de datos PostgreSQL
- **WhatsApp** integración con Baileys
- **Voz**: AssemblyAI (STT) y MiniMax (TTS)

### Estructura del Proyecto

```
v2-backend-pymebot/
├── src/
│   ├── api/                # Endpoints REST
│   ├── config/            # Configuración
│   ├── flows/             # Flujos BuilderBot
│   ├── middlewares/       # Auth y otros
│   ├── models/            # Tipos TypeScript
│   ├── provider/          # Proveedores (Web/WhatsApp)
│   ├── services/          # Lógica de negocio
│   ├── templates/         # Templates predefinidos
│   ├── utils/             # Utilidades
│   └── app.ts            # Entrada principal
├── scripts/               # Scripts de utilidad
├── migrations/            # Migraciones SQL
└── _archived_tests/       # Tests archivados
```

## 🚀 Instalación y Configuración

### 1. Instalación de Dependencias

```bash
npm install
```

### 2. Variables de Entorno

Crear archivo `.env`:

```env
# Configuración General
PORT=3090
NODE_ENV=development

# API Keys
ASSEMBLYAI_API_KEY=your_key
MINIMAX_API_KEY=your_key
MINIMAX_GROUP_ID=your_group_id
OPENAI_API_KEY=your_key

# WhatsApp
ENABLE_WHATSAPP=true
WHATSAPP_SESSION_NAME=bot

# Supabase
ENABLE_SUPABASE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_KEY=your_service_key

# Multi-tenant
ENABLE_MULTITENANT=true
DEFAULT_TENANT_ID=default
DEFAULT_TENANT_UUID=afa60b0a-3046-4607-9c48-266af6e1d322
```

### 3. Ejecutar el Servidor

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## 📡 API Endpoints

### Chat y Mensajería

- `POST /api/text/chatbot` - Procesar mensaje (sin auth)
- `POST /api/text/chat` - Procesar mensaje (con auth)
- `GET /api/text/templates` - Obtener templates activos
- `POST /api/text/templates/activate` - Activar template

### Voz

- `POST /api/voice/chat` - Procesar audio completo
- `POST /api/voice/transcribe` - Solo transcribir audio
- `POST /api/voice/tts` - Generar audio desde texto

### Gestión

- `GET /api/flows` - Listar flujos disponibles
- `POST /api/templates` - Crear/actualizar template
- `GET /api/system/health` - Estado del sistema

## 🔧 Características Principales

### 1. Sistema de Templates Dinámicos

Los templates creados en el frontend se convierten automáticamente a flujos BuilderBot:

```typescript
// Template Visual → Flujo BuilderBot
{
  type: "messageNode",
  message: "Hola {{nombre}}",
  waitForResponse: true
}

// Se convierte a:
addKeyword(['hola'])
  .addAnswer('Hola {{nombre}}', { capture: true })
```

### 2. Sistema de Variables

Variables disponibles en mensajes:
- `{{business_name}}` - Nombre de la empresa
- `{{business_hours}}` - Horario de atención
- `{{nombre_usuario}}` - Nombre del usuario
- `{{email_usuario}}` - Email del usuario

### 3. Integración BuilderBot

Flujo típico:
```typescript
const welcomeFlow = createFlow([
  addKeyword(['hola', 'buenos días'])
    .addAnswer('¡Hola! Bienvenido a {{business_name}}')
    .addAnswer('¿En qué puedo ayudarte?', { capture: true })
    .addAction(async (ctx, { state }) => {
      await state.update({ userQuery: ctx.body });
    })
]);
```

### 4. Botones Dinámicos

Soporte completo para botones interactivos:
```typescript
.addAnswer('¿Qué deseas hacer?', {
  buttons: [
    { body: '📅 Agendar cita' },
    { body: '❓ Hacer pregunta' },
    { body: '📞 Contactar' }
  ]
})
```

### 5. Multi-tenant

Aislamiento completo de datos por tenant:
- Templates por tenant
- Variables personalizadas
- Límites de uso
- Configuración independiente

## 🐛 Solución de Problemas Comunes

### 1. Pérdida de Contexto en Botones

**Problema**: Los botones no mantienen el flujo esperado.
**Solución**: Usar `waitForResponse: true` y flowDynamic:

```typescript
.addAnswer('Pregunta', { capture: true })
.addAction(async (ctx, { flowDynamic }) => {
  if (ctx.body === 'si') {
    return flowDynamic('Continuamos...');
  }
})
```

### 2. Variables No Se Reemplazan

**Problema**: `{{variable}}` aparece literal.
**Solución**: Usar el endpoint correcto `/api/chatbot/integrated-message`.

### 3. Error de CORS

**Problema**: Bloqueo cross-origin.
**Solución**: Configurar headers apropiados:

```typescript
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
```

## 📚 Referencias

### Documentación BuilderBot
- [Guía oficial](https://builderbot.vercel.app/docs)
- Patrones de flujo continuo
- Manejo de estado

### Scripts Útiles

```bash
# Limpiar sesiones
npm run clean-sessions

# Verificar templates
npm run check-templates

# Aplicar migraciones
npm run migrate
```

## 🔐 Seguridad

- Autenticación con JWT
- Row Level Security en Supabase
- Validación de entrada
- Rate limiting
- Sanitización de variables

## 🚧 Próximas Mejoras

1. **Performance**
   - Caché de respuestas frecuentes
   - Pool de conexiones optimizado
   - Lazy loading de flujos

2. **Funcionalidades**
   - Análisis de conversaciones
   - Métricas en tiempo real
   - Integración con más canales

3. **Desarrollo**
   - Tests unitarios completos
   - CI/CD pipeline
   - Documentación API completa

## 📞 Soporte

Para soporte técnico o preguntas:
- Email: contacto@pymebot.ai
- Discord: [Canal PymeBot](https://discord.gg/pymebot)
- GitHub: [Issues](https://github.com/pymebot/backend/issues)

---
*Última actualización: ${new Date().toISOString().split('T')[0]}*