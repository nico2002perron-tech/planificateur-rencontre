// LA CRISTALLISATION DE PERTES — chaque condition d'une recommandation ferme.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI REND CETTE STRATÉGIE PLUS DÉLICATE QUE SA JUMELLE.
//
// La cristallisation de GAINS propose de réaliser un gain à impôt nul : au
// pire, le client vend et rachète pour rien. Celle-ci propose de VENDRE À
// PERTE — c'est-à-dire exactement l'acte que vise la règle de la perte
// apparente. Une recommandation fausse ne coûte pas une transaction inutile :
// elle coûte une déduction refusée par l'ARC.
//
// C'est pourquoi devise, prix de base, valeur marchande, perte apparente, biens
// identiques et portée sont ici MATÉRIELS, et pas des raffinements.
//
// L'audit du 21 août 2026 avait mesuré, sur des dossiers fictifs passés au
// moteur, ce que leur absence produisait : « calculé, 10 000 $ » sur une perte
// américaine ; « calculé, 16 000 $ » sur une perte apparente manifeste ; une
// position sans valeur marchande disparue sans trace ; et `calcule` sortant
// avec des données manquantes non vides.
//
// Données entièrement fictives : comptes « FICT », symboles inventés.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { profilVierge, type ProfilClient, type Compte, type Position } from '../types';
import { analyser } from '../strategies';
import { racheteDansLaFenetre } from '../completude-cristallisation';
import { verifierCompletudeCristallisationPertes } from '../completude-cristallisation-pertes';
import { deriverTransactionsAnnee } from '../deriver';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

const DATE = '2026-08-21';
const ANNEE = 2026;

function pos(s: string, vm: number | null, pbr: number | null, devise = 'CAD'): Position {
  return { symbole: s, devise, categorie: null, valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null };
}

function cpt(positions: Position[], numero = 'FICT-1', dateReleve: string | null = '2026-08-19'): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre', type: 'non-enregistre',
    titulaire: 'client', candidats: [numero], dateReleve, presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, encaisse: [], positions,
  };
}

/**
 * UN DOSSIER OÙ RIEN D'AUTRE NE BLOQUE : 20 000 $ de gain net réalisé cette
 * année, une position en perte latente de 10 000 $. Chaque test n'introduit
 * QU'UNE imperfection, pour que le blocage observé ne puisse venir que d'elle.
 */
function dossier(m: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif01', DATE);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '100-150k';
  p.revenus.dateDonnee = DATE;
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.transactionsAnnee.portee = 'complete';
  p.transactionsAnnee.gainsRealises = 20000;
  p.transactionsAnnee.gainsRealisesNonEnregistres = 20000;
  p.comptes = [cpt([pos('PERDANT', 4000, 14000)])];
  m(p);
  return p;
}

const pertes = (p: ProfilClient) =>
  analyser(p, null, DATE).constats.find((c) => c.strategie === 'cristallisation-pertes')!;
const plat = (t: string) => t.replace(/[\s   ]+/g, ' ');

function tx(p: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: `${ANNEE}-03-15`, dateReglement: `${ANNEE}-03-17`, nom: 'Fictif, Test', note: '',
    symbole: 'XYZ', quantite: null, prix: null, devise: 'CAD', total: null,
    gainsPertes: null, description: '', categorie: '', typeBrut: p.type, ...p,
  } as LigneTransaction;
}

// ═══════════════════════════════════════════════════════════════════════════
// A / P — LE CAS PROPRE
// ═══════════════════════════════════════════════════════════════════════════

