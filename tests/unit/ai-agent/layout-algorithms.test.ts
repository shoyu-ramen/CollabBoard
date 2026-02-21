import { describe, it, expect } from 'vitest';
import {
  computeGridLayout,
  computeClusterLayout,
  computeTypeLayout,
  parseFlowchartSteps,
} from '@/features/ai-agent/services/tool-executor';

function makeItem(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  type = 'sticky_note'
) {
  return { id, x, y, width: w, height: h, object_type: type };
}

describe('computeGridLayout', () => {
  it('returns empty array for empty input', () => {
    expect(computeGridLayout([], 0, 0, 40)).toEqual([]);
  });

  it('places a single item at the anchor', () => {
    const items = [makeItem('a', 500, 500, 200, 200)];
    const result = computeGridLayout(items, 100, 100, 40);
    expect(result).toEqual([{ id: 'a', x: 100, y: 100 }]);
  });

  it('arranges 4 items in a 2x2 grid', () => {
    const items = [
      makeItem('a', 0, 0, 200, 200),
      makeItem('b', 0, 0, 200, 200),
      makeItem('c', 0, 0, 200, 200),
      makeItem('d', 0, 0, 200, 200),
    ];
    const result = computeGridLayout(items, 0, 0, 40);
    expect(result).toHaveLength(4);
    // sqrt(4) = 2 columns
    expect(result[0]).toEqual({ id: 'a', x: 0, y: 0 });
    expect(result[1]).toEqual({ id: 'b', x: 240, y: 0 });
    expect(result[2]).toEqual({ id: 'c', x: 0, y: 240 });
    expect(result[3]).toEqual({ id: 'd', x: 240, y: 240 });
  });

  it('respects spacing parameter', () => {
    const items = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 0, 100, 100),
    ];
    const result = computeGridLayout(items, 0, 0, 20);
    // sqrt(2) = ceil to 2 columns
    expect(result[0]).toEqual({ id: 'a', x: 0, y: 0 });
    expect(result[1]).toEqual({ id: 'b', x: 120, y: 0 });
  });

  it('produces non-overlapping positions', () => {
    const items = Array.from({ length: 9 }, (_, i) =>
      makeItem(`item-${i}`, Math.random() * 1000, Math.random() * 1000, 200, 200)
    );
    const result = computeGridLayout(items, 0, 0, 40);
    // Check no two items share the same position
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const overlap =
          result[i].x < result[j].x + 200 &&
          result[i].x + 200 > result[j].x &&
          result[i].y < result[j].y + 200 &&
          result[i].y + 200 > result[j].y;
        expect(overlap).toBe(false);
      }
    }
  });
});

describe('computeClusterLayout', () => {
  it('returns empty array for empty input', () => {
    expect(computeClusterLayout([], 0, 0, 40)).toEqual([]);
  });

  it('groups nearby items into the same cluster', () => {
    // Two items 50px apart (well within 300px threshold)
    const items = [
      makeItem('a', 100, 100, 200, 200),
      makeItem('b', 150, 150, 200, 200),
    ];
    const result = computeClusterLayout(items, 0, 0, 40);
    expect(result).toHaveLength(2);
    // Both should be placed together (same anchor area)
    const xDiff = Math.abs(result[0].x - result[1].x);
    const yDiff = Math.abs(result[0].y - result[1].y);
    // They should be within one grid cell of each other
    expect(xDiff + yDiff).toBeLessThan(500);
  });

  it('separates distant items into different clusters', () => {
    // Two items 1000px apart (well beyond 300px threshold)
    const items = [
      makeItem('a', 0, 0, 200, 200),
      makeItem('b', 1500, 1500, 200, 200),
    ];
    const result = computeClusterLayout(items, 0, 0, 40);
    expect(result).toHaveLength(2);
    // Different clusters means they should be in different grid areas
    const dist = Math.sqrt(
      (result[0].x - result[1].x) ** 2 + (result[0].y - result[1].y) ** 2
    );
    expect(dist).toBeGreaterThan(0);
  });

  it('produces non-overlapping positions', () => {
    const items = [
      makeItem('a', 0, 0, 200, 200),
      makeItem('b', 50, 50, 200, 200),
      makeItem('c', 1000, 1000, 200, 200),
      makeItem('d', 1050, 1050, 200, 200),
    ];
    const result = computeClusterLayout(items, 0, 0, 40);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const samePos =
          result[i].x === result[j].x && result[i].y === result[j].y;
        expect(samePos).toBe(false);
      }
    }
  });
});

describe('computeTypeLayout', () => {
  it('returns empty array for empty input', () => {
    expect(computeTypeLayout([], 0, 0, 40)).toEqual([]);
  });

  it('groups items by type into vertical sections', () => {
    const items = [
      makeItem('s1', 0, 0, 200, 200, 'sticky_note'),
      makeItem('s2', 0, 0, 200, 200, 'sticky_note'),
      makeItem('r1', 0, 0, 150, 100, 'rectangle'),
    ];
    const result = computeTypeLayout(items, 0, 0, 40);
    expect(result).toHaveLength(3);

    // Sticky notes should share the same X
    const s1Pos = result.find((r) => r.id === 's1')!;
    const s2Pos = result.find((r) => r.id === 's2')!;
    const r1Pos = result.find((r) => r.id === 'r1')!;

    expect(s1Pos.x).toBe(s2Pos.x);
    // Rectangle should be in a different X section
    expect(r1Pos.x).toBeGreaterThan(s1Pos.x);
  });

  it('stacks items vertically within each type section', () => {
    const items = [
      makeItem('a', 0, 0, 200, 200, 'sticky_note'),
      makeItem('b', 0, 0, 200, 200, 'sticky_note'),
      makeItem('c', 0, 0, 200, 200, 'sticky_note'),
    ];
    const result = computeTypeLayout(items, 100, 100, 40);
    // All same X, increasing Y
    expect(result[0].x).toBe(100);
    expect(result[1].x).toBe(100);
    expect(result[2].x).toBe(100);
    expect(result[0].y).toBe(100);
    expect(result[1].y).toBe(340); // 100 + 200 + 40
    expect(result[2].y).toBe(580); // 340 + 200 + 40
  });
});

describe('parseFlowchartSteps', () => {
  it('parses numbered list', () => {
    const input = '1. Login\n2. Validate\n3. Redirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('parses comma-separated list', () => {
    const input = 'Login, Validate, Redirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('parses newline-separated list', () => {
    const input = 'Login\nValidate\nRedirect';
    expect(parseFlowchartSteps(input)).toEqual([
      'Login',
      'Validate',
      'Redirect',
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(parseFlowchartSteps('')).toEqual([]);
  });

  it('returns single-item array for unparseable input', () => {
    expect(parseFlowchartSteps('just one step')).toEqual([
      'just one step',
    ]);
  });
});
