/**
 * CONFIGURACIÓN CENTRAL DE MONITOREO PARA TESTS
 * 
 * PROPÓSITO: Configuración unificada para todos los sistemas de monitoreo durante testing
 * FUNCIÓN: Centralizar thresholds, alertas, perfiles de monitoreo y configuraciones
 * ALCANCE: Todas las áreas de testing (E2E, carga, tiempo real, regresión, etc.)
 * FLEXIBILIDAD: Perfiles configurables por tipo de test y entorno
 * 
 * CARACTERÍSTICAS:
 * - Perfiles de monitoreo por tipo de test
 * - Thresholds configurables por severidad
 * - Configuración de alertas multi-canal
 * - Métricas personalizables por área
 * - Configuración de exportación de reportes
 * 
 * @version 1.0.0
 * @created 2025-07-10
 */

// TIPOS DE CONFIGURACIÓN
export interface MonitoringProfile {
  name: string;
  description: string;
  enabled: boolean;
  
  // INTERVALOS DE ACTUALIZACIÓN
  intervals: {
    metricsUpdate: number; // ms
    dashboardRefresh: number; // ms
    healthCheck: number; // ms
    automaticReport: number; // ms
    alertCheck: number; // ms
  };
  
  // RETENCIÓN DE DATOS
  retention: {
    metrics: number; // segundos
    alerts: number; // segundos
    testResults: number; // segundos
    logs: number; // segundos
  };
  
  // THRESHOLDS DE ALERTAS
  thresholds: {
    critical: PerformanceThresholds;
    warning: PerformanceThresholds;
    info: PerformanceThresholds;
  };
  
  // CONFIGURACIÓN DE EXPORTACIÓN
  export: {
    enabled: boolean;
    formats: ('json' | 'csv' | 'html' | 'pdf')[];
    autoExport: boolean;
    exportPath: string;
  };
}

export interface PerformanceThresholds {
  responseTime: number; // ms
  errorRate: number; // 0-1
  memoryUsage: number; // MB
  cpuUsage: number; // porcentaje
  successRate: number; // 0-1
  captureRate: number; // 0-1
  leadProgressionRate: number; // 0-1
  throughputPerSecond: number; // requests/sec
  connectionCount: number; // número
  queueSize: number; // número
}

export interface AlertConfiguration {
  enabled: boolean;
  channels: AlertChannel[];
  escalation: EscalationRules;
  autoResolve: boolean;
  suppressDuplicates: boolean;
  suppressionWindow: number; // ms
}

export interface AlertChannel {
  type: 'console' | 'file' | 'email' | 'slack' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
  severityFilter: ('critical' | 'warning' | 'info')[];
}

export interface EscalationRules {
  enabled: boolean;
  levels: {
    duration: number; // ms
    action: 'notify' | 'escalate' | 'auto_resolve';
    channels: string[];
  }[];
}

export interface TestAreaConfig {
  enabled: boolean;
  profile: string;
  customThresholds?: Partial<PerformanceThresholds>;
  specificMetrics: string[];
  reportingEnabled: boolean;
}

