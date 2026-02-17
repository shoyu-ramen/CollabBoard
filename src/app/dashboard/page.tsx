'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { useBoardPresence } from '@/features/board/contexts/BoardPresenceProvider';
import type { Board } from '@/features/board/types';

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [tab, setTab] = useState<'my' | 'all'>('all');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { presenceMap } = useBoardPresence();

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data.boards ?? []);
      }
    } catch (err) {
      console.error('Failed to fetch boards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchBoards();

      // Subscribe to realtime changes on the boards table
      const supabase = createClient();
      const channelName = `dashboard-boards-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'boards' },
          () => {
            fetchBoards();
          }
        )
        .subscribe((status) => {
          console.log('[Dashboard realtime]', channelName, status);
        });

      return () => {
        channel.unsubscribe();
      };
    }
  }, [authLoading, user, fetchBoards]);

  const handleCreateBoard = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/board/${data.id}`);
      }
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameBoard = async (boardId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }

    try {
      const res = await fetch('/api/boards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: boardId, name: trimmed }),
      });
      if (res.ok) {
        setBoards((prev) =>
          prev.map((b) =>
            b.id === boardId ? { ...b, name: trimmed } : b
          )
        );
      }
    } catch (err) {
      console.error('Failed to rename board:', err);
    } finally {
      setEditingId(null);
    }
  };

  const handleDeleteBoard = async (
    e: React.MouseEvent,
    boardId: string
  ) => {
    e.stopPropagation();

    const otherUsers = (presenceMap[boardId] ?? []).filter(
      (u) => u.userId !== user?.id
    );
    if (otherUsers.length > 0) {
      const names = otherUsers.map((u) => u.userName).join(', ');
      setDeleteError(
        `Can't delete — ${otherUsers.length === 1 ? `${names} is` : `${names} are`} currently on this board`
      );
      setTimeout(() => setDeleteError(null), 4000);
      return;
    }

    try {
      const res = await fetch(`/api/boards?id=${boardId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBoards((prev) => prev.filter((b) => b.id !== boardId));
      }
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {deleteError && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {deleteError}
        </div>
      )}
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">CollabBoard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setTab('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Boards
            </button>
            <button
              onClick={() => setTab('my')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === 'my'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Boards
            </button>
          </div>
          <button
            onClick={handleCreateBoard}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : '+ New Board'}
          </button>
        </div>

        {(() => {
          const filteredBoards =
            tab === 'my'
              ? boards.filter((b) => b.created_by === user?.id)
              : boards;
          const emptyLabel =
            tab === 'my' ? 'You haven\u2019t created any boards yet' : 'No boards yet';

          return filteredBoards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
            <div className="mb-4 text-4xl">&#128466;</div>
            <p className="mb-2 text-lg font-medium text-gray-700">
              {emptyLabel}
            </p>
            <p className="mb-4 text-sm text-gray-500">
              Create your first collaborative whiteboard
            </p>
            <button
              onClick={handleCreateBoard}
              disabled={creating}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBoards.map((board) => (
              <div
                key={board.id}
                onClick={() => router.push(`/board/${board.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/board/${board.id}`);
                }}
                className="group relative flex cursor-pointer flex-col items-start rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                {board.created_by === user?.id && (
                  <button
                    onClick={(e) => handleDeleteBoard(e, board.id)}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Delete board"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                )}
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">
                  &#128466;
                </div>
                {editingId === board.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameBoard(board.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameBoard(board.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mb-1 w-full rounded border border-blue-300 px-1 py-0.5 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : board.created_by === user?.id ? (
                  <h3
                    className="mb-1 text-sm font-semibold text-gray-900 hover:text-blue-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(board.id);
                      setEditName(board.name);
                    }}
                    title="Click to rename"
                  >
                    {board.name}
                  </h3>
                ) : (
                  <h3 className="mb-1 text-sm font-semibold text-gray-900">
                    {board.name}
                  </h3>
                )}
                <p className="text-xs text-gray-400">
                  {board.creator_email ?? 'Unknown'}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(board.created_at).toLocaleDateString(
                    undefined,
                    {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }
                  )}
                </p>
                {presenceMap[board.id]?.length > 0 && (
                  <div className="mt-3 flex items-center gap-1">
                    {presenceMap[board.id]
                      .slice(0, 5)
                      .map((u) => (
                        <div
                          key={u.userId}
                          title={u.userName}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.userName
                            .split(' ')
                            .map((w) => w[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                      ))}
                    {presenceMap[board.id].length > 5 && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-[10px] font-bold text-gray-600">
                        +{presenceMap[board.id].length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
        })()}
      </div>
    </div>
  );
}
