// LA CLASSIFICATION PAR LIGNE — étape 2 de la ligne du temps.
//
// Ce que ces tests tiennent :
//   · la LISTE BLANCHE : un libellé inconnu sort `inconnu`, compté et nommé ;
//   · le vocabulaire dépend du RÉGIME : on cotise à un CELI, on apporte du
//     capital à un comptant, on ne cotise PAS à un FERR ;
//   · un Transfert n'est JAMAIS une cotisation par défaut ;
//   · la NOTE prime sur le régime (règles 3 et 5) ;
//   · une opération sur un TITRE et un revenu ne sont jamais un flux de capital ;
//     un achat/vente d'ENCAISSE, lui, est ambigu (conversion probable) ;
//   · un régime non prouvé, un montant illisible, une ligne sans symbole rendent
//     `ambigu`, pas une nature devinée ;
//   · l'étape 2 ne produit AUCUNE des natures réservées à l'étape 3 ;
//   · le diagnostic ne laisse fuir ni nom ni numéro de compte.
//
// Contre-expertise du 19 août (5 lentilles, 30 trouvailles confirmées) : les
// cas marqués « CE » ont été ajoutés parce qu'un relecteur les avait cassés.
//
// Tous les identifiants et notes sont FICTIFS : bloc « FICT », pas de prénom
// d'enfant réel, pas de numéro tiré du livre.
import { describe, it, expect } from 'vitest';
import { classerLigne, diagnostiquerClassification, normaliserLibelle, type NatureFlux } from '../flux';
import type { LigneTransaction } from '@/lib/parseur-croesus/types';

/** Une ligne fictive, avec des valeurs neutres partout où le test ne regarde pas. */
function ligne(partiel: Partial<LigneTransaction> & { type: string; noCompte: string }): LigneTransaction {
  return {
    date: '2026-03-15', dateReglement: '2026-03-17', nom: 'Fictif, Test', note: '',
    symbole: '1CAD', quantite: null, prix: null, devise: 'CAD', total: 1000,
    gainsPertes: null, solde: null, description: '',
    ...partiel,
  };
}

const CELI = '37-FICT-W';
const REER = '37-FICT-S';
const REEE = '37-FICT-Z';
const FERR = '37-FICT-T';
const CRI = '37-FICT-N';
const FRV = '37-FICT-P';
const COMPTANT = '37-FICT-A';
const MARGE = '37-FICT-E';
const MARGE_USD = '37-FICT-F';
const REGIME_INCONNU = '37-FICT-X';
const VMBL_INCONNU = '4A-FICA-6';          // lettre A non prouvée chez VMBL → régime null
const NOTE_CITE_UN_COMPTE = 'VIRE DE 37FICTE';   // forme compacte 2+4+1, préfixe 37 → reconnu (règle 6)

describe('la liste blanche', () => {
  it('un libellé jamais vu sort « inconnu » — jamais rangé par défaut', () => {
    // « Échange » et « Frais de gestion » ONT ÉTÉ MESURÉS le 20 août 2026 et
    // sont entrés dans la liste — ils ont désormais leurs propres tests, avec
    // leurs négatifs adjacents. Ceux qui restent ici n'ont aucune mesure
    // derrière eux ; « Valeur comptable » a été mesuré et REFUSÉ (le net par
    // compte-jour n'est pas nul : 3 groupes sur 4 seulement).
    for (const type of ['Ajustement', 'Impôt non-résident', '', 'Cotisations', 'Valeur comptable']) {
      const c = classerLigne(ligne({ type, noCompte: CELI }));
      expect(c.nature, `libellé « ${type} »`).toBe('inconnu');
      expect(c.confiance).toBe('inconnu');
      expect(c.motif).toMatch(/liste blanche/);
    }
  });

  it('CE · « constructor » et « __proto__ » ne traversent pas la liste : c’est une Map, pas un objet', () => {
    for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(classerLigne(ligne({ type, noCompte: CELI })).nature, type).toBe('inconnu');
    }
  });

  it('la comparaison est insensible aux accents et à la casse, tolère les espaces de bord — jamais par sous-chaîne', () => {
    expect(classerLigne(ligne({ type: 'RÉCEPTION', noCompte: CELI })).nature).toBe('ambigu');   // = Réception sans note
    expect(classerLigne(ligne({ type: 'reception ', noCompte: CELI })).nature).toBe('ambigu');
    expect(classerLigne(ligne({ type: 'Dividende', noCompte: CELI, symbole: 'XYZ' })).nature).toBe('revenu');
    // « Cotisation de rattrapage » CONTIENT « cotisation » : refusé. La liste
    // blanche compare le libellé entier, c'est ce qui la rend blanche.
    expect(classerLigne(ligne({ type: 'Cotisation de rattrapage', noCompte: CELI })).nature).toBe('inconnu');
    expect(normaliserLibelle('  RÉCEPTION  ')).toBe('reception');
  });

  it('CE · « Dépôt » est connu du moteur (deriver.ts:214) : dans un REEE, c’est une cotisation', () => {
    const c = classerLigne(ligne({ type: 'Dépôt', noCompte: REEE, total: 2500, note: 'CONTRIBUTION 01ENFANTA' }));
    expect(c.nature).toBe('cotisation');
    expect(c.confiance).toBe('eleve');
    expect(c.motif).toMatch(/Dépôt/);   // le libellé reste traçable dans le motif
  });

  it('le diagnostic NOMME les libellés inconnus (normalisés) et les compte', () => {
    const d = diagnostiquerClassification([
      ligne({ type: 'Valeur comptable', noCompte: CELI }),
      ligne({ type: 'VALEUR COMPTABLE ', noCompte: COMPTANT }),   // même libellé, autre casse
      ligne({ type: 'Ajustement', noCompte: CELI }),
      ligne({ type: 'Achat', noCompte: CELI, symbole: 'XYZ' }),
    ]);
    expect(d.lues).toBe(4);
    expect(d.libellesInconnus).toEqual({ 'valeur comptable': 2, ajustement: 1 });
    expect(d.parNature.inconnu).toBe(3);
    expect(d.parNature['operation-titre']).toBe(1);
  });
});

