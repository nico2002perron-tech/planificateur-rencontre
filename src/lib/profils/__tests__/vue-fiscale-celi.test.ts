// LA COUCHE « MONTANT FISCAL CAD » — les 12 verrous de la consigne du 20 août
// 2026 (A à L), plus l'identité stable, les résolutions refusées déclarées et
// la cohérence avec vueCeliParAnnee.
//
// Données synthétiques, comptes « FICT ».
import { describe, it, expect } from 'vitest';
import { construireLigneDuTemps, vueCeliParAnnee } from '../ligne-du-temps';
import {
  vueFiscaleCeli, cleEvenementFiscal,
  type ResolutionMontantFiscalCad,
} from '../vue-fiscale-celi';
import { tauxExplicitesDansNote, tauxDansNote } from '../rapprochement';
import { deriverCeliParAnnee } from '../deriver';
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
const vf = (lignes: LigneTransaction[], resolutions: ResolutionMontantFiscalCad[] = []) =>
  vueFiscaleCeli(construireLigneDuTemps(lignes), resolutions);
const resolution = (cle: string, montantCad: number): ResolutionMontantFiscalCad =>
  ({ cleEvenement: cle, montantCad, dateResolution: '2026-08-20', note: null });

// ═══ A · transaction déjà en CAD ═════════════════════════════════════════════

describe('A — cotisation CAD : le montant fiscal EST le montant', () => {
  it('7 000 CAD → confirmé, source transaction-cad, aucune conversion', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })]);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(7000);
    expect(v.evenements).toHaveLength(1);
    expect(v.evenements[0].role).toBe('cotisation');
    expect(v.evenements[0].fiscal).toMatchObject({
      montantCad: 7000, source: 'transaction-cad', confiance: 'confirme',
      tauxUtilise: null, deviseOriginale: 'CAD', montantOriginal: 7000,
    });
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
  });
});

// ═══ B · USD sans taux ═══════════════════════════════════════════════════════

describe('B — cotisation 1 000 USD sans taux : le montant CAD est INCONNU', () => {
  it('montantCad null, jamais 1 000 CAD, motif honnête', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.source).toBe('inconnue');
    expect(f.confiance).toBe('inconnu');
    expect(f.montantOriginal).toBe(1000);
    expect(f.deviseOriginale).toBe('USD');
    expect(f.motif).toContain('jamais 1:1');
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(0);
    expect(v.parAnnee['2026'].evenementsSansMontantCad).toEqual([f.evenementId]);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
  });
});

// ═══ C · CAD + USD : jamais fondus ═══════════════════════════════════════════

describe('C — 6 000 CAD + 1 000 USD : JAMAIS 7 000 CAD', () => {
  it('le confirmé vaut 6 000, l’USD est déclaré sans montant', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
    ]);
    const a = v.parAnnee['2026'];
    expect(a.cotisationsCadConfirmees).toBe(6000);
    expect(a.cotisationsCadConfirmees + a.cotisationsCadAConfirmer).not.toBe(7000);
    expect(a.evenementsSansMontantCad).toHaveLength(1);
    expect(v.diagnostics.sansMontantCad).toBe(1);
  });
});

// ═══ D · retrait USD sans taux ═══════════════════════════════════════════════

describe('D — retrait USD sans taux : montant CAD inconnu', () => {
  it('null, et tousRetraitsEnCadFiscal tombe', () => {
    const v = vf([tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -500 })]);
    expect(v.evenements[0].role).toBe('retrait-ferme');
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(false);
  });
});

// ═══ E · taux explicite dans la note de la ligne même ════════════════════════

describe('E — taux annoncé dans SA note : converti, provenance conservée, jamais « confirme »', () => {
  it('1 000 USD @ 1.3252 → 1 325,20 CAD, eleve, taux et date conservés', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'CONV EN CAD @ 1.3252' })]);
    const f = v.evenements[0].fiscal;
    expect(f).toMatchObject({
      montantCad: 1325.2, source: 'taux-explicite-croesus', confiance: 'eleve',
      tauxUtilise: 1.3252, dateTaux: '2026-03-15',
    });
    expect(f.sources).toEqual([f.evenementId]);
    const a = v.parAnnee['2026'];
    expect(a.cotisationsCadAConfirmer).toBe(1325.2);
    expect(a.cotisationsCadConfirmees).toBe(0);
    // « eleve » n'est PAS « en CAD fiscal » au sens strict : à valider.
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
  });
});

// ═══ F · taux contradictoire ═════════════════════════════════════════════════

describe('F — deux taux différents dans la note : contradiction, aucun choisi', () => {
  it('TAUX 1.30 et @ 1.40 → montantCad null, ambigu', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'TAUX 1.30 SPOT @ 1.40' })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.confiance).toBe('ambigu');
    expect(f.motif).toContain('contradiction');
  });
});

// ═══ G · résolution manuelle ═════════════════════════════════════════════════

describe('G — résolution manuelle : confirme SANS toucher l’événement source', () => {
  it('la grandeur est appliquée avec le signe de la transaction, le livre reste intact', () => {
    const lignes = [tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 })];
    const avant = JSON.stringify(lignes);
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf(lignes, [resolution(cle, 1350)]);
    expect(v.evenements[0].fiscal).toMatchObject({
      montantCad: 1350, source: 'resolution-manuelle', confiance: 'confirme',
      montantOriginal: 1000, deviseOriginale: 'USD',
    });
    expect(v.evenements[0].fiscal.motif).toContain('2026-08-20');
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(1350);
    expect(v.resolutions).toEqual({ appliquees: 1, ignorees: [] });
    expect(JSON.stringify(lignes)).toBe(avant);   // la transaction historique n'a pas bougé
  });
});

// ═══ H · les DEUX questions d'un retrait ne se confondent pas ════════════════

describe('H — retrait à confirmer avec montant CAD connu : la nature reste à confirmer', () => {
  it('résolution du MONTANT (question A) sans jamais trancher la NATURE (question B)', () => {
    const lignes = [tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -7000, note: 'TRANSFERE A 37FICTA' })];
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', -7000);
    const v = vf(lignes, [resolution(cle, 9500)]);
    expect(v.evenements[0].role).toBe('retrait-a-confirmer');
    expect(v.evenements[0].fiscal.montantCad).toBe(-9500);   // le signe de la transaction
    expect(v.evenements[0].fiscal.confiance).toBe('confirme');
    const a = v.parAnnee['2026'];
    expect(a.retraitsCadAConfirmer).toBe(9500);
    expect(a.retraitsCadConfirmes).toBe(0);                   // JAMAIS ferme sur la seule question A
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(true);  // question A : répondue
    expect(v.completude.retraitsNatureConfirmee).toBe(false); // question B : toujours ouverte
  });
});

// ═══ I · une paire FX voisine n'est PAS une relation ═════════════════════════

describe('I — FX-1 confirmée le même jour : jamais attribuée au flux CELI', () => {
  it('la paire vit sa vie, la cotisation USD reste sans montant CAD', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: '37-FICT-E', symbole: '1CAD', devise: 'CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: -10000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
    ]);
    expect(t.diagnostics.pairesFxConfirmees).toBe(1);          // la paire EST reconnue…
    const v = vueFiscaleCeli(t);
    expect(v.evenements).toHaveLength(1);                       // …mais ne fait pas partie du CELI
    expect(v.evenements[0].fiscal.montantCad).toBeNull();       // et son taux n'est PAS emprunté
    expect(v.evenements[0].fiscal.source).toBe('inconnue');
  });
});

