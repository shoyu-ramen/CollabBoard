import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">CollabBoard</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
          <span>&#9889;</span> Real-time collaborative whiteboard
        </div>
        <h2 className="mb-4 max-w-2xl text-5xl font-bold leading-tight tracking-tight text-gray-900">
          Think together,{' '}
          <span className="text-blue-600">build together</span>
        </h2>
        <p className="mb-8 max-w-lg text-lg text-gray-500">
          Create sticky notes, shapes, and diagrams with your team in real
          time. Powered by an AI assistant that understands your whiteboard.
        </p>
        <div className="flex gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Log in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
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
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl"
                dangerouslySetInnerHTML={{ __html: feature.icon }}
              />
              <h3 className="mb-1 text-sm font-semibold text-gray-900">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        CollabBoard &mdash; Built with Next.js, Supabase, and Claude AI
      </footer>
    </div>
  );
}
