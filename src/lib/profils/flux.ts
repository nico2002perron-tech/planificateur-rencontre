// LA LIGNE DU TEMPS DES FLUX — étape 2 : la classification par ligne.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE MODULE EXISTE (19 août 2026).
//
// Le moteur connaissait QUATRE types de transaction Croesus — « Cotisation »,
// « Retrait », « Transfert », « Réception » — et tout le reste tombait dans
// « pas un flux » par défaut. C'était juste par accident : un achat, une vente,
// un dividende ne sont effectivement pas des flux de capital. Mais un type
// jamais vu — « Échange », « Ajustement », un libellé renommé par Croesus —
// tombait au même endroit, SILENCIEUSEMENT. Un silence qui a l'air juste est le
// défaut le plus cher de ce dépôt (voir docs/regles-parseur.md, règle 1).
//
// Ce module remplace le défaut par une LISTE BLANCHE : chaque ligne reçoit une
// nature tirée d'un vocabulaire fermé, et un libellé inconnu devient la nature
// `inconnu` — COMPTÉ et NOMMÉ dans le diagnostic, jamais rangé. La liste ne
// grandit que par mesure : un libellé entre quand il a été vu sur le livre.
//
// CE QUE L'ÉTAPE 2 FAIT : une nature PROVISOIRE par ligne, en lisant la ligne
// SEULE — son type, son régime, son signe, sa forme (argent ou titre), sa note.
//
// CE QU'ELLE NE FAIT PAS, À DESSEIN : aucun rapprochement entre lignes. La
// partie double d'une cotisation (règle 2), une conversion CAD/USD, un virement
// à deux jambes, un renversement — tout cela exige de regarder PLUSIEURS lignes,
// et c'est l'étape 3. Les natures correspondantes (`conversion-devise`,
// `annule`…) sont déclarées dans le vocabulaire pour que le type soit complet,
// mais AUCUNE ligne ne les reçoit ici. Un test le vérifie.
//
// RÈGLE QUI COMMANDE TOUT : un transfert n'est JAMAIS une cotisation par le seul
// fait d'être un transfert. Ici, il est `ambigu` — sauf si sa note cite un
// compte (règle 3), auquel cas c'est un `virement-interne` dont l'autre jambe
// sera cherchée à l'étape 4.
//
// CONTRE-EXPERTISE DU 19 AOÛT (5 lentilles adverses, 2 lectures chacune) — ce
// qu'elle a fait corriger AVANT la première livraison :
//   · une « Cotisation » dans un FERR/FRV/CRI sortait « cotisation » : on ne
//     cotise pas à un régime de décaissement → `ambigu` ;
//   · une cotisation dont la NOTE cite un compte sortait « argent neuf » alors
//     que la règle 5 (`separerCotisations`) dit le contraire → `virement-interne` ;
//   · une ligne SANS SYMBOLE passait pour « en argent », et contournait la
//     garde de signe → `ambigu` ;
//   · un « Achat » de 1USD passait pour une opération sur titre : c'est la
//     forme la plus courante d'une conversion de devise → `ambigu` ;
//   · « Dépôt » est connu de `deriver.ts:214` et manquait à la liste blanche ;
//   · la règle 3 ne dépend pas du suffixe : un Transfert au régime inconnu dont
//     la note cite un compte est un virement interne ;
//   · un régime connu mais sans vocabulaire (`corpo`) tombait en capital par
//     défaut — le même défaut silencieux qu'on venait de corriger pour les
//     libellés → `ambigu` ;
//   · `libellesInconnus` recopiait le libellé brut : un collage décalé d'une
//     colonne y aurait fait entrer un numéro de compte → clé normalisée, et
//     tout libellé non textuel replié sous une seule clé ;
//   · `constructor` traversait la liste blanche (héritage de Object.prototype)
//     → une `Map`.
//
// ⚠ CE MODULE EST EN PRODUCTION DEPUIS LE 20 AOÛT 2026 — l'en-tête disait
// encore « rien dans deriver.ts, strategies.ts ou le PDF ne consomme ce module,
// la non-régression est mécanique ». C'était vrai le 19 août ; ça ne l'est plus
// depuis la bascule : `hydrater.signauxDuLivre` appelle `vueCeliParAnnee`, qui
// appelle `classerLigne` ligne par ligne ; le résultat traverse
// `signaux-livre.ts` (limites et rétrogradation d'état) puis `strategies.ts`,
// dont l'`explication` est rendue dans le PDF remis au client.
//
// CE QUE ÇA CHANGE POUR QUI TOUCHE ICI : les MONTANTS restent protégés (aucune
// nature de ce module n'entre dans un agrégat de cotisation ou de retrait — la
// règle 2 et les branches d'agrégation en décident seules), mais le VERDICT
// AFFICHÉ, lui, dépend de ces natures : une ligne qui devient `ambigu` peut
// rétrograder « maximisé » en « indéterminé » à l'écran. La non-régression
// n'est plus mécanique : elle se teste.
// ─────────────────────────────────────────────────────────────────────────────