// ═══ J · aucune attribution par proximité ════════════════════════════════════

describe('J — deux USD le même jour, un seul taux en note : aucun héritage', () => {
  it('le taux ne vaut que pour la ligne qui le PORTE', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'TAUX 1.3000' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 2000 }),
    ]);
    const [avecTaux, sansTaux] = v.evenements.map((e) => e.fiscal);
    expect(avecTaux.montantCad).toBe(1300);
    expect(sansTaux.montantCad).toBeNull();
    expect(sansTaux.motif).toContain('sans taux');
  });
});

// ═══ K · traçabilité ═════════════════════════════════════════════════════════

describe('K — chaque montant CAD pointe vers ses sources, chaque somme se recompose', () => {
  const lignes = [
    tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
    tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'TAUX 1.3000' }),
    tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
    tx({ type: 'Retrait', noCompte: CELI, total: -3000, note: 'TRSF 37FICTA' }),
  ];

  it('les agrégats se recomposent EXACTEMENT depuis les événements cités', () => {
    const v = vf(lignes);
    const parId = new Map(v.evenements.map((e) => [e.fiscal.evenementId, e.fiscal]));
    for (const a of Object.values(v.parAnnee)) {
      const somme = (ids: number[]) => Math.round(ids.reduce((s, id) => s + Math.abs(parId.get(id)!.montantCad as number), 0) * 100) / 100;
      expect(somme(a.sources.cotisationsCadConfirmees)).toBe(a.cotisationsCadConfirmees);
      expect(somme(a.sources.cotisationsCadAConfirmer)).toBe(a.cotisationsCadAConfirmer);
      expect(somme(a.sources.retraitsCadConfirmes)).toBe(a.retraitsCadConfirmes);
      expect(somme(a.sources.retraitsCadAConfirmer)).toBe(a.retraitsCadAConfirmer);
    }
  });

  it('chaque événement paraît EXACTEMENT une fois, et sa clé se recalcule', () => {
    const v = vf(lignes);
    const ids = v.evenements.map((e) => e.fiscal.evenementId);
    expect(new Set(ids).size).toBe(ids.length);
    const t = construireLigneDuTemps(lignes);
    for (const e of v.evenements) {
      const ev = t.evenements[e.fiscal.evenementId];
      expect(e.fiscal.cleEvenement).toBe(cleEvenementFiscal(ev.compte, ev.date, ev.devise, ev.montant as number));
    }
  });

  it('COHÉRENCE avec vueCeliParAnnee : les nombres CAD des deux vues se répondent', () => {
    const t = construireLigneDuTemps(lignes);
    const celi = vueCeliParAnnee(t);
    const fiscale = vueFiscaleCeli(t);
    const a = fiscale.parAnnee['2026'];
    expect(a.cotisationsCadConfirmees).toBe(celi.cotisations['2026']);
    expect(a.retraitsCadConfirmes + a.retraitsCadAConfirmer).toBe(celi.retraits['2026']);
  });
});

// ═══ L · aucun taux externe, jamais ══════════════════════════════════════════

describe('L — aucun taux inventé : ni marché, ni 1:1, ni convention non mesurée', () => {
  it('USD et GBP sans note : null, point', () => {
    const v = vf([
      tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -500 }),
      tx({ type: 'Retrait', noCompte: CELI, devise: 'GBP', total: -800 }),
    ]);
    for (const e of v.evenements) expect(e.fiscal.montantCad).toBeNull();
  });

  it('un taux annoncé sur une devise NON mesurée (EUR) ne convertit rien', () => {
    const v = vf([tx({ type: 'Retrait', noCompte: CELI, devise: 'EUR', total: -800, note: 'TAUX 1.50' })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.motif).toContain('EUR');
    expect(f.motif).toContain('mesur');
  });

  it('un taux nul annoncé ne fabrique pas un faux zéro CAD', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'TAUX 0,0000' })]);
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
    expect(v.evenements[0].fiscal.confiance).toBe('ambigu');
  });
});

// ═══ les résolutions refusées se DÉCLARENT ═══════════════════════════════════

describe('résolutions refusées — jamais appliquées en silence, jamais perdues en silence', () => {
  const usd = () => tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 });

  it('sans cible : déclarée', () => {
    const v = vf([usd()], [resolution('37-ZZZZ-W|2026-01-01|USD|123.00', 500)]);
    expect(v.resolutions.ignorees).toHaveLength(1);
    expect(v.resolutions.ignorees[0].motif).toContain('sans cible');
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
  });

  it('clé partagée par deux événements identiques : appliquée à AUCUN', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf([usd(), usd()], [resolution(cle, 1350)]);
    for (const e of v.evenements) expect(e.fiscal.montantCad).toBeNull();
    expect(v.resolutions.ignorees[0].motif).toContain('partagée par 2');
  });

  it('sur un événement déjà en CAD : la donnée exacte gagne, le refus se déclare', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'CAD', 7000);
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })], [resolution(cle, 3000)]);
    expect(v.evenements[0].fiscal).toMatchObject({ montantCad: 7000, source: 'transaction-cad' });
    expect(v.resolutions.ignorees[0].motif).toContain('déjà en dollars canadiens');
  });

  it('deux résolutions contradictoires sur la même clé : aucune', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf([usd()], [resolution(cle, 1350), resolution(cle, 1400)]);
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
    expect(v.resolutions.ignorees[0].motif).toContain('contradictoires');
  });

  it('grandeur non positive : refusée — le signe vient de la transaction, jamais de la saisie', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf([usd()], [resolution(cle, -1350)]);
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
    expect(v.resolutions.ignorees[0].motif).toContain('grandeur');
  });

  it('une résolution VALIDE qui suit une résolution refusée : refusée AUSSI, et déclarée pour elle-même', () => {
    // Contre-expertise du 20 août : elle disparaissait en silence — le
    // fiscaliste qui corrigeait sa saisie dans le même lot perdait sa
    // confirmation sans explication.
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf([usd()], [resolution(cle, -5), resolution(cle, 1350)]);
    expect(v.evenements[0].fiscal.montantCad).toBeNull();
    expect(v.resolutions.ignorees).toHaveLength(2);
    expect(v.resolutions.ignorees[1].motif).toContain('antérieure');
  });

  it('résolution visant un événement CELI que la vue ne sait pas exprimer : le motif est le VRAI motif', () => {
    // Un « Dépôt » CELI existe dans le livre mais la règle 2 ne le voit pas :
    // « sans cible » serait un mensonge — l'événement a bel et bien cette clé.
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 5000);
    const v = vf([tx({ type: 'Dépôt', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 5000 })], [resolution(cle, 6600)]);
    expect(v.resolutions.ignorees[0].motif).toContain('ne sait pas l’exprimer');
  });
});

// ═══ complétude ══════════════════════════════════════════════════════════════