// PERFILES PREDEFINIDOS DE MONITOREO
export const MONITORING_PROFILES: Record<string, MonitoringProfile> = {
  
  // PERFIL PARA DESARROLLO Y DEBUGGING
  development: {
    name: 'Desarrollo',
    description: 'Monitoreo detallado para desarrollo y debugging',
    enabled: true,
    
    intervals: {
      metricsUpdate: 200, // Muy frecuente para debugging
      dashboardRefresh: 500,
      healthCheck: 1000,
      automaticReport: 60000, // 1 minuto
      alertCheck: 500
    },
    
    retention: {
      metrics: 1800, // 30 minutos
      alerts: 3600, // 1 hora
      testResults: 7200, // 2 horas
      logs: 3600
    },
    
    thresholds: {
      critical: {
        responseTime: 5000,
        errorRate: 0.15,
        memoryUsage: 1000,
        cpuUsage: 90,
        successRate: 0.70,
        captureRate: 0.60,
        leadProgressionRate: 0.70,
        throughputPerSecond: 5,
        connectionCount: 100,
        queueSize: 50
      },
      warning: {
        responseTime: 2000,
        errorRate: 0.08,
        memoryUsage: 500,
        cpuUsage: 70,
        successRate: 0.80,
        captureRate: 0.75,
        leadProgressionRate: 0.80,
        throughputPerSecond: 10,
        connectionCount: 50,
        queueSize: 25
      },
      info: {
        responseTime: 1000,
        errorRate: 0.03,
        memoryUsage: 200,
        cpuUsage: 50,
        successRate: 0.95,
        captureRate: 0.90,
        leadProgressionRate: 0.90,
        throughputPerSecond: 20,
        connectionCount: 20,
        queueSize: 10
      }
    },
    
    export: {
      enabled: true,
      formats: ['json', 'html'],
      autoExport: true,
      exportPath: './reports/development'
    }
  },

  // PERFIL PARA TESTING AUTOMATIZADO
  testing: {
    name: 'Testing Automatizado',
    description: 'Configuración optimizada para suites de tests automatizados',
    enabled: true,
    
    intervals: {
      metricsUpdate: 1000, // Balance entre precisión y performance
      dashboardRefresh: 2000,
      healthCheck: 5000,
      automaticReport: 300000, // 5 minutos
      alertCheck: 1000
    },
    
    retention: {
      metrics: 3600, // 1 hora
      alerts: 7200, // 2 horas
      testResults: 14400, // 4 horas
      logs: 7200
    },
    
    thresholds: {
      critical: {
        responseTime: 8000,
        errorRate: 0.10,
        memoryUsage: 800,
        cpuUsage: 85,
        successRate: 0.75,
        captureRate: 0.65,
        leadProgressionRate: 0.75,
        throughputPerSecond: 8,
        connectionCount: 200,
        queueSize: 100
      },
      warning: {
        responseTime: 3000,
        errorRate: 0.05,
        memoryUsage: 400,
        cpuUsage: 60,
        successRate: 0.85,
        captureRate: 0.80,
        leadProgressionRate: 0.85,
        throughputPerSecond: 15,
        connectionCount: 100,
        queueSize: 50
      },
      info: {
        responseTime: 1500,
        errorRate: 0.02,
        memoryUsage: 250,
        cpuUsage: 40,
        successRate: 0.95,
        captureRate: 0.90,
        leadProgressionRate: 0.90,
        throughputPerSecond: 25,
        connectionCount: 50,
        queueSize: 20
      }
    },
    
    export: {
      enabled: true,
      formats: ['json', 'csv'],
      autoExport: false,
      exportPath: './reports/testing'
    }
  },

  // PERFIL PARA TESTS DE CARGA
  load_testing: {
    name: 'Tests de Carga',
    description: 'Configuración específica para tests de carga y estrés',
    enabled: true,
    
    intervals: {
      metricsUpdate: 2000, // Menos frecuente para no impactar rendimiento
      dashboardRefresh: 5000,
      healthCheck: 10000,
      automaticReport: 600000, // 10 minutos
      alertCheck: 3000
    },
    
    retention: {
      metrics: 7200, // 2 horas para análisis post-carga
      alerts: 14400, // 4 horas
      testResults: 28800, // 8 horas
      logs: 14400
    },
    
    thresholds: {
      critical: {
        responseTime: 15000, // Más permisivo bajo carga
        errorRate: 0.20,
        memoryUsage: 1500,
        cpuUsage: 95,
        successRate: 0.60,
        captureRate: 0.50,
        leadProgressionRate: 0.60,
        throughputPerSecond: 3,
        connectionCount: 500,
        queueSize: 200
      },
      warning: {
        responseTime: 8000,
        errorRate: 0.10,
        memoryUsage: 800,
        cpuUsage: 80,
        successRate: 0.75,
        captureRate: 0.70,
        leadProgressionRate: 0.75,
        throughputPerSecond: 8,
        connectionCount: 300,
        queueSize: 100
      },
      info: {
        responseTime: 4000,
        errorRate: 0.05,
        memoryUsage: 400,
        cpuUsage: 60,
        successRate: 0.85,
        captureRate: 0.80,
        leadProgressionRate: 0.85,
        throughputPerSecond: 15,
        connectionCount: 150,
        queueSize: 50
      }
    },
    
    export: {
      enabled: true,
      formats: ['json', 'csv', 'html'],
      autoExport: true,
      exportPath: './reports/load-testing'
    }
  },

  // PERFIL PARA PRODUCCIÓN (SIMULACIÓN)
  production_simulation: {
    name: 'Simulación Producción',
    description: 'Configuración estricta simulando condiciones de producción',
    enabled: true,
    
    intervals: {
      metricsUpdate: 5000, // Menos invasivo
      dashboardRefresh: 10000,
      healthCheck: 30000,
      automaticReport: 1800000, // 30 minutos
      alertCheck: 5000
    },
    
    retention: {
      metrics: 14400, // 4 horas
      alerts: 28800, // 8 horas
      testResults: 86400, // 24 horas
      logs: 28800
    },
    
    thresholds: {
      critical: {
        responseTime: 3000, // Estricto para producción
        errorRate: 0.03,
        memoryUsage: 600,
        cpuUsage: 80,
        successRate: 0.95,
        captureRate: 0.85,
        leadProgressionRate: 0.90,
        throughputPerSecond: 10,
        connectionCount: 100,
        queueSize: 30
      },
      warning: {
        responseTime: 1500,
        errorRate: 0.01,
        memoryUsage: 300,
        cpuUsage: 60,
        successRate: 0.98,
        captureRate: 0.92,
        leadProgressionRate: 0.95,
        throughputPerSecond: 20,
        connectionCount: 50,
        queueSize: 15
      },
      info: {
        responseTime: 800,
        errorRate: 0.005,
        memoryUsage: 150,
        cpuUsage: 40,
        successRate: 0.99,
        captureRate: 0.95,
        leadProgressionRate: 0.98,
        throughputPerSecond: 30,
        connectionCount: 25,
        queueSize: 5
      }
    },
    
    export: {
      enabled: true,
      formats: ['json', 'csv', 'html', 'pdf'],
      autoExport: true,
      exportPath: './reports/production-simulation'
    }
  }
};

