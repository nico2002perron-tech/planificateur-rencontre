// L'ÉTAPE 4 DE LA CRISTALLISATION DE GAINS — un parcours, pas un bilan.
//
// ─────────────────────────────────────────────────────────────────────────────
// POURQUOI CE N'EST PAS `DiagrammeAvantStrategieApres`.
//
// La cristallisation de PERTES raconte une soustraction : gain existant, perte
// créée, gain réduit. Trois barres comparables sur une même échelle, et le
// message est « ça s'annule ».
//
// Celle-ci ne soustrait rien. Elle raconte une SÉQUENCE dans le temps :
// aujourd'hui on réalise une part du gain latent, des pertes déjà disponibles
// l'absorbent, et plus tard un éventuel rachat modifiera le coût fiscal moyen.
// Trois barres sur une échelle commune diraient une comparaison qui n'existe
// pas — d'où trois jalons reliés par des flèches.
//
// ⚠ LE TROISIÈME JALON N'EST PAS CHIFFRÉ, ET C'EST UNE CONCLUSION D'AUDIT.
// Le moteur ne connaît ni le prix, ni la quantité, ni la date, ni les frais
// d'un rachat qui n'a pas eu lieu. Afficher un « prix de base après » serait
// une invention. On explique le mécanisme, sans chiffre.
//
// Contraintes héritées : aucune couleur `#rrggbbaa`, aucune section vide.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text } from '@react-pdf/renderer';

const argent = (n: number) => `${n.toLocaleString('fr-CA', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} $`;

const C = {
  encre: '#1e293b', gris: '#64748b',
  gain: '#2f8f4e', gainFond: '#e6f4ea', gainBord: '#c3e4cd',
  perte: '#2563a8', perteFond: '#eef4fb', perteBord: '#cbdcf0',
  futur: '#7c6ba0', futurFond: '#f2effa', futurBord: '#ddd5ee',
  neutre: '#f1f5f9',
};

function Jalon({ moment, titre, montant, note, couleur, fond, bord }: {
  moment: string; titre: string; montant: string | null; note: string;
  couleur: string; fond: string; bord: string;
}) {
  return (
    <View style={{
      borderRadius: 11, padding: 7, backgroundColor: fond,
      borderWidth: 1, borderColor: bord, borderStyle: 'solid',
    }} wrap={false}>
      <Text style={{
        fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600,
        color: couleur, letterSpacing: 0.7, marginBottom: 2,
      }}>
        {moment}
      </Text>
      <Text style={{ fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: C.encre }}>
        {titre}
      </Text>
      {/* ⚠ PAS DE MONTANT SUR LE TROISIÈME JALON : le moteur ne le connaît pas.
          Le jalon garde sa place et sa hauteur — un blanc se lirait « cassé ». */}
      {montant !== null && (
        <Text style={{
          marginTop: 2, fontSize: 12, fontFamily: 'Montserrat', fontWeight: 800, color: couleur,
        }}>
          {montant}
        </Text>
      )}
      <Text style={{ marginTop: 2, fontSize: 6.6, color: C.gris, lineHeight: 1.35 }}>
        {note}
      </Text>
    </View>
  );
}

/**
 * LE LIEN ENTRE DEUX JALONS — le temps qui passe, pas une soustraction.
 *
 * ⚠ DESSINÉ, PAS ÉCRIT. Un « ↓ » (U+2193) sortait en petits guillemets : le
 * glyphe n'est pas dans les polices embarquées. Le dépôt connaît cette famille
 * de bug — U+26A0 s'imprimait en carré vide, et un test refuse déjà « ⚠ ✓ → ← »
 * dans le texte client. Deux `View` ne dépendent d'aucune police.
 */
function Lien() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 1 }} wrap={false}>
      <View style={{ width: 2, height: 7, backgroundColor: C.gris, borderRadius: 1 }} />
      <View style={{ width: 6, height: 6, marginTop: -2.5, backgroundColor: C.gris, borderRadius: 3 }} />
    </View>
  );
}

export function ParcoursGainCristallise({
  gainRealiseEstimeCad, pertesDisponiblesCad, cibleRestanteCad,
}: {
  gainRealiseEstimeCad: number | null;
  pertesDisponiblesCad: number | null;
  /** La capacité fiscale qui demeure inutilisée, granularité oblige. */
  cibleRestanteCad: number | null;
}) {
  if (gainRealiseEstimeCad === null || pertesDisponiblesCad === null) {
    return (
      <View style={{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: C.neutre }}>
        <Text style={{ fontSize: 7.4, color: C.gris, lineHeight: 1.4 }}>
          Le parcours chiffré ne peut pas être illustré tant que le gain à réaliser
          n’est pas confirmé.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Jalon
        moment="AUJOURD’HUI" titre="Une partie du gain latent est réalisée"
        montant={argent(gainRealiseEstimeCad)}
        note="La vente estimée transforme une partie du gain latent en gain réalisé."
        couleur={C.gain} fond={C.gainFond} bord={C.gainBord}
      />
      <Lien />
      <Jalon
        moment="LES PERTES DISPONIBLES" titre="Elles absorbent le gain réalisé"
        montant={argent(pertesDisponiblesCad)}
        note={
          cibleRestanteCad !== null && cibleRestanteCad > 0
            ? `Il reste ${argent(cibleRestanteCad)} de capacité fiscale inutilisée : une action entière ne tombe pas exactement sur la cible.`
            : 'La capacité fiscale disponible est utilisée par cette opération.'
        }
        couleur={C.perte} fond={C.perteFond} bord={C.perteBord}
      />
      <Lien />
      {/* ⚠ CONDITIONNEL, ET SANS CHIFFRE. Le rachat n'est ni planifié ni
          exécuté : c'est une éventualité dont on explique la mécanique. */}
      <Jalon
        moment="PLUS TARD" titre="Si des unités sont rachetées" montant={null}
        note={
          'Si des unités du même titre sont rachetées par la suite, leur coût d’acquisition '
          + 'sera intégré au coût fiscal moyen des unités alors détenues. Le nouveau coût '
          + 'fiscal dépendra notamment du prix, de la quantité et des frais du rachat.'
        }
        couleur={C.futur} fond={C.futurFond} bord={C.futurBord}
      />
    </View>
  );
}
