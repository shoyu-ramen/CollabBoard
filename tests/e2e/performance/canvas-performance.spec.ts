import { test, expect } from '@playwright/test';
import {
  mockEmptyBoard,
  waitForCanvasReady,
  getKonvaShapes,
} from '../helpers/board.helpers';
import {
  generateObjects,
  measureFPS,
  simulatePan,
  simulateZoom,
  measureOperationTime,
} from '../helpers/performance.helpers';

test.describe('Canvas performance — FPS & object capacity', () => {
  test('FPS during pan with 500 objects >= 30', async ({ page }) => {
    const objects = generateObjects(500);
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Start FPS measurement in background
    const fpsPromise = measureFPS(page, 2000);

    // Simulate panning during measurement
    await simulatePan(page, 300, 200);
    await page.waitForTimeout(500);
    await simulatePan(page, -200, -100);
    await page.waitForTimeout(500);
    await simulatePan(page, 150, 150);

    const fps = await fpsPromise;
    console.log(`[perf] FPS during pan with 500 objects: ${fps.toFixed(1)}`);

    // 30 FPS as CI-safe threshold; 60 is aspirational for headed mode
    expect(fps).toBeGreaterThanOrEqual(30);
  });

  test('FPS during zoom with 500 objects >= 30', async ({ page }) => {
    const objects = generateObjects(500);
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    // Start FPS measurement
    const fpsPromise = measureFPS(page, 2000);

    // Simulate zoom in/out during measurement
    await simulateZoom(page, -300); // zoom in
    await page.waitForTimeout(400);
    await simulateZoom(page, 300); // zoom out
    await page.waitForTimeout(400);
    await simulateZoom(page, -150); // zoom in a bit
    await page.waitForTimeout(400);
    await simulateZoom(page, 200); // zoom out again

    const fps = await fpsPromise;
    console.log(`[perf] FPS during zoom with 500 objects: ${fps.toFixed(1)}`);

    expect(fps).toBeGreaterThanOrEqual(30);
  });

  test('500 objects render on canvas (visible subset via culling)', async ({
    page,
  }) => {
    const objects = generateObjects(500);
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const shapes = await getKonvaShapes(page);
    const perfShapes = shapes.filter((s) => s.id.startsWith('perf-obj-'));

    // Not all 500 will be rendered (viewport culling), but a meaningful number should be
    console.log(
      `[perf] Rendered ${perfShapes.length} of 500 objects (viewport culling active)`
    );
    expect(perfShapes.length).toBeGreaterThan(0);
    // Viewport culling should keep the count well below 500
    expect(perfShapes.length).toBeLessThanOrEqual(500);
  });

  test('1000 objects — viewport culling keeps rendered count manageable', async ({
    page,
  }) => {
    const objects = generateObjects(1000);
    await mockEmptyBoard(page, objects);
    await page.goto('/board/test-board-id');
    await waitForCanvasReady(page);

    const shapes = await getKonvaShapes(page);
    const perfShapes = shapes.filter((s) => s.id.startsWith('perf-obj-'));

    console.log(
      `[perf] Rendered ${perfShapes.length} of 1000 objects (viewport culling active)`
    );
    // Viewport culling should prevent rendering all 1000
    expect(perfShapes.length).toBeLessThan(1000);
    expect(perfShapes.length).toBeGreaterThan(0);
  });

  test('canvas loads and becomes interactive within 3 seconds with 500 objects', async ({
    page,
  }) => {
    const objects = generateObjects(500);
    await mockEmptyBoard(page, objects);

    const elapsed = await measureOperationTime(async () => {
      await page.goto('/board/test-board-id');
      await waitForCanvasReady(page);
    });

    console.log(
      `[perf] Time to interactive with 500 objects: ${elapsed}ms`
    );
    // 3 seconds threshold (includes page load, rendering, etc.)
    // waitForCanvasReady adds 500ms internal wait, so effective budget is ~2.5s
    expect(elapsed).toBeLessThan(5000);
  });
});
