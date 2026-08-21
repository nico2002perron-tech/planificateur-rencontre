// CE QUE LE PDF DIT DE LA CRISTALLISATION DE GAINS — et surtout ce qu'il tait.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE VERROU RECHERCHÉ N'EST PAS UNE LISTE DE PHRASES.
//
// Jusqu'ici, la protection des chiffres reposait sur cinq scénarios connus :
// on vérifiait qu'aucun montant n'apparaissait dans cinq explications
// particulières. C'est une garantie par énumération — elle tombe le jour où une
// sixième phrase est écrite.
//
// Ce fichier vise l'autre garantie, celle par CONSTRUCTION : on forge des
// constats impossibles (statut dégradé PORTANT un montant, prose truffée de
// dollars) et on exige que la page ne les rende pas. Un auteur de stratégie
// peut désormais se tromper sans que le client en paie le prix.
//
// Données entièrement fictives : comptes « FICT », symboles inventés.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import React from 'react';
import { OptimisationsFiscalesPage } from '../optimisations-fiscales-page';
import { analyser, type Constat, type ResultatAnalyse } from '@/lib/profils/strategies';
import { profilVierge, type ProfilClient, type Compte, type Position } from '@/lib/profils/types';
import {
  montantAffichable, proseSansMontantFerme, modeTableau, ENTETE,
  raisonsAConfirmer, estIdentifiantTechnique, mentionDate,
} from '../rendu-constat';

const DATE = '2026-08-21';

// ─────────────────────────────────────────────────────────────────────────────
// Lire le texte réellement posé sur la page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On parcourt l'arbre en invoquant les composants : ce sont exactement les
 * chaînes envoyées au moteur de rendu. (Le PDF compressé n'est pas lisible —
 * voir la note du fichier voisin.)
 */
function textesDe(noeud: unknown): string[] {
  if (noeud === null || noeud === undefined || noeud === false || noeud === true) return [];
  if (typeof noeud === 'string') return [noeud];
  if (typeof noeud === 'number') return [String(noeud)];
  if (Array.isArray(noeud)) return noeud.flatMap(textesDe);
  const el = noeud as { type?: unknown; props?: Record<string, unknown> };
  if (!el.props) return [];
  if (typeof el.type === 'function') return textesDe((el.type as (p: unknown) => unknown)(el.props));
  return textesDe(el.props.children);
}

/** Le texte de la page, espaces aplatis — insécables compris. */
function rendre(resultat: ResultatAnalyse): string {
  return textesDe(React.createElement(OptimisationsFiscalesPage, { resultat }))
    .join('')
    .replace(/[\s   ]+/g, ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Les fixtures
// ─────────────────────────────────────────────────────────────────────────────

function position(s: string, vm: number | null, pbr: number | null, devise = 'CAD'): Position {
  return { symbole: s, devise, categorie: null, valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null };
}

function compte(type: Compte['type'], positions: Position[], numero = 'FICT-1'): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre', type, titulaire: 'client',
    candidats: [numero], dateReleve: '2026-08-19', presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, encaisse: [], positions,
  };
}

function dossier(modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge('fictif01', DATE);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '0-50k';
  p.revenus.dateDonnee = DATE;
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.transactionsAnnee.portee = 'complete';
  p.transactionsAnnee.pertesRealisees = 10000;
  p.transactionsAnnee.pertesRealiseesNonEnregistrees = 10000;
  p.comptes = [compte('non-enregistre', [position('GAGNANT', 50000, 10000)])];
  modif(p);
  return p;
}

const analyse = (p: ProfilClient) => analyser(p, null, DATE);
const constatGains = (r: ResultatAnalyse) =>
  r.constats.find((c) => c.strategie === 'cristallisation-gains')!;

