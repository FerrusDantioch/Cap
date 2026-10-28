/* ============================================================
   CAP — logique de l'application
   Tout est écrit en français, avec des commentaires pour
   expliquer le "pourquoi" quand ce n'est pas évident.
   Aucune donnée ne quitte jamais ce téléphone : tout est stocké
   avec localStorage, rien n'est envoyé sur internet.

   L'application TUTOIE la personne : tout texte qui s'adresse à
   elle (boutons, explications, messages) dit « tu ».
   ============================================================ */

/* ---------- 1. Stockage (localStorage) ---------- */

const CLE_ROUTINES = 'cap_routines';
const CLE_TACHES = 'cap_taches';
const CLE_REGLAGES = 'cap_reglages';
const CLE_ROUTINE_EN_COURS = 'cap_routine_en_cours';
const CLE_HISTORIQUE = 'cap_historique';

// L'historique garde au plus les 500 dernières routines terminées, pour ne
// jamais remplir la mémoire du navigateur.
const HISTORIQUE_MAX = 500;

// Les tailles de texte proposées dans Réglages (1 = normal).
const ECHELLES = [0.9, 1, 1.15, 1.35];
// Les durées de pause proposées pour les transitions douces, en secondes.
const DUREES_TRANSITION = [5, 10, 20, 30];

// Les routines et les tâches sont relues à travers les mêmes fonctions de
// « nettoyage » que la restauration d'une sauvegarde (section 10) : une
// donnée abîmée est écartée au lieu d'empêcher Cap de démarrer, et les
// routines écrites par une ancienne version (étapes en simple texte) sont
// converties au nouveau format (étapes avec image et durée facultatives).
function chargerRoutines() {
  let brut = null;
  try { brut = JSON.parse(localStorage.getItem(CLE_ROUTINES)); } catch (e) { /* rien */ }
  return Array.isArray(brut) ? brut.map(nettoyerRoutine).filter(Boolean) : [];
}
function sauverRoutines() {
  localStorage.setItem(CLE_ROUTINES, JSON.stringify(routines));
}

function chargerTaches() {
  let brut = null;
  try { brut = JSON.parse(localStorage.getItem(CLE_TACHES)) } catch (e) { /* rien */ }
  const liste = Array.isArray(brut) ? brut.map(nettoyerTache).filter(Boolean) : [];
  unSeulEpinglage(liste);
  return liste;
}
function sauverTaches() {
  localStorage.setItem(CLE_TACHES, JSON.stringify(taches));
}

// L'historique des routines terminées : [{ id, date, nom, essentiel? }],
// du plus ancien au plus récent.
function chargerHistorique() {
  let brut = null;
  try { brut = JSON.parse(localStorage.getItem(CLE_HISTORIQUE)); } catch (e) { /* rien */ }
  const liste = Array.isArray(brut) ? brut.map(nettoyerEntreeHistorique).filter(Boolean) : [];
  return liste.sort((a, b) => a.date - b.date).slice(-HISTORIQUE_MAX);
}
function sauverHistorique() {
  try { localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(historique)); }
  catch (e) { /* mémoire pleine : la routine est finie quand même */ }
}

function chargerReglages() {
  const defaut = {
    vibrationMinuteur: true,
    ecranAllumeMinuteur: false,
    preavisMinuteur: true,
    theme: 'auto',
    palette: 'bleu',
    echelle: 1,
    // Mode « Une seule chose » (seule l'étape en cours, en grand), mémorisé
    // séparément pour les tâches et pour les routines. Le nom
    // « tacheUneEtape » vient d'une ancienne version : on le garde tel quel
    // pour que le choix déjà fait par la personne soit conservé.
    tacheUneEtape: false,
    routineUneChose: false,
    // Journée difficile : les routines ne montrent que leurs étapes essentielles.
    journeeDifficile: false,
    // Transitions douces : une courte pause entre deux étapes (en secondes).
    // Éteintes au départ, pour ne surprendre personne.
    transitionsDouces: false,
    dureeTransition: 10,
    // Petit « ✓ Fait » discret après chaque étape (désactivable).
    retourFait: true,
    // Noter chaque routine terminée dans l'historique (date et nom).
    historiqueActif: true
  };
  try { return Object.assign(defaut, JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}); }
  catch (e) { return defaut; }
}
function sauverReglages() {
  localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
}

function creerId(prefixe) {
  return prefixe + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- 2. Pictogrammes et modèles ---------- */

// Les images que l'on peut poser à côté d'une étape. Beaucoup de personnes
// autistes comprennent une image plus vite qu'une phrase : c'est le
// principe des emplois du temps visuels.
// Ce sont des émojis, donc souvent très colorés : styles.css les affiche
// désaturés (classe .picto), pour respecter la règle « aucune couleur vive ».
// Chaque image a un nom, lu à voix haute par les lecteurs d'écran.
const PICTOS = [
  ['⏰', 'Réveil'], ['☀️', 'Matin'], ['🛏️', 'Lit'], ['🚽', 'Toilettes'],
  ['🚿', 'Douche'], ['🛁', 'Bain'], ['🪥', 'Brosse à dents'], ['🧴', 'Soin'],
  ['🪒', 'Rasoir'], ['👕', 'Habits'], ['🧦', 'Chaussettes'], ['👟', 'Chaussures'],
  ['🧥', 'Manteau'], ['💧', 'Eau'], ['☕', 'Boisson chaude'], ['🥣', 'Petit-déjeuner'],
  ['🍳', 'Cuisiner'], ['🍽️', 'Repas'], ['💊', 'Médicament'], ['🧺', 'Linge'],
  ['🧹', 'Ménage'], ['🧽', 'Vaisselle'], ['🗑️', 'Poubelle'], ['🪴', 'Plante'],
  ['🐾', 'Animal'], ['🎒', 'Sac'], ['🔑', 'Clés'], ['👛', 'Porte-monnaie'],
  ['📱', 'Téléphone'], ['🎧', 'Casque'], ['🚪', 'Porte'], ['🚌', 'Transport'],
  ['🛒', 'Courses'], ['💻', 'Ordinateur'], ['📝', 'Écrire'], ['✉️', 'Courrier'],
  ['📞', 'Appeler'], ['📅', 'Agenda'], ['📚', 'Lire'], ['🌳', 'Dehors'],
  ['💡', 'Lumière'], ['🌙', 'Soir'], ['💤', 'Dormir']
];

function nomPicto(image) {
  const trouve = PICTOS.find(p => p[0] === image);
  return trouve ? trouve[1] : 'Image';
}

// Des routines toutes prêtes, pour ne pas partir d'une page vide (qui est
// déjà, en soi, un obstacle pour démarrer). Choisir un modèle ouvre le
// formulaire déjà rempli : rien n'est enregistré tant que la personne
// n'appuie pas sur « Enregistrer », et elle peut tout changer avant.
// Chaque modèle propose trois étapes « essentielles » (celles qui restent
// les jours difficiles) : une suggestion, modifiable comme le reste.
const MODELES_ROUTINES = [
  {
    nom: 'Le matin',
    etapes: [
      { image: '⏰', texte: 'Se lever', essentielle: true },
      { image: '🚽', texte: 'Aller aux toilettes' },
      { image: '💧', texte: 'Boire un verre d’eau', essentielle: true },
      { image: '🚿', texte: 'Se doucher', minutes: 10 },
      { image: '👕', texte: 'S’habiller' },
      { image: '🥣', texte: 'Prendre le petit-déjeuner', minutes: 15, essentielle: true },
      { image: '🪥', texte: 'Se brosser les dents', minutes: 2 }
    ]
  },
  {
    nom: 'Avant de sortir',
    etapes: [
      { image: '🧥', texte: 'Mettre une veste adaptée au temps qu’il fait' },
      { image: '👟', texte: 'Mettre les chaussures' },
      { image: '🔑', texte: 'Prendre les clés', essentielle: true },
      { image: '👛', texte: 'Prendre le porte-monnaie ou la carte' },
      { image: '📱', texte: 'Prendre le téléphone', essentielle: true },
      { image: '🎧', texte: 'Prendre le casque ou les bouchons d’oreilles' },
      { image: '💡', texte: 'Éteindre les lumières' },
      { image: '🚪', texte: 'Fermer la porte à clé', essentielle: true }
    ]
  },
  {
    nom: 'Le soir',
    etapes: [
      { image: '🎒', texte: 'Préparer les affaires de demain', minutes: 10 },
      { image: '📱', texte: 'Mettre le téléphone à charger', essentielle: true },
      { image: '🪥', texte: 'Se brosser les dents', minutes: 2, essentielle: true },
      { image: '👕', texte: 'Mettre le pyjama' },
      { image: '💡', texte: 'Baisser la lumière' },
      { image: '🎧', texte: 'Un moment calme', minutes: 15 },
      { image: '💤', texte: 'Aller au lit', essentielle: true }
    ]
  },
  {
    nom: 'Ménage',
    etapes: [
      { image: '🎧', texte: 'Mettre de la musique ou le casque, si ça aide' },
      { image: '🧺', texte: 'Ramasser ce qui traîne et le ranger', minutes: 5, essentielle: true },
      { image: '🧽', texte: 'Faire la vaisselle', minutes: 15, essentielle: true },
      { image: '🍽️', texte: 'Essuyer la table et le plan de travail', minutes: 5 },
      { image: '🧹', texte: 'Passer le balai ou l’aspirateur', minutes: 15 },
      { image: '🚽', texte: 'Nettoyer les toilettes', minutes: 10 },
      { image: '🗑️', texte: 'Sortir la poubelle', essentielle: true }
    ]
  },
  {
    nom: 'Courses',
    etapes: [
      { image: '📝', texte: 'Regarder ce qui manque et faire la liste', minutes: 10, essentielle: true },
      { image: '📅', texte: 'Choisir un moment où il y a moins de monde' },
      { image: '🎒', texte: 'Prendre des sacs' },
      { image: '👛', texte: 'Prendre le porte-monnaie ou la carte', essentielle: true },
      { image: '🎧', texte: 'Prendre le casque ou les bouchons d’oreilles' },
      { image: '🛒', texte: 'Acheter ce qui est sur la liste', minutes: 30, essentielle: true },
      { image: '🧺', texte: 'Ranger les courses en rentrant', minutes: 10 }
    ]
  }
];

/* ---------- 3. État en mémoire ---------- */

let routines = chargerRoutines();
let taches = chargerTaches();
let reglages = chargerReglages();
let historique = chargerHistorique();

let vueCourante = 'accueil';
let routineEnEdition = null;   // id de la routine modifiée, ou null si création
let tacheEnEdition = null;     // id de la tâche modifiée, ou null si création
let ongletTachesActif = 'en-cours';
let tacheOuverteId = null;
let tdIndexAffiche = null;     // étape montrée en mode « une étape à la fois »
let chronoHandle = null;       // rafraîchit « Temps passé » tant que la tâche est à l'écran

// Routine commencée : { routine, index, passees }. Elle est enregistrée à
// chaque pas (voir sauverRoutineEnCours) : un appel, un autre écran, ou
// Android qui ferme Cap en arrière-plan ne font pas perdre la progression.
let routineEnCours = chargerRoutineEnCours();

// Durée prévue de l'étape affichée : { fin, duree, handle, fini }.
let minuteurEtape = null;

// État du minuteur : minFinTimestamp est l'heure d'arrivée (Date.now() + durée),
// pas un simple compteur qui descend — ainsi le temps restant reste juste même
// si on change d'écran ou si le téléphone met l'onglet en veille un instant.
let minDureeMs = 5 * 60 * 1000;
let minFinTimestamp = null;
let minRestantMsAuPause = null;
let minEnCours = false;
let minEnPause = false;
let minTermine = false;        // fini, mais pas encore remis à zéro
let minFiniNonVu = false;      // fini pendant que l'écran du minuteur n'était pas affiché
let minPreavisAnnonce = false;
let minNomActuel = '';
let minTimerHandle = null;
const MIN_CIRCONFERENCE = 2 * Math.PI * 100;

// Verrou « écran allumé » (Wake Lock) : tant qu'on le tient, le téléphone ne
// se met pas en veille et ne se verrouille pas.
let verrouEcran = null;
let demandeEcranEnCours = false;
let delaiLiberationEcran = null;
const GRACE_ECRAN_APRES_FIN_MS = 60 * 1000;

/* ---------- 4. Petits outils partagés ---------- */

function echapper(texte) {
  const d = document.createElement('div');
  d.textContent = texte;
  return d.innerHTML;
}

function annoncer(texte) {
  const zone = document.getElementById('annonce');
  zone.textContent = '';
  setTimeout(() => { zone.textContent = texte; }, 30);
}

// Une suppression demande deux appuis : le premier "arme" le bouton (il
// change de texte et de couleur), le second confirme vraiment l'action.
// Si on ne confirme pas dans les 4 secondes, le bouton se désarme tout seul.
function armerSuppression(bouton, texteArme, action) {
  if (!bouton.classList.contains('arme')) {
    bouton.classList.add('arme');
    bouton.dataset.texteOriginal = bouton.textContent;
    bouton.textContent = texteArme;
    clearTimeout(bouton._minuteurArme);
    bouton._minuteurArme = setTimeout(() => desarmerBouton(bouton), 4000);
    return;
  }
  clearTimeout(bouton._minuteurArme);
  // On remet le bouton dans son état normal AVANT l'action : un bouton qui
  // reste affiché (comme « Supprimer cette tâche ») ne doit pas rester armé
  // pour la tâche suivante, sinon un seul appui suffirait à la supprimer.
  desarmerBouton(bouton);
  action();
}
function desarmerBouton(bouton) {
  clearTimeout(bouton._minuteurArme);
  bouton.classList.remove('arme');
  if (bouton.dataset.texteOriginal) bouton.textContent = bouton.dataset.texteOriginal;
}

function formaterDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// « 14 h 35 », arrondi à la minute la plus proche : plus parlant qu'un
// compte à rebours pour situer la fin dans sa journée.
function heureLisible(ts) {
  const d = new Date(Math.round(ts / 60000) * 60000);
  return d.getHours() + ' h ' + String(d.getMinutes()).padStart(2, '0');
}

// Le temps restant dit en mots, à la minute près — jamais à la seconde,
// pour que le texte ne bouge pas sans arrêt sous les yeux.
function texteRestant(ms) {
  if (ms <= 60 * 1000) return 'Encore moins d’une minute';
  return 'Encore ' + Math.ceil(ms / 60000) + ' minutes';
}

function pluriel(n, un, plusieurs) {
  return n + ' ' + (n > 1 ? plusieurs : un);
}

// Une durée en minutes, écrite simplement : « 12 min », « 1 h 05 ».
function texteMinutes(n) {
  if (n < 1) return 'moins d’1 min';
  if (n < 60) return n + ' min';
  const m = n % 60;
  return Math.floor(n / 60) + ' h' + (m ? ' ' + String(m).padStart(2, '0') : '');
}

// Retour positif sobre : un petit « ✓ Fait » apparaît en bas de l'écran
// par un fondu lent, reste un instant, puis s'efface. Il ne bouge pas, ne
// clignote pas, ne fait aucun bruit, et ne gêne aucun toucher. Désactivable
// dans Réglages. Les lecteurs d'écran ont déjà leur propre annonce.
let elementFait = null;
let delaiFait = null;

function montrerFait() {
  if (!reglages.retourFait) return;
  if (!elementFait) {
    elementFait = document.createElement('div');
    elementFait.className = 'retour-fait';
    elementFait.setAttribute('aria-hidden', 'true');
    elementFait.textContent = '✓ Fait';
    document.body.appendChild(elementFait);
  }
  clearTimeout(delaiFait);
  elementFait.classList.add('visible');
  delaiFait = setTimeout(() => elementFait.classList.remove('visible'), 1600);
}

// Remplit un élément avec une étape : son image (si elle en a une), puis
// son texte. Tout passe par textContent : aucun risque d'injecter du code.
function remplirEtape(el, etape) {
  el.textContent = '';
  if (etape.image) {
    const img = document.createElement('span');
    img.className = 'picto';
    img.setAttribute('aria-hidden', 'true');
    img.textContent = etape.image;
    el.appendChild(img);
  }
  el.appendChild(document.createTextNode(etape.texte));
}

// La même chose, sous forme de texte HTML échappé, pour les listes
// construites avec innerHTML.
function etapeHtml(etape) {
  return (etape.image ? '<span class="picto" aria-hidden="true">' + echapper(etape.image) + '</span>' : '') +
    echapper(etape.texte);
}

// Transitions douces : entre deux étapes, une courte pause avec un message
// calme et le nom de l'étape qui vient, pour souffler avant de changer
// d'activité. Une barre fine se vide lentement ; un toucher n'importe où
// sur la pause la termine tout de suite. Le message est toujours le même :
// c'est plus prévisible.
// La pause prend la place de l'écran SOUS la barre du haut : la flèche ←
// reste là, et quitter l'écran annule la pause (la progression, elle, est
// déjà enregistrée).
const MESSAGE_PAUSE = 'Petite pause. Respire tranquillement.';
let elementPause = null;
let pauseEnCours = null;   // { vue, debut, handle, suite }

function creerElementPause() {
  // Toute la pause est un seul grand bouton : un toucher n'importe où
  // suffit, et au clavier « Entrée » fait la même chose.
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pause-douce';
  b.innerHTML =
    '<span class="pause-fait">✓ Fait</span>' +
    '<span class="pause-message"></span>' +
    '<span class="pause-ensuite"></span>' +
    '<span class="pause-jauge"><span class="pause-barre"></span></span>' +
    '<span class="pause-aide"></span>';
  b.addEventListener('click', () => {
    // Un double appui sur « C'est fait » ne doit pas sauter la pause sans
    // le vouloir : les touchers des 0,6 premières secondes sont ignorés.
    if (pauseEnCours && Date.now() - pauseEnCours.debut > 600) finirPause(true);
  });
  return b;
}

// nomVue : l'écran où afficher la pause ; etape : celle qui vient ensuite ;
// suite : ce qu'il faut faire quand la pause est finie ; fait : true si
// l'étape d'avant vient d'être faite (et non passée) — la pause commence
// alors par le petit « ✓ Fait », à la place du message qui s'efface.
function lancerPause(nomVue, etape, suite, fait) {
  finirPause(false);
  if (!elementPause) elementPause = creerElementPause();
  const vue = document.getElementById('vue-' + nomVue);
  const duree = reglages.dureeTransition * 1000;

  elementPause.querySelector('.pause-fait').classList.toggle('masque', !(fait && reglages.retourFait));
  elementPause.querySelector('.pause-message').textContent = MESSAGE_PAUSE;
  const ensuite = elementPause.querySelector('.pause-ensuite');
  ensuite.textContent = 'Ensuite : ';
  const span = document.createElement('span');
  remplirEtape(span, etape);
  ensuite.appendChild(span);
  elementPause.querySelector('.pause-aide').textContent =
    'La suite arrive dans ' + reglages.dureeTransition + ' secondes. Touche ici pour continuer tout de suite.';

  vue.querySelector('.barre-haut').after(elementPause);
  vue.classList.add('en-pause');

  // La barre part pleine, puis se vide en une seule glissade régulière qui
  // dure exactement le temps de la pause.
  const barre = elementPause.querySelector('.pause-barre');
  barre.style.transition = 'none';
  barre.style.width = '100%';
  void barre.offsetWidth;   // force le navigateur à poser la barre pleine d'abord
  barre.style.transition = 'width ' + duree + 'ms linear';
  barre.style.width = '0%';

  pauseEnCours = { vue, debut: Date.now(), suite, handle: setTimeout(() => finirPause(true), duree) };
  elementPause.focus();
}

// continuer : true pour passer à la suite, false pour simplement annuler.
function finirPause(continuer) {
  const p = pauseEnCours;
  if (!p) return;
  pauseEnCours = null;
  clearTimeout(p.handle);
  p.vue.classList.remove('en-pause');
  elementPause.remove();
  if (continuer) p.suite();
}

/* ---------- 5. Apparence : thème, gamme de couleurs, taille du texte ---------- */

// « Automatique » suit le réglage clair/sombre du téléphone ; sinon on
// applique le choix explicite de la personne.
function themeEffectif() {
  if (reglages.theme === 'auto') {
    return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sombre' : 'clair';
  }
  return reglages.theme;
}

// Pose data-mode="<gamme>-<sombre|clair>" sur <html> : c'est ce que lit
// styles.css. Un script identique, dans le <head> de index.html, fait la
// même chose avant même que ce fichier soit chargé, pour éviter un flash
// de mauvaises couleurs à l'ouverture.
function appliquerApparence() {
  document.documentElement.dataset.mode = reglages.palette + '-' + themeEffectif();
  document.documentElement.style.setProperty('--echelle', String(reglages.echelle || 1));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (bg) meta.setAttribute('content', bg);
  }
}

