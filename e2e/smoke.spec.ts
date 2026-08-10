import { expect, test } from '@playwright/test';

test('正式首頁可在桌機與手機正確載入', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() === 404) failedAssets.push(response.url());
  });

  await page.goto('');
  if (testInfo.project.name === 'mobile-chromium') {
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  }
  await expect(page).toHaveTitle(/臺灣農產王/);
  await expect(page.getByRole('heading', { level: 1, name: /臺灣農產王/ })).toBeVisible();
  await expect(page.getByText('Phase 4 CPU 開發預覽', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '開始遊戲', exact: true }).first()).toBeVisible();
  await expect(page.getByText('30', { exact: true })).toBeVisible();
  await expect(page.getByText('48', { exact: true })).toBeVisible();
  await expect(page.getByText('20', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '一趟看得懂，也玩得完的環島' })).toBeVisible();
  await expect(page.getByRole('link', { name: '核心引擎測試' })).toBeVisible();
  await expect(page.locator('.hero-board')).toBeVisible();
  await expect(page.locator('.facts article')).toHaveCount(4);
  await expect(page.locator('.play-sequence article')).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
