// L'ASSIETTE FISCALE DES DISPOSITIONS — le régime compte (20 août 2026).
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CE FICHIER VERROUILLE.
//
// `deriverTransactionsAnnee` sommait la colonne « Gains/Pertes » de TOUTES les
// ventes sans regarder le compte — alors qu'elle filtrait déjà les retraits par
// régime six lignes plus bas. Une perte réalisée dans un CELI entrait donc dans
// les « pertes disponibles » de la cristallisation de gains, où elle n'a aucune
// existence fiscale : le moteur invitait à réaliser des gains imposables en les
// croyant abrités. Le miroir était vrai aussi — un gain réalisé dans un REER
// gonflait le « gain net à absorber » de la cristallisation de pertes, et le
// moteur recommandait de vendre à perte pour effacer un impôt inexistant.
//
// Mesuré sur la base locale : 171 des 440 dispositions du livre (39 %) sont
// dans des comptes enregistrés — REER 128, REEE 25, CELI 12, FERR 6.
//
// ⚠ CE QUE CES TESTS N'AFFIRMENT PAS : qu'une disposition non enregistrée soit
// fiscalement ADMISSIBLE. Pertes apparentes (30 jours), transferts en nature
// vers un régime enregistré, personnes affiliées, pertes refusées : rien de
// tout cela n'est vérifié — ce sera le lot de cristallisation. Ici, une seule
// chose est prouvée : une disposition en compte ENREGISTRÉ est certainement
// hors de l'assiette.
//
// Données synthétiques, comptes « FICT ».
import { describe, it, expect } from 'vitest';
import { deriverTransactionsAnnee } from '../deriver';
import { analyser } from '../strategies';
import { profilVierge, type ProfilClient, type Compte, type Position } from '../types';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

const ANNEE = 2026;
const DATE = '2026-08-20';

/** Les comptes par régime — via les VRAIS suffixes, jamais une table parallèle. */
const COMPTE = {
  nonEnregistre: '37-FICT-A',
  celi: '37-FICT-W',
  reer: '37-FICT-S',
  ferr: '37-FICT-T',
  reee: '37-FICT-Z',
  celiapp: '37-FICT-Q',
  inconnu: '37-FICT-X',      // suffixe hors des tables : régime NON PROUVÉ
};

function vente(noCompte: string, gainsPertes: number): LigneTransaction {
  return {
    date: `${ANNEE}-05-15`, dateReglement: `${ANNEE}-05-17`, nom: 'Fictif, Test', note: '',
    type: 'Vente', symbole: 'XYZ', quantite: 100, prix: 10, devise: 'CAD',
    total: 1000, gainsPertes, solde: null, noCompte, description: '',
  };
}
const derive = (lignes: LigneTransaction[]) => deriverTransactionsAnnee(lignes, ANNEE);

// ═══ A à I · CHAQUE RÉGIME, DANS LES DEUX DIRECTIONS ════════════════════════

describe('l’assiette fiscale ne retient que le non-enregistré', () => {
  it('A · perte non enregistrée → CONSERVÉE', () => {
    const t = derive([vente(COMPTE.nonEnregistre, -5000)]);
    expect(t.pertesRealiseesNonEnregistrees).toBe(5000);
    expect(t.gainsRealisesNonEnregistres).toBe(0);
  });

  it('B · gain non enregistré → CONSERVÉ', () => {
    const t = derive([vente(COMPTE.nonEnregistre, 8000)]);
    expect(t.gainsRealisesNonEnregistres).toBe(8000);
    expect(t.pertesRealiseesNonEnregistrees).toBe(0);
  });

  // C à I — les régimes enregistrés, gains ET pertes, un par un.
  const enregistres: Array<[string, string]> = [
    ['C/D · CELI', COMPTE.celi],
    ['E/F · REER', COMPTE.reer],
    ['G · FERR', COMPTE.ferr],
    ['H · REEE', COMPTE.reee],
    ['I · CELIAPP', COMPTE.celiapp],
  ];
  for (const [nom, compte] of enregistres) {
    it(`${nom} · perte ET gain → EXCLUS de l’assiette`, () => {
      const perte = derive([vente(compte, -10000)]);
      expect(perte.pertesRealiseesNonEnregistrees, `${nom} perte`).toBe(0);
      expect(perte.pertesRealisees, `${nom} perte reste dans la performance`).toBe(10000);

      const gain = derive([vente(compte, 10000)]);
      expect(gain.gainsRealisesNonEnregistres, `${nom} gain`).toBe(0);
      expect(gain.gainsRealises, `${nom} gain reste dans la performance`).toBe(10000);

      // Et ils ne sont pas non plus rangés dans « régime indéterminé » :
      // leur régime est parfaitement PROUVÉ — il est simplement enregistré.
      expect(perte.dispositionsRegimeIndetermine.nombre, nom).toBe(0);
    });
  }

  it('J · mélange : non-enregistré −5 000 et CELI −15 000 → perte pertinente = 5 000', () => {
    const t = derive([vente(COMPTE.nonEnregistre, -5000), vente(COMPTE.celi, -15000)]);
    expect(t.pertesRealiseesNonEnregistrees).toBe(5000);
    expect(t.pertesRealisees).toBe(20000);            // la performance, elle, les voit toutes
  });

  it('K · mélange : non-enregistré +10 000 et REER +25 000 → gain pertinent = 10 000', () => {
    const t = derive([vente(COMPTE.nonEnregistre, 10000), vente(COMPTE.reer, 25000)]);
    expect(t.gainsRealisesNonEnregistres).toBe(10000);
    expect(t.gainsRealises).toBe(35000);
  });

  it('L · RÉGIME INCONNU ≠ non-enregistré — jamais assimilé, jamais perdu', () => {
    const t = derive([vente(COMPTE.inconnu, -5000)]);
    expect(t.pertesRealiseesNonEnregistrees).toBe(0);          // PAS dans l'assiette
    expect(t.dispositionsRegimeIndetermine).toEqual({ nombre: 1, gains: 0, pertes: 5000 });
    expect(t.pertesRealisees).toBe(5000);                      // ni oublié
  });

  it('L bis · un gain au régime inconnu se compte à part lui aussi', () => {
    const t = derive([vente(COMPTE.inconnu, 7000)]);
    expect(t.gainsRealisesNonEnregistres).toBe(0);
    expect(t.dispositionsRegimeIndetermine).toEqual({ nombre: 1, gains: 7000, pertes: 0 });
  });

  it('les anciens champs GARDENT leur sens : performance, tous régimes', () => {
    // §4 de la consigne : pas de changement de sens invisible d'un champ générique.
    const t = derive([
      vente(COMPTE.nonEnregistre, 10000), vente(COMPTE.celi, 5000),
      vente(COMPTE.reer, -3000), vente(COMPTE.inconnu, -1000),
    ]);
    expect(t.gainsRealises).toBe(15000);
    expect(t.pertesRealisees).toBe(4000);
    expect(t.gainsRealisesNonEnregistres).toBe(10000);
    expect(t.pertesRealiseesNonEnregistrees).toBe(0);
  });

  it('seules les VENTES portent une disposition — un retrait n’en est pas une', () => {
    const retrait = { ...vente(COMPTE.nonEnregistre, -5000), type: 'Retrait' };
    expect(derive([retrait]).pertesRealiseesNonEnregistrees).toBe(0);
  });

  it('une année étrangère ne compte pas', () => {
    const vieille = { ...vente(COMPTE.nonEnregistre, 9000), date: '2024-05-15' };
    expect(derive([vieille]).gainsRealisesNonEnregistres).toBe(0);
  });
});

