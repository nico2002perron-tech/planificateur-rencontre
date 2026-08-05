import { describe, it, expect } from 'vitest';
import { profilVierge } from '../types';
import { badgesProfil, questionsRencontre, resumeBadges } from '../badges';

const AUJOURDHUI = '2026-08-04';
const badge = (profil: Parameters<typeof badgesProfil>[0], champ: string) =>
  badgesProfil(profil, AUJOURDHUI).find((b) => b.champ === champ)!;

/**
 * PIÈGE : `toLocaleString('fr-CA')` sépare les milliers par une ESPACE
 * INSÉCABLE ÉTROITE (U+202F), pas par une espace ordinaire. « 48 000 $ » écrit
 * au clavier et « 48 000 $ » produit par le formateur sont visuellement
 * identiques et différents à l'octet. On normalise donc avant de comparer.
 */
const espaces = (s: string | null) => (s ?? '').replace(/[  \s]+/g, ' ');

describe('badgesProfil — trois couleurs, une règle chacune', () => {
  it('un profil vierge n’a que du gris (sauf les dérivés à zéro)', () => {
    const r = resumeBadges(badgesProfil(profilVierge('4471', AUJOURDHUI), AUJOURDHUI));
    expect(r.manuel).toBe(0);
    expect(r.manquant).toBeGreaterThan(5);
  });

  it('un champ saisi devient jaune et porte sa date', () => {
    const p = profilVierge('4471', AUJOURDHUI);
    p.droits.celiInutilises = { montant: 48000, dateDonnee: '2026-07-01' };
    const b = badge(p, 'droits.celiInutilises');
    expect(b.couleur).toBe('manuel');
    expect(espaces(b.valeur)).toBe('48 000 $');
    expect(b.date).toBe('2026-07-01');
    expect(b.aReconfirmer).toBe(false);
    expect(b.question).toBeNull();
  });

  it('passé 12 mois, la donnée manuelle demande une reconfirmation', () => {
    const p = profilVierge('4471', AUJOURDHUI);
    p.droits.celiInutilises = { montant: 48000, dateDonnee: '2025-08-04' };
    expect(badge(p, 'droits.celiInutilises').aReconfirmer).toBe(true);

    p.droits.celiInutilises = { montant: 48000, dateDonnee: '2025-09-04' };
    expect(badge(p, 'droits.celiInutilises').aReconfirmer).toBe(false);
  });

  it('un champ dérivé de Croesus est vert, jamais jaune', () => {
    const p = profilVierge('4471', AUJOURDHUI);
    p.historiqueVie.celi = {
      dateOuverture: '2015-03-12', cotisationsTotales: 62000,
      retraitsAnneesPassees: 8000, transfertEntrantDetecte: false,
      dateImport: AUJOURDHUI, portee: 'interne-seulement',
    };
    const b = badge(p, 'historiqueVie.celi');
    expect(b.couleur).toBe('auto');
    expect(espaces(b.valeur)).toContain('62 000 $');
    expect(espaces(b.valeur)).toContain('2015-03-12');
  });

  it('les transferts tranchés ont leur propre badge — c’est le levier', () => {
    const p = profilVierge('4471', AUJOURDHUI);
    expect(badge(p, 'consolidation.transfertsResolus').couleur).toBe('manquant');

    p.consolidation.transfertsResolus = [{
      cle: '37-FICT-W|2021-03-15|40000.00', compte: '37-FICT-W', date: '2021-03-15',
      montant: 40000, resolution: 'interne', dateConfirmation: AUJOURDHUI, note: null,
    }];
    const b = badge(p, 'consolidation.transfertsResolus');
    expect(b.couleur).toBe('manuel');
    expect(b.valeur).toBe('1 confirmé');
    expect(b.question).toBeNull();
  });
});

describe('questionsRencontre — ordonnées par impact', () => {
  it('la consolidation passe avant les droits, puis le conjoint, puis le reste', () => {
    const q = questionsRencontre(badgesProfil(profilVierge('4471', AUJOURDHUI), AUJOURDHUI));
    expect(q[0]).toContain('comptes de placement ailleurs');
    const iDroits = q.findIndex((x) => x.includes('droits REER'));
    const iConjoint = q.findIndex((x) => x.includes('votre conjoint'));
    expect(iDroits).toBeGreaterThan(0);
    expect(iConjoint).toBeGreaterThan(iDroits);
  });

  it('un champ rempli disparaît de la liste des questions', () => {
    const p = profilVierge('4471', AUJOURDHUI);
    const avant = questionsRencontre(badgesProfil(p, AUJOURDHUI)).length;
    p.consolidation.comptesExternes = 'non';
    p.consolidation.dateConfirmation = AUJOURDHUI;
    expect(questionsRencontre(badgesProfil(p, AUJOURDHUI)).length).toBe(avant - 1);
  });
});
