/**
 * src/flows/lead-capture.flow.ts
 *
 * Implementación del flujo de captura de leads en BuilderBot
 * basado en la plantilla "Flujo Básico Lead".
 *
 * Este flujo demuestra la transformación de una plantilla visual
 * a código de BuilderBot con énfasis en la gestión correcta de estado
 * y variables para permitir integración entre múltiples plantillas.
 *
 * @version 1.0.1
 * @created 2025-05-10
 * @updated 2025-10-05
 */

import { addKeyword, addAction, createFlow } from "@builderbot/bot";
import { logAuditAction, AuditActionType } from "../services/auditService";
import { saveConversationState, loadConversationState } from "../services/stateManager";
import logger from "../utils/logger";

/**
 * Flujo de captura y calificación de leads implementado con BuilderBot
 *
 * Este flujo mantiene el estado persistente para permitir:
 * - Integración con otras plantillas
 * - Recuperación de conversaciones interrumpidas
 * - Uso de variables en múltiples flujos
 * - Sincronización del estado con Supabase
 */
const leadCaptureFlowDefinition = addKeyword(['INICIO', 'HOLA', 'LEAD'])
  /**
   * Mensaje de bienvenida (messageNode-welcome)
   */
  .addAnswer(
    '👋 Hola, soy el asistente virtual de AgentProp. ¿En qué puedo ayudarte hoy?',
    null,
    async (ctx, { flowDynamic, state }) => {
      try {
        // Intentamos cargar estado existente primero
        const sessionId = ctx.message?.sessionId || `session-${ctx.from}-${Date.now()}`;
        const tenantId = ctx?.message?.tenantId || 'default';
        const userId = ctx.from || 'unknown';
        
        // Intentamos recuperar el estado guardado en la base de datos
        const savedState = await loadConversationState(tenantId, userId, sessionId);
        
        // Si hay estado guardado, lo cargamos en el estado de BuilderBot
        if (savedState && Object.keys(savedState).length > 0) {
          logger.info(`Restaurando estado existente para sesión ${sessionId}`);
          await state.update(savedState);
        } else {
          logger.info(`Iniciando nueva conversación con sesión ${sessionId}`);
          // Inicializamos el estado con datos básicos de la sesión
          await state.update({
            flow_id: 'lead-capture',
            session_id: sessionId,
            tenant_id: tenantId,
            user_id: userId,
            started_at: new Date().toISOString(),
            last_updated_at: new Date().toISOString()
          });
        }

        // Registramos el inicio de la conversación
        await logAuditAction({
          action: AuditActionType.CHAT_START,
          userId: userId,
          tenantId: tenantId,
          resourceId: 'lead-capture',
          resourceType: 'flow',
          resourceName: 'Flujo Básico Lead',
          details: {
            channel: ctx?.message?.channel || 'unknown',
            platformId: userId,
            sessionId: sessionId
          }
        }).catch(err => logger.error('Error al registrar inicio de chat:', err));

        // Enviamos la siguiente pregunta (solicitamos nombre)
        await flowDynamic('Para brindarte una mejor atención, ¿podrías decirme tu nombre?');
      } catch (error) {
        logger.error('Error al iniciar flujo lead-capture:', error);
        await flowDynamic('Para brindarte una mejor atención, ¿podrías decirme tu nombre?');
      }
    }
  )

  /**
   * Captura de nombre (inputNode-nombre)
   */
  .addAnswer(
    null, // No enviamos texto adicional aquí
    { capture: true }, // Capturamos la respuesta
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const nombre = ctx.body;
        
        // Actualizamos tanto el estado local como la variable específica
        await state.update({ 
          nombre_usuario: nombre,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-nombre'
        });

        logger.info(`Nombre capturado: ${nombre}`);
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos la siguiente pregunta (solicitamos email)
        await flowDynamic(`Gracias ${nombre}. ¿Cuál es tu correo electrónico?`);
      } catch (error) {
        logger.error('Error al capturar nombre:', error);
        // En caso de error, continuamos con la siguiente pregunta
        await flowDynamic('¿Cuál es tu correo electrónico?');
      }
    }
  )

  /**
   * Captura de email (inputNode-email)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const email = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          email_usuario: email,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-email'
        });

        logger.info(`Email capturado: ${email}`);
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos la siguiente pregunta (solicitamos teléfono)
        await flowDynamic('¿Y tu número de teléfono?');
      } catch (error) {
        logger.error('Error al capturar email:', error);
        await flowDynamic('¿Y tu número de teléfono?');
      }
    }
  )

  /**
   * Captura de teléfono (inputNode-phone)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const telefono = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          telefono_usuario: telefono,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-phone'
        });

        logger.info(`Teléfono capturado: ${telefono}`);
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos el mensaje de introducción a las preguntas de calificación
        await flowDynamic(`Gracias por tus datos, ${currentState.nombre_usuario}. Para poder ayudarte mejor, necesito hacerte algunas preguntas sobre lo que estás buscando.`);
        await flowDynamic('¿Estás buscando una propiedad para comprar o rentar?');
      } catch (error) {
        logger.error('Error al capturar teléfono:', error);
        await flowDynamic('Para poder ayudarte mejor, necesito hacerte algunas preguntas sobre lo que estás buscando. ¿Estás buscando una propiedad para comprar o rentar?');
      }
    }
  )

  /**
   * Captura de preferencia compra/renta (inputNode-q1)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const compraRenta = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          compra_renta: compraRenta,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-q1'
        });
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos la siguiente pregunta de calificación
        await flowDynamic('¿Qué tipo de propiedad estás buscando? (casa, departamento, oficina, etc.)');
      } catch (error) {
        logger.error('Error al capturar preferencia:', error);
        await flowDynamic('¿Qué tipo de propiedad estás buscando? (casa, departamento, oficina, etc.)');
      }
    }
  )

  /**
   * Captura de tipo de propiedad (inputNode-q2)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const tipoPropiedad = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          tipo_propiedad: tipoPropiedad,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-q2'
        });
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos la siguiente pregunta de calificación
        await flowDynamic('¿Cuál es tu presupuesto aproximado?');
      } catch (error) {
        logger.error('Error al capturar tipo de propiedad:', error);
        await flowDynamic('¿Cuál es tu presupuesto aproximado?');
      }
    }
  )

  /**
   * Captura de presupuesto (inputNode-q3)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const presupuesto = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          presupuesto: presupuesto,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-q3',
          
          // También marcamos que el lead está parcialmente calificado
          lead_status: 'qualified',
          lead_qualification_date: new Date().toISOString()
        });
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Enviamos el mensaje de lead calificado
        await flowDynamic(`¡Excelente ${currentState.nombre_usuario}! Basado en tus respuestas, tenemos varias propiedades que podrían interesarte. Me gustaría que uno de nuestros asesores te contacte para mostrarte opciones personalizadas.`);
        
        // Preguntamos si quiere agendar una cita
        await flowDynamic('¿Te gustaría agendar una cita con uno de nuestros asesores? (sí/no)');
      } catch (error) {
        logger.error('Error al capturar presupuesto:', error);
        await flowDynamic('¿Te gustaría agendar una cita con uno de nuestros asesores? (sí/no)');
      }
    }
  )

  /**
   * Captura confirmación de cita y bifurcación condicional (inputNode-agendar + condicion-cita)
   */
  .addAnswer(
    null,
    { capture: true },
    async (ctx, { flowDynamic, state }) => {
      try {
        // Obtenemos el estado actual
        const currentState = await state.get();
        const confirmaCita = ctx.body.toLowerCase();
        
        // Actualizamos el estado
        await state.update({ 
          confirma_cita: confirmaCita,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'condicion-cita'
        });
        
        // Determinamos la ruta a seguir (bifurcación condicional)
        const quiereCita = confirmaCita.includes('sí') || 
                          confirmaCita.includes('si') || 
                          confirmaCita === 'si' || 
                          confirmaCita === 'sí';
        
        // Actualizamos el estado con la decisión
        await state.update({
          quiere_agendar_cita: quiereCita
        });
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));

        // Implementamos el nodo condicional
        if (quiereCita) {
          // Ruta SI - Agendamos fecha
          await flowDynamic('¿Para qué fecha te gustaría agendar la cita? (formato: DD/MM/YYYY)');
        } else {
          // Ruta NO - Mensaje sin cita
          await flowDynamic('No hay problema. Uno de nuestros asesores se pondrá en contacto contigo pronto para proporcionarte información sobre propiedades que podrían interesarte.');
          
          // Enviamos mensaje de despedida
          await flowDynamic('Gracias por usar nuestro asistente virtual. Si tienes más preguntas o necesitas ayuda adicional, no dudes en contactarnos. ¡Que tengas un excelente día!');
          
          // Actualizamos el estado como completado
          await state.update({
            conversation_status: 'completed',
            end_time: new Date().toISOString(),
            completed_flow: true
          });
          
          // Guardamos el estado final
          await saveConversationState(
            tenantId, 
            userId, 
            sessionId, 
            await state.get()
          ).catch(err => logger.warn('Error al guardar estado final:', err));
          
          // Registramos la finalización del flujo
          await logAuditAction({
            action: AuditActionType.CHAT_COMPLETED,
            userId: userId,
            tenantId: tenantId,
            resourceId: 'lead-capture',
            resourceType: 'flow',
            resourceName: 'Flujo Básico Lead',
            details: {
              leadCaptured: true,
              appointmentScheduled: false,
              leadData: {
                nombre: currentState.nombre_usuario,
                email: currentState.email_usuario,
                telefono: currentState.telefono_usuario,
                tipoPropiedad: currentState.tipo_propiedad,
                presupuesto: currentState.presupuesto,
                compraRenta: currentState.compra_renta
              }
            }
          }).catch(err => logger.error('Error al registrar finalización de chat:', err));
        }
      } catch (error) {
        logger.error('Error al procesar confirmación de cita:', error);
        await flowDynamic('Lo siento, hubo un problema al procesar tu respuesta. Por favor, intenta nuevamente más tarde o contacta directamente con nuestro equipo de atención al cliente.');
      }
    }
  )

  /**
   * Captura de fecha (inputNode-fecha) - Solo para la ruta SI
   */
  .addAction(async (ctx, { flowDynamic, state }) => {
    try {
      const currentState = await state.get();
      
      // Solo procesamos si estamos en la ruta de confirmar cita
      if (currentState.quiere_agendar_cita === true) {
        // Capturamos la fecha
        const fechaCita = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          fecha_cita: fechaCita,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'inputNode-fecha'
        });
        
        // Guardamos el estado en la base de datos para persistencia
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado de conversación:', err));
        
        // Preguntamos por la hora
        await flowDynamic('¿A qué hora prefieres? Tenemos disponibilidad entre 9 AM y 6 PM');
      }
    } catch (error) {
      logger.error('Error al capturar fecha de cita:', error);
    }
  })

  /**
   * Captura de hora (inputNode-hora) - Solo para la ruta SI
   */
  .addAction(async (ctx, { flowDynamic, state }) => {
    try {
      const currentState = await state.get();
      
      // Solo procesamos si estamos en la ruta de confirmar cita y ya tenemos fecha
      if (currentState.quiere_agendar_cita === true && currentState.fecha_cita) {
        // Capturamos la hora
        const horaCita = ctx.body;
        
        // Actualizamos el estado
        await state.update({ 
          hora_cita: horaCita,
          last_updated_at: new Date().toISOString(),
          last_node_id: 'messageNode-cita-confirmada',
          
          // Actualizamos el estado de la conversación
          conversation_status: 'completed',
          end_time: new Date().toISOString(),
          completed_flow: true,
          
          // Marcamos que se agendó una cita
          appointment_scheduled: true,
          appointment_date: currentState.fecha_cita,
          appointment_time: horaCita
        });
        
        // Confirmamos la cita
        await flowDynamic(`¡Perfecto! Tu cita ha sido agendada para el ${currentState.fecha_cita} a las ${horaCita}. Te enviaremos un correo con los detalles y uno de nuestros asesores se comunicará contigo pronto.`);
        
        // Enviamos mensaje de despedida
        await flowDynamic('Gracias por usar nuestro asistente virtual. Si tienes más preguntas o necesitas ayuda adicional, no dudes en contactarnos. ¡Que tengas un excelente día!');
        
        // Guardamos el estado final en la base de datos
        const sessionId = currentState.session_id || ctx.message?.sessionId;
        const tenantId = currentState.tenant_id || ctx?.message?.tenantId;
        const userId = currentState.user_id || ctx.from;
        
        await saveConversationState(
          tenantId, 
          userId, 
          sessionId, 
          await state.get()
        ).catch(err => logger.warn('Error al guardar estado final de conversación:', err));
        
        // Registramos la finalización del flujo con cita
        await logAuditAction({
          action: AuditActionType.CHAT_COMPLETED,
          userId: userId,
          tenantId: tenantId,
          resourceId: 'lead-capture',
          resourceType: 'flow',
          resourceName: 'Flujo Básico Lead',
          details: {
            leadCaptured: true,
            appointmentScheduled: true,
            appointmentDate: currentState.fecha_cita,
            appointmentTime: horaCita,
            leadData: {
              nombre: currentState.nombre_usuario,
              email: currentState.email_usuario,
              telefono: currentState.telefono_usuario,
              tipoPropiedad: currentState.tipo_propiedad,
              presupuesto: currentState.presupuesto,
              compraRenta: currentState.compra_renta
            }
          }
        }).catch(err => logger.error('Error al registrar finalización de chat con cita:', err));
      }
    } catch (error) {
      logger.error('Error al capturar hora de cita:', error);
    }
  });

// Creamos un adaptador de flujo completo utilizando el flujo definido arriba
// Esto es crucial para que podamos acceder a handleMsg y otras funciones del flow adapter
const leadCaptureFlow = createFlow([leadCaptureFlowDefinition]);

// Exportamos el adaptador completo que contiene el método handleMsg
export default leadCaptureFlow;