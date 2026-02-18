import { describe, it, expect } from 'vitest';
import { getUserColor } from '@/features/board/hooks/useBoardRealtime';
import {
  shouldApplyRemoteChange,
  mergeRemoteChange,
} from '@/features/board/services/sync.service';
import { CURSOR_COLORS } from '@/lib/constants';
import type { WhiteboardObject } from '@/features/board/types';

// ---- getUserColor ----

describe('getUserColor', () => {
  it('same input always returns same color', () => {
    const color1 = getUserColor('user-abc');
    const color2 = getUserColor('user-abc');
    expect(color1).toBe(color2);
  });

  it('different inputs return (likely) different colors', () => {
    const color1 = getUserColor('user-abc');
    const color2 = getUserColor('user-xyz');
    // Not guaranteed but highly likely with different strings
    expect(typeof color1).toBe('string');
    expect(typeof color2).toBe('string');
    // At minimum, both should be valid colors from the palette
    expect(CURSOR_COLORS).toContain(color1);
    expect(CURSOR_COLORS).toContain(color2);
  });

  it('returns a value from CURSOR_COLORS array', () => {
    const testIds = ['user-1', 'user-2', 'abc', 'test-id-long-string'];
    for (const id of testIds) {
      expect(CURSOR_COLORS).toContain(getUserColor(id));
    }
  });
});

// ---- shouldApplyRemoteChange ----

describe('shouldApplyRemoteChange', () => {
  it('remote timestamp newer returns true', () => {
    const result = shouldApplyRemoteChange(
      1,
      1,
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:01:00Z'
    );
    expect(result).toBe(true);
  });

  it('remote timestamp older returns false', () => {
    const result = shouldApplyRemoteChange(
      1,
      1,
      '2024-01-01T00:01:00Z',
      '2024-01-01T00:00:00Z'
    );
    expect(result).toBe(false);
  });

  it('same timestamp, higher remote version returns true', () => {
    const result = shouldApplyRemoteChange(
      1,
      2,
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z'
    );
    expect(result).toBe(true);
  });

  it('same timestamp, lower remote version returns false', () => {
    const result = shouldApplyRemoteChange(
      2,
      1,
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z'
    );
    expect(result).toBe(false);
  });

  it('same timestamp, same version returns false (equal, do not apply)', () => {
    const result = shouldApplyRemoteChange(
      1,
      1,
      '2024-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z'
    );
    expect(result).toBe(false);
  });
});

// ---- mergeRemoteChange ----

function makeObj(overrides: Partial<WhiteboardObject> = {}): WhiteboardObject {
  return {
    id: 'obj-1',
    board_id: 'board-1',
    object_type: 'sticky_note',
    x: 100,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    properties: { text: 'Hello' },
    updated_by: 'user-1',
    updated_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('mergeRemoteChange', () => {
  it('remote newer returns remote', () => {
    const local = makeObj({ updated_at: '2024-01-01T00:00:00Z', version: 1 });
    const remote = makeObj({
      updated_at: '2024-01-01T00:01:00Z',
      version: 1,
      x: 999,
    });
    const result = mergeRemoteChange(local, remote);
    expect(result).toBe(remote);
    expect(result.x).toBe(999);
  });

  it('local newer returns local', () => {
    const local = makeObj({
      updated_at: '2024-01-01T00:01:00Z',
      version: 1,
      x: 42,
    });
    const remote = makeObj({ updated_at: '2024-01-01T00:00:00Z', version: 1 });
    const result = mergeRemoteChange(local, remote);
    expect(result).toBe(local);
    expect(result.x).toBe(42);
  });
});
