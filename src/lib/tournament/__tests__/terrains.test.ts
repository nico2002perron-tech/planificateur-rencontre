import { describe, it, expect } from 'vitest';
import {
  SPORTS,
  SPORT_PAR_DEFAUT,
  normaliserSport,
  libelleTerrain,
  nomTerrain,
  schemaTerrain,
  nombreTerrains,
  construireGrilleTerrains,
  construireGrilleParJour,
  journeeCourante,
  SCHEMA_LARGEUR,
  SCHEMA_HAUTEUR,
  type PartiePlacable,
} from '../terrains';

/** Partie minimale : le terrain et l'heure suffisent à la placer. */
function p(court: number, heure: string, extra: Partial<PartiePlacable> & { id?: string } = {}) {
  return { id: `${court}-${heure}`, court, scheduled_time: heure, ...extra };
}

describe('sports', () => {
  it('retombe sur la balle molle pour toute valeur inconnue', () => {
    expect(normaliserSport(undefined)).toBe(SPORT_PAR_DEFAUT);
    expect(normaliserSport(null)).toBe(SPORT_PAR_DEFAUT);
    expect(normaliserSport('curling')).toBe(SPORT_PAR_DEFAUT);
    expect(SPORT_PAR_DEFAUT).toBe('balle-molle');
  });

  it('garde un sport connu', () => {
    expect(normaliserSport('volleyball')).toBe('volleyball');
  });

  it('donne un schéma non vide, dans la boîte, pour chaque sport offert', () => {
    for (const sport of SPORTS) {
      const s = schemaTerrain(sport.id);
      expect(s.formes.length, sport.id).toBeGreaterThan(0);
      expect(s.largeur).toBe(SCHEMA_LARGEUR);
      expect(s.hauteur).toBe(SCHEMA_HAUTEUR);
      // Aucune forme ne doit déborder franchement du cadre (marge de 4 pour les
      // buts de soccer, volontairement posés sur la ligne de fond).
      for (const f of s.formes) {
        const xs: number[] = [];
        const ys: number[] = [];
        if (f.forme === 'rect') { xs.push(f.x, f.x + f.l); ys.push(f.y, f.y + f.h); }
        if (f.forme === 'ligne') { xs.push(f.x1, f.x2); ys.push(f.y1, f.y2); }
        if (f.forme === 'cercle') { xs.push(f.cx - f.r, f.cx + f.r); ys.push(f.cy - f.r, f.cy + f.r); }
        for (const x of xs) expect(x, `${sport.id} x`).toBeGreaterThanOrEqual(-4);
        for (const x of xs) expect(x, `${sport.id} x`).toBeLessThanOrEqual(SCHEMA_LARGEUR + 4);
        for (const y of ys) expect(y, `${sport.id} y`).toBeGreaterThanOrEqual(-4);
        for (const y of ys) expect(y, `${sport.id} y`).toBeLessThanOrEqual(SCHEMA_HAUTEUR + 4);
      }
    }
  });
});

describe('nom des terrains', () => {
  it('numérote en lettres', () => {
    expect(libelleTerrain(1)).toBe('A');
    expect(libelleTerrain(2)).toBe('B');
    expect(libelleTerrain(26)).toBe('Z');
    expect(nomTerrain(2)).toBe('Terrain B');
  });

  it('retombe sur le numéro au-delà de 26', () => {
    expect(libelleTerrain(27)).toBe('27');
  });
});

