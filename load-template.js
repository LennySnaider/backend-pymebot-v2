import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuración de Supabase desde variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada en el archivo .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function loadTemplate() {
  try {
    // Leer el archivo de plantilla
    const templatePath = '/Users/masi/Documents/chatbot-builderbot-supabase/Flujo_basico_lead_2025-05-16.json';
    const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
    
    console.log('Cargando plantilla:', templateData.name);
    
    // Verificar si la plantilla ya existe
    const { data: existingTemplates, error: fetchError } = await supabase
      .from('chatbot_templates')
      .select('id, name')
      .eq('name', templateData.name);
    
    if (fetchError) {
      console.error('Error al verificar plantillas existentes:', fetchError);
      return;
    }
    
    if (existingTemplates && existingTemplates.length > 0) {
      console.log('La plantilla ya existe con ID:', existingTemplates[0].id);
      console.log('Actualizando plantilla...');
      
      // Actualizar plantilla existente
      const { error: updateError } = await supabase
        .from('chatbot_templates')
        .update({
          react_flow_json: templateData.react_flow_json,
          description: templateData.description,
          status: templateData.status || 'published',
          version: templateData.version || 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTemplates[0].id);
        
      if (updateError) {
        console.error('Error al actualizar plantilla:', updateError);
      } else {
        console.log('Plantilla actualizada exitosamente');
      }
      
      return existingTemplates[0].id;
    }
    
    // Crear nueva plantilla
    console.log('Creando nueva plantilla...');
    const { data: newTemplate, error: insertError } = await supabase
      .from('chatbot_templates')
      .insert({
        name: templateData.name,
        description: templateData.description,
        react_flow_json: templateData.react_flow_json,
        status: templateData.status || 'published',
        version: templateData.version || 1,
        vertical_id: templateData.vertical_id || null,
        created_by: 'system',
        tenant_id: 'afa60b0a-3046-4607-9c48-266af6e1d322', // Tu tenant ID
        is_public: true,
        is_template: true
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error al crear plantilla:', insertError);
      return;
    }
    
    console.log('Plantilla creada exitosamente con ID:', newTemplate.id);
    
    // Activar la plantilla para el tenant
    const { error: activationError } = await supabase
      .from('tenant_chatbot_activations')
      .insert({
        tenant_id: 'afa60b0a-3046-4607-9c48-266af6e1d322',
        template_id: newTemplate.id,
        is_active: true,
        activated_by: 'system'
      })
      .select();
    
    if (activationError) {
      console.error('Error al activar plantilla:', activationError);
    } else {
      console.log('Plantilla activada para el tenant');
    }
    
    return newTemplate.id;
  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar
loadTemplate().then(templateId => {
  if (templateId) {
    console.log('\n=== IMPORTANTE ===');
    console.log(`ID de la plantilla: ${templateId}`);
    console.log('Usa este ID en tu configuración');
    console.log('==================\n');
  }
  process.exit(0);
});