// LA PAGE « CRISTALLISATION DE GAINS » — verrouillée après inspection du PDF.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUE CES TESTS PROTÈGENT, ET POURQUOI ILS EXISTENT.
//
// Le design a été regardé sur un PDF réel avant d'être verrouillé. Trois choses
// n'étaient visibles QUE là :
//   · l'étape 2 dégradée imprimait deux fois la même phrase (PG14) ;
//   · le tiret d'une valeur absente sortait en VERT, couleur du gain, et se
//     lisait comme un montant (PG15) ;
//   · l'étape 4 encadrée d'une carte inutile poussait toute l'étape à la page
//     suivante, laissant un tiers de page blanc (PG18).
//
// S'y ajoutent les trois contraintes de rendu héritées de la page des pertes,
// chacune née d'un vrai bug : pas de `#rrggbbaa`, pas de section vide, pas de
// glyphe absent des polices embarquées.
//
// Données entièrement fictives.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import React from 'react';
import { PageCristallisationGains } from '../page-cristallisation-gains';
import { TITRE_CLIENT_CRISTALLISATION_GAINS } from '@/lib/profils/titres-strategies';
import {
  TITRE_PRESENTATION, SOUS_TITRE_PRESENTATION,
} from '../presentation-cristallisation-gains';
import {
  PRESENTATION_GAINS_CALCULEE, PRESENTATION_GAINS_DEGRADEE, PRESENTATION_GAINS_USD,
} from '../__fixtures__/cristallisation-gains';
import { textesDe, platDe, noeudsTexte } from './_texte-rendu';
import type { PresentationCristallisationGains } from '../presentation-cristallisation-gains';

const arbre = (p: PresentationCristallisationGains, logos?: Record<string, string>) =>
  React.createElement(PageCristallisationGains, { presentation: p, logos });
const jetons = (p: PresentationCristallisationGains, l?: Record<string, string>) =>
  textesDe(arbre(p, l));
const plat = (p: PresentationCristallisationGains, l?: Record<string, string>) =>
  platDe(arbre(p, l));

const CALCULEE = () => plat(PRESENTATION_GAINS_CALCULEE);
const DEGRADEE = () => plat(PRESENTATION_GAINS_DEGRADEE);

// ═══════════════════════════════════════════════════════════════════════════
// PG1 — L'HISTOIRE, DANS L'ORDRE
// ═══════════════════════════════════════════════════════════════════════════

