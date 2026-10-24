/* Service Worker de Cap.
   Rôle : rendre l'application utilisable SANS connexion internet, une fois
   installée. Tout est mis en cache la première fois, puis servi depuis le
   téléphone. */

const CACHE = 'cap-v16';

/* La liste des fichiers indispensables au fonctionnement hors-ligne.
   Si on ajoute un fichier au projet, il faut aussi l'ajouter ici. */
const FICHIERS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* 1. Installation : on télécharge et on range tout dans le cache.
      { cache: 'reload' } oblige à reprendre chaque fichier sur le serveur,
      sans passer par le petit cache du navigateur (GitHub Pages le garde
      10 minutes) : sinon, deux mises à jour publiées coup sur coup
      pourraient ranger d'anciens fichiers sous le nouveau numéro de version. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

/* 2. Activation : on supprime NOS anciens caches d'une version précédente,
      et seulement eux. Toutes les applications de ferrusdantioch.github.io
      partagent la même liste de caches : supprimer tout ce qui n'est pas
      CACHE effacerait aussi la copie hors ligne des autres applications.
      On ne touche donc qu'aux noms qui commencent par « cap-v ». */
const PREFIXE = 'cap-v';

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles
        .filter((k) => k !== CACHE && k.startsWith(PREFIXE))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 3. Interception des requêtes : on sert d'abord le cache (instantané, hors-ligne),
      et on rafraîchit discrètement en arrière-plan si le réseau répond. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((enCache) => {
      const surLeReseau = fetch(e.request)
        .then((rep) => {
          if (rep && rep.status === 200 && rep.type === 'basic') {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copie));
          }
          return rep;
        })
        .catch(() => enCache);
      return enCache || surLeReseau;
    })
  );
});
