// LES 5 STRATÉGIES FISCALES.
//
// Ces tests ne vérifient pas qu'on trouve toujours un chiffre — ils vérifient
// qu'on n'en invente JAMAIS. Un `indisponible` correctement motivé est un
// succès ; un montant présenté comme certain alors qu'une donnée manque est
// l'échec que ce module existe pour empêcher.
//
// Profils fictifs, formats réels : les tests partent sur GitHub.

import { describe, it, expect } from 'vitest';
import { analyser, restreindre, classerManques, etatDetection, type PortefeuilleCible } from '../strategies';
import { gestesDe } from '../demarches';
import { profilVierge, type ProfilClient, type Compte, type Position } from '../types';

const DATE = '2026-08-05';

function position(symbole: string, vm: number | null, pbr: number | null): Position {
  return {
    symbole, devise: 'CAD', categorie: null,
    valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
  };
}

function compte(type: Compte['type'], positions: Position[]): Compte {
  return {
    numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', candidats: ['37-FICT-A'],
    type, titulaire: 'client', dateReleve: DATE, positions, encaisse: [],
  };
}

/** Un profil consolidé : le client a confirmé n'avoir aucun compte ailleurs. */
function profilConsolide(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif-1', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.dateConfirmation = DATE;
  p.demographie.etatCivil = 'marie';
  modif(p);
  return p;
}

const trouver = (r: ReturnType<typeof analyser>, s: string) =>
  r.constats.find((c) => c.strategie === s)!;

/**
 * Aplatit les espaces avant de comparer du texte.
 *
 * `toLocaleString('fr-CA')` sépare les milliers par U+202F, une espace fine
 * insécable invisible à l'œil. Comparer « 12 000 $ » tapé au clavier avec
 * « 12 000 $ » produit par le formateur échoue sans que rien ne se voie —
 * le piège a déjà coûté une session ici.
 */
const plat = (s: string) => s.replace(/[\s   ]+/g, ' ');

