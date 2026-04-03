const http = require('http');
const data = JSON.stringify({ username: 'admin', password: 'Admin@123!' });
const options = {
  host: 'localhost',
  port: 5000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', chunk => (body += chunk));
  res.on('end', () => console.log(body));
});

req.on('error', err => console.error(err));
req.write(data);
req.end();
