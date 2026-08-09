import { expect, test, type Page } from '@playwright/test';

function observePage(page: Page): { consoleErrors: string[]; failedAssets: string[] } {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() === 404) failedAssets.push(response.url());
  });
  return { consoleErrors, failedAssets };
}

async function expectHealthyPage(
  page: Page,
  diagnostics: { consoleErrors: string[]; failedAssets: string[] },
): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await expect(page.getByTestId('pending-action')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Turn summary' })).toBeVisible();
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
}

test('Basic Turn走真實引擎完成購買並切換P2', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('engine-test.html?testMode=1&scenario=basic-purchase');
  await expect(page.getByText('Phase 2 核心引擎測試・開發中')).toBeVisible();
  await expect(page.getByText('非正式遊戲畫面・正式臺灣地圖介面尚未完成')).toBeVisible();
  await expect(page.getByTestId('round')).toHaveText('1');
  await expect(page.getByTestId('season')).toHaveText('spring');
  await expect(page.getByTestId('current-player')).toHaveText('測試玩家1');
  await expect(page.getByTestId('funds-player-1')).toHaveText('15');

  await page.getByRole('button', { name: '擲骰' }).click();
  await expect(page.getByTestId('dice')).toHaveText('1');
  await page.getByRole('button', { name: '前進一步' }).click();
  await expect(page.getByTestId('position')).toHaveText('1');
  await page.getByRole('button', { name: '購買', exact: true }).click();
  await expect(page.getByTestId('funds-player-1')).toHaveText('13');
  await expect(page.getByTestId('products-player-1')).toContainText('桃園稻米');
  await page.getByRole('button', { name: '結束回合' }).click();
  await expect(page.getByTestId('current-player')).toHaveText('測試玩家2');
  await expectHealthyPage(page, diagnostics);
});

test('Round Transition完成P1與P2後換市場卡並回P1', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('engine-test.html?testMode=1&scenario=round-transition');
  const originalCard = await page.getByTestId('active-card').textContent();
  const auto = page.getByRole('button', { name: '執行下一個真實引擎動作' });
  for (let action = 0; action < 8; action += 1) await auto.click();
  await expect(page.getByTestId('round')).toHaveText('2');
  await expect(page.getByTestId('current-player')).toHaveText('測試玩家1');
  await expect(page.getByTestId('active-card')).not.toHaveText(originalCard ?? '');
  await expectHealthyPage(page, diagnostics);
});

test('Transport離島行程清除temporaryDestination並留在交通格', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('engine-test.html?testMode=1&scenario=transport');
  await page.getByRole('button', { name: '擲骰' }).click();
  await page.getByRole('button', { name: '前進一步' }).click();
  await expect(page.getByTestId('position')).toHaveText('13');
  await page.getByRole('button', { name: '選擇離島' }).click();
  await expect(page.getByTestId('temporary-destination')).toHaveText('penghu-island-stop');
  await expect(page.getByTestId('pending-action')).toContainText('penghu-cobia');
  await page.getByRole('button', { name: '購買', exact: true }).click();
  await expect(page.getByTestId('temporary-destination')).toHaveText('無');
  await expect(page.getByTestId('position')).toHaveText('13');
  await page.getByRole('button', { name: '結束回合' }).click();
  await expect(page.getByTestId('position')).toHaveText('0');
  await expectHealthyPage(page, diagnostics);
});

test('Game Over以真實引擎跑完12輪並顯示排名', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('engine-test.html?testMode=1&scenario=full-game');
  await page.getByRole('button', { name: '快速完成12輪' }).click();
  await expect(page.getByTestId('round')).toHaveText('12');
  await expect(page.getByTestId('phase')).toHaveText('game-over');
  await expect(page.getByTestId('rankings')).toBeVisible();
  await expect(page.getByText('遊戲已結束，不能再擲骰。')).toBeVisible();
  await expectHealthyPage(page, diagnostics);
});
