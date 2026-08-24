// L'ADAPTATEUR DE PRÉSENTATION — il organise, il ne calcule pas.
//
// Le test A8 est le plus important du fichier : il injecte des valeurs
// volontairement INCOHÉRENTES et exige qu'elles ressortent telles quelles. Un
// adaptateur qui « corrigerait » au passage serait un second moteur fiscal en
// devenir, avec ses propres arrondis et aucun des garde-fous du premier.
//
// Données entièrement fictives.
import { describe, it, expect } from 'vitest';
import {
  construirePresentationCristallisationPertes, avecDescription,
} from '../presentation-cristallisation-pertes';
import type { Constat } from '@/lib/profils/strategies';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';

function constat(p: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-pertes', titre: 'T', titreClient: 'TC',
    statut: 'calcule', portee: 'declaree', montantEstime: 8997.81,
    libelleMontant: 'de perte à cristalliser', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false, ...p,
  } as Constat;
}

function ligne(p: Partial<LigneExecution> = {}): LigneExecution {
  return {
    positionId: 'FICT-A|XYZ', compteId: 'FICT-A', symbole: 'XYZ',
    description: null, typeInstrument: 'Action', devise: 'CAD',
    uniteValeursRapport: 'CAD',
    quantiteDetenue: 203, quantiteAVendre: 118, uniteQuantite: 'unite',
    valeurVenteEstimeeCad: 4898.18, montantRealiseEstimeCad: 9031.6,
    montantLatentDisponibleCad: 15537.41,
    dateValeurs: '2026-08-21', ...p,
  };
}

/**
 * ⚠ UN PLAN LITTÉRAL, pour que le test A8 garde tout son sens : il injecte des
 * valeurs volontairement INCOHÉRENTES et exige qu'elles ressortent telles
 * quelles. Un plan calculé par le moteur les « corrigerait » avant l'adaptateur,
 * et le test ne prouverait plus rien.
 */
const mono = (p?: Partial<LigneExecution>, o: Partial<PlanExecution> = {}): PlanExecution => ({
  sens: 'perte', cibleCad: 8997.81, lignes: [ligne(p)],
  valeurVenteTotaleCad: 4898.18, montantRealiseTotalCad: 9031.6,
  ecartCad: 33.79, cibleRestanteCad: 0,
  capaciteCouvreCible: true, executionCouvreEntierementCible: true,
  monoTitre: true, gainNetApresCad: 0, rechercheTronquee: false, refus: [], ...o,
});

/** L'action FERME, avec la garantie qu'il n'y a qu'une ligne à lire. */
function seule(p: ReturnType<typeof construire>): LigneExecution {
  const a = p.etape3.action;
  if (a.type !== 'ferme') throw new Error('action non ferme');
  // ⚠ ON VÉRIFIE LE COMPTE AVANT DE LIRE `lignes[0]`. Sans ça, un plan multi
  // passerait pour un mono et le test lirait une ligne pour le tout.
  expect(a.lignes).toHaveLength(1);
  return a.lignes[0];
}

const construire = (c = constat(), m: PlanExecution | null = mono(), g: number | null = 8997.81) =>
  construirePresentationCristallisationPertes(c, m, g);

