// LA LIGNE DU TEMPS DES FLUX — la comptabilité événementielle intermédiaire.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE MODULE EST (19 août 2026, étapes 5-6 du plan).
//
//   transaction brute → événement économique compris → agrégat annuel
//
// Chaque LigneTransaction du livre devient EXACTEMENT UN événement, avec sa
// nature (classerLigne + rapprocherConversions), sa confiance, son motif et sa
// source. Les événements s'agrègent ensuite par année × régime × devise — et
// chaque agrégat garde les identifiants de ses événements : un montant qui ne
// peut pas dire d'où il vient n'existe pas ici.
//
// LA PRIORITÉ EST LA TRAÇABILITÉ, PAS LA QUANTITÉ DE CHIFFRES. Un agrégat vide
// est un Record sans clé de devise — jamais un zéro qui se ferait passer pour
// une donnée établie. Les ambigus et les inconnus sont des COLLECTIONS, pas des
// pertes silencieuses : l'invariant de partition (diagnostics) garantit que
// lues = conversions + agrégés + hors-flux + virements + ambigus + inconnus +
// non-agrégés, et un test le tient.
//
// CE QUE CE MODULE RÉUTILISE — jamais de seconde implémentation d'une règle :
//   · rapprocherConversions()      les paires FX-1/FX-2 mesurées (étape 3) ;
//   · classerLigne()               la nature ligne-seule (étape 2) ;
//   · separerCotisations()         la règle 2/5 — l'ARGENT NEUF et ses lignes
//                                  sources (champ lignesArgentNeuf, ajouté
//                                  additivement pour la traçabilité) ;
//   · beneficiaireReeeDeLaNote()   la MÊME regex que cotisationsReeeParEnfant.
//
// POURQUOI LES COTISATIONS PASSENT PAR separerCotisations ET PAS PAR LA SOMME
// DES ÉVÉNEMENTS « cotisation » : la partie double (règle 2). Une cotisation en
// nature s'écrit deux fois — jambe argent, jambe titre — et la jambe argent
// appariée N'EST PAS de l'argent neuf. `classerLigne` lue seule ne peut pas le
// savoir (elle le dit : « provisoire : la règle 2 vérifie » ) ; additionner ses
// « cotisation/eleve » DOUBLERAIT les apports en nature. La somme ferme vient
// donc de la règle, ligne par ligne tracée ; l'événement garde sa nature
// provisoire pour l'audit.
//
// CE QUI EST VOLONTAIREMENT ABSENT :
//   · la double lecture des virements internes (E→W = retrait-capital +
//     cotisation liés) : elle exige le rapprochement des DEUX jambes — étape 4,
//     non faite. Les virements internes sont une collection à part, comptés,
//     tracés, JAMAIS agrégés en flux externes ;
//   · ferr.transitions : rien ne produit encore `transfert-regime` (le
//     rapprochement REER→FERR est hors périmètre mesuré). Pas de champ qui
//     serait toujours vide — un 0 permanent finirait par passer pour une donnée ;
//   · toute neutralisation `annule` (0 type correctif mesuré dans la base).
//
// LES CUMULATIFS COMPTENT DEPUIS LE DÉBUT DE L'HISTORIQUE DISPONIBLE — jamais
// « depuis toujours ». La portée le dit : `interne-seulement` quand il y a des
// lignes, `inconnue` quand il n'y en a pas. Ce n'est PAS le dossier ARC.
// ─────────────────────────────────────────────────────────────────────────────

import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import { typeDeCompte } from '@/lib/parseur-croesus/types';
import { separerCotisations } from '@/lib/parseur-croesus/regles';
import { classerLigne, cleLibelleInconnu, type Confiance, type NatureFlux, type ImpactCompletude } from './flux';
import { rapprocherVirements, type RelationVirement } from './virements-internes';
import { rapprocherEcrituresComptables, type GroupeEcritures } from './ecritures-comptables';
import { rapprocherConversions, type PaireConversion } from './rapprochement';
import { beneficiaireReeeDeLaNote } from './deriver';
import type { Portee } from './types';

// ═══ LES TYPES ═══════════════════════════════════════════════════════════════

/** Un événement économique : UNE transaction source, comprise. */
export type EvenementFlux = {
  /** Identifiant stable dans ce lot : l'indice de la ligne dans l'entrée. */
  id: number;
  date: string;
  annee: string;
  compte: string;
  regime: string | null;
  /** La devise de la LIGNE — les agrégats ne mélangent jamais deux devises. */
  devise: string;
  nature: NatureFlux;
  confiance: Confiance;
  /** Ce que la ligne pourrait encore changer dans un chiffre fiscal (voir flux.ts). */
  impactCompletude: ImpactCompletude;
  montant: number | null;
  /** REEE seulement — la note nomme le bénéficiaire, ou personne. */
  beneficiaire: string | null;
  motif: string;
  source: LigneTransaction;
};

/**
 * CE QU'EST DEVENUE CHAQUE LIGNE — la partition. Chaque événement a UNE
 * disposition, et leur somme vaut le nombre de lignes lues (invariant testé).
 */
