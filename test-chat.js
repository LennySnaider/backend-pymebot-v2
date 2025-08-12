import http from 'http';

const postData = JSON.stringify({
  message: "hola",
  userId: "test-user-001",
  tenantId: "afa60b0a-3046-4607-9c48-266af6e1d322"
});

const options = {
  hostname: 'localhost',
  port: 3090,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Probando API de chat...');

const req = http.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`);
  console.log(`headers:`, res.headers);

  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();