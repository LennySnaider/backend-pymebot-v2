#!/usr/bin/env node

const https = require('http');

const testData = JSON.stringify({
    text: "hola",
    userId: "test-direct-final-working",
    tenantId: "afa60b0a-3046-4607-9c48-266af6e1d322",
    templateId: "d5e05ba1-0146-4587-860b-4e984dd0b672"
});

const options = {
    hostname: 'localhost',
    port: 3090,
    path: '/api/text/chatbot',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
    }
};

console.log('🧪 [TEST] Probando interceptación del flujo directo-funcional...');
console.log('🧪 [TEST] Datos de prueba:', testData);

const req = https.request(options, (res) => {
    console.log(`🧪 [TEST] Estado de respuesta: ${res.statusCode}`);
    console.log(`🧪 [TEST] Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('🧪 [TEST] Respuesta completa:');
        try {
            const parsed = JSON.parse(data);
            console.log('✅ [TEST] Respuesta JSON:', JSON.stringify(parsed, null, 2));
            
            if (parsed.success && parsed.responses && parsed.responses.length > 0) {
                console.log('🎉 [TEST] ¡ÉXITO! El chatbot respondió con:', parsed.responses);
                console.log('🎉 [TEST] La interceptación del flujo directo-funcional FUNCIONA!');
            } else {
                console.log('❌ [TEST] El chatbot no respondió como esperado');
            }
        } catch (e) {
            console.log('📄 [TEST] Respuesta texto plano:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ [TEST] Error de conexión:', e.message);
    console.error('❌ [TEST] ¿Está corriendo el servidor en puerto 3090?');
});

req.write(testData);
req.end();