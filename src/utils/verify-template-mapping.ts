import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function verifyTemplateMapping() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const targetFlowId = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';
  
  try {
    // 1. Verificar si hay una plantilla que mapea a este flow
    const { data: templates, error: templateError } = await supabase
      .from('chatbot_templates')
      .select('id, name, flow_id, is_active')
      .eq('tenant_id', pyemebotTenantId);
    
    if (templateError) {
      logger.error('Error al obtener templates:', templateError);
    } else {
      logger.info(`\n========== TEMPLATES DEL TENANT ==========`);
      templates.forEach(template => {
        logger.info(`- ${template.name} (${template.id})`);
        logger.info(`  flow_id: ${template.flow_id}`);
        logger.info(`  activo: ${template.is_active}`);
        
        if (template.flow_id === targetFlowId) {
          logger.info(`  ✓ MAPEA AL FLOW "Flujo basico lead"`);
        }
      });
    }
    
    // 2. Verificar el template específico que está respondiendo
    const responseTemplateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
    
    const { data: specificTemplate, error: specificError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', responseTemplateId)
      .single();
    
    if (!specificError && specificTemplate) {
      logger.info(`\n========== TEMPLATE QUE ESTÁ RESPONDIENDO ==========`);
      logger.info(`Nombre: ${specificTemplate.name}`);
      logger.info(`ID: ${specificTemplate.id}`);
      logger.info(`Flow ID: ${specificTemplate.flow_id}`);
      logger.info(`Activo: ${specificTemplate.is_active}`);
      logger.info(`Tenant: ${specificTemplate.tenant_id}`);
    }
    
    // 3. Verificar si necesitamos crear un template para nuestro flow
    const existingTemplate = templates.find(t => t.flow_id === targetFlowId);
    
    if (!existingTemplate) {
      logger.info(`\n⚠️ No hay template que mapee al flow "Flujo basico lead"`);
      logger.info(`Creando template...`);
      
      const newTemplate = {
        name: 'Flujo basico lead',
        description: 'Template para captura y calificación de leads',
        flow_id: targetFlowId,
        tenant_id: pyemebotTenantId,
        is_active: true,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { data: created, error: createError } = await supabase
        .from('chatbot_templates')
        .insert(newTemplate)
        .select()
        .single();
      
      if (createError) {
        logger.error('Error al crear template:', createError);
      } else {
        logger.info(`✓ Template creado: ${created.id}`);
        
        // Desactivar otros templates
        const { error: deactivateError } = await supabase
          .from('chatbot_templates')
          .update({ is_active: false })
          .eq('tenant_id', pyemebotTenantId)
          .neq('id', created.id);
        
        if (!deactivateError) {
          logger.info('✓ Otros templates desactivados');
        }
      }
    } else {
      logger.info(`\n✓ Ya existe template: ${existingTemplate.id}`);
      
      // Activarlo si no está activo
      if (!existingTemplate.is_active) {
        const { error: activateError } = await supabase
          .from('chatbot_templates')
          .update({ is_active: true })
          .eq('id', existingTemplate.id);
        
        if (!activateError) {
          logger.info('✓ Template activado');
          
          // Desactivar otros
          const { error: deactivateError } = await supabase
            .from('chatbot_templates')
            .update({ is_active: false })
            .eq('tenant_id', pyemebotTenantId)
            .neq('id', existingTemplate.id);
          
          if (!deactivateError) {
            logger.info('✓ Otros templates desactivados');
          }
        }
      }
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
verifyTemplateMapping();