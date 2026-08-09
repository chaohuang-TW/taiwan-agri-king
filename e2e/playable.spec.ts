import { expect, test, type Page } from '@playwright/test';

function observePage(page: Page) {
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

async function expectPageHealthy(
  page: Page,
  diagnostics: ReturnType<typeof observePage>,
): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
}

async function waitForAction(page: Page, heading: string | RegExp): Promise<void> {
  await expect(page.getByText(heading, { exact: typeof heading === 'string' }).first()).toBeVisible(
    {
      timeout: 5000,
    },
  );
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-settled', 'true');
}

test('正式首頁可設定兩名玩家並進入30格臺灣棋盤', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('');
  await page.getByRole('link', { name: '開始遊戲', exact: true }).first().click();
  await page.locator('input[name="player-count"][value="2"]').check();
  await page.getByLabel('玩家 1 名稱').fill('阿禾');
  await page.getByLabel('玩家 2 名稱').fill('小穗');
  await page.getByRole('button', { name: '開始環島' }).click();
  await expect(page.getByTestId('round')).toHaveText('第 1 / 12 輪');
  await expect(page.getByTestId('season')).toContainText('春');
  await expect(page.getByTestId('current-player')).toHaveText('阿禾');
  await expect(page.locator('.board-tile')).toHaveCount(30);
  await expect(page.locator('.board-tile[data-position="27"]')).toBeVisible();
  await expect(page.getByTestId('market-card')).toBeVisible();
  await expect(page.getByText('收藏任務', { exact: false })).toBeVisible();
  await expect(page.getByTestId('funds-player-1')).toHaveText('15');
  await expectPageHealthy(page, diagnostics);
});

test('擲骰逐格移動並完成Camera Follow與回全景', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('game.html?testMode=1&scenario=movement');
  await page.evaluate(() => {
    const camera = document.querySelector('[data-testid="board-camera"]')!;
    const values: string[] = [];
    (window as typeof window & { cameraPositions: string[] }).cameraPositions = values;
    new MutationObserver(() => {
      const position = (camera as HTMLElement).dataset.focusedPosition;
      if (position && values.at(-1) !== position) values.push(position);
    }).observe(camera, { attributes: true, attributeFilter: ['data-focused-position'] });
  });
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '選擇一個合法目的地');
  const positions = await page.evaluate(
    () => (window as typeof window & { cameraPositions: string[] }).cameraPositions,
  );
  expect(positions).toEqual(expect.arrayContaining(['24', '25', '26', '0']));
  expect(positions.indexOf('24')).toBeLessThan(positions.indexOf('25'));
  expect(positions.indexOf('25')).toBeLessThan(positions.indexOf('26'));
  expect(positions.indexOf('26')).toBeLessThan(positions.lastIndexOf('0'));
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute('data-position', '0');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-state', 'overview');
  const cameraValues = await page.getByTestId('board-camera').evaluate((element) => ({
    x: Number((element as HTMLElement).dataset.cameraX),
    y: Number((element as HTMLElement).dataset.cameraY),
  }));
  expect(Number.isFinite(cameraValues.x) && Number.isFinite(cameraValues.y)).toBe(true);
  await expectPageHealthy(page, diagnostics);
});

test('產地採購會扣款、加入產品並顯示回合摘要', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=purchase');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '產地採購');
  const before = Number(await page.getByTestId('funds-player-1').textContent());
  await page.locator('[data-action="buy"]:not([disabled])').first().click();
  await expect(page.getByRole('heading', { name: /抵達桃園/ })).toBeVisible();
  expect(Number(await page.getByTestId('funds-player-1').textContent())).toBeLessThan(before);
  await expect(page.getByTestId('product-count-player-1')).toHaveText('1');
});

test('農會顯示原價、農會折扣、市場折扣與最低價', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=farmers');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '農會直售站');
  await expect(page.getByText(/原價/).first()).toBeVisible();
  await expect(page.getByText(/農會優惠 -1/).first()).toBeVisible();
  await expect(page.getByText(/市場優惠 -1/).first()).toBeVisible();
  await expect(page.getByText(/本次 1/)).toBeVisible();
});

test('漁會只提供水產', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=fishers');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '漁會市場');
  const categories = await page
    .locator('.product-choice')
    .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.productCategory));
  expect(categories.length).toBeGreaterThan(0);
  expect(new Set(categories)).toEqual(new Set(['seafood']));
});

