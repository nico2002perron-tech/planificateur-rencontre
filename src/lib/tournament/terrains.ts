/**
 * Les TERRAINS : leur nom, leur dessin, et l'horaire propre à chacun.
 *
 * Deux terrains ne se condensent pas en une seule liste : chacun garde son
 * propre fil d'heures. Les deux fils partagent la MÊME échelle d'heures, si
 * bien qu'un terrain sans partie à 10h30 montre un trou (« Libre ») aligné
 * avec la partie qui se joue au même moment sur l'autre terrain.
 *
 * Ce module est PUR (aucune I/O, aucun React) et sert de source unique aux
 * quatre surfaces : console organisateur, page publique, mode TV, feuille PDF.
 * La géométrie des terrains y est décrite en primitives neutres (rectangles,
 * lignes, cercles, chemins) pour être rendue à l'identique en SVG dans le
 * navigateur et en @react-pdf/renderer dans la feuille imprimable.
 */

// ── Sports ───────────────────────────────────────────────────────────────────

export type SportId =
  | 'balle-molle'
  | 'volleyball'
  | 'pickleball'
  | 'tennis'
  | 'basketball'
  | 'soccer'
  | 'generique';

export interface SportDef {
  id: SportId;
  /** Nom affiché dans le sélecteur de la console. */
  label: string;
  /** Ce que montre le schéma, en une ligne (aide au choix). */
  apercu: string;
}

export const SPORTS: SportDef[] = [
  { id: 'balle-molle', label: 'Balle molle', apercu: 'Losange, buts et monticule' },
  { id: 'volleyball', label: 'Volleyball', apercu: 'Filet au centre, lignes d’attaque' },
  { id: 'pickleball', label: 'Pickleball', apercu: 'Filet, zone de non-volée' },
  { id: 'tennis', label: 'Tennis', apercu: 'Filet, carrés de service, couloirs' },
  { id: 'basketball', label: 'Basketball', apercu: 'Ligne du centre, clés et paniers' },
  { id: 'soccer', label: 'Soccer', apercu: 'Ligne du centre, surfaces de réparation' },
  { id: 'generique', label: 'Terrain générique', apercu: 'Rectangle neutre, ligne du milieu' },
];

export const SPORT_PAR_DEFAUT: SportId = 'balle-molle';

/** Accepte n'importe quelle valeur venue de la base et retombe sur le défaut. */
export function normaliserSport(valeur: unknown): SportId {
  return SPORTS.some(s => s.id === valeur) ? (valeur as SportId) : SPORT_PAR_DEFAUT;
}

export function libelleSport(sport: SportId): string {
  return SPORTS.find(s => s.id === sport)?.label ?? '';
}

// ── Nom des terrains : 1 → A, 2 → B … ────────────────────────────────────────

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Lettre du terrain (« A », « B »…). Au-delà de 26 terrains : le numéro. */
export function libelleTerrain(court: number): string {
  const n = Math.floor(court);
  return n >= 1 && n <= LETTRES.length ? LETTRES[n - 1] : String(n);
}

/** Nom complet prêt à afficher (« Terrain A »). */
export function nomTerrain(court: number): string {
  return `Terrain ${libelleTerrain(court)}`;
}

// ── Couleur d'identité d'un terrain ──────────────────────────────────────────

/**
 * Chaque terrain a SA couleur, la même partout (console, public, TV, PDF) :
 * c'est ce qui empêche l'œil de re-mélanger les deux horaires.
 */
export interface AccentTerrain {
  /** Trait et pastilles. */
  base: string;
  /** Texte sur fond pâle (contraste suffisant). */
  fonce: string;
  /** Fond très pâle : surface du schéma, en-tête de colonne. */
  pale: string;
}

const ACCENTS: AccentTerrain[] = [
  { base: '#1CB0F6', fonce: '#0b6a97', pale: '#eaf7fe' }, // A — bleu
  { base: '#FF9600', fonce: '#a35f00', pale: '#fff4e5' }, // B — orange
  { base: '#58CC02', fonce: '#356f06', pale: '#f0fbe6' }, // C — vert
  { base: '#A560F0', fonce: '#6b31ad', pale: '#f6effe' }, // D — violet
];

export function accentTerrain(court: number): AccentTerrain {
  const n = Math.max(1, Math.floor(court) || 1);
  return ACCENTS[(n - 1) % ACCENTS.length];
}

// ── Géométrie des terrains ───────────────────────────────────────────────────

/**
 * Rôle visuel d'une forme — la couleur exacte appartient à la surface qui rend
 * (fond pâle sur le web clair, encre sobre dans le PDF, contraste élevé à la TV).
 */
export type RoleForme =
  /** La surface de jeu elle-même (gazon, plancher). */
  | 'surface'
  /** Une zone repérable à l'intérieur : avant-champ, clé, zone de non-volée. */
  | 'zone'
  /** Un simple trait peint sur le sol. */
  | 'trait'
  /** Le filet (ou la ligne du centre marquée) — trait appuyé. */
  | 'filet'
  /** Un objet plein : but, panier, monticule. */
  | 'objet';

export type Forme =
  | { forme: 'rect'; role: RoleForme; x: number; y: number; l: number; h: number; r?: number }
  | { forme: 'ligne'; role: RoleForme; x1: number; y1: number; x2: number; y2: number; tirets?: boolean }
  | { forme: 'cercle'; role: RoleForme; cx: number; cy: number; r: number }
  | { forme: 'chemin'; role: RoleForme; d: string };

export interface SchemaTerrain {
  /** Toutes les coordonnées vivent dans cette boîte (ratio ~1,6:1). */
  largeur: number;
  hauteur: number;
  formes: Forme[];
}

export const SCHEMA_LARGEUR = 100;
export const SCHEMA_HAUTEUR = 62;

// Terrain rectangulaire commun (volley/pickleball/tennis/basket/soccer/générique)
const RECT = { x: 8, y: 7, l: 84, h: 48 };
const MILIEU = RECT.x + RECT.l / 2; // 50

function surfaceRect(): Forme[] {
  return [{ forme: 'rect', role: 'surface', x: RECT.x, y: RECT.y, l: RECT.l, h: RECT.h, r: 2 }];
}

function ligneMilieu(role: RoleForme = 'filet', tirets = false): Forme {
  return { forme: 'ligne', role, x1: MILIEU, y1: RECT.y, x2: MILIEU, y2: RECT.y + RECT.h, tirets };
}

