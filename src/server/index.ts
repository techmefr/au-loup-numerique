import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { z } from 'zod';
import QRCode from 'qrcode';
import { GameError } from '../engine/game.js';
import { Room, SHEEP_ACTIONS } from './room.js';

const WEB = fileURLToPath(new URL('../../web', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

export const rooms = new Map<string, Room>();

const claim = z.union([z.object({ kind: z.literal('all-sheep') }), z.object({ kind: z.literal('survivors'), count: z.number().int().min(0).max(3) })]);

const message = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room:create'), displayName: z.string().max(16), voteSeconds: z.number().int().min(0).max(120).optional() }),
  z.object({ type: z.literal('room:join'), code: z.string().max(8), displayName: z.string().max(16), resumeToken: z.string().optional() }),
  z.object({ type: z.literal('display:attach'), code: z.string().max(8) }),
  z.object({ type: z.literal('game:start') }),
  z.object({ type: z.literal('game:next') }),
  z.object({ type: z.literal('cards:submit'), roundId: z.string(), cardIds: z.array(z.string()).min(1).max(3), claim }),
  z.object({ type: z.literal('vote:submit'), roundId: z.string(), choice: z.enum(['wolf', 'trust']) }),
  z.object({ type: z.literal('sheep:action'), sheepId: z.string(), action: z.enum(SHEEP_ACTIONS) }),
  z.object({ type: z.literal('sheep:rename'), sheepId: z.string(), name: z.string().max(16) }),
]);

function newCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    const code = Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join('');
    if (!rooms.has(code)) return code;
  }
}

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
    let room: Room | null = null;
    let playerId = '';
    const send = (m: unknown) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
    const err = (code: string) => send({ type: 'error', code });

    ws.on('message', (raw) => {
      let parsed;
      try {
        parsed = message.safeParse(JSON.parse(String(raw)));
      } catch {
        return err('bad_json');
      }
      if (!parsed.success) return err('bad_message');
      const m = parsed.data;
      try {
        switch (m.type) {
          case 'room:create': {
            room = new Room(newCode());
            room.voteSeconds = m.voteSeconds ?? 0;
            rooms.set(room.code, room);
            const j = room.join(m.displayName, send);
            playerId = j.id;
            send({ type: 'room:joined', code: room.code, playerId, resumeToken: j.token });
            break;
          }
          case 'room:join': {
            const target = rooms.get(m.code.toUpperCase());
            if (!target) return err('room_not_found');
            room = target;
            const j = room.join(m.displayName, send, m.resumeToken);
            playerId = j.id;
            send({ type: 'room:joined', code: room.code, playerId, resumeToken: j.token });
            break;
          }
          case 'display:attach': {
            const target = rooms.get(m.code.toUpperCase());
            if (!target) return err('room_not_found');
            target.attachDisplay(send);
            break;
          }
          default: {
            if (!room) return err('no_room');
            if (m.type === 'game:start') room.start(playerId);
            else if (m.type === 'game:next') room.next(playerId);
            else if (m.type === 'cards:submit') {
              if (m.roundId !== room.game.roundId) return err('stale_round');
              room.submit(playerId, m.cardIds, m.claim);
            } else if (m.type === 'vote:submit') {
              if (m.roundId !== room.game.roundId) return err('stale_round');
              room.vote(playerId, m.choice);
            } else if (m.type === 'sheep:action') room.sheepAction(playerId, m.sheepId, m.action);
            else if (m.type === 'sheep:rename') room.rename(playerId, m.sheepId, m.name);
          }
        }
      } catch (e) {
        err(e instanceof GameError ? e.message : 'internal');
      }
    });
    ws.on('close', () => room && playerId && room.leave(playerId));
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
