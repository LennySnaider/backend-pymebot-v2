import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function checkTemplateStructure() {
  const templateId = 'd794fa47-06e9-4083-a10c-a6da07b8e2bf';
  
  try {
    // 1. Intentar obtener todas las columnas de la plantilla
    const { data: template, error: templateError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (templateError) {
      logger.error('Error al obtener plantilla:', templateError);
    } else {
      logger.info('Estructura de la plantilla:');
      Object.keys(template).forEach(key => {
        const value = template[key];
        if (typeof value === 'object' && value !== null) {
          logger.info(`- ${key}: ${JSON.stringify(value).substring(0, 100)}...`);
        } else {
          logger.info(`- ${key}: ${value}`);
        }
      });
    }
    
    // 2. Buscar en flows si tiene la información
    const { data: flow, error: flowError } = await supabase
      .from('flows')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (flowError) {
      logger.info('\nNo se encontró en flows, intentando con flow_id de la plantilla...');
      
      if (template && template.flow_id) {
        const { data: flowByFlowId, error: flowByIdError } = await supabase
          .from('flows')
          .select('*')
          .eq('id', template.flow_id)
          .single();
        
        if (!flowByIdError && flowByFlowId) {
          logger.info('\nEstructura del flow:');
          Object.keys(flowByFlowId).forEach(key => {
            const value = flowByFlowId[key];
            if (key === 'nodes' && typeof value === 'object') {
              logger.info(`- ${key}: ${JSON.stringify(value).substring(0, 200)}...`);
              
              // Analizar nodos si es un array
              if (Array.isArray(value)) {
                logger.info(`\nNodos con información de sales funnel:`);
                value.forEach((node: any) => {
                  if (node.data && (node.data.salesStageId || node.data.movesToStage)) {
                    logger.info(`  - Nodo ${node.id}: salesStageId=${node.data.salesStageId}, movesToStage=${node.data.movesToStage}`);
                  }
                });
              }
            } else if (typeof value === 'object' && value !== null) {
              logger.info(`- ${key}: [object]`);
            } else {
              logger.info(`- ${key}: ${value}`);
            }
          });
        }
      }
    } else {
      logger.info('\nEstructura del flow:');
      Object.keys(flow).forEach(key => {
        const value = flow[key];
        if (typeof value === 'object' && value !== null) {
          logger.info(`- ${key}: [object]`);
        } else {
          logger.info(`- ${key}: ${value}`);
        }
      });
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
checkTemplateStructure();