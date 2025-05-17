# Manual de Desarrollo: Implementación de Streaming de Voz Continuo

## 1. Visión General

Este manual describe los pasos para evolucionar el actual sistema Push-to-Talk (PTT) a un sistema de streaming de voz continuo que detecte automáticamente cuándo el usuario comienza y termina de hablar.

## 2. Modificaciones en el Frontend

### 2.1. Actualización del componente VoiceBotHandler

```
/src/app/(protected-pages)/concepts/chatbot/demo/_components/VoiceBotHandler.tsx
```

- Implementar modo de escucha continua con `MediaRecorder` usando `timeslice` (fragmentos de 200-500ms)
- Añadir detección de silencio/pausas con Web Audio API
- Crear buffer circular para almacenar últimos fragmentos de audio

### 2.2. Mejoras en la interfaz de usuario

```
/src/components/view/ChatBox/components/VoiceChat.tsx
```

- Añadir botón de alternancia "Escucha continua ON/OFF"
- Implementar indicadores visuales para estados:
  - Escuchando activamente
  - Detectando habla
  - Procesando respuesta
- Implementar animaciones de visualización para retroalimentación en tiempo real

## 3. Modificaciones en el Backend

### 3.1. Actualización de VoiceService

```
/src/services/VoiceService.ts
```

- Implementar endpoint para streaming en tiempo real
- Modificar `sendChat` para manejar chunks de audio en lugar de grabaciones completas
- Implementar gestión de sesiones de streaming persistentes

### 3.2. Integración con servicios de STT en tiempo real

- Implementar conexión con AssemblyAI Realtime API o similar
- Configurar WebSockets para comunicación bidireccional
- Crear mecanismo de buffer para fragmentos de texto procesados

## 4. Detección de Actividad de Voz (VAD)

- Integrar algoritmo VAD para determinar automáticamente:
  - Inicio de habla (para comenzar grabación)
  - Finalización de habla (para enviar audio)
  - Filtrado de ruido ambiental
- Implementar umbrales configurables para la sensibilidad

## 5. Optimizaciones

- Implementar almacenamiento en caché de contexto de conversación
- Añadir mecanismo de reintentos para fallos de conexión
- Comprimir audio en cliente para reducir uso de ancho de banda

## 6. Consideraciones de UX

- Añadir notificaciones claras sobre estado de escucha
- Implementar controles de privacidad (indicador de micrófono activo)
- Incluir configuración de usuario para ajustar:
  - Sensibilidad de detección de voz
  - Duración mínima/máxima de silencio para finalizar grabación
  - Activación/desactivación del modo de escucha continua

## 7. Pruebas y Monitoreo

- Implementar herramientas de diagnóstico para:
  - Calidad de la conexión
  - Precisión de la transcripción en tiempo real
  - Latencia de respuesta
- Crear panel de administración para métricas de rendimiento

## 8. Consideraciones de Recursos y Rendimiento

- El streaming de voz aumentará considerablemente el consumo de recursos del servidor
- Implementar límites de uso por tenant
- Considerar escalamiento horizontal para manejar múltiples conexiones simultáneas

## Próximos Pasos

1. Realizar análisis de viabilidad técnica y estimación de recursos
2. Implementar prototipo con funcionalidad básica
3. Realizar pruebas de carga y rendimiento
4. Desarrollar plan de implementación incremental

---

Este manual proporciona una hoja de ruta de alto nivel. La implementación requerirá profundizar en cada área, evaluar las opciones tecnológicas específicas y adaptar la solución a los requisitos precisos del sistema.