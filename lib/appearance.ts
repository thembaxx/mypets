import type { Appearance } from './storage';
export const themeColors = { light: '#f7f7f2', dark: '#171c19' };
export function applyAppearance(appearance: Appearance) {
  const theme =
    appearance === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : appearance;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector<HTMLLinkElement>('link[rel="manifest"]')
    ?.setAttribute(
      'href',
      theme === 'dark' ? '/manifest-dark.webmanifest' : '/manifest.webmanifest',
    );
  document
    .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.content = themeColors[theme];
  });
}
// These adaptive head elements are owned by this script, so React's metadata hydration cannot duplicate them.
// Runs before the first paint, including the offline shell. No user-controlled HTML is inserted.
export const appearanceBootstrap = `(function(){var p;try{p=JSON.parse(localStorage.getItem('mypets-v1')||'{}').appearance;}catch(e){}var t=p==='dark'||p==='light'?p:matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;var l=document.querySelector('link[rel="manifest"]');if(!l){l=document.createElement('link');l.rel='manifest';document.head.appendChild(l);}l.href=t==='dark'?'/manifest-dark.webmanifest':'/manifest.webmanifest';function meta(n,v){var m=document.querySelector('meta[name="'+n+'"]');if(!m){m=document.createElement('meta');m.name=n;document.head.appendChild(m);}m.content=v;}meta('apple-mobile-web-app-status-bar-style',t==='dark'?'black-translucent':'default');meta('theme-color',t==='dark'?'#171c19':'#f7f7f2');})();`;
