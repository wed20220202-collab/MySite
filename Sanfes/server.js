// Firebaseなしでスマホ複数台テストするためのローカルLANサーバー
// 起動: node server.js
// 表示: http://localhost:3000/movie.html / admin.html / index.html

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'local-data.json');

let data = { sequences: [], session: null, participants: {} };
let clients = new Set();

try {
  if (fs.existsSync(DATA_FILE)) data = { ...data, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch (e) {
  console.warn('local-data.json の読み込みに失敗しました。新規データで起動します。');
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function json(res, obj, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

function sendEvent(type, payload) {
  const text = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(text);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime'
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});

  if (req.url === '/api/mode') return json(res, { mode: 'local-lan', firebase: false });

  if (req.url === '/api/sequences' && req.method === 'GET') {
    return json(res, data.sequences.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  }

  if (req.url === '/api/sequences' && req.method === 'POST') {
    const item = await readBody(req);
    data.sequences = [item, ...data.sequences.filter(s => s.id !== item.id)];
    save();
    return json(res, item);
  }

  if (req.url === '/api/session' && req.method === 'GET') return json(res, data.session);

  if (req.url === '/api/session' && req.method === 'POST') {
    data.session = await readBody(req);
    save();
    sendEvent('session', data.session);
    return json(res, data.session);
  }

  if (req.url === '/api/participants' && req.method === 'POST') {
    const p = await readBody(req);
    data.participants[p.id] = p;
    return json(res, { ok: true, count: Object.keys(data.participants).length });
  }

  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const safePath = decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) return json(res, { error: 'forbidden' }, 403);

  fs.readFile(filePath, (err, buf) => {
    if (err) return json(res, { error: 'not found' }, 404);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nFestival Color Sync local server`);
  console.log(`PC: http://localhost:${PORT}/movie.html`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`LAN: http://${net.address}:${PORT}/movie.html`);
      }
    }
  }
  console.log('admin.html / index.html も同じURLで開けます。\n');
});
