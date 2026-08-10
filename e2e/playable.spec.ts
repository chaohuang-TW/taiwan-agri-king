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

type DiceObservation = {
  state: string;
  result: string;
  visualFace: string;
  playerId: string;
  width: number;
  height: number;
  left: number;
  top: number;
  animationName: string;
};

type GeometryRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type BoardArtworkGeometry = {
  viewport: GeometryRect;
  artwork: GeometryRect;
  cameraState: string | null;
  cameraSettled: boolean;
};

function observeDiceInDocument(): void {
  const start = (): void => {
    const observations: DiceObservation[] = [];
    const capture = (element: HTMLElement): void => {
      const cube = element.querySelector<HTMLElement>('.dice-cube');
      observations.push({
        state: element.dataset.diceState ?? '',
        result: element.dataset.diceResult ?? '',
        visualFace: element.dataset.diceVisualFace ?? '',
        playerId: element.dataset.dicePlayerId ?? '',
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        left: element.getBoundingClientRect().left,
        top: element.getBoundingClientRect().top,
        animationName: cube ? getComputedStyle(cube).animationName : 'none',
      });
    };
    (window as typeof window & { diceObservations: DiceObservation[] }).diceObservations =
      observations;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.target instanceof HTMLElement &&
          record.target.matches('[data-testid="dice-overlay"]')
        ) {
          capture(record.target);
        }
      }
      const overlay = document.querySelector<HTMLElement>('[data-testid="dice-overlay"]');
      if (overlay) capture(overlay);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        'data-dice-state',
        'data-dice-result',
        'data-dice-visual-face',
        'data-dice-player-id',
      ],
    });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
}

async function prepareDiceObserver(page: Page): Promise<void> {
  await page.addInitScript(observeDiceInDocument);
}

async function getDiceObservations(page: Page): Promise<DiceObservation[]> {
  return page.evaluate(
    () =>
      (window as typeof window & { diceObservations?: DiceObservation[] }).diceObservations ?? [],
  );
}

function observeCameraInDocument(options: { tokenId: string; property: string }): void {
  const { tokenId } = options;
  const property = options.property as 'cameraSamples' | 'cpuCameraSamples';
  const cameraWindow = window as typeof window & {
    cameraObserverReady?: boolean;
    cameraObserverBootstrap?: MutationObserver;
    [key: string]: unknown;
  };
  cameraWindow.cameraObserverReady = false;
  cameraWindow[property] = [];

  let started = false;
  const start = (): void => {
    if (started) return;
    const camera = document.querySelector<HTMLElement>('[data-testid="board-camera"]');
    const token = document.querySelector<HTMLElement>(`[data-testid="${tokenId}"]`);
    if (!camera || !token) return;
    const cameraRect = camera.getBoundingClientRect();
    const tokenRect = token.getBoundingClientRect();
    if (
      cameraRect.width <= 0 ||
      cameraRect.height <= 0 ||
      tokenRect.width <= 0 ||
      tokenRect.height <= 0 ||
      window.innerWidth <= 0 ||
      window.innerHeight <= 0
    )
      return;

    started = true;
    cameraWindow.cameraObserverBootstrap?.disconnect();
    const sampleMap = new Map<string, CameraSample>();
    const publish = (): void => {
      cameraWindow[property] = [...sampleMap.values()].sort(
        (left, right) => left.stepIndex - right.stepIndex,
      );
    };
    const sample = (): void => {
      const currentToken = document.querySelector<HTMLElement>(`[data-testid="${tokenId}"]`);
      const position = camera.dataset.focusedPosition;
      const stepIndex = Number(camera.dataset.cameraStepIndex);
      if (!position || stepIndex < 1 || !currentToken) return;
      const viewportRect = camera.getBoundingClientRect();
      const currentTokenRect = currentToken.getBoundingClientRect();
      const x = Number(camera.dataset.cameraX);
      const y = Number(camera.dataset.cameraY);
      const scale = Number(camera.dataset.cameraScale);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(scale) ||
        viewportRect.width <= 0 ||
        viewportRect.height <= 0 ||
        currentTokenRect.width <= 0 ||
        currentTokenRect.height <= 0
      )
        return;
      const tokenCenterX = currentTokenRect.left + currentTokenRect.width / 2;
      const tokenCenterY = currentTokenRect.top + currentTokenRect.height / 2;
      const value: CameraSample = {
        position,
        stepIndex,
        x,
        y,
        scale,
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
      };
      sampleMap.set(`${position}:${stepIndex}`, value);
      publish();
    };
    const observer = new MutationObserver(() => {
      sample();
      requestAnimationFrame(() => requestAnimationFrame(sample));
    });
    observer.observe(document, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: [
        'data-focused-position',
        'data-camera-x',
        'data-camera-y',
        'data-camera-step-index',
      ],
    });
    sample();
    const sampleFrame = (): void => {
      sample();
      if (started) window.requestAnimationFrame(sampleFrame);
    };
    window.requestAnimationFrame(sampleFrame);
    cameraWindow.cameraObserverReady = true;
  };

  cameraWindow.cameraObserverBootstrap = new MutationObserver(start);
  cameraWindow.cameraObserverBootstrap.observe(document, {
    childList: true,
    subtree: true,
  });
  start();
  const retryUntilReady = (): void => {
    if (started) return;
    start();
    if (!started) window.requestAnimationFrame(retryUntilReady);
  };
  window.requestAnimationFrame(retryUntilReady);
}

