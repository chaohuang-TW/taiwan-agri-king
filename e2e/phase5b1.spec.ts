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
  await expect(page.getByTestId('player-card-player-1')).toContainText('P1');
  await expect(page.getByTestId('player-card-player-2')).toContainText('C1');
  await page.screenshot({ path: 'qa/phase5b1/desktop-1280-token-identity.png' });
  await expectHealthy(page, diagnostics);
});

test('Phase 5B-1 procurement cards show supplied product samples', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-procurement');
  await expect(page.locator('.product-choice')).toHaveCount(3);
  await expect(page.locator('.product-choice [data-product-artwork]')).toHaveCount(2);
  await expect(page.getByText('彰化平原', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'qa/phase5b1/desktop-1280-procurement-cards.png' });
  await expectHealthy(page, diagnostics);
});

test('Phase 5B-1 inventory and atlas expose artwork with text fallback elsewhere', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop QA screenshot');
  const diagnostics = await openScenario(page, 'phase5b1-inventory');
  await expect(page.locator('.player-inventory [data-product-artwork]')).toHaveCount(6);
  await page.getByRole('button', { name: '圖鑑', exact: true }).click();
  const atlas = page.getByRole('dialog', { name: '農產圖鑑' });
  await expect(atlas).toBeVisible();
  await expect(atlas.locator('[data-product-artwork]')).toHaveCount(6);
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
  await page.screenshot({ path: 'qa/phase5b1/mobile-390-token-and-products.png' });
  await expectHealthy(page, diagnostics);
});
