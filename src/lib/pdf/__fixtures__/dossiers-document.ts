// LES DOSSIERS QUI TRAVERSENT TOUT LE PIPELINE — du profil au PDF.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CES FIXTURES-CI SONT DIFFÉRENTES DES AUTRES.
//
// Les fixtures existantes du volet PDF partent d'une `PresentationCristallisation…`
// fabriquée à la main. Elles prouvent le RENDU, et c'est utile — mais elles
// sautent tout ce qui se trouve avant : le moteur, le plan canonique, la
// dérivation `plan`, la sélection des stratégies, l'assemblage du document.
//
// Celles-ci partent d'un `ProfilClient`. Elles passent donc par `analyser()`,
// c'est-à-dire par la MÊME fonction que la route de production — laquelle est
// synchrone et pure : aucun disque, aucune variable d'environnement. Ce qu'on
// court-circuite volontairement, c'est `hydraterProfil`, dont le seul rôle est
// de remplir `comptes` depuis le livre Croesus ; ici on les pose à la main,
// exactement comme le font déjà les batteries du moteur.
//
// ⚠ NE JAMAIS APPELER `profilPourClient()` DEPUIS UN TEST. Il passe par
// `pseudonymePour()`, qui ÉCRIT dans `correspondance.json` de la vraie base
// locale dès qu'un nom lui est inconnu. Un test qui « lit » un dossier
// fabriquerait ainsi une entrée nominative permanente.
//
// ⚠ SOCIÉTÉS ET DOSSIERS ENTIÈREMENT FICTIFS. Comptes « FICT », symboles
// inventés, aucun nom de personne.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QU'IL FAUT POUR QU'UNE LIGNE DE PLAN EXISTE — mesuré, pas supposé.
//
// La position doit porter les CINQ : `typeInstrument` supporté (Action ou Fonds
// d'investissement — Obligation et absent sont refusés par conception),
// `uniteValeursRapport`, `quantite > 0`, `valeurComptable`, `valeurMarchande`.
// Et le compte doit porter `type: 'non-enregistre'` et une `dateReleve`, qui
// alimente à la fois la complétude et la date affichée sur la page.
// ─────────────────────────────────────────────────────────────────────────────
import { profilVierge, type ProfilClient, type Compte, type Position } from '@/lib/profils/types';

export const DATE_DOSSIER = '2026-08-21';

// ⚠ LA `description` COMPTE, ET SON ABSENCE M'A FAIT MAL LIRE UN PDF.
// Mes premières fixtures l'omettaient : le document rendu n'affichait que le
// symbole, et j'ai failli le noter comme un défaut de production. C'en est un
// de FIXTURE — `Position.description` existe, le parseur la remplit depuis le
// relevé, et le rôle du champ est précisément d'écrire le nom de la société
// sous son ticker dans le document remis. Une fixture plus pauvre que le réel
// fait inspecter un document que personne ne recevra.
const NOMS: Record<string, string> = {
  ALFA: 'Alfa Ressources Ltée',
  BRAVO: 'Bravo Technologies du Nord inc.',
  CHARLI: 'Écho Gestion privée du Saint-Laurent',
};

function position(
  symbole: string, vm: number | null, pbr: number | null,
  quantite = 100, devise = 'CAD', typeInstrument = 'Action'
): Position {
  return {
    symbole, devise, categorie: null, uniteValeursRapport: 'CAD',
    description: NOMS[symbole], quantite, typeInstrument,
    valeurMarchande: vm, valeurComptable: pbr, revenuAnnuel: null,
  };
}

function compte(positions: Position[], numero = 'FICT-1'): Compte {
  return {
    numero, suffixe: numero.slice(-1), provenanceNumero: 'livre',
    type: 'non-enregistre', titulaire: 'client', candidats: [numero],
    dateReleve: DATE_DOSSIER, presence: 'au-releve',
    derniereActivite: null, dernierSolde: null, encaisse: [], positions,
  };
}

