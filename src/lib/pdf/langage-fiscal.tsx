// LE LANGAGE VISUEL COMMUN DES PAGES DE STRATÉGIE FISCALE.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE MODULE NE CONTIENT QUE CE QUI EST PROUVÉ IDENTIQUE.
//
// Deux stratégies ont été dessinées, inspectées sur PDF réel, puis comparées :
// `docs/comparaison-pertes-gains-2026-08-23.md`. Ce qui se trouve ici est la
// colonne « générique tel quel » de cette comparaison — du code qui existait en
// DOUBLE, à l'octet près, dans les deux pages.
//
// ⚠ CE QUI N'EST PAS ICI, ET NE DOIT PAS Y VENIR :
//   · les palettes — le rouge est la couleur d'action des pertes, le vert celle
//     des gains ; c'est le RÔLE qui s'inverse, et deux exemples ne suffisent pas
//     à savoir comment le paramétrer ;
//   · les cartes d'action — même anatomie, libellés différents, une ligne de
//     précision en plus côté gains ;
//   · les étapes 4 — trois barres sur une échelle commune racontent une
//     SOUSTRACTION, trois jalons reliés racontent une SÉQUENCE dans le temps.
//     Un composant à deux modes ne partagerait que le mot « trois » ;
//   · les étapes 5 et les validations, dont les DONNÉES sont propres à chaque
//     stratégie (la perte apparente n'existe pas côté gains).
//
// ─────────────────────────────────────────────────────────────────────────────
// LES TROIS CONTRAINTES DE RENDU, CHACUNE NÉE D'UN VRAI BUG REGARDÉ SUR PDF.
// Elles survivent à l'extraction parce qu'elles vivent maintenant ICI, une fois
// pour toutes, au lieu d'être répétées dans chaque page :
//
//   1. JAMAIS `#rrggbbaa`. react-pdf ne gère pas l'alpha hexadécimal à huit
//      chiffres et rend une couleur arbitraire — un `#ffffff55` sortait VERT
//      sur une barre grise. Toute transparence passe par une teinte opaque.
//   2. JAMAIS UNE ZONE VIDE POUR UNE DONNÉE INDISPONIBLE. Un blanc se lit
//      « le document est cassé » plutôt que « la donnée manque ». D'où `Manque`.
//   3. JAMAIS UN GLYPHE ABSENT DES POLICES EMBARQUÉES. Un « ↓ » (U+2193)
//      sortait en petits guillemets, un « ⚠ » (U+26A0) en carré vide. Ce qui
//      doit pointer se DESSINE avec des `View`.
//
//   Et le correctif qui a dû être appliqué DEUX FOIS avant cette extraction :
//   4. UNE VALEUR ABSENTE PORTE LA COULEUR DU TEXTE SECONDAIRE, jamais celle du
//      sens. Un « — » peint en vert — la couleur du gain — se lit comme un
//      montant. Voir `LigneChiffree`, et les tests PG15 / V19 qui le prouvent
//      des deux côtés à la fois.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import { LogoSocieteFiscal } from './logo-societe-fiscal';
import { PageFooterV12 } from './year-activity-pages';
import { argent } from './rendu-constat';
import type { LigneExecution } from '@/lib/profils/plan-execution';
import {
  FORMAT_PAGE_FISCALE, ORIENTATION_PAGE_FISCALE, STYLE_PAGE_FISCALE,
} from './page-fiscale';

/**
 * Les teintes NEUTRES, communes aux deux stratégies. Opaques (contrainte 1).
 *
 * ⚠ AUCUNE COULEUR DE SENS ICI. Le vert de « confirmé » n'y figure pas : c'est
 * une teinte de SENS, elle appartient à la stratégie qui l'emploie. Une palette
 * « neutre » qui hébergerait un vert d'approbation serait une factorisation
 * déguisée — et celle-là a effectivement imposé, un instant, le rendu des
 * pertes à celui des gains.
 */
export const NEUTRE = {
  encre: '#1e293b',
  gris: '#64748b',
  ligne: '#e2e8f0',
  papier: '#ffffff',
  badge: '#334155',
  fond: '#f1f5f9',
  page: '#f8fafc',
} as const;

/** Le bleu nuit des titres du document — celui de `styles.ts`. */
const NAVY = '#03045e';

/** Le pied de page du document fiscal — pas celui des cours cibles. */
export const LIBELLE_PIED_FISCAL = 'Groupe Financier Ste-Foy — Optimisations fiscales';

// Le formateur canonique vit dans `rendu-constat`, qui ignore le moteur de
// rendu — l'adaptateur de présentation en a besoin sans dépendre du PDF.
export { argent } from './rendu-constat';
export type { ValidationAvantExecution } from './rendu-constat';
import type { ValidationAvantExecution } from './rendu-constat';

/**
 * L'EN-TÊTE D'UNE PAGE DE STRATÉGIE.
 *
 * ⚠ LES DEUX CHAMPS SONT OBLIGATOIRES, `sousTitre` étant explicitement
 * nullable. C'est délibéré : on peut REFUSER un sous-titre, on ne peut pas
 * l'OUBLIER. Jusqu'ici le titre était posé par le harnais d'aperçu, chacun à sa
 * façon, et une stratégie branchée dans le vrai flux serait sortie anonyme.
 */
export type EnteteStrategie = {
  titre: string;
  sousTitre: string | null;
  /**
   * Le filet de couleur sous le titre.
   *
   * ⚠ OBLIGATOIRE, ET PROPRE À LA STRATÉGIE. La page de synthèse porte le même
   * filet en or ; c'est ce trait qui fait que les pages de stratégie se lisent
   * comme des chapitres du MÊME document et non comme des feuilles rapportées.
   * La teinte, elle, reste celle de la stratégie — c'est ce qui les distingue.
   */
  accent: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// LES PRIMITIVES DE MISE EN PAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * UNE ÉTAPE — pastille numérotée + titre, puis son contenu.
 *
 * `wrap={false}` : une étape coupée en deux par un saut de page se lit comme un
 * document abîmé. Mieux vaut la pousser entière à la page suivante.
 */
export function Etape({ numero, titre, children, teinte = NEUTRE.badge }: {
  numero: number; titre: string; children: React.ReactNode; teinte?: string;
}) {
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
        <View style={{
          width: 19, height: 19, borderRadius: 9.5, backgroundColor: teinte,
          alignItems: 'center', justifyContent: 'center', marginRight: 7,
        }}>
          <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
            {numero}
          </Text>
        </View>
        <Text style={{ fontSize: 10.5, fontFamily: 'Montserrat', fontWeight: 800, color: NEUTRE.encre }}>
          {titre}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function Carte({ children, fond = NEUTRE.papier, bord = NEUTRE.ligne }: {
  children: React.ReactNode; fond?: string; bord?: string;
}) {
  return (
    <View style={{
      borderRadius: 12, padding: 10, backgroundColor: fond,
      borderWidth: 1, borderColor: bord, borderStyle: 'solid',
    }}>
      {children}
    </View>
  );
}

/** LE REPLI D'UNE SECTION : il DIT ce qui manque (contrainte 2). */
export function Manque({ texte }: { texte: string }) {
  return (
    <View style={{
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: NEUTRE.fond,
    }}>
      <Text style={{ fontSize: 7.4, color: NEUTRE.gris, lineHeight: 1.4 }}>{texte}</Text>
    </View>
  );
}

/**
 * UNE LIGNE CHIFFRÉE — libellé à gauche, montant à droite.
 *
 * ⚠ C'EST ICI QUE VIT LA CONTRAINTE 4, et le fait qu'elle vive à un seul
 * endroit est toute la raison d'être de ce module : avant l'extraction, le
 * même défaut — un tiret peint de la couleur du chiffre qu'il remplace — a dû
 * être trouvé, corrigé et verrouillé DEUX FOIS. Un sabotage de cette ligne fait
 * maintenant rougir les batteries des deux stratégies d'un coup.
 */
export function LigneChiffree({ libelle, valeur, couleur = NEUTRE.encre, signe = '' }: {
  libelle: string; valeur: number | null; couleur?: string; signe?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={{ flex: 1, fontSize: 7.6, color: NEUTRE.gris }}>{libelle}</Text>
      <Text style={{
        fontSize: 8.6, fontFamily: 'Montserrat', fontWeight: 700,
        color: valeur === null ? NEUTRE.gris : couleur,
      }}>
        {valeur === null ? '—' : `${signe}${argent(valeur)}`}
      </Text>
    </View>
  );
}

/** L'identité du titre : sa pastille (ou son logo mémorisé) et son nom. */
export function EnTeteSociete({ symbole, description, logos, taille = 26 }: {
  symbole: string | null; description: string | null;
  logos?: Record<string, string>; taille?: number;
}) {
  if (!symbole) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LogoSocieteFiscal symbole={symbole} logos={logos} taille={taille} />
      <View style={{ marginLeft: 8 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: NEUTRE.encre }}>
          {symbole}
        </Text>
        {description && (
          <Text style={{ fontSize: 7.4, color: NEUTRE.gris, marginTop: 1 }}>{description}</Text>
        )}
      </View>
    </View>
  );
}

/**
 * UN CHIFFRE AVEC SON LIBELLÉ.
 *
 * ⚠ LA CONTRAINTE 4 S'APPLIQUE ICI AUSSI, et elle y était contournée : les deux
 * pages passaient `valeur={x === null ? '—' : argent(x)}` AVEC une couleur
 * d'action, si bien qu'une donnée absente sortait en rouge côté pertes et en
 * bleu côté gains. Le même défaut que le tiret de `LigneChiffree`, dans un
 * autre composant — trouvé parce qu'on a cherché la règle et pas le symptôme.
 *
 * La valeur devient donc `number | null` : c'est le composant qui décide du
 * tiret et de sa couleur, plus l'appelant.
 */
export function CarteChiffre({ libelle, valeur, couleur = NEUTRE.encre }: {
  libelle: string; valeur: number | null; couleur?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 6.6, color: NEUTRE.gris, marginBottom: 2 }}>{libelle}</Text>
      <Text style={{
        fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800,
        color: valeur === null ? NEUTRE.gris : couleur,
      }}>
        {valeur === null ? '—' : argent(valeur)}
      </Text>
    </View>
  );
}

