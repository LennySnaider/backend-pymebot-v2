-- migrations/002_create_audit_table.sql
-- Migración para crear la tabla de auditoría
-- @version 1.0.0
-- @updated 2025-04-25

-- Tabla de auditoría para acciones de super_admin y tenants
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type VARCHAR(50) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    resource_id VARCHAR(255),
    resource_type VARCHAR(50),
    resource_name TEXT,
    details JSONB,
    user_role VARCHAR(50),
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant ON audit_logs(user_id, tenant_id);

-- Crear función RPC para que los clientes puedan crear esta tabla
CREATE OR REPLACE FUNCTION create_audit_table()
RETURNS BOOLEAN AS $$
BEGIN
    -- Verificamos si la tabla ya existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        RETURN true;
    END IF;
    
    -- Creamos la tabla
    CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type VARCHAR(50) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255) NOT NULL,
        resource_id VARCHAR(255),
        resource_type VARCHAR(50),
        resource_name TEXT,
        details JSONB,
        user_role VARCHAR(50),
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Creamos los índices
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant ON audit_logs(user_id, tenant_id);
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Comentarios en tablas
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de acciones sobre flujos y plantillas';
COMMENT ON COLUMN audit_logs.action_type IS 'Tipo de acción realizada (crear, actualizar, eliminar, etc.)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Tipo de recurso (flow, template)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID del recurso afectado';
COMMENT ON COLUMN audit_logs.user_role IS 'Rol del usuario que realizó la acción';
