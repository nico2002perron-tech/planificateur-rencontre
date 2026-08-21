// LES PERTES EN CAPITAL REPORTÉES — un montant sans unité n'est pas une donnée
// fiscale.
//
// Ce fichier verrouille la bascule du 20 août 2026 : le champ était un nombre
// nu (`MontantDate`), il devient un montant QUALIFIÉ (montant, unité, source,
// date). Deux dangers sont testés ici, et ce sont les deux faces du même :
//
//   · RÉINTERPRÉTER — décider qu'un ancien 10 000 est une perte brute
//     utilisable alors que personne n'a jamais demandé l'unité ;
//   · EFFACER — laisser tomber le nombre au motif qu'il est ambigu, et perdre
//     une donnée réelle entrée par un humain.
//
// La bonne réponse est la troisième : conserver le nombre, refuser de le lire.
//
// Données entièrement synthétiques : pseudonymes de test, comptes « FICT ».
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { profilVierge, unitePermetUnChiffreFerme, type ProfilClient } from '../types';
import { analyser } from '../strategies';

const DATE = '2026-08-20';
const ID = 'testpertes01';

// ─────────────────────────────────────────────────────────────────────────────
// Le bac à sable disque — une racine jetable par test, jamais la vraie base.
// ─────────────────────────────────────────────────────────────────────────────
const aNettoyer: string[] = [];

async function racineJetable(): Promise<string> {
  const racine = await fs.mkdtemp(path.join(os.tmpdir(), 'pertes-reportees-'));
  aNettoyer.push(racine);
  process.env.BASE_LOCALE_RACINE = racine;
  return racine;
}

/** Écrit un fichier de profil À LA MAIN — c'est ainsi qu'on simule l'ANCIEN format. */
async function poserProfilBrut(racine: string, contenu: Record<string, unknown>): Promise<string> {
  const chemin = path.join(racine, 'profils', `${ID}.json`);
  await fs.mkdir(path.dirname(chemin), { recursive: true });
  await fs.writeFile(chemin, JSON.stringify(contenu, null, 2), 'utf8');
  return chemin;
}

const RACINE_ORIGINALE = process.env.BASE_LOCALE_RACINE;

afterEach(async () => {
  if (RACINE_ORIGINALE === undefined) delete process.env.BASE_LOCALE_RACINE;
  else process.env.BASE_LOCALE_RACINE = RACINE_ORIGINALE;
  for (const r of aNettoyer.splice(0)) await fs.rm(r, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// V1 — L'ANCIEN FORMAT : le montant survit, son sens ne s'invente pas
// ═══════════════════════════════════════════════════════════════════════════

describe('V1 · un profil écrit AVANT le modèle qualifié', () => {
  it('conserve le montant, et le déclare d’unité inconnue — jamais réinterprété', async () => {
    const racine = await racineJetable();
    // LA FORME EXACTE D'AVANT : { montant, dateDonnee }, rien d'autre.
    await poserProfilBrut(racine, {
      id: ID, version: 3, dateMiseAJour: '2026-07-01',
      droits: {
        reerInutilises: { montant: 25000, dateDonnee: '2026-07-01' },
        celiInutilises: { montant: 7000, dateDonnee: '2026-07-01' },
        celiConjointInutilises: { montant: null, dateDonnee: null },
        pertesCapitalReportees: { montant: 10000, dateDonnee: '2026-07-01' },
      },
    });

    const { lireProfil } = await import('../stockage');
    const lu = await lireProfil(ID);

    expect(lu).not.toBeNull();
    const r = lu!.droits.pertesCapitalReportees;
    expect(r.montant).toBe(10000);            // LE NOMBRE SURVIT
    expect(r.unite).toBe('inconnue');         // SON SENS N'EST PAS INVENTÉ
    expect(r.source).toBe('inconnue');
    // LA DATE, ELLE, N'EST PAS AMBIGUË : elle dit quand la saisie a eu lieu.
    expect(r.dateDonnee).toBe('2026-07-01');

    // Les droits voisins n'ont pas bougé — la migration est CHIRURGICALE.
    expect(lu!.droits.reerInutilises).toEqual({ montant: 25000, dateDonnee: '2026-07-01' });
  });

  it('accepte même la forme la plus ancienne : un nombre nu, sans date', async () => {
    const racine = await racineJetable();
    await poserProfilBrut(racine, {
      id: ID, version: 1, dateMiseAJour: '2026-01-15',
      droits: { pertesCapitalReportees: 10000 },
    });

    const { lireProfil } = await import('../stockage');
    const r = (await lireProfil(ID))!.droits.pertesCapitalReportees;
    expect(r).toEqual({ montant: 10000, unite: 'inconnue', source: 'inconnue', dateDonnee: null });
  });

  it('un profil ancien ne peut PAS fonder un chiffre ferme de cristallisation', async () => {
    const racine = await racineJetable();
    await poserProfilBrut(racine, {
      id: ID, version: 3, dateMiseAJour: '2026-07-01',
      droits: { pertesCapitalReportees: { montant: 10000, dateDonnee: '2026-07-01' } },
    });

    const { lireProfil } = await import('../stockage');
    const profil = await lireProfil(ID);
    const c = constatGains(avecUnGainLatent(profil!));

    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    // ⚠ ET LE MOTIF EST LE VRAI MOTIF — pas « aucune perte disponible ».
    expect(c.donneesManquantes.join(' ')).toMatch(/unité des pertes en capital reportées/);
  });

  it('une unité HORS ÉNUMÉRATION — fichier édité à la main — retombe à inconnue', async () => {
    // Le doute est le défaut sûr : un fichier bricolé ne doit pas pouvoir faire
    // entrer dans le moteur une unité que le moteur ne connaît pas.
    const racine = await racineJetable();
    await poserProfilBrut(racine, {
      id: ID, version: 4, dateMiseAJour: DATE,
      droits: {
        pertesCapitalReportees: {
          montant: 10000, unite: 'perte-deja-verifiee-promis', source: 'un-courriel', dateDonnee: DATE,
        },
      },
    });

    const { lireProfil } = await import('../stockage');
    const r = (await lireProfil(ID))!.droits.pertesCapitalReportees;
    expect(r.montant).toBe(10000);
    expect(r.unite).toBe('inconnue');
    expect(r.source).toBe('inconnue');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V2 — LA PERTE NETTE DE L'AVIS : connue, et pour cela même refusée
// ═══════════════════════════════════════════════════════════════════════════

describe('V2 · une perte NETTE de l’avis de cotisation', () => {
  it('n’est jamais assimilée à une perte brute utilisable', () => {
    const p = avecUnGainLatent(profilDeTest());
    p.droits.pertesCapitalReportees = {
      montant: 10000, unite: 'perte-nette-capital-fiscale',
      source: 'avis-cotisation', dateDonnee: DATE,
    };
    const c = constatGains(p);

    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
    // AUCUNE CONVERSION INVENTÉE : ni 10 000, ni 20 000, ni 5 000.
    expect(plat(c.explication)).not.toMatch(/10 000|20 000|5 000/);
    expect(plat(c.explication)).toMatch(/montant NET/);
    expect(c.donneesManquantes.join(' ')).toMatch(/montant BRUT/);
  });

  it('le motif diffère de celui d’une unité jamais demandée', () => {
    // Deux blocages distincts, deux phrases distinctes : le planificateur ne
    // pose pas la même question dans les deux cas.
    const nette = avecUnGainLatent(profilDeTest());
    nette.droits.pertesCapitalReportees = {
      montant: 10000, unite: 'perte-nette-capital-fiscale', source: 'avis-cotisation', dateDonnee: DATE,
    };
    const inconnue = avecUnGainLatent(profilDeTest());
    inconnue.droits.pertesCapitalReportees = {
      montant: 10000, unite: 'inconnue', source: 'saisie-manuelle', dateDonnee: DATE,
    };

    expect(constatGains(nette).donneesManquantes)
      .not.toEqual(constatGains(inconnue).donneesManquantes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V3 — LES UNITÉS COMPATIBLES : elles chiffrent, et c'est le but
// ═══════════════════════════════════════════════════════════════════════════

describe('V3 · une unité explicitement comparable', () => {
  it('« montant normalisé utilisable » est consommé par la formule', () => {
    const p = avecUnGainLatent(profilDeTest());        // gain latent : 40 000
    p.droits.pertesCapitalReportees = {
      montant: 10000, unite: 'montant-normalise-utilisable',
      source: 'autre', dateDonnee: DATE,
    };
    const c = constatGains(p);

    expect(c.statut).toBe('calcule');
    expect(c.montantEstime).toBe(10000);
  });

  it('« perte en capital brute » aussi — elle se compare au même gain', () => {
    // ⚠ CE N'EST PAS DE LA GÉNÉROSITÉ : les gains latents sont eux-mêmes bruts
    // (valeur marchande moins prix de base). Refuser une perte brute exigerait
    // d'inventer un motif, et le motif du blocage doit être le vrai motif.
    const p = avecUnGainLatent(profilDeTest());
    p.droits.pertesCapitalReportees = {
      montant: 10000, unite: 'perte-capital-brute',
      source: 'avis-cotisation', dateDonnee: DATE,
    };
    expect(constatGains(p).montantEstime).toBe(10000);
  });

  it('le prédicat d’unité dit exactement lesquelles passent', () => {
    expect(unitePermetUnChiffreFerme('perte-capital-brute')).toBe(true);
    expect(unitePermetUnChiffreFerme('montant-normalise-utilisable')).toBe(true);
    expect(unitePermetUnChiffreFerme('perte-nette-capital-fiscale')).toBe(false);
    expect(unitePermetUnChiffreFerme('inconnue')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V4 — L'ALLER-RETOUR : les quatre champs traversent le disque intacts
// ═══════════════════════════════════════════════════════════════════════════

describe('V4 · sauvegarder puis relire', () => {
  it('rend les quatre champs identiques', async () => {
    const racine = await racineJetable();
    const { ecrireProfil, lireProfil } = await import('../stockage');

    const profil = profilVierge(ID, DATE);
    profil.droits.pertesCapitalReportees = {
      montant: 12345.67, unite: 'perte-capital-brute',
      source: 'avis-recotisation', dateDonnee: '2026-03-11',
    };
    await ecrireProfil(profil, DATE);

    const relu = await lireProfil(ID);
    expect(relu!.droits.pertesCapitalReportees).toEqual({
      montant: 12345.67, unite: 'perte-capital-brute',
      source: 'avis-recotisation', dateDonnee: '2026-03-11',
    });

    // ET SUR LE DISQUE AUSSI — pas seulement après normalisation en mémoire.
    const surDisque = JSON.parse(
      await fs.readFile(path.join(racine, 'profils', `${ID}.json`), 'utf8')
    );
    expect(surDisque.droits.pertesCapitalReportees.unite).toBe('perte-capital-brute');
    expect(surDisque.droits.pertesCapitalReportees.source).toBe('avis-recotisation');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// V5 — LIRE N'EST PAS ÉCRIRE
// ═══════════════════════════════════════════════════════════════════════════

describe('V5 · lire un ancien dossier ne le modifie pas', () => {
  it('le fichier reste octet pour octet celui d’avant, et sa version ne bouge pas', async () => {
    const racine = await racineJetable();
    const chemin = await poserProfilBrut(racine, {
      id: ID, version: 3, dateMiseAJour: '2026-07-01',
      droits: { pertesCapitalReportees: { montant: 10000, dateDonnee: '2026-07-01' } },
    });
    const avant = await fs.readFile(chemin, 'utf8');
    const mtimeAvant = (await fs.stat(chemin)).mtimeMs;

    const { lireProfil, listerProfils } = await import('../stockage');
    // Plusieurs lectures, y compris celle qui balaie tout le dossier.
    await lireProfil(ID);
    await lireProfil(ID);
    await listerProfils();

    const apres = await fs.readFile(chemin, 'utf8');
    expect(apres).toBe(avant);
    expect(apres).not.toMatch(/unite|source/);         // la forme ancienne intacte
    expect((await fs.stat(chemin)).mtimeMs).toBe(mtimeAvant);
    expect((await lireProfil(ID))!.version).toBe(3);   // aucune révision fantôme
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// §8 — L'ADDITION INTERDITE : 10 000 + 5 000 ne fait jamais 15 000
// ═══════════════════════════════════════════════════════════════════════════

describe('§8 · une perte courante solide et une reportée ambiguë', () => {
  it('ne s’additionnent JAMAIS en un montant disponible', () => {
    const p = avecUnGainLatent(profilDeTest());        // gain latent : 40 000
    // 10 000 de perte COURANTE, brute, venue de Croesus : unité connue.
    p.transactionsAnnee.pertesRealisees = 10000;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 10000;
    // 5 000 de perte REPORTÉE d'un ancien dossier : unité inconnue.
    p.droits.pertesCapitalReportees = {
      montant: 5000, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    };

    const c = constatGains(p);
    expect(c.montantEstime).not.toBe(15000);
    expect(plat(c.explication)).not.toMatch(/15 000/);
    // Et pas davantage un 10 000 présenté comme certain : la reportée pourrait
    // élargir la place disponible, donc le chiffre n'est pas établi non plus.
    expect(c.statut).toBe('montant-a-confirmer');
    expect(c.montantEstime).toBeNull();
  });

  it('mais avec une reportée d’unité BRUTE, les deux s’additionnent — et le disent', () => {
    const p = avecUnGainLatent(profilDeTest());
    p.transactionsAnnee.pertesRealisees = 10000;
    p.transactionsAnnee.pertesRealiseesNonEnregistrees = 10000;
    p.droits.pertesCapitalReportees = {
      montant: 5000, unite: 'perte-capital-brute', source: 'avis-cotisation', dateDonnee: DATE,
    };
    expect(constatGains(p).montantEstime).toBe(15000);
  });

  it('une reportée inutilisable n’est jamais rangée en « aucune perte disponible »', () => {
    // LE MOTIF DU ZÉRO DOIT ÊTRE LE VRAI MOTIF. Sans perte courante, un montant
    // reporté d'unité inconnue laissait le moteur conclure « rien à récolter »
    // — un faux négatif silencieux, pire que l'ambiguïté qu'il masquait.
    const p = avecUnGainLatent(profilDeTest());
    p.droits.pertesCapitalReportees = {
      montant: 5000, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
    };
    const c = constatGains(p);

    expect(c.statut).not.toBe('non-applicable');
    expect(c.statut).toBe('montant-a-confirmer');
    expect(plat(c.explication)).not.toMatch(/[Aa]ucune perte inutilisée/);
    expect(c.donneesManquantes.join(' ')).toMatch(/unité des pertes en capital reportées/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Les outils du fichier
// ─────────────────────────────────────────────────────────────────────────────

/** Un profil consolidé : rien d'AUTRE que les pertes reportées ne doit bloquer. */
function profilDeTest(): ProfilClient {
  const p = profilVierge(ID, DATE);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '0-50k';
  p.revenus.dateDonnee = DATE;
  // Aucun compte ailleurs, aucun historique externe : la portée est complète.
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE;
  p.transactionsAnnee.portee = 'complete';
  return p;
}

/** Un unique compte non enregistré, un unique titre : 50 000 $ pour un PBR de 10 000 $. */
function avecUnGainLatent(profil: ProfilClient): ProfilClient {
  const p: ProfilClient = JSON.parse(JSON.stringify(profil));
  if (p.consolidation.comptesExternes === 'inconnu') {
    // Un profil relu du disque part vierge : on le consolide comme les autres.
    Object.assign(p.consolidation, {
      comptesExternes: 'non', historiqueExterne: 'jamais', dateConfirmation: DATE,
    });
    p.transactionsAnnee.portee = 'complete';
    p.demographie.dateNaissance = '1960-05-04';
    p.demographie.age = 66;
    p.revenus.trancheRevenu = '0-50k';
    p.revenus.dateDonnee = DATE;
  }
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

/** Les espaces insécables de `argent()` rendent les regexes illisibles. */
function plat(texte: string): string {
  return texte.replace(/ | /g, ' ');
}
