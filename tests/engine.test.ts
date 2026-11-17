import { describe, expect, it } from 'vitest';
import { resolve, isLie, type Animal } from '../src/engine/resolve.js';
import { Game, buildDeck } from '../src/engine/game.js';

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

describe('game', () => {
  it('needs 2 players', () => {
    const g = new Game();
    g.addPlayer('a', 'A');
    expect(() => g.start()).toThrow();
  });

  it('only author plays 1-3 cards from own hand', () => {
    const g = setup();
    const author = g.author;
    expect(() => g.submit('p1', [g.player('p1').hand[0]!.id], { kind: 'all-sheep' })).toThrow('not_your_turn');
    expect(() => g.submit(author.id, [], { kind: 'all-sheep' })).toThrow();
    expect(() => g.submit(author.id, author.hand.slice(0, 4).map((c) => c.id), { kind: 'all-sheep' })).toThrow();
    expect(() => g.submit(author.id, ['nope'], { kind: 'all-sheep' })).toThrow('card_not_in_hand');
    g.submit(author.id, author.hand.slice(0, 2).map((c) => c.id), { kind: 'all-sheep' });
    expect(author.hand).toHaveLength(3);
    expect(g.phase).toBe('voting');
  });

  it('reveals only after all votes; no double vote; author cannot vote', () => {
    const g = setup();
    g.submit(g.author.id, [g.author.hand[0]!.id], { kind: 'all-sheep' });
    expect(() => g.vote(g.author.id, 'trust')).toThrow('author_cannot_vote');
    expect(g.vote('p1', 'trust')).toBe(false);
    expect(g.lastReveal).toBeNull();
    expect(() => g.vote('p1', 'wolf')).toThrow('already_voted');
    expect(g.vote('p2', 'wolf')).toBe(true);
    expect(g.phase).toBe('result');
    expect(g.lastReveal?.cards).toHaveLength(1);
  });

  it('plays rounds to the end', () => {
    const g = setup(2);
    while (g.phase !== 'finished') {
      g.submit(g.author.id, [g.author.hand[0]!.id], { kind: 'all-sheep' });
      const voter = g.eligibleVoters()[0]!;
      g.vote(voter.id, 'trust');
      g.next();
    }
    expect(g.roundNo).toBe(6);
  });
});
