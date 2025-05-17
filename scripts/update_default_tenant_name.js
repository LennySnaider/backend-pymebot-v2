/**
 * Script para actualizar el nombre del tenant default
 * Esto asegura que las variables del sistema muestren el nombre correcto
 */

import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://gyslfajscteoqhxefudu.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDQ4MzQ1MCwiZXhwIjoyMDU2MDU5NDUwfQ.VBBFm673ptVByxXWqYcLBu5M72gQdWvTqpLXm3EkG6A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateDefaultTenant() {
  const defaultTenantId = '00000000-0000-0000-0000-000000000000';
  
  try {
    // Primero verificar si existe y si no, buscar el tenant real
    console.log('Buscando tenant...');
    
    // Buscar si existe el tenant con UUID default
    let { data: tenantCheck, error: checkError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', defaultTenantId)
      .single();
      
    let actualTenantId = defaultTenantId;
    
    if (checkError || !tenantCheck) {
      console.log('Tenant UUID default no encontrado, buscando por nombre...');
      
      // Buscar tenant por nombre "default" o el primer tenant
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name')
        .order('created_at', { ascending: true })
        .limit(1);
        
      if (tenants && tenants.length > 0) {
        actualTenantId = tenants[0].id;
        console.log(`Usando tenant existente: ${tenants[0].name} (${actualTenantId})`);
      } else {
        console.error('No se encontraron tenants en la base de datos');
        return;
      }
    }
    
    console.log(`Actualizando tenant ${actualTenantId}...`);
    
    // Actualizar el nombre del tenant
    const { data, error } = await supabase
      .from('tenants')
      .update({
        name: 'Pymebot',
        website: 'https://www.pymebot.ai',
        contact_email: 'contacto@pymebot.ai',
        phone_number: '55168974132',
        city: 'Ciudad de México',
        address: 'Avenida Siempre Viva 34'
      })
      .eq('id', actualTenantId);
      
    if (error) {
      console.error('Error al actualizar tenant:', error);
      return;
    }
    
    console.log('Tenant actualizado exitosamente');
    
    // También vamos a agregar/actualizar las variables del sistema
    const systemVariables = [
      { variable_name: 'company_name', variable_value: 'Pymebot' },
      { variable_name: 'nombre_empresa', variable_value: 'Pymebot' },
      { variable_name: 'nombre_negocio', variable_value: 'Pymebot' },
      { variable_name: 'business_name', variable_value: 'Pymebot' }
    ];
    
    for (const variable of systemVariables) {
      const { error: varError } = await supabase
        .from('tenant_variables')
        .upsert({
          tenant_id: actualTenantId,
          ...variable,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,variable_name'
        });
        
      if (varError) {
        console.error(`Error al actualizar variable ${variable.variable_name}:`, varError);
      } else {
        console.log(`Variable ${variable.variable_name} actualizada`);
      }
    }
    
    console.log('Proceso completado');
    
  } catch (error) {
    console.error('Error general:', error);
  }
}

// Ejecutar el script
updateDefaultTenant();