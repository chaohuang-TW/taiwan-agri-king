import './styles/game.css';
import { MARKET_CARDS } from './data/marketCards';
import { PRODUCTS } from './data/products';
import {
  advanceMovementStep,
  chooseIslandPurchase,
  choosePurchase,
  chooseSale,
  chooseTransport,
  createGame,
  endTurn,
  rollDice,
  skipIslandPurchase,
  skipPurchase,
  skipSale,
  skipTransport,
} from './game/engine';
import { getCurrentPlayer } from './game/selectors';
import type { GameState, RandomSource } from './game/types';

const mount = document.querySelector<HTMLDivElement>('#game-app');
if (!mount) throw new Error('找不到核心引擎測試頁掛載點');
const root: HTMLDivElement = mount;

const params = new URLSearchParams(window.location.search);
const testMode = params.get('testMode') === '1';
const scenario = params.get('scenario') ?? 'basic-purchase';
const fixedRandom: RandomSource = () => 0;
const random: RandomSource = testMode ? fixedRandom : Math.random;
let state: GameState | null = null;
let errorMessage = '';

function productName(id: string): string {
  return PRODUCTS.find((product) => product.id === id)?.name ?? id;
}

function activeCardTitle(game: GameState): string {
  return MARKET_CARDS.find(({ id }) => id === game.marketDeck.activeCardId)?.title ?? '無';
}

