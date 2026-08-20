// LA LIGNE DU TEMPS — la comptabilité événementielle, tenue par ses invariants.
//
// Chaque cas vient de la liste obligatoire du 19 août. Les invariants qui
// traversent tout le fichier :
//   · une ligne source = exactement UN événement = UNE disposition ;
//   · un agrégat = la somme EXACTE de ses événements sources ;
//   · CAD et USD ne s'additionnent jamais ;
//   · une jambe FX ne redevient jamais cotisation/retrait/apport ;
//   · un ambigu n'entre dans aucun montant ferme ;
//   · `{}` = rien de détecté — jamais un faux zéro.
//
// Données synthétiques, comptes « FICT », prénoms d'enfants inventés.
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps, type LigneDuTemps } from '../ligne-du-temps';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function tx(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2026-03-15', dateReglement: '2026-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}
const CELI = '37-FICT-W';
const REER = '37-FICT-S';
const REEE = '37-FICT-Z';
const FERR = '37-FICT-T';
const COMPTANT = '37-FICT-A';
const E = '37-FICT-E';
const F = '37-FICT-F';
const MARGE = E;   // alias de lecture pour les lots mélangés

/** L'invariant de partition, vérifié sur chaque timeline construite. */
function partitionTient(t: LigneDuTemps): void {
  const somme = Object.values(t.diagnostics.dispositions).reduce((s, n) => s + n, 0);
  expect(somme).toBe(t.diagnostics.lignesLues);
  expect(t.evenements).toHaveLength(t.diagnostics.lignesLues);
}

/** Tout id de source d'un agrégat pointe un événement dont le montant participe à la somme. */
function sourcesExactes(t: LigneDuTemps, agregat: { montant: number; sources: number[] }, absolu = false): void {
  const somme = agregat.sources.reduce((s, id) => {
    const m = t.evenements[id].montant as number;
    return s + (absolu ? Math.abs(m) : m);
  }, 0);
  expect(Math.round(somme * 100) / 100).toBe(agregat.montant);
}

describe('la timeline vide', () => {
  it('aucune transaction → structure valide, portée inconnue, AUCUN faux zéro', () => {
    const t = construireLigneDuTemps([]);
    expect(t.parAnnee).toEqual({});
    expect(t.cumulatifs).toEqual({});
    expect(t.portee).toBe('inconnue');   // rien n'est connu — pas « zéro cotisation »
    expect(t.diagnostics.lignesLues).toBe(0);
    partitionTient(t);
  });
});

describe('les cotisations enregistrées', () => {
  it('une cotisation CELI : bonne année, bonne devise, source conservée', () => {
    const t = construireLigneDuTemps([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })]);
    const ag = t.parAnnee['2026'].celi.cotisations['CAD'];
    expect(ag.montant).toBe(7000);
    expect(ag.devise).toBe('CAD');
    expect(ag.sources).toEqual([0]);
    expect(t.evenements[0].source.noCompte).toBe(CELI);
    expect(t.portee).toBe('interne-seulement');
    partitionTient(t);
  });

  it('une cotisation REER : agrégée sous reer, traçable', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: REER, date: '2025-02-10', total: 12000 }),
    ]);
    const ag = t.parAnnee['2025'].reer.cotisations['CAD'];
    expect(ag.montant).toBe(12000);
    sourcesExactes(t, ag);
  });

  it('la PARTIE DOUBLE ne double pas : jambe argent appariée à une jambe titre étiquetée transfert = 0 $ d’argent neuf', () => {
    // La règle 2/5, consommée telle quelle : le cas mesuré du 4 août.
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 20177.9 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'TD', quantite: 155, total: -20177.9, note: 'TRANSFERE A 37FICTS' }),
    ]);
    expect(t.parAnnee['2026'].celi.cotisations).toEqual({});   // rien de ferme
    expect(t.diagnostics.dispositions['non-agrege'] + t.diagnostics.dispositions['virement-interne'] + t.diagnostics.dispositions.ambigu).toBe(2);
    partitionTient(t);
  });

  it('un retrait CELI est agrégé en valeur absolue, avec sa source', () => {
    const t = construireLigneDuTemps([tx({ type: 'Retrait', noCompte: CELI, total: -2000 })]);
    const ag = t.parAnnee['2026'].celi.retraits['CAD'];
    expect(ag.montant).toBe(2000);
    sourcesExactes(t, ag, true);
  });

  it('une « Cotisation » dans un FERR n’entre dans AUCUN agrégat ferme — régime de décaissement', () => {
    const t = construireLigneDuTemps([tx({ type: 'Cotisation', noCompte: FERR, total: 80000 })]);
    expect(t.parAnnee['2026'].ferr.retraits).toEqual({});
    expect(t.ambigus).toHaveLength(1);
    partitionTient(t);
  });

  it('un retrait FERR, lui, est agrégé : c’est l’objet du régime', () => {
    const t = construireLigneDuTemps([tx({ type: 'Retrait', noCompte: FERR, total: -12000 })]);
    expect(t.parAnnee['2026'].ferr.retraits['CAD'].montant).toBe(12000);
  });
});