/**
 * L'APPARENCE D'UNE PASTILLE « CONFIRMÉ ».
 *
 * ⚠ SANS DÉFAUT, ET C'EST TOUT L'INTÉRÊT. Les deux pages ne rendaient PAS ce
 * statut de la même façon avant l'extraction : les pertes peignaient la
 * pastille en vert sur fond vert, les gains la laissaient grise quel que soit
 * le statut. Fusionner les deux aurait imposé le rendu d'une stratégie à
 * l'autre — exactement ce que « n'extraire que ce qui est identique » interdit.
 *
 * La structure est commune, la teinte de sens reste à l'appelant. Sans valeur
 * par défaut, personne ne peut hériter du choix du voisin par inadvertance.
 */
export type ApparenceConfirme = { fond: string; texte: string };

/**
 * LE BLOC « AVANT D'EXÉCUTER ».
 *
 * ⚠ « Confirmé » exige une donnée AFFIRMATIVE. Une pastille cochée faute de
 * motif contraire serait un faux vert : l'absence d'un signal ne prouve rien.
 */
export function ValidationsAvantExecution({ validations, apparenceConfirme }: {
  validations: ValidationAvantExecution[];
  apparenceConfirme: ApparenceConfirme;
}) {
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{
        fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600,
        color: NEUTRE.gris, letterSpacing: 0.6, marginBottom: 5,
      }}>
        AVANT D’EXÉCUTER
      </Text>
      {validations.map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <View style={{
            borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1.5, marginRight: 6,
            backgroundColor: v.statut === 'confirme' ? apparenceConfirme.fond : NEUTRE.fond,
          }}>
            <Text style={{
              fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600,
              color: v.statut === 'confirme' ? apparenceConfirme.texte : NEUTRE.gris,
            }}>
              {v.statut === 'confirme' ? 'Confirmé' : 'À confirmer'}
            </Text>
          </View>
          <Text style={{ fontSize: 7.4, color: NEUTRE.encre }}>{v.libelle}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * LA LISTE DES TRANSACTIONS D'UN PLAN À PLUSIEURS TITRES.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ UNE SEULE PRIMITIVE POUR LES DEUX STRATÉGIES. Les pertes et les gains
 * racontent des histoires différentes, mais « voici les ordres à passer » est
 * la même phrase des deux côtés : mêmes colonnes, même totalisation. Deux
 * composants séparés auraient divergé au premier ajustement.
 *
 * ⚠ ET AUCUNE LIGNE N'EST PERDUE NI CHOISIE. Afficher `lignes[0]` comme si
 * elle portait le plan entier réintroduirait exactement la divergence que le
 * plan canonique vient de supprimer — la carte de synthèse disait un titre, la
 * page détaillée en disait un autre.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function ListeTransactions({
  lignes, couleur, bord, libelleMontant, valeurVenteTotaleCad,
  montantRealiseTotalCad, cibleCad, ecartCad,
}: {
  lignes: LigneExecution[];
  couleur: string;
  bord: string;
  /** « de perte » ou « de gain » — le mot que le total porte. */
  libelleMontant: string;
  valeurVenteTotaleCad: number;
  montantRealiseTotalCad: number;
  cibleCad: number;
  ecartCad: number;
}) {
  return (
    <View>
      {/* L'EN-TÊTE DU TABLEAU — sans lui, quatre nombres alignés ne disent pas
          ce qu'ils sont. */}
      <View style={{
        flexDirection: 'row', paddingBottom: 3, marginBottom: 3,
        borderBottomWidth: 0.8, borderBottomColor: bord, borderBottomStyle: 'solid',
      }}>
        <Text style={{ flex: 1.4, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: NEUTRE.gris }}>
          Titre
        </Text>
        <Text style={{ flex: 1.3, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: NEUTRE.gris }}>
          Quantité
        </Text>
        <Text style={{ flex: 1.2, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: NEUTRE.gris, textAlign: 'right' }}>
          Vente estimée
        </Text>
        <Text style={{ flex: 1.2, fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: NEUTRE.gris, textAlign: 'right' }}>
          {libelleMontant}
        </Text>
      </View>

      {lignes.map((l) => (
        <View key={l.positionId} style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 }}>
          <View style={{ flex: 1.4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: NEUTRE.encre }}>
              {l.symbole}
            </Text>
            {l.description && (
              <Text style={{ fontSize: 6.2, color: NEUTRE.gris }}>{l.description}</Text>
            )}
          </View>
          <Text style={{ flex: 1.3, fontSize: 9, fontFamily: 'Montserrat', fontWeight: 800, color: couleur }}>
            ≈ {l.quantiteAVendre.toLocaleString('fr-CA')} {l.uniteQuantite === 'part' ? 'parts' : 'actions'}
          </Text>
          <Text style={{ flex: 1.2, fontSize: 7.6, color: NEUTRE.encre, textAlign: 'right' }}>
            {argent(l.valeurVenteEstimeeCad)}
          </Text>
          <Text style={{
            flex: 1.2, fontSize: 7.6, fontFamily: 'Montserrat', fontWeight: 700,
            color: couleur, textAlign: 'right',
          }}>
            {argent(l.montantRealiseEstimeCad)}
          </Text>
        </View>
      ))}

      {/* LE PIED — total, objectif, écart. Les trois se lisent ensemble. */}
      <View style={{
        marginTop: 4, paddingTop: 5,
        borderTopWidth: 1, borderTopColor: bord, borderTopStyle: 'solid',
      }}>
        <View style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={{ flex: 2.7, fontSize: 7.2, color: NEUTRE.gris }}>
            Total — {lignes.length} transactions
          </Text>
          <Text style={{ flex: 1.2, fontSize: 7.6, fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre, textAlign: 'right' }}>
            {argent(valeurVenteTotaleCad)}
          </Text>
          <Text style={{ flex: 1.2, fontSize: 7.6, fontFamily: 'Montserrat', fontWeight: 800, color: couleur, textAlign: 'right' }}>
            {argent(montantRealiseTotalCad)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ flex: 1, fontSize: 7.2, color: NEUTRE.gris }}>
            Objectif{'   '}
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
              {argent(cibleCad)}
            </Text>
          </Text>
          <Text style={{ fontSize: 7.2, color: NEUTRE.gris }}>
            Écart estimé{'   '}
            <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
              {ecartCad > 0 ? '+' : ''}{argent(ecartCad)}
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ASSEMBLAGE — la frontière qui empêche une stratégie de sortir anonyme
// ═══════════════════════════════════════════════════════════════════════════

