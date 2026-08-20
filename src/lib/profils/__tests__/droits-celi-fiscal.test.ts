// LA MIGRATION CONTRÔLÉE DES DROITS CELI — ancien contre nouveau (20 août 2026).
//
// Ce que ce fichier tient :
//   · la PARITÉ exacte sur les dossiers propres (CAD, sans ambigu, sans
//     virement non résolu) — toute divergence y serait une régression ;
//   · les divergences VOULUES, chacune classée : D5 (devise fondue par
//     l'ancien), natures non tranchées, portée ;
//   · l'invariant transversal : jamais un chiffre ferme sur une devise non
//     résolue, une nature ambiguë ou une portée externe non confirmée ;
//   · la règle du retrait reporté, préservée telle quelle.
//
// Données synthétiques, comptes « FICT ».
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps } from '../ligne-du-temps';
import { vueFiscaleCeli, cleEvenementFiscal, type ResolutionMontantFiscalCad } from '../vue-fiscale-celi';
import { deriverHistoriqueCeliFiscal, comparerDroitsCeli, type ContexteDroitsCeli } from '../droits-celi-fiscal';
import { deriverHistoriqueRegime } from '../deriver';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function tx(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2025-03-15', dateReglement: '2025-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}
const CELI = '37-FICT-W';
const MARGE = '37-FICT-E';
const ANNEE = 2026;
const PLAFOND = 102_000;

/** Le contexte « dossier parfait » : client qui a tout confirmé. */
const ctxPropre = (over: Partial<ContexteDroitsCeli> = {}): ContexteDroitsCeli => ({
  anneeCourante: ANNEE, plafondCumulatif: PLAFOND,
  historiqueExterne: 'jamais', comptesExternes: 'non',
  dateImport: '2026-08-20', dateOuverture: '2020-01-01',
  ...over,
});

const nouveau = (lignes: LigneTransaction[], ctx = ctxPropre(), resolutions: ResolutionMontantFiscalCad[] = []) =>
  deriverHistoriqueCeliFiscal(vueFiscaleCeli(construireLigneDuTemps(lignes), resolutions), ctx);
const ancien = (lignes: LigneTransaction[]) => deriverHistoriqueRegime(lignes, 'celi', ANNEE, '2026-08-20');
const comparer = (lignes: LigneTransaction[], ctx = ctxPropre(), resolutions: ResolutionMontantFiscalCad[] = []) =>
  comparerDroitsCeli(ancien(lignes), nouveau(lignes, ctx, resolutions));

// ═══ A à D · LA PARITÉ SUR LES DOSSIERS PROPRES ══════════════════════════════

describe('parité ancien ↔ nouveau sur les dossiers propres', () => {
  it('A · historique CAD propre, aucune ambiguïté', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' })];
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(7000);
    expect(n.statut).toBe('calcule');
    for (const d of comparer(lignes)) expect(d.classe, `${d.champ} : ${d.motif}`).toBe('parite');
  });

  it('B · plusieurs années de cotisations', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000, date: '2022-03-01' }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 6500, date: '2023-03-01' }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-03-01' }),
    ];
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(19500);
    expect(Object.keys(n.parAnnee).sort()).toEqual(['2022', '2023', '2024']);
    for (const d of comparer(lignes)) expect(d.classe, d.champ).toBe('parite');
  });

  it('C · LA RÈGLE DU RETRAIT REPORTÉ est préservée : l’année courante ne redonne rien', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }),
      tx({ type: 'Retrait', noCompte: CELI, total: -3000, date: '2024-06-01' }),   // année passée : compte
      tx({ type: 'Retrait', noCompte: CELI, total: -5000, date: '2026-06-01' }),   // année COURANTE : ne compte pas
    ];
    const n = nouveau(lignes);
    expect(n.retraitsAnneesPassees.min).toBe(3000);          // et surtout PAS 8 000
    expect(n.parAnnee['2026'].retraitsCadConfirmes).toBe(5000);   // il est vu, mais pas compté dans les droits
    for (const d of comparer(lignes)) expect(d.classe, d.champ).toBe('parite');
  });

  it('D · cotisations et retraits sur plusieurs années', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000, date: '2022-03-01' }),
      tx({ type: 'Retrait', noCompte: CELI, total: -2000, date: '2023-05-01' }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 6500, date: '2024-03-01' }),
      tx({ type: 'Retrait', noCompte: CELI, total: -1000, date: '2025-05-01' }),
    ];
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(12500);
    expect(n.retraitsAnneesPassees.min).toBe(3000);
    for (const d of comparer(lignes)) expect(d.classe, d.champ).toBe('parite');
  });
});

// ═══ E à H · LA DEVISE ═══════════════════════════════════════════════════════

