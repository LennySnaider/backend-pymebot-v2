# Plan de Actividades: Implementación de AgentBot Multitenant (Texto y Voz)

## 1. Preparación y Configuración

### 1.1. Configuración del Entorno Base

- [x] Clonar repositorio base `bot-whatsapp-notas-de-voz`
- [x] Instalar dependencias necesarias
- [x] Configurar estructura de proyecto TypeScript
- [x] Configurar linting y formateado
- [ ] Establecer pipeline CI/CD

### 1.2. Configuración de Servicios Externos

- [x] Configurar credenciales de AssemblyAI
- [x] Configurar credenciales de MiniMax
- [x] Crear proyecto en Supabase
- [ ] Configurar autenticación JWT en Supabase
- [x] Definir esquema de base de datos unificado para bots de texto y voz

## 2. Arquitectura Unificada de Bots

### 2.1. Diseño de Core Compartido

- [ ] Crear interfaces base para bots (TextBot, VoiceBot)
- [ ] Implementar clases abstractas con funcionalidad común
- [ ] Desarrollar sistema de factory para creación de bots
- [ ] Implementar registro de tipos de bot

### 2.2. Adaptación de Builderbot

- [ ] Crear sistema adaptador para flujos conversacionales
- [ ] Implementar mecanismo de nodos especializados por tipo
- [ ] Desarrollar sistema de transiciones entre modalidades
- [ ] Crear herramientas de prueba para flujos híbridos

## 3. Desarrollo del Backend para Bots de Texto

### 3.1. API para Chatbots de Texto

- [ ] Implementar endpoint `/api/text/chat`
- [ ] Desarrollar rutas auxiliares para gestión de mensajes
- [ ] Crear sistema de sesiones de chat
- [ ] Implementar webhooks para integraciones externas

### 3.2. Procesamiento de Texto

- [ ] Crear servicios de preprocesamiento de texto
- [ ] Implementar detector de idioma
- [ ] Desarrollar sistema de análisis de sentimiento (opcional)
- [ ] Crear sistema de caché para respuestas frecuentes

## 4. Desarrollo del Backend para Agentes de Voz

### 4.1. Adaptación del Sistema de Proveedores

- [ ] Crear interfaz común para proveedores de mensajería
- [ ] Implementar Factory Method para selección de proveedor
- [x] Adaptar proveedor Baileys actual
- [ ] Implementar proveedor Meta
- [ ] Crear mecanismo de cambio dinámico

### 4.2. Servicios de Voz

- [x] Refactorizar servicio STT con AssemblyAI
- [x] Optimizar servicio TTS con MiniMax
- [x] Implementar sistema de detección de formato de audio
- [x] Desarrollar sistema de caché para respuestas TTS
- [x] Implementar pre-renderizado de frases comunes

### 4.3. API para Agentes de Voz

- [x] Crear endpoints para procesamiento de voz
- [x] Implementar ruta `/api/voice/chat` principal
- [x] Desarrollar rutas auxiliares para STT y TTS
- [ ] Crear rutas de configuración y gestión de voces

## 5. Integración con Builderbot

### 5.1. Adaptación para Soporte Bidual

- [x] Crear proveedor personalizado para API web
- [ ] Adaptar flujos existentes para soporte multitenant
- [ ] Implementar sistema de carga dinámica de flujos
- [ ] Desarrollar mecanismo para identificar tipo de bot en tiempo de ejecución
- [ ] Implementar adaptadores específicos por tipo de bot

### 5.2. Gestor de Plantillas

- [ ] Crear sistema de plantillas para ambos tipos de bot
- [ ] Implementar editor de plantillas (opcional)
- [ ] Desarrollar verificador de integridad de plantillas
- [ ] Crear convertidor entre formatos de plantilla

## 6. Integración con Supabase

### 6.1. Autenticación y Usuarios

- [ ] Implementar mecanismo de decodificación JWT
- [ ] Crear middleware de autenticación
- [ ] Desarrollar sistema de roles y permisos
- [ ] Implementar verificación de pertenencia a tenant

### 6.2. Almacenamiento

- [x] Configurar buckets en Supabase Storage
- [ ] Implementar cliente para Storage en el backend
- [ ] Desarrollar sistema de organización por tenant y tipo de bot
- [ ] Crear sistema de TTL para archivos

### 6.3. Base de Datos

- [x] Crear tablas compartidas y específicas en Supabase
- [x] Implementar políticas RLS para cada tabla
- [ ] Desarrollar sistema unificado de logs de conversaciones
- [ ] Crear mecanismo de análisis de uso por tipo de bot

## 7. Desarrollo del Sistema Multitenant

### 7.1. Gestión de Tenants

- [ ] Implementar sistema de registro de tenants
- [ ] Crear panel de configuración por tenant
- [ ] Desarrollar sistema de límites y cuotas diferenciadas
- [ ] Implementar aislamiento completo de datos

### 7.2. Configuración de Bots por Tenant

- [ ] Crear interfaz de configuración de bots (API)
- [ ] Implementar sistema de activación/desactivación
- [ ] Desarrollar sistema de versiones de bots
- [ ] Crear mecanismo de clonación de configuraciones

## 8. Integración de Canales

### 8.1. Canal Web

