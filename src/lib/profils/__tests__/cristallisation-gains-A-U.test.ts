// LA MATRICE A→U — chaque condition matérielle d'un `calcule`, verrouillée.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS.
//
// Il n'ajoute AUCUNE règle fiscale. Tout ce qu'il teste existe déjà dans le
// moteur depuis les lots précédents. Son objet est de prouver que chacune de
// ces protections est réellement tenue par un test — et la section U le prouve
// à l'envers, en cassant les gardes un par un pour voir tomber le rouge.
//
// LA RÈGLE QUI GOUVERNE TOUT LE FICHIER :
//
//   une stratégie ne sort `calcule` que si TOUTES les données matériellement
//   nécessaires À CETTE STRATÉGIE sont fiables — et « matériellement » veut
//   dire « peut changer SON chiffre », jamais « appartient à la même famille
//   de vocabulaire ».
//
// D'où le test S : une ambiguïté CELI, si grave soit-elle, ne doit rien changer
// à une récolte de gains en compte non enregistré. Un moteur qui bloque tout
// dès qu'il ignore quelque chose quelque part ne dit plus rien à personne.
//
// Données entièrement fictives : comptes « FICT », symboles inventés.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { profilVierge, type ProfilClient, type Compte, type Position } from '../types';
import { analyser } from '../strategies';
import {
  qualifierPosition, verifierCompletudeCristallisationGains,
  biensIdentiquesMultiComptes, racheteDansLaFenetre, positionsNonEnregistrees,
  pertesReporteesUtilisables,
} from '../completude-cristallisation';
import { deriverTransactionsAnnee } from '../deriver';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

const DATE = '2026-08-21';
const ANNEE = 2026;

// ─────────────────────────────────────────────────────────────────────────────
// Le vocabulaire des fixtures
// ─────────────────────────────────────────────────────────────────────────────

function position(
  symbole: string, vm: number | null, pbr: number | null, devise = 'CAD',
  quantite: number | undefined = 100, typeInstrument: string | undefined = 'Action'
): Position {
  return {
    symbole, devise, categorie: null, uniteValeursRapport: 'CAD',
    quantite, typeInstrument,
    valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
  };
}

function compte(
  type: Compte['type'], positions: Position[], numero = 'FICT-1', dateReleve: string | null = DATE
): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre',
    type, titulaire: 'client', candidats: [numero], dateReleve,
    presence: 'au-releve', derniereActivite: null, dernierSolde: null,
    encaisse: [], positions,
  };
}

/**
 * UN DOSSIER OÙ RIEN D'AUTRE NE BLOQUE.
 *
 * C'est le socle de toute la matrice : chaque test n'introduit QU'UNE seule
 * imperfection, pour que le blocage observé ne puisse venir que d'elle. Un
 * dossier qui bloque pour trois raisons ne prouve rien sur aucune des trois.
 */
function dossierPropre(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif01', DATE);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '0-50k';
  p.revenus.dateDonnee = DATE;
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.transactionsAnnee.portee = 'complete';
  // 10 000 $ de pertes NON ENREGISTRÉES de l'année, en montants bruts venus du
  // livre : l'unité est connue, contrairement au champ saisi des reportées.
  p.transactionsAnnee.pertesRealisees = 10000;
  p.transactionsAnnee.pertesRealiseesNonEnregistrees = 10000;
  p.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
  modif(p);
  return p;
}

function gains(profil: ProfilClient) {
  const c = analyser(profil, null, DATE).constats.find((x) => x.strategie === 'cristallisation-gains');
  if (!c) throw new Error('constat cristallisation-gains absent');
  return c;
}

/** `argent()` sème des espaces insécables ; les regexes ne les voient pas. */
const plat = (t: string) => t.replace(/[\s  ]+/g, ' ');

function tx(p: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: `${ANNEE}-03-15`, dateReglement: `${ANNEE}-03-17`, nom: 'Fictif, Test', note: '',
    symbole: 'XYZ', quantite: null, prix: null, devise: 'CAD', total: null,
    gainsPertes: null, description: '', categorie: '', typeBrut: p.type,
    ...p,
  } as LigneTransaction;
}

