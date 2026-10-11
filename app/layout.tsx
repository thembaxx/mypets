import type { Metadata, Viewport } from 'next';
import './globals.css';
import { appearanceBootstrap } from '@/lib/appearance';
import { brand } from '@/lib/brand';
export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description:
    'A thoughtful daily companion for your pets. Discover, plan, and learn together with care tailored to their age and breed.',
  appleWebApp: { capable: true, title: brand.name },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
        {children}
      </body>
    </html>
  );
}
