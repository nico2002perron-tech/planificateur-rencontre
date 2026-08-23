// PARTICULIER OU ENTREPRISE — la bifurcation, et ce qu'elle protège.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CES TESTS TIENNENT.
//
// 1. Le défaut est `particulier` : un dossier existant ne change pas de
//    comportement du jour où le champ apparaît.
// 2. Le type est DÉCLARÉ. Aucun test ne le déduit d'un nom ni d'un compte —
//    et un test vérifie explicitement qu'un nom de société ne suffit pas.
// 3. Sous `entreprise`, une stratégie de particulier ne rend AUCUN engagement :
//    ni montant, ni plan, ni quantité, ni échéance.
// 4. Elle ne DISPARAÎT pas non plus : elle sort `non-applicable` avec son motif.
// 5. La matrice couvre TOUT le catalogue — une stratégie ajoutée sans qu'on se
//    pose la question fait rougir la suite.
//
// Dossiers fictifs.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { analyser } from '../strategies';
import {
  strategieApplicableA, STRATEGIES_QUALIFIEES, RAISON_TITULAIRE_ENTREPRISE,
} from '../applicabilite-titulaire';
import {
  profilVierge, typeTitulaireDe, type ProfilClient, type Compte, type Position,
} from '../types';
import type { SignauxLivre } from '../signaux-livre';

const DATE = '2026-08-23';
const PARAM_REEE = { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 };

const position = (symbole: string, vm: number, pbr: number): Position => ({
  symbole, devise: 'CAD', categorie: null, uniteValeursRapport: 'CAD',
  quantite: 100, typeInstrument: 'Action',
  valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
});

const compte = (type: Compte['type'], positions: Position[]): Compte => ({
  numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve',
  derniereActivite: null, dernierSolde: null, candidats: ['37-FICT-A'],
  type, titulaire: 'client', dateReleve: DATE, positions, encaisse: [],
});

/** Un dossier où plusieurs stratégies ont de quoi s'allumer. */
function dossier(m: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.demographie.province = 'QC';
  p.demographie.etatCivil = 'marie';
  p.revenus.trancheRevenu = '100-150k';
  p.revenus.dateDonnee = DATE;
  p.droits.celiInutilises = { montant: 21_500, dateDonnee: DATE };
  p.droits.celiConjointInutilises = { montant: 12_000, dateDonnee: DATE };
  p.comptes = [compte('non-enregistre', [position('GAGNANT', 50_000, 20_000)])];
  p.transactionsAnnee.pertesRealisees = 20_000;
  p.transactionsAnnee.pertesRealiseesNonEnregistrees = 20_000;
  m(p);
  return p;
}

/**
 * ⚠ LES SIGNAUX DU LIVRE SONT FOURNIS, ET C'EST NÉCESSAIRE. Sans eux,
 * `droits-cotisation` sort déjà sans montant — la neutralisation par le type
 * d'entité devenait alors invisible, et le sabotage « laisser passer le
 * montant » restait VERT. Un test qui ne peut pas voir la garde ne la tient pas.
 */
const SIGNAUX: SignauxLivre = {
  droitsCeli: {
    statut: 'calcule', portee: 'complete', montant: 21_500, borne: 21_500,
    conditionsManquantes: [], transfertsATrancher: 0,
  },
  maximisation: null,
  plafondParDefautMaximal: false,
};

const constats = (p: ProfilClient) =>
  analyser(p, null, DATE, PARAM_REEE, SIGNAUX).constats;
const trouver = (p: ProfilClient, cle: string) =>
  constats(p).find((c) => c.strategie === cle)!;

// ═══════════════════════════════════════════════════════════════════════════
// TT1 — LE DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════

