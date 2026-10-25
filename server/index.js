import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomService } from './rooms.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function createApp({ dev = false, allowedOrigins = [] } = {}) {
  const epoch = Date.now() - performance.now();
  const now = () => epoch + performance.now();
  const vite = dev ? await (await import('vite')).createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'spa' }) : null;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true })); }
    if (req.url === '/connection-info') {
      const port = server.address()?.port;
      const addresses = Object.values(networkInterfaces()).flat().filter(address => address && address.family === 'IPv4' && !address.internal && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address));
      addresses.sort((a, b) => Number(b.address.startsWith('192.168.')) - Number(a.address.startsWith('192.168.')));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ lanUrls: addresses.map(address => `http://${address.address}:${port}`) }));
    }
    if (vite) return vite.middlewares(req, res);
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const file = path.resolve(root, 'dist', relative);
      if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
      const content = await readFile(file);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(content);
    } catch { res.writeHead(404); res.end('Not found. Run npm run build before npm start.'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  const rooms = new RoomService({ now, send: (client, message) => { if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message)); } });
  server.on('upgrade', (req, socket, head) => {
    const requestPath = new URL(req.url, 'http://localhost').pathname;
    let sameHost = false;
    try { sameHost = new URL(req.headers.origin).host === req.headers.host; } catch { /* Non-browser test clients may omit Origin. */ }
    if (requestPath !== '/ws' || (req.headers.origin && !sameHost && !allowedOrigins.includes(req.headers.origin))) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return socket.destroy(); }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });
  wss.on('connection', socket => {
    const client = { socket, room: null };
    let windowAt = now(), messages = 0;
    socket.alive = true;
    socket.on('pong', () => { socket.alive = true; });
    socket.on('error', () => {});
    socket.on('message', data => {
      if (now() - windowAt >= 1000) { windowAt = now(); messages = 0; }
      if (++messages > 80) return socket.close(1008, 'Too many messages');
      try {
        const message = JSON.parse(data.toString());
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;
        rooms.handle(client, message);
      } catch { socket.close(1007, 'Invalid message'); }
    });
    socket.on('close', () => rooms.disconnect(client));
  });
  const tick = setInterval(() => rooms.tick(), 100);
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.alive) { socket.terminate(); continue; }
      socket.alive = false;
      socket.ping();
    }
  }, 5000);
  return {
    server, rooms,
    close: async () => {
      clearInterval(tick); clearInterval(heartbeat);
      wss.clients.forEach(socket => socket.terminate());
      await new Promise(resolve => wss.close(resolve));
      await new Promise(resolve => server.close(resolve));
      await vite?.close();
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await createApp({ dev: process.argv.includes('--dev'), allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean) });
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, '0.0.0.0', () => {
    console.log(`Sync lab: http://localhost:${port}`);
    for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) if (address.family === 'IPv4' && !address.internal) console.log(`Same Wi-Fi: http://${address.address}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
}