describe('A · dossier fiable avec un gain courant à absorber', () => {
  it('sort `calcule`, sans donnée manquante, avec un plan nominatif', () => {
    const c = pertes(dossier());
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(10000);        // plafonné par la perte latente
    expect(c.donneesManquantes).toEqual([]);
    expect(c.plan?.some((l) => l.symbole === 'PERDANT')).toBe(true);
  });

  it('P · l’invariant : `calcule` n’admet AUCUNE donnée manquante', () => {
    // C'est le défaut de l'audit : le moteur chiffrait fermement tout en
    // déclarant qu'il lui manquait de quoi chiffrer.
    const c = pertes(dossier());
    expect(c.statut).toBe('calcule');
    expect(c.donneesManquantes.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B — LA DEVISE
// ═══════════════════════════════════════════════════════════════════════════

describe('B · une perte en dollars américains', () => {
  it('ne devient JAMAIS un montant canadien', () => {
    // AVANT : « calculé, 10 000 $ » sur 10 000 USD de perte.
    const c = pertes(dossier((p) => { p.comptes = [cpt([pos('USPERDANT', 4000, 14000, 'USD')])]; }));
    expect(c.statut).not.toBe('calcule');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/dollars canadiens/);
    expect(plat(c.explication)).not.toMatch(/10 000/);
  });

  it('mais une position réellement en dollars canadiens n’est pas bloquée', () => {
    // Sans ce pendant, un garde qui refuserait TOUT passerait le test ci-dessus.
    expect(pertes(dossier()).statut).toBe('calcule');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C / D / E / Q — PBR, VALEUR MARCHANDE, POSITIONS AVEUGLES
// ═══════════════════════════════════════════════════════════════════════════

describe('C · prix de base absent', () => {
  it('n’est jamais lu comme un prix de base de zéro, et empêche le chiffre', () => {
    const c = pertes(dossier((p) => { p.comptes = [cpt([pos('AVEUGLE', 4000, null)])]; }));
    expect(c.statut).not.toBe('calcule');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/prix de base rajusté/);
  });
});

describe('D · valeur marchande absente', () => {
  it('ne DISPARAÎT plus en silence — elle se compte et se dit', () => {
    // AVANT : `sansPbr` ne comptait que les prix de base ; une position sans
    // valeur marchande était écartée du calcul et n'apparaissait NULLE PART.
    const p = dossier((x) => {
      x.comptes = [cpt([pos('PERDANT', 4000, 14000), pos('SANSVM', null, 50000)])];
    });
    const completude = verifierCompletudeCristallisationPertes(p);
    expect(completude.sansValeurMarchande).toBe(1);

    const c = pertes(p);
    expect(c.statut).not.toBe('calcule');
    expect(c.donneesManquantes.join(' ')).toMatch(/valeur marchande/);
  });
});

describe('E · une position lisible ET une position aveugle', () => {
  it('ne permet plus `calcule` parce qu’une PARTIE du portefeuille se calcule', () => {
    // AVANT : « calculé, 10 000 $ » avec `donneesManquantes` non vide. Une
    // seule position incomplète peut changer la quantité récoltable.
    const c = pertes(dossier((p) => {
      p.comptes = [cpt([pos('PERDANT', 4000, 14000), pos('AVEUGLE', 90000, null)])];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.length).toBeGreaterThan(0);
  });
});

describe('Q · les positions aveugles ne sont jamais proposées à la vente', () => {
  const aveugles: Array<[string, Position]> = [
    ['sans prix de base', pos('SANSPBR', 4000, null)],
    ['sans valeur marchande', pos('SANSVM', null, 50000)],
    ['en devise non résolue', pos('USTITRE', 4000, 14000, 'USD')],
  ];
  for (const [quoi, aveugle] of aveugles) {
    it(`${quoi} : absente du plan ET des candidats`, () => {
      const c = pertes(dossier((p) => {
        p.comptes = [cpt([pos('PERDANT', 4000, 14000), aveugle])];
      }));
      expect(JSON.stringify(c.plan ?? []), quoi).not.toMatch(aveugle.symbole);
      expect(JSON.stringify(c.candidats ?? []), quoi).not.toMatch(aveugle.symbole);
      // La position lisible, elle, est bien nommée — sinon « rien n'est jamais
      // nommé » passerait ce test.
      expect(JSON.stringify(c.candidats ?? []), quoi).toMatch('PERDANT');
    });
  }
});

describe('R · aucun plan ferme sous statut dégradé', () => {
  it('le plan n’existe que sur un constat calculé', () => {
    for (const modif of [
      (p: ProfilClient) => { p.consolidation.comptesExternes = 'oui'; },
      (p: ProfilClient) => { p.comptes = [cpt([pos('USPERDANT', 4000, 14000, 'USD')])]; },
      (p: ProfilClient) => { p.transactionsAnnee.pertesCourantesAValiderPerteApparente = true; },
    ]) {
      const c = pertes(dossier(modif));
      expect(c.statut).not.toBe('calcule');
      expect(c.plan ?? []).toEqual([]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// F / G — LES PERTES REPORTÉES
// ═══════════════════════════════════════════════════════════════════════════

describe('F · une perte reportée d’unité inconnue', () => {
  it('n’est JAMAIS présentée comme s’ajoutant aux pertes', () => {
    // AVANT, et sous statut `calcule` — donc hors de portée du filtre du
    // document : « À cela s’ajoutent 5 000 $ de pertes en capital déjà
    // reportées d’années passées. »
    const c = pertes(dossier((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE };
    }));
    expect(plat(c.explication)).not.toMatch(/À cela s’ajoutent/);
    expect(plat(c.explication)).not.toMatch(/5 000/);
    expect(plat(c.explication)).toMatch(/unité reste à qualifier/);
  });

  it('une perte NETTE de l’avis n’est pas davantage additionnée', () => {
    const c = pertes(dossier((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE };
    }));
    expect(plat(c.explication)).not.toMatch(/À cela s’ajoutent/);
    expect(plat(c.explication)).toMatch(/unité reste à qualifier/);
  });
});

describe('G · une perte reportée d’unité compatible', () => {
  it('se mentionne comme capacité, avec son montant', () => {
    for (const unite of ['perte-capital-brute', 'montant-normalise-utilisable'] as const) {
      const c = pertes(dossier((p) => {
        p.droits.pertesCapitalReportees = { montant: 5000, unite, source: 'avis-cotisation', dateDonnee: DATE };
      }));
      expect(c.statut, unite).toBe('calcule');
      expect(plat(c.explication), unite).toMatch(/À cela s’ajoutent 5 000 \$/);
      // ⚠ ET ELLE NE CHANGE PAS LE MONTANT : la perte à cristalliser dépend
      // des gains de l'année, pas des reports.
      expect(c.montantEstime, unite).toBe(10000);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// H / I / J / K — LA PERTE APPARENTE
// ═══════════════════════════════════════════════════════════════════════════

describe('H · le même titre dans deux comptes non enregistrés', () => {
  it('empêche la recommandation ferme — c’est le cas d’école de la perte apparente', () => {
    // AVANT : « calculé, 16 000 $ ». Vendre à perte dans un compte pendant que
    // le même titre reste détenu dans l'autre place l'opération dans le champ
    // de la règle : la perte serait refusée et ajoutée au prix de base du bien
    // conservé.
    const c = pertes(dossier((p) => {
      p.comptes = [
        cpt([pos('XYZ', 4000, 14000)], 'FICT-A'),
        cpt([pos('XYZ', 3000, 9000)], 'FICT-E'),
      ];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/perte apparente/);
    expect(plat(c.explication)).toMatch(/refusée et ajoutée au prix de base/);
  });

  it('NÉGATIF — deux titres DIFFÉRENTS dans deux comptes ne lèvent rien', () => {
    const c = pertes(dossier((p) => {
      p.comptes = [
        cpt([pos('XYZ', 4000, 14000)], 'FICT-A'),
        cpt([pos('ABC', 3000, 9000)], 'FICT-E'),
      ];
    }));
    expect(c.statut).toBe('calcule');
  });
});

describe('I · un rachat visible dans la fenêtre', () => {
  const vente = tx({ type: 'Vente', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-03-15`, gainsPertes: -4000 });

  it('déclenche le garde, bout à bout depuis le livre', () => {
    const rachat = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-04-02` });
    expect(racheteDansLaFenetre([vente, rachat], ANNEE)).toBe(true);

    const t = deriverTransactionsAnnee([vente, rachat], ANNEE);
    expect(t.pertesCourantesAValiderPerteApparente).toBe(true);

    const c = pertes(dossier((p) => {
      p.transactionsAnnee.pertesCourantesAValiderPerteApparente = true;
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/perte apparente/);
  });

  it('J · NÉGATIF — la même acquisition HORS fenêtre ne déclenche pas ce garde', () => {
    const tardif = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-05-20` });
    expect(racheteDansLaFenetre([vente, tardif], ANNEE)).toBe(false);
    expect(deriverTransactionsAnnee([vente, tardif], ANNEE).pertesCourantesAValiderPerteApparente).toBe(false);
  });
});

describe('K · ce que le moteur ne voit pas reste une question de portée', () => {
  it('un portefeuille externe non exclu empêche toute conclusion ferme', () => {
    // Le conjoint, une société contrôlée, un compte détenu ailleurs : la règle
    // de la perte apparente les vise, et nous ne les voyons pas. L'absence de
    // rachat visible n'est PAS une preuve d'absence.
    for (const reponse of ['oui', 'inconnu'] as const) {
      const c = pertes(dossier((p) => { p.consolidation.comptesExternes = reponse; }));
      expect(c.statut, reponse).toBe('montant-a-confirmer');
      expect(c.donneesManquantes.join(' ')).toMatch(/ailleurs/);
      expect(plat(c.explication)).toMatch(/personne affiliée/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L — UNE INCONNUE ÉTRANGÈRE NE BLOQUE PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('L · une ambiguïté CELI indépendante', () => {
  it('laisse le constat EXACTEMENT identique', () => {
    const sans = pertes(dossier());
    const avec = pertes(dossier((p) => {
      p.comptes = [
        ...p.comptes,
        { ...cpt([pos('ABRITE', 90000, null)], 'FICT-W'), type: 'celi' },
      ];
      p.historiqueVie.celi = { ...p.historiqueVie.celi, portee: 'inconnue' };
      p.cotisationsAnnee.celi = 7000;
      p.cotisationsAnnee.portee = 'inconnue';
    }));
    expect(avec.statut).toBe('calcule');
    expect(avec.statut).toBe(sans.statut);
    expect(avec.montantEstime).toBe(sans.montantEstime);
    expect(avec.donneesManquantes).toEqual(sans.donneesManquantes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M / N — « DÉJÀ EN ORDRE » NE COUVRE QU'UN SEUL CAS
// ═══════════════════════════════════════════════════════════════════════════

describe('M · aucune perte latente', () => {
  it('là, « rien à cristalliser » est vrai — et le dossier est en ordre', () => {
    const c = pertes(dossier((p) => { p.comptes = [cpt([pos('GAGNANT', 20000, 8000)])]; }));
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(true);
    expect(c.montantEstime).toBeNull();
  });
});

describe('N · des pertes latentes, mais aucun gain de l’année', () => {
  it('n’est PAS « déjà en ordre » — la perte se reporte', () => {
    // AVANT : `dejaEnOrdre` dès qu'`absorbable` tombait à zéro. Le dossier
    // partait dans la section « Déjà en ordre » du document, alors qu'une perte
    // nette en capital se reporte trois ans en arrière puis indéfiniment vers
    // l'avant. Conclure exigerait l'historique des trois années, absent d'ici.
    const c = pertes(dossier((p) => {
      p.transactionsAnnee.gainsRealises = 0;
      p.transactionsAnnee.gainsRealisesNonEnregistres = 0;
    }));
    expect(c.dejaEnOrdre).toBe(false);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/trois années précédentes/);
    expect(plat(c.explication)).toMatch(/trois années précédentes et, au-delà, indéfiniment/);
    // Les titres restent nommés : le planificateur voit quoi regarder.
    expect(c.candidats?.some((l) => l.symbole === 'PERDANT')).toBe(true);
  });

  it('AUCUN MONTANT n’est avancé pour autant', () => {
    const c = pertes(dossier((p) => {
      p.transactionsAnnee.gainsRealises = 0;
      p.transactionsAnnee.gainsRealisesNonEnregistres = 0;
    }));
    expect(plat(c.explication)).not.toMatch(/10 000/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// O — LA DATE
// ═══════════════════════════════════════════════════════════════════════════

describe('O · la date du relevé', () => {
  it('est propagée sur tous les chemins — le document ne parse aucune phrase', () => {
    const chemins: Array<[string, (p: ProfilClient) => void]> = [
      ['calculé', () => {}],
      ['dégradé', (p) => { p.consolidation.comptesExternes = 'oui'; }],
      ['pertes sans gain', (p) => {
        p.transactionsAnnee.gainsRealises = 0; p.transactionsAnnee.gainsRealisesNonEnregistres = 0; }],
      ['aucune perte latente', (p) => { p.comptes = [cpt([pos('GAGNANT', 20000, 8000)])]; }],
    ];
    for (const [quoi, modif] of chemins) {
      expect(pertes(dossier(modif)).dateDonnees, quoi).toBe('2026-08-19');
    }
  });

  it('AUCUN seuil de fraîcheur : une date ancienne ne bloque pas', () => {
    const c = pertes(dossier((p) => {
      p.comptes = [cpt([pos('PERDANT', 4000, 14000)], 'FICT-1', '2019-01-31')];
    }));
    expect(c.statut).toBe('calcule');
    expect(c.dateDonnees).toBe('2019-01-31');
  });
});
