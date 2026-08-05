// LA JOINTURE RELEVÉ ↔ GRAND LIVRE.
//
// Le cœur du sujet : un relevé ne porte que le SUFFIXE d'un compte, et
// 65 clients du livre ont deux comptes finissant par la même lettre. Ces tests
// vérifient qu'on ne devine JAMAIS — pas qu'on trouve toujours.
//
// Numéros fictifs, formats réels : les tests partent sur GitHub.

import { describe, it, expect } from 'vitest';
import { deriverComptes, indexerComptesDuLivre, jointureDuSuffixe } from '../comptes';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

function lig(...cols: string[]): string {
  const c = new Array(13).fill('');
  cols.forEach((v, i) => { c[i] = v; });
  return c.join('\t');
}

const FNB = lig('CAD', 'Action', '206', 'FNB OBLIGATIONS', 'S', 'XBB',
  '17,02', '16,34', '3 508,14', '3 367,22', '', '', '84,50');
const OBLIG = lig('CAD', 'Obligation', '39 000', 'MUNICIPALE 4.45%20JA28', 'A', 'Q273A4',
  '100,000', '101,744', '39 000,00', '39 680,16', '', '', '1 735,50');
const MARGE = lig('CAD', 'Encaisse', '-160 675,63', 'SOLDE DU COMPTE CAD', 'A', '1CAD',
  '1,000', '1,000', '-160 675,63', '-160 675,63');

function tx(noCompte: string, date: string, solde: number | null = null): LigneTransaction {
  return {
    date, dateReglement: date, nom: 'FICTIF', note: '', type: 'Achat', symbole: 'XBB',
    quantite: 1, prix: 1, devise: 'CAD', total: 1, gainsPertes: null, solde,
    noCompte, description: '',
  };
}

describe('indexerComptesDuLivre', () => {
  it('regroupe par suffixe et garde la dernière activité de chaque candidat', () => {
    const index = indexerComptesDuLivre([
      tx('37-AAAA-S', '2020-01-01', 100),
      tx('37-AAAA-S', '2024-06-01', 900),
      tx('37-BBBB-S', '2019-01-01', 50),
    ]);
    expect(index.get('S')).toHaveLength(2);
    expect(index.get('S')![0]).toMatchObject({
      numero: '37-AAAA-S', derniereActivite: '2024-06-01', dernierSolde: 900,
    });
  });

  it('LES DEUX ÉCRITURES D’UN COMPTE NE FONT QU’UN CANDIDAT', () => {
    const index = indexerComptesDuLivre([tx('37-AAAA-S', '2020-01-01'), tx('37AAAAS', '2021-01-01')]);
    expect(index.get('S')).toHaveLength(1);
  });
});

describe('jointureDuSuffixe — le verdict, jamais la devinette', () => {
  it('un seul candidat : provenance « livre »', () => {
    const index = indexerComptesDuLivre([tx('37-AAAA-S', '2020-01-01')]);
    expect(jointureDuSuffixe('S', index)).toMatchObject({ numero: '37-AAAA-S', provenance: 'livre' });
  });

  it('DEUX CANDIDATS : numéro null, et les deux candidats transportés', () => {
    const index = indexerComptesDuLivre([tx('37-AAAA-S', '2020-01-01'), tx('37-BBBB-S', '2019-01-01')]);
    const v = jointureDuSuffixe('S', index);
    expect(v.numero).toBeNull();
    expect(v.provenance).toBe('ambigu');
    expect(v.candidats.sort()).toEqual(['37-AAAA-S', '37-BBBB-S']);
  });

  it('le tranchage manuel du planificateur l’emporte sur l’ambiguïté', () => {
    const index = indexerComptesDuLivre([tx('37-AAAA-S', '2020-01-01'), tx('37-BBBB-S', '2019-01-01')]);
    const v = jointureDuSuffixe('S', index, [
      { suffixe: 'S', numero: '37-BBBB-S', titulaire: 'client', dateConfirmation: '2026-08-05' },
    ]);
    expect(v.numero).toBe('37-BBBB-S');
  });

  it('aucun candidat, livre non vide : « absent »', () => {
    const index = indexerComptesDuLivre([tx('37-AAAA-S', '2020-01-01')]);
    expect(jointureDuSuffixe('W', index).provenance).toBe('absent');
  });

  it('LIVRE ENTIÈREMENT VMBL : « non-jointable », pas « absent »', () => {
    // Chez VMBL le dernier caractère est un CHIFFRE ; la colonne 4 d'un relevé
    // porte une lettre. Les deux ne se comparent pas. Confondre ce cas avec un
    // compte inconnu ferait disparaître l'écart au lieu de le montrer :
    // 433 comptes sur 3 325, soit 13 % du livre.
    const index = indexerComptesDuLivre([tx('4A-Y3VI-6', '2020-01-01'), tx('6A-AZCI-0', '2021-01-01')]);
    expect(jointureDuSuffixe('W', index).provenance).toBe('non-jointable');
  });
});