describe('le vocabulaire suit le régime', () => {
  it('T1 · une entrée « Cotisation » en argent dans un CELI → cotisation, confiance élevée, se dit provisoire', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, total: 7000 }));
    expect(c.nature).toBe('cotisation');
    expect(c.confiance).toBe('eleve');
    expect(c.regime).toBe('celi');
    expect(c.forme).toBe('argent');
    expect(c.motif).toMatch(/règle 2/);
  });

  it('T2 · une sortie « Retrait » d’un CELI → retrait', () => {
    const c = classerLigne(ligne({ type: 'Retrait', noCompte: CELI, total: -2000 }));
    expect(c.nature).toBe('retrait');
    expect(c.confiance).toBe('eleve');
  });

  it('la même entrée dans un COMPTANT est un apport de capital, pas une cotisation', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: COMPTANT, total: 30000 }));
    expect(c.nature).toBe('apport-capital');
    expect(c.sousType).toBe('comptant');
    expect(c.deviseCompte).toBe('CAD');
    // Le motif garde le LIBELLÉ Croesus (« Cotisation ») pour la traçabilité,
    // mais la NATURE et son explication parlent de capital, pas de cotisation.
    expect(c.motif).toMatch(/apport de capital/);
    expect(c.motif).not.toMatch(/cotisation en argent/);
  });

  it('… et dans une MARGE USD, un apport de capital dont le compte est en USD', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: MARGE_USD, total: 25000, symbole: '1USD', devise: 'USD' }));
    expect(c.nature).toBe('apport-capital');
    expect(c.sousType).toBe('marge');
    expect(c.deviseCompte).toBe('USD');
  });

  it('une sortie « Retrait » d’une marge → retrait de capital', () => {
    expect(classerLigne(ligne({ type: 'Retrait', noCompte: MARGE, total: -10000 })).nature).toBe('retrait-capital');
  });

  it('T8 · une cotisation REEE est une cotisation (le bénéficiaire se lit à l’agrégation, pas ici)', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: REEE, total: 2500, note: 'CONTRIBUTION 01ENFANTA' }));
    expect(c.nature).toBe('cotisation');
    expect(c.confiance).toBe('eleve');
    expect(c.regime).toBe('reee');
  });

  it('CE · une entrée REEE dont la note parle de SUBVENTION garde la nature mais perd la confiance', () => {
    // Si c'est la SCEE/IQEE, ce n'est pas l'argent du client et ça ne consomme
    // pas le plafond à vie. Non mesuré : on le signale, on ne le tranche pas.
    for (const note of ['SCEE 20%', 'SUBVENTION IQEE', 'CESG GRANT']) {
      const c = classerLigne(ligne({ type: 'Cotisation', noCompte: REEE, total: 500, note }));
      expect(c.nature, note).toBe('cotisation');
      expect(c.confiance, note).toBe('ambigu');
      expect(c.motif).toMatch(/subvention/i);
    }
  });

  it('CE · T7 · une « Cotisation » dans un FERR, un CRI ou un FRV n’est JAMAIS une cotisation — régimes de décaissement', () => {
    // Cahier des charges §18. Un FERR reçoit un REER converti ; un CRI, un régime
    // de pension ; un FRV, un CRI. Des transitions. L'étape 3 cherchera la jambe
    // sortante pour dire `transfert-regime` ; ici, ambigu.
    for (const no of [FERR, CRI, FRV]) {
      const c = classerLigne(ligne({ type: 'Cotisation', noCompte: no, total: 80000 }));
      expect(c.nature, no).toBe('ambigu');
      expect(c.motif).toMatch(/décaissement/);
      expect(c.motif).toMatch(/jamais une cotisation/);
    }
  });

  it('… mais un RETRAIT d’un FERR est bien un retrait : c’est à ça qu’il sert', () => {
    const c = classerLigne(ligne({ type: 'Retrait', noCompte: FERR, total: -12000 }));
    expect(c.nature).toBe('retrait');
    expect(c.regime).toBe('ferr');
  });

  it('un « Transfert » vers un FERR avec la seule mention 146.3 reste ambigu (règle 3 : la note ne suffit pas)', () => {
    const c = classerLigne(ligne({ type: 'Transfert', noCompte: FERR, total: 80000, note: 'TFR-146.3(2)(E)' }));
    expect(c.nature).toBe('ambigu');
    expect(c.regime).toBe('ferr');
  });
});

