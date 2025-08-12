/**
 * TESTS PARA TEMPLATE DETECTOR SERVICE
 * 
 * PROPÓSITO: Validar detección automática de templates problemáticos
 * BASADO EN: Patrones de testing del v1-reference y mejores prácticas
 * PRESERVA: Sistema actual 100% intacto durante testing
 * VALIDA: Detección precisa de templates que requieren módulos híbridos
 * 
 * @version 1.0.0
 * @created 2025-06-26
 */

import TemplateDetectorService from './templateDetector';
import type { 
  TemplateAnalysisResult, 
  DetectionConfiguration,
  PerformanceMetrics 
} from './templateDetector';
import type { ChatbotTemplate } from '../types/Template';

// Mock del logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('TemplateDetectorService', () => {
  let detectorService: TemplateDetectorService;

  beforeEach(() => {
    // Configuración de testing con valores controlados
    const testConfig: Partial<DetectionConfiguration> = {
      enableAutoDetection: true,
      analysisDepth: 'comprehensive',
      performanceThresholds: {
        minCaptureSuccessRate: 0.8,
        maxAverageResponseTime: 2000,
        maxSessionDropRate: 0.2,
        maxErrorRate: 0.1,
        minUserCompletionRate: 0.7
      },
      complexityThresholds: {
        maxSimpleNodes: 5,
        maxMediumNodes: 15,
        maxComplexNodes: 30,
        maxCaptureNodesRatio: 0.4,
        maxNavigationDepth: 10
      },
      errorThresholds: {
        maxCriticalIssues: 0,
        maxHighIssues: 2,
        maxMediumIssues: 5,
        maxLowIssues: 10
      },
      enableHistoricalAnalysis: true,
      enablePredictiveAnalysis: false
    };

    detectorService = TemplateDetectorService.getInstance(testConfig);
  });

  afterEach(() => {
    detectorService.destroy();
  });

  describe('Singleton Pattern', () => {
    test('debe devolver la misma instancia', () => {
      const instance1 = TemplateDetectorService.getInstance();
      const instance2 = TemplateDetectorService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Template Analysis - Basic Functionality', () => {
    test('debe analizar template simple sin problemas', async () => {
      const simpleTemplate: ChatbotTemplate = {
        id: 'simple-template-1',
        name: 'Template Simple',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { id: 'start', type: 'messageNode', data: { message: 'Hola' } },
            { id: 'end', type: 'messageNode', data: { message: 'Adiós' } }
          ],
          edges: [
            { source: 'start', target: 'end' }
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(simpleTemplate);

      expect(result.templateId).toBe('simple-template-1');
      expect(result.needsHybridModules).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.detectedIssues).toHaveLength(0);
      expect(result.recommendedModules).toHaveLength(0);
    });

    test('debe detectar template complejo que requiere módulos híbridos', async () => {
      const complexTemplate: ChatbotTemplate = {
        id: 'complex-template-1',
        name: 'Template Complejo',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: Array.from({ length: 25 }, (_, i) => ({
            id: `node-${i}`,
            type: i % 3 === 0 ? 'inputNode' : 'messageNode',
            data: { 
              message: `Nodo ${i}`,
              waitForResponse: i % 3 === 0,
              capture: i % 3 === 0
            }
          })),
          edges: Array.from({ length: 24 }, (_, i) => ({
            source: `node-${i}`,
            target: `node-${i + 1}`
          }))
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(complexTemplate);

      expect(result.templateId).toBe('complex-template-1');
      expect(result.needsHybridModules).toBe(true);
      expect(result.riskLevel).toBeOneOf(['medium', 'high', 'critical']);
      expect(result.detectedIssues.length).toBeGreaterThan(0);
      expect(result.recommendedModules.length).toBeGreaterThan(0);
    });

    test('debe manejar template con métricas de rendimiento pobres', async () => {
      const template: ChatbotTemplate = {
        id: 'poor-performance-template',
        name: 'Template con Problemas',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { id: 'start', type: 'inputNode', data: { waitForResponse: true, capture: true } },
            { id: 'end', type: 'messageNode', data: { message: 'Fin' } }
          ],
          edges: [{ source: 'start', target: 'end' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const poorMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.3,  // 30% - Muy bajo
        averageResponseTime: 5000, // 5 segundos - Muy alto
        sessionDropRate: 0.4,     // 40% - Muy alto
        errorRate: 0.25,          // 25% - Muy alto
        userCompletionRate: 0.4   // 40% - Muy bajo
      };

      const result = await detectorService.analyzeTemplate(template, {
        performanceMetrics: poorMetrics
      });

      expect(result.needsHybridModules).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'capture_failures',
          severity: 'critical'
        })
      );
      expect(result.recommendedModules).toContain('enhancedDataCapture');
      expect(result.recommendedModules).toContain('improvedSessionManager');
    });
  });

  describe('Detection Rules', () => {
    test('debe detectar fallos de captura', async () => {
      const templateWithCapture: ChatbotTemplate = {
        id: 'capture-test-template',
        name: 'Template con Captura',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { id: 'input1', type: 'inputNode', data: { capture: true } },
            { id: 'input2', type: 'inputNode', data: { waitForResponse: true } },
            { id: 'input3', type: 'inputNode', data: { capture: true } }
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const lowCaptureMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.5, // 50% - Bajo
        averageResponseTime: 1000,
        sessionDropRate: 0.1,
        errorRate: 0.05,
        userCompletionRate: 0.8
      };

      const result = await detectorService.analyzeTemplate(templateWithCapture, {
        performanceMetrics: lowCaptureMetrics
      });

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'capture_failures',
          severity: 'critical'
        })
      );
      expect(result.recommendedModules).toContain('enhancedDataCapture');
    });

    test('debe detectar pérdida de sesión', async () => {
      const multiStepTemplate: ChatbotTemplate = {
        id: 'multistep-template',
        name: 'Template Multi-paso',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: Array.from({ length: 10 }, (_, i) => ({
            id: `step-${i}`,
            type: 'messageNode',
            data: { message: `Paso ${i}` }
          }))
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const highDropMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.9,
        averageResponseTime: 1500,
        sessionDropRate: 0.3, // 30% - Alto
        errorRate: 0.05,
        userCompletionRate: 0.8
      };

      const result = await detectorService.analyzeTemplate(multiStepTemplate, {
        performanceMetrics: highDropMetrics
      });

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'session_drops',
          severity: 'high'
        })
      );
      expect(result.recommendedModules).toContain('improvedSessionManager');
    });

    test('debe detectar navegación compleja', async () => {
      const complexNavigationTemplate: ChatbotTemplate = {
        id: 'complex-nav-template',
        name: 'Template Navegación Compleja',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { id: 'start', type: 'messageNode' },
            { id: 'condition1', type: 'conditionNode', data: { conditions: [{}] } },
            { id: 'condition2', type: 'conditionNode', data: { conditions: [{}] } },
            { id: 'loop1', type: 'messageNode' },
            { id: 'loop2', type: 'messageNode' }
          ],
          edges: [
            { source: 'start', target: 'condition1' },
            { source: 'condition1', target: 'condition2' },
            { source: 'condition2', target: 'loop1' },
            { source: 'loop1', target: 'loop2' },
            { source: 'loop2', target: 'condition1' } // Ciclo
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(complexNavigationTemplate);

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'complex_flows',
          severity: 'medium'
        })
      );
      expect(result.recommendedModules).toContain('dynamicNavigation');
    });

    test('debe detectar pérdida de contexto', async () => {
      const variableTemplate: ChatbotTemplate = {
        id: 'variable-template',
        name: 'Template con Variables',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { 
              id: 'input1', 
              type: 'inputNode', 
              data: { 
                message: 'Ingresa tu nombre: {{nombre}}',
                capture: true,
                variables: ['nombre']
              }
            },
            { 
              id: 'input2', 
              type: 'inputNode', 
              data: { 
                message: 'Tu edad {{edad}} y nombre {{nombre}}',
                capture: true,
                variables: ['edad']
              }
            }
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const lowCompletionMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.9,
        averageResponseTime: 1500,
        sessionDropRate: 0.1,
        errorRate: 0.05,
        userCompletionRate: 0.5 // 50% - Bajo
      };

      const result = await detectorService.analyzeTemplate(variableTemplate, {
        performanceMetrics: lowCompletionMetrics
      });

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'context_loss',
          severity: 'high'
        })
      );
      expect(result.recommendedModules).toContain('enhancedDataCapture');
    });

    test('debe detectar problemas de rendimiento', async () => {
      const template: ChatbotTemplate = {
        id: 'performance-template',
        name: 'Template Rendimiento',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const poorPerformanceMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.9,
        averageResponseTime: 4000, // 4 segundos - Muy alto
        sessionDropRate: 0.1,
        errorRate: 0.15, // 15% - Alto
        userCompletionRate: 0.8
      };

      const result = await detectorService.analyzeTemplate(template, {
        performanceMetrics: poorPerformanceMetrics
      });

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'performance_issues',
          severity: 'medium'
        })
      );
      expect(result.recommendedModules).toContain('nodeProcessingQueue');
    });

    test('debe detectar integración con leads', async () => {
      const leadTemplate: ChatbotTemplate = {
        id: 'lead-template',
        name: 'Template con Leads',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { 
              id: 'lead1', 
              type: 'messageNode', 
              data: { 
                leadStageId: 'prospect',
                salesFunnelStep: 'discovery'
              }
            },
            { 
              id: 'lead2', 
              type: 'messageNode', 
              data: { 
                leadStageId: 'qualified'
              }
            }
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(leadTemplate);

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'lead_integration',
          severity: 'high'
        })
      );
      expect(result.recommendedModules.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    test('debe respetar configuración de templates forzados', async () => {
      const config = detectorService.getConfiguration();
      config.forceHybridTemplateIds = ['forced-template'];

      detectorService.updateConfiguration(config);

      const forcedTemplate: ChatbotTemplate = {
        id: 'forced-template',
        name: 'Template Forzado',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'simple', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(forcedTemplate);

      expect(result.needsHybridModules).toBe(true);
      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          description: 'Template configurado para usar módulos híbridos obligatoriamente'
        })
      );
    });

    test('debe respetar configuración de templates excluidos', async () => {
      const config = detectorService.getConfiguration();
      config.excludeTemplateIds = ['excluded-template'];

      detectorService.updateConfiguration(config);

      const excludedTemplate: ChatbotTemplate = {
        id: 'excluded-template',
        name: 'Template Excluido',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: Array.from({ length: 50 }, (_, i) => ({ // Template muy complejo
            id: `node-${i}`,
            type: 'inputNode',
            data: { capture: true }
          }))
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(excludedTemplate);

      expect(result.needsHybridModules).toBe(false);
      expect(result.analysisScore).toBe(0);
    });

    test('debe permitir actualizar configuración de umbrales', async () => {
      const newConfig: Partial<DetectionConfiguration> = {
        performanceThresholds: {
          minCaptureSuccessRate: 0.9, // Más estricto
          maxAverageResponseTime: 1000, // Más estricto
          maxSessionDropRate: 0.1, // Más estricto
          maxErrorRate: 0.05, // Más estricto
          minUserCompletionRate: 0.8 // Más estricto
        }
      };

      detectorService.updateConfiguration(newConfig);

      const template: ChatbotTemplate = {
        id: 'threshold-test',
        name: 'Test Umbrales',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'inputNode', data: { capture: true } }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const moderateMetrics: PerformanceMetrics = {
        captureSuccessRate: 0.85, // Antes aceptable, ahora bajo
        averageResponseTime: 1500, // Antes aceptable, ahora alto
        sessionDropRate: 0.15, // Antes aceptable, ahora alto
        errorRate: 0.08, // Antes aceptable, ahora alto
        userCompletionRate: 0.75 // Antes aceptable, ahora bajo
      };

      const result = await detectorService.analyzeTemplate(template, {
        performanceMetrics: moderateMetrics
      });

      // Con umbrales más estrictos, debería detectar más problemas
      expect(result.needsHybridModules).toBe(true);
      expect(result.detectedIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Detection Rules', () => {
    test('debe permitir registrar reglas personalizadas', async () => {
      detectorService.registerDetectionRule({
        id: 'custom_rule_test',
        name: 'Regla de Prueba',
        description: 'Detectar templates de prueba',
        category: 'custom',
        severity: 'medium',
        isBlocking: false,
        detect: async (template) => {
          if (template.name.includes('Prueba')) {
            return {
              detected: true,
              confidence: 0.9,
              evidence: { templateName: template.name },
              affectedNodes: [],
              recommendation: 'Usar configuración de prueba'
            };
          }
          return {
            detected: false,
            confidence: 0,
            evidence: {},
            affectedNodes: [],
            recommendation: ''
          };
        }
      });

      const testTemplate: ChatbotTemplate = {
        id: 'custom-test',
        name: 'Template de Prueba',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(testTemplate);

      expect(result.detectedIssues).toContainEqual(
        expect.objectContaining({
          issueType: 'custom',
          description: 'Detectar templates de prueba'
        })
      );
    });

    test('debe permitir desregistrar reglas', () => {
      const ruleId = 'test_rule_to_remove';
      
      detectorService.registerDetectionRule({
        id: ruleId,
        name: 'Regla Temporal',
        description: 'Regla para eliminar',
        category: 'custom',
        severity: 'low',
        isBlocking: false,
        detect: async () => ({
          detected: false,
          confidence: 0,
          evidence: {},
          affectedNodes: [],
          recommendation: ''
        })
      });

      expect(detectorService.getDetectionRules()).toContainEqual(
        expect.objectContaining({ id: ruleId })
      );

      const removed = detectorService.unregisterDetectionRule(ruleId);
      expect(removed).toBe(true);

      expect(detectorService.getDetectionRules()).not.toContainEqual(
        expect.objectContaining({ id: ruleId })
      );
    });
  });

  describe('Performance and Caching', () => {
    test('debe usar caché para análisis repetidos', async () => {
      const template: ChatbotTemplate = {
        id: 'cache-test',
        name: 'Template Cache',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Primer análisis
      const startTime1 = Date.now();
      const result1 = await detectorService.analyzeTemplate(template);
      const duration1 = Date.now() - startTime1;

      // Segundo análisis (debería usar caché)
      const startTime2 = Date.now();
      const result2 = await detectorService.analyzeTemplate(template);
      const duration2 = Date.now() - startTime2;

      expect(result1.templateId).toBe(result2.templateId);
      expect(result1.analysisScore).toBe(result2.analysisScore);
      expect(duration2).toBeLessThan(duration1); // Caché debería ser más rápido
    });

    test('debe permitir forzar análisis sin caché', async () => {
      const template: ChatbotTemplate = {
        id: 'force-analysis-test',
        name: 'Template Force',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Análisis inicial
      await detectorService.analyzeTemplate(template);

      // Análisis forzado (sin caché)
      const forcedResult = await detectorService.analyzeTemplate(template, {
        forceAnalysis: true
      });

      expect(forcedResult.templateId).toBe('force-analysis-test');
      // El resultado puede ser el mismo, pero se ejecutó sin caché
    });

    test('debe limpiar caché correctamente', async () => {
      const template: ChatbotTemplate = {
        id: 'clear-cache-test',
        name: 'Template Clear Cache',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Generar entrada en caché
      await detectorService.analyzeTemplate(template);

      // Limpiar caché
      detectorService.clearCache();

      // El siguiente análisis debería procesar nuevamente
      const result = await detectorService.analyzeTemplate(template);
      expect(result.templateId).toBe('clear-cache-test');
    });
  });

  describe('Error Handling', () => {
    test('debe manejar template con datos malformados', async () => {
      const malformedTemplate: ChatbotTemplate = {
        id: 'malformed-template',
        name: 'Template Malformado',
        tenant_id: 'tenant-1',
        template_data: 'invalid json data', // JSON inválido
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(malformedTemplate);

      expect(result.templateId).toBe('malformed-template');
      expect(result.needsHybridModules).toBe(false);
      expect(result.metadata.nodeCount).toBe(0);
    });

    test('debe manejar métricas de rendimiento incompletas', async () => {
      const template: ChatbotTemplate = {
        id: 'incomplete-metrics-test',
        name: 'Template Métricas Incompletas',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const incompleteMetrics: Partial<PerformanceMetrics> = {
        captureSuccessRate: 0.5, // Solo una métrica
        // Falta el resto
      };

      const result = await detectorService.analyzeTemplate(template, {
        performanceMetrics: incompleteMetrics as PerformanceMetrics
      });

      expect(result.templateId).toBe('incomplete-metrics-test');
      // Debería funcionar con métricas incompletas
    });

    test('debe manejar reglas de detección que fallan', async () => {
      detectorService.registerDetectionRule({
        id: 'failing_rule',
        name: 'Regla que Falla',
        description: 'Regla diseñada para fallar',
        category: 'custom',
        severity: 'low',
        isBlocking: false,
        detect: async () => {
          throw new Error('Error simulado en regla');
        }
      });

      const template: ChatbotTemplate = {
        id: 'failing-rule-test',
        name: 'Template Regla Fallida',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [{ id: 'test', type: 'messageNode' }]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(template);

      // El análisis debería completarse a pesar del fallo de la regla
      expect(result.templateId).toBe('failing-rule-test');
      // Podría tener un issue reportando el error de la regla
    });
  });

  describe('Performance Metrics Integration', () => {
    test('debe integrar métricas de rendimiento en el análisis', async () => {
      detectorService.setPerformanceData('metrics-integration-test', {
        captureSuccessRate: 0.4,
        averageResponseTime: 6000,
        sessionDropRate: 0.5,
        errorRate: 0.3,
        userCompletionRate: 0.3
      });

      const template: ChatbotTemplate = {
        id: 'metrics-integration-test',
        name: 'Template Integración Métricas',
        tenant_id: 'tenant-1',
        template_data: JSON.stringify({
          nodes: [
            { id: 'input1', type: 'inputNode', data: { capture: true } },
            { id: 'input2', type: 'inputNode', data: { capture: true } }
          ]
        }),
        version: '1.0',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const result = await detectorService.analyzeTemplate(template, {
        includePerformanceData: true
      });

      expect(result.needsHybridModules).toBe(true);
      expect(result.riskLevel).toBe('critical');
      expect(result.detectedIssues.length).toBeGreaterThan(2);
      expect(result.recommendedModules).toContain('enhancedDataCapture');
      expect(result.recommendedModules).toContain('improvedSessionManager');
    });
  });

  describe('Service Lifecycle', () => {
    test('debe destruir servicio correctamente', () => {
      const service = TemplateDetectorService.getInstance();
      
      // Registrar algunos datos
      service.setPerformanceData('test-template', {
        captureSuccessRate: 0.8,
        averageResponseTime: 1000,
        sessionDropRate: 0.1,
        errorRate: 0.05,
        userCompletionRate: 0.9
      });

      service.registerDetectionRule({
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        category: 'custom',
        severity: 'low',
        isBlocking: false,
        detect: async () => ({
          detected: false,
          confidence: 0,
          evidence: {},
          affectedNodes: [],
          recommendation: ''
        })
      });

      // Destruir servicio
      service.destroy();

      // Verificar limpieza
      expect(service.getDetectionRules()).toHaveLength(0);
    });
  });
});

// Matcher personalizado para toBeOneOf
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}