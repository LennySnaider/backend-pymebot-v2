-- migrations/001_create_flow_tables.sql
-- Migración para crear las tablas necesarias para la gestión de flujos
-- @version 1.1.0
-- @updated 2025-04-25

-- Tabla principal de flujos
CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    entry_node_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    author VARCHAR(255),
    is_template BOOLEAN DEFAULT false,
    parent_template_id UUID,
    edit_permission VARCHAR(50) DEFAULT 'content'
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_flows_tenant_id ON flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_flows_is_active ON flows(is_active);
CREATE INDEX IF NOT EXISTS idx_flows_tenant_active ON flows(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_flows_category ON flows(category);
CREATE INDEX IF NOT EXISTS idx_flows_created_at ON flows(created_at);
CREATE INDEX IF NOT EXISTS idx_flows_parent_template ON flows(parent_template_id);

-- Tabla de nodos de flujo
CREATE TABLE IF NOT EXISTS flow_nodes (
    id VARCHAR(255) NOT NULL,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    next JSONB,
    x FLOAT,
    y FLOAT,
    is_editable BOOLEAN DEFAULT false,
    PRIMARY KEY (id, flow_id)
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_type ON flow_nodes(type);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_editable ON flow_nodes(is_editable);

-- Tabla para almacenar estados de conversación (opcional - para persistencia entre reinicios)
CREATE TABLE IF NOT EXISTS flow_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    current_node_id VARCHAR(255) NOT NULL,
    context JSONB DEFAULT '{}',
    history JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_flow_states_flow_id ON flow_states(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_user_id ON flow_states(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_session_id ON flow_states(session_id);
CREATE INDEX IF NOT EXISTS idx_flow_states_is_active ON flow_states(is_active);
CREATE INDEX IF NOT EXISTS idx_flow_states_user_session ON flow_states(user_id, session_id);

-- Función para actualizar automáticamente el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente updated_at en flows
DROP TRIGGER IF EXISTS update_flows_modtime ON flows;
CREATE TRIGGER update_flows_modtime
BEFORE UPDATE ON flows
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Trigger para actualizar automáticamente last_updated_at en flow_states
DROP TRIGGER IF EXISTS update_flow_states_modtime ON flow_states;
CREATE TRIGGER update_flow_states_modtime
BEFORE UPDATE ON flow_states
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Tabla de plantillas de flujos (creadas por super_admin)
CREATE TABLE IF NOT EXISTS flow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    nodes JSONB NOT NULL,
    entry_node_id VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    author VARCHAR(255),
    editable_nodes TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para actualizar automáticamente updated_at en flow_templates
DROP TRIGGER IF EXISTS update_flow_templates_modtime ON flow_templates;
CREATE TRIGGER update_flow_templates_modtime
BEFORE UPDATE ON flow_templates
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_flow_templates_category ON flow_templates(category);
CREATE INDEX IF NOT EXISTS idx_flow_templates_created_at ON flow_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_flow_templates_author ON flow_templates(author);

-- Comentarios en tablas
COMMENT ON TABLE flows IS 'Tabla principal que almacena los flujos conversacionales';
COMMENT ON TABLE flow_nodes IS 'Tabla que almacena los nodos individuales de cada flujo';
COMMENT ON TABLE flow_states IS 'Tabla que almacena el estado de las conversaciones activas con flujos';
COMMENT ON TABLE flow_templates IS 'Tabla que almacena plantillas de flujos creadas por el super_admin';
COMMENT ON COLUMN flows.parent_template_id IS 'ID de la plantilla original si el flujo es una instancia de plantilla';
COMMENT ON COLUMN flows.edit_permission IS 'Nivel de edición permitido para el tenant (none, content, full)';
COMMENT ON COLUMN flow_nodes.is_editable IS 'Indica si el tenant puede editar este nodo';
COMMENT ON COLUMN flow_templates.editable_nodes IS 'Lista de IDs de nodos que los tenants pueden editar';