describe('le contrat', () => {
  it('rend TOUT le catalogue, toujours, même sur un profil vide', () => {
    const r = analyser(profilVierge('vide', DATE), null, DATE);
    expect(r.constats).toHaveLength(8);
    expect(r.constats.map((c) => c.strategie).sort()).toEqual([
      'celi-conjoint', 'cristallisation-gains', 'cristallisation-pertes', 'don-titres',
      'droits-cotisation', 'localisation-actifs', 'ordre-vente', 'subvention-reee',
    ]);
  });

  it('AUCUN MONTANT hors du statut « calcule »', () => {
    // La garde centrale du module. Si elle saute, un chiffre incertain peut
    // atteindre le PDF, et le PDF atteint le client.
    for (const profil of [profilVierge('vide', DATE), profilConsolide()]) {
      for (const c of analyser(profil, null, DATE).constats) {
        if (c.statut !== 'calcule') expect(c.montantEstime).toBeNull();
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // LA GARDE TRANSVERSALE DE VISIBILITÉ — balayage de TOUT le catalogue.
  //
  // L'inspection du 13 août 2026 a trouvé cinq violations de la même règle dans
  // cinq stratégies différentes : chacune avait été écrite (et testée) sur des
  // profils consolidés, où la règle ne se voit pas. Un test par stratégie
  // n'attrape pas une famille — celui-ci balaie le catalogue entier, et couvre
  // donc aussi les stratégies qui n'existent pas encore.
  // ───────────────────────────────────────────────────────────────────────────
  describe('VISIBILITÉ ENTAMÉE — la règle transversale, sur tout le catalogue', () => {
    /** Un profil aussi renseigné que possible : chaque stratégie a de quoi chiffrer. */
    const profilRiche = (externes: 'oui' | 'inconnu' | 'non') => {
      const p = profilVierge('riche', DATE);
      p.consolidation.comptesExternes = externes;
      p.consolidation.historiqueExterne = 'jamais';
      p.consolidation.dateConfirmation = DATE;
      p.demographie.etatCivil = 'marie';
      p.demographie.conjoint = { age: 45, trancheRevenu: '50-100k' };
      p.demographie.enfants = [{ prenom: 'Laurie', age: 8 }];
      p.revenus = { trancheRevenu: '100-150k', source: 'declare', dateDonnee: DATE };
      p.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
      p.droits.pertesCapitalReportees = { montant: 20000, dateDonnee: DATE };
      p.intentions.donsAnnuelsMoyens = 5000;
      p.transactionsAnnee = {
        gainsRealises: 12000, pertesRealisees: 0, retraitsReer: 0, retraitsCeli: 0, portee: 'complete',
      };
      p.comptes = [compte('non-enregistre', [
        position('GAGNANT', 50000, 20000),
        position('PERDANT', 8000, 20000),
      ])];
      return p;
    };
    const signauxComplets = {
      droitsCeli: {
        statut: 'calcule' as const, portee: 'complete' as const, montant: 21500,
        borne: 21500, conditionsManquantes: [], transfertsATrancher: 0,
      },
      maximisation: null,
    };

    for (const externes of ['oui', 'inconnu'] as const) {
      it(`comptesExternes = « ${externes} » : AUCUN montant ferme, AUCUN « déjà en ordre »`, () => {
        const r = analyser(profilRiche(externes), null, DATE, { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 }, signauxComplets);
        for (const c of r.constats) {
          expect(
            c.statut === 'calcule' ? `${c.strategie} sort « calcule »` : 'ok'
          ).toBe('ok');
          expect(
            c.dejaEnOrdre ? `${c.strategie} sort « déjà en ordre »` : 'ok'
          ).toBe('ok');
          expect(
            c.montantEstime !== null ? `${c.strategie} affirme un montant` : 'ok'
          ).toBe('ok');
        }
      });

      it(`comptesExternes = « ${externes} » : tout constat non chiffré porte SA réserve ou SA question`, () => {
        // Sans l'un des deux, le constat échappe à l'angle mort du document :
        // la limite existerait sans être écrite nulle part.
        const r = analyser(profilRiche(externes), null, DATE, { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 }, signauxComplets);
        for (const c of r.constats) {
          if (c.statut === 'non-applicable' && c.donneesManquantes.length === 0 && c.limiteVisibilite === null) {
            // Seul cas légitime : la stratégie ne dépend pas de ce qu'on voit.
            expect(`${c.strategie} : ni réserve ni question`).toBe('ok');
          }
        }
      });
    }

    it('la même situation, comptesExternes = « non » : les montants reviennent', () => {
      const r = analyser(profilRiche('non'), null, DATE, { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 }, signauxComplets);
      const chiffrees = r.constats.filter((c) => c.statut === 'calcule');
      // La garde ne doit pas être un mur : sans compte ailleurs, ça calcule.
      expect(chiffrees.length).toBeGreaterThanOrEqual(4);
      for (const c of chiffrees) expect(c.montantEstime).not.toBeNull();
    });
  });

  it('LA DATE ENTRE PAR L’APPELANT, jamais par une horloge cachée', () => {
    expect(analyser(profilVierge('v', DATE), null, '1999-01-01').date).toBe('1999-01-01');
  });

  it('le verrou du fiscaliste est posé', () => {
    expect(analyser(profilVierge('v', DATE), null, DATE).revisionFiscalisteRequise).toBe(true);
  });

  it('les questions sont dédupliquées et ordonnées par impact', () => {
    const r = analyser(profilVierge('vide', DATE), null, DATE);
    expect(new Set(r.questionsRencontre).size).toBe(r.questionsRencontre.length);
    const iAilleurs = r.questionsRencontre.findIndex((q) => q.includes('ailleurs'));
    const iAutre = r.questionsRencontre.findIndex((q) => q.includes('prix de base'));
    if (iAilleurs >= 0 && iAutre >= 0) expect(iAilleurs).toBeLessThan(iAutre);
  });
});

describe('stratégie 1 — cristallisation de pertes', () => {
  it('calcule ce qui absorbe un gain déjà réalisé', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];  // −12 000
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(12000);
  });

  it('PLAFONNE au gain réalisé : une perte au-delà se REPORTE, elle n’économise pas cette année', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 3000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 50000)])];  // −42 000
    });
    expect(trouver(analyser(p, null, DATE), 'cristallisation-pertes').montantEstime).toBe(3000);
  });

  it('UN COMPTE DE RÉGIME INCONNU EST ÉCARTÉ, jamais présumé non enregistré', () => {
    // Vendre à perte dans un CELI détruirait un droit de cotisation sans
    // produire la moindre déduction.
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte(null, [position('AAA', 8000, 20000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
  });

  it('SANS PBR : indisponible, et le motif le dit', () => {
    const p = profilConsolide((x) => {
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, null)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes.join(' ')).toMatch(/prix de base/);
  });

  it('VISIBILITÉ ENTAMÉE : le chiffre est dit, mais dégradé en « à confirmer »', () => {
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(plat(c.explication)).toMatch(/12 000/);  // le chiffre vu reste dit
    expect(c.portee).toBe('interne-seulement');
  });
});

describe('stratégie 2 — localisation d’actifs', () => {
  it('reste INDISPONIBLE : aucune colonne du relevé ne porte la nature du revenu', () => {
    const p = profilConsolide((x) => {
      x.revenus.trancheRevenu = '150-200k';
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 5000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'localisation-actifs');
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes.join(' ')).toMatch(/registre d’instruments/);
  });
});

describe('stratégie 3 — CELI du conjoint', () => {
  it('NON APPLICABLE quand le client n’a pas de conjoint', () => {
    const p = profilConsolide((x) => { x.demographie.etatCivil = 'celibataire'; });
    expect(trouver(analyser(p, null, DATE), 'celi-conjoint').statut).toBe('non-applicable');
  });

  it('INDISPONIBLE sans avis de cotisation du conjoint, avec la question qui va avec', () => {
    const c = trouver(analyser(profilConsolide(), null, DATE), 'celi-conjoint');
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes.join(' ')).toMatch(/avis de cotisation/);
  });

  it('calcule quand les deux données du conjoint sont là', () => {
    const p = profilConsolide((x) => {
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
    });
    const c = trouver(analyser(p, null, DATE), 'celi-conjoint');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(48000);
  });

  it('MAIS JAMAIS un montant à cotiser si des comptes existent ailleurs', () => {
    // Règle transversale : une cotisation excédentaire coûte 1 % par mois.
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
    });
    const c = trouver(analyser(p, null, DATE), 'celi-conjoint');
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
  });
});

