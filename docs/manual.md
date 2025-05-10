# Manual de desarrollo: Agente conversacional de voz usando Builderbot + MiniMax

Este manual te guía para implementar un agente conversacional de voz multitenant usando Node.js, TypeScript, Express.js, Builderbot para manejar flujos conversacionales, AssemblyAI para reconocimiento de voz (STT) y MiniMax para síntesis de voz (TTS).

---

## ✨ 1. Base del proyecto

El proyecto se basa en una arquitectura moderna para agentes de voz con:

- Múltiples canales (web, WhatsApp, otros)
- Arquitectura multitenant con aislamiento
- Sistema completo con AssemblyAI para STT y MiniMax para TTS
- Caché de respuestas para optimización
- Procesamiento de flujos con Builderbot

---

## ⚖️ 2. Arquitectura de servicios de voz

### A. Reconocimiento de voz con AssemblyAI (STT)

El servicio de transcripción (`stt.ts`) implementa:

```
POST https://api.assemblyai.com/v2/transcript
```

Características implementadas:

- Detección automática del formato de audio (MP3, WAV, OGG)
- Soporte para múltiples idiomas
- Sistema robusto y confiable

#### Configuración en AssemblyAI:

```typescript
// En config/index.ts
assemblyai: {
  apiKey: process.env.ASSEMBLYAI_API_KEY || "",
}
```

### B. Síntesis de voz con MiniMax (TTS)

El servicio de síntesis (`tts.ts`) implementa:

```
POST https://api.minimax.chat/v1/t2a_v2?GroupId=<GROUP_ID>
```

Características implementadas:

- Sistema de caché para respuestas frecuentes
- Pre-renderizado de frases comunes
- Soporte para modo sincrónico y asincrónico
- Fallback automático entre modos

#### Formato de petición para MiniMax TTS:

```typescript
const payload = {
  text: "Texto a sintetizar",
  model: "speech-02-hd",
  stream: false,
  subtitle_enable: false,
  voice_setting: {
    voice_id: "Friendly_Person", // ID de voz disponible
    speed: 1.0,
    vol: 1.0,
    pitch: 0,
  },
  audio_setting: {
    sample_rate: 32000,
    bitrate: 128000,
    format: "mp3",
    channel: 1,
  },
};
```

#### Voces disponibles en MiniMax:

MiniMax ofrece las siguientes voces:

```typescript
const availableVoices = [
  "Wise_Woman",
  "Friendly_Person",
  "Inspirational_girl",
  "Deep_Voice_Man",
  "Calm_Woman",
  "Casual_Guy",
  "Lively_Girl",
  "Patient_Man",
  "Young_Knight",
  "Determined_Man",
  "Lovely_Girl",
  "Decent_Boy",
  "Imposing_Manner",
  "Elegant_Man",
  "Abbess",
  "Sweet_Girl_2",
  "Exuberant_Girl",
];
```

> ⚠️ **IMPORTANTE**: Usa exactamente estos nombres de voces. Valores como "female-1" o "male-2" no son válidos.

---

## 🔄 3. Flujo de procesamiento de voz

1. **Entrada de voz:**

   - Usuario envía audio (web o WhatsApp)
   - El sistema detecta formato y preprocesa si es necesario

2. **Transcripción (STT):**

   - AssemblyAI procesa el audio y devuelve texto
   - Se aplican optimizaciones de detección de idioma

3. **Procesamiento con Builderbot:**

   - El texto se envía al flujo conversacional adecuado
   - Los flujos procesan la intención y generan respuesta

4. **Síntesis de voz (TTS):**

   - La respuesta textual se envía a MiniMax con configuración óptima
   - Se maneja de forma diferente según modo sincrónico o asincrónico
   - Se genera audio de alta calidad con la voz seleccionada

5. **Entrega multimedia:**
   - Se devuelve tanto texto como audio al usuario
   - Se almacena en caché para uso futuro si aplicable

### Sistema de procesamiento implementado:

El sistema de procesamiento de voz implementa un enfoque robusto:

```
Audio → AssemblyAI (STT)
        ↓
     Texto → Builderbot → Respuesta de texto
        ↓
    MiniMax (TTS sincrónico)
        ↓
    Si falla → MiniMax (TTS asincrónico) → Audio de respuesta
```

> ⚠️ **IMPORTANTE**: MiniMax NO proporciona servicio de STT (Speech to Text). El único servicio que ofrece MiniMax para esta integración es el TTS (Text to Speech). Cualquier intento de usar MiniMax como STT resultará en errores. Utiliza siempre AssemblyAI u otro proveedor específico para STT.

---

## 🛠️ 4. Estructura del proyecto

### 🔧 Archivos clave para procesamiento de voz

