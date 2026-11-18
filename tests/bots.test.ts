import { describe, expect, it } from 'vitest';
import { Room } from '../src/server/room.js';

describe('solo contre ordinateur', () => {
  it('les bots posent, votent et la partie avance seule', async () => {
    const room = new Room('TEST');
    room.botDelay = 0.005;
    let me = '';
    let rounds = 0;
    const seen = new Set<string>();
    const send = (m: any) => {
      if (m.type !== 'room:snapshot' || !me) return;
      seen.add(m.phase);
      rounds = Math.max(rounds, m.roundNo);
      queueMicrotask(() => {
        try {
          if (m.phase === 'select' && m.authorId === me) room.submit(me, [m.hand[0].id], { kind: 'all-sheep' });
          else if (m.phase === 'voting' && m.authorId !== me && !m.myVote) room.vote(me, 'trust');
          else if (m.phase === 'result') room.next(me);
        } catch { /* snapshot périmé */ }
      });
    };
    const j = room.join('Moi', send);
    me = j.id;
    room.addBots(3);
    room.start(me);
    for (let i = 0; i < 200 && rounds < 8; i++) await new Promise((r) => setTimeout(r, 20));
    expect(rounds).toBeGreaterThanOrEqual(8);
    expect(seen.has('voting')).toBe(true);
    expect(room.game.players.filter((p) => p.bot)).toHaveLength(3);
  });
});