describe('stratégie 4 — don de titres', () => {
  it('NE SUGGÈRE JAMAIS DE DONNER POUR DONNER', () => {
    const p = profilConsolide((x) => {
      x.intentions.donsAnnuelsMoyens = 0;
      x.comptes = [compte('non-enregistre', [position('AAA', 50000, 10000)])];
    });
    expect(trouver(analyser(p, null, DATE), 'don-titres').statut).toBe('non-applicable');
  });

  it('choisit le plus gros gain latent et chiffre le gain mis à l’abri', () => {
    const p = profilConsolide((x) => {
      x.intentions.donsAnnuelsMoyens = 5000;
      x.comptes = [compte('non-enregistre', [
        position('PETIT', 12000, 10000),      // +2 000
        position('GROS', 50000, 10000),       // +40 000
      ])];
    });
    const c = trouver(analyser(p, null, DATE), 'don-titres');
    expect(c.statut).toBe('calcule');
    expect(c.explication).toMatch(/GROS/);
    // Don de 5 000 sur une position de 50 000 qui porte 40 000 de gain :
    // la portion donnée emporte 10 % du gain.
    expect(c.montantEstime).toBeCloseTo(4000, 2);
  });

  it('ne peut pas choisir sans PBR', () => {
    const p = profilConsolide((x) => {
      x.intentions.donsAnnuelsMoyens = 5000;
      x.comptes = [compte('non-enregistre', [position('AAA', 50000, null)])];
    });
    expect(trouver(analyser(p, null, DATE), 'don-titres').statut).toBe('indisponible');
  });
});

describe('stratégie 5 — ordre de vente', () => {
  const cible: PortefeuilleCible = { positions: [{ symbole: 'XBB', poidsCible: 1 }] };

  it('NON APPLICABLE sans portefeuille cible — il n’y a rien à ordonner', () => {
    const c = trouver(analyser(profilConsolide(), null, DATE), 'ordre-vente');
    expect(c.statut).toBe('non-applicable');
  });

  it('INDISPONIBLE avec une cible mais sans PBR', () => {
    const p = profilConsolide((x) => {
      x.comptes = [compte('non-enregistre', [position('AAA', 50000, null)])];
    });
    expect(trouver(analyser(p, cible, DATE), 'ordre-vente').statut).toBe('indisponible');
  });

  it('ordonne en commençant par la perte, et chiffre le gain net de l’année', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 1000;
      x.comptes = [compte('non-enregistre', [
        position('GAIN', 20000, 5000),        // +15 000
        position('PERTE', 3000, 9000),        // −6 000
      ])];
    });
    const c = trouver(analyser(p, cible, DATE), 'ordre-vente');
    expect(c.statut).toBe('calcule');
    expect(c.explication).toMatch(/PERTE/);           // la perte d'abord
    expect(c.montantEstime).toBe(10000);              // 15 000 − 6 000 + 1 000
  });
});

describe('l’angle mort', () => {
  it('N’EXISTE PAS quand le client a confirmé n’avoir aucun compte ailleurs', () => {
    expect(analyser(profilConsolide(), null, DATE).angleMort).toBeNull();
  });

  it('compte les constats limités et porte le suivi CELI', () => {
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
      x.historiqueVie.celi.cotisationsTotales = 4000;
      x.historiqueVie.celi.dateOuverture = '2015-03-12';
    });
    const a = analyser(p, null, DATE).angleMort!;
    expect(a).not.toBeNull();
    expect(a.total).toBe(8);
    expect(a.constatsLimites).toBeGreaterThan(0);
    expect(plat(a.details.join(' '))).toMatch(/4 000 \$ vus ici depuis 2015-03-12/);
    expect(plat(a.details.join(' '))).toMatch(/plafond non vérifiable/);
  });

  it('APPARAÎT AUSSI quand la réponse est « inconnu » — le doute compte comme un angle mort', () => {
    // profilVierge pose comptesExternes = 'inconnu'.
    expect(analyser(profilVierge('vide', DATE), null, DATE).angleMort).not.toBeNull();
  });
});

describe('la limite de visibilité — la matière de l’angle mort', () => {
  it('est une PHRASE COURTE, pas l’explication recopiée', () => {
    // Première version : l'angle mort recopiait l'explication entière de chaque
    // constat, ce qui donnait un bloc de six lignes qui répétait la page.
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    });
    const r = analyser(p, null, DATE);
    const c = trouver(r, 'cristallisation-pertes');
    expect(c.limiteVisibilite).not.toBeNull();
    expect((c.limiteVisibilite as string).length).toBeLessThan(c.explication.length);
    expect(r.angleMort!.details.some((d) => d === `${c.titreClient} : ${c.limiteVisibilite}`)).toBe(true);
  });

  it('reste NULL quand la visibilité est complète', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    });
    for (const c of analyser(p, null, DATE).constats) expect(c.limiteVisibilite).toBeNull();
  });
});

