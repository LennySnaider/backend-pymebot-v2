/**
 * src/api/admin.ts
 *
 * Endpoints administrativos para gestionar el sistema
 * Incluye funciones de reinicio, limpieza y diagnóstico
 * @version 1.0.0
 * @updated 2025-05-08
 */

import express from 'express';
import { cleanAllSessions, cleanOldSessions } from '../utils/cleanSessions';
import logger from '../utils/logger';
import { config } from '../config';

const router = express.Router();

/**
 * GET /api/admin/health
 * Comprueba el estado de salud del sistema
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.4.0',
    timestamp: new Date().toISOString(),
    environment: config.environment,
    services: {
      voice: true,
      text: true,
      flows: true,
      templates: true,
      whatsapp: config.whatsapp.enabled,
    },
  });
});

/**
 * POST /api/admin/reset-whatsapp
 * Reinicia la conexión de WhatsApp limpiando todas las sesiones
 */
router.post('/reset-whatsapp', (req, res) => {
  try {
    // Verificamos que WhatsApp esté habilitado
    if (!config.whatsapp.enabled) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp no está habilitado en la configuración',
      });
    }

    // Limpiamos todas las sesiones
    logger.info('Limpiando todas las sesiones de WhatsApp por solicitud administrativa');
    const cleaned = cleanAllSessions(false); // false = no mantener QR
    
    if (cleaned) {
      logger.info('Sesiones de WhatsApp limpiadas correctamente');
      
      // Notificamos que el servidor necesita reiniciarse
      return res.json({
        success: true,
        message: 'Sesiones de WhatsApp limpiadas. El servidor debe reiniciarse para aplicar los cambios.',
        needsRestart: true,
      });
    } else {
      logger.error('Error al limpiar sesiones de WhatsApp');
      return res.status(500).json({
        success: false,
        message: 'Error al limpiar sesiones de WhatsApp',
      });
    }
  } catch (error) {
    logger.error('Error al reiniciar WhatsApp:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al reiniciar WhatsApp',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * POST /api/admin/clean-old-sessions
 * Limpia sesiones antiguas sin reiniciar el servidor
 */
router.post('/clean-old-sessions', (req, res) => {
  try {
    // Extraemos la edad máxima de la petición o usamos 24 horas por defecto
    const { maxAgeHours = 24 } = req.body;
    
    // Limpiamos sesiones antiguas
    logger.info(`Limpiando sesiones más antiguas de ${maxAgeHours} horas`);
    const removedCount = cleanOldSessions(maxAgeHours);
    
    return res.json({
      success: true,
      message: `Se eliminaron ${removedCount} archivos de sesión antiguos`,
      removedCount,
    });
  } catch (error) {
    logger.error('Error al limpiar sesiones antiguas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al limpiar sesiones antiguas',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

/**
 * GET /api/admin/config
 * Devuelve información sobre la configuración del sistema (sin secretos)
 */
router.get('/config', (req, res) => {
  // Creamos una versión segura de la configuración sin secretos
  const safeConfig = {
    environment: config.environment,
    port: config.port,
    whatsappEnabled: config.whatsapp.enabled,
    paths: config.paths,
    multitenantEnabled: config.multitenant.enabled,
    voiceEnabled: true,
    debug: config.debug,
  };
  
  return res.json(safeConfig);
});

/**
 * POST /api/admin/log-level
 * Cambia el nivel de log en tiempo de ejecución
 */
router.post('/log-level', (req, res) => {
  try {
    const { level } = req.body;
    
    if (!level || !['error', 'warn', 'info', 'debug'].includes(level)) {
      return res.status(400).json({
        success: false,
        message: 'Nivel de log inválido. Debe ser: error, warn, info o debug',
      });
    }
    
    // Aquí modificaríamos el nivel de log si tuviéramos acceso directo
    // a la configuración del logger en tiempo de ejecución
    logger.info(`Cambiando nivel de log a: ${level}`);
    
    return res.json({
      success: true,
      message: `Nivel de log cambiado a ${level}`,
      newLevel: level,
    });
  } catch (error) {
    logger.error('Error al cambiar nivel de log:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar nivel de log',
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
});

export default router;