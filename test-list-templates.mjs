#!/usr/bin/env node

/**
 * List available templates
 */

const API_BASE = 'http://localhost:3090';
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';

async function listTemplates() {
  try {
    // List templates for tenant
    const response = await fetch(`${API_BASE}/api/templates?tenant_id=${TENANT_ID}`, {
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
    console.log('Templates found:');
    data.templates.forEach(template => {
      console.log(`- ${template.name} (${template.id})`);
      console.log(`  Is Active: ${template.is_active}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

listTemplates();