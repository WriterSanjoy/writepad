// WritePad Service Worker
// Provides offline support by caching the app shell

const CACHE_NAME = 'writepad-v1';

// Files to cache on install
const SHELL_FILES = [
  '/writepad/',
  '/writepad/index.html',
  '/writepad/manifest.json',
];

// ── Install — cache app shell ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES).catch(() => {
        // Silently fail if some files aren't available yet
      });
    })
  );
  self.skipWaiting();
});

// ── Activate — clean old caches ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch — serve from cache, fall back to network ────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Google APIs (OAuth, Drive)
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('accounts.google.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('api.pcloud.com') ||
      url.hostname.includes('eapi.pcloud.com')) {
    return; // Let browser handle normally
  }

  // For everything else: cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for app files
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index.html for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/writepad/index.html');
        }
      });
    })
  );
});
