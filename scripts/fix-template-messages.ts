/**
 * scripts/fix-template-messages.ts
 * 
 * Script para arreglar los mensajes en todas las plantillas
 * Extrae los mensajes de los flujos y los guarda en la configuración
 * 
 * Modo de uso:
 * ts-node fix-template-messages.ts [--dry-run] [--template-id=ID]
 * 
 * Opciones:
 *   --dry-run       Mostrar cambios sin aplicarlos
 *   --template-id   Arreglar solo una plantilla específica
 * 
 * @version 1.0.0
 * @updated 2025-05-10
 */

import { supabase, checkSupabaseConnection } from '../src/config/supabase';
import { findInitialMessage } from '../src/services/chatbotUtils';
import { config } from '../src/config';
import logger from '../src/utils/logger';

// Verificar si estamos en modo dry-run
const isDryRun = process.argv.includes('--dry-run');
console.log(`Modo: ${isDryRun ? 'Simulación (--dry-run)' : 'Ejecución real'}`);

// Verificar si se especificó un ID de plantilla
const templateIdArg = process.argv.find(arg => arg.startsWith('--template-id='));
const specificTemplateId = templateIdArg ? templateIdArg.split('=')[1] : null;

if (specificTemplateId) {
  console.log(`Procesando solo la plantilla con ID: ${specificTemplateId}`);
}

/**
 * Función principal del script
 */
async function main() {
  console.log('Iniciando script de corrección de mensajes en plantillas...');
  
  // Verificar conexión a Supabase
  console.log('Verificando conexión a Supabase...');
  const connected = await checkSupabaseConnection();
  
  if (!connected) {
    console.error('❌ Error: No se pudo conectar a Supabase. Verifique las credenciales.');
    process.exit(1);
  }
  
  console.log('✅ Conexión a Supabase establecida correctamente.');
  
  // Consultar plantillas
  let query = supabase.from('chatbot_templates').select('*');
  
  // Si hay un ID específico, filtrar por él
  if (specificTemplateId) {
    query = query.eq('id', specificTemplateId);
  }
  
  const { data: templates, error } = await query;
  
  if (error) {
    console.error(`❌ Error al recuperar plantillas: ${error.message}`);
    process.exit(1);
  }
  
  if (!templates || templates.length === 0) {
    console.log('⚠️ No se encontraron plantillas para procesar.');
    process.exit(0);
  }
  
  console.log(`Encontradas ${templates.length} plantillas para procesar.`);
  
  // Contador de plantillas arregladas
  let fixedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  // Procesar cada plantilla
  for (const template of templates) {
    try {
      console.log(`\n--------------------------------------`);
      console.log(`Procesando plantilla "${template.name}" (ID: ${template.id})...`);
      
      // Verificar si tiene react_flow_json
      if (!template.react_flow_json) {
        console.log(`⚠️ La plantilla no tiene react_flow_json. Omitiendo.`);
        skippedCount++;
        continue;
      }
      
      // Preparar la configuración
      let config = template.config;
      if (typeof config === 'string') {
        try {
          config = JSON.parse(config);
        } catch (parseError) {
          console.log(`⚠️ Error al parsear config, creando nuevo objeto: ${parseError}`);
          config = {};
        }
      } else if (!config) {
        config = {};
      }
      
      // Ver si ya tiene mensajes en la configuración
      if (config.initialMessage && config.greeting) {
        console.log(`ℹ️ La plantilla ya tiene mensajes configurados:`);
        console.log(`   - initialMessage: "${config.initialMessage}"`);
        console.log(`   - greeting: "${config.greeting}"`);
      }
      
      // Convertir el react_flow_json a objeto si es necesario
      let flowJson;
      try {
        flowJson = typeof template.react_flow_json === 'string'
          ? JSON.parse(template.react_flow_json)
          : template.react_flow_json;
      } catch (parseError) {
        console.error(`❌ Error al parsear react_flow_json: ${parseError}`);
        errorCount++;
        continue;
      }
      
      // Extraer mensaje del flujo
      console.log(`Intentando extraer mensaje del flujo...`);
      const extractResult = findInitialMessage(flowJson);
      
      if (extractResult && extractResult.message) {
        const message = extractResult.message;
        console.log(`✅ Mensaje extraído: "${message}"`);
        console.log(`   - Método: ${extractResult.diagnostics.extractionMethod}`);
        console.log(`   - Fuente: ${extractResult.diagnostics.messageSource}`);
        
        // Actualizar la configuración
        config.initialMessage = message;
        config.greeting = message;
        
        // Guardar los cambios (si no estamos en modo dry-run)
        if (!isDryRun) {
          const { error: updateError } = await supabase
            .from('chatbot_templates')
            .update({ 
              config,
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id);
          
          if (updateError) {
            console.error(`❌ Error al actualizar plantilla: ${updateError.message}`);
            errorCount++;
            continue;
          }
          
          console.log(`✅ Plantilla actualizada correctamente.`);
          fixedCount++;
        } else {
          console.log(`✅ [SIMULACIÓN] Cambios que se aplicarían:`);
          console.log(`   - initialMessage: "${message}"`);
          console.log(`   - greeting: "${message}"`);
          fixedCount++;
        }
      } else {
        console.log(`⚠️ No se pudo extraer mensaje del flujo.`);
        
        // Usar un mensaje por defecto
        const defaultMessage = "👋 Hola, soy el asistente virtual. ¿En qué puedo ayudarte hoy?";
        console.log(`   - Usando mensaje por defecto: "${defaultMessage}"`);
        
        // Actualizar la configuración
        config.initialMessage = defaultMessage;
        config.greeting = defaultMessage;
        
        // Guardar los cambios (si no estamos en modo dry-run)
        if (!isDryRun) {
          const { error: updateError } = await supabase
            .from('chatbot_templates')
            .update({ 
              config,
              updated_at: new Date().toISOString()
            })
            .eq('id', template.id);
          
          if (updateError) {
            console.error(`❌ Error al actualizar plantilla: ${updateError.message}`);
            errorCount++;
            continue;
          }
          
          console.log(`✅ Plantilla actualizada con mensaje por defecto.`);
          fixedCount++;
        } else {
          console.log(`✅ [SIMULACIÓN] Cambios que se aplicarían:`);
          console.log(`   - initialMessage: "${defaultMessage}"`);
          console.log(`   - greeting: "${defaultMessage}"`);
          fixedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error al procesar plantilla ${template.id}: ${error}`);
      errorCount++;
    }
  }
  
  // Resumen
  console.log(`\n======================================`);
  console.log(`Resumen de la ejecución${isDryRun ? ' (SIMULACIÓN)' : ''}:`);
  console.log(`- Total de plantillas procesadas: ${templates.length}`);
  console.log(`- Plantillas arregladas: ${fixedCount}`);
  console.log(`- Plantillas omitidas: ${skippedCount}`);
  console.log(`- Errores: ${errorCount}`);
  console.log(`======================================`);
}

// Ejecutar el script
main()
  .catch(error => {
    console.error('Error general en el script:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Script finalizado.');
    process.exit(0);
  });