// L'HISTORIQUE SE LIT PAR SES TITRES DE COLONNES, PAS PAR LEUR RANG.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CETTE BATTERIE VERROUILLE.
//
// `parserCollage` déduisait le sens des colonnes de leur NOMBRE :
// 20 → décalage 0, 18 → décalage 2. Nicolas retire volontairement la colonne du
// NOM DU CLIENT de ses exports ; le fichier en compte alors 19, tombait dans la
// branche « 18 », et `noCompte` allait lire la colonne « Solde ».
//
// ⚠ LA FIXTURE EST SYNTHÉTIQUE MAIS STRUCTURELLEMENT FIDÈLE. Numéros de compte,
// symboles et libellés sont inventés ; l'ordre des colonnes, les cellules vides
// et les formats de nombre sont ceux de l'export réel. La doctrine du dépôt
// interdit qu'une donnée de client entre dans une fixture.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parserCollage } from '../historique';
import {
  indexerEntetes, estLigneEntete, verifierCoherence, normaliserEntete,
  COLONNES_REQUISES, COLONNES_FACULTATIVES, COLONNES_IGNOREES,
  MOTIF_LIGNE_INCOHERENTE, ALIAS_COLONNES, type ChampHistorique,
} from '../colonnes-historique';

// ── LES EN-TÊTES RÉELS, dans l'ordre de l'export ─────────────────────────────
const AVEC_NOM = [
  'Ind. VM', 'Description', 'Nom', 'Note', 'Traitement', 'Transaction',
  'Code de CP', 'Type', 'Symbole', 'Quantité', 'Prix', 'Devise', 'Total',
  'Commission', 'Gains/Pertes', 'Int. courus', 'Frais', 'PBR manuel',
  'Solde', 'No de compte',
];
/** Le format réel de Nicolas : le même, moins « Nom ». Dix-neuf colonnes. */
const SANS_NOM = AVEC_NOM.filter((c) => c !== 'Nom');

/**
 * LES LIGNES, décrites par CHAMP plutôt que par rang — sans quoi la fixture
 * elle-même reproduirait le défaut qu'on corrige.
 */
type Ligne = Partial<Record<string, string>>;

const LIGNES: Ligne[] = [
  // Une VENTE avec gain/perte, en dollars canadiens.
  {
    'Ind. VM': 'O', Description: 'FICTIVE TECH INC', Nom: 'Client Synthetique',
    Note: 'ordre au marche', Traitement: '2026-03-17', Transaction: '2026-03-15',
    'Code de CP': 'CP1', Type: 'Vente', Symbole: 'FCT', 'Quantité': '-140',
    Prix: '141,00', Devise: 'CAD', Total: '19 740,00', Commission: '9,95',
    'Gains/Pertes': '11 985,00', 'Int. courus': '', Frais: '0,00',
    'PBR manuel': '', Solde: '25 000,00', 'No de compte': '99-FICT-A',
  },
  // Un ACHAT, avec une NOTE VIDE — le cas qui décalait tout si on filtrait.
  {
    'Ind. VM': 'O', Description: 'SYNTH INDUSTRIES LTEE', Nom: 'Client Synthetique',
    Note: '', Traitement: '2026-04-02', Transaction: '2026-03-31',
    'Code de CP': 'CP1', Type: 'Achat', Symbole: 'SYN', 'Quantité': '200',
    Prix: '52,50', Devise: 'CAD', Total: '-10 500,00', Commission: '9,95',
    'Gains/Pertes': '', 'Int. courus': '', Frais: '0,00',
    'PBR manuel': '', Solde: '14 490,05', 'No de compte': '99-FICT-A',
  },
  // Une transaction d'ENCAISSE, sans symbole ni quantité.
  {
    'Ind. VM': '', Description: 'DEPOT', Nom: 'Client Synthetique',
    Note: 'virement', Traitement: '2026-05-04', Transaction: '2026-05-04',
    'Code de CP': '', Type: 'Cotisation', Symbole: '', 'Quantité': '',
    Prix: '', Devise: 'CAD', Total: '5 000,00', Commission: '',
    'Gains/Pertes': '', 'Int. courus': '', Frais: '', 'PBR manuel': '',
    Solde: '19 490,05', 'No de compte': '99-FICT-A',
  },
  // Une ligne en dollars AMÉRICAINS.
  {
    'Ind. VM': 'O', Description: 'NORTHBOUND SYNTH CORP', Nom: 'Client Synthetique',
    Note: '', Traitement: '2026-06-11', Transaction: '2026-06-09',
    'Code de CP': 'CP2', Type: 'Vente', Symbole: 'NSC', 'Quantité': '-50',
    Prix: '88,20', Devise: 'USD', Total: '4 410,00', Commission: '9,95',
    'Gains/Pertes': '-1 240,00', 'Int. courus': '', Frais: '0,00',
    'PBR manuel': '', Solde: '4 400,05', 'No de compte': '99-FICT-B',
  },
];

/** Assemble un collage : en-têtes + lignes, dans l'ordre de colonnes demandé. */
function collage(entetes: string[], lignes: Ligne[] = LIGNES): string {
  const corps = lignes.map((l) => entetes.map((e) => l[e] ?? '').join('\t'));
  return [entetes.join('\t'), ...corps].join('\n');
}

/** Ce qui doit être identique d'un format à l'autre : le métier, pas le décor. */
const metier = (r: ReturnType<typeof parserCollage>) =>
  r.lignes.map((l) => ({
    date: l.date, type: l.type, symbole: l.symbole, quantite: l.quantite,
    prix: l.prix, devise: l.devise, total: l.total,
    gainsPertes: l.gainsPertes, solde: l.solde, noCompte: l.noCompte,
  }));

// ═══════════════════════════════════════════════════════════════════════════
// CH1 — LE TEST PRINCIPAL : AVEC OU SANS LE NOM DU CLIENT
// ═══════════════════════════════════════════════════════════════════════════

describe('CH1 · la colonne du nom du client est facultative', () => {
  it('le même jeu, avec et sans « Nom », donne le même résultat métier', () => {
    // ⚠ C'EST LE TEST DU LOT. Avant, 19 colonnes tombaient dans la branche
    // « 18 » avec un décalage de 2 : `noCompte` lisait « Solde ».
    const a = parserCollage(collage(AVEC_NOM));
    const b = parserCollage(collage(SANS_NOM));
    expect(a.rejet).toBeNull();
    expect(b.rejet).toBeNull();
    expect(b.lignes).toHaveLength(LIGNES.length);
    expect(metier(b)).toEqual(metier(a));
  });

  it('et le décalage historique aurait été visible : le compte reste un compte', () => {
    const b = parserCollage(collage(SANS_NOM));
    for (const l of b.lignes) {
      expect(l.noCompte, 'le numéro de compte a glissé').toMatch(/^99-FICT-[AB]$/);
      expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Le seul champ qui change entre les deux formats est celui qu'on a retiré.
    expect(b.lignes.every((l) => l.nom === '')).toBe(true);
    expect(parserCollage(collage(AVEC_NOM)).lignes.every((l) => l.nom !== '')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH2 — L'ORDRE DES COLONNES N'A AUCUNE IMPORTANCE
// ═══════════════════════════════════════════════════════════════════════════

describe('CH2 · colonnes réordonnées', () => {
  it('le même fichier, colonnes permutées, donne le même métier', () => {
    const permute = [...SANS_NOM].reverse();
    expect(metier(parserCollage(collage(permute))))
      .toEqual(metier(parserCollage(collage(SANS_NOM))));
  });

  it('même en déplaçant « No de compte » au tout début', () => {
    const deplace = ['No de compte', ...SANS_NOM.filter((c) => c !== 'No de compte')];
    expect(metier(parserCollage(collage(deplace))))
      .toEqual(metier(parserCollage(collage(SANS_NOM))));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH3 — UNE COLONNE INCONNUE NE DÉCALE RIEN
// ═══════════════════════════════════════════════════════════════════════════

describe('CH3 · colonne décorative supplémentaire', () => {
  it('insérée au milieu, elle est ignorée et ne déplace aucune colonne connue', () => {
    const avecDeco = [...SANS_NOM];
    avecDeco.splice(5, 0, 'Indicateur maison');
    const r = parserCollage(collage(avecDeco));
    expect(r.rejet).toBeNull();
    expect(metier(r)).toEqual(metier(parserCollage(collage(SANS_NOM))));
    expect(indexerEntetes(avecDeco).inconnues).toContain('Indicateur maison');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH4 — UNE COLONNE REQUISE ABSENTE : REJET, JAMAIS COMPENSATION
// ═══════════════════════════════════════════════════════════════════════════

describe('CH4 · rejet explicite', () => {
  it('« Gains/Pertes » absente : le format est refusé, et nommé', () => {
    // ⚠ LA COLONNE FISCALE PAR EXCELLENCE. L'accepter en la traitant comme
    // vide ferait tomber les gains réalisés de l'année à zéro, en silence.
    const ampute = SANS_NOM.filter((c) => c !== 'Gains/Pertes');
    const r = parserCollage(collage(ampute));
    expect(r.rejet?.motif).toBe('colonnes-requises-absentes');
    expect(r.rejet?.colonnes).toContain('gainsPertes');
    expect(r.lignes).toHaveLength(0);
  });

  it('« No de compte » absente : refusé aussi', () => {
    const ampute = SANS_NOM.filter((c) => c !== 'No de compte');
    const r = parserCollage(collage(ampute));
    // ⚠ CE TEST A CHANGÉ LE CODE. Il exigeait un rejet ; il obtenait quatre
    // lignes parsées de travers, parce que la ligne d'en-têtes n'était plus
    // reconnue et que le collage retombait sur le repli POSITIONNEL. Le seuil
    // de reconnaissance ne dépend plus des champs présents.
    expect(r.rejet?.motif).toBe('colonnes-requises-absentes');
    expect(r.rejet?.colonnes).toContain('noCompte');
    expect(r.lignes).toHaveLength(0);
  });

  it('aucune colonne n’est décalée pour compenser une absence', () => {
    const ampute = SANS_NOM.filter((c) => c !== 'Gains/Pertes');
    expect(parserCollage(collage(ampute)).lignes).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH5 — LES CELLULES VIDES RESTENT À LEUR PLACE
// ═══════════════════════════════════════════════════════════════════════════

describe('CH5 · une cellule vide ne décale pas ses voisines', () => {
  it('la ligne à « Note » vide garde son type, son symbole et son compte', () => {
    const r = parserCollage(collage(SANS_NOM));
    const achat = r.lignes.find((l) => l.type === 'Achat');
    expect(achat).toBeDefined();
    expect(achat!.note).toBe('');
    expect(achat!.symbole).toBe('SYN');
    expect(achat!.noCompte).toBe('99-FICT-A');
    expect(achat!.total).toBe(-10_500);
  });

  it('la ligne d’encaisse, sans symbole ni quantité, reste alignée', () => {
    const r = parserCollage(collage(SANS_NOM));
    const depot = r.lignes.find((l) => l.type === 'Cotisation');
    expect(depot).toBeDefined();
    expect(depot!.symbole).toBe('');
    expect(depot!.quantite).toBeNull();
    expect(depot!.total).toBe(5_000);
    expect(depot!.noCompte).toBe('99-FICT-A');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH6 — UNE LIGNE STRUCTURELLEMENT DÉCALÉE EST DIAGNOSTIQUÉE
// ═══════════════════════════════════════════════════════════════════════════

describe('CH6 · décalage détecté, jamais réparé', () => {
  it('une ligne dont les cellules ont glissé est écartée, pas devinée', () => {
    // Le symptôme réel : Transaction = « SA1H », Type = « T822D9 ».
    const cassee: Ligne = {
      Transaction: 'SA1H', 'Code de CP': 'Remboursement', Type: 'T822D9',
      Devise: 'ZZZ', 'Quantité': 'abc', Total: 'xyz',
      'Gains/Pertes': '', Symbole: 'X', 'No de compte': '99-FICT-A',
    };
    const r = parserCollage(collage(SANS_NOM, [LIGNES[0], cassee]));
    expect(r.incoherentes).toBe(1);
    expect(r.lignes).toHaveLength(1);          // la bonne ligne passe
    expect(r.lignes[0].type).toBe('Vente');
    // ⚠ AUCUNE TENTATIVE DE RECALAGE : rien n'a été « rattrapé ».
    expect(r.lignes.some((l) => l.type === 'T822D9')).toBe(false);
  });

  it('le verdict porte un motif canonique et nomme les champs fautifs', () => {
    const carte = indexerEntetes(SANS_NOM);
    const cellules = SANS_NOM.map((e) =>
      e === 'Devise' ? 'ZZZ' : e === 'Total' ? 'xyz' : '');
    const v = verifierCoherence(cellules, carte);
    expect(v.coherente).toBe(false);
    if (!v.coherente) {
      expect(v.motif).toBe(MOTIF_LIGNE_INCOHERENTE);
      expect(v.details).toEqual(expect.arrayContaining(['devise', 'total']));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH7 — LES ANCIENS FORMATS SANS EN-TÊTES CONTINUENT DE FONCTIONNER
// ═══════════════════════════════════════════════════════════════════════════

describe('CH7 · le repli positionnel survit', () => {
  const sansEntete = (entetes: string[]) =>
    LIGNES.map((l) => entetes.map((e) => l[e] ?? '').join('\t')).join('\n');

  it('20 colonnes sans ligne de titres : lu comme avant', () => {
    const r = parserCollage(sansEntete(AVEC_NOM));
    expect(r.lignes.length).toBeGreaterThan(0);
    expect(r.lignes.every((l) => /^99-FICT-[AB]$/.test(l.noCompte))).toBe(true);
    expect(r.lignes[0].type).toBe('Vente');
  });

  it('18 colonnes sans ligne de titres : lu comme avant', () => {
    // La carte à 18 est celle à 20 moins ses deux premières colonnes.
    const dix_huit = AVEC_NOM.slice(2);
    const r = parserCollage(sansEntete(dix_huit));
    expect(r.lignes.length).toBeGreaterThan(0);
    expect(r.lignes.every((l) => /^99-FICT-[AB]$/.test(l.noCompte))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CH8 — LE CONTRAT DES COLONNES
// ═══════════════════════════════════════════════════════════════════════════

describe('CH8 · requises, facultatives, ignorées', () => {
  it('les trois listes couvrent tout le champ, sans recoupement', () => {
    const toutes = [...COLONNES_REQUISES, ...COLONNES_FACULTATIVES, ...COLONNES_IGNOREES];
    expect(new Set(toutes).size, 'une colonne est dans deux listes').toBe(toutes.length);
    const connues = Object.keys(ALIAS_COLONNES) as ChampHistorique[];
    expect([...toutes].sort()).toEqual([...connues].sort());
  });

  it('« Nom » est facultative, « Gains/Pertes » est requise', () => {
    expect(COLONNES_FACULTATIVES).toContain('nom');
    expect(COLONNES_REQUISES).toContain('gainsPertes');
  });

  it('la normalisation ne tolère que la typographie', () => {
    expect(normaliserEntete('  QUANTITÉ ')).toBe(normaliserEntete('quantite'));
    expect(normaliserEntete('Gains / Pertes')).toBe('gains / pertes');
    expect(normaliserEntete('Ind. VM')).toBe('ind vm');
    // Deux titres qui diffèrent par un MOT restent différents.
    expect(normaliserEntete('Prix')).not.toBe(normaliserEntete('PBR manuel'));
  });

  it('la ligne d’en-têtes réelle est reconnue, une ligne de données ne l’est pas', () => {
    expect(estLigneEntete(SANS_NOM)).toBe(true);
    expect(estLigneEntete(AVEC_NOM)).toBe(true);
    expect(estLigneEntete(SANS_NOM.map(() => 'x'))).toBe(false);
  });
});
