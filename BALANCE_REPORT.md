# Phase 4 平衡驗證報告

## 方法

- Simulations：2,000
- Seeds：`1..2000`
- Players per game：4 CPU
- CPU strategy：deterministic heuristic
- Core rule changes：none
- Telemetry：由 `runBalanceSimulation(2_000)` 直接產生，收藏完成判定使用核心 `getCompletedCollectionGoals()`。

## 完整性

| 指標           |          結果 |
| -------------- | ------------: |
| 完成局數       | 2,000 / 2,000 |
| 無效局數       |             0 |
| Deadlock       |             0 |
| 最大 action 數 |           348 |

所有局均在 12 輪完成；資金沒有負值或 `NaN`，沒有非法 phase、卡死或未完成遊戲。

## Seat equity

平手以等分勝場計算。

| Seat | Win-equivalent |
| ---- | -------------: |
| P1   |        26.000% |
| P2   |        24.000% |
| P3   |        25.175% |
| P4   |        24.825% |

Max-min gap：`2.000pp`
Acceptance：`<= 8pp`，**PASS**

## Score / Economy

- Average score：40.565
- Median score：42.000
- Score stddev（population）：11.941
- Average ending funds：3.229
- Average products：4.813
- Average completed goals：0.745
- Tie rate：0.500%

## Actions

| 行為     | 總次數 | 平均每位玩家 |
| -------- | -----: | -----------: |
| 採購     | 43,758 |        5.470 |
| 出售     |  5,257 |        0.657 |
| 離島交通 |  3,062 |        0.383 |
| 略過     | 38,641 |            — |
| 事件換卡 |  8,344 |            — |

平均值分母為 `2,000 × 4 = 8,000` 位玩家。

## Collection Completion

整體收藏任務完成率仍為 `6.206%`。以下為 2,000 場、8,000 位玩家的逐項完成率：

| 收藏任務   |  完成率 |
| ---------- | ------: |
| 水果王國   |  3.288% |
| 臺灣好茶   |  0.000% |
| 海味王     |  0.250% |
| 稻米達人   |  0.000% |
| 蔬菜滿籃   |  8.025% |
| 東部好物   |  0.138% |
| 海線之旅   |  0.250% |
| 山城珍味   |  0.125% |
| 農漁雙全   | 21.313% |
| 環島達人   |  7.663% |
| 百味臺灣   | 32.988% |
| 臺灣農產王 |  0.438% |

## Observations

依本輪觀測標準，完成率低於 1% 或高於 30% 的任務標示如下；本輪只記錄，不調整 goal condition、bonus、產品 tag、棋盤或 CPU 權重：

- **Detected imbalance / observation：** 臺灣好茶、海味王、稻米達人、東部好物、海線之旅、山城珍味、臺灣農產王低於 1%。
- **Detected imbalance / observation：** 百味臺灣高於 30%。
- 這些是平衡觀測，不代表已確認為程式錯誤；需人工決定是否在後續階段調整收藏目標或策略。

## 結論

座位勝率差距為 2.000pp，低於 8pp CI hard assertion 門檻；2,000 局全部完成，經濟與生命週期遙測有效。CPU 核心策略保持不動，Phase 4 進入最終人工驗收。
