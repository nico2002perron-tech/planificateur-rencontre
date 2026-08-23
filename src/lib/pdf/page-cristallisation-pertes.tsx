// LA PAGE « CRISTALLISATION DE PERTES » — cinq étapes qu'on descend en parlant.
//
// ─────────────────────────────────────────────────────────────────────────────
// DEUX CONTRAINTES DE RENDU, APPRISES EN REGARDANT LE PREMIER PDF :
//
//   1. JAMAIS `#rrggbbaa`. react-pdf ne gère pas l'alpha hexadécimal à huit
//      chiffres et rend une couleur arbitraire — un `#ffffff55` sortait VERT
//      sur une barre grise. Toute transparence passe par une teinte opaque
//      calculée à la main.
//   2. UN ÉTAT NON AFFICHABLE DIT POURQUOI. Un blanc se lit « le document est
//      cassé » plutôt que « la donnée manque ». Chaque section a sa phrase de
//      repli.
//
// LA PAGE NE CALCULE RIEN. Elle lit `PresentationCristallisationPertes` et
// dispose. L'union discriminée de l'adaptateur fait qu'une action à confirmer
// n'a littéralement pas de champ « quantité » à afficher par mégarde.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { LogoSocieteFiscal } from './logo-societe-fiscal';
import { DiagrammeAvantStrategieApres } from './diagramme-avant-strategie-apres';
import { mentionDate } from './rendu-constat';
import type { PresentationCristallisationPertes } from './presentation-cristallisation-pertes';

const argent = (n: number) => `${n.toLocaleString('fr-CA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} $`;

/** Teintes OPAQUES — voir la contrainte 1 en tête de fichier. */
const C = {
  encre: '#1e293b', gris: '#64748b', ligne: '#e2e8f0', papier: '#ffffff',
  action: '#e05252', actionFond: '#fdf0f0', actionBord: '#f3c9c9',
  fiscal: '#2563a8', fiscalFond: '#eef4fb', fiscalBord: '#cbdcf0',
  badge: '#334155', vert: '#3f9142', vertFond: '#e3f3e4',
};

function Etape({ numero, titre, children, teinte = C.badge }: {
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
        <Text style={{ fontSize: 10.5, fontFamily: 'Montserrat', fontWeight: 800, color: C.encre }}>
          {titre}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Carte({ children, fond = C.papier, bord = C.ligne }: {
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

export function EnTeteSociete({ symbole, description, logos, taille = 26 }: {
  symbole: string | null; description: string | null;
  logos?: Record<string, string>; taille?: number;
}) {
  if (!symbole) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <LogoSocieteFiscal symbole={symbole} logos={logos} taille={taille} />
      <View style={{ marginLeft: 8 }}>
        <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: C.encre }}>
          {symbole}
        </Text>
        {description && (
          <Text style={{ fontSize: 7.4, color: C.gris, marginTop: 1 }}>{description}</Text>
        )}
      </View>
    </View>
  );
}

export function CarteChiffre({ libelle, valeur, couleur = C.encre }: {
  libelle: string; valeur: string; couleur?: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 6.6, color: C.gris, marginBottom: 2 }}>{libelle}</Text>
      <Text style={{ fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: couleur }}>
        {valeur}
      </Text>
    </View>
  );
}

