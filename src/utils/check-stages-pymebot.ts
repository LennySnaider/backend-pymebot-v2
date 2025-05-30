import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function checkStagesPymebot() {
  const pyemebotTenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322'; // ID correcto de Pymebot
  
  try {
    // 1. Listar todas las etapas únicas de los leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('stage')
      .eq('tenant_id', pyemebotTenantId);
    
    if (leadsError) {
      logger.error('Error al obtener leads:', leadsError);
    } else {
      const uniqueStages = [...new Set(leads.map(lead => lead.stage))].filter(stage => stage !== null);
      logger.info(`\n\nEtapas únicas encontradas para Pymebot: ${uniqueStages.length}`);
      
      // Contar leads por etapa
      uniqueStages.forEach(stage => {
        const count = leads.filter(lead => lead.stage === stage).length;
        logger.info(`- ${stage}: ${count} leads`);
      });
      
      // Comparar con las etapas del template
      logger.info('\n\nComparación con etapas del template (español vs inglés):');
      const stageMapping = {
        'nuevos': 'new',
        'prospectando': 'prospecting', 
        'calificacion': 'qualification',
        'oportunidad': 'opportunity',
        'confirmado': 'confirmed',
        'cerrado': 'closed'
      };
      
      Object.entries(stageMapping).forEach(([spanish, english]) => {
        const inDb = uniqueStages.includes(english);
        logger.info(`- ${spanish} -> ${english}: ${inDb ? '✓ Existe en BD' : '✗ No existe en BD'}`);
      });
    }
    
    // 2. Ver algunos leads recientes y sus etapas
    const { data: recentLeads, error: recentError } = await supabase
      .from('leads')
      .select('id, full_name, phone, stage, updated_at')
      .eq('tenant_id', pyemebotTenantId)
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (recentError) {
      logger.error('Error al obtener leads recientes:', recentError);
    } else {
      logger.info('\n\nLeads más recientes:');
      recentLeads.forEach(lead => {
        logger.info(`- ${lead.id}: ${lead.full_name} (${lead.phone}) -> Etapa: ${lead.stage} | Actualizado: ${lead.updated_at}`);
      });
    }
    
    // 3. Buscar si hay leads sin etapa
    const { data: noStageLeads, error: noStageError } = await supabase
      .from('leads')
      .select('id, full_name')
      .eq('tenant_id', pyemebotTenantId)
      .is('stage', null);
    
    if (noStageError) {
      logger.error('Error al buscar leads sin etapa:', noStageError);
    } else {
      logger.info(`\n\nLeads sin etapa definida: ${noStageLeads.length}`);
      if (noStageLeads.length > 0) {
        noStageLeads.forEach(lead => {
          logger.info(`- ${lead.id}: ${lead.full_name}`);
        });
      }
    }
    
  } catch (error) {
    logger.error('Error general:', error);
  }
}

// Ejecutar
checkStagesPymebot();