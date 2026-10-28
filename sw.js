/* Service Worker de Cap.
   Rôle : rendre l'application utilisable SANS connexion internet, une fois
   installée. Tout est mis en cache la première fois, puis servi depuis le
   téléphone. */

const CACHE = 'cap-v18';

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
      pourraient ranger d'anciens fichiers sous le nouveau numéro de version.
      Volontairement, PAS de self.skipWaiting() ici : une nouvelle version
      attend que la personne touche « Mettre à jour » sur l'accueil (voir
      l'étape 3). Rien ne change par surprise. Seule exception, fixée par
      le navigateur : si Cap est complètement fermée, la nouvelle version
      est là à la prochaine ouverture. */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: 'reload' }))))
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

/* 3. La personne a touché « Mettre à jour » : cette version prend le relais.
      La page le remarque (événement « controllerchange ») et se recharge. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'activer') self.skipWaiting();
});

/* 4. Interception des requêtes : on sert la copie rangée dans le téléphone
      (instantané, hors-ligne). On ne va sur internet que pour un fichier
      absent de la copie.
      On ne remplace JAMAIS en arrière-plan un fichier déjà rangé : sinon
      l'application changerait en douce, sans passer par « Mettre à jour ».
      On ne cherche que dans CACHE, la copie de CETTE version : pendant
      qu'une nouvelle version attend, sa copie existe déjà à côté. */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then((c) => c.match(e.request).then((enCache) => {
      if (enCache) return enCache;
      return fetch(e.request).then((rep) => {
        if (rep && rep.status === 200 && rep.type === 'basic') c.put(e.request, rep.clone());
        return rep;
      });
    }))
  );
});
