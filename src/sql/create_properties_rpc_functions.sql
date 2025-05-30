-- Funciones RPC para el sistema de propiedades inmobiliarias
-- Estas funciones permiten saltar las restricciones de RLS para operaciones críticas

-- Función para obtener propiedades para un tenant específico
CREATE OR REPLACE FUNCTION get_properties_for_tenant(
  p_tenant_id UUID,
  p_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS SETOF properties AS $$
BEGIN
  IF p_type IS NULL THEN
    RETURN QUERY
      SELECT *
      FROM properties 
      WHERE tenant_id = p_tenant_id 
        AND is_active = true
      ORDER BY is_featured DESC, created_at DESC
      LIMIT p_limit;
  ELSE
    RETURN QUERY
      SELECT *
      FROM properties 
      WHERE tenant_id = p_tenant_id 
        AND type = p_type
        AND is_active = true
      ORDER BY is_featured DESC, created_at DESC
      LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener una propiedad específica por ID
CREATE OR REPLACE FUNCTION get_property_by_id(
  p_property_id UUID,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS properties AS $$
DECLARE
  v_property properties;
BEGIN
  IF p_tenant_id IS NULL THEN
    SELECT *
    INTO v_property
    FROM properties
    WHERE id = p_property_id;
  ELSE
    SELECT *
    INTO v_property
    FROM properties
    WHERE id = p_property_id AND tenant_id = p_tenant_id;
  END IF;
  
  RETURN v_property;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener propiedades destacadas
CREATE OR REPLACE FUNCTION get_featured_properties_for_tenant(
  p_tenant_id UUID,
  p_limit INT DEFAULT 3
)
RETURNS SETOF properties AS $$
BEGIN
  RETURN QUERY
    SELECT *
    FROM properties 
    WHERE tenant_id = p_tenant_id 
      AND is_active = true
      AND is_featured = true
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para buscar Casa Claudia o una casa alternativa
CREATE OR REPLACE FUNCTION get_casa_claudia_property(
  p_tenant_id UUID
)
RETURNS properties AS $$
DECLARE
  v_casa_claudia properties;
  v_casa_alternativa properties;
BEGIN
  -- Primero buscar por nombre "Casa Claudia"
  SELECT *
  INTO v_casa_claudia
  FROM properties
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND name ILIKE '%Casa Claudia%'
  LIMIT 1;
  
  -- Si se encontró, devolverla
  IF v_casa_claudia.id IS NOT NULL THEN
    RETURN v_casa_claudia;
  END IF;
  
  -- Si no se encontró, buscar cualquier casa
  SELECT *
  INTO v_casa_alternativa
  FROM properties
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND type = 'Casa'
  LIMIT 1;
  
  -- Si se encontró una casa alternativa, devolverla
  IF v_casa_alternativa.id IS NOT NULL THEN
    RETURN v_casa_alternativa;
  END IF;
  
  -- Si no se encontró ninguna propiedad, devolver NULL
  RETURN v_casa_claudia; -- Es NULL
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para asegurar que las funciones tienen la configuración correcta
COMMENT ON FUNCTION get_properties_for_tenant IS 'Obtiene propiedades para un tenant específico, evitando restricciones de RLS';
COMMENT ON FUNCTION get_property_by_id IS 'Obtiene una propiedad específica por ID, evitando restricciones de RLS';
COMMENT ON FUNCTION get_featured_properties_for_tenant IS 'Obtiene propiedades destacadas para un tenant específico, evitando restricciones de RLS';
COMMENT ON FUNCTION get_casa_claudia_property IS 'Obtiene Casa Claudia o una casa alternativa para un tenant específico, evitando restricciones de RLS';