describe('la nature des montants', () => {
  it('chaque constat DIT ce que son montant est', () => {
    for (const c of analyser(profilVierge('v', DATE), null, DATE).constats) {
      expect(c.libelleMontant.length).toBeGreaterThan(5);
    }
  });

  it('les droits CELI du conjoint sont un CUMUL, donc « unique »', () => {
    const p = profilConsolide((x) => {
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
    });
    expect(trouver(analyser(p, null, DATE), 'celi-conjoint').recurrence).toBe('unique');
  });
});

describe('restreindre — le planificateur choisit, le moteur détecte', () => {
  const complet = () => analyser(profilConsolide((x) => {
    x.consolidation.comptesExternes = 'oui';
    x.transactionsAnnee.gainsRealises = 12000;
    x.intentions.donsAnnuelsMoyens = 5000;
    x.historiqueVie.celi.cotisationsTotales = 4000;
    x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000), position('BBB', 50000, 10000)])];
  }), null, DATE);

  it('RIEN DE COCHÉ rend une analyse VIDE — c’est voulu, pas dégénéré', () => {
    const r = restreindre(complet(), []);
    expect(r.constats).toEqual([]);
    expect(r.angleMort).toBeNull();
    expect(r.questionsRencontre).toEqual([]);
  });

  it('ne retient que les stratégies cochées', () => {
    const r = restreindre(complet(), ['cristallisation-pertes']);
    expect(r.constats.map((c) => c.strategie)).toEqual(['cristallisation-pertes']);
  });

  it('L’ANGLE MORT NE NOMME JAMAIS une stratégie absente de la page', () => {
    const r = restreindre(complet(), ['cristallisation-pertes']);
    expect(r.angleMort!.details.some((d) => d.startsWith('Utiliser le CELI'))).toBe(false);
    expect(r.angleMort!.details.some((d) => d.startsWith('Réduire l’impôt'))).toBe(true);
    expect(r.angleMort!.total).toBe(1);
  });

  it('garde la ligne du suivi CELI : elle décrit le dossier, pas une stratégie', () => {
    const r = restreindre(complet(), ['cristallisation-pertes']);
    expect(r.angleMort!.details.some((d) => d.startsWith('Suivi de cotisation CELI'))).toBe(true);
  });

  it('les questions ne portent que sur les pistes retenues', () => {
    const r = restreindre(complet(), ['localisation-actifs']);
    expect(r.questionsRencontre.join(' ')).toMatch(/registre d’instruments/);
    expect(r.questionsRencontre.join(' ')).not.toMatch(/portefeuille cible/);
  });

  it('le verrou du fiscaliste et la date survivent à la restriction', () => {
    const r = restreindre(complet(), ['cristallisation-pertes']);
    expect(r.revisionFiscalisteRequise).toBe(true);
    expect(r.date).toBe(DATE);
  });
});

describe('le vocabulaire du document', () => {
  it('UN SEUL VOCABULAIRE SUR LA PAGE : l’angle mort parle comme les cartes', () => {
    // Les cartes portent `titreClient` ; si l'angle mort portait `titre`, deux
    // vocabulaires sur la même page se liraient comme deux sujets différents.
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    });
    const r = analyser(p, null, DATE);
    for (const d of r.angleMort!.details) {
      if (d.startsWith('Suivi de cotisation')) continue;    // décrit le dossier
      expect(r.constats.some((c) => d.startsWith(c.titreClient))).toBe(true);
    }
  });

  it('chaque stratégie a un titre client DIFFÉRENT de son titre de catalogue', () => {
    for (const c of analyser(profilVierge('v', DATE), null, DATE).constats) {
      expect(c.titreClient).not.toBe(c.titre);
      expect(c.titreClient.length).toBeGreaterThan(10);
    }
  });
});

describe('LE GAIN NET — défaut trouvé en campagne, 6 août 2026', () => {
  it('les pertes DÉJÀ RÉALISÉES réduisent ce qu’il reste à cristalliser', () => {
    // Cas réel : 6 728 $ de gains réalisés ET 4 000 $ de pertes déjà prises.
    // Ne regarder que les gains ferait recommander 6 728 $ de ventes là où
    // 2 728 $ suffisent — 4 000 $ de ventes inutiles, leurs frais, et une
    // sortie de marché, pour un gain fiscal nul.
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 6728;
      x.transactionsAnnee.pertesRealisees = 4000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 40000)])];  // −32 000
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(2728);
  });

  it('des pertes qui couvrent tous les gains : plus rien à cristalliser', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 3000;
      x.transactionsAnnee.pertesRealisees = 9000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 40000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(plat(c.explication)).toMatch(/pertes déjà prises couvrent les gains/);
  });

  it('l’ordre de vente compte lui aussi le gain NET déjà réalisé', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 6728;
      x.transactionsAnnee.pertesRealisees = 4000;
      x.comptes = [compte('non-enregistre', [position('GAIN', 20000, 5000)])];  // +15 000
    });
    const c = trouver(analyser(p, { positions: [{ symbole: 'X', poidsCible: 1 }] }, DATE), 'ordre-vente');
    expect(c.montantEstime).toBe(17728);   // 15 000 + (6 728 − 4 000)
  });
});

