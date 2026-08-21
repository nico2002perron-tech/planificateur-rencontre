// LA COMPLÉTUDE DE LA CRISTALLISATION DE GAINS — un seul endroit, une seule
// question : ce chiffre peut-il être ferme ? (20 août 2026)
//
// ─────────────────────────────────────────────────────────────────────────────
// L'INVARIANT QUE CE MODULE FAIT RESPECTER
//
// « Une stratégie ne peut produire `calcule` que si TOUTES les données
// matériellement nécessaires À CETTE STRATÉGIE sont suffisamment fiables. »
//
// Et le corollaire, tout aussi important : une inconnue qui ne peut PAS
// changer le chiffre de cette stratégie ne doit rien bloquer. Une ambiguïté
// CELI n'a aucune incidence sur une récolte de gains en compte non enregistré.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE LA MESURE DU 20 AOÛT A ÉTABLI (49 positions non enregistrées réelles)
//
//   · PBR présent sur 49/49 — le PBR n’est PAS le manque courant aujourd'hui ;
//   · valeur marchande absente sur 1/49 ;
//   · **14 positions sur 49 sont en USD** (29 %) — c'est le vrai sujet ;
//   · 0 bien identique détenu dans plusieurs comptes non enregistrés ;
//   · relevés tous du mois courant (5 au 19 août 2026) ;
//   · 4 comptes au régime NON PROUVÉ, écartés des positions non enregistrées.
//
// ─────────────────────────────────────────────────────────────────────────────
// LES SÉMANTIQUES VERROUILLÉES ICI (§20)
//
//   inconnu ≠ 0                    une position sans PBR n'a pas un gain de 0
//   absent ≠ 0                     une VM absente n’est pas une VM nulle
//   PBR nul CONFIRMÉ ≠ PBR absent  0,00 $ est une donnée ; `null` est un trou
//   USD ≠ CAD                      aucun montant nominal converti au pair
//   compte inconnu ≠ non-enregistré
//   perte réalisée ≠ perte admissible    (perte apparente non vérifiable ici)
//   position visible ≠ portefeuille fiscal complet
// ─────────────────────────────────────────────────────────────────────────────

import { unitePermetUnChiffreFerme } from './types';
import type { ProfilClient, Position, Compte, PertesCapitalReportees } from './types';

/**
 * LE MONTANT DES PERTES REPORTÉES QUI ENTRE RÉELLEMENT DANS L'ADDITION.
 *
 * Extrait de `strategies.ts` le 21 août 2026, en découvrant par le sabotage U
 * que cette exclusion n'était verrouillée par AUCUN test : le garde-fou de
 * complétude bloquait déjà le constat, si bien qu'on pouvait supprimer
 * l'exclusion arithmétique sans faire rougir quoi que ce soit. La protection
 * existait, mais rien ne la retenait.
 *
 * Les deux protections sont volontairement redondantes — l'une empêche le
 * STATUT `calcule`, l'autre empêche le MONTANT d'être faux. Une fonction pure
 * rend la seconde observable, donc verrouillable.
 */
export function pertesReporteesUtilisables(r: PertesCapitalReportees): number {
  return unitePermetUnChiffreFerme(r.unite) ? (r.montant ?? 0) : 0;
}

/** Une position, avec le compte où elle vit — la maille de tout ce module. */
export type PositionSituee = Position & { compte: Compte };

/** La qualité d’une position, dimension par dimension. Aucune n'en résume une autre. */
export type QualitePosition = {
  position: PositionSituee;
  /** Le PBR est-il une donnée ? (0,00 $ CONFIRMÉ en est une ; `null` n'en est pas une.) */
  pbrFiable: boolean;
  vmFiable: boolean;
  /**
   * LES VALEURS DE CETTE POSITION SONT-ELLES EXPRIMÉES EN DOLLARS CANADIENS ?
   *
   * ⚠ CE N'EST PAS « le titre se transige-t-il en dollars canadiens ». La
   * question porte sur l'UNITÉ DES COLONNES MONÉTAIRES, pas sur la monnaie de
   * négociation — voir `Position.uniteValeursRapport`.
   */
  valeursExprimeesEnCad: boolean;
  /** Le gain latent, seulement quand les trois précédents le permettent. */
  gainLatentCad: number | null;
  /** Pourquoi cette position ne peut pas porter de chiffre ferme — vide si elle le peut. */
  raisons: string[];
};