export type Disposition =
  | 'conversion'                 // jambe d'une paire FX-1/FX-2
  | 'agrege'                     // compté dans un agrégat ferme (cotisation, retrait, apport, retrait de capital)
  | 'hors-flux'                  // opération sur titre, revenu : pas un flux de capital — exclusion justifiée
  | 'virement-interne'           // détecté par la note (règle 3/5) — la double lecture attend l'étape 4
  | 'ambigu'                     // on SAIT qu'on ne sait pas — collection dédiée
  | 'inconnu'                    // libellé hors liste blanche — diagnostic
  | 'non-agrege'                 // flux compris mais sans agrégat ferme (ex. cotisation à confiance dégradée)
  | 'consommee-partie-double';   // jambe TITRE d'un apport en nature COMPTÉ (règle 2) — expliquée, jamais une ambiguïté résiduelle (20 août 2026)

/** Un montant ferme, dans UNE devise, avec ses sources. */
export type Agregat = {
  montant: number;
  devise: string;
  /** Les ids d'événements qui composent EXACTEMENT ce montant. */
  sources: number[];
};

/** Par devise : `{}` = aucun événement (pas un zéro connu — rien de détecté). */
export type ParDevise = Record<string, Agregat>;

export type FluxRegime = { cotisations: ParDevise; retraits: ParDevise };

/** Une conversion, telle qu'elle paraît dans la timeline. */
export type ConversionTimeline = {
  date: string;
  /** La racine du compte, PAS le numéro complet : « 37-XXXX ». */
  famille: string;
  jambeCadId: number;
  jambeUsdId: number;
  montantCad: number;
  montantUsd: number;
  ratio: number;
  tauxNote: number | null;
  confiance: 'confirme' | 'eleve';
  motif: string;
};

export type AnneeLigneDuTemps = {
  celi: FluxRegime;
  celiapp: FluxRegime;
  reer: FluxRegime;
  /** VMBL lettre S — valeur hors TypeCompte, tolérée par Compte.type ; jamais fondue dans reer. */
  reerConjoint: FluxRegime;
  reee: {
    /** Cotisations par bénéficiaire nommé dans la note ; « (inconnu) » quand elle ne nomme personne — jamais réparti. */
    parBeneficiaire: Record<string, ParDevise>;
    retraits: ParDevise;
  };
  /** Régimes de DÉCAISSEMENT : retraits seulement. Une « cotisation » y est ambiguë (jamais agrégée). */
  ferr: { retraits: ParDevise };
  frv: { retraits: ParDevise };
  cri: { retraits: ParDevise };
  nonEnregistre: {
    apportsCapital: ParDevise;
    retraitsCapital: ParDevise;
    conversionsDevise: ConversionTimeline[];
  };
};

export type DiagnosticsLigneDuTemps = {
  lignesLues: number;
  pairesFxConfirmees: number;
  pairesFxElevees: number;
  /** La partition : Σ des valeurs === lignesLues (invariant testé). */
  dispositions: Record<Disposition, number>;
  lignesSansRegime: number;
  /** Libellés hors liste blanche, normalisés, comptés — jamais une donnée client. */
  libellesInconnus: Record<string, number>;
};

export type LigneDuTemps = {
  parAnnee: Record<string, AnneeLigneDuTemps>;
  /**
   * CUMULS DEPUIS LE DÉBUT DE L'HISTORIQUE DISPONIBLE — pas « depuis
   * toujours », et surtout pas le dossier ARC. CELI, REER et REEE seulement :
   * les régimes où le cumul nourrit un raisonnement de droits.
   */
  cumulatifs: Record<string, {
    celi: FluxRegime;
    reer: FluxRegime;
    reee: { parBeneficiaire: Record<string, ParDevise> };
  }>;
  /** Tous les événements, dans l'ordre des lignes d'entrée — l'audit complet. */
  evenements: EvenementFlux[];
  /** Ce qui attend une confirmation humaine — jamais additionné à un montant ferme. */
  ambigus: EvenementFlux[];
  /** Les libellés que la liste blanche refuse — visibles, comptés, jamais perdus. */
  inconnus: EvenementFlux[];
  /** Détectés par la note (règle 3/5) — reliés à leur contrepartie quand le livre la porte (étape 4). */
  virementsInternes: EvenementFlux[];
  /**
   * LES RELATIONS ÉCONOMIQUES des virements internes (étape 4, 20 août 2026).
   * Une relation par mouvement ; ses deux jambes y pointent. Orpheline quand le
   * livre ne porte qu'un côté — et alors `effet: 'indetermine'`, jamais deviné.
   */
  relationsVirements: RelationVirement[];
  /** id d'événement → id de relation. Une jambe appartient à AU PLUS une relation. */
  relationParJambe: Map<number, number>;
  /**
   * LES ÉCRITURES « Valeur comptable », groupées par compte × jour (20 août
   * 2026). Un groupe ÉQUILIBRÉ ne déplace aucune valeur : ses lignes sont
   * prouvées inoffensives — pas comprises, INOFFENSIVES. Un groupe qui ne
   * s'annule pas laisse un mouvement réel, et reste bloquant.
   */
  groupesEcritures: GroupeEcritures[];
  /** Les écritures d'un groupe équilibré — visibles, comptées, sans impact. */
  ecrituresEquilibrees: EvenementFlux[];
  /**
   * Les jambes TITRE consommées par la règle 2 pour un apport COMPTÉ — des
   * lignes EXPLIQUÉES, visibles, jamais recomptées ni laissées « ambiguës »
   * (20 août 2026 : le faux rouge de la complétude venait d'ici).
   */
  consommesPartieDouble: EvenementFlux[];
  /** La traçabilité des apports en nature comptés : jambe argent (comptée) ↔ jambe titre (consommée). */
  partiesDoubles: Array<{ jambeArgentId: number; jambeTitreId: number }>;
  diagnostics: DiagnosticsLigneDuTemps;
  /** `interne-seulement` dès qu'il y a des lignes : c'est NOTRE livre, pas l'ARC. */
  portee: Portee;
};

// ═══ OUTILS ══════════════════════════════════════════════════════════════════

const BENEFICIAIRE_INCONNU = '(inconnu)';

const fluxRegimeVide = (): FluxRegime => ({ cotisations: {}, retraits: {} });
const anneeVide = (): AnneeLigneDuTemps => ({
  celi: fluxRegimeVide(), celiapp: fluxRegimeVide(), reer: fluxRegimeVide(), reerConjoint: fluxRegimeVide(),
  reee: { parBeneficiaire: {}, retraits: {} },
  ferr: { retraits: {} }, frv: { retraits: {} }, cri: { retraits: {} },
  nonEnregistre: { apportsCapital: {}, retraitsCapital: {}, conversionsDevise: [] },
});

/** Ajoute un montant à un agrégat par devise — chaque devise reste la sienne. */
function ajouter(par: ParDevise, devise: string, montant: number, id: number): void {
  const d = (devise || 'CAD').toUpperCase();
  if (!par[d]) par[d] = { montant: 0, devise: d, sources: [] };
  // ARRONDI AU CENT à chaque addition : les flottants d'un livre de 20 ans
  // finissent par traîner des décimales fantômes (vu sur le REEE, 12 août).
  par[d].montant = Math.round((par[d].montant + montant) * 100) / 100;
  par[d].sources.push(id);
}

const CLES_REGIME: Record<string, 'celi' | 'celiapp' | 'reer' | 'reerConjoint'> = {
  celi: 'celi', celiapp: 'celiapp', reer: 'reer', 'reer-conjoint': 'reerConjoint',
};
const DECAISSEMENT: Record<string, 'ferr' | 'frv' | 'cri'> = { ferr: 'ferr', frv: 'frv', cri: 'cri' };

// ═══ LA CONSTRUCTION ═════════════════════════════════════════════════════════

/**
 * Construit la ligne du temps d'un lot de transactions.
 *
 * Le pipeline, dans l'ordre — et l'ordre commande :
 *   1. rapprocherConversions()  — les paires FX se réservent leurs jambes AVANT
 *      que quiconque ne les fige dans une autre nature (une jambe consommée ne
 *      redevient JAMAIS cotisation, retrait ou apport — invariant testé) ;
 *   2. classement ligne-seule du reste (déjà fait par rapprocherConversions,
 *      qui rend les deux) ;
 *   3. l'ARGENT NEUF des régimes cotisables par separerCotisations, compte par
 *      compte, année par année — la règle 2/5, avec ses lignes sources ;
 *   4. agrégation par année × régime × devise ;
 *   5. cumulatifs, collections (ambigus, inconnus, virements), diagnostics.
 */
export function construireLigneDuTemps(lignes: LigneTransaction[]): LigneDuTemps {
  const { paires, classees } = rapprocherConversions(lignes);

  // ── les événements : un par ligne, id = indice d'entrée ─────────────────────
  const evenements: EvenementFlux[] = classees.map((c, id) => ({
    id,
    date: c.source.date,
    annee: c.source.date.slice(0, 4),
    compte: c.source.noCompte,
    regime: c.regime,
    devise: (c.source.devise || 'CAD').toUpperCase(),
    nature: c.nature,
    confiance: c.confiance,
    impactCompletude: c.impactCompletude,
    montant: c.source.total,
    beneficiaire: c.regime === 'reee' ? beneficiaireReeeDeLaNote(c.source.note) : null,
    motif: c.motif,
    source: c.source,
  }));
  const idDe = new Map<LigneTransaction, number>();
  lignes.forEach((l, i) => { if (!idDe.has(l)) idDe.set(l, i); });

  const parAnnee: Record<string, AnneeLigneDuTemps> = {};
  const anneeDe = (a: string): AnneeLigneDuTemps => (parAnnee[a] ??= anneeVide());
  const disposition = new Map<number, Disposition>();

  // ── 1 · les conversions (déjà réservées par le rapprochement) ───────────────
  let fxConfirmees = 0, fxElevees = 0;
  for (const p of paires) {
    const idCad = idDe.get(p.jambeCad)!;
    const idUsd = idDe.get(p.jambeUsd)!;
    disposition.set(idCad, 'conversion');
    disposition.set(idUsd, 'conversion');
    if (p.confiance === 'confirme') fxConfirmees++; else fxElevees++;
    const famille = p.jambeCad.noCompte.replace(/-[0-9A-Z]$/i, '').replace(/^(..)-?(....).*$/i, '$1-XXXX');
    anneeDe(p.jambeCad.date.slice(0, 4)).nonEnregistre.conversionsDevise.push({
      date: p.jambeCad.date,
      famille,
      jambeCadId: idCad, jambeUsdId: idUsd,
      // Chaque jambe garde SON montant dans SA devise — jamais additionnés.
      montantCad: p.jambeCad.total as number,
      montantUsd: p.jambeUsd.total as number,
      ratio: p.ratio, tauxNote: p.tauxNote, confiance: p.confiance, motif: p.motif,
      // Le flux externe consolidé d'une conversion est ZÉRO par construction :
      // rien n'est ajouté à apportsCapital ni retraitsCapital.
    });
  }

  // ── 2 · l'ARGENT NEUF des régimes cotisables — CHAQUE régime garde SA règle ──
  //
  // CELI / CELIAPP / REER : la règle 2/5 (`separerCotisations`), compte par
  // compte, année par année — exactement le découpage de deriverCeliParAnnee,
  // pour que les deux systèmes soient comparables au dollar près.
  //
  // REEE : la règle HISTORIQUE de cotisationsReeeParEnfant — les lignes
  // `Cotisation` OU `Dépôt` à montant positif, bénéficiaire lu dans la note.
  // Le REEE n'est jamais passé par la règle 2 dans ce dépôt, et la parité l'a
  // prouvé le 19 août : un « Dépôt » REEE comptait dans l'ancien et pas dans
  // une première version de cette timeline qui uniformisait à tort. Un régime,
  // une règle, la SIENNE.
  const cotisables = new Set(['celi', 'celiapp', 'reer', 'reer-conjoint']);
  const parCompteAnnee = new Map<string, LigneTransaction[]>();
  for (const l of lignes) {
    const id = idDe.get(l)!;
    if (disposition.has(id)) continue;                 // une jambe FX ne se réutilise pas
    const regime = typeDeCompte(l.noCompte);
    if (!regime) continue;
    if (regime === 'reee') {
      // La règle REEE, ligne par ligne (miroir de cotisationsReeeParEnfant, plus
      // le seau « (inconnu) » — divergence D3, documentée et voulue).
      //
      // MAIS l'ÉVÉNEMENT a le dernier mot — contre-expertise du 19 août :
      //   · une note de SUBVENTION (SCEE/IQEE) rend la ligne ambiguë — ce n'est
      //     pas l'argent du client, elle ne consomme pas le plafond : jamais
      //     sommée ferme (l'ancien la JETTE ; divergence D5) ;
      //   · une note qui CITE UN COMPTE (règle 5) fait un virement interne — pas
      //     de l'argent neuf (l'ancien l'attribuait à un enfant nommé « REF » ;
      //     divergence D6).
      const evReee = evenements[id];
      if (evReee.nature === 'cotisation' && evReee.confiance === 'eleve'
        && (l.type === 'Cotisation' || l.type === 'Dépôt') && (l.total ?? 0) > 0) {
        const benef = beneficiaireReeeDeLaNote(l.note) ?? BENEFICIAIRE_INCONNU;
        const a = anneeDe(l.date.slice(0, 4));
        a.reee.parBeneficiaire[benef] ??= {};
        ajouter(a.reee.parBeneficiaire[benef], (l.devise || 'CAD').toUpperCase(), l.total as number, id);
        disposition.set(id, 'agrege');
      }
      continue;
    }
    if (!cotisables.has(regime)) continue;
    const cle = `${l.noCompte}|${l.date.slice(0, 4)}`;
    if (!parCompteAnnee.has(cle)) parCompteAnnee.set(cle, []);
    parCompteAnnee.get(cle)!.push(l);
  }
  const partiesDoubles: Array<{ jambeArgentId: number; jambeTitreId: number }> = [];
  for (const [cle, ls] of parCompteAnnee) {
    const annee = cle.slice(-4);
    const regime = typeDeCompte(ls[0].noCompte)!;
    const { lignesArgentNeuf, pairesArgentNeuf } = separerCotisations(ls);
    for (const l of lignesArgentNeuf) {
      const id = idDe.get(l)!;
      const ev = evenements[id];
      ajouter(anneeDe(annee)[CLES_REGIME[regime]].cotisations, ev.devise, l.total as number, id);
      disposition.set(id, 'agrege');
    }
    // LA JAMBE TITRE D'UN APPORT COMPTÉ EST EXPLIQUÉE — pas ambiguë (20 août).
    // Sans cette disposition, elle retombait à l'étape 3 en « ambigu » (signe
    // négatif) ou « non-agrege », et la complétude de la vue fiscale — comme la
    // limitation « evenements-ambigus » du signal de maximisation — virait au
    // rouge au-dessus d'un apport parfaitement compris par la règle 2. Une
    // ligne, UNE disposition : consommée ici, elle ne réapparaît nulle part.
    // (Aucune collision FX possible : les jambes de la règle 2 sont de type
    // « Cotisation », les jambes FX de type « Transfert »/« Réception », et le
    // groupement ci-dessus exclut déjà toute ligne disposée.)
    for (const p of pairesArgentNeuf) {
      const idTitre = idDe.get(p.jambeTitre)!;
      const idArgent = idDe.get(p.jambeArgent)!;
      if (disposition.get(idTitre) === 'consommee-partie-double') continue;   // garde : jamais deux fois
      disposition.set(idTitre, 'consommee-partie-double');
      partiesDoubles.push({ jambeArgentId: idArgent, jambeTitreId: idTitre });
      evenements[idTitre].motif =
        `jambe titre d'un apport en nature COMPTÉ (règle 2) — consommée, le montant est porté par la jambe argent #${idArgent}`;
    }
  }

  // ── 2bis · LES VIREMENTS INTERNES, reliés à leur contrepartie (étape 4) ─────
  // APRÈS le FX et la règle 2 : une jambe déjà consommée ne peut pas être
  // réutilisée (invariant d'unicité §10, testé de l'extérieur). La mesure du
  // 20 août commande la prudence : 28/28 citent un compte, mais 2/28 seulement
  // ont une contrepartie dans le livre — et une note qui nomme un CELI ne dit
  // pas à QUI il appartient. Les orphelines restent donc `indetermine`.
  const { relations: relationsVirements, parJambe: relationParJambe } =
    rapprocherVirements(evenements, new Set(disposition.keys()));

  // ── 2ter · LES ÉCRITURES « VALEUR COMPTABLE » ÉQUILIBRÉES ───────────────────
  // Mesuré : 15 des 17 groupes (compte × jour) s'annulent entre eux. Quand
  // c'est le cas, aucune valeur n'est entrée ni sortie du compte ce jour-là —
  // ces lignes ne peuvent donc modifier ni cotisation ni retrait. Elles restent
  // `inconnu` (on ignore toujours ce que le libellé SIGNIFIE) mais leur impact
  // tombe à « aucun » : c'est une preuve d'innocuité, pas une compréhension.
  const { groupes: groupesEcritures, equilibrees } =
    rapprocherEcrituresComptables(evenements, new Set(disposition.keys()));
  for (const id of equilibrees) {
    disposition.set(id, 'hors-flux');
    evenements[id].impactCompletude = 'aucun';
    const g = groupesEcritures.find((x) => x.ids.includes(id))!;
    evenements[id].motif =
      `écriture « Valeur comptable » d'un groupe ÉQUILIBRÉ (${g.ids.length} lignes le même jour sur le même compte, net ${g.net.toFixed(2)} $) — aucune valeur n'entre ni ne sort : sans effet sur les cotisations et les retraits, même si le libellé reste incompris`;
  }

  // ── 3 · le reste, événement par événement ───────────────────────────────────
  for (const ev of evenements) {
    if (disposition.has(ev.id)) continue;
    const a = anneeDe(ev.annee);

    if (ev.nature === 'retrait' && ev.confiance === 'eleve' && ev.regime) {
      const cle = CLES_REGIME[ev.regime];
      const dec = DECAISSEMENT[ev.regime];
      if (cle) { ajouter(a[cle].retraits, ev.devise, Math.abs(ev.montant as number), ev.id); disposition.set(ev.id, 'agrege'); continue; }
      if (dec) { ajouter(a[dec].retraits, ev.devise, Math.abs(ev.montant as number), ev.id); disposition.set(ev.id, 'agrege'); continue; }
      if (ev.regime === 'reee') { ajouter(a.reee.retraits, ev.devise, Math.abs(ev.montant as number), ev.id); disposition.set(ev.id, 'agrege'); continue; }
    }
    if (ev.nature === 'apport-capital' && ev.confiance === 'eleve') {
      ajouter(a.nonEnregistre.apportsCapital, ev.devise, ev.montant as number, ev.id);
      disposition.set(ev.id, 'agrege'); continue;
    }
    if (ev.nature === 'retrait-capital' && ev.confiance === 'eleve') {
      ajouter(a.nonEnregistre.retraitsCapital, ev.devise, Math.abs(ev.montant as number), ev.id);
      disposition.set(ev.id, 'agrege'); continue;
    }
    // HORS FLUX DE CAPITAL — une classification POSITIVE, jamais un silence :
    // opération sur titre, revenu de placement, et depuis le 20 août 2026 les
    // frais et leurs taxes (mesurés). Aucun n'entre dans un montant de
    // cotisation ou de retrait ; tous restent visibles, comptés, traçables.
    if (ev.nature === 'operation-titre' || ev.nature === 'revenu' || ev.nature === 'frais-impot') {
      disposition.set(ev.id, 'hors-flux'); continue;
    }
    if (ev.nature === 'virement-interne') { disposition.set(ev.id, 'virement-interne'); continue; }
    if (ev.nature === 'inconnu') { disposition.set(ev.id, 'inconnu'); continue; }
    if (ev.nature === 'ambigu' || ev.confiance === 'ambigu') { disposition.set(ev.id, 'ambigu'); continue; }
    // Un flux compris mais sans agrégat ferme : une « cotisation » que la règle
    // 2/5 n'a PAS retenue comme argent neuf (jambe de partie double, apport à
    // trancher), un retrait à confiance dégradée… Compté, tracé, jamais sommé.
    disposition.set(ev.id, 'non-agrege');
  }

  // ── 4 · cumulatifs — depuis le début de l'historique DISPONIBLE ─────────────
  const annees = Object.keys(parAnnee).sort();
  const cumulatifs: LigneDuTemps['cumulatifs'] = {};
  const cumule = (cible: ParDevise, source: ParDevise): void => {
    for (const [dev, ag] of Object.entries(source)) {
      if (!cible[dev]) cible[dev] = { montant: 0, devise: dev, sources: [] };
      cible[dev].montant = Math.round((cible[dev].montant + ag.montant) * 100) / 100;
      cible[dev].sources.push(...ag.sources);
    }
  };
  const copie = (p: ParDevise): ParDevise =>
    Object.fromEntries(Object.entries(p).map(([d, a]) => [d, { ...a, sources: [...a.sources] }]));
  let courant = { celi: fluxRegimeVide(), reer: fluxRegimeVide(), reee: { parBeneficiaire: {} as Record<string, ParDevise> } };
  for (const annee of annees) {
    const a = parAnnee[annee];
    cumule(courant.celi.cotisations, a.celi.cotisations);
    cumule(courant.celi.retraits, a.celi.retraits);
    cumule(courant.reer.cotisations, a.reer.cotisations);
    cumule(courant.reer.retraits, a.reer.retraits);
    for (const [b, p] of Object.entries(a.reee.parBeneficiaire)) {
      courant.reee.parBeneficiaire[b] ??= {};
      cumule(courant.reee.parBeneficiaire[b], p);
    }
    cumulatifs[annee] = {
      celi: { cotisations: copie(courant.celi.cotisations), retraits: copie(courant.celi.retraits) },
      reer: { cotisations: copie(courant.reer.cotisations), retraits: copie(courant.reer.retraits) },
      reee: { parBeneficiaire: Object.fromEntries(Object.entries(courant.reee.parBeneficiaire).map(([b, p]) => [b, copie(p)])) },
    };
  }

  // ── 5 · collections et diagnostics ──────────────────────────────────────────
  const dispositions = { conversion: 0, agrege: 0, 'hors-flux': 0, 'virement-interne': 0, ambigu: 0, inconnu: 0, 'non-agrege': 0, 'consommee-partie-double': 0 } as Record<Disposition, number>;
  for (const [, d] of disposition) dispositions[d]++;
  const libellesInconnus: Record<string, number> = {};
  for (const ev of evenements) {
    if (ev.nature !== 'inconnu') continue;
    // PAR LA GARDE de flux.ts, jamais le brut : un collage décalé met une note,
    // un nom ou un compte dans la colonne « type » — repliés sous une seule clé.
    // (Bloquant de la contre-expertise du 19 août : la première version
    // recopiait le libellé brut et faisait fuir « 37-XXXX-W NOM, PRÉNOM ».)
    const lib = cleLibelleInconnu(ev.source.type);
    libellesInconnus[lib] = (libellesInconnus[lib] ?? 0) + 1;
  }

  return {
    parAnnee,
    cumulatifs,
    evenements,
    ambigus: evenements.filter((e) => disposition.get(e.id) === 'ambigu'),
    inconnus: evenements.filter((e) => disposition.get(e.id) === 'inconnu'),
    virementsInternes: evenements.filter((e) => disposition.get(e.id) === 'virement-interne'),
    consommesPartieDouble: evenements.filter((e) => disposition.get(e.id) === 'consommee-partie-double'),
    relationsVirements,
    relationParJambe,
    groupesEcritures,
    ecrituresEquilibrees: evenements.filter((e) => equilibrees.has(e.id)),
    partiesDoubles,
    diagnostics: {
      lignesLues: lignes.length,
      pairesFxConfirmees: fxConfirmees,
      pairesFxElevees: fxElevees,
      dispositions,
      lignesSansRegime: evenements.filter((e) => e.regime === null).length,
      libellesInconnus,
    },
    portee: lignes.length > 0 ? 'interne-seulement' : 'inconnue',
  };
}

