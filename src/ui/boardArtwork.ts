import type { BoardTileType } from '../game/types';

export const BOARD_COORDINATES: ReadonlyArray<readonly [number, number]> = [
  [49, 18],
  [49, 9],
  [41, 13],
  [34, 20],
  [28, 29],
  [24, 39],
  [23, 49],
  [24, 59],
  [28, 69],
  [33, 79],
  [39, 87],
  [47, 92],
  [54, 95],
  [61, 92],
  [68, 87],
  [76, 79],
  [82, 69],
  [85, 58],
  [85, 47],
  [82, 36],
  [77, 27],
  [70, 20],
  [63, 15],
  [58, 19],
  [54, 28],
  [57, 38],
  [62, 48],
  [8, 74],
  [8, 43],
  [8, 16],
];

const TAIWAN_LAND_PATH =
  'M220 18C257 22 280 49 282 84C284 112 302 131 304 161C307 192 297 216 285 239C277 256 286 279 283 301C279 327 292 350 282 377C273 404 251 426 239 451C226 476 222 498 208 529C194 562 175 593 151 607C135 616 117 610 108 596C100 583 103 566 110 548C119 526 118 504 110 481C102 457 87 438 83 414C79 389 90 368 93 348C97 325 87 306 88 284C89 258 105 238 108 213C111 188 100 169 104 145C109 119 123 97 141 76C163 50 190 25 220 18Z';

