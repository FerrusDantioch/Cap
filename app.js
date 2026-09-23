/* ============================================================
   CAP — logique de l'application
   Tout est écrit en français, avec des commentaires pour
   expliquer le "pourquoi" quand ce n'est pas évident.
   Aucune donnée ne quitte jamais ce téléphone : tout est stocké
   avec localStorage, rien n'est envoyé sur internet.
   ============================================================ */

/* ---------- 1. Stockage (localStorage) ---------- */

const CLE_ROUTINES = 'cap_routines';
const CLE_TACHES = 'cap_taches';
const CLE_REGLAGES = 'cap_reglages';

function chargerRoutines() {
  try { return JSON.parse(localStorage.getItem(CLE_ROUTINES)) || []; }
  catch (e) { return []; }
}
function sauverRoutines() {
  localStorage.setItem(CLE_ROUTINES, JSON.stringify(routines));
}

function chargerTaches() {
  try { return JSON.parse(localStorage.getItem(CLE_TACHES)) || []; }
  catch (e) { return []; }
}
function sauverTaches() {
  localStorage.setItem(CLE_TACHES, JSON.stringify(taches));
}

function chargerReglages() {
  const defaut = { vibrationMinuteur: true, ecranAllumeMinuteur: false, theme: 'auto', palette: 'bleu' };
  try { return Object.assign(defaut, JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}); }
  catch (e) { return defaut; }
}
function sauverReglages() {
  localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages));
}

function creerId(prefixe) {
  return prefixe + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- 2. État en mémoire ---------- */

let routines = chargerRoutines();
let taches = chargerTaches();
let reglages = chargerReglages();

let routineEnEdition = null;   // id de la routine modifiée, ou null si création
let routineEnCours = null;     // { routine, index } pendant l'exécution pas à pas
let ongletTachesActif = 'en-cours';
let tacheOuverteId = null;

// État du minuteur : minFinTimestamp est l'heure d'arrivée (Date.now() + durée),
// pas un simple compteur qui descend — ainsi le temps restant reste juste même
// si on change d'écran ou si le téléphone met l'onglet en veille un instant.
let minDureeMs = 5 * 60 * 1000;
let minFinTimestamp = null;
let minRestantMsAuPause = null;
let minEnCours = false;
let minEnPause = false;
let minTimerHandle = null;
const MIN_CIRCONFERENCE = 2 * Math.PI * 100;

// Verrou « écran allumé » (Wake Lock) : tant qu'on le tient, le téléphone ne
// se met pas en veille et ne se verrouille pas.
let verrouEcran = null;
let demandeEcranEnCours = false;
let delaiLiberationEcran = null;
const GRACE_ECRAN_APRES_FIN_MS = 60 * 1000;

/* ---------- 3. Petits outils partagés ---------- */

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
  action();
}
function desarmerBouton(bouton) {
  bouton.classList.remove('arme');
  if (bouton.dataset.texteOriginal) bouton.textContent = bouton.dataset.texteOriginal;
}

function formaterDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/* ---------- 3 bis. Apparence : thème et gamme de couleurs ---------- */

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
}

/* ---------- 4. Navigation entre les écrans ---------- */