// ═══════════════════════════════════════════════════════════════════════════
// A — LE CAS PROPRE : tout est fiable, donc ça chiffre
// ═══════════════════════════════════════════════════════════════════════════

describe('A · dossier entièrement fiable en dollars canadiens', () => {
  it('sort `calcule`, avec un montant et sans donnée manquante', () => {
    const c = gains(dossierPropre());
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(10000);       // plafonné par les pertes disponibles
    expect(c.donneesManquantes).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B / C / D — LE PBR ET LA VALEUR MARCHANDE
// ═══════════════════════════════════════════════════════════════════════════

describe('B · PBR absent', () => {
  it('n’est JAMAIS lu comme un PBR de zéro', () => {
    const q = qualifierPosition({ ...position('AVEUGLE', 50000, null), compte: compte('non-enregistre', []) });
    expect(q.pbrFiable).toBe(false);
    expect(q.gainLatentCad).toBeNull();         // et surtout PAS 50 000
  });

  it('empêche le chiffre ferme, et nomme le PBR comme motif', () => {
    // TOUTES les positions sans PBR : le moteur dit `indisponible` plutôt que
    // `montant-a-confirmer`, et c'est plus vrai — il n'y a aucun chiffre à
    // confirmer. Ce qui compte, c'est qu'aucun montant ne sorte et que le motif
    // soit le bon.
    const c = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [position('AVEUGLE', 50000, null)])];
    }));
    expect(c.statut).not.toBe('calcule');
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/prix de base rajusté/);
    expect(plat(c.explication)).not.toMatch(/50 000/);
  });

  it('MÉLANGÉ — une position lisible et une aveugle : le chiffre reste à confirmer', () => {
    const c = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [
        position('BONNE', 50000, 10000),
        position('AVEUGLE', 40000, null),
      ])];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/prix de base rajusté/);
  });
});

describe('C · PBR de zéro CONFIRMÉ', () => {
  it('est une donnée valide — le gain latent vaut la valeur marchande entière', () => {
    const q = qualifierPosition({ ...position('HERITE', 50000, 0), compte: compte('non-enregistre', []) });
    expect(q.pbrFiable).toBe(true);
    expect(q.gainLatentCad).toBe(50000);
  });

  it('ne se confond pas avec un PBR absent : l’un chiffre, l’autre bloque', () => {
    const zero = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [position('HERITE', 50000, 0)])];
    }));
    const absent = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [position('HERITE', 50000, null)])];
    }));
    expect(zero.statut).toBe('calcule');
    expect(zero.montantEstime).toBe(10000);
    expect(absent.statut).not.toBe('calcule');
    expect(absent.montantEstime).toBeNull();
  });
});

