import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BoardPresenceProvider } from '@/features/board/contexts/BoardPresenceProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'CollabBoard - Real-time Collaborative Whiteboard',
  description:
    'Create sticky notes, shapes, and diagrams with your team in real time. Powered by AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <BoardPresenceProvider>{children}</BoardPresenceProvider>
      </body>
    </html>
  );
}
