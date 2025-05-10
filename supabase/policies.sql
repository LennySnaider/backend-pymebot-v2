/**
 * supabase/policies.sql
 *
 * Políticas de Row Level Security (RLS) para Supabase.
 * Configuración para multitenant con aislamiento de datos.
 * @version 1.0.0
 * @updated 2025-04-17
 */

-- Habilitar Row Level Security para todas las tablas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- Políticas para tabla de tenants
CREATE POLICY "Tenants visibles para el propietario o usuarios con acceso"
    ON tenants FOR SELECT
    USING (owner_id = auth.uid() OR
           EXISTS (
               SELECT 1 FROM tenant_users
               WHERE tenant_users.tenant_id = tenants.id
               AND tenant_users.user_id = auth.uid()
           ));

CREATE POLICY "Solo el propietario puede modificar el tenant"
    ON tenants FOR UPDATE
    USING (owner_id = auth.uid());

-- Políticas para tabla de bots
CREATE POLICY "Bots visibles para usuarios del tenant"
    ON bots FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM tenants WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Solo el owner del tenant o administradores del bot pueden modificar bots"
    ON bots FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM tenants 
            WHERE tenants.id = bots.tenant_id 
            AND tenants.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM bot_admins 
            WHERE bot_admins.bot_id = bots.id 
            AND bot_admins.user_id = auth.uid()
        )
    );

CREATE POLICY "Solo el owner del tenant o administradores del bot pueden eliminar bots"
    ON bots FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM tenants 
            WHERE tenants.id = bots.tenant_id 
            AND tenants.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM bot_admins 
            WHERE bot_admins.bot_id = bots.id 
            AND bot_admins.user_id = auth.uid()
        )
    );

-- Políticas para tabla de mensajes
CREATE POLICY "Mensajes visibles para usuarios del tenant"
    ON messages FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM tenant_users
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM tenants WHERE owner_id = auth.uid()
    ));

CREATE POLICY "Usuarios pueden ver sus propios mensajes"
    ON messages FOR SELECT
    USING (user_id = auth.uid());

-- Políticas para tabla de uso
CREATE POLICY "Estadísticas de uso visibles para el propietario del tenant"
    ON usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants 
            WHERE tenants.id = usage.tenant_id 
            AND tenants.owner_id = auth.uid()
        )
    );

-- Función para actualizar contadores de usuarios únicos
CREATE OR REPLACE FUNCTION update_unique_users()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar contadores de usuarios únicos para el día actual
    UPDATE usage
    SET unique_users = (
        SELECT COUNT(DISTINCT user_id) 
        FROM messages 
        WHERE tenant_id = NEW.tenant_id 
        AND DATE(created_at) = DATE(NEW.created_at)
    )
    WHERE tenant_id = NEW.tenant_id 
    AND date = DATE(NEW.created_at);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estadísticas de usuarios únicos
CREATE TRIGGER trigger_update_unique_users
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_unique_users();

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_messages_tenant_user ON messages(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bots_tenant ON bots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON usage(tenant_id, date);
