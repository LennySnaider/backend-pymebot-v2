import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function testSalesFunnelDetailed() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  try {
    // 1. Buscar un lead en etapa "new"
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, full_name, stage')
      .eq('tenant_id', pyemebotTenantId)
      .eq('stage', 'new')
      .limit(1);
    
    if (leadsError || !leads || leads.length === 0) {
      logger.error('No hay leads en etapa "new"');
      return;
    }
    
    const testLead = leads[0];
    logger.info(`\n\n========== PRUEBA DETALLADA SALES FUNNEL ==========`);
    logger.info(`Lead de prueba: ${testLead.id} - ${testLead.full_name}`);
    logger.info(`Etapa inicial: ${testLead.stage}`);
    
    // 2. Obtener información de la plantilla
    const templateId = 'd794fa47-06e9-4083-a10c-a6da07b8e2bf';
    const { data: template, error: templateError } = await supabase
      .from('chatbot_templates')
      .select('name, data')
      .eq('id', templateId)
      .single();
    
    if (templateError) {
      logger.error('Error al obtener plantilla:', templateError);
      return;
    }
    
    logger.info(`\nPlantilla: ${template.name}`);
    logger.info(`Nodos con salesStageId configurado:`);
    
    // Analizar nodos con información de etapas
    if (template.data && template.data.nodes) {
      template.data.nodes.forEach((node: any) => {
        if (node.data && (node.data.salesStageId || node.data.movesToStage)) {
          logger.info(`  - Nodo ${node.id}: salesStageId=${node.data.salesStageId}, movesToStage=${node.data.movesToStage}`);
        }
      });
    }
    
    // 3. Hacer múltiples llamadas para forzar el movimiento por etapas
    const messages = [
      'Hola, estoy interesado',
      'Quiero saber más información',
      'Me interesa mucho el servicio',
      'Cuándo podemos hablar?'
    ];
    
    logger.info(`\n\n========== ENVIANDO MENSAJES ==========`);
    
    for (let i = 0; i < messages.length; i++) {
      const chatPayload = {
        message: messages[i],
        user_id: testLead.id,
        tenant_id: pyemebotTenantId,
        session_id: `session_${Date.now()}_${i}`,
        template_id: templateId,
        is_first_message: i === 0
      };
      
      logger.info(`\nMensaje ${i + 1}: "${messages[i]}"`);
      
      try {
        const response = await axios.post(
          'http://localhost:3090/api/text/integrated-message',
          chatPayload,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        logger.info(`Respuesta: ${response.data.data?.message?.substring(0, 50)}...`);
        
        // Esperar un poco antes de verificar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar etapa actual del lead
        const { data: currentLead, error: checkError } = await supabase
          .from('leads')
          .select('stage')
          .eq('id', testLead.id)
          .single();
        
        if (!checkError && currentLead) {
          logger.info(`Etapa después del mensaje ${i + 1}: ${currentLead.stage}`);
          
          if (currentLead.stage !== testLead.stage) {
            logger.info(`✅ ¡ÉXITO! Lead movido de "${testLead.stage}" a "${currentLead.stage}"`);
            break;
          }
        }
        
      } catch (apiError: any) {
        logger.error(`Error en mensaje ${i + 1}:`, apiError.response?.data || apiError.message);
      }
      
      // Esperar entre mensajes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 4. Verificación final
    logger.info(`\n\n========== RESULTADO FINAL ==========`);
    
    const { data: finalLead, error: finalError } = await supabase
      .from('leads')
      .select('stage, updated_at')
      .eq('id', testLead.id)
      .single();
    
    if (!finalError && finalLead) {
      logger.info(`Etapa inicial: ${testLead.stage}`);
      logger.info(`Etapa final: ${finalLead.stage}`);
      logger.info(`Última actualización: ${finalLead.updated_at}`);
      
      if (testLead.stage !== finalLead.stage) {
        logger.info(`\n✅ PRUEBA EXITOSA: El lead cambió de etapa`);
      } else {
        logger.warn(`\n⚠️ PRUEBA FALLIDA: El lead no cambió de etapa`);
      }
    }
    
  } catch (error) {
    logger.error('Error general en la prueba:', error);
  }
}

// Ejecutar la prueba
testSalesFunnelDetailed();