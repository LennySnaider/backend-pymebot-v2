import { Router } from "express";
import { handleTextChat, handleTextChatNoAuth, handleIntegratedChat } from "./text";
import { getTenantTemplatesWithFlows } from "../services/supabase";
import { config } from "../config";
import logger from "../utils/logger";

const router = Router();

// Rutas del API de texto
router.post("/chat", handleTextChat);
router.post("/chatbot", handleTextChatNoAuth);
router.post("/integrated-message", handleIntegratedChat);

// Endpoint para obtener plantillas sin autenticación completa
router.get("/templates", async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || config.multitenant.defaultTenant;
    
    logger.info(`[API text/templates] Obteniendo plantillas para tenant: ${tenantId}`);
    
    // Llamar a la función que obtiene plantillas y flowId
    const templatesWithFlows = await getTenantTemplatesWithFlows(tenantId as string);
    
    logger.info(`[API text/templates] Plantillas encontradas: ${templatesWithFlows.length}`);

    // Mapear para asegurar la estructura esperada por el frontend
    const frontendTemplates = templatesWithFlows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      avatarUrl: t.avatarUrl || "/img/avatars/thumb-placeholder.jpg",
      isActive: t.is_active,
      isEnabled: true,
      tokensEstimated: t.tokens_estimated || 500,
      category: t.category || "general",
      flowId: t.flowId,
    }));

    return res.json({
      success: true,
      templates: frontendTemplates
    });
  } catch (error) {
    logger.error(
      `Error al obtener plantillas para tenant ${req.query.tenant_id}:`,
      error
    );
    return res.status(500).json({
      success: false,
      error: "Error al obtener plantillas del tenant",
      details: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Endpoint para crear o actualizar activación de plantilla
router.post("/templates/activate", async (req, res) => {
  try {
    const { template_id, tenant_id } = req.body;
    
    if (!template_id || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: "Se requieren template_id y tenant_id"
      });
    }
    
    logger.info(`[API text/templates/activate] Activando plantilla ${template_id} para tenant ${tenant_id}`);
    
    const { getSupabaseAdminClient, getValidTenantUuid } = await import("../services/supabase");
    const supabase = getSupabaseAdminClient();
    
    // Convertir tenant_id a UUID válido
    // Si es "default", usar el UUID default configurado
    const tenantUuid = tenant_id === "default" 
      ? config.multitenant.defaultTenantUuid 
      : getValidTenantUuid(tenant_id);
    
    // Primero, desactivar todas las activaciones existentes para este tenant
    const { error: updateError } = await supabase
      .from("tenant_chatbot_activations")
      .update({ is_active: false })
      .eq("tenant_id", tenantUuid);
      
    if (updateError) {
      logger.error("Error al desactivar plantillas existentes:", updateError);
    }
    
    // Buscar si ya existe una activación para esta plantilla y tenant
    const { data: existingActivation, error: searchError } = await supabase
      .from("tenant_chatbot_activations")
      .select("id")
      .eq("template_id", template_id)
      .eq("tenant_id", tenantUuid)
      .single();
      
    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error("Error al buscar activación existente:", searchError);
    }
    
    let activationId;
    
    if (existingActivation) {
      // Si ya existe, actualizarla para activarla
      const { data: updatedActivation, error: activateError } = await supabase
        .from("tenant_chatbot_activations")
        .update({ 
          is_active: true
        })
        .eq("id", existingActivation.id)
        .select("id")
        .single();
        
      if (activateError) {
        throw activateError;
      }
      
      activationId = updatedActivation.id;
      logger.info(`Activación existente ${activationId} actualizada`);
    } else {
      // Primero obtener la versión de la plantilla
      const { data: templateData, error: templateError } = await supabase
        .from("chatbot_templates")
        .select("version")
        .eq("id", template_id)
        .single();
        
      if (templateError || !templateData) {
        logger.error("Error al obtener versión de plantilla:", templateError);
        throw new Error("No se pudo obtener la versión de la plantilla");
      }
      
      // Si no existe, crear una nueva activación
      const { data: newActivation, error: createError } = await supabase
        .from("tenant_chatbot_activations")
        .insert({
          template_id,
          tenant_id: tenantUuid,
          is_active: true,
          template_version: templateData.version || "1.0.0"
        })
        .select("id")
        .single();
        
      if (createError) {
        throw createError;
      }
      
      activationId = newActivation.id;
      logger.info(`Nueva activación ${activationId} creada`);
    }
    
    return res.json({
      success: true,
      activationId,
      message: "Plantilla activada correctamente"
    });
    
  } catch (error) {
    logger.error("Error al activar plantilla:", error);
    return res.status(500).json({
      success: false,
      error: "Error al activar plantilla",
      details: error instanceof Error ? error.message : "Error desconocido"
    });
  }
});


// Endpoint para verificar variables del sistema
router.get("/variables/check", async (req, res) => {
  try {
    const tenantId = (req.query.tenant_id as string) || config.multitenant.defaultTenant;
    logger.info(`[Variables Check] Verificando variables para tenant: ${tenantId}`);
    
    const { getSystemVariablesForTenant } = await import("../utils/systemVariablesLoader");
    const { getSupabaseClient } = await import("../services/supabase");
    
    // 1. Obtener variables del sistema
    const systemVariables = await getSystemVariablesForTenant(tenantId);
    
    // 2. Buscar datos del tenant directamente
    const supabase = getSupabaseClient();
    const tenantUuid = tenantId === "default" ? config.multitenant.defaultTenantUuid : tenantId;
    
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, website, contact_email, phone_number, city, address")
      .eq("id", tenantUuid)
      .single();
      
    return res.json({
      tenantId,
      tenantUuid,
      systemVariables,
      tenantData,
      error: tenantError?.message
    });
  } catch (error) {
    logger.error("[Variables Check] Error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

export default router;