/**
 * scripts/actualizar_tokens_prueba.js
 *
 * Script para actualizar los tokens en los scripts de prueba.
 * Lee el token manual guardado y actualiza los scripts de prueba automáticamente.
 * @version 1.0.1
 * @updated 2025-04-26
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Para usar __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas de archivos
const MANUAL_TOKEN_FILE = path.join(__dirname, "manual_token.json");
// const SUPABASE_TOKEN_FILE = path.join(__dirname, 'supabase_token.json');
const TEST_SCRIPT = path.join(
  __dirname,
  "..",
  "tests",
  "test_constructor_visual.js"
);
const LOAD_SCRIPT = path.join(__dirname, "cargar_flujo_constructor_visual.js");

/**
 * Lee el token guardado
 */
function leerTokenGuardado() {
  try {
    // Primero intentamos leer desde manual_token.json
    if (fs.existsSync(MANUAL_TOKEN_FILE)) {
      console.log(`✅ Usando token manual de: ${MANUAL_TOKEN_FILE}`);
      return JSON.parse(fs.readFileSync(MANUAL_TOKEN_FILE, "utf8"));
    }

    // Si no existe, intentamos leer desde supabase_token.json
    if (fs.existsSync(SUPABASE_TOKEN_FILE)) {
      console.log(`✅ Usando token de Supabase de: ${SUPABASE_TOKEN_FILE}`);
      return JSON.parse(fs.readFileSync(SUPABASE_TOKEN_FILE, "utf8"));
    }

    console.error(`❌ No se encontró ningún archivo de token`);
    console.error(`   Ejecuta primero: node scripts/crear_token_manual.js`);
    return null;
  } catch (error) {
    console.error("❌ Error al leer el archivo de token:", error.message);
    return null;
  }
}

/**
 * Actualiza un script con el token y tenant ID
 */
function actualizarScript(filePath, tokenData) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Archivo de script no encontrado: ${filePath}`);
      return false;
    }

    let contenido = fs.readFileSync(filePath, "utf8");

    // Actualizar tokens
    contenido = contenido.replace(
      /const AUTH_TOKEN = ['"].*['"]/g,
      `const AUTH_TOKEN = '${tokenData.access_token}'`
    );

    contenido = contenido.replace(
      /const SUPER_ADMIN_TOKEN = ['"].*['"]/g,
      `const SUPER_ADMIN_TOKEN = '${tokenData.access_token}'`
    );

    // Actualizar tenant ID si está disponible
    if (tokenData.tenant_id) {
      contenido = contenido.replace(
        /const TEST_TENANT_ID = ['"].*['"]/g,
        `const TEST_TENANT_ID = '${tokenData.tenant_id}'`
      );
    }

    // Guardar cambios
    fs.writeFileSync(filePath, contenido, "utf8");
    return true;
  } catch (error) {
    console.error(
      `❌ Error al actualizar el script ${filePath}:`,
      error.message
    );
    return false;
  }
}

/**
 * Función principal
 */
function actualizarTokensEnScripts() {
  console.log("🔄 Actualizando tokens en scripts de prueba...");

  // Leer token guardado
  const tokenData = leerTokenGuardado();
  if (!tokenData) {
    return;
  }

  // Actualizar scripts
  const scriptsPaths = [TEST_SCRIPT, LOAD_SCRIPT];

  for (const scriptPath of scriptsPaths) {
    const nombreArchivo = path.basename(scriptPath);
    if (actualizarScript(scriptPath, tokenData)) {
      console.log(`✅ Token actualizado en: ${nombreArchivo}`);
    } else {
      console.error(`❌ No se pudo actualizar: ${nombreArchivo}`);
    }
  }

  console.log("\n📝 AHORA PUEDES:");
  console.log(
    "1. Ejecutar tu API en modo desarrollo: NODE_ENV=development npm run dev"
  );
  console.log("2. Ejecutar las pruebas: node tests/test_constructor_visual.js");
  console.log(
    "3. Cargar un flujo de ejemplo: node scripts/cargar_flujo_constructor_visual.js --activate"
  );

  // Advertencia sobre la expiración del token
  if (tokenData.expires_at) {
    const expirationDate = new Date(tokenData.expires_at);
    const now = new Date();
    const hoursRemaining = Math.round(
      (expirationDate - now) / (1000 * 60 * 60)
    );

    console.log(
      `\n⚠️  IMPORTANTE: El token expira ${
        hoursRemaining > 0
          ? `en aproximadamente ${hoursRemaining} horas`
          : "PRONTO o YA HA EXPIRADO"
      }`
    );
    console.log(
      "   Si las pruebas fallan, obtén un nuevo token ejecutando: node scripts/crear_token_manual.js"
    );
  }
}

// Ejecutar la función principal
actualizarTokensEnScripts();
