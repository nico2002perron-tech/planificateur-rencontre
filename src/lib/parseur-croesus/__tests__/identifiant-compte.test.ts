// LA FORME CANONIQUE D'UN IDENTIFIANT DE COMPTE.
//
// Fixtures à NUMÉROS FICTIFS mais à FORMATS RÉELS : les tests partent sur
// GitHub, aucun compte de client ne doit y figurer. Les formats, eux, sont
// ceux mesurés sur le livre — c'est ce qui donne leur valeur aux cas.

import { describe, it, expect } from 'vitest';
import {
  canoniserCompte, memeCompte, decomposerCompte,
  comptesCitesDansTexte, compteCiteDansTexte, prefixesInconnus,
  PREFIXES_CONNUS,
} from '../identifiant-compte';
import { typeDeCompte, estCompteVMBL } from '../types';

describe('canoniserCompte', () => {
  it('retire tirets, espaces et casse', () => {
    expect(canoniserCompte('6a-azci-0')).toBe('6AAZCI0');
    expect(canoniserCompte(' 37-AEF9-R ')).toBe('37AEF9R');
  });

  it('retire aussi les espaces INSÉCABLES qu’Excel livre', () => {
    // U+00A0 et U+202F sont invisibles à l'œil et ont déjà cassé des
    // comparaisons de chaînes ailleurs dans ce projet.
    expect(canoniserCompte('37 AEF9 R')).toBe('37AEF9R');
  });

  it('rend une chaîne vide sur null/undefined plutôt que de lever', () => {
    expect(canoniserCompte(null)).toBe('');
    expect(canoniserCompte(undefined)).toBe('');
  });
});

describe('memeCompte', () => {
  it('reconnaît les deux écritures du même compte', () => {
    expect(memeCompte('6A-AZCI-0', '6AAZCI0')).toBe(true);
    expect(memeCompte('37-AEF9-R', '37aef9r')).toBe(true);
  });

  it('ne confond pas deux comptes différents', () => {
    expect(memeCompte('37-AEF9-R', '37-AEF9-S')).toBe(false);
  });

  it('DEUX INCONNUS NE SONT PAS LE MÊME COMPTE', () => {
    // C'est le principe qui interdit au suffixe vide de servir de clé.
    expect(memeCompte('', '')).toBe(false);
    expect(memeCompte(null, undefined)).toBe(false);
  });
});

describe('decomposerCompte', () => {
  it('découpe la forme tiretée', () => {
    expect(decomposerCompte('37-AEF9-R')).toMatchObject({
      prefixe: '37', milieu: 'AEF9', suffixe: 'R', canonique: '37AEF9R', vmbl: false,
    });
  });

  it('découpe la forme SANS TIRETS en 2-4-1', () => {
    expect(decomposerCompte('6AAZCI0')).toMatchObject({
      prefixe: '6A', milieu: 'AZCI', suffixe: '0', vmbl: true,
    });
  });

  it('LES TIRETS FONT FOI quand ils sont là : le bloc de 5 survit', () => {
    // Le format aberrant « ~E-0024I-0 » (9 comptes sur 3 325) a un bloc du
    // milieu de 5 caractères. Un découpage en 2-4-1 le mutilerait.
    expect(decomposerCompte('~E-0024I-0')).toMatchObject({ milieu: '0024I', suffixe: '0' });
  });

  it('refuse ce qui n’a pas un préfixe mesuré', () => {
    expect(decomposerCompte('SALAIRE')).toBeNull();
    expect(decomposerCompte('01LOUIS')).toBeNull();   // préfixe 01 : jamais vu au livre
    expect(decomposerCompte('')).toBeNull();
  });
});

