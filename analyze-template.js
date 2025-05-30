import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTemplate() {
  try {
    // Primero verificar estructura de tabla
    const { data: sampleData, error: sampleError } = await supabase
      .from('chatbot_templates')
      .select('*')
      .limit(1);
      
    if (sampleData && sampleData.length > 0) {
      console.log('Columnas disponibles:', Object.keys(sampleData[0]));
    }

    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', 'd5e05ba1-0146-4587-860b-4e984dd0b672')
      .single();

    if (error) {
      console.log('Error:', error);
      return;
    }

    if (!data) {
      console.log('Plantilla no encontrada');
      return;
    }

    console.log('=== ANÁLISIS DE PLANTILLA: PymeBot V1 - Agendamiento Completo ===');
    console.log('Template ID:', data.id);
    console.log('Nombre:', data.name);
    console.log('Descripción:', data.description);
    console.log('Status:', data.status);
    console.log('Vertical ID:', data.vertical_id);
    console.log('Bot Type:', data.bot_type);
    console.log('');

    if (data.react_flow_json) {
      console.log('JSON Type:', typeof data.react_flow_json);
      
      let flowData;
      try {
        // Si ya es un objeto, no necesita parsing
        if (typeof data.react_flow_json === 'object') {
          flowData = data.react_flow_json;
        } else {
          flowData = JSON.parse(data.react_flow_json);
        }
      } catch (jsonError) {
        console.log('Error parsing JSON:', jsonError.message);
        console.log('Raw JSON:', data.react_flow_json);
        return;
      }
      
      console.log('=== NODOS DEL FLUJO ===');
      console.log('Total de nodos:', flowData.nodes?.length || 0);
      console.log('');

      // Ordenar nodos por posición Y para ver el flujo secuencial
      const sortedNodes = (flowData.nodes || []).sort((a, b) => a.position.y - b.position.y);
      
      sortedNodes.forEach((node, index) => {
        console.log(`${index + 1}. Nodo: ${node.id}`);
        console.log(`   Tipo: ${node.type}`);
        console.log(`   Posición: x=${node.position.x}, y=${node.position.y}`);
        
        if (node.data) {
          if (node.data.message) {
            console.log(`   Mensaje: ${node.data.message.substring(0, 100)}...`);
          }
          if (node.data.label) {
            console.log(`   Label: ${node.data.label}`);
          }
          if (node.data.waitForResponse !== undefined) {
            console.log(`   Espera respuesta: ${node.data.waitForResponse}`);
          }
          if (node.data.buttons && node.data.buttons.length > 0) {
            console.log(`   Botones: ${node.data.buttons.map(b => b.text).join(', ')}`);
          }
        }
        console.log('');
      });

      console.log('=== EDGES (CONEXIONES) ===');
      console.log('Total de conexiones:', flowData.edges?.length || 0);
      console.log('');
      
      (flowData.edges || []).forEach((edge, index) => {
        console.log(`${index + 1}. ${edge.source} → ${edge.target}`);
        if (edge.sourceHandle) {
          console.log(`   Handle: ${edge.sourceHandle}`);
        }
        if (edge.label) {
          console.log(`   Etiqueta: ${edge.label}`);
        }
      });

      console.log('');
      console.log('=== ANÁLISIS ESPECÍFICO ===');
      
      // Buscar nodos específicos
      const productsNode = sortedNodes.find(n => n.type === 'products' || n.id.includes('product'));
      const availabilityNode = sortedNodes.find(n => n.type === 'check-availability' || n.id.includes('availability'));
      const bookingNode = sortedNodes.find(n => n.type === 'book-appointment' || n.id.includes('book') || n.id.includes('appointment'));
      
      console.log('Nodo de Productos encontrado:', !!productsNode);
      if (productsNode) {
        console.log(`  ID: ${productsNode.id}, Tipo: ${productsNode.type}`);
      }
      
      console.log('Nodo de Disponibilidad encontrado:', !!availabilityNode);
      if (availabilityNode) {
        console.log(`  ID: ${availabilityNode.id}, Tipo: ${availabilityNode.type}`);
      }
      
      console.log('Nodo de Agendamiento encontrado:', !!bookingNode);
      if (bookingNode) {
        console.log(`  ID: ${bookingNode.id}, Tipo: ${bookingNode.type}`);
      }

      // Analizar secuencia servicios → disponibilidad → cita
      console.log('');
      console.log('=== SECUENCIA SERVICIOS → DISPONIBILIDAD → CITA ===');
      
      if (productsNode && availabilityNode && bookingNode) {
        // Verificar conexiones
        const productToAvailability = flowData.edges.find(e => e.source === productsNode.id && e.target === availabilityNode.id);
        const availabilityToBooking = flowData.edges.find(e => e.source === availabilityNode.id && e.target === bookingNode.id);
        
        console.log('Conexión Productos → Disponibilidad:', !!productToAvailability);
        console.log('Conexión Disponibilidad → Agendamiento:', !!availabilityToBooking);
        console.log('Flujo completo implementado:', !!(productToAvailability && availabilityToBooking));
      } else {
        console.log('Flujo completo NO implementado - faltan nodos');
      }

    } else {
      console.log('No hay datos de flujo JSON');
    }

  } catch (error) {
    console.log('Error al analizar plantilla:', error.message);
  }
}

analyzeTemplate();