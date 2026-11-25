import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

let server;
let baseUrl;
let browser;

before(async () => {
  server = http.createServer((req, res) => {
    const reqPath = new URL(req.url, 'http://127.0.0.1').pathname;
    const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
    const full = path.resolve(ROOT, rel);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

function attacherEspions(page, options = {}) {
  const erreurs = [];
  const cspViolations = [];
  const externes = [];

  page.on('pageerror', (err) => erreurs.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !options.autoriserConsoleError) {
      erreurs.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseUrl) && !url.startsWith('blob:') && !url.startsWith('data:')) {
      externes.push(url);
    }
  });
  return {
    erreurs,
    cspViolations,
    externes,
    async installerInitScript() {
      await page.addInitScript(() => {
        window.__cspViolations = [];
        window.__audioAppels = 0;
        document.addEventListener('securitypolicyviolation', (e) => {
          window.__cspViolations.push(`${e.violatedDirective}:${e.blockedURI}`);
        });
        if (window.HTMLMediaElement) {
          window.HTMLMediaElement.prototype.play = function () {
            window.__audioAppels++;
            return Promise.resolve();
          };
        }
        window.Audio = function () { window.__audioAppels++; };
        if (window.AudioContext) {
          const Orig = window.AudioContext;
          window.AudioContext = function () {
            window.__audioAppels++;
            return new Orig();
          };
        }
      });
    },
    async verifier() {
      const violations = await page.evaluate(() => window.__cspViolations || []);
      const audioAppels = await page.evaluate(() => window.__audioAppels || 0);
      assert.deepEqual(erreurs, [], `Erreurs inattendues : ${erreurs.join(' | ')}`);
      assert.deepEqual(violations, [], `Violations CSP : ${violations.join(' | ')}`);
      assert.deepEqual(externes, [], `Requêtes externes : ${externes.join(' | ')}`);
      assert.equal(audioAppels, 0, 'Aucun appel audio toléré (R2)');
    }
  };
}

test('E2E 1 — CSP stricte, zéro erreur console, zéro requête externe, zéro son (R2)', async () => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });

    await page.click('#btn-accueil-routines');
    await page.click('#btn-modeles');
    await page.click('#btn-historique');
    await page.click('#vue-historique .bouton-retour');

    await page.click('#btn-accueil-taches');
    await page.click('#btn-nouvelle-tache');
    await page.click('#btn-tf-annuler');
    await page.click('#vue-taches .bouton-retour');

    await page.click('#btn-accueil-minuteur');
    await page.click('#btn-min-demarrer');
    await page.click('#btn-min-pause');
    await page.click('#btn-min-arreter');
    await page.click('#vue-minuteur .bouton-retour');

    await page.click('#btn-accueil-reglages');
    await page.click('button[data-theme-val="clair"]');
    await page.click('button[data-palette-val="sauge"]');
    await page.click('button[data-echelle="1.15"]');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btn-sauvegarder')
    ]);
    assert.ok(download.suggestedFilename().startsWith('sauvegarde-cap-'));

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 2 — Service Worker cap-v21, hors ligne et raccourcis ?vue=', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page, { autoriserConsoleError: true });
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Recharge pour que le contrôleur SW soit actif sur la page
    await page.reload({ waitUntil: 'load' });

    const swInfo = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const cles = await caches.keys();
      const cache = await caches.open('cap-v21');
      const entrees = (await cache.keys()).map((r) => new URL(r.url).pathname);
      return {
        hasController: !!navigator.serviceWorker.controller,
        cles,
        entrees
      };
    });

    assert.equal(swInfo.hasController, true, 'Le SW doit contrôler la page');
    assert.ok(swInfo.cles.includes('cap-v21'), 'Cache cap-v21 attendu');
    for (const chemin of ['/index.html', '/theme-init.js', '/styles.css', '/app.js', '/manifest.json', '/icons/apple-touch-icon.png']) {
      assert.ok(swInfo.entrees.includes(chemin), `${chemin} absent du cache cap-v21`);
    }

    await context.setOffline(true);

    await page.goto(`${baseUrl}/index.html?vue=minuteur`);
    await page.waitForSelector('#vue-minuteur.active');
    assert.equal(await page.title(), 'Minuteur — Cap');

    await page.goto(`${baseUrl}/index.html?vue=taches`);
    await page.waitForSelector('#vue-taches.active');
    assert.equal(await page.title(), 'Mes tâches — Cap');

    await page.goto(`${baseUrl}/index.html?vue=routines`);
    await page.waitForSelector('#vue-routines.active');

    await page.goto(`${baseUrl}/index.html?vue=reglages`);
    await page.waitForSelector('#vue-reglages.active');

    await page.goto(`${baseUrl}/index.html?vue=inconnue`);
    await page.waitForSelector('#vue-accueil.active');
    assert.equal(await page.title(), 'Cap');

    const respAbsent = await page.goto(`${baseUrl}/absent.html`);
    assert.equal(respAbsent.status(), 200);
    await page.waitForSelector('#vue-accueil.active');

    const statusJson = await page.evaluate(() => fetch('./absent.json').then((r) => r.status));
    assert.equal(statusJson, 503);

    const violations = await page.evaluate(() => window.__cspViolations || []);
    assert.deepEqual(violations, []);
  } finally {
    await context.close();
  }
});

