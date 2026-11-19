/*****************************************************************
 * SERVICE WORKER — hace que la app abra sin señal.
 * Guarda una copia de los archivos (también el generador de PDF).
 * Con señal trae la versión más reciente; sin señal (o si la red
 * tarda más de 3 segundos) usa la copia guardada.
 * Si cambias algún archivo, sube el número de VERSION.
 *****************************************************************/

const NOMBRE = 'hojas-vida';
const VERSION = NOMBRE + '-v14';

const ARCHIVOS = [
  './', 'index.html', 'app.js', 'iconos.js', 'config.js', 'manifest.webmanifest', 'logo.jpg', 'logo-pdf.png',
  'icon-192.png?v=20261119', 'icon-512.png?v=20261119', 'icon-maskable-512.png?v=20261119',
  'lib/jspdf.umd.min.js', 'lib/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(VERSION).then(function(cache) {
      return cache.addAll(ARCHIVOS.map(function(url) { return new Request(url, { cache: 'reload' }); }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(claves) {
      // Solo se borran las copias viejas de ESTA app (las otras apps del portal no se tocan)
      return Promise.all(claves.filter(function(k) { return k.indexOf(NOMBRE + '-') === 0 && k !== VERSION; })
        .map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La letra de Google se guarda al usarla, para tenerla sin señal
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(VERSION + '-letra').then(function(cache) {
      return cache.match(req).then(function(r) {
        return r || fetch(req).then(function(resp) { cache.put(req, resp.clone()); return resp; }).catch(function() { return r; });
      });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(new Promise(function(resolve) {
    let listo = false;
    const deCache = function() {
      return caches.match(req, { ignoreSearch: false }).then(function(r) { return r || caches.match('index.html'); });
    };
    const t = setTimeout(function() { deCache().then(function(r) { if (r && !listo) { listo = true; resolve(r); } }); }, 3000);
    fetch(req).then(function(resp) {
      clearTimeout(t);
      if (resp && resp.ok) { const copia = resp.clone(); caches.open(VERSION).then(function(c) { c.put(req, copia); }); }
      if (!listo) { listo = true; resolve(resp); }
    }).catch(function() {
      clearTimeout(t);
      deCache().then(function(r) { if (!listo) { listo = true; resolve(r || Response.error()); } });
    });
  }));
});
