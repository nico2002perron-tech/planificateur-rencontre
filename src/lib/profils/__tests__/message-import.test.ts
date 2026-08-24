// CE QUE L'IMPORT DIT AU PLANIFICATEUR — trois niveaux, jamais confondus.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE DÉFAUT QUE CETTE BATTERIE VERROUILLE.
//
// Le parseur produisait déjà `rejet` et `incoherentes` ; l'écran n'affichait
// que le nombre de transactions ajoutées. Un fichier REFUSÉ se lisait donc
// « 0 transaction » — le planificateur n'avait aucun moyen de savoir quoi
// corriger. C'est la même famille de piège que le refus muet du 17 août 2026.
//
// ⚠ ET LES TROIS NIVEAUX NE SE CONFONDENT JAMAIS :
//   un fichier refusé n'est PAS « un import réussi à 0 transaction » ;
//   un fichier partiellement lu n'est PAS un refus complet.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { messageImport, nomLisibleColonne, type ResumeImportUI } from '../message-import';

const resume = (o: Partial<ResumeImportUI> = {}): ResumeImportUI => ({
  nouvelles: 428, doublons: 0, ignorees: 0, incoherentes: 0, rejet: null, ...o,
});

// ═══════════════════════════════════════════════════════════════════════════
// MI1 — L'IMPORT NORMAL
// ═══════════════════════════════════════════════════════════════════════════

