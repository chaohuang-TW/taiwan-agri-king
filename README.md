# 《臺灣農產王：環島產地爭霸戰》

《臺灣農產王》是以臺灣農漁產地為主題的兒童與家庭網頁桌遊。玩家扮演農產採購王，沿環島棋盤認識產地、採購產品、觀察市場，並在12輪後以最高總產值取勝。

> 目前為 Phase 2 核心引擎開發預覽。核心規則已可完整運行，正式臺灣地圖介面尚未完成。

## 遊戲概念與目標

核心體驗是「走臺灣、認產地、買農產、看行情、湊收藏、拚最高總產值」。核心引擎支援1至4名真人；Phase 2不包含CPU。完整規則見 [GAME_RULES.md](./GAME_RULES.md)。

## 目前資料規模

- 5個臺灣地區與22縣市
- 48項農漁產品
- 30格環島棋盤
- 20張市場卡
- 12張收藏任務
- 春、夏、秋、冬共12輪的季節配置

## 技術棧

Vite、TypeScript、原生HTML、原生CSS、Vitest、Playwright、ESLint、Prettier、GitHub Actions、GitHub Pages與pnpm。

## 本機啟動

需求：Node.js 24、pnpm 9.15.9。

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

## 測試與品質檢查

```bash
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run build
pnpm run test:e2e
```

Coverage門檻：Statements 85%、Branches 80%、Functions 85%、Lines 85%。

## GitHub Pages

開發預覽網址：<https://chaohuang-tw.github.io/taiwan-agri-king/>。`game.html` 是核心引擎測試介面，並非正式遊戲畫面。

## 資料來源聲明

產地資料優先參考農業部、農糧署、漁業署、農業知識入口網與地方政府等官方來源。來源與查證範圍記錄於 [DATA_SOURCES.md](./DATA_SOURCES.md)。代表性產地不表示該產品只在單一縣市生產。

## 遊戲數值聲明

> 本遊戲中的「採購金」、「採購成本」與「產值」均為遊戲化數值，僅供玩法與平衡使用，不代表實際市場價格、交易價格或官方農業產值。

## Roadmap

1. Phase 1 資料基礎
2. Phase 2 核心遊戲引擎
3. Phase 3 臺灣地圖UI
4. Phase 4 CPU、市場與收藏
5. Phase 5 手機UX、動畫與發布
