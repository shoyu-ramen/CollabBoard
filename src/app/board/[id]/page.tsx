'use client';

import { use, useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Toolbar from '@/features/board/components/Toolbar';
import PropertiesPanel from '@/features/board/components/PropertiesPanel';
import { PresenceIndicator } from '@/features/board/components/PresenceIndicator';
import { FollowBanner } from '@/features/board/components/FollowBanner';
import { useFollowViewport } from '@/features/board/hooks/useFollowViewport';
import { MemberManagementModal } from '@/features/board/components/MemberManagementModal';
import { AIButton } from '@/features/ai-agent/components/AIButton';
import { AIChatPanel } from '@/features/ai-agent/components/AIChatPanel';
import { FloatingActionBar } from '@/features/board/components/FloatingActionBar';
import { Minimap } from '@/features/board/components/Minimap';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBoardRealtime } from '@/features/board/hooks/useBoardRealtime';
import { useBoardPersistence } from '@/features/board/hooks/useBoardPersistence';
import { useCanvas } from '@/features/board/hooks/useCanvas';
import { useBoardPresence } from '@/features/board/contexts/BoardPresenceProvider';

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

  const userId = user?.id ?? null;
  const userName =
    user?.user_metadata?.full_name ??
    user?.email?.split('@')[0] ??
    'Anonymous';

  // Load board objects from Supabase (also handles auto-join via API)
  const { loading, error, reload, boardVisibility } = useBoardPersistence(boardId, userId);

  // Only activate realtime channels after the board is loaded and the user
  // has joined (via the join API). This ensures RLS access is established
  // before the channels subscribe.
  const realtimeBoardId = loading ? null : boardId;
  const { onlineUsers, remoteCursors, broadcastCursor, connectionStatus } = useBoardRealtime({
    boardId: realtimeBoardId,
    userId,
    userName,
  });

  // Track presence on the global dashboard presence channel
  const { trackBoard, untrackBoard } = useBoardPresence();
  useEffect(() => {
    if (!loading && userId && userName) {
      trackBoard(boardId, userId, userName);
    }
    // Untrack on tab close since React cleanup doesn't reliably fire
    const handleBeforeUnload = () => untrackBoard();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      untrackBoard();
    };
  }, [loading, boardId, userId, userName, trackBoard, untrackBoard]);

  // Kick user out if they're removed from the board
  const router = useRouter();
  const kickedRef = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard-board-updates')
      .on(
        'broadcast',
        { event: 'member-removed' },
        ({ payload }) => {
          const { boardId: removedBoardId, userId: removedUserId } =
            payload as { boardId: string; userId: string };
          if (
            removedBoardId === boardId &&
            removedUserId === userId &&
            !kickedRef.current
          ) {
            kickedRef.current = true;
            router.push('/dashboard');
          }
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [boardId, userId, router]);

  // AI panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  // Members modal state
  const [membersOpen, setMembersOpen] = useState(false);
  const [isBoardOwner, setIsBoardOwner] = useState(false);

  // Check if current user is the board owner
  useEffect(() => {
    if (!userId || loading) return;
    fetch(`/api/boards/members?boardId=${boardId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          const me = data.members.find(
            (m: { user_id: string }) => m.user_id === userId
          );
          setIsBoardOwner(me?.role === 'owner');
        }
      })
      .catch(() => {});
  }, [boardId, userId, loading]);

  // Toggle AI panel with Cmd/Ctrl + J
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAiPanelOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Follow / spotlight mode
  const { breakFollow } = useFollowViewport(userId);

  // Canvas state for cursor coordinate conversion
  const zoom = useCanvas((s) => s.zoom);
  const panOffset = useCanvas((s) => s.panOffset);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--system-blue)] border-t-transparent" />
          <p className="text-sm text-[var(--label-secondary)]">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAccessDenied = error.includes('Access denied') || error.includes('private');
    const isNotFound = error.includes('not found');
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3 text-center">
          {isAccessDenied ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--system-red)]/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--system-red)]">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <p className="text-lg font-medium text-[var(--system-red)]">
                Access Denied
              </p>
              <p className="text-sm text-[var(--label-secondary)]">
                This board is private. Ask the owner to invite you.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-[var(--system-red)]">
                {isNotFound ? 'Board Not Found' : 'Failed to load board'}
              </p>
              <p className="text-sm text-[var(--label-secondary)]">{error}</p>
            </>
          )}
          <div className="mt-2 flex gap-2">
            <Link
              href="/dashboard"
              className="bg-[var(--fill-tertiary)] text-[var(--label-primary)] hig-rounded-md hig-pressable px-4 py-2 text-sm hover:opacity-80"
            >
              Back to Dashboard
            </Link>
            {!isAccessDenied && (
              <button
                onClick={reload}
                className="bg-[var(--system-blue)] hig-rounded-md hig-pressable px-4 py-2 text-sm text-white"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main
      className="relative h-screen w-screen overflow-hidden"
      onMouseMove={(e) => {
        // Convert screen coordinates to canvas coordinates so cursors
        // render correctly inside the Konva Stage for all viewers
        const canvasX = (e.clientX - panOffset.x) / zoom;
        const canvasY = (e.clientY - panOffset.y) / zoom;
        broadcastCursor(canvasX, canvasY);
      }}
    >
      <Canvas
        remoteCursors={remoteCursors}
        CursorOverlayComponent={CursorOverlayDynamic}
        onBreakFollow={breakFollow}
      />
      <FloatingActionBar />
      <Link
        href="/dashboard"
        className="absolute top-2 left-2 z-50 flex items-center justify-center hig-material-regular hig-rounded-md min-h-[44px] min-w-[44px] border border-[var(--separator)] text-[var(--label-secondary)] hover:opacity-80 transition-colors sm:top-4 sm:left-4 h-9 w-9 sm:h-10 sm:w-10"
        title="Back to dashboard"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <Toolbar />
      <PropertiesPanel />
      <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5 sm:top-4 sm:right-4 sm:gap-2">
        {isBoardOwner && boardVisibility === 'private' && (
          <button
            onClick={() => setMembersOpen(true)}
            className="flex items-center justify-center hig-material-regular hig-rounded-md min-h-[44px] min-w-[44px] border border-[var(--separator)] text-[var(--label-secondary)] hover:opacity-80 transition-colors h-9 w-9 sm:h-10 sm:w-10"
            title="Manage members"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:h-5 sm:w-5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
        )}
        <PresenceIndicator
          users={onlineUsers}
          currentUserId={userId}
          currentUserName={userName}
        />
      </div>
      {isBoardOwner && boardVisibility === 'private' && (
        <MemberManagementModal
          boardId={boardId}
          isOpen={membersOpen}
          onClose={() => setMembersOpen(false)}
        />
      )}
      <AIButton onClick={() => setAiPanelOpen(true)} isOpen={aiPanelOpen} />
      {aiPanelOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setAiPanelOpen(false)}
        />
      )}
      <AIChatPanel boardId={boardId} isOpen={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      <Minimap onlineUsers={onlineUsers} currentUserId={userId} onBreakFollow={breakFollow} />
      <FollowBanner currentUserId={userId} currentUserName={userName} />
      {/* Connection status banner */}
      {(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') && !loading && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 hig-material-regular hig-rounded-md border border-[var(--separator)] px-3 py-1.5 shadow-md sm:top-4 sm:px-4 sm:py-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--system-orange)] animate-pulse" />
          <span className="text-xs text-[var(--system-orange)] sm:text-sm">
            {connectionStatus === 'reconnecting'
              ? 'Reconnecting...'
              : 'Connection lost'}
          </span>
        </div>
      )}
    </main>
  );
}
