// Verificar qué tablas existen en la base de datos
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqgikdcwmgtkzmebizse.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZ2lrZGN3bWd0a3ptZWJpenNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTc5NzY0MCwiZXhwIjoyMDQ1MzczNjQwfQ.g-RcKWd1dE3Gu8kvRNYAOEUrLJr8g2MzJqL_OBZMh9M';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Verificando tablas en la base de datos...\n');

  // Lista de tablas relacionadas con productos que podrían existir
  const tablesToCheck = [
    'products',
    'product_categories', 
    'properties',
    'property_types',
    'services'
  ];

  for (const table of tablesToCheck) {
    try {
      console.log(`Verificando tabla: ${table}...`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Tabla existe (${data.length === 0 ? 'vacía' : 'con datos'})`);
        
        // Si existe, mostrar estructura básica
        if (data.length > 0) {
          console.log(`   Columnas: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    } catch (err) {
      console.log(`❌ ${table}: Error de conexión`);
    }
    console.log();
  }

  // Intentar verificar esquema de la base de datos
  console.log('📊 Intentando obtener información del esquema...');
  try {
    const { data, error } = await supabase
      .rpc('get_table_info', {})
      .limit(10);
      
    if (error) {
      console.log('❌ No se pudo obtener información del esquema:', error.message);
    } else {
      console.log('✅ Esquema obtenido:', data);
    }
  } catch (err) {
    console.log('❌ Error al consultar esquema');
  }
}

checkTables();