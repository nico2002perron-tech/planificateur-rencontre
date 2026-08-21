// LA DÉRIVATION — du grand livre cumulatif vers les champs du profil.
//
// TypeScript pur, aucun accès disque : on reçoit des transactions, on rend des
// champs de profil. Testable sans fixture de fichier.
//
// Applique les quatre règles du parseur (docs/regles-parseur.md) : partie
// double des cotisations, virement interne reconnu à la note, transfert
// orphelin présumé externe. Rien n'est deviné : ce qui manque reste `null`.

import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import { typeDeCompte } from '@/lib/parseur-croesus/types';
import { analyserFluxCompte, estVirementInterne, separerCotisations } from '@/lib/parseur-croesus/regles';
import type { HistoriqueRegime, TypeCompte } from './types';
import type { TransfertObserve } from './droits-celi';
import { racheteDansLaFenetre } from './completude-cristallisation';

/** Les transactions d'un régime donné (celi, reer…), tous comptes confondus. */
function pourRegime(lignes: LigneTransaction[], regime: TypeCompte): LigneTransaction[] {
  return lignes.filter((l) => typeDeCompte(l.noCompte) === regime);
}

/**
 * Dérive `historiqueVie.<régime>` du grand livre cumulatif.
 *
 * `retraitsAnneesPassees` exclut l'année courante à dessein : un retrait CELI
 * ne redonne des droits qu'au 1er janvier suivant. Le compter tout de suite
 * surestimerait les droits — exactement l'erreur qui coûte une pénalité.
 */
export function deriverHistoriqueRegime(
  lignes: LigneTransaction[],
  regime: TypeCompte,
  anneeCourante: number,
  dateImport: string
): HistoriqueRegime {
  const duRegime = pourRegime(lignes, regime);
  if (duRegime.length === 0) {
    return {
      dateOuverture: null, cotisationsTotales: null, retraitsAnneesPassees: null,
      transfertEntrantDetecte: null, dateImport: null, portee: 'inconnue',
    };
  }

  const parCompte = new Map<string, LigneTransaction[]>();
  for (const l of duRegime) {
    if (!parCompte.has(l.noCompte)) parCompte.set(l.noCompte, []);
    parCompte.get(l.noCompte)!.push(l);
  }

  let cotisations = 0;
  let transfertEntrant = false;
  for (const [, lignesCompte] of parCompte) {
    const flux = analyserFluxCompte(lignesCompte);
    cotisations += flux.cotisations;                 // argent neuf seulement (règle 2)
    if (flux.transfertEntrantDetecte) transfertEntrant = true;
  }

  const retraitsAnneesPassees = duRegime
    .filter((l) => l.type === 'Retrait' && (l.total ?? 0) < 0
      && Number.parseInt(l.date.slice(0, 4), 10) < anneeCourante)
    .reduce((s, l) => s + Math.abs(l.total as number), 0);

  const dates = duRegime.map((l) => l.date).sort();

  return {
    dateOuverture: dates[0] ?? null,
    cotisationsTotales: cotisations,
    retraitsAnneesPassees,
    transfertEntrantDetecte: transfertEntrant,
    dateImport,
    portee: 'interne-seulement',
  };
}

/**
 * La liste des transferts entrants observés — la matière de l'écran de
 * résolution manuelle. On les rend TOUS (appariés ou non) : l'écran n'affiche
 * que les orphelins, mais le décompte des appariés explique au planificateur
 * pourquoi certains ne lui sont pas soumis.
 */
