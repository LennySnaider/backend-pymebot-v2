#!/bin/bash

# SCRIPT DE TESTING PARA PERSISTENCIA DE SESIONES
# 
# PROPÓSITO: Ejecutar tests exhaustivos del sistema de sesiones persistentes
# INCLUYE: Tests unitarios, integración, rendimiento, casos edge
# VALIDA: Que el sistema de leads NO se vea afectado

set -e  # Salir en caso de error

echo "🧪 INICIANDO TESTS DE PERSISTENCIA DE SESIONES"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging con colores
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    log_error "No se encontró package.json. Ejecuta desde el directorio backend-pymebot-v2-bk"
    exit 1
fi

# Verificar que Jest está instalado
if ! command -v npx &> /dev/null; then
    log_error "npx no está disponible. Instala Node.js"
    exit 1
fi

# Limpiar caché de Jest
log_info "Limpiando caché de Jest..."
npx jest --clearCache

# 1. TESTS ESPECÍFICOS DE PERSISTENCIA DE SESIONES
echo ""
log_info "Ejecutando tests de persistencia de sesiones..."
echo "==============================================="

npx jest src/services/__tests__/sessionPersistence.test.ts \
    --coverage \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand \
    --testTimeout=30000

SESSION_TESTS_EXIT_CODE=$?

if [ $SESSION_TESTS_EXIT_CODE -eq 0 ]; then
    log_success "Tests de persistencia de sesiones completados exitosamente"
else
    log_error "Fallos en tests de persistencia de sesiones"
fi

# 2. TESTS DE IMPROVED SESSION MANAGER
echo ""
log_info "Ejecutando tests específicos de ImprovedSessionManager..."
echo "======================================================="

npx jest -t "ImprovedSessionManager" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

MANAGER_TESTS_EXIT_CODE=$?

# 3. TESTS DE SESSION CACHE
echo ""
log_info "Ejecutando tests específicos de SessionCache..."
echo "==============================================="

npx jest -t "SessionCache" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

CACHE_TESTS_EXIT_CODE=$?

# 4. TESTS DE WEBPROVIDER V2
echo ""
log_info "Ejecutando tests de WebProvider con sesiones persistentes..."
echo "==========================================================="

npx jest -t "WebProvider.*Sesiones Persistentes" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

PROVIDER_TESTS_EXIT_CODE=$?

# 5. TESTS DE UTILIDADES DE CONTEXTO
echo ""
log_info "Ejecutando tests de maintainSessionContext..."
echo "============================================="

npx jest -t "maintainSessionContext" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

CONTEXT_TESTS_EXIT_CODE=$?

# 6. TESTS DE SERVICIO DE LIMPIEZA
echo ""
log_info "Ejecutando tests de SessionCleanupService..."
echo "============================================"

npx jest -t "SessionCleanupService" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

CLEANUP_TESTS_EXIT_CODE=$?

# 7. TESTS DE INTEGRACIÓN COMPLETA
echo ""
log_info "Ejecutando tests de integración completa..."
echo "==========================================="

npx jest -t "Integración Completa" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

INTEGRATION_TESTS_EXIT_CODE=$?

# 8. TESTS DE RENDIMIENTO
echo ""
log_info "Ejecutando tests de rendimiento y estrés..."
echo "==========================================="

npx jest -t "Rendimiento.*Estrés" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand \
    --testTimeout=60000

PERFORMANCE_TESTS_EXIT_CODE=$?

# 9. TESTS DE CASOS EDGE
echo ""
log_info "Ejecutando tests de casos edge y manejo de errores..."
echo "===================================================="

npx jest -t "Casos Edge" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

EDGE_TESTS_EXIT_CODE=$?

# 10. VALIDACIÓN CRÍTICA: SISTEMA DE LEADS INTACTO
echo ""
log_info "Validando que el sistema de leads NO se ve afectado..."
echo "===================================================="

# Ejecutar tests específicos que validen la preservación del sistema de leads
npx jest -t "preservar.*leads.*sistema actual" \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

LEADS_VALIDATION_EXIT_CODE=$?

# 11. GENERAR REPORTES
echo ""
log_info "Generando reportes de testing..."
echo "================================"

# Crear directorio de reportes si no existe
mkdir -p reports/session-persistence

# Mover reportes de cobertura
if [ -d "coverage" ]; then
    cp -r coverage reports/session-persistence/
    log_success "Reportes de cobertura generados en reports/session-persistence/coverage/"
fi

# 12. ANÁLISIS DE COBERTURA
echo ""
log_info "Analizando cobertura de código..."
echo "================================="

