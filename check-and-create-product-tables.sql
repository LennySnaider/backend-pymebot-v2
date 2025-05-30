-- Script para verificar y crear las tablas de productos/categorías
-- Ejecutar este script en Supabase para asegurar que las tablas existen

-- Verificar si las tablas existen
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN ('product_categories', 'products')
    AND schemaname = 'public';

-- Si las tablas no existen, crear la estructura
-- Habilitar UUID si no está habilitado
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de categorías de productos/servicios por tenant
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    UNIQUE (tenant_id, name, parent_id)
);

-- Tabla de productos/servicios por tenant
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2),
    currency TEXT DEFAULT 'USD',
    duration_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_by TEXT,
    UNIQUE (tenant_id, category_id, name)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_id ON product_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active ON product_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Función para actualizar el timestamp updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
DROP TRIGGER IF EXISTS update_product_categories_updated_at ON product_categories;
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar categorías de ejemplo para testing (solo si no existen)
INSERT INTO product_categories (tenant_id, name, description, display_order, created_by, updated_by) 
SELECT 
    'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID,
    'Inmobiliaria',
    'Servicios inmobiliarios y propiedades',
    1,
    'system',
    'system'
WHERE NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE tenant_id = 'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID 
    AND name = 'Inmobiliaria'
);

INSERT INTO product_categories (tenant_id, name, description, display_order, created_by, updated_by) 
SELECT 
    'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID,
    'Servicios Médicos',
    'Consultas y tratamientos médicos',
    2,
    'system',
    'system'
WHERE NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE tenant_id = 'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID 
    AND name = 'Servicios Médicos'
);

INSERT INTO product_categories (tenant_id, name, description, display_order, created_by, updated_by) 
SELECT 
    'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID,
    'General',
    'Servicios generales',
    3,
    'system',
    'system'
WHERE NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE tenant_id = 'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID 
    AND name = 'General'
);

-- Verificar que las categorías se crearon
SELECT 
    id,
    tenant_id,
    name,
    description,
    display_order,
    is_active,
    created_at
FROM product_categories 
WHERE tenant_id = 'afa60b0a-3046-4607-9c48-266af6e1d322'::UUID
ORDER BY display_order;

-- Mostrar información de las tablas creadas
SELECT 
    'product_categories' as table_name,
    count(*) as total_records
FROM product_categories
UNION ALL
SELECT 
    'products' as table_name,
    count(*) as total_records
FROM products;