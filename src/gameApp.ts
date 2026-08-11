import './styles/tokens.css';
import './styles/play.css';
import { BOARD_TILES } from './data/board';
import { COLLECTION_GOALS } from './data/collectionGoals';
import { MARKET_CARDS } from './data/marketCards';
import { PRODUCTS } from './data/products';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGameWithPlayers,
  endTurn,
  getCurrentProductValue,
  rollDice,
  skipIslandPurchase,
  skipPurchase,
  skipSale,
  skipTransport,
} from './game/engine';
import { getCurrentPlayer, getProductById, getTileById } from './game/selectors';
import type { GameState, Product, PurchaseSource, RandomSource } from './game/types';
import { decideCpuAction, isCpuPlayer } from './cpu/cpuStrategy';
import type { CpuDecision } from './cpu/cpuTypes';
import { BoardCameraController } from './ui/boardCamera';
import { DiceAnimationController } from './ui/dicePresentation';
import { createBoardView, type BoardView } from './ui/renderBoard';
import { getPlayerIdentityMap, renderPlayerBadge } from './ui/playerIdentity';
import { renderProductArtwork } from './ui/productArtwork';
import {
  getAllCollectionProgress,
  getCategoryLabel,
  getCountyName,
  getOwnedProducts,
  getPlayerEstimatedScore,
  getPurchaseBreakdown,
  getSeasonLabel,
  SEASON_SYMBOLS,
} from './ui/selectors';
import { createUiPresentation } from './ui/uiTypes';

const mount = document.querySelector<HTMLDivElement>('#game-app');
if (!mount) throw new Error('找不到正式遊戲掛載點');
const root: HTMLDivElement = mount;

const params = new URLSearchParams(window.location.search);
const testMode = params.get('testMode') === '1';
const scenario = params.get('scenario') ?? '';
const cameraTestScenario = scenario === 'movement' || scenario === 'cpu-camera';
const uiDelay = {
  // Camera E2E needs one render frame per step even on a busy CI runner.
  // This affects only deterministic test scenarios, never production play.
  step: testMode ? (cameraTestScenario ? 260 : 35) : 320,
  arrival: testMode ? 45 : 500,
  returning: testMode ? 45 : 400,
  handoff: testMode ? 30 : 620,
  cpuThinking: testMode ? 35 : 320,
  cpuDecision: testMode ? 35 : 360,
};

let state: GameState | null = null;
let board: BoardView | null = null;
let camera: BoardCameraController | null = null;
let diceAnimation: DiceAnimationController | null = null;
let ui = createUiPresentation();
let errorMessage = '';
let lastEventCardId: string | null = null;
let lifecycleGeneration = 0;
const timers = new Set<number>();
let cpuStatusMessage = '';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function scheduleUiDelay(ms: number): Promise<void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? Math.min(ms, 45) : ms;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      resolve();
    }, duration);
    timers.add(timer);
  });
}

function cleanupUiLifecycle(): void {
  lifecycleGeneration += 1;
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  diceAnimation?.cleanup();
  diceAnimation = null;
  camera?.cleanup();
  camera = null;
  board = null;
  ui = createUiPresentation();
  cpuStatusMessage = '';
}

function getScenarioRandom(): RandomSource {
  if (scenario === 'movement' || scenario === 'cpu-camera') return () => 0.5;
  return () => 0;
}

function gameRandom(): RandomSource {
  return testMode ? getScenarioRandom() : Math.random;
}