// CONFIGURACIÓN DE ALERTAS POR CANAL
export const ALERT_CONFIGURATIONS: Record<string, AlertConfiguration> = {
  
  console: {
    enabled: true,
    channels: [{
      type: 'console',
      enabled: true,
      config: {
        colorOutput: true,
        detailedMessages: true,
        includeTimestamp: true,
        includeMetrics: true
      },
      severityFilter: ['critical', 'warning', 'info']
    }],
    escalation: {
      enabled: false,
      levels: []
    },
    autoResolve: true,
    suppressDuplicates: true,
    suppressionWindow: 60000 // 1 minuto
  },

  file: {
    enabled: true,
    channels: [{
      type: 'file',
      enabled: true,
      config: {
        logFile: './logs/monitoring-alerts.log',
        rotateDaily: true,
        maxFileSize: '10MB',
        format: 'json'
      },
      severityFilter: ['critical', 'warning']
    }],
    escalation: {
      enabled: false,
      levels: []
    },
    autoResolve: false,
    suppressDuplicates: false,
    suppressionWindow: 0
  },

  comprehensive: {
    enabled: true,
    channels: [
      {
        type: 'console',
        enabled: true,
        config: {
          colorOutput: true,
          detailedMessages: true
        },
        severityFilter: ['critical', 'warning']
      },
      {
        type: 'file',
        enabled: true,
        config: {
          logFile: './logs/comprehensive-alerts.log',
          format: 'detailed'
        },
        severityFilter: ['critical', 'warning', 'info']
      }
    ],
    escalation: {
      enabled: true,
      levels: [
        {
          duration: 300000, // 5 minutos
          action: 'notify',
          channels: ['console']
        },
        {
          duration: 600000, // 10 minutos
          action: 'escalate',
          channels: ['file']
        }
      ]
    },
    autoResolve: true,
    suppressDuplicates: true,
    suppressionWindow: 120000 // 2 minutos
  }
};