// ═══ §11 · LE DÉFAUT EST FERMÉ DES DEUX CÔTÉS ═══════════════════════════════

describe('les deux cristallisations, prouvées séparément', () => {
  const position = (symbole: string, vm: number, pbr: number): Position => ({
    symbole, devise: 'CAD', categorie: null,
    valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
  });
  const compte = (positions: Position[]): Compte => ({
    numero: COMPTE.nonEnregistre, suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, candidats: [COMPTE.nonEnregistre],
    type: 'non-enregistre', titulaire: 'client', dateReleve: DATE, positions, encaisse: [],
  });
  /** Un dossier consolidé, dont l'assiette vient d'un VRAI livre de transactions. */
  const dossier = (lignes: LigneTransaction[], positions: Position[]): ProfilClient => {
    const p = profilVierge('fictif', DATE);
    p.consolidation.comptesExternes = 'non';
    p.consolidation.historiqueExterne = 'jamais';
    p.consolidation.dateConfirmation = DATE;
    p.comptes = [compte(positions)];
    p.transactionsAnnee = derive(lignes);
    return p;
  };
  const constat = (p: ProfilClient, strategie: string) =>
    analyser(p, null, DATE).constats.find((c) => c.strategie === strategie)!;

  it('CRISTALLISATION DE PERTES · un gain réalisé dans un REER n’ouvre AUCUNE récolte', () => {
    const p = dossier([vente(COMPTE.reer, 12000)], [position('PERDANT', 8000, 20000)]);
    const c = constat(p, 'cristallisation-pertes');
    expect(c.montantEstime).toBeNull();
    expect(c.statut).not.toBe('calcule');
    // Le même dossier, le gain réalisé cette fois dans le compte imposable :
    const imposable = dossier([vente(COMPTE.nonEnregistre, 12000)], [position('PERDANT', 8000, 20000)]);
    expect(constat(imposable, 'cristallisation-pertes').montantEstime).toBe(12000);
  });

  it('CRISTALLISATION DE GAINS · une perte réalisée dans un CELI n’absorbe RIEN', () => {
    const p = dossier([vente(COMPTE.celi, -15000)], [position('GAGNANT', 50000, 20000)]);
    const c = constat(p, 'cristallisation-gains');
    expect(c.montantEstime).toBeNull();
    expect(c.statut).not.toBe('calcule');
    // La même perte, cette fois dans le compte imposable : la récolte s'ouvre.
    const imposable = dossier([vente(COMPTE.nonEnregistre, -15000)], [position('GAGNANT', 50000, 20000)]);
    expect(constat(imposable, 'cristallisation-gains').montantEstime).toBe(15000);
  });

  it('LE CAS MESURÉ · un gain enregistré masquait une vraie perte imposable', () => {
    // Vu sur la base réelle : la perte non enregistrée était NOYÉE par un gain
    // réalisé dans un régime enregistré, et la cristallisation de gains
    // affichait « aucune perte disponible ». Elle en avait 3 000.
    const p = dossier(
      [vente(COMPTE.nonEnregistre, -3000), vente(COMPTE.reer, 25000)],
      [position('GAGNANT', 50000, 20000)],
    );
    expect(p.transactionsAnnee.pertesRealiseesNonEnregistrees).toBe(3000);
    expect(constat(p, 'cristallisation-gains').montantEstime).toBe(3000);
  });

  it('un régime INCONNU n’ouvre ni une récolte ni l’autre', () => {
    const gains = dossier([vente(COMPTE.inconnu, -15000)], [position('GAGNANT', 50000, 20000)]);
    expect(constat(gains, 'cristallisation-gains').montantEstime).toBeNull();
    const pertes = dossier([vente(COMPTE.inconnu, 12000)], [position('PERDANT', 8000, 20000)]);
    expect(constat(pertes, 'cristallisation-pertes').montantEstime).toBeNull();
  });
});
