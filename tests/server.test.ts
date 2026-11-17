import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../src/server/index.js';

let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(0); });
afterAll(() => app.close());

class Client {
  ws: WebSocket;
  msgs: any[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://localhost:${app.port}`);
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(String(d))));
  }
  open() { return new Promise<void>((r) => this.ws.on('open', () => r())); }
  send(m: unknown) { this.ws.send(JSON.stringify(m)); }
  async wait(pred: (m: any) => boolean): Promise<any> {
    for (let i = 0; i < 100; i++) {
      const f = [...this.msgs].reverse().find(pred);
      if (f) return f;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('timeout');
  }
  snap(pred: (s: any) => boolean = () => true) { return this.wait((m) => m.type === 'room:snapshot' && pred(m)); }
}

async function table(n: number) {
  const cs = Array.from({ length: n }, () => new Client());
  await Promise.all(cs.map((c) => c.open()));
  cs[0]!.send({ type: 'room:create', displayName: 'Host' });
  const { code } = await cs[0]!.wait((m) => m.type === 'room:joined');
  for (let i = 1; i < n; i++) cs[i]!.send({ type: 'room:join', code, displayName: `P${i}` });
  await cs[0]!.snap((s) => s.players.length === n);
  cs[0]!.send({ type: 'game:start' });
  await Promise.all(cs.map((c) => c.snap((s) => s.phase === 'select')));
  return { cs, code };
}

describe('server', () => {
  it('2 clients: no hand leak, votes hidden until close, reveal broadcast', async () => {
    const { cs } = await table(2);
    const [a, b] = cs as [Client, Client];
    const sa = await a.snap((s) => s.phase === 'select');
    const sb = await b.snap((s) => s.phase === 'select');
    expect(sa.hand).toHaveLength(5);
    expect(JSON.stringify(sa)).not.toContain(sb.hand[0].id);
    expect(sa.players.every((p: any) => p.hand === undefined)).toBe(true);

    const author = sa.authorId === sa.you ? a : b;
    const voter = author === a ? b : a;
    const as = await author.snap();
    author.send({ type: 'cards:submit', roundId: as.roundId, cardIds: [as.hand[0].id], claim: { kind: 'all-sheep' } });
    const v = await voter.snap((s) => s.phase === 'voting');
    expect(v.pile).toBe(1);
    expect(v.reveal).toBeNull();
    voter.send({ type: 'vote:submit', roundId: v.roundId, choice: 'trust' });
    const ev = await author.wait((m) => m.type === 'round:revealed');
    expect(ev.reveal.cards).toHaveLength(1);
    cs.forEach((c) => c.ws.close());
  });

  it('rejects stale round and reconnects with token', async () => {
    const { cs, code } = await table(3);
    const s = await cs[1]!.snap();
    cs[1]!.send({ type: 'vote:submit', roundId: 'old', choice: 'wolf' });
    await cs[1]!.wait((m) => m.type === 'error' && m.code === 'stale_round');
    const joined = await cs[1]!.wait((m) => m.type === 'room:joined');
    cs[1]!.ws.close();
    await cs[0]!.snap((x) => x.players.some((p: any) => !p.connected));
    const back = new Client();
    await back.open();
    back.send({ type: 'room:join', code, displayName: 'x', resumeToken: joined.resumeToken });
    const r = await back.snap((x) => x.phase === 'select');
    expect(r.you).toBe(s.you);
    expect(r.hand).toHaveLength(5);
    cs.forEach((c) => c.ws.close());
    back.ws.close();
  });

  it('isolates rooms', async () => {
    const t1 = await table(2);
    const t2 = await table(2);
    expect(t1.code).not.toBe(t2.code);
    t1.cs.concat(t2.cs).forEach((c) => c.ws.close());
  });
});
