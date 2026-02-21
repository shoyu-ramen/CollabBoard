import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSystemPrompt,
  callClaude,
  processAIMessage,
} from '@/features/ai-agent/services/ai.service';
import type { BoardStateSummary } from '@/features/ai-agent/types';

// Mock the tool-executor module
vi.mock('@/features/ai-agent/services/tool-executor', () => ({
  executeTool: vi.fn().mockResolvedValue({
    toolName: 'createStickyNote',
    input: { text: 'test' },
    result: 'Created sticky note "test" at (100, 100)',
    objectId: 'mock-id',
  }),
}));

describe('buildSystemPrompt', () => {
  it('includes "board is currently empty" for empty board state', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('board is currently empty');
  });

  it('includes object count and details for board with objects', () => {
    const state: BoardStateSummary[] = [
      {
        id: 'obj-1',
        type: 'sticky_note',
        x: 100,
        y: 200,
        width: 200,
        height: 200,
        text: 'Hello',
        color: '#FEF08A',
      },
      {
        id: 'obj-2',
        type: 'rectangle',
        x: 400,
        y: 300,
        width: 150,
        height: 100,
      },
    ];
    const prompt = buildSystemPrompt(state);
    expect(prompt).toContain('2 objects');
    expect(prompt).toContain('obj-1');
    expect(prompt).toContain('sticky_note');
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('obj-2');
    expect(prompt).toContain('rectangle');
  });

  it('includes viewport coordinates when viewportCenter is provided', () => {
    const prompt = buildSystemPrompt([], { x: 500.7, y: 300.3 });
    expect(prompt).toContain('VIEWPORT');
    expect(prompt).toContain('501');
    expect(prompt).toContain('300');
  });

  it('does not include viewport section when viewportCenter is omitted', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).not.toContain('VIEWPORT');
  });
});

describe('callClaude', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key-123' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('sends correct request shape to Anthropic API', async () => {
    const mockResponse = {
      id: 'msg-1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    await callClaude(
      [{ role: 'user', content: 'Hi' }],
      'You are a helpful assistant'
    );

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options?.method).toBe('POST');

    const headers = options?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key-123');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['content-type']).toBe('application/json');

    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe('claude-sonnet-4-6');
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toBe('You are a helpful assistant');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.tools).toBeDefined();
    expect(body.tools.length).toBe(15);
  });

  it('throws error when API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      callClaude(
        [{ role: 'user', content: 'Hi' }],
        'system prompt'
      )
    ).rejects.toThrow('ANTHROPIC_API_KEY is not configured');
  });

  it('throws error with status code on API error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limit exceeded'),
    } as Response);

    await expect(
      callClaude(
        [{ role: 'user', content: 'Hi' }],
        'system prompt'
      )
    ).rejects.toThrow('Claude API error (429)');
  });
});

describe('processAIMessage', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key-123' };
    const { executeTool } = await import(
      '@/features/ai-agent/services/tool-executor'
    );
    vi.mocked(executeTool).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns text reply with empty toolCalls for end_turn', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello there!' }],
          model: 'claude-sonnet-4-6',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
    } as Response);

    const result = await processAIMessage('Hi', 'board-1', 'user-1', []);
    expect(result.reply).toBe('Hello there!');
    expect(result.toolCalls).toEqual([]);
  });

  it('executes tool call and returns final reply with toolCalls', async () => {
    const { executeTool } = await import(
      '@/features/ai-agent/services/tool-executor'
    );

    // First call: tool_use response
    // Second call: end_turn with summary text
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'msg-1',
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'tool-1',
                  name: 'createStickyNote',
                  input: { text: 'test note' },
                },
              ],
              model: 'claude-sonnet-4-6',
              stop_reason: 'tool_use',
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'msg-2',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'I created a sticky note for you.' },
            ],
            model: 'claude-sonnet-4-6',
            stop_reason: 'end_turn',
            usage: { input_tokens: 30, output_tokens: 10 },
          }),
      } as Response);
    });

    const result = await processAIMessage(
      'Create a sticky note',
      'board-1',
      'user-1',
      []
    );

    expect(executeTool).toHaveBeenCalledWith(
      'createStickyNote',
      { text: 'test note' },
      'board-1',
      'user-1',
      undefined
    );
    expect(result.reply).toBe('I created a sticky note for you.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe('createStickyNote');
  });

  it('executes multiple tool calls in a single response', async () => {
    const { executeTool } = await import(
      '@/features/ai-agent/services/tool-executor'
    );

    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'msg-1',
              type: 'message',
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'tool-1',
                  name: 'createStickyNote',
                  input: { text: 'Note 1' },
                },
                {
                  type: 'tool_use',
                  id: 'tool-2',
                  name: 'createStickyNote',
                  input: { text: 'Note 2' },
                },
              ],
              model: 'claude-sonnet-4-6',
              stop_reason: 'tool_use',
              usage: { input_tokens: 10, output_tokens: 30 },
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'msg-2',
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: 'Created both notes.' }],
            model: 'claude-sonnet-4-6',
            stop_reason: 'end_turn',
            usage: { input_tokens: 50, output_tokens: 10 },
          }),
      } as Response);
    });

    const result = await processAIMessage(
      'Create two notes',
      'board-1',
      'user-1',
      []
    );

    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.reply).toBe('Created both notes.');
  });

  it('returns max-iteration message when limit is reached', async () => {
    // Always return tool_use to force max iterations
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'msg-loop',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: `tool-${Date.now()}`,
                name: 'getBoardState',
                input: {},
              },
            ],
            model: 'claude-sonnet-4-6',
            stop_reason: 'tool_use',
            usage: { input_tokens: 10, output_tokens: 10 },
          }),
      } as Response)
    );

    const result = await processAIMessage(
      'Do something complex',
      'board-1',
      'user-1',
      []
    );

    expect(result.reply).toContain('maximum number of steps');
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });
});