export type RaisonBlocage =
  | 'positions-sans-pbr'
  | 'positions-sans-valeur-marchande'
  | 'devise-etrangere-non-convertie'
  | 'bien-identique-multi-comptes-a-confirmer'
  | 'regime-de-compte-non-prouve'
  | 'dispositions-regime-indetermine'
  | 'pertes-reportees-unite-non-demontree'
  | 'pertes-reportees-unite-incompatible'
  | 'perte-courante-a-valider-perte-apparente'
  | 'portee-externe-non-confirmee';

export type CompletudeCristallisation = {
  /** Les positions, chacune qualifiée. */
  qualites: QualitePosition[];
  /** Celles qui peuvent porter un chiffre ferme ET un gain latent positif. */
  candidatesFiables: QualitePosition[];
  /** Les blocages MATÉRIELS — chacun peut changer le montant de CETTE stratégie. */
  blocages: RaisonBlocage[];
  /** Une phrase par blocage, prête pour l'écran — sans jamais un chiffre présenté comme certain. */
  explications: string[];
  /** Ce que le planificateur peut aller chercher. */
  donneesManquantes: string[];
  /** La date des valeurs marchandes utilisées — un montant daté vaut mieux qu'un faux « aujourd'hui ». */
  dateReleve: string | null;
  /** Vrai seulement si AUCUN blocage matériel ne subsiste. */
  peutEtreFerme: boolean;
};

/** Les comptes non enregistrés, et eux seuls. Un régime non prouvé n'en est pas un. */
export function positionsNonEnregistrees(profil: ProfilClient): PositionSituee[] {
  const dedans: PositionSituee[] = [];
  for (const c of profil.comptes) {
    if (c.type !== 'non-enregistre') continue;
    for (const p of c.positions) dedans.push({ ...p, compte: c });
  }
  return dedans;
}

/**
 * L'UNITÉ DES COLONNES MONÉTAIRES D'UNE POSITION.
 *
 * Absente = le format d'import historique, dont la mesure du 21 août 2026 a
 * établi qu'il rend ses valeurs en dollars canadiens. Toute source qui ne peut
 * pas le garantir doit poser `inconnue` — et le moteur dégradera alors, pour
 * un motif qui sera vrai cette fois.
 */
export function uniteValeursDe(p: Position): 'CAD' | 'USD' | 'inconnue' {
  return p.uniteValeursRapport ?? 'CAD';
}

/**
 * Qualifie UNE position. Chaque dimension est mesurée séparément : une position
 * peut avoir un PBR parfait et une valeur marchande absente, et c'est une
 * information différente d’une position sans PBR.
 */
