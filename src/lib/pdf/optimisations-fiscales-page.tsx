// « OPTIMISATIONS FISCALES » — UNE page, datée, LOCALE SEULEMENT.
//
// Rend les constats produits par `analyser()` (src/lib/profils/strategies.ts).
// ZÉRO logique fiscale ici, ZÉRO mise en page là-bas : c'est le contrat de la
// section 5 du schéma, et le tenir est ce qui rend le module vérifiable par un
// fiscaliste sans qu'il ait à lire du JSX.
//
// ─────────────────────────────────────────────────────────────────────────────
// CETTE PAGE N'EXISTE QUE DANS LE PDF, JAMAIS DANS LE RAPPORT VIVANT HTML.
//
// Décision de Nicolas, 5 août 2026. Les deux formats partagent le pipeline de
// données, et `enrich-report-data.ts` dit pourquoi : « sinon les deux formats
// raconteraient deux histoires différentes au même client ». On accepte ici une
// divergence ASSUMÉE — le rapport vivant circule, cette section ne doit pas
// circuler avant l'avis du fiscaliste. Ne pas « réparer » cette divergence sans
// le lui demander.
//
// ÉTEINTE PAR DÉFAUT. Le drapeau est `=== true`, pas `!== false` comme les
// autres sections du gabarit : chaque apparition doit être un geste volontaire.
// Et il est imposé par la ROUTE via `modeFiscalActif()`, jamais réclamé par le
// navigateur — personne ne peut demander cette page depuis Vercel.
//
// Identité de page : accent OR #c5a365 — la seule couleur de la charte encore
// non réservée (orange = parcours, cyan = activité, duoBlue/duoGreen = revenus).
//
// Gardes d'honnêteté :
// - un MONTANT n'est affiché QUE si statut === 'calcule'. Les autres statuts
//   rendent leur explication et leurs données manquantes, jamais un chiffre ;
// - la DATE vient de `resultat.date`, donc de l'appelant — jamais d'un
//   `new Date()` caché, sinon deux rendus du même dossier porteraient deux
//   dates et rien ne dirait laquelle fait foi ;
// - la mention du fiscaliste est rendue tant que `revisionFiscalisteRequise` ;
// - l'angle mort est FACTUEL, jamais vendeur : la liste EST l'argument.
//
// Pas de « ≈ » (U+2248) ni de « ✓ » (U+2713) : ces glyphes manquent aux polices
// embarquées. Les flèches n'existent qu'en Montserrat.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Page, Text, View, Svg, Path, Image } from '@react-pdf/renderer';
import { styles, C } from './styles';
import {
  FORMAT_PAGE_FISCALE, ORIENTATION_PAGE_FISCALE, STYLE_PAGE_FISCALE,
} from './page-fiscale';
import { SectionHeader, PageFooterV12 } from './year-activity-pages';
import { aUnePageDetaillee, STRATEGIES_VISUELLES } from './strategies-visuelles';
import type { ResultatAnalyse, Constat } from '@/lib/profils/strategies';
import {
  montantAffichable, proseSansMontantFerme, ENTETE, raisonsAConfirmer,
  modeTableau, lignesTableau, COLONNES, mentionDate, mentionPortee, libelleRaison,
} from './rendu-constat';

import { gestesDe, estDejaEnOrdre } from '@/lib/profils/demarches';

