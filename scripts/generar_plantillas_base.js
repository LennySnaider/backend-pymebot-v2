/**
 * scripts/generar_plantillas_base.js
 * 
 * Script para generar plantillas base para el super_admin.
 * Estas plantillas pueden servir como punto de partida para crear flujos más complejos.
 * @version 1.0.0
 * @updated 2025-04-25
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tu-supabase-url.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'tu-supabase-service-key';
const AUTHOR = process.env.AUTHOR || 'super_admin';

// Cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Plantillas base
const PLANTILLAS_BASE = [
  {
    name: "Plantilla de Bienvenida Simple",
    description: "Una plantilla básica para dar la bienvenida a los usuarios",
    version: "1.0.0",
    category: "general",
    tags: ["bienvenida", "inicio"],
    entryNodeId: "welcome1",
    nodes: {
      "welcome1": {
        id: "welcome1",
        type: "message",
        content: "¡Hola! Bienvenido a nuestro servicio de asistencia virtual.",
        metadata: {
          role: "bot",
          delay: 500
        },
        next: "welcome2",
        x: 100,
        y: 100,
        isEditable: true
      },
      "welcome2": {
        id: "welcome2",
        type: "message",
        content: "Soy tu asistente virtual y estoy aquí para ayudarte con información, reservas y soporte técnico.",
        metadata: {
          role: "bot",
          delay: 1000
        },
        next: "welcome3",
        x: 100,
        y: 200,
        isEditable: true
      },
      "welcome3": {
        id: "welcome3",
        type: "message",
        content: "¿En qué puedo ayudarte hoy?",
        metadata: {
          role: "bot",
          delay: 500
        },
        x: 100,
        y: 300,
        isEditable: true
      }
    },
    editableNodes: ["welcome1", "welcome2", "welcome3"]
  },
  {
    name: "Plantilla de Atención al Cliente",
    description: "Flujo para atender consultas y problemas de los clientes",
    version: "1.0.0",
    category: "atención_cliente",
    tags: ["soporte", "ayuda", "atención"],
    entryNodeId: "start",
    nodes: {
      "start": {
        id: "start",
        type: "message",
        content: "Bienvenido a nuestro servicio de atención al cliente. ¿En qué puedo ayudarte hoy?",
        metadata: {
          role: "bot",
          delay: 500
        },
        next: "options",
        x: 100,
        y: 100,
        isEditable: true
      },
      "options": {
        id: "options",
        type: "condition",
        content: "Analizando tu consulta...",
        next: [
          {
            condition: {
              type: "contains",
              value: "producto",
              caseSensitive: false
            },
            nextNodeId: "product_info"
          },
          {
            condition: {
              type: "contains",
              value: "problema",
              caseSensitive: false
            },
            nextNodeId: "issue_help"
          },
          {
            condition: {
              type: "contains",
              value: "horario",
              caseSensitive: false
            },
            nextNodeId: "schedule_info"
          }
        ],
        x: 300,
        y: 100,
        isEditable: false
      },
      "product_info": {
        id: "product_info",
        type: "ai_voice_agent",
        content: "Entiendo que necesitas información sobre nuestros productos. Por favor, cuéntame más específicamente qué producto te interesa.",
        metadata: {
          voiceId: "Calm_Woman",
          speed: 1.0
        },
        next: "end",
        x: 500,
        y: 50,
        isEditable: true
      },
      "issue_help": {
        id: "issue_help",
        type: "ai_voice_agent",
        content: "Lamento que estés experimentando problemas. Por favor, describe el problema con detalle para poder ayudarte mejor.",
        metadata: {
          voiceId: "Calm_Woman",
          speed: 1.0
        },
        next: "end",
        x: 500,
        y: 150,
        isEditable: true
      },
      "schedule_info": {
        id: "schedule_info",
        type: "message",
        content: "Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM y sábados de 10:00 AM a 2:00 PM. Domingos cerrado.",
        metadata: {
          role: "bot"
        },
        next: "end",
        x: 500,
        y: 250,
        isEditable: true
      },
      "end": {
        id: "end",
        type: "message",
        content: "¿Hay algo más en lo que pueda ayudarte?",
        metadata: {
          role: "bot"
        },
        x: 700,
        y: 150,
        isEditable: true
      }
    },
    editableNodes: ["start", "product_info", "issue_help", "schedule_info", "end"]
  },
  {
    name: "Plantilla de Reservas",
    description: "Flujo para gestionar reservas y citas",
    version: "1.0.0",
    category: "reservas",
    tags: ["citas", "reservas", "agenda"],
    entryNodeId: "start",
    nodes: {
      "start": {
        id: "start",
        type: "message",
        content: "Bienvenido al sistema de reservas. ¿Qué tipo de servicio te gustaría reservar?",
        metadata: {
          role: "bot"
        },
        next: "get_service",
        x: 100,
        y: 100,
        isEditable: true
      },
      "get_service": {
        id: "get_service",
        type: "input",
        content: "Por favor, indica qué servicio deseas reservar:",
        metadata: {
          inputType: "text",
          variableName: "service"
        },
        next: "get_date",
        x: 300,
        y: 100,
        isEditable: false
      },
      "get_date": {
        id: "get_date",
        type: "input",
        content: "¿Para qué fecha deseas hacer la reserva? (Ejemplo: 15 de mayo)",
        metadata: {
          inputType: "text",
          variableName: "date"
        },
        next: "get_time",
        x: 500,
        y: 100,
        isEditable: false
      },
      "get_time": {
        id: "get_time",
        type: "input",
        content: "¿A qué hora te gustaría tu cita?",
        metadata: {
          inputType: "text",
          variableName: "time"
        },
        next: "get_name",
        x: 700,
        y: 100,
        isEditable: false
      },
      "get_name": {
        id: "get_name",
        type: "input",
        content: "Por favor, proporciona tu nombre completo:",
        metadata: {
          inputType: "text",
          variableName: "fullName"
        },
        next: "confirm",
        x: 900,
        y: 100,
        isEditable: true
      },
      "confirm": {
        id: "confirm",
        type: "message",
        content: "Voy a confirmar tu reserva:\n- Servicio: {{context.service}}\n- Fecha: {{context.date}}\n- Hora: {{context.time}}\n- Nombre: {{context.fullName}}\n\n¿Es correcta esta información?",
        metadata: {
          role: "bot"
        },
        next: "check_confirmation",
        x: 1100,
        y: 100,
        isEditable: true
      },
      "check_confirmation": {
        id: "check_confirmation",
        type: "condition",
        content: "Verificando confirmación...",
        next: [
          {
            condition: {
              type: "contains",
              value: "sí",
              caseSensitive: false
            },
            nextNodeId: "success"
          },
          {
            condition: {
              type: "contains",
              value: "si",
              caseSensitive: false
            },
            nextNodeId: "success"
          },
          {
            condition: {
              type: "contains",
              value: "no",
              caseSensitive: false
            },
            nextNodeId: "cancel"
          }
        ],
        x: 1300,
        y: 100,
        isEditable: false
      },
      "success": {
        id: "success",
        type: "message",
        content: "¡Tu reserva ha sido confirmada! Te esperamos el {{context.date}} a las {{context.time}}. Recibirás un correo de confirmación con los detalles.",
        metadata: {
          role: "bot"
        },
        next: "end",
        x: 1500,
        y: 50,
        isEditable: true
      },
      "cancel": {
        id: "cancel",
        type: "message",
        content: "He cancelado el proceso de reserva. Puedes iniciar nuevamente cuando lo desees.",
        metadata: {
          role: "bot"
        },
        next: "end",
        x: 1500,
        y: 150,
        isEditable: true
      },
      "end": {
        id: "end",
        type: "end",
        content: "Gracias por usar nuestro sistema de reservas. ¡Que tengas un buen día!",
        x: 1700,
        y: 100,
        isEditable: true
      }
    },
    editableNodes: ["start", "get_name", "confirm", "success", "cancel", "end"]
  }
];

/**
 * Crea una plantilla base en Supabase
 * @param {Object} plantilla Datos de la plantilla a crear
 * @returns {Promise<string|null>} ID de la plantilla creada o null si falla
 */
