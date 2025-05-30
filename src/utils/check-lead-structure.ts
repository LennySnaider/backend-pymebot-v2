import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function checkLeadStructure() {
  const tenantId = '3a1bb0e6-c9c9-4a09-8fd8-fb2b9f7b005e';
  
  try {
    // 1. Intentar obtener cualquier información de la tabla leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
      .limit(5);
    
    if (leadsError) {
      logger.error('Error al obtener leads:', leadsError);
    } else {
      logger.info(`\n\nEncontrados ${leads.length} leads`);
      
      if (leads.length > 0) {
        logger.info('Estructura de un lead (todas las columnas disponibles):');
        const firstLead = leads[0];
        Object.keys(firstLead).forEach(key => {
          logger.info(`- ${key}: ${firstLead[key]}`);
        });
        
        // Específicamente buscar información de etapas
        logger.info('\n\nEtapas encontradas:');
        leads.forEach(lead => {
          const stageInfo = lead.stage || lead.sales_stage || lead.funnel_stage || 'No stage found';
          logger.info(`Lead ${lead.id}: ${stageInfo}`);
        });
      }
    }
    
    // 2. Buscar en tenants qué estructura de etapas manejan
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();
    
    if (tenantError) {
      logger.error('Error al obtener tenant:', tenantError);
    } else {
      logger.info('\n\nInformación del tenant:');
      Object.keys(tenant).forEach(key => {
        if (key.includes('stage') || key.includes('funnel')) {
          logger.info(`- ${key}: ${tenant[key]}`);
        }
      });
    }
    
    // 3. Buscar si hay una tabla específica de sales stages
    const { data: stages, error: stagesError } = await supabase
      .from('sales_stages')
      .select('*')
      .limit(10);
    
    if (stagesError) {
      logger.info('\n\nNo existe tabla sales_stages o hay error:', stagesError.message);
    } else {
      logger.info(`\n\nTenemos ${stages.length} sales stages definidos`);
      stages.forEach(stage => {
        logger.info(`- ${stage.id}: ${stage.name || stage.title || JSON.stringify(stage)}`);
      });
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
checkLeadStructure();