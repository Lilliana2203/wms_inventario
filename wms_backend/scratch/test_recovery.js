const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('Testing /api/auth/recuperar with valid user...');
  try {
    const res = await postJson('http://localhost:3000/api/auth/recuperar', { email: 'erickp@gmail.com' });
    console.log('Status Code:', res.status);
    console.log('Response Body:', res.data);
    
    if (res.status === 200 && res.data.success) {
      console.log('TEST PASSED! Token:', res.data.data.tokenSimulado);
    } else {
      console.log('TEST FAILED!');
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

run();
