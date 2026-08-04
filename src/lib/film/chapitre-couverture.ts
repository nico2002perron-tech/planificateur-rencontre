/**
 * La COUVERTURE DE CHAPITRE épinglée — prototype de la vague 1 du scroll story.
 *
 * Une couverture est une page pleine hauteur qui se POSE sous les yeux et y TIENT
 * pendant qu'on défile, puis s'estompe quand le contenu du chapitre monte.
 * C'est le geste central du registre KEEL : une idée par écran, la forme avant le
 * détail.
 *
 * ⚠️ LE PIÈGE STRUCTUREL, vérifié dans le fichier et non supposé :
 * `position:sticky` est ANNULÉ, en silence, si un ancêtre porte `transform`,
 * `filter` ou `backdrop-filter`. Or les cartes du rapport portent `[data-tilt]`
 * (transform permanent, 15 occurrences) et `.glass` un `backdrop-filter`
 * (7 occurrences). Une couverture posée à l'intérieur d'une carte ne collerait
 * jamais — sans aucun message d'erreur. La couverture vit donc en FRÈRE de
 * `.page`, enfant direct du corps, où aucun ancêtre n'est transformé.
 *
 * Mécanique : la piste (`.couv`) fait deux hauteurs d'écran ; l'intérieur
 * (`.couv-in`) colle sur une hauteur d'écran. Le rAF unique du scroll-film écrit
 * une propriété `--p` de 0 à 1 sur la piste ; le CSS s'en sert pour estomper et
 * soulever. Aucune animation pilotée par le temps : le client s'arrête de
 * défiler, la couverture s'arrête. C'est ce qui en fait la télécommande du
 * conseiller plutôt qu'un film qui joue tout seul.
 */
import type { FilmData } from './build-film-data';

const NB = ' ';
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-CA')}${NB}$`;

export interface Couverture {
  /** Identifiant de la piste (pour le script). */
  id: string;
  /** L'ancre du contenu vers laquelle « tourner la page ». */
  vers: string;
  numero: string;
  surtitre: string;
  titre: string;
  phrase: string;
}

/**
 * La couverture du chapitre 1.0.
 *
 * Le chiffre y est POSÉ, pas compté : les odomètres à rouleaux du héros, dix
 * centimètres plus bas, gardent l'exclusivité du spectacle. Le client lit le
 * montant, puis le voit rouler — jamais deux chiffres qui bougent par écran.
 */
export function couverturePortraitHtml(film: FilmData): string {
  const h = film.hero;
  if (!h || !(h.portfolioValue > 0)) return '';
  const projete = h.projectedValue;

  return `
<section class="couv" id="couv-portrait" data-vers="ch-portrait">
  <div class="couv-in">
    <div class="couv-grille">
      <span class="couv-num">1.0</span>
      <div class="couv-txt">
        <p class="couv-sur">Le portrait</p>
        <h2 class="couv-titre">Où vous en êtes<br>aujourd&rsquo;hui</h2>
        <p class="couv-phrase">Voici votre portefeuille au&nbsp;jour&nbsp;le&nbsp;jour, et
          <span class="couv-souligne">ce que les analystes en attendent</span> d&rsquo;ici douze mois.</p>
        <div class="couv-paire">
          <div class="couv-ch">
            <b>${fmt(h.portfolioValue)}</b>
            <span>Aujourd&rsquo;hui</span>
          </div>
          ${projete != null ? `<i class="couv-fl" aria-hidden="true">&rarr;</i>
          <div class="couv-ch est-proj">
            <b>${fmt(projete)}</b>
            <span>Projeté 12 mois</span>
          </div>` : ''}
        </div>
      </div>
    </div>
    <button type="button" class="couv-suite" data-vers="ch-portrait">
      <span class="couv-chev" aria-hidden="true">&darr;</span>
      <span>Défilez</span>
    </button>
  </div>
</section>`;
}

/**
 * La bascule de papier — OUTIL DE PROTOTYPE, à retirer une fois le choix fait.
 *
 * La question posée à Nicolas ne se tranche pas sur description : les couvertures
 * KEEL vivent sur un papier chaud (#f6f5f2, encre presque noire), le rapport vit
 * en bleu-gris froid de marque. On met donc les deux à un clic l'un de l'autre,
 * sur sa vraie couverture, avec ses vrais chiffres.
 */
export function bascalePapierHtml(): string {
  return `
<div class="papier-bascule" id="papier-bascule">
  <span>Papier</span>
  <button type="button" data-papier="froid" class="est-actif">Froid</button>
  <button type="button" data-papier="chaud">Chaud</button>
</div>`;
}
