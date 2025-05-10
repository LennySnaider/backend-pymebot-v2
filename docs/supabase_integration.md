# Integración con Supabase para VoiceAgentBot

## Resumen de implementación

Hemos implementado exitosamente las siguientes estructuras en Supabase para dar soporte a los agentes de voz:

### 1. Tablas principales

- **voice_bot_settings**: Almacena configuraciones específicas de voz para cada chatbot
- **voice_templates**: Gestiona plantillas de respuesta en audio pre-renderizadas
- **voice_usage**: Registra métricas de consumo de servicios de voz

### 2. Extensiones a tablas existentes

- Añadimos `bot_type` a `chatbot_templates` para distinguir bots de texto/voz
- Añadimos `voice_enabled` a `tenant_chatbot_activations` como flag de activación
- Añadimos `audio_processing_settings` a `tenant_chatbot_configurations` para guardar configuraciones JSON

### 3. Funciones de soporte

- `update_modified_column()`: Actualiza automáticamente campos de timestamp
- `log_voice_service_usage()`: Registra el consumo de servicios de voz por tenant

### 4. Buckets de almacenamiento

Se han configurado los siguientes buckets en Supabase Storage:

- `tenant_voice_inputs`: Para almacenar los archivos de audio de entrada (notas de voz recibidas)
- `tenant_voice_outputs`: Para almacenar los archivos de audio de salida (respuestas generadas)
- `tenant_voice_templates`: Para almacenar las plantillas de audio pre-renderizadas

## Scripts SQL generados

Hemos generado los siguientes scripts SQL para la implementación:

1. **combined_voice_extensions.sql**: Script generado automáticamente con todas las sentencias SQL extraídas de los archivos Markdown.
2. **combined_voice_extensions_complete.sql**: Script completo con todas las sentencias necesarias para implementar las extensiones de voz en Supabase.

Estos scripts se encuentran en el directorio `supabase/` del proyecto.

## Recomendaciones para mejoras futuras

### 1. Seguridad y acceso a datos

Es recomendable implementar políticas RLS adicionales para garantizar el aislamiento multi-tenant:

```sql
-- Para voice_bot_settings
ALTER TABLE voice_bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants only see their bots' voice settings" ON voice_bot_settings
USING (EXISTS (
  SELECT 1 FROM bots b JOIN tenants t ON b.tenant_id = t.id
  WHERE b.id = voice_bot_settings.chatbot_id
  AND t.id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
));

-- Políticas similares para voice_templates y voice_usage
```

### 2. Mejoras de rendimiento

Añadir índices adicionales una vez que empiece a crecer el volumen de datos:

```sql
CREATE INDEX idx_voice_templates_by_key ON voice_templates(tenant_id, template_key);
CREATE INDEX idx_voice_usage_by_date ON voice_usage(tenant_id, created_at);
```

### 3. Integridad referencial

Añadir restricciones de clave foránea para mantener la consistencia de datos:

```sql
ALTER TABLE voice_bot_settings
ADD CONSTRAINT fk_voice_settings_bot
FOREIGN KEY (chatbot_id) REFERENCES bots(id) ON DELETE CASCADE;
```

### 4. Optimización de almacenamiento

Configurar un sistema de limpieza periódica para datos de uso antiguos:

```sql
CREATE OR REPLACE FUNCTION cleanup_old_voice_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM voice_usage
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;
```

### 5. Monitoreo y análisis

Considerar la creación de vistas materializadas para análisis de uso:

```sql
CREATE MATERIALIZED VIEW voice_usage_monthly AS
SELECT
  tenant_id,
  DATE_TRUNC('month', created_at) AS month,
  SUM(duration_seconds) AS total_seconds,
  SUM(cost_usd) AS total_cost
FROM voice_usage
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

CREATE INDEX idx_voice_usage_monthly ON voice_usage_monthly(tenant_id, month);
```

## Configuración de entorno

Para utilizar Supabase en el proyecto VoiceAgentBot, es necesario configurar las siguientes variables de entorno en el archivo `.env`:

```
ENABLE_SUPABASE=true
ENABLE_MULTITENANT=true
SUPABASE_URL=https://gyslfajscteoqhxefudu.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_key_aqui
```

## Próximos pasos

1. Implementar autenticación JWT para integración segura con el frontend
2. Desarrollar sistema de roles y permisos basado en las políticas RLS
3. Implementar sistema de límites y cuotas diferenciadas por tenant
4. Crear panel de administración para configuración de bots de voz
5. Desarrollar sistema de análisis de uso y métricas
