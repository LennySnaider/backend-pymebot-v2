/**
 * CONFIGURACIÓN DE JEST PARA ENHANCED DATA CAPTURE
 * 
 * PROPÓSITO: Configurar entorno de testing para módulo híbrido
 * ENFOQUE: Tests exhaustivos con cobertura completa
 * COMPATIBILIDAD: Node.js + TypeScript + ES6 modules
 */

module.exports = {
  // Entorno de testing
  testEnvironment: 'node',
  
  // Archivos de test
  testMatch: [
    '**/src/services/__tests__/**/*.test.ts',
    '**/src/services/__tests__/**/*.integration.test.ts'
  ],
  
  // Transformaciones para TypeScript
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  
  // Extensiones de archivos
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Setup de testing
  setupFilesAfterEnv: ['<rootDir>/src/services/__tests__/setup.ts'],
  
  // Cobertura de código
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/enhancedDataCapture.ts',
    '!src/services/__tests__/**',
    '!**/node_modules/**'
  ],
  
  // Reportes de cobertura
  coverageReporters: ['text', 'html', 'lcov', 'json'],
  coverageDirectory: 'coverage',
  
  // Umbrales de cobertura
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/enhancedDataCapture.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Configuración de módulos
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@builderbot/bot$': '<rootDir>/src/services/__tests__/__mocks__/builderbot.ts',
    '^@supabase/supabase-js$': '<rootDir>/src/services/__tests__/__mocks__/supabase.ts'
  },
  
  // Timeout para tests
  testTimeout: 30000,
  
  // Configuración verbose para debugging
  verbose: true,
  
  // Limpiar mocks entre tests
  clearMocks: true,
  
  // Ignorar archivos
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Variables de entorno para testing
  setupFiles: ['<rootDir>/src/services/__tests__/env.setup.ts'],
  
  // Reporteros
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Enhanced Data Capture Test Report'
      }
    ]
  ],
  
  // Configuración específica para TypeScript
  preset: 'ts-jest',
  
  // Globals para ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          strict: false,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        }
      }
    }
  }
};