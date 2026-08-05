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

/** Les gains et pertes réalisés d'une année — colonne Gains/Pertes de Croesus. */
export function deriverTransactionsAnnee(lignes: LigneTransaction[], annee: number) {
  const delAnnee = lignes.filter((l) => l.date.startsWith(String(annee)));
  let gainsRealises = 0;
  let pertesRealisees = 0;
  for (const l of delAnnee) {
    if (l.type !== 'Vente' || l.gainsPertes === null) continue;
    if (l.gainsPertes >= 0) gainsRealises += l.gainsPertes;
    else pertesRealisees += Math.abs(l.gainsPertes);
  }
  const retrait = (regime: TypeCompte) =>
    delAnnee
      .filter((l) => typeDeCompte(l.noCompte) === regime && l.type === 'Retrait' && (l.total ?? 0) < 0)
      .reduce((s, l) => s + Math.abs(l.total as number), 0);

  return {
    gainsRealises,
    pertesRealisees,
    retraitsReer: retrait('reer'),
    retraitsCeli: retrait('celi'),
    portee: 'interne-seulement' as const,
  };
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
  return { reer: somme('reer'), celi: somme('celi'), portee: 'interne-seulement' as const };
}
