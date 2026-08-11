import type { PlayerState } from '../game/types';

import p1BadgeUrl from '../assets/player-badges/p1.png';
import p2BadgeUrl from '../assets/player-badges/p2.png';
import p3BadgeUrl from '../assets/player-badges/p3.png';
import p4BadgeUrl from '../assets/player-badges/p4.png';
import c1BadgeUrl from '../assets/player-badges/c1.png';
import c2BadgeUrl from '../assets/player-badges/c2.png';
import c3BadgeUrl from '../assets/player-badges/c3.png';

export type PlayerIdentityAssetKey = 'p1' | 'p2' | 'p3' | 'p4' | 'c1' | 'c2' | 'c3';

export interface PlayerIdentity {
  playerId: string;
  controller: 'human' | 'cpu';
  badgeLabel: string;
  shortLabel: string;
  fullLabel: string;
  assetKey: PlayerIdentityAssetKey;
  assetUrl: string;
}

const BADGE_URLS: Record<PlayerIdentityAssetKey, string> = {
  p1: p1BadgeUrl,
  p2: p2BadgeUrl,
  p3: p3BadgeUrl,
  p4: p4BadgeUrl,
  c1: c1BadgeUrl,
  c2: c2BadgeUrl,
  c3: c3BadgeUrl,
};

export function getPlayerIdentityMap(players: readonly PlayerState[]): Map<string, PlayerIdentity> {
  let humanNumber = 0;
  let cpuNumber = 0;

  return new Map(
    players.map((player) => {
      const controller = player.controller ?? 'human';
      const number = controller === 'cpu' ? ++cpuNumber : ++humanNumber;
      const badgeLabel = `${controller === 'cpu' ? 'C' : 'P'}${number}`;
      const assetKey = badgeLabel.toLowerCase() as PlayerIdentityAssetKey;
      const identity: PlayerIdentity = {
        playerId: player.id,
        controller,
        badgeLabel,
        shortLabel: badgeLabel,
        fullLabel: `${controller === 'cpu' ? '電腦' : '玩家'} ${badgeLabel}`,
        assetKey,
        assetUrl: BADGE_URLS[assetKey],
      };
      return [player.id, identity];
    }),
  );
}

export function getPlayerIdentity(
  player: PlayerState,
  players: readonly PlayerState[],
): PlayerIdentity {
  const identity = getPlayerIdentityMap(players).get(player.id);
  if (!identity) throw new Error(`找不到玩家身份：${player.id}`);
  return identity;
}

export function renderPlayerBadge(
  identity: PlayerIdentity,
  className = '',
  size: 'board' | 'hud' | 'ranking' = 'hud',
): string {
  return `<img class="player-badge player-badge-${identity.assetKey} player-badge-${size} ${className}" src="${identity.assetUrl}" alt="${identity.fullLabel}" data-identity-label="${identity.badgeLabel}" draggable="false" />`;
}
