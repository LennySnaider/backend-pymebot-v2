const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateFlowStructure() {
    const templateId = 'd5e05ba1-0146-4587-860b-4e984dd0b672';
    const flowId = 'b8ec193d-de62-4e82-b0ff-858ad27f9368';
    
    console.log('🔍 Buscando plantilla "PymeBot V1 - Agendamiento Completo"...');
    
    try {
        // 1. Obtener la estructura de la plantilla
        const { data: template, error: templateError } = await supabase
            .from('flow_templates')
            .select('nodes, edges, name')
            .eq('id', templateId)
            .single();
            
        if (templateError) {
            console.error('❌ Error al obtener la plantilla:', templateError);
            return;
        }
        
        if (!template) {
            console.error('❌ No se encontró la plantilla con ID:', templateId);
            return;
        }
        
        console.log('✅ Plantilla encontrada:', template.name);
        console.log('📊 Nodos:', template.nodes ? template.nodes.length : 0);
        console.log('📊 Conexiones:', template.edges ? template.edges.length : 0);
        
        // 2. Actualizar el flujo con la nueva estructura
        console.log('\n🔄 Actualizando flujo "Flujo basico lead"...');
        
        const { data: updatedFlow, error: updateError } = await supabase
            .from('flows')
            .update({
                nodes: template.nodes,
                edges: template.edges,
                updated_at: new Date().toISOString()
            })
            .eq('id', flowId)
            .select()
            .single();
            
        if (updateError) {
            console.error('❌ Error al actualizar el flujo:', updateError);
            return;
        }
        
        console.log('✅ Flujo actualizado exitosamente');
        console.log('📋 ID del flujo:', updatedFlow.id);
        console.log('📋 Nombre del flujo:', updatedFlow.name);
        console.log('📊 Nuevos nodos:', updatedFlow.nodes ? updatedFlow.nodes.length : 0);
        console.log('📊 Nuevas conexiones:', updatedFlow.edges ? updatedFlow.edges.length : 0);
        
        // 3. Verificar la actualización
        console.log('\n🔍 Verificando actualización...');
        
        const { data: verifyFlow, error: verifyError } = await supabase
            .from('flows')
            .select('id, name, nodes, edges, is_active')
            .eq('id', flowId)
            .single();
            
        if (verifyError) {
            console.error('❌ Error al verificar el flujo:', verifyError);
            return;
        }
        
        console.log('✅ Verificación exitosa:');
        console.log('  - Nombre:', verifyFlow.name);
        console.log('  - Activo:', verifyFlow.is_active);
        console.log('  - Estructura actualizada con', verifyFlow.nodes?.length || 0, 'nodos');
        
        // Mostrar algunos detalles de los nodos
        if (verifyFlow.nodes && verifyFlow.nodes.length > 0) {
            console.log('\n📋 Primeros nodos del flujo actualizado:');
            verifyFlow.nodes.slice(0, 3).forEach((node, index) => {
                console.log(`  ${index + 1}. ${node.type} - ${node.data?.label || node.data?.message || 'Sin etiqueta'}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar la actualización
updateFlowStructure();