export function qualifierPosition(p: PositionSituee): QualitePosition {
  const raisons: string[] = [];
  // ⚠ `=== null`, jamais `!p.valeurComptable` : un PBR CONFIRMÉ à 0,00 $ est une
  // donnée valide (un titre reçu sans coût), et le traiter comme absent
  // effacerait un gain latent parfaitement connu.
  const pbrFiable = p.valeurComptable !== null;
  const vmFiable = p.valeurMarchande !== null;
  // ── LE FAUX GARDE, RETIRÉ LE 21 AOÛT 2026 ────────────────────────────────
  //
  // Cette ligne lisait `p.devise` — la monnaie de NÉGOCIATION du titre — et en
  // concluait que ses montants n'étaient pas en dollars canadiens. Les deux
  // notions n'ont rien à voir, et la mesure l'a tranché : le format d'export
  // que nous supportons rend ses colonnes monétaires en CAD, y compris sur les
  // lignes marquées « USD » (encaisse 1USD à 1,379 et 1,389 ; distribution
  // valeur/coût identique entre lignes CAD et USD).
  //
  // Ce que ce faux garde coûtait, mesuré : 14 des 49 positions non enregistrées
  // (29 %) écartées d'un calcul parfaitement faisable. Pas un faux vert — un
  // FAUX ROUGE, moins dangereux, tout aussi faux.
  //
  // LA VRAIE QUESTION est posée au format, qui seul la connaît. Une source qui
  // ne déclare rien vaut CAD : c'est le contrat du seul format supporté à ce
  // jour, et toute nouvelle source devra dire `inconnue` explicitement.
  const valeursExprimeesEnCad = uniteValeursDe(p) === 'CAD';

  if (!pbrFiable) raisons.push('prix de base rajusté absent');
  if (!vmFiable) raisons.push('valeur marchande absente');
  if (!valeursExprimeesEnCad) {
    raisons.push('les montants de cette position ne sont pas exprimés en dollars canadiens');
  }

  // LE GAIN N'EXISTE QUE SI LES TROIS TIENNENT. Sans PBR on ne sait pas d'où on
  // part ; sans valeur marchande on ne sait pas où on est ; en devise étrangère
  // on ne sait pas dire le résultat en dollars canadiens — et l'ARC exige des
  // dollars canadiens.
  const gainLatentCad = pbrFiable && vmFiable && valeursExprimeesEnCad
    ? (p.valeurMarchande as number) - (p.valeurComptable as number)
    : null;

  return { position: p, pbrFiable, vmFiable, valeursExprimeesEnCad, gainLatentCad, raisons };
}

/** Le même symbole détenu dans PLUSIEURS comptes non enregistrés (§8). */
export function biensIdentiquesMultiComptes(positions: PositionSituee[]): string[] {
  const parSymbole = new Map<string, Set<string>>();
  for (const p of positions) {
    const cle = p.symbole.trim().toUpperCase();
    if (!cle) continue;
    if (!parSymbole.has(cle)) parSymbole.set(cle, new Set());
    parSymbole.get(cle)!.add(p.compte.numero ?? p.compte.suffixe ?? '(sans numéro)');
  }
  return [...parSymbole.entries()].filter(([, comptes]) => comptes.size > 1).map(([s]) => s);
}

/**
 * LA VÉRIFICATION UNIQUE — appelée avant tout `calcule`.
 *
 * `pertesReporteesUtilisees` : le champ saisi lorsque la stratégie s'appuie
 *   dessus, `null` sinon. C'est l'objet complet — montant ET unité — parce que
 *   la question n'est pas « y a-t-il un montant ? » mais « ce montant est-il
 *   comparable au gain latent qu'on lui oppose ? ».
 * `pertesCourantesAValider` : une perte de l'année risque-t-elle d'être apparente ?
 */
