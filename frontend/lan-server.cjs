const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DIST_DIR = path.resolve(__dirname, 'dist');
const INDEX_FILE = path.join(DIST_DIR, 'index.html');

const DEFAULT_BACKEND_ORIGIN = 'http://127.0.0.1:3000';
const BACKEND_ORIGIN = String(process.env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).trim() || DEFAULT_BACKEND_ORIGIN;

const DEFAULT_PORTS = '5173,5174';
const PORTS = String(process.env.FRONTEND_PORTS || DEFAULT_PORTS)
  .split(',')
  .map((value) => Number(String(value).trim()))
  .filter((value) => Number.isFinite(value) && value > 0);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function isProxyPath(pathname) {
  return pathname.startsWith('/api') || pathname.startsWith('/uploads');
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    ...headers
  });
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendText(res, 500, 'Internal Server Error');
      return;
    }

    const cacheControl = ext && ext !== '.html' ? 'public, max-age=31536000, immutable' : 'no-cache';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    });

    res.end(data);
  });
}

function proxyToBackend(req, res) {
  const target = new URL(BACKEND_ORIGIN);
  const isHttps = target.protocol === 'https:';
  const client = isHttps ? https : http;

  const proxyReq = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: target.host
      }
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error.message);
    sendText(res, 502, 'Bad Gateway');
  });

  req.pipe(proxyReq);
}

function handleRequest(req, res) {
  const host = req.headers.host || 'localhost';
  const requestUrl = new URL(req.url || '/', `http://${host}`);
  let pathname = requestUrl.pathname || '/';

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep raw pathname if decode fails
  }

  if (isProxyPath(pathname)) {
    proxyToBackend(req, res);
    return;
  }

  if (!fs.existsSync(INDEX_FILE)) {
    sendText(res, 503, 'Frontend build not found. Run: cd frontend && npm run build');
    return;
  }

  const relativePath = pathname === '/' ? '/index.html' : pathname;
  const resolvedPath = path.resolve(DIST_DIR, `.${relativePath}`);

  if (!resolvedPath.startsWith(DIST_DIR)) {
    sendText(res, 404, 'Not Found');
    return;
  }

  fs.stat(resolvedPath, (statError, stats) => {
    if (!statError && stats.isFile()) {
      serveFile(res, resolvedPath);
      return;
    }

    // SPA fallback
    serveFile(res, INDEX_FILE);
  });
}

if (!PORTS.length) {
  console.error('No valid FRONTEND_PORTS provided. Example: FRONTEND_PORTS=5173,5174');
  process.exit(1);
}

PORTS.forEach((port) => {
  const server = http.createServer(handleRequest);

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      console.error(`❌ Frontend port ${port} is already in use.`);
    } else {
      console.error(`❌ Failed to start frontend on port ${port}:`, error);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Frontend running on 0.0.0.0:${port}`);
    console.log(`   → http://localhost:${port}`);
    console.log(`   Proxy: /api, /uploads → ${BACKEND_ORIGIN}`);
  });
});
