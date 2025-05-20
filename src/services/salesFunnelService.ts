/**
 * src/services/salesFunnelService.ts
 * 
 * Servicio para la integración del sales funnel con el chatbot
 * Maneja la actualización de etapas de leads cuando avanzan en el flujo del chatbot
 * 
 * @version 1.0.0
 * @created 2025-05-19
 */

import logger from "../utils/logger";
import { getSupabaseClient } from "./supabase";
import { FlowNode } from "../models/flow.types";
import { ExtendedFlowState } from "../models/extendedFlow.types";

// Interface para la metadata del sales funnel en los nodos
export interface SalesFunnelNodeData {
  salesStageId?: string; // Etapa actual del nodo
  movesToStage?: string; // Etapa a la que mueve el lead
  requiresStage?: string; // Etapa requerida para ejecutar el nodo
}

// Etapas del sales funnel - Nombres en inglés para BD
export const SALES_FUNNEL_STAGES = {
  nuevos: 'new',
  prospectando: 'prospecting',
  calificacion: 'qualification',
  oportunidad: 'opportunity',
  confirmado: 'confirmed',
  cerrado: 'closed'
};

// Mapeo español a inglés para traducir etapas del template
const stageSpanishToEnglish: { [key: string]: string } = {
  'nuevos': 'new',
  'prospectando': 'prospecting',
  'calificacion': 'qualification',
  'oportunidad': 'opportunity',
  'confirmado': 'confirmed',
  'cerrado': 'closed'
};

/**
 * Actualiza la etapa de un lead en el sales funnel
 * @param leadId ID del lead
 * @param newStage Nueva etapa del lead
 * @param tenantId ID del tenant
 * @returns true si se actualizó correctamente
 */
export async function updateLeadStage(
  leadId: string,
  newStage: string,
  tenantId: string
): Promise<boolean> {
  try {
    // Asegurar que siempre usamos etapas en inglés
    const englishStage = stageSpanishToEnglish[newStage] || newStage;
    
    logger.info(`Actualizando lead ${leadId} a etapa ${englishStage} (original: ${newStage}) para tenant ${tenantId}`);
    
    const supabase = getSupabaseClient();
    
    // Actualizar la etapa del lead
    const { error } = await supabase
      .from('leads')
      .update({
        stage: englishStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('tenant_id', tenantId);
    
    if (error) {
      logger.error(`Error al actualizar etapa del lead: ${error.message}`);
      return false;
    }
    
    logger.info(`Lead ${leadId} actualizado exitosamente a etapa ${englishStage} (original: ${newStage})`);
    return true;
  } catch (error) {
    logger.error(`Error en updateLeadStage: ${error}`);
    return false;
  }
}

/**
 * Verifica si un lead está en una etapa específica
 * @param leadId ID del lead
 * @param stageId ID de la etapa requerida
 * @param tenantId ID del tenant
 * @returns true si el lead está en la etapa especificada
 */
export async function checkLeadStage(
  leadId: string,
  stageId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    
    // Traducir etapa de español a inglés si es necesario
    const translatedStage = stageSpanishToEnglish[stageId] || stageId;
    
    const { data, error } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error || !data) {
      logger.error(`Error al verificar etapa del lead: ${error?.message}`);
      return false;
    }
    
    logger.info(`[SALES FUNNEL DEBUG] Verificando etapa - Lead stage: ${data.stage}, Required stage: ${translatedStage} (original: ${stageId})`);
    
    return data.stage === translatedStage;
  } catch (error) {
    logger.error(`Error en checkLeadStage: ${error}`);
    return false;
  }
}

/**
 * Procesa las acciones del sales funnel asociadas a un nodo
 * @param node Nodo actual del flujo
 * @param state Estado del flujo
 * @returns true si se procesó correctamente
 */
