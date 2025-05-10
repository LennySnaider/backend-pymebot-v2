/**
 * scripts/cargar_flujo_constructor_visual.js
 * 
 * Script para cargar un flujo predefinido desde el formato del Constructor Visual al backend.
 * Útil para pruebas manuales y demostraciones.
 * @version 1.0.0
 * @updated 2025-04-25
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para usar __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'admin_test_token'; // Token de super_admin
const TENANT_ID = process.env.TENANT_ID || 'default';

// Cliente HTTP
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  }
});

// Flujo de ejemplo del Constructor Visual (con formato compatible)
const constructorVisualFlow = {
  name: `Demo Constructor Visual ${new Date().toISOString().split('T')[0]}`,
  description: "Ejemplo de flujo creado con el Constructor Visual",
  version: "1.0.0",
  tenantId: TENANT_ID,
  entryNodeId: "start-node",
  isActive: false,
  tags: ["demo", "constructor-visual"],
  category: "ejemplos",
  author: "Admin",
  nodes: {
    "start-node": {
      id: "start-node",
      type: "startNode",
      content: "Nodo de inicio",
      metadata: {},
      next: "bienvenida",
      x: 50,
      y: 150
    },
    "bienvenida": {
      id: "bienvenida",
      type: "messageNode",
      content: "👋 ¡Hola! Soy un asistente virtual creado con el Constructor Visual de Flujos.",
      metadata: {
        role: "bot",
        delay: 500
      },
      next: "menu-principal",
      x: 250,
      y: 150
    },
    "menu-principal": {
      id: "menu-principal",
      type: "messageNode",
      content: "Puedo ayudarte con:\n1️⃣ Información sobre el Constructor Visual\n2️⃣ Ejemplos de flujos\n3️⃣ Finalizar conversación\n\n¿Qué opción te gustaría explorar?",
      metadata: {
        role: "bot"
      },
      next: "decision-menu",
      x: 450,
      y: 150
    },
    "decision-menu": {
      id: "decision-menu",
      type: "conditionNode",
      content: "Evaluando respuesta...",
      metadata: {
        condition: "Respuesta del usuario"
      },
      next: [
        {
          condition: {
            type: "contains",
            value: "1",
            caseSensitive: false
          },
          nextNodeId: "info-constructor"
        },
        {
          condition: {
            type: "contains",
            value: "información",
            caseSensitive: false
          },
          nextNodeId: "info-constructor"
        },
        {
          condition: {
            type: "contains",
            value: "2",
            caseSensitive: false
          },
          nextNodeId: "ejemplos-flujos"
        },
        {
          condition: {
            type: "contains",
            value: "ejemplos",
            caseSensitive: false
          },
          nextNodeId: "ejemplos-flujos"
        },
        {
          condition: {
            type: "contains",
            value: "3",
            caseSensitive: false
          },
          nextNodeId: "despedida"
        },
        {
          condition: {
            type: "contains",
            value: "finalizar",
            caseSensitive: false
          },
          nextNodeId: "despedida"
        },
        {
          condition: {
            type: "contains",
            value: "salir",
            caseSensitive: false
          },
          nextNodeId: "despedida"
        }
      ],
      x: 650,
      y: 150
    },
    "info-constructor": {
      id: "info-constructor",
      type: "messageNode",
      content: "📝 El Constructor Visual de Flujos es una herramienta que permite diseñar conversaciones interactivas sin necesidad de programar.\n\nCaracterísticas principales:\n• Interfaz visual intuitiva\n• Nodos de diferentes tipos (mensajes, condiciones, acciones)\n• Posibilidad de integrar IA y voz\n• Exportación e importación de flujos",
      metadata: {
        role: "bot",
        delay: 1000
      },
      next: "pregunta-mas-info",
      x: 850,
      y: 50
    },
    "pregunta-mas-info": {
      id: "pregunta-mas-info",
      type: "messageNode",
      content: "¿Te gustaría conocer más sobre el Constructor Visual o prefieres volver al menú principal?",
      metadata: {
        role: "bot"
      },
      next: "decision-mas-info",
      x: 1050,
      y: 50
    },
    "decision-mas-info": {
      id: "decision-mas-info",
      type: "conditionNode",
      content: "Evaluando respuesta...",
      metadata: {
        condition: "Respuesta del usuario"
      },
      next: [
        {
          condition: {
            type: "contains",
            value: "más",
            caseSensitive: false
          },
          nextNodeId: "info-constructor-detalle"
        },
        {
          condition: {
            type: "contains",
            value: "mas",
            caseSensitive: false
          },
          nextNodeId: "info-constructor-detalle"
        },
        {
          condition: {
            type: "contains",
            value: "conocer",
            caseSensitive: false
          },
          nextNodeId: "info-constructor-detalle"
        },
        {
          condition: {
            type: "contains",
            value: "volver",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        },
        {
          condition: {
            type: "contains",
            value: "menú",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        },
        {
          condition: {
            type: "contains",
            value: "menu",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        }
      ],
      x: 1250,
      y: 50
    },
    "info-constructor-detalle": {
      id: "info-constructor-detalle",
      type: "messageNode",
      content: "El Constructor Visual forma parte de una suite completa para la creación de chatbots y asistentes virtuales.\n\nBeneficios:\n• Reduce el tiempo de desarrollo\n• Permite a usuarios no técnicos crear flujos conversacionales\n• Facilita la iteración y mejora continua\n• Se integra con servicios de IA como GPT-4, Claude y otros\n\nLos flujos creados se guardan como plantillas que pueden ser activadas por los tenants.",
      metadata: {
        role: "bot",
        delay: 1200
      },
      next: "menu-principal",
      x: 1450,
      y: 50
    },
    "ejemplos-flujos": {
      id: "ejemplos-flujos",
      type: "messageNode",
      content: "🔍 Algunos ejemplos de flujos que puedes crear:\n\n• Atención al cliente con preguntas frecuentes\n• Asistentes de ventas para productos o servicios\n• Encuestas y recopilación de feedback\n• Guías interactivas paso a paso\n• Juegos conversacionales\n• Asistentes de IA con memoria y contexto",
      metadata: {
        role: "bot",
        delay: 1000
      },
      next: "pregunta-ejemplo-especifico",
      x: 850,
      y: 150
    },
    "pregunta-ejemplo-especifico": {
      id: "pregunta-ejemplo-especifico",
      type: "messageNode",
      content: "¿Te gustaría ver un ejemplo más específico de alguno de estos flujos o prefieres volver al menú principal?",
      metadata: {
        role: "bot"
      },
      next: "decision-ejemplo-especifico",
      x: 1050,
      y: 150
    },
    "decision-ejemplo-especifico": {
      id: "decision-ejemplo-especifico",
      type: "conditionNode",
      content: "Evaluando respuesta...",
      metadata: {
        condition: "Respuesta del usuario"
      },
      next: [
        {
          condition: {
            type: "contains",
            value: "sí",
            caseSensitive: false
          },
          nextNodeId: "ejemplo-detallado"
        },
        {
          condition: {
            type: "contains",
            value: "si",
            caseSensitive: false
          },
          nextNodeId: "ejemplo-detallado"
        },
        {
          condition: {
            type: "contains",
            value: "ejemplo",
            caseSensitive: false
          },
          nextNodeId: "ejemplo-detallado"
        },
        {
          condition: {
            type: "contains",
            value: "específico",
            caseSensitive: false
          },
          nextNodeId: "ejemplo-detallado"
        },
        {
          condition: {
            type: "contains",
            value: "especifico",
            caseSensitive: false
          },
          nextNodeId: "ejemplo-detallado"
        },
        {
          condition: {
            type: "contains",
            value: "volver",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        },
        {
          condition: {
            type: "contains",
            value: "menú",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        },
        {
          condition: {
            type: "contains",
            value: "menu",
            caseSensitive: false
          },
          nextNodeId: "menu-principal"
        }
      ],
      x: 1250,
      y: 150
    },
    "ejemplo-detallado": {
      id: "ejemplo-detallado",
      type: "messageNode",
      content: "📱 Ejemplo: Asistente de reservas para restaurante\n\n1. Nodo Inicio → Bienvenida\n2. Solicitar fecha y hora para la reserva\n3. Condición para verificar disponibilidad\n4. Si hay disponibilidad → Solicitar datos de contacto\n5. Si no hay disponibilidad → Ofrecer alternativas\n6. Confirmar reserva\n7. Enviar recordatorio\n\nEste flujo podría incluir nodos de IA para manejar consultas fuera del flujo principal y nodos de API para verificar disponibilidad en tiempo real.",
      metadata: {
        role: "bot",
        delay: 1200
      },
      next: "menu-principal",
      x: 1450,
      y: 150
    },
    "despedida": {
      id: "despedida",
      type: "messageNode",
      content: "👋 Gracias por probar este ejemplo de flujo creado con el Constructor Visual. ¡Hasta pronto!",
      metadata: {
        role: "bot"
      },
      next: "end-node",
      x: 850,
      y: 250
    },
    "end-node": {
      id: "end-node",
      type: "endNode",
      content: "Fin de la conversación",
      metadata: {},
      x: 1050,
      y: 250
    }
  }
};

/**
 * Funciones
 */

