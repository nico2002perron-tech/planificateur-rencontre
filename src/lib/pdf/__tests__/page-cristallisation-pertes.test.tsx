// LA PAGE EN CINQ ÉTAPES — verrouillée avant d'être réutilisée ailleurs.
//
// Le design a été inspecté sur PDF réel (commit 4d82545). Ces tests protègent
// ce qui a été vu : l'ordre de l'histoire, l'exactitude des chiffres repris de
// l'adaptateur, et les deux bugs visuels réellement rencontrés — le liseré vert
// d'un `#rrggbbaa` et la carte dégradée vide.
//
// Données entièrement fictives.
import { describe, it, expect } from 'vitest';
import React from 'react';
import { PageCristallisationPertes } from '../page-cristallisation-pertes';
import {
  PRESENTATION_CALCULEE, PRESENTATION_DEGRADEE,
} from '../__fixtures__/cristallisation-pertes';
import type { PresentationCristallisationPertes } from '../presentation-cristallisation-pertes';

/** Le texte réellement posé sur la page — même technique que les tests voisins. */
function textesDe(n: unknown): string[] {
  if (n === null || n === undefined || typeof n === 'boolean') return [];
  if (typeof n === 'string') return [n];
  if (typeof n === 'number') return [String(n)];
  if (Array.isArray(n)) return n.flatMap(textesDe);
  const el = n as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return [];
  if (typeof el.type === 'function') return textesDe((el.type as (p: unknown) => unknown)(el.props));
  return textesDe(el.props.children);
}

const rendu = (p: PresentationCristallisationPertes, logos?: Record<string, string>) =>
  textesDe(<PageCristallisationPertes presentation={p} logos={logos} />);
/** Joint SANS séparateur : react-pdf colle les fragments d'un même `<Text>`. */
const plat = (p: PresentationCristallisationPertes, l?: Record<string, string>) =>
  rendu(p, l).join('').replace(/[\s   ]+/g, ' ');

const CALCULEE = () => plat(PRESENTATION_CALCULEE);
const DEGRADEE = () => plat(PRESENTATION_DEGRADEE);

// ═══════════════════════════════════════════════════════════════════════════
// V1 — L'HISTOIRE, DANS L'ORDRE
// ═══════════════════════════════════════════════════════════════════════════

