import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock uuid ---
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// --- Mock Supabase service client ---
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEqEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdateEq = vi.fn().mockReturnValue({ eq: mockUpdateEqEq });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
const mockSelectSingleEqEq = vi.fn().mockResolvedValue({
  data: { properties: { text: 'old text' }, object_type: 'sticky_note' },
  error: null,
});
const mockSelectSingleEq = vi.fn().mockReturnValue({
  eq: mockSelectSingleEqEq,
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
});
const mockSelectOrderEq = vi.fn().mockReturnValue({
  eq: mockSelectSingleEq,
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: mockSelectOrderEq,
});
const mockDeleteEqEq = vi.fn().mockResolvedValue({ error: null });
const mockDeleteEq = vi.fn().mockReturnValue({ eq: mockDeleteEqEq });
const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    delete: mockDelete,
  }),
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => mockSupabase),
}));

import { executeTool } from '@/features/ai-agent/services/tool-executor';
import {
  DEFAULT_STICKY_COLORS,
  DEFAULT_SHAPE_WIDTH,
  DEFAULT_SHAPE_HEIGHT,
  DEFAULT_SHAPE_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_FRAME_WIDTH,
  DEFAULT_FRAME_HEIGHT,
  DEFAULT_LINE_COLOR,
  DEFAULT_LINE_WIDTH,
} from '@/lib/constants';

const BOARD_ID = 'board-123';
const USER_ID = 'user-456';

