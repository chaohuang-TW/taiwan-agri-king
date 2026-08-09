import './styles/global.css';
import { BOARD_TILES } from './data/board';
import { COLLECTION_GOALS } from './data/collectionGoals';
import { COUNTIES } from './data/counties';
import { MARKET_CARDS } from './data/marketCards';
import { PRODUCT_CATEGORY_NAMES, PRODUCTS } from './data/products';
import { REGIONS, REGION_NAMES } from './data/regions';
import { validateGameData } from './game/dataValidation';

validateGameData();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('找不到應用程式掛載點');

const featuredProducts = [
  'miaoli-strawberry',
  'nantou-high-mountain-tea',
  'tainan-milkfish',
  'taitung-custard-apple',
  'penghu-cobia',
].map((id) => PRODUCTS.find((product) => product.id === id)!);

const categoryCount = (category: (typeof PRODUCTS)[number]['category']) =>
  PRODUCTS.filter((product) => product.category === category).length;

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="回到臺灣農產王頁首">
      <span class="brand-mark" aria-hidden="true">田</span>
      <span>臺灣農產王</span>
    </a>
    <span class="development-status">開發中</span>
  </header>

  <main id="top">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">Phase 1 資料基礎</p>
        <h1 id="hero-title">《臺灣農產王》<span>環島產地爭霸戰</span></h1>
        <p class="hero-subtitle">走臺灣・認產地・買農產・拚產值</p>
        <a class="primary-link" href="#data-preview">查看資料預覽</a>
      </div>
      <div class="route-preview" aria-label="環島資料路線預覽">
        <div class="route-island">
          <span class="route-label route-north">北部</span>
          <span class="route-label route-central">中部</span>
          <span class="route-label route-south">南部</span>
          <span class="route-label route-east">東部</span>
          <span class="route-label route-offshore">離島</span>
          <span class="route-core">12<span>輪</span></span>
        </div>
        <p>資料已通過跨縣市、產品與棋盤引用驗證</p>
      </div>
    </section>

    <section class="facts" aria-label="遊戲資料規模">
      <article><strong>${BOARD_TILES.length}</strong><span>格環島棋盤</span></article>
      <article><strong>${PRODUCTS.length}</strong><span>項臺灣農漁產品</span></article>
      <article><strong>${MARKET_CARDS.length}</strong><span>張市場卡</span></article>
      <article><strong>${COLLECTION_GOALS.length}</strong><span>個收藏挑戰</span></article>
      <article><strong>12</strong><span>輪春夏秋冬</span></article>
    </section>

    <section class="data-preview" id="data-preview" aria-labelledby="data-title">
      <div class="section-heading">
        <h2 id="data-title">從產地出發的資料地基</h2>
        <p>真實產地脈絡與遊戲化數值分開記錄，讓後續引擎與介面都能由同一套資料驅動。</p>
      </div>
      <div class="product-showcase">
        ${featuredProducts
          .map(
            (product, index) => `
              <article class="product-card product-card-${index + 1}">
                <span class="product-index">${String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>${REGION_NAMES[product.region]}・${PRODUCT_CATEGORY_NAMES[product.category]}</p>
                  <h3>${product.name}</h3>
                  <span>${COUNTIES.find(({ id }) => id === product.countyId)!.name}</span>
                </div>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="category-section" aria-labelledby="category-title">
      <h2 id="category-title">六大類，48種採購選擇</h2>
      <div class="category-grid">
        ${Object.entries(PRODUCT_CATEGORY_NAMES)
          .map(
            ([id, name]) => `
              <article>
                <strong>${categoryCount(id as keyof typeof PRODUCT_CATEGORY_NAMES)}</strong>
                <span>${name}</span>
              </article>
            `,
          )
          .join('')}
      </div>
    </section>

    <section class="foundation-note" aria-labelledby="foundation-title">
      <div>
        <h2 id="foundation-title">這一階段只把資料做對</h2>
        <p>目前尚未提供擲骰、棋子移動、CPU、市場結算或完整遊戲畫面。</p>
      </div>
      <dl>
        <div><dt>縣市</dt><dd>${COUNTIES.length}</dd></div>
        <div><dt>地區</dt><dd>${REGIONS.length}</dd></div>
        <div><dt>資料狀態</dt><dd>已驗證</dd></div>
      </dl>
    </section>
  </main>

  <footer>
    <p>本遊戲中的採購金、採購成本與產值均為遊戲化數值，不代表實際市場價格、交易價格或官方農業產值。</p>
  </footer>
`;
