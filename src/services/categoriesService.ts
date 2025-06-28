/**
 * src/services/categoriesService.ts
 * 
 * Servicio para obtener categorías dinámicas del tenant
 * Compatible con sistema modular V1
 */

import { supabase } from '../config/supabase';
import logger from '../utils/logger';

/**
 * Obtiene las categorías de servicios para un tenant específico
 */
export async function getTenantCategories(tenantId: string): Promise<string[]> {
  try {
    logger.info(`[CategoriesService] Obteniendo categorías para tenant: ${tenantId}`);

    // Consultar tabla de servicios para obtener categorías únicas
    const { data: categories, error } = await supabase
      .from('services')
      .select('category')
      .eq('tenant_id', tenantId)
      .not('category', 'is', null)
      .order('category');

    if (error) {
      logger.error(`[CategoriesService] Error consultando categorías:`, error);
      // Fallback a categorías por defecto
      return ['Residencial', 'Comercial', 'Industrial'];
    }

    if (!categories || categories.length === 0) {
      logger.warn(`[CategoriesService] No hay categorías para tenant ${tenantId}, usando por defecto`);
      return ['Residencial', 'Comercial', 'Industrial'];
    }

    // Extraer nombres únicos de categorías
    const uniqueCategories = [...new Set(categories.map((cat: any) => cat.category))] as string[];
    
    logger.info(`[CategoriesService] Categorías encontradas para tenant ${tenantId}:`, uniqueCategories);
    
    return uniqueCategories;

  } catch (error) {
    logger.error(`[CategoriesService] Error obteniendo categorías para tenant ${tenantId}:`, error);
    // Fallback a categorías por defecto en caso de error
    return ['Residencial', 'Comercial', 'Industrial'];
  }
}

/**
 * Obtiene los productos/servicios para una categoría específica de un tenant
 */
export async function getTenantProducts(tenantId: string, category?: string): Promise<string[]> {
  try {
    logger.info(`[CategoriesService] Obteniendo productos para tenant: ${tenantId}, categoría: ${category}`);

    let query = supabase
      .from('services')
      .select('name')
      .eq('tenant_id', tenantId)
      .not('name', 'is', null);

    // Filtrar por categoría si se proporciona
    if (category) {
      query = query.eq('category', category);
    }

    const { data: products, error } = await query.order('name');

    if (error) {
      logger.error(`[CategoriesService] Error consultando productos:`, error);
      // Fallback a productos por defecto
      return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
    }

    if (!products || products.length === 0) {
      logger.warn(`[CategoriesService] No hay productos para tenant ${tenantId}, categoría ${category}, usando por defecto`);
      return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
    }

    const productNames = products.map((prod: any) => prod.name) as string[];
    
    logger.info(`[CategoriesService] Productos encontrados:`, productNames);
    
    return productNames;

  } catch (error) {
    logger.error(`[CategoriesService] Error obteniendo productos:`, error);
    // Fallback a productos por defecto
    return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
  }
}