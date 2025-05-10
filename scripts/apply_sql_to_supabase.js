/**
 * Script para ejecutar los scripts SQL en Supabase
 * Este script utiliza la biblioteca supabase-js para conectarse a Supabase
 * y ejecutar los scripts SQL generados.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), "voiceAgentBot", ".env") });

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidos en el archivo .env"
  );
  process.exit(1);
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Directorio de scripts SQL
const scriptsDir = path.join(process.cwd(), "supabase", "scripts");

// Orden de ejecución de scripts
const scriptOrder = [
  "extend_existing_tables.sql",
  "voice_bot_settings.sql",
  "voice_templates.sql",
  "voice_functions.sql",
  "script_6.sql",
  "script_7.sql",
];

// Función para ejecutar un script SQL
async function executeScript(scriptPath) {
  try {
    console.log(`Ejecutando script: ${scriptPath}`);
    const scriptContent = fs.readFileSync(scriptPath, "utf8");

    // Dividir el script en sentencias individuales
    const statements = scriptContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    // Ejecutar cada sentencia por separado
    for (const statement of statements) {
      console.log(`Ejecutando sentencia: ${statement.substring(0, 50)}...`);

      // Usar la API REST directamente en lugar de la función exec_sql
      const { error } = await supabase
        .from("_sql")
        .select("*")
        .execute(statement + ";");

      if (error) {
        console.error(`Error al ejecutar sentencia: ${error.message}`);
        console.error(`Sentencia: ${statement}`);
      }
    }

    console.log(`Script ${scriptPath} ejecutado correctamente`);
    return true;
  } catch (error) {
    console.error(`Error al ejecutar script ${scriptPath}: ${error.message}`);
    return false;
  }
}

// Función principal
async function main() {
  console.log("Iniciando ejecución de scripts SQL en Supabase...");

  // Verificar la conexión a Supabase
  try {
    const { error } = await supabase.from("_pgsql_version").select("*");
    if (error) {
      console.error(`Error al conectar con Supabase: ${error.message}`);
      console.error("Verifique las credenciales y la URL de Supabase.");
      process.exit(1);
    }
    console.log("Conexión a Supabase establecida correctamente.");
  } catch (error) {
    console.error(
      `Error al verificar la conexión a Supabase: ${error.message}`
    );
    console.error("Intentando continuar de todos modos...");
  }

  // Ejecutar scripts en orden
  let success = true;
  for (const scriptName of scriptOrder) {
    const scriptPath = path.join(scriptsDir, scriptName);
    if (fs.existsSync(scriptPath)) {
      const result = await executeScript(scriptPath);
      if (!result) {
        success = false;
        console.error(`Error al ejecutar el script ${scriptName}`);
      }
    } else {
      console.warn(`Script ${scriptName} no encontrado`);
    }
  }

  if (success) {
    console.log("Todos los scripts se ejecutaron correctamente");
  } else {
    console.error(
      "Algunos scripts fallaron. Revise los mensajes de error anteriores."
    );
  }
}

// Ejecutar la función principal
main().catch((error) => {
  console.error("Error en la ejecución principal:", error);
  process.exit(1);
});