describe('devise étrangère — jamais un chiffre ferme sans équivalent CAD', () => {
  const usd = () => tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 5000, date: '2024-02-01' });

  it('E · cotisation USD sans montant CAD : rien de ferme, et l’ancien D5 est classé', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }), usd()];
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(7000);                    // les 5 000 USD n'entrent PAS
    expect(n.statut).toBe('montant-a-confirmer');
    expect(n.completude.devisesNonResolues).toBe(true);
    expect(n.donneesManquantes.some((d) => d.includes('dollars canadiens'))).toBe(true);
    // R · l'ancien fondait : 12 000 au nominal. Divergence VOULUE, classée.
    expect(ancien(lignes).cotisationsTotales).toBe(12000);
    const d = comparer(lignes).find((x) => x.champ === 'cotisationsTotales')!;
    expect(d.classe).toBe('bug-ancien-corrige');
    expect(d.motif).toMatch(/D5/);
  });

  it('F · cotisation USD résolue à la main : le montant CAD entre dans le ferme', () => {
    const lignes = [usd()];
    const cle = cleEvenementFiscal(CELI, '2024-02-01', 'USD', 5000);
    const n = nouveau(lignes, ctxPropre(), [{ cleEvenement: cle, montantCad: 6800, dateResolution: '2026-08-20', note: null }]);
    expect(n.cotisations.min).toBe(6800);
    expect(n.completude.devisesNonResolues).toBe(false);
    expect(n.statut).toBe('calcule');
  });

  it('G · retrait USD sans montant CAD : aucun droit recréé ferme', () => {
    const lignes = [tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -4000, date: '2024-06-01' })];
    const n = nouveau(lignes);
    expect(n.retraitsAnneesPassees.min).toBe(0);             // JAMAIS un droit recréé sur un montant inconnu
    expect(n.statut).toBe('montant-a-confirmer');
    expect(n.completude.devisesNonResolues).toBe(true);
  });

  it('H · retrait USD résolu ET de nature ferme : utilisable', () => {
    const lignes = [tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -4000, date: '2024-06-01' })];
    const cle = cleEvenementFiscal(CELI, '2024-06-01', 'USD', -4000);
    const n = nouveau(lignes, ctxPropre(), [{ cleEvenement: cle, montantCad: 5400, dateResolution: '2026-08-20', note: null }]);
    expect(n.retraitsAnneesPassees.min).toBe(5400);
    expect(n.statut).toBe('calcule');
  });
});

// ═══ I et J · MONTANT ET NATURE, ORTHOGONAUX DANS LES DEUX SENS ══════════════

describe('montant et nature — les deux doivent être fermes', () => {
  it('I · montant connu, nature ambiguë : pas ferme', () => {
    const lignes = [tx({ type: 'Transfert', noCompte: CELI, total: -5000, date: '2024-06-01', note: 'TRANSFERE A 37ZZZZK' })];
    const n = nouveau(lignes);
    expect(n.retraitsAnneesPassees.min).toBe(0);
    expect(n.retraitsAnneesPassees.max).toBe(5000);          // il vit dans la BORNE
    expect(n.completude.naturesNonResolues).toBe(true);
    expect(n.statut).toBe('montant-a-confirmer');
  });

  it('J · nature ferme, montant inconnu : pas ferme non plus', () => {
    const lignes = [
      tx({ type: 'Transfert', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -4000, date: '2024-06-01', note: 'TRANSFERE A 37FICTE' }),
      tx({ type: 'Transfert', noCompte: MARGE, symbole: '1USD', devise: 'USD', total: 4000, date: '2024-06-01', note: 'VIRE DE 37FICTW' }),
    ];
    const n = nouveau(lignes);
    expect(n.retraitsAnneesPassees.min).toBe(0);
    expect(n.completude.devisesNonResolues).toBe(true);
    expect(n.statut).toBe('montant-a-confirmer');
  });

  it('K · virement orphelin : à confirmer, jamais ferme', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: CELI, total: 5000, date: '2024-02-01', note: 'VIRE DE 37ZZZZK' })];
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(0);
    expect(n.cotisations.max).toBe(5000);
    expect(n.statut).toBe('montant-a-confirmer');
    // et la divergence avec l'ancien est une prudence, pas une régression
    const d = comparer(lignes).find((x) => x.champ === 'cotisationsTotales')!;
    expect(['ambiguite-volontaire', 'parite']).toContain(d.classe);
  });
});

// ═══ L et M · LES ÉCRITURES COMPTABLES ══════════════════════════════════════

