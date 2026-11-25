# Cap — notes pour Claude

PWA d'aide aux fonctions exécutives au quotidien (démarrer une tâche,
s'organiser, ne pas se perdre en route), en **HTML/CSS/JS pur, sans
dépendance ni compilation**. Projet frère de **Refuge** (aide aux crises de
surcharge sensorielle, dépôt séparé), même philosophie mais application
distincte. L'utilisatrice ou l'utilisateur est novice en programmation :
garder les commentaires en français simple, éviter le jargon.

Trois fonctions : Routines pas à pas, Tâches en petites étapes, Minuteur
visuel. Pas d'écran de connexion, pas de compte. Plusieurs fonctions
viennent de suggestions de personnes autistes : savoir ce qui vient
(« Ensuite : … », liste des étapes repliable), reprendre une routine
interrompue, passer une étape sans culpabilité, images d'étapes, durée
prévue par étape, préavis visuel du minuteur, tâche du jour épinglée sur
l'accueil.

- **Mode « Une seule chose »** (routines et tâches) : seule l'étape en
  cours, en grand, avec « Étape suivante » ; le bouton « Une seule chose » /
  « Voir tout » reste toujours en haut, au même endroit. Les éléments marqués
  `hors-une-chose` sont cachés quand l'écran porte la classe `une-chose`.
  Choix mémorisé séparément : `routineUneChose` et `tacheUneEtape`.
- **Journée difficile** : interrupteur sur l'accueil (juste au-dessus du lien
  Refuge) et dans Réglages, gardés d'accord par `data-reglage`. Les routines
  ne montrent alors que leurs étapes `essentielle` (voir `etapesDuJour()`),
  sans jamais modifier la routine enregistrée. Une routine sans étape
  essentielle reste complète. Allumé en cours de route, l'étape à l'écran
  reste affichée (`etapesMontrees()`). Ne s'éteint jamais tout seul.
- **Mini-démarrage** (tâches) : champ facultatif « Première toute petite
  action », rangé comme première étape de la tâche avec `mini: true`
  (jamais ailleurs qu'en première position). Affiché en premier, sur fond
  doux, avec l'étiquette « Pour démarrer » (aussi sur l'accueil).
- **Transitions douces** (éteintes par défaut) : entre deux étapes d'une
  routine, ou d'une tâche en mode « Une seule chose », une pause de 5 à
  30 s (`lancerPause()` / `finirPause()`), message fixe, nom de l'étape qui
  vient, barre qui se vide lentement. Un toucher la termine (sauf pendant
  les 0,6 premières secondes, contre les doubles appuis). Elle s'affiche
  sous la barre du haut : `←` reste disponible et annule la pause.
- **Modèles de routines** : Le matin, Avant de sortir, Le soir, Ménage,
  Courses, chacun avec 3 étapes essentielles proposées. Un modèle ouvre le
  formulaire pré-rempli ; rien n'est enregistré avant « Enregistrer ».
- **Temps prévu et temps réel** (tâches) : `tempsPrevu` facultatif, et un
  chrono par tâche (Commencer / Pause / Reprendre, « Remettre à zéro » en
  deux appuis) basé sur des heures (`{ cumul, depuis }`), affiché à la
  minute près. Il s'arrête tout seul quand la tâche est terminée ; l'écart
  n'est alors montré que de façon neutre (« 15 min de plus que prévu »,
  « Autant que prévu »), sans couleur ni commentaire. L'accueil signale un
  chrono qui tourne.
- **Historique** des routines terminées (pas des routines arrêtées) : date,
  heure, nom, « l'essentiel » si journée difficile. Une carte par jour,
  **aucun total, aucun compteur, aucune série** — y compris dans le résumé
  de restauration (« ton historique », sans nombre). « Vider l'historique »
  en deux appuis ; désactivable (`historiqueActif`). 500 entrées au plus.
- **Petit « ✓ Fait »** (`retourFait`, activé par défaut) : après une étape
  faite (pas passée), un fondu d'opacité en bas de l'écran, sans mouvement
  ni son (`montrerFait()`). Avec les transitions douces, il s'affiche dans
  la pause à la place. Pas de « Fait » sur l'écran de fin de routine.

## Données (localStorage)

- `cap_routines` : `[{ id, nom, etapes: [{ texte, image?, minutes?,
  essentielle? }] }]`.
  Les anciennes versions rangeaient les étapes en simple texte :
  `nettoyerRoutine()` accepte toujours les deux formes, au chargement comme
  à la restauration. Ne jamais supprimer cette compatibilité.
- `cap_taches` : `[{ id, nom, etapes: [{ texte, faite, image?, mini? }],
  termineeLe, epinglee?, tempsPrevu?, chrono? }]`. Une seule tâche peut
  être épinglée (`unSeulEpinglage()`). `mini` n'est gardé que sur la
  première étape. `chrono` : `{ cumul (ms), depuis (heure de départ ou
  null) }`.
- `cap_historique` : `[{ id, date, nom, essentiel? }]`, du plus ancien au
  plus récent, 500 au plus.
