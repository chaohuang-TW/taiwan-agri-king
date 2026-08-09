# 設計與架構決策

## 資料驅動設計

產品、縣市、地區、季節、棋盤、市場卡與收藏任務分別存放。UI與未來遊戲引擎只能透過穩定ID與型別取得資料。

> 不得在UI中使用 `if (county === '屏東')` 這類硬編碼控制產品內容。

任何縣市內容必須由 `countyId`、`productIds` 或其他正式關聯資料決定。資料驗證在啟動、單元測試與CI中執行，錯誤引用直接拋出具體訊息。

## 遊戲引擎與UI分離

未來 `src/game` 負責純函式狀態轉換、規則與隨機來源注入；UI只呈現狀態並送出玩家意圖。DOM、動畫與音效不得進入規則函式，規則測試也不得依賴瀏覽器。

## 真實資料與遊戲數值分離

`sourceNote` 描述產地依據與代表性，`purchaseCost` 與 `baseValue` 只服務玩法平衡。正式價格、即時行情與官方產值不進入遊戲資料，也不以遊戲數值冒充真實統計。

## 純靜態架構

專案由Vite輸出靜態檔案，可部署至GitHub Pages。Phase 1不包含後端、資料庫、帳號、API Server、外部AI服務或即時價格來源。

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

預定流程是「擲骰、Camera聚焦、棋子逐格移動、Camera跟拍、抵達、回到臺灣全景」。Camera只負責視覺座標轉換，不改變棋盤position或規則狀態。Phase 1不實作Camera。

## 手機響應式

互動目標至少44px，主要操作固定在拇指可及範圍。地圖內容可縮放或平移，但頁面本身不得水平溢位。支援 `prefers-reduced-motion`、鍵盤焦點與系統明暗色。

## 未來CPU策略

CPU只讀取公開遊戲狀態與可用動作，透過可測試的評分函式選擇採購、移動或任務方向。難度差異來自評估深度與權重，不透過偷看牌庫或修改亂數。

## ID與資料版本

所有ID使用穩定英文kebab-case，不由陣列index產生。更名顯示文字不得順帶修改ID。若未來資料格式改變，須先加入遷移說明與跨資料測試。
