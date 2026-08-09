# 設計與架構決策

## 資料驅動設計

產品、縣市、地區、季節、棋盤、市場卡與收藏任務分別存放。UI與未來遊戲引擎只能透過穩定ID與型別取得資料。

> 不得在UI中使用 `if (county === '屏東')` 這類硬編碼控制產品內容。

任何縣市內容必須由 `countyId`、`productIds` 或其他正式關聯資料決定。資料驗證在啟動、單元測試與CI中執行，錯誤引用直接拋出具體訊息。

## Core Engine Architecture

`src/game` 以純資料 `GameState` 與同步state transition實作核心規則。每個phase只接受合法action，函式回傳新state，不依賴DOM、動畫、音效或Timer；UI只根據state呈現並送出玩家意圖。

- RNG透過 `RandomSource` 注入，正式使用 `Math.random`，測試可固定或seed。
- `MovementPresentation` 保留逐格path與stepIndex，最後一步才提交玩家position。
- `PendingAction` 是採購、出售、交通與離島採購的discriminated union。
- 主環島路線0至26與離島27至29分離；離島只作為交通格的暫時目的地。
- `MarketDeckState` 分開管理抽牌、棄牌與唯一active卡，並支援安全重洗。
- 收藏selector純粹依玩家持有的穩定product ID判斷12項公開任務。
- 最終計分集中處理產品現值、收藏、資金換分與完整平手順序。

`game.html` 是正式遊戲介面；Phase 2最小測試介面保留於 `engine-test.html`。

## Taiwan Map Board

正式棋盤由穩定的HTML節點、桌遊化臺灣SVG輪廓與30個絕對座標格組成。本島主路線0至26沿西岸向南、東岸向北形成環線；澎湖、金門、馬祖27至29位於本島外側，視覺與規則都不混入主路線。棋盤只初始化一次，後續僅更新棋子、目前格與測試資料屬性。

## Board Camera

`BoardCameraController` 只管理 `translate3d` 與 `scale`。全景會依viewport自動fit，聚焦倍率桌機1.72、手機1.32；目標座標經四邊clamp，無效尺寸回退identity。流程為overview、focus-player、following、arrival、returning、overview。ResizeObserver只觀察現有viewport，RAF具generation防止舊動作回寫，cleanup會取消RAF並中斷observer。

## UI Presentation State

`UiPresentationState` 與 `BoardCameraPresentation` 完全位於 `src/ui`，不進入 `GameState`。骰子顯示、Camera停留、交棒提示、action lock與事件卡強調皆屬presentation；採購金、位置、收藏、合法目的地與最終計分仍由Phase 2引擎決定。

## Responsive Layout

1280×720使用玩家、棋盤、市場收藏三欄與底部操作區。小於760px後改為單欄：回合狀態、橫滑玩家卡、全景棋盤、可折疊收藏與sticky bottom sheet。頁面本身禁止水平溢位，橫向內容只在明確的卡片scroller內發生。

## Mobile Bottom Sheet

手機操作區固定於viewport下緣的可視位置，主要按鈕至少44px。Camera抵達後先回到全景再解鎖操作，避免zoom狀態占用採購、出售或交通選擇空間。

## Stable Board DOM

`createBoardView()` 建立棋盤與所有玩家token後不再replace整棵board。每一步只更新CSS custom properties、`data-position`與目前格狀態；多人同格以1、2、3、4人的不同offset排列。

## Animation Lifecycle

UI延遲集中由 `scheduleUiDelay()` 管理，restart與離頁會清除timer、Camera RAF與ResizeObserver。`ui.locked` 同時保護重複擲骰、重複購買與重複結束回合，不只依賴disabled外觀。

## Reduced Motion

`prefers-reduced-motion: reduce` 時Camera固定 `scale(1)` 與零位移，CSS transition近乎即時；引擎仍逐次執行每個 `advanceMovementStep()`，不跳過任何遊戲狀態。

## 真實資料與遊戲數值分離

`sourceNote` 描述產地依據與代表性，`purchaseCost` 與 `baseValue` 只服務玩法平衡。正式價格、即時行情與官方產值不進入遊戲資料，也不以遊戲數值冒充真實統計。

## 語意標籤

`Product.category` 負責水果、米糧雜糧、蔬菜、茶與特色作物、水產、畜產與其他這六大主要遊戲分類。`Product.tags` 負責跨分類語意，例如 `tea`、`rice`、`mountain`、`coastal`、`tropical` 與 `indigenous`。

收藏任務需要跨分類特徵時必須沿用語意標籤，不得為每一個收藏任務增加新的主分類。

## 純靜態架構

專案由Vite輸出靜態檔案，可部署至GitHub Pages。Phase 2不包含後端、資料庫、帳號、API Server、外部AI服務或即時價格來源。

## Camera預留

未來地圖介面使用以下容器層級：

```html
<div class="map-camera">
  <div class="map-camera-viewport">
    <div class="map-camera-content">
      <!-- Taiwan board -->
    </div>
  </div>
</div>
```

正式流程是「擲骰、Camera聚焦、棋子逐格移動、Camera跟拍、抵達、回到臺灣全景」。Camera只負責視覺座標轉換，不改變棋盤position或規則狀態。

## 手機響應式

互動目標至少44px，主要操作固定在拇指可及範圍。地圖內容可縮放或平移，但頁面本身不得水平溢位。支援 `prefers-reduced-motion`、鍵盤焦點與系統明暗色。

## 未來CPU策略

CPU只讀取公開遊戲狀態與可用動作，透過可測試的評分函式選擇採購、移動或任務方向。難度差異來自評估深度與權重，不透過偷看牌庫或修改亂數。

## ID與資料版本

所有ID使用穩定英文kebab-case，不由陣列index產生。更名顯示文字不得順帶修改ID。若未來資料格式改變，須先加入遷移說明與跨資料測試。
