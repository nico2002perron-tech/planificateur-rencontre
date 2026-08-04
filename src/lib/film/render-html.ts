/**
 * « Rapport vivant » — assemblage du FICHIER HTML autonome.
 *
 * Un seul fichier, aucune dépendance externe : polices (woff2 base64), logo,
 * CSS, JS et données sont incorporés. Il s'ouvre hors ligne, sur n'importe quel
 * appareil, et se transmet en pièce jointe. Rien n'est hébergé nulle part.
 *
 * ⚠️ Ce module lit des fichiers sur le disque (`public/fonts/web`, `public/`) :
 * il est réservé au SERVEUR. Toute la logique « quoi raconter » vit dans
 * `build-film-data.ts`, qui reste pur et testable.
 *
 * Répartition des rôles :
 *   · `build-film-data.ts` — le scénario (pur, testé)
 *   · `cover-html.ts`      — le balisage de la couverture
 *   · `cover-css.ts`       — son CSS
 *   · `client-script.ts`   — son interactivité
 *   · ce fichier           — l'assemblage et les ressources incorporées
 *
 * Contraintes typographiques du sous-ensemble de polices (`tools/build-report-fonts.py`) :
 *  - les FLÈCHES (→ ← ↑ ↓) n'existent que dans Montserrat → la pile de polices
 *    doit toujours finir par Montserrat en repli ;
 *  - le crochet ✓ (U+2713) n'existe dans AUCUNE des deux familles : ne jamais
 *    l'employer (utiliser •, · ou un SVG en ligne).
 */
import path from 'path';
import fs from 'fs';
import type { FilmData } from './build-film-data';
import type { PriceTargetReportData } from '../pdf/price-targets-template';
import { coverHtml } from './cover-html';
import { coverCss } from './cover-css';
import { clientScript } from './client-script';
import { C } from '../pdf/styles';

// ─── Ressources incorporées ──────────────────────────────────────────────────

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const WEB_FONTS_DIR = path.join(PUBLIC_DIR, 'fonts', 'web');

const FONT_FACES: { family: string; weight: number; file: string }[] = [
  { family: 'Open Sans', weight: 400, file: 'OpenSans-Regular.woff2' },
  { family: 'Open Sans', weight: 600, file: 'OpenSans-SemiBold.woff2' },
  { family: 'Montserrat', weight: 700, file: 'Montserrat-Bold.woff2' },
  { family: 'Montserrat', weight: 800, file: 'Montserrat-ExtraBold.woff2' },
];

/** Poids détaillé du fichier produit — garde-fou de budget (plan §1.2). */
export interface AssetWeights {
  fontsBytes: number;
  logoBytes: number;
  videoBytes: number;
  dataBytes: number;
  codeBytes: number;
  totalBytes: number;
}

/**
 * Médias du générique. La boucle vidéo n'est PAS posée en `src="data:..."` :
 * Safari exige des requêtes par plage d'octets sur les médias et refuse
 * régulièrement les URI `data:`. On transporte donc le base64 dans un îlot de
 * texte, et le script le convertit en objet Blob au chargement — les Blob, eux,
 * répondent aux requêtes par plage partout. L'affiche, elle, est une image :
 * une URI `data:` fait très bien l'affaire.
 */
export interface IntroMedia {
  videoB64: string | null;
  posterB64: string | null;
}

function readBase64(file: string): string | null {
  try { return fs.readFileSync(file).toString('base64'); } catch { return null; }
}

function buildFontCss(): { css: string; bytes: number } {
  let css = '';
  let bytes = 0;
  for (const f of FONT_FACES) {
    const b64 = readBase64(path.join(WEB_FONTS_DIR, f.file));
    if (!b64) continue;
    bytes += b64.length;
    css += `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;`
      + `src:url(data:font/woff2;base64,${b64}) format('woff2')}\n`;
  }
  return { css, bytes };
}

// ─── Échappement ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * JSON destiné à un <script> : on neutralise `<` (donc `</script>` et `<!--`) et
 * les séparateurs de ligne Unicode U+2028/U+2029, invalides dans un script.
 * Ces deux caractères ne sont JAMAIS écrits littéralement dans ce fichier —
 * JavaScript les traite comme des fins de ligne.
 */
function jsonForScript(value: unknown): string {
  const BS = String.fromCharCode(92);
  return JSON.stringify(value)
    .replace(/</g, BS + 'u003c')
    .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BS + 'u2029');
}

// ─── Rendu ───────────────────────────────────────────────────────────────────

export interface RenderResult {
  html: string;
  weights: AssetWeights;
}

