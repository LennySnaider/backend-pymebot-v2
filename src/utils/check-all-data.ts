import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function checkAllData() {
  try {
    // 1. Ver todos los tenants disponibles
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(10);
    
    if (tenantsError) {
      logger.error('Error al obtener tenants:', tenantsError);
    } else {
      logger.info(`\n\nTenants encontrados: ${tenants.length}`);
      tenants.forEach(tenant => {
        logger.info(`- ${tenant.id}: ${tenant.name}`);
      });
    }
    
    // 2. Ver todos los leads sin filtrar por tenant
    const { data: allLeads, error: allLeadsError } = await supabase
      .from('leads')
      .select('*')
      .limit(5);
    
    if (allLeadsError) {
      logger.error('Error al obtener todos los leads:', allLeadsError);
    } else {
      logger.info(`\n\nLeads totales encontrados: ${allLeads.length}`);
      
      if (allLeads.length > 0) {
        const firstLead = allLeads[0];
        logger.info('\n\nPrimera lead - estructura:');
        Object.keys(firstLead).forEach(key => {
          const value = firstLead[key];
          const displayValue = value && typeof value === 'object' ? JSON.stringify(value) : value;
          logger.info(`- ${key}: ${displayValue}`);
        });
        
        // Buscar específicamente campos relacionados con etapas
        logger.info('\n\nCampos relacionados con etapas:');
        Object.keys(firstLead).forEach(key => {
          if (key.toLowerCase().includes('stage') || 
              key.toLowerCase().includes('funnel') || 
              key.toLowerCase().includes('status') ||
              key.toLowerCase().includes('phase')) {
            logger.info(`- ${key}: ${firstLead[key]}`);
          }
        });
      }
    }
    
    // 3. Ver las templates de chatbot para entender la estructura
    const { data: templates, error: templatesError } = await supabase
      .from('chatbot_templates')
      .select('id, name, data')
      .limit(3);
    
    if (templatesError) {
      logger.error('Error al obtener templates:', templatesError);
    } else {
      logger.info(`\n\nTemplates encontrados: ${templates.length}`);
      
      templates.forEach(template => {
        logger.info(`\n\nTemplate: ${template.name}`);
        
        // Si existe data, buscar información sobre nodos y etapas
        if (template.data && typeof template.data === 'object') {
          const templateData = template.data as any;
          if (templateData.nodes && Array.isArray(templateData.nodes)) {
            logger.info('Analizando nodos para información de etapas:');
            templateData.nodes.forEach((node: any, index: number) => {
              if (node.data && (node.data.salesStageId || node.data.movesToStage)) {
                logger.info(`  Nodo ${index}: salesStageId=${node.data.salesStageId}, movesToStage=${node.data.movesToStage}`);
              }
            });
          }
        }
      });
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
checkAllData();