-- Script directo para actualizar las activaciones con template_id incorrecto
-- Este script actualizará las referencias del template_id incorrecto al correcto

-- Primero, desactivar todas las activaciones actuales del tenant
UPDATE tenant_chatbot_activations
SET is_active = false, 
    updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000000';

-- Actualizar las activaciones que tienen el template_id incorrecto
UPDATE tenant_chatbot_activations
SET template_id = 'afa60b0a-3046-4607-9c48-266af6e1d322',
    is_active = true,
    updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
  AND template_id = '3fa60b0a-3046-4607-9c48-266af6e1d399';

-- Si no hay ninguna activación para el template correcto, crear una nueva
INSERT INTO tenant_chatbot_activations (tenant_id, template_id, is_active)
SELECT '00000000-0000-0000-0000-000000000000', 'afa60b0a-3046-4607-9c48-266af6e1d322', true
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_chatbot_activations 
    WHERE tenant_id = '00000000-0000-0000-0000-000000000000' 
    AND template_id = 'afa60b0a-3046-4607-9c48-266af6e1d322'
)
ON CONFLICT (tenant_id, template_id) DO UPDATE
SET is_active = true,
    updated_at = NOW();

-- Verificar el resultado
SELECT 
    tca.id,
    tca.tenant_id,
    tca.template_id,
    tca.is_active,
    ct.name as template_name,
    ct.status as template_status,
    tca.updated_at
FROM tenant_chatbot_activations tca
LEFT JOIN chatbot_templates ct ON ct.id = tca.template_id
WHERE tca.tenant_id = '00000000-0000-0000-0000-000000000000'
  AND tca.is_active = true
ORDER BY tca.updated_at DESC;