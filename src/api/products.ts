/**
 * src/api/products.ts
 * API endpoints para gestión de productos/servicios
 * @version 1.0.0
 * @created 2025-01-30
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/products
 * Obtiene todos los productos del tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { category_id, is_active } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('products')
      .select('*, category:product_categories(id, name)')
      .eq('tenant_id', tenantId)
      .order('display_order', { ascending: true });
    
    if (category_id) {
      query = query.eq('category_id', category_id as string);
    }
    
    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error obteniendo productos:', error);
      return res.status(500).json({ error: 'Error al obtener productos' });
    }
    
    res.json(data || []);
  } catch (error) {
    logger.error('Error en GET /products:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/products/:id
 * Obtiene un producto específico
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('*, category:product_categories(id, name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      logger.error('Error obteniendo producto:', error);
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /products/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/products
 * Crea un nuevo producto
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const { 
      category_id,
      name, 
      description, 
      price,
      currency,
      duration_minutes,
      is_active,
      display_order,
      metadata 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        category_id,
        name,
        description,
        price,
        currency: currency || 'USD',
        duration_minutes,
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0,
        metadata: metadata || {},
        created_by: userId,
        updated_by: userId
      })
      .select('*, category:product_categories(id, name)')
      .single();
    
    if (error) {
      logger.error('Error creando producto:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Ya existe un producto con ese nombre en la categoría seleccionada' });
      }
      return res.status(500).json({ error: 'Error al crear producto' });
    }
    
    res.status(201).json(data);
  } catch (error) {
    logger.error('Error en POST /products:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/products/:id
 * Actualiza un producto
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const { 
      category_id,
      name, 
      description, 
      price,
      currency,
      duration_minutes,
      is_active,
      display_order,
      metadata 
    } = req.body;
    
    const supabase = getSupabaseClient();
    
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    
    if (category_id !== undefined) updateData.category_id = category_id;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (currency !== undefined) updateData.currency = currency;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (metadata !== undefined) updateData.metadata = metadata;
    
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, category:product_categories(id, name)')
      .single();
    
    if (error) {
      logger.error('Error actualizando producto:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Ya existe un producto con ese nombre en la categoría seleccionada' });
      }
      return res.status(500).json({ error: 'Error al actualizar producto' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Error en PUT /products/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/products/:id
 * Elimina un producto (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    // Soft delete - solo marcar como inactivo
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error eliminando producto:', error);
      return res.status(500).json({ error: 'Error al eliminar producto' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (error) {
    logger.error('Error en DELETE /products/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/products/bulk-update-order
 * Actualiza el orden de múltiples productos
 */
router.post('/bulk-update-order', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const { updates } = req.body; // Array de { id, display_order }
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Se requiere un array de actualizaciones' });
    }
    
    const supabase = getSupabaseClient();
    
    // Actualizar cada producto
    const promises = updates.map(({ id, display_order }) =>
      supabase
        .from('products')
        .update({ display_order })
        .eq('id', id)
        .eq('tenant_id', tenantId)
    );
    
    const results = await Promise.all(promises);
    
    // Verificar si hubo errores
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      logger.error('Errores actualizando orden de productos:', errors);
      return res.status(500).json({ error: 'Error al actualizar orden de productos' });
    }
    
    res.json({ message: 'Orden actualizado exitosamente' });
  } catch (error) {
    logger.error('Error en POST /products/bulk-update-order:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;