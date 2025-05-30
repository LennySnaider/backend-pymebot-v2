/**
 * src/services/productsService.ts
 * Servicio para gestionar productos y categorías
 * @version 1.0.0
 * @created 2025-01-30
 */

import { getSupabaseClient } from './supabase';
import logger from '../utils/logger';

// Cache para verificar si las tablas existen
let tablesChecked = false;
let tablesExist = false;

export interface ProductCategory {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  parent_id?: string;
  display_order: number;
  is_active: boolean;
  metadata?: any;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  duration_minutes?: number;
  is_active: boolean;
  display_order: number;
  metadata?: any;
}

/**
 * Verifica si las tablas de productos existen
 */
async function checkTablesExist(): Promise<boolean> {
  if (tablesChecked) {
    return tablesExist;
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Intentar hacer una consulta simple para verificar si la tabla existe
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    tablesChecked = true;
    tablesExist = !error;
    
    if (error) {
      logger.warn('[checkTablesExist] Las tablas de productos no existen aún:', error.message);
    } else {
      logger.info('[checkTablesExist] Las tablas de productos están disponibles');
    }
    
    return tablesExist;
  } catch (error) {
    logger.error('[checkTablesExist] Error verificando tablas:', error);
    tablesChecked = true;
    tablesExist = false;
    return false;
  }
}

/**
 * Obtiene las categorías activas de un tenant
 */
export async function getActiveCategories(tenantId: string): Promise<ProductCategory[]> {
  try {
    // Verificar primero si las tablas existen
    const tablesReady = await checkTablesExist();
    if (!tablesReady) {
      logger.warn('[getActiveCategories] Las tablas no están listas, devolviendo array vacío');
      return [];
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      logger.error(`Error obteniendo categorías para tenant ${tenantId}:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error en getActiveCategories:', error);
    return [];
  }
}

/**
 * Obtiene los productos activos de un tenant
 * @param tenantId ID del tenant
 * @param categoryId Opcional: filtrar por categoría
 * @param limit Opcional: límite de productos a devolver
 */
export async function getActiveProducts(
  tenantId: string, 
  categoryId?: string,
  limit?: number
): Promise<Product[]> {
  try {
    logger.info(`[getActiveProducts] Iniciando búsqueda de productos para tenant: ${tenantId}, categoryId: ${categoryId}, limit: ${limit}`);
    
    // Verificar primero si las tablas existen
    const tablesReady = await checkTablesExist();
    if (!tablesReady) {
      logger.warn('[getActiveProducts] Las tablas no están listas, devolviendo array vacío');
      return [];
    }
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    
    if (limit && limit > 0) {
      query = query.limit(limit);
    }
    
    logger.info(`[getActiveProducts] Ejecutando query...`);
    const { data, error } = await query;
    
    if (error) {
      logger.error(`[getActiveProducts] Error obteniendo productos para tenant ${tenantId}:`, error);
      logger.error(`[getActiveProducts] Detalles del error:`, JSON.stringify(error));
      return [];
    }
    
    logger.info(`[getActiveProducts] Productos obtenidos: ${data?.length || 0}`);
    return data || [];
  } catch (error) {
    logger.error('[getActiveProducts] Error general:', error);
    logger.error('[getActiveProducts] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return [];
  }
}

/**
 * Obtiene los productos activos formateados para el chatbot
 * @param tenantId ID del tenant
 * @param categoryId Opcional: filtrar por categoría
 * @param limit Opcional: límite de productos
 * @returns Array de strings con los nombres de los productos
 */
export async function getProductsForChatbot(
  tenantId: string,
  categoryId?: string,
  limit?: number
): Promise<string[]> {
  try {
    const products = await getActiveProducts(tenantId, categoryId, limit);
    
    // Formatear los productos para el chatbot
    return products.map(product => {
      // Si tiene precio y duración, incluirlos
      let productText = product.name;
      
      if (product.price) {
        productText += ` - ${product.currency || '$'}${product.price}`;
      }
      
      if (product.duration_minutes) {
        productText += ` (${product.duration_minutes} min)`;
      }
      
      return productText;
    });
  } catch (error) {
    logger.error('Error en getProductsForChatbot:', error);
    return [];
  }
}

/**
 * Obtiene los detalles completos de los productos para el chatbot
 * Útil cuando se necesita más información que solo el nombre
 */
export async function getProductDetailsForChatbot(
  tenantId: string,
  categoryId?: string,
  limit?: number
): Promise<Array<{name: string, description?: string, price?: number, duration?: number}>> {
  try {
    const products = await getActiveProducts(tenantId, categoryId, limit);
    
    return products.map(product => ({
      name: product.name,
      description: product.description,
      price: product.price,
      duration: product.duration_minutes
    }));
  } catch (error) {
    logger.error('Error en getProductDetailsForChatbot:', error);
    return [];
  }
}

/**
 * Obtiene categorías específicamente formateadas para el chatbot
 * @param tenantId ID del tenant
 * @param showSubcategories Si true, muestra subcategorías en lugar de categorías padre
 * @returns Array de strings con nombres de categorías
 */
export async function getCategoriesForChatbot(tenantId: string, showSubcategories: boolean = false): Promise<string[]> {
  try {
    const categories = await getActiveCategories(tenantId);
    
    let filteredCategories: ProductCategory[];
    
    if (showSubcategories) {
      // Mostrar solo subcategorías (categorías que tienen parent_id)
      filteredCategories = categories.filter(category => category.parent_id !== null);
    } else {
      // Mostrar solo categorías padre (categorías que NO tienen parent_id)
      filteredCategories = categories.filter(category => category.parent_id === null);
    }
    
    return filteredCategories.map(category => {
      // Formato: "Nombre" o "Nombre - Descripción" si hay descripción
      if (category.description) {
        return `${category.name} - ${category.description}`;
      }
      return category.name;
    });
  } catch (error) {
    logger.error(`Error en getCategoriesForChatbot para tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Obtiene las subcategorías de una categoría específica
 * @param tenantId ID del tenant
 * @param parentCategoryId ID de la categoría padre
 * @returns Array de subcategorías
 */
export async function getSubcategories(tenantId: string, parentCategoryId: string): Promise<ProductCategory[]> {
  try {
    // Verificar primero si las tablas existen
    const tablesReady = await checkTablesExist();
    if (!tablesReady) {
      logger.warn('[getSubcategories] Las tablas no están listas, devolviendo array vacío');
      return [];
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('parent_id', parentCategoryId)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (error) {
      logger.error(`Error obteniendo subcategorías para tenant ${tenantId}, parent ${parentCategoryId}:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error en getSubcategories:', error);
    return [];
  }
}

/**
 * Obtiene estructura jerárquica de categorías (padre -> hijos)
 * @param tenantId ID del tenant
 * @returns Mapa de categorías padre con sus subcategorías
 */
export async function getCategoriesHierarchy(tenantId: string): Promise<Map<ProductCategory, ProductCategory[]>> {
  try {
    const allCategories = await getActiveCategories(tenantId);
    const hierarchy = new Map<ProductCategory, ProductCategory[]>();
    
    // Separar categorías padre e hijas
    const parentCategories = allCategories.filter(cat => cat.parent_id === null);
    const childCategories = allCategories.filter(cat => cat.parent_id !== null);
    
    // Construir jerarquía
    parentCategories.forEach(parent => {
      const children = childCategories.filter(child => child.parent_id === parent.id);
      hierarchy.set(parent, children);
    });
    
    return hierarchy;
  } catch (error) {
    logger.error('Error en getCategoriesHierarchy:', error);
    return new Map();
  }
}