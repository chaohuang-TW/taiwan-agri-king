import { BOARD_TILES } from '../data/board';
import type { GameState } from '../game/types';

const TILE_SYMBOL: Record<(typeof BOARD_TILES)[number]['type'], string> = {
  production: '產',
  'farmers-association': '農',
  'fishers-association': '漁',
  market: '市',
  event: '卡',
  transport: '船',
};

const TOKEN_SYMBOLS = ['卡車', '竹籃', '曳引', '推車'];

const BOARD_COORDINATES: ReadonlyArray<readonly [number, number]> = [
  [54, 8],
  [44, 12],
  [35, 18],
  [28, 25],
  [23, 33],
  [20, 42],
  [18, 51],
  [17, 60],
  [18, 69],
  [22, 78],
  [28, 86],
  [37, 91],
  [47, 94],
  [57, 92],
  [67, 86],
  [73, 77],
  [77, 67],
  [78, 57],
  [77, 47],
  [74, 37],
  [71, 27],
  [67, 18],
  [62, 13],
  [57, 18],
  [53, 27],
  [56, 36],
  [61, 43],
  [6, 74],
  [8, 39],
  [9, 17],
];

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
            <svg class="taiwan-silhouette" viewBox="0 0 360 620" role="img" aria-label="桌遊化臺灣本島輪廓">
              <path d="M225 18C274 58 285 120 274 176C264 225 284 266 261 321C239 373 221 414 207 466C194 518 164 587 128 604C98 579 107 534 112 493C119 440 95 398 91 347C87 294 113 259 112 207C111 152 135 104 160 65C179 36 201 19 225 18Z" />
            </svg>
            <div class="route-line" aria-hidden="true"></div>
            <div class="island-label island-label-penghu">澎湖</div>
            <div class="island-label island-label-kinmen">金門</div>
            <div class="island-label island-label-matsu">馬祖</div>
            <div class="board-tiles">
              ${BOARD_TILES.map((tile) => {
                const coordinate = BOARD_COORDINATES[tile.position]!;
                return `<button class="board-tile tile-${tile.type}" style="--tile-x:${coordinate[0]}%;--tile-y:${coordinate[1]}%" data-position="${tile.position}" data-tile-id="${tile.id}" type="button" aria-label="${tile.position} ${tile.name}" title="${tile.name}｜${tile.description}">
                  <span class="tile-symbol" aria-hidden="true">${TILE_SYMBOL[tile.type]}</span>
                  <span class="tile-position">${tile.position}</span>
                  <span class="tile-name">${tile.shortName}</span>
                </button>`;
              }).join('')}
            </div>
            <div class="player-tokens" aria-label="玩家棋子">
              ${initialState.players.map((player, index) => `<div class="player-token token-${index + 1}" data-testid="player-token-${player.id}" data-player-id="${player.id}" data-position="${player.position}" aria-label="${player.name}棋子"><span>${TOKEN_SYMBOLS[index]}</span><strong>P${index + 1}</strong></div>`).join('')}
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
                  [-12, -12],
                  [12, -12],
                  [-12, 12],
                  [12, 12],
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
