import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import QRCode from 'qrcode';
import { createSession, rooms } from './session.js';

export { rooms };

const WEB = fileURLToPath(new URL('../../web', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

export function createApp(port: number) {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let path = url.pathname;
    const qr = /^\/qr\/([A-Z]{4})\.svg$/.exec(path);
    if (qr) {
      const host = req.headers.host ?? 'localhost';
      const svg = await QRCode.toString(`http://${host}/room/${qr[1]}`, { type: 'svg', margin: 1 });
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      res.end(svg);
      return;
    }
    if (path === '/' || path.startsWith('/room/') || path.startsWith('/display/')) path = '/index.html';
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const vendor = /^[/\\]vendor[/\\](three|font)[/\\]([\w.-]+)$/.exec(safe);
    const file = vendor
      ? join(ROOT, 'node_modules', vendor[1] === 'three' ? 'three/build' : '@fontsource/pixelify-sans/files', vendor[2]!)
      : join(WEB, safe);
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  const wss = new WebSocketServer({ server: http });

  wss.on('connection', (ws: WebSocket) => {
    const session = createSession((m) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); });
    ws.on('message', (raw) => session.handle(String(raw)));
    ws.on('close', () => session.close());
  });

  return new Promise<{ close: () => void; port: number }>((resolve) => {
    http.listen(port, () => {
      const addr = http.address();
      resolve({ port: typeof addr === 'object' && addr ? addr.port : port, close: () => { wss.close(); http.close(); } });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3000);
  createApp(port).then(() => console.log(`AU LOUP ! http://localhost:${port}`));
}
