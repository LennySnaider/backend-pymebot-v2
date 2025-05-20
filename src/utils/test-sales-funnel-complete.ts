import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function testSalesFunnelComplete() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  
  try {
    // 1. Crear un lead de prueba nuevo
    const testPhone = '+52555' + Date.now().toString().substring(8);
    const { data: newLead, error: createError } = await supabase
      .from('leads')
      .insert({
        full_name: 'Lead Test ' + Date.now(),
        phone: testPhone,
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
    
    const testLead = newLead;
    logger.info(`\n========== PRUEBA COMPLETA SALES FUNNEL ==========`);
    logger.info(`Lead creado: ${testLead.id}`);
    logger.info(`Nombre: ${testLead.full_name}`);
    logger.info(`Etapa inicial: ${testLead.stage}`);
    logger.info(`Template: ${templateId}`);
    
    // 2. Simular conversación paso a paso
    const conversation = [
      { 
        message: 'Hola', 
        expectedStage: 'new',
        description: 'Mensaje inicial'
      },
      { 
        message: 'Juan Pérez', 
        expectedStage: 'prospecting',
        description: 'Proporcionar nombre'
      },
      { 
        message: 'juan@example.com', 
        expectedStage: 'prospecting',
        description: 'Proporcionar email'
      },
      { 
        message: '+5215512345678', 
        expectedStage: 'prospecting',
        description: 'Proporcionar teléfono'
      },
      { 
        message: 'Casa', 
        expectedStage: 'qualification',
        description: 'Tipo de propiedad'
      },
      { 
        message: '500000', 
        expectedStage: 'qualification',
        description: 'Presupuesto'
      }
    ];
    
    logger.info(`\n========== INICIANDO CONVERSACIÓN ==========`);
    
    for (let i = 0; i < conversation.length; i++) {
      const step = conversation[i];
      
      const chatPayload = {
        message: step.message,
        user_id: testLead.id,
        tenant_id: pyemebotTenantId,
        session_id: `session_test_${testLead.id}`,
        template_id: templateId,
        is_first_message: i === 0
      };
      
      logger.info(`\n[Paso ${i + 1}] ${step.description}`);
      logger.info(`Enviando: "${step.message}"`);
      
      try {
        const response = await axios.post(
          'http://localhost:3090/api/text/integrated-message',
          chatPayload,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );
        
        logger.info(`Respuesta: ${response.data.data?.message?.substring(0, 100)}...`);
        
        // Esperar más tiempo para que se procese
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verificar etapa actual
        const { data: currentLead, error: checkError } = await supabase
          .from('leads')
          .select('stage')
          .eq('id', testLead.id)
          .single();
        
        if (!checkError && currentLead) {
          logger.info(`Etapa actual: ${currentLead.stage}`);
          
          // Verificar si cambió la etapa
          if (i > 0 && currentLead.stage !== conversation[i-1].expectedStage) {
            logger.info(`✓ Etapa cambió de "${conversation[i-1].expectedStage}" a "${currentLead.stage}"`);
          }
          
          // Verificar si es la etapa esperada
          if (currentLead.stage === step.expectedStage) {
            logger.info(`✓ Etapa correcta: ${step.expectedStage}`);
          } else {
            logger.warn(`⚠️ Se esperaba "${step.expectedStage}" pero está en "${currentLead.stage}"`);
          }
        }
        
      } catch (apiError: any) {
        logger.error(`Error en paso ${i + 1}:`, apiError.response?.data || apiError.message);
      }
      
      // Esperar entre mensajes
      await new Promise(resolve => setTimeout(resolve, 1500));
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
        logger.info(`\n✅ PRUEBA EXITOSA: El lead se movió de "${testLead.stage}" a "${finalLead.stage}"`);
      } else {
        logger.warn(`\n⚠️ PRUEBA FALLIDA: El lead no cambió de etapa`);
      }
    }
    
    // 4. Limpiar - eliminar lead de prueba
    const { error: deleteError } = await supabase
      .from('leads')
      .delete()
      .eq('id', testLead.id);
    
    if (!deleteError) {
      logger.info('\nLead de prueba eliminado');
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
testSalesFunnelComplete();