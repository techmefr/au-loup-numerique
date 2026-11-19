import { randomInt, randomUUID } from './random.js';
import { isLie, resolve, type Animal, type Claim, type Resolution } from './resolve.js';

export type Phase = 'lobby' | 'select' | 'voting' | 'result' | 'finished';
export type Vote = 'wolf' | 'trust';
export const MODES = ['ni-vu', 'compte', 'loup-parmi-nous', 'passe-ton-loup', 'troupeau-de-tete', 'qui-sy-frotte'] as const;
export type Mode = (typeof MODES)[number];
export type Camp = 'sheep' | 'wolf';
export type VariantAction =
  | { kind: 'place'; cardIds: string[]; targetId?: string; announcement?: string }
  | { kind: 'draw' }
  | { kind: 'stop' };

interface VariantResult {
  cards: Animal[];
  saved: number;
  eaten: number;
  loserId?: string;
  winningCamp?: Camp;
  winners?: string[];
  flocks?: { playerId: string; cards: Animal[]; saved: number }[];
}
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
  pasture: Card[] = [];
  roles = new Map<string, Camp>();
  flocks = new Map<string, Card[]>();
  deck: Card[] = [];
  announcements: { playerId: string; text: string }[] = [];
  turnCards: Animal[] = [];
  turnSheep = 0;
  shields = 0;
  sheepEaten = 0;
  variantResult: VariantResult | null = null;

  get isBluff(): boolean { return this.mode === 'ni-vu' || this.mode === 'compte'; }
  get minPlayers(): number { return this.mode === 'loup-parmi-nous' ? 3 : 2; }
  get maxPlayers(): number { return Math.min(this.config.maxPlayers, this.mode === 'troupeau-de-tete' ? 6 : 8); }

  constructor(public config: GameConfig = DEFAULT_CONFIG) {}

  addPlayer(id: string, name: string, bot = false): Player {
    if (this.phase !== 'lobby' && this.phase !== 'finished') throw new GameError('game_started');
    if (this.players.length >= this.maxPlayers) throw new GameError('room_full');
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
    if (this.players.length < this.minPlayers) throw new GameError(this.minPlayers === 3 ? 'need_three_players' : 'not_enough_players');
    if (this.players.length > this.maxPlayers) throw new GameError('room_full');
    this.deck = buildDeck();
    const size = this.isBluff ? Math.min(this.config.handSize, Math.floor(this.deck.length / this.players.length))
      : this.mode === 'qui-sy-frotte' ? 0 : 3;
    this.roundNo = 0;
    this.sheepSaved = 0;
    this.sheepEaten = 0;
    this.lastReveal = null;
    this.winnerId = null;
    this.pasture = [];
    this.roles.clear();
    this.flocks.clear();
    const wolves = this.players.length >= 6 ? 2 : 1;
    const roles = this.mode === 'loup-parmi-nous'
      ? shuffle<Camp>(this.players.map((_, i) => i < wolves ? 'wolf' : 'sheep')) : [];
    const wolfSeat = this.mode === 'passe-ton-loup' ? randomInt(this.players.length) : -1;
    const dogSeat = wolfSeat === -1 ? -1 : (wolfSeat + 1 + randomInt(this.players.length - 1)) % this.players.length;
    const reserved = new Map<number, Card>();
    if (wolfSeat !== -1) {
      reserved.set(wolfSeat, this.deck.splice(this.deck.findIndex((card) => card.type === 'wolf'), 1)[0]!);
      reserved.set(dogSeat, this.deck.splice(this.deck.findIndex((card) => card.type === 'dog'), 1)[0]!);
    }
    this.players.forEach((player, i) => {
      player.score = 0;
      const seed = reserved.get(i);
      player.hand = seed ? [seed] : [];
      if (roles[i]) this.roles.set(player.id, roles[i]!);
      if (this.mode === 'troupeau-de-tete') this.flocks.set(player.id, []);
      while (player.hand.length < size) {
        const index = this.mode === 'passe-ton-loup'
          ? this.deck.findIndex((card) => !this.hasDangerousPair([...player.hand, card]))
          : 0;
        player.hand.push(this.deck.splice(index, 1)[0]!);
      }
    });
    this.authorIndex = 0;
    this.beginRound();
  }

  private beginRound(): void {
    this.roundNo += 1;
    this.roundId = randomUUID();
    this.votes.clear();
    this.pile = [];
    this.phase = 'select';
    this.announcements = [];
    this.variantResult = null;
    this.turnCards = [];
    this.turnSheep = 0;
    this.shields = 0;
  }

  submit(playerId: string, cardIds: string[], claim: Claim): void {
    if (!this.isBluff || this.phase !== 'select') throw new GameError('bad_phase');
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
      this.player(takerId).hand.push(...this.pasture, ...this.pile);
      this.pasture = [];
    } else {
      this.pasture.push(...this.pile);
      this.sheepSaved += resolution.sheepSaved;
      this.author.score += resolution.sheepSaved;
    }
    if (this.author.hand.length === 0) this.winnerId = this.author.id;
    this.lastReveal = { roundId: this.roundId, authorId: this.author.id, cards, claim: this.claim, votes: record, resolution, lie, outcome, accuserId, takerId };
    this.phase = 'result';
  }

  playVariant(playerId: string, action: VariantAction): void {
    if (this.isBluff || this.phase !== 'select') throw new GameError('bad_phase');
    if (this.author.id !== playerId) throw new GameError('not_your_turn');
    if (this.mode === 'qui-sy-frotte') {
      if (action.kind === 'place') throw new GameError('bad_message');
      if (action.kind === 'draw') this.drawRiskCard();
      else this.finishRiskTurn();
      return;
    }
    if (action.kind !== 'place') throw new GameError('bad_message');
    const maximum = this.mode === 'loup-parmi-nous' ? 3 : 1;
    const ids = new Set(action.cardIds);
    if (ids.size !== action.cardIds.length || ids.size < 1 || ids.size > maximum) throw new GameError('bad_selection');
    const cards = this.author.hand.filter((card) => ids.has(card.id));
    if (cards.length !== ids.size) throw new GameError('card_not_in_hand');
    const target = this.mode === 'troupeau-de-tete' ? this.flocks.get(action.targetId ?? '') : undefined;
    if (this.mode === 'troupeau-de-tete' && !target) throw new GameError('unknown_player');
    this.author.hand = this.author.hand.filter((card) => !ids.has(card.id));

    if (this.mode === 'passe-ton-loup') {
      this.advanceAuthor();
      this.author.hand.push(cards[0]!);
      if (this.hasDangerousPair(this.author.hand)) {
        this.variantResult = { cards: ['wolf', 'dog'], saved: 0, eaten: 0, loserId: this.author.id };
        this.phase = 'finished';
      }
    } else if (target) {
      target.push(cards[0]!);
      const replacement = this.deck.shift();
      if (replacement) this.author.hand.push(replacement);
      if (this.players.every((player) => !player.hand.length)) this.finishFlocks();
      else this.advanceAuthor();
    } else {
      this.pile.push(...cards);
      this.announcements.push({ playerId, text: (action.announcement ?? '').trim().slice(0, 80) });
      while (this.author.hand.length < 3 && this.deck.length) this.author.hand.push(this.deck.shift()!);
      const next = this.players.findIndex((player, i) => i > this.authorIndex && player.hand.length > 0);
      if (next === -1) this.finishHiddenRound();
      else {
        this.authorIndex = next;
        this.roundId = randomUUID();
      }
    }
  }

  private advanceAuthor(): void {
    do {
      this.authorIndex = (this.authorIndex + 1) % this.players.length;
    } while (this.mode === 'troupeau-de-tete' && !this.author.hand.length);
    this.roundId = randomUUID();
  }

  private hasDangerousPair(hand: Card[]): boolean {
    return hand.some((card) => card.type === 'wolf') && hand.some((card) => card.type === 'dog');
  }

  private finishHiddenRound(): void {
    const cards = this.pile.map((card) => card.type);
    const { sheepSaved: saved, sheepEaten: eaten } = resolve(cards);
    this.sheepSaved += saved;
    this.sheepEaten += eaten;
    const sheepWon = this.sheepSaved >= 15;
    const wolvesWon = this.sheepEaten >= 8;
    const winningCamp = sheepWon === wolvesWon ? undefined : sheepWon ? 'sheep' : 'wolf';
    this.variantResult = { cards, saved, eaten, winningCamp };
    this.phase = sheepWon || wolvesWon || this.players.every((player) => !player.hand.length) ? 'finished' : 'result';
  }

  private finishFlocks(): void {
    const flocks = this.players.map((player) => {
      const cards = this.flocks.get(player.id)!.map((card) => card.type);
      const { sheepSaved: saved } = resolve(cards);
      player.score = saved;
      return { playerId: player.id, cards, saved };
    });
    const saved = Math.max(...flocks.map((flock) => flock.saved));
    this.variantResult = { cards: [], saved, eaten: 0, flocks, winners: this.players.filter((player) => player.score === saved).map((player) => player.id) };
    this.phase = 'finished';
  }

  private drawRiskCard(): void {
    const card = this.deck.shift();
    if (!card) throw new GameError('bad_phase');
    this.turnCards.push(card.type);
    if (card.type === 'sheep') this.turnSheep++;
    if (card.type === 'dog') this.shields++;
    if (card.type === 'wolf') {
      if (this.shields) this.shields--;
      else this.turnSheep = Math.max(0, this.turnSheep - 1);
    }
    this.roundId = randomUUID();
    if (!this.deck.length) this.finishRiskTurn();
  }

  private finishRiskTurn(): void {
    if (!this.turnCards.length) throw new GameError('bad_phase');
    this.author.score += this.turnSheep;
    this.sheepSaved += this.turnSheep;
    const best = Math.max(...this.players.map((player) => player.score));
    const winners = this.deck.length ? undefined : this.players.filter((player) => player.score === best).map((player) => player.id);
    this.variantResult = { cards: [...this.turnCards], saved: this.turnSheep, eaten: 0, winners };
    this.phase = this.deck.length ? 'result' : 'finished';
  }

  next(): void {
    if (this.phase !== 'result') throw new GameError('bad_phase');
    if (this.mode === 'loup-parmi-nous') {
      this.authorIndex = this.players.findIndex((player) => player.hand.length > 0);
      this.beginRound();
      return;
    }
    if (this.winnerId) {
      this.phase = 'finished';
      return;
    }
    this.authorIndex = (this.authorIndex + 1) % this.players.length;
    this.beginRound();
  }
}