describe('« dont 0 $ absorberait » ne se dit pas', () => {
  it('sans gain à absorber, la phrase le DIT au lieu d’afficher un zéro', () => {
    // Vu à l'écran le 6 août sur un client de la campagne : « 3 positions
    // portent une perte latente de 13 088 $, dont 0 $ absorberait le gain net
    // déjà réalisé cette année (0 $) ». Exact, illisible, et laissait croire
    // qu'il y avait quelque chose à faire.
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';           // -> branche « à confirmer »
      x.transactionsAnnee.gainsRealises = 0;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 21088)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.explication).not.toMatch(/dont 0/);
    expect(plat(c.explication)).toMatch(/aucun gain net n’a été réalisé/);
    expect(plat(c.explication)).toMatch(/13 088/);       // le chiffre vu reste dit
  });
});

describe('STRATÉGIE 6 — subvention REEE (SCEE 20 % + IQEE 10 %)', () => {
  const PARAMS = { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 };
  const avecEnfants = (prenoms: string[], cotise: Record<string, number> = {}) =>
    profilConsolide((x) => {
      x.demographie.enfants = prenoms.map((prenom) => ({ prenom, age: 8 }));
      x.cotisationsAnnee = { reer: 0, celi: 0, reeeParEnfant: cotise, portee: 'interne-seulement' };
    });
  const reee = (p: ProfilClient, params = PARAMS) =>
    analyser(p, null, DATE, params).constats.find((c) => c.strategie === 'subvention-reee')!;

  it('chiffre 30 % sur ce qui reste à cotiser', () => {
    const c = reee(avecEnfants(['Laurie']));
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(750);          // 2 500 × 30 %
    expect(plat(c.explication)).toMatch(/2 500 \$ de cotisation supplémentaire/);
  });

  it('tient compte de ce qui est DÉJÀ cotisé cette année, par enfant', () => {
    const c = reee(avecEnfants(['Laurie', 'Jules'], { LAURIE: 2000 }));
    // Laurie : 500 restants · Jules : 2 500 restants = 3 000 × 30 %
    expect(c.montantEstime).toBe(900);
    expect(plat(c.explication)).toMatch(/Laurie : 500 \$/);
  });

  it('LE PRÉNOM SE COMPARE SANS ACCENT NI CASSE', () => {
    const c = reee(avecEnfants(['Béatrice'], { BEATRICE: 2500 }));
    expect(c.dejaEnOrdre).toBe(true);
  });

  it('plafond atteint pour tous : « déjà en ordre », pas une piste', () => {
    const c = reee(avecEnfants(['Laurie'], { LAURIE: 2500 }));
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(true);
  });

  it('SANS ENFANT AU DOSSIER : indisponible, avec la question', () => {
    const c = reee(profilConsolide());
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes.join(' ')).toMatch(/enfants bénéficiaires/);
  });

  it('SANS BARÈME : indisponible plutôt qu’un taux deviné', () => {
    const c = reee(avecEnfants(['Laurie']), null as unknown as typeof PARAMS);
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
  });

  it('LE MONTANT EST ANNONCÉ COMME UN PLANCHER', () => {
    // On ne voit ni les droits reportés, ni les majorations selon le revenu,
    // ni les plafonds à vie. Les trois ne peuvent qu'augmenter le montant ou
    // l'annuler — jamais le rendre trompeur à la hausse. Il faut le dire.
    const c = reee(avecEnfants(['Laurie']));
    expect(plat(c.explication)).toMatch(/plancher/);
    expect(plat(c.explication)).toMatch(/ne se reporte pas indéfiniment/);
  });
});

describe('LE DÉTECTEUR ACTIONNABLE', () => {
  it('classe les données manquantes par ce qu’elles DÉBLOQUENT', () => {
    const r = analyser(profilVierge('vide', DATE), null, DATE);
    const m = classerManques(r);
    expect(m.length).toBeGreaterThan(0);
    // Trié par nombre de pistes bloquées, décroissant.
    for (let i = 1; i < m.length; i++) expect(m[i - 1].bloque).toBeGreaterThanOrEqual(m[i].bloque);
    expect(m[0].strategies.length).toBe(m[0].bloque);
  });

  it('NE COMPTE PAS les pistes sans objet', () => {
    // Une piste « non-applicable » ne se débloque pas. La compter gonflerait
    // artificiellement l'intérêt d'une question.
    const p = profilConsolide((x) => { x.demographie.etatCivil = 'celibataire'; });
    const r = analyser(p, null, DATE);
    const conjoint = r.constats.find((c) => c.strategie === 'celi-conjoint')!;
    expect(conjoint.statut).toBe('non-applicable');
    expect(classerManques(r).some((m) => m.strategies.includes(conjoint.titre))).toBe(false);
  });

  it('l’état de détection compte chaque famille et nomme la prochaine priorité', () => {
    const e = etatDetection(analyser(profilVierge('vide', DATE), null, DATE));
    expect(e.chiffrees + e.aConfirmer + e.bloquees + e.total).toBeGreaterThan(0);
    expect(e.prochainePriorite).not.toBeNull();
    expect(e.prochainePriorite!.bloque).toBeGreaterThan(0);
  });

  it('AUCUNE PRIORITÉ quand plus rien ne manque', () => {
    const p = profilConsolide((x) => {
      x.demographie.etatCivil = 'celibataire';
      x.intentions.donsAnnuelsMoyens = 0;
      x.transactionsAnnee.gainsRealises = 0;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 5000)])];
    });
    const r = restreindre(analyser(p, null, DATE), ['celi-conjoint', 'don-titres', 'cristallisation-pertes']);
    expect(etatDetection(r).prochainePriorite).toBeNull();
  });
});

