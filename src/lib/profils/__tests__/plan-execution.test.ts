// LE PLAN CANONIQUE — une seule réponse à « combien vendre ».
//
// Ces tests verrouillent la POLITIQUE dans son ordre :
//   1. un seul titre si un seul suffit · 2. sinon plusieurs · 3. le moins
//   possible · 4. puis le plus petit écart · 5. départage stable.
//
// Et l'invariant qui a motivé tout le lot : toute quantité rendue est
// EXÉCUTABLE — action entière, part au millième.
//
// Sociétés fictives.
import { describe, it, expect } from 'vitest';
import { construirePlanExecution, type PlanExecution } from '../plan-execution';
import type { Compte, Position } from '../types';
import { enMilliemes } from '../granularite-vente';

const DATE = '2026-08-23';

const pos = (
  symbole: string, vm: number, pbr: number, quantite: number,
  typeInstrument = 'Action'
): Position => ({
  symbole, devise: 'CAD', categorie: null, uniteValeursRapport: 'CAD',
  typeInstrument, quantite, valeurMarchande: vm, valeurComptable: pbr,
  revenuAnnuel: null,
});

const compte = (numero = '37-FICT-A'): Compte => ({
  numero, suffixe: 'A', provenanceNumero: 'livre', candidats: [numero],
  presence: 'au-releve', derniereActivite: null, dernierSolde: null,
  type: 'non-enregistre', titulaire: 'client', dateReleve: DATE,
  encaisse: [], positions: [],
});

const situer = (positions: Position[], c = compte()) =>
  positions.map((position) => ({ compte: c, position }));

// Pertes latentes : AAA 8 600 · BBB 3 150 · CCC 2 900
const AAA = pos('AAA', 12_400, 21_000, 310);
const BBB = pos('BBB', 8_150, 11_300, 163);
const CCC = pos('CCC', 30_100, 33_000, 700);
// Gains latents : DDD 11 985 · EEE 11 000
const DDD = pos('DDD', 19_740, 7_755, 141);
const EEE = pos('EEE', 44_000, 33_000, 400);

const perte = (cible: number, p = [AAA, BBB, CCC]) =>
  construirePlanExecution('perte', situer(p), cible);
const gain = (cible: number, p = [DDD, EEE]) =>
  construirePlanExecution('gain', situer(p), cible);

// ═══════════════════════════════════════════════════════════════════════════
// PE1 — LA POLITIQUE, DANS SON ORDRE
// ═══════════════════════════════════════════════════════════════════════════

describe('PE1 · un seul titre quand un seul suffit', () => {
  it('cible 5 000 : AAA porte 8 600, il suffit seul', () => {
    const p = perte(5_000);
    expect(p.monoTitre).toBe(true);
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0].symbole).toBe('AAA');
    expect(p.capaciteCouvreCible).toBe(true);
  });

  it('et le titre retenu est celui du plus petit écart, PAS le plus gros', () => {
    // ⚠ CE TEST A ÉTÉ ÉCRIT TROP MOU LA PREMIÈRE FOIS. Il vérifiait
    // `abs(ecart) < 27,74` — vrai pour les deux réponses concurrentes, donc
    // aveugle. Le sabotage « retirer la recherche mono-titre » restait vert.
    //
    // Cible 2 800, les trois titres peuvent seuls :
    //   AAA  27,7419 $/unité → 101 unités = 2 801,93   écart +1,93
    //   BBB  19,3252 $/unité → 145 unités = 2 802,15   écart +2,15
    //   CCC   4,1429 $/unité → 676 unités = 2 800,57   écart +0,57  ← le plus petit
    // La plus grosse CAPACITÉ est AAA. Le plan doit choisir CCC.
    const p = perte(2_800);
    expect(p.monoTitre).toBe(true);
    expect(p.lignes[0].symbole).toBe('CCC');

    // Et il est bien MINIMAL : aucun titre seul ne fait mieux.
    const seuls = [AAA, BBB, CCC].map((x) => Math.abs(perte(2_800, [x]).ecartCad));
    expect(Math.abs(p.ecartCad)).toBe(Math.min(...seuls));
  });
});

