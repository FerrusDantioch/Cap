# Cap — notes pour Claude

PWA d'aide aux fonctions exécutives au quotidien (démarrer une tâche,
s'organiser, ne pas se perdre en route), en **HTML/CSS/JS pur, sans
dépendance ni compilation**. Projet frère de **Refuge** (aide aux crises de
surcharge sensorielle, dépôt séparé), même philosophie mais application
distincte. L'utilisatrice ou l'utilisateur est novice en programmation :
garder les commentaires en français simple, éviter le jargon.

Trois fonctions : Routines pas à pas, Tâches en petites étapes, Minuteur
visuel. Pas d'écran de connexion, pas de compte.

## Contraintes de conception à préserver

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
  `appliquerApparence()` dans `app.js`, et le petit script identique dans
  le `<head>` de `index.html` qui évite un flash de mauvaises couleurs).
  Toute nouvelle gamme ajoutée doit rester dans la même plage de
  saturation et de contraste que les existantes — jamais un accent saturé
  ou un fond franc.
- **Animations lentes et régulières**, jamais brusques ;
  `prefers-reduced-motion` pleinement respecté.
- **Zones tactiles ≥ 60 px.**
- **Jamais de son.** Le seul signal de fin de minuteur est une vibration
  courte (optionnelle, réglable) et un changement de couleur de l'anneau —
  pas de fichier audio, pas d'API `Audio`.
- **Pas de notifications programmées.** Peu fiable sur Android quand l'app
  est fermée ; volontairement laissé de côté pour l'instant. Ne pas ajouter
  `Notification` ou `setTimeout`/`setInterval` de longue durée qui suppose
  que l'app reste ouverte en arrière-plan au-delà de l'onglet actif.
- **Retour à l'accueil en un geste** depuis n'importe quel écran (bouton
  `←` en haut de chaque vue secondaire). Ne pas introduire de menu ou de
  navigation imbriquée plus complexe.
- **Suppression = deux appuis.** Utiliser `armerSuppression()` (déjà dans
  `app.js`) pour toute action destructive, jamais un `confirm()` natif.
- **Minuteur : la fin de compte est basée sur une date d'arrivée**
  (`Date.now() + durée`), jamais sur un simple compteur qui descend à chaque
  tick — sinon changer d'écran ou verrouiller le téléphone fausse le temps
  restant.

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`,
`app.js`, `styles.css`, `manifest.json`, icônes), incrémenter la constante en
haut de `sw.js` :

```js
const CACHE = 'cap-v1';   // → v2
```

Sans ce changement, le navigateur ne retélécharge rien. En cas d'**ajout de
fichier**, l'inscrire aussi dans la liste `FICHIERS` du même fichier. **Ne
pas** incrémenter pour un changement hors cache (README, GUIDE-GITHUB.md,
LICENSE).

## Tester en local

Ce dépôt ne contient pas de serveur de test. Un service worker ne fonctionne
**que** sur `https://` ou `http://localhost`, jamais en `file://` : servir le
dossier par un petit serveur HTTP local (par exemple `python3 -m http.server`)
pour vérifier l'installation et le mode hors ligne.

Déploiement : GitHub Pages, branche `main`, racine.

`GUIDE-GITHUB.md` explique comment publier et modifier l'application
**entièrement depuis un téléphone Android**, via l'interface web de GitHub,
sans ordinateur ni ligne de commande.