describe('typeDeCompte — le régime, quelle que soit l’écriture', () => {
  it('LE DÉFAUT CORRIGÉ : un CELI VMBL sans tirets était invisible', () => {
    // Avant le 4 août 2026, « 6AAZCI0 » tombait dans la table iA par son
    // dernier caractère « 0 », absent de cette table → null. Un transfert de
    // régime entier passait alors pour de l'argent neuf.
    expect(typeDeCompte('6A-AZCI-0')).toBe('celi');
    expect(typeDeCompte('6AAZCI0')).toBe('celi');
  });

  it('les deux conventions cohabitent sans se contaminer', () => {
    // Chez VMBL le régime est le dernier caractère du BLOC DU MILIEU, et R/S
    // sont INVERSÉS par rapport à iA. Le même « R » ne veut pas dire la même
    // chose des deux côtés.
    expect(typeDeCompte('37-AEF9-R')).toBe('reer');        // iA : suffixe
    expect(typeDeCompte('4A-Y3VR-6')).toBe('reer');        // VMBL : milieu
    expect(typeDeCompte('4A-Y3VS-6')).toBe('reer-conjoint');
    expect(typeDeCompte('37-AEF9-S')).toBe('reer');        // iA : S = REER aussi
  });

  it('rend null plutôt qu’un régime deviné', () => {
    expect(typeDeCompte('4A-Y3VA-6')).toBeNull();          // lettre VMBL non prouvée
  });

  it('estCompteVMBL reconnaît les deux écritures', () => {
    expect(estCompteVMBL('4A-Y3VI-6')).toBe(true);
    expect(estCompteVMBL('4AY3VI6')).toBe(true);
    expect(estCompteVMBL('37-AEF9-R')).toBe(false);
  });
});

describe('comptesCitesDansTexte', () => {
  it('trouve la forme sans tirets dans une note', () => {
    expect(compteCiteDansTexte('CONTRIBUTION REF: 6AAZCI0 29326')).toBe('6AAZCI0');
  });

  it('trouve la forme tiretée, et la rend TELLE QUELLE', () => {
    // Ce numéro finit sous les yeux du planificateur : il doit ressembler à ce
    // que Croesus lui montre. La canonisation sert à comparer, pas à afficher.
    expect(compteCiteDansTexte('A 37-AEF9-R - 146(16)')).toBe('37-AEF9-R');
  });

  it('RATE VOLONTAIREMENT les mots : c’est le préfixe qui trie', () => {
    // Mesuré : 140 294 jetons de 7 caractères rejetés dans les notes du livre,
    // tous des mots — ARTICLE, SALAIRE, RETRAIT, MALBAIE, PAYMENT, COMINAR.
    for (const mot of ['ARTICLE', 'SALAIRE', 'RETRAIT', 'MALBAIE', 'PAYMENT', 'COMINAR']) {
      expect(compteCiteDansTexte(`TRANSFERT ${mot} DIVERS`)).toBeNull();
    }
  });

  it('attrape les préfixes que les anciens motifs manquaient', () => {
    expect(compteCiteDansTexte('VIRE DE 00027A7')).toBe('00027A7');
    expect(compteCiteDansTexte('TRSF 37-C7LY-6')).toBe('37-C7LY-6');   // suffixe CHIFFRE
  });

  it('ne rend pas deux fois le même compte écrit de deux façons', () => {
    expect(comptesCitesDansTexte('DE 37-AEF9-R VERS 37AEF9R')).toEqual(['37-AEF9-R']);
  });
});

describe('prefixesInconnus — le filet de sécurité', () => {
  it('signale un préfixe jamais vu au lieu de dégrader en silence', () => {
    expect(prefixesInconnus(['37-AEF9-R', '99-ABCD-A'])).toEqual(['99']);
    expect(prefixesInconnus(['37-AEF9-R'])).toEqual([]);
  });

  it('la liste mesurée porte bien les 13 préfixes du livre', () => {
    expect(PREFIXES_CONNUS.size).toBe(13);
    for (const p of ['37', '4A', '6A', '5A', '00', '36', '34', '6D', '~E', '5M', '6M', '6C', '69']) {
      expect(PREFIXES_CONNUS.has(p)).toBe(true);
    }
  });
});
