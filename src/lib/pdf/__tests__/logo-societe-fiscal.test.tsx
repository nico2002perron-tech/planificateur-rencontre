// LE LOGO FISCAL — présent ou remplacé, jamais absent, jamais réseau.
//
// Données fictives : symboles inventés, images en data URI minuscules.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import {
  LogoSocieteFiscal, tickerLisible, initialesTicker,
} from '../logo-societe-fiscal';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** Parcourt l'arbre en invoquant les composants — comme les tests PDF voisins. */
function noeuds(n: unknown, sortie: Array<{ type: unknown; props: Record<string, unknown> }> = []) {
  if (n === null || n === undefined || typeof n !== 'object') return sortie;
  if (Array.isArray(n)) { for (const x of n) noeuds(x, sortie); return sortie; }
  const el = n as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return sortie;
  if (typeof el.type === 'function') return noeuds((el.type as (p: unknown) => unknown)(el.props), sortie);
  sortie.push({ type: el.type, props: el.props });
  noeuds(el.props.children, sortie);
  return sortie;
}
const rendu = (p: Parameters<typeof LogoSocieteFiscal>[0]) =>
  noeuds(React.createElement(LogoSocieteFiscal, p));
const textes = (p: Parameters<typeof LogoSocieteFiscal>[0]) =>
  rendu(p).flatMap((n) => (typeof n.props.children === 'string' ? [n.props.children] : []));

afterEach(() => vi.restoreAllMocks());

describe('L1 · un logo mémorisé est rendu', () => {
  it('affiche l’image du cache', () => {
    const n = rendu({ symbole: 'XYZ', logos: { XYZ: PNG } });
    const image = n.find((x) => x.props.src !== undefined);
    expect(image).toBeDefined();
    expect(image!.props.src).toBe(PNG);
  });
});

describe('L2/L3 · sans logo, une pastille lisible — jamais un trou', () => {
  it('rend le ticker dans une pastille colorée', () => {
    const t = textes({ symbole: 'XYZ', logos: {} });
    expect(t).toContain('XYZ');
    // Aucune image : c'est bien le repli, pas une image cassée.
    expect(rendu({ symbole: 'XYZ', logos: {} }).some((x) => x.props.src !== undefined)).toBe(false);
  });

  it('le cache absent est un cas NORMAL, pas une erreur', () => {
    expect(textes({ symbole: 'XYZ' })).toContain('XYZ');
    expect(textes({ symbole: 'XYZ', logos: { AUTRE: PNG } })).toContain('XYZ');
  });

  it('la couleur est DÉTERMINISTE — le même titre garde sa teinte', () => {
    const couleur = (s: string) =>
      rendu({ symbole: s, logos: {} }).find((x) => x.props.style
        && (x.props.style as Record<string, unknown>).backgroundColor)?.props.style;
    expect(couleur('XYZ')).toEqual(couleur('XYZ'));
    // Deux titres différents ne partagent pas forcément la même teinte, mais
    // l'important est la STABILITÉ : un rendu à l'autre, elle ne bouge pas.
  });

  it('le suffixe de place boursière ne s’affiche pas au client', () => {
    expect(tickerLisible('GSY.TO')).toBe('GSY');
    expect(tickerLisible('ABC.V')).toBe('ABC');
    expect(tickerLisible('DEF.NE')).toBe('DEF');
    expect(textes({ symbole: 'GSY.TO', logos: {} })).toContain('GSY');
  });
});

describe('L5 · un symbole hostile ne fait pas tomber le rendu', () => {
  const hostiles = ['', '   ', '.TO', 'ABCDEFGHIJKLMNOP', '1USD', 'É'];
  for (const s of hostiles) {
    it(`« ${s || '(vide)'} » rend une pastille stable`, () => {
      const t = textes({ symbole: s, logos: {} });
      expect(t).toHaveLength(1);
      expect(t[0].length).toBeGreaterThan(0);      // jamais une pastille vide
      expect(t[0].length).toBeLessThanOrEqual(3);
    });
  }

  it('un symbole vide affiche un tiret plutôt que rien', () => {
    expect(initialesTicker('')).toBe('—');
    expect(initialesTicker('.TO')).toBe('—');
  });
});

describe('L4 · AUCUN appel réseau — la règle du volet fiscal', () => {
  it('ni fetch ni URL distante, avec ou sans logo en cache', () => {
    // `docs/sorties-reseau.md` : aucune sortie depuis le volet fiscal. Le
    // composant ne sait pas aller chercher un logo, et ce test l'atteste.
    const fetchEspion = vi.fn();
    vi.stubGlobal('fetch', fetchEspion);

    const cas: Array<Parameters<typeof LogoSocieteFiscal>[0]> = [
      { symbole: 'XYZ', logos: { XYZ: PNG } },
      { symbole: 'XYZ', logos: {} },
      { symbole: 'XYZ' },
    ];
    for (const p of cas) {
      const n = rendu(p);
      expect(fetchEspion).not.toHaveBeenCalled();
      // Aucune source distante : seules les données déjà résolues passent.
      for (const x of n) {
        const src = x.props.src;
        if (typeof src === 'string') {
          expect(src.startsWith('data:'), src.slice(0, 40)).toBe(true);
          expect(src).not.toMatch(/^https?:/);
          expect(src).not.toMatch(/financialmodelingprep/i);
        }
      }
    }
  });

  it('le module n’importe rien qui puisse sortir', async () => {
    // Défense en profondeur : le fichier lui-même ne mentionne aucun hôte.
    const fs = await import('node:fs/promises');
    const source = await fs.readFile('src/lib/pdf/logo-societe-fiscal.tsx', 'utf8');
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toMatch(/https?:\/\/(?!\S*docs)/);
    expect(source).not.toMatch(/financialmodelingprep/i);
  });
});
