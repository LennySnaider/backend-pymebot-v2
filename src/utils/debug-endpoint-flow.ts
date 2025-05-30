import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';
import axios from 'axios';

async function debugEndpointFlow() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  const flowId = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';
  
  try {
    // 1. Verificar qué flow está activo
    const { data: activeFlow, error: flowError } = await supabase
      .from('flows')
      .select('id, name')
      .eq('tenant_id', pyemebotTenantId)
      .eq('is_active', true)
      .single();
    
    if (flowError || !activeFlow) {
      logger.error('No hay flow activo:', flowError);
      return;
    }
    
    logger.info(`Flow activo: ${activeFlow.name} (${activeFlow.id})`);
    
    // 2. Hacer una llamada simple al endpoint para ver qué responde
    const chatPayload = {
      message: 'Hola',
      user_id: 'test-' + Date.now(),
      tenant_id: pyemebotTenantId,
      session_id: 'debug-session-' + Date.now(),
      template_id: flowId,
      is_first_message: true
    };
    
    logger.info('\nEnviando mensaje de debug...');
    logger.info('Payload:', JSON.stringify(chatPayload, null, 2));
    
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
      
      logger.info('\nRespuesta completa:');
      logger.info(JSON.stringify(response.data, null, 2));
      
    } catch (apiError: any) {
      logger.error('Error del API:');
      if (apiError.response) {
        logger.error('Status:', apiError.response.status);
        logger.error('Data:', JSON.stringify(apiError.response.data, null, 2));
      } else {
        logger.error(apiError.message);
      }
    }
    
    // 3. Verificar si el flow tiene el nodo inicial correcto
    const { data: startNode, error: nodeError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', flowId)
      .eq('id', 'start-node')
      .single();
    
    if (nodeError || !startNode) {
      logger.error('\nNo se encontró el nodo inicial:', nodeError);
    } else {
      logger.info('\nNodo inicial encontrado:');
      logger.info('- ID:', startNode.id);
      logger.info('- Tipo:', startNode.type);
      logger.info('- Content:', startNode.content);
      logger.info('- Metadata:', JSON.stringify(startNode.metadata));
    }
    
    // 4. Ver el primer mensaje
    const { data: firstMessage, error: msgError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('flow_id', flowId)
      .eq('id', 'messageNode-welcome')
      .single();
    
    if (!msgError && firstMessage) {
      logger.info('\nPrimer mensaje encontrado:');
      logger.info('- ID:', firstMessage.id);
      logger.info('- Content:', firstMessage.content);
      logger.info('- Metadata:', JSON.stringify(firstMessage.metadata));
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
debugEndpointFlow();