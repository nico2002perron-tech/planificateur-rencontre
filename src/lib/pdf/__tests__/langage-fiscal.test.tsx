// LE LANGAGE FISCAL COMMUN — ce qui a été extrait, et ce qui le protège.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEUX CHOSES SONT PROUVÉES ICI, ET AUCUNE NE L'ÉTAIT AVANT L'EXTRACTION.
//
// 1. UNE STRATÉGIE NE PEUT PLUS SORTIR ANONYME. Le titre était posé par le
//    harnais d'aperçu, chacun le sien ; une page branchée dans le vrai flux
//    serait sortie sans titre sans que rien ne rougisse.
//
// 2. LES GARDES DE RENDU VIVENT À UN SEUL ENDROIT. Avant, le même défaut — un
//    tiret peint de la couleur du chiffre qu'il remplace — a dû être trouvé,
//    corrigé et verrouillé DEUX FOIS. Saboter `LigneChiffree` fait maintenant
//    rougir les batteries des deux stratégies d'un coup : c'est exactement ce
//    que la factorisation devait acheter.
//
// Données entièrement fictives.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import {
  argent, Etape, Carte, Manque, LigneChiffree, CarteChiffre, ValidationsAvantExecution,
  EnTeteStrategie, PageStrategieFiscale, NEUTRE,
} from '../langage-fiscal';
import {
  STRATEGIES_VISUELLES, CLES_STRATEGIES_VISUELLES, type CleStrategieVisuelle,
} from '../strategies-visuelles';
import { PRESENTATION_CALCULEE, PRESENTATION_DEGRADEE } from '../__fixtures__/cristallisation-pertes';
import {
  PRESENTATION_GAINS_CALCULEE, PRESENTATION_GAINS_DEGRADEE,
} from '../__fixtures__/cristallisation-gains';
import { textesDe, platDe, noeudsTexte } from './_texte-rendu';

// ═══════════════════════════════════════════════════════════════════════════
// LF1 — LE TITRE NE PEUT PLUS ÊTRE PERDU
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ LE TYPE FAIT LE TRAVAIL. `Record<CleStrategieVisuelle, …>` : ajouter une
 * stratégie au registre sans lui donner ici de page assemblée NE COMPILE PAS.
 * Le test qui suit la rend alors obligatoirement titrée.
 */
const ASSEMBLAGES: Record<CleStrategieVisuelle, () => React.ReactElement> = {
  'cristallisation-pertes': () =>
    STRATEGIES_VISUELLES['cristallisation-pertes'].Page({ presentation: PRESENTATION_CALCULEE }),
  'cristallisation-gains': () =>
    STRATEGIES_VISUELLES['cristallisation-gains'].Page({ presentation: PRESENTATION_GAINS_CALCULEE }),
};

const ASSEMBLAGES_DEGRADES: Record<CleStrategieVisuelle, () => React.ReactElement> = {
  'cristallisation-pertes': () =>
    STRATEGIES_VISUELLES['cristallisation-pertes'].Page({ presentation: PRESENTATION_DEGRADEE }),
  'cristallisation-gains': () =>
    STRATEGIES_VISUELLES['cristallisation-gains'].Page({ presentation: PRESENTATION_GAINS_DEGRADEE }),
};

describe('LF1 · une stratégie du registre ne peut pas perdre son titre', () => {
  it('le registre n’est pas vide, et couvre les deux stratégies dessinées', () => {
    expect(CLES_STRATEGIES_VISUELLES.length).toBeGreaterThanOrEqual(2);
    expect(CLES_STRATEGIES_VISUELLES).toContain('cristallisation-pertes');
    expect(CLES_STRATEGIES_VISUELLES).toContain('cristallisation-gains');
  });

  for (const cle of CLES_STRATEGIES_VISUELLES) {
    it(`${cle} · l’en-tête déclaré est réellement RENDU par la page`, () => {
      const { entete } = STRATEGIES_VISUELLES[cle];
      // Un titre vide serait un « oubli conforme au type » : on l'interdit.
      expect(entete.titre.trim().length, `${cle} : titre vide`).toBeGreaterThan(3);
      // ⚠ ET UN SOUS-TITRE BLANC AUSSI. `sousTitre: ' '` passait le type, passait
      // la garde, et décalait la page de 13 pt sans rien afficher — un oubli
      // déguisé en refus. Refuser, c'est écrire `null`.
      expect(entete.sousTitre === null || entete.sousTitre.trim().length > 3,
        `${cle} : sous-titre blanc — écrire \`null\` pour refuser`).toBe(true);

      const t = platDe(ASSEMBLAGES[cle]());
      expect(t, `${cle} : titre absent de la page`).toContain(entete.titre);
      if (entete.sousTitre !== null) {
        expect(t, `${cle} : sous-titre absent`).toContain(entete.sousTitre);
      }
    });

    it(`${cle} · le titre survit au statut dégradé`, () => {
      // C'est le cas que le conseiller verra le plus souvent. Une page sans
      // chiffre reste une page qui se nomme.
      const { entete } = STRATEGIES_VISUELLES[cle];
      expect(platDe(ASSEMBLAGES_DEGRADES[cle]()), cle).toContain(entete.titre);
    });

    it(`${cle} · le titre n’est posé QU'UNE FOIS — pas de doublon harnais/page`, () => {
      const { entete } = STRATEGIES_VISUELLES[cle];
      const t = platDe(ASSEMBLAGES[cle]());
      const n = t.split(entete.titre).length - 1;
      expect(n, `${cle} : titre présent ${n} fois`).toBe(1);
    });
  }
});