function createScenarioGame(names: string[]): GameState {
  const cpuScenario = scenario.startsWith('cpu-');
  const identityScenario = scenario === 'phase5b1-identity' || scenario === 'phase5b1-mobile';
  const normalConfigs = names.map((name) => ({ name, controller: 'human' as const }));
  const configs = identityScenario
    ? [
        { name: '測試真人', controller: 'human' as const },
        { name: '測試電腦1', controller: 'cpu' as const },
        { name: '測試電腦2', controller: 'cpu' as const },
        { name: '測試電腦3', controller: 'cpu' as const },
      ]
    : !testMode && names.length < 4
      ? [
          ...normalConfigs,
          ...Array.from({ length: 4 - names.length }, (_, index) => ({
            name: `電腦採購員${index + 1}`,
            controller: 'cpu' as const,
          })),
        ]
      : cpuScenario
        ? [
            { name: '測試真人', controller: 'human' as const },
            { name: '測試電腦1', controller: 'cpu' as const },
            { name: '測試電腦2', controller: 'cpu' as const },
            { name: '測試電腦3', controller: 'cpu' as const },
          ]
        : normalConfigs;
  let game = createGameWithPlayers(configs, testMode ? getScenarioRandom() : Math.random);
  if (!testMode) return game;
  const startingPositions: Record<string, number> = {
    movement: 23,
    purchase: 0,
    farmers: 2,
    fishers: 11,
    market: 23,
    event: 17,
    transport: 12,
    collection: 18,
    camera: 23,
    'cpu-purchase': 0,
    'cpu-skip': 0,
    'cpu-sale': 6,
    'cpu-transport': 12,
    'cpu-camera': 23,
    'cpu-round': 0,
    'cpu-game-over': 0,
    'cpu-restart': 0,
    'phase5b1-identity': 0,
    'phase5b1-mobile': 0,
    'phase5b1-procurement': 5,
    'phase5b1-inventory': 0,
  };
  const position = startingPositions[scenario] ?? 0;
  const inventoryByScenario: Record<string, string[]> = {
    market: ['taoyuan-rice'],
    collection: ['hsinchu-oriental-beauty-tea', 'nantou-high-mountain-tea'],
    'phase5b1-mobile': [
      'miaoli-strawberry',
      'changhua-rice',
      'new-taipei-bamboo-shoot',
      'nantou-high-mountain-tea',
      'tainan-milkfish',
      'changhua-eggs',
    ],
    'phase5b1-inventory': [
      'miaoli-strawberry',
      'changhua-rice',
      'new-taipei-bamboo-shoot',
      'nantou-high-mountain-tea',
      'tainan-milkfish',
      'changhua-eggs',
    ],
  };
  game = {
    ...game,
    round: scenario === 'game-over' || scenario === 'cpu-game-over' ? 12 : 1,
    season: scenario === 'game-over' || scenario === 'cpu-game-over' ? 'winter' : game.season,
    currentPlayerIndex:
      scenario === 'cpu-game-over'
        ? game.players.length - 1
        : cpuScenario
          ? 1
          : game.currentPlayerIndex,
    players: game.players.map((player, index) =>
      index === 0
        ? {
            ...player,
            position,
            productIds: inventoryByScenario[scenario] ?? player.productIds,
          }
        : cpuScenario && index === 1
          ? {
              ...player,
              position,
              ...(scenario === 'cpu-sale' ? { funds: 3, productIds: ['taoyuan-rice'] } : {}),
              ...(scenario === 'cpu-skip' ? { funds: 0 } : {}),
            }
          : player,
    ),
    marketDeck:
      scenario === 'farmers'
        ? { ...game.marketDeck, activeCardId: 'local-food-channel' }
        : game.marketDeck,
  };
  if (scenario === 'phase5b1-procurement') {
    game = {
      ...game,
      phase: 'awaiting-purchase',
      pendingAction: {
        kind: 'purchase',
        tileId: 'changhua-plain',
        productIds: ['changhua-grape', 'changhua-rice', 'changhua-eggs'],
        source: 'production',
      },
      turnSummary: { title: '抵達彰化平原', lines: ['可購買0或1項產品'] },
    };
  }
  return game;
}

function activeMarketCard(game: GameState) {
  return MARKET_CARDS.find(({ id }) => id === game.marketDeck.activeCardId) ?? null;
}

function productCard(product: Product, source: PurchaseSource, game: GameState): string {
  const player = getCurrentPlayer(game);
  const price = getPurchaseBreakdown(product, source, game);
  const owned = player.productIds.includes(product.id);
  const insufficient = player.funds < price.final;
  const disabled = owned || insufficient || ui.locked;
  const value = getCurrentProductValue(product, game.season, activeMarketCard(game));
  const artwork = renderProductArtwork(product, 'procurement-artwork');
  return `<article class="product-choice" data-product-id="${product.id}" data-product-category="${product.category}">
    ${artwork ? `<div class="product-artwork-wrap">${artwork}</div>` : ''}
    <div class="product-choice-head"><div><span>${getCategoryLabel(product.category)}</span><h3>${escapeHtml(product.name)}</h3><p>${getCountyName(product.countyId)}</p></div><strong>${value}<small>目前產值</small></strong></div>
    <dl><div><dt>採購</dt><dd>${price.final}</dd></div><div><dt>基礎產值</dt><dd>${product.baseValue}</dd></div><div><dt>旺季</dt><dd>${product.peakSeasons.map(getSeasonLabel).join('、')}</dd></div></dl>
    ${source === 'farmers-association' ? `<p class="price-detail">原價 ${price.original} | 農會優惠 -${price.associationDiscount}${price.marketDiscount ? ` | 市場優惠 -${price.marketDiscount}` : ''} | 本次 ${price.final}</p>` : price.marketDiscount ? `<p class="price-detail">原價 ${price.original} | 市場優惠 -${price.marketDiscount} | 本次 ${price.final}</p>` : ''}
    <button type="button" data-action="${game.pendingAction?.kind === 'island-purchase' ? 'buy-island' : 'buy'}" data-product-id="${product.id}" ${disabled ? 'disabled' : ''}>${owned ? '已收藏' : insufficient ? '採購金不足' : `採購 ${price.final}`}</button>
  </article>`;
}

