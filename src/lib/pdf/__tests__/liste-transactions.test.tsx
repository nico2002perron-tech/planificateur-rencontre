// LA BATTERIE « M » — CE QU'UN PLAN À PLUSIEURS TITRES NE DOIT JAMAIS PERDRE.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI UNE BATTERIE À PART.
//
// Les batteries V (pertes) et PG (gains) prouvent le contenu d'UNE stratégie.
// Celle-ci prouve une propriété du TRANSPORT : entre le plan canonique et la
// feuille remise au client, aucune ligne ne disparaît, ne se réordonne, ne
// change de quantité, et aucun total n'est refait en chemin.
//
// ⚠ CHAQUE TEST ICI CORRESPOND À UN SABOTAGE EXIGÉ PAR LA CONSIGNE. Un test
// qu'on peut satisfaire sans exécuter le vrai rendu ne prouve rien : on
// DÉROULE l'arbre et on lit ce qui est réellement posé.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import { Image } from '@react-pdf/renderer';
import { PageCristallisationPertes } from '../page-cristallisation-pertes';
import { PageCristallisationGains } from '../page-cristallisation-gains';
import { ListeTransactions } from '../langage-fiscal';
import { construirePresentationCristallisationPertes } from '../presentation-cristallisation-pertes';
import type { PlanExecution, LigneExecution } from '@/lib/profils/plan-execution';
import type { Constat } from '@/lib/profils/strategies';
import { platDe, textesDe } from './_texte-rendu';
import {
  PERTE_MULTI_2, PERTE_MULTI_5, PERTE_MULTI_14, PERTE_MONO, PERTE_DEGRADEE,
  GAIN_MULTI_5,
} from '../__fixtures__/multi-visuel';

// ── UN PARCOURS D'ARBRE QUI VOIT AUTRE CHOSE QUE DU TEXTE ──────────────────
// `_texte-rendu` s'arrête aux `<Text>`. Ici il faut aussi les `<Image>` (pour
// prouver qu'aucune source n'est une URL) et les `wrap` (pour prouver qu'une
// transaction ne peut pas être coupée).
type Elem = { type?: unknown; props?: Record<string, unknown> };
function elements(noeud: unknown): Elem[] {
  if (noeud === null || noeud === undefined || typeof noeud !== 'object') return [];
  if (Array.isArray(noeud)) return noeud.flatMap(elements);
  const el = noeud as Elem;
  if (!el.props) return [];
  if (typeof el.type === 'function') {
    return [el, ...elements((el.type as (p: unknown) => unknown)(el.props))];
  }
  return [el, ...elements(el.props.children)];
}

const pagePertes = (p: Parameters<typeof PageCristallisationPertes>[0]['presentation']) =>
  <PageCristallisationPertes presentation={p} />;

/**
 * UN NOMBRE FORMATÉ, NORMALISÉ COMME LE FAIT `platDe`.
 *
 * ⚠ SANS ÇA, RIEN NE SE COMPARE. `toLocaleString('fr-CA')` sépare les milliers
 * par une espace fine insécable (U+202F) ; `platDe` la ramène à une espace
 * ordinaire. « 1 240 » attendu ne se trouvait donc jamais dans « 1 240 » rendu,
 * et le test rougissait sur un rendu parfaitement correct.
 */
const nombre = (n: number) => n.toLocaleString('fr-CA').replace(/[\s\u00a0\u202f\u2009]+/g, ' ');

// ═══════════════════════════════════════════════════════════════════════════
// M1 · SABOTAGE « UNE LIGNE MULTI DISPARAÎT »
// ═══════════════════════════════════════════════════════════════════════════

