/**
 * La COUVERTURE du « Rapport vivant » — même structure et mêmes chiffres que la
 * couverture du PDF de cours cibles (`price-targets-template.tsx` → `CoverPage`),
 * enrichie des interactions du palier « WOW ».
 *
 * Blocs (identiques au PDF, dans le même ordre) :
 *   1. bandeau : logo + date + titre + nom du client + pastilles
 *      (+ pastille « on se vérifie » et son panneau de transparence)
 *   2. « portefeuille aujourd'hui → projeté 12 mois » + éventail
 *      (+ curseur « et si » glissable et bouton « Pourquoi ce chiffre ? »)
 *   3. RÉPARTITION DU PORTEFEUILLE : classes d'actifs + secteurs
 *      (+ rayons X : clic sur un secteur → ses titres)
 *   4. CALENDRIER DES REVENUS : revenu annuel + 12 mois + dividendes / revenus fixes
 *   5. mention légale + pied de page
 *
 * Le CSS vit dans `cover-css.ts`, le JavaScript dans `client-script.ts`.
 */
import type { PriceTargetReportData, PriceTargetHolding } from '../pdf/price-targets-template';
import { buildEquitySectorSlices, buildAssetClassSlices, SECTOR_META, type SectorSlice } from '../pdf/sectors';
import type { FilmData } from './build-film-data';
import { buildProjectionChart, projectionCaption } from './projection-chart';
import { buildComptes, buildObligations, buildMoisRevenu } from './build-sections';
import { comptesHtml, obligationsHtml, moisIsland, moisPanneauHtml } from './sections-html';
import { couverturePortraitHtml, bascalePapierHtml } from './chapitre-couverture';

export { coverCss } from './cover-css';

// ─── Formatage (identique au PDF : fr-CA, espace insécable) ──────────────────
const NB = ' ';
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-CA')}${NB}$`;
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${NB}%`;
const fmt1 = (n: number) => n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} k` : Math.round(n).toLocaleString('fr-CA');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/** Date de l'en-tête — même format que le PDF (« 29 juillet 2026 »). */
function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

/** JSON sûr pour un <script> : `<` neutralisé, séparateurs de ligne échappés. */
function jsonIsland(value: unknown): string {
  const BS = String.fromCharCode(92);
  return JSON.stringify(value)
    .replace(/</g, BS + 'u003c')
    .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BS + 'u2029');
}

/** Beigne : chaque tranche se dessine, se soulève au survol, se nomme au centre. */
function donut(slices: SectorSlice[], size: number, id: string): string {
  const visible = slices.filter(s => s.pct > 0);
  if (visible.length === 0) return '';
  const CIRC = 2 * Math.PI * 42;
  let cum = 0;
  const arcs = visible.map((s, i) => {
    const len = (s.pct / 100) * CIRC;
    const rot = (cum / 100) * 360 - 90;
    cum += s.pct;
    return `<circle class="arc" data-slice="${id}-${i}" data-name="${esc(s.label)}" data-pct="${fmt1(s.pct)}${NB}%"
      cx="50" cy="50" r="42" fill="none" stroke="${s.color}" stroke-width="15"
      stroke-dasharray="${len.toFixed(2)} ${(CIRC - len).toFixed(2)}"
      style="--len:${len.toFixed(2)};--rot:${rot.toFixed(2)}deg;animation-delay:${(0.06 * i).toFixed(2)}s"/>`;
  }).join('');
  return `<div class="dn" style="width:${size}px;height:${size}px">
    <svg class="donut" viewBox="0 0 100 100" aria-hidden="true">${arcs}</svg>
    <div class="dn-mid"><b></b><span></span></div>
  </div>`;
}

function legend(slices: SectorSlice[], id: string): string {
  return slices.filter(s => s.pct > 0).map((s, i) => `
    <button type="button" class="lg-row" data-for="${id}-${i}" style="--i:${i}">
      <span class="sw" style="background:${s.color};--c:${s.color}"></span>
      <span class="lg-name">${esc(s.label)}</span>
      <span class="lg-pct">${fmt1(s.pct)}${NB}%</span>
    </button>`).join('');
}

