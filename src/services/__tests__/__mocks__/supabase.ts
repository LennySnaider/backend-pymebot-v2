/**
 * MOCK DE SUPABASE PARA TESTING
 * 
 * PROPÓSITO: Simular todas las operaciones de Supabase sin conexión real
 * COMPATIBILIDAD: Mantiene la misma interfaz que el cliente real
 */

import { jest } from '@jest/globals';

// Mock del cliente Supabase
export const createClient = jest.fn(() => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  containedBy: jest.fn().mockReturnThis(),
  rangeGt: jest.fn().mockReturnThis(),
  rangeGte: jest.fn().mockReturnThis(),
  rangeLt: jest.fn().mockReturnThis(),
  rangeLte: jest.fn().mockReturnThis(),
  rangeAdjacent: jest.fn().mockReturnThis(),
  overlaps: jest.fn().mockReturnThis(),
  textSearch: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  abortSignal: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  csv: jest.fn().mockResolvedValue({ data: '', error: null }),
  geojson: jest.fn().mockResolvedValue({ data: null, error: null }),
  explain: jest.fn().mockResolvedValue({ data: null, error: null }),
  rollback: jest.fn().mockResolvedValue({ data: null, error: null }),
  returns: jest.fn().mockReturnThis(),
  
  // Auth mock
  auth: {
    signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
    signInWithOAuth: jest.fn().mockResolvedValue({ data: null, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: {} } })
  },
  
  // Storage mock
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
      createSignedUrls: jest.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } })
    })
  },
  
  // Realtime mock
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue(Promise.resolve('SUBSCRIBED')),
    unsubscribe: jest.fn().mockReturnValue(Promise.resolve('UNSUBSCRIBED'))
  }),
  
  // Edge Functions mock
  functions: {
    invoke: jest.fn().mockResolvedValue({ data: null, error: null })
  }
}));

// Helpers para testing
export const mockSupabaseSuccess = (data: any) => ({
  data,
  error: null
});

export const mockSupabaseError = (message: string) => ({
  data: null,
  error: new Error(message)
});

export const resetSupabaseMocks = () => {
  jest.clearAllMocks();
};

export default {
  createClient,
  mockSupabaseSuccess,
  mockSupabaseError,
  resetSupabaseMocks
};