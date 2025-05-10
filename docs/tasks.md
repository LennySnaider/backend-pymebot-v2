# Tareas Pendientes - Agente Conversacional de Voz

Este documento registra las tareas pendientes, en progreso y completadas para el desarrollo del agente conversacional de voz con Builderbot y MiniMax.

## Estado General del Proyecto

- **STT (Speech to Text)**: Implementado con AssemblyAI
- **TTS (Text to Speech)**: Implementado con MiniMax
- **Builderbot**: Integrado y funcionando
- **Supabase**: Estructura base implementada
- **Multitenant**: Estructura base implementada
- **API Web**: Implementada

## Tareas Completadas

- [x] Configurar proyecto base con TypeScript y Express
- [x] Integrar Builderbot para flujos conversacionales
- [x] Implementar STT con AssemblyAI
- [x] Implementar TTS con MiniMax
- [x] Crear flujos básicos de conversación (welcome, info)
- [x] Crear API para procesar audio y texto
- [x] Implementar caché para respuestas TTS
- [x] Crear sistema multitenant base
- [x] Integrar autenticación básica con Supabase
- [x] Implementar Row Level Security (RLS) para Supabase
- [x] Crear estructura para múltiples proveedores (web, WhatsApp)
- [x] Implementar interfaz web básica para pruebas

## Tareas en Progreso

- [ ] Mejorar la interfaz web con más opciones y mejor diseño
- [ ] Optimizar el caché de audio para reducir latencia
- [ ] Refinar los flujos conversacionales para casos específicos

## Tareas Pendientes

### Prioritarias (Corto Plazo)

- [ ] Implementar sistema de análisis de sentimiento en mensajes
- [ ] Añadir soporte para webhooks para integraciones externas
- [ ] Mejorar gestión de errores y reintentos en servicios de voz
- [ ] Implementar pruebas automatizadas para componentes clave
- [ ] Crear documentación detallada de la API
- [ ] Optimizar rendimiento del servicio de transcripción

### Media Prioridad (Mediano Plazo)

- [ ] Crear dashboard administrativo para gestión de tenants
- [ ] Implementar sistema de estadísticas y analytics
- [ ] Añadir soporte para modelos de IA personalizados
- [ ] Crear sistema de plantillas para respuestas predefinidas
- [ ] Implementar detección automática de idioma
- [ ] Añadir soporte para múltiples idiomas en la interfaz

### Baja Prioridad (Largo Plazo)

- [ ] Implementar streaming de audio en tiempo real
- [ ] Crear conectores para plataformas adicionales (Telegram, etc.)
- [ ] Implementar sistema de plugins extensible
- [ ] Crear SDK para fácil integración con aplicaciones externas
- [ ] Añadir soporte para reconocimiento de múltiples hablantes
- [ ] Implementar sistema de análisis de conversaciones

## Mejoras Técnicas

- [ ] Refactorizar servicios para reducir acoplamiento
- [ ] Mejorar sistema de logging para facilitar diagnóstico
- [ ] Implementar métricas de rendimiento y monitoreo
- [ ] Optimizar configuración de Docker para producción
- [ ] Crear pipeline de CI/CD para despliegue automático
- [ ] Implementar rate limiting y protección contra abusos

## Errores Conocidos

- [ ] Issue #1: La caché de TTS no se limpia correctamente en ciertos casos
- [ ] Issue #2: Ocasionalmente hay problemas con la detección de formato de audio
- [ ] Issue #3: El proveedor de WhatsApp puede desconectarse en sesiones largas

## Notas Importantes

1. **NUNCA implementar STT con MiniMax** - Este servicio no existe y cualquier intento de usarlo dará errores.
2. La API de MiniMax para TTS puede cambiar, estar atento a actualizaciones.
3. Para probar el sistema es necesario tener una clave válida de AssemblyAI y MiniMax.
4. La configuración multitenant requiere una instancia configurada de Supabase.

## Siguientes Pasos

1. Completar las tareas prioritarias
2. Realizar pruebas extensivas con usuarios reales
3. Optimizar para producción
4. Implementar dashboard administrativo
5. Expandir a más canales y plataformas

---

*Última actualización: 17 de Abril de 2025*
