# 📚 BuilderBot - Documentación Completa

## 🏗️ Arquitectura Core

### Componentes Principales

1. **Flow**: Construye el contexto de conversación y proporciona secuenciación de interacciones
2. **Provider**: Conecta plataformas de mensajería (WhatsApp, Telegram, etc.)
3. **Database**: Permite persistencia de datos flexible

### Estructura Básica de un Bot

```typescript
import { createBot, createProvider, createFlow, addKeyword, MemoryDB } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'

const welcomeFlow = addKeyword(['hello', 'hi'])
    .addAnswer('Welcome!')

const main = async () => {
    const adapterDB = new MemoryDB()
    const adapterFlow = createFlow([welcomeFlow])
    const adapterProvider = createProvider(BaileysProvider)

    await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })
}

main()
```

## 🔑 Conceptos Clave

### 1. Flujos (Flows)

Los flujos son el corazón de BuilderBot:

```typescript
const flow = addKeyword(['hola', 'hi'])
    .addAnswer('¡Bienvenido!')
    .addAnswer('¿Cuál es tu nombre?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAction(async (ctx, { state, flowDynamic }) => {
        const name = state.get('name')
        await flowDynamic(`¡Hola ${name}!`)
    })
```

### 2. Estructura del Context (ctx)

```typescript
const ctx = {
    from: '1234567890',  // ID del remitente
    body: 'mensaje',     // Contenido del mensaje
    name: 'Usuario'      // Nombre del usuario
}
```

### 3. Métodos Disponibles

#### State Management
```typescript
// Actualizar estado
await state.update({ key: 'value' })

// Obtener valor
const value = state.get('key')

// Obtener todo el estado
const fullState = state.getMyState()

// Limpiar estado
state.clear()
```

#### Flow Dynamic
```typescript
// Enviar mensaje dinámico
await flowDynamic('Mensaje dinámico')

// Enviar con media
await flowDynamic([{
    body: 'Texto',
    media: 'https://example.com/image.jpg'
}])

// Con delay
await flowDynamic('Mensaje', { delay: 2000 })
```

#### Goto Flow
```typescript
// Cambiar a otro flujo (IMPORTANTE: usar return)
const flowA = addKeyword(EVENTS.ACTION).addAnswer('Flujo A')
const flowB = addKeyword(EVENTS.ACTION).addAnswer('Flujo B')

const mainFlow = addKeyword('start')
    .addAnswer('¿A o B?', { capture: true }, async (ctx, { gotoFlow }) => {
        if (ctx.body === 'A') return gotoFlow(flowA)
        if (ctx.body === 'B') return gotoFlow(flowB)
    })
```

## 🎯 Eventos Disponibles

```typescript
import { EVENTS } from '@builderbot/bot'

// Mensaje de bienvenida (no coincide con keywords)
addKeyword(EVENTS.WELCOME)

// Recibir media (imagen/video)
addKeyword(EVENTS.MEDIA)

// Recibir documento
addKeyword(EVENTS.DOCUMENT)

// Recibir ubicación
addKeyword(EVENTS.LOCATION)

// Nota de voz
addKeyword(EVENTS.VOICE_NOTE)

// Acción genérica
addKeyword(EVENTS.ACTION)
```

## 💡 Buenas Prácticas

### 1. Variables Dinámicas

❌ **Incorrecto**:
```typescript
let name = ''
const flow = addKeyword('hello')
    .addAnswer(`Tu nombre es: ${name}`) // Se serializa al inicio
```

✅ **Correcto**:
```typescript
const flow = addKeyword('hello')
    .addAction(async (ctx, { state, flowDynamic }) => {
        const name = state.get('name')
        await flowDynamic(`Tu nombre es: ${name}`)
    })
```

### 2. Captura de Datos

```typescript
const flow = addKeyword('registro')
    .addAnswer('¿Nombre?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('¿Email?', { capture: true }, async (ctx, { state }) => {
        await state.update({ email: ctx.body })
    })
```

### 3. Envío de Archivos

