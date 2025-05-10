/**
 * src/api/appointments.ts
 *
 * API para gestionar citas y su configuración.
 * @version 1.0.0
 * @created 2025-07-05
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { authMiddleware } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";
import logger from "../utils/logger";

// Cliente de Supabase
const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey || config.supabase.anonKey
);

const router = express.Router();

// Middleware de autenticación
router.use(authMiddleware);

/**
 * GET /api/appointments/types
 * Obtiene los tipos de cita disponibles para un tenant
 */
router.get("/types", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenant_id = req.user.tenantId;
    
    logger.info(`Obteniendo tipos de cita para tenant: ${tenant_id}`);
    
    // Consultar tipos de cita
    const { data: appointmentTypes, error } = await supabase
      .from("tenant_appointment_types")
      .select("*")
      .eq("tenant_id", tenant_id)
      .order("name");
      
    if (error) {
      logger.error(`Error al obtener tipos de cita: ${error.message}`, error);
      throw error;
    }
    
    logger.debug(`Encontrados ${appointmentTypes?.length || 0} tipos de cita`);
    
    return res.json(appointmentTypes || []);
  } catch (error) {
    logger.error("Error en GET /appointments/types:", error);
    return res.status(500).json({ 
      error: "Error al obtener tipos de cita",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

/**
 * GET /api/appointments/settings
 * Obtiene la configuración de citas para un tenant
 */
router.get("/settings", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenant_id = req.user.tenantId;
    
    logger.info(`Obteniendo configuración de citas para tenant: ${tenant_id}`);
    
    // Consultar configuración de citas
    const { data: settings, error } = await supabase
      .from("tenant_appointment_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();
      
    if (error && error.code !== "PGRST116") {
      logger.error(`Error al obtener configuración de citas: ${error.message}`, error);
      throw error;
    }
    
    // Si no hay configuración, devolver valores por defecto
    if (!settings) {
      logger.info(`No se encontró configuración para tenant ${tenant_id}, usando valores predeterminados`);
      return res.json({
        tenant_id,
        appointment_duration: 30,
        buffer_time: 0,
        max_daily_appointments: null,
        min_notice_minutes: 60,
        max_future_days: 30,
        require_approval: false,
        reminder_time_hours: 24,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    logger.debug(`Configuración de citas obtenida para tenant: ${tenant_id}`);
    return res.json(settings);
  } catch (error) {
    logger.error("Error en GET /appointments/settings:", error);
    return res.status(500).json({ 
      error: "Error al obtener configuración de citas",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

/**
 * GET /api/appointments/availability
 * Obtiene disponibilidad de horarios para una fecha específica
 */
router.get("/availability", async (req: AuthRequest, res) => {
  try {
    // Verificar que existe usuario autenticado
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({
        error: "No autorizado",
        message: "Se requiere autenticación con información de tenant",
      });
    }

    const tenant_id = req.user.tenantId;
    const date = req.query.date as string;
    const appointment_type_id = req.query.appointment_type_id as string | undefined;
    const location_id = req.query.location_id as string | undefined;
    const agent_id = req.query.agent_id as string | undefined;
    
    // Validar fecha
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        error: "Se requiere parámetro de fecha válido (YYYY-MM-DD)" 
      });
    }
    
    logger.info(`Calculando disponibilidad para tenant ${tenant_id}, fecha ${date}`);
    
    // Parsear la fecha
    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0 (domingo) a 6 (sábado)
    
    // Consultar horarios de negocio para el día de la semana
    const { data: businessHoursData, error: businessHoursError } = await supabase
      .from("tenant_business_hours")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("day_of_week", dayOfWeek)
      .is("location_id", location_id || null)
      .single();
    
    if (businessHoursError && businessHoursError.code !== "PGRST116") {
      logger.error(`Error al obtener horarios de negocio: ${businessHoursError.message}`, businessHoursError);
      throw new Error("Error al obtener horarios de negocio");
    }
    
    // Si no hay horarios para este día, o está marcado como cerrado
    if (!businessHoursData || businessHoursData.is_closed) {
      logger.info(`Día ${date} cerrado o sin horarios configurados`);
      return res.json({
        available_slots: [],
        business_hours: {
          open_time: businessHoursData?.open_time || "00:00",
          close_time: businessHoursData?.close_time || "00:00",
          is_closed: true
        },
        date,
        is_exception_day: false
      });
    }
    
    // Verificar si hay una excepción para esta fecha
    const { data: exceptionData, error: exceptionError } = await supabase
      .from("tenant_business_hours_exceptions")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("exception_date", date)
      .is("location_id", location_id || null)
      .maybeSingle();
    
    if (exceptionError) {
      logger.error(`Error al obtener excepciones de horarios: ${exceptionError.message}`, exceptionError);
      throw new Error("Error al obtener excepciones de horarios");
    }
    
    // Si hay una excepción y está marcada como cerrado
    if (exceptionData && exceptionData.is_closed) {
      logger.info(`Día ${date} marcado como excepción (cerrado)`);
      return res.json({
        available_slots: [],
        business_hours: {
          open_time: exceptionData.open_time || "00:00",
          close_time: exceptionData.close_time || "00:00",
          is_closed: true
        },
        date,
        is_exception_day: true
      });
    }
    
    // Obtener configuración de citas
    const { data: settingsData, error: settingsError } = await supabase
      .from("tenant_appointment_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();
    
    if (settingsError && settingsError.code !== "PGRST116") {
      logger.error(`Error al obtener configuración de citas: ${settingsError.message}`, settingsError);
      throw new Error("Error al obtener configuración de citas");
    }
    
    // Si no hay configuración, usar valores predeterminados
    const settings = settingsData || {
      id: "",
      tenant_id,
      appointment_duration: 30,
      buffer_time: 0,
      max_daily_appointments: null,
      min_notice_minutes: 60,
      max_future_days: 30,
      require_approval: false,
      reminder_time_hours: 24,
      created_at: "",
      updated_at: ""
    };
    
    let appointmentType = null;
    
    // Si se especifica un tipo de cita, obtenerlo
    if (appointment_type_id) {
      const { data: typeData, error: typeError } = await supabase
        .from("tenant_appointment_types")
        .select("*")
        .eq("id", appointment_type_id)
        .eq("tenant_id", tenant_id)
        .single();
      
      if (typeError) {
        logger.error(`Error al obtener tipo de cita: ${typeError.message}`, typeError);
        throw new Error("Error al obtener tipo de cita");
      }
      
      appointmentType = typeData;
    }
    
    // Determinar duración y tiempo de buffer
    const duration = appointmentType ? appointmentType.duration_minutes : settings.appointment_duration;
    const bufferTime = appointmentType ? (appointmentType.buffer_time || 0) : settings.buffer_time;
    
    // Usar horarios de la excepción si existen, o los horarios regulares
    const openTime = exceptionData ? exceptionData.open_time : businessHoursData.open_time;
    const closeTime = exceptionData ? exceptionData.close_time : businessHoursData.close_time;
    
    // Convertir horarios a objetos Date
    const businessDate = new Date(date);
    const [openHour, openMinute] = openTime.split(":").map(Number);
    const [closeHour, closeMinute] = closeTime.split(":").map(Number);
    
    const openDateTime = new Date(businessDate);
    openDateTime.setHours(openHour, openMinute, 0, 0);
    
    const closeDateTime = new Date(businessDate);
    closeDateTime.setHours(closeHour, closeMinute, 0, 0);
    
    // Obtener citas existentes para este día
    let appointmentsQuery = supabase
      .from("tenant_appointments")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("date", date);
    
    // Filtrar por ubicación si se especifica
    if (location_id) {
      appointmentsQuery = appointmentsQuery.eq("location_id", location_id);
    }
    
    // Filtrar por agente si se especifica
    if (agent_id) {
      appointmentsQuery = appointmentsQuery.eq("agent_id", agent_id);
    }
    
    const { data: existingAppointments, error: appointmentsError } = await appointmentsQuery;
    
    if (appointmentsError) {
      logger.error(`Error al obtener citas existentes: ${appointmentsError.message}`, appointmentsError);
      throw new Error("Error al obtener citas existentes");
    }
    
    logger.debug(`Calculando slots con ${existingAppointments?.length || 0} citas existentes`);
    
    // Generar slots de tiempo desde la apertura hasta el cierre
    const totalMinutes = (closeDateTime.getTime() - openDateTime.getTime()) / (1000 * 60);
    const slots: Array<{ start: Date; end: Date; available: boolean }> = [];
    
    // Duración total de cada slot (duración de la cita + buffer)
    const totalSlotDuration = duration + bufferTime;
    
    // Comprobar si estamos planificando para hoy
    const now = new Date();
    const isToday = now.toDateString() === businessDate.toDateString();
    
    // Crear slots hasta llenar todo el horario comercial
    for (let minute = 0; minute <= totalMinutes - duration; minute += totalSlotDuration) {
      const slotStart = new Date(openDateTime.getTime() + minute * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
      
      // Si es hoy, no mostrar slots que ya han pasado o que no cumplen con el tiempo mínimo de antelación
      if (isToday) {
        const minNoticeDate = new Date(now.getTime() + settings.min_notice_minutes * 60 * 1000);
        if (slotStart < minNoticeDate) {
          continue;
        }
      }
      
      // Por defecto el slot está disponible
      let available = true;
      
      // Verificar si el slot se solapa con alguna cita existente
      for (const appointment of existingAppointments || []) {
        const appointmentStart = new Date(`${date}T${appointment.start_time}`);
        const appointmentEnd = new Date(`${date}T${appointment.end_time}`);
        
        // Si hay solapamiento, marcar como no disponible
        if (
          (slotStart >= appointmentStart && slotStart < appointmentEnd) ||
          (slotEnd > appointmentStart && slotEnd <= appointmentEnd) ||
          (slotStart <= appointmentStart && slotEnd >= appointmentEnd)
        ) {
          available = false;
          break;
        }
      }
      
      slots.push({
        start: slotStart,
        end: slotEnd,
        available
      });
    }
    
    // Filtrar solo los slots disponibles
    const availableSlots = slots.filter(slot => slot.available);
    
    // Verificar límite diario de citas (del tenant o del tipo de cita)
    const maxDailyAppointments = appointmentType?.max_daily_appointments || settings.max_daily_appointments;
    let limitedSlots = [...availableSlots];
    
    if (maxDailyAppointments !== null) {
      const existingCount = existingAppointments?.length || 0;
      const slotsAvailable = Math.max(0, maxDailyAppointments - existingCount);
      
      // Limitar la cantidad de slots si es necesario
      if (limitedSlots.length > slotsAvailable) {
        limitedSlots = limitedSlots.slice(0, slotsAvailable);
      }
    }
    
    // Formatear los slots para la respuesta
    const formattedSlots = limitedSlots.map(slot => {
      // Formato HH:MM
      const formatTime = (date: Date) => {
        return date.toTimeString().slice(0, 5);
      };
      
      return {
        start_time: formatTime(slot.start),
        end_time: formatTime(slot.end),
        start_datetime: slot.start.toISOString(),
        end_datetime: slot.end.toISOString()
      };
    });
    
    logger.info(`Disponibilidad calculada para ${date}: ${formattedSlots.length} slots disponibles`);
    
    return res.json({
      available_slots: formattedSlots,
      business_hours: {
        open_time: openTime,
        close_time: closeTime,
        is_closed: false
      },
      date,
      is_exception_day: !!exceptionData
    });
    
  } catch (error) {
    logger.error("Error en GET /appointments/availability:", error);
    return res.status(500).json({ 
      error: "Error al calcular disponibilidad",
      message: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});

export default router;