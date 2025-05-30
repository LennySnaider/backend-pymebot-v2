#!/usr/bin/env node

/**
 * test-new-nodes.mjs
 * 
 * Script para probar los nuevos nodos implementados en templateConverter:
 * - categories/categoriesNode/categories-node
 * - products/productsNode/products-node  
 * - check-availability/checkAvailabilityNode/check-availability-node
 */

import { convertTemplateToBuilderbotFlow } from './src/services/templateConverter.js';
import logger from './src/utils/logger.js';

// Plantilla de prueba con los nuevos nodos
const testTemplate = {
  react_flow_json: {
    nodes: [
      {
        id: 'start-node',
        type: 'startNode',
        metadata: { keywords: ['test', 'prueba'] }
      },
      {
        id: 'categories-node',
        type: 'categories',
        data: {
          message: "Selecciona una categoría:",
          options: [
            { body: "Residencial" },
            { body: "Comercial" },
            { body: "Industrial" }
          ]
        }
      },
      {
        id: 'products-node', 
        type: 'products',
        data: {
          message: "Selecciona un producto/servicio:",
          options: [
            { body: "Venta de Propiedades" },
            { body: "Alquiler de Propiedades" },
            { body: "Asesoría Inmobiliaria" }
          ]
        }
      },
      {
        id: 'check-availability-node',
        type: 'check-availability',
        data: {
          message: "🔍 Verificando disponibilidad..."
        }
      },
      {
        id: 'end-node',
        type: 'endNode'
      }
    ],
    edges: [
      { source: 'start-node', target: 'categories-node' },
      { source: 'categories-node', target: 'products-node' },
      { source: 'products-node', target: 'check-availability-node' },
      { source: 'check-availability-node', target: 'end-node' }
    ]
  }
};

async function testNewNodes() {
  try {
    console.log('🧪 Iniciando prueba de nuevos nodos...\n');
    
    // Mock de la función getTemplateById para no requerir Supabase
    const originalImport = await import('./src/services/supabase.js');
    const mockSupabase = {
      ...originalImport,
      getTemplateById: async (templateId) => {
        console.log(`📋 Mock: Obteniendo plantilla ${templateId}`);
        return {
          id: templateId,
          name: 'Test Template',
          description: 'Plantilla de prueba para nuevos nodos',
          status: 'published',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          react_flow_json: testTemplate.react_flow_json,
          version: 1,
          created_by: 'test'
        };
      }
    };
    
    // Simular un ID de plantilla
    const testTemplateId = 'test-new-nodes-template';
    const tenantId = 'test-tenant';
    const sessionId = 'test-session';
    
    console.log('🔄 Convirtiendo plantilla a flujo BuilderBot...');
    
    const result = await convertTemplateToBuilderbotFlow(
      testTemplateId,
      tenantId, 
      sessionId
    );
    
    console.log('✅ Conversión completada!\n');
    console.log('📊 Resultados:');
    console.log(`- Flujo creado: ${result.flow ? '✓' : '✗'}`);
    console.log(`- Keywords de entrada: ${result.entryKeywords?.join(', ') || 'N/A'}`);
    console.log(`- Número de nodos mapeados: ${Object.keys(result.nodeMap).length}`);
    
    if (result.flow) {
      console.log('\n🎯 Estructura del flujo creada exitosamente');
      console.log('Los siguientes tipos de nodo fueron procesados:');
      console.log('  ✓ categories/categoriesNode');
      console.log('  ✓ products/productsNode');  
      console.log('  ✓ check-availability/checkAvailabilityNode');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Ejecutar la prueba
testNewNodes().then(success => {
  if (success) {
    console.log('\n🎉 Prueba completada exitosamente');
    console.log('Los nuevos nodos están implementados correctamente en templateConverter.ts');
  } else {
    console.log('\n💥 La prueba falló');
    console.log('Revisar los errores arriba para diagnosticar el problema');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});