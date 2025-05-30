import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function addSalesStageToNode() {
  const flowId = 'd794fa47-06e9-4083-a10c-a6da07b8e2bf';
  const nodeId = 'respuesta-informacion'; // Un nodo que responde cuando el usuario dice "información"
  
  try {
    // 1. Obtener el nodo actual
    const { data: node, error: getError } = await supabase
      .from('flow_nodes')
      .select('metadata')
      .eq('flow_id', flowId)
      .eq('id', nodeId)
      .single();
    
    if (getError) {
      logger.error('Error al obtener nodo:', getError);
      return;
    }
    
    logger.info('Metadata actual del nodo:', JSON.stringify(node.metadata));
    
    // 2. Actualizar metadata con salesStageId
    const updatedMetadata = {
      ...node.metadata,
      salesStageId: 'prospecting' // Cambiar de "new" a "prospecting"
    };
    
    const { error: updateError } = await supabase
      .from('flow_nodes')
      .update({ metadata: updatedMetadata })
      .eq('flow_id', flowId)
      .eq('id', nodeId);
    
    if (updateError) {
      logger.error('Error al actualizar nodo:', updateError);
      return;
    }
    
    logger.info('Nodo actualizado exitosamente con salesStageId: prospecting');
    
    // 3. Verificar la actualización
    const { data: updatedNode, error: verifyError } = await supabase
      .from('flow_nodes')
      .select('metadata')
      .eq('flow_id', flowId)
      .eq('id', nodeId)
      .single();
    
    if (!verifyError) {
      logger.info('Metadata después de la actualización:', JSON.stringify(updatedNode.metadata));
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
addSalesStageToNode();