import type { LigneTransaction } from '@/lib/parseur-croesus/types';
import { typeDeCompte, sousTypeCompte } from '@/lib/parseur-croesus/types';
import { estEncaisse, estVirementInterne } from '@/lib/parseur-croesus/regles';

/**
 * Le vocabulaire FERMÉ des natures. Un flux est l'une d'elles, jamais autre
 * chose. Le vocabulaire dépend du régime : on « cotise » à un CELI, on
 * « apporte du capital » à un comptant — appeler cotisation une entrée dans
 * une marge est conceptuellement faux (cahier des charges, section 6).
 */
export type NatureFlux =
  // ── produites par l'étape 2 (cette version) ────────────────────────────────
  | 'cotisation'        // régime enregistré, entrée — provisoire : la règle 2 (partie double) tranche à l'étape 3
  | 'retrait'           // régime enregistré, sortie
  | 'apport-capital'    // non-enregistré, entrée externe
  | 'retrait-capital'   // non-enregistré, sortie externe
  | 'virement-interne'  // la note cite un compte (règles 3 et 5) — l'autre jambe vient à l'étape 4
  | 'operation-titre'   // achat, vente d'un TITRE : ce n'est pas un flux de capital
  | 'revenu'            // dividende : ce n'est pas un flux de capital
  | 'frais-impot'       // frais de service et leurs taxes — de l'argent sort, mais AUCUN droit n'est recréé (mesuré le 20 août 2026)
  | 'ambigu'            // on SAIT qu'on ne sait pas — et le motif dit pourquoi
  | 'inconnu'           // libellé Croesus jamais vu : DIAGNOSTIC, pas silence
  // ── déclarées, jamais produites ici (étape 3) ──────────────────────────────
  | 'conversion-devise' // E↔F, A↔B, achat/vente de 1USD : deux jambes, deux devises, aucun flux externe
  | 'transfert-regime'  // même régime ou REER→FERR : ne consomme aucun droit
  | 'annule';           // jambe neutralisée par son renversement

export type Confiance = 'confirme' | 'eleve' | 'ambigu' | 'inconnu';

/**
 * CE QUE CETTE LIGNE POURRAIT ENCORE CHANGER dans un chiffre fiscal — ajouté
 * le 20 août 2026 pour supprimer une incohérence de vocabulaire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LE DÉFAUT QUE CETTE NOTION SUPPRIME.
 *
 * `ambigu` bloquait les conclusions ; `inconnu` ne les bloquait pas. Une ligne
 * que le moteur comprend À MOITIÉ pesait donc plus lourd qu'une ligne qu'il ne
 * comprend PAS DU TOUT : 59 « Valeur comptable » inexpliquées — dont un net de
 * −9 000 $ — laissaient un verdict fort intact, pendant qu'un « Frais » de
 * +57,33 $ le faisait tomber. Hiérarchie accidentelle, née de l'ordre dans
 * lequel les libellés sont entrés dans la liste blanche, pas d'un raisonnement.
 *
 * LA RÈGLE EST DONC : ce qui bloque un chiffre, c'est CE QUI PEUT LE MODIFIER.
 *
 *   aucun                      la ligne ne peut pas déplacer un dollar fiscal :
 *                              frais/taxe prouvés, revenu, opération sur titre,
 *                              ou montant nul (un zéro ne change aucune somme) ;
 *   peut-affecter-cotisation   une entrée non tranchée ;
 *   peut-affecter-retrait      une sortie non tranchée ;
 *   peut-affecter-les-deux     un mouvement dont même le SENS est incertain, ou
 *                              une ligne incomprise qui porte un montant ;
 *   inconnu                    on ne sait même pas si ça peut compter — montant
 *                              illisible. Bloque comme le pire cas.
 *
 * ⚠ `inconnu` N'EST JAMAIS INOFFENSIF PAR DÉFAUT (§15 de la consigne) : un
 * libellé jamais mesuré qui porte un montant non nul dans un compte fiscal peut
 * être une cotisation ou un retrait. Il bloque.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export type ImpactCompletude =
  | 'aucun'
  | 'peut-affecter-cotisation'
  | 'peut-affecter-retrait'
  | 'peut-affecter-les-deux'
  | 'inconnu';

/** Une ligne, lue seule, avec ce qu'on peut en dire sans regarder les autres. */
export type LigneClassee = {
  nature: NatureFlux;
  confiance: Confiance;
  /** Ce que cette ligne pourrait encore changer dans un chiffre fiscal (voir `ImpactCompletude`). */
  impactCompletude: ImpactCompletude;
  /** `'argent'` = 1CAD/1USD ; `'titre'` = un symbole ; `null` = pas de symbole. Un FAIT, pas une interprétation. */
  forme: 'argent' | 'titre' | null;
  /** `typeDeCompte(noCompte)` — `null` quand le régime n'est pas prouvé. */
  regime: string | null;
  /** Le sous-type et la devise du COMPTE (pas de la ligne), quand le suffixe les porte. */
  sousType: string | null;
  deviseCompte: 'CAD' | 'USD' | null;
  /** UNE phrase : pourquoi cette nature. C'est ce qu'un fiscaliste relit. */
  motif: string;
  /**
   * La matière première, toujours. Un agrégat sans sa ligne ne s'explique pas.
   *
   * ⚠ DOCTRINE : cette ligne porte le nom, le compte, la note. Elle ne se
   * sérialise JAMAIS vers un client, un journal ou un fichier. Seul
   * `DiagnosticClassification` — des comptages — sort de ce module.
   */
  source: LigneTransaction;
};

