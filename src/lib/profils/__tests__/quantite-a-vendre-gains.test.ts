// LE MOTEUR DE QUANTITÉ POUR LES GAINS — G1 à G19.
//
// Le plus important est G19 : la cible vient de la stratégie, jamais d'un
// `min()` recalculé ici. Données entièrement fictives.
import { describe, it, expect } from 'vitest';
import {
  proposerQuantitePourGain, meilleurPlanGainMonoTitre,
} from '../quantite-a-vendre-gains';
import { positionId } from '../quantite-a-vendre';
import type { Position, Compte } from '../types';

/** 100 unités, 20 000 $ de gain latent → 200 $ de gain par unité. */
function pos(p: Partial<Position> & { symbole: string }): Position {
  return {
    devise: 'CAD', uniteValeursRapport: 'CAD', typeInstrument: 'Action',
    quantite: 100, categorie: null, valeurMarchande: 30000, valeurComptable: 10000,
    revenuAnnuel: null, ...p,
  };
}
function cpt(numero = 'FICT-A', dateReleve: string | null = '2026-08-21'): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre', type: 'non-enregistre',
    titulaire: 'client', candidats: [numero], dateReleve, presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, encaisse: [], positions: [],
  };
}
function prop(p: Position, cible: number, c = cpt()) {
  const r = proposerQuantitePourGain(c, p, cible);
  if (!r.ok) throw new Error(`refusée : ${r.refus.motif}`);
  return r.proposition;
}
const motif = (p: Position, cible = 5000) => {
  const r = proposerQuantitePourGain(cpt(), p, cible);
  return r.ok ? null : r.refus.motif;
};

