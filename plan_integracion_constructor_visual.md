# Plan de Integración de Plantillas Dinámicas

Este documento describe los pasos para eliminar el hard-code de flujos y soportar plantillas cargadas dinámicamente desde el **Constructor Visual** (chatbot builder) en PYMEBOT.

## Diagrama de Flujo (Mermaid)

```mermaid
flowchart TD
  subgraph UI
    A[Constructor Visual] -->|Guardar plantilla| B[(chatbot_templates)]
    C[Selector de Plantilla] --> D[Cliente React]
  end

  subgraph Backend
    B --> E[templateService.getTemplateById]
    E --> F[flowService.instantiateTemplate]
    F --> G[(flows) & (flow_nodes)]
    G --> H[FlowRepository.transformToRuntimeFlow]
    H --> I[flowProcessor]
    I --> J[botFlowIntegration]
    D -->|POST /instantiate| E
    D -->|GET flujo activo| J
  end

  subgraph Chat
    J --> K[Proveedor de Mensajes (WhatsApp/Web)]
    K --> L[Usuario]
  end
```

---

## Tareas Detalladas

1. **Detectar y eliminar flujos estáticos**

   - Revisar `voiceAgentBot/src/flows/*.flow.ts` y `voiceAgentBot/src/templates/*.ts` para localizar mensajes hardcodeados (por ejemplo: “¿Hay algo más en lo que pueda ayudarte?”).
   - Conservar estos archivos solo como ejemplos y retirarlos del ciclo de ejecución en producción.

2. **Unificar carga dinámica de plantillas**

   - En `templateService.getTemplateById`, asegurar consulta a **`chatbot_templates`**.
   - En `templateService.instantiateTemplate`, generar un nuevo flujo en `flows` y `flow_nodes` con `parent_template_id` apuntando a la plantilla seleccionada.

3. **Refactorizar el procesador de flujo**

   - En `flowProcessor`, eliminar rutas o pasos que usen datos estáticos y ejecutar siempre el `RuntimeFlow` proveniente de `getActiveTenantFlow`.
   - Asegurar que cada nodo se lea de la base de datos (`flow_nodes`) según su tipo, contenido y siguiente.

4. **Ajustar la integración del bot**

   - En `botFlowIntegration`, al iniciar la sesión invocar `flowService.getFlowByTenant(tenantId)`.
   - En el endpoint `/api/flows`, eliminar referencias a archivos `.flow.ts` y usar la lógica de flujos dinámicos.

5. **Visualización de costos y tokens en la UI**

   - En `ChatBody.tsx` y `TemplateConfigModal.tsx`, añadir sección o badge con:
     - Tokens estimados vs usados
     - Costo aproximado (tarifa por token)
   - Implementar un hook/contexto que recupere el uso actual desde la tabla `usage`.

6. **Pruebas e integración continua**

   - Crear tests en `voiceAgentBot/tests/flow_integration_test.js` que:
     1. Publiquen una plantilla de prueba en `chatbot_templates`.
     2. Llamen a `/templates/:id/instantiate` y verifiquen inserción en `flows`.
     3. Simulen una conversación, comprobando que el bot sigue los nodos definidos dinámicamente.
   - Añadir pruebas unitarias para `templateService` y `flowService`.

7. **Despliegue y limpieza**
   - Eliminar código muerto (archivos `.flow.ts` obsoletos).
   - Actualizar `docs/README_INTEGRACION_FLUJOS.md` con el ciclo completo de plantillas dinámicas.
   - Realizar un reinicio limpio del backend para cargar todas las correcciones.

---

**Estado actual**: pendiente de refactorizar código en los servicios y rutas de API, y añadir las pruebas de integración.