// ─────────────────────────────────────────────────────────────────────────────
// LA LISTE BLANCHE — les libellés Croesus PROUVÉS, et rien d'autre.
//
// Prouvés = vus dans le code, les fixtures ou la documentation du dépôt avant
// le 19 août 2026. Huit libellés (neuf clés : le singulier « Dividende » est
// toléré). C'est PEU, et c'est voulu : un libellé qui
// n'y est pas sort en `inconnu` et le diagnostic le nomme — c'est ainsi que la
// liste grandit, par la mesure d'un vrai collage, jamais par supposition.
//
// Une `Map`, pas un objet : « constructor » et « __proto__ » traversaient
// l'objet par héritage et sortaient en famille transfert.
//
// ⚠ À NE PAS CONFONDRE avec `detectCategory()` de portfolio/year-activity.ts,
// qui classe par SOUS-CHAÎNE (« contient "cotisation" ») pour le PDF d'activité.
// Ici on compare le libellé ENTIER, normalisé. Deux outils, deux besoins : le
// PDF d'activité tolère, le moteur fiscal déclare. On ne crée pas un troisième
// vocabulaire ; on en crée un STRICT là où il n'y en avait aucun.
// ─────────────────────────────────────────────────────────────────────────────

type FamilleLibelle = 'cotisation' | 'retrait' | 'transfert' | 'operation-titre' | 'revenu' | 'frais-impot';

/** Normalise un libellé pour la comparaison : accents retirés, casse et espaces aplanis. */
export function normaliserLibelle(type: string | null | undefined): string {
  return (type ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/\s+/g, ' ');
}

const LIBELLES_CONNUS = new Map<string, FamilleLibelle>([
  // Les quatre que le moteur connaissait déjà (regles.ts, deriver.ts).
  ['cotisation', 'cotisation'],
  ['retrait', 'retrait'],
  ['transfert', 'transfert'],
  ['reception', 'transfert'],        // « Réception » — TYPES_ENTREE de regles.ts
  // « Dépôt » — deriver.ts:214, cotisationsReeeParEnfant l'accepte comme cotisation REEE.
  ['depot', 'cotisation'],
  // Vus dans les fixtures (regles.test.ts, deriver.test.ts).
  ['achat', 'operation-titre'],
  ['vente', 'operation-titre'],
  // Vu dans la documentation du type (types.ts : « Achat », « Cotisation », « Dividendes »).
  ['dividendes', 'revenu'],
  ['dividende', 'revenu'],           // singulier toléré : même mot
  // MESURÉ le 19 août 2026 sur la base locale (docs/mesure-livre-flux-2026-08-19.md) :
  // 1 575 lignes « Intérêts » (18,3 % du livre), 904 sur titres + 671 d'encaisse,
  // signes surtout positifs — un revenu de placement, jamais un flux de capital.
  ['interets', 'revenu'],
  ['interet', 'revenu'],             // singulier toléré : même mot
  // ── MESURÉ le 20 août 2026 (docs/mesure-types-hors-flux-2026-08-20.md) ─────
  //
  // LES FRAIS ET LEURS TAXES. Sur les CELI de la base locale :
  //   · TPS 17 lignes, TVP 17 lignes — TOUTES négatives, en encaisse, quantité
  //     nulle, et TOUTES accompagnées le même jour, sur le même compte, d'un
  //     « Frais » ou « Frais de gestion » (17/17). Le ratio est le taux de la
  //     taxe lui-même : 5,0 % pour la TPS, 10,0 % pour la TVP — 17 fois sur 17.
  //     Ce ne sont pas des flux de capital : ce sont les taxes du service ;
  //   · Frais de gestion 11 lignes, toutes négatives, en encaisse, notes
  //     « FRAIS GEST. … » ; Frais 7 lignes, 6 négatives de même forme.
  //
  // ⚠ CE QUE CETTE FAMILLE NE DIT PAS : qu'il ne se passe rien. Des frais
  // SORTENT de l'argent du compte. Mais ils ne sont pas un RETRAIT DU
  // TITULAIRE : ils ne recréent aucun droit de cotisation l'année suivante.
  // C'est exactement la distinction que le moteur doit préserver — et la
  // raison pour laquelle « total négatif → retrait » n'a jamais été une règle
  // ici. (« TVH » n'entre PAS : 0 occurrence mesurée. Elle sortira `inconnu`,
  // donc VISIBLE, et entrera à sa première occurrence — c'est ainsi que la
  // liste grandit.)
  ['tps', 'frais-impot'],
  ['tvp', 'frais-impot'],
  ['frais', 'frais-impot'],
  ['frais de gestion', 'frais-impot'],
  //
  // LES OPÉRATIONS SUR TITRE. Mesurées sur les CELI, toutes SANS impact sur
  // l'encaisse (0/11, 0/2, 0/17) — donc aucun capital n'entre ni ne sort :
  //   · Échange 11 lignes, toutes en titres, 10 à total nul, 11/11 appariées
  //     dans une partie double le même jour sur le même compte ;
  //   · Expiration 2 lignes, en titres, total nul, quantité non nulle — des
  //     positions qui disparaissent sans mouvement d'argent ;
  //   · Remboursement 17 lignes, toutes en titres, toutes positives, quantité
  //     non nulle, notes vides, et 15 sur 17 accompagnées d'« Intérêts » le
  //     même jour sur le même compte : le capital d'un titre à revenu fixe qui
  //     arrive à échéance, avec son dernier coupon. La branche `operation-titre`
  //     ci-dessous ne l'accepte QUE sous forme de titre — un « Remboursement »
  //     en argent resterait ambigu, comme la consigne du 20 août le demande.
  ['echange', 'operation-titre'],
  ['expiration', 'operation-titre'],
  ['remboursement', 'operation-titre'],
]);

