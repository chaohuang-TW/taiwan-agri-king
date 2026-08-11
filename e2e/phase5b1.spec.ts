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

async function expectHealthy(
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

async function openScenario(page: Page, scenario: string): Promise<ReturnType<typeof observePage>> {
  const diagnostics = observePage(page);
  await page.goto(`game.html?testMode=1&scenario=${scenario}`);
  await expect(page.locator('[data-testid="board-camera"]')).toHaveAttribute(
    'data-camera-settled',
    'true',
  );
  return diagnostics;
}

test('Phase 5B-1 desktop token identity uses P/C supplied badges consistently', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-identity');
  await expect(page.locator('.player-token')).toHaveCount(4);
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute(
    'data-identity-label',
    'P1',
  );
  await expect(page.getByTestId('player-token-player-2')).toHaveAttribute(
    'data-identity-label',
    'C1',
  );
  await expect(page.getByTestId('player-token-player-3')).toHaveAttribute(
    'data-identity-label',
    'C2',
  );
  await expect(page.getByTestId('player-token-player-4')).toHaveAttribute(
    'data-identity-label',
    'C3',
  );
  await expect(page.locator('.player-identity-label')).toHaveCount(0);
  await expect(
    page.getByTestId('player-card-player-1').locator('[data-identity-label="P1"]'),
  ).toHaveCount(1);
  await expect(
    page.getByTestId('player-card-player-2').locator('[data-identity-label="C1"]'),
  ).toHaveCount(1);
  for (const playerId of ['player-1', 'player-2', 'player-3', 'player-4']) {
    const badge = page.getByTestId(`player-token-${playerId}`).locator('.player-badge-board');
    const size = await badge.evaluate((element) => ({
      width: Number.parseFloat(getComputedStyle(element).width),
      height: Number.parseFloat(getComputedStyle(element).height),
    }));
    expect(size.width).toBeGreaterThanOrEqual(36);
    expect(size.height).toBeGreaterThanOrEqual(36);
  }
  await page.screenshot({ path: 'qa/phase5b1/desktop-1280-token-identity.png' });
  await expectHealthy(page, diagnostics);
});

test('Phase 5B-1 procurement cards show supplied product samples', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-procurement');
  const productCards = page.locator('.product-choice');
  const grapeCard = productCards.filter({ has: page.getByRole('heading', { name: '葡萄' }) });
  const riceCard = productCards.filter({ has: page.getByRole('heading', { name: '彰化稻米' }) });
  const eggCard = productCards.filter({ has: page.getByRole('heading', { name: '雞蛋' }) });
  await expect(productCards).toHaveCount(3);
  await expect(productCards.locator('[data-product-artwork]')).toHaveCount(2);
  await expect(grapeCard.locator('[data-product-artwork]')).toHaveCount(0);
  await expect(grapeCard.locator('.product-artwork-wrap')).toHaveCount(0);
  await expect(riceCard.locator('[data-product-artwork]')).toHaveCount(1);
  await expect(eggCard.locator('[data-product-artwork]')).toHaveCount(1);
  await expect(page.getByText('未提供圖片')).toHaveCount(0);
  await expect(page.getByText('彰化平原', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'qa/phase5b1/desktop-1280-procurement-cards.png' });
  await expectHealthy(page, diagnostics);
});

test('Phase 5B-1 inventory and atlas show artwork only where supplied', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-inventory');
  await expect(page.locator('.player-inventory [data-product-artwork]')).toHaveCount(6);
  await page.getByRole('button', { name: '圖鑑', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: '農產圖鑑' });
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-product-artwork]')).toHaveCount(6);
  await expect(atlas.locator('.atlas-artwork-wrap')).toHaveCount(6);
  await expect(atlas.locator('.atlas-product-card.no-artwork')).toHaveCount(42);
  await expect(atlas.getByText('未提供圖片')).toHaveCount(0);
  await page.screenshot({ path: 'qa/phase5b1/desktop-1280-inventory-and-atlas.png' });
  await expectHealthy(page, diagnostics);
});

test('Phase 5B-1 mobile view keeps token identity and product artwork legible', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-mobile');
  await expect(page.locator('.player-token')).toHaveCount(4);
  await expect(page.locator('.player-inventory [data-product-artwork]')).toHaveCount(6);
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute(
    'data-identity-label',
    'P1',
  );
  await expect(page.getByTestId('player-token-player-2')).toHaveAttribute(
    'data-identity-label',
    'C1',
  );
  await expect(page.locator('.player-identity-label')).toHaveCount(0);
  for (const playerId of ['player-1', 'player-2', 'player-3', 'player-4']) {
    const badge = page.getByTestId(`player-token-${playerId}`).locator('.player-badge-board');
    const size = await badge.evaluate((element) => ({
      width: Number.parseFloat(getComputedStyle(element).width),
      height: Number.parseFloat(getComputedStyle(element).height),
    }));
    expect(size.width).toBeGreaterThanOrEqual(30);
    expect(size.height).toBeGreaterThanOrEqual(30);
  }
  await expect(page.getByText('未提供圖片')).toHaveCount(0);
  await page.screenshot({ path: 'qa/phase5b1/mobile-390-token-and-products.png' });
  await expectHealthy(page, diagnostics);
});