describe('le REEE par bénéficiaire', () => {
  it('deux bénéficiaires → deux agrégats distincts, jamais fusionnés', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'CONTRIBUTION 01ENFANTA' }),
      tx({ type: 'Cotisation', noCompte: REEE, total: 1500, note: 'CONTRIBUTION 02ENFANTB' }),
    ]);
    const par = t.parAnnee['2026'].reee.parBeneficiaire;
    expect(par['ENFANTA']['CAD'].montant).toBe(2500);
    expect(par['ENFANTB']['CAD'].montant).toBe(1500);
    expect(Object.keys(par)).toHaveLength(2);
  });

  it('une note sans bénéficiaire → « (inconnu) », jamais une répartition arbitraire', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'COTISATION' }),
    ]);
    const par = t.parAnnee['2026'].reee.parBeneficiaire;
    expect(par['(inconnu)']['CAD'].montant).toBe(2500);
    expect(par['ENFANTA']).toBeUndefined();
  });
});

describe('les conversions dans la timeline', () => {
  const jambeCad = () => tx({ type: 'Transfert', noCompte: E, total: -13252, note: 'AU F1 TAUX 1.3252' });
  const jambeUsd = () => tx({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 });

  it('FX-1 : deux jambes → UNE conversion, AUCUN flux externe', () => {
    const t = construireLigneDuTemps([jambeCad(), jambeUsd()]);
    const ne = t.parAnnee['2026'].nonEnregistre;
    expect(ne.conversionsDevise).toHaveLength(1);
    const c = ne.conversionsDevise[0];
    expect(c.confiance).toBe('confirme');
    expect(c.montantCad).toBe(-13252);        // chaque jambe garde SA devise et SON montant
    expect(c.montantUsd).toBe(10000);
    expect(c.tauxNote).toBe(1.3252);
    expect(c.famille).toBe('37-XXXX');         // la racine est MASQUÉE dans la timeline
    // Le flux externe consolidé est ZÉRO : rien dans les apports ni les retraits.
    expect(ne.apportsCapital).toEqual({});
    expect(ne.retraitsCapital).toEqual({});
    expect(t.diagnostics.pairesFxConfirmees).toBe(1);
    partitionTient(t);
  });

  it('FX-2 : même résultat économique, confiance élevée', () => {
    const x = jambeCad(); x.note = '';
    const t = construireLigneDuTemps([x, jambeUsd()]);
    expect(t.parAnnee['2026'].nonEnregistre.conversionsDevise[0].confiance).toBe('eleve');
    expect(t.diagnostics.pairesFxElevees).toBe(1);
  });

  it('FX ambigu (taux contredit) : AUCUNE addition aux agrégats fermes', () => {
    const x = jambeCad(); x.note = 'TAUX 1.3150';   // écart 0,78 % > 0,5 %
    const t = construireLigneDuTemps([x, jambeUsd()]);
    const ne = t.parAnnee['2026'].nonEnregistre;
    expect(ne.conversionsDevise).toHaveLength(0);
    expect(ne.apportsCapital).toEqual({});
    expect(ne.retraitsCapital).toEqual({});
    expect(t.ambigus).toHaveLength(2);
    partitionTient(t);
  });

  it('DOUBLE CONSOMMATION interdite : une jambe FX ne devient jamais cotisation, retrait ou apport', () => {
    // La jambe USD entre au F : lue seule ce serait un Transfert ambigu, mais
    // si un défaut la reclassait « apport-capital », l'invariant tomberait.
    const t = construireLigneDuTemps([jambeCad(), jambeUsd()]);
    const idsFx = [t.parAnnee['2026'].nonEnregistre.conversionsDevise[0].jambeCadId,
                   t.parAnnee['2026'].nonEnregistre.conversionsDevise[0].jambeUsdId];
    const tousLesAgregats: number[] = [];
    for (const a of Object.values(t.parAnnee)) {
      for (const r of [a.celi, a.celiapp, a.reer, a.reerConjoint]) {
        for (const p of [r.cotisations, r.retraits]) for (const ag of Object.values(p)) tousLesAgregats.push(...ag.sources);
      }
      for (const p of Object.values(a.reee.parBeneficiaire)) for (const ag of Object.values(p)) tousLesAgregats.push(...ag.sources);
      for (const ag of Object.values(a.nonEnregistre.apportsCapital)) tousLesAgregats.push(...ag.sources);
      for (const ag of Object.values(a.nonEnregistre.retraitsCapital)) tousLesAgregats.push(...ag.sources);
    }
    for (const id of idsFx) expect(tousLesAgregats).not.toContain(id);
  });
});