describe('un Transfert n’est JAMAIS une cotisation par défaut', () => {
  it('T17 · un Transfert entrant sans contrepartie → ambigu, et le motif nomme les hypothèses d’une ENTRÉE', () => {
    const c = classerLigne(ligne({ type: 'Transfert', noCompte: CELI, total: 20000 }));
    expect(c.nature).toBe('ambigu');
    expect(c.confiance).toBe('ambigu');
    expect(c.motif).toMatch(/indécidable/);
    expect(c.motif).toMatch(/cotisation/);
  });

  it('CE · un Transfert SORTANT sans contrepartie → ambigu, et le motif ne parle plus de cotisation', () => {
    const c = classerLigne(ligne({ type: 'Transfert', noCompte: CELI, total: -20000 }));
    expect(c.nature).toBe('ambigu');
    expect(c.motif).toMatch(/retrait/);
    expect(c.motif).not.toMatch(/cotisation/);
  });

  it('un Transfert dont la note cite un compte → virement interne (règle 3)', () => {
    const c = classerLigne(ligne({ type: 'Transfert', noCompte: CELI, total: 7000, note: NOTE_CITE_UN_COMPTE }));
    expect(c.nature).toBe('virement-interne');
    expect(c.confiance).toBe('eleve');
    expect(c.motif).toMatch(/étape 4/);   // l'autre jambe n'est pas encore liée
  });

  it('CE · la règle 3 ne dépend PAS du suffixe : un Transfert sur un compte au régime non prouvé, note citant un compte → virement interne', () => {
    for (const no of [REGIME_INCONNU, VMBL_INCONNU]) {
      const c = classerLigne(ligne({ type: 'Transfert', noCompte: no, total: 5000, note: NOTE_CITE_UN_COMPTE }));
      expect(c.nature, no).toBe('virement-interne');
      expect(c.regime, no).toBeNull();
    }
  });

  it('« TFR-146(16) » seul ne prouve rien : l’article autorise aussi le transfert ENTRE institutions', () => {
    expect(classerLigne(ligne({ type: 'Transfert', noCompte: REER, total: 50000, note: 'TFR-146(16)' })).nature).toBe('ambigu');
  });

  it('« Réception » suit la même règle que « Transfert »', () => {
    expect(classerLigne(ligne({ type: 'Réception', noCompte: CELI, total: 5000 })).nature).toBe('ambigu');
    expect(classerLigne(ligne({ type: 'Réception', noCompte: CELI, total: 5000, note: 'TRSF 37FICTE' })).nature).toBe('virement-interne');
  });
});

describe('la note prime sur le régime — règles 3 et 5', () => {
  it('CE · une Cotisation en argent dont la note cite un compte d’origine n’est PAS de l’argent neuf (règle 5)', () => {
    // `separerCotisations()` le dit déjà : « CONTRIBUTION REF: <compte> est un
    // transfert malgré le mot ». L'étape 2 s'aligne.
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, total: 20000, note: 'CONTRIBUTION REF: 37FICTA 29326' }));
    expect(c.nature).toBe('virement-interne');
    expect(c.motif).toMatch(/règle 5/);
    expect(c.motif).toMatch(/pas de l’argent neuf/);
  });

  it('CE · un Retrait dont la note cite un compte de destination → virement interne, pas une sortie externe', () => {
    const c = classerLigne(ligne({ type: 'Retrait', noCompte: MARGE, total: -7000, note: 'TRANSFERE A 37FICTW' }));
    expect(c.nature).toBe('virement-interne');
    expect(c.motif).toMatch(/règle 3/);
  });

  it('une Cotisation dont la note dit franchement « COTISATION » sans citer de compte reste une cotisation', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, total: 7000, note: 'COTISATION CELI 2026' }));
    expect(c.nature).toBe('cotisation');
    expect(c.confiance).toBe('eleve');
  });
});

describe('ce qui n’est pas un flux de capital, quel que soit le compte', () => {
  it('T10 / T15 · Achat et Vente d’un TITRE → opération sur titre, confiance confirmée, même sur régime inconnu', () => {
    for (const type of ['Achat', 'Vente']) for (const no of [CELI, COMPTANT, REGIME_INCONNU]) {
      const c = classerLigne(ligne({ type, noCompte: no, symbole: 'XYZ', total: type === 'Vente' ? 4500 : -4500 }));
      expect(c.nature, `${type} sur ${no}`).toBe('operation-titre');
      expect(c.confiance).toBe('confirme');
      expect(c.forme).toBe('titre');
    }
  });

  it('CE · un Achat ou une Vente d’ENCAISSE (1USD, 1CAD) n’est pas une opération sur titre : conversion probable, ambigu', () => {
    const a = classerLigne(ligne({ type: 'Achat', noCompte: COMPTANT, symbole: '1USD', total: -13500 }));
    expect(a.nature).toBe('ambigu');
    expect(a.motif).toMatch(/conversion de devise/);
    expect(a.motif).toMatch(/1USD/);
    const v = classerLigne(ligne({ type: 'Vente', noCompte: MARGE_USD, symbole: '1cad', total: 10000 }));
    expect(v.nature).toBe('ambigu');   // casse indifférente : estEncaisse normalise
  });

  it('CE · un Achat sans symbole → ambigu, forme illisible', () => {
    const c = classerLigne(ligne({ type: 'Achat', noCompte: COMPTANT, symbole: '', total: -1000 }));
    expect(c.nature).toBe('ambigu');
    expect(c.forme).toBeNull();
  });

  it('T11 · un dividende → revenu, même sur un compte au régime inconnu', () => {
    const c = classerLigne(ligne({ type: 'Dividendes', noCompte: REGIME_INCONNU, symbole: 'XYZ', total: 120 }));
    expect(c.nature).toBe('revenu');
    expect(c.confiance).toBe('confirme');
  });

  it('T12 · « Intérêts » est un revenu — mesuré le 19 août (1 575 lignes, 18,3 % du livre)', () => {
    const c = classerLigne(ligne({ type: 'Intérêts', noCompte: COMPTANT, symbole: '1CAD', total: 42 }));
    expect(c.nature).toBe('revenu');
    expect(c.confiance).toBe('confirme');
    expect(classerLigne(ligne({ type: 'INTÉRÊT', noCompte: CELI, symbole: 'XYZ', total: 12 })).nature).toBe('revenu');
  });

  // ═══ LES FRAIS ET LEURS TAXES — mesurés le 20 août 2026 ═══════════════════
  //
  // docs/mesure-types-hors-flux-2026-08-20.md, CELI de la base locale :
  // TPS 17 · TVP 17 · Frais de gestion 11 · Frais 7 — toutes en encaisse,
  // quantité nulle, négatives (sauf 1 « Frais » positif), et les taxes
  // accompagnent un frais le même jour sur le même compte 17 fois sur 17, au
  // taux exact de la taxe (5,0 % et 10,0 %).
  describe('T13 / T14 · frais et taxes : de l’argent sort, mais AUCUN droit n’est recréé', () => {
    it('positif — un frais ou une taxe en argent, négatif, est « frais-impot » confirmé', () => {
      for (const type of ['Frais', 'Frais de gestion', 'TPS', 'TVP']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: '1CAD', total: -50 }));
        expect(c.nature, type).toBe('frais-impot');
        expect(c.confiance, type).toBe('confirme');
        expect(c.motif, type).toMatch(/PAS un retrait du titulaire/);
        expect(c.motif, type).toMatch(/aucun droit de cotisation n’est recréé/);
      }
    });

    it('FAUX RETRAIT — un frais négatif n’est JAMAIS un retrait CELI', () => {
      // C'est LA confusion à empêcher : « total négatif → retrait » recréerait
      // un droit de cotisation l'année suivante, sur de l'argent que le
      // titulaire n'a jamais reçu.
      for (const type of ['Frais', 'Frais de gestion', 'TPS', 'TVP']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: '1CAD', total: -2.5 }));
        expect(c.nature, type).not.toBe('retrait');
        expect(c.nature, type).not.toBe('retrait-capital');
      }
    });

    it('NÉGATIF ADJACENT — un frais POSITIF est un remboursement ou une correction : ambigu', () => {
      // Mesuré : 1 ligne « Frais » de +57,33 dont la note citait deux comptes.
      const c = classerLigne(ligne({ type: 'Frais', noCompte: CELI, symbole: '1CAD', total: 57.33 }));
      expect(c.nature).toBe('ambigu');
      expect(c.motif).toMatch(/POSITIF/);
    });

    it('NÉGATIF ADJACENT — des frais EN TITRES ou sans symbole restent ambigus', () => {
      expect(classerLigne(ligne({ type: 'Frais', noCompte: CELI, symbole: 'XYZ', quantite: 10, total: -50 })).nature).toBe('ambigu');
      expect(classerLigne(ligne({ type: 'TPS', noCompte: CELI, symbole: '', total: -2.5 })).nature).toBe('ambigu');
      expect(classerLigne(ligne({ type: 'TVP', noCompte: CELI, symbole: '1CAD', total: 0 })).nature).toBe('ambigu');
    });

    it('LA NOTE PRIME — un frais dont la note cite un compte n’est JAMAIS classé hors flux en silence', () => {
      // Contre-expertise du 20 août : un « Frais » de −25 000 $ noté « VIRE DE
      // 37FICTE » sortait frais-impot/confirme → hors-flux → invisible. De
      // l'argent quittait un CELI vers un compte NOMMÉ, déclaré « taxe du
      // service ». La classe d'entrée est mesurée : la seule ligne « Frais » à
      // note citant des comptes ne s'en sauvait que par son signe.
      for (const type of ['Frais', 'Frais de gestion', 'TPS', 'TVP']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: '1CAD', total: -25000, note: NOTE_CITE_UN_COMPTE }));
        expect(c.nature, type).toBe('ambigu');
        expect(c.motif, type).toMatch(/NOTE cite un compte/);
      }
      // (l'effet sur la complétude est verrouillé dans vue-fiscale-celi.test.ts)
    });

    it('LA NOTE PRIME AUSSI pour les opérations sur titre entrées par ce lot', () => {
      for (const type of ['Échange', 'Expiration', 'Remboursement']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: 'XYZ', quantite: 100, total: 5000, note: NOTE_CITE_UN_COMPTE }));
        expect(c.nature, type).toBe('ambigu');
      }
      // « Achat »/« Vente » gardent le comportement validé le 19 août — hors périmètre.
      expect(classerLigne(ligne({ type: 'Achat', noCompte: CELI, symbole: 'XYZ', total: -3000, note: NOTE_CITE_UN_COMPTE })).nature)
        .toBe('operation-titre');
    });

    it('une note ORDINAIRE de frais ne déclenche rien : la garde ne mange pas les vrais frais', () => {
      // Mesuré : « FRAIS GEST. ANNUELS 2024 », « FRAIS GEST. 2023 », note vide.
      for (const note of ['FRAIS GEST. ANNUELS 2024', 'FRAIS GEST. 2023', 'FRAIS DE GESTION', '']) {
        expect(classerLigne(ligne({ type: 'Frais de gestion', noCompte: CELI, symbole: '1CAD', total: -70, note })).nature, note)
          .toBe('frais-impot');
      }
    });

    it('la règle ne dépend pas du régime : un frais est un frais dans un comptant aussi', () => {
      const c = classerLigne(ligne({ type: 'Frais de gestion', noCompte: COMPTANT, symbole: '1CAD', total: -70 }));
      expect(c.nature).toBe('frais-impot');
    });

    it('NON MESURÉS — TVH, Impôt retenu, Impôt non-résident, Commission restent « inconnu »', () => {
      // 0 occurrence dans la base mesurée. Ils sortiront `inconnu`, donc
      // VISIBLES, et entreront à leur première occurrence — c'est ainsi que la
      // liste blanche grandit, jamais par analogie avec la TPS.
      for (const type of ['TVH', 'Impôt retenu', 'Impôt non-résident', 'Commission']) {
        expect(classerLigne(ligne({ type, noCompte: COMPTANT, symbole: '1CAD', total: -50 })).nature, type).toBe('inconnu');
      }
    });
  });

  // ═══ LES OPÉRATIONS SUR TITRE MESURÉES LE 20 AOÛT ═════════════════════════
  describe('Échange · Expiration · Remboursement : des opérations sur titre, sans flux de capital', () => {
    it('positif — en titres, chacun est « operation-titre » confirmé', () => {
      for (const type of ['Échange', 'Expiration', 'Remboursement']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: 'XYZ', quantite: 100, total: 0 }));
        expect(c.nature, type).toBe('operation-titre');
        expect(c.confiance, type).toBe('confirme');
      }
    });

    it('FAUX COTISATION — un « Remboursement » positif en titres n’est jamais une cotisation', () => {
      // Mesuré : 17/17 en titres, toutes positives (jusqu'à 15 000 $), 15/17
      // accompagnées d'« Intérêts » — le capital d'un titre à échéance.
      const c = classerLigne(ligne({ type: 'Remboursement', noCompte: CELI, symbole: 'OBLIG123', quantite: 15000, total: 15000 }));
      expect(c.nature).toBe('operation-titre');
      expect(c.nature).not.toBe('cotisation');
    });

    it('NÉGATIF ADJACENT — les mêmes libellés EN ARGENT restent ambigus, avec le vrai motif', () => {
      // Ils n'ont JAMAIS été mesurés sous forme d'encaisse (0 impact sur
      // l'encaisse, 30 lignes sur 30) : sous cette forme, on ne sait pas.
      for (const type of ['Échange', 'Expiration', 'Remboursement']) {
        const c = classerLigne(ligne({ type, noCompte: CELI, symbole: '1CAD', total: 5000 }));
        expect(c.nature, type).toBe('ambigu');
        expect(c.motif, type).toMatch(/EN ARGENT/);
        expect(c.motif, type).not.toMatch(/conversion de devise/);   // ce motif-là est réservé à Achat/Vente
      }
    });

    it('« Achat »/« Vente » d’encaisse gardent LEUR motif de conversion', () => {
      const c = classerLigne(ligne({ type: 'Achat', noCompte: MARGE, symbole: '1USD', devise: 'USD', total: -1000 }));
      expect(c.nature).toBe('ambigu');
      expect(c.motif).toMatch(/conversion de devise probable/);
    });
  });

  it('les types VUS par la mesure sans être COMPRIS restent « inconnu » : Assignation, Journal, Divers, Montant brut, Livraison, Valeur comptable', () => {
    // « Valeur comptable » rejoint la liste des refus le 20 août : l'hypothèse
    // « écriture d'inventaire » a été testée et REFUSÉE (net par compte-jour
    // nul dans 3 groupes sur 4 seulement — le quatrième laisse −9 000 $).
    for (const type of ['Assignation', 'Journal', 'Divers', 'Montant brut', 'Livraison', 'Valeur comptable']) {
      const c = classerLigne(ligne({ type, noCompte: COMPTANT, symbole: '1CAD', total: -500 }));
      expect(c.nature, type).toBe('inconnu');
      expect(c.confiance, type).toBe('inconnu');
    }
  });
});

describe('ce qui se déclare au lieu de se deviner', () => {
  it('T18 · une Cotisation sur un compte au régime non prouvé → ambigu, jamais cotisation ni apport', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: REGIME_INCONNU, total: 7000 }));
    expect(c.nature).toBe('ambigu');
    expect(c.regime).toBeNull();
    expect(c.motif).toMatch(/régime non prouvé/);
  });

  it('T19 · un numéro de compte que la décomposition refuse → régime null, compté au diagnostic', () => {
    const d = diagnostiquerClassification([
      ligne({ type: 'Cotisation', noCompte: 'pas un compte', total: 100 }),
      ligne({ type: 'Cotisation', noCompte: CELI, total: 100 }),
    ]);
    expect(d.lignesSansRegime).toBe(1);
    expect(d.parNature.ambigu).toBe(1);
    expect(d.parNature.cotisation).toBe(1);
  });

  it('CE · une Cotisation SANS SYMBOLE → ambigu, quel que soit le signe — et le motif ne dit plus « en argent »', () => {
    for (const total of [7000, -7000, 0]) {
      const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, symbole: '', total }));
      expect(c.nature, `total ${total}`).toBe('ambigu');
      expect(c.forme).toBeNull();
      expect(c.motif).toMatch(/sans symbole/);
      expect(c.motif).not.toMatch(/en argent/);
    }
    // Des espaces seuls valent l'absence.
    expect(classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, symbole: '   ', total: 7000 })).nature).toBe('ambigu');
  });

  it('une cotisation en argent à montant NÉGATIF n’est pas une cotisation lue seule', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, total: -7000 }));
    expect(c.nature).toBe('ambigu');
    expect(c.motif).toMatch(/renversement/);
  });

  it('un retrait à montant POSITIF non plus', () => {
    expect(classerLigne(ligne({ type: 'Retrait', noCompte: CELI, total: 2000 })).nature).toBe('ambigu');
  });

  it('un montant illisible → ambigu', () => {
    expect(classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, total: null })).nature).toBe('ambigu');
    expect(classerLigne(ligne({ type: 'Transfert', noCompte: CELI, total: null, note: NOTE_CITE_UN_COMPTE })).nature).toBe('ambigu');
  });

  it('la jambe TITRE d’une cotisation garde la nature du flux mais une confiance « ambigu » — l’appariement vient après', () => {
    const c = classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, symbole: 'TD', quantite: 155, total: -20177.9 }));
    expect(c.nature).toBe('cotisation');
    expect(c.forme).toBe('titre');
    expect(c.confiance).toBe('ambigu');
    expect(c.motif).toMatch(/EN TITRES/);
  });

  it('CE · une jambe titre à montant NUL est ignorée par la règle 2 : ambigu ici aussi', () => {
    expect(classerLigne(ligne({ type: 'Cotisation', noCompte: CELI, symbole: 'TD', total: 0 })).nature).toBe('ambigu');
  });

  it('CE · la jambe TITRE d’un RETRAIT (retrait en nature) — miroir : nature du flux, confiance ambigu', () => {
    const c = classerLigne(ligne({ type: 'Retrait', noCompte: CELI, symbole: 'TD', total: -5000 }));
    expect(c.nature).toBe('retrait');
    expect(c.confiance).toBe('ambigu');
    expect(c.motif).toMatch(/EN TITRES/);
  });
});

describe('ce que l’étape 2 ne fait PAS — verrou pour l’étape 3', () => {
  // ⚠ `frais-impot` A ÉTÉ RETIRÉE DE CETTE LISTE le 20 août 2026 : depuis la
  // mesure des frais, l'étape 2 la PRODUIT. Le verrou l'y rangeait encore, et
  // il restait vert uniquement parce que son balayage n'incluait aucun libellé
  // de frais — un test qui affirme le faux ET ne peut pas échouer. Le balayage
  // couvre désormais TOUS les libellés de la liste blanche.
  const RESERVEES_ETAPE_3: NatureFlux[] = ['conversion-devise', 'transfert-regime', 'annule'];

  it('aucune ligne, quelle qu’elle soit, ne reçoit une nature réservée à l’étape 3', () => {
    const libelles = [
      'Cotisation', 'Dépôt', 'Retrait', 'Transfert', 'Réception', 'Achat', 'Vente', 'Dividendes', 'Inconnu',
      // les libellés entrés le 20 août — le balayage doit les voir
      'TPS', 'TVP', 'Frais', 'Frais de gestion', 'Échange', 'Expiration', 'Remboursement', 'Valeur comptable',
    ];
    const comptes = [CELI, REER, REEE, FERR, COMPTANT, MARGE, MARGE_USD, REGIME_INCONNU, '4A-FICI-6', VMBL_INCONNU];
    const notes = ['', NOTE_CITE_UN_COMPTE, 'SCEE'];
    // On COLLECTE et on asserte UNE fois : 8 160 combinaisons × 2 `expect`
    // dépassaient le délai de vitest, et l'échec n'aurait nommé qu'un cas.
    let n = 0;
    const violations: string[] = [];
    const naturesVues = new Set<NatureFlux>();
    for (const type of libelles) for (const noCompte of comptes) for (const total of [5000, -5000, 0, null])
      for (const symbole of ['1CAD', '1USD', 'XYZ', '']) for (const note of notes) {
        const c = classerLigne(ligne({ type, noCompte, total, symbole, note }));
        naturesVues.add(c.nature);
        if (RESERVEES_ETAPE_3.includes(c.nature)) violations.push(`${type} / ${noCompte} / ${total} / ${symbole} / ${note} → ${c.nature}`);
        if (c.motif.trim().length === 0) violations.push(`${type} / ${noCompte} — motif VIDE`);
        n++;
      }
    expect(violations).toEqual([]);
    expect(n).toBe(17 * 10 * 4 * 4 * 3);   // 8 160 — le balayage a bien eu lieu
    // ET il atteint vraiment les règles du 20 août : sans ça, le verrou
    // pourrait rester vert en ne voyant aucune des natures qu'il surveille.
    expect(naturesVues.has('frais-impot'), 'le balayage produit des frais-impot').toBe(true);
    expect(naturesVues.has('operation-titre'), 'le balayage produit des operation-titre').toBe(true);
  });

  it('LE BALAYAGE VOIT VRAIMENT les frais : il en produit, et jamais une nature réservée', () => {
    // Sans cette contre-épreuve, le test ci-dessus resterait vert même si les
    // libellés de frais n'y étaient plus. Un balayage qui ne prouve pas qu'il
    // atteint la règle qu'il verrouille ne verrouille rien.
    const c = classerLigne(ligne({ type: 'Frais', noCompte: CELI, symbole: '1CAD', total: -5000 }));
    expect(c.nature).toBe('frais-impot');
    expect(RESERVEES_ETAPE_3).not.toContain(c.nature);
  });

  it('le diagnostic compte à zéro les natures VRAIMENT réservées', () => {
    const d = diagnostiquerClassification([ligne({ type: 'Achat', noCompte: CELI, symbole: 'XYZ' })]);
    for (const n of RESERVEES_ETAPE_3) expect(d.parNature[n], n).toBe(0);
  });
});

describe('le diagnostic est un agrégat', () => {
  it('les totaux par nature et par confiance bouclent sur le nombre de lignes lues', () => {
    const lignes = [
      ligne({ type: 'Cotisation', noCompte: CELI, total: 7000 }),
      ligne({ type: 'Retrait', noCompte: CELI, total: -1000 }),
      ligne({ type: 'Transfert', noCompte: CELI, total: 20000 }),
      ligne({ type: 'Transfert', noCompte: CELI, total: 7000, note: NOTE_CITE_UN_COMPTE }),
      ligne({ type: 'Achat', noCompte: COMPTANT, symbole: 'XYZ', total: -3000 }),
      ligne({ type: 'Dividendes', noCompte: COMPTANT, symbole: 'XYZ', total: 50 }),
      ligne({ type: 'Valeur comptable', noCompte: COMPTANT }),   // mesuré et REFUSÉ le 20 août : toujours inconnu
      ligne({ type: 'Cotisation', noCompte: REGIME_INCONNU, total: 100 }),
    ];
    const d = diagnostiquerClassification(lignes);
    const sommeNatures = Object.values(d.parNature).reduce((s, n) => s + n, 0);
    const sommeConfiances = Object.values(d.parConfiance).reduce((s, n) => s + n, 0);
    expect(sommeNatures).toBe(lignes.length);
    expect(sommeConfiances).toBe(lignes.length);
    expect(d.parNature).toMatchObject({
      cotisation: 1, retrait: 1, ambigu: 2, 'virement-interne': 1,
      'operation-titre': 1, revenu: 1, inconnu: 1,
    });
    expect(d.lignesSansRegime).toBe(1);
  });

  it('ne contient aucun numéro de compte ni nom — des nombres et des libellés seulement', () => {
    const d = diagnostiquerClassification([
      ligne({ type: 'Cotisation', noCompte: '37-SECR-W', nom: 'Secret, Client', total: 100 }),
      ligne({ type: 'Mystère', noCompte: '37-SECR-A', nom: 'Secret, Client' }),
    ]);
    const texte = JSON.stringify(d);
    expect(texte).not.toMatch(/SECR/);
    expect(texte).not.toMatch(/Secret/);
    expect(d.libellesInconnus).toEqual({ mystere: 1 });   // le LIBELLÉ, normalisé, s'affiche
  });

  it('CE · un collage DÉCALÉ d’une colonne ne fait jamais sortir un numéro de compte ni une note du diagnostic', () => {
    // Si la colonne « type » reçoit une note ou un numéro (collage à 19 ou 21
    // colonnes), le libellé n'a plus la forme d'un mot : il se replie sous une
    // seule clé. Le diagnostic reste un diagnostic.
    const d = diagnostiquerClassification([
      ligne({ type: 'VIRE DE 37-SECR-E', noCompte: '37-SECR-W' }),
      ligne({ type: '37-SECR-A', noCompte: '37-SECR-W' }),
      ligne({ type: 'CONTRIBUTION 01ENFANTA 29326', noCompte: '37-SECR-Z' }),
      ligne({ type: 'un libellé beaucoup trop long pour être un vrai type de transaction croesus', noCompte: CELI }),
    ]);
    const texte = JSON.stringify(d);
    expect(texte).not.toMatch(/SECR/);
    expect(texte).not.toMatch(/ENFANT/);
    expect(texte).not.toMatch(/29326/);
    expect(d.libellesInconnus).toEqual({ '(libellé non textuel)': 4 });
    expect(d.parNature.inconnu).toBe(4);
  });
});
