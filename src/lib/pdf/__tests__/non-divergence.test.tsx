// LA BATTERIE « ND » — LA SYNTHÈSE ET LE DÉTAIL NE RACONTENT QU'UN SEUL PLAN.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CETTE BATTERIE N'EXISTAIT PAS, ET POURQUOI ELLE DOIT EXISTER.
//
// Le 23 août 2026, une mesure sur un dossier réel a montré que deux moteurs
// répondaient à « combien vendre » et se contredisaient : la synthèse pouvait
// nommer un titre, la page détaillée un autre ; l'une un montant, l'autre un
// autre ; l'une un plan, l'autre rien. Le plan canonique a supprimé la cause.
//
// ⚠ MAIS RIEN NE L'INTERDISAIT DE REVENIR. La non-divergence reposait sur une
// LECTURE DU CODE — « `plan` dérive de `planExecution` » — et sur un document
// de mesure. Aucun test. Un futur lot qui rebrancherait un calcul local dans
// une couche de rendu passerait tous les verts du dépôt.
//
// Ce fichier est ce verrou. Il part d'un PROFIL, traverse `analyser()`, le
// registre visuel et le document de production — le même chemin que la route.
//
// Données entièrement fictives : voir `__fixtures__/dossiers-document.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import {
  analyser, selonLeTitulaire, type Constat, type ResultatAnalyse,
} from '@/lib/profils/strategies';
import { montantAffichable, modeTableau } from '../rendu-constat';
import {
  STRATEGIES_VISUELLES, CLES_STRATEGIES_VISUELLES, aUnePageDetaillee,
  type CleStrategieVisuelle,
} from '../strategies-visuelles';
import { OptimisationsFiscalesDocument } from '../optimisations-fiscales-document';
import { OptimisationsFiscalesPage } from '../optimisations-fiscales-page';
import { LIBELLE_PIED_FISCAL, LIBELLE_PIED_FISCAL_TRAVAIL } from '../langage-fiscal';
import {
  DOSSIER_PERTES_MONO, DOSSIER_PERTES_MULTI, DOSSIER_GAINS, DOSSIER_COMPLET,
  DOSSIER_A_CONFIRMER, DOSSIER_ENTREPRISE, DATE_DOSSIER, REEE_TEST,
} from '../__fixtures__/dossiers-document';
import { textesDe } from './_texte-rendu';
import type { ProfilClient } from '@/lib/profils/types';

const analyse = (p: ProfilClient): ResultatAnalyse =>
  analyser(p, null, DATE_DOSSIER, REEE_TEST);

const constat = (r: ResultatAnalyse, s: string): Constat =>
  r.constats.find((c) => c.strategie === s)!;

const platDe = (n: unknown) => textesDe(n).join('').replace(/[\s   ]+/g, ' ');

/** Le document tel que la route le produit — couverture, synthèse, stratégies. */
const documentDe = (r: ResultatAnalyse) => React.createElement(OptimisationsFiscalesDocument, {
  donnees: { resultat: r, nomClient: 'Dossier Fictif', preset: 'complet' as const },
});

/** La carte de synthèse seule, sans les pages de stratégie. */
const syntheseDe = (r: ResultatAnalyse) =>
  React.createElement(OptimisationsFiscalesPage, { resultat: r });

// ═══════════════════════════════════════════════════════════════════════════
// ND1 · `plan` N'EST QU'UNE ADAPTATION DE `planExecution`
// ═══════════════════════════════════════════════════════════════════════════
//
// `plan` survit parce que trois consommateurs le lisent : la route y prend les
// symboles pour charger les logos, et `reformuler` s'en sert pour masquer les
// titres à l'aller puis vérifier au retour que le modèle n'en a pas inventé.
// Il doit donc rester une COPIE, jamais un second calcul.