describe('complétude — les préconditions de la future migration, dites sans faux vert', () => {
  it('un ambigu CELI résiduel casse « nature confirmée »', () => {
    // Un « Retrait » POSITIF est un renversement possible : ambigu résiduel.
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: 2000 }),
    ]);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
    expect(v.completude.evenementsCeliAmbigus).toBe(1);
    // L'ambigu n'est PAS un événement fiscal : compté nulle part, déclaré.
    expect(v.evenements).toHaveLength(1);
  });

  it('l’activité externe n’est JAMAIS devinée : « inconnu » par défaut, verbatim sinon', () => {
    const t = construireLigneDuTemps([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 })]);
    expect(vueFiscaleCeli(t).completude.activiteExterneConfirmeeAbsente).toBe('inconnu');
    expect(vueFiscaleCeli(t, [], { activiteExterneConfirmeeAbsente: 'non' }).completude.activiteExterneConfirmeeAbsente).toBe('non');
  });

  it('livre vide : les booléens sont vides de sens et la portée le DIT', () => {
    const v = vueFiscaleCeli(construireLigneDuTemps([]));
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);   // vrai à vide…
    expect(v.completude.portee).toBe('inconnue');                   // …mais la portée refuse le faux vert
    expect(v.diagnostics.evenements).toBe(0);
  });

  it('le dossier ENTIÈREMENT exprimable : les trois drapeaux internes montent', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', 1000);
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 6000 }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000 }),
      tx({ type: 'Retrait', noCompte: CELI, total: -2000 }),
    ], [resolution(cle, 1350)]);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(true);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(7350);   // 6 000 + 1 350 résolus — jamais 7 000
  });
});

// ═══ les gardes de la contre-expertise du 20 août ════════════════════════════

describe('frontière gauche — un mot français n’est jamais un mot-clé de taux', () => {
  it('CAPITAUX, TOTAUX, PRORATE, ÉTAUX : rien d’annoncé', () => {
    expect(tauxExplicitesDansNote('CAPITAUX 5,000.00 RECUS')).toEqual([]);
    expect(tauxExplicitesDansNote('TOTAUX 1,50')).toEqual([]);
    expect(tauxExplicitesDansNote('CALCUL PRORATE 1.25 JOURS')).toEqual([]);
    expect(tauxExplicitesDansNote('ÉTAUX 1.25')).toEqual([]);        // \b seul laissait passer l'accent
  });

  it('« CAPITAUX 5,000.00 » sur une cotisation USD ne fabrique AUCUN montant', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'CAPITAUX 5,000.00 RECUS' })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.source).toBe('inconnue');
    // Et le motif du null est le VRAI motif : la note contient bien des nombres.
    expect(f.motif).toContain('forme reconnue');
  });
});

describe('« @ » sans vocabulaire de conversion — un PRIX, pas un taux', () => {
  it('« 500 PARTS @ 9.9999 » : refusé, motif honnête', () => {
    const v = vf([tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -1000, note: '500 PARTS @ 9.9999' })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.source).toBe('inconnue');
    expect(f.motif).toContain('forme reconnue');
  });

  it('« CONV EN CAD @ 1.3252 » garde son taux : le vocabulaire est là', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'CONV EN CAD @ 1.3252' })]);
    expect(v.evenements[0].fiscal.montantCad).toBe(1325.2);
  });
});

describe('« EN USD » — une convention jamais mesurée ne convertit rien', () => {
  it('« CONV EN USD 0,7546 » : refusé, ni appliqué en direct ni inversé', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'CONV EN USD 0,7546' })]);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBeNull();
    expect(f.motif).toContain('EN USD');
    expect(f.motif).toContain('mesur');
  });
});

describe('rien de CELI n’échappe en silence — les faux verts de la contre-expertise', () => {
  it('un « Transfert » CELI noté ORPHELIN : un rôle « à confirmer », plus un trou muet', () => {
    // ÉVOLUTION DU 20 AOÛT (étape 4) : ce mouvement n'est plus « non exprimé ».
    // Sa note nomme un compte, donc l'étape 4 lui fait une RELATION — orpheline,
    // car aucune jambe correspondante n'est dans le livre. La nature reste à
    // confirmer (un CELI de conjoint ferait un retrait, pas un transfert
    // direct), mais le montant CAD, lui, est connu : les deux questions sont
    // séparées (§19).
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Transfert', noCompte: CELI, total: -5000, note: 'TRANSFERE A 37FICTA' }),
    ]);
    expect(v.evenements.map((e) => e.role)).toEqual(['cotisation', 'retrait-a-confirmer']);
    expect(v.parAnnee['2026'].retraitsCadAConfirmer).toBe(5000);
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);       // jamais ferme sans preuve
    expect(v.completude.retraitsNatureConfirmee).toBe(false);      // question B : ouverte
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(true);       // question A : répondue
    expect(v.completude.evenementsCeliNonExprimes).toBe(0);        // il n'échappe plus à la vue
    expect(v.completude.evenementsCeliBloquants).toBe(0);          // il est COMPTÉ, donc pas « bloquant » : c'est son rôle qui le dit
  });

  it('un « Dépôt » CELI que la règle 2 ne voit pas : déclaré, jamais un faux vert', () => {
    const v = vf([tx({ type: 'Dépôt', noCompte: CELI, total: 5000 })]);
    expect(v.evenements).toHaveLength(0);
    expect(v.completude.evenementsCeliNonExprimes).toBe(1);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
  });
});

// ═══ « Dépôt » — le VERDICT DE LA MESURE, pas de l'intuition ═════════════════
//
// docs/mesure-depot-celi-2026-08-20.md, base locale (8 590 lignes, 7 clients) :
//   · CELI    : 1 SEULE ligne « Dépôt » (2009, 152,38 $, note « FRAIS DE … »,
//               contrepartie interne le même jour) — un remboursement de frais,
//               PAS une cotisation. Seau de mesure : « indécidable ».
//   · CELIAPP : 0 ligne. Rien à décider — le régime n'existe que depuis 2023.
//   · Pour comparaison, l'argent neuf CELI reconnu par la règle 2 : 9 jambes,
//     TOUTES en encaisse positive.
//
// VERDICT : **NO-GO** — « Dépôt » n'entre PAS dans la règle d'argent neuf.
// Une occurrence unique, qui de surcroît ressemble à un remboursement de frais,
// ne fonde aucune règle : ce serait exactement l'analogie que le dépôt
// s'interdit (« cette règle existe parce que X % des vrais cas suivent ce
// motif », jamais « le mot semble évident »). Le REEE garde SA règle
// historique, où « Dépôt » est admis — mesuré là-bas, pas ici.
//
// CE QUE CES TESTS VERROUILLENT : le NO-GO ne doit pas être un silence. Un
// « Dépôt » CELI n'est jamais compté comme cotisation, et il est toujours
// DÉCLARÉ non exprimé — de sorte qu'un futur calcul de droits ne pourra pas
// passer au vert au-dessus de lui.
describe('« Dépôt » CELI/CELIAPP — NO-GO mesuré : jamais compté, toujours déclaré', () => {
  const CELIAPP = '37-FICT-Q';
  const cas: Array<[string, LigneTransaction[]]> = [
    ['dépôt externe clair (le motif le plus favorable)', [tx({ type: 'Dépôt', noCompte: CELI, total: 5000 })]],
    ['dépôt citant un compte interne', [tx({ type: 'Dépôt', noCompte: CELI, total: 5000, note: 'TRANSFERE A 37FICTA' })]],
    ['dépôt avec contrepartie le même jour', [
      tx({ type: 'Dépôt', noCompte: CELI, total: 152.38, note: 'FRAIS DE GESTION' }),
      tx({ type: 'Frais', noCompte: '37-FICT-A', total: -152.38 }),
    ]],
    ['dépôt en USD', [tx({ type: 'Dépôt', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 3000 })]],
    ['dépôt CELIAPP', [tx({ type: 'Dépôt', noCompte: CELIAPP, total: 8000 })]],
    ['dépôt sans symbole', [tx({ type: 'Dépôt', noCompte: CELI, symbole: '', total: 5000 })]],
    ['dépôt avec partie double (jambe titre du même montant)', [
      tx({ type: 'Dépôt', noCompte: CELI, total: 9000 }),
      tx({ type: 'Dépôt', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 90, total: -9000 }),
    ]],
    ['dépôt ambigu (montant négatif)', [tx({ type: 'Dépôt', noCompte: CELI, total: -5000 })]],
  ];

  for (const [nom, lignes] of cas) {
    it(`${nom} → aucune cotisation CELI, et le montant n’est jamais fondu`, () => {
      const t = construireLigneDuTemps(lignes);
      const celi = vueCeliParAnnee(t);
      expect(celi.cotisations['2026']).toBeUndefined();            // JAMAIS de l'argent neuf
      expect(deriverCeliParAnnee(lignes).cotisations['2026'] ?? 0).toBe(0);   // l'ancien non plus : aucune régression
      const v = vueFiscaleCeli(t);
      expect(v.parAnnee['2026']?.cotisationsCadConfirmees ?? 0).toBe(0);
    });
  }

  it('le NO-GO se DÉCLARE : un dépôt CELI empêche les drapeaux de complétude de monter', () => {
    const v = vf([tx({ type: 'Dépôt', noCompte: CELI, total: 5000 })]);
    expect(v.completude.evenementsCeliNonExprimes).toBeGreaterThan(0);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
  });

  it('le REEE garde SA règle : « Dépôt » y reste compté (mesuré là-bas, pas dans le CELI)', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Dépôt', noCompte: '37-FICT-Z', total: 2500, note: 'COTISATION ENFANT' }),
    ]);
    const parBenef = t.parAnnee['2026'].reee.parBeneficiaire;
    expect(Object.values(parBenef).reduce((s, p) => s + (p.CAD?.montant ?? 0), 0)).toBe(2500);
  });
});

describe('l’arrondi au cent est SYMÉTRIQUE', () => {
  it('la même conversion vaut la même grandeur, en entrée comme en sortie', () => {
    // 0,50 USD × 1,25 = 0,625 $ exactement : Math.round seul donnait 0,63 en
    // cotisation et 0,62 en retrait — la grandeur dépendait du signe.
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 0.5, note: 'TAUX 1.25' }),
      tx({ type: 'Retrait', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -0.5, date: '2026-03-16', note: 'TAUX 1.25' }),
    ]);
    const [cot, ret] = v.evenements.map((e) => e.fiscal);
    expect(cot.montantCad).toBe(0.63);
    expect(ret.montantCad).toBe(-0.63);
  });
});

describe('confidentialité — comptages seulement, aucun nom ne traverse', () => {
  it('note nominative + taux : le taux passe, le nom jamais ; diagnostics = nombres', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, symbole: '1USD', devise: 'USD', total: 1000, note: 'CONFIRME PAR NOMSECRET JEAN TAUX 1.3252' }),
    ], [resolution('37-ZZZZ-W|2026-01-01|USD|123.00', 500)]);
    expect(v.evenements[0].fiscal.montantCad).toBe(1325.2);
    expect(JSON.stringify(v)).not.toMatch(/NOMSECRET/);
    for (const val of Object.values(v.diagnostics)) expect(typeof val).toBe('number');
  });

  it('une devise corrompue par un collage ne traverse ni la clé ni le motif', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, devise: 'NOMSECRET JEAN', total: 1000 })]);
    const f = v.evenements[0].fiscal;
    expect(f.deviseOriginale).toBe('(devise-invalide)');
    expect(f.montantCad).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/NOMSECRET/);
  });
});

// ═══ parties doubles (20 août, soir) — consommée ≠ ambiguë ═══════════════════

describe('parties doubles — la règle 2 explique, la complétude ne rougit plus', () => {
  const paire = (note = 'COTISATION') => [
    tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note }),
    tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note }),
  ];

  it('A · partie double standard : cotisation agrégée, jambe titre consommée, AUCUN faux ambigu', () => {
    const t = construireLigneDuTemps(paire());
    expect(t.consommesPartieDouble).toHaveLength(1);
    expect(t.ambigus).toHaveLength(0);
    expect(t.partiesDoubles).toEqual([{ jambeArgentId: 0, jambeTitreId: 1 }]);
    const celi = vueCeliParAnnee(t);
    expect(celi.cotisations['2026']).toBe(10000);
    expect(celi.completude.evenementsAmbigus).toBe(0);           // la limitation du signal tombe aussi
    const v = vueFiscaleCeli(t);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);      // G · le faux rouge est levé
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
    expect(v.completude.evenementsCeliNonExprimes).toBe(0);
  });

  it('B · apport en nature étiqueté : même comportement, par la règle EXISTANTE', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 9000, note: 'COTISATION EN TITRES' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FNB', quantite: 90, total: -9000, note: 'COTISATION EN TITRES' }),
    ]);
    expect(t.consommesPartieDouble).toHaveLength(1);
    expect(vueCeliParAnnee(t).cotisations['2026']).toBe(9000);
    expect(vueFiscaleCeli(t).completude.retraitsNatureConfirmee).toBe(true);
  });

  it('C · une jambe RÉELLEMENT ambiguë à côté de la paire reste ambiguë', () => {
    const t = construireLigneDuTemps([
      ...paire(),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'AUTRE.TO', quantite: 10, total: -5000 }),
    ]);
    expect(t.consommesPartieDouble).toHaveLength(1);
    expect(t.ambigus).toHaveLength(1);                            // l'orpheline reste un vrai doute
    const v = vueFiscaleCeli(t);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
    expect(v.completude.evenementsCeliAmbigus).toBe(1);
  });

  it('D · une jambe titre ne se consomme JAMAIS deux fois — et la partition tient', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note: 'COTISATION' }),
    ]);
    expect(t.consommesPartieDouble).toHaveLength(1);
    expect(t.partiesDoubles).toHaveLength(1);
    expect(vueCeliParAnnee(t).cotisations['2026']).toBe(20000);   // l'apparié + le simple
    const total = Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0);
    expect(total).toBe(t.diagnostics.lignesLues);                 // une ligne, UNE disposition
  });

  it('E · FX et partie double : disjoints par construction, aucun id partagé', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: '37-FICT-E', symbole: '1CAD', devise: 'CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: -10000 }),
      ...paire(),
    ]);
    expect(t.diagnostics.pairesFxConfirmees).toBe(1);
    expect(t.consommesPartieDouble).toHaveLength(1);
    const conv = t.parAnnee['2026'].nonEnregistre.conversionsDevise[0];
    const idsFx = new Set([conv.jambeCadId, conv.jambeUsdId]);
    for (const e of t.consommesPartieDouble) expect(idsFx.has(e.id)).toBe(false);
    const total = Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0);
    expect(total).toBe(t.diagnostics.lignesLues);
  });

  it('F · les DEUX jambes restent retraçables ; seule la jambe argent porte le montant', () => {
    const t = construireLigneDuTemps(paire());
    const v = vueFiscaleCeli(t);
    const f = v.evenements[0].fiscal;
    expect(f.montantCad).toBe(10000);
    expect(f.sources).toEqual([0, 1]);                            // jambe argent + jambe titre
    expect(f.motif).toContain('jambe titre');
    expect(t.evenements[1].motif).toContain('consommée');
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(10000);
  });

  it('H · les montants sont EXACTEMENT ceux d’avant la correction — parité avec le témoin', () => {
    const lignes = [...paire(), tx({ type: 'Retrait', noCompte: CELI, total: -2000 })];
    const t = construireLigneDuTemps(lignes);
    const celi = vueCeliParAnnee(t);
    expect(celi.cotisations['2026']).toBe(10000);
    expect(celi.retraits['2026']).toBe(2000);
    expect(deriverCeliParAnnee(lignes).cotisations['2026']).toBe(10000);
  });
});

// ═══ HORS FLUX COMPRIS — la classification positive du 20 août ══════════════
//
// « Hors flux » n'est PAS « inconnu » : c'est un savoir. Une ligne comprise
// comme frais, taxe, revenu ou opération sur titre reste visible, ne touche
// aucun montant, et ne bloque plus la complétude fiscale.
describe('hors flux compris — ne bloque plus, ne compte nulle part, reste visible', () => {
  const brouhaha = () => [
    tx({ type: 'Frais de gestion', noCompte: CELI, total: -70 }),
    tx({ type: 'TPS', noCompte: CELI, total: -3.5 }),
    tx({ type: 'TVP', noCompte: CELI, total: -6.98 }),
    tx({ type: 'Remboursement', noCompte: CELI, symbole: 'OBLIG123', quantite: 15000, total: 15000 }),
    tx({ type: 'Échange', noCompte: CELI, symbole: 'XYZ', quantite: 100, total: 0 }),
    tx({ type: 'Expiration', noCompte: CELI, symbole: 'OPT', quantite: 5, total: 0 }),
    tx({ type: 'Intérêts', noCompte: CELI, symbole: 'OBLIG123', total: 120 }),
  ];

  it('COMPLÉTUDE · une cotisation noyée dans le bruit hors flux : tous les drapeaux montent', () => {
    const v = vf([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }), ...brouhaha()]);
    expect(v.completude.evenementsCeliNonExprimes).toBe(0);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(true);
  });

  it('MONTANTS · le bruit ne touche AUCUN montant fiscal (§20)', () => {
    const seule = [tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }), tx({ type: 'Retrait', noCompte: CELI, total: -2000 })];
    const avecBruit = [...seule, ...brouhaha()];
    const a = vf(seule).parAnnee['2026'];
    const b = vf(avecBruit).parAnnee['2026'];
    expect(b.cotisationsCadConfirmees).toBe(a.cotisationsCadConfirmees);
    expect(b.retraitsCadConfirmes).toBe(a.retraitsCadConfirmes);
    expect(b.retraitsCadAConfirmer).toBe(a.retraitsCadAConfirmer);
    // et la vue CELI, qui alimente le signal de maximisation, non plus
    expect(vueCeliParAnnee(construireLigneDuTemps(avecBruit)).cotisations['2026']).toBe(7000);
    expect(vueCeliParAnnee(construireLigneDuTemps(avecBruit)).retraits['2026']).toBe(2000);
  });

  it('FAUX RETRAIT · des frais négatifs ne deviennent jamais un retrait CELI', () => {
    const v = vf([tx({ type: 'Frais de gestion', noCompte: CELI, total: -70 }), tx({ type: 'TPS', noCompte: CELI, total: -3.5 })]);
    expect(v.parAnnee['2026']).toBeUndefined();          // aucun montant, pas même un zéro
    expect(v.evenements).toHaveLength(0);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);
    // La borne des retraits du signal de maximisation ne bouge pas non plus.
    expect(vueCeliParAnnee(construireLigneDuTemps([
      tx({ type: 'Frais de gestion', noCompte: CELI, total: -70 }),
    ])).retraits).toEqual({});
  });

  it('TRAÇABILITÉ · la ligne hors flux reste visible, avec sa disposition explicite', () => {
    const t = construireLigneDuTemps(brouhaha());
    expect(t.evenements).toHaveLength(7);
    expect(t.diagnostics.dispositions['hors-flux']).toBe(7);
    const natures = t.evenements.map((e) => e.nature).sort();
    expect(natures).toEqual(['frais-impot', 'frais-impot', 'frais-impot', 'operation-titre', 'operation-titre', 'operation-titre', 'revenu']);
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });

  it('AMBIGU RÉEL · ce qui reste douteux continue de bloquer (§12)', () => {
    // « Valeur comptable » a été mesuré et REFUSÉ ; un frais POSITIF aussi.
    for (const ligne of [
      tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 10, total: -9000 }),
      tx({ type: 'Frais', noCompte: CELI, total: 57.33 }),
      tx({ type: 'Remboursement', noCompte: CELI, total: 5000 }),   // en ARGENT : jamais mesuré ainsi
    ]) {
      const v = vf([tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }), ligne]);
      const bloque = v.completude.evenementsCeliNonExprimes > 0 || v.completude.evenementsCeliAmbigus > 0;
      expect(bloque, ligne.type).toBe(true);
      expect(v.completude.retraitsNatureConfirmee, ligne.type).toBe(false);
    }
  });

  it('FAUX FLUX · un frais dont la NOTE cite un compte BLOQUE au lieu de disparaître', () => {
    // Contre-expertise du 20 août : sans la garde de la note, cette ligne
    // sortait « frais-impot / confirme » → hors-flux → invisible : de l'argent
    // quittait un CELI vers un compte NOMMÉ, et les trois drapeaux passaient au
    // vert. C'est le faux flux dans sa forme la plus pure.
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Frais', noCompte: CELI, total: -25000, note: 'VIRE DE 37FICTE' }),
    ]);
    expect(v.completude.evenementsCeliAmbigus).toBe(1);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(7000);   // et le montant ne bouge pas
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);          // ni transformé en retrait
  });

  it('COLLISION · une jambe FX ou de partie double n’est jamais re-traitée en hors flux', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: '37-FICT-E', symbole: '1CAD', devise: 'CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: -10000 }),
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note: 'COTISATION' }),
      ...brouhaha(),
    ]);
    const conv = t.parAnnee['2026'].nonEnregistre.conversionsDevise[0];
    const reserves = new Set([conv.jambeCadId, conv.jambeUsdId, ...t.consommesPartieDouble.map((e) => e.id)]);
    const horsFlux = t.evenements.filter((e) => ['operation-titre', 'revenu', 'frais-impot'].includes(e.nature));
    for (const e of horsFlux) expect(reserves.has(e.id)).toBe(false);
    expect(t.diagnostics.dispositions['hors-flux']).toBe(7);
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });
});

// ═══ le socle FX n'a pas bougé ═══════════════════════════════════════════════

describe('tauxExplicitesDansNote — extrait sans changer le comportement FX', () => {
  it('mot-clé seulement : le nombre « nu » reste réservé au FX', () => {
    expect(tauxExplicitesDansNote('TAUX 1.3252')).toEqual([{ taux: 1.3252, motCle: 'TAUX' }]);
    expect(tauxExplicitesDansNote('VIREMENT 1.3252')).toEqual([]);   // pas de mot-clé
    expect(tauxDansNote('VIREMENT 1.3252')).toBe(1.3252);            // le repli FX, lui, le voit toujours
  });

  it('tous les taux annoncés, dans l’ordre, avec leur mot-clé', () => {
    expect(tauxExplicitesDansNote('TAUX 1.30 SPOT @ 1.40').map((a) => a.taux)).toEqual([1.3, 1.4]);
    expect(tauxDansNote('TAUX 1.30 SPOT @ 1.40')).toBe(1.3);         // FX : le premier, comme avant
  });
});

