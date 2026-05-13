const http = require('http');

const data = JSON.stringify({
    name: 'Updated Test Device ' + new Date().toLocaleTimeString()
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/devices/test-device-001',
    method: 'PATCH',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

console.log('🚀 Sending PATCH request to update device...');

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('📡 Response Status:', res.statusCode);
        console.log('✅ Response Body:', body);
    });
});

req.on('error', (e) => {
    console.error('❌ Problem with request:', e.message);
});

req.write(data);
req.end();