/** Le texte de la SEULE carte de cristallisation de gains. */
function carteGains(p: ProfilClient): string {
  const r = analyse(p);
  return rendre({ ...r, constats: [constatGains(r)] });
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF-A — LE CAS CALCULÉ
// ═══════════════════════════════════════════════════════════════════════════

describe('PDF-A · statut calculé', () => {
  it('montre le montant, le badge « Calculé », le plan et la date', () => {
    const p = dossier();
    const c = constatGains(analyse(p));
    expect(c.statut).toBe('calcule');

    const texte = carteGains(p);
    expect(texte).toMatch(/10 000 \$/);           // le montant, tel que le moteur l'a rendu
    expect(texte).toMatch(/Calculé/);
    expect(texte).toMatch(/GAGNANT/);             // le plan nomme le titre
    expect(texte).toMatch(/Vendre \(environ\)/);  // c'est bien un plan, pas des candidats
    expect(texte).toMatch(/Selon les valeurs au 19 août 2026/);
  });

  it('le montant vient de `montantEstime`, sans recalcul du PDF', () => {
    const c = constatGains(analyse(dossier()));
    expect(montantAffichable(c)).toBe(c.montantEstime);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PDF-B → PDF-F — LES STATUTS DÉGRADÉS
// ═══════════════════════════════════════════════════════════════════════════

const DEGRADES: Array<[string, (p: ProfilClient) => void, RegExp]> = [
  ['PDF-B · unité des valeurs non établie',
      // ⚠ REPOINTÉ LE 21 AOÛT 2026 : ce n'est pas la DEVISE du titre qui
      // bloque — le format rend ses valeurs en CAD même sur les lignes USD —,
      // mais l'UNITÉ des valeurs quand elle n'est pas établie.
    (p) => { p.comptes = [compte('non-enregistre', [
      { ...position('MYSTERE', 15000, 10000), uniteValeursRapport: 'inconnue' }])]; },
    /dollars canadiens/],
  ['PDF-C · pertes reportées incompatibles',
    (p) => { p.droits.pertesCapitalReportees = {
      montant: 5000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE }; },
    /BRUT|brut/],
  ['PDF-D · PBR absent',
    (p) => { p.comptes = [compte('non-enregistre', [
      position('BONNE', 50000, 10000), position('AVEUGLE', 40000, null)])]; },
    /prix de base rajusté/],
  ['PDF-E · valeur marchande absente',
    (p) => { p.comptes = [compte('non-enregistre', [
      position('BONNE', 50000, 10000), position('SANSVM', null, 10000)])]; },
    /valeur marchande/],
  ['PDF-F · portée externe',
    (p) => { p.consolidation.comptesExternes = 'oui'; },
    /ailleurs/],
];

for (const [nom, modif, raisonAttendue] of DEGRADES) {
  describe(nom, () => {
    it('n’affiche AUCUN résultat fiscal ferme, et dit pourquoi', () => {
      const p = dossier(modif);
      const c = constatGains(analyse(p));
      expect(c.statut, nom).not.toBe('calcule');
      expect(montantAffichable(c), nom).toBeNull();

      const texte = carteGains(p);
      expect(texte).toMatch(/Montant à confirmer|Analyse indisponible/);
      expect(texte).toMatch(/À confirmer avant d’agir|Données manquantes/);
      expect(texte, nom).toMatch(raisonAttendue);
      // AUCUN ORDRE DE VENTE : la colonne d'exécution n'existe pas ici.
      expect(texte, nom).not.toMatch(/Vendre \(environ\)/);
    });
  });
}

describe('PDF-F bis · la portée limite explicitement la conclusion', () => {
  it('dit sur quoi l’analyse s’appuie, pour qu’elle ne se lise pas comme exhaustive', () => {
    const texte = carteGains(dossier((p) => { p.consolidation.comptesExternes = 'oui'; }));
    expect(texte).toMatch(/Analyse fondée sur les comptes et positions disponibles/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PDF-G / PDF-H — INDISPONIBLE ET NON APPLICABLE NE SE CONFONDENT PAS
// ═══════════════════════════════════════════════════════════════════════════

describe('PDF-G · indisponible', () => {
  it('n’affiche ni grand montant ni table d’exécution', () => {
    const p = dossier((x) => {
      x.comptes = [compte('non-enregistre', [position('AVEUGLE', 50000, null)])];
    });
    const c = constatGains(analyse(p));
    expect(c.statut).toBe('indisponible');

    const texte = carteGains(p);
    expect(texte).toMatch(/Analyse indisponible avec les données actuelles/);
    expect(texte).toMatch(/Données insuffisantes/);         // le badge
    expect(texte).not.toMatch(/Vendre \(environ\)/);
    expect(texte).not.toMatch(/50 000 \$/);                  // aucun faux gain de VM − 0
  });
});

describe('PDF-H · non applicable', () => {
  it('un « rien à faire » CONFIRMÉ va dans « Déjà en ordre », sans aveu d’impuissance', () => {
    // Le moteur marque `dejaEnOrdre` quand non-applicable veut dire « c'est
    // correct comme ça ». La page le range alors dans sa section affirmative
    // plutôt que d'en faire une carte — c'est le comportement voulu.
    const p = dossier((x) => {
      x.transactionsAnnee.pertesRealisees = 0;
      x.transactionsAnnee.pertesRealiseesNonEnregistrees = 0;
      x.droits.pertesCapitalReportees = {
        montant: 0, unite: 'inconnue', source: 'avis-cotisation', dateDonnee: DATE };
    });
    const c = constatGains(analyse(p));
    expect(c.statut).toBe('non-applicable');
    expect(c.dejaEnOrdre).toBe(true);

    const texte = carteGains(p);
    expect(texte).not.toMatch(/Analyse indisponible/);
    expect(texte).not.toMatch(/Données insuffisantes/);
    expect(texte).not.toMatch(/Vendre \(environ\)/);
  });

  it('un non-applicable SANS « déjà en ordre » affirme, et ne s’avoue pas impuissant', () => {
    // L'autre moitié du statut : « il n'y a rien » n'est pas « je n'ai pas pu
    // regarder ». La carte doit dire le premier, jamais le second.
    const r = analyse(dossier());
    const forge: Constat = {
      ...constatGains(r), statut: 'non-applicable', montantEstime: null,
      dejaEnOrdre: false, plan: undefined, candidats: [],
    };
    const texte = rendre({ ...r, constats: [forge] });
    expect(texte).toMatch(/Aucune occasion détectée avec les données analysées/);
    expect(texte).toMatch(/Non applicable/);
    expect(texte).not.toMatch(/Analyse indisponible/);
    expect(texte).not.toMatch(/Données insuffisantes/);
  });

  it('les quatre statuts ont quatre annonces et quatre badges DISTINCTS', () => {
    const badges = Object.values(ENTETE).map((e) => e.badge);
    const annonces = Object.values(ENTETE).map((e) => e.annonce);
    expect(new Set(badges).size).toBe(4);
    expect(new Set(annonces).size).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PDF-I — UNE POSITION MENTIONNÉE N'EST PAS UN ORDRE DE VENTE
// ═══════════════════════════════════════════════════════════════════════════

describe('PDF-I · candidats sous statut dégradé', () => {
  it('sont présentés comme des mesures du relevé, jamais comme une instruction', () => {
    const p = dossier((x) => { x.consolidation.comptesExternes = 'oui'; });
    const c = constatGains(analyse(p));
    expect(modeTableau(c)).toBe('candidats');

    const texte = carteGains(p);
    expect(texte).toMatch(/GAGNANT/);                        // la position est nommée
    expect(texte).toMatch(/Valeur au relevé/);
    expect(texte).toMatch(/Gain latent observé/);
    expect(texte).toMatch(/pas un ordre de vente ni un montant fiscal/);
    expect(texte).not.toMatch(/Vendre \(environ\)/);
    expect(texte).not.toMatch(/Gain cristallisé/);
  });

  it('une position AVEUGLE ne réapparaît jamais dans le tableau', () => {
    // Le PDF ne reparcourt pas les positions brutes : il ne rend que ce que le
    // moteur lui a donné, et le moteur a déjà écarté celle-ci.
    const p = dossier((x) => {
      x.consolidation.comptesExternes = 'oui';
      x.comptes = [compte('non-enregistre', [
        position('BONNE', 50000, 10000),
        { ...position('MYSTERE', 90000, 1000), uniteValeursRapport: 'inconnue' as const },
        position('AVEUGLE', 80000, null),
      ])];
    });
    const texte = carteGains(p);
    expect(texte).toMatch(/BONNE/);
    expect(texte).not.toMatch(/MYSTERE/);
    expect(texte).not.toMatch(/AVEUGLE/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PDF-J — UNE AMBIGUÏTÉ ÉTRANGÈRE NE CONTAMINE PAS CETTE CARTE
// ═══════════════════════════════════════════════════════════════════════════

describe('PDF-J · ambiguïté CELI indépendante', () => {
  it('n’apparaît pas dans la carte de cristallisation de gains', () => {
    const p = dossier((x) => {
      x.comptes = [...x.comptes, compte('celi', [position('ABRITE', 90000, null)], 'FICT-W')];
      x.historiqueVie.celi = { ...x.historiqueVie.celi, portee: 'inconnue' };
      x.cotisationsAnnee.celi = 7000;
      x.cotisationsAnnee.portee = 'inconnue';
    });
    // ⚠ ON REGARDE LA CARTE, PAS TOUTE LA PAGE. Le reste du document parle
    // légitimement du CELI (angle mort, questions de rencontre) : c'est le
    // CONSTAT de cristallisation de gains qui ne doit pas s'en trouver changé.
    const c = constatGains(analyse(p));
    const reference = constatGains(analyse(dossier()));
    expect(c.statut).toBe('calcule');
    expect(c.statut).toBe(reference.statut);
    expect(c.montantEstime).toBe(reference.montantEstime);
    expect(c.donneesManquantes).toEqual(reference.donneesManquantes);

    const texte = carteGains(p);
    expect(texte).toMatch(/Calculé/);
    expect(texte).not.toMatch(/ABRITE/);
    expect(raisonsAConfirmer(c)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LE VERROU STRUCTUREL — des constats FORGÉS, impossibles à produire
// ═══════════════════════════════════════════════════════════════════════════

describe('verrou structurel · un montant ne franchit pas un statut dégradé', () => {
  const FORGE = 987654;

  function pageAvec(statut: Constat['statut'], extra: Partial<Constat> = {}): string {
    const r = analyse(dossier());
    const vrai = constatGains(r);
    const forge: Constat = {
      ...vrai,
      statut,
      montantEstime: FORGE,
      // Une prose qui essaie de faire passer le chiffre par la porte de service.
      explication:
        `Jusqu’à ${FORGE.toLocaleString('fr-CA')} $ pourraient être cristallisés, `
        + 'et une économie de 123 456 $ en découlerait.',
      ...extra,
    };
    return rendre({ ...r, constats: [forge] });
  }

  for (const statut of ['montant-a-confirmer', 'indisponible', 'non-applicable'] as const) {
    it(`${statut} : ni 987 654 $ ni 123 456 $ n’atteignent le client`, () => {
      const texte = pageAvec(statut);
      expect(texte, statut).not.toMatch(/987 ?654/);
      expect(texte, statut).not.toMatch(/123 ?456/);
      // Et la phrase reste lisible plutôt que trouée.
      expect(texte, statut).toMatch(/un montant à confirmer/);
    });
  }

  it('sous `calcule`, la prose garde évidemment ses chiffres', () => {
    // Sans ce pendant, un filtre qui effacerait TOUS les montants passerait.
    expect(carteGains(dossier())).toMatch(/10 000 \$/);
  });

  it('le filtre vise les DOLLARS, pas les dénombrements', () => {
    const texte = proseSansMontantFerme(
      '2 positions non enregistrées portent un gain latent de 32 000 $.', 'montant-a-confirmer');
    expect(texte).toMatch(/^2 positions/);              // le dénombrement survit
    expect(texte).not.toMatch(/32 000/);
    expect(texte).toMatch(/un montant à confirmer/);
  });

  it('un plan FORGÉ sur un statut dégradé n’est jamais rendu comme marche à suivre', () => {
    const r = analyse(dossier());
    const vrai = constatGains(r);
    const forge: Constat = {
      ...vrai,
      statut: 'montant-a-confirmer',
      montantEstime: null,
      plan: [{ symbole: 'FANTOME', vendre: 40000, gain: 30000, partiel: false }],
      candidats: [],
    };
    const texte = rendre({ ...r, constats: [forge] });
    expect(modeTableau(forge)).toBeNull();
    expect(texte).not.toMatch(/FANTOME/);
    expect(texte).not.toMatch(/Vendre \(environ\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUCUN VOCABULAIRE DE PROGRAMMEUR NE SORT
// ═══════════════════════════════════════════════════════════════════════════

describe('les raisons sont traduites, jamais brutes', () => {
  it('un identifiant technique forgé ne franchit pas la page', () => {
    const r = analyse(dossier((p) => { p.consolidation.comptesExternes = 'oui'; }));
    const vrai = constatGains(r);
    const forge: Constat = {
      ...vrai,
      donneesManquantes: ['bien-identique-multi-comptes-a-confirmer', 'devise-etrangere-non-convertie'],
    };
    const texte = rendre({ ...r, constats: [forge] });

    expect(texte).not.toMatch(/bien-identique-multi-comptes/);
    expect(texte).not.toMatch(/devise-etrangere-non-convertie/);
    expect(texte).toMatch(/prix de base d’un titre détenu dans plusieurs comptes/);
    expect(texte).toMatch(/dollars canadiens/);
  });

  it('un slug INCONNU devient une phrase, pas du kebab-case', () => {
    expect(estIdentifiantTechnique('quelque-chose-de-neuf')).toBe(true);
    expect(estIdentifiantTechnique('la valeur marchande')).toBe(false);
    const r = analyse(dossier((p) => { p.consolidation.comptesExternes = 'oui'; }));
    const forge: Constat = { ...constatGains(r), donneesManquantes: ['garde-invente-demain'] };
    const texte = rendre({ ...r, constats: [forge] });
    expect(texte).not.toMatch(/garde-invente-demain/);
    expect(texte).toMatch(/une donnée du dossier reste à confirmer/);
  });

  it('aucune carte réelle ne laisse passer de kebab-case', () => {
    for (const [, modif] of DEGRADES) {
      for (const r of raisonsAConfirmer(constatGains(analyse(dossier(modif))))) {
        expect(estIdentifiantTechnique(r), r).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA DATE — sans seuil de fraîcheur inventé
// ═══════════════════════════════════════════════════════════════════════════

describe('la date des valeurs', () => {
  it('se dit en toutes lettres, sans jamais prétendre « aujourd’hui »', () => {
    expect(mentionDate('2026-08-19')).toBe('Selon les valeurs au 19 août 2026.');
    expect(mentionDate(null)).toBeNull();
    expect(mentionDate('pas une date')).toBeNull();
  });

  it('une date ANCIENNE se dit pareil — le PDF n’invente aucun seuil', () => {
    expect(mentionDate('2019-01-31')).toBe('Selon les valeurs au 31 janvier 2019.');
    expect(rendre({
      ...analyse(dossier()),
      constats: [{ ...constatGains(analyse(dossier())), dateDonnees: '2019-01-31' }],
    })).not.toMatch(/périmé|trop ancien|obsolète/i);
  });
});
