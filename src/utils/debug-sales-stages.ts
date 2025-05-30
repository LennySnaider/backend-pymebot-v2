import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

async function debugSalesStages() {
  const tenantId = '3a1bb0e6-c9c9-4a09-8fd8-fb2b9f7b005e';
  
  try {
    // 1. Listar todas las etapas únicas de los leads
    const { data: stages, error: stagesError } = await supabase
      .from('leads')
      .select('stage')
      .eq('tenant_id', tenantId);
    
    if (stagesError) {
      logger.error('Error al obtener etapas:', stagesError);
    } else {
      const uniqueStages = [...new Set(stages.map(lead => lead.stage))].filter(stage => stage !== null);
      logger.info('Etapas únicas encontradas:', uniqueStages);
      
      // Contar leads por etapa
      for (const stage of uniqueStages) {
        const count = stages.filter(lead => lead.stage === stage).length;
        logger.info(`- ${stage}: ${count} leads`);
      }
    }
    
    // 2. Ver algunos leads actuales para entender el formato de las etapas
    const { data: recentLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, name, phone, stage, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (leadsError) {
      logger.error('Error al obtener leads recientes:', leadsError);
    } else {
      logger.info('\n\nLeads más recientes:');
      recentLeads.forEach(lead => {
        logger.info(`- Lead ${lead.id}: ${lead.name} (${lead.phone}) -> Etapa: ${lead.stage}`);
      });
    }
    
    // 3. Primero buscar cualquier lead existente
    const { data: anyLead, error: anyLeadError } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);
    
    if (anyLeadError || !anyLead || anyLead.length === 0) {
      logger.info('No hay leads para este tenant');
    } else {
      const testLeadId = anyLead[0].id;
      const { data: testLead, error: testError } = await supabase
        .from('leads')
        .select('id, stage, updated_at')
        .eq('id', testLeadId)
        .eq('tenant_id', tenantId)
        .single();
      
      if (testError) {
        logger.error('Error al buscar lead de prueba:', testError);
      } else {
        logger.info(`\n\nLead de prueba ${testLeadId}: Etapa actual = ${testLead.stage}, Última actualización = ${testLead.updated_at}`);
      }
    }
    
  } catch (error) {
    logger.error('Error general en debug:', error);
  }
}

// Ejecutar el debug
debugSalesStages();