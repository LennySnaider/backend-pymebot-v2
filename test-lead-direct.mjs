#!/usr/bin/env node

/**
 * Script para verificar lead directamente en la base de datos
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yiggxpihbkpxsjlabzwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2d4cGloYmtweHNqbGFiendqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc0ODA5MTAsImV4cCI6MjAzMzA1NjkxMH0.mJiA3c_u4nG-aVs6WCvGGpTaaTGH1wp5v3qcAkPKcGQ';
const TENANT_ID = 'afa60b0a-3046-4607-9c48-266af6e1d322';
const LEAD_ID = 'test1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkLeadDirectly() {
  try {
    // Buscar lead directamente
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', LEAD_ID)
      .eq('tenant_id', TENANT_ID)
      .single();
    
    if (error) {
      console.error('Error al buscar lead:', error);
      // Intentar buscar todos los leads del tenant
      const { data: allLeads, error: allError } = await supabase
        .from('leads')
        .select('id, stage, name, phone')
        .eq('tenant_id', TENANT_ID)
        .limit(5);
      
      if (allError) {
        console.error('Error al buscar todos los leads:', allError);
      } else {
        console.log('Primeros 5 leads del tenant:');
        console.table(allLeads);
      }
    } else {
      console.log('Lead encontrado:', data);
      console.log('Estado actual:', data.stage);
    }
  } catch (error) {
    console.error('Error general:', error);
  }
}

checkLeadDirectly();