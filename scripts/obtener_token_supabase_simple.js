/**
 * scripts/obtener_token_supabase_simple.js
 *
 * Versión simplificada del script para obtener token JWT de Supabase.
 * Introduce directamente tus credenciales en este archivo.
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

// ============= CONFIGURA ESTAS VARIABLES =============
// Introduce tus credenciales directamente aquí:
const SUPABASE_URL = "https://gyslfajscteoqhxefudu.supabase.co"; // URL de tu proyecto Supabase
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5c2xmYWpzY3Rlb3FoeGVmdWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0ODM0NTAsImV4cCI6MjA1NjA1OTQ1MH0.G7oSIhK8qxZV3-Mp8oiQ2cdBuMnXcvQp64Di4r9SOwU"; // Clave anónima de tu proyecto
const EMAIL = "lenny_snaiderman@yahoo.com"; // Tu email registrado en Supabase
const PASSWORD = "Pymepass2025!"; // Tu contraseña
// ===================================================

// Crear cliente de Supabase con las credenciales proporcionadas
console.log(`🔐 Conectando a Supabase en: ${SUPABASE_URL}`);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Obtiene un token de sesión válido iniciando sesión en Supabase
 */
async function obtenerTokenSesion() {
  try {
    console.log(`📧 Iniciando sesión como ${EMAIL}...`);

    // Mostrar más información sobre la solicitud para depuración
    console.log("📝 Datos que se enviarán:");
    console.log("- Email:", EMAIL);
    console.log("- Password:", PASSWORD ? "********" : "(vacío)");

    // Iniciar sesión con email y contraseña
    const { data, error } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });

    if (error) {
      // Mostrar información detallada del error
      console.error("\n❌ Error detallado:");
      console.error(JSON.stringify(error, null, 2));
      throw error;
    }

    if (!data || !data.session) {
      throw new Error(
        "No se recibió sesión de Supabase aunque no hubo error reportado"
      );
    }

    // Extraer token de acceso y token de actualización
    const { access_token, refresh_token } = data.session;

    console.log("\n✅ Inicio de sesión exitoso!");
    console.log("🔑 TOKEN OBTENIDO!");

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
      console.log("ID de usuario:", decodedPayload.sub);
      console.log("Rol:", decodedPayload.role);
      console.log("Email:", decodedPayload.email);
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
        email: decodedPayload.email,
        role: decodedPayload.role,
        tenant_id: decodedPayload.tenant_id,
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

      console.log("\n🔤 TOKEN COMPLETO (copia esto para usar en tus pruebas):");
      console.log("------------------------------------------------------");
      console.log(access_token);
      console.log("------------------------------------------------------");

      // Para facilitar la actualización de los scripts
      console.log("\n📝 PARA ACTUALIZAR SCRIPTS AUTOMÁTICAMENTE:");
      console.log("node scripts/actualizar_tokens_prueba.js");
    } catch (decodeErr) {
      console.warn("No se pudo decodificar el token:", decodeErr);
      // Al menos mostramos el token para que el usuario pueda usarlo
      console.log("\n🔤 TOKEN COMPLETO:");
      console.log(access_token);
    }

    return access_token;
  } catch (error) {
    console.error("\n❌ Error al iniciar sesión:", error.message);

    console.log("\n🔍 POSIBLES SOLUCIONES:");
    console.log("1. Verifica que el email y contraseña sean correctos");
    console.log("2. Confirma que el usuario exista en el proyecto de Supabase");
    console.log(
      "3. Asegúrate que la URL y la clave anónima de Supabase sean correctas"
    );
    console.log(
      "4. Verifica si tu cuenta tiene alguna restricción (MFA, email sin verificar, etc.)"
    );
    console.log(
      "5. Intenta iniciar sesión directamente en la interfaz web de Supabase"
    );

    console.log("\n🧪 PARA PROBAR DIRECTAMENTE EN LA CONSOLA DE SUPABASE:");
    console.log(`
const { data, error } = await supabase.auth.signInWithPassword({
  email: '${EMAIL}',
  password: 'tu-contraseña'
})
console.log(data, error)
    `);

    return null;
  }
}

// Ejecutar función principal
obtenerTokenSesion();