function majAffichageReglages() {
  document.querySelectorAll('#choix-theme button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.themeVal === reglages.theme));
  });
  document.querySelectorAll('#choix-palette button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.paletteVal === reglages.palette));
  });
  document.querySelectorAll('#choix-taille button').forEach(b => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.echelle) === Number(reglages.echelle)));
  });
  document.querySelectorAll('#choix-duree-transition button').forEach(b => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.secondes) === reglages.dureeTransition));
  });
  majCasesReglages();
}

// Les cases à cocher qui portent data-reglage="<nom>" montrent directement
// reglages[<nom>]. Un même réglage peut avoir deux cases (l'interrupteur
// « Journée difficile » est sur l'accueil ET dans Réglages) : elles sont
// toujours remises d'accord ensemble.
function majCasesReglages() {
  document.querySelectorAll('input[data-reglage]').forEach(c => {
    c.checked = !!reglages[c.dataset.reglage];
  });
  // Le choix de la durée de pause ne sert que si les transitions sont allumées.
  document.getElementById('zone-duree-transition').classList.toggle('masque', !reglages.transitionsDouces);
}

function changerReglageCase(nom, valeur) {
  reglages[nom] = valeur;
  sauverReglages();
  majCasesReglages();
  if (nom === 'journeeDifficile') {
    annoncer(valeur
      ? 'Journée difficile : les routines ne montrent que l’essentiel.'
      : 'Journée difficile éteinte : les routines sont complètes.');
    // « Reprendre … étape 2 sur 3 » change avec le nombre d'étapes montrées.
    if (vueCourante === 'accueil') majAccueil();
  }
}

/* ---------- 6. Navigation entre les écrans ---------- */

function afficherVue(nom) {
  // Quitter l'écran d'une routine coupe le petit minuteur de l'étape : il
  // repartira de zéro au retour (on ne revient pas à une étape « en retard »).
  if (nom !== 'routine-lancer') arreterMinuteurEtape();
  if (nom !== 'tache-detail') clearInterval(chronoHandle);
  if (nom === 'minuteur') minFiniNonVu = false;
  // Changer d'écran annule une pause douce en cours.
  finirPause(false);

  vueCourante = nom;
  document.querySelectorAll('.vue').forEach(v => {
    const active = v.id === 'vue-' + nom;
    v.hidden = !active;
    v.classList.toggle('active', active);
  });
  if (nom === 'accueil') majAccueil();
  window.scrollTo(0, 0);
  const vue = document.getElementById('vue-' + nom);
  const titre = vue ? vue.querySelector('h1') : null;
  if (titre) {
    // On donne le focus au titre : utile au clavier et aux lecteurs d'écran,
    // et ça évite de rester "coincé" sur un bouton de l'écran précédent.
    titre.setAttribute('tabindex', '-1');
    titre.focus({ preventScroll: true });
  }
}

/* ---------- 7. Accueil : ce qui est en cours, et la tâche du jour ---------- */

function boutonEnCours(titre, sous, action) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bouton-en-cours';
  b.textContent = titre;
  const s = document.createElement('span');
  s.className = 'sous';
  s.textContent = sous;
  b.appendChild(s);
  b.addEventListener('click', action);
  return b;
}

// N'affiche que ce qui existe vraiment : rien à reprendre, rien d'affiché.
function majAccueil() {
  const zone = document.getElementById('accueil-en-cours');
  zone.textContent = '';

  if (routineEnCours) {
    const r = routineEnCours.routine;
    const p = positionRoutine(routineEnCours);
    zone.appendChild(boutonEnCours(
      'Reprendre « ' + r.nom + ' »',
      'Étape ' + p.numero + ' sur ' + p.total,
      () => lancerRoutine(r.id)
    ));
  }

  if (minEnCours || (minTermine && minFiniNonVu)) {
    let titre, sous;
    if (minTermine) { titre = 'Minuteur terminé'; sous = minNomActuel || 'Touche pour le voir'; }
    else if (minEnPause) { titre = 'Minuteur en pause'; sous = minNomActuel || 'Touche pour le reprendre'; }
    else {
      titre = 'Minuteur en cours';
      sous = (minNomActuel ? minNomActuel + ' · ' : '') + 'fin à ' + heureLisible(minFinTimestamp);
    }
    zone.appendChild(boutonEnCours(titre, sous, () => afficherVue('minuteur')));
  }

  // Une tâche dont le chrono tourne : on la retrouve d'un toucher, et on
  // pense à l'arrêter.
  taches.filter(chronoTourne).forEach(t => {
    zone.appendChild(boutonEnCours('Chrono en cours', t.nom, () => ouvrirTache(t.id)));
  });

  majTacheDuJour();
  majCarteMiseAJour();
}

// ----- Nouvelle version de Cap -----
// Le service worker télécharge une nouvelle version en arrière-plan, puis
// ATTEND : rien ne change par surprise, même si Cap est fermée puis
// rouverte (voir sw.js). L'accueil le dit, et c'est la personne qui
// choisit « Mettre à jour » ou « Plus tard ».
// Une nouvelle version peut attendre de deux façons :
// - son service worker attend (inscriptionSw.waiting) ;
// - ou il est déjà actif (Cap a été fermée puis rouverte) mais sert encore
//   l'ancienne copie : il le dit quand on lui demande son « etat ».
let inscriptionSw = null;          // l'inscription du service worker
let miseAJourDemandee = false;     // vrai après un appui sur « Mettre à jour »
let miseAJourRepoussee = false;    // « Plus tard » : plus rien jusqu'à la prochaine ouverture
let versionEnAttente = false;      // réponse du service worker à « etat »

// Demande au service worker en place si une nouvelle version attend.
function demanderEtat() {
  const sw = navigator.serviceWorker.controller;
  if (!sw) return;
  const canal = new MessageChannel();
  canal.port1.onmessage = (e) => {
    versionEnAttente = !!(e.data && e.data.nouvelleVersion);
    majCarteMiseAJour();
  };
  sw.postMessage({ type: 'etat' }, [canal.port2]);
}

function surveillerMisesAJour(inscription) {
  inscriptionSw = inscription;
  // Une version attendait déjà (téléchargée lors d'une visite précédente).
  // Sans « controller », c'est la toute première installation : rien à proposer.
  majCarteMiseAJour();
  demanderEtat();
  inscription.addEventListener('updatefound', () => {
    const nouveau = inscription.installing;
    if (!nouveau) return;
    nouveau.addEventListener('statechange', () => {
      if (nouveau.state === 'installed' && navigator.serviceWorker.controller) majCarteMiseAJour();
    });
  });
  // À chaque retour dans Cap, on regarde s'il existe une nouvelle version.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') inscription.update().catch(() => {});
  });
}

function majCarteMiseAJour() {
  const enAttente = !!(inscriptionSw && inscriptionSw.waiting) || versionEnAttente;
  const prete = enAttente && !!navigator.serviceWorker.controller;
  // Pendant un minuteur, on ne propose rien : recharger Cap l'arrêterait.
  const montrer = prete && !miseAJourRepoussee && !minEnCours;
  document.getElementById('accueil-mise-a-jour').classList.toggle('masque', !montrer);
}

function tacheEpinglee() {
  return taches.find(t => t.epinglee) || null;
}

// Garde au plus une tâche épinglée (la première trouvée) : utile après une
// restauration qui en apporterait une deuxième.
function unSeulEpinglage(liste) {
  let dejaUne = false;
  liste.forEach(t => {
    if (t.epinglee && dejaUne) delete t.epinglee;
    if (t.epinglee) dejaUne = true;
  });
}