/** Le socle : tout est confirmé, rien ne bloque, aucune stratégie n'est allumée. */
function socle(id: string, modif: (p: ProfilClient) => void = () => {}): ProfilClient {
  const p = profilVierge(id, DATE_DOSSIER);
  p.demographie.dateNaissance = '1960-05-04';
  p.demographie.age = 66;
  p.demographie.province = 'QC';
  p.revenus.trancheRevenu = '100-150k';
  p.revenus.dateDonnee = DATE_DOSSIER;
  // ⚠ LE LEVIER LE PLUS SENSIBLE DU DOSSIER. Laissé à son défaut « inconnu »,
  // il bloque LES DEUX cristallisations en `montant-a-confirmer` : on ne peut
  // pas affirmer une perte apparente sans savoir ce qui est détenu ailleurs.
  p.consolidation.comptesExternes = 'non';
  p.consolidation.historiqueExterne = 'jamais';
  p.consolidation.dateConfirmation = DATE_DOSSIER;
  p.transactionsAnnee.portee = 'complete';
  modif(p);
  return p;
}

// ═══════════════════════════════════════════════════════════════════════════
// (A) PARTICULIER · CRISTALLISATION DE PERTES **MONO**
// ═══════════════════════════════════════════════════════════════════════════
// 20 000 $ de gain net réalisé, une seule position en perte latente de 10 000 $.
// `absorbable = min(10 000, 20 000) = 10 000` — la position couvre seule.
export const DOSSIER_PERTES_MONO = (): ProfilClient => socle('fict-mono', (p) => {
  p.transactionsAnnee.gainsRealises = 20000;
  p.transactionsAnnee.gainsRealisesNonEnregistres = 20000;
  p.comptes = [compte([position('ALFA', 4000, 14000)])];
});

// ═══════════════════════════════════════════════════════════════════════════
// (B) PARTICULIER · CRISTALLISATION DE PERTES **MULTI**
// ═══════════════════════════════════════════════════════════════════════════
// ⚠ DEUX SYMBOLES DIFFÉRENTS DANS LE MÊME COMPTE, et c'est délibéré : le même
// symbole dans deux comptes déclencherait `biens-identiques-multi-comptes` et
// tout retomberait en `montant-a-confirmer`. Le multi qu'on veut ici vient de
// la CIBLE, pas d'une imperfection du dossier.
//
// Pertes latentes 10 000 + 9 000 = 19 000, mais gain net 15 000 : la cible est
// `min(19 000, 15 000) = 15 000`. Aucune position ne couvre seule, et la
// seconde n'est vendue QU'EN PARTIE.
//
// ⚠ LA CIBLE NE DOIT PAS TOMBER PILE. Mesure faite avant d'ecrire ces
// fixtures : avec un gain net de 19 000, le plan atterrissait exactement sur
// la cible, ecart 0, aucune ligne partielle. Trois des choses que la page en
// cinq etapes existe pour dire — l'ecart, la vente partielle, la granularite
// des unites entieres — n'etaient alors jamais exercees.
export const DOSSIER_PERTES_MULTI = (): ProfilClient => socle('fict-multi', (p) => {
  p.transactionsAnnee.gainsRealises = 15000;
  p.transactionsAnnee.gainsRealisesNonEnregistres = 15000;
  p.comptes = [compte([
    position('ALFA', 4000, 14000),        // perte latente 10 000
    position('BRAVO', 3000, 12000, 60),   // perte latente  9 000
  ])];
});

