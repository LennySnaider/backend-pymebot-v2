/**
 * src/flows/index.ts
 * 
 * Punto de entrada principal para todos los flujos modulares
 */

export { createMainFlow, createFallbackFlow } from './mainFlow';
export * as ModularFlows from './nodes';

// Re-exportar flujos específicos para fácil acceso
export { default as CategoriesFlow } from './nodes/CategoriesFlow';
export { default as ProductsFlow } from './nodes/ProductsFlow';
export { default as MessageFlow } from './nodes/MessageFlow';