describe('le classement privilégie ce qui débloque TOUT DE SUITE', () => {
  it('une donnée qui est le DERNIER verrou passe devant une qui bloque plus', () => {
    // Le compte brut ne suffit pas : une donnée qui bloque trois pistes ayant
    // chacune deux autres trous ne débloque rien à l'instant ; une donnée qui
    // bloque une seule piste, mais qui en est le dernier verrou, la rend
    // chiffrée immédiatement.
    const r = analyser(profilVierge('vide', DATE), null, DATE);
    const m = classerManques(r);
    for (let i = 1; i < m.length; i++) {
      expect(m[i - 1].debloqueImmediatement).toBeGreaterThanOrEqual(m[i].debloqueImmediatement);
    }
  });

  it('compte comme « immédiat » seulement le dernier verrou d’un constat', () => {
    const p = profilConsolide((x) => { x.intentions.donsAnnuelsMoyens = null; });
    const m = classerManques(analyser(p, null, DATE));
    const dons = m.find((x) => x.donnee.includes('dons de bienfaisance'));
    expect(dons).toBeDefined();
    expect(dons!.debloqueImmediatement).toBe(1);
  });
});


describe('STRATÉGIE 7 — cristallisation de GAINS, le miroir de la 1', () => {
  const gains = (p: ProfilClient) =>
    analyser(p, null, DATE).constats.find((c) => c.strategie === 'cristallisation-gains')!;

  it('chiffre le gain absorbable par les pertes REPORTÉES', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 7500, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];  // +40 000
    });
    const c = gains(p);
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(7500);          // plafonné aux pertes, pas aux gains
    expect(plat(c.explication)).toMatch(/7 500 \$ de pertes reportées/);
  });

  it('chiffre aussi le NET DE PERTES de l’année courante', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 0, dateDonnee: DATE };
      x.transactionsAnnee.gainsRealises = 1000;
      x.transactionsAnnee.pertesRealisees = 6000;   // net −5 000
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 20000, 12000)])];  // +8 000
    });
    expect(gains(p).montantEstime).toBe(5000);
  });

  it('PLAFONNE aux gains latents quand les pertes dépassent', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 90000, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 15000, 12000)])];  // +3 000
    });
    expect(gains(p).montantEstime).toBe(3000);
  });

  it('S’ALLUME EXACTEMENT QUAND LA 1 S’ÉTEINT — les deux faces du même signe', () => {
    // Année à pertes nettes : la 1 n'a rien à absorber, la 7 chiffre.
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 0, dateDonnee: DATE };
      x.transactionsAnnee.pertesRealisees = 6000;
      x.comptes = [compte('non-enregistre', [
        position('GAGNANT', 20000, 12000),
        position('PERDANT', 4000, 9000),
      ])];
    });
    const r = analyser(p, null, DATE);
    const pertes = r.constats.find((c) => c.strategie === 'cristallisation-pertes')!;
    const g = r.constats.find((c) => c.strategie === 'cristallisation-gains')!;
    expect(pertes.statut).toBe('non-applicable');
    expect(g.statut).toBe('calcule');
  });

  it('PERTES REPORTÉES JAMAIS DEMANDÉES : une question, pas un « rien à faire »', () => {
    // Elles pourraient exister — seul l'avis de cotisation le sait.
    const p = profilConsolide((x) => {
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
    });
    const c = gains(p);
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes.join(' ')).toMatch(/avis de cotisation/);
  });

  it('AUCUNE PERTE, CONFIRMÉ : « déjà en ordre », et c’est une bonne nouvelle', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 0, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
    });
    const c = gains(p);
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(true);
  });

  it('JAMAIS un montant quand des comptes existent ailleurs', () => {
    const p = profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.droits.pertesCapitalReportees = { montant: 7500, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
    });
    const c = gains(p);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(plat(c.explication)).toMatch(/7 500/);   // le chiffre vu reste dit
  });

  it('un compte au régime INCONNU reste écarté, jamais présumé non enregistré', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 7500, dateDonnee: DATE };
      x.comptes = [compte(null, [position('GAGNANT', 50000, 10000)])];
    });
    expect(gains(p).statut).toBe('indisponible');
  });

  it('ses gestes disent le rachat immédiat — pas de règle des 30 jours pour un gain', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 7500, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
    });
    const g = gestesDe(gains(p));
    expect(g.length).toBeGreaterThan(0);
    expect(plat(g[0].demarches.join(' '))).toMatch(/permis le jour même/);
  });
});

describe('« 0 $ de pertes latentes » ne se dit pas', () => {
  it('la phrase des pertes latentes disparaît quand il n’y en a aucune', () => {
    // Vu au rendu du 11 août : « Les 0 $ de pertes latentes restent
    // disponibles pour une année future » — même famille que le « dont 0 $
    // absorberait » du 5 août. Un zéro narratif est un mensonge de précision.
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 1000;
      x.transactionsAnnee.pertesRealisees = 6000;
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 62000, 14000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(plat(c.explication)).not.toMatch(/0 \$ de pertes latentes/);
  });
});