const MAP_TRANSFORM = 'translate(168 7) scale(1.16 .96)';
const ROUTE_PATH = BOARD_COORDINATES.slice(0, 27)
  .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x * 7.2} ${y * 6.2}`)
  .join(' ')
  .concat(' Z');

const TILE_ICON_PATHS: Record<BoardTileType, string> = {
  production:
    '<path d="M12 20v-7m0 0C8 13 5 11 5 7c4 0 7 2 7 6Zm0 0c0-4 3-7 7-7 0 4-3 7-7 7Z"/><path d="M7 20h10"/>',
  'farmers-association': '<path d="m4 11 8-6 8 6v8H4v-8Z"/><path d="M8 19v-5h8v5M7 10h10"/>',
  'fishers-association':
    '<path d="M4 15h16l-3 4H7l-3-4Z"/><path d="M12 15V6m0 0 4 3m-4-3-4 3M6 21c2-1 4-1 6 0 2-1 4-1 6 0"/>',
  market: '<path d="M4 10h16l-1-4H5l-1 4Zm1 0v9h14v-9M8 13h8M8 16h8"/>',
  event: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/><path d="M9 2v4m6-4v4"/>',
  transport: '<path d="M5 7h14v10H5z"/><path d="M8 17v2m8-2v2M8 11h8M8 14h.01M16 14h.01"/>',
};

const TOKEN_ICON_PATHS = [
  '<path d="M4 13h16l-2-5H8L4 13Z"/><path d="M7 13v4m10-4v4M6 17h2m8 0h2"/>',
  '<path d="M5 7h14l-2 12H7L5 7Z"/><path d="M8 7c0-3 1-4 4-4s4 1 4 4M9 11h6"/>',
  '<path d="M12 4v15M8 19h8M7 9h10"/><path d="M5 7h4l3-3 3 3h4"/>',
  '<path d="M5 10h14v8H5z"/><path d="M8 10V7h8v3M8 18v2m8-2v2"/>',
];

function iconSvg(paths: string, className: string): string {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export function renderTileIcon(type: BoardTileType): string {
  return iconSvg(TILE_ICON_PATHS[type], 'tile-icon');
}

export function renderPlayerTokenIcon(index: number): string {
  return iconSvg(TOKEN_ICON_PATHS[index] ?? TOKEN_ICON_PATHS[0]!, 'token-icon');
}

function renderTerrainPaths(): string {
  return `
    <path class="western-plain" d="M82 206C106 190 130 194 145 213c11 15 10 36 1 53-10 19-15 41-7 62 9 35 31 58 28 88-2 24-18 48-36 59-12 8-25 8-36 0-8-7-11-18-13-31-3-20-16-40-15-64 1-26 15-48 16-72 1-40-13-78-1-102Z" transform="${MAP_TRANSFORM}" />
    <path class="plain-rice-shape" d="M104 232C132 220 151 238 159 260M99 288C126 277 148 289 163 307M93 348C118 340 145 350 165 371M101 417C126 405 147 415 164 433" transform="${MAP_TRANSFORM}" />
    <path class="mountain-spine" d="M218 51C205 108 218 145 207 188s11 77 1 113 8 71-8 105-6 72-31 119" transform="${MAP_TRANSFORM}" />
    <path class="mountain-spine mountain-spine-soft" d="M238 62c-25 56-14 92-28 131s15 73 0 112 1 78-17 111-12 69-31 102M198 65c-20 53-7 91-21 129s11 79 1 112 5 72-17 109" transform="${MAP_TRANSFORM}" />
    <path class="contour-line" d="M175 117c25-15 49-12 67 2M159 161c31-16 62-12 84 6M147 211c33-14 68-7 91 12M135 268c30-11 61-2 88 18M129 326c32-10 62 1 81 21M126 386c27-6 53 6 70 24M121 444c25-4 44 8 59 22M119 501c21 1 37 10 48 21" transform="${MAP_TRANSFORM}" />
    <path class="east-coast-highlight" d="M273 75c17 32 11 59 24 87 11 24-1 46-12 69-10 22 4 44-2 66-8 29-25 54-37 81-12 27-14 50-33 82" transform="${MAP_TRANSFORM}" />
  `;
}

export function renderTaiwanBoardArtwork(): string {
  return `
    <svg class="taiwan-board-art" viewBox="0 0 720 620" role="img" aria-label="具有山脈與平原層次的臺灣環島桌遊地圖">
      <defs>
        <linearGradient id="taiwan-land-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#dfe9bd" />
          <stop offset="0.52" stop-color="#c5d89e" />
          <stop offset="1" stop-color="#91b27d" />
        </linearGradient>
        <linearGradient id="mountain-wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#557d59" stop-opacity=".18" />
          <stop offset="1" stop-color="#2f704d" stop-opacity=".5" />
        </linearGradient>
        <pattern id="land-grain" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M2 13 7 9m4 5 5-5" stroke="#fffdf8" stroke-opacity=".13" stroke-width="1" />
        </pattern>
        <clipPath id="taiwan-land-clip"><path d="${TAIWAN_LAND_PATH}" transform="${MAP_TRANSFORM}" /></clipPath>
        <marker id="route-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0 0 7 3.5 0 7Z" fill="#2f704d" />
        </marker>
      </defs>
      <g class="sea-decoration" aria-hidden="true">
        <path d="M24 110c34-18 68-18 102 0m-102 14c34-18 68-18 102 0M30 492c34-18 68-18 102 0m-96 14c30-16 60-16 90 0M574 104c40-18 80-18 120 0m-118 16c38-17 76-17 114 0M572 482c38-17 76-17 114 0m-104 18c32-14 64-14 96 0" />
      </g>
      <g class="taiwan-land" aria-hidden="true">
        <path class="land-shadow" d="${TAIWAN_LAND_PATH}" transform="${MAP_TRANSFORM} translate(8 10)" />
        <path class="land-base" d="${TAIWAN_LAND_PATH}" transform="${MAP_TRANSFORM}" />
        <g class="terrain-layer" clip-path="url(#taiwan-land-clip)">${renderTerrainPaths()}</g>
        <path class="land-grain" d="${TAIWAN_LAND_PATH}" transform="${MAP_TRANSFORM}" />
        <path class="coastline" d="${TAIWAN_LAND_PATH}" transform="${MAP_TRANSFORM}" />
      </g>
      <g class="route-layer" aria-hidden="true">
        <path class="route-halo" d="${ROUTE_PATH}" />
        <path class="board-route" d="${ROUTE_PATH}" marker-mid="url(#route-arrow)" />
        <path class="route-inner-line" d="M 418 78 C 392 154 414 231 447 302" />
      </g>
      <g class="offshore-lanes" aria-hidden="true">
        <path d="M58 99C77 128 91 165 92 255M58 99C75 216 78 330 91 457M58 99C72 350 77 464 92 582" />
        <circle cx="58" cy="99" r="5" />
      </g>
      <g class="region-labels" aria-hidden="true">
        <text x="342" y="80">北部山海</text>
        <text x="326" y="300">中央山脈</text>
        <text x="340" y="544">南方田海</text>
        <text x="514" y="372">東岸縱谷</text>
      </g>
    </svg>`;
}

export function renderHeroTaiwanArtwork(): string {
  return `
    <svg class="hero-taiwan-art" viewBox="0 0 360 620" role="img" aria-label="臺灣山海與環島路線插畫">
      <defs>
        <linearGradient id="hero-land-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e3edc6" />
          <stop offset=".55" stop-color="#bbd294" />
          <stop offset="1" stop-color="#6c9c70" />
        </linearGradient>
        <clipPath id="hero-land-clip"><path d="${TAIWAN_LAND_PATH}" /></clipPath>
      </defs>
      <path class="hero-land-shadow" d="${TAIWAN_LAND_PATH}" transform="translate(8 9)" />
      <path class="hero-land-base" d="${TAIWAN_LAND_PATH}" />
      <g class="hero-terrain" clip-path="url(#hero-land-clip)">
        <path class="hero-plain" d="M82 206C106 190 130 194 145 213c11 15 10 36 1 53-10 19-15 41-7 62 9 35 31 58 28 88-2 24-18 48-36 59-12 8-25 8-36 0-8-7-11-18-13-31-3-20-16-40-15-64 1-26 15-48 16-72 1-40-13-78-1-102Z" />
        <path class="hero-mountain" d="M218 50C205 108 218 145 207 188s11 77 1 113 8 71-8 105-6 72-31 119M238 62c-25 56-14 92-28 131s15 73 0 112 1 78-17 111-12 69-31 102" />
        <path class="hero-contours" d="M175 117c25-15 49-12 67 2M159 161c31-16 62-12 84 6M147 211c33-14 68-7 91 12M135 268c30-11 61-2 88 18M129 326c32-10 62 1 81 21M126 386c27-6 53 6 70 24M121 444c25-4 44 8 59 22M119 501c21 1 37 10 48 21" />
      </g>
      <path class="hero-coastline" d="${TAIWAN_LAND_PATH}" />
      <path class="hero-route-path" d="M222 44C186 74 150 122 130 180S113 304 130 390s65 148 96 166C254 525 270 460 279 384s-3-156-40-222C218 108 218 73 222 44Z" />
      <text class="hero-map-label" x="186" y="315">臺灣</text>
    </svg>`;
}
