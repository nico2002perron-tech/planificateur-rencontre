// LA MATRICE D'ACTIVATION — chaque règle fiscale s'allume-t-elle vraiment ?
//
// Demande de Nicolas (18 août 2026) : « fais le test de chaque règle de
// fiscalité, qu'elle s'active bien, et dis-moi si tout fonctionne ».
//
// Les autres tests vérifient qu'on n'invente JAMAIS un chiffre. Celui-ci
// vérifie l'inverse — que la machine ALLUME bien quand elle doit allumer. Une
// règle qui ne se déclenche jamais est aussi inutile qu'une règle qui ment, et
// rien ne le signalait : un « indisponible » a toujours l'air sage.
//
// Pour CHAQUE stratégie du catalogue, deux épreuves :
//   ALLUMÉE  un dossier construit pour la déclencher → statut « calcule », un
//            montant, et le libellé qui dit ce que ce montant EST ;
//   ÉTEINTE  le même dossier privé de son ingrédient → plus de montant.
//
// Dossiers fictifs, aucune donnée réelle.

import { describe, it, expect } from 'vitest';
import { analyser, type PortefeuilleCible } from '../strategies';
import { profilVierge, type ProfilClient, type Compte, type Position } from '../types';
import type { SignauxLivre } from '../signaux-livre';

const DATE = '2026-08-18';
const PARAM_REEE = { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 };

const position = (symbole: string, vm: number, pbr: number): Position => ({
  symbole, devise: 'CAD', categorie: null,
  valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
});

const compte = (type: Compte['type'], positions: Position[]): Compte => ({
  numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve',
  derniereActivite: null, dernierSolde: null, candidats: ['37-FICT-A'],
  type, titulaire: 'client', dateReleve: DATE, positions, encaisse: [],
});

/** Un dossier consolidé : le client a confirmé n'avoir aucun compte ailleurs. */
function base(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  modif(p);
  return p;
}

/** Les signaux du livre, tels que `signauxDuLivre` les rend quand tout est là. */
const signauxComplets: SignauxLivre = {
  droitsCeli: {
    statut: 'calcule', portee: 'complete', montant: 21500, borne: 21500,
    conditionsManquantes: [], transfertsATrancher: 0,
  },
  maximisation: null,
  plafondParDefautMaximal: false,
};

const CIBLE: PortefeuilleCible = { positions: [{ symbole: 'AAA', poidsCible: 0 }] };

function constat(
  p: ProfilClient, strategie: string,
  opts: { cible?: PortefeuilleCible | null; signaux?: SignauxLivre | null } = {}
) {
  const r = analyser(p, opts.cible ?? null, DATE, PARAM_REEE, opts.signaux ?? null);
  return r.constats.find((c) => c.strategie === strategie)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// LES HUIT RÈGLES, une par une
// ─────────────────────────────────────────────────────────────────────────────

describe('1. Cristallisation de pertes', () => {
  const dossier = () => base((p) => {
    p.comptes = [compte('non-enregistre', [position('PERDANT', 8000, 20000)])];
    p.transactionsAnnee = {
      gainsRealises: 12000, pertesRealisees: 0,
      // L'ASSIETTE FISCALE (20 août 2026) : ces fixtures décrivent un gain en
      // compte NON ENREGISTRÉ — c'est elle que les cristallisations lisent.
      gainsRealisesNonEnregistres: 12000, pertesRealiseesNonEnregistrees: 0,
      dispositionsRegimeIndetermine: { nombre: 0, gains: 0, pertes: 0 },
      pertesCourantesAValiderPerteApparente: false,
      retraitsReer: 0, retraitsCeli: 0, portee: 'complete',
    };
  });

  it('S ALLUME : perte latente + gain deja realise', () => {
    const c = constat(dossier(), 'cristallisation-pertes');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(12000);            // plafonné au gain réalisé
    expect(c.libelleMontant).toMatch(/perte/i);
    expect(c.echeance).toMatch(/31 d/);             // l'échéance de fin d'année est dite
  });

  it('S ETEINT : aucun gain realise a absorber', () => {
    const p = dossier();
    p.transactionsAnnee.gainsRealises = 0;
    p.transactionsAnnee.gainsRealisesNonEnregistres = 0;
    const c = constat(p, 'cristallisation-pertes');
    expect(c.montantEstime).toBeNull();
    expect(c.dejaEnOrdre).toBe(true);
  });
});

describe('2. Cristallisation de gains', () => {
  const dossier = () => base((p) => {
    p.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 20000)])];
    p.transactionsAnnee.pertesRealisees = 20000;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 20000;
  });

  it('S ALLUME : gain latent + pertes COURANTES non enregistrées, avec un PLAN de recolte', () => {
    // ⚠ LES PERTES COURANTES, PAS LES REPORTÉES — changé le 20 août 2026. Une
    // perte de l'année vient de Croesus en montant BRUT : son unité est connue.
    // Le champ saisi des pertes reportées, lui, ne dit pas la sienne, et ne
    // peut donc plus fonder un chiffre ferme (voir son test dédié).
    const c = constat(dossier(), 'cristallisation-gains');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(20000);            // plafonné aux pertes disponibles
    expect(c.plan).toBeDefined();
    expect(c.plan!.length).toBeGreaterThan(0);
    // La somme du plan vaut EXACTEMENT la cible — c'est ce qui rend le plan sûr.
    expect(c.plan!.reduce((s, l) => s + l.gain, 0)).toBe(c.montantEstime);
  });

  it('S ETEINT : aucune perte disponible', () => {
    const p = dossier();
    p.droits.pertesCapitalReportees = { montant: 0, dateDonnee: DATE };
    p.transactionsAnnee.pertesRealisees = 0;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 0;
    const c = constat(p, 'cristallisation-gains');
    expect(c.montantEstime).toBeNull();
    expect(c.plan).toBeUndefined();
  });
});