function renderPlayers(game: GameState): string {
  const identities = getPlayerIdentityMap(game.players);
  return game.players
    .map((player, index) => {
      const identity = identities.get(player.id)!;
      const score = getPlayerEstimatedScore(player, game);
      const completed = getAllCollectionProgress(player).filter(
        ({ completed }) => completed,
      ).length;
      const tile = BOARD_TILES.find(({ position }) => position === player.position)!;
      const controllerLabel = isCpuPlayer(player) ? '電腦' : '真人';
      const ownedProducts = getOwnedProducts(player);
      const inventory = ownedProducts.length
        ? `<ul class="player-inventory" aria-label="${identity.fullLabel}已持有產品">${ownedProducts
            .map((product) => {
              const artwork = renderProductArtwork(product, 'inventory-artwork');
              return `<li class="${artwork ? 'has-artwork' : 'no-artwork'}">${artwork}<span>${escapeHtml(product.name)}</span></li>`;
            })
            .join('')}</ul>`
        : '';
      return `<article class="player-status player-${index + 1} ${index === game.currentPlayerIndex ? 'is-current' : ''}" data-testid="player-card-${player.id}" data-controller="${player.controller ?? 'human'}" data-position="${player.position}" data-product-ids="${escapeHtml(player.productIds.join(','))}">
        <div class="player-status-title">${renderPlayerBadge(identity, 'hud-player-badge', 'hud')}<h3>${escapeHtml(player.name)}</h3><span class="controller-label">${controllerLabel}</span>${index === game.currentPlayerIndex ? '<em>目前回合</em>' : ''}</div>
        <dl><div><dt>採購金</dt><dd data-testid="funds-${player.id}">${player.funds}</dd></div><div><dt>位置</dt><dd>${tile.shortName}</dd></div><div><dt>產品</dt><dd data-testid="product-count-${player.id}">${player.productIds.length}</dd></div><div><dt>收藏</dt><dd>${completed}</dd></div></dl>
        ${inventory}
        <p>目前估值 <strong data-testid="score-${player.id}">${score.total}</strong></p>
      </article>`;
    })
    .join('');
}

function renderCollections(game: GameState): string {
  const player = getCurrentPlayer(game);
  const progress = getAllCollectionProgress(player);
  return COLLECTION_GOALS.map((goal, index) => {
    const item = progress[index]!;
    return `<article class="collection-item ${item.completed ? 'is-complete' : ''}" data-testid="collection-${goal.id}"><div><h4>${escapeHtml(goal.title)}</h4><p>${escapeHtml(goal.description)}</p></div><strong>${item.completed ? '完成' : item.label}</strong></article>`;
  }).join('');
}

function renderMarket(game: GameState): string {
  const card = activeMarketCard(game);
  return `<article class="market-card" data-testid="market-card"><span>本輪市場行情</span><h3>${escapeHtml(card?.title ?? '無市場卡')}</h3><p>${escapeHtml(card?.description ?? '目前沒有市場效果。')}</p></article>`;
}

function renderCurrentPlayer(game: GameState): string {
  const player = getCurrentPlayer(game);
  const identity = getPlayerIdentityMap(game.players).get(player.id)!;
  return `${renderPlayerBadge(identity, 'turn-player-badge', 'hud')}<span>${escapeHtml(player.name)}</span>`;
}

