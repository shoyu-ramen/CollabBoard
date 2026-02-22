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

  return `You are a helpful AI assistant for a collaborative whiteboard application called CollabBoard. You can create and manipulate objects on the whiteboard using your available tools.

CURRENT BOARD STATE:
${objectsSummary}

GUIDELINES:
- Use descriptive text for sticky notes and frames.
- Use varied colors to make the board visually appealing. Available sticky note colors: #FEF08A (yellow), #BBF7D0 (green), #BFDBFE (blue), #FBCFE8 (pink), #FED7AA (orange), #E9D5FF (purple).
- Always confirm what you did after performing actions.
- If you need to understand the current board state before making changes, use getBoardState first.
- Keep text concise for sticky notes (they have limited space).
- Place new objects in a visible area (positive x,y coordinates, typically 100-1500 range).
- IMPORTANT: Before placing new objects, check the current board state positions. Place new content to the RIGHT of or BELOW existing objects to avoid overlap. If the board has objects, calculate the rightmost edge (max x + width) and place new content at least 80px beyond that.

OBJECT DIMENSIONS:
- Sticky notes default to 200x200 pixels, but users may have resized them.
- When arranging or spacing objects, ALWAYS use the actual width and height from getBoardState (not assumed defaults). Add a 20px gap between objects.
- Text objects render at 200x100 pixels by default. Keep labels short (1-3 words).

TEMPLATES:
- When the user asks for a template, ALWAYS use the createTemplate tool. Supported types: swot, kanban, retrospective, pros_cons, eisenhower, user_journey_map, empathy_map.
- "user journey map", "customer journey", "journey map" → use type "user_journey_map".
- "empathy map" → use type "empathy_map".
- Place the template near the user's viewport so it's immediately visible.
- After creating a template, describe what was created.

ADVANCED TOOLS:
- summarizeBoard: when the user wants a summary of what is on the board. This returns a content digest — synthesize the key themes, then use createFrame + createStickyNote to build the summary on the board.
- generateFlowchart: when the user describes a process, workflow, or sequence of steps. ALWAYS use the structured nodes+connections format (not the description string) so you can create branching decision points. Mark decision nodes with type "decision" and use connection labels like "Yes"/"No". Example: nodes=[{id:"1",text:"Start",type:"start"},{id:"2",text:"Check condition?",type:"decision"},{id:"3",text:"Do A"},{id:"4",text:"Do B"}], connections=[{from:"1",to:"2"},{from:"2",to:"3",label:"Yes"},{from:"2",to:"4",label:"No"}]. Supports top-to-bottom or left-to-right direction.${viewportCenter ? `\n\nVIEWPORT: The user is currently viewing the area around (${Math.round(viewportCenter.x)}, ${Math.round(viewportCenter.y)}). Place new objects near this area so they are immediately visible.` : ''}`;
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
