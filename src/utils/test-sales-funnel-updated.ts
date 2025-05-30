import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function testSalesFunnelUpdated() {
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
    logger.info(`\n========== PRUEBA SALES FUNNEL ACTUALIZADO ==========`);
    logger.info(`Lead de prueba: ${testLead.id} - ${testLead.full_name}`);
    logger.info(`Etapa inicial: ${testLead.stage}`);
    
    // 2. Enviar mensaje que active el nodo con salesStageId
    const chatPayload = {
      message: 'información', // Palabra clave que activa el nodo "respuesta-informacion"
      user_id: testLead.id,
      tenant_id: pyemebotTenantId,
      session_id: `session_test_${Date.now()}`,
      template_id: 'd794fa47-06e9-4083-a10c-a6da07b8e2bf',
      is_first_message: false
    };
    
    logger.info(`\nEnviando mensaje: "${chatPayload.message}"`);
    
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
      
      logger.info(`Respuesta del bot: ${response.data.data?.message?.substring(0, 100)}...`);
      
      // Esperar un poco para que se procese
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 3. Verificar si el lead cambió de etapa
      const { data: updatedLead, error: checkError } = await supabase
        .from('leads')
        .select('stage, updated_at')
        .eq('id', testLead.id)
        .single();
      
      if (checkError) {
        logger.error('Error al verificar lead actualizado:', checkError);
        return;
      }
      
      logger.info(`\n========== RESULTADO ==========`);
      logger.info(`Etapa inicial: ${testLead.stage}`);
      logger.info(`Etapa actual: ${updatedLead.stage}`);
      logger.info(`Última actualización: ${updatedLead.updated_at}`);
      
      if (testLead.stage !== updatedLead.stage) {
        logger.info(`\n✅ ¡ÉXITO! El lead se movió de "${testLead.stage}" a "${updatedLead.stage}"`);
      } else {
        logger.warn(`\n⚠️ El lead no cambió de etapa`);
        
        // Verificar logs del servidor para depuración
        logger.info('\nNOTA: Revisa los logs del servidor para ver si processSalesFunnelActions se ejecutó');
      }
      
    } catch (apiError: any) {
      logger.error('Error al llamar al API:', apiError.response?.data || apiError.message);
    }
    
  } catch (error) {
    logger.error('Error general en la prueba:', error);
  }
}

// Ejecutar la prueba
testSalesFunnelUpdated();