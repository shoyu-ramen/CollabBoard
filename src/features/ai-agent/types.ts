import type { WhiteboardObject } from '@/features/board/types';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallResult[];
  timestamp: string;
  isLoading?: boolean;
  error?: string;
}

export interface ToolCallResult {
  toolName: string;
  input: Record<string, unknown>;
  result: string;
  objectId?: string;
}

// Claude API types (raw fetch, no SDK)
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;

export interface ClaudeTextBlock {
  type: 'text';
  text: string;
}

export interface ClaudeToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AIRequestBody {
  message: string;
  boardId: string;
  boardState?: BoardStateSummary[];
  viewportCenter?: { x: number; y: number };
}

export interface BoardStateSummary {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  color?: string;
}

export interface AIResponseBody {
  reply: string;
  toolCalls: ToolCallResult[];
  createdObjects?: WhiteboardObject[];
  error?: string;
}

