// LES VIREMENTS INTERNES — étape 4 : relier les deux jambes d'un mouvement
// entre comptes, quand le livre les porte toutes les deux (20 août 2026).
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE LA MESURE A ÉTABLI (docs/mesure-virements-internes-2026-08-20.md,
// 28 virements internes CELI de la base locale) :
//
//   · 28/28 citent un compte dans leur note — la règle 3 fait son travail ;
//   · 26/28 nomment un compte dont le régime est PROUVÉ, et c'est un CELI ;
//   · mais **2/28 seulement** ont une contrepartie dans le livre du client
//     (autre compte, signe opposé, même |montant|, même devise, même jour) ;
//   · élargir à ±3 jours n'en ajoute AUCUNE : la fenêtre ne sert à rien ici ;
//   · 0/28 ont une contrepartie DU RÉGIME que la note nomme.
//
// LA CONSÉQUENCE, ET C'EST LA DÉCISION CENTRALE DE CE MODULE : une note qui
// nomme un CELI ne prouve PAS un transfert direct. Elle prouve qu'un compte
// CELI est impliqué — pas qu'il appartient au MÊME TITULAIRE. Or la différence
// est fiscale et lourde :
//
//     CELI → CELI du même titulaire   transfert direct, aucun droit consommé
//     CELI → CELI du conjoint         RETRAIT, puis un don ; les droits du
//                                     titulaire reviennent l'année suivante
//
// Croesus n'écrit nulle part à qui appartient le compte cité. Le SEUL fait qui
// tranche est la présence de l'autre jambe DANS LE LIVRE DU CLIENT — notre
// livre est par client, donc une contrepartie appariée prouve le même
// titulaire. Sans elle, la destination reste À CONFIRMER.
//
// C'est pourquoi ce module ne rend « ferme » que les relations APPARIÉES, et
// laisse les 26 orphelines en `indetermine` — avec leur régime nommé, pour que
// le planificateur sache exactement quelle question poser. Inventer le lien
// aurait fabriqué 26 transferts directs, donc 26 fois zéro droit recréé, sur
// des mouvements dont une partie sont peut-être de vrais retraits.
//
// CE QUE CE MODULE NE FAIT PAS : aucun calcul de droits ; aucune fenêtre de
// jours (mesurée inutile) ; aucun rapprochement par montant seul (une note
// muette ne suffit pas — §K de la consigne) ; aucune réutilisation d'une ligne
// déjà consommée par le FX ou par la règle 2 (invariant d'unicité, testé).
// ─────────────────────────────────────────────────────────────────────────────

import { typeDeCompte } from '@/lib/parseur-croesus/types';
import { compteCiteDansNote } from '@/lib/parseur-croesus/regles';
import { normaliserLibelle } from './flux';
import type { EvenementFlux } from './ligne-du-temps';

/**
 * LE SENS QUE LE LIBELLÉ ANNONCE — et que le montant doit confirmer.
 *
 * ⚠ AJOUTÉ LE 20 AOÛT 2026 APRÈS UNE RÉGRESSION MESURÉE. La comparaison
 * ancien ↔ nouveau sur la base réelle a sorti UNE divergence de classe
 * `regression`, et elle était réelle : une ligne dont le libellé dit
 * « Retrait » mais dont le montant est POSITIF devenait une `cotisation-celi`
 * FERME dès qu'une contrepartie l'appariait. Or `classerLigne` dit exactement
 * le contraire d'une telle ligne quand aucune note ne la couvre — « retrait en
 * argent à montant non négatif : renversement ou correction à rapprocher ».
 *
 * Une ligne qui se contredit elle-même ne peut pas fonder un montant ferme :
 * libellé et signe doivent concorder, sinon la relation reste `indetermine`.
 * C'est le §16 appliqué à la lettre — une divergence sur un cas propre est une
 * régression jusqu'à preuve du contraire, et ici la preuve donnait tort au
 * nouveau code.
 */
const SENS_ANNONCE: Record<string, 'entree' | 'sortie'> = {
  cotisation: 'entree', depot: 'entree', reception: 'entree',
  retrait: 'sortie',
};

/** L'effet FISCAL d'un mouvement, vu du CELI. */
export type EffetVirement =
  | 'cotisation-celi'         // de l'argent ou des titres ENTRENT dans le CELI depuis un compte du même titulaire
  | 'retrait-celi'            // ils en SORTENT vers un compte non enregistré du même titulaire
  | 'transfert-direct-celi'   // CELI → CELI du même titulaire : aucun droit consommé ni recréé
  | 'transfert-regime'        // CELI ↔ un AUTRE régime enregistré (REER, CELIAPP…) — hors périmètre de ce lot
  | 'indetermine';            // la destination n'est pas prouvée : à confirmer, jamais deviné

/**
 * UNE relation économique — les deux effets fiscaux d'un même mouvement
 * pointent vers elle (§9). `jambeContrepartieId` est `null` quand le livre ne
 * porte qu'un côté : la relation existe quand même, et se déclare orpheline.
 */
export type RelationVirement = {
  id: number;
  /** La jambe qui est dans le CELI (celle qui nous intéresse fiscalement). */
  jambeCeliId: number;
  /** L'autre jambe, APPARIÉE dans le livre — `null` si orpheline. */
  jambeContrepartieId: number | null;
  sens: 'entree' | 'sortie';
  regimeSource: string | null;
  regimeDestination: string | null;
  /** Le régime que la NOTE nomme — une piste, jamais une preuve de titulaire. */
  regimeCiteParLaNote: string | null;
  /** La grandeur du mouvement, dans SA devise — jamais convertie. */
  montant: number;
  devise: string;
  effet: EffetVirement;
  confiance: 'confirme' | 'eleve' | 'ambigu';
  motif: string;
};

export type ResultatVirements = {
  relations: RelationVirement[];
  /** id d'événement → id de relation. Une jambe appartient à AU PLUS une relation. */
  parJambe: Map<number, number>;
};

const REGIMES_ENREGISTRES = new Set(['celi', 'celiapp', 'reer', 'reer-conjoint', 'reee', 'ferr', 'frv', 'cri']);

/** L'effet fiscal d'une relation APPARIÉE, déduit des deux régimes et du sens. */
function effetDe(regimeCeli: string, autre: string | null, sens: 'entree' | 'sortie'): { effet: EffetVirement; motif: string } {
  if (autre === null) {
    return { effet: 'indetermine', motif: 'la contrepartie appariée est sur un compte au régime non prouvé — la nature du mouvement ne se déduit pas' };
  }
  if (autre === 'celi') {
    // §3 : JAMAIS retrait + cotisation. Un transfert direct CELI→CELI du même
    // titulaire ne consomme ni ne recrée aucun droit.
    return {
      effet: 'transfert-direct-celi',
      motif: 'transfert direct entre deux CELI du même titulaire (les deux jambes sont dans le livre) — aucun droit consommé ni recréé',
    };
  }
  if (autre === 'non-enregistre') {
    return sens === 'entree'
      ? { effet: 'cotisation-celi', motif: 'entrée dans le CELI depuis un compte non enregistré du même titulaire — cotisation ferme ; l’autre jambe est un retrait de capital' }
      : { effet: 'retrait-celi', motif: 'sortie du CELI vers un compte non enregistré du même titulaire — retrait ferme ; l’autre jambe est un apport de capital' };
  }
  if (REGIMES_ENREGISTRES.has(autre)) {
    // CELIAPP, REER, FERR… — un régime enregistré n'est PAS un CELI (Q = CELIAPP).
    return {
      effet: 'transfert-regime',
      motif: `mouvement entre le CELI et un ${autre} du même titulaire — ce n’est pas un transfert direct entre CELI ; l’effet sur les droits de chaque régime est hors du périmètre de ce lot`,
    };
  }
  return { effet: 'indetermine', motif: `contrepartie dans un régime « ${autre} » que ce module ne sait pas nommer` };
}

/**
 * Rapproche les virements internes d'un lot d'événements.
 *
 * `disposes` : les ids déjà consommés (jambes FX, jambes de partie double,
 * agrégats fermes). Ils ne peuvent PAS être réutilisés — c'est l'invariant
 * d'unicité (§10), et il est testé de l'extérieur.
 *
 * LA PREUVE EXIGÉE POUR APPARIER, telle que mesurée : autre compte, signe
 * opposé, |montant| égal (±0,02), même devise, MÊME JOUR, et unique DES DEUX
 * CÔTÉS. Aucune fenêtre de jours : la mesure a montré qu'elle n'apporte rien.
 * Aucun appariement sur le seul montant : sans note qui cite un compte, deux
 * mouvements du même jour peuvent n'avoir aucun rapport.
 */
export function rapprocherVirements(
  evenements: EvenementFlux[],
  disposes: ReadonlySet<number>
): ResultatVirements {
  const relations: RelationVirement[] = [];
  const parJambe = new Map<number, number>();

  const candidatesCeli = evenements.filter((ev) =>
    ev.nature === 'virement-interne' && ev.regime === 'celi'
    && ev.montant !== null && ev.montant !== 0 && !disposes.has(ev.id));

  for (const ev of candidatesCeli) {
    if (parJambe.has(ev.id)) continue;
    const montant = ev.montant as number;
    const sens: 'entree' | 'sortie' = montant > 0 ? 'entree' : 'sortie';
    const cite = compteCiteDansNote(ev.source.note ?? '');
    const regimeCiteParLaNote = cite ? typeDeCompte(cite) : null;

    // Les contreparties possibles : LE MÊME MOUVEMENT, vu de l'autre compte.
    const contreparties = evenements.filter((x) =>
      x.id !== ev.id && !disposes.has(x.id) && !parJambe.has(x.id)
      && x.compte !== ev.compte
      && x.devise === ev.devise
      && x.date === ev.date
      && x.montant !== null
      && Math.abs(x.montant + montant) <= 0.02);

    // LE LIBELLÉ ET LE SIGNE DOIVENT CONCORDER (voir SENS_ANNONCE).
    const sensAnnonce = SENS_ANNONCE[normaliserLibelle(ev.source.type)];
    const seContredit = sensAnnonce !== undefined && sensAnnonce !== sens;

    const base = {
      id: relations.length,
      jambeCeliId: ev.id,
      sens,
      regimeCiteParLaNote,
      montant: Math.abs(montant),
      devise: ev.devise,
    };

    if (contreparties.length === 1) {
      // L'unicité doit tenir DANS LES DEUX SENS : si une autre jambe CELI non
      // encore reliée peut réclamer la même contrepartie, personne n'est apparié.
      const y = contreparties[0];
      const rivales = candidatesCeli.filter((z) =>
        z.id !== ev.id && !parJambe.has(z.id) && z.compte !== y.compte
        && z.devise === y.devise && z.date === y.date
        && z.montant !== null && y.montant !== null && Math.abs(z.montant + y.montant) <= 0.02);
      if (rivales.length > 0) {
        relations.push({
          ...base, jambeContrepartieId: null, regimeSource: null, regimeDestination: null,
          effet: 'indetermine', confiance: 'ambigu',
          motif: `contrepartie possible mais ${1 + rivales.length} jambes CELI la réclament le même jour — indécidable sans preuve supplémentaire`,
        });
        parJambe.set(ev.id, relations.length - 1);
        continue;
      }
      const autre = typeDeCompte(y.compte);
      if (seContredit) {
        relations.push({
          ...base, jambeContrepartieId: y.id,
          regimeSource: sens === 'entree' ? autre : 'celi',
          regimeDestination: sens === 'entree' ? 'celi' : autre,
          effet: 'indetermine', confiance: 'ambigu',
          motif: `le libellé « ${ev.source.type} » annonce une ${sensAnnonce}, le montant dit le contraire — renversement ou correction probable : une ligne qui se contredit ne fonde aucun montant ferme, même appariée`,
        });
        parJambe.set(ev.id, relations.length - 1);
        parJambe.set(y.id, relations.length - 1);
        continue;
      }
      const { effet, motif } = effetDe('celi', autre, sens);
      // La note CONFIRME-t-elle la contrepartie trouvée ? Quand les deux
      // preuves concordent, c'est le seul cas « confirmé » de ce module.
      const concordante = regimeCiteParLaNote !== null && autre !== null && regimeCiteParLaNote === autre;
      relations.push({
        ...base,
        jambeContrepartieId: y.id,
        regimeSource: sens === 'entree' ? autre : 'celi',
        regimeDestination: sens === 'entree' ? 'celi' : autre,
        effet,
        confiance: effet === 'indetermine' ? 'ambigu' : concordante ? 'confirme' : 'eleve',
        motif: concordante
          ? `${motif} — la note nomme bien un compte ${autre}`
          : `${motif} — la note ${regimeCiteParLaNote ? `nomme un compte ${regimeCiteParLaNote}, pas ${autre}` : 'ne nomme aucun compte au régime prouvé'} : appariement retenu sur la contrepartie, jamais « confirmé » sans concordance`,
      });
      parJambe.set(ev.id, relations.length - 1);
      parJambe.set(y.id, relations.length - 1);
      continue;
    }

    if (contreparties.length > 1) {
      relations.push({
        ...base, jambeContrepartieId: null, regimeSource: null, regimeDestination: null,
        effet: 'indetermine', confiance: 'ambigu',
        motif: `${contreparties.length} contreparties possibles le même jour — appariement indécidable ; en choisir une serait inventer la relation`,
      });
      parJambe.set(ev.id, relations.length - 1);
      continue;
    }

    // ORPHELINE — le cas le plus fréquent (26/28 mesurés). La note nomme un
    // compte, mais rien ne dit à QUI il appartient : un CELI de conjoint est un
    // retrait, un CELI du titulaire est un transfert direct. On ne tranche pas.
    relations.push({
      ...base, jambeContrepartieId: null,
      regimeSource: sens === 'entree' ? regimeCiteParLaNote : 'celi',
      regimeDestination: sens === 'entree' ? 'celi' : regimeCiteParLaNote,
      effet: 'indetermine', confiance: 'ambigu',
      motif: regimeCiteParLaNote === null
        ? 'la note cite un compte dont le régime n’est pas prouvé, et aucune jambe du livre ne lui correspond — destination inconnue'
        : `la note nomme un compte ${regimeCiteParLaNote}, mais aucune jambe correspondante n’est dans le livre : rien ne prouve qu’il appartient au même titulaire${regimeCiteParLaNote === 'celi' ? ' — un CELI de conjoint ferait un RETRAIT, pas un transfert direct' : ''}. À confirmer.`,
    });
    parJambe.set(ev.id, relations.length - 1);
  }

  return { relations, parJambe };
}
