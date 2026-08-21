// LE DIAGRAMME « AVANT / STRATÉGIE / APRÈS » — trois bandes, aucune échelle menteuse.
//
// ─────────────────────────────────────────────────────────────────────────────
// LES DEUX PIÈGES QUE CE FICHIER EXISTE POUR ÉVITER.
//
// 1. LE ZÉRO QUI DISPARAÎT. `gainNetApresCad` vaut 0 dans le cas nominal — une
//    barre de largeur nulle laisserait un blanc, et le client lirait « il
//    manque quelque chose » au lieu de « objectif atteint ». Le zéro garde donc
//    un repère visible et son libellé.
//
// 2. L'ÉCHELLE QU'ON SERAIT TENTÉ D'EXAGÉRER. Avant 8 997,81 $ et stratégie
//    9 031,60 $ ne diffèrent que de 0,4 %. Les deux bandes DOIVENT paraître
//    presque identiques : c'est le vrai message — la perte couvre le gain.
//    Étirer l'échelle pour « montrer » le dépassement fabriquerait une
//    différence que les chiffres ne portent pas. L'information du dépassement
//    appartient à la pastille d'écart, pas à la géométrie.
//
// Aucune librairie graphique : trois `View` et des largeurs en pourcentage.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';

const ARGENT = (n: number) => `${n.toLocaleString('fr-CA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} $`;

/** Rouge doux = la perte créée · vert doux = le résultat · ardoise = le contexte. */
const C = {
  avant: '#64748b', avantFond: '#e2e8f0',
  strategie: '#e05252', strategieFond: '#fbe3e3',
  apres: '#3f9142', apresFond: '#e3f3e4',
  encre: '#1e293b', gris: '#64748b',
};

function Bande({ etiquette, sousTitre, montant, largeurPct, couleur, fond, zero }: {
  etiquette: string; sousTitre: string; montant: number;
  largeurPct: number; couleur: string; fond: string; zero?: boolean;
}) {
  return (
    <View style={{ marginBottom: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 3 }}>
        <Text style={{ fontSize: 6.6, fontFamily: 'Open Sans', fontWeight: 600, color: C.gris, letterSpacing: 0.6 }}>
          {etiquette}
        </Text>
        <Text style={{ marginLeft: 5, fontSize: 6.6, color: C.gris }}>{sousTitre}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* LE COULOIR — il donne sa hauteur à la ligne même quand la barre est
            nulle, ce qui empêche le bloc de « sauter » sur le cas à 0 $. */}
        <View style={{
          flex: 1, height: 20, borderRadius: 6, backgroundColor: fond,
          justifyContent: 'center', overflow: 'hidden',
        }}>
          {zero ? (
            // ── LE ZÉRO GARDE UN REPÈRE ─────────────────────────────────────
            // Un trait vertical à l'origine plutôt qu'un vide : « il ne reste
            // rien » se lit, « rien n'a été rendu » ne se lit pas.
            <View style={{ width: 3, height: 20, backgroundColor: couleur, borderRadius: 1.5 }} />
          ) : (
            <View style={{
              width: `${Math.max(2, Math.min(100, largeurPct))}%`, height: 20,
              backgroundColor: couleur, borderRadius: 6,
              // ⚠ PAS D'ALPHA HEXADÉCIMAL À 8 CHIFFRES ICI. `#ffffff55` était
              // rendu VERT par react-pdf : les barres grise et rouge portaient
              // un liseré vert absurde, vu au premier rendu du 21 août 2026.
              // Le relief passe par une bordure opaque et discrète.
            }} />
          )}
        </View>
        <Text style={{
          width: 74, textAlign: 'right', fontSize: 10,
          fontFamily: 'Montserrat', fontWeight: 800, color: couleur,
        }}>
          {ARGENT(montant)}
        </Text>
      </View>
    </View>
  );
}

export function DiagrammeAvantStrategieApres({
  gainNetAvantCad, perteRealiseeEstimeeCad, gainNetApresCad, ecartCad,
}: {
  gainNetAvantCad: number | null;
  perteRealiseeEstimeeCad: number | null;
  gainNetApresCad: number | null;
  ecartCad: number | null;
}) {
  // ⚠ AUCUN CALCUL FISCAL ICI. Une donnée absente n'est pas un zéro : le bloc
  // ne se rend tout simplement pas.
  if (gainNetAvantCad === null || perteRealiseeEstimeeCad === null) {
    // ⚠ VU AU PREMIER RENDU : la carte s'affichait VIDE. Le refus de fabriquer
    // un « après » était juste, mais un trou blanc se lit « le document est
    // cassé » plutôt que « la donnée manque ». On dit ce qui manque.
    return (
      <View style={{
        borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
        backgroundColor: '#f1f5f9',
      }}>
        <Text style={{ fontSize: 7.4, color: C.gris, lineHeight: 1.4 }}>
          L’effet chiffré ne peut pas être illustré tant que le montant de perte à
          réaliser n’est pas confirmé.
        </Text>
      </View>
    );
  }

  // L'ÉCHELLE EST COMMUNE ET HONNÊTE : la plus grande des deux grandeurs occupe
  // toute la largeur, les autres sont proportionnelles. 0,4 % d'écart donne
  // 0,4 % d'écart à l'œil — et c'est exactement ce qu'on veut montrer.
  const max = Math.max(gainNetAvantCad, perteRealiseeEstimeeCad, 1);
  const pct = (n: number) => (n / max) * 100;
  const apresAffichable = gainNetApresCad !== null;

  return (
    <View>
      <Bande
        etiquette="AVANT" sousTitre="Gain en capital net"
        montant={gainNetAvantCad} largeurPct={pct(gainNetAvantCad)}
        couleur={C.avant} fond={C.avantFond}
      />
      <Bande
        etiquette="STRATÉGIE" sousTitre="Perte estimée réalisée"
        montant={perteRealiseeEstimeeCad} largeurPct={pct(perteRealiseeEstimeeCad)}
        couleur={C.strategie} fond={C.strategieFond}
      />
      {apresAffichable && (
        <Bande
          etiquette="APRÈS" sousTitre="Gain net restant"
          montant={gainNetApresCad as number}
          largeurPct={pct(gainNetApresCad as number)}
          couleur={C.apres} fond={C.apresFond}
          zero={(gainNetApresCad as number) === 0}
        />
      )}

      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {apresAffichable && (gainNetApresCad as number) === 0 && (
          <View style={{
            borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3,
            backgroundColor: C.apresFond, marginRight: 6,
          }}>
            <Text style={{ fontSize: 6.8, fontFamily: 'Open Sans', fontWeight: 600, color: C.apres }}>
              Objectif atteint
            </Text>
          </View>
        )}
        {/* ⚠ L'ÉCART VIT ICI, ET NULLE PART AILLEURS. Les deux premières bandes
            se ressemblent à 0,4 % près ; c'est cette pastille qui porte seule
            l'information du dépassement. */}
        {ecartCad !== null && ecartCad !== 0 && (
          <View style={{
            borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3,
            backgroundColor: '#f1f5f9',
          }}>
            <Text style={{ fontSize: 6.8, color: C.encre }}>
              Écart estimé{'  '}
              <Text style={{ fontFamily: 'Montserrat', fontWeight: 800 }}>
                {ecartCad > 0 ? '+' : '−'}{ARGENT(Math.abs(ecartCad))}
              </Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
