// LA PAGE « CRISTALLISATION DE GAINS » — même langage, autre histoire.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA MISE EN PAGE VIENT DE `langage-fiscal.tsx`, comme celle des pertes. Ce
// fichier ne garde que ce qui est PROPRE aux gains.
//
// ⚠ ET CE N'EST PAS LA MÊME HISTOIRE. Les pertes racontent une soustraction ;
// les gains racontent l'emploi d'une capacité qui dort déjà au dossier.
// L'étape 4 n'est donc pas le diagramme « avant / stratégie / après » mais un
// parcours dans le temps — voir `parcours-gain-cristallise.tsx`.
//
// ⚠ CE FICHIER N'IMPORTE PLUS RIEN DE LA PAGE DES PERTES. Il l'a fait un
// moment — `EnTeteSociete` et `CarteChiffre` y étaient logés — et c'était une
// dépendance entre deux stratégies sœurs qui n'ont aucune raison de se
// connaître. Les deux passent maintenant par le module commun.
//
// Les trois contraintes de rendu et le traitement des valeurs absentes vivent
// dans ce module commun, une fois pour toutes. Voir son en-tête.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { ParcoursGainCristallise } from './parcours-gain-cristallise';
import { mentionDate } from './rendu-constat';
import {
  argent, Etape, Carte, Manque, LigneChiffree, EnTeteSociete, CarteChiffre,
  ValidationsAvantExecution as BlocValidations, PageStrategieFiscale,
  NEUTRE, type EnteteStrategie,
} from './langage-fiscal';
import {
  TITRE_PRESENTATION, SOUS_TITRE_PRESENTATION,
  type PresentationCristallisationGains,
} from './presentation-cristallisation-gains';

/**
 * LA PALETTE DES GAINS — teintes OPAQUES (contrainte 1 du module commun).
 *
 * ⚠ LE VERT EST LA COULEUR D'ACTION ICI, pas le rouge : on RÉALISE un gain, on
 * ne crée pas une perte. Même structure que celle des pertes, rôle inversé —
 * c'est ce qui distingue les deux pages sans changer de langage, et c'est
 * exactement pour ça que les deux palettes restent séparées.
 */
const C = {
  action: '#2f8f4e', actionFond: '#eef7f1', actionBord: '#c9e5d4',
  cible: '#2563a8', cibleFond: '#eef4fb', cibleBord: '#cbdcf0',
};

/** L'en-tête du document, porté par la page elle-même — plus par un harnais. */
export const ENTETE_CRISTALLISATION_GAINS: EnteteStrategie = {
  titre: TITRE_PRESENTATION,
  sousTitre: SOUS_TITRE_PRESENTATION,
};

