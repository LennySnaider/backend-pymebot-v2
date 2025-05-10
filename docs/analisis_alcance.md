# Análisis y Alcance del Proyecto: AgentBot Multitenant con Builderbot y MiniMax

## 1. Entendimiento del Requisito

El objetivo principal es adaptar el proyecto base `bot-whatsapp-notas-de-voz` para crear un sistema conversacional multitenant unificado, que soporte tanto chatbots de texto como agentes de voz, utilizando:

- **Node.js y TypeScript**: Como base de desarrollo
- **Express.js**: Para API REST
- **Builderbot**: Para gestión de flujos conversacionales 
- **MiniMax**: Para síntesis de voz (TTS)
- **AssemblyAI**: Para reconocimiento de voz (STT)
- **Supabase**: Para almacenamiento y autenticación multitenant

La solución debe permitir:
1. Crear y gestionar tanto chatbots de texto como agentes de voz desde un mismo sistema
2. Recibir entradas de múltiples canales (web, WhatsApp, API)
3. Procesar audio a texto con STT cuando sea necesario
4. Interpretar mensajes con flujos compartidos de Builderbot
5. Generar respuestas en texto y/o audio según el tipo de bot
6. Mantener aislamiento entre tenants

## 2. Estado Actual del Proyecto

Actualmente, el proyecto base ya cuenta con:

- **Integración de WhatsApp** mediante Baileys
- **Procesamiento de audio** para recibir y enviar notas de voz
- **Implementación base de Builderbot** para manejar la conversación
- **Integración con AssemblyAI** para STT de alta calidad
- **Integración con MiniMax** para TTS con diversas voces
- **Sistema de caché** para respuestas frecuentes

## 3. Modificaciones Necesarias

Las adaptaciones clave que se requieren son:

### A. Sistema Unificado de Chatbots (Texto y Voz)
- Crear una arquitectura que soporte ambos tipos de bots
- Implementar un gestor de bots que permita activar/desactivar cada tipo
- Desarrollar interfaces comunes para procesamiento de mensajes
- Permitir flujos conversacionales que funcionen en ambas modalidades

### B. Cambio de Proveedor de WhatsApp (Flexibilidad)
- Crear un sistema de factory method para alternar entre Baileys y Meta
- Abstraer las funcionalidades dependientes del proveedor
- Implementar configuración por variable de entorno

### C. Sustitución y Ampliación de Servicios de Voz
- Mantener AssemblyAI para STT por su alta calidad
- Optimizar la integración con MiniMax para TTS
- Implementar manejo de errores y fallbacks entre modos

### D. Creación de API Web para Bots
- Desarrollar endpoints RESTful para procesar tanto texto como voz
- Implementar rutas para manejo de STT, TTS y chat completo
- Permitir formatos de entrada diversos (texto, archivo, base64)

### E. Integración Multitenant con Supabase
- Implementar autenticación mediante JWT
- Configurar Row Level Security (RLS) para aislamiento de datos
- Organizar almacenamiento con estructura por tenant

## 4. Estructura de Almacenamiento en Supabase

### Tablas Principales:
- `tenants`: Información básica de los tenants
- `users`: Usuarios del sistema con relación a tenants
- `bots`: Configuración general de bots (común para texto y voz)
- `bot_configurations`: Configuraciones específicas por tipo de bot
- `conversations`: Registro unificado de conversaciones
- `messages`: Mensajes individuales con metadatos
- `analytics`: Métricas de uso por tenant y tipo de bot

### Buckets de Storage:
```
tenant-{tenant_id}/
├── conversations/
│   ├── {conversation_id}-{timestamp}/
│   │   ├── input-{msg_id}.mp3  # Solo para bots de voz
│   │   └── output-{msg_id}.mp3 # Solo para bots de voz
├── templates/
│   ├── text-templates/
│   │   └── {template_id}.json
│   └── voice-templates/
│       └── {template_id}.json
```

## 5. Arquitectura Unificada de Chatbots

Para soportar tanto chatbots de texto como agentes de voz, se propone:

### 5.1. Sistema de Tipos de Bot
- **Bot Base**: Interfaz común con funcionalidades compartidas
- **TextBot**: Especialización para procesamiento de texto puro
- **VoiceBot**: Especialización con capacidades STT y TTS

### 5.2. Flujos Conversacionales Compartidos
- Diseño de flujos reutilizables para ambos tipos de bot
- Sistema de nodos especializados para voz cuando sea necesario
- Adaptadores para conversiones texto-voz según contexto

### 5.3. Sistema de Plantillas
- Plantillas específicas por tipo de bot
- Plantillas híbridas con secciones condicionales
- Herramientas de conversión entre formatos

## 6. Consideraciones de Seguridad y Rendimiento

### Seguridad:
- **Aislamiento de datos**: Implementación rigurosa de RLS
- **Autenticación**: Verificación de JWT en cada solicitud
- **Control de acceso**: Permisos granulares por ruta y recurso
- **Sanitización**: Validación de todas las entradas de usuario

### Rendimiento:
- **Sistema de caché**: Para respuestas frecuentes (texto y TTS)
- **Pre-renderizado**: De frases comunes para respuesta inmediata
- **Optimización de audio**: Detección inteligente de formato
- **Procesamiento asíncrono**: Para operaciones intensivas

## 7. Métricas y Analítica

Se implementará un sistema de métricas unificado que registre:
- Número de conversaciones por tenant y tipo de bot
- Duración total de audio procesado (para bots de voz)
- Número de mensajes procesados (para bots de texto)
- Tasa de éxito/error en todos los servicios
- Rendimiento del sistema (tiempos de respuesta)
- Uso de recursos por tenant

## 8. Alcance Final del Proyecto

El sistema final permitirá:

1. **Creación y gestión** de chatbots de texto y agentes de voz desde una interfaz unificada
2. **Procesamiento integrado** de mensajes de texto y audio
3. **Flujos conversacionales compartidos** entre tipos de bot
4. **Recepción de entradas** desde múltiples canales
5. **Generación inteligente de respuestas** en formato adecuado al tipo de bot
6. **Gestión multitenant** completa con Supabase
7. **Monitoreo y análisis** de uso y rendimiento
8. **Facturación diferenciada** basada en consumo por tenant y tipo de bot
9. **Escalabilidad** para manejar múltiples tenants simultáneos

Este alcance representa una solución integral para la gestión unificada de chatbots de texto y agentes conversacionales de voz con completo aislamiento multitenant y alta calidad de procesamiento.