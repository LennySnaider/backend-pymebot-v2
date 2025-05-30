import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function checkTemplateSchema() {
  try {
    // 1. Obtener todas las columnas de chatbot_templates
    const { data: template, error: templateError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .limit(1);
    
    if (templateError) {
      logger.error('Error al obtener template:', templateError);
    } else if (template && template.length > 0) {
      logger.info('Columnas de chatbot_templates:');
      Object.keys(template[0]).forEach(key => {
        const value = template[0][key];
        const valueType = typeof value;
        logger.info(`- ${key}: ${valueType} (${value ? 'con valor' : 'null/undefined'})`);
      });
    }
    
    // 2. Obtener el template específico
    const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
    const { data: specificTemplate, error: specificError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (!specificError && specificTemplate) {
      logger.info('\n\nTemplate "Flujo basico lead":');
      Object.entries(specificTemplate).forEach(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          logger.info(`- ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
        } else {
          logger.info(`- ${key}: ${value}`);
        }
      });
      
      // Si tiene una columna de configuración o datos, mostrarla
      ['config', 'data', 'json', 'nodes', 'flow', 'structure'].forEach(possibleKey => {
        if (specificTemplate[possibleKey]) {
          logger.info(`\n${possibleKey.toUpperCase()} contenido:`);
          logger.info(JSON.stringify(specificTemplate[possibleKey], null, 2).substring(0, 500) + '...');
        }
      });
    }
    
    // 3. Ver cómo se relacionan templates y flows
    logger.info('\n\n========== RELACIÓN TEMPLATES-FLOWS ==========');
    
    // Ver si existe una tabla intermedia
    const tables = ['template_flows', 'chatbot_template_flows', 'flow_templates'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          logger.info(`✓ Tabla ${tableName} existe`);
          if (data && data.length > 0) {
            logger.info(`  Columnas: ${Object.keys(data[0]).join(', ')}`);
          }
        }
      } catch (e) {
        // Tabla no existe
      }
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
checkTemplateSchema();