function majTacheDuJour() {
  const carte = document.getElementById('accueil-tache-du-jour');
  const t = tacheEpinglee();
  if (!t) { carte.classList.add('masque'); return; }
  carte.classList.remove('masque');

  document.getElementById('tdj-nom').textContent = t.nom;
  const etapeEl = document.getElementById('tdj-etape');
  const prochaine = t.etapes.find(e => !e.faite);
  if (prochaine) {
    etapeEl.textContent = '';
    const intro = document.createElement('span');
    intro.className = 'intro';
    intro.textContent = prochaine.mini ? 'Pour démarrer : ' : 'Prochaine étape : ';
    const contenu = document.createElement('span');
    remplirEtape(contenu, prochaine);
    etapeEl.appendChild(intro);
    etapeEl.appendChild(contenu);
  } else {
    etapeEl.textContent = 'Tout est fait ✓';
  }
  document.getElementById('btn-tdj-fait').classList.toggle('masque', !prochaine);
  document.getElementById('btn-tdj-retirer').classList.toggle('masque', !!prochaine);
}

/* ---------- 8. Éditeur d'étapes réutilisé (routines ET tâches) ---------- */

// Chaque étape du formulaire est une petite carte :
//   [image] [texte de l'étape .................] [✕]
//   [durée prévue (routines seulement)]  [↑] [↓]
//   [☆ Essentielle (routines seulement) ........]
// L'image choisie, l'état « essentielle » et, pour une tâche, l'état
// « faite » sont rangés sur la carte elle-même (data-image,
// data-essentielle, data-faite) : ils suivent l'étape quand on la monte ou
// la descend.

const DUREES_ETAPE = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60];

function creerBouton(texte, dir, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.dir = dir;
  b.textContent = texte;
  b.setAttribute('aria-label', label);
  return b;
}

function majBoutonImage(ligne) {
  const b = ligne.querySelector('button[data-dir="image"]');
  const image = ligne.dataset.image;
  b.textContent = image || 'Image';
  b.classList.toggle('vide', !image);
  b.classList.toggle('picto', !!image);
  b.setAttribute('aria-label', image
    ? 'Image de cette étape : ' + nomPicto(image) + '. Toucher pour la changer.'
    : 'Choisir une image pour cette étape');
}

// Le bouton « Essentielle » garde toujours le même nom pour les lecteurs
// d'écran ; c'est aria-pressed qui dit s'il est enfoncé. À l'écran,
// l'étoile se remplit (★) et le bouton prend la couleur douce de la gamme.
function majBoutonEssentielle(ligne) {
  const b = ligne.querySelector('button[data-dir="essentielle"]');
  if (!b) return;
  const oui = ligne.dataset.essentielle === '1';
  b.setAttribute('aria-pressed', String(oui));
  b.textContent = (oui ? '★' : '☆') + ' Essentielle';
}

// « 2 étapes essentielles choisies » sous la liste du formulaire de routine.
// Trois est un repère, pas une règle : rien n'empêche d'en choisir plus.
function majCompteEssentielles() {
  const n = document.querySelectorAll('#rf-etapes .ligne-etape[data-essentielle="1"]').length;
  let texte;
  if (n === 0) texte = 'Aucune étape essentielle pour l’instant. Pour une journée difficile, environ 3 suffisent souvent.';
  else if (n < 3) texte = pluriel(n, 'étape essentielle choisie', 'étapes essentielles choisies') + '. On en conseille environ 3, mais c’est toi qui décides.';
  else texte = pluriel(n, 'étape essentielle choisie', 'étapes essentielles choisies') + '.';
  document.querySelector('#rf-essentielles small').textContent = texte;
}

function ajouterLigneEtape(conteneur, etape) {
  etape = etape || {};
  const avecDuree = conteneur.dataset.duree === 'oui';
  const avecEssentielle = conteneur.dataset.essentielle === 'oui';

  const ligne = document.createElement('div');
  ligne.className = 'ligne-etape';
  ligne.dataset.image = etape.image || '';
  if (etape.faite) ligne.dataset.faite = '1';
  if (etape.essentielle) ligne.dataset.essentielle = '1';

  const haut = document.createElement('div');
  haut.className = 'ligne-haut';
  const btnImage = creerBouton('', 'image', '');
  btnImage.className = 'bouton-picto';
  btnImage.setAttribute('aria-expanded', 'false');
  haut.appendChild(btnImage);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Étape';
  input.setAttribute('aria-label', 'Texte de l’étape');
  input.value = etape.texte || '';
  haut.appendChild(input);
  haut.appendChild(creerBouton('✕', 'suppr', 'Supprimer cette étape'));
  ligne.appendChild(haut);

  const bas = document.createElement('div');
  bas.className = 'ligne-bas';
  if (avecDuree) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Durée prévue pour cette étape');
    select.add(new Option('Sans durée', ''));
    DUREES_ETAPE.forEach(m => select.add(new Option(m === 60 ? '⏱ 1 h' : '⏱ ' + m + ' min', String(m))));
    // Une durée qui n'est pas dans la liste (venue d'une sauvegarde) reste possible.
    if (etape.minutes && !DUREES_ETAPE.includes(etape.minutes)) {
      select.add(new Option('⏱ ' + etape.minutes + ' min', String(etape.minutes)));
    }
    select.value = etape.minutes ? String(etape.minutes) : '';
    bas.appendChild(select);
  } else {
    const espace = document.createElement('span');
    espace.className = 'espace';
    bas.appendChild(espace);
  }
  bas.appendChild(creerBouton('↑', 'haut', 'Monter cette étape'));
  bas.appendChild(creerBouton('↓', 'bas', 'Descendre cette étape'));
  ligne.appendChild(bas);

  // Une rangée à part, sur toute la largeur : à côté de la durée et des
  // flèches, il n'y aurait plus assez de place sur un petit téléphone.
  if (avecEssentielle) {
    const btnEss = creerBouton('', 'essentielle', 'Étape essentielle, gardée les jours difficiles');
    btnEss.className = 'bouton-essentielle';
    ligne.appendChild(btnEss);
    majBoutonEssentielle(ligne);
  }

  majBoutonImage(ligne);
  conteneur.appendChild(ligne);
  return input;
}

// Un seul choix d'images pour toute l'application : il se glisse sous
// l'étape dont on a touché le bouton « Image », et se referme après le choix.
let choixImage = null;

function creerChoixImage() {
  const zone = document.createElement('div');
  zone.className = 'choix-image';
  zone.setAttribute('role', 'group');
  zone.setAttribute('aria-label', 'Choisir une image');
  PICTOS.forEach(([image, nom]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'picto';
    b.dataset.picto = image;
    b.textContent = image;
    b.setAttribute('aria-label', nom);
    zone.appendChild(b);
  });
  const aucune = document.createElement('button');
  aucune.type = 'button';
  aucune.className = 'aucune';
  aucune.dataset.picto = '';
  aucune.textContent = 'Pas d’image';
  zone.appendChild(aucune);

  zone.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-picto]');
    if (!b || !zone._ligne) return;
    const ligne = zone._ligne;
    ligne.dataset.image = b.dataset.picto;
    majBoutonImage(ligne);
    fermerChoixImage();
    ligne.querySelector('button[data-dir="image"]').focus();
  });
  return zone;
}

function fermerChoixImage() {
  if (!choixImage || !choixImage._ligne) return;
  choixImage._ligne.querySelector('button[data-dir="image"]').setAttribute('aria-expanded', 'false');
  choixImage._ligne = null;
  choixImage.remove();
}

function ouvrirChoixImage(ligne) {
  if (!choixImage) choixImage = creerChoixImage();
  const dejaIci = choixImage._ligne === ligne;
  fermerChoixImage();
  if (dejaIci) return;   // second appui sur le même bouton : on referme
  choixImage._ligne = ligne;
  ligne.querySelector('.ligne-haut').after(choixImage);
  choixImage.querySelectorAll('button[data-picto]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.picto === ligne.dataset.image && b.dataset.picto !== ''));
  });
  ligne.querySelector('button[data-dir="image"]').setAttribute('aria-expanded', 'true');
}

// Un seul écouteur par conteneur (posé une fois au démarrage) plutôt qu'un
// écouteur par bouton : plus simple, et ça marche aussi pour les lignes
// ajoutées plus tard.
function configurerEditeurEtapes(conteneur) {
  conteneur.addEventListener('click', (e) => {
    const bouton = e.target.closest('button[data-dir]');
    if (!bouton) return;
    const ligne = bouton.closest('.ligne-etape');
    const dir = bouton.dataset.dir;
    if (dir === 'image') { ouvrirChoixImage(ligne); return; }
    fermerChoixImage();
    if (dir === 'essentielle') {
      ligne.dataset.essentielle = ligne.dataset.essentielle === '1' ? '' : '1';
      majBoutonEssentielle(ligne);
    } else if (dir === 'suppr') {
      ligne.remove();
    } else if (dir === 'haut' && ligne.previousElementSibling) {
      conteneur.insertBefore(ligne, ligne.previousElementSibling);
      bouton.focus();
    } else if (dir === 'bas' && ligne.nextElementSibling) {
      conteneur.insertBefore(ligne.nextElementSibling, ligne);
      bouton.focus();
    }
    if (conteneur.dataset.essentielle === 'oui') majCompteEssentielles();
  });
}

// Relit les cartes du formulaire, dans l'ordre affiché. Les étapes sans
// texte sont ignorées.
function lireEtapes(conteneur) {
  return Array.from(conteneur.querySelectorAll('.ligne-etape')).map(ligne => {
    const texte = ligne.querySelector('input[type="text"]').value.trim();
    if (!texte) return null;
    const etape = { texte };
    if (ligne.dataset.image) etape.image = ligne.dataset.image;
    const select = ligne.querySelector('select');
    if (select && select.value) etape.minutes = Number(select.value);
    if (ligne.dataset.faite === '1') etape.faite = true;
    if (ligne.dataset.essentielle === '1') etape.essentielle = true;
    return etape;
  }).filter(Boolean);
}

function viderEditeur(conteneur) {
  fermerChoixImage();
  conteneur.innerHTML = '';
}

/* ---------- 9. Routines ---------- */

function listeEtapesHtml(etapes) {
  return '<ol>' + etapes.map(e => '<li>' + etapeHtml(e) +
    (e.minutes ? ' <span class="duree">· ' + e.minutes + ' min</span>' : '') +
    (e.essentielle ? ' <span class="duree">· ★ essentielle</span>' : '') + '</li>').join('') + '</ol>';
}

function nombreEssentielles(routine) {
  return routine.etapes.filter(e => e.essentielle).length;
}

