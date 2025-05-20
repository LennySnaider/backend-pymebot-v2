import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function testSalesFunnelFinal() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const flowId = 'b8ec193d-de62-4e82-b0ff-858ad27f9368'; // El flow que acabamos de activar
  
  try {
    // 1. Buscar un lead en etapa "new"
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, full_name, stage')
      .eq('tenant_id', pyemebotTenantId)
      .eq('stage', 'new')
      .limit(1);
    
    if (leadsError || !leads || leads.length === 0) {
      // Crear un lead de prueba
      logger.info('Creando un lead de prueba...');
      
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({
          full_name: 'Lead Prueba Sales Funnel',
          phone: '+52' + Date.now().toString().substring(7),
          tenant_id: pyemebotTenantId,
          stage: 'new',
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) {
        logger.error('Error al crear lead:', createError);
        return;
      }
      
      leads[0] = newLead;
    }
    
    const testLead = leads[0];
    logger.info(`\n========== PRUEBA FINAL SALES FUNNEL ==========`);
    logger.info(`Lead: ${testLead.id} - ${testLead.full_name}`);
    logger.info(`Etapa inicial: ${testLead.stage}`);
    logger.info(`Flow activo: Flujo basico lead (${flowId})`);
    
    // 2. Simular conversación completa
    const conversation = [
      { message: 'Hola', expected: 'nuevos' },
      { message: 'Juan Pérez', expected: 'prospectando' },
      { message: 'juan@example.com', expected: 'prospectando' },
      { message: '+5215512345678', expected: 'prospectando' },
      { message: '500000', expected: 'calificacion' },
      { message: 'Sí, quiero agendar', expected: 'oportunidad' }
    ];
    
    logger.info(`\n========== INICIANDO CONVERSACIÓN ==========`);
    
    for (let i = 0; i < conversation.length; i++) {
      const step = conversation[i];
      
      const chatPayload = {
        message: step.message,
        user_id: testLead.id,
        tenant_id: pyemebotTenantId,
        session_id: `session_final_${Date.now()}_${i}`,
        template_id: flowId,
        is_first_message: i === 0
      };
      
      logger.info(`\n[Paso ${i + 1}] Enviando: "${step.message}"`);
      
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
        
        logger.info(`Respuesta: ${response.data.data?.message?.substring(0, 80)}...`);
        
        // Esperar un poco para que se procese
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verificar etapa actual
        const { data: currentLead, error: checkError } = await supabase
          .from('leads')
          .select('stage')
          .eq('id', testLead.id)
          .single();
        
        if (!checkError && currentLead) {
          logger.info(`Etapa actual: ${currentLead.stage}`);
          
          // Verificar si coincide con lo esperado
          if (step.expected) {
            if (currentLead.stage === step.expected) {
              logger.info(`✓ Etapa correcta: ${step.expected}`);
            } else {
              logger.warn(`⚠️ Se esperaba "${step.expected}" pero está en "${currentLead.stage}"`);
            }
          }
        }
        
      } catch (apiError: any) {
        logger.error(`Error en paso ${i + 1}:`, apiError.response?.data || apiError.message);
      }
      
      // Esperar entre mensajes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 3. Verificación final
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
        logger.info(`\n✅ PRUEBA EXITOSA: El lead cambió de "${testLead.stage}" a "${finalLead.stage}"`);
      } else {
        logger.warn(`\n⚠️ PRUEBA FALLIDA: El lead no cambió de etapa`);
      }
    }
    
    // 4. Mostrar el camino recorrido
    const { data: allStages, error: stagesError } = await supabase
      .from('leads')
      .select('id, stage')
      .eq('tenant_id', pyemebotTenantId)
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (!stagesError && allStages) {
      logger.info('\n\nÚltimos leads actualizados:');
      allStages.forEach(l => {
        logger.info(`- ${l.id}: ${l.stage}`);
      });
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
testSalesFunnelFinal();