async function prepareCameraObserver(
  page: Page,
  tokenId: string,
  property: 'cameraSamples' | 'cpuCameraSamples',
): Promise<void> {
  await page.addInitScript(observeCameraInDocument, { tokenId, property });
}

async function waitForCameraObserverReady(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as typeof window & { cameraObserverReady?: boolean }).cameraObserverReady ===
            true,
        ),
      {
        timeout: 5000,
        message: '等待 Camera observer ready（camera、token、有效 layout、MutationObserver）',
      },
    )
    .toBe(true);
}

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
          const keys = samples.map((sample) => `${sample.position}:${sample.stepIndex}`);
          return expected.every((key) => keys.includes(key))
            ? 'ready'
            : `received=${keys.join(',')}`;
        }, property),
      {
        timeout: 10000,
        message: '等待完整 Camera movement samples：24:1, 25:2, 26:3, 0:4',
      },
    )
    .toBe('ready');
  return page.evaluate(
    (name) => (window as typeof window & Record<string, CameraSample[]>)[name] ?? [],
    property,
  );
}

async function waitForStableBoardArtworkGeometry(page: Page): Promise<BoardArtworkGeometry> {
  return page.evaluate(
    ({ consecutiveSamples, epsilon, timeout, tolerance }) =>
      new Promise<BoardArtworkGeometry>((resolve, reject) => {
        type GeometrySample = BoardArtworkGeometry & {
          valid: boolean;
          contained: boolean;
          containment: {
            left: boolean;
            right: boolean;
            top: boolean;
            bottom: boolean;
          };
        };

        const startedAt = performance.now();
        let stableSamples = 0;
        let previous: GeometrySample | null = null;
        let latest: GeometrySample | null = null;

        const toRect = (rect: DOMRect): GeometryRect => ({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        });
        const finiteRect = (rect: GeometryRect): boolean =>
          Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
        const geometryStable = (left: GeometrySample, right: GeometrySample): boolean => {
          const values = (sample: GeometrySample): number[] => [
            sample.viewport.left,
            sample.viewport.top,
            sample.viewport.width,
            sample.viewport.height,
            sample.artwork.left,
            sample.artwork.top,
            sample.artwork.width,
            sample.artwork.height,
          ];
          return values(left).every(
            (value, index) => Math.abs(value - values(right)[index]!) <= epsilon,
          );
        };
        const sampleGeometry = (): GeometrySample | null => {
          const camera = document.querySelector<HTMLElement>('[data-testid="board-camera"]');
          const viewportElement = document.querySelector<HTMLElement>('.map-camera-viewport');
          const artworkElement = document.querySelector<HTMLImageElement>(
            '[data-testid="board-artwork-image"]',
          );
          if (!camera || !viewportElement || !artworkElement) return null;
          const viewport = toRect(viewportElement.getBoundingClientRect());
          const artwork = toRect(artworkElement.getBoundingClientRect());
          const containment = {
            left: artwork.left >= viewport.left - tolerance,
            right: artwork.right <= viewport.right + tolerance,
            top: artwork.top >= viewport.top - tolerance,
            bottom: artwork.bottom <= viewport.bottom + tolerance,
          };
          const cameraSettled = camera.dataset.cameraSettled === 'true';
          return {
            viewport,
            artwork,
            cameraState: camera.dataset.cameraState ?? null,
            cameraSettled,
            valid: finiteRect(viewport) && finiteRect(artwork) && cameraSettled,
            contained: Object.values(containment).every(Boolean),
            containment,
          };
        };
        const diagnostic = (): string => {
          if (!latest) return '最後 sample：camera、viewport 或 artwork 尚未同時存在。';
          return [
            'Board artwork geometry did not stabilize.',
            `viewport=${JSON.stringify(latest.viewport)}`,
            `artwork=${JSON.stringify(latest.artwork)}`,
            `cameraState=${latest.cameraState}`,
            `cameraSettled=${latest.cameraSettled}`,
            `valid=${latest.valid}`,
            `contained=${latest.contained}`,
            `containment=${JSON.stringify(latest.containment)}`,
            `consecutiveStableSamples=${stableSamples}/${consecutiveSamples}`,
          ].join('\n');
        };
        const nextFrame = (): void => {
          latest = sampleGeometry();
          if (latest?.valid && latest.contained) {
            stableSamples = previous && geometryStable(previous, latest) ? stableSamples + 1 : 1;
          } else {
            stableSamples = 0;
          }
          if (latest && stableSamples >= consecutiveSamples) {
            resolve({
              viewport: latest.viewport,
              artwork: latest.artwork,
              cameraState: latest.cameraState,
              cameraSettled: latest.cameraSettled,
            });
            return;
          }
          if (performance.now() - startedAt >= timeout) {
            reject(new Error(diagnostic()));
            return;
          }
          previous = latest;
          requestAnimationFrame(nextFrame);
        };

        requestAnimationFrame(nextFrame);
      }),
    { consecutiveSamples: 3, epsilon: 0.5, timeout: 3000, tolerance: 5 },
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
  await expect(page.getByTestId('board-camera')).toHaveAttribute('data-camera-settled', 'true');
  await expect(page.locator('.taiwan-board-art')).toHaveCount(0);
  await expect(page.locator('.offshore-panel')).toHaveCount(0);
  const boardArtworkImage = page.getByTestId('board-artwork-image');
  await expect(boardArtworkImage).toBeVisible();
  await expect
    .poll(
      () =>
        boardArtworkImage.evaluate((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        }),
      { timeout: 3000 },
    )
    .toBe(true);
  await expect(page.locator('.board-tile.tile-offshore')).toHaveCount(3);
  const defaultTileAppearance = await page
    .locator('.board-tile[data-position="10"]')
    .evaluate((tile) => {
      const element = tile as HTMLElement;
      const icon = element.querySelector<HTMLElement>('.tile-icon-wrap');
      const copy = element.querySelector<HTMLElement>('.tile-copy');
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        iconOpacity: icon ? getComputedStyle(icon).opacity : '',
        iconVisibility: icon ? getComputedStyle(icon).visibility : '',
        copyOpacity: copy ? getComputedStyle(copy).opacity : '',
        copyVisibility: copy ? getComputedStyle(copy).visibility : '',
      };
    });
  expect(defaultTileAppearance.background).toBe('rgba(0, 0, 0, 0)');
  expect(defaultTileAppearance.border).toBe('rgba(0, 0, 0, 0)');
  expect(defaultTileAppearance.iconOpacity).toBe('0');
  expect(defaultTileAppearance.iconVisibility).toBe('hidden');
  expect(defaultTileAppearance.copyOpacity).toBe('0');
  expect(defaultTileAppearance.copyVisibility).toBe('hidden');
  const interactionTile = page.locator('.board-tile[data-position="10"]');
  await interactionTile.hover();
  await expect(interactionTile.locator('.tile-icon-wrap')).toHaveCSS('visibility', 'visible');
  await expect(interactionTile.locator('.tile-copy')).toHaveCSS('visibility', 'visible');
  await page.mouse.move(2, 2);
  await expect(interactionTile.locator('.tile-copy')).toHaveCSS('visibility', 'hidden');
  await interactionTile.evaluate((element) => element.focus({ preventScroll: true }));
  await expect(interactionTile).toBeFocused();
  await expect(interactionTile.locator('.tile-copy')).toHaveCSS('visibility', 'visible');
  await interactionTile.evaluate((element) => element.blur());
  await expect(interactionTile).not.toBeFocused();
  await expect(page.locator('.play-layout[data-layout="production"]')).toBeVisible();
  await expect(page.getByTestId('players-hud')).toBeVisible();
  await expect(page.getByTestId('market-hud')).toBeVisible();
  await expect(page.getByTestId('action-dock')).toBeVisible();
  const stableBoardGeometry = await waitForStableBoardArtworkGeometry(page);
  expect(stableBoardGeometry.cameraSettled).toBe(true);
  const boardGeometry = await page.evaluate(() => {
    const viewport = document.querySelector('.map-camera-viewport')?.getBoundingClientRect();
    const artworkImage = document
      .querySelector<HTMLImageElement>('[data-testid="board-artwork-image"]')
      ?.getBoundingClientRect();
    const positions = Array.from(document.querySelectorAll<HTMLElement>('.board-tile')).map(
      (tile) => Number(tile.dataset.position),
    );
    const centers = Array.from(document.querySelectorAll<HTMLElement>('.board-tile')).map(
      (tile) => {
        const rect = tile.getBoundingClientRect();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const;
      },
    );
    let minimumDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < centers.length; index += 1) {
      for (let next = index + 1; next < centers.length; next += 1) {
        minimumDistance = Math.min(
          minimumDistance,
          Math.hypot(
            centers[index]![0] - centers[next]![0],
            centers[index]![1] - centers[next]![1],
          ),
        );
      }
    }
    const token = document.querySelector<HTMLElement>('[data-testid="player-token-player-1"]');
    const tokenRect = token?.getBoundingClientRect();
    const offshoreCenters = Array.from(
      document.querySelectorAll<HTMLElement>('.board-tile.tile-offshore'),
    ).map((tile) => {
      const rect = tile.getBoundingClientRect();
      return [rect.left + rect.width / 2, rect.top + rect.height / 2] as const;
    });
    return {
      positions,
      minimumDistance,
      tokenVisible: Boolean(tokenRect && tokenRect.width > 0 && tokenRect.height > 0),
      artworkImageInsideViewport:
        Boolean(viewport && artworkImage) &&
        artworkImage!.left >= viewport!.left - 5 &&
        artworkImage!.right <= viewport!.right + 5 &&
        artworkImage!.top >= viewport!.top - 5 &&
        artworkImage!.bottom <= viewport!.bottom + 5,
      offshoreAligned:
        Boolean(artworkImage) &&
        offshoreCenters.length === 3 &&
        offshoreCenters.every(
          ([x, y]) =>
            x >= artworkImage!.left &&
            x <= artworkImage!.left + artworkImage!.width * 0.3 &&
            y >= artworkImage!.top + artworkImage!.height * 0.35 &&
            y <= artworkImage!.bottom,
        ),
    };
  });
  expect(boardGeometry.positions).toEqual(Array.from({ length: 30 }, (_, position) => position));
  expect(boardGeometry.minimumDistance).toBeGreaterThan(14);
  expect(boardGeometry.tokenVisible).toBe(true);
  expect(boardGeometry.artworkImageInsideViewport).toBe(true);
  expect(boardGeometry.offshoreAligned).toBe(true);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth >= 900) {
    const shellGeometry = await page.evaluate(() => {
      const rect = (selector: string) =>
        document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      const stage = rect('.game-stage');
      const players = rect('.players-rail');
      const board = rect('.board-frame');
      const insights = rect('.insight-rail');
      const dock = rect('.action-panel');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        boardWidth: board?.width ?? 0,
        boardRatio: stage && board ? board.width / stage.width : 0,
        playersFloatOverBoard: Boolean(players && board && players.left >= board.left),
        marketFloatsOverBoard: Boolean(insights && board && insights.right <= board.right),
        playersHeightRatio: stage && players ? players.height / stage.height : 1,
        marketHeightRatio: stage && insights ? insights.height / stage.height : 1,
        dockHeight: dock?.height ?? 0,
        dockCentered: Boolean(
          stage &&
          dock &&
          Math.abs(dock.left + dock.width / 2 - (stage.left + stage.width / 2)) < 2,
        ),
      };
    });
    expect(shellGeometry.overflow).toBe(0);
    expect(shellGeometry.boardWidth).toBeGreaterThan(650);
    expect(shellGeometry.boardRatio).toBeGreaterThanOrEqual(0.65);
    expect(shellGeometry.playersFloatOverBoard).toBe(true);
    expect(shellGeometry.marketFloatsOverBoard).toBe(true);
    expect(shellGeometry.playersHeightRatio).toBeLessThan(0.65);
    expect(shellGeometry.marketHeightRatio).toBeLessThan(0.65);
    expect(shellGeometry.dockHeight).toBeLessThanOrEqual(120);
    expect(shellGeometry.dockCentered).toBe(true);
  }
  if (viewportWidth >= 900) {
    await expect(page.getByTestId('market-card')).toBeVisible();
  } else {
    await expect(page.getByTestId('market-hud')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('market-card')).not.toBeVisible();
  }
  await expect(page.getByText('收藏任務', { exact: false })).toBeVisible();
  await expect(page.getByTestId('funds-player-1')).toHaveText('15');
  await expect(page.locator('[data-testid^="player-card-player-"]')).toHaveCount(4);
  await expect(page.getByTestId('player-card-player-3')).toContainText('電腦');
  await expect(page.locator('.player-status.is-current')).toHaveCount(1);
  await expect(page.getByTestId('player-card-player-1')).toHaveClass(/is-current/);
  await expect(page.locator('.controller-label')).toHaveCount(4);
  await expect(page.locator('.action-panel')).toBeVisible();
  await expect(page.locator('.action-panel .primary-action')).toBeVisible();
  await expect(page.getByTestId('collections-drawer')).not.toHaveAttribute('open', '');
  await expect(page.locator('.collections-list')).not.toBeVisible();
  const boardBeforeDrawer = await page.locator('.board-frame').boundingBox();
  await page.getByText('收藏任務', { exact: false }).click();
  await expect(page.locator('.collections-list')).toBeVisible();
  const boardAfterDrawer = await page.locator('.board-frame').boundingBox();
  expect(boardAfterDrawer).toEqual(boardBeforeDrawer);
  await expectPageHealthy(page, diagnostics);
});

