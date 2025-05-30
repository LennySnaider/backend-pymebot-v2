import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function debugFlowNodes() {
  const flowId = 'd794fa47-06e9-4083-a10c-a6da07b8e2bf';
  
  try {
    // 1. Intentar obtener el flow completo
    const { data: flow, error: flowError } = await supabase
      .from('flows')
      .select('*')
      .eq('id', flowId)
      .single();
    
    if (flowError) {
      logger.error('Error al obtener flow:', flowError);
      return;
    }
    
    logger.info('Flow encontrado:', flow.name);
    logger.info('Columnas disponibles:', Object.keys(flow));
    
    // 2. Buscar si hay una tabla de nodos separada
    const { data: nodes, error: nodesError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', flowId)
      .limit(10);
    
    if (nodesError) {
      logger.info('\nNo hay tabla flow_nodes o error:', nodesError.message);
    } else if (nodes && nodes.length > 0) {
      logger.info(`\nEncontrados ${nodes.length} nodos en flow_nodes:`);
      nodes.forEach(node => {
        logger.info(`- Nodo ${node.id}: tipo=${node.type}`);
        if (node.metadata || node.data) {
          logger.info(`  metadata/data: ${JSON.stringify(node.metadata || node.data).substring(0, 100)}...`);
        }
      });
    }
    
    // 3. Buscar en la tabla nodes si existe
    const { data: generalNodes, error: generalNodesError } = await supabase
      .from('nodes')
      .select('*')
      .eq('flow_id', flowId)
      .limit(10);
    
    if (generalNodesError) {
      logger.info('\nNo hay tabla nodes o error:', generalNodesError.message);
    } else if (generalNodes && generalNodes.length > 0) {
      logger.info(`\nEncontrados ${generalNodes.length} nodos en nodes:`);
      generalNodes.forEach(node => {
        logger.info(`- Nodo ${node.id}`);
      });
    }
    
    // 4. Buscar si nodes es una columna JSONB en flows
    const { data: flowsSchema, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'flows' });
    
    if (!schemaError && flowsSchema) {
      logger.info('\nEsquema de la tabla flows:');
      flowsSchema.forEach((col: any) => {
        logger.info(`- ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // 5. Intentar leer específicamente una columna que podría ser JSON
    ['nodes', 'data', 'content', 'flow_data', 'definition'].forEach(async (columnName) => {
      if (flow[columnName]) {
        logger.info(`\n${columnName} column found:`, typeof flow[columnName]);
        if (typeof flow[columnName] === 'object') {
          const stringified = JSON.stringify(flow[columnName]);
          logger.info(`Content preview: ${stringified.substring(0, 200)}...`);
          
          // Si es un objeto con nodos, analizarlos
          const data = flow[columnName];
          if (data.nodes) {
            logger.info(`\nNodos encontrados en ${columnName}.nodes:`);
            if (Array.isArray(data.nodes)) {
              data.nodes.forEach((node: any) => {
                if (node.data && (node.data.salesStageId || node.data.movesToStage)) {
                  logger.info(`- Nodo ${node.id}: salesStageId=${node.data.salesStageId}, movesToStage=${node.data.movesToStage}`);
                }
              });
            } else if (typeof data.nodes === 'object') {
              Object.entries(data.nodes).forEach(([nodeId, node]: [string, any]) => {
                if (node.metadata && (node.metadata.salesStageId || node.metadata.movesToStage)) {
                  logger.info(`- Nodo ${nodeId}: salesStageId=${node.metadata.salesStageId}, movesToStage=${node.metadata.movesToStage}`);
                }
              });
            }
          }
        }
      }
    });
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
debugFlowNodes();