// CONFIGURACIÓN POR ÁREA DE TESTING
export const TEST_AREA_CONFIGURATIONS: Record<string, TestAreaConfig> = {
  
  e2e: {
    enabled: true,
    profile: 'testing',
    customThresholds: {
      responseTime: 5000, // E2E puede ser más lento
      successRate: 0.90
    },
    specificMetrics: [
      'response_time',
      'success_rate',
      'error_rate',
      'lead_progression_rate',
      'capture_rate'
    ],
    reportingEnabled: true
  },

  load: {
    enabled: true,
    profile: 'load_testing',
    customThresholds: {
      errorRate: 0.15, // Más permisivo bajo carga
      memoryUsage: 1000
    },
    specificMetrics: [
      'response_time',
      'throughput_per_second',
      'error_rate',
      'memory_usage',
      'cpu_usage',
      'connection_count'
    ],
    reportingEnabled: true
  },

  realtime: {
    enabled: true,
    profile: 'development', // Más detallado para tiempo real
    customThresholds: {
      responseTime: 2000, // Tiempo real necesita ser rápido
      captureRate: 0.85
    },
    specificMetrics: [
      'response_time',
      'capture_rate',
      'lead_progression_rate',
      'success_rate',
      'data_quality_score'
    ],
    reportingEnabled: true
  },

  regression: {
    enabled: true,
    profile: 'production_simulation', // Estricto para regresión
    customThresholds: {
      errorRate: 0.01, // Muy estricto
      successRate: 0.98
    },
    specificMetrics: [
      'success_rate',
      'error_rate',
      'response_time',
      'function_integrity',
      'data_consistency'
    ],
    reportingEnabled: true
  },

  integration: {
    enabled: true,
    profile: 'testing',
    specificMetrics: [
      'response_time',
      'success_rate',
      'error_rate',
      'system_compatibility',
      'fallback_rate'
    ],
    reportingEnabled: true
  },

  metrics: {
    enabled: true,
    profile: 'testing',
    customThresholds: {
      captureRate: 0.90, // Foco en captura
      leadProgressionRate: 0.85
    },
    specificMetrics: [
      'capture_rate',
      'lead_progression_rate',
      'data_quality_score',
      'dropout_rate',
      'conversion_rate'
    ],
    reportingEnabled: true
  }
};

// UTILIDADES DE CONFIGURACIÓN
export class MonitoringConfigManager {
  private static instance: MonitoringConfigManager;
  private currentProfile: string = 'testing';
  private customOverrides: Partial<MonitoringProfile> = {};

  static getInstance(): MonitoringConfigManager {
    if (!MonitoringConfigManager.instance) {
      MonitoringConfigManager.instance = new MonitoringConfigManager();
    }
    return MonitoringConfigManager.instance;
  }

  setProfile(profileName: string): void {
    if (!(profileName in MONITORING_PROFILES)) {
      throw new Error(`Profile '${profileName}' no existe`);
    }
    this.currentProfile = profileName;
  }

  getCurrentProfile(): MonitoringProfile {
    const baseProfile = MONITORING_PROFILES[this.currentProfile];
    return {
      ...baseProfile,
      ...this.customOverrides,
      // Merge profundo de thresholds
      thresholds: {
        ...baseProfile.thresholds,
        ...(this.customOverrides.thresholds || {})
      }
    };
  }

  setCustomOverrides(overrides: Partial<MonitoringProfile>): void {
    this.customOverrides = overrides;
  }

  getThresholds(severity: 'critical' | 'warning' | 'info'): PerformanceThresholds {
    return this.getCurrentProfile().thresholds[severity];
  }

  getTestAreaConfig(area: string): TestAreaConfig {
    return TEST_AREA_CONFIGURATIONS[area] || {
      enabled: true,
      profile: 'testing',
      specificMetrics: ['response_time', 'success_rate', 'error_rate'],
      reportingEnabled: true
    };
  }