export function observerTransferts(lignes: LigneTransaction[], regime?: TypeCompte): TransfertObserve[] {
  const source = regime ? pourRegime(lignes, regime) : lignes;
  const enArgent = source
    .filter((l) => (l.type === 'Transfert' || l.type === 'Réception') && (l.total ?? 0) > 0)
    .map((l) => ({
      compte: l.noCompte,
      date: l.date,
      montant: l.total as number,
      apparie: estVirementInterne(l.note),
      note: l.note,
    }));

  // RÈGLE 5 : les apports EN NATURE étiquetés transfert ou ambigu rejoignent
  // la liste. Une arrivée de titres depuis un autre régime prouve une origine
  // externe exactement comme un virement d'argent -- et ce que le client a
  // cotisé AVANT, dans le compte d'origine, nous reste invisible.
  const parCompte = new Map<string, LigneTransaction[]>();
  for (const l of source) {
    if (!parCompte.has(l.noCompte)) parCompte.set(l.noCompte, []);
    parCompte.get(l.noCompte)!.push(l);
  }
  const enNature: TransfertObserve[] = [];
  for (const [, ls] of parCompte) {
    for (const a of separerCotisations(ls).apportsATrancher) {
      enNature.push({
        compte: a.compte, date: a.date, montant: a.montant,
        apparie: false, note: a.note,
      });
    }
  }

  return [...enArgent, ...enNature]
    .sort((a, b) => b.date.localeCompare(a.date) || b.montant - a.montant);
}

/**
 * Les gains et pertes réalisés d'une année — colonne Gains/Pertes de Croesus.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE RÉGIME COMPTE — corrigé le 20 août 2026 (audit des huit stratégies).
 *
 * Cette fonction sommait la colonne « Gains/Pertes » de TOUTES les ventes sans
 * jamais regarder le compte, alors que six lignes plus bas elle filtrait déjà
 * les retraits PAR RÉGIME : l'outil était là, il n'avait pas été appliqué ici.
 *
 * Ce que ça coûtait, mesuré sur la base locale : 171 des 440 dispositions
 * (39 %) sont dans des comptes enregistrés — REER 128, REEE 25, CELI 12,
 * FERR 6. Une perte vendue dans un CELI entrait donc dans les « pertes
 * disponibles » de la cristallisation de gains, où elle n'a aucune existence
 * fiscale : le moteur invitait à réaliser des gains imposables en les croyant
 * abrités. Sur les 4 dossiers portant des ventes en 2026, DEUX changent —
 * dont un où le « gain net absorbable » tombe de ~10 000 $ à ZÉRO.
 *
 * LES ANCIENS CHAMPS NE CHANGENT PAS DE SENS. `gainsRealises` et
 * `pertesRealisees` restent la performance réalisée tous régimes confondus ;
 * l'assiette fiscale porte un nom qui le dit. Un champ générique dont le sens
 * change en silence est plus dangereux qu'un champ de plus.
 *
 * ⚠ NÉCESSAIRE, PAS SUFFISANT : « non enregistré » ne veut pas dire « perte
 * admissible ». Pertes apparentes, transferts en nature, personnes affiliées :
 * rien de tout cela n'est vérifié ici.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function deriverTransactionsAnnee(lignes: LigneTransaction[], annee: number) {
  const delAnnee = lignes.filter((l) => l.date.startsWith(String(annee)));
  let gainsRealises = 0;
  let pertesRealisees = 0;
  let gainsRealisesNonEnregistres = 0;
  let pertesRealiseesNonEnregistrees = 0;
  const indetermine = { nombre: 0, gains: 0, pertes: 0 };
  for (const l of delAnnee) {
    if (l.type !== 'Vente' || l.gainsPertes === null) continue;
    const gain = l.gainsPertes >= 0;
    const montant = Math.abs(l.gainsPertes);
    if (gain) gainsRealises += montant; else pertesRealisees += montant;

    // LE RÉGIME VIENT DE LA PRIMITIVE CANONIQUE — aucune table de suffixes
    // parallèle ici (consigne §5). `null` = régime NON PROUVÉ, et un régime non
    // prouvé n'est PAS du non-enregistré : il se compte à part.
    const regime = typeDeCompte(l.noCompte);
    if (regime === 'non-enregistre') {
      if (gain) gainsRealisesNonEnregistres += montant;
      else pertesRealiseesNonEnregistrees += montant;
    } else if (regime === null) {
      indetermine.nombre++;
      if (gain) indetermine.gains += montant; else indetermine.pertes += montant;
    }
    // Tout autre régime est ENREGISTRÉ : la disposition n'a aucun effet sur
    // l'impôt du client, ni comme gain, ni comme perte. Elle sort de l'assiette.
  }
  const retrait = (regime: TypeCompte) =>
    delAnnee
      .filter((l) => typeDeCompte(l.noCompte) === regime && l.type === 'Retrait' && (l.total ?? 0) < 0)
      .reduce((s, l) => s + Math.abs(l.total as number), 0);

  // LA PERTE APPARENTE, telle que le livre permet de la VOIR (§14) : le rachat
  // du même titre dans les trente jours d'une vente à perte. Le conjoint et les
  // comptes détenus ailleurs restent hors de vue — d'où « à valider », pas
  // « refusée », et surtout jamais « confirmée disponible ».
  const pertesCourantesAValiderPerteApparente = racheteDansLaFenetre(
    lignes.map((l) => ({ date: l.date, type: l.type, symbole: l.symbole, noCompte: l.noCompte, gainsPertes: l.gainsPertes })),
    annee,
  );

  const arrondi = (x: number) => Math.round(x * 100) / 100;
  return {
    gainsRealises: arrondi(gainsRealises),
    pertesRealisees: arrondi(pertesRealisees),
    gainsRealisesNonEnregistres: arrondi(gainsRealisesNonEnregistres),
    pertesRealiseesNonEnregistrees: arrondi(pertesRealiseesNonEnregistrees),
    dispositionsRegimeIndetermine: {
      nombre: indetermine.nombre,
      gains: arrondi(indetermine.gains),
      pertes: arrondi(indetermine.pertes),
    },
    pertesCourantesAValiderPerteApparente,
    retraitsReer: retrait('reer'),
    retraitsCeli: retrait('celi'),
    portee: 'interne-seulement' as const,
  };
}

/**
 * Les cotisations CELI d'ARGENT NEUF et les retraits, PAR ANNÉE CIVILE.
 *
 * La matière de l'heuristique de maximisation : « si c'est maximisé d'année en
 * année, probablement que le client est seulement ici » (Nicolas, 12 août).
 * Mêmes règles que partout — partie double, étiquettes, virements internes —
 * appliquées année par année, compte par compte.
 */
