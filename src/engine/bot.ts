import type { Card, Mode, Vote } from './game.js';
import { resolve, type Claim } from './resolve.js';

export const BOT_NAMES = ['Bella', 'Médor', 'Pompon', 'Flocon', 'Câline', 'Noisette', 'Biquette'];

export interface BotMove { cardIds: string[]; claim: Claim }
type Rng = () => number;

const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]!;

export function chooseMove(hand: Card[], mode: Mode = 'ni-vu', rng: Rng = Math.random, bluffChance = 0.35): BotMove {
  const count = Math.min(hand.length, 1 + Math.floor(rng() * 3));
  if (mode === 'compte') {
    const pool = [...hand];
    const chosen: Card[] = [];
    while (chosen.length < count) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    const saved = resolve(chosen.map((c) => c.type)).sheepSaved;
    const claimed = rng() < bluffChance ? pick([0, 1, 2, 3].filter((n) => n !== saved), rng) : saved;
    return { cardIds: chosen.map((c) => c.id), claim: { kind: 'survivors', count: claimed } };
  }
  const honest = hand.filter((c) => c.type !== 'wolf');
  const wolves = hand.filter((c) => c.type === 'wolf');
  const bluff = wolves.length > 0 && (honest.length === 0 || rng() < bluffChance);
  const chosen: Card[] = [];
  const pool = [...honest];
  if (bluff) chosen.push(pick(wolves, rng));
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  if (chosen.length === 0) chosen.push(pick(hand, rng));
  return { cardIds: chosen.map((c) => c.id), claim: { kind: 'all-sheep' } };
}

export function chooseVote(pileSize: number, authorHandSize: number, rng: Rng = Math.random): Vote {
  const suspicion = 0.15 + 0.12 * pileSize + (authorHandSize <= 2 ? 0.25 : 0);
  return rng() < suspicion ? 'wolf' : 'trust';
}
