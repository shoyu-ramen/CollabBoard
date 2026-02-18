import { Page } from '@playwright/test';
import type { AIResponseBody } from '../../../src/features/ai-agent/types';
import type { WhiteboardObject } from '../../../src/features/board/types';

/**
 * Mock the Supabase REST calls for an empty board.
 * Intercepts GET (list objects), POST (create), PATCH (update).
 * Optionally pre-loads objects into the response.
 */
export async function mockEmptyBoard(
  page: Page,
  preloadedObjects: WhiteboardObject[] = []
) {
  // Mock the board persistence API (auto-join)
  await page.route('**/api/boards/*/join', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ role: 'editor' }),
    })
  );

  // Mock Supabase REST: GET whiteboard_objects
  await page.route(
    (url) =>
      url.hostname.includes('supabase') &&
      url.pathname.includes('/whiteboard_objects') &&
      !url.pathname.includes('/rpc'),
    (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(preloadedObjects),
        });
      }
      // POST / PATCH / DELETE — accept silently
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }
  );

  // Mock Supabase Realtime WebSocket — just prevent connection errors
  await page.route(
    (url) => url.pathname.includes('/realtime/'),
    (route) => route.abort()
  );
}

/**
 * Mock the /api/ai endpoint to return a deterministic response.
 */
export async function mockAIResponse(
  page: Page,
  response: AIResponseBody
) {
  await page.route('**/api/ai', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  );
}

/**
 * Wait for the Konva canvas to be fully rendered.
 */
export async function waitForCanvasReady(page: Page) {
  await page.waitForSelector('.konvajs-content', { timeout: 15000 });
  await page.waitForSelector('.konvajs-content canvas', { timeout: 15000 });
  // Give Konva a moment to finish initial rendering
  await page.waitForTimeout(500);
}

/**
 * Retrieve shape data from the Konva stage via page.evaluate().
 * Returns an array of simplified shape descriptors.
 */
export async function getKonvaShapes(page: Page) {
  return page.evaluate(() => {
    const stage = (window as unknown as Record<string, unknown>)
      .__KONVA_STAGE__ as {
      getLayers: () => Array<{
        getChildren: () => Array<{
          getClassName: () => string;
          id: () => string;
          x: () => number;
          y: () => number;
          width: () => number;
          height: () => number;
          fill: () => string;
          text?: () => string;
          getAttr: (name: string) => unknown;
          getChildren?: () => Array<{
            getClassName: () => string;
            text?: () => string;
            fill?: () => string;
            getAttr: (name: string) => unknown;
          }>;
        }>;
      }>;
    };

    if (!stage) return [];

    const shapes: Array<{
      className: string;
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      text?: string;
    }> = [];

    const layers = stage.getLayers();
    for (const layer of layers) {
      const children = layer.getChildren();
      for (const child of children) {
        const id = child.id();
        if (!id) continue; // Skip non-object shapes (grid, preview, etc.)

        const className = child.getClassName();
        let text: string | undefined;
        let fill = '';

        try {
          fill = child.fill?.() || '';
        } catch {
          /* no fill */
        }

        // For Groups (sticky notes, frames), look at children for text
        // and the primary fill (skip shadow rects with rgba fills)
        if (className === 'Group' && child.getChildren) {
          const groupChildren = child.getChildren();
          for (const gc of groupChildren) {
            if (gc.getClassName() === 'Text' && gc.text) {
              text = gc.text();
            }
            if (gc.getClassName() === 'Rect' && gc.fill) {
              const gcFill = gc.fill() || '';
              // Prefer non-shadow fills (skip rgba(0,0,0,...) shadows)
              if (gcFill && !gcFill.startsWith('rgba(0,0,0')) {
                fill = gcFill;
              }
            }
          }
        }

        shapes.push({
          className,
          id,
          x: child.x(),
          y: child.y(),
          width: child.width(),
          height: child.height(),
          fill,
          text,
        });
      }
    }

    return shapes;
  });
}

/**
 * Open the AI chat panel and send a message.
 */
export async function openAIChatAndSend(page: Page, message: string) {
  // Click the AI button to open the panel
  const aiButton = page.locator('button[title="Open AI Assistant"]');
  if (await aiButton.isVisible()) {
    await aiButton.click();
  }

  // Wait for the panel to be open
  await page.waitForSelector('input[placeholder="Ask the AI assistant..."]', {
    timeout: 5000,
  });

  // Type and submit
  const input = page.locator('input[placeholder="Ask the AI assistant..."]');
  await input.fill(message);
  await input.press('Enter');

  // Wait for the response (loading indicator disappears)
  await page.waitForFunction(
    () => {
      const dots = document.querySelectorAll('.animate-pulse');
      return dots.length === 0;
    },
    { timeout: 10000 }
  );

  // Allow time for objects to render on canvas
  await page.waitForTimeout(500);
}

/**
 * Get the canvas element locator for screenshot comparisons.
 */
export function getCanvasLocator(page: Page) {
  return page.locator('.konvajs-content');
}