describe('ND1 · un seul moteur de quantité, deux formes', () => {
  const cas: Array<[string, () => ProfilClient, string]> = [
    ['pertes mono', DOSSIER_PERTES_MONO, 'cristallisation-pertes'],
    ['pertes multi', DOSSIER_PERTES_MULTI, 'cristallisation-pertes'],
    ['gains mono', DOSSIER_GAINS, 'cristallisation-gains'],
  ];

  for (const [nom, dossier, strategie] of cas) {
    it(`${nom} · \`plan\` porte les mêmes titres, dans le même ordre`, () => {
      const c = constat(analyse(dossier()), strategie);
      expect(c.statut).toBe('calcule');
      const pe = c.planExecution!;
      expect(pe).toBeDefined();
      expect(c.plan).toBeDefined();

      // Même nombre de lignes, mêmes symboles, MÊME ORDRE.
      expect(c.plan!.length).toBe(pe.lignes.length);
      expect(c.plan!.map((l) => l.symbole)).toEqual(pe.lignes.map((l) => l.symbole));

      // Et les mêmes montants, à l'arrondi de présentation près.
      for (let i = 0; i < pe.lignes.length; i++) {
        expect(c.plan![i].vendre).toBe(Math.round(pe.lignes[i].valeurVenteEstimeeCad));
        expect(Math.abs(c.plan![i].gain)).toBeCloseTo(pe.lignes[i].montantRealiseEstimeCad, 2);
        // « en partie » se lit sur la QUANTITÉ, plus sur une division de dollars.
        expect(c.plan![i].partiel)
          .toBe(pe.lignes[i].quantiteAVendre < pe.lignes[i].quantiteDetenue);
      }
    });
  }

  it('la fixture multi exerce bien une vente PARTIELLE — sinon ND1 est creux', () => {
    // ⚠ SANS CETTE VÉRIFICATION, `partiel` pourrait être faux partout et
    // l'assertion ci-dessus passerait sans rien prouver.
    const pe = constat(analyse(DOSSIER_PERTES_MULTI()), 'cristallisation-pertes').planExecution!;
    expect(pe.lignes.length).toBe(2);
    expect(pe.lignes.some((l) => l.quantiteAVendre < l.quantiteDetenue)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND2 · LA PRÉSENTATION PORTE LE PLAN, LIGNE PAR LIGNE, CHAMP PAR CHAMP
// ═══════════════════════════════════════════════════════════════════════════

describe('ND2 · du constat à la page, aucune ligne ne se perd ni ne se modifie', () => {
  const cas: Array<[string, () => ProfilClient, CleStrategieVisuelle]> = [
    ['pertes mono', DOSSIER_PERTES_MONO, 'cristallisation-pertes'],
    ['pertes multi', DOSSIER_PERTES_MULTI, 'cristallisation-pertes'],
    ['gains mono', DOSSIER_GAINS, 'cristallisation-gains'],
  ];

  for (const [nom, dossier, cle] of cas) {
    it(`${nom} · les lignes de la présentation SONT celles du plan`, () => {
      const c = constat(analyse(dossier()), cle);
      const pe = c.planExecution!;
      // ⚠ ON PASSE PAR LE REGISTRE, pas par le constructeur en direct : c'est
      // le registre que le document consulte, et c'est donc lui qui peut
      // diverger.
      const p = STRATEGIES_VISUELLES[cle].construire(c) as {
        etape3: { action: { type: string; lignes?: typeof pe.lignes } };
      };
      const action = cle === 'cristallisation-pertes'
        ? (p as unknown as { etape3: { action: Record<string, unknown> } }).etape3.action
        : (p as unknown as { etape3: { action: Record<string, unknown> } }).etape3.action;

      expect(action.type).toBe('ferme');
      const lignes = action.lignes as typeof pe.lignes;
      expect(lignes.length).toBe(pe.lignes.length);

      for (let i = 0; i < pe.lignes.length; i++) {
        for (const champ of [
          'symbole', 'quantiteAVendre', 'uniteQuantite',
          'valeurVenteEstimeeCad', 'montantRealiseEstimeCad', 'devise',
        ] as const) {
          expect(lignes[i][champ], `${nom} ligne ${i} · ${champ}`).toEqual(pe.lignes[i][champ]);
        }
      }

      // Et les agrégats — cible, écart, cible restante — viennent du plan.
      const cible = cle === 'cristallisation-pertes'
        ? (action as Record<string, unknown>).cibleGlobaleCad
        : (action as Record<string, unknown>).cibleGainCad;
      expect(cible).toBe(pe.cibleCad);
      expect((action as Record<string, unknown>).ecartCad).toBe(pe.ecartCad);
      expect((action as Record<string, unknown>).cibleRestanteCad).toBe(pe.cibleRestanteCad);
    });
  }

  it('le statut du constat est celui de la présentation', () => {
    for (const dossier of [DOSSIER_COMPLET, DOSSIER_A_CONFIRMER, DOSSIER_ENTREPRISE]) {
      const r = analyse(dossier());
      for (const cle of CLES_STRATEGIES_VISUELLES) {
        const c = constat(r, cle);
        const p = STRATEGIES_VISUELLES[cle].construire(c) as { statut: string };
        expect(p.statut, `${cle}`).toBe(c.statut);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND3 · LE CHIFFRE DE LA SYNTHÈSE EST LA CIBLE DU DÉTAIL
// ═══════════════════════════════════════════════════════════════════════════

describe('ND3 · un seul montant pour une stratégie', () => {
  it('le chiffre-titre de la carte est la cible du plan', () => {
    for (const dossier of [DOSSIER_PERTES_MONO, DOSSIER_PERTES_MULTI, DOSSIER_GAINS]) {
      const r = analyse(dossier());
      for (const cle of CLES_STRATEGIES_VISUELLES) {
        const c = constat(r, cle);
        if (c.statut !== 'calcule') continue;
        // ⚠ `montantAffichable` EST LA PORTE UNIQUE du chiffre de la synthèse.
        expect(montantAffichable(c), `${cle}`).toBe(c.planExecution!.cibleCad);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND4 · LE DOCUMENT NE PORTE PAS DEUX RECOMMANDATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe('ND4 · le tableau d’ordres a quitté la synthèse, pas le document', () => {
  it('la carte d’une stratégie à page dédiée ne porte plus de tableau d’ordres', () => {
    const r = analyse(DOSSIER_COMPLET());
    const texte = platDe(syntheseDe(r));
    // Le régime « plan » du tableau se reconnaît à son en-tête de colonne.
    expect(texte).not.toContain('Vendre (environ)');
    // Mais la carte ne se tait pas : elle renvoie à la page qui le porte.
    expect(texte).toContain('Le détail');
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      expect(texte).toContain(STRATEGIES_VISUELLES[cle].entete.titre);
    }
  });

  it('le DOCUMENT nomme chaque titre du plan, dans l’ordre du plan', () => {
    const r = analyse(DOSSIER_COMPLET());
    const texte = platDe(documentDe(r));

    for (const cle of CLES_STRATEGIES_VISUELLES) {
      const pe = constat(r, cle).planExecution!;
      const positions = pe.lignes.map((l) => texte.indexOf(l.symbole));
      for (let i = 0; i < positions.length; i++) {
        expect(positions[i], `${cle} · ${pe.lignes[i].symbole} absent du document`)
          .toBeGreaterThan(-1);
        if (i > 0) {
          expect(positions[i], `${cle} · ordre du plan non respecté`)
            .toBeGreaterThan(positions[i - 1]);
        }
      }
      // Et les quantités du plan, telles quelles.
      for (const l of pe.lignes) {
        expect(texte, `${cle} · quantité de ${l.symbole}`)
          .toContain(l.quantiteAVendre.toLocaleString('fr-CA').replace(/[\s  ]/g, ' '));
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND5 · LE STATUT DÉGRADÉ NE LAISSE PASSER AUCUN ORDRE, DES DEUX CÔTÉS
// ═══════════════════════════════════════════════════════════════════════════

describe('ND5 · à confirmer : ni chiffre dans la carte, ni quantité dans la page', () => {
  it('les deux surfaces se taisent en même temps', () => {
    const r = analyse(DOSSIER_A_CONFIRMER());
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      const c = constat(r, cle);
      expect(c.statut, cle).toBe('montant-a-confirmer');
      expect(montantAffichable(c), `${cle} : la carte affiche un montant`).toBeNull();

      const p = STRATEGIES_VISUELLES[cle].construire(c) as {
        etape3: { action: { type: string } };
      };
      expect(p.etape3.action.type, `${cle} : action ferme sous statut dégradé`)
        .toBe('a-confirmer');
    }

    // Et sur le document rendu : aucune quantité, aucun total.
    const texte = platDe(documentDe(r));
    expect(texte).not.toContain('≈ ');
    expect(texte).not.toContain('TRANSACTIONS À EFFECTUER');
  });

  it('mais les deux pages EXISTENT quand même — pas d’ancien design de repli', () => {
    // §5 : une stratégie enregistrée garde sa page, dégradée ou non. Le nouveau
    // système sait présenter l'absence de transaction ferme ; renvoyer les
    // statuts dégradés vers l'ancienne carte ferait cohabiter deux designs.
    const texte = platDe(documentDe(analyse(DOSSIER_A_CONFIRMER())));
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      expect(texte, `${cle} : page absente sous statut dégradé`)
        .toContain(STRATEGIES_VISUELLES[cle].entete.titre);
    }
    expect(texte).toContain('QUANTITÉ À CONFIRMER');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND6 · LE REGISTRE EST RÉELLEMENT JOIGNABLE DEPUIS LA PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════

describe('ND6 · une stratégie inscrite au registre atteint le document', () => {
  it('chaque entrée du registre est produite par le dossier témoin ET rendue', () => {
    const r = analyse(DOSSIER_COMPLET());
    const texte = platDe(documentDe(r));

    for (const cle of CLES_STRATEGIES_VISUELLES) {
      // ⚠ LA PREMIÈRE ASSERTION EMPÊCHE LA GARDE D'ÊTRE CREUSE. Sans elle, une
      // stratégie inscrite au registre mais absente du dossier témoin passerait
      // le test en silence — on vérifierait l'absence de rien.
      expect(r.constats.some((c) => c.strategie === cle),
        `${cle} : le dossier témoin ne la produit pas — la garde serait creuse`).toBe(true);
      expect(texte, `${cle} : inscrite au registre mais absente du document`)
        .toContain(STRATEGIES_VISUELLES[cle].entete.titre);
    }
  });

  it('`aUnePageDetaillee` répond au registre, pas à une liste recopiée', () => {
    for (const cle of CLES_STRATEGIES_VISUELLES) expect(aUnePageDetaillee(cle)).toBe(true);
    expect(aUnePageDetaillee('don-titres')).toBe(false);
    expect(aUnePageDetaillee('ordre-vente')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND7 · AUCUN SECOND PLANIFICATEUR DANS LA COUCHE DE RENDU
// ═══════════════════════════════════════════════════════════════════════════

describe('ND7 · le PDF ne recalcule rien', () => {
  const MOTEURS_INTERDITS = [
    'planifierRecolte', 'meilleurPlanMonoTitre', 'meilleurPlanGainMonoTitre',
  ];

  it('aucun module de src/lib/pdf ne nomme un moteur de quantité concurrent', () => {
    // ⚠ SUR LA SOURCE, PAS SUR LE COMPORTEMENT. Un second moteur ne se voit pas
    // dans un rendu tant qu'il tombe d'accord avec le premier — c'est
    // exactement ce qui a permis à la divergence de vivre deux mois.
    const racine = 'src/lib/pdf';
    const fichiers = fs.readdirSync(racine)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
      .map((f) => `${racine}/${f}`);
    expect(fichiers.length).toBeGreaterThan(10);

    for (const f of fichiers) {
      const source = fs.readFileSync(f, 'utf8');
      for (const m of MOTEURS_INTERDITS) {
        expect(source.includes(m), `${f} nomme ${m}`).toBe(false);
      }
    }
  });

  it('`planifierRecolte` n’existe plus nulle part dans le code', () => {
    // Il était mort — aucun appelant — mais cité comme « le moteur de la carte
    // de synthèse », ce qui a servi d'argument pour déclarer le branchement
    // bloqué. Un moteur fantôme est pire qu'un moteur.
    const src = fs.readFileSync('src/lib/profils/strategies.ts', 'utf8');
    expect(src).not.toContain('planifierRecolte');
  });

  it('la synthèse ne lit le plan que par `modeTableau`, jamais en le recalculant', () => {
    const source = fs.readFileSync('src/lib/pdf/optimisations-fiscales-page.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(source).not.toMatch(/\.reduce\s*\(/);
    expect(source).not.toMatch(/\bsort\s*\(/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND8 · DOSSIER D'ENTREPRISE
// ═══════════════════════════════════════════════════════════════════════════

describe('ND8 · le titulaire traverse tout le pipeline', () => {
  it('une stratégie personnelle sort non-applicable, sans montant ni plan', () => {
    const r = analyse(DOSSIER_ENTREPRISE());
    for (const s of ['droits-cotisation', 'celi-conjoint', 'subvention-reee', 'localisation-actifs']) {
      const c = constat(r, s);
      expect(c.statut, s).toBe('non-applicable');
      expect(c.donneesManquantes, s).toContain('titulaire-entreprise');
      expect(c.montantEstime, s).toBeNull();
      expect(c.planExecution, s).toBeUndefined();
      expect(c.plan, s).toBeUndefined();
      expect(montantAffichable(c), s).toBeNull();
    }
  });

  it('le motif est EXPLIQUÉ au client, jamais donné en identifiant technique', () => {
    // ⚠ LE DÉFAUT QUE CE TEST VERROUILLE ÉTAIT VISIBLE DANS LE DOCUMENT REMIS :
    // la liste « À valider ensemble » imprimait `questionsRencontre` brut, et le
    // client lisait « 1. Titulaire-entreprise ». Les cartes traduisaient déjà
    // par `libelleRaison` ; cette liste était le canal oublié.
    const texte = platDe(documentDe(analyse(DOSSIER_ENTREPRISE())));
    expect(texte).not.toMatch(/[Tt]itulaire-entreprise/);
    expect(texte).toContain('dossier d’entreprise');
  });

  it('la neutralisation EFFACE un montant, même forgé — la garde est défensive', () => {
    // ⚠ CE TEST EXISTE PARCE QU'UN SABOTAGE EST PASSÉ INAPERÇU.
    //
    // Retirer `montantEstime: null` de `selonLeTitulaire` ne faisait rougir
    // aucun test : les quatre stratégies qu'elle neutralise sortent déjà sans
    // montant, donc le retrait ne retirait rien. La garde était vraie et
    // invérifiable — c'est-à-dire supprimable de bonne foi par un futur lot.
    //
    // On lui donne donc ce qu'aucun dossier ne produit encore : une stratégie
    // personnelle CHIFFRÉE, avec son plan. C'est le jour où elle le sera que
    // la garde comptera.
    const forge = {
      ...constat(analyse(DOSSIER_COMPLET()), 'cristallisation-pertes'),
      strategie: 'celi-conjoint',
      statut: 'calcule' as const,
      montantEstime: 987654,
    };
    expect(forge.montantEstime).toBe(987654);
    expect(forge.planExecution).toBeDefined();   // sinon le test est creux
    expect(forge.plan).toBeDefined();

    const neutralise = selonLeTitulaire(forge, 'entreprise');
    expect(neutralise.statut).toBe('non-applicable');
    expect(neutralise.montantEstime).toBeNull();
    expect(neutralise.planExecution).toBeUndefined();
    expect(neutralise.plan).toBeUndefined();
    expect(neutralise.candidats).toBeUndefined();
    expect(montantAffichable(neutralise)).toBeNull();

    // Et un particulier n'est pas touché.
    expect(selonLeTitulaire(forge, 'particulier').montantEstime).toBe(987654);
  });

  it('un dossier d’entreprise garde ses deux pages de cristallisation', () => {
    // C'est le portefeuille qui travaille, pas le régime personnel.
    const texte = platDe(documentDe(analyse(DOSSIER_ENTREPRISE())));
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      expect(texte, cle).toContain(STRATEGIES_VISUELLES[cle].entete.titre);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND9 · UN SEUL PIED POUR TOUT LE DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('ND9 · le pied nomme le document, et l’assembleur le dit', () => {
  it('le document fiscal ne porte QUE son libellé, sur toutes ses pages', () => {
    const r = analyse(DOSSIER_COMPLET());
    const texte = platDe(documentDe(r));
    expect(texte).not.toMatch(/cours cibles/i);

    // Sous révision fiscaliste, c'est la variante « document de travail » — et
    // c'est la SEULE : la synthèse et les stratégies portaient deux libellés
    // différents dans le même PDF.
    const attendu = r.revisionFiscalisteRequise
      ? LIBELLE_PIED_FISCAL_TRAVAIL : LIBELLE_PIED_FISCAL;
    expect(texte).toContain(attendu);

    // ⚠ ON NE COMPTE PAS L'AUTRE VARIANTE PAR SOUSTRACTION : le libellé court
    // EST une sous-chaîne du long. Ma première version cherchait
    // « … Optimisations fiscales » et en trouvait trois — les trois occurrences
    // du libellé LONG. Elle aurait annoncé « trois pieds différents » sur un
    // document parfaitement homogène.
    //
    // La propriété qu'on veut : CHAQUE occurrence du libellé court appartient à
    // une occurrence du libellé attendu. Les deux comptes sont donc égaux, et
    // une page qui porterait la variante nue les ferait diverger.
    const compte = (x: string) => texte.split(x).length - 1;
    expect(compte(attendu)).toBeGreaterThanOrEqual(3);
    expect(compte(LIBELLE_PIED_FISCAL)).toBe(compte(attendu));
  });

  it('intégrée aux cours cibles, la page de synthèse garde le pied de l’hôte', () => {
    // ⚠ NE PAS « CORRIGER » CECI. La même page vit dans DEUX documents ; sans
    // libellé imposé, elle doit porter celui de son hôte.
    const texte = platDe(syntheseDe(analyse(DOSSIER_COMPLET())));
    expect(texte).toMatch(/Analyse des cours cibles/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ND11 · UN SEUL TITRE CLIENT PAR STRATÉGIE
// ═══════════════════════════════════════════════════════════════════════════

describe('ND11 · la carte et la page nomment la stratégie de la même façon', () => {
  it('l’en-tête du registre EST le titreClient du moteur', () => {
    // ⚠ LE DÉFAUT QUE CE TEST VERROUILLE ÉTAIT LISIBLE DANS LE DOCUMENT REMIS :
    // la carte annonçait « Récolter des gains sans payer d'impôt », puis
    // renvoyait à une page intitulée « Cristallisation de gains » — du
    // vocabulaire de métier, et un second nom pour la même chose.
    const r = analyse(DOSSIER_COMPLET());
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      const c = constat(r, cle);
      expect(STRATEGIES_VISUELLES[cle].entete.titre, cle).toBe(c.titreClient);
    }
  });

  it('titre carte === titre page === titreClient, dans le rendu', () => {
    // ⚠ SUR LE TEXTE RÉELLEMENT POSÉ, pas sur les constantes : deux littéraux
    // peuvent être égaux et ne jamais atteindre la même surface.
    const r = analyse(DOSSIER_COMPLET());
    const carte = platDe(syntheseDe(r));
    const doc = platDe(documentDe(r));

    for (const cle of CLES_STRATEGIES_VISUELLES) {
      const titre = constat(r, cle).titreClient;
      expect(carte, `${cle} : la carte ne porte pas le titre client`).toContain(titre);
      expect(doc, `${cle} : la page ne porte pas le titre client`).toContain(titre);
      // Et le renvoi de la carte nomme CE titre-là, pas un autre.
      expect(carte, `${cle} : le renvoi nomme une autre page`)
        .toContain(`à la page « ${titre} »`);
    }
  });

  it('« sans payer d’impôt » n’atteint plus aucun rendu client', () => {
    // Décision de Nicolas, 24 août 2026 : la formulation est TROP ABSOLUE. Le
    // moteur ne démontre pas l'absence d'impôt — il démontre qu'un gain peut
    // être absorbé par des pertes déjà disponibles, et il reste même de la
    // capacité inutilisée sur le cas de référence.
    const gains = constat(analyse(DOSSIER_COMPLET()), 'cristallisation-gains');
    expect(gains.titreClient).not.toMatch(/sans payer d.impôt/i);

    for (const dossier of [DOSSIER_COMPLET, DOSSIER_GAINS, DOSSIER_A_CONFIRMER, DOSSIER_ENTREPRISE]) {
      const texte = platDe(documentDe(analyse(dossier())));
      expect(texte).not.toMatch(/sans payer d.impôt/i);
    }
  });

  it('le nom de MÉTIER survit, il ne sert simplement pas au client', () => {
    // « Cristallisation de gains » reste le nom du catalogue et de l'écran de
    // sélection. Ce qui a changé, c'est qu'il n'atteint plus le document.
    const c = constat(analyse(DOSSIER_COMPLET()), 'cristallisation-gains');
    expect(c.titre).toBe('Cristallisation de gains');
    expect(c.titre).not.toBe(c.titreClient);
  });
});
// ═══════════════════════════════════════════════════════════════════════════
// ND10 · LA CARTE RESTE UNE SYNTHÈSE UTILE
// ═══════════════════════════════════════════════════════════════════════════

describe('ND10 · ce que la synthèse doit continuer de dire', () => {
  it('stratégie, statut, chiffre principal, renvoi — les quatre', () => {
    const r = analyse(DOSSIER_COMPLET());
    const texte = platDe(syntheseDe(r));
    const c = constat(r, 'cristallisation-pertes');

    expect(texte).toContain(c.titreClient);                       // la stratégie
    expect(texte).toContain('Calculé');                            // le statut
    // ⚠ LA SYNTHÈSE ARRONDIT (`fmt`), la page en cinq étapes écrit les cents
    // (`argent`). Deux formats, un seul nombre — exiger « 15 000,00 $ » ici
    // aurait fait rougir un rendu parfaitement correct.
    expect(texte).toContain('15 000 $');                  // le chiffre principal
    expect(texte).toContain('Le détail');                          // le renvoi
  });

  it('sous un statut dégradé, les CANDIDATS restent nommés dans la carte', () => {
    // ⚠ CE MODE N'EST PAS UN TABLEAU D'ORDRES, et c'est pourquoi il survit.
    // Ce sont des mesures du relevé — valeur marchande moins valeur comptable —
    // présentées avec une légende qui dit qu'elles ne sont pas une instruction.
    // Sans elles, un constat dégradé ne nomme AUCUN titre : le défaut du
    // 19 août 2026, « je trouve que ça dit rien ».
    const r = analyse(DOSSIER_A_CONFIRMER());
    const c = constat(r, 'cristallisation-pertes');
    expect(modeTableau(c)).toBe('candidats');

    const texte = platDe(syntheseDe(r));
    expect(texte).toContain('Gain latent observé');
    expect(texte).toContain('ALFA');
  });
});
