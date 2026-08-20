// LA PHASE TÉMOIN — l'infrastructure d'observation, vérifiée elle-même.
//
// Un comparateur qui classe mal est pire que pas de comparateur : il endort.
// Ce fichier tient donc surtout LE FILET — qu'un écart inexpliqué sorte bien
// `non-classee`, et que `non-classee` bloque la bascule au même titre qu'une
// régression. Plus la garantie que le journal ne porte rien de nominatif.
import { describe, it, expect } from 'vitest';
import {
  comparerVerdictsCeli, ligneJournalTemoin, agregerTemoin, idDossierAnonyme,
  comparerPassages, dernierPassage, passagePrecedent,
  type RapportTemoin,
} from '../temoin-celi';
import type { HistoriqueRegime } from '../types';
import type { ResultatDroitsCeli } from '../droits-celi';
import type { HistoriqueCeliFiscal } from '../droits-celi-fiscal';

const CONTEXTE_PROPRE: RapportTemoin['contexte'] = {
  evenementsBloquants: 0, devisesNonResolues: false,
  virementsOrphelins: 0, inconnusAImpact: 0, anneesCouvertes: 2,
};

const ancienHist = (over: Partial<HistoriqueRegime> = {}): HistoriqueRegime => ({
  dateOuverture: '2020-01-01', cotisationsTotales: 7000, retraitsAnneesPassees: 0,
  transfertEntrantDetecte: false, dateImport: '2026-08-20', portee: 'interne-seulement',
  ...over,
});

const ancienDroits = (over: Partial<ResultatDroitsCeli> = {}): ResultatDroitsCeli => ({
  statut: 'calcule', portee: 'complete', montant: 95000, borne: 95000,
  conditionsManquantes: [], transfertsATrancher: 0,
  ...over,
});

const nouveau = (over: Partial<HistoriqueCeliFiscal> = {}, completude: Partial<HistoriqueCeliFiscal['completude']> = {}): HistoriqueCeliFiscal => ({
  parAnnee: {},
  cotisations: { min: 7000, max: 7000 },
  retraitsAnneesPassees: { min: 0, max: 0 },
  droitMinimum: 95000, droitMaximum: 95000,
  statut: 'calcule', raisons: [], donneesManquantes: [],
  completude: {
    evenementsBloquants: 0, montantPotentielCotisation: 0, montantPotentielRetrait: 0,
    devisesNonResolues: false, naturesNonResolues: false, porteeExterne: 'interne-seulement',
    ...completude,
  },
  versHistoriqueRegime: {
    dateOuverture: '2020-01-01', cotisationsTotales: 7000, retraitsAnneesPassees: 0,
    transfertEntrantDetecte: null, dateImport: '2026-08-20', portee: 'interne-seulement',
  },
  ...over,
});

describe('le comparateur de phase témoin', () => {
  it('deux chaînes identiques : parité sur tous les champs', () => {
    const r = comparerVerdictsCeli('Dossier Fictif', ancienHist(), ancienDroits(), nouveau(), CONTEXTE_PROPRE);
    expect(r.classe).toBe('parite');
    expect(r.champs.every((c) => c.identiques)).toBe(true);
  });

  it('D5 · l’ancien fond la devise : « bug-ancien-corrige », jamais autre chose', () => {
    const r = comparerVerdictsCeli('Dossier Fictif',
      ancienHist({ cotisationsTotales: 12000 }),
      ancienDroits({ statut: 'calcule' }),
      nouveau({ statut: 'montant-a-confirmer' }, { devisesNonResolues: true }),
      { ...CONTEXTE_PROPRE, devisesNonResolues: true });
    const cot = r.champs.find((c) => c.champ === 'cotisationsTotales')!;
    expect(cot.classe).toBe('bug-ancien-corrige');
    expect(cot.motif).toMatch(/D5/);
    const statut = r.champs.find((c) => c.champ === 'statut')!;
    expect(statut.classe).toBe('bug-ancien-corrige');
  });

  it('LE FILET · un écart qu’aucune explication ne couvre sort « non-classee »', () => {
    // Le nouveau compte PLUS que l'ancien, sans devise ni nature ouverte :
    // rien ne l'explique. C'est exactement le cas du « Retrait positif ».
    const r = comparerVerdictsCeli('Dossier Fictif',
      ancienHist({ cotisationsTotales: 7000 }),
      ancienDroits(),
      nouveau({ versHistoriqueRegime: { ...nouveau().versHistoriqueRegime, cotisationsTotales: 16000 } }),
      CONTEXTE_PROPRE);
    const cot = r.champs.find((c) => c.champ === 'cotisationsTotales')!;
    expect(cot.classe).toBe('non-classee');
    expect(cot.motif).toMatch(/aucune explication connue/);
    expect(r.classe).toBe('non-classee');
  });

  it('LA GRAVITÉ COMMANDE : une seule non-classée l’emporte sur trois explications', () => {
    const r = comparerVerdictsCeli('Dossier Fictif',
      ancienHist({ cotisationsTotales: 12000, retraitsAnneesPassees: 5000 }),
      ancienDroits({ borne: 90000 }),
      nouveau(
        { droitMaximum: 99000, versHistoriqueRegime: { ...nouveau().versHistoriqueRegime, cotisationsTotales: 20000, retraitsAnneesPassees: 0 } },
        { devisesNonResolues: true },
      ),
      { ...CONTEXTE_PROPRE, devisesNonResolues: true });
    // retraits : l'ancien > le nouveau avec devise ouverte → expliqué ;
    // cotisations : le nouveau > l'ancien → inexpliqué.
    expect(r.champs.find((c) => c.champ === 'retraitsAnneesPassees')!.classe).toBe('bug-ancien-corrige');
    expect(r.champs.find((c) => c.champ === 'cotisationsTotales')!.classe).toBe('non-classee');
    expect(r.classe).toBe('non-classee');
  });

  it('le nouveau, plus exigeant, refuse un ferme que l’ancien accordait : ambiguïté VOLONTAIRE', () => {
    const r = comparerVerdictsCeli('Dossier Fictif', ancienHist(), ancienDroits(),
      nouveau({ statut: 'montant-a-confirmer', droitMinimum: null, droitMaximum: null }, { evenementsBloquants: 3 }),
      { ...CONTEXTE_PROPRE, evenementsBloquants: 3 });
    expect(r.champs.find((c) => c.champ === 'statut')!.classe).toBe('ambiguite-volontaire');
    expect(r.classe).toBe('ambiguite-volontaire');
  });
});

