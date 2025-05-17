const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ID del tenant por defecto
const defaultTenantId = '00000000-0000-0000-0000-000000000000';
// ID incorrecto
const incorrectTemplateId = '3fa60b0a-3046-4607-9c48-266af6e1d399';
// ID correcto
const correctTemplateId = 'afa60b0a-3046-4607-9c48-266af6e1d322';

async function checkActivations() {
  console.log('Verificando activaciones actuales...');
  
  // 1. Verificar las activaciones actuales del tenant
  const { data: activations, error: activationsError } = await supabase
    .from('tenant_chatbot_activations')
    .select('*')
    .eq('tenant_id', defaultTenantId)
    .order('created_at', { ascending: false });

  if (activationsError) {
    console.error('Error al obtener activaciones:', activationsError);
    return;
  }

  console.log('\nActivaciones actuales del tenant:');
  activations.forEach(act => {
    console.log(`- ID: ${act.id}, Template: ${act.template_id}, Activa: ${act.is_active}`);
  });

  // 2. Verificar si la plantilla incorrecta existe
  const { data: incorrectTemplate, error: incorrectError } = await supabase
    .from('chatbot_templates')
    .select('id, name, status')
    .eq('id', incorrectTemplateId)
    .single();

  if (incorrectError) {
    console.log(`\nLa plantilla incorrecta (${incorrectTemplateId}) no existe o hay un error:`, incorrectError.message);
  } else {
    console.log(`\nPlantilla incorrecta encontrada: ${incorrectTemplate.name} (${incorrectTemplate.status})`);
  }

  // 3. Verificar si la plantilla correcta existe
  const { data: correctTemplate, error: correctError } = await supabase
    .from('chatbot_templates')
    .select('id, name, status')
    .eq('id', correctTemplateId)
    .single();

  if (correctError) {
    console.log(`\nLa plantilla correcta (${correctTemplateId}) no existe o hay un error:`, correctError.message);
    return;
  }

  console.log(`\nPlantilla correcta encontrada: ${correctTemplate.name} (${correctTemplate.status})`);

  // 4. Buscar activaciones con la plantilla incorrecta
  const incorrectActivations = activations.filter(act => act.template_id === incorrectTemplateId);
  
  if (incorrectActivations.length > 0) {
    console.log(`\n¡ATENCIÓN! Se encontraron ${incorrectActivations.length} activaciones con la plantilla incorrecta`);
    return true; // Indica que sí hay que corregir
  } else {
    console.log('\nNo se encontraron activaciones con la plantilla incorrecta');
    return false;
  }
}

async function fixActivations() {
  console.log('\nCorrigiendo activaciones...');

  // 1. Desactivar todas las activaciones actuales del tenant
  console.log('1. Desactivando todas las activaciones actuales...');
  const { error: deactivateError } = await supabase
    .from('tenant_chatbot_activations')
    .update({ is_active: false })
    .eq('tenant_id', defaultTenantId);

  if (deactivateError) {
    console.error('Error al desactivar activaciones:', deactivateError);
    return;
  }

  // 2. Actualizar las activaciones con template_id incorrecto
  console.log('2. Actualizando activaciones con template_id incorrecto...');
  const { error: updateError } = await supabase
    .from('tenant_chatbot_activations')
    .update({ 
      template_id: correctTemplateId,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', defaultTenantId)
    .eq('template_id', incorrectTemplateId);

  if (updateError) {
    console.error('Error al actualizar template_id:', updateError);
    
    // Si falla la actualización, intentar crear una nueva activación
    console.log('3. Intentando crear nueva activación con el template correcto...');
    
    // Primero verificar si ya existe una activación para el template correcto
    const { data: existingActivation } = await supabase
      .from('tenant_chatbot_activations')
      .select('id')
      .eq('tenant_id', defaultTenantId)
      .eq('template_id', correctTemplateId)
      .single();

    if (existingActivation) {
      // Si ya existe, solo activarla
      const { error: activateError } = await supabase
        .from('tenant_chatbot_activations')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingActivation.id);

      if (activateError) {
        console.error('Error al activar la activación existente:', activateError);
      } else {
        console.log('Activación existente actualizada correctamente');
      }
    } else {
      // Si no existe, crear una nueva
      const { error: createError } = await supabase
        .from('tenant_chatbot_activations')
        .insert({
          tenant_id: defaultTenantId,
          template_id: correctTemplateId,
          is_active: true
        });

      if (createError) {
        console.error('Error al crear nueva activación:', createError);
      } else {
        console.log('Nueva activación creada correctamente');
      }
    }
  } else {
    console.log('Template_id actualizado correctamente');
  }

  // 4. Verificar los cambios
  console.log('\n4. Verificando los cambios...');
  const { data: updatedActivations } = await supabase
    .from('tenant_chatbot_activations')
    .select('*')
    .eq('tenant_id', defaultTenantId)
    .eq('is_active', true);

  if (updatedActivations && updatedActivations.length > 0) {
    console.log('\nActivaciones activas actualizadas:');
    updatedActivations.forEach(act => {
      console.log(`- ID: ${act.id}, Template: ${act.template_id}, Activa: ${act.is_active}`);
    });
  } else {
    console.log('\n⚠️ No se encontraron activaciones activas después de la actualización');
  }
}

async function main() {
  console.log('=== Corrección de template_id en activaciones ===\n');
  
  const needsFix = await checkActivations();
  
  if (needsFix) {
    console.log('\nSe procederá a corregir las activaciones...');
    const response = await new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('¿Desea continuar? (s/n): ', (answer) => {
        readline.close();
        resolve(answer.toLowerCase());
      });
    });

    if (response === 's' || response === 'si') {
      await fixActivations();
      console.log('\n✅ Proceso completado');
    } else {
      console.log('\n❌ Proceso cancelado');
    }
  } else {
    console.log('\n✅ No se requieren correcciones');
  }
}

// Ejecutar el script
main().catch(console.error);