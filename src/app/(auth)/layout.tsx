export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-grouped-primary)] px-4">
      <div className="w-full max-w-sm">
        <div className="hig-rounded-2xl border border-[var(--separator-opaque)] bg-[var(--bg-grouped-secondary)] p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