/**
 * Rayons X : pour chaque tranche de secteur, la liste de SES titres.
 * On reprend exactement l'affectation de `buildEquitySectorSlices` (y compris la
 * fusion de la queue dans « Autres ») pour qu'aucun titre ne se perde.
 */
function buildDrill(holdings: PriceTargetHolding[], slices: SectorSlice[]): Record<string, SectorSlice[]> {
  const byCode = new Map(slices.map(s => [s.code, s]));
  const autres = slices.find(s => s.code === 'OTHER');
  const groups = new Map<string, { h: PriceTargetHolding; value: number }[]>();

  for (const h of holdings) {
    if (h.assetType !== 'EQUITY' && h.assetType !== 'ETF') continue;
    const value = Math.abs(h.marketValue);
    if (value <= 0) continue;
    const code = (h.sector && SECTOR_META[h.sector]) ? h.sector : (h.assetType === 'ETF' ? 'ETF' : 'OTHER');
    // Secteur absorbé par « Autres » lors de la fusion de la queue.
    const slice = byCode.get(code) ?? autres;
    if (!slice) continue;
    const list = groups.get(slice.label) ?? [];
    list.push({ h, value });
    groups.set(slice.label, list);
  }

  const out: Record<string, SectorSlice[]> = {};
  for (const [label, list] of groups) {
    const total = list.reduce((s, x) => s + x.value, 0) || 1;
    const parent = slices.find(s => s.label === label);
    out[label] = list
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({
        code: x.h.symbol,
        label: `${x.h.symbol} — ${x.h.name}`.slice(0, 46),
        // Nuances de la couleur du secteur : on reste dans sa famille chromatique.
        color: shade(parent?.color ?? '#94a3b8', i),
        value: x.value,
        pct: (x.value / total) * 100,
      }));
  }
  return out;
}

