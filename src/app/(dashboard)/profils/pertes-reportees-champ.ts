// LE CHAMP « PERTES EN CAPITAL INUTILISÉES / REPORTÉES » — sa logique, pure.
//
// POURQUOI UN `.ts` À CÔTÉ DU `.tsx` : la suite de tests tourne en environnement
// Node, sans DOM (voir `vitest.config.ts`). La règle du dépôt est que la logique
// vit dans un module pur et que le composant ne fait que l'habiller. Ce fichier
// est donc l'endroit où les décisions se prennent — et le seul qu'il faille
// tester pour savoir ce que l'écran produira.
//
// CE QUE CE MODULE REFUSE DE FAIRE, et c'est l'essentiel :
//
//   · DEVINER UNE UNITÉ. Choisir « avis de cotisation » comme source n'implique
//     PAS que le montant soit une perte nette. C'est probable ; ce n'est pas
//     prouvé. Une inférence probable écrite dans un champ devient, trois écrans
//     plus loin, un fait — et le moteur chiffrerait sur une supposition.
//   · TRANSFORMER UN VIDE EN ZÉRO. « Je n'ai pas répondu » et « il n'y a rien »
//     sont deux réponses différentes, et une seule des deux autorise un constat.
//   · CORRIGER EN SILENCE. Une saisie invalide est refusée et dite, jamais
//     ramenée à une valeur plausible.
import type {
  PertesCapitalReportees, UnitePertesCapital, SourcePertesCapital,
} from '@/lib/profils/types';

// ─────────────────────────────────────────────────────────────────────────────
// Les libellés — ce que le conseiller lit, jamais les valeurs techniques
// ─────────────────────────────────────────────────────────────────────────────

export type OptionUnite = {
  valeur: UnitePertesCapital;
  libelle: string;
  aide: string;
  /** Une option AVANCÉE ne se choisit pas par défaut ni par inadvertance (§12). */
  avancee?: boolean;
};

/**
 * L'ORDRE COMPTE. « Je ne sais pas » vient EN PREMIER parce que c'est l'état de
 * départ honnête d'un dossier qu'on ouvre, et que le rendre facile à choisir est
 * le meilleur moyen d'éviter qu'on qualifie au hasard pour faire disparaître un
 * avertissement. « Montant déjà normalisé » vient en dernier, replié : il
 * affirme qu'un humain a déjà fait le travail de conversion, et cette
 * affirmation-là doit coûter un geste.
 */
export const OPTIONS_UNITE: OptionUnite[] = [
  {
    valeur: 'inconnue',
    libelle: 'Je ne sais pas / à confirmer',
    aide: 'Le montant est conservé au dossier, mais le moteur ne le chiffrera pas tant que son type n’est pas établi.',
  },
  {
    valeur: 'perte-capital-brute',
    libelle: 'Perte en capital brute',
    aide: 'Le montant de la perte AVANT le taux d’inclusion — la même échelle que les ventes rapportées par le relevé.',
  },
  {
    valeur: 'perte-nette-capital-fiscale',
    libelle: 'Perte nette en capital fiscale',
    aide: 'La « perte en capital nette » de l’avis de cotisation, DÉJÀ au taux d’inclusion.',
  },
  {
    valeur: 'montant-normalise-utilisable',
    libelle: 'Montant déjà normalisé pour le calcul',
    aide: 'À ne choisir que si quelqu’un a établi que ce nombre est déjà dans l’unité attendue par le moteur.',
    avancee: true,
  },
];

export const OPTIONS_SOURCE: Array<{ valeur: SourcePertesCapital; libelle: string }> = [
  { valeur: 'inconnue', libelle: 'Source inconnue' },
  { valeur: 'avis-cotisation', libelle: 'Avis de cotisation' },
  { valeur: 'avis-recotisation', libelle: 'Avis de nouvelle cotisation' },
  { valeur: 'saisie-manuelle', libelle: 'Saisie ou calcul manuel' },
  { valeur: 'autre', libelle: 'Autre document' },
];

/** L'aide du champ principal — elle explique, elle ne demande pas de convertir. */
export const AIDE_PRINCIPALE =
  'Indiquez le montant tel qu’il apparaît dans votre source, sans le convertir. ' +
  'Précisez ensuite son type : c’est lui qui permet au moteur de savoir s’il peut ' +
  'entrer directement dans le calcul.';

/**
 * L'AIDE DE LA SOURCE — elle invite à vérifier, elle ne conclut pas (§11).
 *
 * Un avis de cotisation rapporte le plus souvent une perte NETTE. « Le plus
 * souvent » n'est pas « toujours », et l'écart tient dans le libellé exact de la
 * ligne recopiée. On dit donc au conseiller où regarder, et on le laisse
 * trancher — c'est lui qui a le document sous les yeux.
 */
export const AIDE_SOURCE =
  'Si vous recopiez un montant de l’avis de cotisation, vérifiez le libellé exact ' +
  'de la ligne avant de choisir le type : la source ne détermine pas le type.';

export function libelleUnite(u: UnitePertesCapital): string {
  return OPTIONS_UNITE.find((o) => o.valeur === u)?.libelle ?? u;
}

export function libelleSource(s: SourcePertesCapital): string {
  return OPTIONS_SOURCE.find((o) => o.valeur === s)?.libelle ?? s;
}

// ─────────────────────────────────────────────────────────────────────────────
// La lecture — ce que l'écran affiche à l'ouverture
// ─────────────────────────────────────────────────────────────────────────────

const VIERGE: PertesCapitalReportees = {
  montant: null, unite: 'inconnue', source: 'inconnue', dateDonnee: null,
};

const UNITES = new Set<string>(OPTIONS_UNITE.map((o) => o.valeur));
const SOURCES = new Set<string>(OPTIONS_SOURCE.map((o) => o.valeur));

/**
 * CE QUE L'ÉCRAN AFFICHE POUR UN PROFIL DONNÉ — y compris un profil ancien.
 *
 * Un dossier écrit avant le modèle qualifié arrive ici sous la forme
 * `{ montant, dateDonnee }`, parfois même en nombre nu. Le montant est affiché
 * TEL QUEL — c'est une donnée réelle, entrée par un humain, et la vider serait
 * une perte sèche. Mais l'unité affichée reste « à confirmer », et aucune option
 * n'est présélectionnée : l'écran ne sait pas ce que ce nombre veut dire, et il
 * ne fait pas semblant de le savoir.
 *
 * (Le stockage normalise déjà à la lecture ; cette fonction tient quand même
 * face au brut, parce qu'elle reçoit ce que l'API renvoie et non le profil.)
 */
export function lireDepuisFiche(brut: unknown): PertesCapitalReportees {
  if (brut === null || brut === undefined) return { ...VIERGE };
  if (typeof brut === 'number') {
    return Number.isFinite(brut)
      ? { montant: brut, unite: 'inconnue', source: 'inconnue', dateDonnee: null }
      : { ...VIERGE };
  }
  if (typeof brut !== 'object' || Array.isArray(brut)) return { ...VIERGE };

  const o = brut as Record<string, unknown>;
  return {
    montant: typeof o.montant === 'number' && Number.isFinite(o.montant) ? o.montant : null,
    unite: typeof o.unite === 'string' && UNITES.has(o.unite)
      ? (o.unite as UnitePertesCapital) : 'inconnue',
    source: typeof o.source === 'string' && SOURCES.has(o.source)
      ? (o.source as SourcePertesCapital) : 'inconnue',
    dateDonnee: typeof o.dateDonnee === 'string' && o.dateDonnee !== '' ? o.dateDonnee : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La saisie du montant
// ─────────────────────────────────────────────────────────────────────────────

export type LectureMontant =
  | { ok: true; montant: number | null }
  | { ok: false; motif: string };

/**
 * LE TEXTE TAPÉ → UN MONTANT, OU UN REFUS DIT.
 *
 * Trois issues, jamais deux :
 *   · vide      → `null`. « Pas répondu », qui n'est pas « zéro » (§9).
 *   · valide    → le nombre, zéro compris. Un zéro EXPLICITE est une réponse.
 *   · invalide  → un refus AVEC SON MOTIF. Jamais un repli sur 0, jamais un
 *                 silence : l'ancien champ ignorait purement une saisie
 *                 illisible, et le conseiller croyait avoir enregistré.
 *
 * LE NÉGATIF EST REFUSÉ : le modèle porte l'AMPLEUR d'une perte, et le moteur
 * l'ajoute aux pertes disponibles. Un « −5 000 » saisi par réflexe comptable
 * viendrait RETRANCHER cinq mille dollars de capacité d'absorption — un chiffre
 * faux dans la direction la plus coûteuse.
 */
export function analyserMontantSaisi(texte: string): LectureMontant {
  const t = texte.replace(/[\s  $]/g, '').replace(',', '.');
  if (t === '') return { ok: true, montant: null };

  // `Number.parseFloat` lit « 12abc » comme 12 : on exige la forme entière.
  if (!/^[-+]?\d*\.?\d+$/.test(t)) {
    return { ok: false, motif: 'Entrez un montant en chiffres, sans texte.' };
  }
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) {
    return { ok: false, motif: 'Ce montant n’est pas un nombre lisible.' };
  }
  if (n < 0) {
    return {
      ok: false,
      motif: 'Entrez l’ampleur de la perte, sans signe négatif — par exemple 10 000 pour une perte de 10 000 $.',
    };
  }
  return { ok: true, montant: n };
}

export type LectureDate =
  | { ok: true; date: string | null }
  | { ok: false; motif: string };

/**
 * LA DATE DU DOCUMENT — capturée, jamais jugée (§6).
 *
 * Aucune règle de péremption ici : « plus vieux que douze mois » est une
 * question de MATÉRIALITÉ, qui dépend de la stratégie qui lira la donnée, pas du
 * champ qui la reçoit. L'écran constate, la stratégie décidera.
 */
export function analyserDateSaisie(texte: string): LectureDate {
  const t = texte.trim();
  if (t === '') return { ok: true, date: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return { ok: false, motif: 'Date attendue au format AAAA-MM-JJ.' };
  }
  const d = new Date(`${t}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) {
    return { ok: false, motif: 'Cette date n’existe pas.' };
  }
  return { ok: true, date: t };
}

// ─────────────────────────────────────────────────────────────────────────────
// La fusion — une dimension à la fois, aucune contagion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * APPLIQUE UN SEUL CHANGEMENT, ET RIEN D'AUTRE.
 *
 * C'est ici que se joue l'interdiction d'inférence (§11) : changer la source
 * ne touche pas à l'unité, changer l'unité ne touche pas à la source, et changer
 * le montant ne touche à aucune des deux. Chaque dimension est une réponse
 * distincte du conseiller.
 *
 * SEULE EXCEPTION, et elle va dans le sens de la prudence : effacer le montant
 * remet l'unité, la source et la date à leur état vierge. Laisser « perte
 * brute · avis de cotisation · 2026-03-11 » accroché à un montant absent
 * décrirait un document qui n'est plus au dossier — et la prochaine saisie
 * hériterait d'une qualification qui ne la concerne pas.
 */
export function fusionner(
  courant: PertesCapitalReportees,
  changement: Partial<PertesCapitalReportees>
): PertesCapitalReportees {
  const suivant: PertesCapitalReportees = { ...courant, ...changement };
  if (suivant.montant === null) return { ...VIERGE };
  return suivant;
}

/**
 * LE CORPS ENVOYÉ À L'API — toujours la forme complète (§13).
 *
 * Jamais `pertesCapitalReportees: 10000`. Le nombre nu est la forme que ce lot
 * existe pour faire disparaître : l'API l'accepte encore, pour les anciens
 * appels, mais l'écran neuf ne doit plus jamais la produire.
 */
export function corpsPourApi(s: PertesCapitalReportees): PertesCapitalReportees {
  return {
    montant: s.montant,
    unite: s.unite,
    source: s.source,
    dateDonnee: s.dateDonnee,
  };
}

/**
 * CE QUE LE CHAMP DIT DE LUI-MÊME, sous la saisie.
 *
 * Le conseiller doit voir SANS CLIQUER si ce qu'il vient d'entrer servira. Un
 * montant qualifié « à confirmer » n'est pas une erreur — c'est un état légitime
 * et fréquent —, mais le taire ferait croire que le dossier est complet.
 */
export function etatLisible(s: PertesCapitalReportees): {
  chiffrable: boolean; phrase: string;
} {
  if (s.montant === null) {
    return { chiffrable: false, phrase: 'Aucun montant au dossier.' };
  }
  if (s.montant === 0) {
    return { chiffrable: true, phrase: 'Aucune perte reportée — réponse enregistrée.' };
  }
  if (s.unite === 'inconnue') {
    return {
      chiffrable: false,
      phrase: 'Montant conservé, mais son type reste à confirmer : le moteur ne le chiffrera pas.',
    };
  }
  if (s.unite === 'perte-nette-capital-fiscale') {
    return {
      chiffrable: false,
      phrase: 'Montant NET : le moteur compare des montants bruts et ne convertit pas. Le montant brut reste à établir.',
    };
  }
  return { chiffrable: true, phrase: 'Type établi : ce montant peut entrer dans le calcul.' };
}
