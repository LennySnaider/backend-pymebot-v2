-- Verificar las activaciones del tenant
SELECT 
    id,
    tenant_id,
    template_id,
    is_active,
    created_at,
    updated_at
FROM tenant_chatbot_activations
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
ORDER BY created_at DESC;

-- Verificar la plantilla problemática
SELECT 
    id,
    name,
    description,
    status,
    created_at,
    updated_at
FROM chatbot_templates
WHERE id = '3fa60b0a-3046-4607-9c48-266af6e1d399';

-- Verificar la plantilla correcta
SELECT 
    id,
    name,
    description,
    status,
    created_at,
    updated_at
FROM chatbot_templates
WHERE id = 'afa60b0a-3046-4607-9c48-266af6e1d322';

-- Verificar todas las activaciones para ver si hay duplicados
SELECT 
    tca.id,
    tca.tenant_id,
    tca.template_id,
    tca.is_active,
    ct.name as template_name,
    ct.status as template_status
FROM tenant_chatbot_activations tca
LEFT JOIN chatbot_templates ct ON ct.id = tca.template_id
WHERE tca.tenant_id = '00000000-0000-0000-0000-000000000000'
ORDER BY tca.is_active DESC, tca.created_at DESC;