/**
 * Script para generar un único archivo SQL combinado
 * que el usuario puede ejecutar manualmente en la interfaz de SQL de Supabase.
 */

import fs from "fs";
import path from "path";

// Directorio de scripts SQL
const scriptsDir = path.join(process.cwd(), "supabase", "scripts");

// Directorio de salida
const outputDir = path.join(process.cwd(), "supabase");
const outputFile = path.join(outputDir, "combined_voice_extensions.sql");

// Orden de ejecución de scripts
const scriptOrder = [
  "extend_existing_tables.sql",
  "voice_bot_settings.sql",
  "voice_templates.sql",
  "voice_functions.sql",
  "script_6.sql",
  "script_7.sql",
];

// Función para combinar los scripts SQL
function combineScripts() {
  console.log("Combinando scripts SQL...");

  let combinedContent = `-- Script SQL combinado para extensiones de voz en Supabase
-- Generado automáticamente el ${new Date().toISOString()}
-- Este script debe ejecutarse manualmente en la interfaz de SQL de Supabase

BEGIN;

`;

  // Agregar cada script en orden
  for (const scriptName of scriptOrder) {
    const scriptPath = path.join(scriptsDir, scriptName);
    if (fs.existsSync(scriptPath)) {
      console.log(`Agregando script: ${scriptName}`);
      const scriptContent = fs.readFileSync(scriptPath, "utf8");

      combinedContent += `-- ========================================
-- Inicio de ${scriptName}
-- ========================================

${scriptContent}

`;
    } else {
      console.warn(`Script ${scriptName} no encontrado`);
    }
  }

  // Agregar commit al final
  combinedContent += `COMMIT;

-- Fin del script combinado
`;

  // Guardar el archivo combinado
  fs.writeFileSync(outputFile, combinedContent);
  console.log(`Script combinado guardado en: ${outputFile}`);
}

// Ejecutar la función principal
try {
  combineScripts();
  console.log("Proceso completado con éxito");
} catch (error) {
  console.error("Error en la ejecución principal:", error);
  process.exit(1);
}