export function verifierCompletudeCristallisationGains(
  profil: ProfilClient,
  options: {
    pertesReporteesUtilisees: PertesCapitalReportees | null;
    pertesCourantesAValider: boolean;
  }
): CompletudeCristallisation {
  const positions = positionsNonEnregistrees(profil);
  const qualites = positions.map(qualifierPosition);
  const candidatesFiables = qualites.filter((q) => q.gainLatentCad !== null && q.gainLatentCad > 0);

  const blocages: RaisonBlocage[] = [];
  const explications: string[] = [];
  const donneesManquantes: string[] = [];
  const ajouter = (b: RaisonBlocage, phrase: string, manque?: string) => {
    blocages.push(b);
    explications.push(phrase);
    if (manque) donneesManquantes.push(manque);
  };

  // ── LES POSITIONS, une dimension à la fois ────────────────────────────────
  const sansPbr = qualites.filter((q) => !q.pbrFiable).length;
  const sansVm = qualites.filter((q) => q.pbrFiable && !q.vmFiable).length;
  const enDeviseEtrangere = qualites.filter((q) => !q.valeursExprimeesEnCad).length;

  if (sansPbr > 0) {
    ajouter('positions-sans-pbr',
      `Le prix de base rajusté manque sur ${sansPbr} position${sansPbr > 1 ? 's' : ''} non enregistrée${sansPbr > 1 ? 's' : ''} : leur gain latent est inconnu, pas nul.`,
      'le prix de base rajusté des positions non enregistrées qui en manquent');
  }
  if (sansVm > 0) {
    ajouter('positions-sans-valeur-marchande',
      `La valeur marchande manque sur ${sansVm} position${sansVm > 1 ? 's' : ''} : sans elle, le gain latent ne se calcule pas.`,
      'la valeur marchande des positions qui en manquent');
  }
  if (enDeviseEtrangere > 0) {
    ajouter('devise-etrangere-non-convertie',
      `${enDeviseEtrangere} position${enDeviseEtrangere > 1 ? 's sont détenues' : ' est détenue'} en devise étrangère. Le relevé ne fournit pas leur valeur en dollars canadiens, et l’impôt se déclare en dollars canadiens : leur gain n’est pas chiffrable ici.`,
      'la valeur en dollars canadiens des positions en devise étrangère');
  }

  // ── LE BIEN IDENTIQUE (§8) ────────────────────────────────────────────────
  // Mesuré : aucun cas dans la base d'aujourd'hui. Le garde-fou existe quand
  // même, parce que le jour où il s'en présentera un, le PBR par compte ne sera
  // plus le PBR fiscal : un même bien détenu dans deux comptes se moyenne.
  const biens = biensIdentiquesMultiComptes(positions);
  if (biens.length > 0) {
    ajouter('bien-identique-multi-comptes-a-confirmer',
      `${biens.length} titre${biens.length > 1 ? 's sont détenus' : ' est détenu'} dans plusieurs comptes non enregistrés. Le prix de base d'un bien identique se calcule sur l’ensemble des unités détenues, pas compte par compte : le prix de base fourni par compte ne peut pas être retenu tel quel.`,
      'le prix de base rajusté consolidé des titres détenus dans plusieurs comptes');
  }

  // ── LE RÉGIME DES COMPTES (§20 : compte inconnu ≠ non-enregistré) ─────────
  const regimesNonProuves = profil.comptes.filter((c) => c.type === null).length;
  if (regimesNonProuves > 0) {
    ajouter('regime-de-compte-non-prouve',
      `${regimesNonProuves} compte${regimesNonProuves > 1 ? 's ont' : ' a'} un régime non prouvé. Un compte dont le régime est inconnu est écarté plutôt que présumé imposable — mais s'il l'était, il porterait peut-être d'autres gains à récolter.`,
      'le régime des comptes non identifiés');
  }

  // ── LES DISPOSITIONS AU RÉGIME INDÉTERMINÉ (§4) ───────────────────────────
  const indetermine = profil.transactionsAnnee.dispositionsRegimeIndetermine;
  if (indetermine.nombre > 0) {
    ajouter('dispositions-regime-indetermine',
      `${indetermine.nombre} disposition${indetermine.nombre > 1 ? 's' : ''} de l'année ${indetermine.nombre > 1 ? 'proviennent' : 'provient'} d'un compte au régime non prouvé : ${indetermine.nombre > 1 ? 'elles pourraient' : 'elle pourrait'} changer les pertes disponibles.`,
      'le régime des comptes dont proviennent les dispositions non identifiées');
  }

  // ── LES PERTES REPORTÉES : L'UNITÉ DÉCIDE (§11, précisé le 20 août 2026) ──
  // Le champ de saisie ne portait AUCUNE mention d'unité — contrairement au
  // champ voisin, qui précise « avis de cotisation ». Or l’avis rapporte des
  // pertes en capital NETTES (déjà au taux d'inclusion), tandis que les pertes
  // de l'année viennent de Croesus en montants BRUTS. Additionner les deux,
  // puis comparer le total à un gain latent brut, mélange deux unités.
  //
  // Depuis que le champ porte son unité, le blocage n'est plus automatique : il
  // suit ce qu'on sait. Une perte BRUTE se compare directement au gain latent,
  // et la refuser inventerait un motif faux. Une perte NETTE, elle, est bloquée
  // pour un motif différent — connu, et dit tel quel.
  const reportees = options.pertesReporteesUtilisees;
  if (
    reportees !== null && reportees.montant !== null && reportees.montant > 0 &&
    !unitePermetUnChiffreFerme(reportees.unite)
  ) {
    if (reportees.unite === 'perte-nette-capital-fiscale') {
      // L'UNITÉ EST CONNUE, ET C'EST PRÉCISÉMENT POURQUOI ON REFUSE : les
      // rapprocher exigerait de diviser par le taux d'inclusion — un facteur
      // codé en dur, donc inventé. On nomme ce qui manque, sans le fabriquer.
      ajouter('pertes-reportees-unite-incompatible',
        'Les pertes en capital reportées sont inscrites en montant NET, tel que l’avis de cotisation le rapporte, alors que les gains latents d’un portefeuille se mesurent en montant brut. Le moteur ne convertit pas l’un en l’autre : le montant directement utilisable reste à établir.',
        'le montant BRUT des pertes en capital reportées, ou leur équivalent directement utilisable');
    } else {
      ajouter('pertes-reportees-unite-non-demontree',
        'Les pertes en capital reportées viennent d’une saisie manuelle dont l’unité n’est pas établie : une perte en capital nette de l’avis de cotisation et une perte brute ne se comparent pas au même gain. Le montant exact reste à confirmer.',
        'l’unité des pertes en capital reportées (perte brute ou perte nette de l’avis de cotisation)');
    }
  }

  // ── LA PERTE APPARENTE (§13-§14) ──────────────────────────────────────────
  if (options.pertesCourantesAValider) {
    ajouter('perte-courante-a-valider-perte-apparente',
      'Une perte réalisée cette année pourrait être refusée par la règle de la perte apparente : le même bien a été racheté dans la fenêtre de trente jours. Tant que ce point n\'est pas tranché, cette perte ne peut pas être tenue pour disponible.',
      'la confirmation qu\'aucune perte de l\'année n\'est une perte apparente');
  }

  // ── LA PORTÉE EXTERNE (§9) ────────────────────────────────────────────────
  // Elle ne bloque QUE parce qu'elle peut changer le chiffre : des positions
  // détenues ailleurs porteraient d'autres gains, et un bien identique détenu
  // ailleurs changerait le prix de base d’ici.
  if (profil.consolidation.comptesExternes !== 'non') {
    ajouter('portee-externe-non-confirmee',
      'Le client n\'a pas confirmé n\'avoir aucun compte ailleurs. Des positions détenues ailleurs porteraient d\'autres gains, et un même titre détenu ailleurs changerait le prix de base de celui d\'ici.',
      'la liste des positions détenues ailleurs qu\'ici');
  }

  const dateReleve = positions[0]?.compte.dateReleve ?? profil.comptes[0]?.dateReleve ?? null;

  return {
    qualites, candidatesFiables, blocages, explications, donneesManquantes, dateReleve,
    peutEtreFerme: blocages.length === 0,
  };
}

