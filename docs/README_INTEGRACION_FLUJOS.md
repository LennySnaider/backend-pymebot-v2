# Integración del Ciclo Completo de Plantillas para PYMEBOT

## Objetivo

Implementar y probar el flujo completo para la creación y uso de plantillas en PYMEBOT.

## Requisitos

1. Implementar el flujo para crear una plantilla en el constructor visual (chatbot builder).
2. Verificar cómo se guarda y convierte en un formato accesible para el chat.
3. Asegurar que aparezca en el selector de plantillas del chat.
4. Probar el sistema de activación/desactivación desde la interfaz.
5. Validar que los parámetros de configuración de la plantilla (modelo, temperatura, etc.) se apliquen correctamente cuando se usa en el chat.

## Pasos a Realizar

### 1. Implementar el flujo para crear una plantilla en el constructor visual (chatbot builder)

- **Archivos a revisar/modificar:**
  - `agentprop/src/app/(protected-pages)/concepts/marketing/chat/_components/TemplateConfigModal.tsx`
  - `voiceAgentBot/src/api/templates.ts`
  - `voiceAgentBot/src/services/templateService.ts`

### 2. Verificar cómo se guarda y convierte en un formato accesible para el chat

- **Archivos a revisar/modificar:**
  - `voiceAgentBot/src/services/templateService.ts`
  - `voiceAgentBot/src/api/templates.ts`

### 3. Asegurar que aparezca en el selector de plantillas del chat

- **Archivos a revisar/modificar:**
  - `agentprop/src/app/(protected-pages)/concepts/marketing/chat/_components/ChatBody.tsx`
  - `voiceAgentBot/src/services/templateService.ts`

### 4. Probar el sistema de activación/desactivación desde la interfaz

- **Archivos a revisar/modificar:**
  - `agentprop/src/app/(protected-pages)/concepts/marketing/chat/_components/TemplateConfigModal.tsx`
  - `voiceAgentBot/src/services/templateService.ts`

### 5. Validar que los parámetros de configuración de la plantilla se apliquen correctamente cuando se usa en el chat

- **Archivos a revisar/modificar:**
  - `voiceAgentBot/src/services/templateService.ts`
  - `voiceAgentBot/src/api/templates.ts`
  - `voiceAgentBot/src/services/flowProcessor.ts`

## Mejoras Adicionales

- Mejorar la visualización de costos y tokens en la interfaz.
- **Archivos a revisar/modificar:**
  - `agentprop/src/app/(protected-pages)/concepts/marketing/chat/_components/TemplateConfigModal.tsx`
  - `agentprop/src/app/(protected-pages)/concepts/marketing/chat/_components/ChatBody.tsx`
  - `voiceAgentBot/src/services/templateService.ts`
