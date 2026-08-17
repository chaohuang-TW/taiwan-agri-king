import './styles/tokens.css';
import './styles/global.css';
import { BOARD_TILES } from './data/board';
import { COLLECTION_GOALS } from './data/collectionGoals';
import { COUNTIES } from './data/counties';
import { MARKET_CARDS } from './data/marketCards';
import { PRODUCT_CATEGORY_NAMES, PRODUCTS } from './data/products';
import { validateGameData } from './game/dataValidation';
import { renderHeroTaiwanArtwork } from './ui/boardArtwork';
import { renderProductArtwork } from './ui/productArtwork';

validateGameData();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('找不到應用程式掛載點');

const featured = [
  'pingtung-pineapple',
  'nantou-high-mountain-tea',
  'tainan-milkfish',
  'taitung-custard-apple',
]
  .map((id) => PRODUCTS.find((product) => product.id === id))
  .filter((product): product is (typeof PRODUCTS)[number] => Boolean(product));

const countyName = (id: string) => COUNTIES.find((county) => county.id === id)?.name ?? id;

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="回到臺灣農產王頁首"><span class="brand-mark" aria-hidden="true">田</span><span>臺灣農產王</span></a>
    <nav aria-label="主要導覽"><button type="button" data-open="rules-dialog">遊戲規則</button><button type="button" data-open="atlas-dialog">農產圖鑑</button><a href="./game.html">開始遊戲</a></nav>
  </header>
  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><p class="eyebrow">Phase 4 CPU 開發預覽</p><h1 id="hero-title">《臺灣農產王》<span>環島產地爭霸戰</span></h1><p class="hero-subtitle">走臺灣，認產地，買農產，拚產值。</p><div class="hero-actions"><a class="primary-link" href="./game.html">開始遊戲</a><button type="button" data-open="rules-dialog">看規則</button></div></div>
      <div class="hero-board" aria-label="臺灣環島桌遊棋盤預覽"><div class="hero-island">${renderHeroTaiwanArtwork()}<span class="hero-route-badge"><strong>12<small>輪</small></strong></span><i class="marker marker-north">北</i><i class="marker marker-west">西</i><i class="marker marker-south">南</i><i class="marker marker-east">東</i></div><div class="offshore-set" aria-label="離島旅行"><span>澎湖</span><span>金門</span><span>馬祖</span></div></div>
    </section>
    <section class="facts" aria-label="遊戲內容規模"><article><strong>${BOARD_TILES.length}</strong><span>格臺灣棋盤</span></article><article><strong>${PRODUCTS.length}</strong><span>項農漁產品</span></article><article><strong>${MARKET_CARDS.length}</strong><span>張市場卡</span></article><article><strong>${COLLECTION_GOALS.length}</strong><span>項收藏任務</span></article></section>
    <section class="how-to-play" aria-labelledby="play-title"><h2 id="play-title">一趟看得懂，也玩得完的環島</h2><div class="play-sequence"><article><strong>擲骰前進</strong><p>沿臺灣本島 0 至 26 格逐站移動。</p></article><article><strong>採購與出售</strong><p>在產地、農漁會與市場做一次選擇。</p></article><article><strong>完成收藏</strong><p>公開追蹤 12 項任務，12 輪後結算。</p></article></div></section>
    <section class="produce-stage" aria-labelledby="produce-title"><div><h2 id="produce-title">從產地開始認識臺灣</h2><p>真實產地脈絡與遊戲化成本、產值分開保存。每張產品卡清楚標示縣市、類別與旺季。</p><button type="button" data-open="atlas-dialog">打開 48 項圖鑑</button></div><div class="produce-stack">${featured
      .map((product, index) => {
        const artwork = renderProductArtwork(product, 'homepage-product-image');
        return `<article class="${artwork ? 'has-artwork' : 'no-artwork'}" style="--card-index:${index}">${artwork ? `<div class="homepage-product-art">${artwork}</div>` : ''}<span>${PRODUCT_CATEGORY_NAMES[product.category]}</span><h3>${product.name}</h3><p>${countyName(product.countyId)}</p><small>旺季 ${product.peakSeasons.length} 季</small></article>`;
      })
      .join('')}</div></section>
    <section class="family-note"><div><h2>1 至 4 人，共用一臺裝置</h2><p>沒有隱藏資訊。輪到誰，畫面就會清楚交棒；手機與桌機都能完成整場遊戲。</p></div><a class="primary-link" href="./game.html">開始環島</a></section>
    <section class="developer-note"><h2>開發資訊</h2><p>核心規則由純 TypeScript 引擎負責，正式介面只呈現狀態並送出玩家操作。</p><a href="./engine-test.html">核心引擎測試</a></section>
  </main>
  <footer><p>採購金、採購成本與產值皆為遊戲化數值，不代表實際市場價格或官方農業產值。</p></footer>
  <dialog id="rules-dialog" aria-labelledby="rules-title"><div class="dialog-head"><h2 id="rules-title">遊戲規則</h2><button type="button" data-close aria-label="關閉規則">關閉</button></div><div class="rules-grid"><article><strong>目標</strong><p>12 輪後，以產品價值、收藏加成與資金換分合計最高者獲勝。</p></article><article><strong>四季</strong><p>每 3 輪更換季節，旺季產品價值提高。</p></article><article><strong>採購</strong><p>產地、農會與漁會每次可買 0 或 1 項。</p></article><article><strong>環島獎勵</strong><p>正常移動路徑經過臺北環島起點（position 0），完成一圈獲得5採購金；不必剛好停在起點，從起點出發也不會立即獲獎。</p></article><article><strong>市場</strong><p>市場每次可賣 0 或 1 項，市場卡會改變行情。</p></article><article><strong>收藏</strong><p>12 項任務公開顯示，完成即可取得加成。</p></article><article><strong>離島</strong><p>交通格可選擇合法離島，完成一次特別採購。</p></article></div></dialog>
  <dialog id="atlas-dialog" aria-labelledby="atlas-title"><div class="dialog-head"><h2 id="atlas-title">農產圖鑑</h2><button type="button" data-close aria-label="關閉圖鑑">關閉</button></div><div class="atlas-grid">${PRODUCTS.map(
    (product) => {
      const artwork = renderProductArtwork(product, 'atlas-artwork');
      return `<article class="atlas-product-card ${artwork ? 'has-artwork' : 'no-artwork'}" data-product-id="${product.id}">${artwork ? `<div class="atlas-artwork-wrap">${artwork}</div>` : ''}<div><span>${PRODUCT_CATEGORY_NAMES[product.category]}</span><h3>${product.name}</h3><p>${countyName(product.countyId)}</p><small>旺季：${product.peakSeasons.join('、')}</small></div></article>`;
    },
  ).join('')}</div></dialog>
`;

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const openButton = target.closest<HTMLButtonElement>('[data-open]');
  if (openButton)
    document.querySelector<HTMLDialogElement>(`#${openButton.dataset.open}`)?.showModal();
  const closeButton = target.closest<HTMLButtonElement>('[data-close]');
  if (closeButton) closeButton.closest<HTMLDialogElement>('dialog')?.close();
});
