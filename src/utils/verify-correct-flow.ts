import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function verifyCorrectFlow() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  try {
    // 1. Buscar todos los flows del tenant
    const { data: flows, error: flowsError } = await supabase
      .from('flows')
      .select('id, name, is_active')
      .eq('tenant_id', pyemebotTenantId)
      .order('updated_at', { ascending: false });
    
    if (flowsError) {
      logger.error('Error al obtener flows:', flowsError);
      return;
    }
    
    logger.info(`\n========== FLOWS DEL TENANT PYMEBOT ==========`);
    flows.forEach(flow => {
      logger.info(`- ${flow.name} (${flow.id}) - Activo: ${flow.is_active}`);
    });
    
    // 2. Buscar el flow "Flujo basico lead"
    const leadFlow = flows.find(f => f.name === 'Flujo basico lead');
    
    if (!leadFlow) {
      logger.error('¡NO se encontró el flujo "Flujo basico lead"!');
      return;
    }
    
    logger.info(`\n✓ Flow "Flujo basico lead" encontrado: ${leadFlow.id}`);
    logger.info(`Activo: ${leadFlow.is_active}`);
    
    // 3. Obtener nodos del flow
    const { data: nodes, error: nodesError } = await supabase
      .from('flow_nodes')
      .select('id, type, metadata, content')
      .eq('flow_id', leadFlow.id)
      .order('created_at');
    
    if (nodesError) {
      logger.error('Error al obtener nodos:', nodesError);
      return;
    }
    
    logger.info(`\n========== NODOS CON SALES STAGE ==========`);
    let nodeCount = 0;
    
    nodes.forEach(node => {
      if (node.metadata && node.metadata.salesStageId) {
        nodeCount++;
        logger.info(`\nNodo: ${node.id}`);
        logger.info(`- Tipo: ${node.type}`);
        logger.info(`- Content: ${node.content?.substring(0, 50)}...`);
        logger.info(`- salesStageId: ${node.metadata.salesStageId}`);
        
        // También verificar si todavía tiene movesToStage
        if (node.metadata.movesToStage) {
          logger.warn(`  ⚠️ Todavía tiene movesToStage: ${node.metadata.movesToStage}`);
        }
      }
    });
    
    logger.info(`\n\nTotal nodos con salesStageId: ${nodeCount} de ${nodes.length}`);
    
    // 4. Si no es el flow activo, sugerir activarlo
    if (!leadFlow.is_active) {
      logger.warn(`\n⚠️ IMPORTANTE: El flow "Flujo basico lead" NO está activo.`);
      logger.info(`Para activarlo, ejecuta:`);
      logger.info(`UPDATE flows SET is_active = true WHERE id = '${leadFlow.id}' AND tenant_id = '${pyemebotTenantId}';`);
      logger.info(`UPDATE flows SET is_active = false WHERE tenant_id = '${pyemebotTenantId}' AND id != '${leadFlow.id}';`);
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

verifyCorrectFlow();