// Cargar flujo predefinido
async function cargarFlujoPredefinido() {
  try {
    console.log(`Cargando flujo de ejemplo del Constructor Visual para tenant ${TENANT_ID}...`);
    
    // Enviamos la solicitud para crear el flujo
    const response = await apiClient.post('/flows', constructorVisualFlow);
    
    if (response.status === 201 && response.data.success) {
      console.log(`✅ Flujo creado exitosamente con ID: ${response.data.id}`);
      return response.data.id;
    } else {
      console.error('⚠️ Respuesta inesperada:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error al cargar flujo:', error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    return null;
  }
}

// Activar flujo
async function activarFlujo(id) {
  try {
    console.log(`Activando flujo ${id}...`);
    
    const response = await apiClient.post(`/flows/${id}/activate`);
    
    if (response.status === 200 && response.data.success) {
      console.log(`✅ Flujo activado correctamente`);
      return true;
    } else {
      console.error('⚠️ Respuesta inesperada:', response.data);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error al activar flujo ${id}:`, error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    return false;
  }
}

// Cargar flujo desde archivo
async function cargarFlujoDesdeArchivo(rutaArchivo) {
  try {
    console.log(`Cargando flujo desde archivo: ${rutaArchivo}`);
    
    const contenido = fs.readFileSync(rutaArchivo, 'utf8');
    const flujo = JSON.parse(contenido);
    
    // Aseguramos que tenga el tenant correcto
    flujo.tenantId = TENANT_ID;
    
    // Enviamos la solicitud para crear el flujo
    const response = await apiClient.post('/flows', flujo);
    
    if (response.status === 201 && response.data.success) {
      console.log(`✅ Flujo desde archivo creado exitosamente con ID: ${response.data.id}`);
      return response.data.id;
    } else {
      console.error('⚠️ Respuesta inesperada:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error al cargar flujo desde archivo:', error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  // Obtener argumentos de línea de comandos
  const args = process.argv.slice(2);
  
  // Si se proporciona una ruta de archivo, cargar desde archivo
  if (args.length > 0 && args[0] !== '--activate') {
    const rutaArchivo = args[0];
    const flowId = await cargarFlujoDesdeArchivo(rutaArchivo);
    
    // Si se solicita activar y se creó correctamente
    if (flowId && (args.includes('--activate') || args.includes('-a'))) {
      await activarFlujo(flowId);
    }
    
    return;
  }
  
  // Caso por defecto: cargar flujo predefinido
  const flowId = await cargarFlujoPredefinido();
  
  // Si se solicita activar y se creó correctamente
  if (flowId && (args.includes('--activate') || args.includes('-a'))) {
    await activarFlujo(flowId);
  }
}

// Ejecutar el script
main().catch(console.error);