async function crearPlantilla(plantilla) {
  try {
    // Separamos los nodos editables
    const editableNodes = plantilla.editableNodes || [];
    delete plantilla.editableNodes;

    // Creamos la plantilla en la base de datos
    const { data, error } = await supabase
      .from('flow_templates')
      .insert({
        name: plantilla.name,
        description: plantilla.description,
        version: plantilla.version,
        nodes: plantilla.nodes,
        entry_node_id: plantilla.entryNodeId,
        category: plantilla.category,
        tags: plantilla.tags,
        author: AUTHOR,
        editable_nodes: editableNodes
      })
      .select('id')
      .single();
    
    if (error) {
      console.error(`Error al crear plantilla "${plantilla.name}":`, error);
      return null;
    }
    
    console.log(`✅ Plantilla creada: ${plantilla.name} (ID: ${data.id})`);
    return data.id;
  } catch (error) {
    console.error(`Error al crear plantilla "${plantilla.name}":`, error);
    return null;
  }
}

/**
 * Función principal para crear todas las plantillas base
 */
async function main() {
  console.log('Iniciando creación de plantillas base...');
  
  let creadas = 0;
  let fallidas = 0;
  
  for (const plantilla of PLANTILLAS_BASE) {
    const id = await crearPlantilla(plantilla);
    
    if (id) {
      creadas++;
    } else {
      fallidas++;
    }
  }
  
  console.log('===== Resumen =====');
  console.log(`Plantillas creadas: ${creadas}`);
  console.log(`Plantillas fallidas: ${fallidas}`);
  console.log('===================');
}

// Ejecutar la función principal
main().catch(error => {
  console.error('Error en la ejecución principal:', error);
  process.exit(1);
});