describe('LE PLAN DE RÉCOLTE — quoi vendre, et pourquoi cet ordre', () => {
  const avecPositions = () => profilConsolide((x) => {
    x.droits.pertesCapitalReportees = { montant: 10000, dateDonnee: DATE };
    x.comptes = [compte('non-enregistre', [
      position('DENSE', 10000, 2000),     // gain 8 000, densité 80 %
      position('MOYEN', 20000, 14000),    // gain 6 000, densité 30 %
      position('LEGER', 30000, 27000),    // gain 3 000, densité 10 %
    ])];
  });

  it('commence par le titre au gain le plus DENSE, pas le plus gros', () => {
    const c = trouver(analyser(avecPositions(), null, DATE), 'cristallisation-gains');
    expect(c.statut).toBe('calcule');
    expect(c.plan![0].symbole).toBe('DENSE');
  });

  it('la dernière ligne est PARTIELLE et la somme tombe exactement sur la cible', () => {
    const c = trouver(analyser(avecPositions(), null, DATE), 'cristallisation-gains');
    // Cible 10 000 : DENSE en entier (8 000), puis 2 000 sur MOYEN.
    expect(c.plan).toHaveLength(2);
    expect(c.plan![0]).toMatchObject({ symbole: 'DENSE', vendre: 10000, gain: 8000, partiel: false });
    expect(c.plan![1].symbole).toBe('MOYEN');
    expect(c.plan![1].gain).toBe(2000);
    expect(c.plan![1].partiel).toBe(true);
    // La proportion est fiscalement exacte : 2 000/6 000 du gain = 1/3 de la
    // position, donc environ 6 667 $ à vendre.
    expect(c.plan![1].vendre).toBe(6667);
    const total = c.plan!.reduce((somme, l) => somme + l.gain, 0);
    expect(total).toBe(c.montantEstime);
  });

  it('AUCUN PLAN sur un montant non confirmé', () => {
    // Un plan vers un chiffre incertain serait une marche à suivre vers un
    // chiffre faux.
    const p = avecPositions();
    p.consolidation.comptesExternes = 'oui';
    const c = trouver(analyser(p, null, DATE), 'cristallisation-gains');
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.plan).toBeUndefined();
  });

  it('pertes qui dépassent les gains : tout se vend, rien de partiel', () => {
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 50000, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [
        position('DENSE', 10000, 2000),
        position('MOYEN', 20000, 14000),
      ])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-gains');
    expect(c.plan!.every((l) => !l.partiel)).toBe(true);
    expect(c.montantEstime).toBe(14000);
  });
});

describe('UN COMPTE CORPO EST UN AUTRE CONTRIBUABLE — défaut du 12 août', () => {
  it('les gains de la société n’absorbent JAMAIS les pertes personnelles', () => {
    // Trouvé par la contre-expertise : le plan mélangeait les comptes corpo et
    // personnels — une compensation qui n'existe pas en droit fiscal.
    const p = profilConsolide((x) => {
      x.droits.pertesCapitalReportees = { montant: 10000, dateDonnee: DATE };
      x.comptes = [compte('corpo', [position('CORPO-GAGNANT', 50000, 10000)])];
    });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-gains');
    expect(c.statut).not.toBe('calcule');
    expect(c.plan).toBeUndefined();
  });

  it('la cristallisation de pertes ignore aussi les positions corpo', () => {
    const p = profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('corpo', [position('CORPO-PERDANT', 8000, 20000)])];
    });
    // Depuis le 12 août : « non-applicable » (aucun compte personnel imposable),
    // plus « indisponible » — mais la protection reste entière : jamais de
    // montant ni de plan bâtis sur la position de la société, et l'explication
    // nomme l'autre contribuable.
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(c.montantEstime).toBeNull();
    expect(c.plan).toBeUndefined();
    expect(c.explication).toContain('société');
  });
});

