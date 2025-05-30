import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import fs from 'fs';

async function updateTemplateFlow() {
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  const jsonPath = '/Users/masi/Documents/chatbot-builderbot-supabase/Flujo_basico_lead_2025-05-18 (2).json';
  
  try {
    // 1. Leer el JSON actualizado
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const templateData = JSON.parse(jsonContent);
    
    logger.info(`\n========== ACTUALIZANDO TEMPLATE ==========`);
    logger.info(`Template ID: ${templateId}`);
    logger.info(`Nombre: ${templateData.name}`);
    
    // 2. Limpiar movesToStage de los nodos
    const cleanedFlow = { ...templateData.react_flow_json };
    
    if (cleanedFlow.nodes && Array.isArray(cleanedFlow.nodes)) {
      logger.info(`\nLimpiando ${cleanedFlow.nodes.length} nodos...`);
      
      cleanedFlow.nodes = cleanedFlow.nodes.map((node: any) => {
        if (node.data && node.data.movesToStage) {
          logger.info(`Removiendo movesToStage de nodo ${node.id}`);
          const { movesToStage, ...cleanData } = node.data;
          
          // Log de salesStageId
          if (cleanData.salesStageId) {
            logger.info(`  - salesStageId: ${cleanData.salesStageId}`);
          }
          
          return {
            ...node,
            data: cleanData
          };
        }
        return node;
      });
    }
    
    // 3. Actualizar el template
    const updateData = {
      react_flow_json: cleanedFlow,
      updated_at: new Date().toISOString(),
      version: 3
    };
    
    logger.info('\nActualizando template en la base de datos...');
    
    const { error: updateError } = await supabase
      .from('chatbot_templates')
      .update(updateData)
      .eq('id', templateId);
    
    if (updateError) {
      logger.error('Error al actualizar template:', updateError);
      return;
    }
    
    logger.info('✓ Template actualizado exitosamente');
    
    // 4. Verificar la actualización
    const { data: updatedTemplate, error: verifyError } = await supabase
      .from('chatbot_templates')
      .select('id, name, version, updated_at')
      .eq('id', templateId)
      .single();
    
    if (!verifyError && updatedTemplate) {
      logger.info('\nVerificación:');
      logger.info(`- ID: ${updatedTemplate.id}`);
      logger.info(`- Nombre: ${updatedTemplate.name}`);
      logger.info(`- Versión: ${updatedTemplate.version}`);
      logger.info(`- Actualizado: ${updatedTemplate.updated_at}`);
    }
    
    // 5. Verificar algunos nodos para confirmar salesStageId
    logger.info('\n========== VERIFICANDO NODOS CON SALES STAGE ==========');
    
    let nodeCount = 0;
    cleanedFlow.nodes.forEach((node: any) => {
      if (node.data && node.data.salesStageId) {
        nodeCount++;
        logger.info(`- ${node.id}: salesStageId = ${node.data.salesStageId}`);
      }
    });
    
    logger.info(`\nTotal nodos con salesStageId: ${nodeCount} de ${cleanedFlow.nodes.length}`);
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
updateTemplateFlow();