function afficherVue(nom) {
  document.querySelectorAll('.vue').forEach(v => {
    const active = v.id === 'vue-' + nom;
    v.hidden = !active;
    v.classList.toggle('active', active);
  });
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

/* ---------- 5. Éditeur d'étapes réutilisé (routines ET tâches) ---------- */

function ajouterLigneEtape(conteneur, valeur) {
  const ligne = document.createElement('div');
  ligne.className = 'ligne-etape';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Étape';
  input.value = valeur || '';
  ligne.appendChild(input);

  [['haut', '↑', 'Monter cette étape'], ['bas', '↓', 'Descendre cette étape'], ['suppr', '✕', 'Supprimer cette étape']]
    .forEach(([dir, texte, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.dir = dir;
      b.textContent = texte;
      b.setAttribute('aria-label', label);
      ligne.appendChild(b);
    });

  conteneur.appendChild(ligne);
  return input;
}

// Un seul écouteur par conteneur (posé une fois au démarrage) plutôt qu'un
// écouteur par bouton : plus simple, et ça marche aussi pour les lignes
// ajoutées plus tard.
function configurerEditeurEtapes(conteneur) {
  conteneur.addEventListener('click', (e) => {
    const bouton = e.target.closest('button[data-dir]');
    if (!bouton) return;
    const ligne = bouton.closest('.ligne-etape');
    if (bouton.dataset.dir === 'suppr') {
      ligne.remove();
    } else if (bouton.dataset.dir === 'haut' && ligne.previousElementSibling) {
      conteneur.insertBefore(ligne, ligne.previousElementSibling);
    } else if (bouton.dataset.dir === 'bas' && ligne.nextElementSibling) {
      conteneur.insertBefore(ligne.nextElementSibling, ligne);
    }
  });
}

function lireEtapesTexte(conteneur) {
  return Array.from(conteneur.querySelectorAll('input'))
    .map(i => i.value.trim())
    .filter(v => v !== '');
}

/* ---------- 6. Routines ---------- */

function rendreListeRoutines() {
  const cont = document.getElementById('liste-routines');
  if (routines.length === 0) {
    cont.innerHTML = '<p class="vide">Aucune routine pour l’instant. Créez-en une pour commencer.</p>';
    return;
  }
  cont.innerHTML = routines.map(r => `
    <div class="fiche">
      <div class="nom">${echapper(r.nom)}</div>
      <div class="meta">${r.etapes.length} étape${r.etapes.length > 1 ? 's' : ''}</div>
      <div class="bouton-rangee">
        <button type="button" class="bouton-doux" data-action="lancer" data-id="${r.id}">Lancer</button>
        <button type="button" data-action="modifier" data-id="${r.id}">Modifier</button>
        <button type="button" data-action="supprimer" data-id="${r.id}">Supprimer</button>
      </div>
    </div>
  `).join('');
}

function ouvrirFormulaireRoutine(id) {
  const nomEl = document.getElementById('rf-nom');
  const etapesEl = document.getElementById('rf-etapes');
  etapesEl.innerHTML = '';
  if (id) {
    const r = routines.find(x => x.id === id);
    routineEnEdition = id;
    document.getElementById('titre-routine-form').textContent = 'Modifier la routine';
    nomEl.value = r.nom;
    r.etapes.forEach(e => ajouterLigneEtape(etapesEl, e));
  } else {
    routineEnEdition = null;
    document.getElementById('titre-routine-form').textContent = 'Nouvelle routine';
    nomEl.value = '';
    ajouterLigneEtape(etapesEl);
    ajouterLigneEtape(etapesEl);
  }
  afficherVue('routine-form');
}

function enregistrerRoutine() {
  const nom = document.getElementById('rf-nom').value.trim();
  const etapes = lireEtapesTexte(document.getElementById('rf-etapes'));
  if (!nom) { annoncer('Donnez un nom à la routine.'); document.getElementById('rf-nom').focus(); return; }
  if (etapes.length === 0) { annoncer('Ajoutez au moins une étape.'); return; }

  if (routineEnEdition) {
    const r = routines.find(x => x.id === routineEnEdition);
    r.nom = nom; r.etapes = etapes;
  } else {
    routines.push({ id: creerId('r'), nom, etapes });
  }
  sauverRoutines();
  afficherVue('routines');
  rendreListeRoutines();
}

function lancerRoutine(id) {
  const r = routines.find(x => x.id === id);
  if (!r) return;
  routineEnCours = { routine: r, index: 0 };
  document.getElementById('titre-routine-lancer').textContent = r.nom;
  majAffichageRoutineLancer();
  afficherVue('routine-lancer');
}

function majAffichageRoutineLancer() {
  const { routine, index } = routineEnCours;
  document.getElementById('rl-compteur').textContent = `Étape ${index + 1} / ${routine.etapes.length}`;
  document.getElementById('rl-etape-texte').textContent = routine.etapes[index];
  document.getElementById('btn-rl-precedente').classList.toggle('masque', index === 0);
}

function validerEtapeRoutine() {
  routineEnCours.index++;
  if (routineEnCours.index >= routineEnCours.routine.etapes.length) {
    routineEnCours = null;
    afficherVue('routine-fin');
    return;
  }
  majAffichageRoutineLancer();
}

function arreterRoutine() {
  routineEnCours = null;
  afficherVue('routines');
  rendreListeRoutines();
}

/* ---------- 7. Tâches ---------- */

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
    const meta = ongletTachesActif === 'en-cours'
      ? `${faites} / ${t.etapes.length} étapes faites`
      : 'Terminée le ' + formaterDate(t.termineeLe);
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

function ouvrirFormulaireTache() {
  document.getElementById('tf-nom').value = '';
  const etapesEl = document.getElementById('tf-etapes');
  etapesEl.innerHTML = '';
  ajouterLigneEtape(etapesEl);
  ajouterLigneEtape(etapesEl);
  afficherVue('tache-form');
}

function enregistrerTache() {
  const nom = document.getElementById('tf-nom').value.trim();
  const etapes = lireEtapesTexte(document.getElementById('tf-etapes')).map(texte => ({ texte, faite: false }));
  if (!nom) { annoncer('Donnez un nom à la tâche.'); document.getElementById('tf-nom').focus(); return; }
  if (etapes.length === 0) { annoncer('Ajoutez au moins une étape.'); return; }

  taches.push({ id: creerId('t'), nom, etapes, termineeLe: null });
  sauverTaches();
  ongletTachesActif = 'en-cours';
  majOngletsTaches();
  afficherVue('taches');
  rendreListeTaches();
}

function ouvrirTache(id) {
  tacheOuverteId = id;
  const t = taches.find(x => x.id === id);
  document.getElementById('titre-tache-detail').textContent = t.nom;
  document.getElementById('td-nouvelle-etape').value = '';
  rendreDetailTache();
  afficherVue('tache-detail');
}

function rendreDetailTache() {
  const t = taches.find(x => x.id === tacheOuverteId);
  if (!t) return;
  const faites = t.etapes.filter(e => e.faite).length;
  document.getElementById('td-progres').textContent = `${faites} / ${t.etapes.length} étapes faites`;
  document.getElementById('td-barre').style.width = t.etapes.length ? Math.round(faites / t.etapes.length * 100) + '%' : '0%';

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
    span.textContent = e.texte;
    label.appendChild(input);
    label.appendChild(span);
    cont.appendChild(label);
  });
}