- `cap_routine_en_cours` : `{ id, index, passees }`, la routine commencée.
  Remise à zéro si la routine est modifiée ou supprimée.
- `cap_reglages` : thème, gamme, `echelle` (taille du texte), options du
  minuteur, `tacheUneEtape`, `routineUneChose`, `journeeDifficile`,
  `transitionsDouces`, `dureeTransition` (5, 10, 20 ou 30 secondes),
  `retourFait`, `historiqueActif`.
- Sauvegarde : contient routines, tâches, réglages **et historique** ; la
  restauration ajoute sans doublon (même identifiant).
- Sauvegarde : fichier version 3 ; les fichiers version 1 et 2 se
  restaurent toujours.
- ⚠️ Les fonctions `nettoyer…()` d'`app.js` ne gardent **que** les champs
  qu'elles connaissent, au chargement comme à la restauration (y compris la
  liste blanche des réglages dans `nettoyerReglages()`). Tout nouveau champ
  doit y être ajouté, sinon il disparaît au rechargement suivant.

## Contraintes de conception à préserver

- **Tutoiement : l'application tutoie la personne**, comme Refuge. Tout
  texte qui s'adresse à elle (boutons, explications, messages d'erreur,
  annonces pour lecteur d'écran) dit « tu » : « Choisis une durée »,
  « Donne un nom à la routine ».
- **Images d'étapes : des émojis désaturés.** Ils sont choisis dans la
  liste `PICTOS` d'`app.js` et toujours affichés avec la classe `.picto`,
  qui les désature (`filter: saturate(…)`) pour respecter la règle
  « aucune couleur vive ». Toute nouvelle image passe par cette classe.
- **Aucun compte, aucun appel réseau, aucun traceur, aucune publicité.** Tout
  reste en `localStorage` : rien ne quitte l'appareil.
- **Aucun blanc pur ni noir pur, aucune couleur vive.** Le public visé
  compte beaucoup de personnes autistes, dont certaines très sensibles aux
  couleurs vives. `styles.css` définit plusieurs gammes désaturées
  (froides : `bleu`, `sauge`, `lavande` ; chaudes : `sable`, `peche`,
  `miel`, `rose`), chacune en version sombre et claire. En sombre, les
  accents sont des pastels (clairs, peu saturés) pour rester lisibles sur
  fond foncé. Choisies dans Réglages et appliquées via `data-mode="<gamme>-
  <sombre|clair>"` sur `<html>` (voir `themeEffectif()` /
  `appliquerApparence()` dans `app.js`, et `theme-init.js` chargé dans le
  `<head>` de `index.html` pour éviter un flash de mauvaises couleurs).
  Toute nouvelle gamme ajoutée doit rester dans la même plage de
  saturation et de contraste que les existantes — jamais un accent saturé
  ou un fond franc. Le texte secondaire `--texte-doux` garde un contraste
  ≥ 4,5:1 sur `--bg`, `--surface`, `--surface-2` et `--accent-fond`
  (norme WCAG AA), en clair comme en sombre. Les cases à cocher sont
  redessinées en CSS (`appearance: none`) : celles du navigateur sont d'un
  blanc pur en thème clair. Ne pas revenir aux cases natives.
- **Animations lentes et régulières**, jamais brusques ;
  `prefers-reduced-motion` pleinement respecté.
- **Zones tactiles ≥ 60 px.**
- **Jamais de son.** Le seul signal de fin de minuteur est une vibration
  courte (optionnelle, réglable) et un changement de couleur de l'anneau —
  pas de fichier audio, pas d'API `Audio`. La même vibration (même réglage)
  marque la fin du temps prévu pour une étape de routine. Le préavis avant
  la fin est **uniquement visuel** : teinte de l'anneau qui glisse
  lentement, et temps restant écrit en mots, à la minute près.
- **Ne jamais pousser à passer à la suite.** Quand le temps prévu d'une
  étape est écoulé, l'étape reste affichée : c'est la personne qui décide.
  Pas de séries de jours, de points ni de badges : ça crée de la pression
  et de la culpabilité.
- **Pas de notifications programmées.** Peu fiable sur Android quand l'app
  est fermée ; volontairement laissé de côté pour l'instant. Ne pas ajouter
  `Notification` ou `setTimeout`/`setInterval` de longue durée qui suppose
  que l'app reste ouverte en arrière-plan au-delà de l'onglet actif.
- **Retour à l'accueil en un geste** depuis n'importe quel écran (bouton
  `←` en haut de chaque vue secondaire, touche `Échap` et bouton Retour du
  navigateur/Android via `history.pushState`/`popstate` à un niveau). Ne pas
  introduire de menu ou de navigation imbriquée plus complexe. L'ouverture
  d'une vue par `?vue=` (`minuteur`, `taches`, `routines`, `reglages`, avec
  repli vers l'accueil sinon) sert aux raccourcis du manifeste. `afficherVue()`
  met à jour `document.title` et restaure le focus à l'accueil. Pendant une
  routine, `←`, `Échap` et `popstate` gardent la progression ; l'accueil
  propose alors « Reprendre ».
