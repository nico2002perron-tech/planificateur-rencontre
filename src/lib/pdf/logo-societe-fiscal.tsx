// LE LOGO D'UNE SOCIÉTÉ, DANS LE VOLET FISCAL — sans un octet de réseau.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA CONTRAINTE QUI GOUVERNE CE FICHIER.
//
// `docs/sorties-reseau.md` porte une décision datée du 17 août 2026 : mettre le
// logo des titres sur le plan de récolte demandait de les chercher chez FMP, et
// le faire depuis le document fiscal aurait ouvert une sortie dans LE SEUL
// VOLET QUI N'EN A AUCUNE — une sortie qui aurait transporté les symboles des
// positions d'un client, c'est-à-dire la composition de son portefeuille.
//
// La règle retenue : aucun appel depuis le volet fiscal. Les cours cibles vont
// déjà chercher ces logos (sortie inventoriée), on les garde au passage sur le
// disque (`base-locale/logos.ts`), et le document fiscal ne lit QUE ce cache.
//
// Ce composant reçoit donc des logos DÉJÀ RÉSOLUS. Il ne sait pas aller en
// chercher, et c'est délibéré : il n'y a pas de chemin, pas d'oubli possible.
//
// ⚠ ET SURTOUT, IL NE LAISSE JAMAIS UN TROU. Un titre sans logo affiche une
// pastille portant son ticker, dans la couleur stable que `duoColor` lui donne.
// Le web (`PretAColler`) a trois niveaux — cache, puis URL FMP, puis pastille ;
// ici le niveau du milieu est interdit, donc le repli est la pastille.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { duoColor } from '@/components/models/simulation/constants';

/**
 * LE TICKER LISIBLE — sans les suffixes de place boursière.
 *
 * « GSY.TO » se présente au client comme « GSY ». Même nettoyage que le web,
 * pour que les deux surfaces nomment le même titre de la même façon.
 */
export function tickerLisible(symbole: string): string {
  return (symbole ?? '').trim()
    .replace(/\.(TO|V|CN|NE)$/i, '')
    .toUpperCase();
}

/** Les deux ou trois caractères de la pastille. Jamais vide. */
export function initialesTicker(symbole: string): string {
  const t = tickerLisible(symbole);
  return t.length > 0 ? t.slice(0, Math.min(3, t.length)) : '—';
}

export function LogoSocieteFiscal({ symbole, logos, taille = 22 }: {
  symbole: string;
  /** Le cache déjà résolu. `undefined` est un cas normal, pas une erreur. */
  logos?: Record<string, string>;
  taille?: number;
}) {
  const uri = logos?.[symbole];
  if (uri) {
    return (
      <Image
        src={uri}
        style={{
          width: taille, height: taille, borderRadius: taille * 0.28,
          objectFit: 'contain', backgroundColor: '#ffffff',
        }}
      />
    );
  }

  // ── LE REPLI — une pastille, jamais un vide ──────────────────────────────
  // La couleur est DÉTERMINISTE : le même titre garde la même teinte d'un
  // document à l'autre, ce qui aide l'œil du conseiller en rencontre.
  const couleur = duoColor(tickerLisible(symbole) || 'X');
  return (
    <View
      style={{
        width: taille, height: taille, borderRadius: taille * 0.28,
        backgroundColor: `${couleur}22`,
        borderWidth: 1.4, borderColor: `${couleur}55`, borderStyle: 'solid',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Text style={{
        fontSize: taille * 0.36, fontFamily: 'Montserrat', fontWeight: 800, color: couleur,
      }}>
        {initialesTicker(symbole)}
      </Text>
    </View>
  );
}