// ═══ ÉTAPE 4 — LES VIREMENTS INTERNES (20 août 2026) ═════════════════════════
//
// La mesure commande la prudence : 28/28 des virements CELI de la base citent
// un compte, mais 2/28 seulement ont une contrepartie DANS le livre. Une note
// qui nomme un CELI ne dit pas à QUI il appartient — et un CELI de conjoint
// ferait un RETRAIT là où le CELI du titulaire fait un transfert direct.
// D'où la règle : seul l'appariement des deux jambes rend une nature ferme.
describe('virements internes — la relation, ou rien', () => {
  const MARGE = '37-FICT-E';
  const CELI2 = '37-AUTR-W';
  const CELIAPP = '37-FICT-Q';
  const paire = (compteA: string, montantA: number, compteB: string, note = '') => [
    tx({ type: 'Transfert', noCompte: compteA, total: montantA, note }),
    tx({ type: 'Transfert', noCompte: compteB, total: -montantA, note }),
  ];
  const relCeli = (lignes: LigneTransaction[]) => {
    const t = construireLigneDuTemps(lignes);
    return { t, rel: t.relationsVirements[0], v: vueFiscaleCeli(t) };
  };

  it('A · non-enregistré → CELI, contrepartie appariée : cotisation CELI ferme', () => {
    const { rel, v } = relCeli(paire(CELI, 10000, MARGE, 'VIRE DE 37FICTE'));
    expect(rel.effet).toBe('cotisation-celi');
    expect(rel.jambeContrepartieId).not.toBeNull();
    expect(rel.regimeSource).toBe('non-enregistre');
    expect(rel.regimeDestination).toBe('celi');
    expect(v.evenements.map((e) => e.role)).toEqual(['cotisation']);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(10000);
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
  });

  it('B · CELI → non-enregistré : retrait CELI ferme', () => {
    const { rel, v } = relCeli(paire(CELI, -10000, MARGE, 'TRANSFERE A 37FICTE'));
    expect(rel.effet).toBe('retrait-celi');
    expect(v.evenements.map((e) => e.role)).toEqual(['retrait-ferme']);
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(10000);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(0);
  });

  it('C/D · CELI → CELI apparié : transfert DIRECT — jamais retrait + cotisation', () => {
    const { rel, v } = relCeli(paire(CELI, -10000, CELI2, 'TRANSFERE A 37AUTRW'));
    expect(rel.effet).toBe('transfert-direct-celi');
    expect(v.evenements).toHaveLength(0);                    // aucun rôle fiscal
    expect(v.parAnnee['2026']).toBeUndefined();              // ni cotisation ni retrait, pas même un zéro
    expect(v.completude.retraitsNatureConfirmee).toBe(true); // compris : ne bloque pas
    expect(v.completude.evenementsCeliBloquants).toBe(0);
  });

  it('E/F · W → Q et Q → W : Q est un CELIAPP, ce n’est PAS un transfert entre CELI', () => {
    const sortie = relCeli(paire(CELI, -8000, CELIAPP, 'TRANSFERE A 37FICTQ'));
    expect(sortie.rel.effet).toBe('transfert-regime');
    expect(sortie.rel.regimeDestination).toBe('celiapp');
    expect(sortie.rel.motif).toMatch(/pas un transfert direct entre CELI/);
    const entree = relCeli(paire(CELI, 8000, CELIAPP, 'VIRE DE 37FICTQ'));
    expect(entree.rel.effet).toBe('transfert-regime');
    expect(entree.rel.regimeSource).toBe('celiapp');
    for (const { v } of [sortie, entree]) expect(v.parAnnee['2026']).toBeUndefined();
  });

  it('G · CELI → compte inconnu : ambigu, jamais un retrait ferme', () => {
    const { rel, v } = relCeli([tx({ type: 'Transfert', noCompte: CELI, total: -5000, note: 'TRANSFERE A 37ZZZZK' })]);
    expect(rel.effet).toBe('indetermine');
    expect(rel.confiance).toBe('ambigu');
    expect(v.evenements.map((e) => e.role)).toEqual(['retrait-a-confirmer']);
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
    expect(v.parAnnee['2026'].retraitsCadAConfirmer).toBe(5000);
  });

  it('H · compte inconnu → CELI : cotisation À CONFIRMER, jamais ferme', () => {
    const { rel, v } = relCeli([tx({ type: 'Cotisation', noCompte: CELI, total: 5000, note: 'VIRE DE 37ZZZZK' })]);
    expect(rel.effet).toBe('indetermine');
    expect(v.evenements.map((e) => e.role)).toEqual(['cotisation-a-confirmer']);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(0);
    expect(v.parAnnee['2026'].cotisationsCadAConfirmer).toBe(5000);
  });

  it('I · deux contreparties possibles : ambigu, aucune n’est choisie', () => {
    const { rel, v } = relCeli([
      tx({ type: 'Transfert', noCompte: CELI, total: -5000, note: 'TRANSFERE A 37FICTE' }),
      tx({ type: 'Transfert', noCompte: MARGE, total: 5000 }),
      tx({ type: 'Transfert', noCompte: '37-TIER-A', total: 5000 }),
    ]);
    expect(rel.effet).toBe('indetermine');
    expect(rel.jambeContrepartieId).toBeNull();
    expect(rel.motif).toMatch(/contreparties possibles/);
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
  });

  it('J · compte cité mais aucune jambe correspondante : la contrepartie n’est PAS inventée', () => {
    const { rel } = relCeli([tx({ type: 'Transfert', noCompte: CELI, total: -5000, note: 'TRANSFERE A 37AUTRW' })]);
    expect(rel.jambeContrepartieId).toBeNull();
    expect(rel.effet).toBe('indetermine');
    expect(rel.regimeCiteParLaNote).toBe('celi');            // la piste est conservée…
    expect(rel.motif).toMatch(/conjoint/);                   // …et la raison du doute est nommée
  });

  it('K · même montant et même date SANS compte cité : aucun rapprochement', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: CELI, total: -5000 }),
      tx({ type: 'Transfert', noCompte: MARGE, total: 5000 }),
    ]);
    expect(t.relationsVirements).toHaveLength(0);            // rien ne les désigne comme liés
    expect(t.virementsInternes).toHaveLength(0);
  });

  it('L · une jambe FX ne peut pas être réutilisée par un virement', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: '37-FICT-E', symbole: '1CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: -10000 }),
      tx({ type: 'Transfert', noCompte: CELI, total: -13252, note: 'TRANSFERE A 37FICTE' }),
    ]);
    const conv = t.parAnnee['2026'].nonEnregistre.conversionsDevise[0];
    const idsFx = new Set([conv.jambeCadId, conv.jambeUsdId]);
    for (const r of t.relationsVirements) {
      expect(idsFx.has(r.jambeCeliId)).toBe(false);
      if (r.jambeContrepartieId !== null) expect(idsFx.has(r.jambeContrepartieId)).toBe(false);
    }
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });

  it('M · une jambe de partie double ne peut pas être réutilisée non plus', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 10000, note: 'COTISATION' }),
      tx({ type: 'Cotisation', noCompte: CELI, symbole: 'FICTIF.TO', quantite: 100, total: -10000, note: 'COTISATION' }),
      tx({ type: 'Transfert', noCompte: MARGE, total: -10000, note: 'TRANSFERE A 37FICTW' }),
    ]);
    const consommes = new Set(t.consommesPartieDouble.map((e) => e.id));
    const agreges = new Set(Object.values(t.parAnnee['2026'].celi.cotisations).flatMap((ag) => ag.sources));
    for (const r of t.relationsVirements) {
      expect(consommes.has(r.jambeCeliId)).toBe(false);
      expect(agreges.has(r.jambeCeliId)).toBe(false);
    }
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });

  it('unicité globale — une jambe appartient à AU PLUS une relation', () => {
    const t = construireLigneDuTemps([
      ...paire(CELI, 10000, MARGE, 'VIRE DE 37FICTE'),
      ...paire(CELI, -3000, CELI2, 'TRANSFERE A 37AUTRW').map((l) => ({ ...l, date: '2026-04-02' })),
      tx({ type: 'Transfert', noCompte: CELI, total: -777, note: 'TRANSFERE A 37ZZZZK', date: '2026-05-05' }),
    ]);
    const vues = new Map<number, number>();
    for (const r of t.relationsVirements) {
      for (const id of [r.jambeCeliId, r.jambeContrepartieId]) {
        if (id === null) continue;
        expect(vues.has(id), `jambe #${id} dans deux relations`).toBe(false);
        vues.set(id, r.id);
      }
    }
    for (const [id, relId] of t.relationParJambe) expect(vues.get(id)).toBe(relId);
  });

  it('O · montant USD connu mais nature ambiguë : reste à confirmer', () => {
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', -5000);
    const v = vf([tx({ type: 'Transfert', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -5000, note: 'TRANSFERE A 37ZZZZK' })],
      [resolution(cle, 6800)]);
    expect(v.evenements[0].role).toBe('retrait-a-confirmer');
    expect(v.evenements[0].fiscal.montantCad).toBe(-6800);        // question A : répondue
    expect(v.evenements[0].fiscal.confiance).toBe('confirme');
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);      // question B : non
    expect(v.parAnnee['2026'].retraitsCadAConfirmer).toBe(6800);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
  });

  it('P · nature ferme mais montant USD inconnu : ne devient pas un montant CAD ferme', () => {
    const v = vf([
      tx({ type: 'Transfert', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -5000, note: 'TRANSFERE A 37FICTE' }),
      tx({ type: 'Transfert', noCompte: MARGE, symbole: '1USD', devise: 'USD', total: 5000, note: 'VIRE DE 37FICTW' }),
    ]);
    expect(v.evenements[0].role).toBe('retrait-ferme');           // nature : prouvée
    expect(v.evenements[0].fiscal.montantCad).toBeNull();         // montant : inconnu
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
    expect(v.completude.tousRetraitsEnCadFiscal).toBe(false);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);      // les deux questions, séparément
  });

  it('N · résolution manuelle : la nature dérivée change SANS toucher la ligne source', () => {
    const lignes = [tx({ type: 'Transfert', noCompte: CELI, symbole: '1USD', devise: 'USD', total: -5000, note: 'TRANSFERE A 37ZZZZK' })];
    const avant = JSON.stringify(lignes);
    const cle = cleEvenementFiscal(CELI, '2026-03-15', 'USD', -5000);
    const v = vueFiscaleCeli(construireLigneDuTemps(lignes), [resolution(cle, 6800)]);
    expect(v.resolutions.appliquees).toBe(1);
    expect(v.evenements[0].fiscal.source).toBe('resolution-manuelle');
    expect(JSON.stringify(lignes)).toBe(avant);
  });
});

