#!/bin/bash

# SCRIPT DE TESTING PARA ENHANCED DATA CAPTURE
# 
# PROPÓSITO: Ejecutar tests exhaustivos del módulo de captura mejorado
# INCLUYE: Tests unitarios, integración, cobertura, reportes

set -e  # Salir en caso de error

echo "🧪 INICIANDO TESTS DE ENHANCED DATA CAPTURE"
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

# 1. TESTS UNITARIOS
echo ""
log_info "Ejecutando tests unitarios..."
echo "================================"

npx jest src/services/__tests__/enhancedDataCapture.test.ts \
    --coverage \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

if [ $? -eq 0 ]; then
    log_success "Tests unitarios completados exitosamente"
else
    log_error "Fallos en tests unitarios"
    exit 1
fi

# 2. TESTS DE INTEGRACIÓN
echo ""
log_info "Ejecutando tests de integración..."
echo "=================================="

npx jest src/services/__tests__/enhancedDataCapture.integration.test.ts \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

if [ $? -eq 0 ]; then
    log_success "Tests de integración completados exitosamente"
else
    log_error "Fallos en tests de integración"
    exit 1
fi

# 3. TODOS LOS TESTS CON COBERTURA COMPLETA
echo ""
log_info "Ejecutando suite completa de tests..."
echo "====================================="

npx jest src/services/__tests__/ \
    --coverage \
    --coverageReporters=text \
    --coverageReporters=html \
    --coverageReporters=lcov \
    --verbose \
    --detectOpenHandles \
    --forceExit \
    --runInBand

TEST_EXIT_CODE=$?

# 4. GENERAR REPORTES
echo ""
log_info "Generando reportes de testing..."
echo "================================"

# Crear directorio de reportes si no existe
mkdir -p reports/testing

# Mover reportes de cobertura
if [ -d "coverage" ]; then
    cp -r coverage reports/testing/
    log_success "Reportes de cobertura generados en reports/testing/coverage/"
fi

# 5. ANÁLISIS DE COBERTURA
echo ""
log_info "Analizando cobertura de código..."
echo "================================="

if [ -f "coverage/lcov.info" ]; then
    # Mostrar resumen de cobertura
    echo ""
    echo "📊 RESUMEN DE COBERTURA:"
    echo "========================"
    
    # Extraer estadísticas de cobertura
    LINES_COVERED=$(grep -o "LF:[0-9]*" coverage/lcov.info | cut -d: -f2 | awk '{s+=$1} END {print s}')
    LINES_HIT=$(grep -o "LH:[0-9]*" coverage/lcov.info | cut -d: -f2 | awk '{s+=$1} END {print s}')
    
    if [ ! -z "$LINES_COVERED" ] && [ ! -z "$LINES_HIT" ] && [ "$LINES_COVERED" -gt 0 ]; then
        COVERAGE_PERCENT=$(echo "scale=2; $LINES_HIT * 100 / $LINES_COVERED" | bc -l 2>/dev/null || echo "N/A")
        echo "Líneas cubiertas: $LINES_HIT de $LINES_COVERED ($COVERAGE_PERCENT%)"
    fi
    
    log_success "Reporte de cobertura disponible en coverage/html/index.html"
else
    log_warning "No se generó reporte de cobertura LCOV"
fi

# 6. VALIDACIONES CRÍTICAS
echo ""
log_info "Ejecutando validaciones críticas..."
echo "==================================="

# Verificar que no hay tests que fallen silenciosamente
FAILED_TESTS=$(grep -c "FAIL" reports/testing/coverage/test-report.txt 2>/dev/null || echo "0")
PASSED_TESTS=$(grep -c "PASS" reports/testing/coverage/test-report.txt 2>/dev/null || echo "0")

echo "Tests ejecutados: $(($PASSED_TESTS + $FAILED_TESTS))"
echo "Tests exitosos: $PASSED_TESTS"
echo "Tests fallidos: $FAILED_TESTS"

# 7. VERIFICACIÓN DE ARCHIVOS CRÍTICOS
echo ""
log_info "Verificando archivos críticos..."
echo "================================"

CRITICAL_FILES=(
    "src/services/enhancedDataCapture.ts"
    "src/services/__tests__/enhancedDataCapture.test.ts"
    "src/services/__tests__/enhancedDataCapture.integration.test.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "✓ $file"
    else
        log_error "✗ $file - ARCHIVO FALTANTE"
        exit 1
    fi
done

# 8. RESUMEN FINAL
echo ""
echo "🏆 RESUMEN DE TESTING"
echo "===================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "TODOS LOS TESTS PASARON EXITOSAMENTE"
    log_success "Módulo Enhanced Data Capture está listo para producción"
    
    # Mostrar siguiente paso
    echo ""
    log_info "Próximos pasos:"
    echo "1. Revisar reportes en: reports/testing/coverage/html/index.html"
    echo "2. Continuar con Task 3.0: Crear Sistema de Sesiones Persistentes"
    echo "3. Integrar con templateConverter.ts actual"
    
    exit 0
else
    log_error "ALGUNOS TESTS FALLARON"
    log_error "Revisa los logs arriba para detalles específicos"
    
    # Mostrar debugging tips
    echo ""
    log_info "Tips para debugging:"
    echo "1. Revisar logs detallados arriba"
    echo "2. Ejecutar test específico: npx jest --testNamePattern='nombre del test'"
    echo "3. Usar --verbose para más detalles"
    echo "4. Verificar mocks en __mocks__/"
    
    exit 1
fi