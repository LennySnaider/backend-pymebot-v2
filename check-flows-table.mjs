import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFlows() {
  try {
    console.log('=== Verificando tabla flows ===');
    
    // 1. Ver todos los flows
    console.log('\n1. Todos los flows:');
    const { data: allFlows, error: flowsError } = await supabase
      .from('flows')
      .select('*');
    
    if (flowsError) {
      console.log('Error en flows:', flowsError);
    } else {
      console.log('Flows encontrados:', allFlows?.length || 0);
      allFlows?.forEach(f => console.log(`- ${f.id} | ${f.name} | tenant: ${f.tenant_id} | active: ${f.is_active}`));
    }
    
    // 2. Flows para nuestro tenant
    console.log('\n2. Flows para tenant afa60b0a-3046-4607-9c48-266af6e1d322:');
    const { data: tenantFlows, error: tenantError } = await supabase
      .from('flows')
      .select('*')
      .eq('tenant_id', 'afa60b0a-3046-4607-9c48-266af6e1d322');
    
    if (tenantError) {
      console.log('Error consultando tenant flows:', tenantError);
    } else {
      console.log('Flows del tenant:', tenantFlows?.length || 0);
      tenantFlows?.forEach(f => console.log(`- ${f.id} | ${f.name} | active: ${f.is_active} | template: ${f.parent_template_id}`));
    }
    
    // 3. Flows activos para nuestro tenant
    console.log('\n3. Flows ACTIVOS para tenant afa60b0a-3046-4607-9c48-266af6e1d322:');
    const { data: activeFlows, error: activeError } = await supabase
      .from('flows')
      .select('*')
      .eq('tenant_id', 'afa60b0a-3046-4607-9c48-266af6e1d322')
      .eq('is_active', true);
    
    if (activeError) {
      console.log('Error consultando flows activos:', activeError);
    } else {
      console.log('Flows activos del tenant:', activeFlows?.length || 0);
      activeFlows?.forEach(f => console.log(`- ${f.id} | ${f.name} | template: ${f.parent_template_id}`));
    }
    
    // 4. Intentar activar un flow basado en la plantilla d5e05ba1-0146-4587-860b-4e984dd0b672
    console.log('\n4. Verificando si existe flow para template d5e05ba1-0146-4587-860b-4e984dd0b672:');
    const { data: templateFlows, error: templateError } = await supabase
      .from('flows')
      .select('*')
      .eq('parent_template_id', 'd5e05ba1-0146-4587-860b-4e984dd0b672');
    
    if (templateError) {
      console.log('Error buscando flows por template:', templateError);
    } else {
      console.log('Flows para esa template:', templateFlows?.length || 0);
      templateFlows?.forEach(f => console.log(`- ${f.id} | ${f.name} | tenant: ${f.tenant_id} | active: ${f.is_active}`));
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkFlows();