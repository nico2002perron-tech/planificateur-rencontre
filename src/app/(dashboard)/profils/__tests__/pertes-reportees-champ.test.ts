// L'ÉCRAN DES PERTES REPORTÉES — ce qu'il affiche, et ce qu'il envoie.
//
// La suite tourne sans DOM (voir `vitest.config.ts`) : ces tests portent donc
// sur le module PUR que le composant habille, plus le trajet réel
// écran → API → disque → relecture. C'est ce trajet-là qui compte : un champ
// qui affiche bien mais enregistre mal serait le pire des deux mondes.
//
// LE FIL CONDUCTEUR — l'écran ne doit JAMAIS enrichir la donnée. Il capture ce
// que le conseiller sait, y compris « je ne sais pas », et rien de plus.
//
// Données entièrement fictives : pseudonymes de test, comptes « FICT ».
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  OPTIONS_UNITE, OPTIONS_SOURCE,
  lireDepuisFiche, analyserMontantSaisi, analyserDateSaisie,
  fusionner, corpsPourApi, etatLisible, libelleUnite,
} from '../pertes-reportees-champ';
import { profilVierge, type ProfilClient, type PertesCapitalReportees } from '@/lib/profils/types';
import { analyser } from '@/lib/profils/strategies';

const DATE = '2026-08-21';
const ID = 'ecranpertes1';

const aNettoyer: string[] = [];
const RACINE_ORIGINALE = process.env.BASE_LOCALE_RACINE;

async function racineJetable(): Promise<string> {
  const racine = await fs.mkdtemp(path.join(os.tmpdir(), 'ecran-pertes-'));
  aNettoyer.push(racine);
  process.env.BASE_LOCALE_RACINE = racine;
  return racine;
}

afterEach(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  for (const r of aNettoyer.splice(0)) await fs.rm(r, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// A — L'ANCIEN PROFIL S'OUVRE SANS ÊTRE RÉÉCRIT
// ═══════════════════════════════════════════════════════════════════════════

describe('A · un ancien profil ouvert dans l’écran', () => {
  it('affiche le montant, et l’unité « à confirmer » — jamais une unité choisie pour lui', () => {
    // La forme telle qu'elle arrive du stockage après normalisation.
    const affiche = lireDepuisFiche({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2026-07-01',
    });

    expect(affiche.montant).toBe(10000);         // le montant N'EST PAS vidé
    expect(affiche.unite).toBe('inconnue');
    expect(affiche.source).toBe('inconnue');
    expect(affiche.dateDonnee).toBe('2026-07-01');
    expect(libelleUnite('inconnue')).toMatch(/à confirmer/);
    expect(etatLisible(affiche).chiffrable).toBe(false);
  });

  it('tient même devant la forme la plus ancienne — un nombre nu', () => {
    expect(lireDepuisFiche(10000)).toEqual({
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    });
  });

  it('ne présélectionne AUCUNE unité, et surtout pas la brute', () => {
    // Le piège serait de retenir la première option de la liste. On vérifie donc
    // que « brute » n'est jamais l'état d'un dossier qui ne l'a pas déclarée.
    for (const brut of [10000, { montant: 10000, dateDonnee: DATE }, {}, null, undefined]) {
      expect(lireDepuisFiche(brut).unite).not.toBe('perte-capital-brute');
      expect(lireDepuisFiche(brut).unite).toBe('inconnue');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B / C / J — CHAQUE DIMENSION EST UNE RÉPONSE DISTINCTE
// ═══════════════════════════════════════════════════════════════════════════

describe('B, C, J · aucune contagion entre les dimensions', () => {
  const depart: PertesCapitalReportees = {
    montant: 10000, unite: 'perte-capital-brute', source: 'saisie-manuelle', dateDonnee: '2026-03-11',
  };

  it('B · changer la SOURCE laisse l’unité intacte', () => {
    const apres = fusionner(depart, { source: 'autre' });
    expect(apres.source).toBe('autre');
    expect(apres.unite).toBe('perte-capital-brute');
    expect(apres.montant).toBe(10000);
    expect(apres.dateDonnee).toBe('2026-03-11');
  });

  it('C · changer l’UNITÉ laisse la source intacte', () => {
    const apres = fusionner(depart, { unite: 'perte-nette-capital-fiscale' });
    expect(apres.unite).toBe('perte-nette-capital-fiscale');
    expect(apres.source).toBe('saisie-manuelle');
  });

  it('J · choisir « avis de cotisation » n’impose AUCUNE unité', () => {
    // C'est l'inférence la plus tentante du lot : un avis de cotisation rapporte
    // presque toujours une perte NETTE. « Presque toujours » n'est pas une
    // preuve, et le conseiller a le document sous les yeux — pas nous.
    const vierge: PertesCapitalReportees = {
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    };
    const apres = fusionner(vierge, { source: 'avis-cotisation' });
    expect(apres.source).toBe('avis-cotisation');
    expect(apres.unite).toBe('inconnue');

    // Et l'inverse tient aussi : déclarer une perte nette n'affirme pas d'où
    // elle vient.
    expect(fusionner(vierge, { unite: 'perte-nette-capital-fiscale' }).source).toBe('inconnue');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// D — LA DATE EXISTANTE SURVIT
// ═══════════════════════════════════════════════════════════════════════════

describe('D · la date du document', () => {
  it('survit à une modification de l’unité ou de la source', () => {
    const depart: PertesCapitalReportees = {
      montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: '2024-11-02',
    };
    expect(fusionner(depart, { unite: 'perte-capital-brute' }).dateDonnee).toBe('2024-11-02');
    expect(fusionner(depart, { source: 'avis-cotisation' }).dateDonnee).toBe('2024-11-02');
  });

  it('se saisit, et se refuse quand elle n’est pas lisible', () => {
    expect(analyserDateSaisie('2024-11-02')).toEqual({ ok: true, date: '2024-11-02' });
    expect(analyserDateSaisie('')).toEqual({ ok: true, date: null });
    expect(analyserDateSaisie('02/11/2024').ok).toBe(false);
    expect(analyserDateSaisie('2024-02-31').ok).toBe(false);   // n'existe pas
  });

  it('AUCUNE règle de péremption n’est appliquée par l’écran', () => {
    // Une date de 2009 est vieille, pas invalide. C'est à la stratégie de dire
    // si l'âge de la donnée change quelque chose à SON chiffre.
    expect(analyserDateSaisie('2009-01-01')).toEqual({ ok: true, date: '2009-01-01' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E / F — VIDE ≠ ZÉRO
// ═══════════════════════════════════════════════════════════════════════════

describe('E, F · le vide et le zéro sont deux réponses différentes', () => {
  it('E · un champ vidé donne null, jamais 0', () => {
    expect(analyserMontantSaisi('')).toEqual({ ok: true, montant: null });
    expect(analyserMontantSaisi('   ')).toEqual({ ok: true, montant: null });
  });

  it('F · un zéro TAPÉ reste un zéro — c’est une réponse, pas une absence', () => {
    expect(analyserMontantSaisi('0')).toEqual({ ok: true, montant: 0 });
    expect(etatLisible({ montant: 0, unite: 'inconnue', source: 'inconnue', dateDonnee: null }).chiffrable)
      .toBe(true);   // « aucune perte reportée » est une donnée exploitable
  });

  it('effacer le montant remet la qualification à zéro — elle décrivait un document absent', () => {
    const qualifie: PertesCapitalReportees = {
      montant: 10000, unite: 'perte-capital-brute', source: 'avis-cotisation', dateDonnee: DATE,
    };
    expect(fusionner(qualifie, { montant: null })).toEqual({
      montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    });
  });

  it('lit les montants écrits à la française sans les déformer', () => {
    expect(analyserMontantSaisi('10 000,50')).toEqual({ ok: true, montant: 10000.5 });
    expect(analyserMontantSaisi('1 234,56 $')).toEqual({ ok: true, montant: 1234.56 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §10 — LES SAISIES INVALIDES SONT REFUSÉES, ET DITES
// ═══════════════════════════════════════════════════════════════════════════

describe('§10 · une saisie invalide ne devient jamais un nombre plausible', () => {
  it('refuse le texte, NaN et l’infini — avec un motif', () => {
    for (const mauvais of ['abc', '12abc', 'NaN', 'Infinity', '-Infinity', '1e999x', '--5']) {
      const lu = analyserMontantSaisi(mauvais);
      expect(lu.ok, `« ${mauvais} » aurait dû être refusé`).toBe(false);
      if (!lu.ok) expect(lu.motif.length).toBeGreaterThan(0);
    }
  });

  it('refuse un montant NÉGATIF — il retrancherait de la capacité d’absorption', () => {
    const lu = analyserMontantSaisi('-5000');
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.motif).toMatch(/négatif|ampleur/);
  });

  it('ne replie JAMAIS une saisie invalide sur 0', () => {
    for (const mauvais of ['abc', '-5000', 'Infinity']) {
      const lu = analyserMontantSaisi(mauvais);
      expect(lu.ok).toBe(false);
      // Le type l'interdit déjà ; on le dit quand même, parce que c'est
      // exactement la régression qu'on redoute.
      expect(JSON.stringify(lu)).not.toMatch(/"montant":0/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// G / H / I / K — CE QUE L'ÉCRAN PRODUIT
// ═══════════════════════════════════════════════════════════════════════════

describe('G, H, I, K · le modèle produit par l’écran', () => {
  const base: PertesCapitalReportees = {
    montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: DATE,
  };

  it('G · « perte en capital brute » est enregistrée telle quelle', () => {
    expect(corpsPourApi(fusionner(base, { unite: 'perte-capital-brute' })).unite)
      .toBe('perte-capital-brute');
  });

  it('H · « perte nette en capital fiscale » aussi', () => {
    expect(corpsPourApi(fusionner(base, { unite: 'perte-nette-capital-fiscale' })).unite)
      .toBe('perte-nette-capital-fiscale');
  });

  it('I · « je ne sais pas » ne rend AUCUN chiffre ferme possible', () => {
    const s = fusionner(base, { unite: 'inconnue' });
    expect(etatLisible(s).chiffrable).toBe(false);
    expect(etatLisible(s).phrase).toMatch(/à confirmer/);
  });

  it('H bis · une perte NETTE est annoncée NON chiffrable, et dit pourquoi', () => {
    // ⚠ VERROU AJOUTÉ APRÈS LA REVUE DU 21 AOÛT. Le test H ne regardait que la
    // valeur enregistrée : neutraliser la branche « nette » d'`etatLisible`
    // faisait dire à l'écran « ce montant peut entrer dans le calcul » pour un
    // montant que le moteur bloque — et aucun test ne tombait. L'écran doit
    // dire la même chose que le moteur, sinon il ment.
    const nette = etatLisible({
      montant: 10000, unite: 'perte-nette-capital-fiscale',
      source: 'avis-cotisation', dateDonnee: DATE,
    });
    expect(nette.chiffrable).toBe(false);
    expect(nette.phrase).toMatch(/NET/);
    // La brute, elle, est bien annoncée chiffrable — sinon le test ci-dessus
    // passerait avec un `chiffrable` toujours faux.
    expect(etatLisible({
      montant: 10000, unite: 'perte-capital-brute', source: 'autre', dateDonnee: DATE,
    }).chiffrable).toBe(true);
  });

  it('K · un nouveau profil part avec unité et source inconnues', () => {
    const neuf = profilVierge('neuf1234', DATE).droits.pertesCapitalReportees;
    expect(neuf).toEqual({ montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null });
    // Et l'écran l'affiche tel quel, sans rien présélectionner.
    expect(lireDepuisFiche(neuf)).toEqual(neuf);
  });

  it('§13 · l’écran envoie TOUJOURS la forme complète, jamais un nombre nu', () => {
    const corps = corpsPourApi(fusionner(base, { unite: 'perte-capital-brute' }));
    expect(typeof corps).toBe('object');
    expect(Object.keys(corps).sort()).toEqual(['dateDonnee', 'montant', 'source', 'unite']);
  });

  it('§12 · « déjà normalisé » est une option AVANCÉE, et la seule', () => {
    const avancees = OPTIONS_UNITE.filter((o) => o.avancee).map((o) => o.valeur);
    expect(avancees).toEqual(['montant-normalise-utilisable']);
    // Et « je ne sais pas » est le premier choix offert : le plus honnête doit
    // être le plus facile, sinon on qualifie au hasard pour faire taire l'écran.
    expect(OPTIONS_UNITE[0].valeur).toBe('inconnue');
    expect(OPTIONS_SOURCE[0].valeur).toBe('inconnue');
  });

  it('§4 · aucune valeur technique n’est montrée au conseiller', () => {
    for (const o of [...OPTIONS_UNITE, ...OPTIONS_SOURCE]) {
      expect(o.libelle).not.toMatch(/-/);       // pas de kebab-case à l'écran
      expect(o.libelle[0]).toBe(o.libelle[0].toUpperCase());
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L — L'ALLER-RETOUR COMPLET : écran → API → disque → relecture → écran
// ═══════════════════════════════════════════════════════════════════════════

describe('L · le trajet réel', () => {
  it('rend les quatre champs identiques de bout en bout', async () => {
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil, ecrireProfil } = await import('@/lib/profils/stockage');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    const saisi = corpsPourApi(fusionner(
      { montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null },
      { montant: 8400.25, unite: 'perte-capital-brute', source: 'avis-recotisation', dateDonnee: '2025-04-30' }
    ));

    const reponse = await POST(requete({ id: ID, pertesCapitalReportees: saisi }));
    expect(reponse.status).toBe(200);

    // ⚠ COMPARÉ À UN LITTÉRAL, PAS À `saisi`. La première version faisait
    // `toEqual(saisi)` : `saisi` étant produit par le code sous test, une
    // fonction qui aurait perdu la source en route donnait la même valeur des
    // deux côtés et le test restait vert. On écrit donc à la main ce que le
    // conseiller a répondu.
    const attendu = {
      montant: 8400.25, unite: 'perte-capital-brute',
      source: 'avis-recotisation', dateDonnee: '2025-04-30',
    };
    expect(saisi).toEqual(attendu);                      // l'écran n'a rien perdu
    const relu = (await lireProfil(ID))!.droits.pertesCapitalReportees;
    expect(relu).toEqual(attendu);                       // le disque non plus
    expect(lireDepuisFiche(relu)).toEqual(attendu);      // ni la relecture
  });

  it('§14 · ouvrir un ancien dossier et enregistrer SANS RIEN CHANGER ne l’enrichit pas', async () => {
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil } = await import('@/lib/profils/stockage');

    // Un dossier ancien, écrit à la main dans la forme d'avant.
    const racine = aNettoyer[aNettoyer.length - 1];
    const chemin = path.join(racine, 'profils', `${ID}.json`);
    await fs.mkdir(path.dirname(chemin), { recursive: true });
    await fs.writeFile(chemin, JSON.stringify({
      id: ID, version: 2, dateMiseAJour: '2026-02-10',
      droits: { pertesCapitalReportees: { montant: 10000, dateDonnee: '2024-11-02' } },
    }, null, 2), 'utf8');

    // Le conseiller ouvre l'écran…
    const affiche = lireDepuisFiche((await lireProfil(ID))!.droits.pertesCapitalReportees);
    expect(affiche.montant).toBe(10000);
    expect(affiche.unite).toBe('inconnue');

    // …ne touche à rien, et l'écran renvoie ce qu'il affichait.
    await POST(requete({ id: ID, pertesCapitalReportees: corpsPourApi(affiche) }));

    const relu = (await lireProfil(ID))!.droits.pertesCapitalReportees;
    expect(relu.montant).toBe(10000);            // le montant SURVIT
    expect(relu.unite).toBe('inconnue');         // l'unité N'EST PAS inventée
    expect(relu.source).toBe('inconnue');
    // ⚠ LA DATE DU DOCUMENT NE RAJEUNIT PAS. Elle était posée au jour de la
    // saisie : rouvrir un vieux dossier lui donnait deux ans de moins.
    expect(relu.dateDonnee).toBe('2024-11-02');
  });

  it('la PREMIÈRE saisie, sans date de document, est quand même datée du jour', async () => {
    // ⚠ TROUVÉ PAR LA REVUE ADVERSARIALE DU 21 AOÛT. L'écran envoie
    // `dateDonnee: null` tant que le conseiller n'a pas ouvert le champ de
    // date. L'API honorait ce null — et `badges.ts` calcule la péremption à
    // douze mois À PARTIR DE CETTE DATE : une date nulle rendait le montant
    // éternellement frais, donc plus jamais redemandé, en silence.
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil, ecrireProfil } = await import('@/lib/profils/stockage');
    const { badgesProfil } = await import('@/lib/profils/badges');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    // Exactement ce que le champ produit au premier onBlur du montant.
    const premiere = corpsPourApi(fusionner(
      { montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null },
      { montant: 10000 }
    ));
    expect(premiere.dateDonnee).toBeNull();          // l'écran, lui, ne l'invente pas

    await POST(requete({ id: ID, pertesCapitalReportees: premiere }));
    const profil = (await lireProfil(ID))!;
    expect(profil.droits.pertesCapitalReportees.dateDonnee).not.toBeNull();

    // Et le badge redemande bien la donnée une fois périmée.
    const badge = badgesProfil(profil, '2030-01-01')
      .find((b) => b.champ === 'droits.pertesCapitalReportees');
    expect(badge?.aReconfirmer).toBe(true);
  });

  it('l’API refuse une date impossible — comme l’écran, et pour le même motif', async () => {
    // Le regex de forme laissait passer « 2024-02-31 » : l'écran la refusait,
    // l'API l'acceptait. Deux portes qui ne disent pas la même chose finissent
    // par diverger sur un cas réel.
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil, ecrireProfil } = await import('@/lib/profils/stockage');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    const r = await POST(requete({
      id: ID,
      pertesCapitalReportees: {
        montant: 10000, unite: 'perte-capital-brute', source: 'autre', dateDonnee: '2024-02-31',
      },
    }));
    expect(r.status).toBe(400);
    expect((await lireProfil(ID))!.droits.pertesCapitalReportees.montant).toBeNull();
    // L'écran refuse la même date, avec son propre message.
    expect(analyserDateSaisie('2024-02-31').ok).toBe(false);
  });

  it('§8 · effacer le montant efface AUSSI la qualification, jusque sur le disque', async () => {
    // La règle était verrouillée dans le module pur seulement : côté API, la
    // remplacer par un simple `montant: null` laissait « perte brute · avis de
    // cotisation · 2026-03-11 » accroché à un montant absent — et la saisie
    // suivante héritait d'une qualification qu'elle n'avait pas demandée.
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil, ecrireProfil } = await import('@/lib/profils/stockage');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    await POST(requete({ id: ID, pertesCapitalReportees: {
      montant: 10000, unite: 'perte-capital-brute', source: 'avis-cotisation', dateDonnee: '2026-03-11',
    } }));
    await POST(requete({ id: ID, pertesCapitalReportees: {
      montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    } }));

    expect((await lireProfil(ID))!.droits.pertesCapitalReportees).toEqual({
      montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    });
  });

  it('l’API refuse une unité ou une source hors énumération', async () => {
    // Sans ce verrou, neutraliser les deux validations laissait 31 tests verts :
    // un appelant avec une faute de frappe (« perte-brute ») écrivait sur disque
    // une unité que `unitePermetUnChiffreFerme` ne connaît pas.
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { lireProfil, ecrireProfil } = await import('@/lib/profils/stockage');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    const mauvaiseUnite = await POST(requete({ id: ID, pertesCapitalReportees: {
      montant: 10000, unite: 'perte-brute', source: 'autre', dateDonnee: DATE,
    } }));
    expect(mauvaiseUnite.status).toBe(400);

    const mauvaiseSource = await POST(requete({ id: ID, pertesCapitalReportees: {
      montant: 10000, unite: 'perte-capital-brute', source: 'un-courriel', dateDonnee: DATE,
    } }));
    expect(mauvaiseSource.status).toBe(400);

    expect((await lireProfil(ID))!.droits.pertesCapitalReportees.montant).toBeNull();
  });

  it('l’API refuse un montant négatif au lieu de l’enregistrer', async () => {
    await racineJetable();
    const { POST } = await import('@/app/api/base-locale/fiche/route');
    const { ecrireProfil, lireProfil } = await import('@/lib/profils/stockage');
    await ecrireProfil(profilVierge(ID, DATE), DATE);

    const r = await POST(requete({
      id: ID,
      pertesCapitalReportees: {
        montant: -5000, unite: 'perte-capital-brute', source: 'autre', dateDonnee: DATE,
      },
    }));
    expect(r.status).toBe(400);
    expect((await lireProfil(ID))!.droits.pertesCapitalReportees.montant).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §16 — LE TEST TRANSVERSAL : l'écran est-il VRAIMENT branché au moteur ?
// ═══════════════════════════════════════════════════════════════════════════

describe('§16 · de la saisie au constat', () => {
  it('unité inconnue → la cristallisation de gains reste « à confirmer »', () => {
    const p = dossierAvecGainLatent();
    p.droits.pertesCapitalReportees = corpsPourApi(fusionner(
      { montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null },
      { montant: 10000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE }
    ));

    const c = constatGains(p);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    expect(c.donneesManquantes.join(' ')).toMatch(/unité des pertes en capital reportées/);
  });

  it('puis, qualifiée en perte brute → le garde-fou d’unité se lève et le chiffre sort', () => {
    // LE MÊME DOSSIER, une seule réponse de plus. C'est ce qui prouve que
    // l'écran est branché : rien d'autre n'a changé.
    const p = dossierAvecGainLatent();
    p.droits.pertesCapitalReportees = corpsPourApi(fusionner(
      { montant: 10000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE },
      { unite: 'perte-capital-brute' }
    ));

    const c = constatGains(p);
    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(10000);
  });

  it('et qualifiée en perte NETTE → le blocage demeure, avec son propre motif', () => {
    const p = dossierAvecGainLatent();
    p.droits.pertesCapitalReportees = corpsPourApi(fusionner(
      { montant: 10000, unite: 'inconnue', source: 'avis-cotisation', dateDonnee: DATE },
      { unite: 'perte-nette-capital-fiscale' }
    ));

    const c = constatGains(p);
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.donneesManquantes.join(' ')).toMatch(/montant BRUT/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les outils du fichier
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La route attend un `NextRequest`. Un `Request` standard suffit pour ce qu'elle
 * en fait (`.json()`), et c'est le patron déjà retenu par les tests de
 * `api/transmission` : on emprunte le type du paramètre plutôt que de fabriquer
 * un faux `NextRequest` complet.
 */
type EntreeRoute = Parameters<typeof import('@/app/api/base-locale/fiche/route').POST>[0];

function requete(corps: unknown): EntreeRoute {
  return new Request('http://localhost/api/base-locale/fiche', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }) as unknown as EntreeRoute;
}

/** Un dossier consolidé dont SEULE la qualification des pertes peut bloquer. */
function dossierAvecGainLatent(): ProfilClient {
  const p = profilVierge(ID, DATE);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '0-50k';
  p.revenus.dateDonnee = DATE;
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.transactionsAnnee.portee = 'complete';
  p.comptes = [{
    numero: 'FICT-1', suffixe: 'A', provenanceNumero: 'livre',
    type: 'non-enregistre', titulaire: null, candidats: [],
    dateReleve: DATE, presence: 'au-releve', encaisse: [],
    derniereActivite: null, dernierSolde: null,
    positions: [{
      symbole: 'FICTIF', devise: 'CAD', categorie: null,
      valeurMarchande: 50000, valeurComptable: 10000, revenuAnnuel: null,
    }],
  }];
  return p;
}

function constatGains(profil: ProfilClient) {
  const c = analyser(profil, null, DATE).constats.find((x) => x.strategie === 'cristallisation-gains');
  if (!c) throw new Error('constat cristallisation-gains absent');
  return c;
}
