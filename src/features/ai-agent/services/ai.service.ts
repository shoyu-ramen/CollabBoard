import { AI_MODEL } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { AI_TOOLS } from '../schemas/tools';
import { executeTool } from './tool-executor';
import type {
  ClaudeMessage,
  ClaudeResponse,
  ClaudeContentBlock,
  ClaudeToolUseBlock,
  ClaudeToolResultBlock,
  ToolCallResult,
  BoardStateSummary,
  AIRequestContext,
} from '../types';

const MAX_TOOL_ITERATIONS = 25;

export function buildSystemPrompt(
  boardState: BoardStateSummary[],
  viewportCenter?: { x: number; y: number }
): string {
  const objectsSummary =
    boardState.length === 0
      ? 'The board is currently empty.'
      : `The board currently has ${boardState.length} objects:\n${boardState
          .map(
            (obj) =>
              `- [${obj.id}] ${obj.type} at (${obj.x}, ${obj.y}), ${obj.width}x${obj.height}${obj.text ? `, text: "${obj.text}"` : ''}${obj.color ? `, color: ${obj.color}` : ''}`
          )
          .join('\n')}`;

  return `You are an AI assistant for CollabBoard, a collaborative whiteboard. You manipulate the board using your tools.

BOARD STATE:
${objectsSummary}

GUIDELINES:
- Use varied sticky note colors: #FEF08A (yellow), #BBF7D0 (green), #BFDBFE (blue), #FBCFE8 (pink), #FED7AA (orange), #E9D5FF (purple).
- Keep sticky note text to 6-8 words max. Keep text labels to 1-3 words.
- Place new objects to the RIGHT of or BELOW existing objects to avoid overlap.
- Confirm what you did after performing actions.

TEMPLATES:
- ALWAYS use createTemplate for templates. Types: swot, kanban, retrospective, pros_cons, eisenhower, user_journey_map, empathy_map.

ADVANCED TOOLS:
- clearBoard: use instead of deleting objects one by one.
- summarizeBoard: returns a content digest — synthesize themes, then build summary on board with createFrame + createStickyNote.
- generateFlowchart: use for processes/workflows. ALWAYS use nodes+connections (not description string). Rules:
  - No "Start" or "End" nodes — begin with first real step.
  - Mark decision points with type "decision", use "Yes"/"No" labels.
  - List Yes/happy-path connection FIRST per decision node.
  - Prefix error node text with "Error: " (e.g. "Error: invalid email"). Error nodes are terminal — do not add connections from them.
  - Node colors are automatic: blue=steps, yellow=decisions, red=error nodes, green=terminal/success nodes.
  - When multiple paths converge to the same outcome, reuse one node with multiple connections to it. Do NOT duplicate nodes.
  - ALWAYS use direction "left-to-right" unless user asks for vertical.${viewportCenter ? `\n\nVIEWPORT: User is viewing around (${Math.round(viewportCenter.x)}, ${Math.round(viewportCenter.y)}). Place new objects nearby.` : ''}`;
}

export async function callClaude(
  messages: ClaudeMessage[],
  systemPrompt: string,
  ctx?: AIRequestContext,
  iteration?: number
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const callStart = Date.now();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: AI_TOOLS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (ctx) {
      logger.error('ai.claude.error', {
        requestId: ctx.requestId,
        iteration,
        durationMs: Date.now() - callStart,
        statusCode: response.status,
      });
    }
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as ClaudeResponse;

  if (ctx) {
    const toolUseBlocks = result.content.filter(
      (b) => b.type === 'tool_use'
    );
    logger.info('ai.claude.call', {
      requestId: ctx.requestId,
      iteration,
      durationMs: Date.now() - callStart,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      stopReason: result.stop_reason,
      toolCallCount: toolUseBlocks.length,
      model: result.model,
    });
  }

  return result;
}

export async function processAIMessage(
  userMessage: string,
  boardId: string,
  userId: string,
  boardState: BoardStateSummary[],
  viewportCenter?: { x: number; y: number },
  ctx?: AIRequestContext
): Promise<{ reply: string; toolCalls: ToolCallResult[] }> {
  const systemPrompt = buildSystemPrompt(boardState, viewportCenter);
  const allToolCalls: ToolCallResult[] = [];
  const loopStart = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const messages: ClaudeMessage[] = [
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await callClaude(
      messages,
      systemPrompt,
      ctx,
      iterations
    );

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Extract text blocks and tool use blocks
    const textBlocks = response.content.filter(
      (b): b is { type: 'text'; text: string } => b.type === 'text'
    );
    const toolUseBlocks = response.content.filter(
      (b): b is ClaudeToolUseBlock => b.type === 'tool_use'
    );

    // If no tool calls, return the text response
    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      const reply = textBlocks.map((b) => b.text).join('\n') || '';

      if (ctx) {
        logger.info('ai.loop.complete', {
          requestId: ctx.requestId,
          totalIterations: iterations,
          totalToolCalls: allToolCalls.length,
          totalInputTokens,
          totalOutputTokens,
          totalDurationMs: Date.now() - loopStart,
          hitMaxIterations: false,
        });
      }

      return { reply, toolCalls: allToolCalls };
    }

    // Execute each tool call
    const toolResults: ClaudeToolResultBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input,
        boardId,
        userId,
        ctx
      );
      allToolCalls.push(result);

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.result,
      });
    }

    // Add assistant response and tool results to conversation
    messages.push({
      role: 'assistant',
      content: response.content as ClaudeContentBlock[],
    });
    messages.push({
      role: 'user',
      content: toolResults as ClaudeContentBlock[],
    });
  }

  if (ctx) {
    logger.warn('ai.loop.complete', {
      requestId: ctx.requestId,
      totalIterations: iterations,
      totalToolCalls: allToolCalls.length,
      totalInputTokens,
      totalOutputTokens,
      totalDurationMs: Date.now() - loopStart,
      hitMaxIterations: true,
    });
  }

  // If we hit max iterations, return what we have
  return {
    reply:
      'I completed several actions but reached the maximum number of steps. Please let me know if you need anything else.',
    toolCalls: allToolCalls,
  };
}
