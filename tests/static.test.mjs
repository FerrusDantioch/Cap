import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  assert.equal(h.length, 6, `Couleur hex invalide : ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function luminance([r, g, b]) {
  const f = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hexToRgb(hex1));
  const l2 = luminance(hexToRgb(hex2));
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function hsvStats(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const satHsv = max === 0 ? 0 : chroma / max;
  return { chroma, satHsv };
}

function parsePngInfo(filePath) {
  const buf = fs.readFileSync(filePath);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buf.subarray(0, 8).equals(sig), `${filePath} n'est pas un PNG valide`);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let hasTrns = false;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data.readUInt8(9);
    } else if (type === 'tRNS') {
      hasTrns = true;
    } else if (type === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  const hasAlphaChannel = colorType === 4 || colorType === 6 || hasTrns;
  return { width, height, colorType, hasAlphaChannel };
}

test('R2 — LICENSE intact (taille et SHA-256)', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  const data = Buffer.from(raw.replace(/\r\n/g, '\n'), 'utf8');
  assert.equal(data.length, 43184);
  const sha = crypto.createHash('sha256').update(data).digest('hex');
  assert.equal(sha, '0483fae80ead6506beafd3258fea07f5ff23bb81e2fbd41daf137d58798a14fb');
});

test('R2 — Zéro son et zéro ressource externe dans le code applicatif', () => {
  const html = lire('index.html');
  const app = lire('app.js');
  const sw = lire('sw.js');
  const init = lire('theme-init.js');

  for (const [nom, contenu] of [['index.html', html], ['app.js', app], ['sw.js', sw], ['theme-init.js', init]]) {
    assert.equal(/\bnew\s+Audio\b|\bAudioContext\b|\bwebkitAudioContext\b|<audio\b|\bautoplay\b/i.test(contenu), false, `Audio interdit trouvé dans ${nom}`);
  }

  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/gi)) {
    assert.ok(m[1].startsWith('./'), `Ressource locale attendue en ./ : ${m[1]}`);
  }
});

test('R2 & WCAG — Aucune couleur pure/vive et contrastes AA sur les 14 thèmes', () => {
  const css = lire('styles.css');
  const cssSansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const html = lire('index.html');
  const manifest = lire('manifest.json');

  for (const [nom, contenu] of [['styles.css', cssSansCommentaires], ['index.html', html], ['manifest.json', manifest]]) {
    for (const m of contenu.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
      const hex = m[0].toLowerCase();
      assert.notEqual(hex, '#000', `Noir pur #000 interdit dans ${nom}`);
      assert.notEqual(hex, '#000000', `Noir pur #000000 interdit dans ${nom}`);
      assert.notEqual(hex, '#fff', `Blanc pur #fff interdit dans ${nom}`);
      assert.notEqual(hex, '#ffffff', `Blanc pur #ffffff interdit dans ${nom}`);
      if (nom === 'styles.css' && (m[1].length === 3 || m[1].length === 6)) {
        const { chroma, satHsv } = hsvStats(hex);
        assert.ok(satHsv <= 0.55, `Couleur trop saturée (${hex}, HSV=${satHsv.toFixed(2)})`);
        assert.ok(chroma <= 0.35, `Chroma trop élevé (${hex}, chroma=${chroma.toFixed(2)})`);
      }
    }
  }

  const themes = [...cssSansCommentaires.matchAll(/html\[data-mode="([^"]+)"\]\s*\{([^}]+)\}/g)];
  assert.equal(themes.length, 14, 'Les 14 thèmes doivent être définis');

  for (const [, mode, body] of themes) {
    const vars = {};
    for (const v of body.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
      vars[v[1]] = v[2];
    }
    const fonds = ['bg', 'surface', 'surface-2', 'accent-fond', 'fini-fond'];
    for (const f of fonds) {
      assert.ok(contrastRatio(vars.texte, vars[f]) >= 4.5, `${mode}: --texte sur --${f} < 4.5`);
      assert.ok(contrastRatio(vars['texte-doux'], vars[f]) >= 4.5, `${mode}: --texte-doux sur --${f} < 4.5`);
    }
    for (const f of ['bg', 'surface', 'accent-fond']) {
      assert.ok(contrastRatio(vars.accent, vars[f]) >= 3.0, `${mode}: --accent sur --${f} < 3.0`);
    }
    assert.ok(contrastRatio(vars.fini, vars.bg) >= 3.0, `${mode}: --fini sur --bg < 3.0`);
  }
});

test('Sécurité & CSP — index.html, theme-init.js et app.js', () => {
  const html = lire('index.html');
  const app = lire('app.js');
  const init = lire('theme-init.js');

  const cspMatch = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(cspMatch, 'Balise meta CSP manquante');
  const csp = cspMatch[1];
  for (const directive of [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "manifest-src 'self'",
    "worker-src 'self'"
  ]) {
    assert.ok(csp.includes(directive), `Directive CSP manquante : ${directive}`);
  }

  assert.equal(/\sstyle\s*=/i.test(html), false, 'Aucun attribut style="" inline toléré dans index.html');
  assert.equal(/<style[\s>]/i.test(html), false, 'Aucune balise <style> inline tolérée');
  assert.equal(/\son[a-z]+\s*=/i.test(html), false, 'Aucun gestionnaire on*= inline toléré');

  const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)];
  assert.equal(scripts.length, 2, 'Exactement 2 balises <script> attendues');
  for (const [, attrs] of scripts) {
    assert.ok(/\bsrc="./i.test(attrs), 'Chaque <script> doit charger un fichier externe ./');
  }
  assert.ok(html.includes('<script src="./theme-init.js"></script>'));
  assert.ok(html.includes('<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png">'));
  assert.ok(html.includes('id="alerte-stockage"'));

  assert.ok(init.includes("localStorage.getItem('cap_reglages')"));
  assert.ok(init.includes('try {') && init.includes('catch (e)'));

  assert.ok(app.includes("register('./sw.js', { updateViaCache: 'none' })"));
  assert.ok(app.includes('.replace(/&/g') && app.includes('.replace(/"/g') && app.includes(".replace(/'/g"));
  assert.ok(app.includes('${echapper(r.id)}'), 'r.id doit être échappé');
  assert.ok(app.includes('${echapper(t.id)}'), 't.id doit être échappé');
  assert.equal(/\$\{r\.id\}/.test(app), false, 'r.id brut interdit');
  assert.equal(/\$\{t\.id\}/.test(app), false, 't.id brut interdit');

  // Tous les appels localStorage.setItem / removeItem doivent être uniquement dans ecrireStockage / supprimerStockage
  const setCalls = app.match(/localStorage\.(setItem|removeItem)\s*\(/g) || [];
  assert.equal(setCalls.length, 2, 'Uniquement ecrireStockage et supprimerStockage doivent appeler localStorage.setItem/removeItem');
});

test('Service Worker — cap-v21, fichiers, garde même origine, hors ligne & messages R2', () => {
  const sw = lire('sw.js');
  assert.ok(sw.includes("const CACHE = 'cap-v21';"));

  const attendus = [
    './',
    './index.html',
    './theme-init.js',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
  ];
  for (const f of attendus) {
    assert.ok(sw.includes(`'${f}'`), `${f} manquant dans FICHIERS`);
    if (f !== './') {
      assert.ok(fs.existsSync(path.join(ROOT, f.slice(2))), `${f} introuvable sur disque`);
    }
  }

  for (const msg of ["'etat'", "'activer'", "'recharger'"]) {
    assert.ok(sw.includes(msg), `Message SW R2 manquant : ${msg}`);
  }
  const installBlock = sw.match(/addEventListener\('install'[\s\S]*?\}\);/);
  assert.ok(installBlock && !installBlock[0].includes('skipWaiting'), 'Pas de skipWaiting dans install');
  assert.ok(sw.includes('url.origin !== self.location.origin'));
  assert.ok((sw.match(/ignoreSearch:\s*true/g) || []).length >= 2);
  assert.ok(sw.includes("e.request.mode === 'navigate'"));
  assert.ok(sw.includes('status: 503'));
  assert.ok(sw.includes('.catch(() => {})'));
});