function renderActionPanel(game: GameState): string {
  const player = getCurrentPlayer(game);
  const pending = game.pendingAction;
  const cpuLabel = isCpuPlayer(player) ? '<span class="cpu-badge">電腦玩家</span>' : '';
  if (game.phase === 'awaiting-roll') {
    return `<div class="action-copy"><span>輪到 ${escapeHtml(player.name)} ${cpuLabel}</span><h2>準備前往下一站</h2><p>${isCpuPlayer(player) ? '電腦會依照公開資訊自動決定。' : '擲出六面骰，棋子會沿主環島路線逐格前進。'}</p></div><div class="dice-action"><output class="dice-face" data-testid="dice-result" aria-live="polite">${game.lastDiceRoll ?? '骰'}</output><button class="primary-action" type="button" data-action="roll" ${ui.locked || isCpuPlayer(player) ? 'disabled' : ''}>擲骰子</button></div>`;
  }
  if (game.phase === 'moving') {
    return `<div class="action-copy"><span>正在移動 ${cpuLabel}</span><h2>${escapeHtml(player.name)} 前進中</h2><p aria-live="polite">骰出 ${game.lastDiceRoll} 點，第 ${game.movement?.stepIndex ?? 0} / ${game.movement?.path.length ?? 0} 格。</p></div><div class="dice-action"><output class="dice-face is-rolling" data-testid="dice-result">${game.lastDiceRoll}</output><button class="primary-action" disabled>移動中</button></div>`;
  }
  if (game.phase === 'awaiting-purchase' && pending) {
    const island = pending.kind === 'island-purchase';
    const ids = pending.kind === 'purchase' || island ? pending.productIds : [];
    const source: PurchaseSource = pending.kind === 'purchase' ? pending.source : 'production';
    const tile = getTileById(
      island ? pending.destinationTileId : pending.kind === 'purchase' ? pending.tileId : '',
    );
    const title = island
      ? '離島特別行程'
      : source === 'farmers-association'
        ? '農會直售站'
        : source === 'fishers-association'
          ? '漁會市場'
          : '產地採購';
    return `<div class="action-wide"><div class="action-copy"><span>${title}</span><h2>${escapeHtml(tile.name)}</h2><p>目前採購金 ${player.funds}。本次可採購 0 或 1 項。</p></div><div class="product-choice-grid">${ids.map((id) => productCard(getProductById(id), source, game)).join('')}</div><button class="quiet-action" type="button" data-action="${island ? 'skip-island' : 'skip-purchase'}" ${ui.locked ? 'disabled' : ''}>略過採購</button></div>`;
  }
  if (game.phase === 'awaiting-sale') {
    const products = getOwnedProducts(player);
    return `<div class="action-wide"><div class="action-copy"><span>農產市場</span><h2>出售 0 或 1 項產品</h2><p>${products.length ? '出售價值已套用本季與市場卡。' : '目前沒有可出售的農產品。'}</p></div><div class="product-choice-grid">${products
      .map((product) => {
        const artwork = renderProductArtwork(product, 'sale-artwork');
        return `<article class="product-choice" data-product-id="${product.id}">${artwork ? `<div class="product-artwork-wrap">${artwork}</div>` : ''}<div class="product-choice-head"><div><span>${getCountyName(product.countyId)}</span><h3>${escapeHtml(product.name)}</h3></div><strong>${getCurrentProductValue(product, game.season, activeMarketCard(game))}<small>出售價值</small></strong></div><button type="button" data-action="sell" data-product-id="${product.id}" ${ui.locked ? 'disabled' : ''}>出售</button></article>`;
      })
      .join(
        '',
      )}</div><button class="quiet-action" type="button" data-action="skip-sale" ${ui.locked ? 'disabled' : ''}>略過出售</button></div>`;
  }
  if (game.phase === 'awaiting-transport' && pending?.kind === 'transport') {
    return `<div class="action-wide"><div class="action-copy"><span>離島特別行程</span><h2>選擇一個合法目的地</h2><p>離島採購完成後，主棋子仍停留在交通格。</p></div><div class="destination-grid">${pending.destinationIds
      .map((id) => {
        const tile = getTileById(id);
        return `<button type="button" data-action="transport" data-destination-id="${id}" ${ui.locked ? 'disabled' : ''}><strong>${tile.shortName}</strong><span>${tile.description}</span></button>`;
      })
      .join(
        '',
      )}</div><button class="quiet-action" type="button" data-action="skip-transport" ${ui.locked ? 'disabled' : ''}>略過行程</button></div>`;
  }
  if (game.phase === 'awaiting-turn-end') {
    const eventCard = lastEventCardId
      ? MARKET_CARDS.find(({ id }) => id === lastEventCardId)
      : null;
    return `<div class="action-copy"><span>${eventCard ? '市場行情更新' : '回合摘要'}</span><h2>${escapeHtml(game.turnSummary?.title ?? '本回合完成')}</h2><ul aria-live="polite">${(game.turnSummary?.lines ?? []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>${eventCard ? `<div class="event-reveal"><strong>${escapeHtml(eventCard.title)}</strong><p>${escapeHtml(eventCard.description)}</p></div>` : ''}</div><button class="primary-action" type="button" data-action="end-turn" ${ui.locked ? 'disabled' : ''}>結束回合</button>`;
  }
  return cpuStatusMessage
    ? `<div class="action-copy"><span>電腦回合</span><h2>${escapeHtml(player.name)} 思考中</h2><p aria-live="polite" data-testid="cpu-status">${escapeHtml(cpuStatusMessage)}</p></div>`
    : '';
}

function renderRanking(game: GameState): string {
  const rankings = game.rankings ?? [];
  const identities = getPlayerIdentityMap(game.players);
  return `<section class="result-screen" aria-labelledby="ranking-title"><span>12 輪完成</span><h1 id="ranking-title">${rankings.filter(({ rank }) => rank === 1).length > 1 ? '共同第 1 名' : '環島冠軍'}</h1><div class="winner-name">${rankings
    .filter(({ rank }) => rank === 1)
    .map(
      ({ playerId, playerName }) =>
        `${renderPlayerBadge(identities.get(playerId)!, 'ranking-player-badge', 'ranking')}${escapeHtml(playerName)}`,
    )
    .join(
      '、',
    )}</div><div class="ranking-table" data-testid="rankings" role="table" aria-label="最終排名"><div class="ranking-row ranking-head" role="row"><span>名次</span><span>玩家</span><span>產品價值</span><span>收藏加成</span><span>資金換分</span><span>總分</span></div>${rankings.map((rank) => `<div class="ranking-row" role="row"><strong>${rank.rank === 1 && rankings.filter(({ rank: value }) => value === 1).length > 1 ? '共同 1' : rank.rank}</strong><span class="ranking-player-name">${renderPlayerBadge(identities.get(rank.playerId)!, 'ranking-row-badge', 'ranking')}${escapeHtml(rank.playerName)}</span><span>${rank.score.productValue}</span><span>${rank.score.collectionBonus}</span><span>${rank.score.fundsBonus}</span><strong>${rank.score.total}</strong></div>`).join('')}</div><div class="result-actions"><button class="primary-action" data-action="restart" type="button">再玩一次</button><a href="./">返回首頁</a><button class="quiet-action" data-action="open-collections" type="button">查看收藏成果</button></div></section>`;
}

