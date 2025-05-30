#!/usr/bin/env node

/**
 * Test template via server endpoint
 */

const API_BASE = 'http://localhost:3090';
const TEMPLATE_ID = '0654268d-a65a-4e59-83a2-e99d4d393273';

async function checkTemplateViaServer() {
  try {
    // Query via a test endpoint
    const response = await fetch(`${API_BASE}/api/flows-cache/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        tenant_id: 'afa60b0a-3046-4607-9c48-266af6e1d322'
      })
    });

    if (!response.ok) {
      console.error('Error clearing cache:', response.status);
    }
    
    console.log('Cache cleared, now template should include sales stages if properly configured');
    
    // Use a different endpoint to check templates
    const templatesResponse = await fetch(`${API_BASE}/api/text/templates?tenant_id=afa60b0a-3046-4607-9c48-266af6e1d322`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!templatesResponse.ok) {
      console.error('Error getting templates:', templatesResponse.status);
      return;
    }
    
    const data = await templatesResponse.json();
    console.log('\nTemplates disponibles:');
    data.templates.forEach(template => {
      console.log(`- ${template.name} (${template.id}) - Active: ${template.isActive}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTemplateViaServer();