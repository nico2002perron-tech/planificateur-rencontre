// L'IDENTIFIANT DE COMPTE — une seule forme pour comparer, la forme d'origine
// pour lire.
//
// Un même compte s'écrit de deux façons dans Croesus : « 6A-AZCI-0 » dans la
// colonne du numéro de compte, « 6AAZCI0 » dans les notes. Une reconnaissance
// qui exigeait les tirets a laissé passer un transfert de 22 273 $ sur un
// client témoin, et affiché un total de cotisations CELI faux de 38 %.
//
// RÈGLE GÉNÉRALE (dictée le 4 août 2026) : toute comparaison d'identifiants de
// comptes passe par `canoniserCompte`. Jamais deux chaînes brutes.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI A ÉTÉ MESURÉ, et qui justifie chaque constante de ce fichier.
// Source : le livre complet, 1 072 383 lignes, 3 325 comptes distincts.
//
//   · la colonne du numéro de compte porte TOUJOURS des tirets : « PP-MMMM-S »
//   · le bloc du milieu fait 4 caractères sur 3 316 des 3 325 comptes ; les
//     9 restants sont un format aberrant « ~E-0024I-0 » (bloc de 5)
//   · dans les notes, les jetons de 7 caractères filtrés par préfixe connu :
//       31 750 occurrences correspondent à un compte du livre,
//       48 623 à un compte ABSENT du livre — les comptes externes,
//      140 294 sont rejetées, et ce sont toutes des mots : ARTICLE, SALAIRE,
//              RETRAIT, MALBAIE, DOLBEAU, PAYMENT, COMINAR, FORTIER…
//
// C'est cette dernière mesure qui autorise à relâcher la reconnaissance : le
// préfixe seul sépare proprement les comptes du texte français.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La forme canonique : tirets, espaces (y compris insécables et fines) et
 * casse retirés.
 *
 * Sert UNIQUEMENT à comparer et à indexer. Ce qu'on montre au planificateur
 * reste la forme d'origine, qui est celle de ses écrans Croesus.
 */
export function canoniserCompte(id: string | null | undefined): string {
  // 00a0 espace insecable, 202f espace fine, 2007 espace chiffre : les
  // trois sortent d'Excel et de toLocaleString('fr-CA'), et les deux dernieres
  // ont deja casse des egalites de chaines ailleurs dans ce projet.
  return (id ?? '').replace(/[-\s   .]/g, '').toUpperCase();
}

/**
 * Deux écritures désignent-elles le même compte ?
 *
 * Une chaîne vide n'égale rien, pas même une autre chaîne vide : deux comptes
 * inconnus ne sont pas le même compte.
 */
export function memeCompte(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canoniserCompte(a);
  return ca !== '' && ca === canoniserCompte(b);
}

/**
 * Les 13 préfixes réellement observés dans le livre, avec leur nombre de
 * comptes distincts. Une liste MESURÉE, pas devinée — c'est elle qui rejette
 * les 140 294 mots français qui font 7 caractères.
 *
 *   37 → 2810   4A → 286   6A → 66   5A → 45   00 → 37   36 → 23   34 → 21
 *   6D →    9   ~E →   9   5M →  8   6M →  6   6C →  4   69 →  1
 *
 * Une écriture dont le préfixe est absent d'ici n'est PAS reconnue comme un
 * compte. Le jour où un nouveau préfixe apparaît, la reconnaissance le manque
 * plutôt que d'inventer — c'est le bon côté sur lequel se tromper, et
 * `prefixesInconnus` ci-dessous permet de le détecter.
 */
export const PREFIXES_CONNUS: ReadonlySet<string> = new Set([
  '37', '4A', '6A', '5A', '00', '36', '34', '6D', '~E', '5M', '6M', '6C', '69',
]);

/** La forme tiretée telle que Croesus l'écrit dans la colonne du compte. */
const FORME_TIRETEE = /^([0-9A-Z~]{2})-([0-9A-Z]+)-([0-9A-Z])$/i;

/**
 * La forme canonique d'un compte normal : 2 + 4 + 1 = 7 caractères.
 * Le bloc de 4 est mesuré, pas supposé (3 316 comptes sur 3 325).
 */
const FORME_CANONIQUE = /^([0-9A-Z~]{2})([0-9A-Z]{4})([0-9A-Z])$/i;

