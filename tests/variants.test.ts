import { describe, expect, it } from 'vitest';
import { Game, type Mode } from '../src/engine/game.js';
import { Room } from '../src/server/room.js';

function start(mode: Mode, count = 2) {
  const game = new Game();
  game.mode = mode;
  for (let i = 0; i < count; i++) game.addPlayer(String(i), `Joueur ${i}`);
  game.start();
  return game;
}

describe('Modes du livret', () => {
  it('réserve les rôles à leur propriétaire et révèle la bergerie après le dernier joueur', () => {
    const room = new Room('TEST');
    room.game.mode = 'loup-parmi-nous';
    const first = room.join('Alice', () => {});
    room.join('Bob', () => {});
    expect(() => room.start(first.id)).toThrow('need_three_players');
    room.join('Camille', () => {});
    room.start(first.id);
    const game = room.game;
    expect([...game.roles.values()].filter((role) => role === 'wolf')).toHaveLength(1);
    expect(room.publicSnapshot()).not.toHaveProperty('role');
    expect(room.snapshotFor(first.id)).toHaveProperty('role', game.roles.get(first.id));
    expect(room.publicSnapshot()).toHaveProperty('variant.roles', {});
    game.players.forEach((player, i) => {
      player.hand = [{ id: String(i), type: i === 1 ? 'wolf' : i === 2 ? 'dog' : 'sheep' }];
    });
    game.sheepSaved = 14;
    for (let i = 0; i < 3; i++) {
      const player = game.author;
      room.playVariant(player.id, { kind: 'place', cardIds: [player.hand[0]!.id] });
      if (i < 2) expect(room.publicSnapshot()).toHaveProperty('variant.result', null);
    }
    expect(game.phase).toBe('finished');
    expect(game.variantResult).toMatchObject({ winningCamp: 'sheep', saved: 1, eaten: 0 });
    expect(room.sheep).toHaveLength(1);
  });

  it('distribue les deux cartes à risque séparément et termine dès qu’elles se rencontrent', () => {
    const game = start('passe-ton-loup');
    const author = game.author;
    const next = game.players[1]!;
    expect(author.hand).toHaveLength(3);
    expect(next.hand).toHaveLength(3);
    const chosen = author.hand.find((card) => card.type === 'wolf' || card.type === 'dog')!;
    game.playVariant(author.id, { kind: 'place', cardIds: [chosen.id] });
    expect(game.phase).toBe('finished');
    expect(game.variantResult?.loserId).toBe(next.id);
    expect(author.hand).toHaveLength(2);
    expect(next.hand).toHaveLength(4);
  });

  it('résout tous les troupeaux séparément et permet de viser un adversaire', () => {
    const game = start('troupeau-de-tete');
    game.deck = [];
    const [first, second] = game.players;
    first!.hand = [{ id: 'wolf', type: 'wolf' }, { id: 'sheep-a', type: 'sheep' }];
    second!.hand = [{ id: 'sheep-b', type: 'sheep' }];
    game.playVariant(first!.id, { kind: 'place', cardIds: ['wolf'], targetId: second!.id });
    game.playVariant(second!.id, { kind: 'place', cardIds: ['sheep-b'], targetId: second!.id });
    game.playVariant(first!.id, { kind: 'place', cardIds: ['sheep-a'], targetId: first!.id });
    expect(game.variantResult?.winners).toEqual([first!.id]);
    expect(game.players.map((player) => player.score)).toEqual([1, 0]);
  });

  it('consomme la protection avant le mouton et compte les points à l’arrêt', () => {
    const game = start('qui-sy-frotte');
    game.deck = [
      { id: 'a', type: 'sheep' }, { id: 'b', type: 'dog' }, { id: 'c', type: 'wolf' },
      { id: 'd', type: 'wolf' }, { id: 'e', type: 'sheep' }, { id: 'f', type: 'sheep' },
    ];
    for (let i = 0; i < 3; i++) game.playVariant('0', { kind: 'draw' });
    expect(game.turnSheep).toBe(1);
    expect(game.shields).toBe(0);
    game.playVariant('0', { kind: 'draw' });
    expect(game.turnSheep).toBe(0);
    game.playVariant('0', { kind: 'draw' });
    game.playVariant('0', { kind: 'stop' });
    expect(game.author.score).toBe(1);
    game.next();
    expect(game.turnCards).toEqual([]);
    game.playVariant('1', { kind: 'draw' });
    expect(game.phase).toBe('finished');
    expect(game.variantResult?.winners).toEqual(['0', '1']);
  });

  it.each(['wolf', 'sheep'] as const)('fait ramasser la prairie et la pose avec une carte %s', (type) => {
    const game = start('ni-vu');
    game.players[0]!.hand = [{ id: 'pasture', type: 'sheep' }, { id: 'left', type: 'sheep' }];
    game.players[1]!.hand = [{ id: 'deposit', type }, { id: 'other', type: 'sheep' }];
    game.submit('0', ['pasture'], { kind: 'all-sheep' });
    game.vote('1', 'trust');
    game.next();
    game.submit('1', ['deposit'], { kind: 'all-sheep' });
    game.vote('0', 'wolf');
    const taker = type === 'wolf' ? game.players[1]! : game.players[0]!;
    expect(game.lastReveal?.takerId).toBe(taker.id);
    expect(taker.hand.map((card) => card.id)).toEqual(expect.arrayContaining(['pasture', 'deposit']));
    expect(game.pasture).toEqual([]);
  });
});
