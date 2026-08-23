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
import { textesDe } from './_texte-rendu';

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

// ⚠ QUANTITÉ ET TYPE : le plan canonique exige des quantités EXÉCUTABLES.
function position(
  symbole: string, vm: number | null, pbr: number | null,
  quantite: number | undefined = 100, typeInstrument: string | undefined = 'Action'
): Position {
  return {
    symbole, devise: 'CAD', categorie: null, uniteValeursRapport: 'CAD',
    quantite, typeInstrument,
    valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
  };
}
function compte(type: Compte['type'], positions: Position[]): Compte {
  return {
    numero: '37-FICT-A', suffixe: 'A', provenanceNumero: 'livre', presence: 'au-releve', derniereActivite: null, dernierSolde: null, candidats: ['37-FICT-A'],
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

/** Un dossier fictif qui produit un PLAN DE RÉCOLTE — la table aux logos. */
function profilAvecPlan(): ProfilClient {
  return profilConsolide((p) => {
    p.transactionsAnnee.pertesRealisees = 20000;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 20000;
    p.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 20000)])];
  });
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
// `textesDe` vit dans le harnais partagé — il existait en cinq copies.

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

/** La page telle que le document AUTONOME la rend — mention interne comprise. */
function rendreAutonome(profil: ProfilClient, date = DATE): string {
  const resultat = analyser(profil, null, date);
  return textesDe(React.createElement(OptimisationsFiscalesPage, { resultat, piedInterne: true }))
    .join('')
    .replace(/[\s   ]+/g, ' ');
}

describe('LE PIED DE PAGE dit ce que le document EST — défaut du 17 août 2026', () => {
  // La mention obligatoire et le pied commun étaient ancrés au MÊME bottom:18 :
  // le pied gris, peint après, recouvrait la mention rouge. Et ce pied portait
  // en dur « Analyse des cours cibles 1.2 », imprimé au bas du document
  // autonome d'optimisations fiscales. Vérifié au rendu rastérisé le 17 août.
  it('le document autonome ne se présente PAS comme l’analyse des cours cibles', () => {
    const texte = rendreAutonome(profilConsolide());
    expect(texte).not.toMatch(/cours cibles/i);
    expect(texte).toMatch(/Optimisations fiscales \(document de travail\)/);
  });

  it('la mention « usage interne » est bien rendue en pied du document autonome', () => {
    expect(rendreAutonome(profilConsolide())).toMatch(/usage interne\. Ne pas remettre au client/);
  });

  it('intégrée aux cours cibles, la page garde le pied du document hôte', () => {
    // Sans `piedInterne`, la page vit DANS le rapport de cours cibles : c'est
    // ce document-là que le pied doit nommer.
    expect(rendre(profilConsolide())).toMatch(/Analyse des cours cibles/);
  });

  it('AUCUN glyphe absent des polices embarquées dans ce qui atteint le client', () => {
    // U+26A0 s'imprimait en carré vide. Même famille que « ≈ » et « ✓ ».
    const profil = profilConsolide();
    for (const texte of [rendre(profil), rendreAutonome(profil), rendre(profilVierge('vide', DATE))]) {
      expect(texte).not.toMatch(/[⚠✓≈→←]/);
    }
  });
});

// ⚠ CES TROIS TESTS RENDENT UN VRAI PDF — polices embarquées comprises. Ils
// prennent une à deux secondes chacun à froid, et le premier dépassait le
// délai par défaut de 5 s environ une exécution sur trois quand la suite tourne
// en parallèle (mesuré le 21 août 2026, après l'ajout des tests de migration).
// Un échec intermittent est pire qu'un test lent : il apprend à ignorer le
// rouge. Le délai est donc explicite, et généreux.
const DELAI_RENDU_PDF = 30_000;

describe('la page se rend', () => {
  it('produit un PDF valide même sur un profil entièrement vide', async () => {
    const resultat = analyser(profilVierge('vide', DATE), null, DATE);
    const buffer = await renderToBuffer(
      React.createElement(Document, null, React.createElement(OptimisationsFiscalesPage, { resultat }))
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  }, DELAI_RENDU_PDF);

  // LES LOGOS DU PLAN DE RÉCOLTE (17 août 2026). Ils viennent du cache local ;
  // un logo corrompu ne doit jamais faire échouer la GÉNÉRATION du document —
  // c'est le livrable, et une image manquante n'est pas une raison de le perdre.
  it('rend le plan AVEC les logos fournis', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const resultat = analyser(profilAvecPlan(), null, DATE);
    const plan = resultat.constats.find((c) => c.plan && c.plan.length > 0);
    expect(plan).toBeDefined();

    const buffer = await renderToBuffer(
      React.createElement(Document, null,
        React.createElement(OptimisationsFiscalesPage, {
          resultat, logos: { [plan!.plan![0].symbole]: PNG },
        }))
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  }, DELAI_RENDU_PDF);

  it('SANS logo, le plan se rend quand même — le symbole se suffit', async () => {
    const resultat = analyser(profilAvecPlan(), null, DATE);
    const buffer = await renderToBuffer(
      React.createElement(Document, null,
        React.createElement(OptimisationsFiscalesPage, { resultat, logos: {} }))
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    // Le symbole reste imprimé, avec ou sans image.
    expect(textesDe(React.createElement(OptimisationsFiscalesPage, { resultat })).join('')).toContain('GAGNANT');
  }, DELAI_RENDU_PDF);
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
      x.transactionsAnnee.gainsRealisesNonEnregistres = 12000;
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
      x.transactionsAnnee.gainsRealisesNonEnregistres = 12000;
      x.demographie.conjoint.trancheRevenu = '0-50k';
      x.droits.celiConjointInutilises = { montant: 48000, dateDonnee: DATE };
      x.comptes = [compte('non-enregistre', [position('AAA', 8000, 20000)])];
    }));
    expect(texte).toMatch(/2 pistes chiffrées sur 8/);
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
      x.transactionsAnnee.gainsRealisesNonEnregistres = 12000;
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
