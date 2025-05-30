import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  try {
    console.log('=== Verificando esquema real de la base de datos ===');
    
    // 1. Verificar tabla chatbot_templates sin filtros
    console.log('\n1. Estructura de chatbot_templates:');
    const { data: templates, error: templatesError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .limit(3);
    
    if (templatesError) {
      console.log('Error en chatbot_templates:', templatesError);
    } else {
      console.log('Templates encontradas:', templates?.length || 0);
      if (templates && templates.length > 0) {
        console.log('Columnas disponibles:', Object.keys(templates[0]));
        templates.forEach(t => console.log(`- ${t.id} | ${t.name} | created: ${t.created_at}`));
      }
    }
    
    // 2. Verificar todas las tablas que empiecen con 'chatbot'
    console.log('\n2. Verificando tablas relacionadas con chatbot:');
    
    // Intentar diferentes variaciones
    const tableQueries = [
      'flow_templates',
      'templates', 
      'chatbot_flows',
      'flows'
    ];
    
    for (const table of tableQueries) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(2);
        
        if (!error) {
          console.log(`\\n📋 Tabla "${table}" existe:`);
          console.log(`   - Registros: ${data?.length || 0}`);
          if (data && data.length > 0) {
            console.log(`   - Columnas: ${Object.keys(data[0]).join(', ')}`);
          }
        }
      } catch (e) {
        // Tabla no existe, continuar
      }
    }
    
    // 3. Buscar plantillas que tengan botones específicamente
    console.log('\n3. Buscando plantillas con react_flow_json:');
    const { data: templatesWithFlow, error: flowError } = await supabase
      .from('chatbot_templates')
      .select('id, name, react_flow_json')
      .not('react_flow_json', 'is', null)
      .limit(5);
    
    if (flowError) {
      console.log('Error buscando templates con flow:', flowError);
    } else {
      console.log('Templates con react_flow_json:', templatesWithFlow?.length || 0);
      templatesWithFlow?.forEach(t => {
        try {
          const flow = JSON.parse(t.react_flow_json);
          const nodes = flow.nodes || [];
          const hasButtons = nodes.some(n => n.type === 'buttonsNode' || n.type === 'buttons');
          console.log(`- ${t.id} | ${t.name} | nodes: ${nodes.length} | hasButtons: ${hasButtons}`);
        } catch (e) {
          console.log(`- ${t.id} | ${t.name} | JSON parse error`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkSchema();