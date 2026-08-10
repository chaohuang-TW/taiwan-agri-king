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

type CameraSample = {
  position: string;
  stepIndex: number;
  x: number;
  y: number;
  scale: number;
  tokenCenterX: number;
  tokenCenterY: number;
  viewportLeft: number;
  viewportRight: number;
  viewportTop: number;
  viewportBottom: number;
  tokenVisible: boolean;
};

async function waitForCameraSamples(
  page: Page,
  property: 'cameraSamples' | 'cpuCameraSamples',
): Promise<CameraSample[]> {
  await expect
    .poll(
      () =>
        page.evaluate((name) => {
          const expected = ['24:1', '25:2', '26:3', '0:4'];
          const samples = (window as typeof window & Record<string, CameraSample[]>)[name] ?? [];
          return expected.every((key) =>
            samples.some((sample) => `${sample.position}:${sample.stepIndex}` === key),
          );
        }, property),
      { timeout: 5000 },
    )
    .toBe(true);
  return page.evaluate(
    (name) => (window as typeof window & Record<string, CameraSample[]>)[name] ?? [],
    property,
  );
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
  await expect(page.locator('[data-testid^="player-card-player-"]')).toHaveCount(4);
  await expect(page.getByTestId('player-card-player-3')).toContainText('電腦');
  await expectPageHealthy(page, diagnostics);
});