function CarteActionGain({ p, logos }: {
  p: PresentationCristallisationGains; logos?: Record<string, string>;
}) {
  const a = p.etape3.action;
  if (a.type !== 'ferme') {
    return (
      <Carte fond={C.actionFond} bord={C.actionBord}>
        <Text style={{
          fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600,
          color: C.action, letterSpacing: 0.7, marginBottom: 6,
        }}>
          QUANTITÉ À CONFIRMER
        </Text>
        <Manque texte={
          'La quantité à vendre ne peut pas être établie tant que ces éléments ne sont pas '
          + `confirmés : ${a.raisons.join(' · ')}.`
        } />
      </Carte>
    );
  }
  const unite = a.uniteQuantite === 'part' ? 'parts' : 'actions';
  return (
    <Carte fond={C.actionFond} bord={C.actionBord}>
      <Text style={{
        fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600,
        color: C.action, letterSpacing: 0.7, marginBottom: 7,
      }}>
        ACTION ESTIMÉE
      </Text>
      <EnTeteSociete symbole={p.etape3.symbole} description={p.etape3.description} logos={logos} />
      <Text style={{
        marginTop: 6, fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.action,
      }}>
        ≈ {a.quantiteEstimeeAVendre.toLocaleString('fr-CA')} {unite}
      </Text>

      <View style={{ flexDirection: 'row', marginTop: 7 }}>
        <CarteChiffre libelle="Valeur de vente estimée" valeur={a.valeurVenteEstimeeCad} />
        <CarteChiffre libelle="Gain réalisé estimé"
          valeur={a.gainRealiseEstimeCad} couleur={C.action} />
      </View>

      {/* ⚠ LES −15 $ RESTENT DANS LE BLOC CHIFFRÉ. La phrase d'explication vient
          APRÈS, en dessous : elle explique les chiffres, elle ne les remplace
          pas. Les cacher rendrait le document moins crédible, pas plus simple. */}
      <View style={{
        flexDirection: 'row', marginTop: 7, paddingTop: 6,
        borderTopWidth: 1, borderTopColor: C.actionBord, borderTopStyle: 'solid',
      }}>
        <Text style={{ flex: 1, fontSize: 7.2, color: NEUTRE.gris }}>
          Objectif{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
            {argent(a.cibleGainCad)}
          </Text>
        </Text>
        <Text style={{ fontSize: 7.2, color: NEUTRE.gris }}>
          Écart estimé{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
            {a.ecartCad > 0 ? '+' : ''}{argent(a.ecartCad)}
          </Text>
        </Text>
      </View>

      {p.etape3.precisionGranularite && (
        <Text style={{ marginTop: 6, fontSize: 6.8, color: NEUTRE.gris, lineHeight: 1.4 }}>
          {p.etape3.precisionGranularite}
        </Text>
      )}
      {a.dateValeurs && (
        <Text style={{ marginTop: 4, fontSize: 6.4, color: NEUTRE.gris, lineHeight: 1.35 }}>
          {mentionDate(a.dateValeurs)} Quantité à actualiser avant l’exécution.
        </Text>
      )}
    </Carte>
  );
}

export function PageCristallisationGains({ presentation: p, logos }: {
  presentation: PresentationCristallisationGains;
  logos?: Record<string, string>;
}) {
  const e1 = p.etape1;
  const e5 = p.etape5;
  const usd = p.etape3.deviseNegociation
    && p.etape3.deviseNegociation.toUpperCase() !== 'CAD';

  return (
    <View>
      <Etape numero={1} titre="Des pertes fiscales sont disponibles">
        <Carte>
          <View style={{ flexDirection: 'row' }}>
            <CarteChiffre libelle="Pertes fiscales disponibles"
              valeur={e1.pertesDisponiblesCad} couleur={C.cible} />
            <CarteChiffre libelle="Gains latents disponibles" valeur={e1.gainsLatentsCad} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 7.4, color: NEUTRE.encre, lineHeight: 1.45 }}>
            {e1.texte}
          </Text>
        </Carte>
      </Etape>

      <Etape numero={2} titre="Quel gain peut être réalisé ?" teinte={C.cible}>
        <Carte fond={C.cibleFond} bord={C.cibleBord}>
          <Text style={{ fontSize: 6.8, color: C.cible, marginBottom: 2 }}>Gain ciblé</Text>
          {/* ⚠ LE TEXTE NE S'AFFICHE QU'UNE FOIS. Quand la cible manque, la phrase
              EST le repli — la répéter en dessous se lisait comme un bogue de
              gabarit sur le PDF dégradé. Vu, puis corrigé. */}
          {p.etape2.cibleGainCad === null ? (
            <Manque texte={p.etape2.texte} />
          ) : (
            <>
              <Text style={{ fontSize: 22, fontFamily: 'Montserrat', fontWeight: 800, color: C.cible }}>
                ≈ {argent(p.etape2.cibleGainCad)}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 7.4, color: NEUTRE.encre, lineHeight: 1.45 }}>
                {p.etape2.texte}
              </Text>
            </>
          )}
        </Carte>
      </Etape>

      <Etape numero={3} titre="Quel titre et quelle quantité ?" teinte={C.action}>
        <CarteActionGain p={p} logos={logos} />
        {usd && (
          <Text style={{ marginTop: 4, fontSize: 6.6, color: NEUTRE.gris }}>
            Négociation : {p.etape3.deviseNegociation}   ·   Montants fiscaux : {p.etape3.uniteValeursRapport}
          </Text>
        )}
      </Etape>

      {/* ⚠ PAS DE CARTE AUTOUR DU PARCOURS. Chaque jalon EST déjà une carte
          bordée ; le cadre extérieur faisait un second cadre imbriqué — du bruit
          visuel, et 22 pt qui repoussaient l'étape entière à la page suivante.
          L'étape 4 des pertes n'a qu'un seul cadre elle aussi. */}
      <Etape numero={4} titre="Qu’est-ce que cela change pour la position ?">
        <ParcoursGainCristallise {...p.etape4} />
      </Etape>

      <Etape numero={5} titre="Quel est l’effet fiscal estimé ?" teinte={C.cible}>
        <Carte fond={C.cibleFond} bord={C.cibleBord}>
          {/* ⚠ `LigneChiffree` porte la règle du tiret : une valeur absente sort
              en gris, jamais dans la couleur du chiffre qu'elle remplace. */}
          <LigneChiffree libelle="Pertes fiscales disponibles"
            valeur={e5.pertesDisponiblesCad} couleur={C.cible} />
          <LigneChiffree libelle="Gain réalisé estimé"
            valeur={e5.gainRealiseEstimeCad} couleur={C.action} />
          <View style={{
            marginTop: 3, paddingTop: 5,
            borderTopWidth: 1, borderTopColor: C.cibleBord, borderTopStyle: 'solid',
          }}>
            <LigneChiffree libelle="Capacité encore disponible"
              valeur={e5.capaciteEncoreDisponibleCad} />
          </View>
          <Text style={{ marginTop: 7, fontSize: 7.4, color: NEUTRE.encre, lineHeight: 1.45 }}>
            {e5.texte}
          </Text>
        </Carte>
      </Etape>

      {/* ⚠ LA TEINTE DE « CONFIRMÉ » EST DITE ICI. Les gains laissaient la
          pastille NEUTRE quel que soit le statut — on conserve ce rendu tel
          quel plutôt que d'hériter du vert des pertes. */}
      <BlocValidations validations={p.validationsAvantExecution}
        apparenceConfirme={{ fond: NEUTRE.fond, texte: NEUTRE.gris }} />
    </View>
  );
}

/**
 * LA PAGE COMPLÈTE — en-tête compris, prête à être posée dans un `Document`.
 *
 * C'est CETTE forme que le vrai flux consommera : le titre ne peut plus être
 * oublié par un assembleur, ni recomposé différemment par chaque harnais.
 */
export function PageStrategieCristallisationGains({ presentation, logos, pied }: {
  presentation: PresentationCristallisationGains;
  logos?: Record<string, string>;
  pied?: React.ReactNode;
}) {
  return (
    <PageStrategieFiscale entete={ENTETE_CRISTALLISATION_GAINS} pied={pied}>
      <PageCristallisationGains presentation={presentation} logos={logos} />
    </PageStrategieFiscale>
  );
}
