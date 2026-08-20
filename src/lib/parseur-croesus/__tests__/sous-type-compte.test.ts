// LE SOUS-TYPE ET LA DEVISE D'UN COMPTE — étape 1 de la ligne du temps.
//
// Ce que ces tests tiennent :
//   · l'INVARIANT : `(sousTypeCompte(x)?.regime ?? null) === typeDeCompte(x)`
//     pour tout x — la nouvelle fonction ajoute, elle ne contredit jamais ;
//   · les devises dictées par Nicolas le 19 août (A/E/J en CAD, B/F en USD) ;
//   · les régimes enregistrés ne portent PAS de devise par lettre ;
//   · un identifiant refusé ou une lettre inconnue rend `null`, jamais un profil
//     inventé ;
//   · iA et VMBL ne se mélangent pas ; `table` dit laquelle a été lue.
//
// Tous les identifiants sont FICTIFS — préfixes connus (37, 4A, 6A, 00) avec
// un bloc du milieu « FICT » qui n'existe sur aucun relevé.
import { describe, it, expect } from 'vitest';
import {
  sousTypeCompte, suffixesJumeauxDevise, typeDeCompte, estCompteIA,
  TYPE_PAR_SUFFIXE, TYPE_PAR_LETTRE_VMBL,
} from '../types';

describe('sousTypeCompte — l’invariant', () => {
  it('le régime rendu est TOUJOURS celui de typeDeCompte, pour chaque suffixe iA', () => {
    for (const lettre of Object.keys(TYPE_PAR_SUFFIXE)) {
      const no = `37-FICT-${lettre}`;
      expect(sousTypeCompte(no)?.regime, `suffixe ${lettre}`).toBe(typeDeCompte(no));
    }
  });

  it('… et pour chaque lettre VMBL', () => {
    for (const lettre of Object.keys(TYPE_PAR_LETTRE_VMBL)) {
      const no = `4A-FIC${lettre}-6`;
      expect(sousTypeCompte(no)?.regime, `lettre VMBL ${lettre}`).toBe(typeDeCompte(no));
    }
  });

  it('null EXACTEMENT quand typeDeCompte rend null — dans les deux sens', () => {
    // Six identifiants qui rendent null, et trois qui rendent un profil : la
    // version précédente de ce test n'échantillonnait que le premier côté.
    for (const no of ['37-FICT-X', '37-FICT-1', 'n’importe quoi', '', '4A-FICA-6', '00-FICT-X',
                      '37-FICT-W', '4A-FICI-6', '6A-FICS-0']) {
      const profil = sousTypeCompte(no);
      const regime = typeDeCompte(no);
      expect((profil?.regime ?? null), no).toBe(regime);
      expect(profil === null, `${no} : profil ${profil === null ? 'null' : 'présent'}, régime ${regime}`).toBe(regime === null);
    }
  });
});

describe('sousTypeCompte — les comptes non enregistrés iA', () => {
  it.each([
    ['A', 'comptant', 'CAD'],
    ['B', 'comptant', 'USD'],
    ['E', 'marge', 'CAD'],
    ['F', 'marge', 'USD'],
    ['J', 'revenu', 'CAD'],
  ] as const)('37-FICT-%s → %s en %s, régime non-enregistre', (lettre, sousType, devise) => {
    expect(sousTypeCompte(`37-FICT-${lettre}`)).toEqual({
      lettre, regime: 'non-enregistre', sousType, devise, table: 'suffixe-ia',
    });
  });

  it('A et B sont les deux faces CAD/USD du comptant ; E et F celles de la marge', () => {
    expect(suffixesJumeauxDevise('A', 'B')).toBe(true);
    expect(suffixesJumeauxDevise('E', 'F')).toBe(true);
    expect(suffixesJumeauxDevise('b', 'a')).toBe(true);   // ordre et casse indifférents
  });

  it('A et E ne sont PAS jumeaux (même devise, sous-types différents) ; A et A non plus', () => {
    expect(suffixesJumeauxDevise('A', 'E')).toBe(false);
    expect(suffixesJumeauxDevise('A', 'A')).toBe(false);
    expect(suffixesJumeauxDevise('B', 'F')).toBe(false);   // deux USD, pas une paire
  });

  it('J n’a pas de jumeau : le compte de revenu n’a pas de face USD prouvée', () => {
    for (const autre of Object.keys(TYPE_PAR_SUFFIXE)) {
      expect(suffixesJumeauxDevise('J', autre), `J / ${autre}`).toBe(false);
    }
  });
});