describe('les devises ne se mélangent jamais', () => {
  it('10 000 CAD + 10 000 USD = DEUX agrégats, pas 20 000', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: COMPTANT, total: 10000 }),
      tx({ type: 'Cotisation', noCompte: COMPTANT, symbole: '1USD', devise: 'USD', total: 10000 }),
    ]);
    const ap = t.parAnnee['2026'].nonEnregistre.apportsCapital;
    expect(ap['CAD'].montant).toBe(10000);
    expect(ap['USD'].montant).toBe(10000);
    expect(Object.keys(ap)).toHaveLength(2);
  });
});

describe('rien ne disparaît', () => {
  it('un type inconnu → diagnostic nommé, événement conservé', () => {
    const t = construireLigneDuTemps([tx({ type: 'Assignation', noCompte: E, symbole: 'OPT', total: 0 })]);
    expect(t.inconnus).toHaveLength(1);
    expect(t.diagnostics.libellesInconnus).toEqual({ assignation: 1 });
    partitionTient(t);
  });

  it('une ligne sans régime → comptée, tracée, jamais agrégée', () => {
    const t = construireLigneDuTemps([tx({ type: 'Cotisation', noCompte: 'pas un compte', total: 100 })]);
    expect(t.diagnostics.lignesSansRegime).toBe(1);
    expect(t.ambigus).toHaveLength(1);
    partitionTient(t);
  });

  it('un virement interne détecté par la note : collection à part, jamais un flux externe', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Retrait', noCompte: E, total: -7000, note: 'TRANSFERE A 37FICTW' }),
    ]);
    expect(t.virementsInternes).toHaveLength(1);
    expect(t.parAnnee['2026'].nonEnregistre.retraitsCapital).toEqual({});
    partitionTient(t);
  });

  it('la partition tient sur un lot mélangé — chaque ligne a exactement une disposition', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Retrait', noCompte: REER, total: -3000 }),
      tx({ type: 'Achat', noCompte: COMPTANT, symbole: 'XYZ', total: -5000 }),
      tx({ type: 'Dividendes', noCompte: COMPTANT, symbole: 'XYZ', total: 120 }),
      tx({ type: 'Transfert', noCompte: CELI, total: 20000 }),
      tx({ type: 'Journal', noCompte: REEE, symbole: 'FND123', total: 0, quantite: 12 }),
      tx({ type: 'Cotisation', noCompte: '37-FICT-X', total: 50 }),
    ]);
    partitionTient(t);
    expect(t.diagnostics.dispositions).toMatchObject({
      agrege: 2, 'hors-flux': 2, ambigu: 2, inconnu: 1,
    });
  });
});

describe('les cumulatifs — depuis le début de l’historique DISPONIBLE', () => {
  it('CELI : X, puis X+Y, puis X+Y+Z, sources accumulées', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, date: '2024-05-01', total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2025-04-01', total: 6500 }),
      tx({ type: 'Retrait', noCompte: CELI, date: '2025-09-01', total: -2000 }),
      tx({ type: 'Cotisation', noCompte: CELI, date: '2026-02-01', total: 7000 }),
    ]);
    expect(t.cumulatifs['2024'].celi.cotisations['CAD'].montant).toBe(6000);
    expect(t.cumulatifs['2025'].celi.cotisations['CAD'].montant).toBe(12500);
    expect(t.cumulatifs['2026'].celi.cotisations['CAD'].montant).toBe(19500);
    expect(t.cumulatifs['2025'].celi.retraits['CAD'].montant).toBe(2000);
    expect(t.cumulatifs['2026'].celi.cotisations['CAD'].sources).toHaveLength(3);
    // Et l'année seule reste l'année seule :
    expect(t.parAnnee['2026'].celi.cotisations['CAD'].montant).toBe(7000);
  });
});