describe('« Valeur comptable » — bloque ou non selon la preuve d’innocuité', () => {
  const vc = (over: Partial<LigneTransaction>) =>
    tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 10, date: '2024-04-01', ...over });

  it('L · groupe NON équilibré : bloque le ferme', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }),
      vc({ total: -30000 }), vc({ symbole: '1CAD', quantite: 0, total: 21000 }),
    ];
    const n = nouveau(lignes);
    expect(n.statut).toBe('montant-a-confirmer');
    expect(n.completude.evenementsBloquants).toBe(2);
    expect(n.raisons.some((r) => r.includes('changer le résultat'))).toBe(true);
    expect(n.cotisations.min).toBe(7000);                    // le montant ferme, lui, ne bouge pas
  });

  it('M · groupe équilibré : ne bloque pas', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }),
      vc({ total: -12000 }), vc({ symbole: '1CAD', quantite: 0, total: 12000 }),
    ];
    const n = nouveau(lignes);
    expect(n.completude.evenementsBloquants).toBe(0);
    expect(n.statut).toBe('calcule');
  });
});

// ═══ N à Q · PORTÉE, ANNÉE DE NAISSANCE, DOSSIER COMPLET ════════════════════

describe('portée et données fondamentales', () => {
  const propre = () => [tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' })];

  it('N · le client a DÉJÀ EU un CELI ailleurs : aucun montant global ferme', () => {
    const n = nouveau(propre(), ctxPropre({ historiqueExterne: 'deja-eu' }));
    expect(n.statut).toBe('montant-a-confirmer');
    expect(n.raisons.some((r) => r.includes('déjà eu'))).toBe(true);
    expect(n.cotisations.min).toBe(7000);                    // l'arithmétique reste juste…
  });

  it('O · comptes externes inconnus : aucun montant global ferme (§20)', () => {
    for (const rep of ['oui', 'inconnu'] as const) {
      const n = nouveau(propre(), ctxPropre({ comptesExternes: rep }));
      expect(n.statut, rep).toBe('montant-a-confirmer');
      expect(n.raisons.some((r) => r.includes('portée')), rep).toBe(true);
    }
  });

  it('O bis · historique externe « inconnu » : pas ferme non plus', () => {
    const n = nouveau(propre(), ctxPropre({ historiqueExterne: 'inconnu' }));
    expect(n.statut).toBe('montant-a-confirmer');
    expect(n.donneesManquantes.some((d) => d.includes('jamais été détenu ailleurs'))).toBe(true);
  });

  it('P · année de naissance manquante : indisponible, jamais inférée', () => {
    const n = nouveau(propre(), ctxPropre({ plafondCumulatif: null }));
    expect(n.statut).toBe('indisponible');
    expect(n.donneesManquantes).toContain('l’année de naissance du client');
    expect(n.droitMinimum).toBeNull();
    expect(n.droitMaximum).toBeNull();
  });

  it('Q · toutes les données complètes : « calcule »', () => {
    const n = nouveau(propre());
    expect(n.statut).toBe('calcule');
    expect(n.raisons).toEqual([]);
    expect(n.droitMinimum).toBe(PLAFOND - 7000);
    expect(n.droitMaximum).toBe(PLAFOND - 7000);             // aucune incertitude : les bornes se rejoignent
  });
});

// ═══ S · LES BORNES ══════════════════════════════════════════════════════════

describe('bornes min/max — dans la direction connue de l’incertitude', () => {
  it('S · une cotisation à confirmer pousse le MINIMUM, un retrait à confirmer pousse le MAXIMUM', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 3000, date: '2024-03-01', note: 'VIRE DE 37ZZZZK' }),   // à confirmer
      tx({ type: 'Retrait', noCompte: CELI, total: -2000, date: '2024-06-01', note: 'TRANSFERE A 37ZZZZK' }), // à confirmer
    ];
    const n = nouveau(lignes);
    expect(n.cotisations).toEqual({ min: 7000, max: 10000 });
    expect(n.retraitsAnneesPassees).toEqual({ min: 0, max: 2000 });
    // droit min = plafond − cotisationsMax ; droit max = plafond − cotisationsMin + retraitsMax
    expect(n.droitMinimum).toBe(PLAFOND - 10000);
    expect(n.droitMaximum).toBe(PLAFOND - 7000 + 2000);
    expect(n.droitMinimum as number).toBeLessThan(n.droitMaximum as number);
  });

  it('aucune borne INVENTÉE : une devise non résolue rend les bornes nulles', () => {
    const lignes = [
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 5000, date: '2024-03-01' }),
    ];
    const n = nouveau(lignes);
    expect(n.droitMinimum).toBeNull();
    expect(n.droitMaximum).toBeNull();
  });
});

// ═══ T · LA RÉSOLUTION NE TOUCHE JAMAIS LA SOURCE ═══════════════════════════

