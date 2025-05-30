/**
 * Script para verificar el stage actual de Carolina López en la BD
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

async function checkCarolinaStage() {
  try {
    const supabase = getSupabaseClient();
    
    // Buscar Carolina López por nombre o ID
    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, full_name, stage, metadata, updated_at')
      .or('full_name.ilike.%Carolina López%,id.eq.08f89f3e-7441-4c99-96e4-745d813b9d09,id.eq.605ff65b-0920-480c-aace-0a3ca33b53ca')
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error al buscar leads:', error);
      return;
    }
    
    console.log(`\nEncontrados ${leads.length} leads que coinciden:\n`);
    
    leads.forEach(lead => {
      console.log('===================');
      console.log('ID:', lead.id);
      console.log('Nombre:', lead.full_name);
      console.log('Stage actual:', lead.stage);
      console.log('Metadata:', JSON.stringify(lead.metadata, null, 2));
      console.log('Última actualización:', lead.updated_at);
      console.log('===================\n');
    });
    
    // Verificar si hay problema con el mapeo español/inglés
    const { data: allNewLeads, error: error2 } = await supabase
      .from('leads')
      .select('id, full_name, stage')
      .or('stage.eq.new,stage.eq.nuevos')
      .order('created_at', { ascending: false });
    
    if (!error2) {
      console.log('\nLeads en etapa "new" o "nuevos":');
      allNewLeads.forEach(lead => {
        console.log(`- ${lead.full_name} (ID: ${lead.id}, Stage: ${lead.stage})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCarolinaStage();