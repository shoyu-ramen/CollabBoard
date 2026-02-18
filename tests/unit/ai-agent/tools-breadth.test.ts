import { describe, it, expect } from 'vitest';
import { AI_TOOLS } from '@/features/ai-agent/schemas/tools';

describe('AI tool breadth — spec requirement: 6+ distinct command types', () => {
  it('has at least 6 tools', () => {
    expect(AI_TOOLS.length).toBeGreaterThanOrEqual(6);
  });

  describe('covers all required command categories', () => {
    const toolNames = AI_TOOLS.map((t) => t.name);

    it('has creation tools (create*)', () => {
      const creationTools = toolNames.filter((n) => n.startsWith('create'));
      // Spec requires: createStickyNote, createShape, createFrame, createConnector at minimum
      expect(creationTools.length).toBeGreaterThanOrEqual(3);
      expect(creationTools).toContain('createStickyNote');
      expect(creationTools).toContain('createShape');
      expect(creationTools).toContain('createFrame');
      expect(creationTools).toContain('createConnector');
    });

    it('has manipulation tools (move, resize, update, change, delete)', () => {
      const manipulationPatterns = [
        /^move/,
        /^resize/,
        /^update/,
        /^change/,
        /^delete/,
      ];
      const manipulationTools = toolNames.filter((n) =>
        manipulationPatterns.some((p) => p.test(n))
      );
      expect(manipulationTools.length).toBeGreaterThanOrEqual(3);
    });

    it('has a query tool (getBoardState)', () => {
      expect(toolNames).toContain('getBoardState');
    });

    it('spans creation, manipulation, layout, and query — at least 4 categories', () => {
      const hasCreation = toolNames.some((n) => n.startsWith('create'));
      const hasManipulation = toolNames.some((n) =>
        /^(move|resize|update|change|delete)/.test(n)
      );
      const hasLayout = toolNames.some((n) =>
        ['createFrame', 'createConnector', 'moveObject', 'resizeObject'].includes(n)
      );
      const hasQuery = toolNames.includes('getBoardState');

      const categoryCount = [hasCreation, hasManipulation, hasLayout, hasQuery].filter(
        Boolean
      ).length;
      expect(categoryCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('each tool has a valid schema', () => {
    it.each(AI_TOOLS.map((t) => t.name))(
      'tool "%s" has name, description, and input_schema with properties',
      (toolName) => {
        const tool = AI_TOOLS.find((t) => t.name === toolName);
        expect(tool).toBeDefined();
        expect(typeof tool!.name).toBe('string');
        expect(tool!.name.length).toBeGreaterThan(0);
        expect(typeof tool!.description).toBe('string');
        expect(tool!.description.length).toBeGreaterThan(0);
        expect(tool!.input_schema).toBeDefined();
        expect(tool!.input_schema.type).toBe('object');
        expect(typeof tool!.input_schema.properties).toBe('object');
      }
    );
  });

  it('all tools collectively cover 6+ distinct command types', () => {
    // Group tools by functional type
    const commandTypes = new Set<string>();

    for (const tool of AI_TOOLS) {
      if (tool.name.startsWith('create')) {
        commandTypes.add(`create:${tool.name}`);
      } else if (tool.name === 'moveObject') {
        commandTypes.add('move');
      } else if (tool.name === 'resizeObject') {
        commandTypes.add('resize');
      } else if (tool.name === 'updateText') {
        commandTypes.add('updateText');
      } else if (tool.name === 'changeColor') {
        commandTypes.add('changeColor');
      } else if (tool.name === 'deleteObject') {
        commandTypes.add('delete');
      } else if (tool.name === 'getBoardState') {
        commandTypes.add('query');
      }
    }

    // Spec requires 6+ distinct command types
    expect(commandTypes.size).toBeGreaterThanOrEqual(6);
  });
});
