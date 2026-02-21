import { describe, it, expect } from 'vitest';
import { AI_TOOLS } from '@/features/ai-agent/schemas/tools';

const EXPECTED_TOOL_NAMES = [
  'createStickyNote',
  'createText',
  'createShape',
  'createFrame',
  'createConnector',
  'moveObject',
  'resizeObject',
  'updateText',
  'changeColor',
  'deleteObject',
  'createTemplate',
  'getBoardState',
  'summarizeBoard',
  'generateFlowchart',
];

describe('AI_TOOLS schema', () => {
  it('has exactly 14 tools', () => {
    expect(AI_TOOLS).toHaveLength(14);
  });

  it('contains all expected tool names', () => {
    const names = AI_TOOLS.map((t) => t.name);
    for (const expected of EXPECTED_TOOL_NAMES) {
      expect(names).toContain(expected);
    }
  });

  it('has no duplicate tool names', () => {
    const names = AI_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it.each(EXPECTED_TOOL_NAMES)(
    'tool "%s" has name, description, and valid input_schema',
    (toolName) => {
      const tool = AI_TOOLS.find((t) => t.name === toolName);
      expect(tool).toBeDefined();
      expect(typeof tool!.name).toBe('string');
      expect(typeof tool!.description).toBe('string');
      expect(tool!.description.length).toBeGreaterThan(0);
      expect(tool!.input_schema).toBeDefined();
      expect(tool!.input_schema.type).toBe('object');
      expect(typeof tool!.input_schema.properties).toBe('object');
    }
  );

  it('createStickyNote requires ["text"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'createStickyNote');
    expect(tool!.input_schema.required).toEqual(['text']);
  });

  it('createText requires ["text"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'createText');
    expect(tool!.input_schema.required).toEqual(['text']);
  });

  it('createShape requires ["type"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'createShape');
    expect(tool!.input_schema.required).toEqual(['type']);
  });

  it('createFrame requires ["title"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'createFrame');
    expect(tool!.input_schema.required).toEqual(['title']);
  });

  it('createConnector requires []', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'createConnector');
    expect(tool!.input_schema.required).toEqual([]);
  });

  it('moveObject requires ["objectId", "x", "y"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'moveObject');
    expect(tool!.input_schema.required).toEqual(['objectId', 'x', 'y']);
  });

  it('resizeObject requires ["objectId", "width", "height"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'resizeObject');
    expect(tool!.input_schema.required).toEqual([
      'objectId',
      'width',
      'height',
    ]);
  });

  it('updateText requires ["objectId", "newText"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'updateText');
    expect(tool!.input_schema.required).toEqual(['objectId', 'newText']);
  });

  it('changeColor requires ["objectId", "color"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'changeColor');
    expect(tool!.input_schema.required).toEqual(['objectId', 'color']);
  });

  it('getBoardState has no required fields', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'getBoardState');
    expect(tool!.input_schema.required).toBeUndefined();
  });

  it('summarizeBoard requires []', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'summarizeBoard');
    expect(tool!.input_schema.required).toEqual([]);
  });

  it('generateFlowchart requires ["description"]', () => {
    const tool = AI_TOOLS.find((t) => t.name === 'generateFlowchart');
    expect(tool!.input_schema.required).toEqual(['description']);
  });
});