/**
 * ⚠ TÉMOIN DE PARITÉ depuis le 20 août 2026 — plus consommée en production.
 *
 * `signauxDuLivre` (hydrater.ts) lit désormais `vueCeliParAnnee(timeline)`.
 * Cette fonction reste TELLE QUELLE le temps d'un lot : c'est elle que
 * `parite-derivations.test.ts` compare à la timeline, divergence par
 * divergence (D1 à D6). La retirer, c'est retirer le témoin — décision du
 * prochain lot, pas un ménage en passant.
 *
 * ⚠ Son défaut D5 est VOULU intact ici : elle FOND les devises au nominal
 * (6 000 CAD + 1 000 US = « 7 000 »). C'est le comportement historique que
 * le témoin doit continuer d'exhiber.
 */
export function deriverCeliParAnnee(lignes: LigneTransaction[]): {
  cotisations: Record<string, number>;
  retraits: Record<string, number>;
} {
  const duCeli = lignes.filter((l) => typeDeCompte(l.noCompte) === 'celi');
  const annees = [...new Set(duCeli.map((l) => l.date.slice(0, 4)))].sort();
  const cotisations: Record<string, number> = {};
  const retraits: Record<string, number> = {};
  for (const annee of annees) {
    const delAnnee = duCeli.filter((l) => l.date.startsWith(annee));
    const parCompte = new Map<string, LigneTransaction[]>();
    for (const l of delAnnee) {
      if (!parCompte.has(l.noCompte)) parCompte.set(l.noCompte, []);
      parCompte.get(l.noCompte)!.push(l);
    }
    let c = 0;
    for (const [, ls] of parCompte) c += analyserFluxCompte(ls).cotisations;
    cotisations[annee] = c;
    retraits[annee] = delAnnee
      .filter((l) => l.type === 'Retrait' && (l.total ?? 0) < 0)
      .reduce((somme, l) => somme + Math.abs(l.total as number), 0);
  }
  return { cotisations, retraits };
}

