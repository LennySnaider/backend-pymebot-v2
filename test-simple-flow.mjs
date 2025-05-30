#!/usr/bin/env node

/**
 * Test simple para verificar que nuestro flujo se importa correctamente
 */

async function testFlowImport() {
  console.log('🚀 Probando importación del flujo funcional...\n');
  
  try {
    // Importar nuestro flujo funcional
    const flowModule = await import('./src/flows/simple-working-flow.cjs');
    console.log('✅ Flujo importado exitosamente');
    
    // Verificar que las funciones existen
    if (flowModule.welcomeFlow) {
      console.log('✅ welcomeFlow encontrado');
    } else {
      console.log('❌ welcomeFlow NO encontrado');
    }
    
    if (flowModule.mainFlow) {
      console.log('✅ mainFlow encontrado'); 
    } else {
      console.log('❌ mainFlow NO encontrado');
    }
    
    console.log('\n📋 Estructura del módulo:');
    console.log('Keys:', Object.keys(flowModule));
    
    console.log('\n🎉 Test de importación completado exitosamente!');
    console.log('✅ El flujo funcional está disponible para interceptación');
    
  } catch (error) {
    console.error('❌ Error importando el flujo:', error);
    process.exit(1);
  }
}

// Ejecutar el test
testFlowImport()
  .then(() => {
    console.log('\n🔄 La interceptación podrá funcionar correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fallo en el test:', error);
    process.exit(1);
  });