if [ -f "coverage/lcov.info" ]; then
    # Mostrar resumen de cobertura
    echo ""
    echo "📊 RESUMEN DE COBERTURA:"
    echo "========================"
    
    # Extraer estadísticas de cobertura para archivos de sesiones
    LINES_COVERED=$(grep -A 10 -B 5 "sessionPersistence\|improvedSessionManager\|sessionCache\|sessionCleanupService\|maintainSessionContext" coverage/lcov.info | grep -o "LF:[0-9]*" | cut -d: -f2 | awk '{s+=$1} END {print s}')
    LINES_HIT=$(grep -A 10 -B 5 "sessionPersistence\|improvedSessionManager\|sessionCache\|sessionCleanupService\|maintainSessionContext" coverage/lcov.info | grep -o "LH:[0-9]*" | cut -d: -f2 | awk '{s+=$1} END {print s}')
    
    if [ ! -z "$LINES_COVERED" ] && [ ! -z "$LINES_HIT" ] && [ "$LINES_COVERED" -gt 0 ]; then
        COVERAGE_PERCENT=$(echo "scale=2; $LINES_HIT * 100 / $LINES_COVERED" | bc -l 2>/dev/null || echo "N/A")
        echo "Líneas cubiertas en módulos de sesiones: $LINES_HIT de $LINES_COVERED ($COVERAGE_PERCENT%)"
    fi
    
    log_success "Reporte de cobertura disponible en coverage/html/index.html"
else
    log_warning "No se generó reporte de cobertura LCOV"
fi

# 13. VERIFICACIÓN DE ARCHIVOS CRÍTICOS
echo ""
log_info "Verificando archivos críticos del sistema de sesiones..."
echo "========================================================"

CRITICAL_FILES=(
    "src/services/improvedSessionManager.ts"
    "src/services/sessionCache.ts"
    "src/services/sessionCleanupService.ts"
    "src/utils/maintainSessionContext.ts"
    "src/provider/webProvider.ts"
    "src/services/__tests__/sessionPersistence.test.ts"
)

ALL_FILES_EXIST=true

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "✓ $file"
    else
        log_error "✗ $file - ARCHIVO FALTANTE"
        ALL_FILES_EXIST=false
    fi
done

# 14. CALCULAR RESULTADO GENERAL
echo ""
echo "📋 RESUMEN DE RESULTADOS DE TESTING"
echo "==================================="

TOTAL_EXIT_CODE=0

echo "Resultados por suite:"
echo "- Tests de persistencia: $([ $SESSION_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de SessionManager: $([ $MANAGER_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de SessionCache: $([ $CACHE_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de WebProvider V2: $([ $PROVIDER_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de maintainContext: $([ $CONTEXT_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de CleanupService: $([ $CLEANUP_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de integración: $([ $INTEGRATION_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de rendimiento: $([ $PERFORMANCE_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Tests de casos edge: $([ $EDGE_TESTS_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Validación de leads: $([ $LEADS_VALIDATION_EXIT_CODE -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "- Archivos críticos: $([ $ALL_FILES_EXIST = true ] && echo "✅ COMPLETO" || echo "❌ FALTANTES")"

# Sumar todos los códigos de salida
TOTAL_EXIT_CODE=$((
    $SESSION_TESTS_EXIT_CODE + 
    $MANAGER_TESTS_EXIT_CODE + 
    $CACHE_TESTS_EXIT_CODE + 
    $PROVIDER_TESTS_EXIT_CODE + 
    $CONTEXT_TESTS_EXIT_CODE + 
    $CLEANUP_TESTS_EXIT_CODE + 
    $INTEGRATION_TESTS_EXIT_CODE + 
    $PERFORMANCE_TESTS_EXIT_CODE + 
    $EDGE_TESTS_EXIT_CODE + 
    $LEADS_VALIDATION_EXIT_CODE
))

# 15. RESUMEN FINAL
echo ""
echo "🏆 RESUMEN FINAL"
echo "==============="

if [ $TOTAL_EXIT_CODE -eq 0 ] && [ $ALL_FILES_EXIST = true ]; then
    log_success "TODOS LOS TESTS DE PERSISTENCIA DE SESIONES PASARON EXITOSAMENTE"
    log_success "Sistema de sesiones persistentes está listo para producción"
    log_success "CRÍTICO: Sistema de leads preservado correctamente"
    
    # Mostrar siguiente paso
    echo ""
    log_info "Próximos pasos:"
    echo "1. Revisar reportes en: reports/session-persistence/coverage/html/index.html"
    echo "2. Task 3.0 COMPLETADA: Sistema de Sesiones Persistentes"
    echo "3. Continuar con Task 4.0: Implementar Navegación Dinámica entre Nodos"
    echo "4. Integrar todo el sistema híbrido con templateConverter.ts"
    
    exit 0
else
    log_error "ALGUNOS TESTS DE PERSISTENCIA DE SESIONES FALLARON"
    log_error "Total de errores: $TOTAL_EXIT_CODE"
    
    if [ $LEADS_VALIDATION_EXIT_CODE -ne 0 ]; then
        log_error "CRÍTICO: Validación del sistema de leads falló"
    fi
    
    # Mostrar debugging tips
    echo ""
    log_info "Tips para debugging:"
    echo "1. Revisar logs detallados arriba"
    echo "2. Ejecutar suite específica: ./test-session-persistence.sh [suite-name]"
    echo "3. Usar --verbose para más detalles"
    echo "4. Verificar mocks en __mocks__/"
    echo "5. Validar que el sistema de leads NO se vea afectado"
    
    exit 1
fi