- **Sécurité et robustesse `localStorage`** : `index.html` pose une politique
  CSP stricte (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`,
  `img-src 'self'`, `connect-src 'self'`, `object-src 'none'`,
  `base-uri 'none'`, `manifest-src 'self'`, `worker-src 'self'`), sans
  aucun `<script>`/`<style>`/`style="..."`/`on*=` inline. `echapper()` neutralise
  `&`, `<`, `>`, `"` et `'`, y compris pour `r.id`/`t.id` dans les rendus HTML.
  Toutes les écritures/suppressions `localStorage` passent par
  `ecrireStockage()` / `supprimerStockage()` (`try/catch`), avec alerte calme
  non bloquante (`#alerte-stockage`) en cas de mémoire pleine et rollback
  mémoire dans `confirmerRestauration()`.
- **Suppression = deux appuis.** Utiliser `armerSuppression()` (déjà dans
  `app.js`) pour toute action destructive, jamais un `confirm()` natif.
  « Arrêter la routine » (qui fait perdre la progression) suit la même règle.
- **Minuteur et écran verrouillé.** Une PWA ne peut rien afficher sur
  l'écran verrouillé. Écartés délibérément : une notification (règle
  « pas de notification ») et un faux lecteur audio via Media Session
  (règle « jamais de son »). Retenu : l'option « Garder l'écran allumé
  pendant le minuteur » (Wake Lock, décochée par défaut). Le verrou n'est
  tenu que pendant que le minuteur tourne (rendu en pause et à l'arrêt),
  plus une minute après la fin pour que le changement de couleur soit vu ;
  il est repris au retour dans l'app (`visibilitychange`).
- **Minuteur : la fin de compte est basée sur une date d'arrivée**
  (`Date.now() + durée`), jamais sur un simple compteur qui descend à chaque
  tick — sinon changer d'écran ou verrouiller le téléphone fausse le temps
  restant.

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`,
`theme-init.js`, `app.js`, `styles.css`, `manifest.json`, les 5 icônes dans
`icons/`), incrémenter la constante en haut de `sw.js` :

```js
const CACHE = 'cap-v21';   // → v22
```

Sans ce changement, le navigateur ne retélécharge rien. En cas d'**ajout de
fichier**, l'inscrire aussi dans la liste `FICHIERS` du même fichier. **Ne
pas** incrémenter pour un changement hors cache (`README.md`, `CLAUDE.md`,
`GUIDE-GITHUB.md`, `LICENSE`, `tests/`, `.github/`, `package.json`,
`.gitattributes`, `.nojekyll`, `.gitignore`).

## Nouvelle version : jamais de changement par surprise

Une nouvelle version **attend** que la personne touche « Mettre à jour »
(carte `#accueil-mise-a-jour`, sur l'accueil seulement, cachée pendant un
minuteur et après « Plus tard »), **même si Cap est fermée puis rouverte**.
- `sw.js` note la copie EN SERVICE dans le cache `cap-choix` ; le `fetch`
  sert cette copie, jamais une autre. Un service worker plus récent, activé
  par le navigateur à la réouverture, continue donc de servir l'ancienne.
- Messages page ↔ service worker, **noms à ne jamais changer** (une ancienne
  page doit pouvoir parler à un service worker plus récent) : `etat`
  (réponse `{ nouvelleVersion }`), `activer` (la personne a accepté),
  `recharger` (envoyé aux pages après acceptation).
- Pas de `self.skipWaiting()` dans l'installation ; ne jamais remplacer un
  fichier rangé en arrière-plan.

## Tester en local et en CI

Le dépôt inclut une suite de tests statiques et de tests navigateur Playwright
(sans dépendance applicative) :
- `npm run test:static` : vérifie `tests/static.test.mjs` (CSP, zéro inline,
  `sw.js` `cap-v21`, manifeste, icônes PNG, contrastes CSS, zéro son,
  `LICENSE` intact).
- `npm run test:e2e` : vérifie `tests/e2e.test.mjs` sous Chromium (CSP, hors
  ligne + `?vue=`, 14 thèmes WCAG AA, cibles ≥ 60 px en `390×844` et
  `320×640` à `echelle: 1.35`, routines/tâches/minuteur, sauvegarde/restauration
  v1/v2/v3, `Échap`/`popstate` sans perte de progression, `QuotaExceededError`).
- `npm test` : lance les deux suites.
- `.github/workflows/ci.yml` : exécute `npm run test:static` et
  `npm run test:e2e` sur `ubuntu-latest` à chaque push et pull request.

Un service worker ne fonctionne **que** sur `https://` ou `http://localhost`,
jamais en `file://` : pour tester manuellement l'installation et le mode hors
ligne, servir le dossier par un petit serveur HTTP local (par exemple
`python3 -m http.server`).

Déploiement : GitHub Pages, branche `main`, racine.

`GUIDE-GITHUB.md` explique comment publier et modifier l'application
**entièrement depuis un téléphone Android**, via l'interface web de GitHub,
sans ordinateur ni ligne de commande.