describe('3. Droits de cotisation inutilises', () => {
  it('S ALLUME : les trois conditions du CELI reunies', () => {
    const c = constat(base(), 'droits-cotisation', { signaux: signauxComplets });
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(21500);
    expect(c.explication).toMatch(/Mon dossier ARC/);   // le disclaimer est là
  });

  it('S ETEINT : sans historique importe, rien n est calculable', () => {
    const c = constat(base(), 'droits-cotisation', { signaux: null });
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
  });

  it('DEMANDE l annee de naissance quand elle change le chiffre', () => {
    const c = constat(base(), 'droits-cotisation', {
      signaux: { ...signauxComplets, plafondParDefautMaximal: true },
    });
    expect(c.donneesManquantes.join(' ')).toMatch(/ann/);
  });
});

describe('4. Localisation d actifs', () => {
  it('RESTE BLOQUEE, et le dit — le registre d instruments n est pas branche', () => {
    const p = base((x) => {
      x.comptes = [compte('non-enregistre', [position('AAA', 50000, 20000)])];
      x.revenus = { trancheRevenu: '150-200k', source: 'declare', dateDonnee: DATE };
    });
    const c = constat(p, 'localisation-actifs');
    expect(c.statut).toBe('indisponible');
    expect(c.montantEstime).toBeNull();
    expect(c.explication).toMatch(/registre d/);
  });
});

describe('5. CELI du conjoint', () => {
  const dossier = () => base((p) => {
    p.demographie.etatCivil = 'marie';
    p.demographie.conjoint = { age: 55, trancheRevenu: '50-100k' };
    p.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
  });

  it('S ALLUME : conjoint connu + droits au dossier', () => {
    const c = constat(dossier(), 'celi-conjoint');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(48000);
    expect(c.recurrence).toBe('unique');            // un cumul, pas un montant annuel
  });

  it('S ETEINT : le CELI du conjoint est plein', () => {
    const p = dossier();
    p.droits.celiConjointInutilises = { montant: 0, dateDonnee: DATE };
    const c = constat(p, 'celi-conjoint');
    expect(c.statut).toBe('non-applicable');
    expect(c.montantEstime).toBeNull();
    expect(c.explication).toMatch(/1 %/);            // la pénalité est rappelée
  });

  it('S ETEINT : client celibataire', () => {
    const p = dossier();
    p.demographie.etatCivil = 'celibataire';
    expect(constat(p, 'celi-conjoint').montantEstime).toBeNull();
  });
});

describe('6. Don de titres a gain latent', () => {
  const dossier = () => base((p) => {
    p.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 20000)])];
    p.intentions.donsAnnuelsMoyens = 5000;
  });

  it('S ALLUME : le client donne + un titre porte un gain', () => {
    const c = constat(dossier(), 'don-titres');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBeGreaterThan(0);
    expect(c.explication).toMatch(/GAGNANT/);        // le titre choisi est nommé
  });

  it('S ETEINT : le client ne fait pas de dons', () => {
    const p = dossier();
    p.intentions.donsAnnuelsMoyens = 0;
    const c = constat(p, 'don-titres');
    expect(c.statut).toBe('non-applicable');
    expect(c.montantEstime).toBeNull();
  });
});

describe('7. Subvention REEE (SCEE 20 % + IQEE 10 %)', () => {
  const dossier = () => base((p) => {
    p.demographie.enfants = [{ prenom: 'Laurie', age: 8 }];
    p.cotisationsAnnee = { reer: 0, celi: 0, reeeParEnfant: {}, portee: 'complete' };
  });

  it('S ALLUME : un enfant beneficiaire, rien cotise cette annee', () => {
    const c = constat(dossier(), 'subvention-reee');
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(750);              // 2 500 × 30 %
    expect(c.recurrence).toBe('annuel');
  });

  it('S ETEINT : le plafond subventionne est deja atteint', () => {
    const p = dossier();
    p.cotisationsAnnee.reeeParEnfant = { LAURIE: 2500 };
    const c = constat(p, 'subvention-reee');
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(true);
  });

  it('S ETEINT : aucun enfant au dossier', () => {
    expect(constat(base(), 'subvention-reee').montantEstime).toBeNull();
  });
});

