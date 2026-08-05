// LES 5 STRATÉGIES FISCALES.
//
// Ces tests ne vérifient pas qu'on trouve toujours un chiffre — ils vérifient
// qu'on n'en invente JAMAIS. Un `indisponible` correctement motivé est un
// succès ; un montant présenté comme certain alors qu'une donnée manque est
// l'échec que ce module existe pour empêcher.
//
// Profils fictifs, formats réels : les tests partent sur GitHub.

import { describe, it, expect } from 'vitest';
import { analyser, type PortefeuilleCible } from '../strategies';
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
  it('rend les 5 stratégies, toujours, même sur un profil vide', () => {
    const r = analyser(profilVierge('vide', DATE), null, DATE);
    expect(r.constats).toHaveLength(5);
    expect(r.constats.map((c) => c.strategie).sort()).toEqual([
      'celi-conjoint', 'cristallisation-pertes', 'don-titres', 'localisation-actifs', 'ordre-vente',
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
    expect(a.total).toBe(5);
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
    expect(r.angleMort!.details.some((d) => d === `${c.titre} : ${c.limiteVisibilite}`)).toBe(true);
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
