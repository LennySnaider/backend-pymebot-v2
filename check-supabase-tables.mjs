import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('=== Verificando tablas de chatbot ===');
    
    // 1. Verificar chatbot_templates
    console.log('\n1. Tabla chatbot_templates:');
    const { data: templates, error: templatesError } = await supabase
      .from('chatbot_templates')
      .select('id, name, tenant_id, is_published')
      .limit(10);
    
    if (templatesError) {
      console.log('Error en chatbot_templates:', templatesError);
    } else {
      console.log('Templates encontradas:', templates?.length || 0);
      templates?.forEach(t => console.log(`- ${t.id} | ${t.name} | tenant: ${t.tenant_id} | published: ${t.is_published}`));
    }
    
    // 2. Verificar chatbot_template_activations
    console.log('\n2. Tabla chatbot_template_activations:');
    const { data: activations, error: activationsError } = await supabase
      .from('chatbot_template_activations')
      .select('template_id, tenant_id, is_active')
      .limit(10);
    
    if (activationsError) {
      console.log('Error en chatbot_template_activations:', activationsError);
    } else {
      console.log('Activaciones encontradas:', activations?.length || 0);
      activations?.forEach(a => console.log(`- template: ${a.template_id} | tenant: ${a.tenant_id} | active: ${a.is_active}`));
    }
    
    // 3. Verificar tenant específico
    console.log('\n3. Para tenant afa60b0a-3046-4607-9c48-266af6e1d322:');
    const { data: tenantTemplates, error: tenantError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('tenant_id', 'afa60b0a-3046-4607-9c48-266af6e1d322');
    
    if (tenantError) {
      console.log('Error consultando tenant:', tenantError);
    } else {
      console.log('Templates del tenant:', tenantTemplates?.length || 0);
      tenantTemplates?.forEach(t => console.log(`- ${t.id} | ${t.name} | react_flow_json: ${!!t.react_flow_json}`));
    }
    
    // 4. Verificar activaciones para el tenant
    console.log('\n4. Activaciones para tenant afa60b0a-3046-4607-9c48-266af6e1d322:');
    const { data: tenantActivations, error: activationsTenantError } = await supabase
      .from('chatbot_template_activations')
      .select('*')
      .eq('tenant_id', 'afa60b0a-3046-4607-9c48-266af6e1d322');
    
    if (activationsTenantError) {
      console.log('Error consultando activaciones:', activationsTenantError);
    } else {
      console.log('Activaciones del tenant:', tenantActivations?.length || 0);
      tenantActivations?.forEach(a => console.log(`- template: ${a.template_id} | active: ${a.is_active} | created: ${a.created_at}`));
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkTables();