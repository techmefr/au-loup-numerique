import { describe, expect, it } from 'vitest';
import { resolve, isLie, type Animal } from '../src/engine/resolve.js';
import { Game, buildDeck, type Card } from '../src/engine/game.js';
import { chooseMove, chooseVote } from '../src/engine/bot.js';

const S: Animal = 'sheep', L: Animal = 'wolf', C: Animal = 'dog';

describe('resolve', () => {
  it.each([
    [[S, S, L], 1, 1],
    [[S, L, C], 1, 0],
    [[S, L, L], 0, 1],
    [[S, S, C], 2, 0],
    [[L, L, C], 0, 0],
    [[L], 0, 0],
  ] as [Animal[], number, number][])('%j', (cards, saved, eaten) => {
    const r = resolve(cards);
    expect(r.sheepSaved).toBe(saved);
    expect(r.sheepEaten).toBe(eaten);
  });

  it('lie detection', () => {
    expect(isLie([S, C], { kind: 'all-sheep' })).toBe(false);
    expect(isLie([S, L], { kind: 'all-sheep' })).toBe(true);
    expect(isLie([S, S, L], { kind: 'survivors', count: 1 })).toBe(false);
    expect(isLie([S, S, L], { kind: 'survivors', count: 2 })).toBe(true);
  });
});

describe('deck', () => {
  it('has 60 cards 36/16/8', () => {
    const d = buildDeck();
    expect(d).toHaveLength(60);
    expect(d.filter((c) => c.type === 'wolf')).toHaveLength(16);
  });
});

function setup(n = 3): Game {
  const g = new Game();
  for (let i = 0; i < n; i++) g.addPlayer(`p${i}`, `P${i}`);
  g.start();
  return g;
}

const rig = (g: Game, id: string, types: Animal[]) => {
  g.player(id).hand = types.map((type, i) => ({ id: `${id}-${i}`, type }) as Card);
};

describe('game', () => {
  it('needs 2 players and deals the whole hands', () => {
    const g = new Game();
    g.addPlayer('a', 'A');
    expect(() => g.start()).toThrow();
    const h = setup(8);
    expect(h.players.every((p) => p.hand.length === 7)).toBe(true);
  });

  it('only the author plays 1-3 cards from own hand', () => {
    const g = setup();
    const author = g.author;
    expect(() => g.submit('p1', [g.player('p1').hand[0]!.id], { kind: 'all-sheep' })).toThrow('not_your_turn');
    expect(() => g.submit(author.id, [], { kind: 'all-sheep' })).toThrow();
    expect(() => g.submit(author.id, author.hand.slice(0, 4).map((c) => c.id), { kind: 'all-sheep' })).toThrow();
    expect(() => g.submit(author.id, ['nope'], { kind: 'all-sheep' })).toThrow('card_not_in_hand');
    expect(() => g.submit(author.id, [author.hand[0]!.id], { kind: 'survivors', count: 1 })).toThrow('bad_claim');
    g.submit(author.id, author.hand.slice(0, 2).map((c) => c.id), { kind: 'all-sheep' });
    expect(author.hand).toHaveLength(8);
    expect(g.phase).toBe('voting');
  });

  it('reveals only after all votes; no double vote; author cannot vote', () => {
    const g = setup();
    g.submit(g.author.id, [g.author.hand[0]!.id], { kind: 'all-sheep' });
    expect(() => g.vote(g.author.id, 'trust')).toThrow('author_cannot_vote');
    expect(g.vote('p1', 'trust')).toBe(false);
    expect(g.lastReveal).toBeNull();
    expect(() => g.vote('p1', 'trust')).toThrow('already_voted');
    expect(g.vote('p2', 'trust')).toBe(true);
    expect(g.phase).toBe('result');
  });

  it('all trust: gates open, saved sheep enter, cards leave the hand', () => {
    const g = setup();
    rig(g, 'p0', [S, S, L, S]);
    g.submit('p0', ['p0-0', 'p0-1', 'p0-2'], { kind: 'all-sheep' });
    g.vote('p1', 'trust');
    g.vote('p2', 'trust');
    expect(g.lastReveal?.outcome).toBe('entered');
    expect(g.lastReveal?.resolution.sheepSaved).toBe(1);
    expect(g.sheepSaved).toBe(1);
    expect(g.player('p0').hand).toHaveLength(1);
  });

  it('wolf call on a lie: author takes the pile back', () => {
    const g = setup();
    rig(g, 'p0', [S, L, S]);
    g.submit('p0', ['p0-0', 'p0-1'], { kind: 'all-sheep' });
    g.vote('p1', 'wolf');
    g.vote('p2', 'trust');
    expect(g.lastReveal?.outcome).toBe('author_took');
    expect(g.player('p0').hand).toHaveLength(3);
    expect(g.sheepSaved).toBe(0);
  });

  it('wolf call on a truth: accuser takes the pile', () => {
    const g = setup();
    rig(g, 'p0', [S, C, S]);
    g.submit('p0', ['p0-0', 'p0-1'], { kind: 'all-sheep' });
    g.vote('p1', 'trust');
    g.vote('p2', 'wolf');
    expect(g.lastReveal?.outcome).toBe('accuser_took');
    expect(g.lastReveal?.accuserId).toBe('p2');
    expect(g.player('p2').hand).toHaveLength(12);
    expect(g.player('p0').hand).toHaveLength(1);
  });

  it('first to empty their hand with a validated play wins', () => {
    const g = setup(2);
    rig(g, 'p0', [S]);
    g.submit('p0', ['p0-0'], { kind: 'all-sheep' });
    g.vote('p1', 'trust');
    expect(g.winnerId).toBe('p0');
    g.next();
    expect(g.phase).toBe('finished');
  });

  it('count mode: claim must be a number and exactness decides', () => {
    const g = new Game();
    g.mode = 'compte';
    g.addPlayer('a', 'A');
    g.addPlayer('b', 'B');
    g.start();
    rig(g, 'a', [S, S, L]);
    expect(() => g.submit('a', ['a-0'], { kind: 'all-sheep' })).toThrow('bad_claim');
    g.submit('a', ['a-0', 'a-1', 'a-2'], { kind: 'survivors', count: 1 });
    g.vote('b', 'wolf');
    expect(g.lastReveal?.lie).toBe(false);
    expect(g.lastReveal?.outcome).toBe('accuser_took');
  });
});

describe('bot', () => {
  const hand: Card[] = [S, S, L, C, L].map((type, i) => ({ id: `c${i}`, type }) as Card);

  it('plays 1-3 cards from its hand with a valid claim', () => {
    for (let i = 0; i < 50; i++) {
      const m = chooseMove(hand);
      expect(m.cardIds.length).toBeGreaterThanOrEqual(1);
      expect(m.cardIds.length).toBeLessThanOrEqual(3);
      expect(m.cardIds.every((id) => hand.some((c) => c.id === id))).toBe(true);
      expect(m.claim.kind).toBe('all-sheep');
    }
  });

  it('is honest when it never bluffs', () => {
    for (let i = 0; i < 30; i++) {
      const m = chooseMove(hand, 'ni-vu', Math.random, 0);
      expect(m.cardIds.every((id) => hand.find((c) => c.id === id)!.type !== 'wolf')).toBe(true);
    }
  });

  it('count mode claims a number', () => {
    expect(chooseMove(hand, 'compte').claim.kind).toBe('survivors');
  });

  it('votes within the allowed values', () => {
    expect(['wolf', 'trust']).toContain(chooseVote(3, 1));
    expect(chooseVote(1, 9, () => 0.99)).toBe('trust');
    expect(chooseVote(3, 1, () => 0)).toBe('wolf');
  });
});