/* ---------- 8. Minuteur visuel ---------- */

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

function selectionnerDureeRapide(minutes, boutonSource) {
  minDureeMs = minutes * 60 * 1000;
  document.querySelectorAll('#min-choix-duree button').forEach(b => {
    b.setAttribute('aria-pressed', String(b === boutonSource));
  });
  document.getElementById('min-libre').value = '';
  if (!minEnCours) { majTempsTexte(minDureeMs); majAnneau(1); }
}

function validerDureeLibre() {
  const val = parseInt(document.getElementById('min-libre').value, 10);
  if (!val || val < 1) { annoncer('Entrez un nombre de minutes valable.'); return; }
  const minutes = Math.min(val, 180);
  minDureeMs = minutes * 60 * 1000;
  document.querySelectorAll('#min-choix-duree button').forEach(b => b.setAttribute('aria-pressed', 'false'));
  if (!minEnCours) { majTempsTexte(minDureeMs); majAnneau(1); }
}

function demarrerMinuteur() {
  if (minDureeMs <= 0) return;
  minEnCours = true;
  minEnPause = false;
  minFinTimestamp = Date.now() + minDureeMs;

  document.getElementById('min-reglage-duree').classList.add('masque');
  document.getElementById('min-controles-avant').classList.add('masque');
  document.getElementById('min-controles-en-cours').classList.remove('masque');
  document.getElementById('min-controles-fin').classList.add('masque');
  document.getElementById('min-anneau').classList.remove('termine');
  document.getElementById('btn-min-pause').textContent = 'Pause';
  document.getElementById('min-etat').textContent = 'En cours…';

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
}

function togglePauseMinuteur() {
  if (!minEnCours) return;
  if (!minEnPause) {
    minEnPause = true;
    minRestantMsAuPause = minFinTimestamp - Date.now();
    document.getElementById('btn-min-pause').textContent = 'Reprendre';
    document.getElementById('min-etat').textContent = 'En pause';
    libererEcranAllume();
  } else {
    minEnPause = false;
    minFinTimestamp = Date.now() + minRestantMsAuPause;
    document.getElementById('btn-min-pause').textContent = 'Pause';
    document.getElementById('min-etat').textContent = 'En cours…';
    if (minuteurVeutEcranAllume()) demanderEcranAllume();
  }
}

function arreterMinuteur() {
  clearInterval(minTimerHandle);
  minEnCours = false;
  minEnPause = false;
  libererEcranAllume();
  document.getElementById('min-anneau').classList.remove('termine');
  document.getElementById('min-reglage-duree').classList.remove('masque');
  document.getElementById('min-controles-avant').classList.remove('masque');
  document.getElementById('min-controles-en-cours').classList.add('masque');
  document.getElementById('min-controles-fin').classList.add('masque');
  document.getElementById('min-etat').textContent = 'Choisissez une durée';
  majTempsTexte(minDureeMs);
  majAnneau(1);
}

