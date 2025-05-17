/**
 * src/config/supabase.ts
 * 
 * Configuración del cliente Supabase para acceso a la base de datos
 * Proporciona una instancia del cliente de Supabase para usar en la aplicación
 * @version 1.0.0
 * @updated 2025-05-10
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '.';
import logger from '../utils/logger';

// URL y clave de API de Supabase
const supabaseUrl = config.supabase?.url || process.env.SUPABASE_URL;
const supabaseKey = config.supabase?.serviceKey || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Verificar que tenemos las credenciales necesarias
if (!supabaseUrl || !supabaseKey) {
  logger.error('❌ SUPABASE URL o KEY no configurados. Muchas funciones no estarán disponibles.');
}

// Crear el cliente de Supabase, pero solo si tenemos las credenciales
// Si no hay credenciales, creamos un mock del cliente para evitar errores
let supabaseClient;

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    logger.info('Cliente Supabase inicializado correctamente');
  } catch (error) {
    logger.error(`Error al inicializar cliente Supabase: ${error}`);
    // Creamos un cliente mock
    supabaseClient = createSupabaseMock();
  }
} else {
  logger.warn('Credenciales de Supabase no configuradas, usando cliente mock');
  supabaseClient = createSupabaseMock();
}

export const supabase = supabaseClient;

// Función para crear un mock del cliente de Supabase
function createSupabaseMock() {
  const mockResponse = {
    data: null,
    error: {
      message: 'Supabase no está configurado'
    }
  };

  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(mockResponse),
        order: () => Promise.resolve(mockResponse),
        limit: () => Promise.resolve(mockResponse),
        single: () => Promise.resolve(mockResponse),
      }),
      update: () => ({
        eq: () => Promise.resolve(mockResponse)
      }),
      insert: () => Promise.resolve(mockResponse),
      delete: () => ({
        eq: () => Promise.resolve(mockResponse)
      })
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve(mockResponse),
        download: () => Promise.resolve(mockResponse),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    },
    auth: {
      signIn: () => Promise.resolve(mockResponse),
      signOut: () => Promise.resolve(mockResponse)
    },
    rpc: () => Promise.resolve(mockResponse)
  };
}

// Función para verificar la conexión a Supabase
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    // Intentar una consulta simple para verificar que podemos conectar
    const { error } = await supabase
      .from('chatbot_templates')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error(`Error al verificar conexión a Supabase: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Error al conectar con Supabase: ${error}`);
    return false;
  }
}

// Exportamos el cliente por defecto
export default supabase;