describe('executeTool integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock implementations after clearAllMocks
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });
    mockUpdateEq.mockReturnValue({ eq: mockUpdateEqEq });
    mockUpdateEqEq.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({ eq: mockSelectOrderEq });
    mockSelectOrderEq.mockReturnValue({
      eq: mockSelectSingleEq,
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    mockSelectSingleEq.mockReturnValue({
      eq: mockSelectSingleEqEq,
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    mockSelectSingleEqEq.mockResolvedValue({
      data: { properties: { text: 'old text' }, object_type: 'sticky_note' },
      error: null,
    });
    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      delete: mockDelete,
    });
  });

  // ── createStickyNote ──────────────────────────────────────────────

  describe('createStickyNote', () => {
    it('creates a sticky note and returns result with objectId', async () => {
      const result = await executeTool(
        'createStickyNote',
        { text: 'Hello', x: 200, y: 300, color: '#BBF7D0' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Created sticky note');
      expect(result.result).toContain('Hello');
      expect(result.objectId).toBe('test-uuid-1234');
      expect(result.toolName).toBe('createStickyNote');
    });

    it('sanitizes HTML tags from text', async () => {
      const result = await executeTool(
        'createStickyNote',
        { text: '<b>Bold</b> text' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Bold text');
      expect(result.result).not.toContain('<b>');
    });

    it('uses default position (100,100) when not specified', async () => {
      const result = await executeTool(
        'createStickyNote',
        { text: 'No position' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('(100, 100)');
    });

    it('uses default color when not specified', async () => {
      await executeTool(
        'createStickyNote',
        { text: 'Default color' },
        BOARD_ID,
        USER_ID
      );

      // The insert call should include the default color
      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.properties.noteColor).toBe(DEFAULT_STICKY_COLORS[0]);
      expect(insertArg.properties.fill).toBe(DEFAULT_STICKY_COLORS[0]);
    });
  });

  // ── createShape ───────────────────────────────────────────────────

  describe('createShape', () => {
    it('creates a rectangle with correct JSONB properties', async () => {
      const result = await executeTool(
        'createShape',
        { type: 'rectangle', x: 50, y: 60 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Created rectangle');
      expect(result.objectId).toBe('test-uuid-1234');

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.properties.fill).toBe(DEFAULT_SHAPE_COLOR);
      expect(insertArg.properties.stroke).toBe('#000000');
      expect(insertArg.properties.strokeWidth).toBe(DEFAULT_STROKE_WIDTH);
      expect(insertArg.object_type).toBe('rectangle');
      expect(insertArg.width).toBe(DEFAULT_SHAPE_WIDTH);
      expect(insertArg.height).toBe(DEFAULT_SHAPE_HEIGHT);
    });

    it('creates a circle with correct properties', async () => {
      const result = await executeTool(
        'createShape',
        { type: 'circle', x: 100, y: 200, color: '#FF0000' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Created circle');
      expect(result.objectId).toBe('test-uuid-1234');

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.properties.fill).toBe('#FF0000');
      expect(insertArg.properties.stroke).toBe('#000000');
      expect(insertArg.properties.strokeWidth).toBe(DEFAULT_STROKE_WIDTH);
      expect(insertArg.object_type).toBe('circle');
    });

    it('creates a line with points array, stroke, and strokeWidth', async () => {
      const result = await executeTool(
        'createShape',
        { type: 'line', x: 10, y: 20, width: 300, height: 0 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Created line');
      expect(result.objectId).toBe('test-uuid-1234');

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.properties.points).toEqual([0, 0, 300, 0]);
      expect(insertArg.properties.stroke).toBe(DEFAULT_LINE_COLOR);
      expect(insertArg.properties.strokeWidth).toBe(DEFAULT_LINE_WIDTH);
      expect(insertArg.object_type).toBe('line');
    });

    it('returns error for invalid shape type', async () => {
      const result = await executeTool(
        'createShape',
        { type: 'hexagon' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Invalid shape type: hexagon');
      expect(result.objectId).toBeUndefined();
    });
  });

  // ── createFrame ───────────────────────────────────────────────────

  describe('createFrame', () => {
    it('creates a frame with title and dimensions', async () => {
      const result = await executeTool(
        'createFrame',
        { title: 'Sprint Board', x: 0, y: 0, width: 800, height: 600 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Created frame');
      expect(result.result).toContain('Sprint Board');
      expect(result.objectId).toBe('test-uuid-1234');

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.object_type).toBe('frame');
      expect(insertArg.properties.title).toBe('Sprint Board');
      expect(insertArg.width).toBe(800);
      expect(insertArg.height).toBe(600);
    });

    it('uses default dimensions when not provided', async () => {
      await executeTool(
        'createFrame',
        { title: 'Default Size' },
        BOARD_ID,
        USER_ID
      );

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.width).toBe(DEFAULT_FRAME_WIDTH);
      expect(insertArg.height).toBe(DEFAULT_FRAME_HEIGHT);
    });
  });

  // ── moveObject ────────────────────────────────────────────────────

  describe('moveObject', () => {
    it('updates x and y and returns success message', async () => {
      const result = await executeTool(
        'moveObject',
        { objectId: 'obj-1', x: 500, y: 600 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Moved object obj-1 to (500, 600)');
      expect(result.objectId).toBe('obj-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ x: 500, y: 600, updated_by: USER_ID })
      );
    });

    it('returns error message on Supabase error', async () => {
      mockUpdateEqEq.mockResolvedValueOnce({
        error: { message: 'DB write failed' },
      });

      const result = await executeTool(
        'moveObject',
        { objectId: 'obj-1', x: 500, y: 600 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Error moving object');
      expect(result.result).toContain('DB write failed');
    });
  });

  // ── resizeObject ──────────────────────────────────────────────────

  describe('resizeObject', () => {
    it('updates width and height and returns success message', async () => {
      const result = await executeTool(
        'resizeObject',
        { objectId: 'obj-2', width: 400, height: 300 },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Resized object obj-2 to 400x300');
      expect(result.objectId).toBe('obj-2');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 400,
          height: 300,
          updated_by: USER_ID,
        })
      );
    });
  });

  // ── updateText ────────────────────────────────────────────────────

  describe('updateText', () => {
    it('fetches existing properties, merges new text, returns success', async () => {
      // The select → eq → eq → single chain for fetching existing object
      const mockSingle = vi.fn().mockResolvedValue({
        data: { properties: { text: 'old', noteColor: '#FEF08A' } },
        error: null,
      });
      const mockInnerEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOuterEq = vi.fn().mockReturnValue({ eq: mockInnerEq });
      const mockSelectChain = vi.fn().mockReturnValue({ eq: mockOuterEq });

      // For the update call following the select
      const mockUpdateInnerEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateOuterEq = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateInnerEq });
      const mockUpdateChain = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateOuterEq });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call in executeTool (the top-level createServiceClient)
          // is the same supabase object used for both select and update
          return {
            insert: mockInsert,
            update: mockUpdateChain,
            select: mockSelectChain,
            delete: mockDelete,
          };
        }
        // Second call from insertObject's createServiceClient
        return {
          insert: mockInsert,
          update: mockUpdateChain,
          select: mockSelectChain,
          delete: mockDelete,
        };
      });

      const result = await executeTool(
        'updateText',
        { objectId: 'obj-3', newText: 'updated text' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Updated text of object obj-3');
      expect(result.result).toContain('updated text');
      expect(result.objectId).toBe('obj-3');
    });

    it('returns error when object is not found', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const mockInnerEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOuterEq = vi.fn().mockReturnValue({ eq: mockInnerEq });
      const mockSelectChain = vi.fn().mockReturnValue({ eq: mockOuterEq });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelectChain,
        delete: mockDelete,
      });

      const result = await executeTool(
        'updateText',
        { objectId: 'nonexistent', newText: 'text' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Error: object nonexistent not found');
      expect(result.objectId).toBeUndefined();
    });
  });

  // ── changeColor ───────────────────────────────────────────────────

  describe('changeColor', () => {
    it('updates fill color for a shape', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          properties: { fill: '#000000', stroke: '#111' },
          object_type: 'rectangle',
        },
        error: null,
      });
      const mockInnerEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOuterEq = vi.fn().mockReturnValue({ eq: mockInnerEq });
      const mockSelectChain = vi.fn().mockReturnValue({ eq: mockOuterEq });

      const mockUpdateInnerEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateOuterEq = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateInnerEq });
      const mockUpdateChain = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateOuterEq });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdateChain,
        select: mockSelectChain,
        delete: mockDelete,
      });

      const result = await executeTool(
        'changeColor',
        { objectId: 'obj-4', color: '#FF5733' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Changed color of object obj-4');
      expect(result.result).toContain('#FF5733');
      expect(result.objectId).toBe('obj-4');

      // Verify the update was called with fill color
      const updateArg = mockUpdateChain.mock.calls[0][0];
      expect(updateArg.properties.fill).toBe('#FF5733');
      // rectangle should NOT have noteColor
      expect(updateArg.properties.noteColor).toBeUndefined();
    });

    it('also updates noteColor for sticky_note type', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          properties: { fill: '#FEF08A', noteColor: '#FEF08A', text: 'hi' },
          object_type: 'sticky_note',
        },
        error: null,
      });
      const mockInnerEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOuterEq = vi.fn().mockReturnValue({ eq: mockInnerEq });
      const mockSelectChain = vi.fn().mockReturnValue({ eq: mockOuterEq });

      const mockUpdateInnerEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdateOuterEq = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateInnerEq });
      const mockUpdateChain = vi
        .fn()
        .mockReturnValue({ eq: mockUpdateOuterEq });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdateChain,
        select: mockSelectChain,
        delete: mockDelete,
      });

      const result = await executeTool(
        'changeColor',
        { objectId: 'sticky-1', color: '#BBF7D0' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Changed color of object sticky-1');

      const updateArg = mockUpdateChain.mock.calls[0][0];
      expect(updateArg.properties.fill).toBe('#BBF7D0');
      expect(updateArg.properties.noteColor).toBe('#BBF7D0');
    });

    it('returns error when object is not found', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      const mockInnerEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockOuterEq = vi.fn().mockReturnValue({ eq: mockInnerEq });
      const mockSelectChain = vi.fn().mockReturnValue({ eq: mockOuterEq });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelectChain,
        delete: mockDelete,
      });

      const result = await executeTool(
        'changeColor',
        { objectId: 'missing', color: '#000' },
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Error: object missing not found');
      expect(result.objectId).toBeUndefined();
    });
  });

  // ── getBoardState ─────────────────────────────────────────────────

  describe('getBoardState', () => {
    it('returns JSON summary of all objects', async () => {
      const boardObjects = [
        {
          id: 'obj-a',
          object_type: 'sticky_note',
          x: 100,
          y: 200,
          width: 200,
          height: 200,
          properties: { text: 'Note A', fill: '#FEF08A' },
        },
        {
          id: 'obj-b',
          object_type: 'rectangle',
          x: 400,
          y: 100,
          width: 150,
          height: 100,
          properties: { fill: '#3B82F6' },
        },
      ];

      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: boardObjects, error: null });
      const mockEqBoard = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelectBoard = vi
        .fn()
        .mockReturnValue({ eq: mockEqBoard });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelectBoard,
        delete: mockDelete,
      });

      const result = await executeTool(
        'getBoardState',
        {},
        BOARD_ID,
        USER_ID
      );

      const parsed = JSON.parse(result.result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe('obj-a');
      expect(parsed[0].type).toBe('sticky_note');
      expect(parsed[0].text).toBe('Note A');
      expect(parsed[1].id).toBe('obj-b');
      expect(parsed[1].color).toBe('#3B82F6');
    });

    it('returns empty array for empty board', async () => {
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: [], error: null });
      const mockEqBoard = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelectBoard = vi
        .fn()
        .mockReturnValue({ eq: mockEqBoard });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelectBoard,
        delete: mockDelete,
      });

      const result = await executeTool(
        'getBoardState',
        {},
        BOARD_ID,
        USER_ID
      );

      const parsed = JSON.parse(result.result);
      expect(parsed).toEqual([]);
    });

    it('returns error message on Supabase error', async () => {
      const mockOrder = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Query failed' } });
      const mockEqBoard = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelectBoard = vi
        .fn()
        .mockReturnValue({ eq: mockEqBoard });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelectBoard,
        delete: mockDelete,
      });

      const result = await executeTool(
        'getBoardState',
        {},
        BOARD_ID,
        USER_ID
      );

      expect(result.result).toContain('Error getting board state');
      expect(result.result).toContain('Query failed');
    });
  });

  // ── Unknown tool ──────────────────────────────────────────────────

  describe('unknown tool', () => {
    it('returns "Unknown tool: xyz"', async () => {
      const result = await executeTool('xyz', {}, BOARD_ID, USER_ID);

      expect(result.result).toBe('Unknown tool: xyz');
      expect(result.toolName).toBe('xyz');
    });
  });
});
