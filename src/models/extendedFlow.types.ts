/**
 * Tipos extendidos para el sistema de flujos
 * Agregan propiedades no definidas en los tipos base
 */

import { FlowState } from "./flow.types";

/**
 * Estado de flujo extendido con propiedades adicionales
 */
export interface ExtendedFlowState extends FlowState {
  tenantId?: string;
  variables?: Record<string, any>;
  currentLeadStage?: string; // Etapa actual del lead en el sales funnel
  [key: string]: any; // Permitir propiedades adicionales
}