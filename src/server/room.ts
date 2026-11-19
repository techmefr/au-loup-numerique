import { randomUUID } from '../engine/random.js';
import { Game, GameError, type Vote } from '../engine/game.js';
import { BOT_NAMES, chooseMove, chooseVote } from '../engine/bot.js';
import type { Claim } from '../engine/resolve.js';

export const SHEEP_ACTIONS = ['jump', 'graze', 'sleep', 'bleat', 'run', 'dance'] as const;
export type SheepAction = (typeof SHEEP_ACTIONS)[number];

export interface Sheep { id: string; name?: string }
export type Send = (msg: unknown) => void;

interface Member { id: string; token: string; send: Send | null; lastAction: number }

const COOLDOWN_MS = 800;
const INITIAL_FLOCK = 6;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

export class Room {
  game = new Game();
  members = new Map<string, Member>();
  displays = new Set<Send>();
  sheep: Sheep[] = [];
  hostId = '';
  voteTimer: ReturnType<typeof setTimeout> | null = null;
  botTimers = new Set<ReturnType<typeof setTimeout>>();
  voteSeconds = 0;
  botDelay = 1;

  constructor(public code: string) {}

  addBots(count: number): void {
    for (let i = 0; i < Math.min(count, 7); i++) {
      this.game.addPlayer(`bot-${randomUUID()}`, BOT_NAMES[i % BOT_NAMES.length]!, true);
    }
  }

  join(name: string, send: Send, resumeToken?: string): { id: string; token: string } {
    const existing = resumeToken ? [...this.members.values()].find((m) => m.token === resumeToken) : undefined;
    if (existing) {
      existing.send = send;
      this.game.player(existing.id).connected = true;
      this.broadcast();
      return { id: existing.id, token: existing.token };
    }
    const id = randomUUID();
    this.game.addPlayer(id, name.trim().slice(0, 16) || 'Mouton');
    const member = { id, token: randomUUID(), send, lastAction: 0 };
    this.members.set(id, member);
    if (!this.hostId) this.hostId = id;
    this.broadcast();
    return { id, token: member.token };
  }

  leave(id: string): void {
    const m = this.members.get(id);
    if (!m) return;
    m.send = null;
    this.game.player(id).connected = false;
    this.broadcast();
  }

  attachDisplay(send: Send): void {
    this.displays.add(send);
    send(this.publicSnapshot());
  }

  start(id: string): void {
    if (id !== this.hostId) throw new GameError('host_only');
    this.game.start();
    this.sheep = Array.from({ length: INITIAL_FLOCK }, () => ({ id: randomUUID() }));
    this.armTimer();
    this.broadcast();
  }

  submit(id: string, cardIds: string[], claim: Claim): void {
    this.game.submit(id, cardIds, claim);
    this.armTimer();
    this.broadcast();
  }

  vote(id: string, choice: Vote): void {
    const revealed = this.game.vote(id, choice);
    this.afterVote(revealed);
  }

  private afterVote(revealed: boolean): void {
    if (!revealed) return this.broadcast();
    this.clearTimer();
    const r = this.game.lastReveal!;
    if (r.outcome === 'entered') {
      for (let i = 0; i < r.resolution.sheepSaved; i++) this.sheep.push({ id: randomUUID() });
    } else {
      this.sheep = [];
    }
    this.emit({ type: 'round:revealed', reveal: r });
    this.broadcast();
  }

  next(id: string): void {
    if (id !== this.hostId) throw new GameError('host_only');
    this.game.next();
    this.armTimer();
    this.broadcast();
  }

  sheepAction(id: string, sheepId: string, action: SheepAction): void {
    const m = this.members.get(id);
    if (!m || !this.sheep.some((s) => s.id === sheepId)) return;
    const now = Date.now();
    if (now - m.lastAction < COOLDOWN_MS) return;
    m.lastAction = now;
    this.emit({ type: 'meadow:sheep_action', sheepId, action, at: now });
  }

  rename(id: string, sheepId: string, name: string): void {
    const clean = name.replace(/[<>&"']/g, '').trim().slice(0, 16);
    const s = this.sheep.find((x) => x.id === sheepId);
    if (!s || !clean || id !== this.hostId) return;
    s.name = clean;
    this.broadcast();
  }

  private armTimer(): void {
    this.clearTimer();
    if (!this.voteSeconds || this.game.phase !== 'voting') return;
    this.voteTimer = setTimeout(() => {
      this.game.closeVoting();
      this.afterVote(true);
    }, this.voteSeconds * 1000);
  }

  private clearTimer(): void {
    if (this.voteTimer) clearTimeout(this.voteTimer);
    this.voteTimer = null;
  }

  private later(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.botTimers.delete(t);
      try { fn(); } catch { /* état déjà passé */ }
    }, ms * this.botDelay);
    this.botTimers.add(t);
  }

  private runBots(): void {
    const g = this.game;
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
    if (g.phase === 'select' && g.author.bot) {
      const roundId = g.roundId;
      this.later(rand(1400, 2400), () => {
        if (g.roundId !== roundId || g.phase !== 'select') return;
        const move = chooseMove(g.author.hand, g.mode);
        this.submit(g.author.id, move.cardIds, move.claim);
      });
    } else if (g.phase === 'voting') {
      const roundId = g.roundId;
      for (const bot of g.eligibleVoters().filter((p) => p.bot && !g.votes.has(p.id))) {
        this.later(rand(1500, 3500), () => {
          if (g.roundId !== roundId || g.phase !== 'voting' || g.votes.has(bot.id)) return;
          this.vote(bot.id, chooseVote(g.pile.length, g.author.hand.length));
        });
      }
    }
  }

  private emit(msg: unknown): void {
    for (const m of this.members.values()) m.send?.(msg);
    for (const d of this.displays) d(msg);
  }

  publicSnapshot(): Record<string, unknown> {
    const g = this.game;
    const reveal = g.phase === 'result' || g.phase === 'finished' ? g.lastReveal : null;
    return {
      type: 'room:snapshot',
      code: this.code,
      hostId: this.hostId,
      phase: g.phase,
      roundNo: g.roundNo,
      roundId: g.roundId,
      authorId: g.phase === 'lobby' ? null : g.author.id,
      pile: g.phase === 'voting' ? g.pile.length : 0,
      claim: g.phase === 'voting' ? g.claim : null,
      sheepSaved: g.sheepSaved,
      winnerId: g.winnerId,
      mode: g.mode,
      voted: g.votes.size,
      voters: g.phase === 'lobby' ? 0 : g.eligibleVoters().length,
      players: g.players.map((p) => ({ id: p.id, name: p.name, cards: p.hand.length, score: p.score, connected: p.connected, bot: p.bot })),
      sheep: this.sheep,
      reveal,
    };
  }

  snapshotFor(id: string): Record<string, unknown> {
    const p = this.game.player(id);
    return { ...this.publicSnapshot(), you: id, hand: p.hand, myVote: this.game.votes.get(id) ?? null };
  }

  broadcast(): void {
    for (const m of this.members.values()) m.send?.(this.snapshotFor(m.id));
    const pub = this.publicSnapshot();
    for (const d of this.displays) d(pub);
    this.runBots();
  }
}
