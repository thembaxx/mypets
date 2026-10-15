import type { Metadata } from 'next';
import { brand } from './brand';

export function parseSiteOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment.',
    );
  }
  return url.origin;
}
export const siteOrigin = parseSiteOrigin(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mypets-pi.vercel.app',
);
export const publicUrl = (path: string) => (siteOrigin ? new URL(path, siteOrigin).href : path);
export function pageMetadata(title: string, path: string): Metadata {
  return {
    title: { absolute: title },
    description: brand.description,
    ...(siteOrigin ? { alternates: { canonical: publicUrl(path) } } : {}),
    openGraph: {
      type: 'website',
      siteName: brand.name,
      locale: brand.locale,
      title,
      description: brand.description,
      ...(siteOrigin
        ? {
            url: publicUrl(path),
            images: [
              {
                url: publicUrl('/social.png'),
                width: 1200,
                height: 630,
                alt: `${brand.name}: ${brand.tagline}`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: brand.description,
      ...(siteOrigin ? { images: [publicUrl('/social.png')] } : {}),
    },
  };
}
export function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: brand.name,
        description: brand.description,
        inLanguage: brand.language,
        ...(siteOrigin ? { '@id': publicUrl('/#website'), url: publicUrl('/') } : {}),
      },
      {
        '@type': 'WebApplication',
        name: brand.name,
        description: brand.description,
        applicationCategory: brand.category,
        operatingSystem: 'Web browser',
        inLanguage: brand.language,
        featureList: brand.features,
        ...(siteOrigin ? { '@id': publicUrl('/#application'), url: publicUrl('/') } : {}),
      },
    ],
  };
}
export const jsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
