# Cap

Application web (PWA) d'aide aux fonctions exécutives au quotidien :
démarrer une tâche, s'organiser, ne pas se perdre en route. Fonctionne
hors-ligne, sans compte, sans traceur. Toutes les données restent sur le
téléphone.

**Ouvrir l'application :** https://ferrusdantioch.github.io/Cap/

Cap est le projet frère de [Refuge](https://github.com/FerrusDantioch/Refuge)
(aide aux crises de surcharge sensorielle) : même philosophie, mais une
application distincte.

---

## Ce que fait l'application

| Écran | À quoi il sert |
|---|---|
| **Accueil** | La tâche du jour épinglée, « Reprendre » une routine interrompue, l'interrupteur « Journée difficile », le lien vers Refuge |
| **Mes routines** | Des routines pas à pas, avec une image et une durée prévue pour chaque étape. Cinq modèles prêts à adapter : Le matin, Avant de sortir, Le soir, Ménage, Courses |
| **Mes tâches** | Des tâches découpées en petites étapes, avec une « première toute petite action » pour démarrer, un temps prévu et un chrono |
| **Minuteur** | Un minuteur visuel : un anneau dont la teinte glisse lentement, et le temps restant écrit en mots |
| **Historique** | Les routines terminées, jour par jour, sans total ni série (désactivable) |
| **Réglages** | Thème et gammes de couleurs, taille du texte, options des routines et des tâches, sauvegarde et restauration des données |

Plusieurs fonctions viennent de suggestions de personnes autistes :

- **savoir ce qui vient** : « Ensuite : … » et la liste des étapes, repliable ;
- **mode « Une seule chose »** : seule l'étape en cours s'affiche, en grand ;
- **passer une étape** sans culpabilité, et reprendre une routine interrompue ;
- **« Journée difficile »** : les routines ne montrent que leurs étapes
  essentielles, sans jamais modifier la routine enregistrée ;
- **transitions douces** (facultatives) : une courte pause entre deux étapes ;
- **préavis visuel** avant la fin du minuteur.

## Des choix assumés

- **Jamais de son.** La fin du minuteur se voit à la couleur de l'anneau, avec
  une courte vibration facultative.
- **Aucune couleur vive**, ni blanc pur ni noir pur : plusieurs gammes de
  couleurs douces, en version claire et sombre.
- **Animations lentes**, et le réglage « réduire les animations » du téléphone
  est respecté.
- **Aucune pression** : pas de points, pas de badges, pas de séries de jours.
  Quand le temps prévu d'une étape est écoulé, l'étape reste affichée : c'est
  vous qui décidez de passer à la suite.
- **Grandes zones à toucher** (au moins 60 px).

## Vos données

Tout reste dans le téléphone : aucun compte, aucun envoi sur internet, aucune
publicité. Réglages → « Sauvegarde de mes données » permet d'enregistrer vos
routines, tâches, réglages et historique dans un fichier, puis de les
restaurer.

Effacer les données du site dans le navigateur efface aussi vos routines et
vos tâches : pensez à faire une sauvegarde de temps en temps.

## Installer sur un téléphone Android

1. Ouvrez l'adresse de l'application dans le navigateur.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** → **Installer**.

Si Chrome indique « Cette appli est déjà installée » alors qu'elle ne l'est
pas, c'est une limite de Chrome quand une autre application de
`ferrusdantioch.github.io` est déjà installée. Installez Cap depuis Brave, ou
choisissez « Créer un raccourci » dans Chrome.

## Publier et modifier l'application

Le guide [GUIDE-GITHUB.md](GUIDE-GITHUB.md) explique comment publier et
modifier Cap **entièrement depuis un téléphone Android**, sans ordinateur ni
ligne de commande.

À retenir : après toute modification de `index.html`, `styles.css`, `app.js`,
`manifest.json` ou des icônes, augmentez le numéro de version tout en haut de
`sw.js` (par exemple `cap-v16` → `cap-v17`). Sans cela, les téléphones
continuent d'afficher l'ancienne version.

## Tester sur un ordinateur

Le mode hors-ligne ne fonctionne qu'à une adresse `https://` ou
`http://localhost`, jamais en ouvrant `index.html` par un double-clic. Dans le
dossier du projet :

```bash
python3 -m http.server 8000
```

puis ouvrez http://localhost:8000.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les écrans et tous les textes affichés |
| `styles.css` | Couleurs, tailles, mise en page |
| `app.js` | Le comportement : routines, tâches, minuteur, réglages |
| `sw.js` | Le mode hors-ligne |
| `manifest.json` | Nom et icône de l'application |
| `icons/` | Les icônes |
| `GUIDE-GITHUB.md` | Publier et modifier depuis un téléphone |

Tout le code est commenté en français.

## Limites

- Pas de rappels programmés (notifications) : ils sont peu fiables sur Android
  quand l'application est fermée.
- Une application web ne peut rien afficher sur l'écran verrouillé. L'option
  « Garder l'écran allumé pendant le minuteur » empêche le téléphone de se
  verrouiller tant que le minuteur tourne.
- Cap n'est pas un dispositif médical et ne remplace pas un accompagnement
  professionnel.

## Licence

**© 2026 Ferrus Dantioch — Creative Commons BY-NC-ND 4.0**
([résumé de la licence en français](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr))

En clair : le partage est autorisé, à l'identique et en citant l'auteur ;
l'usage commercial est interdit ; la modification et les œuvres dérivées
sont interdites. Le logiciel est fourni « en l'état », sans aucune garantie.

Texte complet dans le fichier [LICENSE](LICENSE) : le texte officiel en
anglais, suivi de la traduction française officielle publiée par Creative
Commons.
