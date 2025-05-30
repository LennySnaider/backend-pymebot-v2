import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function testSalesFunnelFix() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  try {
    // 1. Buscar un lead existente para prueba
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, full_name, stage')
      .eq('tenant_id', pyemebotTenantId)
      .eq('stage', 'new')
      .limit(1);
    
    if (leadsError || !leads || leads.length === 0) {
      logger.info('No hay leads en etapa "new". Creando uno...');
      
      // Crear un lead de prueba
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          full_name: 'Lead de Prueba Sales Funnel',
          phone: '+5215512345678',
          tenant_id: pyemebotTenantId,
          stage: 'new',
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) {
        logger.error('Error al crear lead de prueba:', createError);
        return;
      }
      
      leads[0] = newLead;
    }
    
    const testLead = leads[0];
    logger.info(`\n\nUsando lead de prueba: ${testLead.id} - ${testLead.full_name}`);
    logger.info(`Etapa actual: ${testLead.stage}`);
    
    // 2. Simular un mensaje de chat para probar el movimiento de etapa
    const chatPayload = {
      message: 'Estoy interesado en el servicio',
      user_id: testLead.id,
      tenant_id: pyemebotTenantId,
      session_id: `session_${Date.now()}`,
      template_id: 'd794fa47-06e9-4083-a10c-a6da07b8e2bf',
      is_first_message: false
    };
    
    logger.info('\n\nEnviando mensaje de prueba al endpoint...');
    
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
      
      logger.info('Respuesta del endpoint:', response.data.message);
      
      // 3. Verificar si el lead se movió de etapa
      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
      
      const { data: updatedLead, error: checkError } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', testLead.id)
        .single();
      
      if (checkError) {
        logger.error('Error al verificar lead actualizado:', checkError);
        return;
      }
      
      logger.info(`\n\nResultado de la prueba:`);
      logger.info(`- Etapa inicial: ${testLead.stage}`);
      logger.info(`- Etapa actual: ${updatedLead.stage}`);
      
      if (testLead.stage !== updatedLead.stage) {
        logger.info(`✅ ¡Éxito! El lead se movió de "${testLead.stage}" a "${updatedLead.stage}"`);
      } else {
        logger.warn(`⚠️ El lead no cambió de etapa`);
      }
      
    } catch (apiError: any) {
      logger.error('Error al llamar al API:', apiError.response?.data || apiError.message);
    }
    
  } catch (error) {
    logger.error('Error general en la prueba:', error);
  }
}

// Ejecutar la prueba
testSalesFunnelFix();