/** Éclaircit progressivement une couleur hex pour distinguer les titres d'un secteur. */
function shade(hex: string, i: number): string {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = Math.min(0.62, i * 0.14);
  const mix = (c: number) => Math.round(c + (255 - c) * k);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/**
 * Une carte de revenu : le montant annuel, ce qui a DÉJÀ été versé, ce qui reste,
 * et une barre qui montre la proportion.
 *
 * ⚠️ Le « déjà versé » vient des TRANSACTIONS RÉELLES, jamais d'une projection.
 * Quand on n'a pas de transactions (`verse` vaut null), la carte se tait : elle
 * n'affiche qu'un montant annuel et une barre pleine, sans jamais prétendre que
 * zéro a été encaissé. C'est exactement ce que faisait le code d'avant — écrire
 * « Encaissé 0 $ » en dur — et il contredisait le PDF dès février.
 */
function carteRevenu(
  cls: string, nom: string, couleur: string, annuel: number,
  verse: number | null | undefined, aVenir: number | null | undefined, delai: number,
): string {
  const connu = typeof verse === 'number' && typeof aVenir === 'number';
  const total = connu ? verse + aVenir : annuel;
  const part = connu && total > 0 ? Math.min((verse / total) * 100, 100) : 100;
  const ligne = connu
    ? `<span>Déjà versé <b>${fmt(verse)}</b></span><span>À venir <b>${fmt(aVenir)}</b></span>`
    : `<span>Sur douze mois</span><span><b>${fmt(annuel)}</b></span>`;
  return `<div class="box ${cls}">
        <div class="r1"><span class="nm"><i style="background:${couleur}"></i>${nom}</span><span class="amt">${fmt(total)}</span></div>
        <div class="r2">${ligne}</div>
        <div class="pb"><i style="--to:${part.toFixed(1)}%;animation:w 1.1s ${delai}s var(--e) forwards"></i></div>
      </div>`;
}

// ─── HTML ────────────────────────────────────────────────────────────────────

export function coverHtml(
  film: FilmData,
  report: PriceTargetReportData,
  logoB64: string | null,
  media: { videoB64: string | null; posterB64: string | null } = { videoB64: null, posterB64: null },
): string {
  const s = report.summary;
  const h = film.hero;

  const assetSlices = buildAssetClassSlices(report.holdings);
  const sectorSlices = buildEquitySectorSlices(report.holdings);
  const drill = buildDrill(report.holdings, sectorSlices);

  // Ventilation « aujourd'hui » (identique à la couverture PDF)
  const eqValue = s.totalCurrentValue || 0;
  const fiValue = s.fixedIncomeMarketValue ?? 0;
  const cashOther = Math.max(0, s.totalMarketValue - eqValue - fiValue);

  // Revenus
  const eqDiv = s.equityDividends ?? 0;
  const fiInc = s.fixedIncomeAnnualIncome ?? 0;
  const incomeTotal = eqDiv + fiInc;
  const yieldPct = s.totalMarketValue > 0 ? (incomeTotal / s.totalMarketValue) * 100 : 0;
  const enc = film.encaisse;
  const aujourdhui = new Date(film.meta.generatedAt);
  const comptes = buildComptes(report.holdings);
  const obligations = buildObligations(report.holdings, aujourdhui);
  const cal = report.incomeCalendar ?? [];
  const maxMonth = Math.max(1, ...cal.map(m => (m.dividends || 0) + (m.coupons || 0)));
  const nowMonth = new Date(film.meta.generatedAt).getMonth();
  const douzeMois = Array.from({ length: 12 }, (_, i) => buildMoisRevenu(cal, i, nowMonth))
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const payers = [...report.holdings]
    .filter((x: PriceTargetHolding) => (x.forwardDividend || 0) > 0)
    .sort((a, b) => (b.forwardDividend || 0) - (a.forwardDividend || 0))
    .slice(0, 3).map(x => x.symbol);

  const pl = (n: number) => n > 1 ? 's' : '';
  const pills: string[] = [];
  if (s.equityCount > 0) pills.push(`<i style="background:#00d4ff"></i>${s.equityCount} action${pl(s.equityCount)}/FNB`);
  if (s.fixedIncomeCount > 0) pills.push(`<i style="background:#c5a365"></i>${s.fixedIncomeCount} revenu${pl(s.fixedIncomeCount)} fixe${pl(s.fixedIncomeCount)}`);
  if (s.cashCount > 0) pills.push(`<i style="background:#64748b"></i>${s.cashCount} liquidités`);
  if (s.targetsFound > 0) pills.push(`<i style="background:#10d98a"></i>${s.targetsFound} cours cible${pl(s.targetsFound)}`);
  if (film.analystTotal > 0) pills.push(`<i style="background:#6366f1"></i>${film.analystTotal} avis d&rsquo;analystes`);

  // ── Éventail + curseur « et si » ──
  const gaugePos = { lo: 8, mid: 50, hi: 92 };
  let gauge = '';
  if (h.scenarios && h.hasRange) {
    const { low, mid, high } = h.scenarios;
    const lo = Math.min(low, mid, high), hi = Math.max(low, mid, high);
    const pad = (hi - lo) * 0.12 || 1;
    const dMin = lo - pad, span = (hi + pad - dMin) || 1;
    const pos = (v: number) => Math.max(4, Math.min(96, ((v - dMin) / span) * 100));
    gaugePos.lo = pos(lo); gaugePos.hi = pos(hi); gaugePos.mid = pos(mid);
    gauge = `
      <p class="g-hint" id="gauge-hint">Glissez la poignée pour explorer les hypothèses</p>
      <div class="gauge lift-sm" id="gauge">
        <div class="track"></div>
        <div class="span" style="left:${gaugePos.lo}%;--to:${(gaugePos.hi - gaugePos.lo).toFixed(1)}%"></div>
        <div class="end" style="left:calc(${gaugePos.lo}% - 2.5px)"></div>
        <div class="end" style="left:calc(${gaugePos.hi}% - 2.5px)"></div>
        <div class="mid" style="left:calc(${gaugePos.mid}% - 1px)"></div>
        <div class="knob" tabindex="0" role="slider" aria-label="Hypothèse de rendement"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
          style="left:calc(${gaugePos.mid}% - 9.5px)"></div>
      </div>
      <div class="scen lift-sm">
        <div class="is-lo" style="animation-delay:2.15s"><div class="l">Prudent</div>
          <div class="v">${fmt(h.portfolioValue + low)}</div><div class="p">${fmtPct((low / h.portfolioValue) * 100)}</div></div>
        <div class="is-mid" style="animation-delay:2.25s"><div class="l">Consensus</div>
          <div class="v">${fmt(h.portfolioValue + mid)}</div><div class="p">${fmtPct((mid / h.portfolioValue) * 100)}</div></div>
        <div class="is-hi" style="animation-delay:2.35s"><div class="l">Optimiste</div>
          <div class="v">${fmt(h.portfolioValue + high)}</div><div class="p">${fmtPct((high / h.portfolioValue) * 100)}</div></div>
      </div>
      <p class="note">Bornes = si toutes les cibles basses / hautes des analystes étaient atteintes. Des repères, pas des prévisions.</p>`;
  }

  // ── Vue « Trajectoire » du carrousel : le graphique en éventail ──
  const chart = film.projection ? buildProjectionChart(film.projection) : null;
  const trajView = chart && film.projection ? `
    <div class="car-view" data-view="trajectoire" role="tabpanel" aria-labelledby="tab-traj">
      <div class="traj">
        <div class="traj-box" id="traj-box">
          ${chart.svg}
          <div class="tj-grid">${chart.gridLabels}</div>
          <div class="tj-labels">${chart.endLabels}</div>
          <div class="tj-tip" id="traj-tip" hidden></div>
        </div>
        <div class="traj-axis">${chart.monthAxis}</div>
        <p class="traj-cap">${projectionCaption(film.projection)}</p>
        <div class="traj-legend">
          <span><i class="sw-mid"></i>Consensus</span>
          <span><i class="sw-cone"></i>Prudent &rarr; optimiste</span>
          <span><i class="sw-floor"></i>Revenus seuls, sans croissance</span>
        </div>
        <p class="note">Seuls le point de départ et les trois montants à 12 mois sont des données
          (cibles d&rsquo;analystes). Le chemin entre les deux est une illustration, pas une prévision,
          et la largeur du cône n&rsquo;est pas une probabilité.</p>
      </div>
    </div>` : '';

  const heroProj = h.projectedValue != null && h.projectedGainPct != null ? `
    <div class="proj">
      <div class="proj-head">
        <p class="h-lbl">Portefeuille projeté 12 mois &mdash; consensus des analystes</p>
        ${trajView ? `<div class="car-tabs" role="tablist" aria-label="Vues de la projection">
          <button type="button" class="car-tab is-on" data-view="sommaire" role="tab" aria-selected="true">Sommaire</button>
          <button type="button" class="car-tab" id="tab-traj" data-view="trajectoire" role="tab" aria-selected="false">Trajectoire</button>
        </div>` : ''}
      </div>
      <div class="car" id="carousel">
        <div class="car-track" id="car-track">
          <div class="car-view" data-view="sommaire" role="tabpanel">
            <div class="h-top lift">
              <div class="h-val up odo" id="proj-val" data-odo="proj" data-value="${Math.round(h.projectedValue)}" data-delay="1300">${fmt(h.projectedValue)}</div>
              <span class="badge" id="proj-badge">${fmtPct(h.projectedGainPct)}</span>
            </div>
            ${film.contributions.length > 0 ? `<button type="button" class="why" id="cascade-btn" aria-expanded="false">
              <span class="chev">&#8250;</span> Pourquoi ce chiffre ?
            </button>` : ''}
            ${gauge}
          </div>
          ${trajView}
        </div>
      </div>
    </div>` : '';

  // ── Cascade « Pourquoi ce chiffre ? » ──
  const cascade = film.contributions.length > 0 ? `
  <section class="cascade glass reveal-f" id="cascade" data-tilt hidden>
    <span class="sheen"></span>
    <h4>D&rsquo;où vient la projection</h4>
    <p class="sub">Ce que chaque titre apporterait si sa cible d&rsquo;analystes était atteinte, plus les revenus encaissés
      de l&rsquo;année. La somme donne exactement l&rsquo;écart projeté ci-dessus &mdash; rien n&rsquo;est caché.</p>
    <div id="cascade-rows"></div>
    <div class="cas-total"><span>Total</span><span></span><span id="cascade-total"></span></div>
  </section>` : '';

  // ── Panneau de transparence ──
  const tr = film.transparency;
  const trustPill = tr ? `<button type="button" class="pill" id="trust-pill" aria-expanded="false">
    <span class="chev">&#8250;</span> Cibles passées : ${tr.hits} sur ${tr.total} touchées
  </button>` : '';
  const trustPanel = tr ? `
    <div class="trust" id="trust-panel" hidden>
      <h4>Nos cibles de l&rsquo;an dernier, vérifiées</h4>
      <p class="sub">
        ${tr.hits} cible${pl(tr.hits)} sur ${tr.total} ${tr.hits > 1 ? 'ont' : 'a'} été touchée${pl(tr.hits)} pendant l&rsquo;horizon de 12 mois${
          tr.avgRealizedPct != null ? ` &middot; gain réellement réalisé à l&rsquo;échéance : <b>${fmtPct(tr.avgRealizedPct)}</b> en moyenne` : ''
        }. Les cibles manquées sont montrées aussi.
      </p>
      ${tr.rows.map(r => `
        <div class="trust-row">
          <span class="trust-sym">${esc(r.symbol)}</span>
          <span class="trust-path">
            <span>d&rsquo;alors <b>${fmt(r.fromPrice)}</b></span>
            <span>&#8594; visé <b>${fmt(r.target)}</b></span>
            ${r.peak != null ? `<span>&#8594; sommet <b>${fmt(r.peak)}</b></span>` : ''}
            ${r.actual != null ? `<span>&#8594; à l&rsquo;échéance <b>${fmt(r.actual)}</b>${
              r.actualGainPct != null ? ` (${fmtPct(r.actualGainPct)})` : ''}</span>` : ''}
          </span>
          <span class="trust-verdict ${r.hit ? 'ok' : 'no'}"><i></i>${r.hit ? 'Cible touchée' : 'Cible manquée'}</span>
        </div>`).join('')}
      <p class="foot">« Touchée » signifie que le prix a atteint la cible au moins une fois pendant les 12 mois &mdash;
        pas qu&rsquo;il a terminé au-dessus. Les deux chiffres sont donnés pour chaque titre. Les cours cibles sont des
        estimations d&rsquo;analystes, pas des promesses.</p>
    </div>` : '';

  // ── Générique nominatif — « Le plateau clair » ──
  // Le client ouvre le fichier sur un plateau de studio pâle : son nom en encre
  // marine à gauche, la scène 3D à droite qui tourne en boucle SANS cadre, sans
  // coin arrondi, sans ombre portée — ses bords sont dissous dans la page, on ne
  // voit jamais où l'image commence. C'est ce que Nicolas a demandé : « un fond
  // très pâle pour fitter avec le fond de la vidéo ».
  //
  // ⚠️ L'identifiant reste `#intro` et le bouton `#intro-skip` : `render-html.ts`
  // les cible nommément (impression, mouvement réduit) et `client-script.ts`
  // cherche le bouton. Un renommage casserait les deux en silence.
  //
  // Trois boîtes imbriquées pour la scène : une par masque. On n'emploie PAS
  // `mask-composite`, dont l'absence de prise en charge fait réapparaître le
  // rectangle en entier.
  const affiche = media.posterB64
    ? `<img class="gen-fixe" alt="" src="data:image/webp;base64,${media.posterB64}">`
    : '';
  // Le bouton : cinq couches, dans cet ordre de peinture (isolation:isolate sur le
  // bouton) — halo 0, anneau 1, fond 2, lueur 3, libellé 4. Aucun z-index négatif.
  // Il garde son identifiant, sa classe, son type et son nom accessible : le script
  // cherche #intro-skip, et la flèche reste aria-hidden.
  const bouton = `<button type="button" id="intro-skip" class="gen-entrer">
          <span class="gen-halo" aria-hidden="true"></span>
          <span class="gen-anneau" aria-hidden="true"></span>
          <span class="gen-fond" aria-hidden="true"></span>
          <span class="gen-lueur" aria-hidden="true"></span>
          <span class="gen-lbl">Entrer<span class="gen-fleche" aria-hidden="true">&rarr;</span></span>
        </button>`;

  const intro = film.meta.client ? `
<div id="intro" role="dialog" aria-modal="true" aria-labelledby="intro-name">
  <div class="gen-plaque">
    <span class="gen-court h1" aria-hidden="true"><i></i></span>
    <span class="gen-court v1" aria-hidden="true"><i></i></span>
    <div class="gen-grille">
      <div class="gen-texte">
        ${logoB64 ? `<img class="gen-logo" src="data:image/png;base64,${logoB64}" alt="Groupe Financier Ste-Foy">` : ''}
        <p class="gen-marque"><i class="gen-filet" aria-hidden="true"></i><span>Analyse des cours cibles</span></p>
        <h1 id="intro-name" class="gen-nom">${esc(film.meta.client)}</h1>
        <p class="gen-sous">Préparé par <b>${esc(film.meta.advisor)}</b><span class="gen-pt" aria-hidden="true">&middot;</span>${esc(dateCourte(film.meta.generatedAt))}</p>
        <div class="gen-action">${bouton}</div>
        <p class="gen-aide">ou cliquez n&rsquo;importe où</p>
      </div>
      <div class="gen-scene" aria-hidden="true">
        <div class="gen-scene-h">
          <div class="gen-scene-i">
            ${affiche}
            <video class="gen-video" muted loop playsinline preload="none"
              disablepictureinpicture disableremoteplayback tabindex="-1"></video>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>` : '';

  const coverData = {
    sectors: sectorSlices.map(x => ({ label: x.label, color: x.color, pct: x.pct, value: x.value })),
    drill: Object.fromEntries(Object.entries(drill).map(([k, v]) =>
      [k, v.map(x => ({ label: x.label, color: x.color, pct: x.pct, value: x.value }))])),
    gaugePos,
    // Repère du graphique : le script s'en sert pour convertir la position du
    // pointeur en mois, et pour placer le curseur exactement sur la courbe.
    chart: chart ? chart.geometry : null,
  };

  // ─── Chapitres (le « scroll-film ») ───────────────────────────────────────
  // Un chapitre = une ancre réellement présente dans la page. On ne déclare que
  // ceux qui existent : une répartition vide ou un portefeuille sans revenu ne
  // doit pas laisser un point mort dans le rail.
  const chapters: { id: string; label: string }[] = [
    { id: 'ch-portrait', label: 'Le portrait' },
  ];
  if (assetSlices.length > 0 || sectorSlices.length > 0) chapters.push({ id: 'ch-repartition', label: 'La répartition' });
  if (incomeTotal > 0) chapters.push({ id: 'ch-revenus', label: 'Les revenus' });
  const blocComptes = comptesHtml(comptes);
  if (blocComptes) chapters.push({ id: 'ch-comptes', label: 'Vos comptes' });
  const blocObligations = obligationsHtml(obligations);
  if (blocObligations) chapters.push({ id: 'ch-obligations', label: 'Vos obligations' });
  chapters.push({ id: 'ch-mentions', label: 'Les mentions' });

  const rail = chapters.length > 2 ? `
<div class="prog" aria-hidden="true"><i id="prog-bar"></i></div>
<nav class="rail" id="rail" aria-label="Chapitres du rapport">
  <span class="rail-line"><i id="rail-fill"></i></span>
  ${chapters.map((c, i) => `<button type="button" class="rail-dot${i === 0 ? ' is-on' : ''}" data-go="${c.id}">
    <span class="rail-lbl">${esc(c.label)}</span><i></i></button>`).join('')}
</nav>
<div class="chap-toast" id="chap-toast" aria-live="polite"><b></b></div>` : '';

  return `
${intro}
<div class="aurora" aria-hidden="true"><i class="o1"></i><i class="o2"></i><i class="o3"></i><i class="o4"></i></div>
${rail}
${couverturePortraitHtml(film)}

<div class="page">

  <!-- 1 · Bandeau -->
  <header class="hdr glass" id="ch-portrait" data-chap="Le portrait" data-tilt>
    <span class="sheen"></span>
    <div class="accent"></div>
    <div class="hdr-in">
      <span class="date rise" style="animation-delay:.5s">${esc(dateCourte(film.meta.generatedAt))}</span>
      ${logoB64 ? `<img class="rise lift-sm" style="animation-delay:.2s" src="data:image/png;base64,${logoB64}" alt="Groupe Financier Ste-Foy">` : ''}
      <h1 class="rise lift" style="animation-delay:.3s"><span class="grad">Analyse des cours cibles</span></h1>
      ${film.meta.client ? `<h2 class="rise lift-sm" style="animation-delay:.4s">${esc(film.meta.client)}</h2>` : ''}
      <div class="div"></div>
      <div class="pills">
        ${pills.map((p, i) => `<span class="pill rise" style="animation-delay:${(0.6 + i * 0.07).toFixed(2)}s">${p}</span>`).join('')}
        ${trustPill}
      </div>
      ${trustPanel}
    </div>
  </header>

  <!-- 2 · Aujourd'hui → projeté -->
  <section class="hero glass fade" data-tilt style="animation-delay:.75s">
    <span class="sheen"></span>
    <div class="today">
      <p class="h-lbl">Portefeuille aujourd&rsquo;hui</p>
      <div class="h-val odo lift" id="today-val" data-odo="today" data-value="${Math.round(h.portfolioValue)}" data-delay="700">${fmt(h.portfolioValue)}</div>
      <div class="h-sub lift-sm">
        ${eqValue > 0 ? `<span>Actions : <b>${fmt(eqValue)}</b></span>` : ''}
        ${fiValue > 0 ? `<span>Rev. fixe : <b>${fmt(fiValue)}</b></span>` : ''}
        ${cashOther > 0 ? `<span>Liquidités : <b>${fmt(cashOther)}</b></span>` : ''}
      </div>
    </div>
    <div class="arrow">
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><path d="M1 6h13M10 2l4.5 4-4.5 4" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>12 mois</span>
    </div>
    ${heroProj}
  </section>

  ${cascade}

  <!-- 3 · Répartition -->
  ${(assetSlices.length > 0 || sectorSlices.length > 0) ? `
  <div class="sec reveal" id="ch-repartition" data-chap="La répartition"><i></i><h3>Répartition du portefeuille</h3><small>cliquez un secteur pour voir ses titres</small></div>
  <div class="card glass reveal-f" data-tilt>
    <span class="sheen"></span>
    <div class="two">
      <div>
        <div class="blk-head"><p class="blk-lbl">Classes d&rsquo;actifs</p></div>
        <div class="dl lift-sm" data-donut="ac">${donut(assetSlices, 112, 'ac')}<div class="lg">${legend(assetSlices, 'ac')}</div></div>
      </div>
      <div class="vr"></div>
      <div>
        <div class="blk-head">
          <p class="blk-lbl" id="drill-title">Secteurs &mdash; actions et FNB</p>
          <button type="button" class="drill-back" id="drill-back" hidden>&#8592; Tous les secteurs</button>
        </div>
        <div class="dl lift-sm" data-donut="sec">${donut(sectorSlices, 126, 'sec')}<div class="lg">${legend(sectorSlices, 'sec')}</div></div>
      </div>
    </div>
  </div>` : ''}

  <!-- 4 · Calendrier des revenus -->
  ${incomeTotal > 0 ? `
  <div class="sec reveal" id="ch-revenus" data-chap="Les revenus"><i class="g"></i><h3>Calendrier des revenus ${film.meta.year}</h3><small>projection des dividendes et coupons</small></div>
  <div class="card glass reveal-f" data-tilt>
    <span class="sheen"></span>
    <div class="inc">
      <div class="lift-sm">
        <p class="blk-lbl">Revenu annuel projeté</p>
        <div class="inc-v odo" data-odo="income" data-value="${Math.round(incomeTotal)}" data-delay="300">${fmt(incomeTotal)}</div>
        <p class="inc-m">environ <b>${fmt(incomeTotal / 12)}</b> / mois</p>
        <div class="yld"><em>${fmt1(yieldPct)}${NB}%</em><span>rendement annuel</span></div>
      </div>
      <div class="vr"></div>
      <div class="bars lift-sm">
        ${(cal.length === 12 ? cal : MONTHS_SHORT.map(() => ({ dividends: 0, coupons: 0 }))).map((m, i) => {
          const v = (m.dividends || 0) + (m.coupons || 0);
          const pct = Math.max(2, (v / maxMonth) * 100);
          return `<button type="button" class="bar${i === nowMonth ? ' now' : ''}" data-mois="${i}" aria-expanded="false" title="${MONTHS_SHORT[i]} : ${fmt(v)} — cliquez pour comprendre">
            <span class="n">${v > 0 ? fmtK(v) : ''}</span>
            <span class="col" style="height:${pct.toFixed(1)}px;animation-delay:${(0.3 + i * 0.05).toFixed(2)}s"></span>
            <span class="m">${MONTHS_SHORT[i]}</span></button>`;
        }).join('')}
      </div>
    </div>
    ${moisPanneauHtml()}
    <div class="boxes lift-sm">
      ${carteRevenu('d', 'Dividendes', '#34d399', eqDiv, enc && enc.dividendesVerses, enc && enc.dividendesAVenir, .9)}
      ${carteRevenu('f', 'Revenus fixes', '#38bdf8', fiInc, enc && enc.couponsVerses, enc && enc.couponsAVenir, 1.05)}
    </div>
    <div class="inc-foot">
      <span>${enc ? 'couleur pleine = déjà versé &middot; teinte claire = à venir' : 'projection sur douze mois'}</span>
      ${payers.length > 0 ? `<span>Principaux payeurs : <b>${payers.map(esc).join(' &middot; ')}</b></span>` : ''}
    </div>
  </div>` : ''}

  ${blocComptes}

  ${blocObligations}

  <!-- 5 · Mentions -->
  <p class="legal reveal" id="ch-mentions" data-chap="Les mentions">Cours cibles = consensus des analystes ; les titres sans couverture reçoivent une estimation fondée sur le rendement 12 mois.
    Document fourni à titre informatif &mdash; ne constitue pas un conseil en placement.</p>
  <div class="pgfoot reveal"><span>Groupe Financier Ste-Foy &mdash; Analyse des cours cibles</span><span>${esc(film.meta.advisor)}</span></div>
</div>

<button type="button" class="replay" id="replay" title="Rejouer l’animation">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
  Rejouer
</button>

${moisIsland(douzeMois)}
${bascalePapierHtml()}
<script id="cover-data" type="application/json">${jsonIsland(coverData)}</script>`.trim();
}