function rendreListeRoutines() {
  const cont = document.getElementById('liste-routines');
  if (routines.length === 0) {
    cont.innerHTML = '<p class="vide">Aucune routine pour l’instant. Crées-en une, ou pars d’un modèle.</p>';
    return;
  }
  cont.innerHTML = routines.map(r => {
    const enCours = routineEnCours && routineEnCours.routine.id === r.id;
    const nbEss = nombreEssentielles(r);
    const meta = pluriel(r.etapes.length, 'étape', 'étapes') +
      (nbEss ? ' · dont ' + pluriel(nbEss, 'essentielle', 'essentielles') : '') +
      (enCours ? ' · commencée, étape ' + positionRoutine(routineEnCours).numero + ' en cours' : '');
    return `
      <div class="fiche">
        <div class="nom">${echapper(r.nom)}</div>
        <div class="meta">${meta}</div>
        <details class="apercu">
          <summary>Voir les étapes</summary>
          ${listeEtapesHtml(r.etapes)}
        </details>
        <div class="bouton-rangee">
          <button type="button" class="bouton-doux" data-action="lancer" data-id="${r.id}">${enCours ? 'Reprendre' : 'Lancer'}</button>
          <button type="button" data-action="modifier" data-id="${r.id}">Modifier</button>
          <button type="button" data-action="supprimer" data-id="${r.id}">Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

function rendreModeles() {
  document.getElementById('liste-modeles').innerHTML = MODELES_ROUTINES.map((m, i) => `
    <div class="fiche">
      <div class="nom">${echapper(m.nom)}</div>
      <div class="meta">${pluriel(m.etapes.length, 'étape', 'étapes')} · dont ${pluriel(nombreEssentielles(m), 'essentielle', 'essentielles')}</div>
      <details class="apercu">
        <summary>Voir les étapes</summary>
        ${listeEtapesHtml(m.etapes)}
      </details>
      <button type="button" class="bouton-doux" data-modele="${i}">Utiliser ce modèle</button>
    </div>
  `).join('');
}

function montrerModeles(ouvert) {
  document.getElementById('zone-modeles').classList.toggle('masque', !ouvert);
  document.getElementById('btn-modeles').setAttribute('aria-expanded', String(ouvert));
  document.getElementById('btn-modeles').textContent = ouvert ? 'Cacher les modèles' : 'Partir d’un modèle';
}

// id : la routine à modifier, ou null pour en créer une.
// modele : une routine toute prête qui pré-remplit le formulaire.
function ouvrirFormulaireRoutine(id, modele) {
  const nomEl = document.getElementById('rf-nom');
  const etapesEl = document.getElementById('rf-etapes');
  viderEditeur(etapesEl);
  const r = id ? routines.find(x => x.id === id) : null;
  routineEnEdition = r ? id : null;
  document.getElementById('titre-routine-form').textContent = r ? 'Modifier la routine' : 'Nouvelle routine';
  const source = r || modele;
  if (source) {
    nomEl.value = source.nom;
    source.etapes.forEach(e => ajouterLigneEtape(etapesEl, e));
  } else {
    nomEl.value = '';
    ajouterLigneEtape(etapesEl);
    ajouterLigneEtape(etapesEl);
  }
  majCompteEssentielles();
  afficherVue('routine-form');
}

function enregistrerRoutine() {
  const nom = document.getElementById('rf-nom').value.trim();
  const etapes = lireEtapes(document.getElementById('rf-etapes')).map(e => {
    const etape = { texte: e.texte };
    if (e.image) etape.image = e.image;
    if (e.minutes) etape.minutes = e.minutes;
    if (e.essentielle) etape.essentielle = true;
    return etape;
  });
  if (!nom) { annoncer('Donne un nom à la routine.'); document.getElementById('rf-nom').focus(); return; }
  if (etapes.length === 0) { annoncer('Ajoute au moins une étape.'); return; }

  if (routineEnEdition) {
    const r = routines.find(x => x.id === routineEnEdition);
    r.nom = nom; r.etapes = etapes;
    // Les étapes ont pu changer : une progression gardée ne voudrait plus
    // rien dire. On la remet à zéro plutôt que de reprendre au mauvais endroit.
    if (routineEnCours && routineEnCours.routine.id === r.id) {
      routineEnCours = null;
      sauverRoutineEnCours();
    }
  } else {
    routines.push({ id: creerId('r'), nom, etapes });
  }
  sauverRoutines();
  fermerChoixImage();
  montrerModeles(false);
  afficherVue('routines');
  rendreListeRoutines();
}

function chargerRoutineEnCours() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_ROUTINE_EN_COURS));
    if (!p || typeof p.id !== 'string') return null;
    const r = routines.find(x => x.id === p.id);
    if (!r) return null;
    const n = r.etapes.length;
    return {
      routine: r,
      index: Number.isInteger(p.index) && p.index >= 0 && p.index < n ? p.index : 0,
      passees: Array.isArray(p.passees) ? p.passees.filter(i => Number.isInteger(i) && i >= 0 && i < n) : []
    };
  } catch (e) { return null; }
}

function sauverRoutineEnCours() {
  try {
    if (routineEnCours) {
      localStorage.setItem(CLE_ROUTINE_EN_COURS, JSON.stringify({
        id: routineEnCours.routine.id,
        index: routineEnCours.index,
        passees: routineEnCours.passees
      }));
    } else {
      localStorage.removeItem(CLE_ROUTINE_EN_COURS);
    }
  } catch (e) { /* mémoire pleine : la routine continue quand même */ }
}

// Les étapes à faire aujourd'hui, par leur position dans la routine
// complète : toutes, ou seulement les essentielles pendant une journée
// difficile. La routine enregistrée, elle, ne change jamais. Une routine
// sans étape essentielle reste complète : on ne se retrouve jamais devant
// une routine vide.
function etapesDuJour(routine) {
  const toutes = routine.etapes.map((e, i) => i);
  const essentielles = toutes.filter(i => routine.etapes[i].essentielle);
  return reglages.journeeDifficile && essentielles.length ? essentielles : toutes;
}

// Les étapes montrées pendant une routine commencée : celles du jour, plus
// l'étape où l'on en est. Si « Journée difficile » est allumé en cours de
// route, l'étape qu'on était en train de faire ne disparaît pas sous ses
// yeux : seule la suite est raccourcie.
function etapesMontrees(enCours) {
  const liste = etapesDuJour(enCours.routine);
  if (!liste.includes(enCours.index)) {
    liste.push(enCours.index);
    liste.sort((a, b) => a - b);
  }
  return liste;
}

// « Étape 2 sur 3 », compté parmi les étapes montrées.
function positionRoutine(enCours) {
  const liste = etapesMontrees(enCours);
  return { numero: liste.indexOf(enCours.index) + 1, total: liste.length };
}

// Lancer une routine déjà commencée la reprend là où elle en était.
function lancerRoutine(id) {
  const r = routines.find(x => x.id === id);
  if (!r) return;
  const reprise = routineEnCours && routineEnCours.routine.id === id;
  if (!reprise) {
    // Pendant une journée difficile, on commence directement à la
    // première étape essentielle.
    routineEnCours = { routine: r, index: etapesDuJour(r)[0], passees: [] };
    sauverRoutineEnCours();
  }
  document.getElementById('titre-routine-lancer').textContent = r.nom;
  document.getElementById('rl-apercu').open = false;
  desarmerBouton(document.getElementById('btn-rl-arreter'));
  appliquerModeRoutine();
  afficherVue('routine-lancer');
  majAffichageRoutineLancer();
  if (reprise) annoncer('Reprise à l’étape ' + positionRoutine(routineEnCours).numero + '.');
}

// Mode « Une seule chose » : seule l'étape en cours reste à l'écran, en
// grand. La classe « une-chose » sur l'écran cache tout ce qui est marqué
// « hors-une-chose » (voir styles.css).
function appliquerModeRoutine() {
  const uneChose = reglages.routineUneChose;
  document.getElementById('vue-routine-lancer').classList.toggle('une-chose', uneChose);
  document.getElementById('btn-rl-mode').textContent = uneChose ? 'Voir tout' : 'Une seule chose';
}

function basculerModeRoutine() {
  reglages.routineUneChose = !reglages.routineUneChose;
  sauverReglages();
  majCasesReglages();
  appliquerModeRoutine();
  // Seul le texte du gros bouton change : on ne réaffiche pas toute
  // l'étape, ce qui relancerait sa durée prévue depuis le début.
  majBoutonValiderRoutine();
  annoncer(reglages.routineUneChose
    ? 'Une seule chose : seule l’étape en cours est affichée.'
    : 'Vue complète de la routine.');
}

// Le gros bouton dit « C'est fait ✓ » en vue complète. En mode « Une seule
// chose », où l'on ne voit plus la suite, il dit ce qui va se passer.
function majBoutonValiderRoutine() {
  const liste = etapesMontrees(routineEnCours);
  const derniere = liste[liste.length - 1] === routineEnCours.index;
  document.getElementById('btn-rl-valider').textContent = !reglages.routineUneChose
    ? 'C’est fait ✓'
    : (derniere ? 'Terminer ✓' : 'Étape suivante ✓');
}

function majAffichageRoutineLancer() {
  const { routine, index, passees } = routineEnCours;
  const etape = routine.etapes[index];
  const liste = etapesMontrees(routineEnCours);
  const position = liste.indexOf(index);
  document.getElementById('rl-compteur').textContent = `Étape ${position + 1} / ${liste.length}`;

  // Journée difficile : une phrase dit pourquoi la routine est plus courte,
  // ou pourquoi elle ne l'est pas (aucune étape essentielle choisie).
  const note = document.getElementById('rl-note-difficile');
  const nbEss = nombreEssentielles(routine);
  if (reglages.journeeDifficile) {
    note.querySelector('small').textContent = nbEss
      ? 'Journée difficile : seulement les étapes essentielles (' + nbEss + ' sur ' + routine.etapes.length + ').'
      : 'Journée difficile : cette routine n’a pas encore d’étape essentielle, elle reste donc complète. Tu peux en choisir avec « Modifier ».';
  }
  note.classList.toggle('masque', !reglages.journeeDifficile);
  document.getElementById('rl-apercu-titre').textContent = reglages.journeeDifficile && nbEss
    ? 'Voir les étapes essentielles'
    : 'Voir toute la routine';

  const imageEl = document.getElementById('rl-etape-image');
  imageEl.textContent = etape.image || '';
  imageEl.classList.toggle('masque', !etape.image);
  document.getElementById('rl-etape-texte').textContent = etape.texte;

  // Ce qui vient ensuite : savoir à l'avance enlève une part d'imprévu.
  const ensuiteEl = document.getElementById('rl-ensuite');
  const suivante = routine.etapes[liste[position + 1]];
  if (suivante) {
    ensuiteEl.textContent = '';
    ensuiteEl.appendChild(document.createTextNode('Ensuite : '));
    const span = document.createElement('span');
    remplirEtape(span, suivante);
    ensuiteEl.appendChild(span);
  } else {
    ensuiteEl.textContent = 'C’est la dernière étape.';
  }

  document.getElementById('btn-rl-precedente').classList.toggle('masque', position === 0);
  majBoutonValiderRoutine();

  // La liste des étapes montrées, avec l'étape en cours repérée.
  document.getElementById('rl-liste').innerHTML = liste.map(i => {
    const e = routine.etapes[i];
    let classe = '';
    let suffixe = '';
    if (i === index) { classe = 'actuelle'; suffixe = ' <span class="duree">· maintenant</span>'; }
    else if (passees.includes(i)) { classe = 'passee'; suffixe = ' <span class="duree">· passée</span>'; }
    else if (i < index) { classe = 'faite'; }
    return `<li class="${classe}"${i === index ? ' aria-current="step"' : ''}>${etapeHtml(e)}${suffixe}</li>`;
  }).join('');

  demarrerMinuteurEtape(etape);
}

// fait : true si l'étape quittée a été faite, false si elle a été passée
// (le petit « ✓ Fait » ne s'affiche que dans le premier cas).
function etapeSuivanteRoutine(fait) {
  const suivante = etapesMontrees(routineEnCours).find(i => i > routineEnCours.index);
  if (suivante === undefined) {
    // L'écran « Routine terminée » suffit : pas de « ✓ Fait » en plus.
    terminerRoutine();
    return;
  }
  routineEnCours.index = suivante;
  sauverRoutineEnCours();
  if (reglages.transitionsDouces) {
    // La durée prévue de l'étape finie s'arrête pendant la pause ; celle de
    // l'étape suivante ne démarrera qu'à la fin de la pause.
    arreterMinuteurEtape();
    lancerPause('routine-lancer', routineEnCours.routine.etapes[suivante], () => {
      majAffichageRoutineLancer();
      document.getElementById('btn-rl-valider').focus();
    }, fait);
    return;
  }
  majAffichageRoutineLancer();
  if (fait) montrerFait();
}

function etapePrecedenteRoutine() {
  const avant = etapesMontrees(routineEnCours).filter(i => i < routineEnCours.index);
  if (!avant.length) return;
  routineEnCours.index = avant[avant.length - 1];
  sauverRoutineEnCours();
  majAffichageRoutineLancer();
}

function validerEtapeRoutine() {
  // Une étape passée puis refaite après un retour en arrière n'est plus « passée ».
  routineEnCours.passees = routineEnCours.passees.filter(i => i !== routineEnCours.index);
  etapeSuivanteRoutine(true);
}

// Passer une étape impossible aujourd'hui, sans mentir (« C'est fait ») ni
// tout abandonner.
function passerEtapeRoutine() {
  if (!routineEnCours.passees.includes(routineEnCours.index)) routineEnCours.passees.push(routineEnCours.index);
  annoncer('Étape passée.');
  etapeSuivanteRoutine(false);
}

function terminerRoutine() {
  const { routine, passees } = routineEnCours;
  routineEnCours = null;
  sauverRoutineEnCours();
  const zone = document.getElementById('rl-fin-passees');
  const textes = passees.slice().sort((a, b) => a - b).map(i => routine.etapes[i].texte);
  zone.querySelector('small').textContent = textes.length
    ? (textes.length > 1 ? 'Passées cette fois : ' : 'Passée cette fois : ') + textes.join(', ') + '.'
    : '';
  zone.classList.toggle('masque', textes.length === 0);
  // Une simple information, sans jugement : les étapes non essentielles
  // n'étaient pas au programme aujourd'hui, elles ne sont pas « ratées ».
  const allegee = reglages.journeeDifficile && nombreEssentielles(routine) > 0;
  document.getElementById('rl-fin-difficile').classList.toggle('masque', !allegee);
  noterDansHistorique(routine, allegee);
  afficherVue('routine-fin');
}

/* ---------- 9 bis. Historique des routines terminées ---------- */

// Seulement la date, l'heure et le nom de chaque routine terminée (et
// « l'essentiel » pour une journée difficile). Aucun total, aucune série,
// aucun score : juste de quoi se souvenir, si on en a envie. Une routine
// arrêtée en cours de route n'est pas notée.
function noterDansHistorique(routine, essentiel) {
  if (!reglages.historiqueActif) return;
  const entree = { id: creerId('h'), date: Date.now(), nom: routine.nom };
  if (essentiel) entree.essentiel = true;
  historique.push(entree);
  historique = historique.slice(-HISTORIQUE_MAX);
  sauverHistorique();
}

// « Aujourd'hui », « Hier », sinon « Lundi 20 octobre » (avec l'année si
// ce n'est pas l'année en cours).
function libelleJour(ts) {
  const d = new Date(ts);
  const maintenant = new Date();
  const hier = new Date();
  hier.setDate(hier.getDate() - 1);
  if (d.toDateString() === maintenant.toDateString()) return 'Aujourd’hui';
  if (d.toDateString() === hier.toDateString()) return 'Hier';
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== maintenant.getFullYear()) options.year = 'numeric';
  const texte = d.toLocaleDateString('fr-FR', options);
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// Une carte par jour, du plus récent au plus ancien.
function rendreHistorique() {
  const cont = document.getElementById('liste-historique');
  document.getElementById('historique-desactive').classList.toggle('masque', reglages.historiqueActif);
  document.getElementById('btn-historique-vider').classList.toggle('masque', historique.length === 0);
  if (historique.length === 0) {
    cont.innerHTML = '<p class="vide">Aucune routine terminée n’est notée ici.</p>';
    return;
  }
  const jours = [];
  historique.slice().reverse().forEach(h => {
    const libelle = libelleJour(h.date);
    if (!jours.length || jours[jours.length - 1].libelle !== libelle) jours.push({ libelle, entrees: [] });
    jours[jours.length - 1].entrees.push(h);
  });
  cont.innerHTML = jours.map(j => `
    <div class="fiche">
      <h2 class="jour-historique">${echapper(j.libelle)}</h2>
      <ul class="liste-historique">
        ${j.entrees.map(h => '<li>' + echapper(h.nom) + ' <span class="duree">· ' + heureLisible(h.date) +
          (h.essentiel ? ' · l’essentiel' : '') + '</span></li>').join('')}
      </ul>
    </div>
  `).join('');
}

function ouvrirHistorique() {
  desarmerBouton(document.getElementById('btn-historique-vider'));
  rendreHistorique();
  afficherVue('historique');
}

function arreterRoutine() {
  routineEnCours = null;
  sauverRoutineEnCours();
  afficherVue('routines');
  rendreListeRoutines();
  annoncer('Routine arrêtée.');
}

// La durée prévue d'une étape : une barre qui se vide doucement, et le
// temps restant écrit en mots. Elle démarre seule quand l'étape s'affiche
// (un geste de moins à faire) et ne pousse jamais à passer à la suite :
// quand le temps est écoulé, l'étape reste là, à son rythme.
function demarrerMinuteurEtape(etape) {
  arreterMinuteurEtape();
  const zone = document.getElementById('rl-minuteur-etape');
  zone.classList.remove('termine');
  if (!etape.minutes) { zone.classList.add('masque'); return; }
  zone.classList.remove('masque');
  const duree = etape.minutes * 60 * 1000;
  minuteurEtape = { fin: Date.now() + duree, duree, fini: false, handle: null };
  tickMinuteurEtape();
  minuteurEtape.handle = setInterval(tickMinuteurEtape, 1000);
}

function tickMinuteurEtape() {
  const m = minuteurEtape;
  if (!m) return;
  const restant = m.fin - Date.now();
  const barre = document.getElementById('rl-barre-etape');
  const texte = document.getElementById('rl-temps-etape');
  if (restant <= 0) {
    clearInterval(m.handle);
    document.getElementById('rl-minuteur-etape').classList.add('termine');
    barre.style.width = '100%';
    texte.textContent = 'Temps prévu écoulé. Tu peux finir à ton rythme.';
    if (!m.fini) {
      m.fini = true;
      annoncer('Temps prévu écoulé pour cette étape.');
      if (reglages.vibrationMinuteur && navigator.vibrate) navigator.vibrate(250);
    }
    return;
  }
  barre.style.width = (restant / m.duree * 100) + '%';
  const t = texteRestant(restant);
  if (texte.textContent !== t) texte.textContent = t;
}

function arreterMinuteurEtape() {
  if (minuteurEtape) clearInterval(minuteurEtape.handle);
  minuteurEtape = null;
}

/* ---------- 10. Tâches ---------- */

function estTermineeTache(t) {
  return t.etapes.length > 0 && t.etapes.every(e => e.faite);
}

// Recalcule si la tâche est terminée après chaque changement, plutôt que
// d'essayer de suivre des transitions séparées : c'est simple, et ça gère
// tout seul le cas où on décoche une étape d'une tâche déjà finie, ou où
// on ajoute une nouvelle étape à une tâche qu'on croyait terminée.
function majEtatTache(t) {
  const finie = estTermineeTache(t);
  t.termineeLe = finie ? (t.termineeLe || Date.now()) : null;
}

function majOngletsTaches() {
  document.getElementById('onglet-en-cours').setAttribute('aria-pressed', String(ongletTachesActif === 'en-cours'));
  document.getElementById('onglet-terminees').setAttribute('aria-pressed', String(ongletTachesActif === 'terminees'));
}

function rendreListeTaches() {
  const cont = document.getElementById('liste-taches');
  const filtrees = taches.filter(t => ongletTachesActif === 'en-cours' ? !estTermineeTache(t) : estTermineeTache(t));

  if (filtrees.length === 0) {
    cont.innerHTML = `<p class="vide">${ongletTachesActif === 'en-cours' ? 'Aucune tâche en cours.' : 'Aucune tâche terminée pour l’instant.'}</p>`;
    return;
  }

  cont.innerHTML = filtrees.map(t => {
    const faites = t.etapes.filter(e => e.faite).length;
    let meta = ongletTachesActif === 'en-cours'
      ? `${faites} / ${t.etapes.length} étapes faites`
      : 'Terminée le ' + formaterDate(t.termineeLe) + comparaisonTemps(t);
    if (t.epinglee) meta += ' · sur l’accueil';
    return `
      <div class="fiche">
        <div class="nom">${echapper(t.nom)}</div>
        <div class="meta">${meta}</div>
        <div class="bouton-rangee">
          <button type="button" class="bouton-doux" data-action="ouvrir" data-id="${t.id}">${ongletTachesActif === 'en-cours' ? 'Ouvrir' : 'Revoir'}</button>
          <button type="button" data-action="supprimer" data-id="${t.id}">Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

// id : la tâche à modifier, ou null pour en créer une.
function ouvrirFormulaireTache(id) {
  const t = id ? taches.find(x => x.id === id) : null;
  tacheEnEdition = t ? id : null;
  document.getElementById('titre-tache-form').textContent = t ? 'Modifier la tâche' : 'Nouvelle tâche';
  document.getElementById('tf-nom').value = t ? t.nom : '';
  // La petite action de démarrage a son propre champ : on la sort de la
  // liste des étapes. Son état « faite » est gardé sur le champ, pour ne
  // pas la décocher si on enregistre sans changer son texte.
  const mini = t && t.etapes[0] && t.etapes[0].mini ? t.etapes[0] : null;
  const miniEl = document.getElementById('tf-mini');
  miniEl.value = mini ? mini.texte : '';
  miniEl.dataset.texte = mini ? mini.texte : '';
  miniEl.dataset.faite = mini && mini.faite ? '1' : '';
  document.getElementById('tf-prevu').value = t && t.tempsPrevu ? String(t.tempsPrevu) : '';
  const etapesEl = document.getElementById('tf-etapes');
  viderEditeur(etapesEl);
  if (t) {
    t.etapes.filter(e => !e.mini).forEach(e => ajouterLigneEtape(etapesEl, e));
  } else {
    ajouterLigneEtape(etapesEl);
    ajouterLigneEtape(etapesEl);
  }
  afficherVue('tache-form');
}

function enregistrerTache() {
  const nom = document.getElementById('tf-nom').value.trim();
  const etapes = lireEtapes(document.getElementById('tf-etapes')).map(e => {
    const etape = { texte: e.texte, faite: e.faite === true };
    if (e.image) etape.image = e.image;
    return etape;
  });
  // La petite action de démarrage devient la toute première étape.
  // Déjà faite, elle le reste tant que son texte ne change pas.
  const miniEl = document.getElementById('tf-mini');
  const miniTexte = miniEl.value.trim();
  if (miniTexte) {
    const dejaFaite = miniEl.dataset.faite === '1' && miniTexte === miniEl.dataset.texte;
    etapes.unshift({ texte: miniTexte, faite: dejaFaite, mini: true });
  }
  // Temps prévu (facultatif) : des minutes entières, de 1 à 600 (10 h).
  const prevu = parseInt(document.getElementById('tf-prevu').value, 10);
  const tempsPrevu = prevu >= 1 ? Math.min(prevu, 600) : null;
  if (!nom) { annoncer('Donne un nom à la tâche.'); document.getElementById('tf-nom').focus(); return; }
  if (etapes.length === 0) { annoncer('Ajoute au moins une étape.'); return; }

  fermerChoixImage();
  if (tacheEnEdition) {
    const t = taches.find(x => x.id === tacheEnEdition);
    t.nom = nom;
    t.etapes = etapes;
    if (tempsPrevu) t.tempsPrevu = tempsPrevu;
    else delete t.tempsPrevu;
    majEtatTache(t);
    sauverTaches();
    ouvrirTache(t.id);
    annoncer('Tâche modifiée.');
    return;
  }
  const nouvelle = { id: creerId('t'), nom, etapes, termineeLe: null };
  if (tempsPrevu) nouvelle.tempsPrevu = tempsPrevu;
  taches.push(nouvelle);
  sauverTaches();
  ongletTachesActif = 'en-cours';
  majOngletsTaches();
  afficherVue('taches');
  rendreListeTaches();
}

function annulerFormulaireTache() {
  fermerChoixImage();
  if (tacheEnEdition && taches.some(t => t.id === tacheEnEdition)) { ouvrirTache(tacheEnEdition); return; }
  afficherVue('taches');
  rendreListeTaches();
}

function ouvrirTache(id) {
  tacheOuverteId = id;
  tdIndexAffiche = null;
  const t = taches.find(x => x.id === id);
  // Si le bouton a été armé sur une autre tâche il y a moins de 4 secondes,
  // on le désarme : chaque tâche repart avec ses deux appuis.
  desarmerBouton(document.getElementById('btn-td-supprimer'));
  desarmerBouton(document.getElementById('btn-td-chrono-zero'));
  document.getElementById('titre-tache-detail').textContent = t.nom;
  document.getElementById('td-nouvelle-etape').value = '';
  rendreDetailTache();
  afficherVue('tache-detail');
}

// Les étapes pas encore faites, par leur position dans la tâche.
function indexNonFaites(t) {
  return t.etapes.map((e, i) => (e.faite ? -1 : i)).filter(i => i >= 0);
}

// Chrono de la tâche : { cumul, depuis }. « cumul » est le temps déjà
// compté, en millisecondes ; « depuis » est l'heure à laquelle il a été
// lancé, ou null s'il est en pause. Comme le minuteur, il se base sur des
// heures et non sur un compteur : il reste juste même si le téléphone se
// verrouille ou si Cap est fermée.
function tempsChrono(t) {
  const c = t.chrono;
  if (!c) return 0;
  return c.cumul + (c.depuis ? Math.max(0, Date.now() - c.depuis) : 0);
}
function chronoTourne(t) {
  return !!(t.chrono && t.chrono.depuis);
}
// À la minute près, jamais à la seconde : le texte ne bouge pas sans arrêt.
function minutesChrono(t) {
  return Math.floor(tempsChrono(t) / 60000);
}
function lancerChrono(t) {
  t.chrono = { cumul: tempsChrono(t), depuis: Date.now() };
}
function arreterChrono(t) {
  if (chronoTourne(t)) t.chrono = { cumul: tempsChrono(t), depuis: null };
}

// L'écart entre le temps prévu et le temps réel, dit de façon neutre et
// factuelle : une information pour mieux prévoir, jamais un reproche.
function texteEcart(prevu, reel) {
  const ecart = reel - prevu;
  if (ecart === 0) return 'Autant que prévu.';
  return texteMinutes(Math.abs(ecart)) + (ecart > 0 ? ' de plus que prévu.' : ' de moins que prévu.');
}

// « · prévu 20 min, réel 35 min » dans la liste des tâches terminées,
// seulement avec ce qui est connu.
function comparaisonTemps(t) {
  const parties = [];
  if (t.tempsPrevu) parties.push('prévu ' + texteMinutes(t.tempsPrevu));
  if (t.chrono) parties.push('réel ' + texteMinutes(minutesChrono(t)));
  return parties.length ? ' · ' + parties.join(', ') : '';
}

// La carte « Temps passé » du détail de la tâche.
function majTempsTache() {
  const t = taches.find(x => x.id === tacheOuverteId);
  if (!t) return;
  const mesure = !!t.chrono;
  const parties = [mesure ? texteMinutes(minutesChrono(t)) : 'Pas encore mesuré'];
  if (t.tempsPrevu) parties.push('prévu : ' + texteMinutes(t.tempsPrevu));
  const texte = parties.join(' · ');
  const el = document.getElementById('td-temps-texte');
  if (el.textContent !== texte) el.textContent = texte;

  // L'écart n'apparaît qu'une fois la tâche terminée (et le chrono
  // arrêté) : le temps réel est alors connu.
  const avecEcart = !!t.tempsPrevu && mesure && !chronoTourne(t) && estTermineeTache(t);
  const ecartEl = document.getElementById('td-temps-ecart');
  ecartEl.textContent = avecEcart ? texteEcart(t.tempsPrevu, minutesChrono(t)) : '';
  ecartEl.classList.toggle('masque', !avecEcart);
  document.getElementById('td-temps-note').classList.toggle('masque', !avecEcart);

  document.getElementById('btn-td-chrono').textContent =
    chronoTourne(t) ? 'Pause' : (mesure ? 'Reprendre' : 'Commencer');
  document.getElementById('btn-td-chrono-zero').classList.toggle('masque', !mesure);
}

// Tant que la tâche est à l'écran et que son chrono tourne, le texte est
// revu chaque seconde (il ne change qu'une fois par minute). Quitter
// l'écran arrête cette mise à jour, pas le chrono.
function suivreChrono() {
  clearInterval(chronoHandle);
  const t = taches.find(x => x.id === tacheOuverteId);
  if (t && chronoTourne(t)) chronoHandle = setInterval(majTempsTache, 1000);
}

function rendreDetailTache() {
  const t = taches.find(x => x.id === tacheOuverteId);
  if (!t) return;
  const faites = t.etapes.filter(e => e.faite).length;
  document.getElementById('td-progres').textContent = `${faites} / ${t.etapes.length} étapes faites`;
  document.getElementById('td-barre').style.width = t.etapes.length ? Math.round(faites / t.etapes.length * 100) + '%' : '0%';

  // Liste complète, à cocher.
  const cont = document.getElementById('td-etapes');
  cont.innerHTML = '';
  t.etapes.forEach((e, i) => {
    const label = document.createElement('label');
    label.className = 'etape-cochable';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = e.faite;
    input.dataset.idx = String(i);
    const span = document.createElement('span');
    remplirEtape(span, e);
    label.appendChild(input);
    if (e.mini) {
      // La petite action de démarrage, mise en valeur doucement (fond de la
      // couleur de la gamme) avec l'étiquette « Pour démarrer » au-dessus.
      // L'étiquette est à côté du texte, pas dedans : une fois l'étape
      // cochée, seul le texte est barré.
      label.classList.add('etape-mini');
      const colonne = document.createElement('span');
      colonne.className = 'colonne';
      const etiquette = document.createElement('small');
      etiquette.className = 'etiquette-mini';
      etiquette.textContent = 'Pour démarrer';
      colonne.appendChild(etiquette);
      colonne.appendChild(span);
      label.appendChild(colonne);
    } else {
      label.appendChild(span);
    }
    cont.appendChild(label);
  });

  // Mode « Une seule chose » : voir douze étapes d'un coup peut
  // décourager ; ici, une seule est à l'écran, en grand, sans la
  // progression ni les autres boutons (classe « une-chose », comme pour
  // les routines). Le bouton garde sa place et dit ce qu'il fera.
  const uneEtape = reglages.tacheUneEtape;
  document.getElementById('vue-tache-detail').classList.toggle('une-chose', uneEtape);
  document.getElementById('btn-td-mode').textContent = uneEtape ? 'Voir tout' : 'Une seule chose';
  document.getElementById('td-une-etape').classList.toggle('masque', !uneEtape);
  document.getElementById('td-tout').classList.toggle('masque', uneEtape);

  const restantes = indexNonFaites(t);
  if (!restantes.includes(tdIndexAffiche)) tdIndexAffiche = restantes.length ? restantes[0] : null;
  const imageEl = document.getElementById('td-ue-image');
  const texteEl = document.getElementById('td-ue-texte');
  if (tdIndexAffiche === null) {
    imageEl.classList.add('masque');
    texteEl.textContent = 'Tout est fait ✓';
  } else {
    const e = t.etapes[tdIndexAffiche];
    imageEl.textContent = e.image || '';
    imageEl.classList.toggle('masque', !e.image);
    texteEl.textContent = e.texte;
  }
  document.getElementById('td-ue-mini').classList.toggle('masque',
    tdIndexAffiche === null || !t.etapes[tdIndexAffiche].mini);
  const btnFait = document.getElementById('btn-td-ue-fait');
  btnFait.textContent = restantes.length > 1 ? 'Étape suivante ✓' : 'Terminer ✓';
  btnFait.classList.toggle('masque', tdIndexAffiche === null);
  document.getElementById('btn-td-ue-autre').classList.toggle('masque', restantes.length < 2);

  const btnEpingle = document.getElementById('btn-td-epingler');
  btnEpingle.setAttribute('aria-pressed', String(!!t.epinglee));
  btnEpingle.textContent = t.epinglee ? 'Retirer de l’accueil' : 'Épingler sur l’accueil';

  majTempsTache();
  suivreChrono();
}

// Coche une étape (depuis la tâche ou depuis l'accueil), puis enregistre.
function cocherEtapeTache(t, idx, faite) {
  t.etapes[idx].faite = faite;
  majEtatTache(t);
  // Tâche finie : son chrono s'arrête tout seul, le temps réel est connu.
  if (faite && estTermineeTache(t)) arreterChrono(t);
  sauverTaches();
  if (faite && estTermineeTache(t)) annoncer('Tâche terminée : ' + t.nom);
}

// L'étape non faite qui suit `depuis`, en revenant au début si besoin.
function prochaineNonFaite(t, depuis) {
  const restantes = indexNonFaites(t);
  if (!restantes.length) return null;
  return restantes.find(i => i > depuis) ?? restantes[0];
}

function basculerEpinglage() {
  const t = taches.find(x => x.id === tacheOuverteId);
  if (!t) return;
  const epingler = !t.epinglee;
  // Une seule tâche du jour à la fois : moins de choix, une seule chose sous les yeux.
  taches.forEach(x => { delete x.epinglee; });
  if (epingler) t.epinglee = true;
  sauverTaches();
  rendreDetailTache();
  annoncer(epingler ? 'Tâche épinglée sur l’accueil.' : 'Tâche retirée de l’accueil.');
}

/* ---------- 11. Minuteur visuel ---------- */

// Une application web ne peut rien afficher sur l'écran verrouillé. La seule
// façon honnête de garder le minuteur visible est d'empêcher le téléphone de
// se verrouiller pendant qu'il tourne — sans notification ni son.
function minuteurVeutEcranAllume() {
  return reglages.ecranAllumeMinuteur && minEnCours && !minEnPause;
}

async function demanderEcranAllume() {
  clearTimeout(delaiLiberationEcran);
  if (!('wakeLock' in navigator) || verrouEcran || demandeEcranEnCours) return;
  demandeEcranEnCours = true;
  try {
    const verrou = await navigator.wakeLock.request('screen');
    verrouEcran = verrou;
    // Android rend le verrou tout seul quand on quitte l'application.
    verrou.addEventListener('release', () => {
      if (verrouEcran === verrou) verrouEcran = null;
    });
    // Le minuteur a pu être arrêté pendant la demande : on rend aussitôt.
    if (!minuteurVeutEcranAllume()) libererEcranAllume();
  } catch (e) {
    // Refus possible (économiseur de batterie…) : le minuteur marche quand même.
  } finally {
    demandeEcranEnCours = false;
  }
}

function libererEcranAllume() {
  clearTimeout(delaiLiberationEcran);
  if (verrouEcran) {
    verrouEcran.release().catch(() => {});
    verrouEcran = null;
  }
}

function majTempsTexte(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  document.getElementById('min-temps').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function majAnneau(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  const cercle = document.getElementById('min-cercle');
  cercle.style.strokeDasharray = String(MIN_CIRCONFERENCE);
  cercle.style.strokeDashoffset = String(MIN_CIRCONFERENCE * (1 - f));
}

function majEtatMinuteur(texte) {
  const el = document.getElementById('min-etat');
  if (el.textContent !== texte) el.textContent = texte;
}

// Le préavis couvre la fin du temps : un cinquième de la durée, entre
// 30 secondes et 2 minutes (1 minute pour 5 minutes, 2 minutes pour 25).
function dureePreavis(dureeMs) {
  return Math.min(2 * 60 * 1000, Math.max(30 * 1000, dureeMs / 5));
}

function selectionnerDureeRapide(minutes, boutonSource) {
  minDureeMs = minutes * 60 * 1000;
  document.querySelectorAll('#min-choix-duree button').forEach(b => {
    b.setAttribute('aria-pressed', String(b === boutonSource));
  });
  document.getElementById('min-libre').value = '';
  if (!minEnCours) { majTempsTexte(minDureeMs); majAnneau(1); }
}

// Renvoie true si la durée tapée a été retenue, false sinon.
function validerDureeLibre() {
  const val = parseInt(document.getElementById('min-libre').value, 10);
  if (!val || val < 1) { annoncer('Entre un nombre de minutes valable.'); return false; }
  const minutes = Math.min(val, 180);
  minDureeMs = minutes * 60 * 1000;
  document.querySelectorAll('#min-choix-duree button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (!minEnCours) { majTempsTexte(minDureeMs); majAnneau(1); }
  return true;
}

function demarrerMinuteur() {
  // Une durée tapée dans « Autre » sans avoir appuyé sur « Valider » compte
  // quand même : sinon on lancerait l'ancienne durée sans prévenir.
  if (document.getElementById('min-libre').value.trim() !== '' && !validerDureeLibre()) return;
  if (minDureeMs <= 0) return;
  minEnCours = true;
  minEnPause = false;
  minTermine = false;
  minFiniNonVu = false;
  minPreavisAnnonce = false;
  minFinTimestamp = Date.now() + minDureeMs;

  // Le nom choisi (« Pause », « Avant de partir ») reste affiché au-dessus
  // de l'anneau : en revenant sur l'écran, on sait à quoi il sert.
  minNomActuel = document.getElementById('min-nom').value.trim();
  const nomEl = document.getElementById('min-nom-affiche');
  nomEl.textContent = minNomActuel;
  nomEl.classList.toggle('masque', !minNomActuel);

  document.getElementById('min-reglage-duree').classList.add('masque');
  document.getElementById('min-controles-avant').classList.add('masque');
  document.getElementById('min-controles-en-cours').classList.remove('masque');
  document.getElementById('min-controles-fin').classList.add('masque');
  document.getElementById('min-anneau').classList.remove('termine', 'bientot');
  document.getElementById('btn-min-pause').textContent = 'Pause';

  clearInterval(minTimerHandle);
  minTimerHandle = setInterval(tickMinuteur, 250);
  tickMinuteur();
  if (minuteurVeutEcranAllume()) demanderEcranAllume();
}

function tickMinuteur() {
  if (minEnPause) return;
  const restant = minFinTimestamp - Date.now();
  if (restant <= 0) { finMinuteur(); return; }
  majTempsTexte(restant);
  majAnneau(restant / minDureeMs);

  // Préavis : l'anneau prend doucement une autre teinte (transition lente
  // en CSS) et le temps restant s'écrit en mots. Les changements d'activité
  // sont souvent le moment le plus dur : être prévenu aide à s'y préparer.
  const preavis = reglages.preavisMinuteur && restant <= dureePreavis(minDureeMs);
  document.getElementById('min-anneau').classList.toggle('bientot', preavis);
  const fin = 'fin à ' + heureLisible(minFinTimestamp);
  majEtatMinuteur(preavis ? texteRestant(restant) + ' · ' + fin : 'En cours · ' + fin);
  if (preavis && !minPreavisAnnonce) {
    minPreavisAnnonce = true;
    annoncer('Le minuteur finit bientôt. ' + texteRestant(restant) + '.');
  }
}

function togglePauseMinuteur() {
  if (!minEnCours) return;
  if (!minEnPause) {
    minEnPause = true;
    minRestantMsAuPause = minFinTimestamp - Date.now();
    document.getElementById('btn-min-pause').textContent = 'Reprendre';
    majEtatMinuteur('En pause');
    libererEcranAllume();
  } else {
    minEnPause = false;
    minFinTimestamp = Date.now() + minRestantMsAuPause;
    document.getElementById('btn-min-pause').textContent = 'Pause';
    tickMinuteur();
    if (minuteurVeutEcranAllume()) demanderEcranAllume();
  }
}

function arreterMinuteur() {
  clearInterval(minTimerHandle);
  minEnCours = false;
  minEnPause = false;
  minTermine = false;
  minFiniNonVu = false;
  libererEcranAllume();
  document.getElementById('min-anneau').classList.remove('termine', 'bientot');
  document.getElementById('min-nom-affiche').classList.add('masque');
  document.getElementById('min-reglage-duree').classList.remove('masque');
  document.getElementById('min-controles-avant').classList.remove('masque');
  document.getElementById('min-controles-en-cours').classList.add('masque');
  document.getElementById('min-controles-fin').classList.add('masque');
  majEtatMinuteur('Choisis une durée');
  majTempsTexte(minDureeMs);
  majAnneau(1);
}

function finMinuteur() {
  clearInterval(minTimerHandle);
  minEnCours = false;
  minTermine = true;
  // Si la fin arrive pendant que la personne est ailleurs dans Cap, l'accueil
  // le lui dit jusqu'à ce qu'elle revienne sur le minuteur.
  minFiniNonVu = !(vueCourante === 'minuteur' && document.visibilityState === 'visible');
  majTempsTexte(0);
  majAnneau(0);
  document.getElementById('min-anneau').classList.remove('bientot');
  document.getElementById('min-anneau').classList.add('termine');
  majEtatMinuteur('Terminé');
  document.getElementById('min-controles-en-cours').classList.add('masque');
  document.getElementById('min-controles-fin').classList.remove('masque');
  annoncer('Le minuteur est terminé.');
  // Un seul signal court, jamais de son : juste une vibration brève, et le
  // changement de couleur de l'anneau (voir la classe "termine" en CSS).
  if (reglages.vibrationMinuteur && navigator.vibrate) navigator.vibrate(250);
  // L'écran reste allumé encore une minute, pour que le changement de
  // couleur soit vu, puis le téléphone reprend sa mise en veille normale.
  if (verrouEcran) {
    clearTimeout(delaiLiberationEcran);
    delaiLiberationEcran = setTimeout(libererEcranAllume, GRACE_ECRAN_APRES_FIN_MS);
  }
  if (vueCourante === 'accueil') majAccueil();
}

function recommencerMinuteur() {
  document.getElementById('min-controles-fin').classList.add('masque');
  arreterMinuteur();
}

/* ---------- 12. Sauvegarde et restauration ---------- */

// Tout ce que la personne saisit vit dans le localStorage du navigateur.
// Si les « données du site » sont effacées (nettoyage du cache,
// réinstallation, nouveau téléphone), tout part avec. Le seul rempart est
// un fichier rangé dans le téléphone lui-même : on le fabrique ici, et on
// sait le relire. Le fichier ne quitte jamais l'appareil : il est copié
// vers le dossier Téléchargements, sans aucun appel réseau.
//
// Restaurer n'efface rien de ce qui est déjà là : les routines, les tâches
// et l'historique du fichier sont AJOUTÉS, sauf ce qui existe déjà (même
// identifiant) — restaurer deux fois ne crée donc pas de doublon. Seuls les
// réglages (thème, couleurs, taille du texte, options du minuteur, journée
// difficile, modes « Une seule chose », transitions douces, petit « Fait »,
// historique allumé ou non) sont remplacés.
//
// Version 2 du fichier : les étapes de routine sont des objets
// { texte, image, minutes } au lieu de simples textes, et les étapes de
// tâche peuvent avoir une image. Les fichiers de version 1 se relisent
// toujours : nettoyerRoutine() accepte les deux formes.
//
// Version 3 : une étape de routine peut être « essentielle »
// ({ ..., essentielle: true }) ; la première étape d'une tâche peut être sa
// petite action de démarrage ({ ..., mini: true }) ; une tâche peut avoir
// un temps prévu (tempsPrevu, en minutes) et un chrono ({ cumul, depuis }) ;
// le fichier contient l'historique des routines terminées
// ([{ id, date, nom, essentiel? }]) ; les réglages comptent de nouvelles
// cases (journeeDifficile, routineUneChose, transitionsDouces,
// dureeTransition, retourFait, historiqueActif). Ce ne sont que des ajouts
// facultatifs : un fichier de version 1 ou 2 se relit tel quel (une étape
// sans « essentielle » ne l'est simplement pas).
//
// ATTENTION : les fonctions nettoyer…() ci-dessous ne gardent QUE les
// informations qu'elles connaissent, au chargement comme à la restauration.
// Toute nouvelle information doit y être ajoutée, sinon elle disparaîtrait.

const CLE_DERNIERE_SAUVEGARDE = 'cap_derniere_sauvegarde';

function messageSauvegarde(texte) {
  const zone = document.getElementById('restaurer-message');
  zone.textContent = texte;
  zone.classList.toggle('masque', !texte);
}

function formaterJour(ts) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function afficherDerniereSauvegarde() {
  let ts = null;
  try { ts = Number(localStorage.getItem(CLE_DERNIERE_SAUVEGARDE)) || null; } catch (e) { /* rien */ }
  document.querySelector('#derniere-sauvegarde small').textContent = ts
    ? 'Dernière sauvegarde : le ' + formaterJour(ts) + '.'
    : 'Aucune sauvegarde faite depuis ce téléphone pour l’instant.';
}

function enregistrerSauvegarde() {
  const donnees = {
    app: 'cap',
    version: 3,
    exporte: new Date().toISOString(),
    routines: routines,
    taches: taches,
    reglages: reglages,
    historique: historique
  };

  // La date dans le nom permet de garder plusieurs sauvegardes côte à côte
  // sans qu'elles s'écrasent.
  const d = new Date();
  const jour = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nom = 'sauvegarde-cap-' + jour + '.json';

  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);

  try { localStorage.setItem(CLE_DERNIERE_SAUVEGARDE, String(Date.now())); } catch (e) { /* rien */ }
  afficherDerniereSauvegarde();
  messageSauvegarde('Fichier « ' + nom + ' » créé dans tes Téléchargements. ' +
    'Tu peux aussi le copier ailleurs (clé USB, ordinateur) pour plus de sûreté.');
  annoncer('Sauvegarde enregistrée.');
}

// Tout ce qui vient du fichier (ou du stockage du téléphone) est vérifié
// avant d'être gardé : une donnée abîmée ou étrangère ne doit jamais
// empêcher Cap de démarrer ensuite.

// Un identifiant est réécrit tel quel dans la page (data-id="…") : on
// n'accepte que des lettres, chiffres, « _ » et « - ». Un identifiant
// bizarre (guillemets, chevrons…) pourrait sinon y glisser du code.
function idPropre(id, prefixe) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : creerId(prefixe);
}

// Une image d'étape : un court texte (un émoji). Toujours affichée avec
// textContent, elle ne peut pas contenir de code.
function imageValable(image) {
  return typeof image === 'string' && image.length > 0 && image.length <= 16;
}

function nettoyerEtapeRoutine(e) {
  // Ancien format (version 1) : l'étape n'était qu'un texte.
  if (typeof e === 'string') return e.trim() ? { texte: e } : null;
  if (!e || typeof e !== 'object' || typeof e.texte !== 'string' || !e.texte.trim()) return null;
  const etape = { texte: e.texte };
  if (imageValable(e.image)) etape.image = e.image;
  if (Number.isInteger(e.minutes) && e.minutes >= 1 && e.minutes <= 180) etape.minutes = e.minutes;
  if (e.essentielle === true) etape.essentielle = true;
  return etape;
}

function nettoyerRoutine(r) {
  if (!r || typeof r !== 'object' || typeof r.nom !== 'string' || !Array.isArray(r.etapes)) return null;
  const etapes = r.etapes.map(nettoyerEtapeRoutine).filter(Boolean);
  if (!r.nom.trim() || etapes.length === 0) return null;
  return { id: idPropre(r.id, 'r'), nom: r.nom, etapes };
}

function nettoyerTache(t) {
  if (!t || typeof t !== 'object' || typeof t.nom !== 'string' || !Array.isArray(t.etapes)) return null;
  const etapes = t.etapes
    .filter(e => e && typeof e === 'object' && typeof e.texte === 'string')
    .map((e, i) => {
      const etape = { texte: e.texte, faite: e.faite === true };
      if (imageValable(e.image)) etape.image = e.image;
      // La petite action de démarrage est toujours la première étape.
      if (e.mini === true && i === 0) etape.mini = true;
      return etape;
    });
  if (!t.nom.trim() || etapes.length === 0) return null;
  const tache = {
    id: idPropre(t.id, 't'),
    nom: t.nom,
    etapes,
    termineeLe: typeof t.termineeLe === 'number' && Number.isFinite(t.termineeLe) ? t.termineeLe : null
  };
  if (t.epinglee === true) tache.epinglee = true;
  if (Number.isInteger(t.tempsPrevu) && t.tempsPrevu >= 1 && t.tempsPrevu <= 600) tache.tempsPrevu = t.tempsPrevu;
  // Le chrono : un temps déjà compté (positif) et, s'il tourne, son heure de
  // départ. Un chrono vide n'est pas gardé.
  const c = t.chrono;
  if (c && typeof c === 'object' && Number.isFinite(c.cumul) && c.cumul >= 0) {
    const depuis = Number.isFinite(c.depuis) && c.depuis > 0 ? c.depuis : null;
    if (c.cumul > 0 || depuis) tache.chrono = { cumul: c.cumul, depuis };
  }
  majEtatTache(tache);
  return tache;
}

// Une ligne de l'historique : une date, un nom, et « essentiel » pour une
// routine faite en version journée difficile.
function nettoyerEntreeHistorique(h) {
  if (!h || typeof h !== 'object' || typeof h.nom !== 'string' || !h.nom.trim()) return null;
  if (!Number.isFinite(h.date) || h.date <= 0) return null;
  const entree = { id: idPropre(h.id, 'h'), date: h.date, nom: h.nom };
  if (h.essentiel === true) entree.essentiel = true;
  return entree;
}

function nettoyerReglages(r) {
  const propre = {};
  ['vibrationMinuteur', 'ecranAllumeMinuteur', 'preavisMinuteur', 'tacheUneEtape',
    'routineUneChose', 'journeeDifficile', 'transitionsDouces', 'retourFait',
    'historiqueActif'].forEach(cle => {
    if (typeof r[cle] === 'boolean') propre[cle] = r[cle];
  });
  if (DUREES_TRANSITION.includes(r.dureeTransition)) propre.dureeTransition = r.dureeTransition;
  if (['auto', 'sombre', 'clair'].includes(r.theme)) propre.theme = r.theme;
  const palettes = Array.from(document.querySelectorAll('#choix-palette button')).map(b => b.dataset.paletteVal);
  if (palettes.includes(r.palette)) propre.palette = r.palette;
  if (ECHELLES.includes(r.echelle)) propre.echelle = r.echelle;
  return propre;
}

// Renvoie ce qu'il y a à restaurer, ou un texte d'erreur.
function lireSauvegarde(d) {
  const etranger = 'Ce fichier ne ressemble pas à une sauvegarde de Cap.';
  if (!d || typeof d !== 'object' || Array.isArray(d)) return etranger;
  if (d.app && d.app !== 'cap') {
    return 'Ce fichier est une sauvegarde d’une autre application (« ' + String(d.app) +
      ' ») : il ne peut pas être restauré dans Cap.';
  }
  if (!['routines', 'taches', 'reglages', 'historique'].some(cle => cle in d)) return etranger;
  return {
    exporte: Date.parse(d.exporte) || null,
    routines: Array.isArray(d.routines) ? d.routines.map(nettoyerRoutine).filter(Boolean) : [],
    taches: Array.isArray(d.taches) ? d.taches.map(nettoyerTache).filter(Boolean) : [],
    reglages: d.reglages && typeof d.reglages === 'object' ? nettoyerReglages(d.reglages) : {},
    historique: Array.isArray(d.historique) ? d.historique.map(nettoyerEntreeHistorique).filter(Boolean) : []
  };
}

function resumeRestauration(r) {
  const contenu = [];
  if (r.routines.length) contenu.push(pluriel(r.routines.length, 'routine', 'routines'));
  if (r.taches.length) contenu.push(pluriel(r.taches.length, 'tâche', 'tâches'));
  // Pas de nombre pour l'historique : ce n'est pas un score.
  if (r.historique.length) contenu.push('ton historique');
  const avecReglages = Object.keys(r.reglages).length > 0;
  if (avecReglages) contenu.push('tes réglages');
  if (!contenu.length) return null;

  const liste = contenu.length > 1
    ? contenu.slice(0, -1).join(', ') + ' et ' + contenu[contenu.length - 1]
    : contenu[0];
  let texte = (r.exporte ? 'Sauvegarde du ' + formaterJour(r.exporte) : 'Cette sauvegarde') + ' : ' + liste + '. ';
  if (r.routines.length || r.taches.length || r.historique.length) texte += 'Ce qui est déjà sur ce téléphone est gardé, sans doublon. ';
  if (avecReglages) texte += 'Les réglages actuels seront remplacés par ceux du fichier.';
  return texte.trim();
}

let restaurationEnAttente = null;

function fermerConfirmationRestauration() {
  restaurationEnAttente = null;
  document.getElementById('restaurer-confirmation').classList.add('masque');
}

async function lireFichierRestauration(fichier) {
  fermerConfirmationRestauration();
  messageSauvegarde('');
  if (!fichier) return;

  let donnees;
  try {
    if (fichier.size > 20 * 1024 * 1024) throw new Error('Fichier trop gros');
    donnees = JSON.parse(await fichier.text());
  } catch (e) {
    messageSauvegarde('Ce fichier n’a pas pu être lu. Choisis un fichier ' +
      '« sauvegarde-cap… .json » créé par Cap.');
    return;
  }

  const lu = lireSauvegarde(donnees);
  if (typeof lu === 'string') { messageSauvegarde(lu); return; }
  const resume = resumeRestauration(lu);
  if (!resume) { messageSauvegarde('Ce fichier ne contient rien à restaurer.'); return; }

  // Rien n'est écrit avant l'appui sur « Restaurer » : on montre d'abord
  // ce que contient le fichier.
  restaurationEnAttente = lu;
  document.getElementById('restaurer-resume').textContent = resume;
  document.getElementById('restaurer-confirmation').classList.remove('masque');
  annoncer(resume);
}

function confirmerRestauration() {
  const r = restaurationEnAttente;
  fermerConfirmationRestauration();
  if (!r) return;

  const idsRoutines = new Set(routines.map(x => x.id));
  const nouvellesRoutines = r.routines.filter(x => !idsRoutines.has(x.id));
  const idsTaches = new Set(taches.map(x => x.id));
  const nouvellesTaches = r.taches.filter(x => !idsTaches.has(x.id));

  const idsHistorique = new Set(historique.map(x => x.id));
  const nouvellesEntrees = r.historique.filter(x => !idsHistorique.has(x.id));

  routines = routines.concat(nouvellesRoutines);
  taches = taches.concat(nouvellesTaches);
  // La tâche déjà épinglée sur ce téléphone garde sa place.
  unSeulEpinglage(taches);
  // L'historique reste rangé par date, et limité aux 500 plus récentes.
  historique = historique.concat(nouvellesEntrees).sort((a, b) => a.date - b.date).slice(-HISTORIQUE_MAX);
  Object.assign(reglages, r.reglages);

  try {
    sauverRoutines();
    sauverTaches();
    sauverReglages();
    localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(historique));
  } catch (e) {
    messageSauvegarde('La restauration n’a pas pu être enregistrée : la mémoire du navigateur est peut-être pleine.');
    annoncer('Restauration impossible.');
    return;
  }

  // Les écrans se mettent à jour tout de suite, sans recharger Cap.
  appliquerApparence();
  majAffichageReglages();
  document.getElementById('min-vibration').checked = reglages.vibrationMinuteur;
  document.getElementById('min-ecran-allume').checked = reglages.ecranAllumeMinuteur;
  document.getElementById('min-preavis').checked = reglages.preavisMinuteur;

  const n1 = nouvellesRoutines.length;
  const n2 = nouvellesTaches.length;
  const bilan = 'Restauration terminée : ' +
    n1 + (n1 > 1 ? ' routines ajoutées, ' : ' routine ajoutée, ') +
    n2 + (n2 > 1 ? ' tâches ajoutées' : ' tâche ajoutée') +
    (nouvellesEntrees.length ? ', historique complété' : '') +
    (Object.keys(r.reglages).length ? ', réglages rétablis.' : '.');
  messageSauvegarde(bilan);
  annoncer(bilan);
}

/* ---------- 13. Mise en place des écouteurs, au chargement ---------- */

document.addEventListener('DOMContentLoaded', () => {

  // Retour direct à l'accueil, depuis n'importe quel écran qui porte cet attribut.
  document.querySelectorAll('[data-accueil]').forEach(b => {
    b.addEventListener('click', () => { fermerChoixImage(); afficherVue('accueil'); });
  });

  // ----- Accueil -----
  document.getElementById('btn-accueil-routines').addEventListener('click', () => {
    montrerModeles(false);
    afficherVue('routines'); rendreListeRoutines();
  });
  document.getElementById('btn-accueil-taches').addEventListener('click', () => {
    ongletTachesActif = 'en-cours'; majOngletsTaches();
    afficherVue('taches'); rendreListeTaches();
  });
  document.getElementById('btn-accueil-minuteur').addEventListener('click', () => {
    afficherVue('minuteur');
  });
  document.getElementById('btn-accueil-reglages').addEventListener('click', () => {
    majAffichageReglages();
    afficherVue('reglages');
  });

  // ----- Accueil : tâche du jour -----
  document.getElementById('btn-tdj-fait').addEventListener('click', () => {
    const t = tacheEpinglee();
    if (!t) return;
    const idx = t.etapes.findIndex(e => !e.faite);
    if (idx < 0) return;
    cocherEtapeTache(t, idx, true);
    if (!estTermineeTache(t)) annoncer('Étape cochée : ' + t.etapes[idx].texte);
    majTacheDuJour();
    montrerFait();
  });
  document.getElementById('btn-tdj-ouvrir').addEventListener('click', () => {
    const t = tacheEpinglee();
    if (t) ouvrirTache(t.id);
  });
  document.getElementById('btn-tdj-retirer').addEventListener('click', () => {
    taches.forEach(x => { delete x.epinglee; });
    sauverTaches();
    majTacheDuJour();
    annoncer('Tâche retirée de l’accueil.');
    document.getElementById('btn-accueil-routines').focus();
  });

  // ----- Routines : liste et modèles -----
  rendreModeles();
  document.getElementById('btn-nouvelle-routine').addEventListener('click', () => ouvrirFormulaireRoutine(null));
  document.getElementById('btn-modeles').addEventListener('click', () => {
    montrerModeles(document.getElementById('zone-modeles').classList.contains('masque'));
  });

  // ----- Routines : historique -----
  document.getElementById('btn-historique').addEventListener('click', ouvrirHistorique);
  document.getElementById('btn-historique-vider').addEventListener('click', (e) => {
    armerSuppression(e.currentTarget, 'Confirmer : tout effacer ?', () => {
      historique = [];
      sauverHistorique();
      rendreHistorique();
      annoncer('Historique vidé.');
    });
  });
  document.getElementById('liste-modeles').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-modele]');
    if (btn) ouvrirFormulaireRoutine(null, MODELES_ROUTINES[Number(btn.dataset.modele)]);
  });
  document.getElementById('liste-routines').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'lancer') lancerRoutine(id);
    else if (btn.dataset.action === 'modifier') ouvrirFormulaireRoutine(id);
    else if (btn.dataset.action === 'supprimer') {
      armerSuppression(btn, 'Confirmer ?', () => {
        routines = routines.filter(r => r.id !== id);
        if (routineEnCours && routineEnCours.routine.id === id) {
          routineEnCours = null;
          sauverRoutineEnCours();
        }
        sauverRoutines();
        rendreListeRoutines();
        annoncer('Routine supprimée.');
      });
    }
  });

  // ----- Routines : formulaire -----
  const rfEtapes = document.getElementById('rf-etapes');
  configurerEditeurEtapes(rfEtapes);
  document.getElementById('btn-rf-ajouter-etape').addEventListener('click', () => {
    fermerChoixImage();
    ajouterLigneEtape(rfEtapes).focus();
  });
  document.getElementById('btn-rf-enregistrer').addEventListener('click', enregistrerRoutine);
  document.getElementById('btn-rf-annuler').addEventListener('click', () => {
    fermerChoixImage();
    afficherVue('routines');
    rendreListeRoutines();
  });

  // ----- Routines : exécution -----
  document.getElementById('btn-rl-valider').addEventListener('click', validerEtapeRoutine);
  document.getElementById('btn-rl-passer').addEventListener('click', passerEtapeRoutine);
  document.getElementById('btn-rl-precedente').addEventListener('click', () => {
    if (routineEnCours) etapePrecedenteRoutine();
  });
  document.getElementById('btn-rl-mode').addEventListener('click', basculerModeRoutine);
  // Arrêter fait perdre la progression : deux appuis, comme une suppression.
  document.getElementById('btn-rl-arreter').addEventListener('click', (e) => {
    armerSuppression(e.currentTarget, 'Confirmer l’arrêt ?', arreterRoutine);
  });
  // La flèche du haut, elle, garde la progression : on reprend depuis l'accueil.
  document.getElementById('btn-rl-retour-haut').addEventListener('click', () => afficherVue('accueil'));

  // ----- Tâches : liste -----
  document.getElementById('btn-nouvelle-tache').addEventListener('click', () => ouvrirFormulaireTache(null));
  document.getElementById('onglet-en-cours').addEventListener('click', () => {
    ongletTachesActif = 'en-cours'; majOngletsTaches(); rendreListeTaches();
  });
  document.getElementById('onglet-terminees').addEventListener('click', () => {
    ongletTachesActif = 'terminees'; majOngletsTaches(); rendreListeTaches();
  });
  document.getElementById('liste-taches').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'ouvrir') ouvrirTache(id);
    else if (btn.dataset.action === 'supprimer') {
      armerSuppression(btn, 'Confirmer ?', () => {
        taches = taches.filter(t => t.id !== id);
        sauverTaches();
        rendreListeTaches();
        annoncer('Tâche supprimée.');
      });
    }
  });

  // ----- Tâches : formulaire -----
  const tfEtapes = document.getElementById('tf-etapes');
  configurerEditeurEtapes(tfEtapes);
  document.getElementById('btn-tf-ajouter-etape').addEventListener('click', () => {
    fermerChoixImage();
    ajouterLigneEtape(tfEtapes).focus();
  });
  document.getElementById('btn-tf-enregistrer').addEventListener('click', enregistrerTache);
  document.getElementById('btn-tf-annuler').addEventListener('click', annulerFormulaireTache);

  // ----- Tâches : détail -----
  document.getElementById('btn-td-retour').addEventListener('click', () => {
    afficherVue('taches'); rendreListeTaches();
  });
  document.getElementById('td-etapes').addEventListener('change', (e) => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const t = taches.find(x => x.id === tacheOuverteId);
    cocherEtapeTache(t, parseInt(e.target.dataset.idx, 10), e.target.checked);
    rendreDetailTache();
    if (e.target.checked) montrerFait();
  });
  document.getElementById('td-ajout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('td-nouvelle-etape');
    const texte = input.value.trim();
    if (!texte) return;
    const t = taches.find(x => x.id === tacheOuverteId);
    t.etapes.push({ texte, faite: false });
    majEtatTache(t);
    sauverTaches();
    input.value = '';
    rendreDetailTache();
  });
  document.getElementById('btn-td-mode').addEventListener('click', () => {
    reglages.tacheUneEtape = !reglages.tacheUneEtape;
    sauverReglages();
    majCasesReglages();
    rendreDetailTache();
    annoncer(reglages.tacheUneEtape
      ? 'Une seule chose : seule une étape est affichée.'
      : 'Vue complète de la tâche.');
  });
  document.getElementById('btn-td-ue-fait').addEventListener('click', () => {
    const t = taches.find(x => x.id === tacheOuverteId);
    if (!t || tdIndexAffiche === null) return;
    const fait = tdIndexAffiche;
    cocherEtapeTache(t, fait, true);
    tdIndexAffiche = prochaineNonFaite(t, fait);
    rendreDetailTache();
    if (estTermineeTache(t)) { montrerFait(); return; }
    // Transitions douces : la pause s'affiche par-dessus l'étape suivante,
    // déjà prête derrière, et commence par le petit « ✓ Fait ».
    if (reglages.transitionsDouces) {
      lancerPause('tache-detail', t.etapes[tdIndexAffiche], () => {
        document.getElementById('btn-td-ue-fait').focus();
      }, true);
    } else {
      annoncer('Étape cochée. Suivante : ' + t.etapes[tdIndexAffiche].texte);
      montrerFait();
    }
  });
  document.getElementById('btn-td-ue-autre').addEventListener('click', () => {
    const t = taches.find(x => x.id === tacheOuverteId);
    if (!t || tdIndexAffiche === null) return;
    tdIndexAffiche = prochaineNonFaite(t, tdIndexAffiche);
    rendreDetailTache();
    annoncer('Étape affichée : ' + t.etapes[tdIndexAffiche].texte);
  });
  document.getElementById('btn-td-epingler').addEventListener('click', basculerEpinglage);
  // Chrono de la tâche : Commencer / Pause / Reprendre.
  document.getElementById('btn-td-chrono').addEventListener('click', () => {
    const t = taches.find(x => x.id === tacheOuverteId);
    if (!t) return;
    if (chronoTourne(t)) {
      arreterChrono(t);
      annoncer('Chrono en pause : ' + texteMinutes(minutesChrono(t)) + '.');
    } else {
      lancerChrono(t);
      annoncer('Chrono lancé.');
    }
    sauverTaches();
    majTempsTache();
    suivreChrono();
  });
  // Remettre à zéro efface le temps mesuré : deux appuis, comme une suppression.
  document.getElementById('btn-td-chrono-zero').addEventListener('click', (e) => {
    armerSuppression(e.currentTarget, 'Confirmer ?', () => {
      const t = taches.find(x => x.id === tacheOuverteId);
      if (!t) return;
      delete t.chrono;
      sauverTaches();
      majTempsTache();
      suivreChrono();
      annoncer('Chrono remis à zéro.');
    });
  });
  document.getElementById('btn-td-modifier').addEventListener('click', () => ouvrirFormulaireTache(tacheOuverteId));
  document.getElementById('btn-td-supprimer').addEventListener('click', (e) => {
    armerSuppression(e.currentTarget, 'Confirmer ?', () => {
      taches = taches.filter(t => t.id !== tacheOuverteId);
      sauverTaches();
      afficherVue('taches');
      rendreListeTaches();
      annoncer('Tâche supprimée.');
    });
  });

  // ----- Minuteur -----
  document.getElementById('min-choix-duree').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-min]');
    if (!btn) return;
    selectionnerDureeRapide(parseInt(btn.dataset.min, 10), btn);
  });
  document.getElementById('btn-min-libre-valider').addEventListener('click', validerDureeLibre);
  // La touche « Entrée » (ou « OK » du clavier du téléphone) valide aussi.
  document.getElementById('min-libre').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); validerDureeLibre(); }
  });
  document.getElementById('btn-min-demarrer').addEventListener('click', demarrerMinuteur);
  document.getElementById('btn-min-pause').addEventListener('click', togglePauseMinuteur);
  document.getElementById('btn-min-arreter').addEventListener('click', arreterMinuteur);
  document.getElementById('btn-min-recommencer').addEventListener('click', recommencerMinuteur);
  document.getElementById('min-vibration').addEventListener('change', (e) => {
    reglages.vibrationMinuteur = e.target.checked;
    sauverReglages();
  });
  document.getElementById('min-vibration').checked = reglages.vibrationMinuteur;
  document.getElementById('min-preavis').addEventListener('change', (e) => {
    reglages.preavisMinuteur = e.target.checked;
    sauverReglages();
    if (minEnCours && !minEnPause) tickMinuteur();
  });
  document.getElementById('min-preavis').checked = reglages.preavisMinuteur;

  if (!('wakeLock' in navigator)) {
    document.getElementById('min-option-ecran').classList.add('masque');
  }
  const caseEcran = document.getElementById('min-ecran-allume');
  caseEcran.checked = reglages.ecranAllumeMinuteur;
  caseEcran.addEventListener('change', (e) => {
    reglages.ecranAllumeMinuteur = e.target.checked;
    sauverReglages();
    if (minuteurVeutEcranAllume()) demanderEcranAllume();
    else libererEcranAllume();
  });
  // Quitter Cap fait perdre le verrou : on le reprend en revenant, si le
  // minuteur tourne toujours. Au retour, la fin a pu arriver pendant que
  // l'écran du minuteur était caché : l'accueil le signale.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (minuteurVeutEcranAllume()) demanderEcranAllume();
    if (vueCourante === 'accueil') majAccueil();
  });

  // Réglage initial de l'anneau et du choix de durée par défaut (5 min).
  const btn5 = document.querySelector('#min-choix-duree button[data-min="5"]');
  selectionnerDureeRapide(5, btn5);

  // ----- Réglages : thème, couleurs, taille du texte -----
  document.getElementById('choix-theme').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme-val]');
    if (!btn) return;
    reglages.theme = btn.dataset.themeVal;
    sauverReglages();
    appliquerApparence();
    majAffichageReglages();
  });
  document.getElementById('choix-palette').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-palette-val]');
    if (!btn) return;
    reglages.palette = btn.dataset.paletteVal;
    sauverReglages();
    appliquerApparence();
    majAffichageReglages();
  });
  document.getElementById('choix-taille').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-echelle]');
    if (!btn) return;
    reglages.echelle = Number(btn.dataset.echelle);
    sauverReglages();
    appliquerApparence();
    majAffichageReglages();
  });
  // ----- Réglages en cases à cocher (journée difficile, modes « Une seule
  // chose ») : sur l'accueil comme dans Réglages -----
  document.querySelectorAll('input[data-reglage]').forEach(c => {
    c.addEventListener('change', () => changerReglageCase(c.dataset.reglage, c.checked));
  });
  majCasesReglages();
  document.getElementById('choix-duree-transition').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-secondes]');
    if (!btn) return;
    reglages.dureeTransition = Number(btn.dataset.secondes);
    sauverReglages();
    majAffichageReglages();
  });

  // En mode « Automatique », si la personne change le thème de son
  // téléphone pendant que Cap est ouvert, on suit sans qu'elle ait à rouvrir l'app.
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (reglages.theme === 'auto') appliquerApparence();
    });
  }
  appliquerApparence();

  // ----- Réglages : sauvegarde et restauration -----
  document.getElementById('btn-sauvegarder').addEventListener('click', enregistrerSauvegarde);
  document.getElementById('btn-restaurer').addEventListener('click', () => {
    const champ = document.getElementById('fichier-restaurer');
    champ.value = '';   // pour pouvoir rechoisir le même fichier
    champ.click();
  });
  document.getElementById('fichier-restaurer').addEventListener('change', (e) => {
    lireFichierRestauration(e.target.files && e.target.files[0]);
  });
  document.getElementById('btn-restaurer-annuler').addEventListener('click', () => {
    fermerConfirmationRestauration();
    annoncer('Restauration annulée.');
  });
  document.getElementById('btn-restaurer-confirmer').addEventListener('click', confirmerRestauration);
  afficherDerniereSauvegarde();

  // L'accueil montre tout de suite une routine commencée ou une tâche épinglée.
  majAccueil();

  // ----- Service worker : installation hors-ligne et nouvelles versions -----
  if ('serviceWorker' in navigator) {
    // Ce changement a aussi lieu à la toute première installation : on ne
    // recharge que si la personne a touché « Mettre à jour ».
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (miseAJourDemandee) window.location.reload();
      else demanderEtat();
    });
    // Le service worker déjà actif a mis la nouvelle version en service.
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'recharger') window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(surveillerMisesAJour).catch(() => {});
    });
  }
  document.getElementById('btn-maj-oui').addEventListener('click', (e) => {
    // Le service worker qui attend, sinon celui qui est déjà actif.
    const sw = (inscriptionSw && inscriptionSw.waiting) || navigator.serviceWorker.controller;
    if (!sw) return;
    miseAJourDemandee = true;
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Mise à jour…';
    sw.postMessage({ type: 'activer' });
  });
  document.getElementById('btn-maj-plus-tard').addEventListener('click', () => {
    miseAJourRepoussee = true;
    majCarteMiseAJour();
    annoncer('D’accord. Cap te le reproposera à la prochaine ouverture.');
  });

  // ----- Stockage persistant -----
  // Par défaut, le navigateur peut effacer de lui-même la copie hors-ligne
  // (et les routines, les tâches) s'il manque de place ou si l'app est peu
  // utilisée. persist() lui demande de les garder.
  // Certains navigateurs (Firefox) affichent alors une fenêtre
  // d'autorisation : pour ne jamais en faire surgir une au démarrage, on ne
  // demande que si le navigateur a déjà répondu « accordé » (Chrome, pour
  // une app installée, sans rien afficher). Sinon, on renonce en silence.
  if (navigator.storage && navigator.storage.persist && navigator.permissions) {
    navigator.storage.persisted()
      .then((dejaPersistant) => {
        if (dejaPersistant) return;
        return navigator.permissions.query({ name: 'persistent-storage' })
          .then((etat) => { if (etat.state === 'granted') return navigator.storage.persist(); });
      })
      .catch(() => {});
  }
});
