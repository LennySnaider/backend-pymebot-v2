# Resumen de Integración de Streaming TTS con MiniMax

## Objetivo

Habilitar el servicio de Text-to-Speech (TTS) para que entregue audio en tiempo real (streaming) en lugar de JSON con payload completo.

## Cambios Principales

1. _Servicio de Streaming_

   - Se creó/ajustó `src/services/minimax-tts-stream.ts`:
     - Se añadió encabezado `Accept: text/event-stream`.
     - Se configura `responseType: "stream"` en la petición `axios.post`.
     - La función devuelve un `ReadableStream` de eventos SSE.

2. _Endpoint de API_

   - En `src/api/voice.ts` (endpoints `/chat` y `/tts`):
     - Importación de `createInterface` de `"readline"`.
     - Lectura del stream SSE línea a línea:
       ```ts
       const rl = createInterface({ input: remoteStream });
       rl.on("line", (line: string) => { ... });
       ```
     - Por cada evento JSON (`data: {...}`):
       - Parseo de JSON.
       - Extracción de `audio` (hexadecimal).
       - Decodificación con `Buffer.from(audioHex, "hex")`.
       - Envío directo con `res.write(buf)`.
     - Al cerrar el stream, se hace `res.end()`.

3. _Condición de Streaming_

   - Se simplificó la condición:
     ```ts
     if (req.query.stream) { ... }
     ```
     Cualquier presencia del parámetro `stream` activa el modo streaming.

4. _Pruebas_
   - Comando recomendado:
     ```bash
     curl -N -H "Accept: audio/mpeg" \
       -X POST -H "Content-Type: application/json" \
       -d '{"text":"Hola, fluyan los datos","voice_id":"Friendly_Person"}' \
       'http://localhost:3090/api/voice/tts?stream=true' \
       --output salida.mp3
     open salida.mp3
     ```
   - Resultado:
     - `salida.mp3` contiene audio MP3 chunked reproducible en tiempo real.

## Conclusión

El servicio TTS ahora utiliza streaming SSE de MiniMax, decodifica fragmentos de audio y los envía como MP3 chunked, permitiendo reproducción inmediata y continua en el cliente.
