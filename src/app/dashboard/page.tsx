'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { Board } from '@/features/board/types';

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchBoards() {
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
    }

    if (!authLoading && user) {
      fetchBoards();
    }
  }, [authLoading, user]);

  const handleCreateBoard = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Board' }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/board/${data.board.id}`);
      }
    } catch (err) {
      console.error('Failed to create board:', err);
    } finally {
      setCreating(false);
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
          <h2 className="text-lg font-semibold text-gray-900">
            Your Boards
          </h2>
          <button
            onClick={handleCreateBoard}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : '+ New Board'}
          </button>
        </div>

        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16">
            <div className="mb-4 text-4xl">&#128466;</div>
            <p className="mb-2 text-lg font-medium text-gray-700">
              No boards yet
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
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => router.push(`/board/${board.id}`)}
                className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">
                  &#128466;
                </div>
                <h3 className="mb-1 text-sm font-semibold text-gray-900">
                  {board.name}
                </h3>
                <p className="text-xs text-gray-400">
                  Created{' '}
                  {new Date(board.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