function renderSetup(): void {
  root.innerHTML = `<main class="setup-screen"><header class="game-brand"><a href="./">臺灣農產王</a><span>Phase 4 CPU 開發預覽</span></header><section class="setup-card" aria-labelledby="setup-title"><div class="setup-intro"><span>真人＋電腦對手</span><h1 id="setup-title">這趟環島，有幾位採購王？</h1><p>選擇 1 至 4 名真人；不足 4 席會由電腦依公開資訊自動補位。</p></div><form id="player-setup"><fieldset><legend>真人玩家人數</legend><div class="count-options">${[1, 2, 3, 4].map((count) => `<label><input type="radio" name="player-count" value="${count}" ${count === 2 ? 'checked' : ''}><span>${count}</span></label>`).join('')}</div></fieldset><div id="player-name-fields" class="name-fields"></div><p class="cpu-setup-note">電腦策略：收藏進度、產值／成本、資金保留與市場溢價。</p><button class="primary-action" type="submit">開始環島</button></form><div class="setup-links"><button type="button" data-action="open-rules">遊戲規則</button><button type="button" data-action="open-atlas">農產圖鑑</button></div></section></main>${sharedDialogs()}`;
  updateNameFields(2);
}

function sharedDialogs(): string {
  return `<dialog id="rules-dialog" aria-labelledby="rules-title"><div class="dialog-head"><h2 id="rules-title">遊戲規則</h2><button type="button" data-action="close-dialog" aria-label="關閉遊戲規則">關閉</button></div><div class="rules-grid"><article><strong>目標</strong><p>12 輪後，以產品價值、收藏加成與資金換分合計最高者獲勝。</p></article><article><strong>四季</strong><p>每 3 輪更換季節，旺季產品的價值會提高。</p></article><article><strong>採購</strong><p>抵達產地、農會或漁會時，可購買 0 或 1 項產品。</p></article><article><strong>市場</strong><p>抵達市場可出售 0 或 1 項；市場卡會影響價值與成本。</p></article><article><strong>收藏</strong><p>12 項任務全部公開，完成條件可獲得額外產值。</p></article><article><strong>離島</strong><p>交通格可前往合法離島採購，主棋子仍停在原交通格。</p></article></div></dialog><dialog id="atlas-dialog" aria-labelledby="atlas-title"><div class="dialog-head"><h2 id="atlas-title">農產圖鑑</h2><button type="button" data-action="close-dialog" aria-label="關閉農產圖鑑">關閉</button></div><div class="atlas-controls"><label>依類別<select id="atlas-category"><option value="all">全部類別</option>${[...new Set(PRODUCTS.map(({ category }) => category))].map((category) => `<option value="${category}">${getCategoryLabel(category)}</option>`).join('')}</select></label><label>依縣市<select id="atlas-county"><option value="all">全部縣市</option>${[...new Set(PRODUCTS.map(({ countyId }) => countyId))].map((countyId) => `<option value="${countyId}">${getCountyName(countyId)}</option>`).join('')}</select></label></div><div id="atlas-grid" class="atlas-grid"></div></dialog>`;
}

function updateNameFields(count: number): void {
  const fields = document.querySelector<HTMLElement>('#player-name-fields');
  if (!fields) return;
  fields.innerHTML = Array.from(
    { length: count },
    (_, index) =>
      `<label><span>玩家 ${index + 1} 名稱</span><input name="player-name-${index + 1}" maxlength="16" autocomplete="off" value="" placeholder="玩家${index + 1}"></label>`,
  ).join('');
}

function initializePlaying(game: GameState): void {
  state = game;
  root.innerHTML = `<div class="game-shell"><header class="game-topbar"><div class="game-brand-lockup"><a class="game-logo" href="./">臺灣農產王</a><span class="game-subtitle">環島產地爭霸戰</span></div><div class="turn-status" aria-live="polite"><strong data-testid="round">第 ${game.round} / 12 輪</strong><span data-testid="season">${SEASON_SYMBOLS[game.season]} ${getSeasonLabel(game.season)}</span><span data-testid="current-player">${renderCurrentPlayer(game)}</span></div><nav><button type="button" data-action="open-rules">規則</button><button type="button" data-action="open-atlas">圖鑑</button></nav></header><main class="play-layout game-stage" data-layout="production"><section id="board-host" class="board-host" aria-label="環島遊戲棋盤"></section><aside class="players-rail players-hud" aria-label="玩家資料" data-testid="players-hud"><div class="rail-heading"><span>玩家席位</span><h2>環島採購團</h2></div><div id="players-panel" class="players-scroll"></div></aside><aside class="insight-rail stage-info-hud" aria-label="市場與收藏"><details class="market-hud" data-testid="market-hud"><summary>市場資訊</summary><div id="market-panel"></div></details><details class="collections-drawer" data-testid="collections-drawer"><summary>收藏任務 <span>12</span></summary><div id="collections-panel" class="collections-list"></div></details></aside><section id="action-panel" class="action-panel" aria-label="目前操作" data-testid="action-dock"></section></main><div id="handoff" class="handoff" aria-live="assertive" hidden></div><p id="cpu-status" class="cpu-status" aria-live="polite"></p><p id="game-error" class="game-error" role="alert"></p></div>${sharedDialogs()}`;
  const marketHud = document.querySelector<HTMLDetailsElement>('.market-hud');
  if (marketHud) marketHud.open = !window.matchMedia('(max-width: 900px)').matches;
  const host = document.querySelector<HTMLElement>('#board-host')!;
  board = createBoardView(host, game);
  camera = new BoardCameraController(board.viewport, board.content);
  diceAnimation = new DiceAnimationController(root, { testMode });
  bindBoardDetails();
  renderDynamic();
}

