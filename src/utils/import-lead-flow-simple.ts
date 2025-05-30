import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

async function importLeadFlowSimple() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const jsonPath = '/Users/masi/Documents/chatbot-builderbot-supabase/Flujo_basico_lead_2025-05-18 (2).json';
  
  try {
    // 1. Verificar si el flow ya existe
    const { data: existingFlow, error: checkError } = await supabase
      .from('flows')
      .select('id, name')
      .eq('name', 'Flujo basico lead')
      .eq('tenant_id', pyemebotTenantId)
      .single();
    
    if (existingFlow && !checkError) {
      logger.info(`\nEl flow "Flujo basico lead" ya existe con ID: ${existingFlow.id}`);
      logger.info('Actualizando nodos existentes...');
      
      // Actualizar nodos directamente desde el JSON
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      const templateData = JSON.parse(jsonContent);
      const nodes = templateData.react_flow_json.nodes;
      
      for (const node of nodes) {
        const nodeData = { ...node.data };
        
        // Remover movesToStage si existe
        if (nodeData.movesToStage) {
          logger.info(`Removiendo movesToStage de nodo ${node.id}`);
          delete nodeData.movesToStage;
        }
        
        // Actualizar metadata del nodo si tiene salesStageId
        if (nodeData.salesStageId) {
          const { error: updateError } = await supabase
            .from('flow_nodes')
            .update({ metadata: nodeData })
            .eq('flow_id', existingFlow.id)
            .eq('id', node.id);
          
          if (updateError) {
            logger.error(`Error al actualizar nodo ${node.id}:`, updateError);
          } else {
            logger.info(`✓ Nodo ${node.id} actualizado con salesStageId: ${nodeData.salesStageId}`);
          }
        }
      }
      
      // Activar el flow
      const { error: activateError } = await supabase
        .from('flows')
        .update({ is_active: true })
        .eq('id', existingFlow.id);
      
      if (!activateError) {
        logger.info(`\n✓ Flow "${existingFlow.name}" activado exitosamente`);
      }
      
      return;
    }
    
    // Si no existe, crear uno nuevo
    logger.info('\nFlow no encontrado. Creando nuevo flow...');
    
    // Leer el JSON
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const templateData = JSON.parse(jsonContent);
    
    const flowId = uuidv4();
    const flowData = {
      id: flowId,
      name: templateData.name,
      description: templateData.description,
      version: '1.0.0',
      entry_node_id: 'start-node',
      tenant_id: pyemebotTenantId,
      is_active: true
    };
    
    logger.info(`Creando flow con ID: ${flowId}`);
    
    const { error: flowError } = await supabase
      .from('flows')
      .insert(flowData);
    
    if (flowError) {
      logger.error('Error al crear flow:', flowError);
      return;
    }
    
    logger.info('✓ Flow creado exitosamente');
    
    // Crear nodos básicos
    const nodes = templateData.react_flow_json.nodes;
    
    for (const node of nodes) {
      const nodeData = { ...node.data };
      
      // Remover movesToStage
      if (nodeData.movesToStage) {
        delete nodeData.movesToStage;
      }
      
      const nodeRecord = {
        id: node.id,
        flow_id: flowId,
        type: node.type,
        content: nodeData.message || nodeData.question || nodeData.label || '',
        metadata: nodeData,
        x: node.position.x,
        y: node.position.y,
        is_editable: true
      };
      
      const { error: nodeError } = await supabase
        .from('flow_nodes')
        .insert(nodeRecord);
      
      if (nodeError) {
        logger.error(`Error al crear nodo ${node.id}:`, nodeError);
      } else {
        logger.info(`✓ Nodo ${node.id} creado`);
        if (nodeData.salesStageId) {
          logger.info(`  - salesStageId: ${nodeData.salesStageId}`);
        }
      }
    }
    
    logger.info(`\n========== IMPORTACIÓN COMPLETADA ==========`);
    logger.info(`Flow ID: ${flowId}`);
    logger.info(`Nombre: ${templateData.name}`);
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
importLeadFlowSimple();