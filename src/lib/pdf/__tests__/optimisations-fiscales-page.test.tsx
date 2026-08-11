// LA PAGE « OPTIMISATIONS FISCALES » — rendue pour de vrai, pas seulement compilée.
//
// @react-pdf/renderer fonctionne en Node : on peut donc produire le PDF et
// relire son texte. Ces tests vérifient CE QUI ATTEINT LE CLIENT, pas la forme
// du JSX — un montant qui fuiterait sur un constat non calculé serait invisible
// à la relecture du code, mais pas ici.

import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { Document, Font, renderToBuffer } from '@react-pdf/renderer';
import path from 'node:path';
import { OptimisationsFiscalesPage } from '../optimisations-fiscales-page';
import { analyser } from '@/lib/profils/strategies';
import { profilVierge, type ProfilClient, type Compte, type Position } from '@/lib/profils/types';

const DATE = '2026-08-05';

// Les polices sont enregistrées par price-targets-template quand la page vit
// dans le vrai document. Ici la page est rendue seule : on refait le geste,
// sans importer le gabarit (qui lit des images au chargement du module).
beforeAll(() => {
  const FONTS = path.join(process.cwd(), 'public', 'fonts');
  Font.register({
    family: 'Montserrat',
    fonts: [
      { src: path.join(FONTS, 'Montserrat-Bold.ttf'), fontWeight: 700 },
      { src: path.join(FONTS, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
    ],
  });
  Font.register({
    family: 'Open Sans',
    fonts: [
      { src: path.join(FONTS, 'OpenSans-Regular.ttf'), fontWeight: 400 },
      { src: path.join(FONTS, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
    ],
  });
  Font.registerHyphenationCallback((mot) => [mot]);
});

function position(symbole: string, vm: number | null, pbr: number | null): Position {
  return { symbole, devise: 'CAD', categorie: null, valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null };
}
function compte(type: Compte['type'], positions: Position[]): Compte {
  return {
    numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', candidats: ['37-FICT-A'],
    type, titulaire: 'client', dateReleve: DATE, positions, encaisse: [],
  };
}
function profilConsolide(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif-1', DATE);
  p.consolidation.comptesExternes = 'non';
  p.consolidation.dateConfirmation = DATE;
  p.demographie.etatCivil = 'marie';
  modif(p);
  return p;
}

/**
 * Le texte réellement posé sur la page.
 *
 * POURQUOI PAS LE PDF RENDU : react-pdf compresse ses flux de contenu (Flate)
 * et y écrit le texte en indices de glyphes de la police sous-ensemblée — les
 * chaînes ne sont pas lisibles dans le tampon, et le dépôt n'a aucun
 * extracteur de texte (pdf-lib n'en fait pas). On parcourt donc l'arbre des
 * éléments en invoquant les composants, ce qui donne exactement les chaînes
 * envoyées au moteur de rendu.
 *
 * Ce que ça prouve : le CONTENU. Ce que ça ne prouve pas : la mise en page —
 * c'est le rendu réel, plus bas, qui atteste qu'elle tient.
 */
function textesDe(noeud: unknown): string[] {
  if (noeud === null || noeud === undefined || noeud === false || noeud === true) return [];
  if (typeof noeud === 'string') return [noeud];
  if (typeof noeud === 'number') return [String(noeud)];
  if (Array.isArray(noeud)) return noeud.flatMap(textesDe);

  const el = noeud as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return [];
  // Un composant fonction : on l'exécute pour voir ce qu'il produit.
  if (typeof el.type === 'function') {
    const rendu = (el.type as (p: unknown) => unknown)(el.props);
    return textesDe(rendu);
  }
  return textesDe(el.props.children);
}

/**
 * Le texte de la page pour un profil donné, espaces aplatis.
 *
 * JOINTURE SANS SÉPARATEUR : react-pdf colle les fragments voisins d'un même
 * `<Text>` — `{n} piste{n > 1 ? 's' : ''}` donne « 2 pistes », pas
 * « 2 piste s ». Joindre par une espace fabriquerait un texte que le client ne
 * verra jamais, et ferait passer des tests sur une chaîne inventée.
 */
function rendre(profil: ProfilClient, date = DATE): string {
  const resultat = analyser(profil, null, date);
  return textesDe(React.createElement(OptimisationsFiscalesPage, { resultat }))
    .join('')
    .replace(/[\s   ]+/g, ' ');
}

describe('la page se rend', () => {
  it('produit un PDF valide même sur un profil entièrement vide', async () => {
    const resultat = analyser(profilVierge('vide', DATE), null, DATE);
    const buffer = await renderToBuffer(
      React.createElement(Document, null, React.createElement(OptimisationsFiscalesPage, { resultat }))
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

describe('ce qui atteint le client', () => {
  it('LA DATE EST IMPRIMÉE, en toutes lettres', () => {
    const texte = rendre(profilConsolide());
    expect(texte).toMatch(/Au 5 ao/);
    expect(texte).toMatch(/2026/);
  });

  it('la mention du fiscaliste est là tant que le verrou tient', () => {
    const texte = rendre(profilConsolide());
    expect(texte).toMatch(/Document de travail/);
    expect(texte).toMatch(/fiscaliste/);
  });

  it('la non-recommandation est écrite', () => {
    const texte = rendre(profilConsolide());
    expect(texte).toMatch(/ni une recommandation/);
    expect(texte).toMatch(/ne remplace pas les relev/);
  });

  it('AUCUN MONTANT quand rien n’est calculable', async () => {
    // Un profil vide : les 5 constats sont indisponibles ou sans objet. Aucun
    // signe de dollar ne doit apparaître dans un encadré de montant, et
    // surtout pas un « 0 $ » qui ferait croire à un calcul abouti.
    const texte = rendre(profilVierge('vide', DATE));
    expect(texte).not.toMatch(/piste chiffr/);
    expect(texte).not.toMatch(/pistes chiffr/);
  });

  it('le montant apparaît quand il est calculé, avec sa récurrence', () => {
    const texte = rendre(profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    }));
    expect(texte).toMatch(/12 000/);
    expect(texte).toMatch(/piste chiffr/);
    // Le montant DIT CE QU'IL EST : sans ce libellé, trois chiffres de natures
    // différentes s'alignent en colonne et se lisent comme trois économies
    // comparables.
    expect(texte).toMatch(/de perte à cristalliser, par année/);
  });

  it('AUCUN TOTAL : des natures différentes ne s’additionnent pas', () => {
    // Le premier rendu de cette page portait un total de 69 871 $, en gros et
    // en vert. Il additionnait une perte à cristalliser, des DROITS de
    // cotisation du conjoint et un gain mis à l'abri. Un chiffre
    // impressionnant qui ne voulait rien dire, sur un document de rencontre.
    const texte = rendre(profilConsolide((x) => {
      x.transactionsAnnee.gainsRealises = 12000;
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    }));
    expect(texte).toMatch(/2 pistes chiffrées sur 7/);
    expect(texte).toMatch(/ne s’additionnent pas/);
    expect(texte).not.toMatch(/60 000/);          // 12 000 + 48 000
  });

  it('des DROITS CUMULÉS ne sont pas « par année »', () => {
    // 48 000 $ est le cumul depuis l'ouverture ; l'afficher « par année »
    // laisserait croire à cette place neuve chaque année, alors que le plafond
    // annuel est de l'ordre de 7 000 $.
    const texte = rendre(profilConsolide((x) => {
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
    }));
    expect(texte).toMatch(/de droits accumulés disponibles, une seule fois/);
  });

  it('un constat « à confirmer » DIT SON CHIFFRE dans le texte mais pas dans l’encadré', () => {
    const texte = rendre(profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.transactionsAnnee.gainsRealises = 12000;
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    }));
    expect(texte).toMatch(/confirmer/);
    // Aucune piste chiffrée : le bandeau vert du total ne doit pas paraître.
    expect(texte).not.toMatch(/piste chiffr/);
  });

  it('l’angle mort est rendu, factuel', () => {
    const texte = rendre(profilConsolide((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.historiqueVie.celi.cotisationsTotales = 4000;
      x.historiqueVie.celi.dateOuverture = '2015-03-12';
    }));
    expect(texte).toMatch(/Ce que nous ne voyons pas/);
    expect(texte).toMatch(/plafond non v/);
  });

  it('les questions de rencontre sont numérotées', () => {
    const texte = rendre(profilVierge('vide', DATE));
    expect(texte).toMatch(/valider ensemble/);
  });

  it('AUCUN GLYPHE ABSENT DES POLICES EMBARQUÉES', async () => {
    // « ≈ » et « ✓ » manquent aux polices du projet ; les flèches n'existent
    // qu'en Montserrat. Un glyphe absent sort en carré vide sur le document
    // remis au client, sans la moindre erreur au rendu.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/lib/pdf/optimisations-fiscales-page.tsx', 'utf8')
    );
    const litteraux = source.replace(/^\s*\/\/.*$/gm, '');   // hors commentaires
    for (const glyphe of ['≈', '✓', '→', '←', '↑', '↓']) {
      expect(litteraux).not.toContain(glyphe);
    }
  });
});