describe('M1 · toutes les lignes du plan atteignent la page', () => {
  const cas = [
    { nom: 'pertes · 2', arbre: () => pagePertes(PERTE_MULTI_2), p: PERTE_MULTI_2 },
    { nom: 'pertes · 5', arbre: () => pagePertes(PERTE_MULTI_5), p: PERTE_MULTI_5 },
    { nom: 'pertes · 14', arbre: () => pagePertes(PERTE_MULTI_14), p: PERTE_MULTI_14 },
    { nom: 'gains · 5', arbre: () => <PageCristallisationGains presentation={GAIN_MULTI_5} />,
      p: GAIN_MULTI_5 },
  ];

  for (const c of cas) {
    it(`${c.nom} · chaque symbole ET chaque quantité sont posés`, () => {
      const a = c.p.etape3.action;
      if (a.type !== 'ferme') throw new Error('fixture non ferme');
      const plat = platDe(c.arbre());

      for (const l of a.lignes) {
        expect(plat, `symbole ${l.symbole} absent`).toContain(l.symbole);
        // ⚠ LA QUANTITÉ, PAS SEULEMENT LE SYMBOLE. Une ligne peut survivre en
        // nom et perdre son ordre — c'est le nombre qu'on exécute.
        expect(plat, `quantité de ${l.symbole} absente`)
          .toContain(nombre(l.quantiteAVendre));
      }
      // Et le compte annoncé est le compte rendu — pas « 5 transactions » sur
      // quatre lignes survivantes.
      expect(plat).toContain(`${a.lignes.length} transaction`);
    });
  }

  it('⚠ le test mord : retirer une ligne de la fixture le fait rougir', () => {
    const a = PERTE_MULTI_5.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');
    const ampute = {
      ...PERTE_MULTI_5,
      etape3: { action: { ...a, lignes: a.lignes.slice(0, -1) } },
    };
    const plat = platDe(pagePertes(ampute));
    expect(plat).not.toContain(a.lignes[a.lignes.length - 1].symbole);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M2 · SABOTAGE « L'ORDRE CANONIQUE EST MODIFIÉ »
// ═══════════════════════════════════════════════════════════════════════════

describe('M2 · l’ordre du plan est l’ordre de la page', () => {
  it('les symboles apparaissent dans l’ordre exact des lignes', () => {
    const a = PERTE_MULTI_5.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');

    // ⚠ ON NE CHERCHE PAS « LES SYMBOLES SONT PRÉSENTS » — M1 le fait déjà.
    // On lit la SUITE des positions dans le texte rendu. Un tri glissé dans la
    // vue (par montant, par symbole) passerait M1 sans broncher.
    const plat = platDe(pagePertes(PERTE_MULTI_5));
    // ⚠ PAS PAR LE SYMBOLE : la pastille de repli pose ses initiales juste
    // avant lui, si bien que « ALFA » se lit dans « ALFALFA ». La description
    // est le seul repère isolé de la ligne.
    const positions = a.lignes.map((l) => plat.indexOf(l.description ?? l.symbole));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], `${a.lignes[i].symbole} remonté avant ${a.lignes[i - 1].symbole}`)
        .toBeGreaterThan(positions[i - 1]);
    }
  });

  it('⚠ le test mord : inverser les lignes le fait rougir', () => {
    const a = PERTE_MULTI_5.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');
    const inverse = {
      ...PERTE_MULTI_5,
      etape3: { action: { ...a, lignes: [...a.lignes].reverse() } },
    };
    const plat = platDe(pagePertes(inverse));
    expect(plat.indexOf(a.lignes[0].description ?? ''))
      .toBeGreaterThan(plat.indexOf(a.lignes[4].description ?? ''));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M3 · SABOTAGE « LE TOTAL EST RECALCULÉ DANS LA PAGE »
// ═══════════════════════════════════════════════════════════════════════════

const L = (symbole: string, q: number, vente: number, realise: number): LigneExecution => ({
  positionId: `FICT-Z|${symbole}`, compteId: 'FICT-Z', symbole,
  description: `${symbole} société fictive`, typeInstrument: 'Action',
  devise: 'CAD', uniteValeursRapport: 'CAD',
  quantiteDetenue: q * 4, quantiteAVendre: q, uniteQuantite: 'unite',
  valeurVenteEstimeeCad: vente, montantRealiseEstimeCad: realise,
  montantLatentDisponibleCad: realise * 2, dateValeurs: '2026-08-24',
});

const CONSTAT_CALCULE = {
  strategie: 'cristallisation-pertes', titre: 'T', titreClient: 'T',
  statut: 'calcule', portee: 'declaree', montantEstime: 9000,
  libelleMontant: 'de perte à cristalliser', recurrence: 'annuel',
  explication: '', donneesManquantes: [], sources: [],
  limiteVisibilite: null, dejaEnOrdre: false,
} as unknown as Constat;

describe('M3 · les totaux viennent du plan, jamais d’une somme refaite', () => {
  it('des totaux VOLONTAIREMENT INCOHÉRENTS ressortent tels quels', () => {
    // ⚠ C'EST LE TEST A8 APPLIQUÉ AU MULTI, ET IL EST DÉLIBÉRÉMENT ABSURDE.
    // 3 000 + 4 000 = 7 000, mais le plan déclare 9 999,99. Une page qui
    // « corrige » afficherait 7 000 — et deviendrait un second moteur fiscal,
    // avec ses arrondis et sans les garde-fous du premier.
    const lignes = [L('AAA', 10, 1000, 3000), L('BBB', 20, 2000, 4000)];
    const plan: PlanExecution = {
      sens: 'perte', cibleCad: 8000, lignes,
      valeurVenteTotaleCad: 55555.55,          // ≠ 3 000
      montantRealiseTotalCad: 9999.99,         // ≠ 7 000
      ecartCad: 1999.99, cibleRestanteCad: 0,
      capaciteCouvreCible: true, executionCouvreEntierementCible: true,
      monoTitre: false, gainNetApresCad: 0,
      rechercheTronquee: false, refus: [],
    };
    const plat = platDe(pagePertes(
      construirePresentationCristallisationPertes(CONSTAT_CALCULE, plan, 8000)));

    expect(plat).toContain('9 999,99');       // le total DÉCLARÉ
    expect(plat).toContain('55 555,55');      // la valeur de vente DÉCLARÉE
    expect(plat).not.toContain('7 000,00');   // la somme que personne n'a demandée
    expect(plat).not.toContain('3 000,00 $ ,'); // ni un recollage de lignes
  });

  it('aucune page fiscale ne réduit une liste de lignes', () => {
    // Le scan complète le test de valeurs : une somme peut être juste
    // aujourd'hui et fausse au prochain arrondi. On interdit le geste.
    for (const f of ['langage-fiscal.tsx', 'page-cristallisation-pertes.tsx',
      'page-cristallisation-gains.tsx']) {
      const source = fs.readFileSync(`src/lib/pdf/${f}`, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(source, `${f} : une somme est refaite dans la vue`)
        .not.toMatch(/lignes\s*\.\s*reduce/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M4 · SABOTAGE « LA QUANTITÉ EST REMPLACÉE »
// ═══════════════════════════════════════════════════════════════════════════

describe('M4 · c’est la quantité À VENDRE qui est affichée', () => {
  it('la quantité détenue n’apparaît jamais à sa place', () => {
    // La fixture détient le triple de ce qu'elle vend : si la vue se trompait
    // de champ, le conseiller passerait un ordre trois fois trop gros.
    const a = PERTE_MULTI_5.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');
    const plat = platDe(pagePertes(PERTE_MULTI_5));

    for (const l of a.lignes) {
      expect(l.quantiteDetenue).not.toBe(l.quantiteAVendre);   // la fixture est utile
      expect(plat, `${l.symbole} : quantité à vendre absente`)
        .toContain(`≈ ${nombre(l.quantiteAVendre)} `);
      expect(plat, `${l.symbole} : la quantité DÉTENUE est affichée`)
        .not.toContain(`≈ ${nombre(l.quantiteDetenue)} `);
    }
  });

  it('l’unité suit le type d’instrument, part par part', () => {
    const parts = [{ ...L('FDS', 125, 1500, 900), uniteQuantite: 'part' as const }];
    const plan: PlanExecution = {
      sens: 'perte', cibleCad: 900, lignes: [...parts, L('AAA', 10, 1000, 300)],
      valeurVenteTotaleCad: 2500, montantRealiseTotalCad: 1200,
      ecartCad: 300, cibleRestanteCad: 0, capaciteCouvreCible: true,
      executionCouvreEntierementCible: true, monoTitre: false, gainNetApresCad: 0,
      rechercheTronquee: false, refus: [],
    };
    const plat = platDe(pagePertes(
      construirePresentationCristallisationPertes(CONSTAT_CALCULE, plan, 900)));
    expect(plat).toContain('125 parts');
    expect(plat).toContain('10 actions');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M5 · SABOTAGE « LE LOGO DÉCLENCHE UN ACCÈS RÉSEAU »
// ═══════════════════════════════════════════════════════════════════════════

afterEach(() => { vi.restoreAllMocks(); });

describe('M5 · aucune sortie réseau, ni au rendu ni dans le code', () => {
  it('rendre une liste de 14 titres n’appelle jamais fetch', () => {
    const espion = vi.spyOn(globalThis, 'fetch' as never);
    textesDe(pagePertes(PERTE_MULTI_14));
    expect(espion).not.toHaveBeenCalled();
  });

  it('aucune source d’image n’est une URL — seulement des data:', () => {
    // ⚠ LA VRAIE PORTE DÉROBÉE. Un cache qui contiendrait une URL ferait
    // partir la requête depuis react-pdf, sans qu'un seul `fetch` apparaisse
    // dans notre code — et elle transporterait les symboles du client.
    const cache = { ALFA: 'data:image/png;base64,iVBORw0KGgo=' };
    const images = elements(
      <ListeTransactions
        lignes={[L('ALFA', 10, 100, 50), L('BRAVO', 5, 60, 20)]}
        couleur="#e05252" bord="#f3c9c9" libelleMontant="Perte réalisée estimée"
        valeurVenteTotaleCad={160} montantRealiseTotalCad={70}
        cibleCad={70} ecartCad={0} logos={cache} />
    ).filter((e) => e.type === Image);

    expect(images.length).toBe(1);                       // ALFA a son logo
    for (const im of images) {
      expect(String(im.props?.src)).toMatch(/^data:image\//);
    }
  });

  it('le module de logo n’a aucun chemin réseau', () => {
    const source = fs.readFileSync('src/lib/pdf/logo-societe-fiscal.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const interdit of [/\bfetch\s*\(/, /https?:\/\//, /XMLHttpRequest/]) {
      expect(source, `motif réseau ${interdit}`).not.toMatch(interdit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M6 · CHAQUE TITRE REÇOIT SON LOGO — et le repli n’est jamais un blanc
// ═══════════════════════════════════════════════════════════════════════════

describe('M6 · une identité visuelle par ligne', () => {
  it('sans cache, chaque ligne porte quand même sa pastille au ticker', () => {
    const lignes = [L('ALFA', 10, 100, 50), L('BRAVO', 5, 60, 20), L('CHARLI', 7, 70, 30)];
    const arbre = (
      <ListeTransactions lignes={lignes} couleur="#e05252" bord="#f3c9c9"
        libelleMontant="Perte réalisée estimée" valeurVenteTotaleCad={230}
        montantRealiseTotalCad={100} cibleCad={100} ecartCad={0} />
    );
    // Aucune image (pas de cache) — mais les trois tickers sont posés en texte
    // par la pastille de repli, en plus du nom de la ligne.
    expect(elements(arbre).filter((e) => e.type === Image).length).toBe(0);
    for (const l of lignes) {
      const occurrences = textesDe(arbre).filter((t) => t.includes(l.symbole.slice(0, 3)));
      expect(occurrences.length, `${l.symbole} : pastille ou nom manquant`)
        .toBeGreaterThanOrEqual(2);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M7 · SABOTAGE « L'ÉTAT DÉGRADÉ AFFICHE UNE TRANSACTION FERME »
// ═══════════════════════════════════════════════════════════════════════════

describe('M7 · un statut dégradé ne laisse passer aucun ordre', () => {
  it('aucune quantité, aucun total, aucun libellé de transaction', () => {
    const plat = platDe(pagePertes(PERTE_DEGRADEE));
    expect(plat).not.toContain('≈ ');                    // aucune quantité posée
    expect(plat).not.toContain('TRANSACTIONS À EFFECTUER');
    expect(plat).not.toContain('Perte réalisée estimée —');
    expect(plat).toContain('QUANTITÉ À CONFIRMER');
  });

  it('mais le CONTEXTE du titre reste visible — décision V12', () => {
    // ⚠ NE PAS « DURCIR » CE TEST EN EXIGEANT LA DISPARITION DU SYMBOLE. Ce
    // que le statut interdit, c'est l'ACTION ; le titre, sa devise et sa perte
    // latente restent des faits du dossier.
    expect(platDe(pagePertes(PERTE_DEGRADEE))).toContain('ALFA');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M8 · LES ÉTAPES 1 ET 2 EN MULTI — intentionnelles, et JAMAIS le repli
// ═══════════════════════════════════════════════════════════════════════════

describe('M8 · un plan calculé ne réclame pas les données qu’il a utilisées', () => {
  it('l’étape 2 en multi dit pourquoi plusieurs titres, sans repli dégradé', () => {
    // ⚠ LE DÉFAUT QUI A MOTIVÉ CE TEST ÉTAIT VISIBLE SUR PDF : un plan CALCULÉ
    // de cinq transactions affichait « Le titre à retenir sera déterminé une
    // fois les données du dossier confirmées ». Le document niait l'étape 3.
    const plat = platDe(pagePertes(PERTE_MULTI_5));
    expect(plat).not.toContain('sera déterminé une fois les données');
    expect(plat).toContain('Aucune position ne porte seule');
    expect(plat).toContain('Pourquoi ces titres ?');
  });

  it('l’étape 1 en multi ne montre ni faux ticker ni case vide', () => {
    const plat = platDe(pagePertes(PERTE_MULTI_5));
    expect(plat).toContain('Plusieurs positions peuvent contribuer');
    // La perte latente est une grandeur PAR TITRE : sans titre nommé, la case
    // n'a pas lieu d'être — et surtout pas sous la forme d'un tiret.
    expect(plat).not.toContain('Perte latente disponible');
    expect(plat).not.toContain('Compte —');
  });

  it('le mono reste la référence : il garde son titre et son compte', () => {
    const plat = platDe(pagePertes(PERTE_MONO));
    expect(plat).toContain('Pourquoi ce titre ?');
    expect(plat).toContain('Perte latente disponible');
    expect(plat).toContain('ACTION PROPOSÉE');
    expect(plat).not.toContain('Plusieurs positions peuvent contribuer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M9 · L'ÉCART N'EST PAS LA CIBLE RESTANTE
// ═══════════════════════════════════════════════════════════════════════════

describe('M9 · écart signé, cible restante jamais négative', () => {
  it('un dépassement donne un écart POSITIF et une restante NULLE', () => {
    const a = PERTE_MULTI_2.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');
    expect(a.ecartCad).toBeGreaterThan(0);
    expect(a.cibleRestanteCad).toBe(0);
    expect(platDe(pagePertes(PERTE_MULTI_2))).toContain('+1,23');
  });

  it('un plan SOUS la cible affiche un écart négatif, pas une restante négative', () => {
    const a = PERTE_MULTI_5.etape3.action;
    if (a.type !== 'ferme') throw new Error('fixture non ferme');
    expect(a.ecartCad).toBeLessThan(0);
    expect(a.cibleRestanteCad).toBeGreaterThanOrEqual(0);
  });

  it('aucune fixture ne porte une cible restante négative', () => {
    for (const p of [PERTE_MONO, PERTE_MULTI_2, PERTE_MULTI_5, PERTE_MULTI_14]) {
      const a = p.etape3.action;
      if (a.type === 'ferme') expect(a.cibleRestanteCad).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M10 · SABOTAGE « UNE TRANSACTION EST COUPÉE PAR UN SAUT DE PAGE »
// ═══════════════════════════════════════════════════════════════════════════

describe('M10 · une transaction ne se coupe pas en deux pages', () => {
  it('chaque ligne rendue porte wrap={false}', () => {
    const lignes = [L('AAA', 1, 1, 1), L('BBB', 2, 2, 2), L('CCC', 3, 3, 3)];
    const atomiques = elements(
      <ListeTransactions lignes={lignes} couleur="#e05252" bord="#f3c9c9"
        libelleMontant="Perte réalisée estimée" valeurVenteTotaleCad={6}
        montantRealiseTotalCad={6} cibleCad={6} ecartCad={0} />
    ).filter((e) => e.props?.wrap === false);
    expect(atomiques.length).toBe(lignes.length);
  });

  it('l’étape 3 peut se couper en multi, et SEULEMENT elle', () => {
    // ⚠ MESURÉ : à 14 transactions, une étape 3 non sécable partait entière à
    // la page suivante et laissait derrière elle une page aux deux tiers vide ;
    // au-delà d'une vingtaine, elle ne tiendrait sur AUCUNE page. Les autres
    // étapes gardent `wrap={false}` — leur hauteur, elle, est bornée.
    const secables = (p: Parameters<typeof pagePertes>[0]) =>
      elements(pagePertes(p))
        .filter((e) => typeof e.props?.numero === 'number' && e.props?.wrap === true)
        .map((e) => e.props?.numero);

    expect(secables(PERTE_MULTI_14)).toEqual([3]);
    expect(secables(PERTE_MONO)).toEqual([]);
    expect(secables(PERTE_DEGRADEE)).toEqual([]);
  });
});