describe('8. Ordre de vente vers le portefeuille cible', () => {
  const dossier = () => base((p) => {
    p.comptes = [compte('non-enregistre', [
      position('AAA', 50000, 20000),
      position('BBB', 8000, 20000),
    ])];
  });

  it('S ALLUME : un portefeuille cible est fourni', () => {
    const c = constat(dossier(), 'ordre-vente', { cible: CIBLE });
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).not.toBeNull();
  });

  it('S ETEINT : sans cible, il n y a rien a ordonner', () => {
    const c = constat(dossier(), 'ordre-vente', { cible: null });
    expect(c.statut).toBe('non-applicable');
    expect(c.montantEstime).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LE BALAYAGE : les huit, éprouvées ENSEMBLE sur un seul dossier
// ─────────────────────────────────────────────────────────────────────────────

describe('LE DOSSIER COMPLET — combien de regles s allument a la fois ?', () => {
  const dossierComplet = () => base((p) => {
    p.demographie.etatCivil = 'marie';
    p.demographie.conjoint = { age: 55, trancheRevenu: '50-100k' };
    p.demographie.enfants = [{ prenom: 'Laurie', age: 8 }];
    p.demographie.anneeNaissance = 1985;
    p.revenus = { trancheRevenu: '150-200k', source: 'declare', dateDonnee: DATE };
    p.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
    p.transactionsAnnee.pertesRealisees = 20000;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 20000;
    p.intentions.donsAnnuelsMoyens = 5000;
    p.cotisationsAnnee = { reer: 0, celi: 0, reeeParEnfant: {}, portee: 'complete' };
    p.transactionsAnnee = {
      gainsRealises: 12000, pertesRealisees: 0,
      // L'ASSIETTE FISCALE (20 août 2026) : ces fixtures décrivent un gain en
      // compte NON ENREGISTRÉ — c'est elle que les cristallisations lisent.
      gainsRealisesNonEnregistres: 12000, pertesRealiseesNonEnregistrees: 0,
      dispositionsRegimeIndetermine: { nombre: 0, gains: 0, pertes: 0 },
      pertesCourantesAValiderPerteApparente: false,
      retraitsReer: 0, retraitsCeli: 0, portee: 'complete',
    };
    p.comptes = [compte('non-enregistre', [
      position('GAGNANT', 50000, 20000),
      position('PERDANT', 8000, 20000),
    ])];
  });

  it('SEPT des huit s allument ; seule la localisation reste bloquee', () => {
    const r = analyser(dossierComplet(), CIBLE, DATE, PARAM_REEE, signauxComplets);
    const chiffrees = r.constats.filter((c) => c.statut === 'calcule').map((c) => c.strategie).sort();
    // ⚠ SIX, PAS SEPT, DEPUIS LE 20 AOÛT 2026. La cristallisation de GAINS ne
    // s'allume plus dans ce dossier, et c'est correct : ses pertes disponibles
    // venaient du champ « pertes en capital reportées », dont l'unité n'est pas
    // établie (perte brute ou perte nette de l'avis ?). Et elle ne peut pas
    // s'allumer via les pertes de l'année ici, puisque ce dossier porte un GAIN
    // net réalisé — c'est ce qui allume sa jumelle, la cristallisation de
    // pertes. Les deux faces du même signe ne s'allument jamais ensemble.
    expect(chiffrees).toEqual([
      'celi-conjoint', 'cristallisation-pertes',
      'don-titres', 'droits-cotisation', 'ordre-vente', 'subvention-reee',
    ]);
    const gains = r.constats.find((c) => c.strategie === 'cristallisation-gains')!;
    expect(gains.statut).toBe('indisponible');
    expect(gains.montantEstime).toBeNull();
    expect(gains.donneesManquantes.join(' ')).toMatch(/pertes en capital reportées/);
    // La huitième est bloquée POUR UNE RAISON DITE, pas par oubli.
    const bloquee = r.constats.find((c) => c.strategie === 'localisation-actifs')!;
    expect(bloquee.statut).toBe('indisponible');
    expect(bloquee.donneesManquantes.length).toBeGreaterThan(0);
  });

  it('CHAQUE montant dit sa nature — ils ne s additionnent pas', () => {
    const r = analyser(dossierComplet(), CIBLE, DATE, PARAM_REEE, signauxComplets);
    const natures = r.constats
      .filter((c) => c.statut === 'calcule')
      .map((c) => c.libelleMontant);
    expect(natures.every((n) => n.trim().length > 0)).toBe(true);
    // Des natures distinctes : c'est ce qui interdit un total.
    expect(new Set(natures).size).toBeGreaterThan(1);
  });
});
