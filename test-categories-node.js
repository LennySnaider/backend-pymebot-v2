#!/usr/bin/env node
/**
 * Script para probar el nodo de categorías
 */

async function testCategoriesNode() {
  console.log('🧪 Iniciando prueba del nodo de categorías...');
  
  const testTemplate = {
    "id": "test-categories-template",
    "name": "Prueba Nodo Categorías",
    "description": "Template para probar el nodo de categorías",
    "react_flow_json": {
      "nodes": [
        {
          "id": "start-node",
          "type": "startNode",
          "position": { "x": 0, "y": 0 },
          "data": {
            "label": "Inicio",
            "message": "¡Hola! Bienvenido a nuestro chatbot de productos.",
            "waitForResponse": false
          }
        },
        {
          "id": "categories-node-1",
          "type": "categories",
          "position": { "x": 300, "y": 0 },
          "data": {
            "label": "Categorías",
            "message": "¿Qué tipo de productos te interesan?",
            "waitForResponse": true
          }
        },
        {
          "id": "products-node-1",
          "type": "products",
          "position": { "x": 600, "y": 0 },
          "data": {
            "label": "Productos",
            "message_template": "Aquí tienes los productos de la categoría seleccionada: {{product_list_formatted}}",
            "waitForResponse": false
          }
        }
      ],
      "edges": [
        {
          "id": "e1-2",
          "source": "start-node",
          "target": "categories-node-1"
        },
        {
          "id": "e2-3",
          "source": "categories-node-1",
          "target": "products-node-1"
        }
      ]
    }
  };

  try {
    console.log('📨 Enviando template al backend...');
    
    const response = await fetch('http://localhost:3090/api/chat/test-flow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: testTemplate,
        tenantId: 'test-tenant-categories'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Respuesta del backend:', result);
    
    // Ahora probar el chat
    console.log('\n💬 Probando conversación...');
    
    const chatResponse = await fetch('http://localhost:3090/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'hola',
        userId: 'test-user-categories',
        tenantId: 'test-tenant-categories'
      })
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Chat HTTP ${chatResponse.status}: ${chatResponse.statusText}`);
    }
    
    const chatResult = await chatResponse.json();
    console.log('🤖 Respuesta del chatbot:', chatResult);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar la prueba
testCategoriesNode();