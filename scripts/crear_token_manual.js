/**
 * scripts/crear_token_manual.js
 * 
 * Script para crear manualmente un token JWT para pruebas.
 * Este enfoque evita la necesidad de autenticación en Supabase.
 * @version 1.0.0
 * @updated 2025-04-26
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Para usar __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para codificar a base64 URL-safe
function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Función para crear un token JWT simple para pruebas
function crearTokenJWT() {
  // 1. Crear el encabezado
  const header = {
    alg: 'HS256', // Algoritmo de firma
    typ: 'JWT'    // Tipo de token
  };
  
  // 2. Crear el payload (datos)
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'user-test-id',                 // ID del usuario (puede ser cualquier identificador)
    email: 'test@example.com',           // Email (puede cambiarse)
    role: 'super_admin',                 // Rol para pruebas
    tenant_id: 'test-tenant',            // ID del tenant para pruebas
    iat: ahora,                          // Issued At (emitido en)
    exp: ahora + 24 * 60 * 60,           // Expires (expira en 24 horas)
    iss: 'supabase',                     // Issuer (emisor)
    jti: crypto.randomBytes(16).toString('hex') // ID único del token
  };
  
  // 3. Codificar encabezado y payload
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  
  // 4. Crear la firma (para un token de prueba, usamos una clave simple)
  const secretKey = 'test-jwt-secret-key-for-development-only';
  const data = `${headerEncoded}.${payloadEncoded}`;
  const signature = crypto.createHmac('sha256', secretKey)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // 5. Crear el token completo
  const token = `${headerEncoded}.${payloadEncoded}.${signature}`;
  
  return {
    token,
    headerDecoded: header,
    payloadDecoded: payload
  };
}

/**
 * Función principal
 */
function ejecutar() {
  console.log('🔨 Creando token JWT manual para pruebas...');
  
  const { token, headerDecoded, payloadDecoded } = crearTokenJWT();
  
  console.log('\n✅ Token JWT creado exitosamente!');
  
  // Mostrar información del token
  console.log('\n📋 INFORMACIÓN DEL TOKEN:');
  console.log('Header:', JSON.stringify(headerDecoded, null, 2));
  console.log('Payload:', JSON.stringify(payloadDecoded, null, 2));
  
  // Mostrar el token completo
  console.log('\n🔤 TOKEN COMPLETO:');
  console.log('------------------------------------------------------');
  console.log(token);
  console.log('------------------------------------------------------');
  
  // Guardar el token para uso posterior
  const tokenInfo = {
    access_token: token,
    refresh_token: null,
    user_id: payloadDecoded.sub,
    email: payloadDecoded.email,
    role: payloadDecoded.role,
    tenant_id: payloadDecoded.tenant_id,
    expires_at: new Date(payloadDecoded.exp * 1000).toISOString(),
    note: 'Este es un token creado manualmente para pruebas, NO es un token de Supabase real'
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'manual_token.json'), 
    JSON.stringify(tokenInfo, null, 2)
  );
  
  console.log('\n💾 Token guardado en:', path.join(__dirname, 'manual_token.json'));
  
  // Instrucciones para usar el token
  console.log('\n📝 PARA USAR ESTE TOKEN EN TUS PRUEBAS:');
  console.log('1. Edita los scripts de prueba y reemplaza las constantes AUTH_TOKEN y SUPER_ADMIN_TOKEN:');
  console.log(`const AUTH_TOKEN = '${token}';`);
  console.log(`const SUPER_ADMIN_TOKEN = '${token}';`);
  console.log(`const TEST_TENANT_ID = '${payloadDecoded.tenant_id}';`);
  
  console.log('\n⚠️ IMPORTANTE: Este token es solo para pruebas y desarrollo');
  console.log('   Para que funcione, debes modificar el middleware de autenticación en tu API');
  console.log('   para aceptar este token de prueba cuando estás en modo desarrollo.');
  
  // Sugerencia para modificar el middleware de autenticación
  console.log('\n📝 AJUSTES NECESARIOS EN TU API:');
  console.log('1. Localiza tu middleware de autenticación (auth.ts o similar)');
  console.log('2. Añade esta condición para entorno de desarrollo:');
  console.log(`
// Verificación especial para token de prueba en desarrollo
if (process.env.NODE_ENV === 'development' && 
    req.headers.authorization?.startsWith('Bearer ey') && 
    req.headers.authorization.includes('.')) {
  // Para propósitos de prueba, aceptamos el token sin verificar la firma
  try {
    const token = req.headers.authorization.split(' ')[1];
    const [_, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
    
    // Asignar información del usuario desde el payload
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenant_id
    };
    
    return next();
  } catch (error) {
    console.error('Error al procesar token de prueba:', error);
  }
}
`);
  
  console.log('\n3. Ejecuta tu API en modo desarrollo:');
  console.log('NODE_ENV=development npm run dev');
  
  console.log('\n🧪 Después de estos ajustes, ejecuta tus pruebas normalmente.');
}

// Ejecutar la función principal
ejecutar();
