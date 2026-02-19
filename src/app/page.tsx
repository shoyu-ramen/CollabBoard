import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="hig-material-chrome border-b border-[var(--separator)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <h1 className="text-lg font-bold text-[var(--label-primary)] sm:text-xl">CollabBoard</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="bg-[var(--fill-tertiary)] hig-rounded-md hig-pressable px-3 py-2 text-sm font-medium text-[var(--label-primary)] sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-[var(--system-blue)] hig-rounded-md hig-pressable min-h-[44px] flex items-center px-3 py-2 text-sm font-medium text-white sm:px-4"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-6 sm:py-24">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--system-blue)]/10 px-3 py-1 text-xs text-[var(--system-blue)] sm:mb-4 sm:text-sm">
          <span>&#9889;</span> Real-time collaborative whiteboard
        </div>
        <h2 className="hig-large-title mb-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--label-primary)] sm:mb-4 sm:text-5xl">
          Think together,{' '}
          <span className="text-[var(--system-blue)]">build together</span>
        </h2>
        <p className="mb-6 max-w-lg text-base text-[var(--label-secondary)] sm:mb-8 sm:text-lg">
          Create sticky notes, shapes, and diagrams with your team in real
          time. Powered by an AI assistant that understands your whiteboard.
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="bg-[var(--system-blue)] hig-rounded-md hig-pressable min-h-[44px] flex items-center px-5 py-2.5 text-sm font-semibold text-white shadow-sm sm:px-6 sm:py-3"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="bg-[var(--fill-tertiary)] hig-rounded-md hig-pressable min-h-[44px] flex items-center px-5 py-2.5 text-sm font-semibold text-[var(--label-primary)] sm:px-6 sm:py-3"
          >
            Log in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-12 grid max-w-4xl grid-cols-1 gap-6 sm:mt-20 sm:grid-cols-3 sm:gap-8">
          {[
            {
              icon: '&#128466;',
              title: 'Infinite Canvas',
              desc: 'Pan, zoom, and create without limits. Sticky notes, shapes, frames, and connectors.',
            },
            {
              icon: '&#128101;',
              title: 'Real-time Sync',
              desc: 'See cursors, changes, and presence instantly. Collaboration with <100ms latency.',
            },
            {
              icon: '&#129302;',
              title: 'AI Assistant',
              desc: 'Ask the AI to create templates, arrange layouts, or generate SWOT analyses.',
            },
          ].map((feature) => (
            <div key={feature.title} className="text-center">
              <div
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--system-blue)]/10 text-2xl"
                dangerouslySetInnerHTML={{ __html: feature.icon }}
              />
              <h3 className="hig-subheadline mb-1 text-sm font-semibold text-[var(--label-primary)]">
                {feature.title}
              </h3>
              <p className="hig-footnote text-sm text-[var(--label-secondary)]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="hig-caption1 border-t border-[var(--separator)] py-6 text-center text-xs text-[var(--label-tertiary)]">
        CollabBoard &mdash; Built with Next.js, Supabase, and Claude AI
      </footer>
    </div>
  );
}
