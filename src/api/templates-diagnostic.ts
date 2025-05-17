/**
 * src/api/templates-diagnostic.ts
 *
 * Herramientas de diagnóstico para plantillas de chatbot
 * Permite analizar y solucionar problemas con plantillas
 * @version 1.0.0
 * @updated 2025-05-10
 */

import express from 'express';
import logger from '../utils/logger';
import { supabase, checkSupabaseConnection } from '../config/supabase';
import { findInitialMessage, diagnoseFlow } from '../services/chatbotUtils';
import { config } from '../config';

const router = express.Router();

/**
 * Verificación de disponibilidad de Supabase
 */
router.get('/status', async (req, res) => {
  const supabaseAvailable = await checkSupabaseConnection();

  return res.json({
    supabaseAvailable,
    message: supabaseAvailable
      ? 'Conexión a Supabase establecida correctamente'
      : 'Supabase no está disponible o no está configurado'
  });
});

/**
 * GET /api/templates-diagnostic/list
 * Lista todas las plantillas con información básica para diagnóstico
 */
router.get('/list', async (req, res) => {
  try {
    // Verificar si Supabase está disponible
    const supabaseAvailable = await checkSupabaseConnection();

    if (!supabaseAvailable) {
      // Si no está disponible, devolver mensaje informativo
      return res.status(503).json({
        error: 'Supabase no disponible',
        message: 'El servicio de Supabase no está configurado o no está disponible',
        supabaseAvailable: false
      });
    }

    const { data, error } = await supabase
      .from('chatbot_templates')
      .select('id, name, created_at, updated_at, template_type, tenant_id')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error(`Error al listar plantillas: ${error.message}`);
      return res.status(500).json({
        error: 'Error al recuperar plantillas',
        details: error.message
      });
    }

    return res.json({
      total: data.length,
      templates: data,
      supabaseAvailable: true
    });
  } catch (error) {
    logger.error(`Error al recuperar plantillas: ${error}`);
    return res.status(500).json({
      error: 'Error en el servidor',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/templates-diagnostic/:templateId
 * Diagnóstico detallado de una plantilla específica
 */
router.get('/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Obtener plantilla de Supabase
    const { data: template, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) {
      logger.error(`Error al recuperar plantilla ${templateId}: ${error.message}`);
      return res.status(404).json({ 
        error: 'Plantilla no encontrada', 
        details: error.message 
      });
    }
    
    // Información básica de la plantilla
    const diagnosticResult: {
      id: any;
      name: any;
      type: any;
      created_at: any;
      updated_at: any;
      hasReactFlowJson: boolean;
      hasConfig: boolean;
      contentSummary: {
        nodesCount?: number;
        edgesCount?: number;
        startNodeExists?: boolean;
        messageNodesCount?: number;
        hasGreeting?: boolean;
        hasInitialMessage?: boolean;
        configError?: string;
      };
      messageExtractionResult: any;
      flowDiagnosis: any;
      config?: any;
    } = {
      id: template.id,
      name: template.name,
      type: template.template_type,
      created_at: template.created_at,
      updated_at: template.updated_at,
      hasReactFlowJson: !!template.react_flow_json,
      hasConfig: !!template.config,
      contentSummary: {},
      messageExtractionResult: null,
      flowDiagnosis: null
    };
    
    // Intentar extraer mensaje si hay react_flow_json
    if (template.react_flow_json) {
      try {
        // Convertir a objeto si es string
        const flowJson = typeof template.react_flow_json === 'string' 
          ? JSON.parse(template.react_flow_json) 
          : template.react_flow_json;
        
        // Extraer y analizar el mensaje
        const extractResult = findInitialMessage(flowJson);
        diagnosticResult.messageExtractionResult = extractResult;
        
        // Analizar a fondo la estructura del flujo
        diagnosticResult.flowDiagnosis = diagnoseFlow(flowJson);
        
        // Verificar estructura aproximada
        if (flowJson.nodes || flowJson.elements) {
          // Añadir un resumen de contenido
          diagnosticResult.contentSummary = {
            nodesCount: flowJson.nodes?.length || 
                      (flowJson.elements ? flowJson.elements.filter(e => e.type !== 'edge').length : 0),
            edgesCount: flowJson.edges?.length || 
                      (flowJson.elements ? flowJson.elements.filter(e => e.type === 'edge').length : 0),
            startNodeExists: !!(
              (flowJson.nodes && flowJson.nodes.find(n => n.type === 'startNode' || n.data?.type === 'startNode')) ||
              (flowJson.elements && flowJson.elements.find(e => e.type === 'startNode' || e.data?.type === 'startNode'))
            ),
            messageNodesCount: (
              (flowJson.nodes && flowJson.nodes.filter(n => n.type === 'messageNode' || n.data?.type === 'messageNode').length) ||
              (flowJson.elements && flowJson.elements.filter(e => e.type === 'messageNode' || e.data?.type === 'messageNode').length) ||
              0
            )
          };
        }
      } catch (error) {
        logger.error(`Error al analizar react_flow_json: ${error}`);
        diagnosticResult.messageExtractionResult = { 
          error: `Error al analizar react_flow_json: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          message: null,
          diagnostics: { messageSource: 'error', extractionMethod: 'error' }
        };
      }
    }
    
    // Carga de configuración
    if (template.config) {
      try {
        const config = typeof template.config === 'string' 
          ? JSON.parse(template.config) 
          : template.config;
        
        // Verifica si hay un saludo en la configuración
        diagnosticResult.contentSummary.hasGreeting = !!config.greeting;
        diagnosticResult.contentSummary.hasInitialMessage = !!config.initialMessage;
        
        // Incluir una versión segura de la configuración
        diagnosticResult.config = {
          greeting: config.greeting,
          initialMessage: config.initialMessage,
          // Otros campos relevantes...
          fields: Object.keys(config)
        };
      } catch (error) {
        logger.error(`Error al analizar config: ${error}`);
        diagnosticResult.contentSummary.configError = `Error al analizar config: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      }
    }
    
    return res.json(diagnosticResult);
  } catch (error) {
    logger.error(`Error al diagnosticar plantilla: ${error}`);
    return res.status(500).json({ 
      error: 'Error en el servidor', 
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * POST /api/templates-diagnostic/:templateId/fix-template
 * Intenta corregir problemas comunes en la plantilla
 */
router.post('/:templateId/fix-template', async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Obtener plantilla a corregir
    const { data: template, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) {
      logger.error(`Error al recuperar plantilla ${templateId}: ${error.message}`);
      return res.status(404).json({ 
        error: 'Plantilla no encontrada', 
        details: error.message 
      });
    }
    
    // Verificar si hay un flujo JSON
    if (!template.react_flow_json) {
      return res.status(400).json({
        error: 'La plantilla no tiene datos de flujo (react_flow_json)',
        message: 'Se requiere react_flow_json para corregir la plantilla'
      });
    }
    
    // Convertir a objeto si es string
    const flowJson = typeof template.react_flow_json === 'string' 
      ? JSON.parse(template.react_flow_json) 
      : template.react_flow_json;
    
    // Extraer mensaje del flujo
    const extractResult = findInitialMessage(flowJson);
    
    // Preparar la configuración
    let config = template.config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (parseError) {
        config = {};
      }
    } else if (!config) {
      config = {};
    }
    
    // Corregir configuración
    let fixed = false;
    let fixDescription = [];
    
    // Si se extrajo un mensaje del flujo, guardarlo en la configuración
    if (extractResult && extractResult.message) {
      const message = extractResult.message;
      
      // Guardar como initialMessage y greeting
      config.initialMessage = message;
      config.greeting = message;
      
      fixed = true;
      fixDescription.push(`Mensaje extraído y guardado: "${message}"`);
    } else {
      // Si no se pudo extraer, usar un mensaje amigable por defecto
      const defaultMessage = "👋 Hola, soy el asistente virtual. ¿En qué puedo ayudarte hoy?";
      config.initialMessage = defaultMessage;
      config.greeting = defaultMessage;
      
      fixed = true;
      fixDescription.push(`No se pudo extraer mensaje, utilizando default: "${defaultMessage}"`);
    }
    
    // Actualizar la configuración en Supabase
    const { error: updateError } = await supabase
      .from('chatbot_templates')
      .update({ 
        config,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);
    
    if (updateError) {
      logger.error(`Error al actualizar plantilla ${templateId}: ${updateError.message}`);
      return res.status(500).json({ 
        error: 'Error al actualizar plantilla', 
        details: updateError.message
      });
    }
    
    return res.json({
      success: true,
      templateId,
      fixed,
      fixDescription,
      extractResult
    });
  } catch (error) {
    logger.error(`Error al corregir plantilla: ${error}`);
    return res.status(500).json({ 
      error: 'Error en el servidor', 
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * POST /api/templates-diagnostic/analyze-flow
 * Analiza un flujo JSON y extrae el mensaje inicial
 */
router.post('/analyze-flow', async (req, res) => {
  try {
    const { flowJson } = req.body;

    if (!flowJson) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requiere el campo flowJson'
      });
    }

    // Analizar el flujo
    const extractResult = findInitialMessage(flowJson);
    const diagnosticResult = diagnoseFlow(flowJson);

    return res.json({
      messageExtractionResult: extractResult,
      flowDiagnosis: diagnosticResult
    });
  } catch (error) {
    logger.error(`Error al analizar flujo: ${error}`);
    return res.status(500).json({
      error: 'Error al analizar flujo',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * POST /api/templates-diagnostic/:templateId/update-message
 * Actualiza el mensaje inicial de la plantilla
 */
router.post('/:templateId/update-message', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requiere el campo "message"'
      });
    }
    
    // Obtener plantilla existente
    const { data: template, error } = await supabase
      .from('chatbot_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    
    if (error) {
      logger.error(`Error al recuperar plantilla ${templateId}: ${error.message}`);
      return res.status(404).json({ 
        error: 'Plantilla no encontrada', 
        details: error.message 
      });
    }
    
    // Preparar la configuración
    let config = template.config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (parseError) {
        config = {};
      }
    } else if (!config) {
      config = {};
    }
    
    // Actualizar mensaje
    config.initialMessage = message;
    config.greeting = message;
    
    // Actualizar la configuración en Supabase
    const { error: updateError } = await supabase
      .from('chatbot_templates')
      .update({ 
        config,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId);
    
    if (updateError) {
      logger.error(`Error al actualizar plantilla ${templateId}: ${updateError.message}`);
      return res.status(500).json({ 
        error: 'Error al actualizar plantilla', 
        details: updateError.message
      });
    }
    
    return res.json({
      success: true,
      templateId,
      message,
      configUpdated: true
    });
  } catch (error) {
    logger.error(`Error al actualizar mensaje: ${error}`);
    return res.status(500).json({ 
      error: 'Error en el servidor', 
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;