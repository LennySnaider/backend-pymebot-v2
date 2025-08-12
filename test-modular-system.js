#!/usr/bin/env node

/**
 * SCRIPT DE TESTING PARA ARQUITECTURA MODULAR V1
 * 
 * Este script automatiza el testing del sistema modular completo
 * Incluye validaciones y métricas de funcionamiento
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 INICIANDO TEST DE ARQUITECTURA MODULAR V1\n');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  log(`\n${colors.bright}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Verificaciones del sistema
async function runSystemChecks() {
  header('VERIFICACIONES DEL SISTEMA');
  
  const checks = [
    {
      name: 'Verificar nodos modulares',
      check: () => {
        const nodes = [
          'src/flows/nodes/CategoriesFlow.ts',
          'src/flows/nodes/ProductsFlow.ts', 
          'src/flows/nodes/MessageFlow.ts',
          'src/flows/nodes/InputFlow.ts',
          'src/flows/nodes/ButtonsFlow.ts',
          'src/flows/nodes/index.ts'
        ];
        
        for (const node of nodes) {
          if (!fs.existsSync(node)) {
            return { success: false, message: `Archivo faltante: ${node}` };
          }
        }
        return { success: true, message: 'Todos los nodos modulares están presentes' };
      }
    },
    {
      name: 'Verificar mainFlow.ts',
      check: () => {
        const mainFlowPath = 'src/flows/mainFlow.ts';
        if (!fs.existsSync(mainFlowPath)) {
          return { success: false, message: 'mainFlow.ts no encontrado' };
        }
        
        const content = fs.readFileSync(mainFlowPath, 'utf8');
        const requiredFunctions = [
          'createMainFlow',
          'shouldUseModularFlow', 
          'getModularFlow'
        ];
        
        for (const func of requiredFunctions) {
          if (!content.includes(func)) {
            return { success: false, message: `Función faltante: ${func}` };
          }
        }
        
        return { success: true, message: 'mainFlow.ts está completo' };
      }
    },
    {
      name: 'Verificar integración templateConverter',
      check: () => {
        const converterPath = 'src/services/templateConverter.ts';
        if (!fs.existsSync(converterPath)) {
          return { success: false, message: 'templateConverter.ts no encontrado' };
        }
        
        const content = fs.readFileSync(converterPath, 'utf8');
        if (!content.includes('shouldUseModularFlow')) {
          return { success: false, message: 'templateConverter no integrado con arquitectura modular' };
        }
        
        return { success: true, message: 'templateConverter integrado correctamente' };
      }
    },
    {
      name: 'Verificar template de testing',
      check: () => {
        const templatePath = 'template-test-modular.json';
        if (!fs.existsSync(templatePath)) {
          return { success: false, message: 'Template de testing no encontrado' };
        }
        
        try {
          const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
          const requiredNodeTypes = ['message', 'input', 'buttons', 'categories', 'products'];
          const presentTypes = Object.values(template.nodes).map(node => node.type);
          
          for (const type of requiredNodeTypes) {
            if (!presentTypes.includes(type)) {
              return { success: false, message: `Tipo de nodo faltante en template: ${type}` };
            }
          }
          
          return { success: true, message: 'Template de testing válido' };
        } catch (e) {
          return { success: false, message: 'Template de testing malformado' };
        }
      }
    },
    {
      name: 'Verificar configuración de entorno',
      check: () => {
        if (!fs.existsSync('.env')) {
          return { success: false, message: 'Archivo .env no encontrado' };
        }
        
        return { success: true, message: 'Configuración de entorno presente' };
      }
    }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    try {
      const result = check.check();
      if (result.success) {
        success(`${check.name}: ${result.message}`);
      } else {
        error(`${check.name}: ${result.message}`);
        allPassed = false;
      }
    } catch (e) {
      error(`${check.name}: Error ejecutando verificación - ${e.message}`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

// Generar instrucciones de testing
function generateTestInstructions() {
  header('INSTRUCCIONES DE TESTING MANUAL');
  
  info('Para probar el sistema completo, sigue estos pasos:');
  
  log('\n1️⃣ INICIAR EL SERVIDOR:', 'bright');
  log('   cd /Users/lenny/Documents/pymebot-v2/backend-pymebot-v2-bk');
  log('   npm run dev');
  
  log('\n2️⃣ CARGAR TEMPLATE DE TESTING:', 'bright');
  log('   - El template está en: template-test-modular.json');
  log('   - Carga este template en tu sistema de plantillas');
  log('   - Asegúrate de que esté activo para testing');
  
  log('\n3️⃣ PROBAR VÍA WHATSAPP:', 'bright');
  log('   - Envía "hola" al bot de WhatsApp');
  log('   - Sigue el flujo completo paso a paso');
  log('   - Verifica que cada nodo funcione correctamente');
  
  log('\n4️⃣ FLUJO DE TESTING ESPERADO:', 'bright');
  log('   ✅ Mensaje de bienvenida');
  log('   ✅ Captura de nombre (InputFlow)');
  log('   ✅ Selección de servicio (ButtonsFlow)');
  log('   ✅ Selección de categoría (CategoriesFlow)');
  log('   ✅ Selección de producto (ProductsFlow)');
  log('   ✅ Captura de email (InputFlow)');
  log('   ✅ Captura de teléfono (InputFlow)');
  log('   ✅ Mensaje final con resumen');
  
  log('\n5️⃣ VERIFICACIONES CRÍTICAS:', 'bright');
  log('   🔍 Estado compartido entre nodos (globalVars)');
  log('   🔍 Navegación automática entre nodos');
  log('   🔍 Validaciones de entrada funcionando');
  log('   🔍 Sales funnel actualizándose');
  log('   🔍 No errores "text.replace is not a function"');
  log('   🔍 Logs limpios sin errores críticos');
  
  log('\n6️⃣ MONITOREO DE LOGS:', 'bright');
  log('   - Observar logs en tiempo real');
  log('   - Buscar mensajes [MainFlow], [InputFlow], [ButtonsFlow], etc.');
  log('   - Verificar que no haya errores de navegación');
  
  warning('\n⚠️  IMPORTANTE:');
  log('   - Prueba CADA tipo de nodo al menos una vez');
  log('   - Verifica validaciones (email incorrecto, nombre muy corto, etc.)');
  log('   - Confirma que las variables se guardan correctamente');
  log('   - Asegúrate de que el sales funnel progrese');
}

// Generar checklist de validación
function generateValidationChecklist() {
  header('CHECKLIST DE VALIDACIÓN');
  
  const checklist = [
    '[ ] Servidor inicia sin errores',
    '[ ] WhatsApp se conecta correctamente',
    '[ ] Template de testing se carga',
    '[ ] Mensaje inicial se muestra',
    '[ ] InputFlow captura nombre correctamente',
    '[ ] Validación de nombre funciona (rechaza nombres muy cortos)',
    '[ ] ButtonsFlow muestra opciones de servicio',
    '[ ] Selección de botón navega al siguiente nodo',
    '[ ] CategoriesFlow muestra categorías dinámicas',
    '[ ] ProductsFlow filtra productos por categoría seleccionada',
    '[ ] InputFlow captura email con validación',
    '[ ] Validación de email rechaza emails inválidos',
    '[ ] InputFlow captura teléfono con validación',
    '[ ] Mensaje final muestra todas las variables capturadas',
    '[ ] Sales funnel progresa: Nuevos → Prospectando → Calificación → Oportunidad',
    '[ ] No hay errores "text.replace is not a function"',
    '[ ] Estado se comparte correctamente entre nodos',
    '[ ] Navegación automática funciona en todos los nodos',
    '[ ] Logs muestran información clara de cada paso',
    '[ ] Sistema funciona de principio a fin sin intervención manual'
  ];
  
  log('Marca cada item conforme lo verifiques:\n');
  checklist.forEach(item => log(item));
  
  log('\n💯 CRITERIO DE ÉXITO:');
  success('TODOS los items deben estar marcados para considerar el test exitoso');
}

// Función principal
async function main() {
  try {
    // Verificaciones del sistema
    const systemOk = await runSystemChecks();
    
    if (!systemOk) {
      error('\n🚨 ALGUNAS VERIFICACIONES FALLARON');
      error('Por favor corrige los errores antes de continuar con el testing');
      process.exit(1);
    }
    
    success('\n🎉 TODAS LAS VERIFICACIONES PASARON');
    info('El sistema está listo para testing manual');
    
    // Generar instrucciones
    generateTestInstructions();
    generateValidationChecklist();
    
    header('RESUMEN');
    success('Sistema modular V1 listo para testing');
    info('Sigue las instrucciones arriba para completar la validación');
    warning('Documenta cualquier error o comportamiento inesperado');
    
  } catch (error) {
    error(`Error ejecutando script de testing: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar script
main();