  getAlertConfig(configName: string = 'console'): AlertConfiguration {
    return ALERT_CONFIGURATIONS[configName] || ALERT_CONFIGURATIONS.console;
  }

  // VALIDAR CONFIGURACIÓN
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const profile = this.getCurrentProfile();

    // VALIDAR INTERVALOS
    if (profile.intervals.metricsUpdate < 100) {
      errors.push('Intervalo de métricas demasiado pequeño (mínimo 100ms)');
    }

    // VALIDAR THRESHOLDS
    Object.entries(profile.thresholds).forEach(([severity, thresholds]) => {
      if (thresholds.errorRate > 1) {
        errors.push(`Error rate en ${severity} debe ser <= 1`);
      }
      if (thresholds.successRate > 1) {
        errors.push(`Success rate en ${severity} debe ser <= 1`);
      }
    });

    // VALIDAR RETENCIÓN
    if (profile.retention.metrics < 60) {
      errors.push('Retención de métricas debe ser al menos 60 segundos');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // GENERAR CONFIGURACIÓN PERSONALIZADA PARA ENTORNO
  generateConfigForEnvironment(env: 'development' | 'testing' | 'staging' | 'production'): MonitoringProfile {
    const baseProfiles = {
      development: 'development',
      testing: 'testing',
      staging: 'production_simulation',
      production: 'production_simulation'
    };

    const profile = MONITORING_PROFILES[baseProfiles[env]];
    
    // AJUSTES ESPECÍFICOS POR ENTORNO
    const envAdjustments: Partial<MonitoringProfile> = {
      development: {
        intervals: { ...profile.intervals, metricsUpdate: 200 }
      },
      testing: {
        export: { ...profile.export, autoExport: false }
      },
      staging: {
        thresholds: {
          ...profile.thresholds,
          critical: {
            ...profile.thresholds.critical,
            responseTime: 2000 // Más estricto en staging
          }
        }
      },
      production: {
        intervals: { ...profile.intervals, metricsUpdate: 10000 }, // Menos frecuente
        export: { ...profile.export, formats: ['json'] } // Solo JSON en producción
      }
    };

    return {
      ...profile,
      ...envAdjustments[env]
    };
  }

  // EXPORTAR CONFIGURACIÓN ACTUAL
  exportConfiguration(): string {
    return JSON.stringify({
      profile: this.currentProfile,
      configuration: this.getCurrentProfile(),
      customOverrides: this.customOverrides,
      testAreas: TEST_AREA_CONFIGURATIONS,
      alerts: ALERT_CONFIGURATIONS
    }, null, 2);
  }

  // IMPORTAR CONFIGURACIÓN
  importConfiguration(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      this.currentProfile = config.profile || 'testing';
      this.customOverrides = config.customOverrides || {};
    } catch (error) {
      throw new Error(`Error importing configuration: ${error.message}`);
    }
  }
}

// CONFIGURACIÓN POR DEFECTO PARA DIFERENTES ESCENARIOS
export const DEFAULT_CONFIGURATIONS = {
  
  // Para desarrollo local
  LOCAL_DEVELOPMENT: {
    profile: 'development',
    alerts: 'console',
    testAreas: ['e2e', 'integration'],
    export: false
  },

  // Para CI/CD
  CONTINUOUS_INTEGRATION: {
    profile: 'testing',
    alerts: 'file',
    testAreas: ['e2e', 'integration', 'regression'],
    export: true
  },

  // Para tests de performance
  PERFORMANCE_TESTING: {
    profile: 'load_testing',
    alerts: 'comprehensive',
    testAreas: ['load', 'metrics'],
    export: true
  },

  // Para validación pre-producción
  PRE_PRODUCTION: {
    profile: 'production_simulation',
    alerts: 'comprehensive',
    testAreas: ['e2e', 'load', 'regression', 'realtime'],
    export: true
  }
};

export default {
  MONITORING_PROFILES,
  ALERT_CONFIGURATIONS,
  TEST_AREA_CONFIGURATIONS,
  MonitoringConfigManager,
  DEFAULT_CONFIGURATIONS
};