describe('l’unicité des sources — à travers TOUTE la timeline', () => {
  /** Tous les ids de sources de tous les agrégats FERMES d'une année (hors cumulatifs, qui répètent par construction). */
  function toutesLesSources(t: LigneDuTemps): number[] {
    const ids: number[] = [];
    for (const a of Object.values(t.parAnnee)) {
      for (const r of [a.celi, a.celiapp, a.reer, a.reerConjoint]) {
        for (const p of [r.cotisations, r.retraits]) for (const ag of Object.values(p)) ids.push(...ag.sources);
      }
      for (const p of Object.values(a.reee.parBeneficiaire)) for (const ag of Object.values(p)) ids.push(...ag.sources);
      for (const ag of Object.values(a.reee.retraits)) ids.push(...ag.sources);
      for (const r of [a.ferr, a.frv, a.cri]) for (const ag of Object.values(r.retraits)) ids.push(...ag.sources);
      for (const ag of Object.values(a.nonEnregistre.apportsCapital)) ids.push(...ag.sources);
      for (const ag of Object.values(a.nonEnregistre.retraitsCapital)) ids.push(...ag.sources);
    }
    return ids;
  }

  it('aucun id n’apparaît dans DEUX agrégats — la partition ne suffit pas, on balaie les agrégats eux-mêmes', () => {
    // La contre-expertise a montré que l'invariant de partition (une disposition
    // par id) est structurellement AVEUGLE à une double agrégation : un id
    // poussé dans deux agrégats garderait une seule disposition. On vérifie
    // donc les agrégats directement, sur un lot qui mélange tout.
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 5000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Cotisation', noCompte: REER, total: 12000 }),
      tx({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'CONTRIBUTION 01ENFANTA' }),
      tx({ type: 'Retrait', noCompte: FERR, total: -1000 }),
      tx({ type: 'Cotisation', noCompte: COMPTANT, total: 30000 }),
      tx({ type: 'Retrait', noCompte: MARGE, total: -4000 }),
      tx({ type: 'Transfert', noCompte: E, total: -13252, note: 'AU F1 TAUX 1.3252' }),
      tx({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: 10000 }),
    ]);
    const ids = toutesLesSources(t);
    expect(new Set(ids).size).toBe(ids.length);
    // Et chaque agrégat = la somme EXACTE de ses sources — sur du MULTI-sources.
    const celi = t.parAnnee['2026'].celi.cotisations['CAD'];
    expect(celi.sources).toHaveLength(2);
    sourcesExactes(t, celi);
    const retraits = t.parAnnee['2026'].celi.retraits['CAD'];
    sourcesExactes(t, retraits, true);
  });
});

describe('la timeline ne se persiste JAMAIS', () => {
  it('ecrireProfil retire ligneDuTemps avant d’écrire — même si l’appelant passe un profil hydraté', async () => {
    // Le contrat « dérivée à la lecture, jamais persistée » est tenu par la
    // fonction d'écriture ELLE-MÊME, pas par la discipline des appelants.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');
    const racineOriginale = process.env.BASE_LOCALE_RACINE;
    const racine = await fs.mkdtemp(path.join(os.tmpdir(), 'timeline-persist-'));
    process.env.BASE_LOCALE_RACINE = racine;
    try {
      const { ecrireProfil } = await import('../stockage');
      const { profilVierge } = await import('../types');
      const profil = profilVierge('a1b2c3d4', '2026-08-19');
      profil.ligneDuTemps = construireLigneDuTemps([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })]);

      const ecrit = await ecrireProfil(profil, '2026-08-19');
      expect(ecrit.ligneDuTemps).toBeUndefined();

      const surDisque = JSON.parse(await fs.readFile(path.join(racine, 'profils', 'a1b2c3d4.json'), 'utf8'));
      expect(surDisque.ligneDuTemps).toBeUndefined();
      expect(JSON.stringify(surDisque)).not.toMatch(/ligneDuTemps|conversionsDevise/);
    } finally {
      if (racineOriginale === undefined) delete process.env.BASE_LOCALE_RACINE;
      else process.env.BASE_LOCALE_RACINE = racineOriginale;
      await fs.rm(racine, { recursive: true, force: true });
    }
  });
});

