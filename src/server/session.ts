import { z } from 'zod';
import { GameError } from '../engine/game.js';
import { randomInt } from '../engine/random.js';
import { Room, SHEEP_ACTIONS, type Send } from './room.js';

const claim = z.union([z.object({ kind: z.literal('all-sheep') }), z.object({ kind: z.literal('survivors'), count: z.number().int().min(0).max(3) })]);

const message = z.discriminatedUnion('type', [
  z.object({ type: z.literal('room:create'), displayName: z.string().max(16), voteSeconds: z.number().int().min(0).max(120).optional(), mode: z.enum(['ni-vu', 'compte']).optional(), bots: z.number().int().min(0).max(7).optional(), solo: z.boolean().optional() }),
  z.object({ type: z.literal('room:join'), code: z.string().max(8), displayName: z.string().max(16), resumeToken: z.string().optional() }),
  z.object({ type: z.literal('display:attach'), code: z.string().max(8) }),
  z.object({ type: z.literal('game:start') }),
  z.object({ type: z.literal('game:next') }),
  z.object({ type: z.literal('cards:submit'), roundId: z.string(), cardIds: z.array(z.string()).min(1).max(3), claim }),
  z.object({ type: z.literal('vote:submit'), roundId: z.string(), choice: z.enum(['wolf', 'trust']) }),
  z.object({ type: z.literal('sheep:action'), sheepId: z.string(), action: z.enum(SHEEP_ACTIONS) }),
  z.object({ type: z.literal('sheep:rename'), sheepId: z.string(), name: z.string().max(16) }),
]);

export const rooms = new Map<string, Room>();

function newCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    const code = Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join('');
    if (!rooms.has(code)) return code;
  }
}

export interface Session {
  handle(raw: string): void;
  close(): void;
}

export function createSession(send: Send, store: Map<string, Room> = rooms): Session {
  let room: Room | null = null;
  let playerId = '';
  const err = (code: string) => send({ type: 'error', code });

  function handle(raw: string): void {
    let parsed;
    try {
      parsed = message.safeParse(JSON.parse(raw));
    } catch {
      return err('bad_json');
    }
    if (!parsed.success) return err('bad_message');
    const m = parsed.data;
    try {
      switch (m.type) {
        case 'room:create': {
          room = new Room(newCodeIn(store));
          room.voteSeconds = m.voteSeconds ?? 0;
          room.game.mode = m.mode ?? 'ni-vu';
          store.set(room.code, room);
          const j = room.join(m.displayName, send);
          playerId = j.id;
          send({ type: 'room:joined', code: room.code, playerId, resumeToken: j.token });
          room.addBots(m.bots ?? 0);
          if (m.solo) room.start(playerId);
          else room.broadcast();
          break;
        }
        case 'room:join': {
          const target = store.get(m.code.toUpperCase());
          if (!target) return err('room_not_found');
          room = target;
          const j = room.join(m.displayName, send, m.resumeToken);
          playerId = j.id;
          send({ type: 'room:joined', code: room.code, playerId, resumeToken: j.token });
          break;
        }
        case 'display:attach': {
          const target = store.get(m.code.toUpperCase());
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
  }

  return { handle, close: () => { if (room && playerId) room.leave(playerId); } };
}

function newCodeIn(store: Map<string, Room>): string {
  if (store === rooms) return newCode();
  for (;;) {
    const c = newCode();
    if (!store.has(c)) return c;
  }
}