describe('grille par terrain', () => {
  it('sépare les terrains au lieu de les condenser', () => {
    const g = construireGrilleTerrains([p(1, '09:00'), p(2, '09:00'), p(1, '09:30')], 2);
    expect(g.heures).toEqual(['09:00', '09:30']);
    expect(g.colonnes).toHaveLength(2);
    expect(g.colonnes[0].libelle).toBe('A');
    expect(g.colonnes[1].libelle).toBe('B');
    expect(g.colonnes[0].nbParties).toBe(2);
    expect(g.colonnes[1].nbParties).toBe(1);
  });

  it('laisse un trou aligné quand un terrain est libre', () => {
    const g = construireGrilleTerrains([p(1, '09:00'), p(2, '09:00'), p(1, '09:30')], 2);
    // Terrain B n'a rien à 09:30 : la case existe et elle est vide.
    expect(g.colonnes[1].cases).toHaveLength(2);
    expect(g.colonnes[1].cases[1]).toEqual([]);
    // …et elle est à la même hauteur que la partie du terrain A.
    expect(g.colonnes[0].cases[1]).toHaveLength(1);
  });

  it('trie les heures chronologiquement et range les parties sans heure à la fin', () => {
    const g = construireGrilleTerrains([p(1, '13:00'), p(1, ''), p(1, '09:00')], 1);
    expect(g.heures).toEqual(['09:00', '13:00', '—']);
    expect(g.colonnes[0].cases[2]).toHaveLength(1);
  });

  it('montre toujours autant de colonnes que la config le demande', () => {
    const g = construireGrilleTerrains([p(1, '09:00')], 3);
    expect(g.colonnes).toHaveLength(3);
    expect(g.colonnes[2].nbParties).toBe(0);
    expect(g.colonnes[2].cases[0]).toEqual([]);
  });

  it('ajoute une colonne pour une partie déplacée à la main hors config', () => {
    expect(nombreTerrains([p(4, '09:00')], 2)).toBe(4);
    const g = construireGrilleTerrains([p(1, '09:00'), p(4, '09:00')], 2);
    expect(g.colonnes).toHaveLength(4);
    expect(g.colonnes[3].nbParties).toBe(1);
  });

  it('n’escamote jamais une partie en conflit (même terrain, même heure)', () => {
    const g = construireGrilleTerrains([p(1, '09:00', { id: 'x' }), p(1, '09:00', { id: 'y' })], 2);
    expect(g.colonnes[0].cases[0]).toHaveLength(2);
    expect(g.colonnes[0].nbParties).toBe(2);
  });

  it('supporte un terrain à 0 ou absurde sans planter', () => {
    const g = construireGrilleTerrains([{ court: 0, scheduled_time: '09:00' }], 2);
    expect(g.colonnes[0].cases[0]).toHaveLength(1);
  });
});

describe('grille par journée', () => {
  it('regroupe et trie les journées', () => {
    const g = construireGrilleParJour(
      [
        p(1, '09:00', { scheduled_date: '2026-08-15' }),
        p(2, '18:00', { scheduled_date: '2026-08-14' }),
        p(1, '19:00', { scheduled_date: '2026-08-14' }),
      ],
      2,
    );
    expect(g.map(j => j.date)).toEqual(['2026-08-14', '2026-08-15']);
    expect(g[0].grille.heures).toEqual(['18:00', '19:00']);
    expect(g[1].grille.heures).toEqual(['09:00']);
  });

  it('rattache les parties sans date à la journée de l’événement', () => {
    const g = construireGrilleParJour([p(1, '09:00')], 2, '2026-08-14');
    expect(g).toHaveLength(1);
    expect(g[0].date).toBe('2026-08-14');
  });
});

describe('journée en cours', () => {
  const vendredi = '2026-08-14';
  const samedi = '2026-08-15';

  it('ouvre sur la journée de la première partie à jouer', () => {
    const ms = [
      p(1, '18:00', { scheduled_date: vendredi, status: 'finished' }),
      p(1, '19:00', { scheduled_date: vendredi, status: 'finished' }),
      p(1, '09:00', { scheduled_date: samedi, status: 'scheduled' }),
    ];
    expect(journeeCourante(ms)).toBe(samedi);
  });

  it('reste au vendredi tant qu’il y reste une partie', () => {
    const ms = [
      p(1, '18:00', { scheduled_date: vendredi, status: 'finished' }),
      p(2, '18:00', { scheduled_date: vendredi, status: 'scheduled' }),
      p(1, '09:00', { scheduled_date: samedi, status: 'scheduled' }),
    ];
    expect(journeeCourante(ms)).toBe(vendredi);
  });

  it('ignore les parties annulées', () => {
    const ms = [
      p(1, '18:00', { scheduled_date: vendredi, status: 'cancelled' }),
      p(1, '09:00', { scheduled_date: samedi, status: 'scheduled' }),
    ];
    expect(journeeCourante(ms)).toBe(samedi);
  });

  it('reste sur la dernière journée quand tout est joué', () => {
    const ms = [
      p(1, '18:00', { scheduled_date: vendredi, status: 'finished' }),
      p(1, '09:00', { scheduled_date: samedi, status: 'finished' }),
    ];
    expect(journeeCourante(ms)).toBe(samedi);
  });

  it('retombe sur la date de l’événement quand il n’y a pas de partie', () => {
    expect(journeeCourante([], vendredi)).toBe(vendredi);
  });
});
