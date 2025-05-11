# Solución de Problemas de Chatbot y Estado de Conversación

Este documento describe problemas comunes encontrados en el sistema de chatbot y sus soluciones, especialmente relacionados con la gestión del estado de conversaciones y la compatibilidad con Supabase.

## Tabla de Contenidos

1. [Problemas de Esquema de Base de Datos](#1-problemas-de-esquema-de-base-de-datos)
2. [Manejo de IDs y UUIDs](#2-manejo-de-ids-y-uuids)
3. [Carga de Plantillas](#3-carga-de-plantillas)

## 1. Problemas de Esquema de Base de Datos

### Columna `session_id` en Tabla `conversation_sessions`

**Problema**: El código del backend intenta acceder a una columna `session_id` en la tabla `conversation_sessions`, pero esta columna no existía en el esquema original.

**Error característico**:
```
[ERROR] Error al cargar estado de conversación: column conversation_sessions.session_id does not exist
```

**Solución aplicada**:
Se creó un script SQL para añadir la columna faltante:

```sql
-- Verificar si la columna existe antes de intentar crearla
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'conversation_sessions'
        AND column_name = 'session_id'
    ) THEN
        -- Añadir la columna session_id
        ALTER TABLE conversation_sessions 
        ADD COLUMN session_id TEXT;
        
        -- Generar un valor único para cada fila existente
        UPDATE conversation_sessions 
        SET session_id = id::text 
        WHERE session_id IS NULL;
        
        -- Hacer la columna NOT NULL después de llenarla
        ALTER TABLE conversation_sessions 
        ALTER COLUMN session_id SET NOT NULL;
        
        -- Añadir un índice para búsquedas eficientes
        CREATE INDEX IF NOT EXISTS idx_conversation_sessions_session_id
        ON conversation_sessions(session_id);
        
        -- Añadir una restricción única (tenant_id, session_id)
        ALTER TABLE conversation_sessions
        ADD CONSTRAINT unique_tenant_session
        UNIQUE (tenant_id, session_id);
    END IF;
END $$;
```

## 2. Manejo de IDs y UUIDs

### Problema con IDs No-UUID en Campos UUID

**Problema**: El código a veces enviaba el string "default" como valor para campos que esperaban UUIDs válidos, causando errores de sintaxis SQL.

**Error característico**:
```
[ERROR] Error al cargar estado de conversación: invalid input syntax for type uuid: "default"
```

**Solución aplicada**:
Se creó una función de validación de UUID que maneja automáticamente valores no-UUID como "default":

```sql
-- Función para convertir a UUID válido
CREATE OR REPLACE FUNCTION get_valid_tenant_uuid(tenant_input TEXT)
RETURNS UUID AS $$
BEGIN
    -- Si el input es 'default' o NULL, devolver el UUID por defecto
    IF tenant_input IS NULL OR tenant_input = 'default' OR tenant_input = '' THEN
        RETURN '00000000-0000-0000-0000-000000000000'::UUID;
    END IF;
    
    -- Intentar convertir a UUID, en caso de error devolver el UUID por defecto
    BEGIN
        RETURN tenant_input::UUID;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Invalid UUID: %, using default UUID', tenant_input;
        RETURN '00000000-0000-0000-0000-000000000000'::UUID;
    END;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validación automática
CREATE OR REPLACE FUNCTION validate_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tenant_id = get_valid_tenant_uuid(NEW.tenant_id::TEXT);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_tenant_id_trigger
BEFORE INSERT OR UPDATE ON conversation_sessions
FOR EACH ROW
EXECUTE FUNCTION validate_tenant_id();
```

### Funciones RPC para Manejo Seguro de Datos

Para mejorar la seguridad y el manejo de IDs, se crearon funciones RPC que encapsulan la lógica de acceso a datos:

```sql
-- Cargar estado de conversación
CREATE OR REPLACE FUNCTION load_conversation_state(
    p_tenant_id TEXT,
    p_session_id TEXT
) 
RETURNS JSONB AS $$
DECLARE
    v_state JSONB;
BEGIN
    SELECT state_data INTO v_state
    FROM conversation_sessions
    WHERE tenant_id = get_valid_tenant_uuid(p_tenant_id)
      AND session_id = p_session_id
    LIMIT 1;
    
    RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- Guardar estado de conversación
CREATE OR REPLACE FUNCTION save_conversation_state(
    p_tenant_id TEXT,
    p_session_id TEXT,
    p_state_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_valid_tenant_id UUID;
    v_record_exists BOOLEAN;
BEGIN
    -- Convertir tenant_id a UUID válido
    v_valid_tenant_id := get_valid_tenant_uuid(p_tenant_id);
    
    -- Verificar si ya existe el registro
    SELECT EXISTS (
        SELECT 1 
        FROM conversation_sessions 
        WHERE tenant_id = v_valid_tenant_id
          AND session_id = p_session_id
    ) INTO v_record_exists;
    
    -- Insertar o actualizar según corresponda
    IF v_record_exists THEN
        UPDATE conversation_sessions
        SET state_data = p_state_data
        WHERE tenant_id = v_valid_tenant_id
          AND session_id = p_session_id;
    ELSE
        INSERT INTO conversation_sessions (
            tenant_id, session_id, state_data
        ) VALUES (
            v_valid_tenant_id, p_session_id, p_state_data
        );
    END IF;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error saving conversation state: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

## 3. Carga de Plantillas

**Problema**: Después de solucionar los problemas de base de datos, el sistema todavía muestra el mensaje:
```
[WARN] Flujo "[ID]" no encontrado en el registro
```

**Causa**: Este error ocurre porque aunque la base de datos puede guardar y cargar estados correctamente, el sistema no puede encontrar la plantilla del flujo para procesar el mensaje.

**Solución implementada**:
Hemos implementado un mecanismo de carga dinámica de plantillas que:
1. No carga todas las plantillas al inicio (evitando uso excesivo de memoria)
2. Carga cada plantilla bajo demanda, cuando un tenant la necesita
3. Mantiene en memoria sólo las plantillas que se están usando activamente

**Implementación**:
Se ha creado una nueva función `loadFlowForTenant()` en `src/services/flowRegistry.ts` que carga dinámicamente una plantilla cuando se necesita:

```typescript
/**
 * Carga un flujo específico para un tenant
 * Se llama justo antes de procesar un mensaje
 *
 * @param flowId ID del flujo a cargar (templateId)
 * @param tenantId ID del tenant
 * @returns true si se cargó correctamente
 */
export const loadFlowForTenant = async (
  flowId: string,
  tenantId: string
): Promise<boolean> => {
  try {
    // Si el flujo ya está cargado, retornamos true
    if (flowRegistry[flowId] || templateFlowRegistry[flowId]) {
      logger.debug(`Flujo ${flowId} ya está cargado en el registro`);
      return true;
    }

    logger.info(`Cargando flujo ${flowId} para tenant ${tenantId}`);

    // Primero intentamos con flujos predefinidos
    if (flowId === 'lead-capture' || flowId === 'flujo-basico-lead') {
      try {
        const flow = await leadCaptureFlow();
        if (flow) {
          registerFlow(flowId, flow);
          logger.info(`Flujo predefinido ${flowId} cargado correctamente`);
          return true;
        }
      } catch (predefinedError) {
        logger.error(`Error al cargar flujo predefinido ${flowId}:`, predefinedError);
      }
    }

    // Si no es un flujo predefinido, buscamos en la base de datos
    if (config.supabase?.enabled) {
      try {
        const { getSupabaseClient } = await import('./supabase');
        const supabase = getSupabaseClient();

        // Obtener la plantilla específica
        const { data: template, error } = await supabase
          .from('chatbot_templates')
          .select('id, name, react_flow_json, status')
          .eq('id', flowId)
          .single();

        if (error) {
          logger.error(`Error al obtener plantilla ${flowId} desde BD:`, error);
          return false;
        }

        if (!template) {
          logger.warn(`Plantilla ${flowId} no encontrada en la base de datos`);
          return false;
        }

        // Convertir y registrar la plantilla
        const result = registerTemplateAsFlow(template.id, template.react_flow_json);
        if (result) {
          logger.info(`Plantilla ${template.id} (${template.name}) cargada y registrada correctamente para tenant ${tenantId}`);
          return true;
        } else {
          logger.warn(`No se pudo convertir la plantilla ${template.id} a flujo`);
          return false;
        }
      } catch (dbError) {
        logger.error(`Error al cargar plantilla ${flowId} desde BD:`, dbError);
        return false;
      }
    } else {
      logger.warn('Supabase deshabilitado, no se puede cargar la plantilla');
      return false;
    }

    return false;
  } catch (error) {
    logger.error(`Error al cargar flujo ${flowId} para tenant ${tenantId}:`, error);
    return false;
  }
};
```

También se ha modificado la función `processFlowMessage()` para usar esta carga dinámica:

```typescript
// Verificamos si el flujo ya está cargado
let flow = getFlow(flowId);

// Si el flujo no está cargado, intentamos cargarlo dinámicamente
if (!flow) {
  logger.info(`Flujo ${flowId} no está en el registro, intentando carga dinámica...`);
  const loadSuccess = await loadFlowForTenant(flowId, tenantId);

  if (loadSuccess) {
    // Intentamos obtener el flujo nuevamente después de cargarlo
    flow = getFlow(flowId);
    logger.info(`Flujo ${flowId} cargado dinámicamente con éxito`);
  } else {
    logger.error(`No se pudo cargar el flujo ${flowId} para tenant ${tenantId}`);
  }
}
```

Esta solución tiene varias ventajas:
1. Minimiza el uso de memoria al no cargar todas las plantillas al inicio
2. Permite cargar plantillas específicas por tenant cuando se necesitan
3. Simplifica el mantenimiento al no tener una carga centralizada de todas las plantillas
4. Facilita la escalabilidad con muchas plantillas o tenants

## 4. Activación de Flujos de Conversación

**Problema**: Incluso después de cargar correctamente las plantillas, los flujos no se iniciaban adecuadamente:
```
[ERROR] No se pudo determinar cómo procesar el flujo [ID]
```

**Causa**: BuilderBot espera que las conversaciones se inicien con palabras clave específicas (INICIO, COMENZAR, HOLA), pero el sistema estaba intentando procesar el primer mensaje directamente sin activar el flujo con las palabras clave.

**Solución implementada**:
Modificamos `processFlowMessage` para detectar el primer mensaje de una conversación y tratarlo como una activación de flujo:

```typescript
// Verificamos si es el primer mensaje (no hay estado previo)
const isFirstMessage = !prevState || Object.keys(prevState).length === 0;

// Si es el primer mensaje, sobreescribimos el mensaje original con "HOLA"
// para asegurarnos de que se active el flujo
const processMessage = isFirstMessage ? "HOLA" : message;
logger.info(`${isFirstMessage ? 'Primer mensaje en la sesión, activando flujo con "HOLA"' : 'Continuando flujo existente'}`);

// Usamos processMessage en lugar de message para todas las llamadas al procesador
const result = await flow.processMessage(
  processMessage, // Puede ser "HOLA" para activar el flujo
  userId,
  sessionId,
  initialState
);
```

Esta mejora permite que cualquier mensaje inicial active el flujo, haciendo que la experiencia sea más natural para el usuario y manteniendo la compatibilidad con la forma en que BuilderBot espera que se inicien las conversaciones.
```

## Conclusión

Los problemas identificados se centraban principalmente en la discrepancia entre el código del backend y el esquema de la base de datos. La solución implementó:

1. Correcciones al esquema de la base de datos
2. Mecanismos robustos para manejar IDs no-UUID
3. Funciones RPC para acceso seguro a datos

Estas mejoras hacen que el sistema sea más resiliente y evitan errores comunes relacionados con el manejo del estado de conversaciones.