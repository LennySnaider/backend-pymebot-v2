#!/usr/bin/env node
/**
 * Script para probar el template converter con un nodo de categorías simple
 */

import { templateConverter } from './src/services/templateConverter.js';

const testTemplate = {
  "id": "test-categories",
  "name": "Test Categorías",
  "description": "Template de prueba para nodo de categorías",
  "react_flow_json": {
    "nodes": [
      {
        "id": "start-1",
        "type": "startNode",
        "position": { "x": 0, "y": 0 },
        "data": {
          "label": "Inicio",
          "message": "¡Hola! Bienvenido a nuestro chatbot.",
          "waitForResponse": false
        }
      },
      {
        "id": "categories-1",
        "type": "categories",
        "position": { "x": 300, "y": 0 },
        "data": {
          "label": "Categorías",
          "message": "¿Qué tipo de productos te interesan?",
          "waitForResponse": true
        }
      },
      {
        "id": "end-1",
        "type": "endNode",
        "position": { "x": 600, "y": 0 },
        "data": {
          "label": "Fin",
          "message": "¡Gracias por usar nuestro chatbot!"
        }
      }
    ],
    "edges": [
      {
        "id": "e1-2",
        "source": "start-1",
        "target": "categories-1"
      },
      {
        "id": "e2-3",
        "source": "categories-1",
        "target": "end-1"
      }
    ]
  }
};

async function testConverter() {
  console.log('🧪 Probando conversión de template con nodo de categorías...');
  
  try {
    const result = await templateConverter(testTemplate, 'test-tenant');
    
    console.log('✅ Conversión exitosa!');
    console.log('📊 Resultado:');
    console.log('- Flujo creado:', !!result);
    console.log('- Tipo:', typeof result);
    
    if (result && typeof result === 'object') {
      console.log('- Propiedades:', Object.keys(result));
    }
    
  } catch (error) {
    console.error('❌ Error en la conversión:', error.message);
    console.error('Stack:', error.stack);
  }
}

testConverter();