// ── Helpers locaux (copies volontaires : price-targets-template importera cette
// page — importer ses helpers créerait un cycle de modules) ──
function fmt(value: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}
function fmtDate(iso: string): string {
  const formatted = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${iso}T12:00:00`));
  return formatted.replace(/^1 /, '1er ');
}

/**
 * Le ton d'un constat.
 *
 * Trois traitements pour quatre statuts, et c'est voulu : `indisponible` et
 * `non-applicable` se ressemblent à l'œil parce qu'ils disent la même chose au
 * client — « pas de chiffre ici » —, mais leurs mots diffèrent. C'est le texte
 * qui porte la nuance, pas la couleur.
 */
// ⚠ TOUTES LES DÉCISIONS DE PRÉSENTATION VIVENT DANS `rendu-constat.ts`.
// Le JSX ne fait que les appliquer : c'est ce qui rend la protection des
// chiffres testable sans rendre un document, et impossible à contourner par
// une phrase bien tournée.
const TON: Record<Constat['statut'], {
  fond: string; bord: string; encre: string; mot: string;
  /** Le bandeau d'en-tête de la carte, et sa pastille de statut. */
  bandeau: string; pastilleFond: string; pastilleEncre: string;
}> = {
  // Passage « présentation » du 5 août : les fonds viennent maintenant de la
  // palette Duolingo de la charte (styles.ts), plus francs que les gris-verts
  // d'origine. LES STATUTS EUX-MÊMES N'ONT PAS BOUGÉ — quatre statuts, quatre
  // mots, la même règle. C'est la couleur qui s'anime, pas la sémantique.
  calcule: {
    fond: C.duoGreenBg, bord: C.duoGreen, encre: '#2f6b12', mot: 'chiffré',
    bandeau: C.duoGreenPale, pastilleFond: C.duoGreen, pastilleEncre: '#ffffff',
  },
  'montant-a-confirmer': {
    fond: '#fff8e7', bord: C.duoYellow, encre: '#8a5a00', mot: 'à confirmer',
    bandeau: '#fff1c9', pastilleFond: C.duoYellow, pastilleEncre: '#5c3d00',
  },
  indisponible: {
    fond: '#f6f8fb', bord: '#c2cddb', encre: '#4a5b70', mot: 'donnée manquante',
    bandeau: '#e8eef5', pastilleFond: '#c2cddb', pastilleEncre: '#33455c',
  },
  'non-applicable': {
    fond: '#f6f8fb', bord: '#c2cddb', encre: '#4a5b70', mot: 'sans objet',
    bandeau: '#e8eef5', pastilleFond: '#c2cddb', pastilleEncre: '#33455c',
  },
};

/**
 * UNE ICÔNE PAR STRATÉGIE — dessinée, jamais importée.
 *
 * Traits vectoriels sur une grille de 24, dans la couleur de la stratégie.
 * Aucune image, aucun fichier externe : le PDF reste autonome et le rendu ne
 * dépend d'aucun réseau. Les traits sont volontairement simples — à 11 pt,
 * tout détail supplémentaire devient une tache.
 */
const ICONES: Record<string, { couleur: string; traits: string[] }> = {
  // Une flèche descendante sur un axe : la perte qu'on va chercher.
  'cristallisation-pertes': {
    couleur: C.duoGreen,
    traits: ['M3 4 L3 21 L21 21', 'M7 9 L11 14 L15 10 L20 16', 'M20 11 L20 16 L15 16'],
  },
  // La flèche qui monte sur un axe : le gain qu'on va récolter.
  'cristallisation-gains': {
    couleur: C.duoYellow,
    traits: ['M3 4 L3 21 L21 21', 'M7 16 L11 11 L15 14 L20 8', 'M20 13 L20 8 L15 8'],
  },
  // Deux contenants, un titre qui passe de l'un à l'autre.
  'localisation-actifs': {
    couleur: C.duoBlue,
    traits: ['M3 7 L10 7 L10 20 L3 20 Z', 'M14 7 L21 7 L21 20 L14 20 Z', 'M10 11 L14 11'],
  },
  // Un coffre entrouvert : l'espace d'abri qui attend.
  'droits-cotisation': {
    couleur: C.blue,
    traits: ['M4 11 L20 11 L20 20 L4 20 Z', 'M4 11 L7 6 L17 6 L20 11', 'M10 15 L14 15'],
  },
  // Deux personnes côte à côte.
  'celi-conjoint': {
    couleur: C.duoPurple,
    traits: ['M9 8 A2.6 2.6 0 1 0 9 3 A2.6 2.6 0 1 0 9 8', 'M3 21 A6 6 0 0 1 15 21',
             'M17 9 A2.2 2.2 0 1 0 17 5 A2.2 2.2 0 1 0 17 9', 'M15 21 A5 5 0 0 1 22 17'],
  },
  // Une main ouverte qui tend quelque chose.
  'don-titres': {
    couleur: C.duoOrange,
    traits: ['M12 3 L12 13', 'M8 7 L12 3 L16 7', 'M4 15 A8 8 0 0 0 20 15'],
  },
  // Une liste ordonnée.
  // ⚠ LA HUITIÈME, LONGTEMPS MANQUANTE. Sept stratégies avaient leur pastille,
  // `subvention-reee` non : son titre partait 23 pt à gauche de tous les autres
  // dans la colonne des cartes. Vu en rastérisant le document d'entreprise, où
  // les huit constats se suivent.
  //
  // Un mortier — le geste « verser dans le REEE » — dans la même grammaire de
  // traits que les sept autres : deux arcs et une tige, 24×24, sans remplissage.
  'subvention-reee': {
    couleur: '#7c3aed',
    traits: ['M4 10 A8 8 0 0 0 20 10', 'M3 10 H21', 'M12 18 V21', 'M8 21 H16', 'M17 4 L14 8'],
  },
  'ordre-vente': {
    couleur: C.cyan,
    traits: ['M4 6 L7 6', 'M4 12 L7 12', 'M4 18 L7 18', 'M10 6 L20 6', 'M10 12 L20 12', 'M10 18 L20 18'],
  },
};

function IconeStrategie({ strategie, eteinte }: { strategie: string; eteinte: boolean }) {
  const icone = ICONES[strategie];
  if (!icone) return null;
  // Un constat sans chiffre porte son icône en gris : la couleur signale qu'il
  // y a quelque chose à faire, pas seulement de quoi on parle.
  const trait = eteinte ? '#94a3b8' : icone.couleur;
  // LA PASTILLE RONDE — 18 août 2026. L'icône flottait nue à côté du titre ;
  // le reste du rapport pose ses symboles sur une surface. Un rond blanc de
  // 17 pt lui donne le même poids qu'un bouton, et le bandeau coloré derrière.
  return (
    <View
      style={{
        width: 17, height: 17, borderRadius: 9, marginRight: 6,
        backgroundColor: '#ffffff',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Svg viewBox="0 0 24 24" style={{ width: 11, height: 11 }}>
        {icone.traits.map((d, i) => (
          <Path key={i} d={d} stroke={trait} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        ))}
      </Svg>
    </View>
  );
}

function CarteConstat({ constat, logos }: { constat: Constat; logos?: Record<string, string> }) {
  const t = TON[constat.statut];
  // ── LES DÉMARCHES SONT UN TROISIÈME CANAL — refermé le 21 août 2026 ──────
  //
  // Trouvé par le verrou anti-fuite : `demarches.ts` lit `constat.montantEstime`
  // DIRECTEMENT et l'écrit dans des instructions comme « Vendre pour environ
  // X $ de gain ». Le moteur met ce champ à `null` hors de `calcule`, donc rien
  // ne fuyait — mais la protection reposait entièrement sur cette discipline,
  // à un endroit que personne ne surveillait. Un constat forgé avec un statut
  // dégradé et un montant produisait une marche à suivre chiffrée.
  //
  // On ne passe donc aux démarches QUE le montant affichable, et on filtre leur
  // prose comme celle du constat : une seule règle, appliquée à tous les canaux.
  const gestes = gestesDe({ ...constat, montantEstime: montantAffichable(constat) });
  return (
    // LA CARTE, SUR LE MOULE DU RESTE DU RAPPORT — refonte du 18 août 2026.
    //
    // Mesuré avant de toucher à quoi que ce soit : les autres pages du rapport
    // emploient des rayons de 10 et des chiffres jusqu'à 24 pt ; cette page
    // avait des rayons de 2 et plafonnait à 8 pt. Elle se lisait comme un
    // formulaire administratif glissé au milieu de pages vivantes — c'est
    // exactement ce que Nicolas a vu.
    //
    // On reprend donc l'idiome maison (cf. YearSummaryPanel) : carte à rayon
    // 10, bandeau d'en-tête coloré, corps blanc. Ce qui NE bouge pas : quatre
    // statuts, quatre mots, et aucun montant hors du statut « calcule ».
    <View
      style={{
        marginBottom: 9,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: t.bord,
        borderStyle: 'solid',
        backgroundColor: '#ffffff',
      }}
      wrap={false}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: t.bandeau,
          paddingHorizontal: 9,
          paddingVertical: 6,
        }}
      >
        <IconeStrategie strategie={constat.strategie} eteinte={constat.statut !== 'calcule'} />
        {/* LE TITRE CLIENT, pas le titre du catalogue. « Cristallisation de
            pertes » est du vocabulaire de metier ; l'ecran de selection le
            garde, le document remis au client dit ce que ca change pour lui. */}
        <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
          {constat.titreClient}
        </Text>
        {/* LA PASTILLE DE STATUT — le mot dans une puce pleine plutôt qu'en
            petites capitales grises. Quatre statuts, quatre mots : la
            sémantique ne bouge pas, seule sa mise en évidence change. */}
        <View
          style={{
            borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2,
            backgroundColor: t.pastilleFond,
          }}
        >
          <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: t.pastilleEncre }}>
            {ENTETE[constat.statut].badge}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 9, paddingTop: 7, paddingBottom: 8 }}>
        {/* LE MONTANT N'APPARAÎT QUE SI LE STATUT EST « calcule ».
            C'est la garde centrale : `montantEstime` est déjà null ailleurs
            (strategies.ts le verrouille et le teste), mais on ne dépend pas
            d'une seule barrière pour un chiffre qui atteint le client.

            IL DEVIENT UN CHIFFRE-TITRE (18 août) : 20 pt, comme les nombres
            des autres pages. Il était à 12 pt en bout de ligne, où il se
            lisait comme une note de bas de page. */}
        {/* ⚠ LA PORTE UNIQUE DU CHIFFRE — `montantAffichable` ne rend un
            montant que sous `calcule`. Un constat forgé avec un statut dégradé
            ET un montant ne peut rien afficher ici. */}
        {montantAffichable(constat) !== null && (
          <View
            style={{
              flexDirection: 'row', alignItems: 'baseline',
              marginBottom: 5, paddingBottom: 5,
              borderBottomWidth: 0.7, borderBottomColor: t.bord, borderBottomStyle: 'solid',
            }}
          >
            <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: t.encre }}>
              {fmt(montantAffichable(constat) as number)}
            </Text>
            {/* CE QUE LE MONTANT EST. Sans cette ligne, trois chiffres de
                natures différentes s'alignent et se lisent comme trois
                économies comparables — alors que des droits de cotisation ne
                sont pas une économie. C'est le défaut qui a fait retirer le
                total de la page. */}
            <Text style={{ marginLeft: 6, flex: 1, fontSize: 7, color: t.encre, lineHeight: 1.3 }}>
              {constat.libelleMontant}
              {constat.recurrence === 'annuel' ? ', par année' : ', une seule fois'}
            </Text>
          </View>
        )}

        {/* L'ANNONCE DU STATUT — quatre statuts, quatre phrases. Sous
            `calcule` le chiffre-titre parle déjà ; ailleurs, cette ligne dit
            d'entrée ce que le document PEUT et NE PEUT PAS conclure. Sans
            elle, « indisponible » et « non applicable » se lisaient pareil :
            l'un est un aveu, l'autre une conclusion. */}
        {constat.statut !== 'calcule' && (
          <Text style={{
            marginBottom: 3, fontSize: 8, fontFamily: 'Montserrat',
            fontWeight: 700, color: t.encre,
          }}>
            {ENTETE[constat.statut].annonce}
          </Text>
        )}

        {/* ⚠ LA PROSE PASSE PAR LE FILTRE. C'est le second canal par lequel un
            chiffre pourrait atteindre le client, et le seul qui ne dépendait
            jusqu'ici que de la vigilance de l'auteur de la stratégie. */}
        <Text style={{ fontSize: 7.6, color: '#334155', lineHeight: 1.45 }}>
          {proseSansMontantFerme(constat.explication, constat.statut)}
        </Text>

        {/* LA DATE DES VALEURS — jamais « aujourd'hui ». Le moteur n'a aucun
            seuil de fraîcheur ; le document date sans juger. */}
        {mentionDate(constat.dateDonnees) && (
          <Text style={{ marginTop: 3, fontSize: 6.6, color: '#64748b' }}>
            {mentionDate(constat.dateDonnees)}
          </Text>
        )}
        {mentionPortee(constat) && (
          <Text style={{ marginTop: 2, fontSize: 6.6, color: '#64748b' }}>
            {mentionPortee(constat)}
          </Text>
        )}

        {/* CE QUI EMPÊCHE D'AGIR — alimenté par le moteur, traduit une seule
            fois (`libelleRaison`). Aucun identifiant technique ne peut
            atteindre le client, et un test le vérifie. */}
        {raisonsAConfirmer(constat).length > 0 && (
          <View
            style={{
              marginTop: 5, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5,
              backgroundColor: t.fond,
            }}
          >
            <Text style={{
              fontSize: 6.9, fontFamily: 'Open Sans', fontWeight: 600,
              color: t.encre, marginBottom: 2,
            }}>
              {ENTETE[constat.statut].titreRaisons}
            </Text>
            {raisonsAConfirmer(constat).map((r, i) => (
              <Text key={i} style={{ fontSize: 6.9, color: t.encre, lineHeight: 1.35 }}>
                {'• ' + r}
              </Text>
            ))}
          </View>
        )}

      {/* LE RENVOI VERS LE DÉTAIL — sans quoi la carte se tait sans le dire.
          Retirer le tableau d'ordres laisse une carte qui annonce un montant et
          n'explique nulle part comment il s'obtient. Elle nomme donc la page
          qui le fait, PAR SON TITRE : « à la page suivante » serait faux dès la
          deuxième stratégie, et un renvoi qu'on ne peut pas suivre ne vaut pas
          mieux que pas de renvoi. */}
      {aUnePageDetaillee(constat.strategie) && modeTableau(constat) === 'plan' && (
        <View style={{
          marginTop: 6, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6,
          backgroundColor: t.fond,
        }}>
          <Text style={{ fontSize: 7, color: t.encre, lineHeight: 1.4 }}>
            Le détail — quelles positions vendre, quelles quantités, et l’effet estimé — est
            présenté plus loin, à la page «{' '}
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700 }}>
              {STRATEGIES_VISUELLES[constat.strategie].entete.titre}
            </Text>
            {' '}».
          </Text>
        </View>
      )}

      {/* QUOI VENDRE — deux régimes, un seul tableau.
          ─────────────────────────────────────────────────────────────────────
          AVANT le 19 août 2026, ce bloc n'affichait que `plan`, présent sur la
          SEULE branche entièrement calculée de la cristallisation de gains.
          Partout ailleurs — comptes détenus ailleurs, pertes reportées non
          saisies — la section ne nommait aucun titre. Nicolas : « je trouve que
          ça dit rien ».

          Désormais :
          · `plan`      — la marche à suivre vers un montant CONFIRMÉ. Ses
                          lignes peuvent être partielles (découpées pour
                          atteindre la cible).
          · `candidats` — les 3 meilleurs titres par densité, dès que les
                          positions sont connues. Jamais partiels, et sans
                          promesse de montant : ce sont des FAITS du relevé
                          (valeur marchande − valeur comptable), pas une
                          estimation fiscale.

          Le plan prime quand il existe ; sinon les candidats. La légende, en
          bas du tableau, dit lequel des deux on est en train de lire — sans
          quoi une liste de candidats se lirait comme un ordre d'exécution. */}
      {(() => {
        // ⚠ LE MODE VIENT DU MODULE, ET IL FAIT L'AUTORITÉ DU TABLEAU. Un plan
        // est une marche à suivre ; des candidats sont des observations du
        // relevé. Confondre les deux fabriquait une instruction de vente à
        // partir d'un montant que le moteur n'avait jamais recommandé.
        // ⚠ LE TABLEAU D'ORDRES SORT DE LA SYNTHÈSE — mais LUI SEUL.
        //
        // Deux régimes vivent dans ce bloc, et les confondre coûterait cher :
        //   · 'plan'      — la marche à suivre. C'est une RECOMMANDATION
        //                   COMPLÈTE, et depuis que les pages en cinq étapes
        //                   sont branchées, le document en donnait DEUX pour
        //                   la même stratégie. C'est celle-ci qui part.
        //   · 'candidats' — les trois meilleurs titres par densité, présentés
        //                   comme des MESURES DU RELEVÉ, avec une légende qui
        //                   dit qu'ils ne sont pas un ordre de vente. Ils
        //                   existent parce que sans eux, un constat dégradé ne
        //                   nommait aucun titre (« je trouve que ça dit rien »,
        //                   19 août 2026) — et la page en cinq étapes ne les
        //                   nomme pas non plus sous un statut dégradé. Les
        //                   retirer rendrait le document MUET là où il l'était
        //                   déjà une fois. Ils restent.
        const brut = modeTableau(constat);
        const mode = brut === 'plan' && aUnePageDetaillee(constat.strategie) ? null : brut;
        if (!mode) return null;
        const lignes = lignesTableau(constat);
        const col = COLONNES[mode];
        return (
        <View
          style={{
            marginTop: 6, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6,
            backgroundColor: '#ffffff',
            borderWidth: 1, borderColor: t.bord, borderStyle: 'solid',
          }}
        >
          <View style={{ flexDirection: 'row', paddingBottom: 3, borderBottomWidth: 0.8, borderBottomColor: t.bord, borderBottomStyle: 'solid' }}>
            <Text style={{ flex: 2, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>Titre</Text>
            <Text style={{ flex: 1.6, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>{col.montant}</Text>
            <Text style={{ flex: 1.6, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b', textAlign: 'right' }}>{col.gain}</Text>
          </View>
          {lignes.map((l) => (
            <View key={l.symbole} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2.2 }}>
              {/* LE LOGO DU TITRE, quand il est déjà sur le poste. Il vient du
                  cache local nourri par les cours cibles — le document fiscal
                  ne va JAMAIS le chercher lui-même (voir base-locale/logos.ts).
                  Absent, la ligne s'affiche comme avant : le symbole se suffit. */}
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                {logos?.[l.symbole] && (
                  <Image
                    src={logos[l.symbole]}
                    style={{ width: 11, height: 11, marginRight: 4.5, objectFit: 'contain' }}
                  />
                )}
                <Text style={{ fontSize: 7, color: '#334155' }}>
                  {l.symbole}{l.partiel ? '  (en partie)' : ''}
                </Text>
              </View>
              <Text style={{ flex: 1.6, fontSize: 7, color: '#334155', textAlign: 'right' }}>{fmt(l.vendre)}</Text>
              <Text style={{ flex: 1.6, fontSize: 7, color: '#334155', textAlign: 'right' }}>{fmt(l.gain)}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.3 }}>
            {col.legende}
          </Text>
        </View>
        );
      })()}

      {/* LES DÉMARCHES, SOUS CHAQUE GESTE.
          Un constat dit ce qui est ; un geste dit ce qu'on fait ; les démarches
          disent comment. Sans elles, la page se lit comme un diagnostic sans
          ordonnance. Toutes ces phrases viennent de gabarits déterministes
          (demarches.ts) : elles sont en nombre fini et un fiscaliste peut les
          relire une par une. */}
      {gestes.map((g, i) => (
        <View
          key={i}
          style={{
            marginTop: 5, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6,
            backgroundColor: '#f8fafc',
            borderLeftWidth: 2, borderLeftColor: t.bord, borderLeftStyle: 'solid',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 7.8, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
              {proseSansMontantFerme(g.libelle, constat.statut)}
            </Text>
            <Text style={{ marginLeft: 5, fontSize: 6, color: '#64748b' }}>
              {PORTEUR[g.porteur]}
            </Text>
          </View>
          {g.demarches.map((d, j) => (
            <Text key={j} style={{ marginTop: 2, fontSize: 7, color: '#475569', lineHeight: 1.4 }}>
              {j + 1}. {proseSansMontantFerme(d, constat.statut)}
            </Text>
          ))}
        </View>
      ))}
      </View>
    </View>
  );
}

/** Qui pose le geste — le client ne doit pas croire qu'il doit tout faire. */
const PORTEUR: Record<'client' | 'conseiller' | 'les-deux', string> = {
  client: 'vous',
  conseiller: 'nous nous en occupons',
  'les-deux': 'ensemble',
};

/**
 * « DÉJÀ EN ORDRE » — le contrepoids honnête.
 *
 * Un document qui ne parle que de ce qui cloche laisse croire que tout cloche.
 * Ce bloc dit ce qui a été regardé et n'appelle rien. Il ne contient QUE les
 * constats dont la situation est correcte — jamais ceux où il nous manque une
 * donnée, qui sont une question à poser, pas une bonne nouvelle.
 */
function BlocDejaEnOrdre({ constats }: { constats: Constat[] }) {
  return (
    <View
      style={{
        marginTop: 4, marginBottom: 7, paddingVertical: 6, paddingHorizontal: 9,
        backgroundColor: C.duoGreenBg, borderRadius: 2,
      }}
    >
      <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 700, color: '#2f6b12' }}>
        Déjà en ordre
      </Text>
      <Text style={{ marginTop: 1.5, fontSize: 6.8, color: '#3f6b2a', lineHeight: 1.35 }}>
        Regardé, rien à faire de ce côté.
      </Text>
      {constats.map((c) => (
        <Text key={c.strategie} style={{ marginTop: 2, fontSize: 7, color: '#334155', lineHeight: 1.35 }}>
          {c.titreClient} — {c.explication}
        </Text>
      ))}
    </View>
  );
}

/**
 * L'angle mort — section 4 du schéma.
 *
 * TON : factuel, jamais vendeur. On ne dit pas au client ce qu'il devrait
 * faire ; on lui montre ce qu'on ne peut pas voir. La liste EST l'argument.
 */
function BlocAngleMort({ angleMort }: { angleMort: NonNullable<ResultatAnalyse['angleMort']> }) {
  return (
    <View
      style={{
        marginTop: 4,
        paddingVertical: 7,
        paddingHorizontal: 9,
        backgroundColor: C.goldPale,
        borderWidth: 0.8,
        borderColor: C.gold,
        borderStyle: 'solid',
        borderRadius: 2,
      }}
    >
      <Text style={{ fontSize: 9.5, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
        Ce que nous ne voyons pas
      </Text>
      <Text style={{ marginTop: 2, fontSize: 7.4, color: '#334155', lineHeight: 1.4 }}>
        {angleMort.constatsLimites} constat{angleMort.constatsLimites > 1 ? 's' : ''} sur{' '}
        {angleMort.total} {angleMort.constatsLimites > 1 ? 'sont limités' : 'est limité'} par des
        données détenues hors de nos livres.
      </Text>
      {angleMort.details.map((d, i) => (
        <Text key={i} style={{ marginTop: 2, fontSize: 6.8, color: '#475569', lineHeight: 1.35 }}>
          — {d}
        </Text>
      ))}
    </View>
  );
}

export function OptimisationsFiscalesPage({
  resultat,
  piedInterne = false,
  essaiIA = false,
  logos,
  libelleDocument,
}: {
  resultat: ResultatAnalyse;
  /**
   * LE NOM DU DOCUMENT QUI CONTIENT CETTE PAGE — posé par l'assembleur.
   *
   * ⚠ UNE PAGE NE PEUT PAS SAVOIR OÙ ELLE EST. Celle-ci vit dans DEUX
   * documents : le rapport de cours cibles et le document fiscal autonome. Elle
   * choisissait son pied d'après `piedInterne`, c'est-à-dire d'après le drapeau
   * du fiscaliste — le jour où il tombe, le document autonome se serait remis à
   * s'appeler « Analyse des cours cibles 1.2 ».
   *
   * Absent, le pied garde le libellé par défaut de `PageFooterV12` : c'est le
   * cas de la page INTÉGRÉE aux cours cibles, et c'est juste.
   */
  libelleDocument?: string;
  /** Des textes reformulés par l'IA d'essai figurent sur la page. */
  essaiIA?: boolean;
  /**
   * Le logo de chaque symbole (data URI), pour le plan de récolte.
   *
   * TOUJOURS fourni par l'appelant, JAMAIS cherché ici : le document fiscal
   * n'a aucune sortie réseau, et il ne doit pas en gagner une. La source est
   * le cache local nourri par les cours cibles (base-locale/logos.ts). Ce qui
   * manque manque — la ligne s'affiche alors avec le seul symbole.
   */
  logos?: Record<string, string>;
  /**
   * Rend la mention « usage interne » en pied de CETTE page aussi.
   *
   * Posé par le document autonome. Une page photographiee seule, ou imprimee
   * hors du document, doit continuer de dire ce qu'elle est.
   */
  piedInterne?: boolean;
}) {
  const dateLisible = fmtDate(resultat.date);
  const chiffres = resultat.constats.filter((c) => c.statut === 'calcule');
  // Deux familles, deux traitements : ce sur quoi on agit, et ce qui est deja
  // correct. Les melanger noierait les bonnes nouvelles dans les cartes.
  const enOrdre = resultat.constats.filter(estDejaEnOrdre);
  const aTravailler = resultat.constats.filter((c) => !estDejaEnOrdre(c));

  return (
    // ⚠ LE MÊME CONTRAT QUE LES PAGES DE STRATÉGIE. Le `#fffdf9` était posé ici
    // en override inline ; il vit maintenant dans `page-fiscale.ts`, avec le
    // format et les marges, pour que toutes les pages du document s'accordent
    // sans qu'on ait à s'en souvenir. Le rendu de CETTE page est inchangé.
    <Page
      size={FORMAT_PAGE_FISCALE}
      orientation={ORIENTATION_PAGE_FISCALE}
      style={STYLE_PAGE_FISCALE}
    >
      <SectionHeader
        title="Optimisations fiscales"
        subtitle={`Au ${dateLisible}, selon les données au dossier`}
        accent={C.gold}
      />

      {/* LA MENTION DU FISCALISTE — retirable en une ligne le jour où
          `revisionFiscalisteRequise` passe à false dans strategies.ts. */}
      {resultat.revisionFiscalisteRequise && (
        <View
          style={{
            marginBottom: 11,
            paddingVertical: 5,
            paddingHorizontal: 8,
            backgroundColor: '#fffbeb',
            borderWidth: 0.8,
            borderColor: '#fbbf24',
            borderStyle: 'solid',
            borderRadius: 2,
          }}
        >
          <Text style={{ fontSize: 7.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#92400e' }}>
            Document de travail — en attente de révision par un fiscaliste
          </Text>
          <Text style={{ marginTop: 1.5, fontSize: 6.6, color: '#92400e', lineHeight: 1.35 }}>
            Les règles et les paramètres qui produisent cette page n&apos;ont pas encore été revus
            par un fiscaliste. Elle sert à préparer la discussion ; elle ne doit pas être remise au
            client sous cette forme.
          </Text>
        </View>
      )}

      {/* AUCUN TOTAL, ET C'EST LE POINT.
          Le premier rendu de cette page en portait un : 69 871 $, en gros et en
          vert. Il additionnait une perte à cristalliser, des DROITS de
          cotisation du conjoint et un gain mis à l'abri — trois natures, trois
          unités, et des droits qui ne sont pas une économie. Un chiffre
          impressionnant qui ne voulait rien dire, sur un document remis en
          rencontre. Le compte, lui, est honnête : il dit combien de pistes ont
          pu être chiffrées, sans prétendre les additionner. */}
      {chiffres.length > 0 && (
        <View
          style={{
            marginBottom: 11, paddingVertical: 6, paddingHorizontal: 9,
            backgroundColor: '#f0fce8', borderRadius: 2,
          }}
        >
          <Text style={{ fontSize: 8, color: '#2f6b12' }}>
            {chiffres.length} piste{chiffres.length > 1 ? 's' : ''} chiffrée
            {chiffres.length > 1 ? 's' : ''} sur {resultat.constats.length}
            {chiffres.length > 1
              ? ' — les montants ci-dessous sont de natures différentes et ne s’additionnent pas.'
              : '.'}
          </Text>
        </View>
      )}

      {aTravailler.map((c) => (
        <CarteConstat key={c.strategie} constat={c} logos={logos} />
      ))}

      {enOrdre.length > 0 && <BlocDejaEnOrdre constats={enOrdre} />}

      {resultat.angleMort && <BlocAngleMort angleMort={resultat.angleMort} />}

      {resultat.questionsRencontre.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
            À valider ensemble
          </Text>
          {/* ⚠ TRADUIT, COMME PARTOUT AILLEURS. Cette liste imprimait le slug
              brut du moteur : sur un dossier d'entreprise, le client lisait
              « 1. Titulaire-entreprise ». Les cartes passaient déjà par
              `libelleRaison` via `raisonsAConfirmer` ; cette liste-ci était le
              canal oublié. Un slug inconnu sort en « une donnée du dossier reste
              à confirmer » plutôt qu'en vocabulaire de programmeur. */}
          {[...new Set(resultat.questionsRencontre.map(libelleRaison))].map((q, i) => (
            <Text key={i} style={{ marginTop: 1.5, fontSize: 7, color: '#475569', lineHeight: 1.35 }}>
              {i + 1}. {q.charAt(0).toUpperCase()}{q.slice(1)}
            </Text>
          ))}
        </View>
      )}

      {/* Note méthodologique — sur le patron de deployment-page.tsx : d'où vient
          chaque chiffre, ce qui est affiché seulement si, et la
          non-recommandation. C'est ce qui rend la page défendable. */}
      <View style={{ marginTop: 9 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
          Comment ces constats ont été établis
        </Text>
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Chaque constat part des transactions et des relevés importés au dossier, arrêtés au{' '}
          {dateLisible}. Un montant n&apos;est affiché que lorsque toutes les données nécessaires
          sont présentes et datées ; sinon le constat porte la mention « à confirmer » ou « donnée
          manquante », et la ligne « pour aller plus loin » nomme précisément ce qui manque. Un
          compte dont le régime n&apos;est pas prouvé est écarté plutôt que présumé. Les positions
          détenues ailleurs qu&apos;ici ne sont pas visibles et ne sont donc jamais incluses.
        </Text>
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Sources : profil du client et paramètres fiscaux au dossier
          {resultat.constats[0]?.sources.length ? ` (${resultat.constats[0].sources.join(', ')})` : ''}.
          Les plafonds de cotisation proviennent des montants publiés ; ceux de l&apos;année en
          cours restent à confirmer.
        </Text>
        {essaiIA && (
          <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#b45309', lineHeight: 1.34 }}>
            Essai sur dossier fictif : certains textes de cette page ont été reformulés par une IA à
            partir des chiffres du moteur, puis vérifiés — chaque nombre, réserve et échéance doit
            correspondre au calcul, sinon le texte d’origine est conservé. Aucune donnée réelle
            n’a été transmise.
          </Text>
        )}
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Ces constats sont établis à partir des données disponibles à la date indiquée : ils ne
          préjugent pas des résultats futurs et ne constituent ni une prévision, ni une
          recommandation, ni un conseil fiscal, juridique ou en placement. Toute mise en oeuvre doit
          être validée par un fiscaliste ou un comptable au regard de la situation complète du
          client. Ce document ne remplace pas les relevés officiels ni les avis de cotisation.
        </Text>
      </View>

      {/* LA MENTION PASSE AU-DESSUS DU PIED — corrigé le 17 août 2026.
          Les deux étaient ancrés au MÊME `bottom: 18` : leurs bandes de texte
          se recouvraient, et le pied gris, peint après, effaçait la mention
          rouge. Le marquage qui doit « survivre à une page photographiée
          isolément » était donc illisible sur chaque PDF autonome. */}
      {piedInterne && (
        <View fixed style={{ position: 'absolute', bottom: 32, left: 44, right: 44 }}>
          <Text style={{ fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#b91c1c' }}>
            Version conseiller — usage interne. Ne pas remettre au client.
          </Text>
        </View>
      )}
      {/* ⚠ LE PIED PORTE LE NOM DU DOCUMENT HÔTE, ET C'EST L'HÔTE QUI LE DIT.
          Intégrée au PDF de cours cibles, la page ne reçoit rien et garde le
          libellé par défaut — un test le verrouille, et c'est juste. Dans le
          document fiscal autonome, l'assembleur passe le sien, le MÊME que
          celui des pages de stratégie.

          Ce qui a disparu ici : un libellé choisi d'après `piedInterne`. Il
          liait le nom du document au drapeau du fiscaliste, deux choses sans
          rapport — et il différait de celui des pages de stratégie du même PDF. */}
      <PageFooterV12 libelle={libelleDocument} />
    </Page>
  );
}
