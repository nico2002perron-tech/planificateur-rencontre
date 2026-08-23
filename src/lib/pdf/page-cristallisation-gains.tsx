// LA PAGE « CRISTALLISATION DE GAINS » — même langage, autre histoire.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE QUI EST REPRIS, ET CE QUI NE L'EST PAS.
//
// Repris de la page des pertes : les badges d'étape, les cartes, la
// typographie, `EnTeteSociete`, `CarteChiffre`, `LogoSocieteFiscal` et son
// repli, le traitement des statuts dégradés.
//
// PAS repris : l'histoire. Les pertes racontent une soustraction ; les gains
// racontent l'emploi d'une capacité qui dort déjà au dossier. L'étape 4 n'est
// donc pas le diagramme « avant / stratégie / après » mais un parcours dans le
// temps — voir `parcours-gain-cristallise.tsx`.
//
// Trois contraintes de rendu, chacune née d'un vrai bug regardé sur PDF :
//   1. jamais `#rrggbbaa` — react-pdf le rend arbitrairement ;
//   2. jamais une section vide quand une donnée manque ;
//   3. jamais un glyphe absent des polices embarquées.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { EnTeteSociete, CarteChiffre } from './page-cristallisation-pertes';
import { ParcoursGainCristallise } from './parcours-gain-cristallise';
import { mentionDate } from './rendu-constat';
import type { PresentationCristallisationGains } from './presentation-cristallisation-gains';

const argent = (n: number) => `${n.toLocaleString('fr-CA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} $`;

const C = {
  encre: '#1e293b', gris: '#64748b', ligne: '#e2e8f0', papier: '#ffffff',
  badge: '#334155', neutre: '#f1f5f9',
  // ⚠ LE VERT EST LA COULEUR D'ACTION ICI, pas le rouge : on réalise un gain,
  // on ne crée pas une perte. Même palette, rôle inversé — c'est ce qui
  // distingue les deux pages sans changer de langage.
  action: '#2f8f4e', actionFond: '#eef7f1', actionBord: '#c9e5d4',
  cible: '#2563a8', cibleFond: '#eef4fb', cibleBord: '#cbdcf0',
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

function Manque({ texte }: { texte: string }) {
  return (
    <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: C.neutre }}>
      <Text style={{ fontSize: 7.4, color: C.gris, lineHeight: 1.4 }}>{texte}</Text>
    </View>
  );
}

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
        <CarteChiffre libelle="Valeur de vente estimée" valeur={argent(a.valeurVenteEstimeeCad)} />
        <CarteChiffre libelle="Gain réalisé estimé"
          valeur={argent(a.gainRealiseEstimeCad)} couleur={C.action} />
      </View>

      {/* ⚠ LES −15 $ RESTENT DANS LE BLOC CHIFFRÉ. La phrase d'explication vient
          APRÈS, en dessous : elle explique les chiffres, elle ne les remplace
          pas. Les cacher rendrait le document moins crédible, pas plus simple. */}
      <View style={{
        flexDirection: 'row', marginTop: 7, paddingTop: 6,
        borderTopWidth: 1, borderTopColor: C.actionBord, borderTopStyle: 'solid',
      }}>
        <Text style={{ flex: 1, fontSize: 7.2, color: C.gris }}>
          Objectif{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: C.encre }}>
            {argent(a.cibleGainCad)}
          </Text>
        </Text>
        <Text style={{ fontSize: 7.2, color: C.gris }}>
          Écart estimé{'   '}
          <Text style={{ fontFamily: 'Montserrat', fontWeight: 700, color: C.encre }}>
            {a.ecartCad > 0 ? '+' : ''}{argent(a.ecartCad)}
          </Text>
        </Text>
      </View>

      {p.etape3.precisionGranularite && (
        <Text style={{ marginTop: 6, fontSize: 6.8, color: C.gris, lineHeight: 1.4 }}>
          {p.etape3.precisionGranularite}
        </Text>
      )}
      {a.dateValeurs && (
        <Text style={{ marginTop: 4, fontSize: 6.4, color: C.gris, lineHeight: 1.35 }}>
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

  // ⚠ UN TIRET N'EST PAS UNE VALEUR. Peint de la couleur du chiffre — vert pour
  // le gain réalisé — il se lisait comme un montant sur le PDF dégradé. Une
  // donnée absente porte la couleur du texte secondaire, jamais celle du sens.
  const ligne = (libelle: string, valeur: number | null, couleur = C.encre) => (
    <View style={{ flexDirection: 'row', marginBottom: 3 }}>
      <Text style={{ flex: 1, fontSize: 7.6, color: C.gris }}>{libelle}</Text>
      <Text style={{
        fontSize: 8.6, fontFamily: 'Montserrat', fontWeight: 700,
        color: valeur === null ? C.gris : couleur,
      }}>
        {valeur === null ? '—' : argent(valeur)}
      </Text>
    </View>
  );

  return (
    <View>
      <Etape numero={1} titre="Des pertes fiscales sont disponibles">
        <Carte>
          <View style={{ flexDirection: 'row' }}>
            <CarteChiffre libelle="Pertes fiscales disponibles"
              valeur={e1.pertesDisponiblesCad === null ? '—' : argent(e1.pertesDisponiblesCad)}
              couleur={C.cible} />
            <CarteChiffre libelle="Gains latents disponibles"
              valeur={e1.gainsLatentsCad === null ? '—' : argent(e1.gainsLatentsCad)} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 7.4, color: C.encre, lineHeight: 1.45 }}>
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
              <Text style={{ marginTop: 6, fontSize: 7.4, color: C.encre, lineHeight: 1.45 }}>
                {p.etape2.texte}
              </Text>
            </>
          )}
        </Carte>
      </Etape>

      <Etape numero={3} titre="Quel titre et quelle quantité ?" teinte={C.action}>
        <CarteActionGain p={p} logos={logos} />
        {usd && (
          <Text style={{ marginTop: 4, fontSize: 6.6, color: C.gris }}>
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
          {ligne('Pertes fiscales disponibles', e5.pertesDisponiblesCad, C.cible)}
          {ligne('Gain réalisé estimé', e5.gainRealiseEstimeCad, C.action)}
          <View style={{
            marginTop: 3, paddingTop: 5,
            borderTopWidth: 1, borderTopColor: C.cibleBord, borderTopStyle: 'solid',
          }}>
            {ligne('Capacité encore disponible', e5.capaciteEncoreDisponibleCad)}
          </View>
          <Text style={{ marginTop: 7, fontSize: 7.4, color: C.encre, lineHeight: 1.45 }}>
            {e5.texte}
          </Text>
        </Carte>
      </Etape>

      <View style={{ marginTop: 2 }}>
        <Text style={{
          fontSize: 7, fontFamily: 'Open Sans', fontWeight: 600,
          color: C.gris, letterSpacing: 0.6, marginBottom: 5,
        }}>
          AVANT D’EXÉCUTER
        </Text>
        {p.validationsAvantExecution.map((v, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
            <View style={{
              borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1.5,
              marginRight: 6, backgroundColor: C.neutre,
            }}>
              <Text style={{ fontSize: 6, fontFamily: 'Open Sans', fontWeight: 600, color: C.gris }}>
                {v.statut === 'confirme' ? 'Confirmé' : 'À confirmer'}
              </Text>
            </View>
            <Text style={{ fontSize: 7.4, color: C.encre }}>{v.libelle}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