/** Le repli d'une section : il DIT ce qui manque (contrainte 2). */
function Manque({ texte }: { texte: string }) {
  return (
    <View style={{
      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#f1f5f9',
    }}>
      <Text style={{ fontSize: 7.4, color: C.gris, lineHeight: 1.4 }}>{texte}</Text>
    </View>
  );
}

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
        <CarteChiffre libelle="Valeur de vente estimée" valeur={argent(a.valeurVenteEstimeeCad)} />
        <CarteChiffre libelle="Perte estimée réalisée"
          valeur={argent(a.perteRealiseeEstimeeCad)} couleur={C.action} />
      </View>

      <View style={{
        flexDirection: 'row', marginTop: 7, paddingTop: 6,
        borderTopWidth: 1, borderTopColor: C.actionBord, borderTopStyle: 'solid',
      }}>
        <Text style={{ flex: 1, fontSize: 7.2, color: C.gris }}>
          Objectif{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: C.encre }}>
            {argent(a.cibleGlobaleCad)}
          </Text>
        </Text>
        <Text style={{ fontSize: 7.2, color: C.gris }}>
          Écart{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: C.encre }}>
            {a.ecartCad > 0 ? '+' : ''}{argent(a.ecartCad)}
          </Text>
        </Text>
      </View>
      {a.dateValeurs && (
        <Text style={{ marginTop: 6, fontSize: 6.4, color: C.gris, lineHeight: 1.35 }}>
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
  // ⚠ UN TIRET N'EST PAS UNE VALEUR. Peint en vert — la couleur du gain net
  // restant — il se lit comme un montant sur le PDF dégradé. Défaut repéré en
  // inspectant la page des gains ; c'est le même défaut, corrigé aux deux.
  const ligne = (libelle: string, valeur: number | null, couleur = C.encre, signe = '') => (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={{ flex: 1, fontSize: 7.6, color: C.gris }}>{libelle}</Text>
      <Text style={{
        fontSize: 8.6, fontFamily: 'Montserrat', fontWeight: 700,
        color: valeur === null ? C.gris : couleur,
      }}>
        {valeur === null ? '—' : `${signe}${argent(valeur)}`}
      </Text>
    </View>
  );
  return (
    <Carte fond={C.fiscalFond} bord={C.fiscalBord}>
      {ligne('Gain en capital net avant', p.etape4.gainNetAvantCad)}
      {ligne('Perte estimée réalisée', p.etape4.perteRealiseeEstimeeCad, C.action, '−')}
      <View style={{
        marginTop: 3, paddingTop: 5,
        borderTopWidth: 1, borderTopColor: C.fiscalBord, borderTopStyle: 'solid',
      }}>
        {ligne('Gain en capital net restant', e5.gainNetApresCad, C.vert)}
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

      <Text style={{ marginTop: 7, fontSize: 7.4, color: C.encre, lineHeight: 1.4 }}>
        {e5.textePrincipal}{e5.texteSecondaire ? ` ${e5.texteSecondaire}` : ''}
      </Text>
      <Text style={{ marginTop: 4, fontSize: 6.8, color: C.gris, lineHeight: 1.4 }}>
        Cette réduction peut diminuer les gains en capital pris en compte dans la déclaration
        de revenus, selon les règles fiscales applicables.
      </Text>
    </Carte>
  );
}

export function ValidationsAvantExecution({ p }: { p: PresentationCristallisationPertes }) {
  return (
    <View style={{ marginTop: 2 }}>
      <Text style={{
        fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600,
        color: C.gris, letterSpacing: 0.6, marginBottom: 5,
      }}>
        AVANT D’EXÉCUTER
      </Text>
      {p.validationsAvantExecution.map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          {/* ⚠ « Confirmé » exige une donnée affirmative. Une pastille cochée
              faute de motif contraire serait un faux vert. */}
          <View style={{
            borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1.5, marginRight: 6,
            backgroundColor: v.statut === 'confirme' ? C.vertFond : '#f1f5f9',
          }}>
            <Text style={{
              fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600,
              color: v.statut === 'confirme' ? C.vert : C.gris,
            }}>
              {v.statut === 'confirme' ? 'Confirmé' : 'À confirmer'}
            </Text>
          </View>
          <Text style={{ fontSize: 7.4, color: C.encre }}>{v.libelle}</Text>
        </View>
      ))}
    </View>
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
            <CarteChiffre libelle="Gain en capital net réalisé"
              valeur={e1.gainNetAvantCad === null ? '—' : argent(e1.gainNetAvantCad)} />
            <CarteChiffre libelle="Perte latente disponible"
              valeur={e1.perteLatenteDisponibleCad === null ? '—' : argent(e1.perteLatenteDisponibleCad)}
              couleur={C.action} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 6.8, color: C.gris }}>
            {/* Minuscule : « Compte Non enregistré » se lisait comme un nom propre. */}
            Compte {(e1.compte ?? '—').toLocaleLowerCase('fr-CA')}
            {usd ? `   ·   Négociation : ${e1.deviseNegociation}   ·   Montants fiscaux : ${e1.uniteValeursRapport}` : ''}
          </Text>
        </Carte>
      </Etape>

      <Etape numero={2} titre="Pourquoi ce titre ?">
        <Carte>
          {p.etape2.raisonSelection
            ? <Text style={{ fontSize: 8, color: C.encre, lineHeight: 1.5 }}>{p.etape2.raisonSelection}</Text>
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

      <ValidationsAvantExecution p={p} />
    </View>
  );
}
