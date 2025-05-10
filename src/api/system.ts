/**
 * src/api/system.ts
 *
 * API para información y diagnóstico del sistema
 * Proporciona endpoints para verificar el estado y configuración
 * @version 1.0.0
 * @updated 2025-05-10
 */

import express from 'express';
import { config } from '../config';
import { checkSupabaseConnection } from '../config/supabase';
import logger from '../utils/logger';
import os from 'os';

const router = express.Router();

/**
 * GET /api/system/health
 * Proporciona información sobre el estado de salud del sistema
 */
router.get('/health', async (req, res) => {
  try {
    // Obtener información sobre conexiones a servicios externos
    const supabaseStatus = await checkSupabaseConnection();
    
    // Información del sistema
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100, // GB
        free: Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100, // GB
      },
      uptime: Math.round(os.uptime() / 60 / 60 * 10) / 10, // Hours
      loadavg: os.loadavg(),
    };
    
    return res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: config.environment,
      version: '1.0.0',
      services: {
        supabase: supabaseStatus,
      },
      system: systemInfo,
    });
  } catch (error) {
    logger.error(`Error al obtener información de salud: ${error}`);
    return res.status(500).json({
      status: 'error',
      message: 'Error al obtener información de salud',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * GET /api/system/config
 * Proporciona información sobre la configuración actual
 */
router.get('/config', (req, res) => {
  // No devolver información sensible
  const safeConfig = {
    environment: config.environment,
    port: config.port,
    whatsapp: {
      enabled: config.whatsapp?.enabled || false,
    },
    multitenant: {
      enabled: config.multitenant?.enabled || false,
    },
    cors: {
      enabled: true,
    },
  };
  
  return res.json(safeConfig);
});

/**
 * GET /api/system/cors-test
 * Endpoint para probar que CORS está configurado correctamente
 */
router.get('/cors-test', (req, res) => {
  // Obtener el origen de la solicitud
  const origin = req.headers.origin || 'Unknown';
  
  // Información detallada para depuración
  const requestInfo = {
    headers: {
      origin,
      host: req.headers.host,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
    },
    ip: req.ip,
    method: req.method,
    path: req.path,
  };
  
  return res.json({
    message: '¡CORS configurado correctamente!',
    origin,
    timestamp: new Date().toISOString(),
    request: requestInfo,
  });
});

/**
 * POST /api/system/echo
 * Devuelve la misma información que se le envía (para depuración)
 */
router.post('/echo', (req, res) => {
  return res.json({
    message: 'Echo received',
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });
});

export default router;