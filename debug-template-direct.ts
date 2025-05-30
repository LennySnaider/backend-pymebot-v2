/**
 * Script to directly check template in backend
 */

import { getSupabaseClient } from "./src/services/supabase";

async function debugTemplate() {
  try {
    const supabase = getSupabaseClient();
    const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
    
    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Template:', data.name);
    console.log('\nNodes with sales stage info:');
    
    const nodes = data.react_flow_json?.nodes || [];
    let foundAny = false;
    
    nodes.forEach((node: any) => {
      if (node.data?.salesStageId || node.data?.movesToStage) {
        foundAny = true;
        console.log(`\nNode ${node.id} (${node.type}):`);
        console.log(`  Label: ${node.data.label}`);
        console.log(`  salesStageId: ${node.data.salesStageId}`);
        console.log(`  movesToStage: ${node.data.movesToStage}`);
      }
    });
    
    if (!foundAny) {
      console.log('\n❌ No sales stage configuration found in this template');
      console.log('\nAll nodes:');
      nodes.forEach((node: any) => {
        console.log(`- ${node.id}: ${node.data?.label || 'No label'}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

debugTemplate();