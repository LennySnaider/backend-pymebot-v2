# PymeBot V2 Backend - Sistema de Chatbot Multi-Tenant

## 🚀 Descripción

Backend de PymeBot V2 - Plataforma robusta para automatización de chatbots con **arquitectura híbrida** implementada. Desarrollado con **Node.js/TypeScript**, **BuilderBot** y **Express.js**, incluye integración completa con WhatsApp, sistema de variables avanzado y arquitectura modular preparada para escalabilidad.

## 🏗️ Arquitectura Híbrida Implementada

### ✨ **Sistema Híbrido Transparente**

El backend implementa una **arquitectura híbrida** que permite:

- ✅ **Sistema Lineal Actual**: Funcionalidad 100% preservada con BuilderBot
- 🔄 **Routing Condicional**: `routingService.ts` para evaluación automática
- 🏗️ **Infraestructura Modular**: `moduleRegistry.ts` preparado para módulos V1  
- 📊 **Análisis de Templates**: Scoring automático de modernización
- 🎯 **Migration Middleware**: Distribución gradual entre sistemas
- ⚡ **Timeout Optimizado**: 3 segundos para procesamiento de mensajes

### Stack Tecnológico

- **Framework**: Node.js con TypeScript y Express.js
- **Chatbot Engine**: BuilderBot para flujos conversacionales
- **Base de Datos**: Supabase (PostgreSQL + RLS)
- **WhatsApp**: Baileys para integración con WhatsApp Business
- **IA**: OpenAI + MiniMax para respuestas inteligentes
- **Voz**: AssemblyAI (STT) + MiniMax (TTS)
- **Variables**: Sistema multi-nivel (Sistema, Tenant, Sesión)

## 🚀 Características Principales

### Sistema de Chatbot Avanzado
- 🤖 **BuilderBot Integration**: Motor robusto para flujos conversacionales
- 💬 **WhatsApp Business**: Integración completa con Baileys
- 🔄 **Template Conversion**: Conversión automática de templates visuales
- ⚡ **Message Processing**: Procesamiento optimizado con timeout de 3s
- 🎯 **Capture System**: Sistema `capture: true` para respuestas de usuario

### Arquitectura Multi-Tenant
- 🏢 **Tenant Isolation**: Aislamiento completo de datos por tenant
- 🔒 **RLS Policies**: Row Level Security en Supabase
- 📊 **Usage Quotas**: Control de cuotas por tenant
- 🔑 **Auth System**: Autenticación robusta con permisos

### Sistema de Variables Avanzado
- 🌍 **Variables Sistema**: Globales (SUPERADMIN)
- 🏢 **Variables Tenant**: Por cliente/organización
- 💬 **Variables Sesión**: Runtime de conversación
- 🔄 **Real-time Sync**: Sincronización en tiempo real

### Sales Funnel Integrado
- 📈 **Progresión Automática**: Nuevos → Prospectando → Calificación → Oportunidad → Confirmado
- 🔄 **Lead Management**: Actualización automática de etapas
- 📊 **CRM Integration**: Gestión completa de leads
- ⚡ **Real-time Updates**: Sincronización instantánea

### Servicios de IA y Voz
- 🎙️ **Speech-to-Text**: AssemblyAI para transcripción
- 🔊 **Text-to-Speech**: MiniMax para síntesis de voz
- 🤖 **AI Responses**: OpenAI + MiniMax para respuestas inteligentes
- 🎯 **Voice Agent**: Agente conversacional por voz

## 🛠️ Estructura del Proyecto

```
backend-pymebot-v2/
├── src/
│   ├── api/                           # API Endpoints
│   │   ├── templates.ts               # Gestión de templates
│   │   ├── variables.ts               # Sistema de variables
│   │   ├── flows.ts                   # Control de flujos
│   │   ├── appointments.ts            # Sistema de citas
│   │   ├── products.ts                # Catálogo de productos
│   │   ├── properties.ts              # Gestión inmobiliaria
│   │   ├── voice.ts                   # API de voz
│   │   └── text.ts                    # Procesamiento de texto
│   ├── services/                      # Servicios Core
│   │   ├── flowRegistry.ts            # ⭐ Registro híbrido de flujos
│   │   ├── routingService.ts          # ⭐ Routing condicional híbrido
│   │   ├── moduleRegistry.ts          # ⭐ Registro modular V1
│   │   ├── templateConverter.ts       # Conversión visual → BuilderBot
│   │   ├── salesFunnelService.ts      # Gestión sales funnel
│   │   ├── variableSyncService.ts     # Sincronización variables
│   │   ├── chatbotService.ts          # Core del chatbot
│   │   ├── leadLookupService.ts       # Gestión de leads
│   │   └── supabase.ts                # Integración DB
│   ├── flows/                         # Flujos BuilderBot
│   │   ├── lead-capture.flow.ts       # Captura de leads
│   │   ├── pymebot-v1.flow.ts         # Flujo principal V1
│   │   └── welcome.flow.ts            # Bienvenida
│   ├── provider/                      # Proveedores
│   │   ├── whatsappProvider.ts        # WhatsApp Baileys
│   │   ├── webProvider.ts             # API Web
│   │   └── providerFactory.ts         # Factory pattern
│   ├── utils/                         # Utilidades
│   │   ├── variableReplacer.ts        # Reemplazo de variables
│   │   ├── compositeMessageProcessor.ts # Procesamiento mensajes
│   │   ├── logger.ts                  # Sistema de logs
│   │   └── systemVariablesLoader.ts   # Carga variables sistema
│   ├── models/                        # Tipos y modelos
│   │   ├── flow.types.ts              # Tipos de flujos
│   │   ├── button.types.ts            # Tipos de botones
│   │   └── extendedFlow.types.ts      # Flujos extendidos
│   ├── config/                        # Configuración
│   │   ├── index.ts                   # Config principal
│   │   └── supabase.ts                # Config Supabase
│   └── app.ts                         # ⭐ Aplicación principal
├── assets/                            # Recursos
├── bot_sessions/                      # Sesiones WhatsApp
└── .env.example                       # Variables de entorno
```

## 📋 Requisitos

- **Node.js 18+**: Runtime principal
- **Supabase**: Base de datos PostgreSQL con RLS
- **BuilderBot**: Motor de chatbots (incluido)
- **WhatsApp Business**: Para integración (opcional)
- **OpenAI API**: Para respuestas IA (opcional)
- **MiniMax API**: Para TTS/STT (opcional)
- **AssemblyAI**: Para STT avanzado (opcional)

## ⚙️ Instalación

### 1. Clonar Repositorio

```bash
git clone https://github.com/LennySnaider/backend-pymebot-v2.git
cd backend-pymebot-v2
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configuración de Variables de Entorno

```bash
cp .env.example .env
```

### Variables de Entorno Requeridas

```env
# Servidor
PORT=3090
NODE_ENV=development

# Supabase (Requerido)
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
SUPABASE_ANON_KEY=tu_anon_key

# OpenAI (Opcional)
OPENAI_API_KEY=tu_openai_key

# MiniMax (Opcional - para voz)
MINIMAX_API_KEY=tu_minimax_key
MINIMAX_GROUP_ID=tu_group_id

# AssemblyAI (Opcional - para STT)
ASSEMBLYAI_API_KEY=tu_assemblyai_key

# WhatsApp (Opcional)
ENABLE_WHATSAPP=true
WHATSAPP_PROVIDER=baileys
```

### 4. Comandos de Desarrollo

```bash
# Desarrollo con auto-reload
npm run dev

# Producción
npm run build
npm start

# Linting
npm run lint

# Testing
npm test
```

## 🔌 API Endpoints

### 💬 **Chat y Mensajería**

```bash
# Procesamiento principal de chat
POST /api/chat
{
  "message": "hola",
  "userId": "user-123", 
  "tenantId": "tenant-uuid"
}