const SCHEMAS: Record<SportId, Forme[]> = {
  // Losange de balle molle : marbre en bas, lignes de démarcation à 45° qui
  // passent exactement par le 1er et le 3e but, champ extérieur en éventail.
  'balle-molle': [
    { forme: 'chemin', role: 'surface', d: 'M 50 57 L 9 16 A 75 75 0 0 1 91 16 Z' },
    // Avant-champ : le losange marbre → 1er → 2e → 3e
    { forme: 'chemin', role: 'zone', d: 'M 50 57 L 65.6 41.4 L 50 25.8 L 34.4 41.4 Z' },
    // Monticule du lanceur
    { forme: 'cercle', role: 'objet', cx: 50, cy: 41.4, r: 4 },
    // Buts : 1er, 2e, 3e
    { forme: 'rect', role: 'objet', x: 63.6, y: 39.4, l: 4, h: 4 },
    { forme: 'rect', role: 'objet', x: 48, y: 23.8, l: 4, h: 4 },
    { forme: 'rect', role: 'objet', x: 32.4, y: 39.4, l: 4, h: 4 },
    // Marbre
    { forme: 'chemin', role: 'objet', d: 'M 47 54.6 L 53 54.6 L 53 57 L 50 59.6 L 47 57 Z' },
  ],
  // Volleyball : filet au centre, lignes d'attaque à 3 m de part et d'autre.
  volleyball: [
    ...surfaceRect(),
    { forme: 'ligne', role: 'trait', x1: MILIEU - 14, y1: RECT.y, x2: MILIEU - 14, y2: RECT.y + RECT.h },
    { forme: 'ligne', role: 'trait', x1: MILIEU + 14, y1: RECT.y, x2: MILIEU + 14, y2: RECT.y + RECT.h },
    ligneMilieu('filet', true),
  ],
  // Pickleball : zone de non-volée (cuisine) de chaque côté + carrés de service.
  pickleball: [
    ...surfaceRect(),
    { forme: 'rect', role: 'zone', x: MILIEU - 9, y: RECT.y, l: 9, h: RECT.h },
    { forme: 'rect', role: 'zone', x: MILIEU, y: RECT.y, l: 9, h: RECT.h },
    { forme: 'ligne', role: 'trait', x1: RECT.x, y1: RECT.y + RECT.h / 2, x2: MILIEU - 9, y2: RECT.y + RECT.h / 2 },
    { forme: 'ligne', role: 'trait', x1: MILIEU + 9, y1: RECT.y + RECT.h / 2, x2: RECT.x + RECT.l, y2: RECT.y + RECT.h / 2 },
    ligneMilieu('filet', true),
  ],
  // Tennis : couloirs de double, carrés de service, filet.
  tennis: [
    ...surfaceRect(),
    { forme: 'ligne', role: 'trait', x1: RECT.x, y1: RECT.y + 6, x2: RECT.x + RECT.l, y2: RECT.y + 6 },
    { forme: 'ligne', role: 'trait', x1: RECT.x, y1: RECT.y + RECT.h - 6, x2: RECT.x + RECT.l, y2: RECT.y + RECT.h - 6 },
    { forme: 'ligne', role: 'trait', x1: MILIEU - 17, y1: RECT.y + 6, x2: MILIEU - 17, y2: RECT.y + RECT.h - 6 },
    { forme: 'ligne', role: 'trait', x1: MILIEU + 17, y1: RECT.y + 6, x2: MILIEU + 17, y2: RECT.y + RECT.h - 6 },
    { forme: 'ligne', role: 'trait', x1: MILIEU - 17, y1: RECT.y + RECT.h / 2, x2: MILIEU + 17, y2: RECT.y + RECT.h / 2 },
    ligneMilieu('filet', true),
  ],
  // Basketball : ligne du centre, cercle central, clés et paniers.
  basketball: [
    ...surfaceRect(),
    { forme: 'rect', role: 'zone', x: RECT.x, y: RECT.y + 14, l: 16, h: RECT.h - 28 },
    { forme: 'rect', role: 'zone', x: RECT.x + RECT.l - 16, y: RECT.y + 14, l: 16, h: RECT.h - 28 },
    { forme: 'cercle', role: 'objet', cx: RECT.x + 4, cy: RECT.y + RECT.h / 2, r: 2 },
    { forme: 'cercle', role: 'objet', cx: RECT.x + RECT.l - 4, cy: RECT.y + RECT.h / 2, r: 2 },
    { forme: 'cercle', role: 'trait', cx: MILIEU, cy: RECT.y + RECT.h / 2, r: 7 },
    ligneMilieu('filet'),
  ],
  // Soccer : ligne du centre, rond central, surfaces de réparation et buts.
  soccer: [
    ...surfaceRect(),
    { forme: 'rect', role: 'zone', x: RECT.x, y: RECT.y + 12, l: 13, h: RECT.h - 24 },
    { forme: 'rect', role: 'zone', x: RECT.x + RECT.l - 13, y: RECT.y + 12, l: 13, h: RECT.h - 24 },
    { forme: 'rect', role: 'objet', x: RECT.x - 3, y: RECT.y + RECT.h / 2 - 5, l: 3, h: 10 },
    { forme: 'rect', role: 'objet', x: RECT.x + RECT.l, y: RECT.y + RECT.h / 2 - 5, l: 3, h: 10 },
    { forme: 'cercle', role: 'trait', cx: MILIEU, cy: RECT.y + RECT.h / 2, r: 8 },
    ligneMilieu('filet'),
  ],
  // Générique : le strict nécessaire, aucune fausse ligne.
  generique: [...surfaceRect(), ligneMilieu('trait', true)],
};

/** Le dessin du terrain pour un sport, en coordonnées normalisées. */
export function schemaTerrain(sport: SportId): SchemaTerrain {
  return {
    largeur: SCHEMA_LARGEUR,
    hauteur: SCHEMA_HAUTEUR,
    formes: SCHEMAS[normaliserSport(sport)],
  };
}

// ── Grille horaire : une colonne par terrain, heures alignées ────────────────

/** Ce qu'il faut savoir d'une partie pour la placer dans la grille. */
export interface PartiePlacable {
  court: number;
  scheduled_time: string;
  scheduled_date?: string;
  status?: string;
}

export interface ColonneTerrain<M> {
  /** Numéro en base (1-based). */
  terrain: number;
  /** « A », « B »… */
  libelle: string;
  /**
   * Une case par heure de `heures`, dans le même ordre.
   * Vide = terrain libre à cette heure. Deux parties dans la même case = conflit
   * de déplacement manuel : on les montre toutes, jamais d'escamotage.
   */
  cases: M[][];
  /** Nombre de parties réelles sur ce terrain (cases pleines). */
  nbParties: number;
}

