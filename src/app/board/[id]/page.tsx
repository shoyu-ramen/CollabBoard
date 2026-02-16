'use client';

import { use, useState } from 'react';
import dynamic from 'next/dynamic';
import Toolbar from '@/features/board/components/Toolbar';
import { PresenceIndicator } from '@/features/board/components/PresenceIndicator';
import { AIButton } from '@/features/ai-agent/components/AIButton';
import { AIChatPanel } from '@/features/ai-agent/components/AIChatPanel';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRealtimeSync } from '@/features/board/hooks/useRealtimeSync';
import { usePresence } from '@/features/board/hooks/usePresence';
import { useCursorSync } from '@/features/board/hooks/useCursorSync';
import { useBoardPersistence } from '@/features/board/hooks/useBoardPersistence';

const Canvas = dynamic(
  () => import('@/features/board/components/Canvas'),
  { ssr: false }
);

const CursorOverlayDynamic = dynamic(
  () =>
    import('@/features/board/components/CursorOverlay').then(
      (mod) => mod.CursorOverlay
    ),
  { ssr: false }
);

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: boardId } = use(params);
  const { user } = useAuth();
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const userId = user?.id ?? null;
  const userName =
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    'Anonymous';

  // Load board objects from Supabase
  const { loading, error, reload } = useBoardPersistence(boardId);

  // Subscribe to realtime changes
  useRealtimeSync(boardId);

  // Presence tracking
  const { onlineUsers } = usePresence({
    boardId,
    userId,
    userName,
  });

  // Cursor sync
  const { remoteCursors, broadcastCursor } = useCursorSync({
    boardId,
    userId,
    userName,
  });

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium text-red-600">
            Failed to load board
          </p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={reload}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      onMouseMove={(e) => {
        broadcastCursor(e.clientX, e.clientY);
      }}
    >
      <Canvas
        remoteCursors={remoteCursors}
        CursorOverlayComponent={CursorOverlayDynamic}
      />
      <Toolbar />
      <PresenceIndicator users={onlineUsers} />
      <AIButton
        onClick={() => setAiPanelOpen(true)}
        isOpen={aiPanelOpen}
      />
      <AIChatPanel
        boardId={boardId}
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
      />
    </main>
  );
}
