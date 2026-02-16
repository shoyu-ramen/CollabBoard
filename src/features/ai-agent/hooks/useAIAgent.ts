'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AIMessage, AIResponseBody } from '../types';

export function useAIAgent(boardId: string) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: AIMessage = {
        id: uuidv4(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const loadingMessage: AIMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setIsLoading(true);

      try {
        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            boardId,
          }),
        });

        const data = (await response.json()) as AIResponseBody & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get AI response');
        }

        const assistantMessage: AIMessage = {
          id: loadingMessage.id,
          role: 'assistant',
          content: data.reply,
          toolCalls: data.toolCalls,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id ? assistantMessage : msg
          )
        );
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Something went wrong';

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id
              ? {
                  ...msg,
                  isLoading: false,
                  content: '',
                  error: errorMsg,
                }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [boardId, isLoading]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