export function EnTeteStrategie({ entete }: { entete: EnteteStrategie }) {
  // ⚠ LA MÊME GRAMMAIRE QUE `SectionHeader` DE LA PAGE DE SYNTHÈSE : 16 pt
  // Montserrat, filet de 1,5 pt, sous-titre gris. Le titre était en 13 pt sans
  // filet — cohérent avec son aperçu isolé, étranger au document réel. Regardé
  // sur PDF avant d'être adopté.
  return (
    <View style={{
      marginBottom: 18, paddingBottom: 9,
      borderBottomWidth: 1.5, borderBottomColor: entete.accent, borderBottomStyle: 'solid',
    }}>
      <Text style={{ fontSize: 16, fontFamily: 'Montserrat', fontWeight: 800, color: NAVY }}>
        {entete.titre}
      </Text>
      {entete.sousTitre && (
        <Text style={{ marginTop: 4, fontSize: 7.5, color: NEUTRE.gris }}>
          {entete.sousTitre}
        </Text>
      )}
    </View>
  );
}

/**
 * LA PAGE D'UNE STRATÉGIE — en-tête compris.
 *
 * ⚠ `entete` EST OBLIGATOIRE. C'était le trou : les deux pages rendaient leurs
 * cinq étapes sans jamais se nommer, et c'est le harnais d'aperçu qui ajoutait
 * un titre — chacun le sien, hors de toute vérification. Une stratégie branchée
 * dans le vrai flux serait sortie sans titre, et rien n'aurait rougi.
 *
 * Le titre est maintenant rendu ICI, une seule fois. Un harnais qui en
 * rajouterait un ferait doublon, et le test d'assemblage le voit.
 */
