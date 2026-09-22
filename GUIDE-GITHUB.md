# Cap

Application web (PWA) d'aide aux fonctions exécutives au quotidien :
routines pas à pas, tâches découpées en petites étapes, minuteur visuel.
Fonctionne hors-ligne, sans compte, sans traceur. Toutes les données restent
sur le téléphone.

Ce guide explique comment publier et modifier Cap **entièrement depuis un
téléphone Android**, via l'interface web de GitHub, sans ordinateur ni ligne
de commande — exactement comme pour Refuge.

## Publier cette application (depuis un téléphone Android)

### 1. Créer le dépôt

1. Ouvrez **github.com** dans Chrome, connectez-vous.
2. Touchez le **+** en haut à droite → **New repository**.
3. **Repository name** : `Cap`
4. Cochez **Public**. *(GitHub Pages n'est gratuit que sur les dépôts publics.)*
5. Ne cochez rien d'autre. Touchez **Create repository**.

### 2. Envoyer les fichiers

1. Décompressez `cap-a-plat.zip` sur votre téléphone
   (Gestionnaire de fichiers → appui long sur le zip → **Extraire**).
2. Sur la page de votre dépôt, touchez **Add file** → **Upload files**.
   *Si vous ne voyez pas ce bouton : menu ⋮ de Chrome → cochez
   « Version pour ordinateur ».*
3. Touchez **choose your files**, ouvrez le dossier décompressé, puis
   **sélectionnez les 7 fichiers** (appui long sur le premier, puis touchez
   les autres).
4. Descendez, touchez **Commit changes**.

> ⚠️ Les fichiers doivent être **à la racine** du dépôt, pas dans un
> sous-dossier. C'est pour cela que cette archive n'a pas de dossier `icons/`.
> L'envoi depuis un téléphone ne sait pas créer de sous-dossier : prenez
> toujours l'archive **à plat** (`cap-a-plat.zip`).
>
> L'autre archive, `cap-avec-dossier-icons.zip`, range les deux icônes dans
> un sous-dossier `icons/` — plus propre, mais seulement utilisable depuis un
> ordinateur (ligne de commande `git`, ou GitHub Desktop).

### 3. Activer GitHub Pages

1. Onglet **Settings** du dépôt (roue dentée).
2. Menu de gauche → **Pages**.
3. **Source** : `Deploy from a branch`.
4. **Branch** : `main`, dossier `/ (root)`. Touchez **Save**.
5. Patientez 1 à 2 minutes, puis rechargez la page : l'adresse apparaît en haut.

Elle ressemble à : `https://votre-pseudo.github.io/Cap/`

### 4. Installer sur l'écran d'accueil

1. Ouvrez cette adresse dans Chrome.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** → **Installer**.

L'icône apparaît sur votre écran d'accueil. L'application s'ouvre en plein
écran et fonctionne **sans connexion**.

---

## Modifier l'application plus tard

Gros avantage de GitHub : **vous pouvez éditer directement depuis le
téléphone**, sans rien réenvoyer.

1. Sur GitHub, ouvrez le fichier (`index.html` pour les textes,
   `styles.css` pour les couleurs, `app.js` pour le comportement).
2. Touchez le **crayon** ✏️ en haut à droite.
3. Modifiez, puis **Commit changes**.

**À faire à chaque modification d'un fichier mis en cache** (`index.html`,
`styles.css`, `app.js`, `manifest.json`, les icônes) : ouvrez `sw.js` et
incrémentez la version, tout en haut :

```js
const CACHE = 'cap-v1';   →   const CACHE = 'cap-v2';
```

Sans cela, votre téléphone continue d'afficher l'ancienne version qu'il garde
en mémoire. Comptez 1 à 2 minutes après chaque commit pour que GitHub Pages
republie.

---

## Mettre à jour une application déjà publiée

Si Cap est déjà en ligne et que vous voulez installer une nouvelle version :

1. Décompressez la nouvelle archive sur le téléphone.
2. Sur votre dépôt GitHub : **Add file** → **Upload files**.
3. Sélectionnez les **mêmes 7 fichiers** que la première fois. GitHub
   **remplace** les anciens automatiquement : il n'y a rien à supprimer.
4. **Commit changes**, puis attendez 1 à 2 minutes.
5. Sur le téléphone, ouvrez l'application et **fermez-la complètement**
   (bouton carré d'Android → balayer la fenêtre), puis rouvrez-la. La nouvelle
   version s'installe au second lancement.

Vos données ne sont pas touchées : les routines, les tâches et les réglages
vivent dans le téléphone, pas dans les fichiers du dépôt.

---

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans et **tous les textes affichés** |
| `styles.css` | Couleurs, tailles, mise en page (tout est en haut du fichier) |
| `app.js` | Le comportement : routines, tâches, minuteur |
| `sw.js` | Le mode hors-ligne |
| `manifest.json` | Nom et icône de l'application |
| `icon-192.png` `icon-512.png` | Les icônes |

Tout le code est commenté en français.

---

## En cas de problème

| Symptôme | Cause probable | Solution |
|---|---|---|
| Page blanche | Fichiers dans un sous-dossier | Les fichiers doivent être à la racine du dépôt (archive « à plat ») |
| Erreur 404 | Pages pas encore publié | Attendre 2 min, recharger |
| Pas de « Ajouter à l'écran d'accueil » | Adresse en `http://` | L'adresse GitHub Pages est en `https://`, vérifiez-la |
| Une modification n'apparaît pas | Cache du service worker | Incrémenter `CACHE` dans `sw.js` |
| Le style a disparu | Un fichier manquant à l'envoi | Vérifier que les 7 fichiers sont bien là |

---

## Limites assumées

Pas de rappels programmés (notifications) dans cette première version : ils
sont peu fiables sur Android quand l'application est fermée. Le minuteur
fonctionne pendant que l'écran est ouvert sur Cap ; s'il se termine pendant
que vous êtes sur un autre écran de l'application, le temps affiché se
remettra à jour dès que vous reviendrez sur l'écran du minuteur.

Cap n'est pas un dispositif médical et ne remplace pas un accompagnement
professionnel.