/**
 * LES MODULES QUI EXPOSENT UNE PAGE DE STRATÉGIE ASSEMBLÉE.
 *
 * ⚠ DÉCOUVERTS PAR CE QU'ILS EXPORTENT, PAS PAR LEUR NOM DE FICHIER. La
 * première version filtrait sur `page-cristallisation-*.tsx` : une page nommée
 * autrement — et le catalogue compte d'autres stratégies — s'échappait par
 * simple nommage. Un export est une intention ; un nom de fichier est un usage.
 */
function modulesDeStrategie(): string[] {
  return fs.readdirSync('src/lib/pdf')
    .filter((f) => f.endsWith('.tsx'))
    // ⚠ `langage-fiscal` exporte `PageStrategieFiscale`, qui est le GABARIT et
    // non une stratégie. On l'écarte nommément plutôt que par un motif plus
    // fin : un motif trop malin finirait par laisser passer une vraie page.
    .filter((f) => f !== 'langage-fiscal.tsx')
    .filter((f) => /export function PageStrategie\w+/
      .test(fs.readFileSync(`src/lib/pdf/${f}`, 'utf8')))
    .map((f) => f.replace(/\.tsx$/, ''));
}

describe('LF2 · aucune page de stratégie n’échappe au registre', () => {
  it('tout module exposant une `PageStrategie…` y est inscrit', () => {
    // ⚠ SANS CETTE GARDE, LE TYPE NE SUFFIT PAS : on peut créer une page et
    // simplement ne jamais l'inscrire.
    const modules = modulesDeStrategie();
    expect(modules.length).toBeGreaterThanOrEqual(2);

    const registre = fs.readFileSync('src/lib/pdf/strategies-visuelles.ts', 'utf8');
    for (const m of modules) {
      expect(registre, `${m} n’est pas inscrit au registre`).toContain(`./${m}`);
    }
    // Et le registre ne contient rien de plus que ces modules : une entrée en
    // trop, ou un module en trop, se voit par le compte.
    expect(CLES_STRATEGIES_VISUELLES.length,
      `${modules.length} module(s) exposent une page, ${CLES_STRATEGIES_VISUELLES.length} inscrite(s)`)
      .toBe(modules.length);

    // Et chacun expose bien son en-tête, sans quoi la page ne peut pas se nommer.
    for (const m of modules) {
      const source = fs.readFileSync(`src/lib/pdf/${m}.tsx`, 'utf8');
      expect(source, `${m} : pas d’en-tête exporté`).toMatch(/export const ENTETE_\w+: EnteteStrategie/);
    }
  });

  it('le harnais d’aperçu ne pose plus de titre lui-même', () => {
    // Il en posait un, différent de celui de la page, et hors de toute
    // vérification. Les aperçus passent maintenant par la forme assemblée.
    const harnais = fs.readFileSync(
      'src/lib/pdf/__tests__/diagramme-avant-strategie-apres.test.tsx', 'utf8');
    expect(harnais).toMatch(/PageStrategieCristallisationPertes/);
    expect(harnais).toMatch(/PageStrategieCristallisationGains/);
    expect(harnais).not.toMatch(/<PageCristallisationPertes\b/);
    expect(harnais).not.toMatch(/<PageCristallisationGains\b/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LF3 — LA GARDE QUI A DÛ ÊTRE ÉCRITE DEUX FOIS N'EXISTE PLUS QU'UNE
// ═══════════════════════════════════════════════════════════════════════════

describe('LF3 · `LigneChiffree` — une valeur absente n’est pas une valeur', () => {
  it('le tiret sort en gris, quelle que soit la couleur demandée', () => {
    // ⚠ SABOTAGE : rendre `couleur` inconditionnelle dans `LigneChiffree` fait
    // rougir CE test, PG15 (gains) et V19 (pertes) — trois d'un coup, au lieu
    // de deux corrections séparées comme avant l'extraction.
    for (const couleur of ['#2f8f4e', '#e05252', '#2563a8', '#3f9142']) {
      const [n] = noeudsTexte(
        <LigneChiffree libelle="Peu importe" valeur={null} couleur={couleur} />
      ).filter((x) => x.texte === '—');
      expect(n, `couleur demandée ${couleur}`).toBeDefined();
      expect(n.couleur, `couleur demandée ${couleur}`).toBe(NEUTRE.gris);
    }
  });

  it('mais un vrai montant garde SA couleur — sinon la garde serait creuse', () => {
    const n = noeudsTexte(
      <LigneChiffree libelle="Un montant" valeur={1234.5} couleur="#2f8f4e" />
    ).find((x) => x.texte === '1 234,50 $');
    expect(n).toBeDefined();
    expect(n?.couleur).toBe('#2f8f4e');
  });

  it('`CarteChiffre` obéit à la MÊME règle — c’est là qu’elle était contournée', () => {
    // ⚠ TROUVÉ EN CHERCHANT LA RÈGLE, PAS LE SYMPTÔME. `LigneChiffree` était
    // corrigée et verrouillée, mais les deux pages écrivaient encore
    // `valeur={x === null ? '—' : argent(x)}` AVEC une couleur d'action sur
    // `CarteChiffre` : une perte latente absente sortait en ROUGE, une perte
    // fiscale absente en BLEU. Même défaut, autre composant.
    for (const couleur of ['#e05252', '#2563a8', '#2f8f4e']) {
      const n = noeudsTexte(<CarteChiffre libelle="Peu importe" valeur={null} couleur={couleur} />)
        .find((x) => x.texte === '—');
      expect(n, `couleur demandée ${couleur}`).toBeDefined();
      expect(n?.couleur, `couleur demandée ${couleur}`).toBe(NEUTRE.gris);
    }
    // Et un vrai montant garde sa couleur, sinon la garde serait creuse.
    const vrai = noeudsTexte(<CarteChiffre libelle="L" valeur={15537.41} couleur="#e05252" />)
      .find((x) => x.texte === '15 537,41 $');
    expect(vrai?.couleur).toBe('#e05252');
  });

  it('aucune page ne contourne la règle en formatant le tiret elle-même', () => {
    // La signature `valeur: number | null` rend le contournement impossible,
    // mais on le dit : c'est ce motif exact qui avait échappé aux deux batteries.
    for (const f of ['page-cristallisation-pertes', 'page-cristallisation-gains']) {
      const source = fs.readFileSync(`src/lib/pdf/${f}.tsx`, 'utf8');
      expect(source, `${f} : tiret fabriqué à la main`).not.toMatch(/\?\s*'—'\s*:/);
    }
  });

  it('le signe demandé est appliqué au montant, jamais au tiret', () => {
    expect(platDe(<LigneChiffree libelle="L" valeur={9031.6} signe="−" />))
      .toContain('−9 031,60 $');
    expect(platDe(<LigneChiffree libelle="L" valeur={null} signe="−" />))
      .not.toContain('−—');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LF4 — LES TROIS CONTRAINTES DE RENDU SURVIVENT À L'EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ LES COMMENTAIRES DU DÉPÔT CITENT LE BUG LUI-MÊME (« un `#ffffff55` sortait
 * VERT »). Un scan qui les lit se déclenche sur sa propre documentation.
 */
const sansCommentaires = (source: string) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

/**
 * TOUTE LA FAMILLE FISCALE — découverte, pas listée à la main.
 *
 * ⚠ UNE LISTE ÉCRITE À LA MAIN NE SUIT PAS LA TROISIÈME STRATÉGIE. LF2
 * découvrait déjà les pages en lisant le répertoire ; laisser la garde des
 * couleurs sur une liste figée aurait créé un angle mort au premier ajout.
 */
function familleFiscale(): string[] {
  const racine = 'src/lib/pdf/';
  const depuis = (f: string) => racine + f;
  const modules = fs.readdirSync(racine).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  // Un module est « fiscal » s'il participe au langage des cinq étapes :
  // il l'importe, ou il EST le langage.
  return modules.filter((f) => {
    if (f === 'langage-fiscal.tsx' || f === 'logo-societe-fiscal.tsx') return true;
    return /from '\.\/langage-fiscal'/.test(fs.readFileSync(depuis(f), 'utf8'));
  }).map(depuis);
}

describe('LF4 · les trois contraintes de rendu, sur toute la famille', () => {
  it('la famille est découverte, et elle n’est pas vide', () => {
    const famille = familleFiscale();
    expect(famille.length).toBeGreaterThanOrEqual(5);
    for (const attendu of [
      'src/lib/pdf/langage-fiscal.tsx',
      'src/lib/pdf/page-cristallisation-pertes.tsx',
      'src/lib/pdf/page-cristallisation-gains.tsx',
      'src/lib/pdf/diagramme-avant-strategie-apres.tsx',
      'src/lib/pdf/parcours-gain-cristallise.tsx',
      'src/lib/pdf/logo-societe-fiscal.tsx',
    ]) {
      expect(famille, attendu).toContain(attendu);
    }
  });

  it('contrainte 1 · aucune couleur hexadécimale à huit caractères', () => {
    // react-pdf les rend arbitrairement — un `#ffffff55` sortait VERT.
    for (const f of familleFiscale()) {
      const source = sansCommentaires(fs.readFileSync(f, 'utf8'));
      const fautifs = source.match(/['"]#[0-9a-fA-F]{8}['"]/g) ?? [];
      expect(fautifs, `${f} → ${fautifs.join(', ')}`).toEqual([]);
    }
  });

  it('contrainte 2 · aucune section dégradée ne reste muette, sur AUCUNE page', () => {
    // ⚠ LA PREMIÈRE VERSION DE CE TEST BÉNISSAIT LE DÉFAUT : elle vérifiait
    // qu'un `<Manque texte="" />` rend bien du vide. C'est le contraire qu'il
    // faut prouver — et sur les pages réelles, pas sur la primitive isolée.
    expect(platDe(<Manque texte="La donnée n’est pas au dossier." />))
      .toContain('La donnée n’est pas au dossier.');

    for (const cle of CLES_STRATEGIES_VISUELLES) {
      const t = platDe(ASSEMBLAGES_DEGRADES[cle]());
      // Chaque repli posé par la page dégradée porte une phrase, pas un blanc.
      const replis = noeudsTexte(ASSEMBLAGES_DEGRADES[cle]())
        .filter((n) => n.couleur === NEUTRE.gris);
      expect(replis.length, `${cle} : aucune zone de repli`).toBeGreaterThan(0);
      for (const r of replis) {
        expect(r.texte.trim().length, `${cle} : un repli vide`).toBeGreaterThan(0);
      }
      expect(t.length, cle).toBeGreaterThan(400);
    }
  });

  it('contrainte 3 · aucun glyphe absent des polices dans le langage commun', () => {
    // « ↓ » (U+2193) sortait en petits guillemets, « ⚠ » (U+26A0) en carré vide.
    // On regarde le texte RENDU, pas les commentaires du fichier.
    const rendus = [
      ...textesDe(<Etape numero={1} titre="Un titre">{null}</Etape>),
      ...textesDe(<Carte>{null}</Carte>),
      ...textesDe(<Manque texte="Un repli." />),
      ...textesDe(<LigneChiffree libelle="L" valeur={null} />),
      ...textesDe(<ValidationsAvantExecution
        apparenceConfirme={{ fond: '#e3f3e4', texte: '#3f9142' }}
        validations={[
          { libelle: 'Confirmée', statut: 'confirme' },
          { libelle: 'À confirmer', statut: 'a-confirmer' },
        ]} />),
      ...textesDe(<EnTeteStrategie entete={{ titre: 'T', sousTitre: 'S' }} />),
    ].join('');
    for (const glyphe of ['↓', '↑', '→', '←', '⚠', '✓', '✔', '✗', '•']) {
      expect(rendus, glyphe).not.toContain(glyphe);
    }
    // Et sur les pages réelles, calculées comme dégradées.
    for (const cle of CLES_STRATEGIES_VISUELLES) {
      for (const faire of [ASSEMBLAGES[cle], ASSEMBLAGES_DEGRADES[cle]]) {
        const t = platDe(faire());
        for (const glyphe of ['↓', '↑', '→', '←', '⚠', '✓', '✔', '✗', '•']) {
          expect(t, `${cle} · ${glyphe}`).not.toContain(glyphe);
        }
      }
    }
  });

  it('contrainte 4 · les teintes du langage commun sont toutes opaques', () => {
    for (const [nom, valeur] of Object.entries(NEUTRE)) {
      expect(valeur, nom).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LF5 — LES PRIMITIVES EXTRAITES SE COMPORTENT COMME AVANT
// ═══════════════════════════════════════════════════════════════════════════

describe('LF5 · le comportement des primitives', () => {
  it('`argent` rend le format canadien, au centième', () => {
    expect(argent(8997.81)).toMatch(/^8[\s   ]997,81 \$$/);
    expect(argent(0)).toBe('0,00 $');
    expect(argent(-15)).toMatch(/^-15,00 \$$/);
  });

  it('la teinte de « confirmé » vient de l’appelant, jamais d’un défaut', () => {
    // ⚠ LES DEUX PAGES NE RENDAIENT PAS CE STATUT PAREIL avant l'extraction :
    // pertes en vert, gains en gris. Le composant ne tranche donc pas — sans
    // valeur par défaut, personne n'hérite du choix du voisin par mégarde.
    const rendre = (a: { fond: string; texte: string }) =>
      noeudsTexte(<ValidationsAvantExecution apparenceConfirme={a} validations={[
        { libelle: 'Prouvée', statut: 'confirme' },
        { libelle: 'À voir', statut: 'a-confirmer' },
      ]} />);
    expect(rendre({ fond: '#e3f3e4', texte: '#3f9142' })
      .find((n) => n.texte === 'Confirmé')?.couleur).toBe('#3f9142');
    expect(rendre({ fond: NEUTRE.fond, texte: NEUTRE.gris })
      .find((n) => n.texte === 'Confirmé')?.couleur).toBe(NEUTRE.gris);
    // « À confirmer » reste neutre dans les deux cas — ça, c'était identique.
    for (const a of [{ fond: '#e3f3e4', texte: '#3f9142' }, { fond: NEUTRE.fond, texte: NEUTRE.gris }]) {
      expect(rendre(a).find((n) => n.texte === 'À confirmer')?.couleur).toBe(NEUTRE.gris);
    }
  });

  it('et chaque page garde SA teinte historique — mesurée sur le code d’avant', () => {
    // pertes : vert sur fond vert · gains : gris sur fond gris.
    const pertes = fs.readFileSync('src/lib/pdf/page-cristallisation-pertes.tsx', 'utf8');
    const gains = fs.readFileSync('src/lib/pdf/page-cristallisation-gains.tsx', 'utf8');
    expect(pertes).toMatch(/apparenceConfirme=\{\{ fond: C\.vertFond, texte: C\.vert \}\}/);
    expect(gains).toMatch(/apparenceConfirme=\{\{ fond: NEUTRE\.fond, texte: NEUTRE\.gris \}\}/);
  });

  it('`EnTeteStrategie` sans sous-titre ne laisse pas de ligne fantôme', () => {
    const sans = textesDe(<EnTeteStrategie entete={{ titre: 'Titre seul', sousTitre: null }} />);
    expect(sans).toEqual(['Titre seul']);
    const avec = textesDe(<EnTeteStrategie entete={{ titre: 'T', sousTitre: 'S' }} />);
    expect(avec).toEqual(['T', 'S']);
  });

  it('une étape ne peut pas être coupée en deux par un saut de page', () => {
    // ⚠ `wrap={false}` N'EST PAS COSMÉTIQUE. Une étape coupée en son milieu se
    // lit comme un document abîmé — c'est le critère d'inspection qui a mené à
    // retirer le cadre superflu de l'étape 4 des gains. Rien ne le verrouillait.
    const e = <Etape numero={3} titre="Combien ?">{null}</Etape>;
    const rendu = (e.type as (p: unknown) => { props: Record<string, unknown> })(e.props);
    expect(rendu.props.wrap).toBe(false);
  });

  it('la géométrie de page est celle qui a été inspectée sur PDF', () => {
    // Les six pages rastérisées avant/après l'extraction sont identiques au
    // pixel. Ce test empêche la dérive silencieuse de ce qui a été regardé.
    const p = <PageStrategieFiscale entete={{ titre: 'T', sousTitre: null }}>{null}</PageStrategieFiscale>;
    const rendu = (p.type as (x: unknown) => {
      props: { size?: string; style?: Record<string, unknown> };
    })(p.props);
    expect(rendu.props.size).toBe('LETTER');
    expect(rendu.props.style).toMatchObject({
      paddingHorizontal: 40, paddingVertical: 34,
      fontFamily: 'Open Sans', backgroundColor: NEUTRE.page,
    });
  });
});
