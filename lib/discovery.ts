import { brand } from './brand';
import { publicUrl } from './site';

export function overviewMarkdown() {
  return `# ${brand.name}

> ${brand.description}

${brand.tagline}

## Features

${brand.features.map((feature) => `- ${feature}`).join('\n')}

## Scope and privacy

${brand.limits.map((limit) => `- ${limit}`).join('\n')}

## Sources

${brand.sources.map(([label, url]) => `- [${label}](${url})`).join('\n')}
`;
}
export function llmsIndex() {
  return `# ${brand.name}

> ${brand.description}

${brand.tagline}

${brand.limits.join(' ')}

## Product

- [Overview](${publicUrl('/about/')}): Features, sources, scope and privacy.
- [Plain-text overview](${publicUrl('/about.md')}): The same public product information without application state.
- [Open the app](${publicUrl('/')}): Interactive experience; requires JavaScript.

## Optional

- [Full public context](${publicUrl('/llms-full.txt')}): Combined feature and source documentation.
`;
}
export function llmsFull() {
  return overviewMarkdown();
}
export function textResponse(content: string) {
  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      Link: '</llms.txt>; rel="describedby"',
    },
  });
}
