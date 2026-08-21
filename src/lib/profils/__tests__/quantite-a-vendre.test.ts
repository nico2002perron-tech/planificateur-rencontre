// LE MOTEUR DE QUANTITÉ — mono-titre.
//
// Chaque test isole UNE condition. Les données sont entièrement fictives.
import { describe, it, expect } from 'vitest';
import {
  proposerQuantitePourPosition, meilleurPlanMonoTitre, positionId,
} from '../quantite-a-vendre';
import type { Position, Compte } from '../types';

function pos(p: Partial<Position> & { symbole: string }): Position {
  return {
    devise: 'CAD', uniteValeursRapport: 'CAD', typeInstrument: 'Action',
    quantite: 100, categorie: null, valeurMarchande: 4000, valeurComptable: 14000,
    revenuAnnuel: null, ...p,
  };
}
function cpt(numero = 'FICT-A', dateReleve: string | null = '2026-08-19'): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre', type: 'non-enregistre',
    titulaire: 'client', candidats: [numero], dateReleve, presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, encaisse: [], positions: [],
  };
}
/** Raccourci : la proposition, ou l'échec du test si elle a été refusée. */
function prop(p: Position, cible: number, c = cpt()) {
  const r = proposerQuantitePourPosition(c, p, cible);
  if (!r.ok) throw new Error(`refusée : ${r.refus.motif}`);
  return r.proposition;
}
function prop2(p: Position, cible: number, gainNetAvant: number, c = cpt()) {
  const r = proposerQuantitePourPosition(c, p, cible, gainNetAvant);
  if (!r.ok) throw new Error(`refusée : ${r.refus.motif}`);
  return r.proposition;
}
function motif(p: Position, cible = 5000, c = cpt()) {
  const r = proposerQuantitePourPosition(c, p, cible);
  return r.ok ? null : r.refus.motif;
}

// ═══════════════════════════════════════════════════════════════════════════
// Q1 → Q4 — LA QUANTITÉ CHOISIE
// ═══════════════════════════════════════════════════════════════════════════

