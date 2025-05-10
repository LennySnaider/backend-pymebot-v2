# Extensiones SQL para Soporte de Voz en Supabase

Este documento contiene los scripts SQL necesarios para extender la base de datos de Supabase con soporte para agentes de voz. Estos scripts deben ejecutarse en la instancia de Supabase para habilitar las funcionalidades de procesamiento de voz en el proyecto voiceAgentBot.

## 1. Tablas Adicionales para Procesamiento de Voz

### 1.1 Tabla de Configuraciones de Bots de Voz

```sql
-- Tabla para configuraciones específicas de bots de voz
CREATE TABLE voice_bot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activation_id UUID NOT NULL REFERENCES tenant_chatbot_activations(id) ON DELETE CASCADE,
    voice_id VARCHAR(50) NOT NULL,
    voice_provider VARCHAR(20) NOT NULL, -- 'minimax', 'assemblyai', etc.
    voice_settings JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para actualizar el campo updated_at
CREATE TRIGGER update_voice_bot_settings_modtime
BEFORE UPDATE ON voice_bot_settings
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Índice para búsquedas por activation_id
CREATE INDEX idx_voice_bot_settings_activation_id ON voice_bot_settings(activation_id);
```

### 1.2 Tabla de Plantillas de Voz Pre-renderizadas

```sql
-- Tabla para plantillas de respuestas de voz pre-renderizadas
CREATE TABLE voice_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    template_key VARCHAR(100) NOT NULL,
    voice_id VARCHAR(50) NOT NULL,
    audio_url TEXT NOT NULL,
    text_content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, template_key, voice_id)
);

-- Trigger para actualizar el campo updated_at
CREATE TRIGGER update_voice_templates_modtime
BEFORE UPDATE ON voice_templates
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Índice para búsquedas por tenant_id
CREATE INDEX idx_voice_templates_tenant_id ON voice_templates(tenant_id);
-- Índice para búsquedas por template_key
CREATE INDEX idx_voice_templates_template_key ON voice_templates(template_key);
```

## 2. Extensiones a Tablas Existentes

```sql
-- Añadir campo bot_type a la tabla chatbot_templates
ALTER TABLE chatbot_templates ADD COLUMN IF NOT EXISTS bot_type VARCHAR(20) DEFAULT 'text';

-- Añadir campo voice_enabled a la tabla tenant_chatbot_activations
ALTER TABLE tenant_chatbot_activations ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT false;

-- Añadir campo audio_processing_settings a la tabla tenant_chatbot_configurations
ALTER TABLE tenant_chatbot_configurations ADD COLUMN IF NOT EXISTS audio_processing_settings JSONB DEFAULT '{}'::JSONB;
```

## 3. Políticas de Row Level Security (RLS)

```sql
-- Políticas para voice_bot_settings
ALTER TABLE voice_bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SUPERADMIN puede gestionar todas las configuraciones de voz"
ON voice_bot_settings
FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin'
);

CREATE POLICY "ADMIN puede gestionar sus propias configuraciones de voz"
ON voice_bot_settings
FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' AND
    EXISTS (
        SELECT 1 FROM tenant_chatbot_activations tca
        JOIN tenants t ON tca.tenant_id = t.id
        WHERE tca.id = activation_id AND
        t.id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
    )
);

-- Políticas para voice_templates
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SUPERADMIN puede gestionar todas las plantillas de voz"
ON voice_templates
FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'superadmin'
);

CREATE POLICY "ADMIN puede gestionar sus propias plantillas de voz"
ON voice_templates
FOR ALL USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin' AND
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
);

CREATE POLICY "Service account can manage all voice templates"
ON voice_templates
FOR ALL USING (
    true
);
```

## 4. Funciones para Procesamiento de Voz

```sql
-- Función para registrar el uso de servicios de voz
CREATE OR REPLACE FUNCTION log_voice_service_usage(
    p_tenant_id UUID,
    p_session_id UUID,
    p_service_type TEXT,
    p_model_used TEXT,
    p_duration_seconds NUMERIC,
    p_cost_usd NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
BEGIN
    INSERT INTO ai_token_usage (
        tenant_id,
        session_id,
        service_type,
        model_used,
        total_tokens,  -- Usamos este campo para almacenar la duración en segundos
        cost_usd
    ) VALUES (
        p_tenant_id,
        p_session_id,
        p_service_type,
        p_model_used,
        p_duration_seconds::INT,
        p_cost_usd
    )
    RETURNING id INTO v_usage_id;

    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;
```

## 5. Configuración de Buckets de Almacenamiento

Para configurar los buckets de almacenamiento, se deben ejecutar los siguientes comandos desde la interfaz de Supabase o mediante la API:

1. Crear bucket para archivos de audio de entrada:

```sql
-- Este comando debe ejecutarse desde la interfaz de Supabase o mediante la API
-- CREATE BUCKET tenant_voice_inputs;
```

2. Crear bucket para archivos de audio de salida:

```sql
-- Este comando debe ejecutarse desde la interfaz de Supabase o mediante la API
-- CREATE BUCKET tenant_voice_outputs;
```

3. Crear bucket para plantillas de audio pre-renderizadas:

```sql
-- Este comando debe ejecutarse desde la interfaz de Supabase o mediante la API
-- CREATE BUCKET tenant_voice_templates;
```

## 6. Notas de Implementación

1. Asegúrate de que la función `update_modified_column()` exista antes de crear los triggers.
2. Verifica que las tablas referenciadas (`tenant_chatbot_activations`, `tenants`, etc.) existan antes de crear las nuevas tablas.
3. Las políticas RLS asumen que el campo `app_metadata` en el JWT contiene los campos `role` y `tenant_id`.
4. La configuración de buckets debe realizarse a través de la interfaz de Supabase o mediante la API, ya que no se puede hacer directamente con SQL.
