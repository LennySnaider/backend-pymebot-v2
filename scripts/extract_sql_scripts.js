/**
 * Script para extraer los scripts SQL de los archivos Markdown
 * y guardarlos en archivos .sql separados.
 */

import fs from "fs";
import path from "path";

// Rutas de los archivos
const voiceExtensionsPath = path.join(
  process.cwd(),
  "voiceAgentBot",
  "docs",
  "supabase_voice_extensions.md"
);
const outputDir = path.join(process.cwd(), "supabase", "scripts");

// Crear directorio de salida si no existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Leer el archivo Markdown
const markdownContent = fs.readFileSync(voiceExtensionsPath, "utf8");

// Expresión regular para extraer bloques de código SQL
const sqlBlockRegex = /```sql\n([\s\S]*?)```/g;

// Extraer y guardar los scripts SQL
let match;
let scriptCount = 0;

while ((match = sqlBlockRegex.exec(markdownContent)) !== null) {
  scriptCount++;
  const sqlContent = match[1].trim();

  // Determinar el nombre del archivo basado en el contenido
  let fileName = `script_${scriptCount}.sql`;

  // Intentar extraer un nombre más descriptivo del contenido
  if (sqlContent.includes("voice_bot_settings")) {
    fileName = "voice_bot_settings.sql";
  } else if (sqlContent.includes("voice_templates")) {
    fileName = "voice_templates.sql";
  } else if (sqlContent.includes("ALTER TABLE chatbot_templates")) {
    fileName = "extend_existing_tables.sql";
  } else if (sqlContent.includes("CREATE POLICY")) {
    fileName = "voice_policies.sql";
  } else if (sqlContent.includes("log_voice_service_usage")) {
    fileName = "voice_functions.sql";
  }

  // Guardar el script SQL
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, sqlContent);
  console.log(`Script SQL guardado en: ${outputPath}`);
}

console.log(`Total de scripts SQL extraídos: ${scriptCount}`);