export function PageStrategieFiscale({ entete, pied, libellePied, children }: {
  entete: EnteteStrategie;
  /** Mention de pied éventuelle (usage interne) — un nœud, jamais un import. */
  pied?: React.ReactNode;
  /** Le libellé du pied de page, quand le document en impose un. */
  libellePied?: string;
  children: React.ReactNode;
}) {
  return (
    // ⚠ LE FORMAT ET LE FOND VIENNENT DU CONTRAT COMMUN, pas d'ici. Ces pages
    // étaient en LETTER sur #f8fafc parce que leur APERÇU l'était ; le document
    // remis est en A4 sur #fffdf9. Voir `page-fiscale.ts` pour l'arbitrage.
    <Page
      size={FORMAT_PAGE_FISCALE}
      orientation={ORIENTATION_PAGE_FISCALE}
      style={STYLE_PAGE_FISCALE}
    >
      <EnTeteStrategie entete={entete} />
      {children}
      {pied}
      {/* ⚠ LE PIED EST POSÉ ICI, PAS PAR L'APPELANT. Une page sans numéro dans
          un document numéroté est un trou : les pages de stratégie sortaient
          sans pied ni pagination pendant que la synthèse affichait « 3 / 7 ». */}
      {/* ⚠ ET SON LIBELLÉ NOMME LE BON DOCUMENT. Le défaut par défaut de
          `PageFooterV12` est « Analyse des cours cibles 1.2 » : vu sur PDF, une
          page de stratégie fiscale portait en pied le nom d'un autre rapport. */}
      <PageFooterV12 libelle={libellePied ?? LIBELLE_PIED_FISCAL} />
    </Page>
  );
}