export type CompteDecompose = {
  /** Les deux premiers caractères — « 37 », « 4A »… */
  prefixe: string;
  /** Le bloc du milieu. Chez VMBL, son DERNIER caractère porte le régime. */
  milieu: string;
  /** Le dernier caractère. Chez iA, c'est lui qui porte le régime. */
  suffixe: string;
  canonique: string;
  /** Vrai pour un vieux numéro VMBL : préfixe « chiffre + lettre ». */
  vmbl: boolean;
};

/**
 * Décompose un identifiant, quelle que soit son écriture.
 *
 * Deux chemins, dans cet ordre :
 *   1. si les TIRETS sont là, ils font foi — le bloc du milieu est délimité
 *      explicitement, quelle que soit sa longueur. C'est ce qui préserve le
 *      format aberrant « ~E-0024I-0 » et tout format futur ;
 *   2. sinon, la forme canonique doit faire exactement 7 caractères et porter
 *      un préfixe connu. On refuse tout le reste plutôt que de découper au
 *      hasard une chaîne qui n'est peut-être pas un compte.
 *
 * Rend `null` quand ce n'est pas un identifiant reconnaissable.
 */
export function decomposerCompte(id: string | null | undefined): CompteDecompose | null {
  const brut = (id ?? '').trim();
  if (!brut) return null;

  const tiretee = FORME_TIRETEE.exec(brut);
  if (tiretee) {
    return construire(tiretee[1], tiretee[2], tiretee[3]);
  }

  const canonique = canoniserCompte(brut);
  const plate = FORME_CANONIQUE.exec(canonique);
  if (plate && PREFIXES_CONNUS.has(plate[1].toUpperCase())) {
    return construire(plate[1], plate[2], plate[3]);
  }
  return null;
}

function construire(prefixe: string, milieu: string, suffixe: string): CompteDecompose {
  const p = prefixe.toUpperCase();
  return {
    prefixe: p,
    milieu: milieu.toUpperCase(),
    suffixe: suffixe.toUpperCase(),
    canonique: p + milieu.toUpperCase() + suffixe.toUpperCase(),
    // VMBL = chiffre puis lettre (« 4A », « 6C »). iA et consorts sont deux
    // chiffres (« 37 », « 00 »). Le format « ~E » n'est ni l'un ni l'autre.
    vmbl: /^[0-9][A-Z]$/.test(p),
  };
}

/**
 * Les identifiants de comptes cités dans un texte libre — typiquement la note
 * d'une transaction : « CONTRIBUTION REF: 6AAZCI0 29326 ».
 *
 * Rend les formes D'ORIGINE, dans l'ordre d'apparition, sans doublon canonique.
 * Reconnaît les deux écritures ; le préfixe mesuré fait le tri avec le texte.
 */
export function comptesCitesDansTexte(texte: string | null | undefined): string[] {
  const t = texte ?? '';
  if (!t) return [];
  const trouves: string[] = [];
  const vus = new Set<string>();

  const ajouter = (candidat: string) => {
    const d = decomposerCompte(candidat);
    if (!d || !PREFIXES_CONNUS.has(d.prefixe)) return;
    if (vus.has(d.canonique)) return;
    vus.add(d.canonique);
    trouves.push(candidat);
  };

  // La forme tiretée d'abord : elle est plus spécifique, et ses tirets la
  // rendraient invisible à la seconde passe (qui s'arrête aux frontières de mot).
  for (const m of t.matchAll(/\b[0-9A-Z~]{2}-[0-9A-Z]{3,5}-[0-9A-Z]\b/gi)) ajouter(m[0]);
  for (const m of t.matchAll(/\b[0-9A-Z]{7}\b/g)) ajouter(m[0]);

  return trouves;
}

/**
 * Le premier compte cité dans un texte, ou `null`.
 * C'est la question que pose la règle 5 : « cette note nomme-t-elle un compte ? »
 */
export function compteCiteDansTexte(texte: string | null | undefined): string | null {
  return comptesCitesDansTexte(texte)[0] ?? null;
}

/**
 * Les préfixes inconnus rencontrés dans une liste de numéros de comptes.
 *
 * Le filet de sécurité de `PREFIXES_CONNUS` : si le jour vient où iA émet un
 * préfixe neuf, cette fonction le montre au lieu de laisser la reconnaissance
 * se dégrader en silence.
 */
export function prefixesInconnus(numeros: Iterable<string>): string[] {
  const inconnus = new Set<string>();
  for (const n of numeros) {
    const m = FORME_TIRETEE.exec((n ?? '').trim());
    const p = m ? m[1].toUpperCase() : canoniserCompte(n).slice(0, 2);
    if (p && !PREFIXES_CONNUS.has(p)) inconnus.add(p);
  }
  return [...inconnus].sort();
}