describe('PG1 · les cinq étapes se suivent, et ce ne sont PAS celles des pertes', () => {
  it('l’ordre est celui de l’histoire des gains', () => {
    const t = CALCULEE();
    const titres = [
      'Des pertes fiscales sont disponibles',
      'Quel gain peut être réalisé',
      'Quel titre et quelle quantité',
      'Qu’est-ce que cela change pour la position',
      'Quel est l’effet fiscal estimé',
    ];
    const positions = titres.map((x) => t.indexOf(x));
    for (const [i, p] of positions.entries()) expect(p, titres[i]).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(new Set(positions).size).toBe(5);
    expect(['1', '2', '3', '4', '5'].every((n) => jetons(PRESENTATION_GAINS_CALCULEE).includes(n)))
      .toBe(true);
  });

  it('aucun titre d’étape emprunté à la page des pertes', () => {
    // ⚠ LA CONSIGNE ÉTAIT DE NE PAS RECOPIER LES CINQ ÉTAPES. Les pertes
    // racontent une soustraction ; les gains, l'emploi d'une capacité qui dort.
    const t = CALCULEE();
    for (const emprunt of [
      /Pourquoi cette stratégie/, /Pourquoi ce titre/, /Combien vendre/,
      /Quel effet \?/, /Effet sur la déclaration de revenus/,
    ]) {
      expect(t, emprunt.source).not.toMatch(emprunt);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG2 — LE TITRE NE PROMET PAS CE QUE LE CONTRAT NE DÉMONTRE PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('PG2 · « sans payer d’impôt » n’atteint jamais le document', () => {
  it('ni sur la page calculée, ni sur la dégradée, ni dans les libellés', () => {
    for (const [nom, t] of [['calculée', CALCULEE()], ['dégradée', DEGRADEE()]] as const) {
      expect(t, nom).not.toMatch(/sans payer d.impôt/i);
      expect(t, nom).not.toMatch(/aucun impôt/i);
      expect(t, nom).not.toMatch(/zéro impôt/i);
      expect(t, nom).not.toMatch(/libre d.impôt/i);
    }
    // ⚠ CE TEST GARDAIT UN CONTOURNEMENT, ET LE CONTOURNEMENT A DISPARU.
    //
    // Il vérifiait que la page REFUSE le titre du catalogue : la promesse
    // vivait dans le constat, et seule la page s'en écartait. C'était vrai, et
    // ça laissait le document porter deux noms — la carte annonçait la
    // promesse, la page renvoyait à autre chose.
    //
    // Le catalogue lui-même ne la porte plus (décision du 24 août 2026). La
    // page reprend donc simplement le titre client, et le sous-titre a été
    // REFUSÉ — il répétait mot pour mot ce que le titre dit maintenant.
    expect(PRESENTATION_GAINS_CALCULEE.titre).toBe(TITRE_PRESENTATION);
    expect(TITRE_PRESENTATION).toBe(TITRE_CLIENT_CRISTALLISATION_GAINS);
    expect(SOUS_TITRE_PRESENTATION).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG3 → PG8 — LES CHIFFRES, REPRIS SANS RETOUCHE
// ═══════════════════════════════════════════════════════════════════════════

describe('PG3-PG8 · la page reprend exactement ce que l’adaptateur donne', () => {
  it('PG3 · étape 1 · les deux grandeurs disponibles', () => {
    const t = CALCULEE();
    expect(t).toMatch(/Pertes fiscales disponibles.*12 000,00 \$/);
    expect(t).toMatch(/Gains latents disponibles.*28 900,00 \$/);
  });

  it('PG4 · étape 2 · la cible EST `montantEstime`, jamais un min() refait', () => {
    expect(CALCULEE()).toMatch(/Gain ciblé.*≈ 12 000,00 \$/);
  });

  it('PG5 · étape 3 · la quantité domine, en actions', () => {
    expect(CALCULEE()).toMatch(/≈ 141 actions/);
  });

  it('PG6 · étape 3 · valeur de vente et gain réalisé', () => {
    const t = CALCULEE();
    expect(t).toMatch(/Valeur de vente estimée.*19 740,00 \$/);
    expect(t).toMatch(/Gain réalisé estimé.*11 985,00 \$/);
  });

  it('PG7 · étape 3 · l’objectif et l’écart NÉGATIF sont dits, côte à côte', () => {
    // ⚠ 11 985 NE DEVIENT PAS 12 000 ET −15 NE DEVIENT PAS 0. Arrondir « juste
    // ce petit écart » rendrait le document faux, pas plus simple.
    const t = CALCULEE();
    expect(t).toMatch(/Objectif *12 000,00 \$/);
    expect(t).toMatch(/Écart estimé *-15,00 \$/);
  });

  it('PG8 · étape 5 · la capacité encore disponible vaut 15 $', () => {
    expect(CALCULEE()).toMatch(/Capacité encore disponible.*15,00 \$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG9 — « CAPACITÉ ≠ EXÉCUTION » SE DIT EN FRANÇAIS, SUR LA PAGE
// ═══════════════════════════════════════════════════════════════════════════

describe('PG9 · la phrase qui rend les 15 $ compréhensibles est VISIBLE', () => {
  it('elle est posée sur la page, sous les chiffres qu’elle explique', () => {
    const t = CALCULEE();
    expect(t).toMatch(/assez de gain latent pour porter la cible/);
    expect(t).toMatch(/15,00 \$ de capacité inutilisée/);
    // Elle vient APRÈS les chiffres : elle les explique, elle ne les remplace pas.
    expect(t.indexOf('capacité inutilisée')).toBeGreaterThan(t.indexOf('Écart estimé'));
  });

  it('exécution complète : la phrase disparaît au lieu de mentir', () => {
    const p: PresentationCristallisationGains = {
      ...PRESENTATION_GAINS_CALCULEE,
      etape3: { ...PRESENTATION_GAINS_CALCULEE.etape3, precisionGranularite: null },
    };
    expect(plat(p)).not.toMatch(/capacité inutilisée/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG10 / PG11 — L'ÉTAPE 4 : UN PARCOURS, ET UN FUTUR NON CHIFFRÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('PG10 · les trois jalons du parcours', () => {
  it('aujourd’hui, les pertes disponibles, puis un plus tard conditionnel', () => {
    const t = CALCULEE();
    const jalons = ['AUJOURD’HUI', 'LES PERTES DISPONIBLES', 'PLUS TARD'];
    const positions = jalons.map((x) => t.indexOf(x));
    for (const [i, p] of positions.entries()) expect(p, jalons[i]).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(t).toMatch(/Une partie du gain latent est réalisée/);
    expect(t).toMatch(/Elles absorbent le gain réalisé/);
  });

  it('le troisième jalon est CONDITIONNEL au rachat, jamais un fait', () => {
    const t = CALCULEE();
    expect(t).toMatch(/Si des unités sont rachetées/);
    expect(t).toMatch(/Si des unités du même titre sont rachetées par la suite/);
    // Aucune formulation qui présenterait le rachat comme prévu ou recommandé.
    for (const interdit of [
      /le rachat aura lieu/i, /vous rachèterez/i, /il faudra racheter/i,
      /nous rachèterons/i, /rachat prévu/i,
    ]) {
      expect(t, interdit.source).not.toMatch(interdit);
    }
  });
});

describe('PG11 · aucun coût fiscal futur n’est inventé', () => {
  it('le mécanisme est expliqué, sans chiffre — conclusion de l’audit PBR', () => {
    // ⚠ LE MOTEUR NE CONNAÎT NI LE PRIX, NI LA QUANTITÉ, NI LA DATE, NI LES
    // FRAIS D'UN RACHAT QUI N'A PAS EU LIEU. Un « nouveau prix de base : X $ »
    // serait une invention pure.
    const t = CALCULEE();
    expect(t).toMatch(/dépendra notamment du prix, de la quantité et des frais du rachat/);
    for (const interdit of [
      /nouveau (coût|prix de base|PBR)[^.]{0,40}\d/i,
      /coût fiscal moyen[^.]{0,40}\d+[ ,]\d*\s*\$/i,
      /prix de base rajusté de \d/i,
    ]) {
      expect(t, interdit.source).not.toMatch(interdit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG12 / PG13 — CE QUE LA PAGE NE DIRA JAMAIS
// ═══════════════════════════════════════════════════════════════════════════

describe('PG12 · aucun impôt inventé, aucun taux d’inclusion', () => {
  const INTERDITS = [
    /économie d.impôt/i, /impôt économisé/i, /économie fiscale/i, /vous économisez/i,
    /taux d.inclusion/i, /taux marginal/i, /revenu imposable/i,
    /\b50\s*%/, /\b2\/3\b/, /gain imposable/i,
  ];
  for (const [nom, t] of [['calculée', CALCULEE], ['dégradée', DEGRADEE]] as const) {
    it(`page ${nom} : aucune formulation fiscale non validée`, () => {
      const texte = t();
      for (const i of INTERDITS) expect(texte, i.source).not.toMatch(i);
    });
  }
});

describe('PG13 · aucun glyphe absent des polices embarquées', () => {
  it('« ↓ » sortait en petits guillemets, « ⚠ » en carré vide', () => {
    for (const t of [CALCULEE(), DEGRADEE()]) {
      for (const glyphe of ['↓', '↑', '→', '←', '⚠', '✓', '✔', '✗', '•']) {
        expect(t, glyphe).not.toContain(glyphe);
      }
    }
    // Les seuls signes non-ASCII admis sont ceux qu'on a vus rendre : ≈ − —.
    expect(CALCULEE()).toContain('≈');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG14 / PG15 — LES DEUX DÉFAUTS VUS SUR LE PDF DÉGRADÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('PG14 · l’étape 2 dégradée ne dit sa phrase QU’UNE FOIS', () => {
  it('la répétition se lisait comme un bogue de gabarit', () => {
    // ⚠ SABOTAGE : remettre le `<Text>{p.etape2.texte}</Text>` sous le repli
    // porte ce compte à 2 et fait rougir ce test.
    const t = DEGRADEE();
    const phrase = 'Le gain réalisable sera chiffré une fois les données du dossier confirmées.';
    const occurrences = t.split(phrase).length - 1;
    expect(occurrences, `« ${phrase} » apparaît ${occurrences} fois`).toBe(1);
  });

  it('mais le cas calculé garde SA phrase sous le chiffre', () => {
    // Sinon le test ci-dessus passerait aussi en supprimant les deux textes.
    const t = CALCULEE();
    expect(t).toMatch(/Voici le gain qui pourrait être réalisé en utilisant ces pertes/);
  });
});

describe('PG15 · un tiret n’est pas une valeur', () => {
  it('une donnée absente porte la couleur du texte secondaire, pas celle du sens', () => {
    // ⚠ VU SUR LE PDF : le « — » du gain réalisé sortait en VERT, la couleur du
    // gain. À l'œil, ça se lit comme un montant. SABOTAGE : rendre `couleur`
    // inconditionnelle repeint ce tiret en #2f8f4e et fait rougir ce test.
    const tirets = noeudsTexte(arbre(PRESENTATION_GAINS_DEGRADEE))
      .filter((n) => n.texte === '—');
    expect(tirets.length, 'la page dégradée doit porter des tirets').toBeGreaterThan(0);
    for (const t of tirets) {
      expect(t.couleur, 'un tiret peint en couleur de valeur').toBe('#64748b');
    }
  });

  it('et un vrai montant garde SA couleur — sinon la garde serait creuse', () => {
    // ⚠ `toLocaleString('fr-CA')` sépare les milliers par une espace insécable
    // étroite, pas par une espace ordinaire : `noeudsTexte` normalise déjà, mais
    // comparer au caractère près sans normaliser donnait un faux rouge.
    const noeuds = noeudsTexte(arbre(PRESENTATION_GAINS_CALCULEE));
    const gain = noeuds.find((n) => n.texte === '11 985,00 $' && n.couleur === '#2f8f4e');
    const pertes = noeuds.find((n) => n.texte === '12 000,00 $' && n.couleur === '#2563a8');
    expect(gain, 'le gain réalisé doit rester vert').toBeDefined();
    expect(pertes, 'les pertes disponibles doivent rester bleues').toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG16 — LE STATUT DÉGRADÉ : DIGNE, ET SANS FAUX CHIFFRE
// ═══════════════════════════════════════════════════════════════════════════

describe('PG16 · aucune quantité ferme hors de `calcule`', () => {
  it('ni 141 actions, ni valeur de vente, ni gain réalisé', () => {
    // ⚠ LA FIXTURE DÉGRADÉE PORTE POURTANT LE PLAN MOTEUR COMPLET. La sécurité
    // est dans le type : l'action « à confirmer » n'a pas de champ quantité.
    const t = DEGRADEE();
    expect(t).not.toMatch(/141/);
    expect(t).not.toMatch(/19 740/);
    expect(t).not.toMatch(/11 985/);
    expect(t).not.toMatch(/ACTION ESTIMÉE/);
    expect(t).toMatch(/QUANTITÉ À CONFIRMER/);
    expect(t).toMatch(/la liste des positions détenues ailleurs/);
  });

  it('aucune section dégradée ne reste vide : chacune DIT ce qui manque', () => {
    const t = DEGRADEE();
    for (const attendu of [
      /sera chiffré une fois les données du dossier confirmées/,   // étape 2
      /ne peut pas être établie/,                                  // étape 3
      /ne peut pas être illustré/,                                 // étape 4
      /L’effet fiscal sera chiffré une fois/,                      // étape 5
    ]) {
      expect(t, attendu.source).toMatch(attendu);
    }
    // Et la page dégradée reste substantielle, pas un squelette.
    expect(t.length).toBeGreaterThan(400);
    // Les grandeurs de CONTEXTE survivent : c'est là qu'elles servent.
    expect(t).toMatch(/12 000,00 \$/);
    expect(t).toMatch(/28 900,00 \$/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG17 — DEVISE, DATE, LOGO
// ═══════════════════════════════════════════════════════════════════════════

describe('PG17 · devise, date et pastille', () => {
  it('un titre USD à montants CAD garde les deux notions', () => {
    const t = plat(PRESENTATION_GAINS_USD);
    expect(t).toMatch(/Négociation : USD/);
    expect(t).toMatch(/Montants fiscaux : CAD/);
    // Aucune conversion : les montants restent ceux du moteur.
    expect(t).toMatch(/19 740,00 \$/);
  });

  it('un titre CAD n’affiche pas cette mention — elle serait du bruit', () => {
    expect(CALCULEE()).not.toMatch(/Négociation :/);
  });

  it('la date se dit au client, pas à la machine', () => {
    const t = CALCULEE();
    expect(t).toMatch(/21 août 2026/);
    expect(t).not.toMatch(/2026-08-21/);
    expect(t).toMatch(/actualiser avant l’exécution/);
  });

  it('sans logo mémorisé, la pastille porte le ticker — jamais un vide', () => {
    expect(jetons(PRESENTATION_GAINS_CALCULEE)).toContain('FIC');
  });

  it('avec un logo en cache, l’image remplace la pastille', () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgo=';
    expect(jetons(PRESENTATION_GAINS_CALCULEE, { FICT: PNG })).not.toContain('FIC');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PG18 — LES CONTRAINTES DE RENDU, DANS LA SOURCE
// ═══════════════════════════════════════════════════════════════════════════

describe('PG18 · aucune couleur hexadécimale à huit caractères', () => {
  it('react-pdf les rend arbitrairement — un `#ffffff55` sortait VERT', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    for (const f of [
      'src/lib/pdf/page-cristallisation-gains.tsx',
      'src/lib/pdf/parcours-gain-cristallise.tsx',
    ]) {
      const fautifs = fs.readFileSync(f, 'utf8').match(/['"]#[0-9a-fA-F]{8}['"]/g) ?? [];
      expect(fautifs, `${f} → ${fautifs.join(', ')}`).toEqual([]);
    }
  });
});

describe('PG18b · le parcours n’est pas enfermé dans une carte de plus', () => {
  it('deux cadres imbriqués repoussaient l’étape 4 à la page suivante', () => {
    // ⚠ MESURÉ SUR PDF : le cadre extérieur coûtait 22 pt, assez pour faire
    // basculer l'étape entière et laisser un tiers de page blanc. Les jalons
    // sont déjà des cartes bordées ; un cadre de plus est du bruit.
    const source = (require('node:fs') as typeof import('node:fs'))
      .readFileSync('src/lib/pdf/page-cristallisation-gains.tsx', 'utf8');
    expect(source).not.toMatch(/<Carte[^>]*>\s*<ParcoursGainCristallise/);
    expect(source).toMatch(/^\s*<ParcoursGainCristallise \{\.\.\.p\.etape4\} \/>/m);
  });
});
