import { randomInt, randomUUID } from 'node:crypto';
import { isLie, resolve, type Animal, type Claim, type Resolution } from './resolve.js';

export type Phase = 'lobby' | 'select' | 'voting' | 'result' | 'finished';
export type Vote = 'wolf' | 'trust';
export type Mode = 'ni-vu' | 'compte';
export type Outcome = 'entered' | 'author_took' | 'accuser_took';

export interface Card { id: string; type: Animal }
export interface Player { id: string; name: string; hand: Card[]; score: number; connected: boolean; bot: boolean }

export interface GameConfig {
  handSize: number;
  maxPlayers: number;
}

export const DEFAULT_CONFIG: GameConfig = { handSize: 10, maxPlayers: 8 };

export interface Reveal {
  roundId: string;
  authorId: string;
  cards: Animal[];
  claim: Claim;
  votes: Record<string, Vote | 'abstain'>;
  resolution: Resolution;
  lie: boolean;
  outcome: Outcome;
  accuserId: string | null;
  takerId: string | null;
}

export class GameError extends Error {}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function buildDeck(): Card[] {
  const counts: Record<Animal, number> = { sheep: 36, wolf: 16, dog: 8 };
  const cards: Card[] = [];
  for (const type of Object.keys(counts) as Animal[]) {
    for (let i = 0; i < counts[type]; i++) cards.push({ id: randomUUID(), type });
  }
  return shuffle(cards);
}

export class Game {
  phase: Phase = 'lobby';
  players: Player[] = [];
  pile: Card[] = [];
  authorIndex = 0;
  roundNo = 0;
  roundId = '';
  claim: Claim = { kind: 'all-sheep' };
  votes = new Map<string, Vote>();
  lastReveal: Reveal | null = null;
  sheepSaved = 0;
  mode: Mode = 'ni-vu';
  winnerId: string | null = null;

  constructor(public config: GameConfig = DEFAULT_CONFIG) {}

  addPlayer(id: string, name: string, bot = false): Player {
    if (this.phase !== 'lobby' && this.phase !== 'finished') throw new GameError('game_started');
    if (this.players.length >= this.config.maxPlayers) throw new GameError('room_full');
    const player: Player = { id, name, hand: [], score: 0, connected: true, bot };
    this.players.push(player);
    return player;
  }

  player(id: string): Player {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new GameError('unknown_player');
    return p;
  }

  get author(): Player {
    return this.players[this.authorIndex]!;
  }

  start(): void {
    if (this.phase !== 'lobby' && this.phase !== 'finished') throw new GameError('bad_phase');
    if (this.players.length < 2) throw new GameError('not_enough_players');
    const deck = buildDeck();
    const size = Math.min(this.config.handSize, Math.floor(deck.length / this.players.length));
    this.roundNo = 0;
    this.sheepSaved = 0;
    this.lastReveal = null;
    this.winnerId = null;
    for (const p of this.players) {
      p.score = 0;
      p.hand = deck.splice(0, size);
    }
    this.authorIndex = 0;
    this.beginRound();
  }

  private beginRound(): void {
    this.roundNo += 1;
    this.roundId = randomUUID();
    this.votes.clear();
    this.pile = [];
    this.phase = 'select';
  }

  submit(playerId: string, cardIds: string[], claim: Claim): void {
    if (this.phase !== 'select') throw new GameError('bad_phase');
    if (this.author.id !== playerId) throw new GameError('not_your_turn');
    const unique = new Set(cardIds);
    if (unique.size !== cardIds.length || cardIds.length < 1 || cardIds.length > 3) throw new GameError('bad_selection');
    if ((this.mode === 'ni-vu') !== (claim.kind === 'all-sheep')) throw new GameError('bad_claim');
    if (claim.kind === 'survivors' && (claim.count < 0 || claim.count > 3 || !Number.isInteger(claim.count))) {
      throw new GameError('bad_claim');
    }
    const hand = this.author.hand;
    const picked = cardIds.map((id) => hand.find((c) => c.id === id));
    if (picked.some((c) => !c)) throw new GameError('card_not_in_hand');
    this.author.hand = hand.filter((c) => !unique.has(c.id));
    this.pile = picked as Card[];
    this.claim = claim;
    this.phase = 'voting';
  }

  eligibleVoters(): Player[] {
    return this.players.filter((p) => p.id !== this.author.id);
  }

  vote(playerId: string, choice: Vote): boolean {
    if (this.phase !== 'voting') throw new GameError('bad_phase');
    if (playerId === this.author.id) throw new GameError('author_cannot_vote');
    if (this.votes.has(playerId)) throw new GameError('already_voted');
    this.player(playerId);
    this.votes.set(playerId, choice);
    if (this.votes.size < this.eligibleVoters().length) return false;
    this.reveal();
    return true;
  }

  closeVoting(): void {
    if (this.phase === 'voting') this.reveal();
  }

  private reveal(): void {
    const cards = this.pile.map((c) => c.type);
    const resolution = resolve(cards);
    const lie = isLie(cards, this.claim);
    const accuserId = [...this.votes.entries()].find(([, v]) => v === 'wolf')?.[0] ?? null;
    const record: Reveal['votes'] = {};
    for (const p of this.eligibleVoters()) record[p.id] = this.votes.get(p.id) ?? 'abstain';

    let outcome: Outcome = 'entered';
    let takerId: string | null = null;
    if (accuserId) {
      outcome = lie ? 'author_took' : 'accuser_took';
      takerId = lie ? this.author.id : accuserId;
      this.player(takerId).hand.push(...this.pile);
    } else {
      this.sheepSaved += resolution.sheepSaved;
      this.author.score += resolution.sheepSaved;
      if (this.author.hand.length === 0) this.winnerId = this.author.id;
    }
    this.lastReveal = { roundId: this.roundId, authorId: this.author.id, cards, claim: this.claim, votes: record, resolution, lie, outcome, accuserId, takerId };
    this.phase = 'result';
  }

  next(): void {
    if (this.phase !== 'result') throw new GameError('bad_phase');
    if (this.winnerId) {
      this.phase = 'finished';
      return;
    }
    this.authorIndex = (this.authorIndex + 1) % this.players.length;
    this.beginRound();
  }
}
