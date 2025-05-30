import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function activateTemplate() {
  try {
    const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
    const templateId = 'd5e05ba1-0146-4587-860b-4e984dd0b672'; // PymeBot V1 - Agendamiento Completo
    
    console.log('=== Activando plantilla para el tenant ===');
    console.log(`Tenant: ${tenantId}`);
    console.log(`Template: ${templateId}`);
    
    // 1. Primero desactivar todas las plantillas del tenant
    console.log('\n1. Desactivando todas las plantillas del tenant...');
    const { data: deactivateData, error: deactivateError } = await supabase
      .from('tenant_chatbot_activations')
      .update({ 
        is_active: false,
        deactivated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    
    if (deactivateError) {
      console.log('Error desactivando plantillas:', deactivateError);
    } else {
      console.log('✅ Plantillas desactivadas exitosamente');
    }
    
    // 2. Activar la plantilla específica
    console.log('\n2. Activando la plantilla específica...');
    const { data: activateData, error: activateError } = await supabase
      .from('tenant_chatbot_activations')
      .update({ 
        is_active: true,
        activated_at: new Date().toISOString(),
        deactivated_at: null
      })
      .eq('tenant_id', tenantId)
      .eq('template_id', templateId);
    
    if (activateError) {
      console.log('Error activando plantilla:', activateError);
    } else {
      console.log('✅ Plantilla activada exitosamente');
      console.log('Datos actualizados:', activateData);
    }
    
    // 3. Verificar el resultado
    console.log('\n3. Verificando activación...');
    const { data: verification, error: verifyError } = await supabase
      .from('tenant_chatbot_activations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    
    if (verifyError) {
      console.log('Error verificando:', verifyError);
    } else {
      console.log('Plantillas activas para el tenant:', verification?.length || 0);
      verification?.forEach(a => console.log(`- template: ${a.template_id} | active: ${a.is_active} | activated_at: ${a.activated_at}`));
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

activateTemplate();