// Le chemin qui fait fondre les 75 % de bornes — et les gardes qui empêchent
// de le prendre trop vite. Noms fictifs : ces tests partent sur GitHub.
import { describe, it, expect } from 'vitest';
import { profilVierge, cleTransfert, type ProfilClient } from '../types';
import {
  croiserTransferts,
  resteUnDouteTransfert,
  calculerDroitsCeli,
  type TransfertObserve,
} from '../droits-celi';

const PLAFOND = 102_000;          // plafond cumulatif théorique, fourni par les paramètres

/** Un profil dont TOUT est en règle sauf ce qu'on veut tester. */
function profilPret(): ProfilClient {
  const p = profilVierge('9999', '2026-08-04');
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = '2026-08-04';
  p.historiqueVie.celi = {
    dateOuverture: '2015-03-12',
    cotisationsTotales: 62_000,
    retraitsAnneesPassees: 8_000,
    transfertEntrantDetecte: false,
    dateImport: '2026-08-04',
    portee: 'interne-seulement',
  };
  return p;
}

const orphelin = (montant = 40_000, date = '2021-03-15'): TransfertObserve => ({
  compte: '37-TEST-W', date, montant, apparie: false, note: '',
});

describe('croiserTransferts — le parseur rencontre les décisions du planificateur', () => {
  it('ne retient que les transferts NON appariés automatiquement', () => {
    const observes: TransfertObserve[] = [
      { compte: '37-TEST-W', date: '2020-01-05', montant: 25_000, apparie: true, note: 'TRANSFERE A 37-TEST-S' },
      orphelin(),
    ];
    const d = croiserTransferts(observes, []);
    expect(d).toHaveLength(1);
    expect(d[0].montant).toBe(40_000);
    expect(d[0].resolution).toBeNull();
  });

  it('retrouve une résolution par sa clé stable', () => {
    const d = croiserTransferts([orphelin()], [{
      cle: cleTransfert('37-TEST-W', '2021-03-15', 40_000),
      compte: '37-TEST-W', date: '2021-03-15', montant: 40_000,
      resolution: 'interne', dateConfirmation: '2026-08-04',
      note: 'venait de son REER',
    }]);
    expect(d[0].resolution).toBe('interne');
    expect(d[0].dateConfirmation).toBe('2026-08-04');
  });

  it('un transfert « interne » lève le doute, un « externe » ne le lève pas', () => {
    const base = croiserTransferts([orphelin()], []);
    expect(resteUnDouteTransfert(base)).toBe(true);

    const interne = base.map((t) => ({ ...t, resolution: 'interne' as const }));
    expect(resteUnDouteTransfert(interne)).toBe(false);

    const externe = base.map((t) => ({ ...t, resolution: 'externe' as const }));
    expect(resteUnDouteTransfert(externe)).toBe(true);
  });
});

describe('calculerDroitsCeli — les trois conditions du schéma', () => {
  it('CALCULE quand les trois conditions sont réunies', () => {
    const r = calculerDroitsCeli(profilPret(), [], PLAFOND);
    expect(r.statut).toBe('calcule');
    expect(r.portee).toBe('complete');
    // 102 000 − 62 000 cotisés + 8 000 retirés les années passées
    expect(r.montant).toBe(48_000);
    expect(r.conditionsManquantes).toEqual([]);
  });

  it('BORNE tant qu’un transfert orphelin n’est pas tranché', () => {
    const douteux = croiserTransferts([orphelin()], []);
    const r = calculerDroitsCeli(profilPret(), douteux, PLAFOND);
    expect(r.statut).toBe('montant-a-confirmer');
    expect(r.montant).toBeNull();
    expect(r.borne).toBe(48_000);
    expect(r.transfertsATrancher).toBe(1);
    expect(r.conditionsManquantes[0]).toContain('1 transfert');
  });

  it('LE LEVIER : marquer le transfert « interne » rend le calcul possible', () => {
    const observes = [orphelin()];
    const avant = calculerDroitsCeli(profilPret(), croiserTransferts(observes, []), PLAFOND);
    expect(avant.statut).toBe('montant-a-confirmer');

    const apres = calculerDroitsCeli(
      profilPret(),
      croiserTransferts(observes, [{
        cle: cleTransfert('37-TEST-W', '2021-03-15', 40_000),
        compte: '37-TEST-W', date: '2021-03-15', montant: 40_000,
        resolution: 'interne', dateConfirmation: '2026-08-04', note: null,
      }]),
      PLAFOND
    );
    expect(apres.statut).toBe('calcule');
    expect(apres.montant).toBe(48_000);
  });

  it('un transfert confirmé EXTERNE garde la borne et le dit clairement', () => {
    const r = calculerDroitsCeli(
      profilPret(),
      croiserTransferts([orphelin()], [{
        cle: cleTransfert('37-TEST-W', '2021-03-15', 40_000),
        compte: '37-TEST-W', date: '2021-03-15', montant: 40_000,
        resolution: 'externe', dateConfirmation: '2026-08-04', note: 'CELI Banque X',
      }]),
      PLAFOND
    );
    expect(r.statut).toBe('montant-a-confirmer');
    expect(r.conditionsManquantes).toContain('un transfert entrant est confirmé externe');
    expect(r.transfertsATrancher).toBe(0);   // tranché, mais dans le mauvais sens
  });

  it('BORNE si l’historique n’a pas été importé', () => {
    const p = profilPret();
    p.historiqueVie.celi.dateImport = null;
    const r = calculerDroitsCeli(p, [], PLAFOND);
    expect(r.statut).toBe('montant-a-confirmer');
    expect(r.conditionsManquantes[0]).toContain("historique complet");
  });

  it('BORNE tant que le client n’a pas confirmé n’avoir eu aucun compte ailleurs', () => {
    const p = profilPret();
    p.consolidation.historiqueExterne = 'inconnu';
    expect(calculerDroitsCeli(p, [], PLAFOND).statut).toBe('montant-a-confirmer');

    p.consolidation.historiqueExterne = 'deja-eu';
    const r = calculerDroitsCeli(p, [], PLAFOND);
    expect(r.conditionsManquantes).toContain('le client a déjà eu des comptes ailleurs');
  });

  it('INDISPONIBLE sans plafond — jamais un chiffre inventé', () => {
    const r = calculerDroitsCeli(profilPret(), [], null);
    expect(r.statut).toBe('indisponible');
    expect(r.montant).toBeNull();
    expect(r.borne).toBeNull();
  });

  it('ne rend jamais une borne négative', () => {
    const p = profilPret();
    p.historiqueVie.celi.cotisationsTotales = 150_000;   // sur-cotisé
    p.historiqueVie.celi.retraitsAnneesPassees = 0;
    expect(calculerDroitsCeli(p, [], PLAFOND).montant).toBe(0);
  });
});
