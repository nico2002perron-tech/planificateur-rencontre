// LA PAGE « CRISTALLISATION DE PERTES » — cinq étapes qu'on descend en parlant.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA MISE EN PAGE VIENT DE `langage-fiscal.tsx`. Ce fichier ne garde que ce qui
// est PROPRE aux pertes : sa palette (le rouge est ici la couleur d'action, on
// crée une perte), sa carte d'action, son étape 4 — trois barres sur une
// échelle commune, qui racontent une SOUSTRACTION — et son étape 5.
//
// Les trois contraintes de rendu et le traitement des valeurs absentes vivent
// désormais dans le module commun, une fois pour toutes. Voir son en-tête.
//
// LA PAGE NE CALCULE RIEN. Elle lit `PresentationCristallisationPertes` et
// dispose. L'union discriminée de l'adaptateur fait qu'une action à confirmer
// n'a littéralement pas de champ « quantité » à afficher par mégarde.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { DiagrammeAvantStrategieApres } from './diagramme-avant-strategie-apres';
import { mentionDate } from './rendu-constat';
import {
  argent, Etape, Carte, Manque, LigneChiffree, EnTeteSociete, CarteChiffre,
  ValidationsAvantExecution as BlocValidations, PageStrategieFiscale,
  NEUTRE, type EnteteStrategie,
} from './langage-fiscal';
import type { PresentationCristallisationPertes } from './presentation-cristallisation-pertes';

/**
 * LA PALETTE DES PERTES — teintes OPAQUES (contrainte 1 du module commun).
 *
 * ⚠ NON FACTORISÉE, ET C'EST UNE DÉCISION. Le rouge est ici la couleur
 * d'ACTION : la stratégie CRÉE une perte. Côté gains c'est le vert, parce
 * qu'on RÉALISE un gain. Le rôle s'inverse, pas la structure — et deux
 * exemples ne suffisent pas à savoir comment paramétrer ça sans se tromper.
 */
const C = {
  action: '#e05252', actionFond: '#fdf0f0', actionBord: '#f3c9c9',
  fiscal: '#2563a8', fiscalFond: '#eef4fb', fiscalBord: '#cbdcf0',
  // Le vert du résultat atteint, et celui de la pastille « confirmé ». Ce sont
  // des teintes de SENS : elles restent ici, pas dans la palette neutre.
  vert: '#3f9142', vertFond: '#e3f3e4',
};

/** L'en-tête du document, porté par la page elle-même — plus par un harnais. */
export const ENTETE_CRISTALLISATION_PERTES: EnteteStrategie = {
  titre: 'Réduire l’impôt sur vos gains de l’année',
  // ⚠ PAS DE SOUS-TITRE AUJOURD'HUI, et c'est un refus explicite plutôt qu'un
  // oubli : le type l'exige, on répond `null`. En ajouter un décalerait toute
  // la page de 13 pt — un changement visuel qui appartient à Nicolas.
  sousTitre: null,
};

export function CarteAction({ p, logos }: {
  p: PresentationCristallisationPertes; logos?: Record<string, string>;
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
          'La quantité à vendre ne peut pas être établie tant que ces éléments ne sont pas confirmés : '
          + a.raisons.join(' · ') + '.'
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
        ACTION PROPOSÉE
      </Text>
      <EnTeteSociete symbole={p.etape1.symbole} description={p.etape1.description} logos={logos} />

      {/* LE CHIFFRE DOMINANT DE LA PAGE — c'est là que l'œil doit tomber. */}
      <Text style={{
        marginTop: 6, fontSize: 28, fontFamily: 'Montserrat', fontWeight: 800, color: C.action,
      }}>
        ≈ {a.quantiteEstimeeAVendre.toLocaleString('fr-CA')} {unite}
      </Text>

      <View style={{ flexDirection: 'row', marginTop: 7 }}>
        <CarteChiffre libelle="Valeur de vente estimée" valeur={a.valeurVenteEstimeeCad} />
        <CarteChiffre libelle="Perte estimée réalisée"
          valeur={a.perteRealiseeEstimeeCad} couleur={C.action} />
      </View>

      <View style={{
        flexDirection: 'row', marginTop: 7, paddingTop: 6,
        borderTopWidth: 1, borderTopColor: C.actionBord, borderTopStyle: 'solid',
      }}>
        <Text style={{ flex: 1, fontSize: 7.2, color: NEUTRE.gris }}>
          Objectif{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
            {argent(a.cibleGlobaleCad)}
          </Text>
        </Text>
        <Text style={{ fontSize: 7.2, color: NEUTRE.gris }}>
          Écart{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: NEUTRE.encre }}>
            {a.ecartCad > 0 ? '+' : ''}{argent(a.ecartCad)}
          </Text>
        </Text>
      </View>
      {a.dateValeurs && (
        <Text style={{ marginTop: 6, fontSize: 6.4, color: NEUTRE.gris, lineHeight: 1.35 }}>
          {/* ⚠ EN TOUTES LETTRES. « 2026-08-21 » est du vocabulaire de machine ;
              `mentionDate` rend « Selon les valeurs au 21 août 2026. » */}
          {mentionDate(a.dateValeurs)} Quantité à actualiser avant l’exécution.
        </Text>
      )}
    </Carte>
  );
}