// ═══ LA VUE CELI PAR ANNÉE — la timeline vue par l'heuristique de maximisation ═

/**
 * Ce que `deriverCeliParAnnee` rendait, RECONSTRUIT depuis la timeline — plus
 * ce que l'ancienne signature ne pouvait pas dire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LES DEUX DÉCISIONS QUI FONT CETTE VUE (20 août 2026, bascule contrôlée).
 *
 * D5 — LES DEVISES NE SE FONDENT PLUS. Les nombres de `cotisations` et
 * `retraits` sont en DOLLARS CANADIENS SEULEMENT. L'ancien additionnait
 * 6 000 CAD + 1 000 US = « 7 000 » ; ici les montants en devise étrangère ne
 * sont NI additionnés NI convertis (aucun taux fiable n'existe dans les
 * données — en inventer un serait pire que déclarer) : ils sont EXCLUS des
 * nombres et DÉCLARÉS dans `completude.deviseEtrangere`. Un appelant qui
 * ignore la complétude voit des montants exacts sur un périmètre déclaré —
 * jamais un montant faux sur un périmètre muet. L'équivalent CAD fiscal d'une
 * cotisation USD est « à confirmer », pas zéro et pas une approximation.
 *
 * D1 — LES RETRAITS SONT UNE BORNE SUPÉRIEURE, ET LE DÉTAIL LE DIT. Trois
 * sortes de sorties CELI :
 *   · FERMES        Retrait franc, en argent, sans note de virement — un vrai
 *                   retrait, personne n'en doute ;
 *   · À CONFIRMER   la note cite un compte ou parle de virement (D1), ou le
 *                   retrait est EN TITRES (D2). Croesus seul ne dit pas si
 *                   l'argent a quitté l'abri (CELI→comptant : vrai retrait) ou
 *                   changé de CELI (CELI→CELI : aucun droit recréé). On ne
 *                   tranche pas — on expose.
 * `retraits` = fermes + à confirmer, parce que l'UNIQUE consommateur est la
 * preuve « depasse-cumul » d'analyserMaximisation, où les retraits HAUSSENT le
 * seuil d'accusation : la borne supérieure est le côté sûr — sous-compter
 * fabriquerait une fausse « PREUVE d'un historique externe » (le défaut du
 * 12 août). Les DROITS CELI, eux, ne lisent PAS cette vue (ils passent par
 * `deriverHistoriqueRegime`) : le futur lot des droits consommera
 * `detail.retraitsFermes` + résolution manuelle, jamais la borne.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type VueCeliParAnnee = {
  /** Cotisations d'argent neuf, EN CAD SEULEMENT, par année. */
  cotisations: Record<string, number>;
  /** Sorties CELI en CAD — fermes + à confirmer : une BORNE SUPÉRIEURE (voir l'en-tête). */
  retraits: Record<string, number>;
  detail: {
    retraitsFermes: Record<string, number>;
    /** D1 (notés) et D2 (en titres) — CAD. À trancher un jour, pas à deviner. */
    retraitsAConfirmer: Record<string, number>;
    sources: {
      cotisations: Record<string, number[]>;
      retraitsFermes: Record<string, number[]>;
      retraitsAConfirmer: Record<string, number[]>;
    };
  };
  completude: {
    /**
     * Les flux CELI en devise ÉTRANGÈRE, exclus des nombres ci-dessus. Leur
     * équivalent CAD fiscal est À CONFIRMER — jamais converti, jamais zéro.
     */
    deviseEtrangere: {
      cotisations: Record<string, Record<string, number>>;   // année → devise → montant
      retraits: Record<string, Record<string, number>>;
    };
    /** Vrai dès qu'un montant existe hors CAD : les nombres sont un périmètre PARTIEL. */
    horsCadPresent: boolean;
    /** Les événements CELI ambigus non comptés nulle part (renversements possibles…). */
    evenementsAmbigus: number;
    /**
     * CE QUI PEUT ENCORE CHANGER UN CHIFFRE — ambigus, inconnus porteurs d'un
     * montant, virements non résolus (§13-§15 du 20 août 2026). C'est ce
     * compteur, et non `evenementsAmbigus`, que le signal de maximisation doit
     * lire : sinon une ligne à moitié comprise bloque plus qu'une ligne
     * incomprise, ce qui est une hiérarchie de vocabulaire, pas de risque.
     */
    evenementsAImpact: number;
    portee: Portee;
  };
};

