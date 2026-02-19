'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!mounted) {
    return (
      <div className="flex h-8 w-14 items-center rounded-full bg-gray-200 p-1">
        <div className="h-6 w-6 rounded-full bg-white" />
      </div>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative flex h-8 w-14 items-center rounded-full p-1 transition-colors hig-pressable bg-[var(--fill-secondary)]`}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon size={14} className="text-slate-700" />
        ) : (
          <Sun size={14} className="text-amber-500" />
        )}
      </div>
    </button>
  );
}
