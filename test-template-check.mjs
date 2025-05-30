#!/usr/bin/env node

/**
 * Check the actual template structure
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yiggxpihbkpxsjlabzwj.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2d4cGloYmtweHNqbGFiendqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzQ4MDkxMCwiZXhwIjoyMDMzMDU2OTEwfQ.qJW4lmk-EQiAhN7prHBsEQ95UtxK9XrImh92Ns_CHfU';
const TEMPLATE_ID = '0654268d-a65a-4e59-83a2-e99d4d393273';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTemplate() {
  try {
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', TEMPLATE_ID)
      .single();
    
    if (error) {
      console.error('Error al buscar template:', error);
      return;
    }
    
    console.log('Template encontrado:', data.name);
    console.log('\nNodos con información de sales stage:');
    
    const nodes = data.react_flow_json?.nodes || [];
    let foundSalesStage = false;
    
    nodes.forEach(node => {
      if (node.data?.salesStageId || node.data?.movesToStage) {
        foundSalesStage = true;
        console.log(`\n- Nodo: ${node.id}`);
        console.log(`  Label: ${node.data.label}`);
        console.log(`  salesStageId: ${node.data.salesStageId || 'N/A'}`);
        console.log(`  movesToStage: ${node.data.movesToStage || 'N/A'}`);
      }
    });
    
    if (!foundSalesStage) {
      console.log('\n❌ Esta plantilla NO tiene configuración de sales funnel');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTemplate();