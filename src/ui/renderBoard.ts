import { BOARD_TILES } from '../data/board';
import type { GameState } from '../game/types';
import {
  BOARD_COORDINATES,
  BOARD_ARTWORK_ASSET_URL,
  renderPlayerTokenIcon,
  renderTileIcon,
} from './boardArtwork';

export interface BoardView {
  root: HTMLElement;
  viewport: HTMLElement;
  content: HTMLElement;
  update(state: GameState): void;
  getToken(playerId: string): HTMLElement | null;
}

export function createBoardView(host: HTMLElement, initialState: GameState): BoardView {
  host.innerHTML = `
    <section class="board-frame" aria-label="臺灣環島棋盤">
      <div class="map-camera">
        <div class="map-camera-viewport" data-testid="board-camera">
          <div class="map-camera-content">
            <img class="board-artwork-image" data-testid="board-artwork-image" src="${BOARD_ARTWORK_ASSET_URL}" alt="" aria-hidden="true" draggable="false" />
            <div class="board-tiles">
              ${BOARD_TILES.map((tile) => {
                const coordinate = BOARD_COORDINATES[tile.position]!;
                return `<button class="board-tile tile-${tile.type} ${tile.position > 26 ? 'tile-offshore' : ''}" style="--tile-x:${coordinate[0]}%;--tile-y:${coordinate[1]}%" data-position="${tile.position}" data-tile-id="${tile.id}" data-tile-type="${tile.type}" type="button" aria-label="${tile.position} ${tile.name}" title="${tile.name}｜${tile.description}">
                  <span class="tile-icon-wrap" aria-hidden="true">${renderTileIcon(tile.type)}</span>
                  <span class="tile-copy"><span class="tile-position">${tile.position}</span><span class="tile-name">${tile.shortName}</span></span>
                </button>`;
              }).join('')}
            </div>
            <div class="player-tokens" aria-label="玩家棋子">
              ${initialState.players.map((player, index) => `<div class="player-token token-${index + 1}" data-testid="player-token-${player.id}" data-player-id="${player.id}" data-position="${player.position}" aria-label="${player.name}棋子"><span>${renderPlayerTokenIcon(index)}</span><strong>P${index + 1}</strong></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </section>`;

  const root = host.querySelector<HTMLElement>('.board-frame')!;
  const viewport = host.querySelector<HTMLElement>('.map-camera-viewport')!;
  const content = host.querySelector<HTMLElement>('.map-camera-content')!;

  function update(state: GameState): void {
    const displayPositions = new Map<string, number>();
    state.players.forEach((player, index) => {
      const moving = index === state.currentPlayerIndex ? state.movement : null;
      const step = moving && moving.stepIndex > 0 ? moving.path[moving.stepIndex - 1] : undefined;
      displayPositions.set(player.id, step ?? player.position);
    });

    const occupancy = new Map<number, string[]>();
    displayPositions.forEach((position, playerId) => {
      occupancy.set(position, [...(occupancy.get(position) ?? []), playerId]);
    });

    state.players.forEach((player) => {
      const token = content.querySelector<HTMLElement>(`[data-player-id="${player.id}"]`);
      const position = displayPositions.get(player.id) ?? player.position;
      const tile = content.querySelector<HTMLElement>(`[data-position="${position}"]`);
      if (!token || !tile) return;
      const coordinate = BOARD_COORDINATES[position]!;
      const peers = occupancy.get(position) ?? [];
      const peerIndex = peers.indexOf(player.id);
      const offsets =
        peers.length === 1
          ? [[0, 0]]
          : peers.length === 2
            ? [
                [-13, 0],
                [13, 0],
              ]
            : peers.length === 3
              ? [
                  [0, -13],
                  [-13, 11],
                  [13, 11],
                ]
              : [
                  [-16, -16],
                  [16, -16],
                  [-16, 16],
                  [16, 16],
                ];
      const [offsetX, offsetY] = offsets[peerIndex] ?? [0, 0];
      token.style.setProperty('--token-x', `${coordinate[0]}%`);
      token.style.setProperty('--token-y', `${coordinate[1]}%`);
      token.style.setProperty('--token-offset-x', `${offsetX}px`);
      token.style.setProperty('--token-offset-y', `${offsetY}px`);
      token.dataset.position = String(position);
      token.dataset.movementStep = String(state.movement?.stepIndex ?? 0);
      token.classList.toggle(
        'is-current',
        player.id === state.players[state.currentPlayerIndex]?.id,
      );
    });
    content.querySelectorAll<HTMLElement>('.board-tile').forEach((tile) => {
      tile.classList.toggle(
        'is-current-tile',
        Number(tile.dataset.position) ===
          displayPositions.get(state.players[state.currentPlayerIndex]!.id),
      );
    });
  }

  update(initialState);
  return {
    root,
    viewport,
    content,
    update,
    getToken: (playerId) => content.querySelector(`[data-player-id="${playerId}"]`),
  };
}
