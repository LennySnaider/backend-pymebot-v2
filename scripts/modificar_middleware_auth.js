/**
 * scripts/modificar_middleware_auth.js
 * 
 * Script para modificar el middleware de autenticación para aceptar tokens de prueba.
 * Este script busca y modifica el middleware de autenticación para desarrollo.
 * @version 1.0.0
 * @updated 2025-04-26
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para usar __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas posibles del middleware de autenticación
const posiblesRutas = [
  path.join(__dirname, '..', 'src', 'middlewares', 'auth.ts'),
  path.join(__dirname, '..', 'src', 'middlewares', 'auth.js'),
  path.join(__dirname, '..', 'src', 'middleware', 'auth.ts'),
  path.join(__dirname, '..', 'src', 'middleware', 'auth.js'),
  path.join(__dirname, '..', 'middlewares', 'auth.ts'),
  path.join(__dirname, '..', 'middlewares', 'auth.js'),
  path.join(__dirname, '..', 'middleware', 'auth.ts'),
  path.join(__dirname, '..', 'middleware', 'auth.js'),
];

// Código para añadir al middleware
const codigoParaAñadir = `
  // Verificación especial para token de prueba en desarrollo (añadido automáticamente)
  if (process.env.NODE_ENV !== 'production' && 
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
      
      console.log('⚠️ USANDO TOKEN DE PRUEBA:', req.user);
      return next();
    } catch (error) {
      console.error('Error al procesar token de prueba:', error);
    }
  }
`;

/**
 * Busca el middleware de autenticación y lo modifica
 */
function modificarMiddleware() {
  console.log('🔍 Buscando el middleware de autenticación...');
  
  // Buscar el archivo de middleware
  let rutaEncontrada = null;
  for (const ruta of posiblesRutas) {
    if (fs.existsSync(ruta)) {
      rutaEncontrada = ruta;
      break;
    }
  }
  
  if (!rutaEncontrada) {
    console.error('❌ No se encontró el archivo de middleware de autenticación');
    console.log('\n🔍 Archivos buscados:');
    for (const ruta of posiblesRutas) {
      console.log(`   ${ruta}`);
    }
    
    console.log('\n📝 OPCIONES:');
    console.log('1. Crea manualmente el middleware o modifica el existente');
    console.log('2. Busca el middleware en otra ubicación y modifícalo manualmente');
    console.log('3. Especifica la ruta exacta del middleware:');
    console.log('   node scripts/modificar_middleware_auth.js [ruta-al-middleware]');
    return;
  }
  
  // Leer el archivo
  console.log(`✅ Middleware encontrado en: ${rutaEncontrada}`);
  const contenido = fs.readFileSync(rutaEncontrada, 'utf8');
  
  // Verificar si ya contiene el código
  if (contenido.includes('Verificación especial para token de prueba')) {
    console.log('✅ El middleware ya ha sido modificado para aceptar tokens de prueba');
    return;
  }
  
  // Encontrar el lugar para insertar el código
  const lineas = contenido.split('\n');
  let punto_insercion = -1;
  
  // Buscar patrón común en middleware de autenticación
  for (let i = 0; i < lineas.length; i++) {
    // Buscar el inicio del middleware de autenticación
    if (lineas[i].includes('authMiddleware') || 
        lineas[i].includes('auth(') || 
        lineas[i].includes('authenticate(') ||
        lineas[i].includes('function auth') ||
        lineas[i].includes('verifyToken')) {
      
      // Buscar el punto donde se inicia la verificación del token
      for (let j = i; j < Math.min(i + 30, lineas.length); j++) {
        if (lineas[j].includes('if (') && 
            (lineas[j].includes('authorization') || lineas[j].includes('token'))) {
          punto_insercion = j;
          break;
        }
      }
      
      if (punto_insercion > 0) break;
    }
  }
  
  // Si no encontramos un punto específico, intentamos encontrar el next()
  if (punto_insercion < 0) {
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].includes('next()') || lineas[i].includes('return next')) {
        punto_insercion = i;
        break;
      }
    }
  }
  
  // Si aún no encontramos, usamos simplemente el principio del archivo
  if (punto_insercion < 0) {
    console.warn('⚠️ No se pudo determinar automáticamente dónde insertar el código');
    console.log('   Se hará una copia de seguridad y se insertará al principio');
    punto_insercion = 10; // Insertar después de posibles imports
  }
  
  // Hacer una copia de seguridad
  const rutaBackup = `${rutaEncontrada}.backup`;
  fs.writeFileSync(rutaBackup, contenido);
  console.log(`📦 Copia de seguridad creada en: ${rutaBackup}`);
  
  // Insertar el código
  lineas.splice(punto_insercion, 0, codigoParaAñadir);
  const nuevoContenido = lineas.join('\n');
  fs.writeFileSync(rutaEncontrada, nuevoContenido);
  
  console.log('✅ Middleware modificado correctamente para aceptar tokens de prueba');
  console.log('\n⚠️ IMPORTANTE: Esta modificación es solo para desarrollo y pruebas');
  console.log('   No uses esta configuración en producción');
  
  console.log('\n🚀 PRÓXIMOS PASOS:');
  console.log('1. Crea un token de prueba: node scripts/crear_token_manual.js');
  console.log('2. Ejecuta tu API en modo desarrollo: NODE_ENV=development npm run dev');
  console.log('3. Ejecuta tus pruebas con el token generado');
}

// Ejecutar con ruta personalizada si se proporciona
if (process.argv.length > 2) {
  const rutaPersonalizada = process.argv[2];
  if (fs.existsSync(rutaPersonalizada)) {
    posiblesRutas.unshift(rutaPersonalizada);
  } else {
    console.error(`❌ La ruta proporcionada no existe: ${rutaPersonalizada}`);
  }
}

// Ejecutar la función principal
modificarMiddleware();