/**
 * UNE PERTE DE L'ANNÉE RISQUE-T-ELLE D'ÊTRE APPARENTE ? (§14)
 *
 * Ce que le livre permet de VOIR : le rachat du même symbole dans les trente
 * jours qui suivent (ou précèdent) une vente à perte, dans les comptes que
 * nous détenons.
 *
 * ⚠ CE QUE LE LIVRE NE VOIT PAS, et que ce module ne prétend donc jamais
 * exclure : le conjoint, une société contrôlée, une fiducie, un compte détenu
 * ailleurs. L'absence de rachat visible n’est PAS une preuve d'absence de perte
 * apparente — c'est une limite déclarée, portée dans les données manquantes du
 * constat, jamais un feu vert.
 */
export function racheteDansLaFenetre(
  lignes: Array<{ date: string; type: string; symbole: string; noCompte: string; gainsPertes: number | null }>,
  annee: number,
  fenetreJours = 30
): boolean {
  const ventesAPerte = lignes.filter((l) =>
    l.type === 'Vente' && l.gainsPertes !== null && l.gainsPertes < 0 && l.date.startsWith(String(annee)));
  const jours = (a: string, b: string) =>
    Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;

  return ventesAPerte.some((vente) => lignes.some((l) =>
    l.type === 'Achat'
    && l.symbole.trim().toUpperCase() === vente.symbole.trim().toUpperCase()
    && jours(l.date, vente.date) <= fenetreJours));
}