describe('PE2 · plusieurs titres seulement quand un seul ne peut pas', () => {
  it('cible 9 000 : aucun titre ne porte 9 000 seul → deux titres', () => {
    // ⚠ C'EST LE CAS QUI CASSAIT TOUT. `meilleurPlanMonoTitre` rendait `null`
    // et la page disait « à confirmer » sur un constat pourtant chiffré.
    const p = perte(9_000);
    expect(p.monoTitre).toBe(false);
    expect(p.lignes.length).toBeGreaterThanOrEqual(2);
    expect(p.capaciteCouvreCible).toBe(true);
    expect(p.lignes.length).toBe(2);      // 8 600 + 3 150 suffit : jamais trois
  });

  it('cible 12 000 : trois titres, parce que deux ne suffisent pas', () => {
    // 8 600 + 3 150 = 11 750 < 12 000. Il faut les trois (14 650).
    const p = perte(12_000);
    expect(p.lignes).toHaveLength(3);
    expect(p.capaciteCouvreCible).toBe(true);
  });

  it('le nombre de lignes est MINIMAL — jamais une position de plus', () => {
    for (const cible of [5_000, 9_000, 12_000]) {
      const p = perte(cible);
      const capacites = [8_600, 3_150, 2_900].sort((a, b) => b - a);
      let k = 0; let cumul = 0;
      while (cumul < cible && k < capacites.length) { cumul += capacites[k]; k++; }
      expect(p.lignes.length, `cible ${cible}`).toBe(k);
    }
  });
});

