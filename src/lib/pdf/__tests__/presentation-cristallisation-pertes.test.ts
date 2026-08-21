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
import type {
  MeilleurMono, PropositionCristallisationPosition,
} from '@/lib/profils/quantite-a-vendre';

function constat(p: Partial<Constat> = {}): Constat {
  return {
    strategie: 'cristallisation-pertes', titre: 'T', titreClient: 'TC',
    statut: 'calcule', portee: 'declaree', montantEstime: 8997.81,
    libelleMontant: 'de perte à cristalliser', recurrence: 'annuel',
    explication: '', donneesManquantes: [], sources: [],
    limiteVisibilite: null, dejaEnOrdre: false, ...p,
  } as Constat;
}

function proposition(p: Partial<PropositionCristallisationPosition> = {}): PropositionCristallisationPosition {
  return {
    positionId: 'FICT-A|XYZ', compteId: 'FICT-A', symbole: 'XYZ',
    typeInstrument: 'Action', devise: 'CAD', uniteValeursRapport: 'CAD',
    quantiteDetenue: 203, quantiteEstimeeAVendre: 118, uniteQuantite: 'unite',
    perteLatenteDisponibleCad: 15537.41, perteParUniteCad: 76.539, valeurParUniteCad: 41.51,
    valeurVenteEstimeeCad: 4898.18, perteRealiseeEstimeeCad: 9031.6,
    cibleGlobaleCad: 8997.81, cibleLocaleCad: 8997.81,
    ecartCad: 33.79, cibleRestanteCad: 0, gainNetApresCad: 0,
    dateValeurs: '2026-08-21', ...p,
  };
}

const mono = (p?: Partial<PropositionCristallisationPosition>): MeilleurMono => ({
  proposition: proposition(p), aucunePositionNeCouvreSeule: false,
  propositions: [proposition(p)], refus: [],
});

const construire = (c = constat(), m: MeilleurMono | null = mono(), g: number | null = 8997.81) =>
  construirePresentationCristallisationPertes(c, m, g);

// ═══════════════════════════════════════════════════════════════════════════
// A1 — LE CAS CALCULÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('A1 · statut calculé', () => {
  it('rend une action FERME, avec les chiffres du moteur', () => {
    const p = construire();
    expect(p.etape3.action.type).toBe('ferme');
    if (p.etape3.action.type !== 'ferme') throw new Error('action non ferme');
    expect(p.etape3.action.quantiteEstimeeAVendre).toBe(118);
    expect(p.etape3.action.uniteQuantite).toBe('unite');
    expect(p.etape3.action.valeurVenteEstimeeCad).toBe(4898.18);
    expect(p.etape3.action.perteRealiseeEstimeeCad).toBe(9031.6);
    expect(p.etape3.action.dateValeurs).toBe('2026-08-21');
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
      expect(JSON.stringify(p.etape3)).not.toMatch(/118/);
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
    const p = construire(constat({ statut: 'montant-a-confirmer', montantEstime: null }),
      { proposition: null, aucunePositionNeCouvreSeule: true, propositions: [], refus: [] });
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
    const p = construire(constat(), mono({ gainNetApresCad: null }));
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
    const p = construire(constat(), mono({
      gainNetApresCad: 15000, ecartCad: 0, perteRealiseeEstimeeCad: 9031.6,
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
      mono({ gainNetApresCad: 15000 }), 20000);
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