// ═══════════════════════════════════════════════════════════════════════════
// G1 → G4 — LE CHOIX DE LA QUANTITÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('G1-G4 · les deux voisines', () => {
  const cent = pos({ symbole: 'AAA' });          // 200 $ de gain l'unité

  it('G1 · une cible exactement atteignable', () => {
    const r = prop(cent, 6000);
    expect(r.quantiteEstimeeAVendre).toBe(30);
    expect(r.gainRealiseEstimeCad).toBe(6000);
    expect(r.ecartCad).toBe(0);
    expect(r.cibleRestanteCad).toBe(0);
  });

  it('G2 · le voisin BAS est plus proche', () => {
    expect(prop(cent, 6040).quantiteEstimeeAVendre).toBe(30);   // 30,2 → 30
  });

  it('G3 · le voisin HAUT est plus proche', () => {
    expect(prop(cent, 6160).quantiteEstimeeAVendre).toBe(31);   // 30,8 → 31
  });

  it('G4 · à égalité EXACTE, la plus petite quantité', () => {
    const r = prop(cent, 6100);                                  // 30,5
    expect(r.quantiteEstimeeAVendre).toBe(30);
    expect(r.ecartCad).toBe(-100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G5 / G6 / G17 — LES BORNES
// ═══════════════════════════════════════════════════════════════════════════

describe('G5/G6/G17 · la position borne tout', () => {
  it('G5 · une cible plus grande que la capacité : la position entière', () => {
    const r = prop(pos({ symbole: 'AAA' }), 50000);
    expect(r.gainLatentDisponibleCad).toBe(20000);
    expect(r.cibleLocaleCad).toBe(20000);
    expect(r.quantiteEstimeeAVendre).toBe(100);
    expect(r.gainRealiseEstimeCad).toBe(20000);
    expect(r.ecartCad).toBe(-30000);
    expect(r.cibleRestanteCad).toBe(30000);
  });

  it('G6/G17 · jamais plus que le détenu, jamais une cible restante négative', () => {
    const cas = [
      pos({ symbole: 'AAA' }),
      pos({ symbole: 'FFF', typeInstrument: "Fonds d'investissement", quantite: 527.731 }),
      pos({ symbole: 'USD1', devise: 'USD', quantite: 17 }),
    ];
    for (const p of cas) {
      for (const cible of [1, 33.79, 6000, 20000, 1e9]) {
        const r = proposerQuantitePourGain(cpt(), p, cible);
        if (!r.ok) continue;
        const x = r.proposition;
        expect(x.quantiteEstimeeAVendre, `${p.symbole}@${cible}`).toBeGreaterThan(0);
        expect(x.quantiteEstimeeAVendre).toBeLessThanOrEqual(x.quantiteDetenue);
        expect(x.cibleRestanteCad).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G7 → G11 — DEVISE, GRANULARITÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('G7 · un titre USD dont les valeurs sont en CAD', () => {
  it('calcule normalement, et garde sa devise de négociation', () => {
    const usd = prop(pos({ symbole: 'US1', devise: 'USD' }), 6000);
    const cad = prop(pos({ symbole: 'CA1' }), 6000);
    expect(usd.quantiteEstimeeAVendre).toBe(cad.quantiteEstimeeAVendre);
    expect(usd.gainRealiseEstimeCad).toBe(cad.gainRealiseEstimeCad);
    expect(usd.devise).toBe('USD');
    expect(usd.uniteValeursRapport).toBe('CAD');
  });
});

describe('G8-G11 · la granularité vient de la primitive partagée', () => {
  it('G8 · un fonds garde ses trois décimales', () => {
    // 1 000 parts, 2 000 $ de gain → 2 $ la part. Cible 240,50 → 120,25 parts.
    const f = pos({
      symbole: 'FFF', typeInstrument: "Fonds d'investissement",
      quantite: 1000, valeurComptable: 10000, valeurMarchande: 12000,
    });
    const r = prop(f, 240.5);
    expect(r.uniteQuantite).toBe('part');
    expect(r.quantiteEstimeeAVendre).toBe(120.25);
  });

  it('G9 · une action ne devient jamais fractionnaire', () => {
    const r = prop(pos({ symbole: 'AAA' }), 6033);
    expect(r.uniteQuantite).toBe('unite');
    expect(Number.isInteger(r.quantiteEstimeeAVendre)).toBe(true);
  });

  it('G10/G11 · obligation et type Autre restent non supportés', () => {
    expect(motif(pos({ symbole: 'O', typeInstrument: 'Obligation' })))
      .toBe('obligation-nominal-non-supporte');
    expect(motif(pos({ symbole: 'X', typeInstrument: 'Autre' })))
      .toBe('type-instrument-non-supporte');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G12 → G16 — LES REFUS
// ═══════════════════════════════════════════════════════════════════════════

describe('G12-G16 · chaque refus porte son motif', () => {
  const cas: Array<[string, Partial<Position>, string]> = [
    ['G12 · quantité absente', { quantite: undefined }, 'quantite-manquante'],
    ['G13 · quantité zéro', { quantite: 0 }, 'quantite-invalide'],
    ['G13 bis · quantité négative', { quantite: -5 }, 'quantite-invalide'],
    ['G14 · valeur comptable absente', { valeurComptable: null }, 'valeur-comptable-manquante'],
    ['G15 · valeur marchande absente', { valeurMarchande: null }, 'valeur-marchande-manquante'],
    ['unité des valeurs non établie', { uniteValeursRapport: 'inconnue' }, 'unite-valeurs-non-etablie'],
  ];
  for (const [nom, patch, attendu] of cas) {
    it(nom, () => expect(motif(pos({ symbole: 'X', ...patch }))).toBe(attendu));
  }

  it('G16 · une position en PERTE porte son propre motif', () => {
    // ⚠ JAMAIS `position-pas-en-perte`. Dire à un planificateur qu'une position
    // « n'est pas en perte » quand on cherchait un gain le ferait chercher le
    // mauvais problème.
    expect(motif(pos({ symbole: 'X', valeurMarchande: 10000, valeurComptable: 30000 })))
      .toBe('position-pas-en-gain');
    // Une position à gain nul non plus n'est pas exploitable.
    expect(motif(pos({ symbole: 'X', valeurMarchande: 10000, valeurComptable: 10000 })))
      .toBe('position-pas-en-gain');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G18 — LE MEILLEUR MONO NE DÉPEND PAS DE L'ORDRE
// ═══════════════════════════════════════════════════════════════════════════

describe('G18 · déterminisme du meilleur mono', () => {
  const c = cpt();
  const AAA = pos({ symbole: 'AAA' });                                    // 200 $/unité
  const BBB = pos({ symbole: 'BBB', quantite: 200, valeurComptable: 10000, valeurMarchande: 30000 }); // 100 $/unité

  it('même résultat dans les deux sens de lecture', () => {
    const a = meilleurPlanGainMonoTitre([{ compte: c, position: AAA }, { compte: c, position: BBB }], 6100);
    const b = meilleurPlanGainMonoTitre([{ compte: c, position: BBB }, { compte: c, position: AAA }], 6100);
    expect(a.proposition?.symbole).toBe(b.proposition?.symbole);
    expect(a.proposition?.ecartCad).toBe(b.proposition?.ecartCad);
    // AAA (200 $/unite) ne tombe pas juste sur 6 100 : sa meilleure quantite
    // laisse 100 $ a couvrir, donc elle n'est pas candidate. BBB (100 $/unite)
    // atteint 6 100 exactement avec 61 unites.
    expect(a.proposition?.symbole).toBe('BBB');
    expect(a.proposition?.ecartCad).toBe(0);
  });

  it('à écart réellement égal, la clé canonique tranche', () => {
    const c2 = cpt('FICT-E');
    const a = meilleurPlanGainMonoTitre(
      [{ compte: c, position: AAA }, { compte: c2, position: pos({ symbole: 'AAA' }) }], 6000);
    const b = meilleurPlanGainMonoTitre(
      [{ compte: c2, position: pos({ symbole: 'AAA' }) }, { compte: c, position: AAA }], 6000);
    expect(a.proposition?.positionId).toBe(b.proposition?.positionId);
    expect(a.proposition?.positionId).toBe(positionId(c, AAA));   // FICT-A < FICT-E
  });

  it('aucune position ne couvre seule : on le dit, sans désigner un gagnant', () => {
    const m = meilleurPlanGainMonoTitre([{ compte: c, position: AAA }], 99999);
    expect(m.aucunePositionNeCouvreSeule).toBe(true);
    expect(m.proposition).toBeNull();
    expect(m.propositions).toHaveLength(1);
  });

  it('les refus sont rendus à part', () => {
    const m = meilleurPlanGainMonoTitre([
      { compte: c, position: AAA },
      { compte: c, position: pos({ symbole: 'PERD', valeurMarchande: 1000, valeurComptable: 9000 }) },
    ], 6000);
    expect(m.proposition?.symbole).toBe('AAA');
    expect(m.refus.map((r) => r.motif)).toEqual(['position-pas-en-gain']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G19 — LA CIBLE EST CONSOMMÉE, JAMAIS REDÉTERMINÉE
// ═══════════════════════════════════════════════════════════════════════════

describe('G19 · le moteur suit `montantEstime`, il ne le recalcule pas', () => {
  it('même quand un min() naïf donnerait un autre nombre', () => {
    // ⚠ CONTEXTE VOLONTAIREMENT PIÉGEUX. Un module qui recalculerait
    // `min(gainsLatents, pertesDisponibles)` obtiendrait ici 20 000 — la
    // capacité de la position. La stratégie, elle, a décidé 6 000 : ses
    // conditions d'admissibilité (unité des pertes reportées, portée, perte
    // apparente) ne sont pas visibles d'ici. Le moteur DOIT suivre les 6 000.
    const p = pos({ symbole: 'AAA' });            // gain latent = 20 000
    const r = prop(p, 6000);                       // cible imposée = 6 000

    expect(r.cibleGainCad).toBe(6000);
    expect(r.gainRealiseEstimeCad).toBe(6000);
    expect(r.quantiteEstimeeAVendre).toBe(30);     // PAS 100
    expect(r.gainLatentDisponibleCad).toBe(20000); // la capacité reste dite
    expect(r.cibleRestanteCad).toBe(0);
  });

  it('une cible plus GRANDE que la capacité ne se rabote pas en silence', () => {
    // L'inverse du piège : le module ne doit pas « corriger » la cible pour
    // qu'elle tienne. Il exécute au mieux et déclare ce qui reste.
    const r = prop(pos({ symbole: 'AAA' }), 35000);
    expect(r.cibleGainCad).toBe(35000);            // la cible reçue, intacte
    expect(r.cibleRestanteCad).toBe(15000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CAPACITÉ ≠ EXÉCUTION — le défaut trouvé en construisant la fixture
// ═══════════════════════════════════════════════════════════════════════════

describe('capacité et exécution sont deux questions distinctes', () => {
  /** 340 unités, 28 900 $ de gain latent → 85 $ l'unité. Le cas de la fixture. */
  const fixture = pos({
    symbole: 'FICT', quantite: 340, valeurComptable: 18700, valeurMarchande: 47600,
  });

  it('SOUS la cible : la position suffit en capacité, l’arrondi laisse 15 $', () => {
    // ⚠ AVANT LE 21 AOÛT, CE CAS RENDAIT `proposition: null`. Le critère unique
    // était `cibleRestanteCad === 0` — asymétrique : dépasser « couvrait »,
    // rester 15 $ en dessous sur 12 000 $ ne couvrait pas, et le moteur ne
    // proposait plus rien. Avec des titres entiers, de quel côté on tombe est
    // un accident d'arrondi, pas une propriété du dossier.
    const r = prop(fixture, 12000);
    expect(r.quantiteEstimeeAVendre).toBe(141);        // 141,176 → le plus proche
    expect(r.gainRealiseEstimeCad).toBe(11985);
    expect(r.ecartCad).toBe(-15);
    expect(r.cibleRestanteCad).toBe(15);
    expect(r.capaciteCouvreCible).toBe(true);          // 28 900 ≥ 12 000
    expect(r.executionCouvreEntierementCible).toBe(false);

    const m = meilleurPlanGainMonoTitre([{ compte: cpt(), position: fixture }], 12000);
    expect(m.proposition).not.toBeNull();              // et NON `null`
    expect(m.aucunePositionNeCouvreSeule).toBe(false);
  });

  it('AU-DESSUS de la cible : même capacité, exécution complète', () => {
    // 85 × 142 = 12 070 : on choisit 142 quand elle est la plus proche.
    const r = prop(fixture, 12060);
    expect(r.quantiteEstimeeAVendre).toBe(142);
    expect(r.gainRealiseEstimeCad).toBe(12070);
    expect(r.ecartCad).toBe(10);
    expect(r.cibleRestanteCad).toBe(0);
    expect(r.capaciteCouvreCible).toBe(true);
    expect(r.executionCouvreEntierementCible).toBe(true);
  });

  it('RÉELLEMENT insuffisante : la capacité, elle, dit non', () => {
    const petite = pos({ symbole: 'PETIT', quantite: 100, valeurComptable: 2000, valeurMarchande: 10000 });
    const r = prop(petite, 12000);
    expect(r.gainLatentDisponibleCad).toBe(8000);
    expect(r.capaciteCouvreCible).toBe(false);
    expect(r.executionCouvreEntierementCible).toBe(false);

    const m = meilleurPlanGainMonoTitre([{ compte: cpt(), position: petite }], 12000);
    expect(m.aucunePositionNeCouvreSeule).toBe(true);
    expect(m.proposition).toBeNull();
    expect(m.propositions).toHaveLength(1);            // utilisable pour un futur multi
  });

  it('AUCUNE tolérance n’est introduite : les 15 $ se disent', () => {
    const r = prop(fixture, 12000);
    expect(r.cibleGainCad).toBe(12000);
    expect(r.gainRealiseEstimeCad).toBe(11985);
    expect(r.cibleRestanteCad).toBe(15);               // ni masqué, ni arrondi à 0
  });
});