function setState(action: () => GameState): void {
  try {
    state = action();
    errorMessage = '';
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
  render();
}

function createScenarioGame(names: string[]): GameState {
  const game = createGame(names, random);
  if (testMode && scenario === 'transport') {
    return {
      ...game,
      players: game.players.map((player, index) =>
        index === 0 ? { ...player, position: 12 } : player,
      ),
    };
  }
  return game;
}

function runOneAutomaticAction(game: GameState): GameState {
  switch (game.phase) {
    case 'awaiting-roll':
      return rollDice(game, random);
    case 'moving':
      return advanceMovementStep(game, random);
    case 'awaiting-purchase': {
      const pending = game.pendingAction;
      if (pending?.kind === 'island-purchase') {
        const candidate = pending.productIds.find(
          (id) => !getCurrentPlayer(game).productIds.includes(id),
        );
        return candidate ? chooseIslandPurchase(game, candidate) : skipIslandPurchase(game);
      }
      if (pending?.kind === 'purchase') {
        const player = getCurrentPlayer(game);
        const candidate = pending.productIds.find((id) => {
          const product = PRODUCTS.find((item) => item.id === id);
          return product && !player.productIds.includes(id) && player.funds >= product.purchaseCost;
        });
        return candidate ? choosePurchase(game, candidate) : skipPurchase(game);
      }
      throw new Error('採購phase缺少pending action。');
    }
    case 'awaiting-sale': {
      const productId = getCurrentPlayer(game).productIds[0];
      return productId ? chooseSale(game, productId) : skipSale(game);
    }
    case 'awaiting-transport': {
      const destination =
        game.pendingAction?.kind === 'transport' ? game.pendingAction.destinationIds[0] : null;
      return destination ? chooseTransport(game, destination) : skipTransport(game);
    }
    case 'awaiting-turn-end':
      return endTurn(game, random);
    case 'game-over':
      return game;
  }
}

function fastForwardGame(): GameState {
  if (!testMode) throw new Error('快速完成只在testMode提供。');
  let game = state ?? createScenarioGame(['測試玩家1', '測試玩家2']);
  let actions = 0;
  while (game.phase !== 'game-over' && actions < 3000) {
    game = runOneAutomaticAction(game);
    actions += 1;
  }
  if (game.phase !== 'game-over') throw new Error('快速模擬未能正常結束。');
  return game;
}

function actionControls(game: GameState): string {
  if (game.phase === 'awaiting-roll') return '<button data-action="roll">擲骰</button>';
  if (game.phase === 'moving') return '<button data-action="advance">前進一步</button>';
  if (game.phase === 'awaiting-turn-end') return '<button data-action="end-turn">結束回合</button>';
  if (game.phase === 'awaiting-purchase') {
    const pending = game.pendingAction;
    const ids =
      pending?.kind === 'purchase' || pending?.kind === 'island-purchase' ? pending.productIds : [];
    const island = pending?.kind === 'island-purchase';
    return `
      <select data-testid="product-choice" aria-label="產品選擇">
        ${ids.map((id) => `<option value="${id}">${productName(id)}</option>`).join('')}
      </select>
      <button data-action="${island ? 'island-purchase' : 'purchase'}" ${ids.length ? '' : 'disabled'}>購買</button>
      <button class="secondary" data-action="${island ? 'skip-island' : 'skip-purchase'}">略過</button>`;
  }
  if (game.phase === 'awaiting-sale') {
    const ids = getCurrentPlayer(game).productIds;
    return `
      <select data-testid="sale-choice" aria-label="出售產品選擇">
        ${ids.map((id) => `<option value="${id}">${productName(id)}</option>`).join('')}
      </select>
      <button data-action="sale" ${ids.length ? '' : 'disabled'}>出售</button>
      <button class="secondary" data-action="skip-sale">略過</button>`;
  }
  if (game.phase === 'awaiting-transport') {
    const ids = game.pendingAction?.kind === 'transport' ? game.pendingAction.destinationIds : [];
    return `
      <select data-testid="transport-choice" aria-label="交通目的地選擇">
        ${ids.map((id) => `<option value="${id}">${id}</option>`).join('')}
      </select>
      <button data-action="transport">選擇離島</button>
      <button class="secondary" data-action="skip-transport">略過</button>`;
  }
  return '<p>遊戲已結束，不能再擲骰。</p>';
}

function render(): void {
  const game = state;
  root.innerHTML = `
    <main class="engine-shell">
      <header class="engine-header">
        <div><p class="engine-kicker">Phase 2 核心引擎測試・開發中</p><h1>核心引擎測試介面</h1></div>
        <a href="./">返回開發預覽首頁</a>
      </header>
      <p class="engine-warning">非正式遊戲畫面・正式臺灣地圖介面尚未完成</p>

      <section class="setup-panel" aria-labelledby="setup-title">
        <h2 id="setup-title">建立測試遊戲</h2>
        <div class="setup-grid">
          <label>玩家數<select id="player-count"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
          <label>玩家名稱<input id="player-names" value="玩家1,玩家2" /></label>
          <button data-action="start">開始</button>
        </div>
      </section>

      ${
        game
          ? `
        <section class="state-panel" aria-label="遊戲狀態">
          <div class="state-grid">
            <div class="state-item"><span>Round</span><strong data-testid="round">${game.round}</strong></div>
            <div class="state-item"><span>Season</span><strong data-testid="season">${game.season}</strong></div>
            <div class="state-item"><span>Current player</span><strong data-testid="current-player">${getCurrentPlayer(game).name}</strong></div>
            <div class="state-item"><span>Phase</span><strong data-testid="phase">${game.phase}</strong></div>
            <div class="state-item"><span>Dice</span><strong data-testid="dice">${game.lastDiceRoll ?? '無'}</strong></div>
            <div class="state-item"><span>Position</span><strong data-testid="position">${getCurrentPlayer(game).position}</strong></div>
            <div class="state-item"><span>Active market card</span><strong data-testid="active-card">${activeCardTitle(game)}</strong></div>
            <div class="state-item"><span>Temporary destination</span><strong data-testid="temporary-destination">${game.temporaryDestinationId ?? '無'}</strong></div>
          </div>
          <p class="pending" data-testid="pending-action">Pending action：${game.pendingAction ? JSON.stringify(game.pendingAction) : '無'}</p>
        </section>

        <section class="players-panel" aria-label="玩家資料"><div class="player-grid">
          ${game.players.map((player, index) => `<article class="player-card ${index === game.currentPlayerIndex ? 'current' : ''}"><h3>${player.name}</h3><p>Funds：<strong data-testid="funds-${player.id}">${player.funds}</strong></p><p>Position：${player.position}</p><p>Products：<span data-testid="products-${player.id}">${player.productIds.map(productName).join('、') || '無'}</span></p></article>`).join('')}
        </div></section>

        <section class="action-panel" aria-labelledby="action-title"><h2 id="action-title">可用操作</h2><div class="action-row">${actionControls(game)}${testMode ? '<button class="secondary" data-action="auto-action">執行下一個真實引擎動作</button><button class="secondary" data-action="fast-forward">快速完成12輪</button>' : ''}</div></section>

        <section class="summary-panel" aria-labelledby="summary-title"><h2 id="summary-title">Turn summary</h2><strong>${game.turnSummary?.title ?? '尚無'}</strong><ul>${(game.turnSummary?.lines ?? []).map((line) => `<li>${line}</li>`).join('')}</ul></section>
        ${game.rankings ? `<section class="ranking-panel"><h2>最終排名</h2><table class="ranking-table" data-testid="rankings"><thead><tr><th>名次</th><th>玩家</th><th>總分</th><th>產品</th><th>收藏</th><th>資金換分</th></tr></thead><tbody>${game.rankings.map((rank) => `<tr><td>${rank.rank}</td><td>${rank.playerName}</td><td>${rank.score.total}</td><td>${rank.score.productValue}</td><td>${rank.score.collectionBonus}</td><td>${rank.score.fundsBonus}</td></tr>`).join('')}</tbody></table></section>` : ''}
      `
          : '<p>請建立1至4名真人玩家。</p>'
      }
      <p class="error-message" role="alert" data-testid="error">${errorMessage}</p>
    </main>`;
}

root.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'start') {
    const count = Number((document.querySelector('#player-count') as HTMLSelectElement).value);
    const entered = (document.querySelector('#player-names') as HTMLInputElement).value.split(',');
    const names = Array.from(
      { length: count },
      (_, index) => entered[index]?.trim() || `玩家${index + 1}`,
    );
    setState(() => createScenarioGame(names));
    return;
  }
  if (!state) return;
  const selectValue = (testId: string) =>
    (document.querySelector(`[data-testid="${testId}"]`) as HTMLSelectElement | null)?.value ?? '';
  const actions: Record<string, () => GameState> = {
    roll: () => rollDice(state!, random),
    advance: () => advanceMovementStep(state!, random),
    purchase: () => choosePurchase(state!, selectValue('product-choice')),
    'skip-purchase': () => skipPurchase(state!),
    sale: () => chooseSale(state!, selectValue('sale-choice')),
    'skip-sale': () => skipSale(state!),
    transport: () => chooseTransport(state!, selectValue('transport-choice')),
    'skip-transport': () => skipTransport(state!),
    'island-purchase': () => chooseIslandPurchase(state!, selectValue('product-choice')),
    'skip-island': () => skipIslandPurchase(state!),
    'end-turn': () => endTurn(state!, random),
    'auto-action': () => runOneAutomaticAction(state!),
    'fast-forward': fastForwardGame,
  };
  const handler = action ? actions[action] : undefined;
  if (handler) setState(handler);
});

if (testMode) state = createScenarioGame(['測試玩家1', '測試玩家2']);
render();
