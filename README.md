# Agente Conversacional de Voz con Builderbot y MiniMax

Este proyecto implementa un agente conversacional de voz multitenant utilizando:

- **Node.js** y **TypeScript** para el backend
- **Builderbot** para la gestión de flujos conversacionales
- **Express.js** para la API REST
- **MiniMax** para TTS (Text to Speech)
- **AssemblyAI** para STT (Speech to Text) con MiniMax como alternativa
- **Supabase** para autenticación y almacenamiento multitenant

## 🚀 Características

- 🎙️ **Conversación por voz** utilizando API web
- 💬 **Integración con WhatsApp** (Baileys/Meta) opcional
- 🔄 **STT y TTS** de alta calidad (con AssemblyAI y MiniMax)
- 🏢 **Arquitectura Multitenant** (aislamiento de datos por tenant)
- 🔍 **Autenticación y permisos** con Supabase
- 📊 **Control de cuota por tenant**
- 🔄 **Caché inteligente** para respuestas frecuentes
- ⚡ **Pre-renderizado** de frases comunes

## 🛠️ Estructura del Proyecto

```
voiceAgentBot/
├── src/
│   ├── api/
│   │   └── voice.ts           # API para procesamiento de voz
│   ├── config/
│   │   └── index.ts           # Configuración centralizada
│   ├── flows/
│   │   ├── welcome.flow.ts    # Flujo de bienvenida
│   │   └── info.flow.ts       # Flujo de información
│   ├── middlewares/
│   │   └── auth.ts            # Middleware de autenticación
│   ├── provider/
│   │   ├── webProvider.ts     # Proveedor para API web
│   │   ├── providerFactory.ts # Factory de proveedores
│   │   └── whatsappProvider.ts # Proveedor para WhatsApp
│   ├── services/
│   │   ├── assemblyai-stt.ts  # Servicio STT con AssemblyAI
│   │   ├── minimax-stt.ts     # Servicio STT con MiniMax
│   │   ├── minimax-tts.ts     # Servicio TTS con MiniMax
│   │   ├── stt.ts             # Servicio STT principal
│   │   ├── tts.ts             # Servicio TTS principal
│   │   ├── bot.ts             # Procesamiento con Builderbot
│   │   └── supabase.ts        # Integración con Supabase
│   ├── utils/
│   │   └── logger.ts          # Utilidad de logging
│   └── app.ts                 # Punto de entrada principal
├── public/
│   └── index.html             # Interfaz web simple
├── supabase/
│   └── policies.sql           # Políticas RLS para Supabase
└── .env.example               # Variables de entorno ejemplo
```

## 📋 Requisitos

- Node.js 18 o superior
- Cuenta en MiniMax (para TTS y STT alternativo)
- Cuenta en AssemblyAI (para STT principal)
- Cuenta en Supabase (para multitenant, opcional)

## ⚙️ Configuración

1. Clona el repositorio
   ```bash
   git clone <url-del-repositorio>
   cd voiceAgentBot
   ```

2. Instala las dependencias
   ```bash
   npm install
   ```

3. Copia el archivo `.env.example` a `.env` y configura tus credenciales
   ```bash
   cp .env.example .env
   ```

4. Configura las variables de entorno:
   - `ASSEMBLYAI_API_KEY`: Tu API key de AssemblyAI
   - `MINIMAX_API_KEY`: Tu API key de MiniMax
   - `MINIMAX_GROUP_ID`: Tu ID de grupo de MiniMax
   - `SUPABASE_URL` y `SUPABASE_ANON_KEY`: Credenciales de Supabase (si lo usas)

5. Inicia el servidor
   ```bash
   npm run dev
   ```

6. Abre la interfaz web
   ```
   http://localhost:3090
   ```

## 🔌 API Endpoints

### API de Voz

- `POST /api/voice/chat` - Conversación completa (audio a audio)
- `POST /api/voice/transcribe` - Solo transcripción (STT)
- `POST /api/voice/tts` - Solo síntesis de voz (TTS)
- `POST /api/voice/clear` - Limpiar conversación
- `GET /api/voice/voices` - Obtener voces disponibles
- `GET /api/voice/health` - Verificar estado del servicio

### Parámetros

Para `POST /api/voice/chat`:

```json
{
  "audio": "[archivo de audio]",  // O
  "audio_base64": "[base64 string]",
  "voice_id": "Friendly_Person",  // Opcional
  "user_id": "usuario123",        // Opcional
  "tenant_id": "default"          // Opcional
}
```

## 📱 Integración con WhatsApp

El sistema puede operar con WhatsApp utilizando Baileys o Meta API:

1. Activa WhatsApp en el `.env`:
   ```
   ENABLE_WHATSAPP=true
   WHATSAPP_PROVIDER=baileys  # O "meta"
   ```

2. Escanea el código QR que se genera en `http://localhost:3090/qr/bot.qr.png`

## 🔒 Multitenant con Supabase

Para habilitar multitenant:

1. Configura las variables de Supabase en `.env`:
   ```
   ENABLE_SUPABASE=true
   ENABLE_MULTITENANT=true
   ```

2. Ejecuta el script SQL en `supabase/policies.sql` para configurar las políticas RLS.

## 📚 Voces Disponibles

Las siguientes voces están disponibles en MiniMax:

- **Masculinas**: Deep_Voice_Man, Casual_Guy, Patient_Man, Young_Knight, Determined_Man, Decent_Boy, Elegant_Man
- **Femeninas**: Wise_Woman, Inspirational_girl, Calm_Woman, Lively_Girl, Lovely_Girl, Abbess, Sweet_Girl_2, Exuberant_Girl
- **Neutras**: Friendly_Person, Imposing_Manner

## 🚀 Ejemplo de uso con API

```javascript
// Ejemplo con fetch
async function sendVoiceMessage() {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('voice_id', 'Friendly_Person');
  formData.append('tenant_id', 'default');
  formData.append('user_id', 'usuario123');

  const response = await fetch('http://localhost:3090/api/voice/chat', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  console.log(data.response);     // Texto de respuesta
  console.log(data.audio_url);    // URL del audio de respuesta
}
```

## 📜 Licencia

MIT

## 🙏 Créditos

Este proyecto utiliza:

- [Builderbot](https://www.builderbot.app/)
- [MiniMax API](https://api.minimax.chat/)
- [AssemblyAI](https://www.assemblyai.com/)
- [Supabase](https://supabase.com/)