test('擲骰逐格移動、Camera實際跟拍並保持棋子可見', async ({ page }) => {
  const diagnostics = observePage(page);
  await prepareDiceObserver(page);
  await prepareCameraObserver(page, 'player-token-player-1', 'cameraSamples');
  await page.goto('game.html?testMode=1&scenario=movement');
  await waitForCameraObserverReady(page);
  await page.getByRole('button', { name: '擲骰子' }).click();
  await waitForAction(page, '選擇一個合法目的地');
  const diceObservations = await getDiceObservations(page);
  expect(diceObservations.map(({ state }) => state)).toEqual(
    expect.arrayContaining(['entering', 'rolling', 'settling', 'result', 'exiting', 'hidden']),
  );
  expect(
    diceObservations.some(({ result, visualFace }) => result === '4' && visualFace === '4'),
  ).toBe(true);
  expect(diceObservations.some(({ playerId }) => playerId === 'player-1')).toBe(true);
  for (const observation of diceObservations) {
    if (observation.state === 'hidden') continue;
    expect(observation.width).toBeGreaterThanOrEqual(0);
    expect(observation.height).toBeGreaterThanOrEqual(0);
    expect(observation.left).toBeGreaterThanOrEqual(0);
    expect(observation.top).toBeGreaterThanOrEqual(0);
  }
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
  await expect(page.locator('.taiwan-board-art')).toHaveCount(0);
  await expect(page.locator('.offshore-panel')).toHaveCount(0);
  const mobileArtworkImage = page.getByTestId('board-artwork-image');
  await expect(mobileArtworkImage).toBeVisible();
  await expect
    .poll(
      () =>
        mobileArtworkImage.evaluate((element) => {
          const image = element as HTMLImageElement;
          return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        }),
      { timeout: 3000 },
    )
    .toBe(true);
  await expect(page.locator('.board-tile.tile-offshore')).toHaveCount(3);
  await expect(page.locator('.board-tile[data-position="27"]')).toBeVisible();
  await expect(page.locator('.board-tile[data-position="28"]')).toBeVisible();
  await expect(page.locator('.board-tile[data-position="29"]')).toBeVisible();
  await expect(page.locator('.play-layout[data-layout="production"]')).toBeVisible();
  await expect(page.getByTestId('action-dock')).toBeVisible();
  await expect(page.getByTestId('market-hud')).not.toHaveAttribute('open', '');
  await expect(page.getByTestId('market-card')).not.toBeVisible();
  await page.getByTestId('market-hud').locator('summary').click();
  await expect(page.getByTestId('market-card')).toBeVisible();
  await page.getByTestId('market-hud').locator('summary').click();
  await expect(page.getByTestId('market-card')).not.toBeVisible();
  await expect(page.locator('.collections-list')).not.toBeVisible();
  await page.getByRole('button', { name: '規則' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '關閉遊戲規則' }).click();
  await page.getByText('收藏任務', { exact: false }).click();
  await expect(page.locator('.collections-list')).toBeVisible();
  await page.getByText('收藏任務', { exact: false }).click();
  await expect(page.locator('.collections-list')).not.toBeVisible();
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
    await prepareDiceObserver(page);
    await prepareCameraObserver(page, 'player-token-player-2', 'cpuCameraSamples');
    await page.goto('game.html?testMode=1&scenario=cpu-camera');
    await waitForCameraObserverReady(page);
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    const diceObservations = await getDiceObservations(page);
    expect(
      diceObservations.some(
        ({ playerId, result, visualFace }) =>
          playerId === 'player-2' && result === '4' && visualFace === '4',
      ),
    ).toBe(true);
    expect(
      diceObservations.some(({ playerId, state }) => playerId === 'player-2' && state === 'hidden'),
    ).toBe(true);
    const viewport = page.viewportSize();
    for (const observation of diceObservations.filter(({ state }) => state !== 'hidden')) {
      expect(observation.width).toBeCloseTo(viewport?.width ?? 0, 0);
      expect(observation.height).toBeCloseTo(viewport?.height ?? 0, 0);
      expect(observation.left).toBeGreaterThanOrEqual(0);
      expect(observation.top).toBeGreaterThanOrEqual(0);
    }
    await expectPageHealthy(page, diagnostics);
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
    await prepareDiceObserver(page);
    await page.goto('game.html?testMode=1&scenario=cpu-purchase');
    await expect(page.getByTestId('dice-overlay')).toHaveAttribute(
      'data-dice-state',
      /^(entering|rolling|settling|result)$/,
      { timeout: 10000 },
    );
    await expect(page.locator('#action-panel button').first()).toBeDisabled();
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 10000 });
  });

  test('1真人加3CPU完整跑完一輪並回到真人P1', async ({ page }) => {
    await prepareDiceObserver(page);
    await page.goto('game.html?testMode=1&scenario=cpu-round');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    await expect(page.getByTestId('round')).toHaveText('第 2 / 12 輪');
    const dicePlayers = new Set(
      (await getDiceObservations(page))
        .filter(({ state }) => state === 'result')
        .map(({ playerId }) => playerId),
    );
    expect([...dicePlayers]).toEqual(expect.arrayContaining(['player-2', 'player-3', 'player-4']));
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
    await expect(page.getByTestId('dice-overlay')).toHaveAttribute(
      'data-dice-state',
      /^(rolling|settling)$/,
      { timeout: 5000 },
    );
    await page
      .getByRole('button', { name: '測試重新開始' })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByRole('heading', { name: '這趟環島，有幾位採購王？' })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: '這趟環島，有幾位採購王？' })).toBeVisible();
    await expect(page.getByTestId('board-camera')).toHaveCount(0);
    await expect(page.getByTestId('dice-overlay')).toHaveCount(0);
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
    await prepareDiceObserver(page);
    await page.goto('game.html?testMode=1&scenario=cpu-camera');
    await expect(page.getByTestId('current-player')).toHaveText('測試真人', { timeout: 5000 });
    const diceObservations = await getDiceObservations(page);
    expect(
      diceObservations.some(
        ({ state, result, visualFace }) =>
          state === 'result' && result === '4' && visualFace === '4',
      ),
    ).toBe(true);
    expect(
      diceObservations.some(
        ({ state, animationName }) => state === 'rolling' && animationName === 'none',
      ),
    ).toBe(true);
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