describe('deriverComptes', () => {
  const livre = [tx('37-AAAA-S', '2024-01-01'), tx('37-CCCC-A', '2024-02-01')];

  it('raccorde les positions et pose le régime depuis le NUMÉRO, pas le suffixe', () => {
    const r = deriverComptes([FNB, OBLIG].join('\n'), livre, { dateReleve: '2026-08-05' });
    const s = r.comptes.find((c) => c.suffixe === 'S')!;
    expect(s.numero).toBe('37-AAAA-S');
    expect(s.provenanceNumero).toBe('livre');
    expect(s.type).toBe('reer');
    expect(s.positions[0]).toMatchObject({ symbole: 'XBB', devise: 'CAD', valeurComptable: 3508.14 });
    expect(s.dateReleve).toBe('2026-08-05');
  });

  it('SANS NUMÉRO PROUVÉ, LE RÉGIME RESTE NULL', () => {
    // La table des suffixes est celle d'iA. Un « Q » de 2009 y deviendrait un
    // CELIAPP — un régime qui n'existait pas à l'ouverture du compte, et qui
    // entraînerait un conseil de cotisation.
    const r = deriverComptes(FNB, [], { dateReleve: '2026-08-05' });
    expect(r.comptes[0].numero).toBeNull();
    expect(r.comptes[0].type).toBeNull();
    expect(r.comptes[0].provenanceNumero).toBe('absent');
  });

  it('LA MARGE DÉBITRICE SURVIT : sans elle le compte paraîtrait plus riche', () => {
    const r = deriverComptes([OBLIG, MARGE].join('\n'), livre, { dateReleve: '2026-08-05' });
    const a = r.comptes.find((c) => c.suffixe === 'A')!;
    expect(a.encaisse).toEqual([{ devise: 'CAD', montant: -160675.63 }]);
  });

  it('une obligation ne publie PAS de revenu annuel : l’échelle n’est pas mesurée', () => {
    // Les colonnes 6 et 7 d'une obligation sont par 100 $ de nominal (règle 1).
    // Personne n'a vérifié la colonne 12. Sur 39 000 de nominal, l'erreur
    // serait d'un facteur 100.
    const r = deriverComptes([FNB, OBLIG].join('\n'), livre, { dateReleve: '2026-08-05' });
    expect(r.comptes.find((c) => c.suffixe === 'A')!.positions[0].revenuAnnuel).toBeNull();
    expect(r.comptes.find((c) => c.suffixe === 'S')!.positions[0].revenuAnnuel).toBe(84.5);
  });

  it('MAIS un FNB D’OBLIGATIONS garde le sien : c’est un fonds, pas une obligation', () => {
    // Le piège trouvé en écrivant ces tests : la description du FNB ci-dessus
    // contient le mot « OBLIGATIONS ». Chercher ce mot dans le texte libre
    // aurait effacé le revenu de tous les FNB obligataires du portefeuille.
    // Seule la colonne 1, la famille déclarée par Croesus, fait foi.
    const r = deriverComptes(FNB, livre, { dateReleve: '2026-08-05' });
    expect(r.comptes[0].positions[0].revenuAnnuel).toBe(84.5);
  });

  it('LA CATÉGORIE RESTE NULL : aucune colonne du relevé ne la porte', () => {
    const r = deriverComptes(FNB, livre, { dateReleve: '2026-08-05' });
    expect(r.comptes[0].positions[0].categorie).toBeNull();
  });

  it('REFUSE un collage multi-clients plutôt que de fusionner deux « A »', () => {
    const r = deriverComptes(['### Client 1', OBLIG, '### Client 2', FNB].join('\n'), livre, {
      dateReleve: '2026-08-05',
    });
    expect(r.multiClients).toBe(true);
    expect(r.comptes).toEqual([]);
  });

  it('remonte les jointures ambiguës avec de quoi trancher', () => {
    const ambigu = [tx('37-AAAA-S', '2024-01-01', 1000), tx('37-BBBB-S', '2015-01-01', 20)];
    const r = deriverComptes(FNB, ambigu, { dateReleve: '2026-08-05' });
    expect(r.aTrancher).toHaveLength(1);
    expect(r.aTrancher[0].candidats.map((c) => c.numero)).toEqual(['37-AAAA-S', '37-BBBB-S']);
    // Le solde et la date sont là pour que le planificateur décide d'un coup
    // d'œil — pas pour que le code décide à sa place.
    expect(r.aTrancher[0].candidats[0].dernierSolde).toBe(1000);
  });
});
