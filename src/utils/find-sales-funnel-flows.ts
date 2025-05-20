import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function findSalesFunnelFlows() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  try {
    // 1. Buscar todos los flows del tenant
    const { data: flows, error: flowsError } = await supabase
      .from('flows')
      .select('id, name, description, is_active')
      .eq('tenant_id', pyemebotTenantId);
    
    if (flowsError) {
      logger.error('Error al obtener flows:', flowsError);
      return;
    }
    
    logger.info(`Total de flows para el tenant: ${flows.length}`);
    logger.info('\n========== BUSCANDO FLOWS CON SALES FUNNEL ==========\n');
    
    for (const flow of flows) {
      logger.info(`\nFlow: ${flow.name} (${flow.id})`);
      logger.info(`- Activo: ${flow.is_active}`);
      logger.info(`- Descripción: ${flow.description}`);
      
      // Buscar nodos de este flow
      const { data: nodes, error: nodesError } = await supabase
        .from('flow_nodes')
        .select('id, type, metadata')
        .eq('flow_id', flow.id);
      
      if (nodesError) {
        logger.error(`Error al obtener nodos del flow ${flow.id}:`, nodesError);
        continue;
      }
      
      // Buscar nodos con información de sales funnel
      let salesFunnelNodes = 0;
      const salesStages: string[] = [];
      
      nodes.forEach(node => {
        if (node.metadata) {
          if (node.metadata.salesStageId) {
            salesFunnelNodes++;
            salesStages.push(`salesStageId: ${node.metadata.salesStageId}`);
          }
          if (node.metadata.movesToStage) {
            salesFunnelNodes++;
            salesStages.push(`movesToStage: ${node.metadata.movesToStage}`);
          }
          if (node.metadata.requiresStage) {
            salesStages.push(`requiresStage: ${node.metadata.requiresStage}`);
          }
        }
      });
      
      if (salesFunnelNodes > 0) {
        logger.info(`  ✓ ENCONTRADO: ${salesFunnelNodes} nodos con sales funnel`);
        logger.info(`  Etapas: ${salesStages.join(', ')}`);
      }
    }
    
    // 2. Buscar también en chatbot_templates si existe
    const { data: templates, error: templatesError } = await supabase
      .from('chatbot_templates')
      .select('id, name, flow_id')
      .eq('tenant_id', pyemebotTenantId);
    
    if (!templatesError && templates && templates.length > 0) {
      logger.info('\n\n========== TEMPLATES ==========');
      templates.forEach(template => {
        logger.info(`- ${template.name} (${template.id}) -> Flow: ${template.flow_id}`);
      });
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
findSalesFunnelFlows();