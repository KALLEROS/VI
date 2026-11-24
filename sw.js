// Service worker: deja la app usable sin conexión.
// - La "cáscara" (HTML, CSS, JS, datos) se pide primero a la red y, si falla, sale de la caché.
// - Las teselas del mapa casi nunca cambian: se sirven desde la caché y se guardan al verlas.
// - Al instalar se guardan las teselas de zoom 0 a 3 (todo el mapa a vista general).
var VERSION = 'mapa-vi-v1';
var CASCARA = ['./', './index.html', './css/estilos.css', './js/app.js', './manifest.webmanifest',
  './data/locations.json', './data/trucos.json', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './icons/apple-touch-icon.png', './icons/icon-512-maskable.png', './icons/icon-192.png', './icons/icon-512.png'];

// Teselas de zoom 0–3. Mismas medidas que en app.js: 14336 x 18432 m, 64 m/px a zoom 0.
function teselasBase() {
  var lista = [];
  for (var z = 0; z <= 3; z++) {
    var metros = 256 * 64 / Math.pow(2, z);
    var nx = Math.ceil(14336 / metros), ny = Math.ceil(18432 / metros);
    for (var x = 0; x < nx; x++) for (var y = 0; y < ny; y++) lista.push('./tiles/' + z + '/' + x + '/' + y + '.jpg');
  }
  return lista;
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CASCARA.concat(teselasBase())); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Teselas: primero caché
  if (url.pathname.indexOf('/tiles/') !== -1) {
    e.respondWith(caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (res) {
        if (res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copia); }); }
        return res;
      });
    }));
    return;
  }

  // Todo lo demás: primero red (para recibir actualizaciones), si no hay señal, caché
  e.respondWith(fetch(e.request).then(function (res) {
    if (res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copia); }); }
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('./index.html'); });
  }));
});