# Procesamiento de texto
POST /api/text
{
  "message": "consulta",
  "from": "5214421234567",
  "tenantId": "tenant-uuid"
}
```

### 📋 **Gestión de Templates**

```bash
# Obtener templates
GET /api/templates?tenantId=uuid

# Crear template
POST /api/templates
{
  "name": "Template Lead Básico",
  "react_flow_json": {...},
  "tenant_id": "uuid"
}

# Activar template
POST /api/templates/activate
{
  "templateId": "template-uuid",
  "tenantId": "tenant-uuid"
}

# Diagnóstico de templates
GET /api/templates-diagnostic?tenantId=uuid
```

### 🔧 **Sistema de Variables**

```bash
# Obtener variables
GET /api/variables?tenantId=uuid

# Actualizar variable
PUT /api/variables
{
  "key": "company_name",
  "value": "Mi Empresa",
  "tenantId": "tenant-uuid"
}

# Variables del sistema (SUPERADMIN)
GET /api/variables/system
POST /api/variables/system
```

### 📊 **Sales Funnel y Leads**

```bash
# Obtener flujos
GET /api/flows?tenantId=uuid

# Diagnóstico de flujos
GET /api/flow-diagnostic?tenantId=uuid

# Gestión de leads (integrado en chat)
# Las etapas se actualizan automáticamente
```

### 🗓️ **Sistema de Citas**

```bash
# Gestión de citas
GET /api/appointments?tenantId=uuid
POST /api/appointments
PUT /api/appointments/:id
DELETE /api/appointments/:id
```

### 🛍️ **Productos y Servicios**

```bash
# Catálogo de productos
GET /api/products?tenantId=uuid
POST /api/products

# Categorías
GET /api/product-categories?tenantId=uuid
POST /api/product-categories
```

### 🎙️ **API de Voz (Opcional)**

```bash
# Conversación por voz
POST /api/voice/chat
{
  "audio": "[archivo de audio]",
  "voice_id": "Friendly_Person",
  "user_id": "usuario123",
  "tenant_id": "tenant-uuid"
}

# Solo transcripción (STT)
POST /api/voice/transcribe

# Solo síntesis (TTS)
POST /api/voice/tts
```

## 📱 Integración con WhatsApp

### Configuración de WhatsApp Business

```env
# Habilitar WhatsApp
ENABLE_WHATSAPP=true
WHATSAPP_PROVIDER=baileys
```

### Proceso de Conexión

1. **Iniciar servidor**: `npm run dev`
2. **Código QR**: Se genera automáticamente en `/bot_sessions/bot.qr.png`
3. **Escanear**: Usar WhatsApp Business en el teléfono
4. **Conexión**: El bot se conecta automáticamente

### Características WhatsApp

- ✅ **Mensajes de texto** con variables
- ✅ **Botones interactivos** 
- ✅ **Listas de opciones**
- ✅ **Captura de respuestas** con `capture: true`
- ✅ **Estados de sesión** persistentes
- ✅ **Multi-tenant** por número

## 🏗️ Arquitectura Híbrida Avanzada

### RoutingService.ts - Análisis Inteligente

```typescript
// Evaluación automática de templates
const shouldUseModular = await routingService.evaluateTemplate(templateId, {
  complexity: 'medium',
  nodeCount: 15,
  modernizationScore: 0.75
});

// Routing condicional transparente
if (shouldUseModular) {
  // Sistema modular V1 (futuro)
  return await moduleRegistry.processMessage(message, context);
} else {
  // Sistema lineal actual (BuilderBot)
  return await flowRegistry.processMessage(message, context);
}
```

### ModuleRegistry.ts - Preparación V1

```typescript
// Infraestructura preparada para módulos
interface ModuleV1 {
  id: string;
  type: 'message' | 'ai' | 'action' | 'condition';
  version: '1.0';
  execution: ModuleExecution;
}

