import { randomUUID } from 'node:crypto';
import { Game, GameError, type Vote } from '../engine/game.js';
import type { Claim } from '../engine/resolve.js';

export const SHEEP_ACTIONS = ['jump', 'graze', 'sleep', 'bleat', 'run', 'dance'] as const;
export type SheepAction = (typeof SHEEP_ACTIONS)[number];

export interface Sheep { id: string; name?: string }
export type Send = (msg: unknown) => void;

interface Member { id: string; token: string; send: Send | null; lastAction: number }

const COOLDOWN_MS = 800;

export class Room {
  game = new Game();
  members = new Map<string, Member>();
  displays = new Set<Send>();
  sheep: Sheep[] = [];
  hostId = '';
  voteTimer: NodeJS.Timeout | null = null;
  voteSeconds = 0;

  constructor(public code: string) {}

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
    this.sheep = Array.from({ length: this.game.players.length * 2 }, () => ({ id: randomUUID() }));
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
    this.applyMeadow();
    this.broadcast();
    this.emit({ type: 'round:revealed', reveal: this.game.lastReveal });
  }

  next(id: string): void {
    if (id !== this.hostId) throw new GameError('host_only');
    this.game.next();
    this.broadcast();
  }

  private applyMeadow(): void {
    const r = this.game.lastReveal;
    if (!r) return;
    for (let i = 0; i < r.resolution.sheepEaten && this.sheep.length > 0; i++) {
      const gone = this.sheep.pop()!;
      this.emit({ type: 'meadow:sheep_removed', sheepId: gone.id });
    }
    for (let i = 0; i < r.resolution.sheepSaved; i++) {
      const s = { id: randomUUID() };
      this.sheep.push(s);
      this.emit({ type: 'meadow:sheep_added', sheepId: s.id });
    }
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
      totalRounds: g.totalRounds,
      roundId: g.roundId,
      authorId: g.phase === 'lobby' ? null : g.author.id,
      pile: g.pile.length,
      claim: g.phase === 'voting' ? g.claim : null,
      deck: g.deck.length,
      sheepSaved: g.sheepSaved,
      sheepEaten: g.sheepEaten,
      voted: g.votes.size,
      voters: g.phase === 'lobby' ? 0 : g.eligibleVoters().length,
      players: g.players.map((p) => ({ id: p.id, name: p.name, cards: p.hand.length, score: p.score, connected: p.connected })),
      sheep: this.sheep,
      reveal,
    };
  }

  snapshotFor(id: string): Record<string, unknown> {
    const p = this.game.player(id);
    return {
      ...this.publicSnapshot(),
      you: id,
      hand: p.hand,
      myVote: this.game.votes.get(id) ?? null,
    };
  }

  broadcast(): void {
    for (const m of this.members.values()) m.send?.(this.snapshotFor(m.id));
    const pub = this.publicSnapshot();
    for (const d of this.displays) d(pub);
  }
}