export interface GrilleTerrains<M> {
  /** L'échelle d'heures commune, en ordre chronologique. */
  heures: string[];
  colonnes: ColonneTerrain<M>[];
}

export interface JourneeGrille<M> {
  /** '' quand la partie n'a pas de date propre (tournoi d'une seule journée). */
  date: string;
  grille: GrilleTerrains<M>;
}

/** Une heure vide se range après toutes les autres (« — »). */
const SANS_HEURE = '—';
function cleHeure(t: string): string {
  return t && t.trim() ? t : SANS_HEURE;
}
function comparerHeures(a: string, b: string): number {
  if (a === b) return 0;
  if (a === SANS_HEURE) return 1;
  if (b === SANS_HEURE) return -1;
  return a.localeCompare(b);
}

/**
 * Combien de colonnes montrer : la config, mais jamais moins que le plus grand
 * numéro de terrain réellement utilisé (une partie déplacée à la main sur un
 * 3e terrain doit rester visible).
 */
export function nombreTerrains(matches: PartiePlacable[], terrainsConfig: number): number {
  const maxUtilise = matches.reduce((max, m) => Math.max(max, Math.floor(m.court) || 1), 0);
  return Math.max(1, Math.floor(terrainsConfig) || 1, maxUtilise);
}

/** Construit la grille alignée d'un jeu de parties (une seule journée). */
export function construireGrilleTerrains<M extends PartiePlacable>(
  matches: M[],
  terrainsConfig: number,
): GrilleTerrains<M> {
  const heures = [...new Set(matches.map(m => cleHeure(m.scheduled_time)))].sort(comparerHeures);
  const indexHeure = new Map(heures.map((h, i) => [h, i]));
  const nb = nombreTerrains(matches, terrainsConfig);

  const colonnes: ColonneTerrain<M>[] = Array.from({ length: nb }, (_, i) => ({
    terrain: i + 1,
    libelle: libelleTerrain(i + 1),
    cases: heures.map(() => [] as M[]),
    nbParties: 0,
  }));

  for (const m of matches) {
    const col = colonnes[Math.min(Math.max(Math.floor(m.court) || 1, 1), nb) - 1];
    const idx = indexHeure.get(cleHeure(m.scheduled_time));
    if (idx === undefined) continue;
    col.cases[idx].push(m);
    col.nbParties++;
  }

  return { heures, colonnes };
}

/**
 * Grilles regroupées par journée (tournois multi-jours), en ordre
 * chronologique. `dateParDefaut` sert aux parties d'avant la v3 (date vide).
 */
export function construireGrilleParJour<M extends PartiePlacable>(
  matches: M[],
  terrainsConfig: number,
  dateParDefaut = '',
): JourneeGrille<M>[] {
  const parJour = new Map<string, M[]>();
  for (const m of matches) {
    const date = m.scheduled_date || dateParDefaut || '';
    parJour.set(date, [...(parJour.get(date) || []), m]);
  }
  return [...parJour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, ms]) => ({ date, grille: construireGrilleTerrains(ms, terrainsConfig) }));
}

/** Étiquette d'une case vide, selon qu'il y a eu ou qu'il y aura des parties. */
export const LIBELLE_CASE_LIBRE = 'Libre';

/**
 * La journée « en cours » d'un tournoi de plusieurs jours : celle de la
 * première partie qui reste à jouer. Quand tout est joué, la dernière journée
 * (on reste sur le bilan plutôt que de revenir au premier matin).
 * Sert d'onglet ouvert par défaut et de journée affichée au mode TV.
 */
export function journeeCourante<M extends PartiePlacable>(matches: M[], dateParDefaut = ''): string {
  const cle = (m: M) => `${m.scheduled_date || dateParDefaut || ''}|${m.scheduled_time || ''}`;
  const triees = [...matches].sort((a, b) => cle(a).localeCompare(cle(b)));
  const aJouer = triees.find(m => m.status !== 'finished' && m.status !== 'cancelled');
  const choisie = aJouer ?? triees[triees.length - 1];
  return choisie ? (choisie.scheduled_date || dateParDefaut || '') : dateParDefaut || '';
}
