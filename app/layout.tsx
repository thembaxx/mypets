import type { Metadata, Viewport } from 'next';
import './globals.css';
import { appearanceBootstrap } from '@/lib/appearance';
import { brand } from '@/lib/brand';
import { siteOrigin, pageMetadata, structuredData, jsonLd } from '@/lib/site';
import { Analytics } from '@vercel/analytics/next';
export const metadata: Metadata = {
  ...pageMetadata(brand.title, '/'),
  metadataBase: siteOrigin ? new URL(siteOrigin) : undefined,
  applicationName: brand.name,
  category: 'pet care',
  robots: { index: Boolean(siteOrigin), follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: brand.name, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
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
      <head>
        <link rel="describedby" type="text/plain" href="/llms.txt" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structuredData()) }}
        />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