test('Manifeste & Icônes PNG — structure, R2 et canaux alpha', () => {
  const manifest = JSON.parse(lire('manifest.json'));
  assert.equal(manifest.id, '/Cap/index.html');
  assert.equal(manifest.start_url, './index.html');
  assert.equal(manifest.dir, 'ltr');
  assert.equal(manifest.background_color, '#171b21');
  assert.equal(manifest.theme_color, '#171b21');
  assert.equal(manifest.icons.length, 5);
  assert.ok(manifest.icons.some((i) => i.src === './icons/icon-maskable-192.png' && i.purpose === 'maskable'));
  assert.ok(manifest.icons.some((i) => i.src === './icons/icon-maskable-512.png' && i.purpose === 'maskable'));
  assert.ok(manifest.icons.some((i) => i.src === './icons/apple-touch-icon.png' && i.sizes === '180x180'));
  assert.deepEqual(manifest.shortcuts.map((s) => s.url), ['./index.html?vue=minuteur', './index.html?vue=taches']);

  const p192 = parsePngInfo(path.join(ROOT, 'icons/icon-192.png'));
  assert.equal(p192.width, 192);
  assert.equal(p192.height, 192);

  const p512 = parsePngInfo(path.join(ROOT, 'icons/icon-512.png'));
  assert.equal(p512.width, 512);
  assert.equal(p512.height, 512);

  const pm192 = parsePngInfo(path.join(ROOT, 'icons/icon-maskable-192.png'));
  assert.equal(pm192.width, 192);
  assert.equal(pm192.height, 192);
  assert.equal(pm192.hasAlphaChannel, false);

  const pm512 = parsePngInfo(path.join(ROOT, 'icons/icon-maskable-512.png'));
  assert.equal(pm512.width, 512);
  assert.equal(pm512.height, 512);
  assert.equal(pm512.hasAlphaChannel, false);

  const papple = parsePngInfo(path.join(ROOT, 'icons/apple-touch-icon.png'));
  assert.equal(papple.width, 180);
  assert.equal(papple.height, 180);
  assert.equal(papple.hasAlphaChannel, false);
});

test('Dépôt & Documentation — fichiers config, tutoiement README et CLAUDE.md à jour', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.nojekyll')));
  assert.ok(lire('.gitattributes').includes('* text=auto eol=lf'));
  assert.ok(lire('.gitignore').includes('node_modules/'));

  const readme = lire('README.md');
  assert.equal(/\b(vous|votre|vos|pensez|ouvrez|installez|choisissez|augmentez)\b/i.test(readme), false, 'Vouvoiement restant dans README.md');
  assert.equal(/cap-v16|cap-v17/.test(readme), false, 'Ancienne version cap-v16/17 restante dans README.md');
  assert.ok(readme.includes('cap-v21'));
  assert.ok(readme.includes('npm test'));

  const claude = lire('CLAUDE.md');
  assert.ok(claude.includes('theme-init.js'));
  assert.ok(claude.includes('cap-v21'));
  assert.ok(claude.includes('tests/static.test.mjs'));
  assert.ok(claude.includes('tests/e2e.test.mjs'));
});
