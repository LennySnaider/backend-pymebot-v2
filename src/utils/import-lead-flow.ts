import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

async function importLeadFlow() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const jsonPath = '/Users/masi/Documents/chatbot-builderbot-supabase/Flujo_basico_lead_2025-05-18 (2).json';
  
  try {
    // 1. Leer el archivo JSON
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const templateData = JSON.parse(jsonContent);
    
    logger.info(`\n========== IMPORTANDO FLUJO BÁSICO LEAD ==========`);
    logger.info(`Nombre: ${templateData.name}`);
    logger.info(`Descripción: ${templateData.description}`);
    logger.info(`Estado: ${templateData.status}`);
    
    // 2. Crear el flow en la base de datos
    const flowId = uuidv4();
    const flowData = {
      id: flowId,
      name: templateData.name,
      description: templateData.description,
      version: '1.0.0',
      entry_node_id: 'start-node',
      tenant_id: pyemebotTenantId,
      is_active: false, // Inicialmente inactivo
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: ['lead', 'sales-funnel'],
      category: 'sales',
      author: 'Import Script',
      parent_template_id: null,
      edit_permission: 'full'
    };
    
    logger.info(`\nCreando flow con ID: ${flowId}`);
    
    const { error: flowError } = await supabase
      .from('flows')
      .insert(flowData);
    
    if (flowError) {
      logger.error('Error al crear flow:', flowError);
      return;
    }
    
    logger.info('✓ Flow creado exitosamente');
    
    // 3. Crear los nodos del flow
    const nodes = templateData.react_flow_json.nodes;
    logger.info(`\nImportando ${nodes.length} nodos...`);
    
    for (const node of nodes) {
      // Limpiar movesToStage si existe
      const nodeData = { ...node.data };
      if (nodeData.movesToStage) {
        logger.info(`  Removiendo movesToStage de nodo ${node.id}`);
        delete nodeData.movesToStage;
      }
      
      const nodeRecord = {
        id: node.id,
        flow_id: flowId,
        type: node.type,
        content: nodeData.message || nodeData.question || nodeData.label || '',
        metadata: nodeData,
        next: node.data.next || null,
        next_node_id: node.data.nextNodeId || null,
        x: node.position.x,
        y: node.position.y,
        is_editable: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
    
    // 4. Crear las conexiones (edges)
    const edges = templateData.react_flow_json.edges || [];
    if (edges.length > 0) {
      logger.info(`\nImportando ${edges.length} conexiones...`);
      
      for (const edge of edges) {
        const edgeRecord = {
          id: edge.id,
          flow_id: flowId,
          source: edge.source,
          target: edge.target,
          source_handle: edge.sourceHandle || null,
          target_handle: edge.targetHandle || null,
          type: edge.type || 'default',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const { error: edgeError } = await supabase
          .from('flow_edges')
          .insert(edgeRecord);
        
        if (edgeError) {
          logger.error(`Error al crear edge ${edge.id}:`, edgeError);
        }
      }
    }
    
    // 5. Activar el flow
    logger.info(`\n========== ACTIVANDO FLOW ==========`);
    
    // Primero desactivar todos los flows del tenant
    const { error: deactivateError } = await supabase
      .from('flows')
      .update({ is_active: false })
      .eq('tenant_id', pyemebotTenantId);
    
    if (deactivateError) {
      logger.error('Error al desactivar flows:', deactivateError);
    }
    
    // Activar el nuevo flow
    const { error: activateError } = await supabase
      .from('flows')
      .update({ is_active: true })
      .eq('id', flowId);
    
    if (activateError) {
      logger.error('Error al activar flow:', activateError);
    } else {
      logger.info('✓ Flow "Flujo basico lead" activado exitosamente');
    }
    
    logger.info(`\n========== IMPORTACIÓN COMPLETADA ==========`);
    logger.info(`Flow ID: ${flowId}`);
    logger.info(`Nombre: ${templateData.name}`);
    logger.info(`Estado: Activo`);
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
importLeadFlow();