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
    <div className="flex items-start gap-2 rounded-md bg-[var(--fill-quaternary)] px-3 py-2 text-xs text-[var(--label-secondary)]">
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
        <div className="max-w-[85%] rounded-[18px] rounded-bl-[4px] bg-[var(--fill-tertiary)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[var(--label-secondary)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--system-blue)]" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--system-blue)] [animation-delay:0.2s]" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--system-blue)] [animation-delay:0.4s]" />
            <span className="ml-1">Thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-[18px] rounded-bl-[4px] bg-[var(--system-red)]/10 px-4 py-3">
          <p className="text-sm text-[var(--system-red)]">{message.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 ${
          isUser
            ? 'bg-[var(--system-blue)] text-white rounded-[18px] rounded-br-[4px]'
            : 'bg-[var(--fill-tertiary)] text-[var(--label-primary)] rounded-[18px] rounded-bl-[4px]'
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
      className={`fixed right-0 top-0 z-50 flex h-full w-full sm:w-96 flex-col border-l border-[var(--separator)] bg-[var(--bg-secondary)] shadow-xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="hig-material-chrome flex items-center justify-between border-b border-[var(--separator)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--system-blue)]/10 text-sm font-semibold text-[var(--system-blue)]">
            AI
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--label-primary)]">
              Board Assistant
            </h2>
            <p className="text-xs text-[var(--label-secondary)]">
              Powered by Claude
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="rounded-md p-1.5 text-[var(--label-tertiary)] hover:bg-[var(--fill-quaternary)] hover:text-[var(--label-secondary)]"
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
            className="rounded-md p-1.5 text-[var(--label-tertiary)] hover:bg-[var(--fill-quaternary)] hover:text-[var(--label-secondary)]"
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
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--system-blue)]/10 text-xl text-[var(--system-blue)]">
              AI
            </div>
            <p className="mb-1 text-sm font-medium text-[var(--label-primary)]">
              Board Assistant
            </p>
            <p className="max-w-[250px] text-xs text-[var(--label-secondary)]">
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
                  className="hig-rounded-xl bg-[var(--fill-quaternary)] px-3 py-2 text-xs text-[var(--label-secondary)] hig-pressable min-h-[44px]"
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
        className="hig-material-chrome border-t border-[var(--separator)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI assistant..."
            className="flex-1 rounded-full bg-[var(--fill-tertiary)] px-3 py-2 text-sm text-[var(--label-primary)] placeholder-[var(--label-tertiary)] outline-none focus:ring-1 focus:ring-[var(--system-blue)]"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--system-blue)] text-white transition-colors hig-pressable disabled:bg-[var(--fill-secondary)] disabled:cursor-not-allowed"
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
