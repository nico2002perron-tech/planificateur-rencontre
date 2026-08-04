/**
 * « La trajectoire » — le graphique en éventail de la projection 12 mois.
 *
 * Inspiré des cartes « Analyst Price Targets », mais SANS PASSÉ : il part d'un
 * point (aujourd'hui) et s'évase vers l'avant.
 *   · cône translucide  = de la borne prudente à la borne optimiste
 *   · ligne pleine      = le consensus
 *   · ligne pointillée  = le PLANCHER, la valeur si les prix ne bougeaient pas
 *                         du tout (portée uniquement par dividendes et coupons)
 *
 * Conformité : seuls le point de départ et les bornes à 12 mois sont des données.
 * Le chemin entre les deux est une illustration linéaire — jamais une prévision,
 * jamais un intervalle de confiance statistique. La mention est collée au dessin.
 *
 * Géométrie : le SVG garde un rapport largeur/hauteur FIXE et remplit son
 * conteneur. Les étiquettes et l'infobulle sont du HTML positionné en POURCENTAGE
 * du même repère — donc parfaitement aligné à toute taille, avec du texte net.
 */
import type { ProjectionSeries } from './build-film-data';

export interface ChartGeometry {
  w: number; h: number;
  padL: number; padR: number; padT: number; padB: number;
  yMin: number; yMax: number;
}

export interface ChartRender {
  svg: string;
  /** Étiquettes de fin (HTML), positionnées en % du repère. */
  endLabels: string;
  /** Libellés de l'axe des valeurs (HTML), positionnés en %. */
  gridLabels: string;
  /** Repères de l'axe des mois (HTML), positionnés en %. */
  monthAxis: string;
  geometry: ChartGeometry;
}