const norm = (t: string | null | undefined) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * LE prédicat unique d'une sortie CELI « à confirmer » — D1 (virement noté) et
 * D2 (en titres). Un « retrait » POSITIF n'est pas une sortie : renversement
 * possible, il reste dans les ambigus résiduels.
 *
 * Partagé entre `vueCeliParAnnee` et la vue fiscale (20 août 2026) : deux
 * copies de ce filtre finiraient par diverger — un événement compté « à
 * confirmer » ici et « résiduel » là serait un mensonge structurel.
 */
const estSortieCeliAConfirmer = (ev: EvenementFlux): boolean =>
  ev.regime === 'celi' && norm(ev.source.type) === 'retrait'
  && ev.montant !== null && ev.montant < 0;

/** Les sorties CELI à confirmer (D1/D2), depuis les COLLECTIONS de la timeline. */
export function sortiesCeliAConfirmer(t: LigneDuTemps): EvenementFlux[] {
  return [...t.virementsInternes, ...t.ambigus].filter(estSortieCeliAConfirmer);
}

/** Les événements CELI ambigus RESTANTS — ni agrégés, ni sorties à confirmer. */
export function ambigusCeliResiduels(t: LigneDuTemps): EvenementFlux[] {
  return t.ambigus.filter((ev) => ev.regime === 'celi' && !estSortieCeliAConfirmer(ev));
}