// ═══════════════════════════════════════════════════════════════════════════
// (C) PARTICULIER · CRISTALLISATION DE **GAINS**
// ═══════════════════════════════════════════════════════════════════════════
// ⚠ LES DEUX CRISTALLISATIONS SONT MIROIRS : `perteNetteAnnee = max(0, pertes −
// gains)`. Un dossier qui allume les pertes éteint les gains, sauf si des
// pertes REPORTÉES existent. D'où l'avis de cotisation ci-dessous — et son
// unité, qui doit être `perte-capital-brute` : toute autre bloque le chiffre
// ferme côté gains.
export const DOSSIER_GAINS = (): ProfilClient => socle('fict-gains', (p) => {
  // 12 345 $ vise sur un gain latent de 100 $ l'unite : 123 unites entieres
  // realisent 12 300 $, et les 45 $ manquants sont exactement ce que la page
  // appelle « capacite inutilisee ».
  p.droits.pertesCapitalReportees = {
    montant: 12345, unite: 'perte-capital-brute',
    source: 'avis-cotisation', dateDonnee: DATE_DOSSIER,
  };
  p.comptes = [compte([position('CHARLI', 50000, 10000, 400)])];
});

// ═══════════════════════════════════════════════════════════════════════════
// (D) PARTICULIER · LES DEUX STRATÉGIES ALLUMÉES, PERTES EN **MULTI**
// ═══════════════════════════════════════════════════════════════════════════
// Le dossier le plus utile du lot : un seul PDF y porte une page de pertes
// MULTI et une page de gains, donc les deux pages en cinq étapes.
export const DOSSIER_COMPLET = (): ProfilClient => socle('fict-complet', (p) => {
  p.transactionsAnnee.gainsRealises = 15000;
  p.transactionsAnnee.gainsRealisesNonEnregistres = 15000;
  p.droits.pertesCapitalReportees = {
    montant: 12345, unite: 'perte-capital-brute',
    source: 'avis-cotisation', dateDonnee: DATE_DOSSIER,
  };
  p.comptes = [compte([
    position('ALFA', 4000, 14000),        // perte latente 10 000
    position('BRAVO', 3000, 12000, 60),   // perte latente  9 000
    position('CHARLI', 50000, 10000, 400),// gain latent   40 000
  ])];
});

// ═══════════════════════════════════════════════════════════════════════════
// (E) PARTICULIER · STATUT **À CONFIRMER**
// ═══════════════════════════════════════════════════════════════════════════
// Une seule cause, et la moins chère : la portée externe n'est pas confirmée.
// Les positions sont là, les chiffres aussi — mais on ne peut pas affirmer
// qu'aucune perte n'est apparente sans savoir ce qui est détenu ailleurs.
export const DOSSIER_A_CONFIRMER = (): ProfilClient => {
  const p = DOSSIER_COMPLET();
  p.consolidation.comptesExternes = 'inconnu';
  p.consolidation.dateConfirmation = null;
  return p;
};

// ═══════════════════════════════════════════════════════════════════════════
// (F) **ENTREPRISE** · le même portefeuille, un autre titulaire
// ═══════════════════════════════════════════════════════════════════════════
// ⚠ LE TYPE EST DÉCLARÉ, JAMAIS DEVINÉ. Aucun indice — « INC », « Gestion »,
// suffixe de compte — ne doit y conduire, et un test l'interdit explicitement.
//
// Ce qui bascule en `non-applicable` : droits-cotisation, celi-conjoint,
// subvention-reee, localisation-actifs. Ce qui RESTE applicable : les deux
// cristallisations, don-titres, ordre-vente. Un dossier d'entreprise garde donc
// ses deux pages en cinq étapes — c'est le portefeuille qui travaille, pas le
// régime personnel.
export const DOSSIER_ENTREPRISE = (): ProfilClient => {
  const p = DOSSIER_COMPLET();
  p.id = 'fict-entreprise';
  p.typeTitulaire = 'entreprise';
  return p;
};

/** Les paramètres du REEE, en littéral — `parametresReee()` lirait un CSV du disque. */
export const REEE_TEST = { tauxScee: 0.20, tauxIqee: 0.10, cotisationSubventionnee: 2500 };
