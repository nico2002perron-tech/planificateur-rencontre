/**
 * Le balisage des sections qui vont au-delà de la couverture : « Vos comptes » et
 * « Vos obligations ».
 *
 * Ce module ne CALCULE rien — tout vient de `build-sections.ts`, qui est pur et
 * testé. Ici, on met en forme.
 *
 * Les deux sections n'existent que si leurs données existent : `buildComptes` et
 * `buildObligations` retournent null quand il n'y a rien à dire, et l'assemblage
 * n'écrit alors ni ancre, ni puce dans le rail, ni chapitre. Un rapport sans
 * obligations ne doit pas montrer un chapitre vide.
 */
import type { Comptes, Obligations, LigneObligation, MoisRevenu } from './build-sections';

const NB = ' ';
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-CA')}${NB}$`;
const fmtSigne = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n)).toLocaleString('fr-CA')}${NB}$`;
const fmt1 = (n: number) => n.toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/** Teinte de la pastille fiscale — trois familles, trois couleurs. */
const TEINTE: Record<string, string> = {
  abri: 'ok', reporte: 'att', imposable: 'imp', inconnu: 'neutre',
};
const ETIQUETTE: Record<string, string> = {
  abri: 'À l’abri de l’impôt',
  reporte: 'Impôt reporté',
  imposable: 'Imposable',
  inconnu: 'À confirmer',
};

// ═══════════════════════════════════════════════════════════════════════════
// VOS COMPTES
// ═══════════════════════════════════════════════════════════════════════════

export function comptesHtml(c: Comptes | null): string {
  if (!c || c.lignes.length < 2) return '';   // un seul compte : rien à comparer

  const cartes = c.lignes.map((l) => {
    const signe = l.gain >= 0 ? 'up' : 'down';
    return `
      <div class="cpt" data-fisc="${TEINTE[l.fiscalite]}">
        <div class="cpt-h">
          <span class="cpt-nom">${esc(l.label)}</span>
          <span class="cpt-tag t-${TEINTE[l.fiscalite]}">${ETIQUETTE[l.fiscalite]}</span>
        </div>
        <div class="cpt-val">${fmt(l.valeur)}</div>
        <div class="cpt-part"><i style="--to:${l.part.toFixed(1)}%"></i></div>
        <div class="cpt-lignes">
          <span>Part du portefeuille</span><b>${fmt1(l.part)}${NB}%</b>
          ${l.gain !== 0 ? `<span>Gain non réalisé</span><b class="${signe}">${fmtSigne(l.gain)}${
            l.gainPct != null ? ` <em>(${l.gainPct >= 0 ? '+' : '−'}${fmt1(Math.abs(l.gainPct))}${NB}%)</em>` : ''}</b>` : ''}
          ${l.revenu > 0 ? `<span>Revenu annuel</span><b>${fmt(l.revenu)}</b>` : ''}
          <span>Positions</span><b>${l.titres}</b>
        </div>
        <p class="cpt-fisc">${esc(l.phrase)}</p>
      </div>`;
  }).join('');

  return `
  <div class="sec reveal" id="ch-comptes" data-chap="Vos comptes"><i class="v"></i><h3>Vos comptes</h3><small>le même argent, trois impôts</small></div>
  <div class="card glass reveal-f" data-tilt>
    <span class="sheen"></span>
    <div class="cpt-grille lift-sm">${cartes}</div>
    ${c.gainConnu ? `<div class="cpt-total">
      <span>Gain non réalisé, tous comptes confondus</span>
      <b class="${c.gain >= 0 ? 'up' : 'down'}">${fmtSigne(c.gain)}</b>
    </div>` : ''}
    <p class="cpt-note">Le gain non réalisé est l’écart entre la valeur de marché et la valeur comptable de vos
      positions : c’est un gain sur papier, tant que rien n’est vendu. Les mentions fiscales décrivent le
      traitement usuel de chaque type de compte ; elles ne remplacent pas un avis fiscal tenant compte de
      votre situation.</p>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// VOS OBLIGATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * La frise d'une obligation : des coupons réguliers, puis un dernier versement où
 * le capital s'ajoute au coupon. C'est le dessin classique d'un échéancier
 * obligataire, avec les montants du client plutôt qu'un exemple à 100 $.
 *
 * Les hauteurs sont proportionnelles au montant, avec un plancher : un coupon de
 * 437 $ à côté d'un capital de 25 000 $ ferait une barre d'un pixel, illisible.
 */
