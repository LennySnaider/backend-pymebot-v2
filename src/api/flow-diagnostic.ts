/**
 * src/api/flow-diagnostic.ts
 *
 * Endpoint de diagnóstico para flujos de chatbot
 * Proporciona información detallada sobre el estado y funcionamiento de los flujos
 * @version 1.0.0
 * @updated 2025-05-08
 */

import express from 'express';
import { FlowService } from '../services/flowService';
import { diagnoseFlow, findInitialMessage } from '../services/chatbotUtils';
import { clearFlowState } from '../services/botFlowIntegration';
import logger from '../utils/logger';

const router = express.Router();
const flowService = new FlowService();

/**
 * GET /api/flow-diagnostic/active/:tenantId
 * Diagnostica el flujo activo para un tenant específico
 */
router.get('/active/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Obtenemos el flujo activo
    const activeFlow = await flowService.getFlowByTenant(tenantId);
    
    if (!activeFlow) {
      return res.status(404).json({ 
        error: 'Flujo no encontrado', 
        message: `No hay flujo activo para el tenant ${tenantId}`
      });
    }
    
    // Realizamos diagnóstico completo
    const diagnosticReport = {
      flowId: activeFlow.id,
      flowName: activeFlow.name,
      entryNodeId: activeFlow.entryNodeId,
      nodesCount: Object.keys(activeFlow.nodes).length,
      hasEntryNode: !!activeFlow.nodes[activeFlow.entryNodeId],
      entryNodeType: activeFlow.nodes[activeFlow.entryNodeId]?.type || 'unknown',
      detailedAnalysis: diagnoseFlow({
        nodes: Object.values(activeFlow.nodes).map(node => ({
          id: node.id,
          type: node.type,
          data: {
            content: node.content,
            type: node.type,
            ...node.metadata
          },
          position: { x: node.x || 0, y: node.y || 0 }
        })),
        edges: Object.values(activeFlow.nodes)
          .filter(node => node.next || node.nextNodeId)
          .flatMap(node => {
            if (typeof node.next === 'string') {
              return [{
                id: `${node.id}-${node.next}`,
                source: node.id,
                target: node.next
              }];
            } else if (Array.isArray(node.next)) {
              return node.next.map((next, index) => ({
                id: `${node.id}-${next.nextNodeId}-${index}`,
                source: node.id,
                target: next.nextNodeId,
                label: next.condition ? `Condición ${index + 1}` : ''
              }));
            } else if (node.nextNodeId) {
              return [{
                id: `${node.id}-${node.nextNodeId}`,
                source: node.id,
                target: node.nextNodeId
              }];
            }
            return [];
          })
      })
    };
    
    return res.json(diagnosticReport);
  } catch (error) {
    logger.error('Error al generar diagnóstico de flujo:', error);
    return res.status(500).json({ 
      error: 'Error al generar diagnóstico', 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * POST /api/flow-diagnostic/find-first-message
 * Analiza un flujo para encontrar el primer mensaje
 */
router.post('/find-first-message', async (req, res) => {
  try {
    const { flowJson } = req.body;
    
    if (!flowJson) {
      return res.status(400).json({ 
        error: 'Datos incompletos', 
        message: 'Se requiere el campo flowJson' 
      });
    }
    
    const result = findInitialMessage(flowJson);
    return res.json(result);
  } catch (error) {
    logger.error('Error al analizar flujo por mensaje inicial:', error);
    return res.status(500).json({ 
      error: 'Error al analizar flujo', 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * POST /api/flow-diagnostic/reset-session
 * Reinicia el estado de una sesión de flujo
 */
router.post('/reset-session', async (req, res) => {
  try {
    const { userId, tenantId, sessionId } = req.body;
    
    if (!userId || !tenantId) {
      return res.status(400).json({ 
        error: 'Datos incompletos', 
        message: 'Se requieren los campos userId y tenantId' 
      });
    }
    
    // Limpiamos el estado de la sesión
    clearFlowState(userId, tenantId, sessionId);
    
    return res.json({ 
      success: true, 
      message: `Estado de flujo reiniciado para ${userId} en tenant ${tenantId}`
    });
  } catch (error) {
    logger.error('Error al reiniciar estado de flujo:', error);
    return res.status(500).json({ 
      error: 'Error al reiniciar estado', 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /api/flow-diagnostic/test-message/:tenantId
 * Prueba el envío de un mensaje a través del flujo sin guardar estado
 */
router.post('/test-message/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { message, userId = 'test-user', sessionId = `test-session-${Date.now()}` } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Datos incompletos', 
        message: 'Se requiere el campo message' 
      });
    }
    
    // Obtenemos el flujo activo
    const activeFlow = await flowService.getFlowByTenant(tenantId);
    
    if (!activeFlow) {
      return res.status(404).json({ 
        error: 'Flujo no encontrado', 
        message: `No hay flujo activo para el tenant ${tenantId}`
      });
    }
    
    // Procesamos el mensaje sin guardar estado
    const result = await flowService.processMessage(
      message,
      userId,
      sessionId,
      tenantId,
      undefined,
      activeFlow
    );
    
    return res.json({
      input: message,
      response: result.response,
      metrics: result.metrics,
      currentNodeId: result.state.currentNodeId,
      visitedNodes: result.state.history,
    });
  } catch (error) {
    logger.error('Error al probar mensaje en flujo:', error);
    return res.status(500).json({ 
      error: 'Error al procesar mensaje', 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

export default router;