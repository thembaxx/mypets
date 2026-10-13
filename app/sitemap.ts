import type { MetadataRoute } from 'next';
import { siteOrigin, publicUrl } from '@/lib/site';
export const dynamic = 'force-static';
export default function sitemap(): MetadataRoute.Sitemap {
  return siteOrigin ? ['/', '/about/'].map((path) => ({ url: publicUrl(path) })) : [];
}