describe('résolutions manuelles', () => {
  it('T · une résolution ne modifie jamais la transaction source', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 5000, date: '2024-02-01' })];
    const avant = JSON.stringify(lignes);
    const cle = cleEvenementFiscal(CELI, '2024-02-01', 'USD', 5000);
    const n = nouveau(lignes, ctxPropre(), [{ cleEvenement: cle, montantCad: 6800, dateResolution: '2026-08-20', note: null }]);
    expect(n.cotisations.min).toBe(6800);
    expect(JSON.stringify(lignes)).toBe(avant);
  });
});

// ═══ L'INVARIANT TRANSVERSAL ════════════════════════════════════════════════

describe('invariant — aucun « calcule » quand quoi que ce soit reste ouvert', () => {
  const cas: Array<[string, LigneTransaction[], ContexteDroitsCeli]> = [
    ['devise non résolue', [tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 5000, date: '2024-02-01' })], ctxPropre()],
    ['nature ambiguë', [tx({ type: 'Transfert', noCompte: CELI, total: -5000, date: '2024-06-01', note: 'TRANSFERE A 37ZZZZK' })], ctxPropre()],
    ['inconnu porteur d’un montant', [tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 1, total: -9000, date: '2024-04-01' })], ctxPropre()],
    ['portée externe ouverte', [tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' })], ctxPropre({ comptesExternes: 'inconnu' })],
    ['plafond inconnu', [tx({ type: 'Cotisation', noCompte: CELI, total: 7000, date: '2024-02-01' })], ctxPropre({ plafondCumulatif: null })],
  ];
  for (const [nom, lignes, ctx] of cas) {
    it(`${nom} → jamais « calcule »`, () => {
      expect(nouveau(lignes, ctx).statut).not.toBe('calcule');
    });
  }

  it('un inconnu ne devient JAMAIS zéro : il est compté et chiffré', () => {
    const n = nouveau([tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 1, total: -9000, date: '2024-04-01' })]);
    expect(n.completude.evenementsBloquants).toBe(1);
    expect(n.completude.montantPotentielRetrait).toBe(9000);
    expect(n.raisons.some((r) => r.includes('9000.00 $'))).toBe(true);
  });
});

// ═══ LA RÉGRESSION QUE LA COMPARAISON A ATTRAPÉE ════════════════════════════
//
// La parité sur la base réelle a sorti UNE divergence `regression`. Elle était
// vraie : une ligne « Retrait » au montant POSITIF, appariée à une contrepartie
// non enregistrée, devenait une COTISATION FERME. Le libellé disait sortie, le
// montant disait entrée — et le nouveau code choisissait le montant.
describe('cohérence libellé ↔ signe — une ligne qui se contredit n’est jamais ferme', () => {
  const contradictoire = (type: string, total: number) => [
    tx({ type, noCompte: CELI, total, date: '2024-06-01', note: 'VIRE DE 37FICTE' }),
    tx({ type, noCompte: MARGE, total: -total, date: '2024-06-01' }),
  ];

  it('« Retrait » POSITIF apparié : indéterminé, jamais une cotisation ferme', () => {
    const lignes = contradictoire('Retrait', 9000);
    const t = construireLigneDuTemps(lignes);
    expect(t.relationsVirements[0].effet).toBe('indetermine');
    expect(t.relationsVirements[0].motif).toMatch(/se contredit/);
    const n = nouveau(lignes);
    expect(n.cotisations.min).toBe(0);
    expect(n.statut).toBe('montant-a-confirmer');
    // et la parité avec l'ancien est rétablie
    for (const d of comparer(lignes)) expect(d.classe, d.champ).not.toBe('regression');
  });

  it('« Cotisation » NÉGATIVE appariée : indéterminée aussi', () => {
    const t = construireLigneDuTemps(contradictoire('Cotisation', -9000));
    expect(t.relationsVirements[0].effet).toBe('indetermine');
  });

  it('NÉGATIF ADJACENT — un « Retrait » NÉGATIF apparié reste bien ferme', () => {
    const lignes = [
      tx({ type: 'Retrait', noCompte: CELI, total: -9000, date: '2024-06-01', note: 'TRANSFERE A 37FICTE' }),
      tx({ type: 'Retrait', noCompte: MARGE, total: 9000, date: '2024-06-01' }),
    ];
    const t = construireLigneDuTemps(lignes);
    expect(t.relationsVirements[0].effet).toBe('retrait-celi');
    expect(nouveau(lignes).retraitsAnneesPassees.min).toBe(9000);
  });

  it('un « Transfert » n’annonce aucun sens : les deux signes restent recevables', () => {
    for (const total of [9000, -9000]) {
      const t = construireLigneDuTemps([
        tx({ type: 'Transfert', noCompte: CELI, total, date: '2024-06-01', note: 'VIRE DE 37FICTE' }),
        tx({ type: 'Transfert', noCompte: MARGE, total: -total, date: '2024-06-01' }),
      ]);
      expect(t.relationsVirements[0].effet, String(total)).not.toBe('indetermine');
    }
  });
});