function renderDynamic(): void {
  const game = state;
  if (!game) return;
  if (game.phase === 'game-over') {
    diceAnimation?.cleanup();
    diceAnimation = null;
    camera?.cleanup();
    root.innerHTML = `${renderRanking(game)}${sharedDialogs()}<section id="completed-collections" class="completed-collections" hidden><h2>收藏成果</h2><div>${renderCollections(game)}</div></section>`;
    renderAtlas();
    return;
  }
  board?.update(game);
  const playersPanel = document.querySelector<HTMLElement>('#players-panel');
  const marketPanel = document.querySelector<HTMLElement>('#market-panel');
  const collectionPanel = document.querySelector<HTMLElement>('#collections-panel');
  const actionPanel = document.querySelector<HTMLElement>('#action-panel');
  if (playersPanel) playersPanel.innerHTML = renderPlayers(game);
  if (marketPanel) marketPanel.innerHTML = renderMarket(game);
  if (collectionPanel) collectionPanel.innerHTML = renderCollections(game);
  if (actionPanel) actionPanel.innerHTML = renderActionPanel(game);
  if (actionPanel) {
    actionPanel.dataset.phase = game.phase;
    actionPanel.dataset.currentPlayerId = getCurrentPlayer(game).id;
    actionPanel.dataset.temporaryDestinationId = game.temporaryDestinationId ?? '';
    actionPanel.dataset.lastDiceRoll = game.lastDiceRoll?.toString() ?? '';
    if (testMode && scenario === 'cpu-restart') {
      actionPanel.insertAdjacentHTML(
        'beforeend',
        '<button type="button" class="test-restart" data-action="restart">測試重新開始</button>',
      );
    }
  }
  const round = document.querySelector<HTMLElement>('[data-testid="round"]');
  const season = document.querySelector<HTMLElement>('[data-testid="season"]');
  const current = document.querySelector<HTMLElement>('[data-testid="current-player"]');
  if (round) round.textContent = `第 ${game.round} / 12 輪`;
  if (season) season.textContent = `${SEASON_SYMBOLS[game.season]} ${getSeasonLabel(game.season)}`;
  if (current) current.innerHTML = renderCurrentPlayer(game);
  const cpuStatus = document.querySelector<HTMLElement>('#cpu-status');
  if (cpuStatus)
    cpuStatus.textContent = isCpuPlayer(getCurrentPlayer(game)) ? cpuStatusMessage : '';
  const error = document.querySelector<HTMLElement>('#game-error');
  if (error) error.textContent = errorMessage;
}

function bindBoardDetails(): void {
  board?.content.addEventListener('click', (event) => {
    const tileButton = (event.target as HTMLElement).closest<HTMLButtonElement>('.board-tile');
    if (!tileButton) return;
    const tile = BOARD_TILES.find(
      ({ position }) => position === Number(tileButton.dataset.position),
    );
    if (!tile) return;
    const existing = board?.root.querySelector<HTMLElement>('.tile-detail');
    existing?.remove();
    const detail = document.createElement('aside');
    detail.className = 'tile-detail';
    detail.innerHTML = `<button type="button" aria-label="關閉地點資訊">關閉</button><span>${tile.position}｜${tile.shortName}</span><h3>${escapeHtml(tile.name)}</h3><p>${escapeHtml(tile.description)}</p>${tile.productIds?.length ? `<p><strong>代表產品：</strong>${tile.productIds.map((id) => escapeHtml(getProductById(id).name)).join('、')}</p>` : ''}`;
    board?.root.append(detail);
    detail
      .querySelector('button')
      ?.addEventListener('click', () => detail.remove(), { once: true });
  });
}