test('E2E 3 — 14 thèmes : contrastes WCAG >= 4,5:1, pas de blanc/noir pur ni couleur vive', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/index.html`);
    const resultats = await page.evaluate(() => {
      const palettes = ['bleu', 'sauge', 'lavande', 'sable', 'peche', 'miel', 'rose'];
      const themes = ['sombre', 'clair'];
      const vars = ['bg', 'surface', 'surface-2', 'accent-fond', 'fini-fond', 'texte', 'texte-doux', 'accent', 'fini'];

      function parseRgb(str) {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
      function lum([r, g, b]) {
        const f = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
      }
      function ratio(c1, c2) {
        const l1 = lum(c1);
        const l2 = lum(c2);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }

      const rapport = [];
      for (const p of palettes) {
        for (const t of themes) {
          document.documentElement.dataset.mode = `${p}-${t}`;
          const cs = getComputedStyle(document.documentElement);
          const vals = {};
          for (const v of vars) {
            const probe = document.createElement('div');
            probe.style.color = `var(--${v})`;
            document.body.appendChild(probe);
            vals[v] = parseRgb(getComputedStyle(probe).color);
            probe.remove();
            const [r, g, b] = vals[v];
            const isBlackOrWhite = (r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255);
            const max = Math.max(r, g, b) / 255;
            const min = Math.min(r, g, b) / 255;
            const chroma = max - min;
            const satHsv = max === 0 ? 0 : chroma / max;
            if (isBlackOrWhite || satHsv > 0.55 || chroma > 0.35) {
              rapport.push(`${p}-${t} --${v} couleur non conforme (${r},${g},${b})`);
            }
          }
          for (const bgKey of ['bg', 'surface', 'surface-2', 'accent-fond', 'fini-fond']) {
            if (ratio(vals.texte, vals[bgKey]) < 4.5) rapport.push(`${p}-${t} texte/${bgKey} < 4.5`);
            if (ratio(vals['texte-doux'], vals[bgKey]) < 4.5) rapport.push(`${p}-${t} texte-doux/${bgKey} < 4.5`);
          }
          for (const bgKey of ['bg', 'surface', 'accent-fond']) {
            if (ratio(vals.accent, vals[bgKey]) < 3.0) rapport.push(`${p}-${t} accent/${bgKey} < 3.0`);
          }
          if (ratio(vals.fini, vals.bg) < 3.0) rapport.push(`${p}-${t} fini/bg < 3.0`);
          void cs;
        }
      }
      return rapport;
    });

    assert.deepEqual(resultats, []);
  } finally {
    await context.close();
  }
});

test('E2E 4 — Cibles tactiles >= 60 px & zéro débordement (390×844 et 320×640 à echelle 1.35)', async () => {
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();

    try {
      await page.addInitScript(() => {
        localStorage.setItem('cap_reglages', JSON.stringify({ echelle: 1.35, transitionsDouces: true }));
        localStorage.setItem('cap_routines', JSON.stringify([
          { id: 'r_test', nom: 'Matin test', etapes: [{ texte: 'Boire', minutes: 2, essentielle: true }, { texte: 'Sortir' }] }
        ]));
        localStorage.setItem('cap_taches', JSON.stringify([
          { id: 't_test', nom: 'Papiers', epinglee: true, tempsPrevu: 10, etapes: [{ texte: 'Sortir dossier', faite: false, mini: true }, { texte: 'Classer', faite: false }] }
        ]));
      });
      await page.goto(`${baseUrl}/index.html`);

      const verifierEcran = async (nomEcran) => {
        const res = await page.evaluate(() => {
          const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
          const petits = [];
          const selecteur = 'button, a.lien-discret, input:not([type="checkbox"]), select, summary, label.interrupteur, label.etape-cochable';
          for (const el of document.querySelectorAll(selecteur)) {
            if (el.closest('[hidden]') || el.closest('.masque')) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.height < 59.5 || rect.width < 59.5) {
              petits.push(`${el.tagName}#${el.id}.${el.className}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
            }
          }
          return { overflow, petits };
        });
        assert.equal(res.overflow, false, `Débordement horizontal sur ${nomEcran} (${vp.width}x${vp.height})`);
        assert.deepEqual(res.petits, [], `Cibles < 60 px sur ${nomEcran} (${vp.width}x${vp.height}) : ${res.petits.join(', ')}`);
      };

      await verifierEcran('accueil');
      await page.click('#btn-accueil-routines');
      await verifierEcran('routines');
      await page.click('#btn-nouvelle-routine');
      await verifierEcran('routine-form');
      await page.click('#btn-rf-annuler');
      await page.click('button[data-action="lancer"]');
      await verifierEcran('routine-lancer');
      await page.click('#btn-rl-retour-haut');

      await page.click('#btn-accueil-taches');
      await verifierEcran('taches');
      await page.click('#btn-nouvelle-tache');
      await verifierEcran('tache-form');
      await page.click('#btn-tf-annuler');
      await page.click('button[data-action="ouvrir"]');
      await verifierEcran('tache-detail');
      await page.click('#btn-td-retour');
      await page.click('#vue-taches .bouton-retour');

      await page.click('#btn-accueil-minuteur');
      await verifierEcran('minuteur');
      await page.click('#vue-minuteur .bouton-retour');

      await page.click('#btn-accueil-reglages');
      await verifierEcran('reglages');
    } finally {
      await context.close();
    }
  }
});

