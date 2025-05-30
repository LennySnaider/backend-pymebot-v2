#!/usr/bin/env node

/**
 * test-new-nodes-simple.js
 * 
 * Script simple para verificar que los nuevos casos están implementados en templateConverter.ts
 */

const fs = require('fs');
const path = require('path');

function testNodesImplementation() {
  try {
    console.log('🧪 Verificando implementación de nuevos nodos en templateConverter.ts...\n');
    
    const templateConverterPath = path.join(__dirname, 'src/services/templateConverter.ts');
    
    if (!fs.existsSync(templateConverterPath)) {
      console.error('❌ No se encontró templateConverter.ts');
      return false;
    }
    
    const fileContent = fs.readFileSync(templateConverterPath, 'utf8');
    
    // Verificar casos implementados
    const nodesToCheck = [
      { name: 'categories', patterns: ['case \'categories\':', 'case \'categoriesNode\':', 'case \'categories-node\':'] },
      { name: 'products', patterns: ['case \'products\':', 'case \'productsNode\':', 'case \'products-node\':'] },
      { name: 'check-availability', patterns: ['case \'check-availability\':', 'case \'checkAvailabilityNode\':', 'case \'check-availability-node\':'] }
    ];
    
    console.log('📋 Verificando casos implementados:\n');
    
    let allImplemented = true;
    
    nodesToCheck.forEach(node => {
      const isImplemented = node.patterns.some(pattern => fileContent.includes(pattern));
      
      if (isImplemented) {
        console.log(`✅ ${node.name}: IMPLEMENTADO`);
        
        // Buscar el código del caso para mostrar un extracto
        const startIndex = fileContent.indexOf(`case '${node.name}':`);
        if (startIndex !== -1) {
          const endIndex = fileContent.indexOf('break;', startIndex);
          const caseCode = fileContent.substring(startIndex, endIndex + 6);
          const lines = caseCode.split('\n').slice(0, 5); // Primeras 5 líneas
          console.log(`   Extracto del código:`);
          lines.forEach(line => {
            if (line.trim()) {
              console.log(`   ${line.trim()}`);
            }
          });
        }
      } else {
        console.log(`❌ ${node.name}: NO IMPLEMENTADO`);
        allImplemented = false;
      }
      console.log('');
    });
    
    // Verificar funciones específicas mencionadas en el contexto
    console.log('🔍 Verificando funciones adicionales:\n');
    
    const additionalChecks = [
      { name: 'createSalesFunnelCallback', pattern: 'createSalesFunnelCallback' },
      { name: 'buildFlowChain', pattern: 'function buildFlowChain' },
      { name: 'processNodeDirectly', pattern: 'async function processNodeDirectly' }
    ];
    
    additionalChecks.forEach(check => {
      const exists = fileContent.includes(check.pattern);
      console.log(`${exists ? '✅' : '❌'} ${check.name}: ${exists ? 'PRESENTE' : 'AUSENTE'}`);
    });
    
    console.log('\n📊 Análisis de estadísticas:');
    console.log(`- Tamaño del archivo: ${(fs.statSync(templateConverterPath).size / 1024).toFixed(2)} KB`);
    console.log(`- Líneas de código: ${fileContent.split('\n').length}`);
    console.log(`- Casos switch encontrados: ${(fileContent.match(/case '/g) || []).length}`);
    
    return allImplemented;
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error.message);
    return false;
  }
}

// Verificar problemas de conectividad
function checkConnectivityIssues() {
  console.log('\n🌐 Analizando posibles problemas de conectividad:\n');
  
  const configPath = path.join(__dirname, 'src/config/index.ts');
  
  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    console.log('📋 Configuración de Supabase detectada:');
    if (configContent.includes('SUPABASE_URL')) {
      console.log('✅ Variable SUPABASE_URL configurada');
    } else {
      console.log('❌ Variable SUPABASE_URL no encontrada');
    }
    
    if (configContent.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      console.log('✅ Variable SUPABASE_SERVICE_ROLE_KEY configurada'); 
    } else {
      console.log('❌ Variable SUPABASE_SERVICE_ROLE_KEY no encontrada');
    }
  }
  
  // Verificar optimizaciones en supabase.ts
  const supabasePath = path.join(__dirname, 'src/services/supabase.ts');
  if (fs.existsSync(supabasePath)) {
    const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
    
    console.log('\n🔧 Optimizaciones de conectividad:');
    console.log(`${supabaseContent.includes('AbortSignal.timeout') ? '✅' : '❌'} Timeout configurado`);
    console.log(`${supabaseContent.includes('templateCache') ? '✅' : '❌'} Cache implementado`);
    console.log(`${supabaseContent.includes('fallback') ? '✅' : '❌'} Fallback disponible`);
  }
}

// Sugerir pruebas
function suggestTests() {
  console.log('\n💡 Sugerencias para probar el sistema:\n');
  
  console.log('1. Prueba de API simple:');
  console.log('   curl -X POST http://localhost:3090/api/chat \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"message": "hola", "userId": "test-user", "tenantId": "test-tenant"}\'');
  
  console.log('\n2. Verificar que el servidor responde:');
  console.log('   curl http://localhost:3090/health || echo "Servidor no disponible"');
  
  console.log('\n3. Probar carga de plantillas:');
  console.log('   curl http://localhost:3090/api/templates || echo "Endpoint de plantillas no responde"');
  
  console.log('\n4. Verificar logs del servidor:');
  console.log('   npm run dev (y buscar errores de Supabase)');
}

// Ejecutar todas las verificaciones
console.log('🚀 Verificación completa del sistema - Nuevos nodos y conectividad\n');

const implementationOk = testNodesImplementation();
checkConnectivityIssues(); 
suggestTests();

console.log('\n' + '='.repeat(60));
if (implementationOk) {
  console.log('🎉 RESULTADO: Los nuevos nodos están correctamente implementados');
  console.log('   - Los casos para categories, products y check-availability están presentes');
  console.log('   - El templateConverter.ts tiene la estructura esperada');
} else {
  console.log('⚠️  RESULTADO: Hay problemas en la implementación');
  console.log('   - Algunos nodos no están implementados correctamente');
}

console.log('\n🔧 PRÓXIMOS PASOS:');
console.log('   1. Iniciar el servidor: npm run dev');
console.log('   2. Probar conectividad con las sugerencias de arriba');
console.log('   3. Verificar logs para problemas específicos de Supabase');
console.log('='.repeat(60));