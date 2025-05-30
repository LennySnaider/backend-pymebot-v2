/**
 * src/api/product-categories.ts
 * API endpoints para gestión de categorías de productos
 * @version 1.0.0
 * @created 2025-01-30
 */

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabase';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/product-categories
 * Obtiene todas las categorías del tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('product_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('display_order', { ascending: true });
    
    if (error) {
      logger.error('Error obteniendo categorías:', error);
      return res.status(500).json({ error: 'Error al obtener categorías' });
    }
    
    res.json(data || []);
  } catch (error) {
    logger.error('Error en GET /product-categories:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/product-categories/:id
 * Obtiene una categoría específica
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
      .from('product_categories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (error) {
      logger.error('Error obteniendo categoría:', error);
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Error en GET /product-categories/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/product-categories
 * Crea una nueva categoría
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const { name, description, parent_id, display_order, is_active, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        tenant_id: tenantId,
        name,
        description,
        parent_id,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        metadata: metadata || {},
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creando categoría:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      }
      return res.status(500).json({ error: 'Error al crear categoría' });
    }
    
    res.status(201).json(data);
  } catch (error) {
    logger.error('Error en POST /product-categories:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/product-categories/:id
 * Actualiza una categoría
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const { name, description, parent_id, display_order, is_active, metadata } = req.body;
    
    const supabase = getSupabaseClient();
    
    const updateData: any = {
      updated_by: userId,
      updated_at: new Date().toISOString()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parent_id !== undefined) updateData.parent_id = parent_id;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (metadata !== undefined) updateData.metadata = metadata;
    
    const { data, error } = await supabase
      .from('product_categories')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error actualizando categoría:', error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
      }
      return res.status(500).json({ error: 'Error al actualizar categoría' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json(data);
  } catch (error) {
    logger.error('Error en PUT /product-categories/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/product-categories/:id
 * Elimina una categoría (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID es requerido' });
    }
    
    const supabase = getSupabaseClient();
    
    // Soft delete - solo marcar como inactiva
    const { data, error } = await supabase
      .from('product_categories')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error) {
      logger.error('Error eliminando categoría:', error);
      return res.status(500).json({ error: 'Error al eliminar categoría' });
    }
    
    if (!data) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    logger.error('Error en DELETE /product-categories/:id:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;