describe('TT1 · un nouveau profil est un dossier de particulier', () => {
  it('`profilVierge` déclare `particulier`', () => {
    expect(profilVierge('x', DATE).typeTitulaire).toBe('particulier');
  });

  it('et un profil ANTÉRIEUR au champ répond `particulier`, pas `undefined`', () => {
    // ⚠ LE CAS RÉEL : onze profils sont déjà sur le disque, écrits avant ce
    // champ. Le défaut sûr est celui qui ne change rien pour eux.
    const ancien = profilVierge('x', DATE);
    delete (ancien as { typeTitulaire?: unknown }).typeTitulaire;
    expect(typeTitulaireDe(ancien)).toBe('particulier');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TT2 — RIEN N'EST DEVINÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('TT2 · le type est déclaré, jamais déduit', () => {
  it('aucun mot de raison sociale n’apparaît dans le module d’applicabilité', () => {
    // ⚠ SE TROMPER D'ENTITÉ FISCALE N'EST PAS UNE IMPRÉCISION : c'est
    // recommander à un contribuable les stratégies d'un autre.
    const fs = require('node:fs') as typeof import('node:fs');
    const source = fs.readFileSync('src/lib/profils/applicabilite-titulaire.ts', 'utf8')
      // On lit le CODE, pas les commentaires qui expliquent le refus.
      .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    for (const indice of ['INC', 'LTÉE', 'LTEE', 'Gestion', 'Holding', 'nom', 'suffixe']) {
      expect(source, indice).not.toMatch(new RegExp(indice, 'i'));
    }
  });

  it('le suffixe d’un compte ne rend pas un dossier « entreprise »', () => {
    const p = dossier((x) => {
      x.comptes = [{ ...compte('non-enregistre', [position('G', 50_000, 20_000)]),
        numero: '37-GESTION-E', suffixe: 'E' }];
    });
    expect(typeTitulaireDe(p)).toBe('particulier');
    expect(trouver(p, 'droits-cotisation').statut).not.toBe('non-applicable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TT3 — LA MATRICE COUVRE TOUT LE CATALOGUE
// ═══════════════════════════════════════════════════════════════════════════

describe('TT3 · aucune stratégie n’échappe à la question', () => {
  it('chaque stratégie produite par le moteur est qualifiée', () => {
    // ⚠ SANS CE TEST, UNE STRATÉGIE AJOUTÉE PLUS TARD passerait au travers :
    // `strategieApplicableA` rend `true` par défaut, pour qu'un oubli ne la
    // fasse pas DISPARAÎTRE d'un dossier d'entreprise. C'est donc ici que
    // l'oubli doit se voir — au développement, pas en rencontre.
    const produites = constats(dossier()).map((c) => c.strategie);
    for (const s of produites) {
      expect(STRATEGIES_QUALIFIEES, `${s} n’est pas dans la matrice`).toContain(s);
    }
    expect(produites.length).toBeGreaterThanOrEqual(8);
  });

  it('un particulier n’est jamais bloqué, quelle que soit la stratégie', () => {
    for (const s of STRATEGIES_QUALIFIEES) {
      expect(strategieApplicableA(s, 'particulier'), s).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TT4 — SOUS `entreprise`, AUCUN ENGAGEMENT PERSONNEL
// ═══════════════════════════════════════════════════════════════════════════

describe('TT4 · une stratégie de particulier ne s’applique pas à une société', () => {
  const PERSONNELLES = [
    'droits-cotisation', 'celi-conjoint', 'subvention-reee', 'localisation-actifs',
  ];

  for (const cle of PERSONNELLES) {
    it(`${cle} : non-applicable, sans montant ni plan`, () => {
      const c = trouver(dossier((p) => { p.typeTitulaire = 'entreprise'; }), cle);
      expect(c.statut).toBe('non-applicable');
      expect(c.montantEstime).toBeNull();
      expect(c.plan).toBeUndefined();
      expect(c.planExecution).toBeUndefined();
      expect(c.candidats).toBeUndefined();
      expect(c.echeance).toBeUndefined();
      expect(c.dejaEnOrdre).toBe(false);
      expect(c.donneesManquantes).toContain(RAISON_TITULAIRE_ENTREPRISE);
    });
  }

  it('la stratégie ne DISPARAÎT pas : elle se nomme et dit pourquoi', () => {
    // ⚠ ESCAMOTER UNE PISTE QUE LE PLANIFICATEUR S'ATTEND À VOIR serait pire
    // qu'un « non applicable » : il croirait qu'elle a été oubliée.
    const r = constats(dossier((p) => { p.typeTitulaire = 'entreprise'; }));
    const celi = r.find((c) => c.strategie === 'droits-cotisation');
    expect(celi).toBeDefined();
    expect(celi!.titreClient.length).toBeGreaterThan(3);
    expect(celi!.explication).toMatch(/dossier d’entreprise/);
  });

  it('aucun montant CELI ne survit nulle part dans le constat', () => {
    const c = trouver(dossier((p) => { p.typeTitulaire = 'entreprise'; }), 'droits-cotisation');
    expect(JSON.stringify(c)).not.toMatch(/21\s*500|21500/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TT5 — CE QUI RESTE APPLICABLE, ET LE RETOUR EN ARRIÈRE
// ═══════════════════════════════════════════════════════════════════════════

describe('TT5 · la bifurcation ne bloque que ce qu’elle doit bloquer', () => {
  it('les stratégies de capital restent actives pour une société', () => {
    // Un gain et une perte en capital existent aussi dans une société. Ce lot
    // pose la bifurcation ; il ne prétend pas savoir ce qu'elle devrait faire.
    const c = trouver(dossier((p) => { p.typeTitulaire = 'entreprise'; }), 'cristallisation-gains');
    expect(c.statut).not.toBe('non-applicable');
    expect(c.donneesManquantes).not.toContain(RAISON_TITULAIRE_ENTREPRISE);
  });

  it('particulier : le comportement existant est inchangé', () => {
    const p = trouver(dossier(), 'droits-cotisation');
    const e = trouver(dossier((x) => { x.typeTitulaire = 'particulier'; }), 'droits-cotisation');
    expect(e.statut).toBe(p.statut);
    expect(e.montantEstime).toBe(p.montantEstime);
  });

  it('revenir à particulier réactive les stratégies personnelles', () => {
    const p = dossier((x) => { x.typeTitulaire = 'entreprise'; });
    expect(trouver(p, 'celi-conjoint').statut).toBe('non-applicable');
    p.typeTitulaire = 'particulier';
    const apres = trouver(p, 'celi-conjoint');
    expect(apres.statut).not.toBe('non-applicable');
    expect(apres.donneesManquantes).not.toContain(RAISON_TITULAIRE_ENTREPRISE);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TT6 — LA VALEUR SURVIT À L'ENREGISTREMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('TT6 · sauvegarde et rechargement', () => {
  it('le type déclaré survit à l’aller-retour JSON du stockage', () => {
    // Le stockage écrit et relit du JSON : c'est exactement ce qu'on éprouve
    // ici, sans toucher au disque réel du planificateur.
    for (const type of ['particulier', 'entreprise'] as const) {
      const avant = dossier((p) => { p.typeTitulaire = type; });
      const apres = JSON.parse(JSON.stringify(avant)) as ProfilClient;
      expect(apres.typeTitulaire, type).toBe(type);
      expect(typeTitulaireDe(apres), type).toBe(type);
      // Et le moteur lit la même chose après rechargement qu'avant.
      expect(trouver(apres, 'droits-cotisation').statut)
        .toBe(trouver(avant, 'droits-cotisation').statut);
    }
  });

  it('la route de fiche n’accepte que les deux valeurs du type', () => {
    // ⚠ AUCUNE DÉDUCTION NI VALEUR LIBRE : une chaîne inattendue est refusée
    // plutôt que rangée telle quelle dans le profil.
    const source = (require('node:fs') as typeof import('node:fs'))
      .readFileSync('src/app/api/base-locale/fiche/route.ts', 'utf8');
    expect(source).toContain("v === 'entreprise' || v === 'particulier'");
    expect(source).toContain("refus.push('typeTitulaire')");
  });
});