// Registro modular escalable
class ModuleRegistry {
  async processMessage(message: string, context: Context) {
    // Procesamiento modular futuro
  }
}
```

## 🔄 Sistema de Variables Avanzado

### Niveles de Variables

```typescript
// 1. Variables Sistema (SUPERADMIN)
await variableService.setSystemVariable('max_messages_per_day', '1000');

// 2. Variables Tenant (Por cliente)
await variableService.setTenantVariable('company_name', 'Mi Empresa', tenantId);

// 3. Variables Sesión (Runtime)
await sessionStore.setVariable('user_name', 'Juan', sessionId);
```

### Reemplazo Automático

```typescript
// Template con variables
const template = "Hola {{user_name}}, bienvenido a {{company_name}}";

// Reemplazo automático
const message = await variableReplacer.process(template, {
  user_name: "Juan",
  company_name: "Mi Empresa"
});
// Resultado: "Hola Juan, bienvenido a Mi Empresa"
```

## 🧪 Testing del Sistema

### Test de Chat Básico

```bash
curl -X POST http://localhost:3090/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "hola",
    "userId": "test-user",
    "tenantId": "your-tenant-id"
  }'
```

### Test de Template

```bash
curl -X POST http://localhost:3090/api/templates/activate \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "template-uuid",
    "tenantId": "tenant-uuid"
  }'
```

### Test de Variables

```bash
curl -X PUT http://localhost:3090/api/variables \
  -H "Content-Type: application/json" \
  -d '{
    "key": "company_name",
    "value": "Mi Empresa Test",
    "tenantId": "tenant-uuid"
  }'
```

## 🚧 Solución de Problemas

### Issues Comunes

1. **"Lo siento, no pude procesar tu mensaje"**
   - ✅ **Solución**: Timeout aumentado a 3000ms en `flowRegistry.ts:712`
   - ✅ **Verificar**: Template activo en Supabase

2. **Template no responde**
   - ✅ **Verificar**: `is_active: true` en `chatbot_templates`
   - ✅ **Debug**: Usar `/api/templates-diagnostic`

3. **Variables no reemplazan**
   - ✅ **Verificar**: Sintaxis `{{variable_name}}`
   - ✅ **Debug**: Verificar `variableReplacer.ts`

4. **Sales funnel no actualiza**
   - ⚠️ **IMPORTANTE**: Sistema funcionando al 100% - NO TOCAR

### Logs y Debugging

```bash
# Logs principales
tail -f backend.log

# Debug específico
NODE_ENV=development npm run dev

# Test directo BuilderBot
node test-simple-builderbot.cjs
```

## 🤝 Contribución

### Reglas de Desarrollo

- ❌ **NUNCA** hardcodear variables de entorno
- ✅ **SIEMPRE** usar sistema modular V1 para nuevos desarrollos
- ✅ **SIEMPRE** verificar multi-tenant isolation
- ✅ **SIEMPRE** preservar funcionalidad del sales funnel
- ✅ **SIEMPRE** seguir patrones existentes

### Arquitectura Modular

```typescript
// Nuevo desarrollo - usar sistema modular
import { moduleRegistry } from './services/moduleRegistry';

// Legacy - mantener pero no expandir
import { flowRegistry } from './services/flowRegistry';
```

## 📄 Licencia

Proyecto privado - PymeBot V2 Backend

## 🙏 Tecnologías

- **[BuilderBot](https://builderbot.app/)**: Motor de chatbots
- **[Baileys](https://github.com/WhiskeySockets/Baileys)**: WhatsApp Integration
- **[Supabase](https://supabase.com/)**: Database & Auth
- **[OpenAI](https://openai.com/)**: AI Responses
- **[MiniMax](https://api.minimax.chat/)**: TTS/STT
- **[AssemblyAI](https://assemblyai.com/)**: Advanced STT

---

**⚠️ Nota Crítica**: Este backend tiene implementada **arquitectura híbrida** con el **sistema de leads funcionando al 100%**. La funcionalidad del sales funnel está preservada y es crítica para el negocio - **¡NO TOCAR!**
