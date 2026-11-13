/*
 * Service worker : le site reste consultable sans connexion après une première visite.
 * - Page et données de situation : réseau d'abord (toujours la version la plus récente),
 *   puis cache si la connexion échoue.
 * - Fichiers statiques : cache d'abord, mis à jour en arrière-plan.
 * Changer VERSION force le renouvellement du cache.
 */
var VERSION = 'rdc-v1';
var FICHIERS = [
  './',
  'index.html',
  'css/style.css',
  'js/carte.js',
  'js/panneau.js',
  'js/actualites.js',
  'js/app.js',
  'data/territoires.json',
  'data/zones.json',
  'manifest.webmanifest',
  'icons/icone.svg',
  'icons/icone-192.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FICHIERS); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function reseauDabord(requete) {
  return fetch(requete).then(function (rep) {
    if (rep.ok) {
      var copie = rep.clone();
      caches.open(VERSION).then(function (c) { c.put(requete, copie); });
    }
    return rep;
  }).catch(function () {
    return caches.match(requete, { ignoreSearch: true }).then(function (rep) {
      return rep || caches.match('index.html');
    });
  });
}

function cacheDabord(requete) {
  return caches.match(requete).then(function (enCache) {
    var reseau = fetch(requete).then(function (rep) {
      if (rep.ok) {
        var copie = rep.clone();
        caches.open(VERSION).then(function (c) { c.put(requete, copie); });
      }
      return rep;
    }).catch(function () { return enCache; });
    return enCache || reseau;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API externes : gérées par la page
  if (req.mode === 'navigate' || /zones\.json$/.test(url.pathname)) {
    e.respondWith(reseauDabord(req));
  } else {
    e.respondWith(cacheDabord(req));
  }
});
