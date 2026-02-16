'use client';

import type { PresenceUser } from '../types';

interface PresenceIndicatorProps {
  users: PresenceUser[];
}

export function PresenceIndicator({ users }: PresenceIndicatorProps) {
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-md">
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user) => (
          <div
            key={user.userId}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white"
            style={{ backgroundColor: user.color }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 5 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-400 text-xs font-medium text-white">
            +{users.length - 5}
          </div>
        )}
      </div>
      <span className="text-sm text-gray-600">
        {users.length} online
      </span>
    </div>
  );
}