test('市場出售套用目前價值並更新資產', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=market');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '出售 0 或 1 項產品');
  const before = Number(await page.getByTestId('funds-player-1').textContent());
  await expect(page.getByText('出售價值', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '出售', exact: true }).click();
  expect(Number(await page.getByTestId('funds-player-1').textContent())).toBeGreaterThan(before);
  await expect(page.getByTestId('product-count-player-1')).toHaveText('0');
});

test('事件格會更換市場卡並顯示事件卡', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=event');
  const before = await page.getByTestId('market-card').textContent();
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, /抵達東北季風/);
  await expect(page.getByText('市場行情更新', { exact: true })).toBeVisible();
  expect(await page.getByTestId('market-card').textContent()).not.toBe(before);
});

test('交通格只列合法離島並維持主棋子位置', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=transport');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '選擇一個合法目的地');
  await page.locator('[data-action="transport"][data-destination-id="penghu-island-stop"]').click();
  await expect(page.getByRole('heading', { name: '澎湖箱網產地' })).toBeVisible();
  await expect(page.getByText('海鱺')).toBeVisible();
  await page.getByRole('button', { name: '略過採購' }).click();
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute('data-position', '13');
});

test('兩名玩家交棒並在兩回合後進入第2輪', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=multiplayer');
  for (const player of ['測試玩家1', '測試玩家2']) {
    await expect(page.getByTestId('current-player')).toHaveText(player);
    await page.getByRole('button', { name: '擲骰子' }).click();
    await waitForAction(page, '產地採購');
    await page.getByRole('button', { name: '略過採購' }).click();
    await page.getByRole('button', { name: '結束回合' }).click();
  }
  await expect(page.getByTestId('round')).toHaveText('第 2 / 12 輪');
  await expect(page.getByTestId('current-player')).toHaveText('測試玩家1');
  await expect(page.getByTestId('player-card-player-1')).toHaveClass(/is-current/);
});

test('收藏進度會由2/3更新為完成', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=collection');
  await expect(page.getByTestId('collection-taiwan-tea')).toContainText('2 / 3');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '產地採購');
  await page.locator('[data-product-id="new-taipei-baozhong-tea"]').click();
  await expect(page.getByTestId('collection-taiwan-tea')).toContainText('完成');
});

test('第12輪真實引擎結算並可重新開始', async ({ page }) => {
  await page.goto('game.html?testMode=1&scenario=game-over');
  await page.getByRole('button', { name: '快速完成 12 輪' }).click();
  await expect(page.getByTestId('rankings')).toBeVisible();
  await expect(page.getByTestId('rankings').getByText('產品價值')).toBeVisible();
  await expect(page.getByTestId('rankings').getByText('收藏加成')).toBeVisible();
  await expect(page.getByTestId('rankings').getByText('資金換分')).toBeVisible();
  await page.getByRole('button', { name: '再玩一次' }).click();
  await expect(page.getByRole('heading', { name: '這趟環島，有幾位採購王？' })).toBeVisible();
});

test('手機390×844可完成一回合並操作規則與收藏', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const diagnostics = observePage(page);
  await page.goto('game.html?testMode=1&scenario=purchase');
  expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  await expect(page.locator('.board-frame')).toBeVisible();
  await page.getByRole('button', { name: '規則' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '關閉遊戲規則' }).click();
  await page.getByText('收藏任務', { exact: false }).click();
  await page.getByText('收藏任務', { exact: false }).click();
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '產地採購');
  const buttonHeight = await page
    .locator('[data-action="buy"]:not([disabled])')
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(buttonHeight).toBeGreaterThanOrEqual(44);
  await page.locator('[data-action="buy"]:not([disabled])').first().click();
  await page.getByRole('button', { name: '結束回合' }).click();
  await expectPageHealthy(page, diagnostics);
});

test('Reduced Motion維持逐格邏輯並停用Camera縮放', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('game.html?testMode=1&scenario=purchase');
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '產地採購');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-scale', '1');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-x', '0');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-y', '0');
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute(
    'data-movement-step',
    '1',
  );
  await expect(page.getByRole('button', { name: /採購/ }).first()).toBeVisible();
});
