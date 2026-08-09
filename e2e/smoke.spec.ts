import { expect, test } from '@playwright/test';

test('資料預覽首頁可在桌機與手機正確載入', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedAssets: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() === 404) failedAssets.push(response.url());
  });

  await page.goto('');

  await expect(page).toHaveTitle(/臺灣農產王/);
  await expect(page.getByRole('heading', { level: 1, name: /臺灣農產王/ })).toBeVisible();
  await expect(page.getByText('開發中', { exact: true })).toBeVisible();
  await expect(page.getByText('30', { exact: true })).toBeVisible();
  await expect(page.getByText('48', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('20', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true }).first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(consoleErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