// ═══ LE GRADIENT D'IMPACT (§13-§16) ══════════════════════════════════════════
describe('impact sur la complétude — ce qui bloque, c’est ce qui peut changer un chiffre', () => {
  it('Q · un INCONNU porteur d’un montant bloque, comme un ambigu', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 10, total: -9000 }),
    ]);
    expect(v.completude.evenementsCeliBloquants).toBe(1);
    expect(v.completude.impacts.retrait).toBe(1);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
  });

  it('R · un inconnu à montant NUL ne peut changer aucune somme : il ne bloque pas', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Journal', noCompte: CELI, symbole: 'XYZ', quantite: 5, total: 0 }),
    ]);
    expect(v.completude.evenementsCeliBloquants).toBe(0);
    expect(v.completude.retraitsNatureConfirmee).toBe(true);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
  });

  it('S · un ambigu HORS du CELI ne bloque pas le CELI', () => {
    const v = vf([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      tx({ type: 'Transfert', noCompte: '37-FICT-E', total: -4000 }),   // ambigu, mais dans la marge
    ]);
    expect(v.completude.evenementsCeliBloquants).toBe(0);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
  });

  it('LE DÉFAUT CORRIGÉ : l’incompris ne pèse plus MOINS que le mi-compris', () => {
    // Avant le 20 août : « Valeur comptable » (inconnu) laissait le verdict
    // intact, un « Frais » positif (ambigu) le faisait tomber. Les deux portent
    // un montant non nul dans un CELI : les deux bloquent, désormais.
    const inconnu = vf([tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 1, total: -9000 })]);
    const ambigu = vf([tx({ type: 'Frais', noCompte: CELI, total: 57.33 })]);
    expect(inconnu.completude.evenementsCeliBloquants).toBe(1);
    expect(ambigu.completude.evenementsCeliBloquants).toBe(1);
  });
});