function frise(l: LigneObligation): string {
  if (l.flux.length === 0) {
    return `<p class="ob-vide">Échéance non fournie par le relevé : impossible de dessiner l’échéancier.</p>`;
  }
  const max = Math.max(...l.flux.map((f) => f.montant));
  const parAnnee = new Map<number, typeof l.flux>();
  for (const f of l.flux) {
    const list = parAnnee.get(f.annee) ?? [];
    list.push(f);
    parAnnee.set(f.annee, list);
  }
  const annees = [...parAnnee.keys()].sort((a, b) => a - b);
  const anneeCourante = l.flux.find((f) => !f.passe)?.annee ?? annees[0];

  const cellules = annees.map((an) => {
    const flux = (parAnnee.get(an) ?? []).sort((a, b) => a.mois - b.mois);
    // Un mois où le capital ET le coupon tombent : on les empile, capital dessous.
    const groupes = new Map<string, typeof flux>();
    for (const f of flux) {
      const g = groupes.get(f.cle) ?? [];
      g.push(f);
      groupes.set(f.cle, g);
    }
    const piles = [...groupes.values()].map((g) => {
      const capital = g.find((f) => f.type === 'capital');
      const coupon = g.find((f) => f.type === 'coupon');
      const passe = g.every((f) => f.passe);
      const hCap = capital ? Math.max(6, (capital.montant / max) * 100) : 0;
      const hCoup = coupon ? Math.max(6, (coupon.montant / max) * 100) : 0;
      return `<div class="ob-pile${passe ? ' est-passe' : ''}" title="${MOIS_COURT[g[0].mois]} ${g[0].annee}">
          ${coupon ? `<span class="ob-b ob-coup" style="height:${hCoup.toFixed(1)}%"><em>${fmt(coupon.montant)}</em></span>` : ''}
          ${capital ? `<span class="ob-b ob-cap" style="height:${hCap.toFixed(1)}%"><em>${fmt(capital.montant)}</em></span>` : ''}
        </div>`;
    }).join('');
    return `<div class="ob-an${an === anneeCourante ? ' est-ici' : ''}">
        <div class="ob-piles">${piles}</div>
        <div class="ob-lab">${an}</div>
      </div>`;
  }).join('');

  return `
    <div class="ob-frise-cadre">
      <div class="ob-frise">${cellules}</div>
      <div class="ob-marque">
        <span class="ob-fleche" aria-hidden="true"></span>
        <span class="ob-marque-txt">Valeur aujourd’hui <b>${fmt(l.valeur)}</b></span>
      </div>
    </div>
    <p class="ob-lecture">Vous encaissez <b>${fmt(l.couponParVersement)}</b> deux fois par année, puis
      <b>${fmt(l.nominal)}</b> de capital reviennent à l’échéance${l.echeance ? ` (${esc(l.echeance)})` : ''}.
      D’ici là, il reste <b>${fmt(l.totalAVenir)}</b> à recevoir.</p>`;
}

export function obligationsHtml(o: Obligations | null): string {
  if (!o || o.lignes.length === 0) return '';

  const chiffres = [
    ['Valeur', fmt(o.valeur)],
    ['Coupons par année', fmt(o.couponAnnuel)],
    o.rendementMoyen != null ? ['Rendement à l’échéance', `${fmt1(o.rendementMoyen)}${NB}%`] : null,
    o.capital24Mois > 0 ? ['Capital de retour d’ici 24 mois', fmt(o.capital24Mois)] : null,
    o.dureeMoyenne != null ? ['Durée moyenne', `${fmt1(o.dureeMoyenne)} an${o.dureeMoyenne >= 2 ? 's' : ''}`] : null,
  ].filter(Boolean) as [string, string][];

  const rangs = o.lignes.map((l, i) => `
      <div class="ob-ligne">
        <button type="button" class="ob-tete" aria-expanded="false" data-ob="${i}">
          <span class="ob-chev" aria-hidden="true">&#8250;</span>
          <span class="ob-nom"><b>${esc(l.nom)}</b>${l.compte ? `<em>${esc(l.compte)}</em>` : ''}</span>
          <span class="ob-col">${l.tauxCoupon != null ? `${fmt1(l.tauxCoupon)}${NB}%` : '&mdash;'}<i>coupon</i></span>
          <span class="ob-col">${l.echeance ? esc(l.echeance.slice(0, 7)) : '&mdash;'}<i>échéance</i></span>
          <span class="ob-col">${l.rendementEcheance != null ? `${fmt1(l.rendementEcheance)}${NB}%` : '&mdash;'}<i>rendement</i></span>
          <span class="ob-col ob-val">${fmt(l.valeur)}<i>valeur</i></span>
        </button>
        <div class="ob-detail" id="ob-d-${i}" hidden>${frise(l)}</div>
      </div>`).join('');

  return `
  <div class="sec reveal" id="ch-obligations" data-chap="Vos obligations"><i class="b"></i><h3>Vos obligations</h3><small>cliquez une obligation pour voir son échéancier</small></div>
  <div class="card glass reveal-f" data-tilt>
    <span class="sheen"></span>
    <div class="ob-chiffres lift-sm">
      ${chiffres.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}
    </div>
    <div class="ob-liste lift-sm">${rangs}</div>
    <p class="cpt-note">Le rendement à l’échéance suppose que vous gardez l’obligation jusqu’au bout et que
      l’émetteur paie tout ce qu’il doit. Les coupons sont présentés semestriellement, calés sur le mois
      d’échéance — la date exacte peut varier de quelques jours.</p>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PANNEAU D'UN MOIS DE REVENU (couverture)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * L'îlot de données des douze mois. Le texte des étapes voyage tel quel : il est
 * écrit et testé dans `build-sections.ts`, et ce qui est testé doit être ce qui
 * est livré. Le dédoublonner ici pour gagner quelques kilo-octets, ce serait
 * livrer un texte que rien ne vérifie.
 */
export function moisIsland(mois: MoisRevenu[]): string {
  const BS = String.fromCharCode(92);
  const json = JSON.stringify(mois)
    .replace(/</g, BS + 'u003c')
    .split(String.fromCharCode(0x2028)).join(BS + 'u2028')
    .split(String.fromCharCode(0x2029)).join(BS + 'u2029');
  return `<script type="application/json" id="mois-data">${json}</script>`;
}

/** La coquille du panneau — son contenu est écrit par le script au clic. */
export function moisPanneauHtml(): string {
  return `
      <div class="mois-p" id="mois-p" hidden>
        <button type="button" class="mois-x" id="mois-x" aria-label="Fermer">&times;</button>
        <p class="mois-t" id="mois-t"></p>
        <div class="mois-chiffres" id="mois-c"></div>
        <ol class="mois-etapes" id="mois-e"></ol>
      </div>`;
}
