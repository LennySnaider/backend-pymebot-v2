/**
 * scripts/obtener_token_supabase.js
 *
 * Script para obtener un token JWT válido desde Supabase.
 * Utiliza el cliente de Supabase para iniciar sesión y obtener un token de sesión.
 * @version 1.0.0
 * @updated 2025-04-26
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Para usar __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Obtener valores de configuración desde el archivo .env (si existe) o usar valores predeterminados
let supabaseUrl = "https://gyslfajscteoqhxefudu.supabase.co";
let supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0ODM0NTAsImV4cCI6MjA1NjA1OTQ1MH0.G7oSIhK8qxZV3-Mp8oiQ2cdBuMnXcvQp64Di4r9SOwU";
let adminEmail = "lenny_snaiderman@yahoo.com";
let adminPassword = "Pymepass2025!";

// Intentar cargar desde config.js si el archivo existe (sin require para módulos ES)
try {
  // Importación dinámica para ES modules
  const configModule = await import("../src/config.js");
  const config = configModule.default || configModule.config || configModule;

  // Usar valores del config si están definidos y no están ya definidos por variables de entorno
  supabaseUrl = supabaseUrl || config.supabase?.url;
  supabaseAnonKey = supabaseAnonKey || config.supabase?.anonKey;

  console.log("Configuración cargada desde config.js");
} catch (err) {
  console.log(
    "No se pudo cargar config.js, usando variables de entorno o valores predeterminados"
  );
}

// Solicitar valores que falten
if (!supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword) {
  console.log(
    "Por favor ingresa la información necesaria para conectarte a Supabase:"
  );
  console.log(
    "✉️  Para obtener el URL y la clave anónima, inicia sesión en el dashboard de Supabase"
  );
  console.log("   y ve a Project Settings > API");

  // Aquí normalmente usaríamos un módulo como 'readline' o 'prompt'
  // para solicitar esta información, pero por simplicidad usaremos
  // valores de ejemplo y comentaremos instrucciones para el usuario

  supabaseUrl = supabaseUrl || "https://tu-proyecto.supabase.co";
  supabaseAnonKey = supabaseAnonKey || "tu-anon-key";
  adminEmail = adminEmail || "super_admin@example.com";
  adminPassword = adminPassword || "password-segura";

  console.log(
    "\n⚠️  IMPORTANTE: Reemplaza los siguientes valores en el script:"
  );
  console.log(`SUPABASE_URL='${supabaseUrl}'`);
  console.log(`SUPABASE_ANON_KEY='${supabaseAnonKey}'`);
  console.log(`ADMIN_EMAIL='${adminEmail}'`);
  console.log(`ADMIN_PASSWORD='${adminPassword}'`);
  console.log("\nO pásalos como variables de entorno al ejecutar el script:");
  console.log(
    "SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx ADMIN_EMAIL=xxx ADMIN_PASSWORD=xxx node scripts/obtener_token_supabase.js"
  );
}

// Crear cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Obtiene un token de sesión válido iniciando sesión en Supabase
 */
async function obtenerTokenSesion() {
  try {
    console.log(`Iniciando sesión como ${adminEmail}...`);

    // Iniciar sesión con email y contraseña
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (error) {
      throw error;
    }

    if (!data || !data.session) {
      throw new Error("No se recibió sesión de Supabase");
    }

    // Extraer token de acceso y token de actualización
    const { access_token, refresh_token } = data.session;

    console.log("\n✅ Inicio de sesión exitoso!");
    console.log("\n🔑 ACCESS TOKEN (para usar en scripts de prueba):");
    console.log("------------------------------------------------------");
    console.log(access_token);
    console.log("------------------------------------------------------");

    // Extraer y mostrar información del token (sin verificar la firma)
    try {
      const [header, payload, _] = access_token.split(".");
      const decodedHeader = JSON.parse(
        Buffer.from(header, "base64").toString()
      );
      const decodedPayload = JSON.parse(
        Buffer.from(payload, "base64").toString()
      );

      console.log("\n📋 INFORMACIÓN DEL TOKEN:");
      console.log("Algoritmo:", decodedHeader.alg);
      console.log("Tipo:", decodedHeader.typ);
      console.log("ID de usuario:", decodedPayload.sub);
      console.log("Rol:", decodedPayload.role);
      console.log(
        "Emitido en:",
        new Date(decodedPayload.iat * 1000).toLocaleString()
      );
      console.log(
        "Expira en:",
        new Date(decodedPayload.exp * 1000).toLocaleString()
      );

      // Guardar para uso fácil
      const tokenInfo = {
        access_token,
        refresh_token,
        user_id: decodedPayload.sub,
        role: decodedPayload.role,
        expires_at: new Date(decodedPayload.exp * 1000).toISOString(),
      };

      // Guardar en un archivo para uso posterior
      fs.writeFileSync(
        path.join(__dirname, "supabase_token.json"),
        JSON.stringify(tokenInfo, null, 2)
      );

      console.log(
        "\n💾 Token guardado en:",
        path.join(__dirname, "supabase_token.json")
      );

      // Instrucciones para usar el token
      console.log("\n📝 INSTRUCCIONES:");
      console.log("1. Copia el ACCESS TOKEN mostrado arriba");
      console.log("2. Actualiza tus scripts de prueba con este token:");
      console.log(`
// En test_constructor_visual.js:
const AUTH_TOKEN = '${access_token.substring(
        0,
        10
      )}...'; // Reemplazar con el token completo
const SUPER_ADMIN_TOKEN = '${access_token.substring(
        0,
        10
      )}...'; // Reemplazar con el token completo
// Asegúrate de usar también un tenant ID válido:
const TEST_TENANT_ID = '${decodedPayload.tenant_id || "tenant-id-válido"}';`);

      // Ejemplo para probar el token
      console.log(`
// Para probar el token puedes ejecutar:
curl -H "Authorization: Bearer ${access_token.substring(
        0,
        10
      )}..." http://localhost:3090/api/flows`);
    } catch (decodeErr) {
      console.warn("No se pudo decodificar el token:", decodeErr);
    }

    return access_token;
  } catch (error) {
    console.error("❌ Error al iniciar sesión:", error.message);
    if (error.status) {
      console.error(`   Estado HTTP: ${error.status}`);
    }
    return null;
  }
}

// Ejecutar función principal
obtenerTokenSesion();