- [ ] Implementar SDK para integración web
- [ ] Crear componentes de chat de texto
- [ ] Desarrollar componentes de chat de voz
- [ ] Implementar sistema de WebSockets para tiempo real

### 8.2. Canal WhatsApp

- [ ] Adaptar proveedor WhatsApp para ambos tipos de bot
- [ ] Implementar detección automática de tipo de mensaje
- [ ] Desarrollar mecanismo de switch entre modalidades
- [ ] Crear sistema de plantillas multimedia

### 8.3. API Pública

- [ ] Diseñar API REST para integraciones externas
- [ ] Implementar sistema de API keys por tenant
- [ ] Desarrollar documentación con OpenAPI/Swagger
- [ ] Crear ejemplos de integración

## 9. Optimización y Mejoras

### 9.1. Rendimiento

- [ ] Implementar sistema de caché distribuido
- [ ] Optimizar procesamiento de texto y audio
- [ ] Desarrollar mecanismo de procesamiento en paralelo
- [ ] Implementar compresión de archivos
- [x] Solucionar problema de visualización de mensajes múltiples

### 9.3. Mejoras para Supabase

- [ ] Implementar políticas RLS adicionales para garantizar aislamiento multi-tenant
- [ ] Añadir índices adicionales para mejorar rendimiento con alto volumen de datos
- [ ] Reforzar integridad referencial con restricciones de clave foránea
- [ ] Configurar sistema de limpieza periódica para datos antiguos
- [ ] Crear vistas materializadas para análisis de uso

### 9.2. Monitoreo y Analítica

- [ ] Crear sistema de logs centralizado
- [ ] Implementar dashboard de métricas por tipo de bot
- [ ] Desarrollar alertas para errores críticos
- [ ] Crear sistema de reportes periódicos

## 10. Seguridad

### 10.1. Protección de Datos

- [ ] Implementar cifrado de mensajes sensibles
- [ ] Crear sistema de redacción automática
- [ ] Desarrollar mecanismo de cumplimiento GDPR
- [ ] Implementar retención configurable de datos

### 10.2. Control de Acceso

- [ ] Crear sistema de roles granulares
- [ ] Implementar permisos por tenant y tipo de bot
- [ ] Desarrollar auditoría de acciones
- [ ] Crear sistema de tokens temporales

## 11. Pruebas y Despliegue

### 11.1. Testing

- [ ] Desarrollar pruebas unitarias para ambos tipos de bot
- [ ] Crear pruebas de integración
- [ ] Implementar pruebas de carga diferenciadas
- [ ] Realizar pruebas de seguridad

### 11.2. Documentación

- [ ] Crear documentación técnica completa
- [ ] Desarrollar guías de usuario específicas por tipo de bot
- [ ] Documentar API con Swagger/OpenAPI
- [ ] Crear tutoriales de integración

### 11.3. Despliegue

- [ ] Configurar entorno de staging
- [ ] Implementar despliegue automatizado
- [ ] Crear scripts de migración
- [ ] Desarrollar plan de rollback

## 12. Cronograma Estimado

| Fase                           | Tiempo Estimado | Dependencias |
| ------------------------------ | --------------- | ------------ |
| 1. Preparación                 | 1 semana        | Ninguna      |
| 2. Arquitectura Unificada      | 2 semanas       | Fase 1       |
| 3. Backend para Bots de Texto  | 2 semanas       | Fase 2       |
| 4. Backend para Agentes de Voz | 2 semanas       | Fase 2       |
| 5. Integración con Builderbot  | 2 semanas       | Fases 3 y 4  |
| 6. Integración con Supabase    | 2 semanas       | Fase 1       |
| 7. Sistema Multitenant         | 2 semanas       | Fases 5 y 6  |
| 8. Integración de Canales      | 2 semanas       | Fase 7       |
| 9. Optimización                | 1 semana        | Fase 8       |
| 10. Seguridad                  | 1 semana        | Fase 8       |
| 11. Pruebas y Despliegue       | 2 semanas       | Fases 9 y 10 |

**Tiempo total estimado: 19 semanas**

## 13. Hitos Clave

1. **Semana 3**: Arquitectura unificada completada
2. **Semana 7**: Backend funcional para ambos tipos de bot
3. **Semana 9**: Integración con Supabase completada
4. **Semana 11**: Sistema multitenant operativo
5. **Semana 13**: Integración de canales completada
6. **Semana 15**: Optimización y seguridad implementadas
7. **Semana 17**: Pruebas completadas
8. **Semana 19**: Despliegue a producción

## 14. Riesgos y Mitigaciones

### Riesgos Técnicos

1. **Complejidad en la arquitectura unificada**: Implementar un MVP temprano para validar conceptos
2. **Cambios en APIs externas**: Implementar adaptadores y versionar dependencias
3. **Problemas de rendimiento con múltiples tenants**: Diseñar sistema de escalado horizontal
4. **Fallos en servicios de voz**: Implementar sistema de fallback entre proveedores

### Riesgos de Proyecto

1. **Ampliación del alcance**: Mantener documentación clara de requisitos y alcance
2. **Retrasos en integración**: Priorizar pruebas de integración tempranas
3. **Complejidad en la gestión dual**: Establecer revisiones periódicas de arquitectura
4. **Complejidad en la migración de bots existentes**: Crear herramientas de migración asistida