// RESTENT « inconnu », À DESSEIN — la mesure les a VUS sans les COMPRENDRE
// assez pour une règle déterministe :
//   · Assignation (2 lignes, des options) — jamais vu ailleurs dans le dépôt ;
//   · Journal (45 lignes, toutes à total = 0, notes vides) — écritures de
//     quantité, probablement ; « probablement » n'est pas une règle ;
//   · Divers (12), Montant brut (6) — trop peu, trop hétérogènes ;
//   · Livraison (1 ligne CELI d'encaisse à −152,38 en 2009) — mesurée le
//     20 août : elle est le MIROIR exact du « Dépôt » de +152,38 du même
//     dossier. Un virement interne, donc ; l'étape 4 le dira. Deux libellés,
//     un seul mouvement : la classifier « hors flux » masquerait la moitié
//     d'un transfert.
//   · Dépôt en CELI — NO-GO du 20 août : 1 occurrence, qui ressemble à un
//     remboursement de frais (voir ci-dessus, son miroir « Livraison »).
//     ⚠ « depot » EST dans la liste ci-dessus, famille cotisation, POUR LE
//     REEE (deriver.ts:214) : c'est `separerCotisations` qui, en n'acceptant
//     que le type « Cotisation », l'écarte de l'argent neuf CELI. La liste
//     blanche dit « ce libellé existe » ; la règle 2 dit « il ne compte pas ».
//   · VALEUR COMPTABLE — 59 lignes CELI, le plus gros bloc restant, et un
//     NO-GO MESURÉ le 20 août. L'hypothèse « écriture d'inventaire sans flux »
//     a été TESTÉE et REFUSÉE : par compte et par jour, 3 groupes sur 4 sont
//     bien une redistribution interne (titres −X, encaisse +X, net ≈ 0), mais
//     le quatrième laisse un net de −9 000,00 $. De la valeur a quitté le
//     compte sous ce libellé. Une règle « Valeur comptable → hors flux »
//     masquerait ce mouvement — exactement le silence que ce module existe
//     pour supprimer. À re-mesurer sur le grand livre : si le net par
//     compte-jour y est systématiquement nul, une règle CONTEXTUELLE (étape 3,
//     pas ici : elle exige plusieurs lignes) deviendra possible.
// Un libellé n'entre ici QUE compris, pas seulement compté.

/**
 * Les libellés HORS FLUX entrés le 20 août 2026, pour lesquels une note citant
 * un compte (règle 3) prime sur la classification : un mouvement vers un compte
 * nommé n'est jamais « juste des frais » ni « juste une opération sur titre ».
 */
const LIBELLES_NOTE_SENSIBLE = new Set([
  'tps', 'tvp', 'frais', 'frais de gestion', 'echange', 'expiration', 'remboursement',
]);

/** Les régimes enregistrés où l'on COTISE : le vocabulaire y est « cotisation » / « retrait ». */
const REGIMES_COTISABLES = new Set(['celi', 'celiapp', 'reer', 'reer-conjoint', 'reee']);
/**
 * Les régimes de DÉCAISSEMENT — on n'y cotise pas. Un FERR reçoit un REER
 * converti, un CRI un régime de pension, un FRV un CRI : des TRANSITIONS, jamais
 * des cotisations. Cahier des charges, section 18 : « ne considère jamais une
 * entrée dans un FERR comme une cotisation FERR par analogie simpliste ».
 * On en RETIRE, en revanche — c'est à ça qu'ils servent.
 */