describe('PE3 · la matière ne suffit pas : on le dit, on n’invente pas', () => {
  it('cible 20 000 sur 14 650 de perte latente', () => {
    const p = perte(20_000);
    expect(p.capaciteCouvreCible).toBe(false);
    expect(p.executionCouvreEntierementCible).toBe(false);
    // On rend quand même le meilleur plan possible, et le reste est explicite.
    expect(p.lignes.length).toBeGreaterThan(0);
    expect(p.cibleRestanteCad).toBeGreaterThan(5_000);
    expect(p.ecartCad).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE4 — TOUTE QUANTITÉ EST EXÉCUTABLE
// ═══════════════════════════════════════════════════════════════════════════

describe('PE4 · aucune quantité inexécutable, jamais', () => {
  const executable = (p: PlanExecution) => {
    for (const l of p.lignes) {
      if (l.uniteQuantite === 'unite') {
        expect(Number.isInteger(l.quantiteAVendre), `${l.symbole} : ${l.quantiteAVendre}`).toBe(true);
      } else {
        // Une part se vend au millième : la quantité doit tomber juste dessus.
        expect(Math.abs(enMilliemes(l.quantiteAVendre) - l.quantiteAVendre * 1000))
          .toBeLessThan(1e-6);
      }
      expect(l.quantiteAVendre).toBeGreaterThan(0);
      expect(l.quantiteAVendre).toBeLessThanOrEqual(l.quantiteDetenue);
    }
  };

  it('sur toutes les cibles, en perte comme en gain', () => {
    for (const c of [500, 1_500, 2_800, 5_000, 9_000, 12_000, 14_650, 20_000]) {
      executable(perte(c));
      executable(gain(c));
    }
  });

  it('les fonds sortent au millième, pas en flottant sale', () => {
    // ⚠ 120,12299999999999 était le vrai symptôme avant `enMilliemes`.
    const fonds = pos('FFF', 50_000, 80_000, 1_204.123, 'Fonds d’investissement');
    const p = construirePlanExecution('perte', situer([fonds]), 10_000);
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0].uniteQuantite).toBe('part');
    expect(String(p.lignes[0].quantiteAVendre)).not.toMatch(/\d{6,}$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE5 — LES QUATRE GRANDEURS SONT CONSERVÉES ET COHÉRENTES
// ═══════════════════════════════════════════════════════════════════════════

describe('PE5 · écart signé, reste jamais négatif, capacité ≠ exécution', () => {
  it('les agrégats sont la somme des lignes, au sou près', () => {
    for (const c of [1_500, 9_000, 12_000]) {
      const p = perte(c);
      const somme = p.lignes.reduce((s, l) => s + l.montantRealiseEstimeCad, 0);
      expect(Math.abs(p.montantRealiseTotalCad - somme), `cible ${c}`).toBeLessThan(0.005);
      expect(p.ecartCad).toBeCloseTo(p.montantRealiseTotalCad - c, 2);
      expect(p.cibleRestanteCad).toBeGreaterThanOrEqual(0);
      if (p.montantRealiseTotalCad >= c) expect(p.cibleRestanteCad).toBe(0);
    }
  });

  it('une exécution sous la cible reste SOUS la cible — aucune tolérance', () => {
    // Le cas de référence des gains : 141 actions = 11 985 pour une cible de
    // 12 000. Il manque 15 $, et le plan le dit au lieu de les gommer.
    const p = gain(12_000, [DDD]);
    expect(p.lignes).toHaveLength(1);
    expect(p.montantRealiseTotalCad).toBe(11_985);
    expect(p.ecartCad).toBe(-15);
    expect(p.cibleRestanteCad).toBe(15);
    expect(p.executionCouvreEntierementCible).toBe(false);
    expect(p.capaciteCouvreCible).toBe(false);   // 11 985 < 12 000
  });

  it('capacité et exécution sont deux questions distinctes', () => {
    // AAA porte 8 600 ≥ 8 500 : la capacité couvre. L'action entière la plus
    // proche peut rester quelques dollars sous — ce sont deux faits différents.
    const p = perte(8_500, [AAA]);
    expect(p.capaciteCouvreCible).toBe(true);
    expect(typeof p.executionCouvreEntierementCible).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE6 — LE RÉSULTAT NE DÉPEND PAS DE L'ORDRE REÇU
// ═══════════════════════════════════════════════════════════════════════════

describe('PE6 · départage canonique stable', () => {
  const empreinte = (p: PlanExecution) =>
    JSON.stringify({
      l: p.lignes.map((x) => [x.symbole, x.quantiteAVendre, x.montantRealiseEstimeCad]),
      e: p.ecartCad, r: p.cibleRestanteCad, m: p.monoTitre,
    });

  it('six permutations, un seul plan', () => {
    const permutations = [
      [AAA, BBB, CCC], [AAA, CCC, BBB], [BBB, AAA, CCC],
      [BBB, CCC, AAA], [CCC, AAA, BBB], [CCC, BBB, AAA],
    ];
    for (const cible of [1_500, 5_000, 9_000, 12_000]) {
      const empreintes = new Set(permutations.map((p) => empreinte(perte(cible, p))));
      expect(empreintes.size, `cible ${cible} : ${[...empreintes].join(' ≠ ')}`).toBe(1);
    }
  });

  it('deux titres rigoureusement équivalents sont départagés par la clé — MONO', () => {
    const X = pos('XXX', 10_000, 15_000, 100);
    const Y = pos('YYY', 10_000, 15_000, 100);
    const a = construirePlanExecution('perte', situer([X, Y]), 2_000);
    const b = construirePlanExecution('perte', situer([Y, X]), 2_000);
    expect(a.lignes[0].symbole).toBe(b.lignes[0].symbole);
    expect(a.lignes[0].symbole).toBe('XXX');   // la clé canonique tranche
  });

  it('et le classement par CAPACITÉ est stable lui aussi — MULTI', () => {
    // ⚠ LE TEST MONO CI-DESSUS N'EXERÇAIT PAS LE BON COMPARATEUR : il passe par
    // l'étape 1, qui a son propre départage. Retirer la clé canonique du tri
    // par capacité laissait la suite verte. Il faut donc un cas MULTI où deux
    // positions ont EXACTEMENT la même capacité.
    const X = pos('XXX', 4_000, 7_000, 100);   // capacité 3 000
    const Y = pos('YYY', 6_000, 9_000, 200);   // capacité 3 000, autre densité
    const a = construirePlanExecution('perte', situer([X, Y]), 5_000);
    const b = construirePlanExecution('perte', situer([Y, X]), 5_000);
    expect(a.monoTitre).toBe(false);
    expect(a.lignes.map((l) => l.symbole)).toEqual(b.lignes.map((l) => l.symbole));
    // L'ordre canonique met XXX d'abord : c'est lui qui est vendu en entier.
    expect(a.lignes[0].symbole).toBe('XXX');
    expect(a.ecartCad).toBe(b.ecartCad);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE7 — LES REFUS SONT NOMMÉS, JAMAIS SILENCIEUX
// ═══════════════════════════════════════════════════════════════════════════

describe('PE7 · ce qui est écarté dit pourquoi', () => {
  it('une obligation est refusée avec son motif, pas oubliée', () => {
    const obligation = pos('OBL', 9_000, 12_000, 10_000, 'Obligation');
    const p = construirePlanExecution('perte', situer([AAA, obligation]), 5_000);
    expect(p.refus.map((r) => r.motif)).toContain('obligation-nominal-non-supporte');
    expect(p.lignes.every((l) => l.symbole !== 'OBL')).toBe(true);
  });

  it('une position en gain est refusée du plan de PERTES, avec le bon motif', () => {
    const p = construirePlanExecution('perte', situer([AAA, DDD]), 5_000);
    expect(p.refus.find((r) => r.symbole === 'DDD')?.motif).toBe('position-pas-en-perte');
  });

  it('aucun candidat : un plan vide qui ne prétend rien', () => {
    const p = construirePlanExecution('perte', situer([DDD, EEE]), 5_000);
    expect(p.lignes).toHaveLength(0);
    expect(p.capaciteCouvreCible).toBe(false);
    expect(p.montantRealiseTotalCad).toBe(0);
    expect(p.cibleRestanteCad).toBe(5_000);
    expect(p.refus).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE8 — LA BORNE DE RECHERCHE SE DIT
// ═══════════════════════════════════════════════════════════════════════════

describe('PE8 · une recherche bornée le déclare', () => {
  it('sur un dossier ordinaire, la recherche est exhaustive', () => {
    for (const c of [1_500, 9_000, 12_000]) {
      expect(perte(c).rechercheTronquee, `cible ${c}`).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE9 — L'ALLOCATION S'ARRÊTE DÈS QUE LA CIBLE EST COUVERTE
// ═══════════════════════════════════════════════════════════════════════════

describe('PE9 · aucune ligne au-delà du nécessaire', () => {
  it('un sous-ensemble large ne produit pas de lignes inutiles', () => {
    // ⚠ C'EST `allouer` QUI PORTE LA MINIMALITÉ, pas la borne de recherche —
    // établi par sabotage : gonfler `kMin` laissait le nombre de lignes intact.
    // On le verrouille donc là où il vit.
    const p = perte(2_800);            // AAA seul suffit largement
    expect(p.lignes).toHaveLength(1);
    // Et la dernière ligne est celle qui porte le résidu : aucune ligne ne
    // s'ajoute une fois la cible atteinte.
    const cumul = p.lignes.map((l) => l.montantRealiseEstimeCad);
    expect(cumul.slice(0, -1).reduce((s, x) => s + x, 0)).toBeLessThan(2_800);
  });

  it('sur une cible qui demande deux titres, la deuxième ligne est partielle', () => {
    const p = perte(9_000);
    expect(p.lignes).toHaveLength(2);
    // La première est vendue en ENTIER (sa capacité ne suffisait pas seule)...
    expect(p.lignes[0].quantiteAVendre).toBe(p.lignes[0].quantiteDetenue);
    // ...la seconde ne l'est pas : elle ne porte que le reste.
    expect(p.lignes[1].quantiteAVendre).toBeLessThan(p.lignes[1].quantiteDetenue);
  });
});
