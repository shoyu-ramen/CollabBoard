'use client';

interface AIButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function AIButton({ onClick, isOpen }: AIButtonProps) {
  if (isOpen) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-16 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--system-blue)] text-white shadow-lg transition-all hig-pressable sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      title="Open AI Assistant"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </button>
  );
}