const REGIMES_DECAISSEMENT = new Set(['ferr', 'frv', 'cri']);
/** Sur un REEE, une note qui parle de subvention : l'argent n'est pas celui du client. */
const NOTE_SUBVENTION_REEE = /\b(SCEE|IQEE|CESG|QESI|BEC|CLB|SUBVENTION|INCITATIF)\b/i;

// ─────────────────────────────────────────────────────────────────────────────
// LA CLASSIFICATION D'UNE LIGNE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'IMPACT POSSIBLE d'une ligne sur un chiffre fiscal — la seule chose qui
 * autorise à bloquer, ou à ne pas bloquer, un calcul ferme.
 *
 * L'ordre des tests suit la force de la preuve :
 *   1. les natures PROUVÉES hors flux ne déplacent rien, par définition ;
 *   2. un montant NUL ne peut changer aucune somme — quel que soit le libellé ;
 *   3. un montant ILLISIBLE est le pire cas : on ne sait même pas ;
 *   4. les flux fermes sont DÉJÀ comptés là où ils doivent l'être ;
 *   5. tout le reste — ambigu, inconnu, virement non résolu — bloque, et le
 *      SENS du montant dit quel côté il menace.
 */
function impactDe(nature: NatureFlux, confiance: Confiance, l: LigneTransaction): ImpactCompletude {
  // 1 · ce qui est prouvé hors flux de capital
  if (nature === 'revenu' || nature === 'operation-titre' || nature === 'conversion-devise') return 'aucun';
  if (nature === 'frais-impot' && confiance === 'confirme') return 'aucun';
  // 2 · un zéro ne déplace aucun dollar (fait arithmétique, pas une hypothèse)
  if (l.total === 0) return 'aucun';
  // 3 · un montant illisible : on ne peut rien borner
  if (l.total === null) return 'inconnu';
  // ⚠ PAS D'EXEMPTION POUR LES FLUX « FERMES » ICI. Une ligne lue SEULE ne peut
  // pas savoir si elle a été comptée : un « Dépôt » CELI sort `cotisation` /
  // `eleve` de cette fonction, et la règle 2 le rejette ensuite. L'exempter au
  // nom de sa confiance le rendait invisible ET inoffensif — le faux vert que
  // le lot précédent venait de supprimer. C'est à l'appelant, qui sait ce qui a
  // été agrégé, d'exclure les événements DÉJÀ comptés (ils deviennent des rôles
  // fiscaux) ; ce qui reste hors de tout agrégat bloque.
  //
  // 4 · le reste bloque, du côté que le signe désigne. Un virement interne non
  //     résolu menace les DEUX côtés : entrer dans un CELI depuis le compte du
  //     conjoint serait une cotisation, en sortir vers lui serait un retrait, et
  //     un transfert direct ne serait ni l'un ni l'autre — l'étape 4 tranche.
  if (nature === 'virement-interne') return 'peut-affecter-les-deux';
  return l.total > 0 ? 'peut-affecter-cotisation' : 'peut-affecter-retrait';
}

/**
 * Classe UNE ligne, lue seule.
 *
 * L'ordre des tests va de ce qu'on sait le mieux à ce qu'on sait le moins :
 * le libellé (s'il est inconnu, rien d'autre ne compte) ; la forme et le
 * montant (des faits) ; la note (une preuve, quand elle cite un compte — et
 * elle ne dépend pas du suffixe) ; le régime (une déduction du suffixe) enfin.
 */