describe('MI1 · import normal', () => {
  it('succès, avec le compte de transactions', () => {
    const m = messageImport(resume());
    expect(m.niveau).toBe('succes');
    expect(m.titre).toContain('428 transactions ajoutées');
    expect(m.details.join(' ')).toContain('428 transactions importées');
  });

  it('les doublons se disent, sans alarmer', () => {
    const m = messageImport(resume({ nouvelles: 12, doublons: 416 }));
    expect(m.niveau).toBe('succes');
    expect(m.details.join(' ')).toContain('416 déjà présentes');
  });

  it('le singulier est respecté — un document remis ne dit pas « 1 transactions »', () => {
    const m = messageImport(resume({ nouvelles: 1 }));
    expect(m.titre).toContain('1 transaction ajoutée');
    expect(m.titre).not.toContain('transactions');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MI2 — LE FICHIER REFUSÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('MI2 · colonne requise absente', () => {
  const refuse = () => messageImport(resume({
    nouvelles: 0,
    rejet: { motif: 'colonnes-requises-absentes', colonnes: ['gainsPertes', 'noCompte'] },
  }));

  it('niveau ERREUR, jamais un succès à zéro transaction', () => {
    // ⚠ C'EST LE PIÈGE QUE CE LOT SUPPRIME.
    const m = refuse();
    expect(m.niveau).toBe('erreur');
    expect(m.titre).toBe('Import impossible');
    expect(m.titre).not.toMatch(/0 transaction/);
    expect(m.details.join(' ')).not.toMatch(/^0 transaction/);
  });

  it('les colonnes sont nommées COMME DANS LE FICHIER, pas comme dans le code', () => {
    // ⚠ « gainsPertes » N'ATTEINT PAS L'ÉCRAN. Le planificateur cherche
    // « Gains/Pertes » dans son export ; traduire est notre travail.
    const t = refuse().details.join(' ');
    expect(t).toContain('Gains/Pertes');
    expect(t).toContain('No de compte');
    expect(t).not.toContain('gainsPertes');
    expect(t).not.toContain('noCompte');
  });

  it('aucun code interne, aucune trace technique dans le message', () => {
    const m = refuse();
    const tout = [m.titre, ...m.details].join(' ');
    expect(tout).not.toContain('colonnes-requises-absentes');
    expect(tout).not.toMatch(/Error|stack|undefined|null/);
    expect(tout).toContain('Vérifiez l’export Croesus');
  });

  it('chaque colonne du contrat a un nom lisible', () => {
    for (const [interne, lisible] of [
      ['gainsPertes', 'Gains/Pertes'], ['noCompte', 'No de compte'],
      ['date', 'Transaction'], ['devise', 'Devise'], ['quantite', 'Quantité'],
    ] as const) {
      expect(nomLisibleColonne(interne), interne).toBe(lisible);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MI3 — L'IMPORT PARTIEL
// ═══════════════════════════════════════════════════════════════════════════

describe('MI3 · lignes incohérentes avec les en-têtes', () => {
  const partiel = () => messageImport(resume({ nouvelles: 428, incoherentes: 2 }));

  it('niveau AVERTISSEMENT — ni succès muet, ni refus complet', () => {
    const m = partiel();
    expect(m.niveau).toBe('avertissement');
    expect(m.niveau).not.toBe('erreur');
  });

  it('les lignes valides sont bien comptées', () => {
    expect(partiel().details.join(' ')).toContain('428 transactions importées');
    expect(partiel().titre).toContain('2 lignes');
  });

  it('on ne laisse JAMAIS croire qu’elles ont été réparées', () => {
    // ⚠ LE POINT DE DOCTRINE. Le parseur exclut plutôt que de deviner ; le
    // message doit dire exactement ça, sinon le planificateur suppose que le
    // système « s'est débrouillé ».
    const t = partiel().details.join(' ');
    expect(t).toContain('exclues plutôt que corrigées automatiquement');
    // ⚠ PIÈGE PAYÉ ICI : /corrigé(es)?/ matchait « corrigées », parce que
    // « é » n'est pas un caractère de mot en JS — la frontière tombait au
    // milieu. On énonce la phrase attendue, et on interdit NOMMÉMENT le
    // vocabulaire de la réparation.
    for (const interdit of ['réparé', 'rattrapé', 'ajusté', 'recalé', 'reconstitué']) {
      expect(t, interdit).not.toContain(interdit);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MI4 — LES LIGNES IGNORÉES NE SONT PAS UNE CORRUPTION
// ═══════════════════════════════════════════════════════════════════════════

describe('MI4 · lignes ignorées', () => {
  it('elles n’abaissent pas le niveau : l’import reste un succès', () => {
    // ⚠ CE SONT LES LIGNES SANS DATE NI COMPTE : totaux, sous-totaux,
    // séparateurs — le décor ordinaire d'un export. Les peindre en rouge
    // ferait chercher une panne qui n'existe pas.
    const m = messageImport(resume({ ignorees: 6 }));
    expect(m.niveau).toBe('succes');
  });

  it('elles se mentionnent discrètement, et sont nommées pour ce qu’elles sont', () => {
    const t = messageImport(resume({ ignorees: 6 })).details.join(' ');
    expect(t).toContain('non transactionnelles');
    expect(t).toContain('totaux, séparateurs');
  });

  it('aucune mention quand il n’y en a pas — pas de bruit inutile', () => {
    expect(messageImport(resume({ ignorees: 0 })).details.join(' '))
      .not.toContain('ignorée');
  });

  it('un fichier avec ignorées ET incohérentes reste un avertissement', () => {
    // L'incohérence prime : c'est elle qui signale une structure douteuse.
    const m = messageImport(resume({ ignorees: 6, incoherentes: 1 }));
    expect(m.niveau).toBe('avertissement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MI5 — LES TROIS NIVEAUX SONT DISTINCTS
// ═══════════════════════════════════════════════════════════════════════════

describe('MI5 · trois niveaux, trois situations', () => {
  it('chaque situation produit son niveau, et un seul', () => {
    expect(messageImport(resume()).niveau).toBe('succes');
    expect(messageImport(resume({ incoherentes: 1 })).niveau).toBe('avertissement');
    expect(messageImport(resume({
      nouvelles: 0, rejet: { motif: 'colonnes-requises-absentes', colonnes: ['date'] },
    })).niveau).toBe('erreur');
  });

  it('le rejet prime sur tout le reste', () => {
    // Un fichier refusé n'a rien importé : parler de lignes exclues serait
    // trompeur, puisque AUCUNE ligne n'a été lue.
    const m = messageImport(resume({
      nouvelles: 0, incoherentes: 40, ignorees: 3,
      rejet: { motif: 'colonnes-requises-absentes', colonnes: ['total'] },
    }));
    expect(m.niveau).toBe('erreur');
    expect(m.details.join(' ')).not.toContain('40');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MI6 — L'ÉCRAN EST RÉELLEMENT BRANCHÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('MI6 · le câblage vers l’écran', () => {
  // ⚠ CE TEST LIT LA SOURCE, ET C'EST ASSUMÉ. L'environnement de test du dépôt
  // est `node` : les composants d'écran n'y sont pas rendables (doctrine de
  // vitest.config.ts). Un sabotage « l'écran cesse d'appeler messageImport »
  // laissait donc toute la batterie verte. Vérifier le branchement par la
  // source est imparfait, mais c'est la différence entre une garde et rien.
  const ecran = () => (require('node:fs') as typeof import('node:fs'))
    .readFileSync('src/app/(dashboard)/profils/EcranFiscal.tsx', 'utf8');

  it('l’écran appelle bien le constructeur de message', () => {
    expect(ecran()).toContain('messageImport(d.resume)');
  });

  it('les trois niveaux ont chacun leur rendu', () => {
    const s = ecran();
    expect(s, 'erreur').toMatch(/niveau === 'erreur'/);
    expect(s, 'avertissement').toMatch(/niveau === 'avertissement'/);
    // Trois teintes distinctes : rouge, ambre, vert.
    expect(s, 'rouge').toContain('bg-red-50');
    expect(s, 'ambre').toContain('bg-amber-50');
    expect(s, 'vert').toContain('bg-emerald-50');
  });

  it('un rejet ne vide pas la zone de collage', () => {
    // ⚠ LE PLANIFICATEUR DOIT POUVOIR CORRIGER SON EXPORT sans tout recoller.
    // `setColleTx('')` ne doit être atteint qu'après le retour anticipé.
    const s = ecran();
    const iRetour = s.indexOf("setErreur([m.titre, ...m.details].join(' '));");
    const iVider = s.indexOf("setColleTx('');", iRetour);
    expect(iRetour).toBeGreaterThan(-1);
    expect(s.slice(iRetour, iVider)).toContain('return;');
  });
});