describe('le journal — non nominatif par construction', () => {
  it('l’identifiant est stable, tronqué, et ne contient pas le nom', () => {
    const nom = 'Tremblaysecret, Jean';
    const id = idDossierAnonyme(nom);
    expect(id).toHaveLength(10);
    expect(id).toBe(idDossierAnonyme(nom));                      // stable
    expect(id).not.toBe(idDossierAnonyme('Autre, Personne'));    // distinctif
    expect(id.toUpperCase()).not.toMatch(/TREMBLAY|JEAN/);
  });

  it('AUCUN NOM ne traverse le journal, et les montants ne sortent QUE sur une divergence', () => {
    const propre = comparerVerdictsCeli('Tremblaysecret, Jean', ancienHist(), ancienDroits(), nouveau(), CONTEXTE_PROPRE);
    const l = ligneJournalTemoin(propre, ancienDroits(), nouveau(), '2026-08-20');
    expect(JSON.stringify(l).toUpperCase()).not.toMatch(/TREMBLAY|JEAN/);
    expect(l.classe).toBe('parite');
    expect(l.ancienMontant).toBeNull();                          // une parité n'a rien à dire
    expect(l.nouveauMontant).toBeNull();

    const divergent = comparerVerdictsCeli('Tremblaysecret, Jean',
      ancienHist({ cotisationsTotales: 12000 }), ancienDroits(),
      nouveau({ statut: 'montant-a-confirmer' }, { devisesNonResolues: true }),
      { ...CONTEXTE_PROPRE, devisesNonResolues: true });
    const ld = ligneJournalTemoin(divergent, ancienDroits(), nouveau({ statut: 'montant-a-confirmer' }), '2026-08-20');
    expect(ld.ancienMontant).toBe(95000);                        // là, oui : c'est le sujet
    expect(ld.motif).toContain('cotisationsTotales');
    expect(JSON.stringify(ld).toUpperCase()).not.toMatch(/TREMBLAY/);
  });
});

describe('les statistiques cumulées et le seuil de bascule', () => {
  const ligne = (over: Partial<ReturnType<typeof ligneJournalTemoin>>) => ({
    date: '2026-08-20', versionMoteur: 'test', dossier: 'aaaa000000',
    classe: 'parite' as const, ancienStatut: 'calcule', nouveauStatut: 'calcule',
    ancienMontant: null, nouveauMontant: null, evenementsBloquants: 0,
    devisesEtrangeres: 0, virementsOrphelins: 0, inconnusAImpact: 0, motif: 'aucun écart',
    ...over,
  });

  it('le taux de parité et la couverture se comptent', () => {
    const s = agregerTemoin([
      ligne({}),
      ligne({ dossier: 'bbbb', classe: 'ambiguite-volontaire', devisesEtrangeres: 1, evenementsBloquants: 3 }),
      ligne({ dossier: 'cccc', classe: 'ambiguite-volontaire', virementsOrphelins: 4, evenementsBloquants: 2 }),
      ligne({ dossier: 'dddd', classe: 'bug-ancien-corrige', devisesEtrangeres: 1, evenementsBloquants: 1 }),
    ]);
    expect(s.dossiers).toBe(4);
    expect(s.tauxParite).toBe(25);
    expect(s.couverture).toEqual({ avecUsd: 2, avecVirementsOrphelins: 1, avecInconnusAImpact: 0, dossiersPropres: 1 });
    expect(s.basculePossible).toBe(true);
  });

  it('UNE régression suffit à interdire la bascule', () => {
    const s = agregerTemoin([ligne({}), ligne({ dossier: 'bbbb', classe: 'regression' })]);
    expect(s.basculePossible).toBe(false);
  });

  it('UNE non-classée aussi — un écart qu’on ne sait pas nommer bloque autant', () => {
    const s = agregerTemoin([ligne({}), ligne({ dossier: 'bbbb', classe: 'non-classee' })]);
    expect(s.basculePossible).toBe(false);
  });

  it('un dossier PROPRE qui n’est pas en parité interdit la bascule', () => {
    // §16 : une divergence sur un cas propre est une régression jusqu'à preuve
    // du contraire — même si le classement l'a rangée ailleurs.
    const s = agregerTemoin([ligne({ classe: 'ambiguite-volontaire' })]);
    expect(s.parClasse.regression).toBe(0);
    expect(s.basculePossible).toBe(false);
  });

  it('un journal vide ne prétend rien', () => {
    const s = agregerTemoin([]);
    expect(s.dossiers).toBe(0);
    expect(s.tauxParite).toBe(0);
  });
});

