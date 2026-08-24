// L'ADAPTATEUR DES GAINS — il organise, il ne calcule pas.
//
// Données entièrement fictives, chiffres de la fixture de référence.
import { describe, it, expect } from 'vitest';
import {
  construirePresentationCristallisationGains, TITRE_PRESENTATION,
} from '../presentation-cristallisation-gains';
import type { Constat } from '@/lib/profils/strategies';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';

function constat(p: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-gains', titre: 'T',
    titreClient: 'Récolter des gains sans payer d’impôt',
    statut: 'calcule', portee: 'declaree', montantEstime: 12000,
    libelleMontant: 'de gain cristallisable sans impôt', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false,
    gainsLatentsCad: 28900, pertesDisponiblesCad: 12000, ...p,
  } as Constat;
}
function ligne(p: Partial<LigneExecution> = {}): LigneExecution {
  return {
    positionId: 'FICT-A|FICT', compteId: 'FICT-A', symbole: 'FICT',
    description: 'Compagnie Fictive Ltée', typeInstrument: 'Action',
    devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: 340, quantiteAVendre: 141, uniteQuantite: 'unite',
    valeurVenteEstimeeCad: 19740, montantRealiseEstimeCad: 11985,
    montantLatentDisponibleCad: 28900,
    dateValeurs: '2026-08-21', ...p,
  };
}

/** Un plan littéral : les chiffres restent ceux qui ont été inspectés. */
const mono = (p?: Partial<LigneExecution>, o: Partial<PlanExecution> = {}): PlanExecution => ({
  sens: 'gain', cibleCad: 12000, lignes: [ligne(p)],
  valeurVenteTotaleCad: 19740, montantRealiseTotalCad: 11985,
  ecartCad: -15, cibleRestanteCad: 15,
  capaciteCouvreCible: true, executionCouvreEntierementCible: false,
  monoTitre: true, gainNetApresCad: null, rechercheTronquee: false, refus: [], ...o,
});

/** Le plan à DEUX titres — pour prouver que les lignes traversent l'adaptateur. */
const multi = (): PlanExecution => ({
  ...mono(),
  cibleCad: 20000, monoTitre: false,
  lignes: [
    ligne(),
    ligne({
      positionId: 'FICT-A|SECO', symbole: 'SECO', description: 'Seconde Fictive Ltée',
      quantiteDetenue: 400, quantiteAVendre: 292,
      valeurVenteEstimeeCad: 32120, montantRealiseEstimeCad: 8030,
      montantLatentDisponibleCad: 11000,
    }),
  ],
  // ⚠ « CAPACITÉ COUVRE, EXÉCUTION NON » — l'état EXACT où la phrase
  // « ce titre possède assez de gain latent » apparaîtrait à tort. Avec
  // `executionCouvreEntierementCible: true`, la condition tombait de toute
  // façon et le sabotage restait vert : la fixture ne discriminait rien.
  valeurVenteTotaleCad: 51860, montantRealiseTotalCad: 19985,
  ecartCad: -15, cibleRestanteCad: 15,
  capaciteCouvreCible: true, executionCouvreEntierementCible: false,
});

/** L'action FERME, avec la garantie qu'il n'y a qu'une ligne à lire. */
function seule(p: ReturnType<typeof faire>): LigneExecution {
  const a = p.etape3.action;
  if (a.type !== 'ferme') throw new Error('non ferme');
  // ⚠ ON VÉRIFIE LE COMPTE AVANT DE LIRE `lignes[0]` : un plan multi ne doit
  // jamais passer pour un mono dans un test.
  expect(a.lignes).toHaveLength(1);
  return a.lignes[0];
}

const faire = (c = constat(), m: PlanExecution | null = mono()) =>
  construirePresentationCristallisationGains(c, m);

// ═══════════════════════════════════════════════════════════════════════════
// LE TITRE — une description, pas une promesse
// ═══════════════════════════════════════════════════════════════════════════