const NB = ' ';
const fmtFull = (n: number) => `${Math.round(n).toLocaleString('fr-CA')}${NB}$`;
/** Axe des valeurs : compact (« 305 k$ ») pour ne pas encombrer. */
const fmtAxis = (n: number) => Math.abs(n) >= 10000
  ? `${Math.round(n / 1000).toLocaleString('fr-CA')}${NB}k$`
  : `${Math.round(n).toLocaleString('fr-CA')}${NB}$`;
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NB}%`;

export function buildProjectionChart(p: ProjectionSeries): ChartRender {
  // padR généreux : les étiquettes de fin (« 386 783 $ » + « OPTIMISTE ») vivent
  // dans cette marge. Trop étroite, elles se faisaient couper par le bord de la
  // carte — piège vécu. Elles sont en plus ancrées à DROITE (voir endLabels).
  const g: ChartGeometry = {
    w: 760, h: 320,
    padL: 58, padR: 172, padT: 30, padB: 30,
    yMin: 0, yMax: 0,
  };

  // Échelle verticale : tout doit tenir, plancher compris (il peut passer SOUS la
  // borne prudente quand celle-ci est négative).
  let lo = Infinity, hi = -Infinity;
  for (const pt of p.points) {
    lo = Math.min(lo, pt.low, pt.floor);
    hi = Math.max(hi, pt.high, pt.floor);
  }
  const pad = (hi - lo) * 0.14 || Math.max(1, hi * 0.05);
  g.yMin = lo - pad;
  g.yMax = hi + pad;

  const innerW = g.w - g.padL - g.padR;
  const innerH = g.h - g.padT - g.padB;
  const X = (t: number) => g.padL + (t / 12) * innerW;
  const Y = (v: number) => g.padT + (1 - (v - g.yMin) / (g.yMax - g.yMin)) * innerH;

  const pts = (key: 'low' | 'mid' | 'high' | 'floor') =>
    p.points.map(pt => `${X(pt.month).toFixed(1)},${Y(pt[key]).toFixed(1)}`).join(' ');

  // Cône : on monte le long de la borne basse, on redescend le long de la haute.
  const cone = p.points.map(pt => `${X(pt.month).toFixed(1)},${Y(pt.low).toFixed(1)}`).join(' L ')
    + ' L ' + [...p.points].reverse().map(pt => `${X(pt.month).toFixed(1)},${Y(pt.high).toFixed(1)}`).join(' L ');

  // Trois repères horizontaux. Les LIBELLÉS sont en HTML (voir plus bas) : le SVG
  // s'étire sans conserver son rapport, ce qui déformerait du texte SVG.
  const gridVals = [g.yMin + (g.yMax - g.yMin) * 0.15, (g.yMin + g.yMax) / 2, g.yMin + (g.yMax - g.yMin) * 0.85];
  const grid = gridVals.map(v => `
    <line x1="${g.padL}" y1="${Y(v).toFixed(1)}" x2="${(g.w - g.padR).toFixed(1)}" y2="${Y(v).toFixed(1)}"
      stroke="rgba(3,4,94,.07)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');

  const last = p.points[12];
  const yTop = Y(last.high), yMid = Y(last.mid), yLow = Y(last.low), yFloor = Y(last.floor);

  const svg = `
<svg class="traj-svg" viewBox="0 0 ${g.w} ${g.h}" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="coneFill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34d399" stop-opacity=".05"/>
      <stop offset="1" stop-color="#34d399" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="midStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0891b2"/><stop offset="1" stop-color="#059669"/>
    </linearGradient>
  </defs>

  ${grid}

  <!-- Le cône d'incertitude : d'un point aujourd'hui vers l'éventail à 12 mois -->
  <path class="traj-cone" d="M ${cone} Z" fill="url(#coneFill)"/>

  <!-- Bornes -->
  <polyline class="traj-edge" points="${pts('high')}" fill="none" stroke="#34d399" stroke-width="1.4" stroke-opacity=".8" vector-effect="non-scaling-stroke"/>
  <polyline class="traj-edge" points="${pts('low')}" fill="none" stroke="#7dd3fc" stroke-width="1.4" stroke-opacity=".8" vector-effect="non-scaling-stroke"/>

  <!-- Plancher : la valeur portée par les seuls revenus, sans aucune croissance.
       Dessiné APRÈS les bornes : quand le scénario prudent est faible, le plancher
       le rejoint presque et se faisait masquer — or c'est un argument clé. -->
  <polyline class="traj-floor" points="${pts('floor')}" fill="none" stroke="#c5a365"
    stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>

  <!-- Le consensus, par-dessus tout -->
  <polyline class="traj-mid" points="${pts('mid')}" fill="none" stroke="url(#midStroke)"
    stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>

  <!-- Aujourd'hui -->
  <circle class="traj-now-halo" cx="${X(0).toFixed(1)}" cy="${Y(p.startValue).toFixed(1)}" r="11" fill="#0891b2" opacity=".16"/>
  <circle class="traj-now" cx="${X(0).toFixed(1)}" cy="${Y(p.startValue).toFixed(1)}" r="5" fill="#0891b2" stroke="#fff" stroke-width="2.4" vector-effect="non-scaling-stroke"/>

  <!-- Points d'arrivée (les seules autres vraies données) -->
  <circle class="traj-end" cx="${X(12).toFixed(1)}" cy="${yTop.toFixed(1)}" r="3.4" fill="#34d399"/>
  <circle class="traj-end" cx="${X(12).toFixed(1)}" cy="${yLow.toFixed(1)}" r="3.4" fill="#7dd3fc"/>
  <circle class="traj-end" cx="${X(12).toFixed(1)}" cy="${yMid.toFixed(1)}" r="5" fill="#059669" stroke="#fff" stroke-width="2.4" vector-effect="non-scaling-stroke"/>

  <!-- Curseur de survol (piloté par le script) -->
  <line class="traj-cursor" x1="0" y1="${g.padT}" x2="0" y2="${g.h - g.padB}"
    stroke="#0f172a" stroke-width="1" stroke-dasharray="3 3" opacity="0" vector-effect="non-scaling-stroke"/>
  <circle class="traj-cursor-dot" cx="0" cy="0" r="4.5" fill="#059669" stroke="#fff" stroke-width="2" opacity="0" vector-effect="non-scaling-stroke"/>
</svg>`.trim();

  // Étiquettes en HTML, positionnées en % du même repère (texte net à toute taille).
  // Les étiquettes de FIN sont ancrées au bord DROIT du cadre : ainsi elles ne
  // peuvent jamais être coupées, quelle que soit la largeur du conteneur.
  const topPc = (y: number) => `top:${(y / g.h * 100).toFixed(2)}%`;
  const endLabels = `
    <div class="tj-lbl end hi" style="${topPc(yTop)}">
      <b>${fmtFull(last.high)}</b><span>optimiste</span></div>
    <div class="tj-lbl end mid" style="${topPc(yMid)}">
      <b>${fmtFull(last.mid)}</b><span>consensus</span></div>
    <div class="tj-lbl end lo" style="${topPc(yLow)}">
      <b>${fmtFull(last.low)}</b><span>prudent</span></div>
    ${Math.abs(yFloor - yMid) > 24 && Math.abs(yFloor - yLow) > 20 ? `
    <div class="tj-lbl end fl" style="${topPc(yFloor)}">
      <b>${fmtFull(last.floor)}</b><span>revenus seuls</span></div>` : ''}
    <div class="tj-lbl now" style="left:${(X(0) / g.w * 100).toFixed(2)}%;${topPc(Y(p.startValue) + 20)}">
      <b>${fmtFull(p.startValue)}</b><span>aujourd’hui</span></div>`;

  // Largeur de la colonne des valeurs = la marge gauche du repère, en % : les
  // libellés restent alignés sur le début de la grille à toute largeur.
  const gridLabels = gridVals.map(v =>
    `<span class="tj-g" style="top:${(Y(v) / g.h * 100).toFixed(2)}%;width:${(g.padL / g.w * 100).toFixed(2)}%">${fmtAxis(v)}</span>`).join('');

  // Axe des mois : un repère sur trois, pour rester lisible.
  const monthAxis = p.points
    .filter(pt => pt.month % 3 === 0)
    .map(pt => `<span class="tj-m" style="left:${(X(pt.month) / g.w * 100).toFixed(2)}%">${
      pt.month === 0 ? 'auj.' : '+' + pt.month + ' mois'}</span>`)
    .join('');

  return { svg, endLabels, gridLabels, monthAxis, geometry: g };
}

/** Résumé chiffré affiché sous le graphique (repris tel quel du héros). */
export function projectionCaption(p: ProjectionSeries): string {
  const last = p.points[12];
  const gainPct = p.startValue > 0 ? ((last.mid - p.startValue) / p.startValue) * 100 : 0;
  const floorPct = p.startValue > 0 ? ((last.floor - p.startValue) / p.startValue) * 100 : 0;
  return `Consensus <b>${fmtFull(last.mid)}</b> (${fmtPct(gainPct)})`
    + ` &middot; revenus seuls <b>${fmtFull(last.floor)}</b> (${fmtPct(floorPct)})`;
}
