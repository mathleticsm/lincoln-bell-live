const CACHE = 'lincoln-bell-live-static-v6';

const CORE = [
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/theme-init.js'
];

async function cacheIfAvailable(cache, url) {
  try {
    const response = await fetch(url, { cache: 'reload' });

    if (response.ok) {
      await cache.put(url, response);
    }
  } catch {
    // Optional static assets should not prevent service-worker installation.
  }
}

async function precacheAppShell() {
  const cache = await caches.open(CACHE);

  const shell = await fetch('/', { cache: 'reload' });

  if (!shell.ok) {
    throw new Error(`Could not cache app shell (${shell.status})`);
  }

  const html = await shell.clone().text();

  await cache.put('/', shell);

  // Discover Vite's hashed production JS/CSS files from the generated HTML.
  const assets = new Set();

  for (
    const match of html.matchAll(
      /\b(?:src|href)=["'](\/assets\/[^"']+)["']/g
    )
  ) {
    assets.add(match[1]);
  }

  await Promise.all(
    [...CORE, ...assets].map(url => cacheIfAvailable(cache, url))
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    precacheAppShell().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health'
  ) {
    return;
  }

  // SPA navigations: /, /bells, /calendar, /about, etc.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            event.waitUntil(
              caches
                .open(CACHE)
                .then(cache => cache.put('/', copy))
            );
          }

          return response;
        })
        .catch(async () => {
          const shell = await caches.match('/');

          if (shell) {
            return shell;
          }

          return new Response(
            `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#0b1118">
  <title>Lincoln Bell Live — Offline</title>
</head>
<body>
  <main>
    <h1>You're offline</h1>
    <p>
      Lincoln Bell Live couldn't load this page.
      Reconnect to the internet and try again.
    </p>
  </main>
</body>
</html>`,
            {
              status: 503,
              statusText: 'Offline',
              headers: {
                'Content-Type': 'text/html; charset=utf-8'
              }
            }
          );
        })
    );

    return;
  }

  // Static assets: network first, then cache.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          event.waitUntil(
            caches
              .open(CACHE)
              .then(cache => cache.put(event.request, copy))
          );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) {
          return cached;
        }

        return new Response('', {
          status: 503,
          statusText: 'Offline'
        });
      })
  );
});