export function classerLigne(l: LigneTransaction): LigneClassee {
  const regime = typeDeCompte(l.noCompte);
  const profil = sousTypeCompte(l.noCompte);
  const forme: LigneClassee['forme'] =
    !l.symbole?.trim() ? null : estEncaisse(l.symbole) ? 'argent' : 'titre';
  const base = {
    forme, regime,
    sousType: profil?.sousType ?? null,
    deviseCompte: profil?.devise ?? null,
    source: l,
  };
  const rendre = (nature: NatureFlux, confiance: Confiance, motif: string): LigneClassee =>
    ({ ...base, nature, confiance, motif, impactCompletude: impactDe(nature, confiance, l) });
  const libelle = (l.type ?? '').trim() || '(vide)';

  const famille = LIBELLES_CONNUS.get(normaliserLibelle(l.type));
  if (!famille) {
    return rendre('inconnu', 'inconnu',
      `libellé « ${libelle} » absent de la liste blanche — à mesurer, pas à deviner`);
  }

  // ⚠ LA NOTE PRIME, MÊME HORS FLUX — ajouté le 20 août 2026 après contre-
  // expertise adversariale. Les branches hors flux rendaient AVANT que la note
  // ne soit lue : un « Frais » de −25 000 $ dont la note citait un autre compte
  // sortait `frais-impot`/`confirme`, donc hors flux, donc INVISIBLE — sans
  // montant, sans ambiguïté, sans compteur. De l'argent quittait un CELI vers
  // un compte NOMMÉ, déclaré « taxe du service ». C'est le silence exact que ce
  // module existe pour supprimer, et la classe d'entrée est MESURÉE : la seule
  // ligne « Frais » à note citant des comptes de la base ne s'en sauvait que
  // par son signe positif — un hasard, pas une garde.
  //
  // On ne rend PAS `virement-interne` : une note de frais peut nommer le compte
  // FACTURÉ, et envoyer l'étape 4 chercher une seconde jambe inexistante serait
  // une autre invention. On rend `ambigu` — ce qui est douteux reste douteux.
  //
  // PÉRIMÈTRE : les libellés entrés PAR CE LOT. « Achat », « Vente » et
  // « Dividendes » gardent le comportement validé le 19 août ; les élargir
  // sortirait du périmètre (signalé comme risque résiduel).
  if (LIBELLES_NOTE_SENSIBLE.has(normaliserLibelle(l.type)) && estVirementInterne(l.note)) {
    return rendre('ambigu', 'ambigu',
      `${libelle} dont la NOTE cite un compte (règle 3) — un mouvement vers un compte nommé n’est pas un simple ${famille === 'frais-impot' ? 'frais' : 'événement sur titre'} : à trancher, jamais classé hors flux en silence`);
  }

  // ── Ce qui n'est pas un flux de capital — et ne dépend pas du régime ────────
  // Un achat est un achat dans un CELI comme dans une marge. On classe AVANT de
  // regarder le régime, pour qu'un compte au régime inconnu ne les rende pas
  // ambigus à tort. MAIS la forme compte : un « Achat » de 1USD n'est pas une
  // opération sur titre, c'est la façon la plus courante d'écrire une
  // conversion de devise — étape 3.
  if (famille === 'operation-titre') {
    if (forme === 'titre') return rendre('operation-titre', 'confirme', `${libelle} : une opération sur titre, pas un flux de capital`);
    if (forme === 'argent') {
      // LE MOTIF DOIT ÊTRE LE VRAI MOTIF : un « Achat »/« Vente » d'encaisse est
      // presque toujours une conversion de devise ; un « Remboursement » ou un
      // « Échange » en argent, non — ce serait un mouvement d'argent sous un
      // libellé d'opération sur titre, et c'est autre chose qu'on ignore.
      const conversionProbable = famille === 'operation-titre'
        && ['achat', 'vente'].includes(normaliserLibelle(l.type));
      return rendre('ambigu', 'ambigu', conversionProbable
        ? `${libelle} d’encaisse (${l.symbole.trim().toUpperCase()}) — conversion de devise probable, à rapprocher à l’étape 3`
        : `${libelle} EN ARGENT (${l.symbole.trim().toUpperCase()}) — ce libellé n’a été mesuré qu’en titres, sans mouvement d’encaisse : sous cette forme il est indécidable`);
    }
    return rendre('ambigu', 'ambigu', `${libelle} sans symbole — ni titre ni encaisse, forme illisible`);
  }
  if (famille === 'revenu') {
    if (forme === null) return rendre('ambigu', 'ambigu', `${libelle} sans symbole — forme illisible`);
    return rendre('revenu', 'confirme', `${libelle} : un revenu de placement, pas un flux de capital`);
  }
  // ── LES FRAIS ET LEURS TAXES (mesurés le 20 août 2026) ──────────────────────
  // Une SORTIE D'ARGENT qui n'est PAS un retrait du titulaire : elle ne recrée
  // aucun droit de cotisation. Le sens du montant fait partie de la preuve —
  // un « Frais » POSITIF est un remboursement ou une correction, pas des frais
  // (1 cas mesuré, dont la note citait deux comptes) : il reste ambigu.
  if (famille === 'frais-impot') {
    if (l.total === null) return rendre('ambigu', 'ambigu', `${libelle} au montant illisible`);
    if (forme === 'titre') return rendre('ambigu', 'ambigu', `${libelle} EN TITRES — des frais se paient en argent ; sous cette forme, indécidable`);
    if (forme === null) return rendre('ambigu', 'ambigu', `${libelle} sans symbole — forme illisible`);
    if (l.total > 0) return rendre('ambigu', 'ambigu', `${libelle} à montant POSITIF — remboursement de frais ou correction, pas des frais : à trancher`);
    if (l.total === 0) return rendre('ambigu', 'ambigu', `${libelle} à montant nul`);
    return rendre('frais-impot', 'confirme',
      `${libelle} : frais ou taxe du service — de l’argent sort du compte, mais ce n’est PAS un retrait du titulaire et aucun droit de cotisation n’est recréé`);
  }

  // ── Les flux : d'abord ce que la ligne seule sait dire ──────────────────────
  const total = l.total;
  if (total === null) return rendre('ambigu', 'ambigu', `${libelle} au montant illisible`);
  if (forme === null) return rendre('ambigu', 'ambigu', `${libelle} sans symbole — ni argent ni titre, la forme ne se lit pas`);

  // La NOTE prime sur le régime : un compte cité (règle 3, règle 5) est une
  // preuve qui ne dépend pas du suffixe. Valable pour un Transfert comme pour
  // une Cotisation ou un Retrait — `separerCotisations()` le dit déjà pour les
  // cotisations (« CONTRIBUTION REF: <compte> est un transfert malgré le mot »).
  // Que le compte cité soit du client ou d'une autre institution se vérifie au
  // LIVRE, pas à la ligne : c'est l'étape 4 qui confirme ou rétrograde.
  const noteCiteUnCompte = estVirementInterne(l.note);

  // ── Transfert / Réception — LA RÈGLE ABSOLUE : jamais une cotisation par défaut ──
  if (famille === 'transfert') {
    if (noteCiteUnCompte) {
      return rendre('virement-interne', 'eleve',
        'la note cite un compte (règle 3) — l’autre jambe sera cherchée à l’étape 4');
    }
    // Le motif suit le SIGNE : une sortie ne peut pas être une cotisation.
    const hypotheses = total > 0
      ? 'cotisation, transfert d’une autre institution ou conversion'
      : total < 0
        ? 'retrait, transfert vers une autre institution ou conversion'
        : 'montant nul';
    return rendre('ambigu', 'ambigu',
      `${libelle} sans contrepartie identifiée — ${hypotheses} : indécidable ligne seule`);
  }

  // ── Cotisation / Retrait — le vocabulaire suit le régime ────────────────────
  if (regime === null) {
    return rendre('ambigu', 'ambigu',
      `${libelle} sur un compte au régime non prouvé — ni cotisation ni apport ne peut être affirmé`);
  }
  const cotisable = REGIMES_COTISABLES.has(regime);
  const decaissement = REGIMES_DECAISSEMENT.has(regime);
  const capital = regime === 'non-enregistre';
  if (!cotisable && !decaissement && !capital) {
    // Le même défaut silencieux qu'on vient d'ôter aux libellés, appliqué aux
    // régimes : un régime connu du type (`corpo`) mais sans vocabulaire ici ne
    // tombe pas « en capital par défaut ». Il se déclare.
    return rendre('ambigu', 'ambigu',
      `${libelle} dans un régime « ${regime} » que cette classification ne sait pas encore nommer`);
  }

  if (famille === 'cotisation') {
    if (decaissement) {
      return rendre('ambigu', 'ambigu',
        `entrée dans un ${regime}, régime de décaissement — une transition (REER→FERR, CRI→FRV) ou un transfert, jamais une cotisation ; à rapprocher à l’étape 3`);
    }
    if (noteCiteUnCompte) {
      return rendre('virement-interne', 'eleve',
        'cotisation dont la note cite un compte d’origine (règle 5) — ce n’est pas de l’argent neuf ; l’autre jambe sera cherchée à l’étape 4');
    }
    const nature: NatureFlux = cotisable ? 'cotisation' : 'apport-capital';
    if (forme === 'titre') {
      // `separerCotisations()` exclut les jambes titre à total nul : on fait pareil.
      if (total === 0) return rendre('ambigu', 'ambigu', 'jambe titre à montant nul — ignorée par la règle 2');
      return rendre(nature, 'ambigu',
        `${cotisable ? 'cotisation' : 'apport'} EN TITRES (jambe titre de la partie double) — l’appariement de la règle 2 tranche à l’étape 3`);
    }
    if (total <= 0) {
      return rendre('ambigu', 'ambigu', 'cotisation en argent à montant non positif — renversement ou correction à rapprocher');
    }
    if (regime === 'reee' && NOTE_SUBVENTION_REEE.test(l.note ?? '')) {
      return rendre('cotisation', 'ambigu',
        'entrée REEE dont la note parle de subvention — si c’est la SCEE/IQEE, ce n’est pas une cotisation du client et ça ne consomme pas le plafond ; à mesurer');
    }
    // « Dépôt » et « Cotisation » sont deux libellés Croesus pour de l'argent qui
    // entre ; le premier n'a pas de partie double. Le motif garde le libellé
    // pour que la lecture reste traçable — deriver.ts:214 les compte tous deux
    // en REEE, deployment.ts:161 les distingue au PDF d'activité.
    return rendre(nature, 'eleve',
      cotisable
        ? `${libelle} en argent dans un ${regime} — provisoire : la règle 2 vérifie qu’aucune jambe titre ne l’apparie`
        : `${libelle} : apport de capital en argent dans un compte ${profil?.sousType ?? 'non enregistré'}`);
  }

  if (famille === 'retrait') {
  // Le miroir de la cotisation. Un FERR se RETIRE : c'est son objet.
  if (noteCiteUnCompte) {
    return rendre('virement-interne', 'eleve',
      'retrait dont la note cite un compte de destination (règle 3) — l’autre jambe sera cherchée à l’étape 4');
  }
  const nature: NatureFlux = capital ? 'retrait-capital' : 'retrait';
  if (forme === 'titre') {
    if (total === 0) return rendre('ambigu', 'ambigu', 'jambe titre à montant nul');
    return rendre(nature, 'ambigu',
      'retrait EN TITRES (jambe titre d’un retrait en nature) — l’appariement tranche à l’étape 3');
  }
  if (total >= 0) {
    return rendre('ambigu', 'ambigu', 'retrait en argent à montant non négatif — renversement ou correction à rapprocher');
  }
  return rendre(nature, 'eleve',
    capital
      ? `retrait de capital d’un compte ${profil?.sousType ?? 'non enregistré'}`
      : `retrait d’un ${regime}`);
  }

  // EXHAUSTIVITÉ : une famille ajoutée à la liste blanche sans sa branche ne
  // tombe pas dans le dernier `if` par gravité — le compilateur refuse.
  const _exhaustif: never = famille;
  return rendre('inconnu', 'inconnu', `famille « ${String(_exhaustif)} » sans branche de classification`);
}

