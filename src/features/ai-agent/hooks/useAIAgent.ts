'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AIMessage, AIResponseBody } from '../types';
import { useBoardObjects } from '@/features/board/hooks/useBoardObjects';
import { broadcastToLiveChannel } from '@/features/board/hooks/useBoardRealtime';
import { useCanvas } from '@/features/board/hooks/useCanvas';

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
        // Compute viewport center so AI places objects near the visible area
        const { panOffset, zoom } = useCanvas.getState();
        const viewportCenter = {
          x: (-panOffset.x + window.innerWidth / 2) / zoom,
          y: (-panOffset.y + window.innerHeight / 2) / zoom,
        };

        const response = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            boardId,
            viewportCenter,
          }),
        });

        const data = (await response.json()) as AIResponseBody & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || 'Failed to get AI response');
        }

        // Hydrate local store with created objects for instant rendering
        if (data.createdObjects && data.createdObjects.length > 0) {
          const store = useBoardObjects.getState();
          for (const obj of data.createdObjects) {
            // addObject is state-only (no DB write) — the object already exists in DB
            store.addObject(obj);
            // Broadcast to other clients for instant sync
            broadcastToLiveChannel('object_create', {
              object: obj,
              senderId: store.userId,
            });
          }
        }

        // Remove deleted objects from local store
        if (data.deletedObjectIds && data.deletedObjectIds.length > 0) {
          const store = useBoardObjects.getState();
          for (const id of data.deletedObjectIds) {
            store.deleteObject(id);
            broadcastToLiveChannel('object_delete', {
              id,
              senderId: store.userId,
            });
          }
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