export async function processSalesFunnelActions(
  node: FlowNode,
  state: ExtendedFlowState
): Promise<boolean> {
  try {
    // Log detallado para debugging
    logger.info(`[SALES FUNNEL DEBUG] Procesando nodo: ${node.id}`);
    logger.info(`[SALES FUNNEL DEBUG] Tipo de nodo: ${node.type}`);
    logger.info(`[SALES FUNNEL DEBUG] Metadata del nodo: ${JSON.stringify(node.metadata)}`);
    logger.info(`[SALES FUNNEL DEBUG] node.data: ${JSON.stringify(node.data)}`);
    
    // Verificar si el nodo tiene metadata del sales funnel - También verificar en node.data
    const funnelData = (node.metadata || node.data) as SalesFunnelNodeData;
    
    if (!funnelData) {
      logger.info(`[SALES FUNNEL DEBUG] Nodo ${node.id} no tiene datos del sales funnel`);
      return true; // No hay acciones del sales funnel, continuar
    }
    
    logger.info(`[SALES FUNNEL DEBUG] Datos del funnel encontrados: ${JSON.stringify(funnelData)}`);
    logger.info(`[SALES FUNNEL DEBUG] salesStageId: ${funnelData.salesStageId}`);
    logger.info(`[SALES FUNNEL DEBUG] movesToStage: ${funnelData.movesToStage}`);
    logger.info(`[SALES FUNNEL DEBUG] requiresStage: ${funnelData.requiresStage}`);
    
    // SI no hay acciones específicas del sales funnel, continuar
    if (!funnelData.salesStageId && !funnelData.movesToStage && !funnelData.requiresStage) {
      logger.info(`[SALES FUNNEL DEBUG] Nodo ${node.id} no tiene acciones del sales funnel definidas`);
      return true;
    }
    
    // Obtener el lead ID del contexto o directamente del estado
    let leadId = state.leadId || state.lead_id || state.context?.leadId || state.context?.lead_id;
    const tenantId = state.tenantId || state.tenant_id || 'default';
    
    logger.info(`[SALES FUNNEL DEBUG] Lead ID: ${leadId}`);
    logger.info(`[SALES FUNNEL DEBUG] Tenant ID: ${tenantId}`);
    logger.info(`[SALES FUNNEL DEBUG] Estado completo: ${JSON.stringify(state)}`);
    
    if (!leadId) {
      logger.warn(`[SALES FUNNEL DEBUG] No se encontró leadId en el contexto para procesar acciones del sales funnel`);
      return true; // Continuar sin error
    }
    
    // Normalizar el almacenamiento del leadId en todos los lugares posibles para mantener consistencia
    if (leadId) {
      if (!state.leadId) state.leadId = leadId;
      if (!state.lead_id) state.lead_id = leadId;
      if (!state.context) state.context = {};
      if (!state.context.leadId) state.context.leadId = leadId;
      if (!state.context.lead_id) state.context.lead_id = leadId;
    }
    
    // 1. Verificar si el lead cumple con la etapa requerida
    if (funnelData.requiresStage) {
      const hasRequiredStage = await checkLeadStage(
        leadId,
        funnelData.requiresStage,
        tenantId
      );
      
      if (!hasRequiredStage) {
        logger.info(`Lead ${leadId} no cumple con la etapa requerida ${funnelData.requiresStage}`);
        return false; // No se puede ejecutar este nodo
      }
    }
    
    // 2. Actualizar la etapa del lead si el nodo lo requiere
    // Verificar tanto movesToStage como salesStageId
    let targetStageId = funnelData.movesToStage || funnelData.salesStageId;
    
    logger.info(`[SALES FUNNEL DEBUG] Verificando cambio de etapa - movesToStage: ${funnelData.movesToStage}, salesStageId: ${funnelData.salesStageId}`);
    
    if (targetStageId) {
      // Traducir de español a inglés si es necesario
      const translatedStage = stageSpanishToEnglish[targetStageId] || targetStageId;
      
      logger.info(`[SALES FUNNEL DEBUG] Etapa original: ${targetStageId}, Etapa traducida: ${translatedStage}`);
      logger.info(`[SALES FUNNEL DEBUG] Intentando mover lead ${leadId} a etapa ${translatedStage}`);
      
      const updated = await updateLeadStage(
        leadId,
        translatedStage,
        tenantId
      );
      
      if (!updated) {
        logger.error(`[SALES FUNNEL DEBUG] ERROR: No se pudo mover lead ${leadId} a etapa ${targetStageId}`);
        // Continuar aunque falle la actualización
      } else {
        // Actualizar el contexto con la nueva etapa (en inglés)
        if (!state.context) {
          state.context = {};
        }
        state.context.currentLeadStage = translatedStage;
        logger.info(`[SALES FUNNEL DEBUG] Lead ${leadId} movido exitosamente a etapa ${translatedStage} (original: ${targetStageId})`);
      }
    } else {
      logger.info(`[SALES FUNNEL DEBUG] Nodo ${node.id} no tiene configurada ninguna etapa de destino`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error en processSalesFunnelActions: ${error}`);
    return true; // Continuar aunque haya error
  }
}

/**
 * Obtiene la información de la etapa actual de un lead
 * @param leadId ID del lead
 * @param tenantId ID del tenant
 * @returns Información de la etapa o null si hay error
 */
export async function getLeadStageInfo(
  leadId: string,
  tenantId: string
): Promise<{
  stageId: string;
  stageName: string;
} | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('leads')
      .select('stage')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error || !data) {
      logger.error(`Error al obtener información de etapa del lead: ${error?.message}`);
      return null;
    }
    
    // Mapeo de IDs de etapa a nombres
    const stageNames: Record<string, string> = {
      nuevos: 'Nuevos',
      prospectando: 'Prospectando',
      calificacion: 'Calificación',
      oportunidad: 'Oportunidad',
      confirmado: 'Confirmado',
      cerrado: 'Cerrado'
    };
    
    return {
      stageId: data.stage,
      stageName: stageNames[data.stage] || data.stage
    };
  } catch (error) {
    logger.error(`Error en getLeadStageInfo: ${error}`);
    return null;
  }
}

export default {
  updateLeadStage,
  checkLeadStage,
  processSalesFunnelActions,
  getLeadStageInfo,
  SALES_FUNNEL_STAGES
};