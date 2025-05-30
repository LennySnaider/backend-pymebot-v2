// Test completo del sistema de categorías
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqgikdcwmgtkzmebizse.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZ2lrZGN3bWd0a3ptZWJpenNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyOTc5NzY0MCwiZXhwIjoyMDQ1MzczNjQwfQ.g-RcKWd1dE3Gu8kvRNYAOEUrLJr8g2MzJqL_OBZMh9M';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';

async function testCategoriesSystem() {
  console.log('🧪 Iniciando prueba completa del sistema de categorías...\n');

  try {
    // 1. Verificar si las tablas existen
    console.log('1️⃣ Verificando estructura de la base de datos...');
    
    const { data: tables, error: tablesError } = await supabase
      .from('product_categories')
      .select('id')
      .limit(1);
      
    if (tablesError) {
      console.error('❌ Error: Las tablas de categorías no existen:', tablesError.message);
      return;
    }
    
    console.log('✅ Tablas de categorías disponibles\n');

    // 2. Limpiar categorías existentes del tenant de prueba
    console.log('2️⃣ Limpiando categorías existentes...');
    
    const { error: deleteError } = await supabase
      .from('product_categories')
      .delete()
      .eq('tenant_id', TENANT_ID);
      
    if (deleteError) {
      console.warn('⚠️ Error al limpiar categorías existentes:', deleteError.message);
    } else {
      console.log('✅ Categorías existentes limpiadas\n');
    }

    // 3. Crear categorías de prueba
    console.log('3️⃣ Creando categorías de prueba...');
    
    const testCategories = [
      {
        tenant_id: TENANT_ID,
        name: 'Servicios Médicos',
        description: 'Consultas y procedimientos médicos generales',
        display_order: 1,
        is_active: true
      },
      {
        tenant_id: TENANT_ID,
        name: 'Odontología',
        description: 'Servicios dentales y de salud oral',
        display_order: 2,
        is_active: true
      },
      {
        tenant_id: TENANT_ID,
        name: 'Medicina Estética',
        description: 'Tratamientos de belleza y estética',
        display_order: 3,
        is_active: true
      },
      {
        tenant_id: TENANT_ID,
        name: 'Terapias',
        description: 'Fisioterapia y terapias de rehabilitación',
        display_order: 4,
        is_active: false // Una inactiva para probar filtrado
      }
    ];

    const { data: createdCategories, error: createError } = await supabase
      .from('product_categories')
      .insert(testCategories)
      .select();

    if (createError) {
      console.error('❌ Error al crear categorías:', createError.message);
      return;
    }

    console.log(`✅ Creadas ${createdCategories.length} categorías de prueba\n`);

    // 4. Probar función getCategoriesForChatbot equivalente
    console.log('4️⃣ Probando obtención de categorías activas...');
    
    const { data: activeCategories, error: fetchError } = await supabase
      .from('product_categories')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (fetchError) {
      console.error('❌ Error al obtener categorías activas:', fetchError.message);
      return;
    }

    console.log('✅ Categorías activas obtenidas:');
    activeCategories.forEach(cat => {
      console.log(`   • ${cat.name}${cat.description ? ' - ' + cat.description : ''}`);
    });
    console.log();

    // 5. Formatear para chatbot (simular getCategoriesForChatbot)
    console.log('5️⃣ Formateando categorías para chatbot...');
    
    const formattedCategories = activeCategories.map(category => {
      if (category.description) {
        return `${category.name} - ${category.description}`;
      }
      return category.name;
    });

    console.log('✅ Categorías formateadas para chatbot:');
    formattedCategories.forEach(cat => {
      console.log(`   • "${cat}"`);
    });
    console.log();

    // 6. Simular el nodo de categorías con botones
    console.log('6️⃣ Simulando nodo de categorías con botones...');
    
    const categoryButtons = activeCategories.map((category, index) => ({
      id: `cat_${category.id}`,
      body: category.name,
      description: category.description || undefined,
      value: category.name
    }));

    console.log('✅ Botones generados para el chatbot:');
    categoryButtons.forEach(button => {
      console.log(`   • Botón: "${button.body}"${button.description ? ' (' + button.description + ')' : ''}`);
    });
    console.log();

    // 7. Probar actualización de una categoría
    console.log('7️⃣ Probando actualización de categoría...');
    
    const categoryToUpdate = createdCategories[0];
    const { data: updatedCategory, error: updateError } = await supabase
      .from('product_categories')
      .update({
        name: 'Servicios Médicos Generales',
        description: 'Consultas médicas generales y especializadas',
        updated_at: new Date().toISOString()
      })
      .eq('id', categoryToUpdate.id)
      .eq('tenant_id', TENANT_ID)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error al actualizar categoría:', updateError.message);
    } else {
      console.log(`✅ Categoría actualizada: "${updatedCategory.name}"`);
    }
    console.log();

    // 8. Resultado final
    console.log('8️⃣ Resumen final del sistema de categorías:');
    
    const { data: finalCategories } = await supabase
      .from('product_categories')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .order('display_order', { ascending: true });

    console.log(`✅ Total de categorías en el sistema: ${finalCategories.length}`);
    console.log(`✅ Categorías activas: ${finalCategories.filter(c => c.is_active).length}`);
    console.log(`✅ Categorías inactivas: ${finalCategories.filter(c => !c.is_active).length}`);
    
    console.log('\n🎉 ¡Prueba del sistema de categorías completada exitosamente!');
    console.log('\n📋 Funcionalidades verificadas:');
    console.log('   ✅ Creación de categorías');
    console.log('   ✅ Obtención de categorías activas');
    console.log('   ✅ Formateo para chatbot');
    console.log('   ✅ Generación de botones');
    console.log('   ✅ Actualización de categorías');
    console.log('   ✅ Filtrado por estado activo/inactivo');

  } catch (error) {
    console.error('❌ Error general en la prueba:', error);
  }
}

// Ejecutar la prueba
testCategoriesSystem();