export function CarteDeclaration({ p }: { p: PresentationCristallisationPertes }) {
  const e5 = p.etape5;
  return (
    <Carte fond={C.fiscalFond} bord={C.fiscalBord}>
      {/* ⚠ `LigneChiffree` porte la règle du tiret : une valeur absente sort en
          gris, jamais dans la couleur du chiffre qu'elle remplace. */}
      <LigneChiffree libelle="Gain en capital net avant" valeur={p.etape4.gainNetAvantCad} />
      <LigneChiffree libelle="Perte estimée réalisée"
        valeur={p.etape4.perteRealiseeEstimeeCad} couleur={C.action} signe="−" />
      <View style={{
        marginTop: 3, paddingTop: 5,
        borderTopWidth: 1, borderTopColor: C.fiscalBord, borderTopStyle: 'solid',
      }}>
        <LigneChiffree libelle="Gain en capital net restant"
          valeur={e5.gainNetApresCad} couleur={C.vert} />
      </View>

      {e5.reductionGainCapitalNetCad !== null ? (
        <View style={{ marginTop: 7 }}>
          <Text style={{ fontSize: 6.8, color: C.fiscal, marginBottom: 2 }}>
            Réduction du gain en capital net
          </Text>
          <Text style={{ fontSize: 20, fontFamily: 'Montserrat', fontWeight: 800, color: C.fiscal }}>
            ≈ {argent(e5.reductionGainCapitalNetCad)}
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 7 }}>
          <Manque texte="La réduction du gain en capital net sera chiffrée une fois les données confirmées." />
        </View>
      )}

      <Text style={{ marginTop: 7, fontSize: 7.4, color: NEUTRE.encre, lineHeight: 1.4 }}>
        {e5.textePrincipal}{e5.texteSecondaire ? ` ${e5.texteSecondaire}` : ''}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 6.8, color: NEUTRE.gris, lineHeight: 1.4 }}>
        Cette réduction peut diminuer les gains en capital pris en compte dans la déclaration
        de revenus, selon les règles fiscales applicables.
      </Text>
    </Carte>
  );
}

export function PageCristallisationPertes({ presentation: p, logos }: {
  presentation: PresentationCristallisationPertes;
  logos?: Record<string, string>;
}) {
  const e1 = p.etape1;
  const usd = e1.deviseNegociation && e1.deviseNegociation.toUpperCase() !== 'CAD';
  return (
    <View>
      <Etape numero={1} titre="Pourquoi cette stratégie ?">
        <Carte>
          <EnTeteSociete symbole={e1.symbole} description={e1.description} logos={logos} />
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <CarteChiffre libelle="Gain en capital net réalisé" valeur={e1.gainNetAvantCad} />
            <CarteChiffre libelle="Perte latente disponible"
              valeur={e1.perteLatenteDisponibleCad} couleur={C.action} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 6.8, color: NEUTRE.gris }}>
            {/* Minuscule : « Compte Non enregistré » se lisait comme un nom propre. */}
            Compte {(e1.compte ?? '—').toLocaleLowerCase('fr-CA')}
            {usd ? `   ·   Négociation : ${e1.deviseNegociation}   ·   Montants fiscaux : ${e1.uniteValeursRapport}` : ''}
          </Text>
        </Carte>
      </Etape>

      <Etape numero={2} titre="Pourquoi ce titre ?">
        <Carte>
          {p.etape2.raisonSelection
            ? <Text style={{ fontSize: 8, color: NEUTRE.encre, lineHeight: 1.5 }}>{p.etape2.raisonSelection}</Text>
            : <Manque texte="Le titre à retenir sera déterminé une fois les données du dossier confirmées." />}
        </Carte>
      </Etape>

      <Etape numero={3} titre="Combien vendre ?" teinte={C.action}>
        <CarteAction p={p} logos={logos} />
      </Etape>

      <Etape numero={4} titre="Quel effet ?">
        <Carte><DiagrammeAvantStrategieApres {...p.etape4} /></Carte>
      </Etape>

      <Etape numero={5} titre="Effet sur la déclaration de revenus" teinte={C.fiscal}>
        <CarteDeclaration p={p} />
      </Etape>

      {/* ⚠ LA TEINTE DE « CONFIRMÉ » EST DITE ICI, pas héritée du module
          commun : les deux stratégies ne la rendaient pas pareil. Les pertes
          peignent la pastille en vert sur fond vert — c'est leur choix, mesuré
          sur le code d'origine, pas une valeur par défaut du langage. */}
      <BlocValidations validations={p.validationsAvantExecution}
        apparenceConfirme={{ fond: C.vertFond, texte: C.vert }} />
    </View>
  );
}

/**
 * LA PAGE COMPLÈTE — en-tête compris, prête à être posée dans un `Document`.
 *
 * C'est CETTE forme que le vrai flux consommera : le titre ne peut plus être
 * oublié par un assembleur, ni recomposé différemment par chaque harnais.
 */
export function PageStrategieCristallisationPertes({ presentation, logos, pied }: {
  presentation: PresentationCristallisationPertes;
  logos?: Record<string, string>;
  pied?: React.ReactNode;
}) {
  return (
    <PageStrategieFiscale entete={ENTETE_CRISTALLISATION_PERTES} pied={pied}>
      <PageCristallisationPertes presentation={presentation} logos={logos} />
    </PageStrategieFiscale>
  );
}
