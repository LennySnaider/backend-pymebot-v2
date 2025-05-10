/**
 * scripts/cargar_ejemplos_flujos.js
 * 
 * Script para cargar ejemplos de flujos en la base de datos.
 * Útil para pruebas y para proporcionar flujos predefinidos a los tenants.
 * @version 1.0.0
 * @updated 2025-04-25
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuración
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tu-supabase-url.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'tu-supabase-service-key';
const TENANT_ID = process.argv[2] || 'default'; // Tomar del primer argumento

// Cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Carga de ejemplos de flujos
const flujosEjemplos = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../tests/ejemplos_flujos.json'), 'utf8')
);

/**
 * Carga un flujo en la base de datos
 * @param {Object} flujo Datos del flujo a cargar
 * @param {string} tenantId ID del tenant
 * @returns {Promise<string>} ID del flujo creado
 */
async function cargarFlujo(flujo, tenantId) {
  try {
    // Preparar el flujo para inserción
    const flowData = {
      name: flujo.name,
      description: flujo.description,
      version: flujo.version,
      entry_node_id: flujo.entryNodeId,
      tenant_id: tenantId,
      is_active: flujo.isActive || false,
      tags: flujo.tags || [],
      category: flujo.category || 'general',
      author: flujo.author || 'system'
    };
    
    // Insertar el flujo
    const { data: flow, error } = await supabase
      .from('flows')
      .insert(flowData)
      .select('id')
      .single();
    
    if (error) {
      throw new Error(`Error al insertar flujo: ${error.message}`);
    }
    
    // Preparar los nodos para inserción
    const nodesToInsert = Object.values(flujo.nodes).map(node => ({
      id: node.id,
      flow_id: flow.id,
      type: node.type,
      content: node.content,
      metadata: node.metadata || {},
      next: node.next,
      x: node.x || 0,
      y: node.y || 0
    }));
    
    // Insertar los nodos
    const { error: nodesError } = await supabase
      .from('flow_nodes')
      .insert(nodesToInsert);
    
    if (nodesError) {
      // Si falla, eliminamos el flujo para mantener consistencia
      await supabase.from('flows').delete().eq('id', flow.id);
      throw new Error(`Error al insertar nodos: ${nodesError.message}`);
    }
    
    console.log(`✅ Flujo "${flujo.name}" cargado con ID: ${flow.id}`);
    return flow.id;
  } catch (error) {
    console.error(`❌ Error al cargar flujo "${flujo.name}":`, error.message);
    return null;
  }
}

/**
 * Activa un flujo específico
 * @param {string} flowId ID del flujo a activar
 * @param {string} tenantId ID del tenant
 */
async function activarFlujo(flowId, tenantId) {
  try {
    // Primero desactivamos todos los flujos del tenant
    const { error: deactivateError } = await supabase
      .from('flows')
      .update({ is_active: false })
      .eq('tenant_id', tenantId);
    
    if (deactivateError) {
      throw new Error(`Error al desactivar flujos: ${deactivateError.message}`);
    }
    
    // Activamos el flujo específico
    const { error } = await supabase
      .from('flows')
      .update({ is_active: true })
      .eq('id', flowId);
    
    if (error) {
      throw new Error(`Error al activar flujo ${flowId}: ${error.message}`);
    }
    
    console.log(`✅ Flujo ${flowId} activado correctamente`);
  } catch (error) {
    console.error(`❌ Error al activar flujo ${flowId}:`, error.message);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log(`Cargando flujos de ejemplo para tenant: ${TENANT_ID}`);
  
  // Verificar que el tenant exista
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', TENANT_ID)
    .maybeSingle();
  
  if (tenantError) {
    console.error(`Error al verificar tenant: ${tenantError.message}`);
    process.exit(1);
  }
  
  if (!tenant) {
    console.log(`El tenant ${TENANT_ID} no existe. Creándolo...`);
    
    // Crear el tenant
    const { error: createError } = await supabase
      .from('tenants')
      .insert({
        id: TENANT_ID,
        name: `Tenant ${TENANT_ID}`,
        active: true
      });
    
    if (createError) {
      console.error(`Error al crear tenant: ${createError.message}`);
      process.exit(1);
    }
  }
  
  // Cargar cada flujo de ejemplo
  let primerFlujoId = null;
  
  for (const flujo of flujosEjemplos) {
    const flowId = await cargarFlujo(flujo, TENANT_ID);
    
    if (flowId && !primerFlujoId) {
      primerFlujoId = flowId;
    }
  }
  
  // Activar el primer flujo cargado
  if (primerFlujoId) {
    await activarFlujo(primerFlujoId, TENANT_ID);
  }
  
  console.log(`✅ Carga de flujos completada para tenant: ${TENANT_ID}`);
}

// Ejecutar función principal
main().catch(error => {
  console.error('Error en la ejecución principal:', error);
  process.exit(1);
});
