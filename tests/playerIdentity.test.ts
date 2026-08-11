import { describe, expect, it } from 'vitest';
import { createGameWithPlayers } from '../src/game/engine';
import { getPlayerIdentityMap } from '../src/ui/playerIdentity';

describe('player identity presentation', () => {
  it('numbers humans and CPUs independently for a mixed table', () => {
    const game = createGameWithPlayers([
      { name: '真人一', controller: 'human' },
      { name: '電腦一', controller: 'cpu' },
      { name: '電腦二', controller: 'cpu' },
      { name: '真人二', controller: 'human' },
    ]);
    const identities = [...getPlayerIdentityMap(game.players).values()];

    expect(identities.map(({ badgeLabel }) => badgeLabel)).toEqual(['P1', 'C1', 'C2', 'P2']);
    expect(identities.map(({ assetKey }) => assetKey)).toEqual(['p1', 'c1', 'c2', 'p2']);
  });

  it('keeps all-human seats in P order', () => {
    const game = createGameWithPlayers([
      { name: '玩家一', controller: 'human' },
      { name: '玩家二', controller: 'human' },
      { name: '玩家三', controller: 'human' },
      { name: '玩家四', controller: 'human' },
    ]);
    expect(
      [...getPlayerIdentityMap(game.players).values()].map(({ badgeLabel }) => badgeLabel),
    ).toEqual(['P1', 'P2', 'P3', 'P4']);
  });
});
