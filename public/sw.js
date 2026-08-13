const CACHE = 'lincoln-bell-live-static-v5';
const CORE = ['/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/theme-init.js'];

async function cacheIfAvailable(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await cache.put(url, response);
  } catch {
    // A single optional static asset should not prevent service-worker installation.
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const shell = await fetch('/', { cache: 'reload' });
  if (!shell.ok) throw new Error(`Could not cache app shell (${shell.status})`);

  const html = await shell.clone().text();
  await cache.put('/', shell);

  // Vite fingerprints production JS/CSS. Discover those same-origin assets from
  // the built HTML so a first successful visit is enough for the shell to boot offline.
  const assets = new Set();
  for (const match of html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/g)) assets.add(match[1]);
  await Promise.all([...CORE, ...assets].map(url => cacheIfAvailable(cache, url)));
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health'
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