// ═══ « VALEUR COMPTABLE » — la preuve d'INNOCUITÉ, pas la compréhension ══════
//
// docs/mesure-valeur-comptable-2026-08-20.md (244 occurrences, tous régimes).
// DEUX hypothèses réfutées par la mesure : aucune ligne n'est neutralisée par
// une contrepartie de même symbole (0/169 à J0, ±1, ±2), et aucune opération
// sur titre voisine n'explique un montant (0/169). Ce qui EST mesuré : 15 des
// 17 groupes (compte × jour) s'annulent entre eux.
describe('écritures « Valeur comptable » — équilibrées = inoffensives, sinon bloquantes', () => {
  const vc = (over: Partial<LigneTransaction> = {}) =>
    tx({ type: 'Valeur comptable', noCompte: CELI, symbole: 'XYZ', quantite: 100, total: 0, ...over });

  it('PATTERN HORS-FLUX · un groupe qui s’annule ne bloque plus rien', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      vc({ symbole: 'XYZ', quantite: 100, total: -12000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 12000 }),
    ]);
    expect(t.groupesEcritures).toHaveLength(1);
    expect(t.groupesEcritures[0].equilibre).toBe(true);
    expect(t.groupesEcritures[0].net).toBe(0);
    expect(t.ecrituresEquilibrees).toHaveLength(2);
    const v = vueFiscaleCeli(t);
    expect(v.completude.evenementsCeliBloquants).toBe(0);
    expect(v.completude.evenementsCeliNonExprimes).toBe(0);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(true);
    // et le montant de la cotisation n'a pas bougé d'un cent
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(7000);
  });

  it('NÉGATIF ADJACENT · le même groupe à un cent près NE s’annule pas — il bloque', () => {
    const t = construireLigneDuTemps([
      vc({ symbole: 'XYZ', quantite: 100, total: -12000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 11999 }),
    ]);
    expect(t.groupesEcritures[0].equilibre).toBe(false);
    expect(t.ecrituresEquilibrees).toHaveLength(0);
    expect(vueFiscaleCeli(t).completude.evenementsCeliBloquants).toBe(2);
  });

  it('LE CAS −9 000 · un groupe au net non nul reste inconnu ET bloquant', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      vc({ symbole: 'XYZ', quantite: 100, total: -30000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 21000 }),   // net : −9 000
    ]);
    expect(t.groupesEcritures[0].net).toBe(-9000);
    expect(t.groupesEcritures[0].equilibre).toBe(false);
    const v = vueFiscaleCeli(t);
    expect(v.completude.evenementsCeliBloquants).toBe(2);
    expect(v.completude.retraitsNatureConfirmee).toBe(false);
    expect(v.completude.toutesCotisationsEnCadFiscal).toBe(false);
    // jamais transformé en retrait ni en cotisation
    expect(v.parAnnee['2026'].retraitsCadConfirmes).toBe(0);
    expect(v.parAnnee['2026'].cotisationsCadConfirmees).toBe(7000);
  });

  it('ENCAISSE et TITRE comptent dans le MÊME groupe — c’est la valeur du compte qui est en jeu', () => {
    const t = construireLigneDuTemps([
      vc({ symbole: '1CAD', quantite: 0, total: 5000 }),
      vc({ symbole: 'XYZ', quantite: 50, total: -5000 }),
    ]);
    expect(t.groupesEcritures[0].equilibre).toBe(true);
    expect(t.ecrituresEquilibrees).toHaveLength(2);
  });

  it('CONTREPARTIE MANQUANTE · une écriture seule ne s’annule pas', () => {
    const t = construireLigneDuTemps([vc({ symbole: '1CAD', quantite: 0, total: -9000 })]);
    expect(t.groupesEcritures[0].equilibre).toBe(false);
    expect(t.evenements[0].impactCompletude).toBe('peut-affecter-retrait');
    expect(vueFiscaleCeli(t).completude.evenementsCeliBloquants).toBe(1);
  });

  it('PLUSIEURS CONTREPARTIES · le groupe s’équilibre globalement, pas deux à deux', () => {
    // La règle mesurée porte sur le NET du groupe : c'est ce que la mesure
    // observe (aucune annulation deux à deux n'existe dans la base).
    const t = construireLigneDuTemps([
      vc({ symbole: 'XYZ', quantite: 10, total: -3000 }),
      vc({ symbole: 'ABC', quantite: 20, total: -2000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 5000 }),
    ]);
    expect(t.groupesEcritures[0].equilibre).toBe(true);
    expect(t.ecrituresEquilibrees).toHaveLength(3);
  });

  it('LE JOUR COMPTE · deux écritures opposées de JOURS différents ne s’annulent pas', () => {
    const t = construireLigneDuTemps([
      vc({ symbole: 'XYZ', quantite: 10, total: -5000, date: '2026-03-15' }),
      vc({ symbole: '1CAD', quantite: 0, total: 5000, date: '2026-03-16' }),
    ]);
    expect(t.groupesEcritures).toHaveLength(2);
    for (const g of t.groupesEcritures) expect(g.equilibre).toBe(false);
    expect(vueFiscaleCeli(t).completude.evenementsCeliBloquants).toBe(2);
  });

  it('LE COMPTE COMPTE · deux écritures opposées sur des COMPTES différents ne s’annulent pas', () => {
    const t = construireLigneDuTemps([
      vc({ noCompte: CELI, symbole: 'XYZ', quantite: 10, total: -5000 }),
      vc({ noCompte: '37-FICT-E', symbole: '1CAD', quantite: 0, total: 5000 }),
    ]);
    expect(t.groupesEcritures).toHaveLength(2);
    for (const g of t.groupesEcritures) expect(g.equilibre).toBe(false);
  });

  it('L’HYPOTHÈSE RÉFUTÉE reste refusée : un « Remboursement » voisin n’explique RIEN', () => {
    // Le cahier suggérait « Valeur comptable −9 000 + Remboursement +9 000 →
    // opération sur titre ». La mesure a cherché ce motif : 0 sur 169. Aucune
    // règle ne l'implémente, et la ligne reste bloquante.
    const t = construireLigneDuTemps([
      vc({ symbole: 'XYZ', quantite: 10, total: -9000 }),
      tx({ type: 'Remboursement', noCompte: CELI, symbole: 'XYZ', quantite: 9000, total: 9000 }),
    ]);
    expect(t.groupesEcritures[0].equilibre).toBe(false);          // le Remboursement n'entre PAS dans le groupe
    expect(vueFiscaleCeli(t).completude.evenementsCeliBloquants).toBe(1);
  });

  it('LA NATURE NE MENT PAS : « inconnu » reste « inconnu », seul l’IMPACT tombe', () => {
    const t = construireLigneDuTemps([
      vc({ symbole: 'XYZ', quantite: 100, total: -12000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 12000 }),
    ]);
    for (const e of t.evenements) {
      expect(e.nature).toBe('inconnu');                            // on ignore toujours ce que ça VEUT DIRE
      expect(e.impactCompletude).toBe('aucun');                    // mais pas ce que ça PEUT CHANGER
      expect(e.motif).toMatch(/groupe ÉQUILIBRÉ/);
    }
    expect(t.diagnostics.dispositions['hors-flux']).toBe(2);
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });

  it('UNICITÉ · une ligne déjà consommée par le FX ou la règle 2 n’entre pas dans un groupe', () => {
    const t = construireLigneDuTemps([
      tx({ type: 'Transfert', noCompte: '37-FICT-E', symbole: '1CAD', total: 13252, note: 'CONV @ 1.3252' }),
      tx({ type: 'Transfert', noCompte: '37-FICT-F', symbole: '1USD', devise: 'USD', total: -10000 }),
      vc({ symbole: 'XYZ', quantite: 10, total: -5000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 5000 }),
    ]);
    const idsGroupes = new Set(t.groupesEcritures.flatMap((g) => g.ids));
    const conv = t.parAnnee['2026'].nonEnregistre.conversionsDevise[0];
    expect(idsGroupes.has(conv.jambeCadId)).toBe(false);
    expect(idsGroupes.has(conv.jambeUsdId)).toBe(false);
    expect(Object.values(t.diagnostics.dispositions).reduce((s, x) => s + x, 0)).toBe(t.diagnostics.lignesLues);
  });

  it('LE SIGNAL DE MAXIMISATION en profite aussi : un groupe équilibré ne le rétrograde plus', () => {
    const equilibre = vueCeliParAnnee(construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      vc({ symbole: 'XYZ', quantite: 10, total: -5000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 5000 }),
    ]));
    expect(equilibre.completude.evenementsAImpact).toBe(0);
    const desequilibre = vueCeliParAnnee(construireLigneDuTemps([
      tx({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      vc({ symbole: 'XYZ', quantite: 10, total: -5000 }),
      vc({ symbole: '1CAD', quantite: 0, total: 4000 }),
    ]));
    expect(desequilibre.completude.evenementsAImpact).toBe(2);
  });
});