```
voiceAgentBot/
├── src/
│   ├── services/
│   │   ├── assemblyai-stt.ts      # Servicio de transcripción con AssemblyAI
│   │   ├── stt.ts                 # Servicio principal de transcripción
│   │   ├── minimax-tts.ts         # Servicio de síntesis con MiniMax
│   │   └── tts.ts                 # Servicio principal de síntesis
│   ├── api/
│   │   └── voice.ts               # Endpoints para procesamiento de voz
│   ├── config/
│   │   └── index.ts               # Configuración centralizada
│   └── app.ts                     # Inicialización de la aplicación
└── .env                           # Variables de entorno
```

---

## 🚀 5. Buenas prácticas implementadas

### Detección de formato de audio

El sistema detecta automáticamente el formato del audio entrante:

```typescript
const detectAudioFormat = (buffer: Buffer): string | undefined => {
  // OGG header: "OggS"
  if (buffer.length > 4 && buffer.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }

  // MP3 header: "ID3" o comienza con 0xFF 0xFB
  if (
    (buffer.length > 3 && buffer.toString("ascii", 0, 3) === "ID3") ||
    (buffer.length > 2 &&
      buffer[0] === 0xff &&
      (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2))
  ) {
    return "audio/mp3";
  }

  // WAV header: "RIFF" + "WAVE"
  if (
    buffer.length > 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }

  // Si no podemos detectar, asumimos ogg por ser común en WhatsApp
  return "audio/ogg";
};
```

### Manejo de respuestas TTS

Para optimizar el rendimiento, implementamos un sistema de caché:

```typescript
interface TTSCacheEntry {
  buffer: Buffer;
  timestamp: number;
  filePath: string;
}

// Mapa para almacenar el caché
const ttsCache: Map<string, TTSCacheEntry> = new Map();

// Función para generar clave de caché
const getCacheKey = (text: string, voiceId: string): string => {
  return createHash("md5").update(`${text}|${voiceId}`).digest("hex");
};
```

### Gestión de modos de síntesis

El sistema maneja automáticamente la conmutación entre modos sincrónico y asincrónico:

```typescript
// Detección del modo de API
const isAsyncMode = url.includes("async");

// Si falla el modo sincrónico, intentar con asincrónico
if (!isAsyncMode && config.minimax.apiUrl.tts.includes("t2a_v2")) {
  console.log(
    "⚠️ Error en modo sincrónico, intentando con endpoint asincrónico..."
  );

  // URL del endpoint asincrónico
  const asyncUrl = config.minimax.apiUrl.tts.replace("t2a_v2", "t2a_async_v2");

  // Realizamos la petición...
}
```

---

## 📄 6. Variables de entorno requeridas

```env
# Credenciales de AssemblyAI (STT)
ASSEMBLYAI_API_KEY=tu_api_key_aqui

# Credenciales de MiniMax (TTS)
MINIMAX_GROUP_ID=tu_group_id_aqui
MINIMAX_API_KEY=tu_api_key_aqui

# URLs para la API de MiniMax
MINIMAX_API_URL=https://api.minimax.chat/v1/t2a_v2

# Configuración de MiniMax
MINIMAX_MODEL=speech-02-hd
MINIMAX_VOICE=Friendly_Person

# Configuración de caché
ENABLE_TTS_CACHE=true
TTS_CACHE_EXPIRATION=86400  # 24 horas en segundos
```

---

## 🔍 7. Troubleshooting común

### Problemas con STT (AssemblyAI)

- **Error "bad request"**: Verifica que estás enviando el audio en el formato correcto.
- **Error "unauthorized"**: Confirma que ASSEMBLYAI_API_KEY es válido.
- **Error "no audio received"**: Asegúrate de que el audio no está vacío y tiene un formato soportado.

### Problemas con TTS (MiniMax)

- **Error "invalid params"**: Verifica que el formato del payload sea exactamente como se documenta, especialmente la estructura de `voice_setting` y `audio_setting`.
- **Error "invalid voice_id"**: Asegúrate de usar uno de los valores exactos de la lista de voces disponibles (como "Friendly_Person", no "female-1").
- **Error "invalid samples or voice_id"**: La voz seleccionada no es compatible con el modelo, prueba otra voz de la lista disponible.
- **Respuesta en formato incorrecto**: La API de MiniMax puede devolver el audio en diferentes estructuras. Verifica que estás procesando tanto `response.data.audio` como `response.data.data.audio`.

### Problemas con el modo asincrónico

- **Error de tiempo de espera**: Aumenta el valor de `maxAttempts` o `delayMs` para tareas que toman más tiempo.
- **Error "task failed"**: Verifica en la respuesta el campo `message` para obtener detalles específicos del error.
- **Error al descargar archivo**: Asegúrate de que el `taskToken` se incluye correctamente en los encabezados.

---

## 🔗 8. Recursos y documentación

- AssemblyAI API: [https://www.assemblyai.com/docs/](https://www.assemblyai.com/docs/)
- MiniMax TTS API: [https://api.minimax.chat/v1/t2a_v2](https://api.minimax.chat/v1/t2a_v2)
- Builderbot: [https://www.builderbot.app/](https://www.builderbot.app/)
