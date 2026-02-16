import { AI_MODEL } from '@/lib/constants';
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
} from '../types';

const MAX_TOOL_ITERATIONS = 10;

function buildSystemPrompt(boardState: BoardStateSummary[]): string {
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
- When creating multiple related items (like a template), space them out so they don't overlap. Use reasonable spacing (e.g., 220px between sticky notes, 450px between frames).
- Use descriptive text for sticky notes and frames.
- Use varied colors to make the board visually appealing. Available sticky note colors: #FEF08A (yellow), #BBF7D0 (green), #BFDBFE (blue), #FBCFE8 (pink), #FED7AA (orange), #E9D5FF (purple).
- When asked to create templates (e.g., SWOT analysis, Kanban board), create a frame with labeled sticky notes inside it.
- Always confirm what you did after performing actions.
- If you need to understand the current board state before making changes, use getBoardState first.
- Keep text concise for sticky notes (they have limited space).
- Place new objects in a visible area (positive x,y coordinates, typically 100-1500 range).`;
}

async function callClaude(
  messages: ClaudeMessage[],
  systemPrompt: string
): Promise<ClaudeResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

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
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<ClaudeResponse>;
}

export async function processAIMessage(
  userMessage: string,
  boardId: string,
  userId: string,
  boardState: BoardStateSummary[]
): Promise<{ reply: string; toolCalls: ToolCallResult[] }> {
  const systemPrompt = buildSystemPrompt(boardState);
  const allToolCalls: ToolCallResult[] = [];

  const messages: ClaudeMessage[] = [
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const response = await callClaude(messages, systemPrompt);

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
      return { reply, toolCalls: allToolCalls };
    }

    // Execute each tool call
    const toolResults: ClaudeToolResultBlock[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input,
        boardId,
        userId
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

  // If we hit max iterations, return what we have
  return {
    reply:
      'I completed several actions but reached the maximum number of steps. Please let me know if you need anything else.',
    toolCalls: allToolCalls,
  };
}