```typescript
// Desde URL
.addAnswer('Imagen', { media: 'https://example.com/image.jpg' })

// Archivo local
const pathLocal = join('assets', 'document.pdf')
.addAnswer('Documento', { media: pathLocal })

// Dinámicamente
.addAction(async (_, { flowDynamic }) => {
    await flowDynamic([{
        body: 'Archivo adjunto',
        media: 'https://example.com/file.pdf'
    }])
})
```

## 🔧 Métodos Avanzados

### GlobalState
```typescript
// Estado global compartido entre conversaciones
const { globalState } = await createBot(...)

// Actualizar
await globalState.update({ botEnabled: true })

// Obtener
const isEnabled = globalState.get('botEnabled')
```

### FallBack
```typescript
// Manejar respuestas inválidas
.addAnswer('¿Email?', { capture: true }, async (ctx, { fallBack }) => {
    if (!ctx.body.includes('@')) {
        return fallBack('Por favor ingresa un email válido')
    }
})
```

### EndFlow
```typescript
// Terminar flujo
.addAnswer('¿Continuar? (si/no)', { capture: true }, async (ctx, { endFlow }) => {
    if (ctx.body === 'no') {
        return endFlow('Proceso cancelado')
    }
})
```

### Blacklist
```typescript
const { blacklist } = await createBot(...)

// Agregar a lista negra
blacklist.add('1234567890')

// Remover de lista negra
blacklist.remove('1234567890')

// Verificar si está en lista negra
const isBlocked = blacklist.checkIf('1234567890')
```

## 🚀 Ejemplo Completo: Bot Avanzado

```typescript
import { createBot, createProvider, createFlow, addKeyword, MemoryDB, EVENTS } from '@builderbot/bot'
import { BaileysProvider } from '@builderbot/provider-baileys'

// Flujo de registro
const registerFlow = addKeyword(['registro'])
    .addAnswer('📝 Iniciemos tu registro')
    .addAnswer('¿Cuál es tu nombre?', { capture: true }, async (ctx, { state }) => {
        await state.update({ name: ctx.body })
    })
    .addAnswer('¿Tu email?', { capture: true }, async (ctx, { state, fallBack }) => {
        if (!ctx.body.includes('@')) {
            return fallBack('❌ Email inválido. Intenta de nuevo.')
        }
        await state.update({ email: ctx.body })
    })
    .addAction(async (ctx, { state, flowDynamic }) => {
        const data = state.getMyState()
        await flowDynamic(`✅ Registro completado:
        - Nombre: ${data.name}
        - Email: ${data.email}`)
    })

// Flujo de ayuda
const helpFlow = addKeyword(['ayuda', 'help'])
    .addAnswer([
        '📚 *Comandos disponibles:*',
        '',
        '• registro - Iniciar registro',
        '• ayuda - Ver este menú',
        '• info - Información del bot'
    ])

// Flujo de bienvenida (cuando no coincide ningún keyword)
const welcomeFlow = addKeyword(EVENTS.WELCOME)
    .addAnswer('👋 ¡Hola! Soy tu asistente virtual.')
    .addAnswer('Escribe "ayuda" para ver los comandos disponibles')

// Flujo principal
const main = async () => {
    const adapterDB = new MemoryDB()
    const adapterFlow = createFlow([registerFlow, helpFlow, welcomeFlow])
    const adapterProvider = createProvider(BaileysProvider)

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    httpServer(3001)
    console.log('Bot iniciado en http://localhost:3001')
}

main()
```

## 🎨 Estructura Correcta de un Flujo para BuilderBot

Para que BuilderBot reconozca correctamente un flujo, debe seguir esta estructura:

```typescript
// 1. Crear flujos con addKeyword
const myFlow = addKeyword(['keyword1', 'keyword2'])
    .addAnswer('Respuesta')
    .addAction(async (ctx, { state }) => {
        // Lógica personalizada
    })

// 2. Combinar flujos con createFlow
const mainFlow = createFlow([myFlow, otherFlow])

// 3. Pasar a createBot
await createBot({
    flow: mainFlow,
    provider: myProvider,
    database: myDB
})
```

**IMPORTANTE**: El flujo debe ser creado con `createFlow()` y contener arrays de flujos creados con `addKeyword()`.