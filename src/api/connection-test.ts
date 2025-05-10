/**
 * src/api/connection-test.ts
 *
 * API de prueba específicamente para diagnosticar problemas de conectividad
 * Proporciona endpoints para verificar si hay problemas de CORS o red
 * @version 1.0.0
 * @updated 2025-05-10
 */

import express from 'express';
import logger from '../utils/logger';
import { config } from '../config';

const router = express.Router();

/**
 * GET /connection-test/ping
 * Endpoint simple para verificar que el servidor está respondiendo
 */
router.get('/ping', (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  
  logger.info(`Ping recibido desde ${origin}`);
  
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    origin,
    message: 'Servidor respondiendo correctamente'
  });
});

/**
 * POST /connection-test/echo
 * Devuelve la misma información que recibe
 */
router.post('/echo', (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  
  logger.info(`Echo request desde ${origin}`);
  
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    received: req.body,
    headers: req.headers,
    message: 'Echo funcionando correctamente'
  });
});

/**
 * POST /connection-test/chat-simulate
 * Simula una llamada a chat sin procesamiento real
 */
router.post('/chat-simulate', (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  const message = req.body.text || 'Sin mensaje';
  const userId = req.body.user_id || 'test-user';
  const sessionId = req.body.session_id || `session-${Date.now()}`;
  const templateId = req.body.template_id || 'test-template';
  
  logger.info(`Simulación de chat desde ${origin}`);
  logger.info(`Mensaje: "${message}", Usuario: ${userId}, Plantilla: ${templateId}`);
  
  // Simulamos un pequeño retraso para que parezca un procesamiento real
  setTimeout(() => {
    return res.json({
      success: true,
      response: `Simulación de respuesta para: "${message}"`,
      timestamp: new Date().toISOString(),
      debug: {
        received: {
          message,
          userId,
          sessionId,
          templateId
        },
        headers: req.headers
      }
    });
  }, 500);
});

/**
 * GET /connection-test/detailed
 * Proporciona información detallada sobre la conexión
 */
router.get('/detailed', (req, res) => {
  const origin = req.headers.origin || 'Unknown';
  
  logger.info(`Prueba detallada desde ${origin}`);
  
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: {
      environment: config.environment,
      port: config.port,
      nodejs: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    },
    request: {
      ip: req.ip,
      method: req.method,
      path: req.path,
      protocol: req.protocol,
      secure: req.secure,
      headers: req.headers
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      credentials: true
    }
  });
});

/**
 * OPTIONS preflight handler
 * Responde a las solicitudes OPTIONS directamente
 */
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

export default router;