function finMinuteur() {
  clearInterval(minTimerHandle);
  minEnCours = false;
  majTempsTexte(0);
  majAnneau(0);
  document.getElementById('min-anneau').classList.add('termine');
  document.getElementById('min-etat').textContent = 'Terminé';
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
}

function recommencerMinuteur() {
  document.getElementById('min-controles-fin').classList.add('masque');
  arreterMinuteur();
}

/* ---------- 9. Mise en place des écouteurs, au chargement ---------- */

document.addEventListener('DOMContentLoaded', () => {

  // Retour direct à l'accueil, depuis n'importe quel écran qui porte cet attribut.
  document.querySelectorAll('[data-accueil]').forEach(b => {
    b.addEventListener('click', () => afficherVue('accueil'));
  });

  // ----- Accueil -----
  document.getElementById('btn-accueil-routines').addEventListener('click', () => {
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

  // ----- Routines : liste -----
  document.getElementById('btn-nouvelle-routine').addEventListener('click', () => ouvrirFormulaireRoutine(null));
  document.getElementById('liste-routines').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'lancer') lancerRoutine(id);
    else if (btn.dataset.action === 'modifier') ouvrirFormulaireRoutine(id);
    else if (btn.dataset.action === 'supprimer') {
      armerSuppression(btn, 'Confirmer ?', () => {
        routines = routines.filter(r => r.id !== id);
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
    ajouterLigneEtape(rfEtapes).focus();
  });
  document.getElementById('btn-rf-enregistrer').addEventListener('click', enregistrerRoutine);

  // ----- Routines : exécution -----
  document.getElementById('btn-rl-valider').addEventListener('click', validerEtapeRoutine);
  document.getElementById('btn-rl-precedente').addEventListener('click', () => {
    if (routineEnCours && routineEnCours.index > 0) {
      routineEnCours.index--;
      majAffichageRoutineLancer();
    }
  });
  document.getElementById('btn-rl-arreter').addEventListener('click', arreterRoutine);
  document.getElementById('btn-rl-retour-haut').addEventListener('click', arreterRoutine);

  // ----- Tâches : liste -----
  document.getElementById('btn-nouvelle-tache').addEventListener('click', ouvrirFormulaireTache);
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
    ajouterLigneEtape(tfEtapes).focus();
  });
  document.getElementById('btn-tf-enregistrer').addEventListener('click', enregistrerTache);

  // ----- Tâches : détail -----
  document.getElementById('btn-td-retour').addEventListener('click', () => {
    afficherVue('taches'); rendreListeTaches();
  });
  document.getElementById('td-etapes').addEventListener('change', (e) => {
    if (!e.target.matches('input[type="checkbox"]')) return;
    const t = taches.find(x => x.id === tacheOuverteId);
    const idx = parseInt(e.target.dataset.idx, 10);
    t.etapes[idx].faite = e.target.checked;
    const finieAvant = estTermineeTache(t);
    majEtatTache(t);
    sauverTaches();
    rendreDetailTache();
    if (finieAvant) annoncer('Tâche terminée : ' + t.nom);
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
  document.getElementById('btn-min-demarrer').addEventListener('click', demarrerMinuteur);
  document.getElementById('btn-min-pause').addEventListener('click', togglePauseMinuteur);
  document.getElementById('btn-min-arreter').addEventListener('click', arreterMinuteur);
  document.getElementById('btn-min-recommencer').addEventListener('click', recommencerMinuteur);
  document.getElementById('min-vibration').addEventListener('change', (e) => {
    reglages.vibrationMinuteur = e.target.checked;
    sauverReglages();
  });
  document.getElementById('min-vibration').checked = reglages.vibrationMinuteur;

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
  // minuteur tourne toujours.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && minuteurVeutEcranAllume()) demanderEcranAllume();
  });

  // Réglage initial de l'anneau et du choix de durée par défaut (5 min).
  const btn5 = document.querySelector('#min-choix-duree button[data-min="5"]');
  selectionnerDureeRapide(5, btn5);

  // ----- Réglages : thème et couleurs -----
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
  // En mode « Automatique », si la personne change le thème de son
  // téléphone pendant que Cap est ouvert, on suit sans qu'elle ait à rouvrir l'app.
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (reglages.theme === 'auto') appliquerApparence();
    });
  }
  appliquerApparence();

  // ----- Service worker : installation hors-ligne -----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});
