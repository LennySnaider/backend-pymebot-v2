#!/usr/bin/env node

/**
 * Debug test to verify flow processing
 */

const API_BASE = 'http://localhost:3090';
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const TEMPLATE_ID = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';

async function testTemplate() {
  try {
    // Get template directly
    const response = await fetch(`${API_BASE}/api/templates/${TEMPLATE_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      }
    });

    if (!response.ok) {
      console.error(`Error: ${response.status}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();
    const template = data.template;
    console.log('Template found:', template.name);
    console.log('\nReact flow nodes with sales stages:');
    
    const nodes = template.react_flow_json?.nodes || [];
    nodes.forEach(node => {
      if (node.data?.salesStageId || node.data?.movesToStage) {
        console.log(`\nNode: ${node.id} (${node.type})`);
        console.log(`  Label: ${node.data.label}`);
        if (node.data?.salesStageId) {
          console.log(`  salesStageId: ${node.data.salesStageId}`);
        }
        if (node.data?.movesToStage) {
          console.log(`  movesToStage: ${node.data.movesToStage}`);
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

testTemplate();