describe('le titre client ne promet pas ce que le contrat ne démontre pas', () => {
  it('« sans payer d’impôt » n’atteint jamais le document', () => {
    // Le catalogue porte cette formule ; elle reste intacte pour ses autres
    // usages. Mais il reste 15 $ de capacité inutilisée sur le cas de
    // référence, et rien ne garantit une absorption totale.
    const p = faire();
    expect(p.titre).toBe(TITRE_PRESENTATION);
    expect(JSON.stringify(p)).not.toMatch(/sans payer d.impôt/i);
    expect(p.sousTitre).toMatch(/pertes fiscales disponibles/);
  });

  it('le titre historique du catalogue n’est pas modifié', () => {
    const c = constat();
    faire(c);
    expect(c.titreClient).toBe('Récolter des gains sans payer d’impôt');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES CINQ ÉTAPES
// ═══════════════════════════════════════════════════════════════════════════

describe('les données de chaque étape viennent du moteur', () => {
  it('étape 1 · ce qui est disponible', () => {
    const p = faire();
    expect(p.etape1.pertesDisponiblesCad).toBe(12000);
    expect(p.etape1.gainsLatentsCad).toBe(28900);
  });

  it('étape 2 · la cible EST `montantEstime`, jamais un min() refait', () => {
    // ⚠ CONTEXTE PIÉGEUX : `min(28 900, 12 000)` donnerait 12 000 par
    // coïncidence. On force donc un `montantEstime` que ce min NE donne PAS.
    const p = faire(constat({ montantEstime: 7500 }));
    expect(p.etape2.cibleGainCad).toBe(7500);
    expect(p.etape2.cibleGainCad).not.toBe(12000);
  });

  it('étape 3 · le plan moteur, repris tel quel', () => {
    const p = faire();
    expect(p.etape3.action.type).toBe('ferme');
    const l = seule(p);
    expect(l.quantiteAVendre).toBe(141);
    expect(l.montantRealiseEstimeCad).toBe(11985);
    if (p.etape3.action.type === 'ferme') expect(p.etape3.action.ecartCad).toBe(-15);
    expect(p.etape3.symbole).toBe('FICT');
    expect(p.etape3.description).toBe('Compagnie Fictive Ltée');
  });

  it('étape 3 · capacité ≠ exécution se dit en français', () => {
    // Deux booléens laissés au composant seraient illisibles.
    const p = faire();
    expect(p.etape3.precisionGranularite).toMatch(/assez de gain latent/);
    expect(p.etape3.precisionGranularite).toMatch(/15,00 \$ de capacité inutilisée/);
  });

  it('exécution COMPLÈTE : aucune précision de granularité à donner', () => {
    const p = faire(constat(), mono(undefined, {
      cibleRestanteCad: 0, ecartCad: 10, executionCouvreEntierementCible: true,
    }));
    expect(p.etape3.precisionGranularite).toBeNull();
  });

  it('étape 4 · les trois jalons, dont la cible restante', () => {
    const p = faire();
    expect(p.etape4.gainRealiseEstimeCad).toBe(11985);
    expect(p.etape4.pertesDisponiblesCad).toBe(12000);
    expect(p.etape4.cibleRestanteCad).toBe(15);
  });

  it('étape 5 · « capacité encore disponible » dit ce que le champ signifie', () => {
    const p = faire();
    expect(p.etape5.capaciteEncoreDisponibleCad).toBe(15);
    expect(p.etape5.gainRealiseEstimeCad).toBe(11985);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES 15 $ NE DISPARAISSENT JAMAIS
// ═══════════════════════════════════════════════════════════════════════════

describe('aucun maquillage de l’écart', () => {
  it('11 985 ne devient pas 12 000, et −15 ne devient pas 0', () => {
    const p = faire();
    const t = JSON.stringify(p);
    expect(t).toMatch(/11985/);
    expect(p.etape4.cibleRestanteCad).toBe(15);
    if (p.etape3.action.type === 'ferme') {
      expect(p.etape3.action.montantRealiseTotalCad).not.toBe(12000);
      expect(p.etape3.action.ecartCad).not.toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STATUTS DÉGRADÉS
// ═══════════════════════════════════════════════════════════════════════════

describe('aucune action ferme hors de `calcule`', () => {
  for (const statut of ['montant-a-confirmer', 'indisponible', 'non-applicable'] as const) {
    it(`${statut} : la variante ferme n’existe pas`, () => {
      const p = faire(constat({
        statut, montantEstime: null,
        donneesManquantes: ['la liste des positions détenues ailleurs'],
      }), mono());
      expect(p.etape3.action.type, statut).toBe('a-confirmer');
      expect(JSON.stringify(p.etape3), statut).not.toMatch(/141/);
      expect(p.etape2.cibleGainCad, statut).toBeNull();
      expect(p.etape4.gainRealiseEstimeCad, statut).toBeNull();
      expect(p.etape5.capaciteEncoreDisponibleCad, statut).toBeNull();
      expect(p.etape3.precisionGranularite, statut).toBeNull();
    });
  }

  it('les grandeurs de CONTEXTE survivent au statut dégradé', () => {
    // C'est là qu'elles servent : dire ce qui existe quand le chiffre ferme
    // est impossible.
    const p = faire(constat({ statut: 'montant-a-confirmer', montantEstime: null }), mono());
    expect(p.etape1.pertesDisponiblesCad).toBe(12000);
    expect(p.etape1.gainsLatentsCad).toBe(28900);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USD, ET AUCUNE FISCALITÉ INVENTÉE
// ═══════════════════════════════════════════════════════════════════════════

describe('USD et interdits fiscaux', () => {
  it('un titre USD à montants CAD garde les deux notions', () => {
    const p = faire(constat(), mono({ devise: 'USD', uniteValeursRapport: 'CAD' }));
    expect(p.etape3.deviseNegociation).toBe('USD');
    expect(p.etape3.uniteValeursRapport).toBe('CAD');
    expect(p.etape3.action.type).toBe('ferme');
  });

  it('aucune économie d’impôt, aucun taux d’inclusion, aucun zéro impôt garanti', () => {
    const interdits = [
      /économie d.impôt/i, /impôt économisé/i, /taux marginal/i, /revenu imposable/i,
      /taux d.inclusion/i, /\b50\s*%/, /\b2\/3\b/, /aucun impôt/i, /zéro impôt/i,
    ];
    for (const c of [constat(), constat({ statut: 'indisponible', montantEstime: null })]) {
      const t = JSON.stringify(faire(c));
      for (const i of interdits) expect(t, i.source).not.toMatch(i);
    }
  });

  it('aucun glyphe absent des polices embarquées dans les textes produits', () => {
    // ⚠ TROISIÈME CONTRAINTE DE RENDU, née d'un vrai bug : « ↓ » (U+2193)
    // sortait en petits guillemets, comme U+26A0 en carré vide.
    const t = JSON.stringify(faire());
    for (const glyphe of ['↓', '↑', '→', '←', '⚠', '✓']) {
      expect(t, glyphe).not.toContain(glyphe);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE PLAN MULTI TRAVERSE L'ADAPTATEUR SANS PERDRE UNE LIGNE
// ═══════════════════════════════════════════════════════════════════════════

describe('un plan à plusieurs titres arrive entier dans l’action', () => {
  it('les DEUX lignes sont là, dans l’ordre du plan', () => {
    // ⚠ C'EST LA RAISON D'ÊTRE DU LOT. L'ancienne forme au singulier obligeait
    // l'adaptateur à choisir un titre — donc à décider, ce qui n'est pas son
    // rôle — et la ligne écartée disparaissait sans trace.
    const p = faire(constat({ montantEstime: 20000 }), multi());
    const a = p.etape3.action;
    expect(a.type).toBe('ferme');
    if (a.type !== 'ferme') throw new Error('non ferme');
    expect(a.lignes).toHaveLength(2);
    expect(a.lignes.map((l) => l.symbole)).toEqual(['FICT', 'SECO']);
    expect(a.lignes.map((l) => l.quantiteAVendre)).toEqual([141, 292]);
    expect(a.lignes.map((l) => l.montantRealiseEstimeCad)).toEqual([11985, 8030]);
  });

  it('les totaux sont ceux du PLAN, pas ceux de la première ligne', () => {
    const p = faire(constat({ montantEstime: 20000 }), multi());
    const a = p.etape3.action;
    if (a.type !== 'ferme') throw new Error('non ferme');
    expect(a.montantRealiseTotalCad).toBe(19985);
    expect(a.valeurVenteTotaleCad).toBe(51860);
    expect(a.montantRealiseTotalCad).not.toBe(a.lignes[0].montantRealiseEstimeCad);
    // Et l'étape 4 lit le même total.
    expect(p.etape4.gainRealiseEstimeCad).toBe(19985);
  });

  it('AUCUN titre n’est nommé en multi — pas de faux « titre principal »', () => {
    // Sommer les capacités ou élire la plus grosse ligne fabriquerait une
    // sélection que le plan n'a jamais faite.
    const p = faire(constat({ montantEstime: 20000 }), multi());
    expect(p.etape3.symbole).toBeNull();
    expect(p.etape3.description).toBeNull();
    expect(p.etape3.deviseNegociation).toBeNull();
  });

  it('`precisionGranularite` est MUETTE en multi — elle dit « ce titre »', () => {
    // ⚠ LA PHRASE DÉSIGNE UN TITRE AU SINGULIER. Sur un plan à deux
    // transactions, elle parlerait d'un titre qui n'a pas été choisi.
    const p = faire(constat({ montantEstime: 20000 }), multi());
    expect(p.etape3.precisionGranularite).toBeNull();
    // Et elle reste bien présente en mono, sinon la garde serait creuse.
    expect(faire().etape3.precisionGranularite).toMatch(/assez de gain latent/);
  });
});
