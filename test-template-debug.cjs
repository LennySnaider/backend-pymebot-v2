#!/usr/bin/env node

const fetch = require('node-fetch');

async function testTemplateLoad() {
  try {
    console.log('🔍 [TEST TEMPLATE] Obteniendo template problemático desde Supabase...');
    
    const templateId = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';
    const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
    
    // Usar las credenciales de Supabase del .env
    const SUPABASE_URL = 'https://gyslfajscteoqhxefudu.supabase.co';
    const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/chatbot_templates?id=eq.${templateId}&tenant_id=eq.${tenantId}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ [TEST TEMPLATE] Error HTTP: ${response.status}`);
      return;
    }
    
    const templates = await response.json();
    
    if (!templates || templates.length === 0) {
      console.log('❌ [TEST TEMPLATE] No se encontró el template');
      return;
    }
    
    const template = templates[0];
    console.log('✅ [TEST TEMPLATE] Template encontrado:', template.name);
    console.log('🔍 [TEST TEMPLATE] Estado activo:', template.is_active);
    
    if (!template.flow_data) {
      console.log('❌ [TEST TEMPLATE] No hay flow_data en el template');
      return;
    }
    
    const flowData = JSON.parse(template.flow_data);
    console.log('🔍 [TEST TEMPLATE] Cantidad de nodos:', Object.keys(flowData.nodes || {}).length);
    
    // Analizar tipos de nodos
    const nodeTypes = Object.values(flowData.nodes || {}).map((node) => node.type);
    console.log('🔍 [TEST TEMPLATE] Tipos de nodos encontrados:', [...new Set(nodeTypes)]);
    
    // Verificar si tiene nodos problemáticos
    const problematicTypes = ['categories', 'products', 'check-availability', 'booking', 'bookAppointmentNode'];
    const hasProblematicNodes = nodeTypes.some(type => problematicTypes.includes(type));
    
    if (hasProblematicNodes) {
      console.log('🔥 [TEST TEMPLATE] ¡Template tiene nodos problemáticos!');
      console.log('🔥 [TEST TEMPLATE] Nodos problemáticos detectados:', 
        nodeTypes.filter(type => problematicTypes.includes(type))
      );
      console.log('🔥 [TEST TEMPLATE] Este template DEBERÍA ser interceptado por templateConverter');
    } else {
      console.log('✅ [TEST TEMPLATE] Template NO tiene nodos problemáticos');
      console.log('✅ [TEST TEMPLATE] Este template NO necesita intercepción');
    }
    
    // Mostrar algunos nodos como ejemplo
    console.log('🔍 [TEST TEMPLATE] Primeros 3 nodos:');
    Object.entries(flowData.nodes || {}).slice(0, 3).forEach(([id, node]) => {
      console.log(`  - ${id}: type="${node.type}", data="${JSON.stringify(node.data).substring(0, 100)}..."`);
    });
    
  } catch (error) {
    console.error('❌ [TEST TEMPLATE] Error:', error.message);
  }
}

testTemplateLoad();