import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Total Business Centres CRM',
  description: 'Business centre CRM built with Next.js, TypeScript and Tailwind CSS'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