// ─────────────────────────────────────────────────────────────────────────────
// LE DIAGNOSTIC — des agrégats, jamais une ligne.
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticClassification = {
  lues: number;
  parNature: Record<NatureFlux, number>;
  parConfiance: Record<Confiance, number>;
  /**
   * Les libellés Croesus rencontrés et refusés par la liste blanche, avec leur
   * fréquence, INDEXÉS PAR LIBELLÉ NORMALISÉ (« Échange » et « ECHANGE » sont
   * une seule clé, comme pour la liste blanche). Ce sont des LIBELLÉS, pas des
   * données client : ils peuvent s'afficher. C'est par eux que la liste grandit.
   *
   * GARDE-FOU : un collage décalé d'une colonne ferait atterrir une note ou un
   * numéro de compte dans la colonne « type ». Tout libellé qui n'a pas la forme
   * d'un mot — chiffres, ponctuation de compte, plus de 40 caractères — se
   * replie sous la seule clé `(libellé non textuel)`. Le diagnostic reste un
   * diagnostic, jamais un canal de fuite.
   */
  libellesInconnus: Record<string, number>;
  /** Combien de LIGNES portent un compte au régime non prouvé. Un nombre — jamais les numéros. */
  lignesSansRegime: number;
};

const NATURES: NatureFlux[] = [
  'cotisation', 'retrait', 'apport-capital', 'retrait-capital', 'virement-interne',
  'operation-titre', 'revenu', 'ambigu', 'inconnu',
  'conversion-devise', 'transfert-regime', 'frais-impot', 'annule',
];
const CONFIANCES: Confiance[] = ['confirme', 'eleve', 'ambigu', 'inconnu'];
const LIBELLE_TEXTUEL = /^[\p{L}\s'’.()/-]{1,40}$/u;
const CLE_NON_TEXTUEL = '(libellé non textuel)';

/**
 * LA CLÉ D'AFFICHAGE D'UN LIBELLÉ INCONNU — la SEULE façon d'exposer un
 * libellé hors liste blanche. Exportée le 19 août (contre-expertise de la
 * ligne du temps) : une seconde implémentation du comptage, sans cette garde,
 * laissait un collage décalé faire entrer un numéro de compte ou un nom dans
 * les diagnostics. Tout compteur de libellés inconnus passe PAR ICI.
 */
export function cleLibelleInconnu(type: string | null | undefined): string {
  const brut = (type ?? '').trim();
  return brut === '' ? '(vide)' : LIBELLE_TEXTUEL.test(brut) ? normaliserLibelle(brut) : CLE_NON_TEXTUEL;
}

/**
 * Classe toutes les lignes et compte. N'imprime rien : rend une structure que
 * l'appelant affiche — en comptages seulement, par doctrine.
 */
export function diagnostiquerClassification(lignes: LigneTransaction[]): DiagnosticClassification {
  const parNature = Object.fromEntries(NATURES.map((n) => [n, 0])) as Record<NatureFlux, number>;
  const parConfiance = Object.fromEntries(CONFIANCES.map((c) => [c, 0])) as Record<Confiance, number>;
  const libellesInconnus: Record<string, number> = {};
  let lignesSansRegime = 0;

  for (const l of lignes) {
    const c = classerLigne(l);
    parNature[c.nature]++;
    parConfiance[c.confiance]++;
    if (c.nature === 'inconnu') {
      const brut = (l.type ?? '').trim();
      const cle = cleLibelleInconnu(brut);
      libellesInconnus[cle] = (libellesInconnus[cle] ?? 0) + 1;
    }
    if (c.regime === null) lignesSansRegime++;
  }
  return { lues: lignes.length, parNature, parConfiance, libellesInconnus, lignesSansRegime };
}