/** Les cotisations de l'année, régime par régime — argent neuf seulement. */
export function deriverCotisationsAnnee(lignes: LigneTransaction[], annee: number) {
  const delAnnee = lignes.filter((l) => l.date.startsWith(String(annee)));
  const somme = (regime: TypeCompte) => {
    const parCompte = new Map<string, LigneTransaction[]>();
    for (const l of delAnnee.filter((x) => typeDeCompte(x.noCompte) === regime)) {
      if (!parCompte.has(l.noCompte)) parCompte.set(l.noCompte, []);
      parCompte.get(l.noCompte)!.push(l);
    }
    let t = 0;
    for (const [, ls] of parCompte) t += analyserFluxCompte(ls).cotisations;
    return t;
  };
  return {
    reer: somme('reer'),
    celi: somme('celi'),
    reeeParEnfant: cotisationsReeeParEnfant(delAnnee),
    portee: 'interne-seulement' as const,
  };
}

/**
 * LES COTISATIONS REEE, VENTILEES PAR ENFANT.
 *
 * Mesure sur le livre (6 aout 2026) : 110 comptes REEE, 23 326 lignes, et les
 * cotisations portent le beneficiaire dans leur note -- « CONTRIBUTION
 * 01LAURIE », « CONTRIBUTION 03JULES ». Le chiffre qui precede est un rang
 * interne, pas une partie du prenom.
 *
 * POURQUOI PAR LA NOTE ET PAS PAR LE COMPTE : un REEE familial sert plusieurs
 * enfants sous un seul numero. Compter par compte melerait leurs plafonds, et
 * la subvention se calcule PAR BENEFICIAIRE.
 *
 * Un prenom non reconnu n'est pas invente : la ligne est simplement absente du
 * decompte, et l'enfant ressort avec 0 $ cotise -- donc avec le plein montant
 * a cotiser. C'est le bon cote sur lequel se tromper : on suggere de verifier,
 * jamais de ne rien faire.
 */
/**
 * LE BÉNÉFICIAIRE D'UNE NOTE REEE — la primitive, extraite le 19 août 2026 pour
 * que la ligne du temps réutilise LA MÊME regex plutôt que d'en écrire une
 * seconde. Comportement inchangé : même motif, même normalisation.
 * Rend `null` quand la note ne nomme personne — jamais une répartition devinée.
 */
const MOTIF_BENEFICIAIRE_REEE = /(?:CONTRIBUTION|COTIS(?:ATION)?)\s+(?:\d{1,2})?([A-ZÀ-ÖØ-Þ]{3,})/i;
export function beneficiaireReeeDeLaNote(note: string | null | undefined): string | null {
  const m = MOTIF_BENEFICIAIRE_REEE.exec(note ?? '');
  return m ? m[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() : null;
}

function cotisationsReeeParEnfant(lignes: LigneTransaction[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lignes) {
    if (typeDeCompte(l.noCompte) !== 'reee') continue;
    if (l.type !== 'Cotisation' && l.type !== 'Dépôt') continue;
    const montant = l.total ?? 0;
    if (montant <= 0) continue;
    const cle = beneficiaireReeeDeLaNote(l.note);
    if (!cle) continue;
    out[cle] = (out[cle] ?? 0) + montant;
  }
  return out;
}