// ═══════════════════════════════════════════════════════════════════════════
// A1 — LE CAS CALCULÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('A1 · statut calculé', () => {
  it('rend une action FERME, avec les chiffres du moteur', () => {
    const p = construire();
    const p2 = construire();
    expect(p2.etape3.action.type).toBe('ferme');
    const l = seule(p2);
    expect(l.quantiteAVendre).toBe(118);
    expect(l.uniteQuantite).toBe('unite');
    expect(l.valeurVenteEstimeeCad).toBe(4898.18);
    expect(l.montantRealiseEstimeCad).toBe(9031.6);
    expect(l.dateValeurs).toBe('2026-08-21');
  });

  it('les trois barres du graphique sont disponibles', () => {
    const p = construire();
    expect(p.etape4.gainNetAvantCad).toBe(8997.81);
    expect(p.etape4.perteRealiseeEstimeeCad).toBe(9031.6);
    expect(p.etape4.gainNetApresCad).toBe(0);
    expect(p.etape4.apresAffichable).toBe(true);
  });

  it('l’étape 2 donne une raison FISCALE, jamais un avis d’investissement', () => {
    const r = construire().etape2.raisonSelection ?? '';
    expect(r).toMatch(/une seule transaction/);
    for (const interdit of [/meilleur/i, /mauvais/i, /perspective/i, /devrait être vendu/i, /potentiel/i]) {
      expect(r).not.toMatch(interdit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A2 — LES STATUTS DÉGRADÉS
// ═══════════════════════════════════════════════════════════════════════════

describe('A2 · aucune action ferme hors de `calcule`', () => {
  for (const statut of ['montant-a-confirmer', 'indisponible', 'non-applicable'] as const) {
    it(`${statut} : la variante ferme n’existe pas`, () => {
      // ⚠ MÊME AVEC UNE PROPOSITION COMPLÈTE DANS L'OBJET MOTEUR. La sécurité
      // est dans le TYPE : il n'y a pas de champ « quantité » à afficher par
      // mégarde, donc pas de « Vendre 118 actions » possible.
      const p = construire(constat({ statut, montantEstime: null,
        donneesManquantes: ['la liste des positions détenues ailleurs'] }), mono());
      expect(p.etape3.action.type, statut).toBe('a-confirmer');
      // ⚠ AUCUNE LIGNE N'EXISTE sous `a-confirmer` : le TYPE l'interdit, il n'y
      // a littéralement rien à masquer par mégarde.
      expect(JSON.stringify(p.etape3)).not.toMatch(/118/);
      expect(JSON.stringify(p.etape3)).not.toMatch(/lignes/);
      if (p.etape3.action.type === 'a-confirmer') {
        expect(p.etape3.action.raisons).toContain('la liste des positions détenues ailleurs');
      }
      // Le graphique ne fabrique pas d'après non plus.
      expect(p.etape4.apresAffichable, statut).toBe(false);
      expect(p.etape4.gainNetApresCad, statut).toBeNull();
      expect(p.etape5.reductionGainCapitalNetCad, statut).toBeNull();
      expect(p.etape2.raisonSelection, statut).toBeNull();
    });
  }

  it('aucune position retenue : personne n’est nommé', () => {
    const p = construire(constat({ statut: 'montant-a-confirmer', montantEstime: null }), null);
    expect(p.etape1.symbole).toBeNull();
    expect(p.etape2.symbole).toBeNull();
    expect(p.etape2.raisonSelection).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A3 — `gainNetApresCad` null
// ═══════════════════════════════════════════════════════════════════════════

describe('A3 · un après inconnu ne devient jamais zéro', () => {
  it('aucun 0 inventé, aucun texte « environ 0 $ », graphique non affichable', () => {
    const p = construire(constat(), mono(undefined, { gainNetApresCad: null }));
    expect(p.etape4.gainNetApresCad).toBeNull();
    expect(p.etape4.apresAffichable).toBe(false);
    expect(p.etape5.gainNetApresCad).toBeNull();
    expect(p.etape5.texteSecondaire).toBeNull();
    expect(JSON.stringify(p.etape5)).not.toMatch(/environ 0/);
  });

  it('mais un après RÉELLEMENT nul se dit — sinon le test ci-dessus passerait toujours', () => {
    const p = construire();
    expect(p.etape4.apresAffichable).toBe(true);
    expect(p.etape5.texteSecondaire).toMatch(/environ 0 \$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A4 / A5 / A6 — USD, DESCRIPTION, ÉCART
// ═══════════════════════════════════════════════════════════════════════════

describe('A4 · un titre USD dont les montants sont en CAD', () => {
  it('conserve les DEUX notions, sans dégrader', () => {
    const p = construire(constat(), mono({ devise: 'USD', uniteValeursRapport: 'CAD' }));
    expect(p.etape1.deviseNegociation).toBe('USD');
    expect(p.etape1.uniteValeursRapport).toBe('CAD');
    expect(p.etape3.action.type).toBe('ferme');
  });
});

describe('A5 · le symbole et la description traversent tels quels', () => {
  it('aucun enrichissement, aucune source externe', () => {
    const p = avecDescription(construire(), 'Compagnie Fictive Ltée');
    expect(p.etape1.symbole).toBe('XYZ');
    expect(p.etape1.description).toBe('Compagnie Fictive Ltée');
    // Sans description fournie, le champ reste nul — jamais devine.
    expect(construire().etape1.description).toBeNull();
  });
});

describe('A6 · l’écart est repris au centième près', () => {
  it('33,79 reste 33,79', () => {
    const p = construire();
    expect(p.etape4.ecartCad).toBe(33.79);
    if (p.etape3.action.type === 'ferme') expect(p.etape3.action.ecartCad).toBe(33.79);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A7 — AUCUN IMPÔT INVENTÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('A7 · rien qui ressemble à une économie d’impôt', () => {
  it('aucune formulation fiscale non validée dans les textes produits', () => {
    const interdits = [
      /économie d.impôt/i, /impôt économisé/i, /taux marginal/i,
      /revenu imposable/i, /taux d.inclusion/i, /\b50\s*%/, /\b2\/3\b/,
      /vous économisez/i,
    ];
    for (const c of [constat(), constat({ statut: 'montant-a-confirmer', montantEstime: null })]) {
      const texte = JSON.stringify(construire(c));
      for (const i of interdits) expect(texte, i.source).not.toMatch(i);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A8 — LE TEST D'ARCHITECTURE : l'adaptateur FAIT CONFIANCE au moteur
// ═══════════════════════════════════════════════════════════════════════════

describe('A8 · des valeurs incohérentes ressortent telles quelles', () => {
  it('ne « corrige » rien, si tentant que ce soit', () => {
    // ⚠ CES CHIFFRES SONT VOLONTAIREMENT ABSURDES. 20 000 − 9 031,60 ne fait
    // pas 15 000, et l'écart n'est pas 0. Un adaptateur qui recalculerait —
    // « juste ce petit écart » — deviendrait en trois lots un second moteur
    // fiscal, avec ses propres arrondis et aucun garde-fou. Il doit recopier.
    const p = construire(constat(), mono(undefined, {
      gainNetApresCad: 15000, ecartCad: 0, montantRealiseTotalCad: 9031.6,
    }), 20000);

    expect(p.etape4.gainNetAvantCad).toBe(20000);
    expect(p.etape4.perteRealiseeEstimeeCad).toBe(9031.6);
    expect(p.etape4.gainNetApresCad).toBe(15000);   // PAS 10 968,40
    expect(p.etape4.ecartCad).toBe(0);              // PAS +33,79
    expect(p.etape5.gainNetApresCad).toBe(15000);
  });

  it('la réduction du gain net est LUE, jamais dérivée de avant − après', () => {
    // `montantEstime` est la grandeur métier. Si l'adaptateur faisait
    // `20 000 − 15 000`, il rendrait 5 000 au lieu de 8 997,81.
    const p = construire(constat({ montantEstime: 8997.81 }),
      mono(undefined, { gainNetApresCad: 15000 }), 20000);
    expect(p.etape5.reductionGainCapitalNetCad).toBe(8997.81);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LES VALIDATIONS AVANT EXÉCUTION
// ═══════════════════════════════════════════════════════════════════════════

describe('validations · « confirmé » exige une donnée affirmative', () => {
  it('rien n’est coché faute de motif contraire', () => {
    // Cocher parce qu'aucun drapeau n'est levé serait un faux vert : la perte
    // apparente ne se prouve pas par l'absence d'un signal.
    const v = construire().validationsAvantExecution;
    expect(v.length).toBeLessThanOrEqual(3);
    expect(v.every((x) => x.statut === 'a-confirmer')).toBe(true);
    expect(v.map((x) => x.libelle).join(' ')).toMatch(/perte apparente/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A9 — LE PLAN MULTI TRAVERSE L'ADAPTATEUR SANS PERDRE UNE LIGNE
// ═══════════════════════════════════════════════════════════════════════════

describe('A9 · un plan à plusieurs titres arrive entier', () => {
  const planMulti = (): PlanExecution => ({
    ...mono(),
    cibleCad: 12000, monoTitre: false,
    lignes: [
      ligne({ symbole: 'AAA', quantiteDetenue: 310, quantiteAVendre: 310,
        valeurVenteEstimeeCad: 12400, montantRealiseEstimeCad: 8600,
        montantLatentDisponibleCad: 8600 }),
      ligne({ positionId: 'FICT-A|BBB', symbole: 'BBB', quantiteDetenue: 163,
        quantiteAVendre: 176, valeurVenteEstimeeCad: 8798.53,
        montantRealiseEstimeCad: 3401.23, montantLatentDisponibleCad: 3150 }),
    ],
    valeurVenteTotaleCad: 21198.53, montantRealiseTotalCad: 12001.23,
    ecartCad: 1.23, cibleRestanteCad: 0, gainNetApresCad: 0,
  });

  it('les DEUX lignes sont là, dans l’ordre du plan', () => {
    const p = construire(constat({ montantEstime: 12000 }), planMulti(), 12000);
    const a = p.etape3.action;
    expect(a.type).toBe('ferme');
    if (a.type !== 'ferme') throw new Error('non ferme');
    expect(a.lignes).toHaveLength(2);
    expect(a.lignes.map((l) => l.symbole)).toEqual(['AAA', 'BBB']);
    expect(a.lignes.map((l) => l.quantiteAVendre)).toEqual([310, 176]);
  });

  it('les totaux viennent du PLAN, jamais de la première ligne', () => {
    const p = construire(constat({ montantEstime: 12000 }), planMulti(), 12000);
    const a = p.etape3.action;
    if (a.type !== 'ferme') throw new Error('non ferme');
    expect(a.montantRealiseTotalCad).toBe(12001.23);
    expect(a.montantRealiseTotalCad).not.toBe(a.lignes[0].montantRealiseEstimeCad);
    expect(p.etape4.perteRealiseeEstimeeCad).toBe(12001.23);
  });

  it('AUCUN titre n’est nommé en multi — mais l’étape 2 ne se tait plus', () => {
    // ⚠ CE TEST EXIGEAIT `raisonSelection === null` EN MULTI, ET C'ÉTAIT UNE
    // ERREUR VUE SUR PDF. Le `null` faisait tomber la page dans son repli
    // dégradé : un plan CALCULÉ de cinq transactions affichait « Le titre à
    // retenir sera déterminé une fois les données du dossier confirmées »,
    // c'est-à-dire que le document réclamait les données qu'il venait
    // d'utiliser. Se taire n'était pas neutre — c'était affirmer autre chose.
    //
    // Ce que la garde protège vraiment reste intact : AUCUN TITRE N'EST NOMMÉ.
    const p = construire(constat({ montantEstime: 12000 }), planMulti(), 12000);
    expect(p.etape1.symbole).toBeNull();
    expect(p.etape1.perteLatenteDisponibleCad).toBeNull();
    expect(p.etape2.symbole).toBeNull();
    expect(p.etape2.couvreSeuleLaCible).toBe(false);

    const raison = p.etape2.raisonSelection ?? '';
    expect(raison).toMatch(/Aucune position ne porte seule/);
    // ⚠ « cette position suffit à elle seule » serait FAUX sur deux transactions.
    expect(raison).not.toMatch(/une seule transaction/);
    // Et surtout : la phrase multi ne nomme AUCUN des symboles du plan.
    for (const l of planMulti().lignes) expect(raison).not.toContain(l.symbole);

    // Et en mono, la phrase mono est bien là — sinon la garde serait creuse.
    expect(construire().etape2.raisonSelection).toMatch(/une seule transaction/);
  });

  it('`gainNetApresCad` est LU sur le plan, jamais recalculé', () => {
    // Le plan dit 0 ; un adaptateur qui calculerait `max(0, 12000 − 12001,23)`
    // trouverait 0 lui aussi. On force donc une valeur que le calcul NE
    // donnerait PAS, et on exige qu'elle ressorte telle quelle.
    const p = construire(constat({ montantEstime: 12000 }),
      { ...planMulti(), gainNetApresCad: 4242 }, 12000);
    expect(p.etape4.gainNetApresCad).toBe(4242);
    expect(p.etape5.gainNetApresCad).toBe(4242);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A10 — L'ÉTAPE 1 TRANSPORTE, ELLE NE RETOUCHE PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('A10 · les valeurs de la ligne ressortent telles quelles', () => {
  it('aucune retouche entre la ligne du plan et l’étape 1', () => {
    // ⚠ SABOTAGE QUI RESTAIT VERT : multiplier `montantLatentDisponibleCad`
    // par 1,1 dans l'adaptateur ne faisait rougir personne. Un adaptateur qui
    // « ajuste » un chiffre devient un second moteur, et c'est exactement la
    // dérive que le test A8 surveille sur les autres champs.
    const l = ligne({ montantLatentDisponibleCad: 15537.41, devise: 'CAD' });
    const pr = construire(constat(), mono({
      montantLatentDisponibleCad: 15537.41, devise: 'CAD',
    }));
    expect(pr.etape1.perteLatenteDisponibleCad).toBe(l.montantLatentDisponibleCad);
    expect(pr.etape1.symbole).toBe(l.symbole);
    expect(pr.etape1.compte).toBe(l.compteId);
    expect(pr.etape1.deviseNegociation).toBe(l.devise);
    expect(pr.etape1.uniteValeursRapport).toBe(l.uniteValeursRapport);
  });
});