test('擲骰逐格移動、Camera實際跟拍並保持棋子可見', async ({ page }) => {
  const diagnostics = observePage(page);
  await page.goto('game.html?testMode=1&scenario=movement');
  await page.evaluate(() => {
    const camera = document.querySelector<HTMLElement>('[data-testid="board-camera"]')!;
    const token = document.querySelector<HTMLElement>('[data-testid="player-token-player-1"]')!;
    const samples: CameraSample[] = [];
    (window as typeof window & { cameraSamples: CameraSample[] }).cameraSamples = samples;

    const sample = () => {
      const position = camera.dataset.focusedPosition;
      const stepIndex = Number(camera.dataset.cameraStepIndex);
      if (!position || stepIndex < 1) return;
      if (
        samples.some(
          (value) => `${value.position}:${value.stepIndex}` === `${position}:${stepIndex}`,
        )
      )
        return;

      const viewportRect = camera.getBoundingClientRect();
      const tokenRect = token.getBoundingClientRect();
      const tokenCenterX = tokenRect.left + tokenRect.width / 2;
      const tokenCenterY = tokenRect.top + tokenRect.height / 2;
      const tolerance = 2;
      samples.push({
        position,
        stepIndex,
        x: Number(camera.dataset.cameraX),
        y: Number(camera.dataset.cameraY),
        scale: Number(camera.dataset.cameraScale),
        tokenCenterX,
        tokenCenterY,
        viewportLeft: viewportRect.left,
        viewportRight: viewportRect.right,
        viewportTop: viewportRect.top,
        viewportBottom: viewportRect.bottom,
        tokenVisible:
          tokenCenterX >= viewportRect.left - tolerance &&
          tokenCenterX <= viewportRect.right + tolerance &&
          tokenCenterY >= viewportRect.top - tolerance &&
          tokenCenterY <= viewportRect.bottom + tolerance,
      });
    };

    new MutationObserver(() => {
      requestAnimationFrame(() => requestAnimationFrame(sample));
    }).observe(camera, {
      attributes: true,
      attributeFilter: [
        'data-focused-position',
        'data-camera-x',
        'data-camera-y',
        'data-camera-step-index',
      ],
    });
  });
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '選擇一個合法目的地');
  const samples = await waitForCameraSamples(page, 'cameraSamples');
  const movementSamples = [
    ['24', 1],
    ['25', 2],
    ['26', 3],
    ['0', 4],
  ].map(([position, stepIndex]) => {
    const value = samples.find(
      (sample) => sample.position === position && sample.stepIndex === stepIndex,
    );
    expect(value, `缺少 position ${position}、step ${stepIndex} 的Camera sample`).toBeDefined();
    return value!;
  });
  expect(movementSamples.map(({ position }) => position)).toEqual(['24', '25', '26', '0']);
  for (const sample of movementSamples) {
    expect(Number.isFinite(sample.x)).toBe(true);
    expect(Number.isFinite(sample.y)).toBe(true);
    expect(Number.isFinite(sample.scale)).toBe(true);
    expect(sample.scale).toBeGreaterThan(1);
    expect(
      sample.tokenVisible,
      `棋子在 position ${sample.position} 未位於 camera viewport 中：\n` +
        `token=(${sample.tokenCenterX}, ${sample.tokenCenterY})\n` +
        `viewport=(${sample.viewportLeft}, ${sample.viewportTop})-(${sample.viewportRight}, ${sample.viewportBottom})\n` +
        `camera=(${sample.x}, ${sample.y})`,
    ).toBe(true);
  }
  const cameraTransforms = movementSamples.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`);
  expect(new Set(cameraTransforms).size).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('player-token-player-1')).toHaveAttribute('data-position', '0');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-state', 'overview');
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-settled', 'true');
  const cameraValues = await page.getByTestId('board-camera').evaluate((element) => ({
    x: Number((element as HTMLElement).dataset.cameraX),
    y: Number((element as HTMLElement).dataset.cameraY),
    scale: Number((element as HTMLElement).dataset.cameraScale),
  }));
  expect(
    Number.isFinite(cameraValues.x) &&
      Number.isFinite(cameraValues.y) &&
      Number.isFinite(cameraValues.scale),
  ).toBe(true);
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

test.describe('CPU回合情境', () => {
  test('cpu-purchase真正增加產品並扣除採購金', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-purchase');
    const cpu = page.getByTestId('player-card-player-2');
    const beforeFunds = Number(await page.getByTestId('funds-player-2').textContent());
    const beforeProducts = Number(await page.getByTestId('product-count-player-2').textContent());
    await expect(cpu).toHaveAttribute('data-controller', 'cpu');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    expect(Number(await page.getByTestId('funds-player-2').textContent())).toBeLessThan(
      beforeFunds,
    );
    expect(Number(await page.getByTestId('product-count-player-2').textContent())).toBe(
      beforeProducts + 1,
    );
    expect(await cpu.getAttribute('data-product-ids')).not.toBe('');
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-settled', 'true');
    await expectPageHealthy(page, diagnostics);
  });

  test('cpu-skip資金與產品不變並交棒真人', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-skip');
    const cpu = page.getByTestId('player-card-player-2');
    await expect(page.getByTestId('funds-player-2')).toHaveText('0');
    await expect(page.getByTestId('product-count-player-2')).toHaveText('0');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    await expect(page.getByTestId('funds-player-2')).toHaveText('0');
    await expect(page.getByTestId('product-count-player-2')).toHaveText('0');
    await expect(cpu).toHaveAttribute('data-product-ids', '');
    await expectPageHealthy(page, diagnostics);
  });

  test('cpu-sale出售指定產品並增加資金', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-sale');
    const cpu = page.getByTestId('player-card-player-2');
    await expect(cpu).toHaveAttribute('data-product-ids', 'taoyuan-rice');
    const beforeFunds = Number(await page.getByTestId('funds-player-2').textContent());
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    expect(Number(await page.getByTestId('funds-player-2').textContent())).toBeGreaterThan(
      beforeFunds,
    );
    await expect(page.getByTestId('product-count-player-2')).toHaveText('0');
    await expect(cpu).toHaveAttribute('data-product-ids', '');
    await expectPageHealthy(page, diagnostics);
  });

  test('cpu-transport完成離島決策但主棋子留在交通格', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-transport');
    const cpu = page.getByTestId('player-card-player-2');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    await expect(page.locator('#action-panel')).toHaveAttribute(
      'data-temporary-destination-id',
      '',
    );
    await expect(cpu).toHaveAttribute('data-position', '13');
    await expect(page.getByTestId('player-token-player-2')).toHaveAttribute('data-position', '13');
    await expect(page.getByTestId('product-count-player-2')).toHaveText('1');
    await expectPageHealthy(page, diagnostics);
  });

  test('cpu-camera逐格跟拍、抵達並回到overview', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-camera');
    await page.evaluate(() => {
      const camera = document.querySelector<HTMLElement>('[data-testid="board-camera"]')!;
      const token = document.querySelector<HTMLElement>('[data-testid="player-token-player-2"]')!;
      const samples: CameraSample[] = [];
      (window as typeof window & { cpuCameraSamples: CameraSample[] }).cpuCameraSamples = samples;
      const sample = () => {
        const position = camera.dataset.focusedPosition;
        const stepIndex = Number(camera.dataset.cameraStepIndex);
        if (!position || stepIndex < 1) return;
        if (
          samples.some(
            (value) => `${value.position}:${value.stepIndex}` === `${position}:${stepIndex}`,
          )
        )
          return;
        const viewportRect = camera.getBoundingClientRect();
        const tokenRect = token.getBoundingClientRect();
        const tokenCenterX = tokenRect.left + tokenRect.width / 2;
        const tokenCenterY = tokenRect.top + tokenRect.height / 2;
        samples.push({
          position,
          stepIndex,
          x: Number(camera.dataset.cameraX),
          y: Number(camera.dataset.cameraY),
          scale: Number(camera.dataset.cameraScale),
          tokenCenterX,
          tokenCenterY,
          viewportLeft: viewportRect.left,
          viewportRight: viewportRect.right,
          viewportTop: viewportRect.top,
          viewportBottom: viewportRect.bottom,
          tokenVisible:
            tokenCenterX >= viewportRect.left - 2 &&
            tokenCenterX <= viewportRect.right + 2 &&
            tokenCenterY >= viewportRect.top - 2 &&
            tokenCenterY <= viewportRect.bottom + 2,
        });
      };
      new MutationObserver(() =>
        requestAnimationFrame(() => requestAnimationFrame(sample)),
      ).observe(camera, {
        attributes: true,
        attributeFilter: [
          'data-focused-position',
          'data-camera-x',
          'data-camera-y',
          'data-camera-step-index',
        ],
      });
    });
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    const samples = await waitForCameraSamples(page, 'cpuCameraSamples');
    const movementSamples = [
      ['24', 1],
      ['25', 2],
      ['26', 3],
      ['0', 4],
    ].map(([position, stepIndex]) => {
      const value = samples.find(
        (sample) => sample.position === position && sample.stepIndex === stepIndex,
      );
      expect(
        value,
        `CPU缺少 position ${position}、step ${stepIndex} 的Camera sample`,
      ).toBeDefined();
      return value!;
    });
    for (const sample of movementSamples) {
      expect(sample.scale).toBeGreaterThan(1);
      expect(sample.tokenVisible).toBe(true);
    }
    expect(
      new Set(movementSamples.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`)).size,
    ).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-state', 'overview');
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-settled', 'true');
    await expectPageHealthy(page, diagnostics);
  });

  test('CPU回合期間真人控制鎖定，完成後恢復', async ({ page }) => {
    await page.goto('game.html?testMode=1&scenario=cpu-purchase');
    await expect(page.locator('#action-panel')).toHaveAttribute('data-phase', 'awaiting-purchase', {
      timeout: 5000,
    });
    await expect(page.locator('#action-panel [data-action="buy"]').first()).toBeDisabled();
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
  });

  test('1真人加3CPU完整跑完一輪並回到真人P1', async ({ page }) => {
    await page.goto('game.html?testMode=1&scenario=cpu-round');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    await expect(page.getByTestId('round')).toHaveText('第 2 / 12 輪');
    for (const id of ['player-2', 'player-3', 'player-4']) {
      await expect(page.getByTestId(`product-count-${id}`)).toHaveText('1');
    }
  });

  test('4真人不補CPU且可由P1交棒P2', async ({ page }) => {
    await page.goto('game.html');
    await page.locator('input[name="player-count"][value="4"]').check({ force: true });
    await page.getByRole('button', { name: '開始環島' }).click();
    await expect(page.locator('[data-testid^="player-card-player-"]')).toHaveCount(4);
    await expect(page.locator('[data-controller="cpu"]')).toHaveCount(0);
    await page.getByRole('button', { name: '擲骰子' }).click();
    await expect
      .poll(() => page.locator('#action-panel').getAttribute('data-phase'), { timeout: 10000 })
      .toMatch(/^awaiting-(purchase|sale|transport|turn-end)$/);
    const phase = await page.locator('#action-panel').getAttribute('data-phase');
    if (phase === 'awaiting-purchase') await page.getByRole('button', { name: '略過採購' }).click();
    if (phase === 'awaiting-sale') await page.getByRole('button', { name: '略過出售' }).click();
    if (phase === 'awaiting-transport')
      await page.getByRole('button', { name: '略過行程' }).click();
    await expect(page.locator('#action-panel')).toHaveAttribute('data-phase', 'awaiting-turn-end');
    await page.getByRole('button', { name: '結束回合' }).click();
    await expect(page.getByTestId('current-player')).toHaveText('玩家2');
  });

  test('cpu-restart會取消舊CPU timer並留在設定頁', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-restart');
    await page.getByRole('button', { name: '測試重新開始' }).click();
    await expect(page.getByRole('heading', { name: '這趟環島，有幾位採購王？' })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: '這趟環島，有幾位採購王？' })).toBeVisible();
    await expect(page.getByTestId('board-camera')).toHaveCount(0);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.failedAssets).toEqual([]);
  });

  test('cpu-game-over完成最後CPU回合並顯示排名', async ({ page }) => {
    const diagnostics = observePage(page);
    await page.goto('game.html?testMode=1&scenario=cpu-game-over');
    await expect(page.getByTestId('rankings')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('rankings').locator('[role="row"]')).toHaveCount(5);
    await expect(page.getByTestId('rankings')).toContainText('測試電腦');
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.failedAssets).toEqual([]);
  });

  test('Reduced Motion仍保留CPU逐格流程並停用Camera縮放', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('game.html?testMode=1&scenario=cpu-camera');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-scale', '1');
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-x', '0');
    await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-y', '0');
  });

  test('手機390×844可看見CPU標籤、鎖定操作並恢復真人', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('game.html?testMode=1&scenario=cpu-purchase');
    await expect(page.getByTestId('player-card-player-2')).toContainText('電腦');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
