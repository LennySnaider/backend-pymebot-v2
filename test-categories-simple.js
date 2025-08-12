import fetch from 'node-fetch';

// Test simple del flujo de categorías + productos
async function testCategoriesFlow() {
  const sessionId = 'test-session-' + Date.now();
  const userId = 'test-user-' + Date.now();
  const tenantId = 'afa60b0a-3046-4607-9c48-266af6e1d322';
  
  console.log('🚀 Iniciando test del flujo completo...');
  console.log(`Session: ${sessionId}, User: ${userId}`);
  
  try {
    // 1. Primer mensaje - "hola"
    console.log('\n1️⃣ Enviando "hola"...');
    let response = await fetch('http://localhost:3090/api/text/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'hola',
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantId
      })
    });
    
    let data = await response.json();
    console.log('Response 1:', data.responses || data.message || data);
    
    // 2. Segundo mensaje - responder con nombre
    console.log('\n2️⃣ Enviando nombre "Juan Pérez"...');
    response = await fetch('http://localhost:3090/api/text/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Juan Pérez',
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantId
      })
    });
    
    data = await response.json();
    console.log('Response 2:', data.responses || data.message || data);
    
    // 3. Tercer mensaje - teléfono
    console.log('\n3️⃣ Enviando teléfono "555-1234"...');
    response = await fetch('http://localhost:3090/api/text/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '555-1234',
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantId
      })
    });
    
    data = await response.json();
    console.log('Response 3:', data.responses || data.message || data);
    
    // 4. Cuarto mensaje - seleccionar categoría (1 para Inmobiliaria)
    console.log('\n4️⃣ Seleccionando categoría "1" (Inmobiliaria)...');
    response = await fetch('http://localhost:3090/api/text/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '1',
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantId
      })
    });
    
    data = await response.json();
    console.log('Response 4:', data.responses || data.message || data);
    
    // 5. Quinto mensaje - seleccionar producto
    console.log('\n5️⃣ Seleccionando producto "1"...');
    response = await fetch('http://localhost:3090/api/text/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '1',
        session_id: sessionId,
        user_id: userId,
        tenant_id: tenantId
      })
    });
    
    data = await response.json();
    console.log('Response 5:', data.responses || data.message || data);
    
    console.log('\n✅ Test completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en el test:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 El servidor no está ejecutándose en puerto 3090');
    }
  }
}

// Ejecutar test
testCategoriesFlow();