export function renderFilmHtml(film: FilmData, report: PriceTargetReportData): RenderResult {
  const { css: fontCss, bytes: fontsBytes } = buildFontCss();
  // Logo dimensionné pour l'écran (`tools/build-report-logo.mjs`) : 6,8 Ko en
  // base64 contre 170 Ko pour l'original, pour un affichage identique.
  const logoB64 = readBase64(path.join(PUBLIC_DIR, 'logo-web.png'))
    ?? readBase64(path.join(PUBLIC_DIR, 'logo.png'));
  const logoBytes = logoB64 ? logoB64.length : 0;

  // Médias du générique (`tools/build-intro-video.mjs`). Absents = le générique
  // retombe simplement sur son fond peint : rien ne casse.
  const media: IntroMedia = {
    videoB64: readBase64(path.join(PUBLIC_DIR, 'intro-loop.mp4')),
    posterB64: readBase64(path.join(PUBLIC_DIR, 'intro-poster.webp')),
  };
  const videoBytes = (media.videoB64?.length ?? 0) + (media.posterB64?.length ?? 0);

  const dataJson = jsonForScript(film);

  const title = film.meta.client
    ? `Analyse des cours cibles — ${film.meta.client}`
    : 'Analyse des cours cibles';

  const baseCss = `
${fontCss}
:root{
  --navy:${C.navy}; --blue:${C.blue}; --cyan:${C.cyan}; --gold:${C.gold};
  --green:#059669; --red:${C.down};
  --e:cubic-bezier(.22,1,.36,1);
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
/* L'attribut « hidden » doit gagner. La règle du navigateur ([hidden]{display:none})
   a la spécificité la plus faible : n'importe quel « .drill-back{display:inline-flex} »
   l'écrase et l'élément reste À L'ÉCRAN. C'est exactement ce qui arrivait au bouton
   « Tous les secteurs », visible en permanence alors qu'il n'a de sens qu'après un
   clic sur un secteur. */
[hidden]{display:none!important}
body{
  /* Open Sans d'abord, Montserrat en repli : les flèches n'existent que dans Montserrat. */
  font-family:'Open Sans','Montserrat',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px; color:#0f172a; background:#f8fafc;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
body.dragging{user-select:none}
/* Compléments d'animation utilisés par la couverture */
@keyframes gspan{to{width:var(--to)}}
@keyframes w{to{width:var(--to)}}

@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  .rise,.lg-row,.scen>div,.badge,.arrow svg,.reveal,.reveal-f,.fade,.replay,.cas-row,.odo{opacity:1!important;transform:none!important}
  .arc{stroke-dashoffset:0!important}
  .bar .col{transform:none!important}
  .accent,.gauge .span,.box .pb i{width:var(--to,100%)!important}
  /* Le générique RESTE en mouvement réduit : c'est la couverture du document,
     pas une animation. Il perd sa vidéo et ses transitions, rien de plus — et il
     doit rester cliquable, sinon on n'entre jamais dans le rapport. */
  .aurora,.chap-toast{display:none}
  [data-tilt]{transform:none!important}
}
@media print{
  body{background:#fff}
  .aurora,.replay,.sheen,#intro,.drill-back,.why,.g-hint,.prog,.rail,.chap-toast{display:none!important}
  .page{max-width:none;padding:0}
  .glass{background:#fff!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;
    border:1px solid #e2e8f0!important;box-shadow:none!important}
  .reveal,.reveal-f,.fade,.odo{opacity:1!important;transform:none!important}
  [data-tilt]{transform:none!important}
  /* À l'impression, on montre tout : rien ne doit rester replié. */
  #cascade,#trust-panel{display:block!important}
  .card,.hdr,.hero,.cascade,.trust{break-inside:avoid}
}
${coverCss}
`.trim();

  const body = coverHtml(film, report, logoB64, media);

  // L'îlot de la boucle vidéo : du base64 pur, donc aucun caractère à échapper.
  // `type="text/plain"` empêche le navigateur d'essayer de l'exécuter.
  const videoIsland = media.videoB64
    ? `\n<script type="text/plain" id="intro-video-b64">${media.videoB64}</script>`
    : '';

  const html = `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>${baseCss}</style>
</head>
<body class="waiting">
${body}${videoIsland}
<script id="film-data" type="application/json">${dataJson}</script>
<script>
window.__FILM__ = JSON.parse(document.getElementById('film-data').textContent);
(function(){ var el = document.getElementById('cover-data');
  window.__COVER__ = el ? JSON.parse(el.textContent) : {}; })();
</script>
<script>${clientScript}</script>
</body>
</html>`;

  // Le CSS contient les polices et le balisage contient le logo : on les retire
  // pour que la ventilation ne double-compte pas.
  const codeBytes = Math.max(
    0,
    baseCss.length + clientScript.length + body.length
      - fontsBytes - logoBytes - (media.posterB64?.length ?? 0),
  );
  return {
    html,
    weights: {
      fontsBytes,
      logoBytes,
      videoBytes,
      dataBytes: dataJson.length,
      codeBytes,
      totalBytes: Buffer.byteLength(html, 'utf8'),
    },
  };
}
