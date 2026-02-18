import { Page } from '@playwright/test';
import type { WhiteboardObject, ObjectType } from '../../../src/features/board/types';

/**
 * Generate N WhiteboardObject instances spread across a grid.
 */
export function generateObjects(count: number): WhiteboardObject[] {
  const types: ObjectType[] = ['sticky_note', 'rectangle', 'circle'];
  return Array.from({ length: count }, (_, i) => ({
    id: `perf-obj-${i}`,
    board_id: 'test-board-id',
    object_type: types[i % 3],
    x: (i % 25) * 250,
    y: Math.floor(i / 25) * 250,
    width: 200,
    height: 200,
    rotation: 0,
    properties: {
      text: `Object ${i}`,
      noteColor: '#FEF08A',
      fill: '#FEF08A',
    },
    updated_by: 'test-user',
    updated_at: '2026-02-17T12:00:00.000Z',
    created_at: '2026-02-17T12:00:00.000Z',
    version: 1,
  }));
}

/**
 * Inject a requestAnimationFrame-based FPS counter and measure over a duration.
 * Returns the average FPS.
 */
export async function measureFPS(
  page: Page,
  durationMs: number
): Promise<number> {
  return page.evaluate((duration) => {
    return new Promise<number>((resolve) => {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames++;
        if (performance.now() - start < duration) {
          requestAnimationFrame(tick);
        } else {
          const elapsed = performance.now() - start;
          resolve(frames / (elapsed / 1000));
        }
      }
      requestAnimationFrame(tick);
    });
  }, durationMs);
}

/**
 * Measure how long an async operation takes on the page.
 * Returns elapsed time in milliseconds.
 */
export async function measureOperationTime(
  fn: () => Promise<void>
): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

/**
 * Simulate a pan (drag) gesture on the Konva stage.
 */
export async function simulatePan(
  page: Page,
  deltaX: number,
  deltaY: number
): Promise<void> {
  const canvas = page.locator('.konvajs-content canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // Hold space to activate pan mode, then drag
  await page.keyboard.down('Space');
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Move in small steps for realistic drag
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX + (deltaX * i) / steps,
      startY + (deltaY * i) / steps
    );
  }

  await page.mouse.up();
  await page.keyboard.up('Space');
}

/**
 * Simulate a zoom (wheel) gesture on the Konva stage.
 */
export async function simulateZoom(
  page: Page,
  delta: number
): Promise<void> {
  const canvas = page.locator('.konvajs-content canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  // Use Ctrl+wheel for zoom
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, delta);
  await page.keyboard.up('Control');
  // Allow time for zoom animation
  await page.waitForTimeout(100);
}