// ═══ LA MÉMOIRE DU TÉMOIN — ce qui a bougé entre deux versions ══════════════
describe('comparaison de passages — voir apparaître et disparaître', () => {
  const l = (dossier: string, classe: string, over: Record<string, unknown> = {}) => ({
    date: '2026-08-20', versionMoteur: 'v1', dossier, classe,
    ancienStatut: 'calcule', nouveauStatut: 'calcule', ancienMontant: null, nouveauMontant: null,
    evenementsBloquants: 0, devisesEtrangeres: 0, virementsOrphelins: 0, inconnusAImpact: 0,
    motif: 'x', ...over,
  }) as never;

  it('une divergence qui APPARAÎT est signalée', () => {
    const c = comparerPassages([l('aaa', 'parite')], [l('aaa', 'regression', { versionMoteur: 'v2' })]);
    expect(c.evolutions[0].mouvement).toBe('apparue');
    expect(c.aExaminer).toHaveLength(1);
    expect(c.versionAvant).toBe('v1');
    expect(c.versionApres).toBe('v2');
  });

  it('une divergence qui DISPARAÎT est signalée AUSSI — un silence accidentel vaut moins que rien', () => {
    const c = comparerPassages([l('aaa', 'regression')], [l('aaa', 'parite', { versionMoteur: 'v2' })]);
    expect(c.evolutions[0].mouvement).toBe('disparue');
    expect(c.aExaminer).toHaveLength(1);
  });

  it('une aggravation et une amélioration se distinguent', () => {
    const agg = comparerPassages([l('aaa', 'ambiguite-volontaire')], [l('aaa', 'regression')]);
    expect(agg.evolutions[0].mouvement).toBe('aggravee');
    const amel = comparerPassages([l('aaa', 'regression')], [l('aaa', 'ambiguite-volontaire')]);
    expect(amel.evolutions[0].mouvement).toBe('amelioree');
  });

  it('un dossier stable ou nouveau n’encombre pas la liste à examiner', () => {
    const c = comparerPassages(
      [l('aaa', 'ambiguite-volontaire')],
      [l('aaa', 'ambiguite-volontaire'), l('bbb', 'parite')],
    );
    expect(c.evolutions.map((e) => e.mouvement).sort()).toEqual(['nouveau-dossier', 'stable']);
    expect(c.aExaminer).toHaveLength(0);
  });

  it('un dossier qui DISPARAÎT du lot est signalé — on ne perd pas un témoin en silence', () => {
    const c = comparerPassages([l('aaa', 'parite'), l('bbb', 'parite')], [l('aaa', 'parite')]);
    expect(c.evolutions.find((e) => e.dossier === 'bbb')!.mouvement).toBe('dossier-absent');
    expect(c.aExaminer).toHaveLength(1);
  });

  it('les passages se découpent par date ET par version du moteur', () => {
    const journal = [
      l('aaa', 'parite', { date: '2026-08-19', versionMoteur: 'v1' }),
      l('bbb', 'parite', { date: '2026-08-19', versionMoteur: 'v1' }),
      l('aaa', 'regression', { date: '2026-08-20', versionMoteur: 'v2' }),
    ];
    expect(dernierPassage(journal)).toHaveLength(1);
    expect(passagePrecedent(journal)).toHaveLength(2);
    const c = comparerPassages(passagePrecedent(journal), dernierPassage(journal));
    expect(c.evolutions.find((e) => e.dossier === 'aaa')!.mouvement).toBe('apparue');
  });

  it('un journal d’un seul passage n’invente pas de comparaison', () => {
    const journal = [l('aaa', 'parite')];
    expect(passagePrecedent(journal)).toEqual([]);
    expect(comparerPassages([], journal).aExaminer).toHaveLength(0);
  });
});