describe('V1 · les cinq étapes se suivent', () => {
  it('dans l’ordre, et une permutation le ferait tomber', () => {
    const t = CALCULEE();
    const titres = [
      'Pourquoi cette stratégie', 'Pourquoi ce titre', 'Combien vendre',
      'Quel effet', 'Effet sur la déclaration de revenus',
    ];
    const positions = titres.map((x) => t.indexOf(x));
    for (const [i, p] of positions.entries()) {
      expect(p, titres[i]).toBeGreaterThan(-1);
    }
    // Strictement croissantes : c'est l'ordre qui fait l'histoire.
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(positions).size).toBe(5);
    // Les badges numérotés suivent le même ordre.
    expect(['1', '2', '3', '4', '5'].every((n) => rendu(PRESENTATION_CALCULEE).includes(n))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V2 / V16 — L'IDENTITÉ DU TITRE, ET SON LOGO
// ═══════════════════════════════════════════════════════════════════════════

describe('V2 · l’étape 1 nomme le titre', () => {
  it('symbole, description et logo rendu', () => {
    const t = CALCULEE();
    expect(t).toMatch(/FICT/);
    expect(t).toMatch(/Compagnie Fictive Ltée/);
  });
});

describe('V16 · sans logo mémorisé, la pastille porte le ticker', () => {
  it('jamais un espace vide ni une image cassée', () => {
    // Aucun cache fourni : c'est le repli de Phase 1 qui doit s'afficher.
    const jetons = rendu(PRESENTATION_CALCULEE);
    expect(jetons).toContain('FIC');            // trois premières lettres du ticker
  });

  it('avec un logo en cache, l’image remplace la pastille', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgo=';
    expect(rendu(PRESENTATION_CALCULEE, { FICT: PNG })).not.toContain('FIC');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V3 — UNE RAISON FISCALE, PAS UN AVIS D'INVESTISSEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe('V3 · l’étape 2 ne juge jamais l’entreprise', () => {
  it('dit pourquoi fiscalement, et rien d’autre', () => {
    const t = CALCULEE();
    expect(t).toMatch(/une seule transaction/);
    for (const interdit of [
      /meilleur titre/i, /mauvais titre/i, /potentiel/i, /perspective/i,
      /devrait être vendu/i, /à éviter/i, /moins bon/i,
    ]) {
      expect(t, interdit.source).not.toMatch(interdit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V4 → V9 — LES CHIFFRES, REPRIS DE L'ADAPTATEUR SANS RETOUCHE
// ═══════════════════════════════════════════════════════════════════════════

describe('V4-V9 · la page reprend exactement ce que l’adaptateur donne', () => {
  it('V4 · la quantité domine, en actions', () => {
    expect(CALCULEE()).toMatch(/≈ 118 actions/);
  });

  it('V5 · la valeur de vente estimée', () => {
    expect(CALCULEE()).toMatch(/4 898,18 \$/);
  });

  it('V6 · la perte estimée réalisée', () => {
    expect(CALCULEE()).toMatch(/9 031,60 \$/);
  });

  it('V7 · avant, stratégie et après dans le diagramme', () => {
    const t = CALCULEE();
    expect(t).toMatch(/8 997,81 \$/);
    expect(t).toMatch(/9 031,60 \$/);
    expect(t).toMatch(/0,00 \$/);
    expect(t).toMatch(/AVANT/);
    expect(t).toMatch(/STRATÉGIE/);
    expect(t).toMatch(/APRÈS/);
  });

  it('V8 · l’écart est dit séparément, avec son signe', () => {
    const t = CALCULEE();
    expect(t).toMatch(/Écart estimé.*\+33,79 \$/);
    expect(t).toMatch(/Objectif atteint/);
  });

  it('V9 · l’étape 5 chiffre la réduction du gain net', () => {
    const t = CALCULEE();
    expect(t).toMatch(/Réduction du gain en capital net/);
    expect(t).toMatch(/≈ 8 997,81 \$/);
    expect(t).toMatch(/Gain en capital net restant/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V10 / V11 — CE QUE LA PAGE NE DIRA JAMAIS
// ═══════════════════════════════════════════════════════════════════════════

describe('V10/V11 · aucun impôt inventé, aucun taux d’inclusion', () => {
  const INTERDITS = [
    /économie d.impôt/i, /impôt économisé/i, /économie fiscale/i, /vous économisez/i,
    /taux d.inclusion/i, /taux marginal/i, /revenu imposable/i,
    /\b50\s*%/, /\b2\/3\b/,
  ];
  for (const [nom, t] of [['calculée', CALCULEE], ['dégradée', DEGRADEE]] as const) {
    it(`page ${nom} : aucune formulation fiscale non validée`, () => {
      const texte = t();
      for (const i of INTERDITS) expect(texte, i.source).not.toMatch(i);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// V12 / V13 — DEVISE ET DATE
// ═══════════════════════════════════════════════════════════════════════════

describe('V12 · un titre USD dont les montants sont en dollars canadiens', () => {
  it('garde les deux notions, sans convertir quoi que ce soit', () => {
    // La fixture dégradée porte déjà `deviseNegociation: 'USD'`.
    const t = DEGRADEE();
    expect(t).toMatch(/Négociation : USD/);
    expect(t).toMatch(/Montants fiscaux : CAD/);
    // Les montants restent ceux du moteur, en dollars canadiens.
    expect(t).toMatch(/8 997,81 \$/);
  });

  it('un titre CAD n’affiche pas cette mention — elle serait du bruit', () => {
    expect(CALCULEE()).not.toMatch(/Négociation :/);
  });
});

describe('V13 · la date se dit au client, pas à la machine', () => {
  it('« 21 août 2026 », jamais « 2026-08-21 »', () => {
    const t = CALCULEE();
    expect(t).toMatch(/21 août 2026/);
    expect(t).not.toMatch(/2026-08-21/);
    expect(t).toMatch(/actualiser avant l’exécution/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V14 / V15 / V18 — LE STATUT DÉGRADÉ, DIGNE ET SANS FAUX CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════

describe('V14 · aucune quantité ferme hors de `calcule`', () => {
  it('ni 118 actions, ni ordre de vente', () => {
    const t = DEGRADEE();
    expect(t).not.toMatch(/118/);
    expect(t).not.toMatch(/ACTION PROPOSÉE/);
    expect(t).not.toMatch(/Valeur de vente estimée/);
    expect(t).toMatch(/QUANTITÉ À CONFIRMER/);
    expect(t).toMatch(/ne peut pas être établie/);
  });
});

describe('V15 · un après indisponible ne devient jamais zéro', () => {
  it('aucun faux 0 $, aucun « Objectif atteint »', () => {
    const t = DEGRADEE();
    expect(t).not.toMatch(/Objectif atteint/);
    expect(t).not.toMatch(/0,00 \$/);
    expect(t).toMatch(/ne peut pas être illustré/);
  });
});

describe('V18 · aucune section dégradée ne reste vide', () => {
  it('chaque partie non affichable DIT ce qui manque', () => {
    // ⚠ VU AU PREMIER RENDU : une carte vide se lit « le document est cassé »
    // plutôt que « la donnée manque ».
    const t = DEGRADEE();
    for (const attendu of [
      /ne peut pas être établie/,        // étape 3
      /ne peut pas être illustré/,       // étape 4
      /sera chiffrée une fois/,          // étape 5
      /sera déterminé une fois/,         // étape 2
    ]) {
      expect(t, attendu.source).toMatch(attendu);
    }
    // Et la page dégradée reste substantielle : pas un squelette.
    expect(t.length).toBeGreaterThan(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V17 — LE LISERÉ VERT NE REVIENDRA PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('V17 · aucune couleur hexadécimale à huit caractères', () => {
  it('react-pdf les rend arbitrairement — un `#ffffff55` sortait VERT', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const fichiers = [
      'src/lib/pdf/page-cristallisation-pertes.tsx',
      'src/lib/pdf/diagramme-avant-strategie-apres.tsx',
      'src/lib/pdf/logo-societe-fiscal.tsx',
    ];
    for (const f of fichiers) {
      const source = fs.readFileSync(f, 'utf8');
      // Un `#` suivi de 8 chiffres hexadécimaux, hors d'un commentaire décrivant
      // le bug lui-même : on cherche les valeurs entre guillemets.
      const fautifs = source.match(/['"]#[0-9a-fA-F]{8}['"]/g) ?? [];
      expect(fautifs, `${f} → ${fautifs.join(', ')}`).toEqual([]);
    }
  });
});
