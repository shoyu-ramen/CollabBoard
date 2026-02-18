'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAIAgent } from '../hooks/useAIAgent';
import type { AIMessage, ToolCallResult } from '../types';

interface AIChatPanelProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

function ToolCallCard({ toolCall }: { toolCall: ToolCallResult }) {
  const label = formatToolCallLabel(toolCall);
  return (
    <div className="flex items-start gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      <span className="mt-0.5 shrink-0">&#9881;</span>
      <span>{label}</span>
    </div>
  );
}

function formatToolCallLabel(toolCall: ToolCallResult): string {
  const { toolName, input } = toolCall;
  switch (toolName) {
    case 'createStickyNote':
      return `Created sticky note "${(input.text as string)?.slice(0, 30) || ''}${((input.text as string)?.length || 0) > 30 ? '...' : ''}"`;
    case 'createShape':
      return `Created ${input.type as string} shape`;
    case 'createFrame':
      return `Created frame "${input.title as string}"`;
    case 'createConnector':
      return `Created arrow`;
    case 'moveObject':
      return `Moved object to (${input.x}, ${input.y})`;
    case 'resizeObject':
      return `Resized object to ${input.width}x${input.height}`;
    case 'updateText':
      return `Updated text content`;
    case 'changeColor':
      return `Changed color to ${input.color as string}`;
    case 'getBoardState':
      return `Retrieved board state`;
    default:
      return toolName;
  }
}

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  if (message.isLoading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg bg-white px-4 py-3 shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:0.2s]" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500 [animation-delay:0.4s]" />
            <span className="ml-1">Thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg bg-red-50 px-4 py-3 border border-red-200 dark:bg-red-950 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{message.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white shadow-sm border border-slate-200 text-slate-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
        }`}
      >
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5">
            {message.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </div>
        )}
        {message.content && (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        )}
      </div>
    </div>
  );
}

export function AIChatPanel({ boardId, isOpen, onClose }: AIChatPanelProps) {
  const { messages, isLoading, sendMessage, clearMessages } =
    useAIAgent(boardId);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div
      className={`fixed right-0 top-0 z-50 flex h-full w-full sm:w-96 flex-col border-l border-slate-200 bg-slate-50 shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-950 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
            AI
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-gray-200">
              Board Assistant
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Powered by Claude
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Clear chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="Collapse panel"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl text-blue-600 dark:bg-blue-900 dark:text-blue-300">
              AI
            </div>
            <p className="mb-1 text-sm font-medium text-slate-700 dark:text-gray-300">
              Board Assistant
            </p>
            <p className="max-w-[250px] text-xs text-slate-500 dark:text-gray-400">
              Ask me to create sticky notes, shapes, frames, or templates on
              your whiteboard.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {[
                'Create a SWOT analysis template',
                'Add 3 sticky notes for brainstorming',
                'Create a Kanban board layout',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-600 dark:hover:bg-gray-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI assistant..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
