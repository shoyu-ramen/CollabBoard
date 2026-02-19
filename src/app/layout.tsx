import type { Metadata } from 'next';
import { BoardPresenceProvider } from '@/features/board/contexts/BoardPresenceProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'CollabBoard',
  description:
    'Create sticky notes, shapes, and diagrams with your team in real time. Powered by AI.',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡️</text></svg>',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <BoardPresenceProvider>{children}</BoardPresenceProvider>
          <div className="fixed bottom-16 left-3 z-50 sm:bottom-4 sm:left-4">
            <ThemeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
