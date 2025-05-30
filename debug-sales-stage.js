/**
 * Script de depuración para verificar por qué salesStageId no se está propagando
 */

import { getTemplateById } from './src/services/supabase.ts';

async function debugTemplate() {
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  
  try {
    console.log('\n=== DEPURACIÓN DE SALESTAGEID ===\n');
    
    // 1. Verificar la estructura del template
    const template = await getTemplateById(templateId);
    
    if (!template) {
      console.log('ERROR: Template no encontrado');
      return;
    }
    
    console.log('Template encontrado:', template.name);
    console.log('React Flow JSON existe:', !!template.react_flow_json);
    
    if (template.react_flow_json) {
      const nodes = template.react_flow_json.nodes;
      
      console.log('\n=== NODOS DEL TEMPLATE ===');
      nodes.forEach(node => {
        console.log(`\nNodo: ${node.id} (${node.type})`);
        console.log('data:', JSON.stringify(node.data, null, 2));
        
        // Verificar específicamente salesStageId
        const salesStageId = node.data?.salesStageId;
        if (salesStageId) {
          console.log(`✓ salesStageId encontrado: "${salesStageId}"`);
        } else {
          console.log('✗ salesStageId NO encontrado');
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// También verificar el flujo procesado
async function debugConvertedFlow() {
  const { convertTemplateToBuilderbotFlow } = await import('./src/services/templateConverter.ts');
  const templateId = '0654268d-a65a-4e59-83a2-e99d4d393273';
  const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  try {
    console.log('\n\n=== FLUJO CONVERTIDO ===\n');
    
    const result = await convertTemplateToBuilderbotFlow(templateId, tenantId);
    
    console.log('Flujo convertido exitosamente');
    console.log('Entrada de flujo:', result.entryKeywords);
    console.log('Número de nodos:', Object.keys(result.nodeMap).length);
    
    // Verificar cómo se procesaron los nodos
    Object.entries(result.nodeMap).forEach(([nodeId, node]) => {
      console.log(`\nProcesando nodo: ${nodeId}`);
      console.log('Tipo:', node.type);
      console.log('Metadata:', JSON.stringify(node.metadata || {}, null, 2));
      console.log('Data:', JSON.stringify(node.data || {}, null, 2));
    });
    
  } catch (error) {
    console.error('Error convirtiendo flujo:', error);
  }
}

debugTemplate().then(() => debugConvertedFlow());