function setState(action: () => GameState): void {
  if (ui.locked) return;
  try {
    state = action();
    errorMessage = '';
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  renderDynamic();
}

async function animateMovement(generation: number): Promise<boolean> {
  const game = state;
  if (!game || game.phase !== 'awaiting-roll') return false;
  try {
    state = rollDice(game, gameRandom());
    ui.phase = 'showing-dice';
    renderDynamic();
    const player = getCurrentPlayer(state);
    const diceResult = state.lastDiceRoll;
    if (diceResult === null || !diceAnimation) return false;
    await diceAnimation.show(diceResult, player.id, player.name);
    if (generation !== lifecycleGeneration) return false;
    const token = board?.getToken(player.id);
    if (token) camera?.focus(token, 'focus-player', player.id, player.position, 0);
    while (state?.phase === 'moving') {
      state = advanceMovementStep(state, gameRandom());
      board?.update(state);
      const shownPosition =
        state.movement?.path[(state.movement?.stepIndex ?? 1) - 1] ?? player.position;
      const movedToken = board?.getToken(player.id);
      if (movedToken)
        camera?.focus(
          movedToken,
          'following',
          player.id,
          shownPosition,
          state.movement?.stepIndex ?? 0,
        );
      renderDynamic();
      await scheduleUiDelay(uiDelay.step);
      if (generation !== lifecycleGeneration) return false;
    }
    if (!state) return false;
    if (
      state.phase === 'awaiting-turn-end' &&
      activeMarketCard(state)?.id !== game.marketDeck.activeCardId
    ) {
      lastEventCardId = activeMarketCard(state)?.id ?? null;
    }
    ui.phase = 'arrival';
    const arrivedToken = board?.getToken(player.id);
    if (arrivedToken)
      camera?.focus(
        arrivedToken,
        'arrival',
        player.id,
        getCurrentPlayer(state).position,
        state.movement?.stepIndex ?? 0,
      );
    await scheduleUiDelay(uiDelay.arrival);
    camera?.overview('returning');
    ui.phase = 'returning';
    await scheduleUiDelay(uiDelay.returning);
    camera?.settleOverview();
    ui.phase = 'idle';
    return generation === lifecycleGeneration;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    return false;
  }
}

async function runMovement(): Promise<void> {
  if (
    !state ||
    state.phase !== 'awaiting-roll' ||
    ui.locked ||
    isCpuPlayer(getCurrentPlayer(state))
  )
    return;
  const generation = lifecycleGeneration;
  ui.locked = true;
  lastEventCardId = null;
  await animateMovement(generation);
  ui.locked = false;
  renderDynamic();
}

function applyCpuDecision(game: GameState, decision: CpuDecision): GameState {
  switch (decision.kind) {
    case 'purchase':
      return decision.source === 'production' && game.pendingAction?.kind === 'island-purchase'
        ? chooseIslandPurchase(game, decision.productId)
        : choosePurchase(game, decision.productId);
    case 'skip-purchase':
      return game.pendingAction?.kind === 'island-purchase'
        ? skipIslandPurchase(game)
        : skipPurchase(game);
    case 'sale':
      return chooseSale(game, decision.productId);
    case 'skip-sale':
      return skipSale(game);
    case 'transport':
      return chooseTransport(game, decision.destinationId);
    case 'skip-transport':
      return skipTransport(game);
  }
}

async function runCpuTurns(): Promise<void> {
  if (!state || !isCpuPlayer(getCurrentPlayer(state)) || ui.locked) return;
  const generation = lifecycleGeneration;
  ui.locked = true;
  try {
    while (
      state &&
      state.phase !== 'game-over' &&
      isCpuPlayer(getCurrentPlayer(state)) &&
      generation === lifecycleGeneration
    ) {
      if (state.phase === 'awaiting-roll') {
        cpuStatusMessage = '擲骰並沿棋盤逐格移動';
        renderDynamic();
        await scheduleUiDelay(uiDelay.cpuThinking);
        if (!(await animateMovement(generation))) break;
        continue;
      }
      if (
        state.phase === 'awaiting-purchase' ||
        state.phase === 'awaiting-sale' ||
        state.phase === 'awaiting-transport'
      ) {
        cpuStatusMessage = '依收藏進度、成本與市場行情評估';
        renderDynamic();
        await scheduleUiDelay(uiDelay.cpuThinking);
        const decision = decideCpuAction(state);
        cpuStatusMessage = decision.reason;
        renderDynamic();
        await scheduleUiDelay(uiDelay.cpuDecision);
        state = applyCpuDecision(state, decision);
        renderDynamic();
        await scheduleUiDelay(uiDelay.cpuDecision);
        continue;
      }
      if (state.phase === 'awaiting-turn-end') {
        cpuStatusMessage = '完成回合，交棒給下一位玩家';
        renderDynamic();
        await scheduleUiDelay(uiDelay.cpuDecision);
        state = endTurn(state, gameRandom());
        lastEventCardId = null;
        cpuStatusMessage = '';
        renderDynamic();
        continue;
      }
      break;
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    ui.locked = false;
    cpuStatusMessage = '';
    renderDynamic();
  }
}

function runAutomaticAction(game: GameState): GameState {
  switch (game.phase) {
    case 'awaiting-roll':
      return rollDice(game, () => 0);
    case 'moving':
      return advanceMovementStep(game, () => 0);
    case 'awaiting-purchase': {
      const pending = game.pendingAction;
      if (pending?.kind === 'purchase') return skipPurchase(game);
      if (pending?.kind === 'island-purchase') return skipIslandPurchase(game);
      throw new Error('採購階段缺少合法操作。');
    }
    case 'awaiting-sale':
      return skipSale(game);
    case 'awaiting-transport':
      return skipTransport(game);
    case 'awaiting-turn-end':
      return endTurn(game, () => 0);
    case 'game-over':
      return game;
  }
}

function fastForwardGame(): void {
  if (!testMode || !state) return;
  let next = state;
  let count = 0;
  while (next.phase !== 'game-over' && count < 4000) {
    next = runAutomaticAction(next);
    count += 1;
  }
  if (next.phase !== 'game-over') throw new Error('測試流程未能完成遊戲。');
  state = next;
  renderDynamic();
}

async function endCurrentTurn(): Promise<void> {
  if (!state || state.phase !== 'awaiting-turn-end' || ui.locked) return;
  ui.locked = true;
  const previousIndex = state.currentPlayerIndex;
  state = endTurn(state, gameRandom());
  lastEventCardId = null;
  if (state.phase === 'game-over') {
    ui.locked = false;
    renderDynamic();
    return;
  }
  const handoff = document.querySelector<HTMLElement>('#handoff');
  if (handoff && (state.currentPlayerIndex !== previousIndex || state.round > 1)) {
    handoff.textContent = `輪到 ${getCurrentPlayer(state).name}`;
    handoff.hidden = false;
    await scheduleUiDelay(uiDelay.handoff);
    handoff.hidden = true;
  }
  if (isCpuPlayer(getCurrentPlayer(state))) {
    renderDynamic();
    ui.locked = false;
    void runCpuTurns();
    return;
  }
  ui.locked = false;
  renderDynamic();
}

function renderAtlas(): void {
  const grid = document.querySelector<HTMLElement>('#atlas-grid');
  if (!grid) return;
  const category = document.querySelector<HTMLSelectElement>('#atlas-category')?.value ?? 'all';
  const county = document.querySelector<HTMLSelectElement>('#atlas-county')?.value ?? 'all';
  const products = PRODUCTS.filter(
    (product) =>
      (category === 'all' || product.category === category) &&
      (county === 'all' || product.countyId === county),
  );
  grid.innerHTML = products
    .map((product) => {
      const artwork = renderProductArtwork(product, 'atlas-artwork');
      return `<article class="atlas-product-card ${artwork ? 'has-artwork' : 'no-artwork'}" data-product-id="${product.id}">${artwork ? `<div class="atlas-artwork-wrap">${artwork}</div>` : ''}<div><span>${getCategoryLabel(product.category)}</span><h3>${escapeHtml(product.name)}</h3><p>${getCountyName(product.countyId)}</p><small>旺季：${product.peakSeasons.map(getSeasonLabel).join('、')}</small></div></article>`;
    })
    .join('');
}

function openDialog(id: 'rules-dialog' | 'atlas-dialog'): void {
  const dialog = document.querySelector<HTMLDialogElement>(`#${id}`);
  if (!dialog) return;
  if (id === 'atlas-dialog') renderAtlas();
  dialog.showModal();
}

root.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement;
  if (target.name === 'player-count') updateNameFields(Number(target.value));
  if (target.id === 'atlas-category' || target.id === 'atlas-county') renderAtlas();
});