/** La vue — dérivée de la timeline, jamais une seconde lecture des transactions. */
export function vueCeliParAnnee(t: LigneDuTemps): VueCeliParAnnee {
  const vue: VueCeliParAnnee = {
    cotisations: {}, retraits: {},
    detail: { retraitsFermes: {}, retraitsAConfirmer: {}, sources: { cotisations: {}, retraitsFermes: {}, retraitsAConfirmer: {} } },
    completude: {
      deviseEtrangere: { cotisations: {}, retraits: {} },
      horsCadPresent: false, evenementsAmbigus: 0, evenementsAImpact: 0, portee: t.portee,
    },
  };
  const rond = (x: number) => Math.round(x * 100) / 100;
  const poserEtranger = (cible: Record<string, Record<string, number>>, annee: string, devise: string, montant: number) => {
    cible[annee] ??= {};
    cible[annee][devise] = rond((cible[annee][devise] ?? 0) + montant);
    vue.completude.horsCadPresent = true;
  };

  // ── les agrégats fermes de la timeline ──────────────────────────────────────
  for (const [annee, a] of Object.entries(t.parAnnee)) {
    for (const [devise, ag] of Object.entries(a.celi.cotisations)) {
      if (devise === 'CAD') {
        vue.cotisations[annee] = ag.montant;
        vue.detail.sources.cotisations[annee] = [...ag.sources];
      } else poserEtranger(vue.completude.deviseEtrangere.cotisations, annee, devise, ag.montant);
    }
    for (const [devise, ag] of Object.entries(a.celi.retraits)) {
      if (devise === 'CAD') {
        vue.detail.retraitsFermes[annee] = ag.montant;
        vue.detail.sources.retraitsFermes[annee] = [...ag.sources];
      } else poserEtranger(vue.completude.deviseEtrangere.retraits, annee, devise, ag.montant);
    }
  }

  // ── les sorties À CONFIRMER : D1 (virements notés) et D2 (en titres) ────────
  // Par LE prédicat partagé — jamais une seconde copie du filtre.
  for (const ev of sortiesCeliAConfirmer(t)) {
    const montant = Math.abs(ev.montant as number);
    if (ev.devise === 'CAD') {
      vue.detail.retraitsAConfirmer[ev.annee] = rond((vue.detail.retraitsAConfirmer[ev.annee] ?? 0) + montant);
      (vue.detail.sources.retraitsAConfirmer[ev.annee] ??= []).push(ev.id);
    } else poserEtranger(vue.completude.deviseEtrangere.retraits, ev.annee, ev.devise, montant);
  }

  // ── la borne : fermes + à confirmer ─────────────────────────────────────────
  for (const annee of new Set([...Object.keys(vue.detail.retraitsFermes), ...Object.keys(vue.detail.retraitsAConfirmer)])) {
    vue.retraits[annee] = rond((vue.detail.retraitsFermes[annee] ?? 0) + (vue.detail.retraitsAConfirmer[annee] ?? 0));
  }

  // ── les ambigus CELI restants (non comptés) — déclarés, pas perdus ──────────
  vue.completude.evenementsAmbigus = ambigusCeliResiduels(t).length;

  // ── ce qui peut encore CHANGER un chiffre (§13) ─────────────────────────────
  // Tout événement CELI qui n'est ni compté dans un agrégat, ni compté dans la
  // borne des retraits, ni expliqué (jambe consommée, transfert direct), et dont
  // l'impact n'est pas « aucun ». Un « Valeur comptable » inexpliqué de
  // −9 000 $ pèse ici exactement autant qu'un « Frais » ambigu : c'est le but.
  const comptes = new Set<number>([
    ...Object.values(vue.detail.sources.cotisations).flat(),
    ...Object.values(vue.detail.sources.retraitsFermes).flat(),
    ...Object.values(vue.detail.sources.retraitsAConfirmer).flat(),
  ]);
  const expliques = new Set<number>([
    ...t.consommesPartieDouble.map((e) => e.id),
    ...t.relationsVirements
      .filter((r) => r.effet === 'transfert-direct-celi' || r.effet === 'transfert-regime')
      .flatMap((r) => [r.jambeCeliId, r.jambeContrepartieId].filter((x): x is number => x !== null)),
  ]);
  vue.completude.evenementsAImpact = t.evenements.filter((ev) =>
    ev.regime === 'celi' && !comptes.has(ev.id) && !expliques.has(ev.id)
    && ev.impactCompletude !== 'aucun').length;

  return vue;
}

