/**
 * src/services/categoriesService.ts
 * 
 * Servicio para obtener categorías dinámicas del tenant
 * Compatible con sistema modular V1
 */

import { supabase } from '../config/supabase';
import logger from '../utils/logger';

/**
 * Obtiene las categorías de productos para un tenant específico filtradas por vertical
 */
export async function getTenantProductCategories(tenantId: string, vertical: string = 'bienes_raices'): Promise<string[]> {
  try {
    logger.info(`[CategoriesService] Obteniendo categorías de productos para tenant: ${tenantId}, vertical: ${vertical}`);

    // Consultar tabla product_categories para obtener categorías filtradas por vertical
    const { data: categories, error } = await supabase
      .from('product_categories')
      .select('id, name, metadata, parent_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error(`[CategoriesService] Error consultando product_categories:`, error);
      // Fallback a categorías por defecto
      return ['Comprar', 'Rentar'];
    }

    if (!categories || categories.length === 0) {
      logger.warn(`[CategoriesService] No hay categorías para tenant ${tenantId}, usando por defecto`);
      return ['Comprar', 'Rentar'];
    }

    // Filtrar por vertical usando metadata
    const filteredCategories = categories.filter((cat: any) => {
      const catVertical = cat.metadata?.vertical;
      return catVertical === vertical || catVertical === 'bienes_raices' || catVertical === 'inmobiliaria';
    });
    
    // Obtener IDs de categorías que son padres (tienen subcategorías)
    const parentIds = new Set(filteredCategories
      .filter((cat: any) => cat.parent_id !== null)
      .map((cat: any) => cat.parent_id)
    );
    
    // Filtrar solo categorías que NO son padres (categorías finales/hoja)
    const leafCategories = filteredCategories.filter((cat: any) => !parentIds.has(cat.id));
    
    // Extraer nombres únicos de categorías
    const uniqueCategories = [...new Set(leafCategories.map((cat: any) => cat.name))] as string[];
    
    logger.info(`[CategoriesService] Categorías filtradas encontradas para tenant ${tenantId} y vertical ${vertical}:`, uniqueCategories);
    
    return uniqueCategories.length > 0 ? uniqueCategories : ['Comprar', 'Rentar'];

  } catch (error) {
    logger.error(`[CategoriesService] Error obteniendo categorías para tenant ${tenantId}:`, error);
    // Fallback a categorías por defecto en caso de error
    return ['Comprar', 'Rentar'];
  }
}

/**
 * Obtiene las categorías de servicios para un tenant específico (función original)
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

    // Simplificar consulta - solo obtener productos directamente
    const { data: products, error } = await supabase
      .from('products')
      .select('name, category_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      logger.error(`[CategoriesService] Error consultando productos:`, error);
      // Fallback a productos por defecto
      return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
    }

    if (!products || products.length === 0) {
      logger.warn(`[CategoriesService] No hay productos para tenant ${tenantId}, usando por defecto`);
      return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
    }

    // Si se especifica categoría, filtrar por nombre de categoría
    let filteredProducts = products;
    if (category) {
      // Obtener ID de la categoría por nombre
      const { data: categoryData, error: catError } = await supabase
        .from('product_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', category)
        .eq('is_active', true)
        .single();

      if (catError) {
        logger.warn(`[CategoriesService] No se encontró categoría ${category}, retornando todos los productos`);
        logger.warn(`[CategoriesService] Error detalle:`, catError);
      } else if (categoryData) {
        logger.info(`[CategoriesService] ID de categoría '${category}': ${categoryData.id}`);
        filteredProducts = products.filter((prod: any) => prod.category_id === categoryData.id);
        logger.info(`[CategoriesService] Productos filtrados para categoría ${category}:`, filteredProducts.length);
      }
    }

    const productNames = filteredProducts.map((prod: any) => prod.name) as string[];
    
    logger.info(`[CategoriesService] Productos encontrados:`, productNames);
    
    return productNames.length > 0 ? productNames : ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];

  } catch (error) {
    logger.error(`[CategoriesService] Error obteniendo productos:`, error);
    // Fallback a productos por defecto
    return ['Venta de Propiedades', 'Alquiler de Propiedades', 'Asesoría Inmobiliaria'];
  }
}