// ═══ L'INVARIANT GLOBAL D'UNICITÉ (20 août 2026, §6 du lot) ═════════════════
//
// « Une LigneTransaction ne peut avoir qu'UNE seule disposition principale. »
// La Map `disposition` le garantit par construction ; ce test le PROUVE de
// l'extérieur, sur un lot mélangé, en vérifiant que les collections publiques
// et les sources d'agrégats sont deux à deux DISJOINTES. Sans lui, la nouvelle
// disposition `consommee-partie-double` aurait pu recouvrir une jambe FX ou un
// agrégat sans que rien ne le dise.
describe('invariant global d’unicité — une ligne, UNE disposition', () => {
  it('collections et agrégats sont deux à deux disjoints, sur un lot mélangé', () => {
    const t = construireLigneDuTemps([
      // une partie double comptée (jambe argent + jambe titre consommée)
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note: 'COTISATION' }),
      // une conversion FX confirmée
      tx({ type: 'Transfert', noCompte: E, symbole: '1CAD', devise: 'CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: F, symbole: '1USD', devise: 'USD', total: -10000 }),
      // un retrait ferme, un virement interne noté, un ambigu, un inconnu
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -3000, note: 'TRSF 37FICTA' }),
      tx({ type: 'Retrait', noCompte: CELI, total: 1500 }),
      tx({ type: 'Fractionnement', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 2, total: 0 }),
    ]);
    partitionTient(t);

    const sourcesAgregats = new Set<number>();
    for (const a of Object.values(t.parAnnee)) {
      for (const r of [a.celi, a.celiapp, a.reer, a.reerConjoint]) {
        for (const p of [r.cotisations, r.retraits]) {
          for (const ag of Object.values(p)) for (const id of ag.sources) sourcesAgregats.add(id);
        }
      }
    }
    const idsFx = new Set(Object.values(t.parAnnee).flatMap((a) =>
      a.nonEnregistre.conversionsDevise.flatMap((c) => [c.jambeCadId, c.jambeUsdId])));
    const collections: Array<[string, Set<number>]> = [
      ['agrégats', sourcesAgregats],
      ['conversions FX', idsFx],
      ['consommées partie double', new Set(t.consommesPartieDouble.map((e) => e.id))],
      ['ambigus', new Set(t.ambigus.map((e) => e.id))],
      ['inconnus', new Set(t.inconnus.map((e) => e.id))],
      ['virements internes', new Set(t.virementsInternes.map((e) => e.id))],
    ];
    // Aucune paire de collections ne partage un id — c'est l'unicité.
    for (let i = 0; i < collections.length; i++) {
      for (let j = i + 1; j < collections.length; j++) {
        const communs = [...collections[i][1]].filter((id) => collections[j][1].has(id));
        expect(`${collections[i][0]} ∩ ${collections[j][0]} = ${JSON.stringify(communs)}`)
          .toBe(`${collections[i][0]} ∩ ${collections[j][0]} = []`);
      }
    }
    // Et la partie double a bien eu lieu, sinon le test ne prouverait rien.
    expect(t.consommesPartieDouble).toHaveLength(1);
    expect(t.partiesDoubles).toHaveLength(1);
    expect(idsFx.size).toBe(2);
  });

  it('la jambe titre consommée reste VISIBLE et retraçable — jamais jetée', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note: 'COTISATION' }),
    ]);
    expect(t.evenements).toHaveLength(2);                       // les deux lignes existent toujours
    const { jambeArgentId, jambeTitreId } = t.partiesDoubles[0];
    expect(t.evenements[jambeTitreId].motif).toContain('consommée');
    expect(t.evenements[jambeTitreId].montant).toBe(-10000);    // son montant d'origine, intact
    expect(t.parAnnee['2026'].celi.cotisations['CAD'].sources).toEqual([jambeArgentId]);
    expect(t.diagnostics.dispositions['consommee-partie-double']).toBe(1);
  });
});

describe('la déduplication logique', () => {
  it('une transaction ne peut pas apparaître deux fois dans le même agrégat', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),   // deux VRAIES cotisations identiques
    ]);
    const ag = t.parAnnee['2026'].celi.cotisations['CAD'];
    expect(ag.montant).toBe(14000);
    expect(ag.sources).toEqual([0, 1]);                          // deux ids distincts
    expect(new Set(ag.sources).size).toBe(ag.sources.length);    // aucun id répété
  });
});