describe('sousTypeCompte — les régimes enregistrés iA', () => {
  it.each([
    ['R', 'reer', 'reer'],
    ['S', 'reer', 'reer'],
    ['W', 'celi', 'celi'],
    ['Q', 'celiapp', 'celiapp'],   // Q = CELIAPP, confirmé par Nicolas le 19 août
    ['T', 'ferr', 'ferr'],
    ['Y', 'ferr', 'ferr'],
    ['P', 'frv', 'frv'],
    ['N', 'cri', 'cri'],
    ['Z', 'reee', 'reee'],         // le cas rapporté : « quand le compte finit par Z »
  ] as const)('37-FICT-%s → régime %s, sous-type %s, AUCUNE devise', (lettre, regime, sousType) => {
    expect(sousTypeCompte(`37-FICT-${lettre}`)).toEqual({
      lettre, regime, sousType, devise: null, table: 'suffixe-ia',
    });
  });

  it('aucun suffixe enregistré n’est jumeau d’un autre : la devise y est par position', () => {
    const enregistres = Object.keys(TYPE_PAR_SUFFIXE).filter((l) => TYPE_PAR_SUFFIXE[l] !== 'non-enregistre');
    for (const a of enregistres) for (const b of Object.keys(TYPE_PAR_SUFFIXE)) {
      expect(suffixesJumeauxDevise(a, b), `${a} / ${b}`).toBe(false);
    }
  });
});

describe('sousTypeCompte — la table appliquée n’est pas l’institution prouvée', () => {
  it('`table` dit « suffixe-ia » pour tout préfixe non VMBL — y compris 00, que estCompteIA refuse', () => {
    // Le champ mesure la TABLE lue, pas l'institution. C'est `estCompteIA()`
    // (préfixe 37 seul) qui prouve qu'un compte est iA. Les deux ne se
    // contredisent donc pas : ils répondent à deux questions.
    const p = sousTypeCompte('00-FICT-W');
    expect(p?.table).toBe('suffixe-ia');
    expect(p?.regime).toBe('celi');
    expect(estCompteIA('00-FICT-W')).toBe(false);
    expect(sousTypeCompte('37-FICT-W')?.table).toBe('suffixe-ia');
    expect(estCompteIA('37-FICT-W')).toBe(true);
  });
});

describe('sousTypeCompte — VMBL ne se mélange pas avec iA', () => {
  it('la lettre VMBL est lue dans le bloc du milieu, et `table` le dit', () => {
    // « I » = CELI chez VMBL. En suffixe iA, « I » n'existe pas.
    expect(sousTypeCompte('4A-FICI-6')).toEqual({
      lettre: 'I', regime: 'celi', sousType: 'celi', devise: null, table: 'lettre-vmbl',
    });
    expect(sousTypeCompte('37-FICT-I')).toBeNull();
  });

  it('`lettre` est la lettre qui porte le régime — le suffixe chez iA, le milieu chez VMBL', () => {
    expect(sousTypeCompte('37-FICT-W')?.lettre).toBe('W');   // le suffixe
    expect(sousTypeCompte('4A-FICI-6')?.lettre).toBe('I');   // PAS le « 6 »
  });

  it('R/S sont INVERSÉS entre les deux conventions, et le profil le reflète', () => {
    expect(sousTypeCompte('37-FICT-S')?.sousType).toBe('reer');            // iA : S = REER
    expect(sousTypeCompte('4A-FICS-6')?.sousType).toBe('reer-conjoint');   // VMBL : S = REER conjoint
  });

  it('la forme VMBL sans tirets rend le même profil que la forme tiretée', () => {
    expect(sousTypeCompte('6AFICI0')).toEqual(sousTypeCompte('6A-FICI-0'));
    expect(sousTypeCompte('6AFICI0')?.regime).toBe('celi');
  });

  it('une lettre VMBL non prouvée (A, E, T, B, Q…) rend null — pas un régime deviné', () => {
    for (const lettre of ['A', 'E', 'T', 'B', 'Q', 'F', 'Z', 'U', 'Y']) {
      expect(sousTypeCompte(`4A-FIC${lettre}-6`), `VMBL ${lettre}`).toBeNull();
    }
  });
});