root.addEventListener('submit', (event) => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('#player-setup');
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const count = Number(data.get('player-count'));
  if (!Number.isInteger(count) || count < 1 || count > 4) return;
  const names = Array.from(
    { length: count },
    (_, index) => String(data.get(`player-name-${index + 1}`) ?? '').trim() || `玩家${index + 1}`,
  );
  cleanupUiLifecycle();
  initializePlaying(createScenarioGame(names));
  if (state && isCpuPlayer(getCurrentPlayer(state))) void runCpuTurns();
});

root.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'open-rules') return openDialog('rules-dialog');
  if (action === 'open-atlas') return openDialog('atlas-dialog');
  if (action === 'close-dialog') return button.closest<HTMLDialogElement>('dialog')?.close();
  if (action === 'roll') return void runMovement();
  if (action === 'end-turn') return void endCurrentTurn();
  if (action === 'buy') return setState(() => choosePurchase(state!, button.dataset.productId!));
  if (action === 'buy-island')
    return setState(() => chooseIslandPurchase(state!, button.dataset.productId!));
  if (action === 'skip-purchase') return setState(() => skipPurchase(state!));
  if (action === 'skip-island') return setState(() => skipIslandPurchase(state!));
  if (action === 'sell') return setState(() => chooseSale(state!, button.dataset.productId!));
  if (action === 'skip-sale') return setState(() => skipSale(state!));
  if (action === 'transport')
    return setState(() => chooseTransport(state!, button.dataset.destinationId!));
  if (action === 'skip-transport') return setState(() => skipTransport(state!));
  if (action === 'restart') {
    cleanupUiLifecycle();
    renderSetup();
    return;
  }
  if (action === 'open-collections') {
    const section = document.querySelector<HTMLElement>('#completed-collections');
    if (section) section.hidden = !section.hidden;
  }
});

if (testMode && scenario) {
  const playerCount =
    scenario === 'multiplayer'
      ? 2
      : scenario === 'phase5b1-identity' || scenario === 'phase5b1-mobile'
        ? 4
        : scenario.startsWith('cpu-')
          ? 4
          : 1;
  initializePlaying(
    createScenarioGame(Array.from({ length: playerCount }, (_, index) => `測試玩家${index + 1}`)),
  );
  if (state && isCpuPlayer(getCurrentPlayer(state))) void runCpuTurns();
  if (scenario === 'game-over') {
    const actionPanel = document.querySelector<HTMLElement>('#action-panel');
    actionPanel?.insertAdjacentHTML(
      'beforeend',
      '<button type="button" class="test-fast-forward" data-action="fast-forward">快速完成 12 輪</button>',
    );
  }
} else {
  renderSetup();
}

root.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    '[data-action="fast-forward"]',
  );
  if (button) fastForwardGame();
});

window.addEventListener('beforeunload', cleanupUiLifecycle, { once: true });