test('E2E 5 — Routines, Tâches & Minuteur (flux complets sans pression/compteur)', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/index.html`);

    // Routine
    await page.click('#btn-accueil-routines');
    await page.click('#btn-nouvelle-routine');
    await page.fill('#rf-nom', 'Routine calme');
    const champs = page.locator('#rf-etapes input[type="text"]');
    await champs.nth(0).fill('Boire un verre d’eau');
    await champs.nth(1).fill('Ouvrir les volets');
    await page.click('#rf-etapes .ligne-etape:first-child button[data-dir="essentielle"]');
    await page.click('#btn-rf-enregistrer');
    await page.waitForSelector('#vue-routines.active');
    await page.click('#liste-routines button[data-action="lancer"]');
    await page.waitForSelector('#vue-routine-lancer.active');

    await page.click('#btn-rl-mode');
    assert.ok((await page.textContent('#btn-rl-mode')).includes('Voir tout'));
    await page.click('#btn-rl-mode');

    await page.click('#btn-rl-passer');
    await page.click('#btn-rl-valider');
    await page.waitForSelector('#vue-routine-fin.active');
    assert.ok((await page.textContent('#rl-fin-passees')).includes('Boire un verre d’eau'));
    await page.click('#vue-routine-fin button[data-accueil]');

    // Vérifier historique sans compteur ni série
    await page.click('#btn-accueil-routines');
    await page.click('#btn-historique');
    const histoText = await page.textContent('#liste-historique');
    assert.ok(histoText.includes('Routine calme'));
    await page.click('#vue-historique .bouton-retour');

    // Tâche avec mini-démarrage, temps prévu, chrono et épinglage
    await page.click('#btn-accueil-taches');
    await page.click('#btn-nouvelle-tache');
    await page.fill('#tf-nom', 'Trier le bureau');
    await page.fill('#tf-mini', 'Prendre une pochette');
    await page.locator('#tf-etapes input[type="text"]').nth(0).fill('Ranger les factures');
    await page.fill('#tf-prevu', '10');
    await page.click('#btn-tf-enregistrer');

    await page.click('#liste-taches button[data-action="ouvrir"]');
    await page.waitForSelector('#vue-tache-detail.active');
    await page.click('#btn-td-epingler');
    await page.click('#btn-td-chrono');
    assert.equal(await page.textContent('#btn-td-chrono'), 'Pause');
    await page.click('#btn-td-chrono');
    assert.equal(await page.textContent('#btn-td-chrono'), 'Reprendre');
    await page.click('#btn-td-retour');
    await page.click('#vue-taches .bouton-retour');

    await page.waitForSelector('#accueil-tache-du-jour:not(.masque)');
    assert.ok((await page.textContent('#tdj-etape')).includes('Pour démarrer'));
    await page.click('#btn-tdj-fait');
    await page.click('#btn-tdj-fait');
    assert.ok((await page.textContent('#tdj-etape')).includes('Tout est fait'));

    // Minuteur
    await page.click('#btn-accueil-minuteur');
    await page.fill('#min-nom', 'Pause lecture');
    await page.click('#btn-min-demarrer');
    await page.waitForSelector('#min-controles-en-cours:not(.masque)');
    await page.click('#btn-min-pause');
    assert.equal(await page.textContent('#min-etat'), 'En pause');
    await page.click('#btn-min-arreter');
    assert.equal(await page.textContent('#min-etat'), 'Choisis une durée');

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 6 — Sauvegarde & Restauration v1, v2, v3 et neutralisation XSS id', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.goto(`${baseUrl}/index.html`);
    await page.click('#btn-accueil-reglages');

    // v1 : étapes de routine en simples chaînes
    const v1 = {
      routines: [{ id: 'r_v1', nom: 'Routine v1', etapes: ['Étirer les bras', 'Respirer'] }],
      taches: [{ id: 't_v1', nom: 'Tâche v1', etapes: [{ texte: 'Ouvrir', faite: false }], termineeLe: null }],
      reglages: { palette: 'lavande', theme: 'clair', echelle: 1 }
    };
    await page.setInputFiles('#fichier-restaurer', {
      name: 'sauvegarde-cap-v1.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(v1), 'utf8')
    });
    await page.waitForSelector('#restaurer-confirmation:not(.masque)');
    await page.click('#btn-restaurer-confirmer');
    assert.ok((await page.textContent('#restaurer-message')).includes('1 routine ajoutée, 1 tâche ajoutée'));

    // v2 : étapes objets + epinglee
    const v2 = {
      app: 'cap',
      version: 2,
      routines: [
        { id: 'r_v1', nom: 'Doublon ignoré', etapes: ['X'] },
        { id: 'r_v2', nom: 'Routine v2', etapes: [{ texte: 'Eau', image: '💧', minutes: 5 }] }
      ],
      taches: [
        { id: 't_v2', nom: 'Tâche v2', epinglee: true, etapes: [{ texte: 'Faire', faite: false, image: '📝' }], termineeLe: null }
      ]
    };
    await page.setInputFiles('#fichier-restaurer', {
      name: 'sauvegarde-cap-v2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(v2), 'utf8')
    });
    await page.waitForSelector('#restaurer-confirmation:not(.masque)');
    await page.click('#btn-restaurer-confirmer');
    assert.ok((await page.textContent('#restaurer-message')).includes('1 routine ajoutée, 1 tâche ajoutée'));

    // v3 + tentative XSS sur id
    const v3 = {
      app: 'cap',
      version: 3,
      exporte: '2026-11-20T10:00:00.000Z',
      routines: [{ id: 'r_xss" onclick="window.__xss=1', nom: 'Routine v3', etapes: [{ texte: 'Clés', essentielle: true }] }],
      taches: [{
        id: 't_xss" onmouseover="window.__xss=2',
        nom: 'Tâche v3',
        tempsPrevu: 20,
        chrono: { cumul: 120000, depuis: null },
        etapes: [{ texte: 'Mini', faite: false, mini: true }]
      }],
      historique: [{ id: 'h_v3', date: Date.now() - 3600000, nom: 'Routine v1', essentiel: true }],
      reglages: { palette: 'sauge', theme: 'sombre', echelle: 1.15, transitionsDouces: true, dureeTransition: 5 }
    };
    await page.setInputFiles('#fichier-restaurer', {
      name: 'sauvegarde-cap-v3.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(v3), 'utf8')
    });
    await page.waitForSelector('#restaurer-confirmation:not(.masque)');
    const resumeV3 = await page.textContent('#restaurer-resume');
    assert.ok(resumeV3.includes('ton historique') && !/\d+\s+historique/.test(resumeV3));
    await page.click('#btn-restaurer-confirmer');
    assert.ok((await page.textContent('#restaurer-message')).includes('historique complété'));

    // Ouvrir routines & tâches pour vérifier rendu sûr + absence d'XSS
    await page.click('#vue-reglages .bouton-retour');
    await page.click('#btn-accueil-routines');
    assert.ok((await page.textContent('#liste-routines')).includes('Routine v3'));
    await page.click('#vue-routines .bouton-retour');
    await page.click('#btn-accueil-taches');
    assert.ok((await page.textContent('#liste-taches')).includes('Tâche v3'));
    assert.equal(await page.evaluate(() => window.__xss), undefined);

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 7 — Navigation Échap, popstate, document.title & focus sans perte de progression', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.addInitScript(() => {
      localStorage.setItem('cap_routines', JSON.stringify([
        {
          id: 'r_nav',
          nom: 'Soir',
          etapes: [
            { texte: 'Étape 1', minutes: 2 },
            { texte: 'Étape 2', minutes: 3 },
            { texte: 'Étape 3' }
          ]
        }
      ]));
      localStorage.setItem('cap_reglages', JSON.stringify({ transitionsDouces: true, dureeTransition: 10 }));
    });
    await page.goto(`${baseUrl}/index.html`);
    assert.equal(await page.title(), 'Cap');

    // Échap ferme #choix-image avant la vue
    await page.click('#btn-accueil-routines');
    assert.equal(await page.title(), 'Mes routines — Cap');
    await page.click('#btn-nouvelle-routine');
    await page.click('#rf-etapes .ligne-etape:first-child button[data-dir="image"]');
    await page.waitForSelector('.choix-image');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.choix-image').count(), 0);
    await page.waitForSelector('#vue-routine-form.active');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#vue-accueil.active');
    assert.equal(await page.title(), 'Cap');

    // Focus restauré sur le déclencheur de l'accueil
    await page.click('#btn-accueil-minuteur');
    assert.equal(await page.title(), 'Minuteur — Cap');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#vue-accueil.active');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'btn-accueil-minuteur');

    // Routine lancée -> étape 2 en pause douce -> Échap conserve progression
    await page.click('#btn-accueil-routines');
    await page.click('#liste-routines button[data-action="lancer"]');
    await page.waitForSelector('#vue-routine-lancer.active');
    assert.equal(await page.title(), 'Soir — Cap');
    await page.click('#btn-rl-valider');
    await page.waitForSelector('#vue-routine-lancer.en-pause');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#vue-accueil.active');
    assert.equal(await page.title(), 'Cap');

    const repriseText = await page.textContent('#accueil-en-cours');
    assert.ok(repriseText.includes('Reprendre « Soir »'));
    assert.ok(repriseText.includes('Étape 2 sur 3'));

    // Reprise depuis l'accueil -> étape 2 avec minuteur actif -> popstate (Retour Android)
    await page.click('#accueil-en-cours .bouton-en-cours');
    await page.waitForSelector('#vue-routine-lancer.active');
    assert.equal(await page.textContent('#rl-compteur'), 'Étape 2 / 3');
    await page.goBack();
    await page.waitForSelector('#vue-accueil.active');
    assert.ok((await page.textContent('#accueil-en-cours')).includes('Étape 2 sur 3'));

    // Reprise finale confirme que l'étape 2 est intacte
    await page.click('#accueil-en-cours .bouton-en-cours');
    await page.waitForSelector('#vue-routine-lancer.active');
    assert.equal(await page.textContent('#rl-compteur'), 'Étape 2 / 3');

    await espions.verifier();
  } finally {
    await context.close();
  }
});

test('E2E 8 — Protection localStorage plein (QuotaExceededError) & rollback restauration', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const espions = attacherEspions(page);
  await espions.installerInitScript();

  try {
    await page.addInitScript(() => {
      localStorage.setItem('cap_routines', JSON.stringify([
        { id: 'r_init', nom: 'Routine initiale', etapes: [{ texte: 'A' }] }
      ]));
    });
    await page.goto(`${baseUrl}/index.html`);

    // Simule localStorage plein
    await page.evaluate(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      };
    });

    await page.click('#btn-accueil-reglages');
    await page.click('button[data-theme-val="clair"]');
    await page.waitForSelector('#alerte-stockage:not(.masque)');
    const btnRect = await page.locator('#btn-alerte-stockage-fermer').boundingBox();
    assert.ok(btnRect.height >= 59.5, 'Bouton Fermer de l’alerte stockage >= 60 px');
    await page.click('#btn-alerte-stockage-fermer');
    await page.locator('#alerte-stockage').waitFor({ state: 'hidden' });

    // Tentative de création de routine quand le stockage est plein
    await page.click('#vue-reglages .bouton-retour');
    await page.click('#btn-accueil-routines');
    await page.click('#btn-nouvelle-routine');
    await page.fill('#rf-nom', 'Routine non sauvée');
    await page.locator('#rf-etapes input[type="text"]').nth(0).fill('Étape');
    await page.click('#btn-rf-enregistrer');
    await page.waitForSelector('#alerte-stockage:not(.masque)');

    // Tentative de restauration avec vérification du rollback mémoire
    await page.click('#vue-routines .bouton-retour');
    await page.click('#btn-accueil-reglages');
    await page.setInputFiles('#fichier-restaurer', {
      name: 'sauvegarde-cap.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        app: 'cap',
        version: 3,
        routines: [{ id: 'r_new', nom: 'Routine rollback', etapes: [{ texte: 'B' }] }]
      }), 'utf8')
    });
    await page.waitForSelector('#restaurer-confirmation:not(.masque)');
    await page.click('#btn-restaurer-confirmer');
    assert.ok((await page.textContent('#restaurer-message')).includes('mémoire du navigateur est peut-être pleine'));

    // Vérifier le rollback : r_new ne doit PAS rester dans la liste en mémoire
    await page.click('#vue-reglages .bouton-retour');
    await page.click('#btn-accueil-routines');
    const listeText = await page.textContent('#liste-routines');
    assert.equal(listeText.includes('Routine rollback'), false, 'La routine non enregistrée doit être annulée en mémoire');

    await espions.verifier();
  } finally {
    await context.close();
  }
});
