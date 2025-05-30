import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenantActivations() {
  try {
    console.log('=== Verificando sistema de activaciones por tenant ===');
    
    // 1. Verificar si existe tenant_chatbot_activations
    console.log('\n1. Tabla tenant_chatbot_activations:');
    const { data: tenantActivations, error: tenantActivationsError } = await supabase
      .from('tenant_chatbot_activations')
      .select('*')
      .limit(5);
    
    if (tenantActivationsError) {
      console.log('Error en tenant_chatbot_activations:', tenantActivationsError);
    } else {
      console.log('Activaciones de tenant encontradas:', tenantActivations?.length || 0);
      if (tenantActivations && tenantActivations.length > 0) {
        console.log('Columnas:', Object.keys(tenantActivations[0]));
        tenantActivations.forEach(a => console.log(`- template: ${a.template_id} | tenant: ${a.tenant_id} | active: ${a.is_active}`));
      }
    }
    
    // 2. Probar otras variaciones de nombres de tabla
    const possibleTables = [
      'tenant_chatbot_activations',
      'chatbot_activations', 
      'template_activations',
      'tenant_templates',
      'chatbot_instances',
      'tenant_chatbot_instances'
    ];
    
    console.log('\n2. Probando otras tablas posibles:');
    for (const table of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(2);
        
        if (!error) {
          console.log(`\\n✅ Tabla "${table}" existe:`);
          console.log(`   - Registros: ${data?.length || 0}`);
          if (data && data.length > 0) {
            console.log(`   - Columnas: ${Object.keys(data[0]).join(', ')}`);
          }
        }
      } catch (e) {
        // Tabla no existe, continuar
      }
    }
    
    // 3. Verificar activaciones específicas para nuestro tenant
    console.log('\n3. Buscando activaciones para tenant afa60b0a-3046-4607-9c48-266af6e1d322:');
    try {
      const { data: specificActivations, error: specificError } = await supabase
        .from('tenant_chatbot_activations')
        .select('*')
        .eq('tenant_id', 'afa60b0a-3046-4607-9c48-266af6e1d322');
      
      if (specificError) {
        console.log('Error consultando activaciones específicas:', specificError);
      } else {
        console.log('Activaciones del tenant:', specificActivations?.length || 0);
        specificActivations?.forEach(a => console.log(`- template: ${a.template_id} | active: ${a.is_active} | created: ${a.created_at}`));
      }
    } catch (e) {
      console.log('No se puede consultar tenant_chatbot_activations');
    }
    
    // 4. Verificar estructura de chatbot_templates (sin tenant_id)
    console.log('\n4. Verificando chatbot_templates (plantillas globales):');
    const { data: globalTemplates, error: globalError } = await supabase
      .from('chatbot_templates')
      .select('id, name, status')
      .eq('status', 'published')
      .limit(5);
    
    if (globalError) {
      console.log('Error consultando templates globales:', globalError);
    } else {
      console.log('Templates globales publicadas:', globalTemplates?.length || 0);
      globalTemplates?.forEach(t => console.log(`- ${t.id} | ${t.name} | status: ${t.status}`));
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkTenantActivations();