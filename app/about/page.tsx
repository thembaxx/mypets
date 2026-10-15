import Link from 'next/link';
import { brand } from '@/lib/brand';
import { pageMetadata } from '@/lib/site';
export const metadata = pageMetadata(
  `About ${brand.name} — features, sources & privacy`,
  '/about/',
);
export default function AboutPage() {
  return (
    <main className="public-overview">
      <nav aria-label="Product">
        <Link href="/">Open {brand.name}</Link>
      </nav>
      <h1>{brand.name}</h1>
      <p className="overview-tagline">{brand.tagline}</p>
      <p>{brand.description}</p>
      <h2>What you can do</h2>
      <ul>
        {brand.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <h2>Scope and privacy</h2>
      <ul>
        {brand.limits.map((limit) => (
          <li key={limit}>{limit}</li>
        ))}
      </ul>
      <h2>Sources</h2>
      <ul>
        {brand.sources.map(([label, url]) => (
          <li key={url}>
            <a href={url}>{label}</a>
          </li>
        ))}
      </ul>
      <footer>
        <a href="/about.md">Plain-text overview</a> · <a href="/llms.txt">AI-readable index</a>
      </footer>
    </main>
  );
}