describe('LE MOTIF DU ZÉRO DOIT ÊTRE LE VRAI MOTIF — client tout à l’abri (12 août)', () => {
  // Trouvé en éprouvant le moteur sur un client fictif « CELI + CELIAPP
  // seulement » : le constat affirmait « le régime de certains comptes reste
  // inconnu » alors que les deux régimes étaient PROUVÉS. Un client dont tous
  // les comptes sont à l'abri n'est pas « bloqué » : il n'a rien à cristalliser.
  const toutAbri = (modif: (p: ProfilClient) => void = () => {}) =>
    profilConsolide((x) => {
      x.comptes = [
        compte('celi', [position('AAA', 45000, 30000)]),
        compte('celiapp', [position('BBB', 12000, 10000)]),
      ];
      modif(x);
    });

  it('CELI + CELIAPP prouvés : non-applicable et déjà en ordre, pas « bloqué »', () => {
    const r = analyser(toutAbri(), null, DATE);
    for (const s of ['cristallisation-pertes', 'cristallisation-gains', 'localisation-actifs']) {
      const c = trouver(r, s);
      expect(c.statut).toBe('non-applicable');
      expect(c.dejaEnOrdre).toBe(true);
      expect(c.donneesManquantes).toEqual([]);
      expect(plat(c.explication)).toContain('à l’abri de l’impôt');
    }
  });

  it('visibilité entamée : non-applicable mais PAS « déjà en ordre », et la limite est dite', () => {
    const p = toutAbri((x) => { x.consolidation.comptesExternes = 'inconnu'; });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(false);
    expect(c.limiteVisibilite).toContain('ailleurs');
  });

  it('un régime NON prouvé garde le verdict « bloqué », avec son motif vrai', () => {
    const p = toutAbri((x) => { x.comptes.push(compte(null, [position('CCC', 5000, 4000)])); });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('indisponible');
    expect(c.donneesManquantes[0]).toContain('régime');
  });

  it('un compte imposable VIDE (encaisse seulement) : non-applicable avec ce motif-là', () => {
    const p = toutAbri((x) => { x.comptes.push(compte('non-enregistre', [])); });
    const c = trouver(analyser(p, null, DATE), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(c.explication).toContain('encaisse seulement');
  });

  it('ordre-vente avec cible : rien d’imposable à ordonner → non-applicable', () => {
    const c = trouver(
      analyser(toutAbri(), { positions: [] }, DATE),
      'ordre-vente'
    );
    expect(c.statut).toBe('non-applicable');
    expect(c.donneesManquantes).toEqual([]);
  });

  it('don-titres chez un donateur sans relevé : indisponible (pas « déjà en ordre »)', () => {
    const p = profilConsolide((x) => {
      x.intentions.donsAnnuelsMoyens = 5000;
      x.comptes = [];
    });
    const c = trouver(analyser(p, null, DATE), 'don-titres');
    expect(c.statut).toBe('indisponible');
    expect(c.dejaEnOrdre).toBe(false);
    expect(c.donneesManquantes[0]).toContain('relevé');
  });
});

describe('STRATÉGIE 8 — droits de cotisation, et le signal de maximisation', () => {
  const signaux = (droits: Partial<import('../droits-celi').ResultatDroitsCeli> | null, max: Partial<import('../signaux-livre').SignalMaximisation> | null = null) => ({
    droitsCeli: droits === null ? null : {
      statut: 'montant-a-confirmer' as const, portee: 'interne-seulement' as const,
      montant: null, borne: 50000, conditionsManquantes: ["le client n'a pas confirmé"],
      transfertsATrancher: 0, ...droits,
    },
    maximisation: max === null ? null : {
      etat: 'sous-plafond' as const, depuis: 2015, totalCotise: 40000,
      plafondPeriode: 70000, anneesSousPlafond: [2019, 2022], ...max,
    },
  });
  const dc = (p: ProfilClient, s: ReturnType<typeof signaux> | null) =>
    analyser(p, null, DATE, null, s).constats.find((c) => c.strategie === 'droits-cotisation')!;

  it('SANS signaux (pas de livre) : indisponible', () => {
    const c = dc(profilConsolide(), null);
    expect(c.statut).toBe('indisponible');
  });

  it('trois conditions réunies : l’espace est CHIFFRÉ', () => {
    const c = dc(profilConsolide(), signaux({ statut: 'calcule', montant: 37000, borne: 37000, conditionsManquantes: [] }));
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(37000);
  });

  it('sinon : une BORNE dans le texte, jamais un montant', () => {
    const c = dc(profilConsolide(), signaux({}));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(plat(c.explication)).toMatch(/50 000 \$/);
    expect(plat(c.explication)).toMatch(/borne, pas le droit réel/);
  });

  it('LE SIGNAL ÉCLAIRE SANS RÉPONDRE : « maximisé » reste une suggestion', () => {
    const c = dc(profilConsolide(), signaux({}, { etat: 'maximise', anneesSousPlafond: [] }));
    expect(plat(c.explication)).toMatch(/suggère que le client cotise seulement ici/);
    expect(plat(c.explication)).toMatch(/un mot en rencontre le confirme/);
  });

  it('« dépasse-cumul » est annoncé comme une PREUVE d’historique externe', () => {
    const c = dc(profilConsolide(), signaux({}, { etat: 'depasse-cumul', totalCotise: 90000, plafondPeriode: 70000 }));
    expect(plat(c.explication)).toMatch(/preuve d’un historique externe/);
  });

  it('le REER dit son incalculabilité — ou l’avis saisi, daté', () => {
    const sansAvis = dc(profilConsolide(), signaux({}));
    expect(plat(sansAvis.explication)).toMatch(/ne peut pas se calculer d’ici/);
    const avecAvis = dc(profilConsolide((x) => {
      x.droits.reerInutilises = { montant: 22000, dateDonnee: DATE };
    }), signaux({}));
    expect(plat(avecAvis.explication)).toMatch(/22 000 \$ selon l’avis/);
  });

  it('le petit disclaimer ARC est TOUJOURS là', () => {
    for (const c of [dc(profilConsolide(), signaux({})), dc(profilConsolide(), signaux({ statut: 'calcule', montant: 5000, conditionsManquantes: [] }))]) {
      expect(plat(c.explication)).toMatch(/Mon dossier ARC/);
      expect(plat(c.explication)).toMatch(/1 % par mois/);
    }
  });
});
