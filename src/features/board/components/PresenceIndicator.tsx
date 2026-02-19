'use client';

import type { PresenceUser } from '../types';

interface PresenceIndicatorProps {
  users: PresenceUser[];
}

export function PresenceIndicator({ users }: PresenceIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5 hig-rounded-lg hig-material-regular px-2 py-1.5 border border-[var(--separator)] sm:gap-2 sm:px-3 sm:py-2">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) => (
          <div
            key={user.userId}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] text-[10px] font-medium text-white sm:h-8 sm:w-8 sm:text-xs"
            style={{ backgroundColor: user.color }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {/* Show more avatars on desktop */}
        {users.slice(3, 5).map((user) => (
          <div
            key={user.userId}
            className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] text-xs font-medium text-white sm:flex"
            style={{ backgroundColor: user.color }}
            title={user.userName}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 5 && (
          <div className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--fill-secondary)] text-xs font-medium text-[var(--label-secondary)] sm:flex">
            +{users.length - 5}
          </div>
        )}
        {users.length > 3 && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--bg-primary)] bg-[var(--fill-secondary)] text-[10px] font-medium text-[var(--label-secondary)] sm:hidden">
            +{users.length - 3}
          </div>
        )}
      </div>
      <span className="hig-caption1 text-[var(--label-secondary)]">
        {users.length}
      </span>
    </div>
  );
}
