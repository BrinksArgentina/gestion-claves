// BRINKS KEYS — Service Worker
// Versión del caché: incrementar cuando haya cambios en el HTML/CSS/JS
const CACHE_NAME = 'brinks-keys-v1';

// Archivos que se cachean al instalar (shell de la app)
const SHELL_ASSETS = [
  './scanner.html',
  './manifest.json'
];

// ─── INSTALL: cachear el shell de la app ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => {
      // Activar inmediatamente sin esperar al cierre de otras pestañas
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE: limpiar cachés viejos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => {
      // Tomar control de todas las pestañas abiertas de inmediato
      return self.clients.claim();
    })
  );
});

// ─── FETCH: estrategia Network-first con fallback a caché ────────────────────
// Para las llamadas al backend (Google Apps Script) siempre va a la red.
// Para los assets de la app (HTML, manifest) intenta red primero; si falla,
// sirve desde caché para que la app funcione offline (muestra la UI aunque
// no pueda validar hasta tener conexión).
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Llamadas al backend → siempre red, nunca caché
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('api.qrserver.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Assets de la app → Network-first, caché como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, actualizamos el caché
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red → devolver desde caché
        return caches.match(event.request);
      })
  );
});
