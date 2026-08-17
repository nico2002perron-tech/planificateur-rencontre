// LES GESTES ET « DÉJÀ EN ORDRE ».
import { describe, it, expect } from 'vitest';
import { gestesDe, estDejaEnOrdre } from '../demarches';
import { analyser } from '../strategies';
import { profilVierge, type ProfilClient, type Position } from '../types';

const DATE = '2026-08-05';
const pos = (s: string, vm: number | null, pbr: number | null): Position =>
  ({ symbole: s, devise: 'CAD', categorie: null, valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null });

function profil(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('f', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.dateConfirmation = DATE;
  p.demographie.etatCivil = 'marie';
  modif(p);
  return p;
}
const compte = (positions: Position[]) => ({
  numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre' as const, candidats: ['37-FICT-A'],
  presence: 'au-releve' as const, derniereActivite: null, dernierSolde: null,
  type: 'non-enregistre' as const, titulaire: 'client' as const, dateReleve: DATE,
  encaisse: [], positions,
});
/** Aplatit les espaces : toLocaleString('fr-CA') separe par U+202F, invisible. */
const plat = (s: string) => s.replace(/[\s   ]+/g, ' ');
const trouver = (p: ProfilClient, s: string) =>
  analyser(p, null, DATE).constats.find((c) => c.strategie === s)!;

describe('les gestes', () => {
  it('un constat CHIFFRÉ porte des gestes et leurs démarches', () => {
    const c = trouver(profil((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte([pos('AAA', 8000, 20000)])];
    }), 'cristallisation-pertes');
    const g = gestesDe(c);
    expect(g.length).toBeGreaterThan(0);
    expect(g[0].demarches.length).toBeGreaterThan(1);
    expect(plat(g[0].demarches.join(' '))).toMatch(/12 000/);
    expect(g.every((x) => ['client', 'conseiller', 'les-deux'].includes(x.porteur))).toBe(true);
  });

  it('AUCUN GESTE quand rien n’est actionnable', () => {
    // Proposer une marche à suivre pour une piste qu'on ne peut pas chiffrer
    // serait mettre la charrue devant les bœufs : ce qu'il faut d'abord, c'est
    // la donnée manquante, et elle est déjà nommée ailleurs.
    for (const c of analyser(profilVierge('vide', DATE), null, DATE).constats) {
      if (c.statut === 'indisponible' || c.statut === 'non-applicable') {
        expect(gestesDe(c)).toEqual([]);
      }
    }
  });

  it('un constat « à confirmer » garde ses gestes mais pas le chiffre', () => {
    const c = trouver(profil((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte([pos('AAA', 8000, 20000)])];
    }), 'cristallisation-pertes');
    const d = gestesDe(c)[0].demarches.join(' ');
    expect(gestesDe(c).length).toBeGreaterThan(0);
    expect(d).toMatch(/positions détenues ailleurs/);
  });

  it('LES DÉMARCHES SONT DÉTERMINISTES : deux appels, le même texte', () => {
    const c = trouver(profil((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte([pos('AAA', 8000, 20000)])];
    }), 'cristallisation-pertes');
    expect(JSON.stringify(gestesDe(c))).toBe(JSON.stringify(gestesDe(c)));
  });
});

describe('« Déjà en ordre »', () => {
  it('un client sans conjoint : le CELI du conjoint EST en ordre', () => {
    const c = trouver(profil((x) => { x.demographie.etatCivil = 'celibataire'; }), 'celi-conjoint');
    expect(estDejaEnOrdre(c)).toBe(true);
  });

  it('un client qui ne donne pas : le don de titres EST en ordre', () => {
    const c = trouver(profil((x) => { x.intentions.donsAnnuelsMoyens = 0; }), 'don-titres');
    expect(estDejaEnOrdre(c)).toBe(true);
  });

  it('AUCUN GAIN RÉALISÉ : rien à cristalliser, et c’est une bonne nouvelle', () => {
    const c = trouver(profil((x) => {
      x.transactionsAnnee.gainsRealises = 0;
      x.comptes = [compte([pos('AAA', 8000, 20000)])];
    }), 'cristallisation-pertes');
    expect(c.statut).toBe('non-applicable');
    expect(estDejaEnOrdre(c)).toBe(true);
  });

  it('UN INTRANT QUI NOUS MANQUE N’EST PAS « en ordre »', () => {
    // « Aucun portefeuille cible n'a été fourni » est non-applicable, mais ce
    // n'est pas le client qui est en ordre : c'est nous qui n'avons pas la
    // matière. Le ranger dans les bonnes nouvelles serait se donner le beau rôle.
    const c = trouver(profil(), 'ordre-vente');
    expect(c.statut).toBe('non-applicable');
    expect(estDejaEnOrdre(c)).toBe(false);
  });

  it('un constat INDISPONIBLE n’est jamais « en ordre »', () => {
    for (const c of analyser(profilVierge('vide', DATE), null, DATE).constats) {
      if (c.statut === 'indisponible') expect(estDejaEnOrdre(c)).toBe(false);
    }
  });
});