describe('D · valeur marchande absente', () => {
  it('ne donne JAMAIS un gain latent de zéro', () => {
    const q = qualifierPosition({ ...position('SANSVM', null, 10000), compte: compte('non-enregistre', []) });
    expect(q.vmFiable).toBe(false);
    expect(q.gainLatentCad).toBeNull();
  });

  it('exclut la position de tout plan ferme, et le dit', () => {
    const c = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [
        position('BONNE', 50000, 10000),
        position('SANSVM', null, 10000),
      ])];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/valeur marchande/);
    expect(JSON.stringify(c.plan ?? [])).not.toMatch(/SANSVM/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E / F / G / H — LE RÉGIME
// ═══════════════════════════════════════════════════════════════════════════

describe('E · un gros gain latent dans un compte ENREGISTRÉ', () => {
  it('n’est jamais candidat à une cristallisation imposable', () => {
    for (const regime of ['celi', 'reer', 'celiapp', 'ferr', 'reee'] as const) {
      const p = dossierPropre((x) => {
        x.comptes = [compte(regime, [position('ABRITE', 500000, 1000)])];
      });
      expect(positionsNonEnregistrees(p)).toHaveLength(0);
      const c = gains(p);
      expect(c.montantEstime, `régime ${regime}`).toBeNull();
      expect(JSON.stringify(c.candidats ?? [])).not.toMatch(/ABRITE/);
    }
  });
});

describe('F · un gain réalisé dans un REER', () => {
  it('n’entre jamais dans l’assiette non enregistrée', () => {
    const t = deriverTransactionsAnnee([
      tx({ type: 'Vente', noCompte: '37-FICT-S', gainsPertes: 8000 }),      // REER
    ], ANNEE);
    expect(t.gainsRealises).toBe(8000);                 // la PERFORMANCE le voit
    expect(t.gainsRealisesNonEnregistres).toBe(0);      // l'ASSIETTE non
  });
});

describe('G · une perte réalisée dans un CELI', () => {
  it('n’entre jamais dans les pertes non enregistrées', () => {
    const t = deriverTransactionsAnnee([
      tx({ type: 'Vente', noCompte: '37-FICT-W', gainsPertes: -9000 }),     // CELI
    ], ANNEE);
    expect(t.pertesRealisees).toBe(9000);
    expect(t.pertesRealiseesNonEnregistrees).toBe(0);
  });
});

describe('H · une disposition dont le régime n’est pas prouvé', () => {
  it('se compte à part — jamais versée d’office dans le non-enregistré', () => {
    const t = deriverTransactionsAnnee([
      tx({ type: 'Vente', noCompte: '37-FICT-X', gainsPertes: -7000 }),     // suffixe inconnu
    ], ANNEE);
    expect(t.pertesRealiseesNonEnregistrees).toBe(0);
    expect(t.dispositionsRegimeIndetermine.nombre).toBe(1);
    expect(t.dispositionsRegimeIndetermine.pertes).toBe(7000);
  });

  it('empêche le chiffre ferme quand elle pourrait changer les pertes disponibles', () => {
    const c = gains(dossierPropre((p) => {
      p.transactionsAnnee.dispositionsRegimeIndetermine = { nombre: 2, gains: 0, pertes: 7000 };
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/régime des comptes/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I / J — LA DEVISE
// ═══════════════════════════════════════════════════════════════════════════

describe('I · l’unité des valeurs — pas la devise du titre', () => {
  // ⚠ HYPOTHÈSE REMPLACÉE LE 21 AOÛT 2026, PAS SUPPRIMÉE.
  //
  // Ces tests affirmaient : « position USD → blocage ». C'était FAUX, et
  // mesuré comme tel : le format d'export que nous supportons rend ses
  // colonnes monétaires en dollars canadiens, y compris sur les lignes
  // marquées « USD » (encaisse 1USD à 1,379 et 1,389 ; distribution
  // valeur/coût identique entre lignes CAD et USD, 40 % contre 41 % en perte).
  // 14 des 49 positions non enregistrées étaient écartées pour rien.
  //
  // Le garde n'est pas retiré — il est REPOINTÉ sur la vraie question :
  // l'unité des VALEURS, déclarée par le format, et non la monnaie de
  // NÉGOCIATION du titre.

  it('D4 · une unité de rapport INCONNUE bloque, elle', () => {
    const q = qualifierPosition({
      ...position('MYSTERE', 15000, 10000, 'CAD'), uniteValeursRapport: 'inconnue',
      compte: compte('non-enregistre', []),
    });
    expect(q.valeursExprimeesEnCad).toBe(false);
    expect(q.gainLatentCad).toBeNull();          // ni 5 000, ni rien d'autre
  });

  it('D5 · un rapport explicitement en USD n’est JAMAIS lu comme du canadien', () => {
    const q = qualifierPosition({
      ...position('USTITRE', 15000, 10000, 'USD'), uniteValeursRapport: 'USD',
      compte: compte('non-enregistre', []),
    });
    expect(q.valeursExprimeesEnCad).toBe(false);
    expect(q.gainLatentCad).toBeNull();
  });

  it('bloque le constat, et nomme l’unité comme motif', () => {
    const c = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [
        { ...position('MYSTERE', 15000, 10000), uniteValeursRapport: 'inconnue' },
      ])];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/dollars canadiens/);
    expect(plat(c.explication)).not.toMatch(/5 000/);
  });
});

describe('J · une position USD dont les valeurs sont en dollars canadiens', () => {
  it('D2 / D6 · CHIFFRE — c’est le cas que l’ancien garde bloquait à tort', () => {
    const q = qualifierPosition({
      ...position('USTITRE', 15000, 10000, 'USD'), uniteValeursRapport: 'CAD',
      compte: compte('non-enregistre', []),
    });
    expect(q.valeursExprimeesEnCad).toBe(true);
    expect(q.gainLatentCad).toBe(5000);          // 5 000 CAD, pas USD

    const c = gains(dossierPropre((p) => {
      p.comptes = [compte('non-enregistre', [
        { ...position('USTITRE', 15000, 10000, 'USD'), uniteValeursRapport: 'CAD' },
      ])];
    }));
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(5000);
  });

  it('D3 · la devise du TITRE ne détermine jamais l’unité des valeurs', () => {
    // Les deux positions ont exactement les mêmes nombres. Seule la monnaie de
    // négociation diffère — et elle ne doit rien changer.
    const usd = qualifierPosition({
      ...position('USTITRE', 15000, 10000, 'USD'), compte: compte('non-enregistre', []) });
    const cad = qualifierPosition({
      ...position('CATITRE', 15000, 10000, 'CAD'), compte: compte('non-enregistre', []) });
    expect(usd.gainLatentCad).toBe(cad.gainLatentCad);
    expect(usd.valeursExprimeesEnCad).toBe(cad.valeursExprimeesEnCad);
  });

  it('D1 · le cas canadien de bout en bout reste évidemment calculable', () => {
    for (const devise of ['CAD', 'cad', '']) {
      const q = qualifierPosition({
        ...position('CANADIEN', 15000, 10000, devise), compte: compte('non-enregistre', []),
      });
      expect(q.valeursExprimeesEnCad, devise).toBe(true);
      expect(q.gainLatentCad, devise).toBe(5000);
    }
  });

  it('D8 · les AUTRES gardes restent actifs sur une position USD', () => {
    // Le correctif ne doit pas devenir un laissez-passer : une position USD
    // sans prix de base reste bloquée, pour son vrai motif.
    const sansPbr = qualifierPosition({
      ...position('USTITRE', 15000, null, 'USD'), compte: compte('non-enregistre', []) });
    expect(sansPbr.gainLatentCad).toBeNull();
    const sansVm = qualifierPosition({
      ...position('USTITRE', null, 10000, 'USD'), compte: compte('non-enregistre', []) });
    expect(sansVm.gainLatentCad).toBeNull();

    const c = gains(dossierPropre((p) => {
      p.consolidation.comptesExternes = 'oui';   // portée
      p.comptes = [compte('non-enregistre', [position('USTITRE', 15000, 10000, 'USD')])];
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/ailleurs/);
  });

  it('D9 · le compte reste décrit comme USD, sans fusionner les deux notions', () => {
    // « Compte non enregistré USD » et « montants fiscaux en CAD » sont deux
    // informations vraies en même temps. Le correctif ne doit pas effacer la
    // première pour faire passer la seconde.
    const p = { ...position('USTITRE', 15000, 10000, 'USD'), compte: compte('non-enregistre', []) };
    const q = qualifierPosition(p);
    expect(q.position.devise).toBe('USD');       // la monnaie de négociation SURVIT
    expect(q.valeursExprimeesEnCad).toBe(true);  // et les valeurs sont en CAD
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// K / L — LES PERTES REPORTÉES
// ═══════════════════════════════════════════════════════════════════════════

describe('K · une perte reportée d’unité inconnue', () => {
  it('n’est JAMAIS ajoutée nominalement aux pertes disponibles', () => {
    const c = gains(dossierPropre((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 10000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE,
      };
    }));
    // Les pertes courantes valent 10 000 ; si la reportée s'ajoutait, on verrait
    // 20 000 quelque part.
    expect(c.montantEstime).not.toBe(20000);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(plat(c.explication)).not.toMatch(/20 000|10 000/);
  });

  it('L’ARITHMÉTIQUE ELLE-MÊME l’exclut — pas seulement le statut', () => {
    // ⚠ VERROU AJOUTÉ APRÈS LE SABOTAGE U DU 21 AOÛT. Le garde-fou de
    // complétude bloquait déjà le constat, si bien qu'on pouvait supprimer
    // l'exclusion arithmétique sans faire rougir un seul test. Les deux
    // protections sont redondantes À DESSEIN : l'une empêche le STATUT, l'autre
    // empêche le MONTANT d'être faux. Il fallait pouvoir observer la seconde.
    expect(pertesReporteesUtilisables({
      montant: 10000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE,
    })).toBe(0);
    expect(pertesReporteesUtilisables({
      montant: 10000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE,
    })).toBe(0);
    // Et le pendant positif, sinon « toujours zéro » passerait le test.
    expect(pertesReporteesUtilisables({
      montant: 10000, unite: 'perte-capital-brute', source: 'avis-cotisation', dateDonnee: DATE,
    })).toBe(10000);
    expect(pertesReporteesUtilisables({
      montant: 10000, unite: 'montant-normalise-utilisable', source: 'autre', dateDonnee: DATE,
    })).toBe(10000);
    expect(pertesReporteesUtilisables({
      montant: null, unite: 'perte-capital-brute', source: 'autre', dateDonnee: null,
    })).toBe(0);
  });
});

describe('L · une perte reportée d’unité compatible', () => {
  it('entre dans le calcul, selon le prédicat existant', () => {
    for (const unite of ['perte-capital-brute', 'montant-normalise-utilisable'] as const) {
      const c = gains(dossierPropre((p) => {
        p.droits.pertesCapitalReportees = { montant: 5000, unite, source: 'avis-cotisation', dateDonnee: DATE };
      }));
      expect(c.statut, unite).toBe('calcule');
      expect(c.montantEstime, unite).toBe(15000);      // 10 000 courantes + 5 000 reportées
    }
  });

  it('une perte NETTE reste bloquée, avec son propre motif', () => {
    const c = gains(dossierPropre((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE,
      };
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/montant BRUT/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M / N — LA PERTE APPARENTE
// ═══════════════════════════════════════════════════════════════════════════

describe('M · une perte courante dans la bonne assiette mais au statut incertain', () => {
  it('n’est pas tenue pour fermement disponible', () => {
    const c = gains(dossierPropre((p) => {
      p.transactionsAnnee.pertesCourantesAValiderPerteApparente = true;
    }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/perte apparente/);
  });

  it('« bonne assiette » et « utilisable » sont deux questions distinctes', () => {
    // La perte EST non enregistrée — l'assiette est bonne. C'est son
    // admissibilité qui reste ouverte. Le moteur ne doit pas confondre les deux.
    const p = dossierPropre((x) => {
      x.transactionsAnnee.pertesCourantesAValiderPerteApparente = true;
    });
    expect(p.transactionsAnnee.pertesRealiseesNonEnregistrees).toBe(10000);
    expect(gains(p).montantEstime).toBeNull();
  });
});

describe('N · le rachat du même bien dans la fenêtre visible', () => {
  const vente = tx({ type: 'Vente', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-03-15`, gainsPertes: -4000 });

  it('déclenche réellement le garde-fou', () => {
    const rachat = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-04-02` });  // +18 j
    expect(racheteDansLaFenetre([vente, rachat], ANNEE)).toBe(true);
  });

  it('NÉGATIF ADJACENT — le même rachat hors fenêtre ne déclenche rien', () => {
    const tardif = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-05-20` });  // +66 j
    expect(racheteDansLaFenetre([vente, tardif], ANNEE)).toBe(false);
  });

  it('NÉGATIF ADJACENT — un AUTRE titre racheté dans la fenêtre ne déclenche rien', () => {
    const autre = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'ABC', date: `${ANNEE}-04-02` });
    expect(racheteDansLaFenetre([vente, autre], ANNEE)).toBe(false);
  });

  it('la fenêtre couvre aussi le rachat qui PRÉCÈDE la vente', () => {
    const avant = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-03-01` });   // −14 j
    expect(racheteDansLaFenetre([vente, avant], ANNEE)).toBe(true);
  });

  it('bout à bout : le livre déclenche le drapeau, qui dégrade le constat', () => {
    const rachat = tx({ type: 'Achat', noCompte: '37-FICT-A', symbole: 'XYZ', date: `${ANNEE}-04-02` });
    const t = deriverTransactionsAnnee([vente, rachat], ANNEE);
    expect(t.pertesCourantesAValiderPerteApparente).toBe(true);

    const c = gains(dossierPropre((p) => {
      p.transactionsAnnee.pertesRealiseesNonEnregistrees = 4000;
      p.transactionsAnnee.pertesRealisees = 4000;
      p.transactionsAnnee.pertesCourantesAValiderPerteApparente = t.pertesCourantesAValiderPerteApparente;
    }));
    expect(c.statut).toBe('montant-a-confirmer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// O — LE BIEN IDENTIQUE DANS PLUSIEURS COMPTES
// ═══════════════════════════════════════════════════════════════════════════

describe('O · le même titre dans deux comptes non enregistrés', () => {
  it('lève le garde, et ne calcule AUCUN prix de base transversal', () => {
    const p = dossierPropre((x) => {
      x.comptes = [
        compte('non-enregistre', [position('XYZ', 30000, 10000)], 'FICT-A'),
        compte('non-enregistre', [position('XYZ', 20000, 5000)], 'FICT-E'),
      ];
    });
    expect(biensIdentiquesMultiComptes(positionsNonEnregistrees(p))).toEqual(['XYZ']);

    const c = gains(p);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/prix de base rajusté consolidé/);
  });

  it('NÉGATIF — deux symboles DIFFÉRENTS dans deux comptes ne lèvent rien', () => {
    const p = dossierPropre((x) => {
      x.comptes = [
        compte('non-enregistre', [position('XYZ', 30000, 10000)], 'FICT-A'),
        compte('non-enregistre', [position('ABC', 20000, 5000)], 'FICT-E'),
      ];
    });
    expect(biensIdentiquesMultiComptes(positionsNonEnregistrees(p))).toEqual([]);
    expect(gains(p).statut).toBe('calcule');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P — LA PORTÉE EXTERNE
// ═══════════════════════════════════════════════════════════════════════════

describe('P · les comptes détenus ailleurs', () => {
  it('bloquent tant qu’ils ne sont pas exclus — ils peuvent changer le PBR et la perte apparente', () => {
    for (const reponse of ['oui', 'inconnu'] as const) {
      const c = gains(dossierPropre((p) => { p.consolidation.comptesExternes = reponse; }));
      expect(c.statut, reponse).toBe('montant-a-confirmer');
      expect(c.donneesManquantes.join(' ')).toMatch(/ailleurs/);
    }
  });

  it('mais une inconnue SANS effet possible sur cette stratégie ne bloque pas', () => {
    // L'historique CELI externe est une inconnue réelle. Elle ne touche ni le
    // prix de base d'un titre non enregistré, ni les pertes de l'année, ni la
    // règle de la perte apparente. Elle ne doit donc rien changer ici.
    const c = gains(dossierPropre((p) => { p.consolidation.historiqueExterne = 'inconnu'; }));
    expect(c.statut).toBe('calcule');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Q — LA DATE DU RELEVÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('Q · la date des valeurs marchandes', () => {
  it('est conservée et dite, jamais transformée en « valeur d’aujourd’hui »', () => {
    const p = dossierPropre((x) => {
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)], 'FICT-1', '2026-06-30')];
      x.consolidation.comptesExternes = 'oui';        // pour obtenir la phrase dégradée
    });
    const completude = verifierCompletudeCristallisationGains(p, {
      pertesReporteesUtilisees: null, pertesCourantesAValider: false,
    });
    expect(completude.dateReleve).toBe('2026-06-30');
    expect(plat(gains(p).explication)).toMatch(/relevé du 2026-06-30/);
  });

  it('AUCUN seuil de fraîcheur n’est inventé : une date ancienne ne bloque pas à elle seule', () => {
    const c = gains(dossierPropre((x) => {
      x.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)], 'FICT-1', '2019-01-31')];
    }));
    expect(c.statut).toBe('calcule');       // vieux n'est pas invalide
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// R — LES POSITIONS AVEUGLES
// ═══════════════════════════════════════════════════════════════════════════

describe('R · une position matériellement incomplète', () => {
  const aveugles: Array<[string, Position]> = [
    ['sans PBR', position('SANSPBR', 50000, null)],
    ['sans valeur marchande', position('SANSVM', null, 10000)],
    ['dont l’unité des valeurs n’est pas établie',
      { ...position('MYSTERE', 50000, 10000), uniteValeursRapport: 'inconnue' as const }],
  ];

  for (const [quoi, pos] of aveugles) {
    it(`${quoi} : absente du plan ferme, conservée dans les diagnostics, avec sa raison`, () => {
      const p = dossierPropre((x) => {
        x.comptes = [compte('non-enregistre', [position('BONNE', 50000, 10000), pos])];
      });
      const completude = verifierCompletudeCristallisationGains(p, {
        pertesReporteesUtilisees: null, pertesCourantesAValider: false,
      });

      // CONSERVÉE : elle figure dans les qualités, avec son motif.
      const q = completude.qualites.find((x) => x.position.symbole === pos.symbole);
      expect(q, quoi).toBeDefined();
      expect(q!.raisons.length, quoi).toBeGreaterThan(0);
      // ÉCARTÉE : ni candidate au sens de la complétude…
      expect(completude.candidatesFiables.map((x) => x.position.symbole)).not.toContain(pos.symbole);
      // …ni NOMMÉE au client. ⚠ On regarde `candidats` et pas seulement `plan` :
      // le plan est absent de tout statut dégradé, si bien que l'assertion sur
      // le plan seul passait même en cassant l'exclusion (sabotage U du
      // 21 août). Les candidats, eux, sont émis dégradés comme calculés.
      const c = gains(p);
      expect(JSON.stringify(c.plan ?? []), quoi).not.toMatch(pos.symbole);
      expect(JSON.stringify(c.candidats ?? []), quoi).not.toMatch(pos.symbole);
      // Et la position lisible, elle, est bien nommée — sinon « rien n'est
      // jamais nommé » passerait ce test.
      expect(JSON.stringify(c.candidats ?? []), quoi).toMatch('BONNE');
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// S — L'INVARIANT ARCHITECTURAL : une inconnue ailleurs ne bloque pas ici
// ═══════════════════════════════════════════════════════════════════════════

describe('S · une ambiguïté CELI totalement étrangère à cette stratégie', () => {
  it('laisse le constat EXACTEMENT identique — inconnue quelque part ≠ blocage partout', () => {
    const sans = gains(dossierPropre());
    const avec = gains(dossierPropre((p) => {
      // Un CELI plein d'ambiguïtés, et un historique CELI inconnu par-dessus.
      p.comptes = [
        ...p.comptes,
        compte('celi', [position('ABRITE', 90000, null)], 'FICT-W'),
      ];
      p.historiqueVie.celi = { ...p.historiqueVie.celi, portee: 'inconnue' };
      p.cotisationsAnnee.celi = 7000;
      p.cotisationsAnnee.portee = 'inconnue';
    }));

    expect(avec.statut).toBe(sans.statut);
    expect(avec.statut).toBe('calcule');
    expect(avec.montantEstime).toBe(sans.montantEstime);
    expect(avec.donneesManquantes).toEqual(sans.donneesManquantes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// T — L'INVARIANT `calcule`, et la traçabilité du plan
// ═══════════════════════════════════════════════════════════════════════════

describe('les deux grandeurs de contexte sortent de la stratégie', () => {
  it('gains latents et pertes disponibles sont exposés, sans changer de sens', () => {
    // Le document doit pouvoir dire « voici ce qui dort au dossier » à côté de
    // « voici ce que vous pouvez récolter ». Sans ces deux champs il devrait
    // les redériver — interdit — ou s'en passer, et l'histoire devient
    // incompréhensible.
    const c = gains(dossierPropre());
    expect(c.statut).toBe('calcule');
    expect(c.gainsLatentsCad).toBe(40000);        // 50 000 − 10 000
    expect(c.pertesDisponiblesCad).toBe(10000);   // pertes NON ENREGISTRÉES de l'année
    // Le montant reste le minimum des deux — la règle n'a pas bougé.
    expect(c.montantEstime).toBe(Math.min(c.gainsLatentsCad!, c.pertesDisponiblesCad!));
  });

  it('⚠ une perte reportée d’unité inconnue N’ENTRE PAS dans les pertes disponibles', () => {
    // L'exposition ne desserre aucune admissibilité : c'est déjà la doctrine,
    // et la sortir du moteur ne doit pas la changer.
    const c = gains(dossierPropre((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE,
      };
    }));
    expect(c.pertesDisponiblesCad).toBe(10000);   // PAS 15 000
  });

  it('une reportée d’unité COMPATIBLE, elle, s’y ajoute', () => {
    const c = gains(dossierPropre((p) => {
      p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'perte-capital-brute', source: 'avis-cotisation', dateDonnee: DATE,
      };
    }));
    expect(c.pertesDisponiblesCad).toBe(15000);
  });

  it('les deux grandeurs survivent à un statut dégradé', () => {
    // C'est là qu'elles servent le plus : dire ce qui existe même quand le
    // chiffre ferme est impossible.
    const c = gains(dossierPropre((p) => { p.consolidation.comptesExternes = 'oui'; }));
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.gainsLatentsCad).toBe(40000);
    expect(c.pertesDisponiblesCad).toBe(10000);
  });
});

describe('T · le test positif final', () => {
  it('statut calculé, montant présent, aucune donnée manquante, plan entièrement traçable', () => {
    const p = dossierPropre((x) => {
      x.transactionsAnnee.pertesRealisees = 40000;
      x.transactionsAnnee.pertesRealiseesNonEnregistrees = 40000;
      x.comptes = [compte('non-enregistre', [
        position('DENSE', 20000, 4000),      // +16 000
        position('MOYEN', 30000, 18000),     // +12 000
        position('PLAT', 10000, 9000),       // +1 000
      ])];
    });
    const c = gains(p);

    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).not.toBeNull();
    expect(c.donneesManquantes).toEqual([]);

    // LE PLAN NE NOMME QUE DES POSITIONS RÉELLEMENT DÉTENUES ET QUALIFIÉES.
    const detenues = new Set(positionsNonEnregistrees(p)
      .map(qualifierPosition)
      .filter((q) => q.gainLatentCad !== null && q.gainLatentCad > 0)
      .map((q) => q.position.symbole));
    expect(c.plan!.length).toBeGreaterThan(0);
    for (const ligne of c.plan!) expect(detenues.has(ligne.symbole)).toBe(true);

    // La somme du plan tombe EXACTEMENT sur le montant annoncé — c'est ce qui
    // rend la marche à suivre vérifiable ligne à ligne.
    const somme = c.plan!.reduce((s, l) => s + l.gain, 0);
    expect(Math.round(somme * 100) / 100).toBe(c.montantEstime);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §2 — AUCUN CHIFFRE INCERTAIN PRÉSENTÉ COMME CERTAIN
// ═══════════════════════════════════════════════════════════════════════════

describe('§2 · les phrases des constats dégradés', () => {
  const degrades: Array<[string, (p: ProfilClient) => void, RegExp[]]> = [
    ['unité des valeurs non établie',
      (p) => { p.comptes = [compte('non-enregistre', [
        { ...position('MYSTERE', 15000, 10000), uniteValeursRapport: 'inconnue' }])]; },
      [/5 000/, /15 000/]],
    ['PBR absent',
      (p) => { p.comptes = [compte('non-enregistre', [position('AVEUGLE', 50000, null)])]; },
      [/50 000/]],
    ['VM absente',
      (p) => { p.comptes = [compte('non-enregistre', [
        position('BONNE', 50000, 10000), position('SANSVM', null, 10000)])]; },
      [/40 000/]],
    ['perte reportée incompatible',
      (p) => { p.droits.pertesCapitalReportees = {
        montant: 5000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE }; },
      [/5 000/, /2 500/, /15 000/]],
    ['portée externe',
      (p) => { p.consolidation.comptesExternes = 'oui'; },
      [/40 000/]],
  ];

  for (const [quoi, modif, interdits] of degrades) {
    it(`${quoi} : aucun montant fiscal présenté comme établi`, () => {
      const c = gains(dossierPropre(modif));
      expect(c.statut, quoi).not.toBe('calcule');
      expect(c.montantEstime, quoi).toBeNull();

      const texte = plat(c.explication);
      for (const interdit of interdits) {
        expect(texte, `${quoi} — « ${interdit} » ne doit pas figurer`).not.toMatch(interdit);
      }
      // Et la phrase dit ce qui manque plutôt que de laisser un blanc.
      expect(c.donneesManquantes.length, quoi).toBeGreaterThan(0);
    });
  }

  it('l’encadré du montant reste vide sur tout statut dégradé', () => {
    for (const [, modif] of degrades) {
      expect(gains(dossierPropre(modif)).montantEstime).toBeNull();
    }
  });
});
