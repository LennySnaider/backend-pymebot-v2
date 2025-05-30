import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function debugFlowSalesNodes() {
  const flowId = 'd794fa47-06e9-4083-a10c-a6da07b8e2bf';
  
  try {
    // Obtener TODOS los nodos del flow
    const { data: nodes, error: nodesError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', flowId);
    
    if (nodesError) {
      logger.error('Error al obtener nodos:', nodesError);
      return;
    }
    
    logger.info(`Total de nodos en el flow: ${nodes.length}`);
    logger.info('\n========== ANALIZANDO NODOS ==========\n');
    
    let nodesWithSalesInfo = 0;
    
    nodes.forEach(node => {
      logger.info(`\nNodo: ${node.id}`);
      logger.info(`- Tipo: ${node.type}`);
      logger.info(`- Content: ${node.content?.substring(0, 50)}...`);
      logger.info(`- Metadata: ${JSON.stringify(node.metadata)}`);
      
      // Verificar diferentes propiedades
      if (node.metadata) {
        if (node.metadata.salesStageId) {
          logger.info(`  ✓ salesStageId: ${node.metadata.salesStageId}`);
          nodesWithSalesInfo++;
        }
        if (node.metadata.movesToStage) {
          logger.info(`  ✓ movesToStage: ${node.metadata.movesToStage}`);
          nodesWithSalesInfo++;
        }
        if (node.metadata.requiresStage) {
          logger.info(`  ✓ requiresStage: ${node.metadata.requiresStage}`);
        }
      }
      
      // También verificar si hay una columna 'data' separada
      if (node.data) {
        logger.info(`- Data: ${JSON.stringify(node.data)}`);
        if (node.data.salesStageId || node.data.movesToStage) {
          logger.info(`  ✓ Sales info en data`);
          nodesWithSalesInfo++;
        }
      }
      
      // Verificar next y nextNodeId
      if (node.next) {
        logger.info(`- Next: ${JSON.stringify(node.next).substring(0, 100)}...`);
      }
      if (node.next_node_id) {
        logger.info(`- NextNodeId: ${node.next_node_id}`);
      }
    });
    
    logger.info(`\n========== RESUMEN ==========`);
    logger.info(`Nodos con información de sales funnel: ${nodesWithSalesInfo} de ${nodes.length}`);
    
    // Buscar el nodo inicial
    const { data: flow, error: flowError } = await supabase
      .from('flows')
      .select('entry_node_id')
      .eq('id', flowId)
      .single();
    
    if (!flowError && flow) {
      logger.info(`\nNodo inicial del flow: ${flow.entry_node_id}`);
      const startNode = nodes.find(n => n.id === flow.entry_node_id);
      if (startNode) {
        logger.info(`Tipo del nodo inicial: ${startNode.type}`);
        logger.info(`Metadata del nodo inicial: ${JSON.stringify(startNode.metadata)}`);
      }
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
debugFlowSalesNodes();