describe('Q1-Q4 · le choix entre les deux voisines', () => {
  // 100 actions, 10 000 $ de perte latente → 100 $ de perte par action.
  const cent = pos({ symbole: 'AAA', quantite: 100, valeurComptable: 14000, valeurMarchande: 4000 });

  it('Q1 · une cible exactement atteignable donne la quantité exacte', () => {
    const r = prop(cent, 3000);
    expect(r.quantiteEstimeeAVendre).toBe(30);
    expect(r.perteRealiseeEstimeeCad).toBe(3000);
    expect(r.ecartCad).toBe(0);
    expect(r.cibleRestanteCad).toBe(0);
  });

  it('Q2 · floor plus proche l’emporte', () => {
    // 3 020 / 100 = 30,2 → 30 (écart −20) contre 31 (écart +80).
    expect(prop(cent, 3020).quantiteEstimeeAVendre).toBe(30);
  });

  it('Q3 · ceil plus proche l’emporte', () => {
    // 3 080 / 100 = 30,8 → 31 (écart +20) contre 30 (écart −80).
    expect(prop(cent, 3080).quantiteEstimeeAVendre).toBe(31);
  });

  it('Q4 · à égalité EXACTE, la plus petite quantité — moins de marché vendu', () => {
    // 3 050 / 100 = 30,5 : 30 et 31 sont à 50 $ de la cible, des deux côtés.
    const r = prop(cent, 3050);
    expect(r.quantiteEstimeeAVendre).toBe(30);
    expect(r.ecartCad).toBe(-50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q31 / Q33 — ÉCART ET CIBLE RESTANTE NE DISENT PAS LA MÊME CHOSE
// ═══════════════════════════════════════════════════════════════════════════

describe('Q31/Q33 · ecartCad signé, cibleRestanteCad jamais négative', () => {
  it('Q31 · sur-réalisation : écart +6, cible restante 0 — jamais −6', () => {
    // 300 actions à 30,013333 $ de perte l'unité → 9 004 $ pour 300.
    const p = pos({ symbole: 'GSY', quantite: 300, valeurComptable: 39004, valeurMarchande: 30000 });
    const r = prop(p, 8998);
    expect(r.quantiteEstimeeAVendre).toBe(300);
    expect(r.perteRealiseeEstimeeCad).toBe(9004);
    expect(r.ecartCad).toBe(6);
    expect(r.cibleRestanteCad).toBe(0);
    expect(r.cibleRestanteCad).not.toBeLessThan(0);
  });

  it('Q33 · position trop petite : la cible restante dit ce qui manque', () => {
    // 5 000 $ de perte disponible pour une cible de 8 998 $.
    const p = pos({ symbole: 'PETIT', quantite: 100, valeurComptable: 15000, valeurMarchande: 10000 });
    const r = prop(p, 8998);
    expect(r.perteLatenteDisponibleCad).toBe(5000);
    expect(r.cibleLocaleCad).toBe(5000);           // bornée par sa propre capacité
    expect(r.quantiteEstimeeAVendre).toBe(100);    // la position entière
    expect(r.perteRealiseeEstimeeCad).toBe(5000);
    expect(r.ecartCad).toBe(-3998);
    expect(r.cibleRestanteCad).toBe(3998);

    const m = meilleurPlanMonoTitre([{ compte: cpt(), position: p }], 8998);
    expect(m.aucunePositionNeCouvreSeule).toBe(true);
    expect(m.proposition).toBeNull();
    expect(m.propositions).toHaveLength(1);        // utilisable pour un futur multi
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q8 — LE CAS USD
// ═══════════════════════════════════════════════════════════════════════════

describe('Q8 · une position USD dont les valeurs sont en dollars canadiens', () => {
  it('calcule exactement comme une position CAD, et garde sa devise', () => {
    const usd = pos({ symbole: 'USTITRE', devise: 'USD', uniteValeursRapport: 'CAD' });
    const cad = pos({ symbole: 'CATITRE', devise: 'CAD' });
    const a = prop(usd, 3000);
    const b = prop(cad, 3000);

    expect(a.quantiteEstimeeAVendre).toBe(b.quantiteEstimeeAVendre);
    expect(a.perteRealiseeEstimeeCad).toBe(b.perteRealiseeEstimeeCad);
    expect(a.valeurVenteEstimeeCad).toBe(b.valeurVenteEstimeeCad);
    // La devise SURVIT pour l'affichage — « titre USD, montants CAD ».
    expect(a.devise).toBe('USD');
    expect(a.uniteValeursRapport).toBe('CAD');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q9 → Q13, Q23, Q26 — LES REFUS, CHACUN AVEC SON MOTIF
// ═══════════════════════════════════════════════════════════════════════════

describe('Q9-Q13/Q23/Q26 · aucune position n’est écartée en silence', () => {
  const cas: Array<[string, Partial<Position>, string]> = [
    ['Q9 · unité des valeurs non établie', { uniteValeursRapport: 'inconnue' }, 'unite-valeurs-non-etablie'],
    ['Q9 bis · rapport en USD', { uniteValeursRapport: 'USD' }, 'unite-valeurs-non-etablie'],
    ['Q10 · valeur comptable absente', { valeurComptable: null }, 'valeur-comptable-manquante'],
    ['Q11 · valeur marchande absente', { valeurMarchande: null }, 'valeur-marchande-manquante'],
    ['Q12 · quantité zéro', { quantite: 0 }, 'quantite-invalide'],
    ['Q13 · quantité négative', { quantite: -5 }, 'quantite-invalide'],
    ['quantité absente', { quantite: undefined }, 'quantite-manquante'],
    ['quantité non finie', { quantite: Number.NaN }, 'quantite-invalide'],
    ['Q23 · obligation', { typeInstrument: 'Obligation' }, 'obligation-nominal-non-supporte'],
    ['Q26 · type Autre', { typeInstrument: 'Autre' }, 'type-instrument-non-supporte'],
    ['type inconnu', { typeInstrument: 'Bidule' }, 'type-instrument-non-supporte'],
    ['position en GAIN, pas en perte', { valeurComptable: 4000, valeurMarchande: 14000 }, 'position-pas-en-perte'],
  ];
  for (const [nom, patch, attendu] of cas) {
    it(nom, () => {
      expect(motif(pos({ symbole: 'X', ...patch }))).toBe(attendu);
    });
  }

  it('AUCUN `?? 0` : une valeur absente refuse, elle ne vaut pas zéro', () => {
    // Sans le refus, valeurComptable null donnerait 0 − 4 000 = perte négative,
    // ou pire, 0 traité comme un prix de base réel.
    expect(motif(pos({ symbole: 'X', valeurComptable: null }))).not.toBeNull();
    expect(motif(pos({ symbole: 'X', valeurMarchande: null }))).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q14 / Q15 — FONDS ET ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('Q14/Q15 · la granularité vient de la primitive, jamais d’ici', () => {
  it('Q14 · un fonds garde ses trois décimales', () => {
    // 1 000 parts, 2 000 $ de perte → 2 $ la part. Cible 240,50 $ → 120,25 parts.
    const f = pos({
      symbole: 'FFF', typeInstrument: "Fonds d'investissement",
      quantite: 1000, valeurComptable: 12000, valeurMarchande: 10000,
    });
    const r = prop(f, 240.5);
    expect(r.uniteQuantite).toBe('part');
    expect(r.quantiteEstimeeAVendre).toBe(120.25);
    expect(String(r.quantiteEstimeeAVendre)).not.toMatch(/\d{5,}$/);
  });

  it('Q15 · une action ne devient jamais fractionnaire', () => {
    const r = prop(pos({ symbole: 'AAA', quantite: 100, valeurComptable: 14000, valeurMarchande: 4000 }), 3033);
    expect(r.uniteQuantite).toBe('unite');
    expect(Number.isInteger(r.quantiteEstimeeAVendre)).toBe(true);
  });

  it('jamais plus que la quantité détenue', () => {
    const p = pos({ symbole: 'AAA', quantite: 100, valeurComptable: 14000, valeurMarchande: 4000 });
    const r = prop(p, 99999);
    expect(r.quantiteEstimeeAVendre).toBe(100);
    expect(r.quantiteEstimeeAVendre).toBeLessThanOrEqual(r.quantiteDetenue);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA VALEUR DE VENTE ESTIMÉE, ET SA DATE
// ═══════════════════════════════════════════════════════════════════════════

describe('la valeur de vente est une estimation datée', () => {
  it('se dérive des totaux du relevé, et porte sa date', () => {
    // 100 actions valant 4 000 $ → 40 $ l'unité ; 30 unités → 1 200 $.
    const r = prop(pos({ symbole: 'AAA' }), 3000);
    expect(r.valeurParUniteCad).toBe(40);
    expect(r.valeurVenteEstimeeCad).toBe(1200);
    expect(r.dateValeurs).toBe('2026-08-19');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q32 — LE MEILLEUR MONO NE DÉPEND PAS DE L'ORDRE
// ═══════════════════════════════════════════════════════════════════════════

describe('Q32 · le meilleur mono-titre est déterministe', () => {
  const c = cpt();
  // BBB atteint la cible pile ; AAA la dépasse de 100 $.
  const AAA = pos({ symbole: 'AAA', quantite: 100, valeurComptable: 14000, valeurMarchande: 4000 });
  const BBB = pos({ symbole: 'BBB', quantite: 200, valeurComptable: 18000, valeurMarchande: 8000 });

  it('choisit l’écart absolu minimal, dans les deux sens de lecture', () => {
    const ordre1 = meilleurPlanMonoTitre([{ compte: c, position: AAA }, { compte: c, position: BBB }], 3050);
    const ordre2 = meilleurPlanMonoTitre([{ compte: c, position: BBB }, { compte: c, position: AAA }], 3050);
    expect(ordre1.proposition?.symbole).toBe(ordre2.proposition?.symbole);
    expect(ordre1.proposition?.ecartCad).toBe(ordre2.proposition?.ecartCad);
    // BBB : 50 $ la part de perte → 61 unités = 3 050 $, écart 0.
    expect(ordre1.proposition?.symbole).toBe('BBB');
    expect(ordre1.proposition?.ecartCad).toBe(0);
  });

  it('à écart RÉELLEMENT égal, la clé canonique tranche — pas le tableau', () => {
    const c2 = cpt('FICT-E');
    // Deux positions identiques dans deux comptes : même écart, même quantité.
    const jumelle = pos({ symbole: 'AAA', quantite: 100, valeurComptable: 14000, valeurMarchande: 4000 });
    const a = meilleurPlanMonoTitre(
      [{ compte: c, position: AAA }, { compte: c2, position: jumelle }], 3000);
    const b = meilleurPlanMonoTitre(
      [{ compte: c2, position: jumelle }, { compte: c, position: AAA }], 3000);
    expect(a.proposition?.compteId).toBe(b.proposition?.compteId);
    expect(a.proposition?.positionId).toBe(positionId(c, AAA));   // FICT-A < FICT-E
  });

  it('les refus sont rendus à part, jamais confondus avec un résultat', () => {
    const m = meilleurPlanMonoTitre([
      { compte: c, position: AAA },
      { compte: c, position: pos({ symbole: 'OOO', typeInstrument: 'Obligation' }) },
    ], 3000);
    expect(m.proposition?.symbole).toBe('AAA');
    expect(m.refus.map((r) => r.motif)).toEqual(['obligation-nominal-non-supporte']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L'INVARIANT FINAL — verrouillé sur le RÉSULTAT, pas sur son mécanisme
// ═══════════════════════════════════════════════════════════════════════════

describe('invariant · la quantité proposée tient toujours dans la position', () => {
  it('sur un large balayage de cibles, jamais plus que le détenu', () => {
    // ⚠ CE TEST NE FAIT PAS CONFIANCE AU MÉCANISME ACTUEL. La borne vient
    // aujourd'hui de `cibleLocaleCad` ; si demain elle venait d'ailleurs, ou
    // de nulle part, c'est ce test-ci qui doit tomber.
    const c = cpt();
    const cas = [
      pos({ symbole: 'AAA', quantite: 203, valeurComptable: 24000, valeurMarchande: 8463 }),
      pos({ symbole: 'FFF', typeInstrument: "Fonds d'investissement",
        quantite: 527.731, valeurComptable: 12000, valeurMarchande: 10000 }),
      pos({ symbole: 'USD1', devise: 'USD', quantite: 17, valeurComptable: 9000, valeurMarchande: 1200 }),
    ];
    for (const p of cas) {
      for (const cible of [1, 33.79, 500, 8997.81, 15537.41, 99999, 1e9]) {
        const r = proposerQuantitePourPosition(c, p, cible);
        if (!r.ok) continue;
        const q = r.proposition.quantiteEstimeeAVendre;
        expect(q, `${p.symbole} @ ${cible}`).toBeGreaterThan(0);
        expect(q, `${p.symbole} @ ${cible}`).toBeLessThanOrEqual(r.proposition.quantiteDetenue);
      }
    }
  });

  it('une cible ÉNORME vend la position entière, jamais davantage', () => {
    const p = pos({ symbole: 'AAA', quantite: 203, valeurComptable: 24000, valeurMarchande: 8463 });
    const r = prop(p, 1e9);
    expect(r.quantiteEstimeeAVendre).toBe(203);
    expect(r.quantiteEstimeeAVendre).toBe(r.quantiteDetenue);
    expect(r.cibleRestanteCad).toBeGreaterThan(0);   // la cible reste loin
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// gainNetApresCad — LA TROISIÈME BARRE, ET ELLE NE SE DÉDUIT PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('gainNetApresCad · distinct de l’écart et de la cible restante', () => {
  it('couverture COMPLÈTE avec léger dépassement : après = 0, restante = 0, écart > 0', () => {
    // Le cas réel mesuré : 203 actions, 15 537,41 $ de perte latente.
    const p = pos({ symbole: 'GSY', quantite: 203, valeurComptable: 24000, valeurMarchande: 8462.59 });
    const r = prop2(p, 8997.81, 8997.81);
    expect(r.quantiteEstimeeAVendre).toBe(118);
    expect(r.perteRealiseeEstimeeCad).toBeCloseTo(9031.6, 1);
    expect(r.ecartCad).toBeCloseTo(33.79, 1);
    expect(r.cibleRestanteCad).toBe(0);
    expect(r.gainNetApresCad).toBe(0);               // JAMAIS −33,79
  });

  it('couverture PARTIELLE : les trois chiffres disent trois choses', () => {
    const p = pos({ symbole: 'PETIT', quantite: 100, valeurComptable: 15000, valeurMarchande: 10000 });
    const r = prop2(p, 8998, 8998);
    expect(r.perteRealiseeEstimeeCad).toBe(5000);
    expect(r.ecartCad).toBe(-3998);                  // sous la cible
    expect(r.cibleRestanteCad).toBe(3998);           // ce qu'il manque
    expect(r.gainNetApresCad).toBe(3998);            // le gain qui subsiste
  });

  it('⚠ la cible n’est PAS le gain net : les deux se fournissent séparément', () => {
    // `absorbable = min(pertesLatentes, gainsRealises)` — quand les pertes sont
    // insuffisantes, la cible est PLUS PETITE que le gain à compenser. Déduire
    // l'un de l'autre donnerait un « après » faussement nul.
    const p = pos({ symbole: 'PETIT', quantite: 100, valeurComptable: 15000, valeurMarchande: 10000 });
    const r = prop2(p, 5000, 20000);                 // cible 5 000, gain net 20 000
    expect(r.perteRealiseeEstimeeCad).toBe(5000);
    expect(r.ecartCad).toBe(0);                      // la CIBLE est atteinte
    expect(r.cibleRestanteCad).toBe(0);
    expect(r.gainNetApresCad).toBe(15000);           // mais 15 000 $ de gain restent
  });

  it('sans gain net fourni, le champ vaut null — jamais une déduction', () => {
    expect(prop(pos({ symbole: 'AAA' }), 3000).gainNetApresCad).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAPACITÉ ≠ EXÉCUTION — le même correctif, prouvé commun aux deux moteurs
// ═══════════════════════════════════════════════════════════════════════════

describe('capacité et exécution, côté pertes', () => {
  it('SOUS la cible : la position suffit, l’arrondi laisse 15 $', () => {
    // 340 unités, 20 000 $ de perte latente → 58,8235 $ l'unité… on prend des
    // chiffres ronds : 85 $ l'unité, comme la fixture des gains.
    const p = pos({ symbole: 'PERD', quantite: 340, valeurComptable: 47600, valeurMarchande: 18700 });
    const r = prop(p, 12000);
    expect(r.quantiteEstimeeAVendre).toBe(141);
    expect(r.perteRealiseeEstimeeCad).toBe(11985);
    expect(r.ecartCad).toBe(-15);
    expect(r.cibleRestanteCad).toBe(15);
    expect(r.capaciteCouvreCible).toBe(true);
    expect(r.executionCouvreEntierementCible).toBe(false);

    const m = meilleurPlanMonoTitre([{ compte: cpt(), position: p }], 12000);
    expect(m.proposition).not.toBeNull();
  });

  it('LE CAS RÉEL MESURÉ ne bouge pas : +33,79 $, exécution complète', () => {
    // Aucune régression visuelle sur la page déjà inspectée.
    const p = pos({ symbole: 'GSY', quantite: 203, valeurComptable: 24000, valeurMarchande: 8462.59 });
    const r = prop(p, 8997.81);
    expect(r.quantiteEstimeeAVendre).toBe(118);
    expect(r.ecartCad).toBeCloseTo(33.79, 1);
    expect(r.cibleRestanteCad).toBe(0);
    expect(r.capaciteCouvreCible).toBe(true);
    expect(r.executionCouvreEntierementCible).toBe(true);
  });

  it('capacité insuffisante : la position ne prétend pas couvrir', () => {
    const p = pos({ symbole: 'PETIT', quantite: 100, valeurComptable: 15000, valeurMarchande: 10000 });
    expect(prop(p, 12000).capaciteCouvreCible).toBe(false);
    expect(meilleurPlanMonoTitre([{ compte: cpt(), position: p }], 12000).aucunePositionNeCouvreSeule).toBe(true);
  });
});
