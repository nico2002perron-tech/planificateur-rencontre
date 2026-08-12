// LE DOCUMENT AUTONOME « OPTIMISATIONS FISCALES ».
//
// Jusqu'au 6 août 2026, la section fiscale ne sortait qu'à l'INTÉRIEUR du PDF
// de cours cibles, derrière une case du composeur. Elle est maintenant un
// document à part entière : on arrive, on colle, on répond, on génère.
//
// ─────────────────────────────────────────────────────────────────────────────
// LE MARQUAGE « VERSION CONSEILLER — USAGE INTERNE » — exigence de Nicolas,
// en contrepartie de cette autonomie.
//
// Son raisonnement, à retenir : « il devient facile à générer, il doit rester
// clair qu'il ne se remet pas ». Un document qu'on produit en trois clics
// finit par circuler ; celui-ci ne doit pas, tant que le fiscaliste n'a pas
// revu les règles et les barèmes.
//
// Deux marquages, pas un :
//   · un BANDEAU en tête de couverture, impossible à manquer ;
//   · une MENTION EN PIED de chaque page, qui survit à une impression partielle
//     ou à une page photographiée isolément.
//
// Les deux sont commandés par `revisionFiscalisteRequise`, le même drapeau que
// la mention existante. Le jour venu, une seule ligne dans strategies.ts fait
// disparaître les trois d'un coup.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import path from 'node:path';
import { Document, Page, Text, View, Font } from '@react-pdf/renderer';
import { styles, C } from './styles';
import { OptimisationsFiscalesPage } from './optimisations-fiscales-page';
import type { ResultatAnalyse } from '@/lib/profils/strategies';

// Ce document peut être rendu SEUL — il ne passe plus par price-targets-template,
// qui enregistrait les polices pour tout le monde. Il les enregistre donc lui-même.
const POLICES = path.join(process.cwd(), 'public', 'fonts');
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: path.join(POLICES, 'Montserrat-Bold.ttf'), fontWeight: 700 },
    { src: path.join(POLICES, 'Montserrat-ExtraBold.ttf'), fontWeight: 800 },
  ],
});
Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(POLICES, 'OpenSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(POLICES, 'OpenSans-SemiBold.ttf'), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((mot) => [mot]);

export type DonneesDocumentFiscal = {
  resultat: ResultatAnalyse;
  /** Le nom du client — imprimé sur la couverture SEULEMENT, jamais ailleurs. */
  nomClient?: string;
  /** `instantane` = portefeuille seul · `complet` = fiche rempli. */
  preset: 'instantane' | 'complet';
  /**
   * VRAI quand des textes ont été reformulés par l'IA d'essai (dossier fictif).
   * Le document LE DIT : un texte poli par un modèle qui ne s'annonce pas
   * serait un mensonge d'origine, même sur un dossier inventé.
   */
  essaiIA?: boolean;
};

const MOT_PRESET: Record<DonneesDocumentFiscal['preset'], string> = {
  instantane: 'Instantané — ce que le portefeuille dit aujourd’hui',
  complet: 'Bilan complet — portefeuille et situation personnelle',
};

function fmtDate(iso: string): string {
  const f = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${iso}T12:00:00`));
  return f.replace(/^1 /, '1er ');
}

/** Le bandeau d'usage interne — en tête de couverture. */
function BandeauInterne() {
  return (
    <View
      style={{
        marginBottom: 22, paddingVertical: 9, paddingHorizontal: 12,
        backgroundColor: '#7f1d1d', borderRadius: 3,
      }}
    >
      <Text style={{ fontSize: 11, fontFamily: 'Montserrat', fontWeight: 800, color: '#ffffff' }}>
        VERSION CONSEILLER — USAGE INTERNE
      </Text>
      <Text style={{ marginTop: 3, fontSize: 7.6, color: '#fecaca', lineHeight: 1.4 }}>
        Ce document ne doit pas être remis au client. Les règles fiscales et les barèmes qui le
        produisent n’ont pas encore été revus par un fiscaliste. Il sert à préparer la rencontre.
      </Text>
    </View>
  );
}

/** La mention en pied — sur CHAQUE page, y compris photographiée seule. */
export function PiedInterne() {
  return (
    <View fixed style={{ position: 'absolute', bottom: 18, left: 44, right: 44 }}>
      <Text style={{ fontSize: 6.4, fontFamily: 'Open Sans', fontWeight: 600, color: '#b91c1c' }}>
        Version conseiller — usage interne. Ne pas remettre au client.
      </Text>
    </View>
  );
}

function Couverture({ donnees }: { donnees: DonneesDocumentFiscal }) {
  const { resultat, nomClient, preset } = donnees;
  const chiffrees = resultat.constats.filter((c) => c.statut === 'calcule').length;
  const aDemander = resultat.questionsRencontre.length;

  return (
    <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fffdf9' }]}>
      {resultat.revisionFiscalisteRequise && <BandeauInterne />}

      <Text style={{ fontSize: 26, fontFamily: 'Montserrat', fontWeight: 800, color: C.navy }}>
        Optimisations fiscales
      </Text>
      <View style={{ marginTop: 8, height: 2, width: 90, backgroundColor: C.gold }} />

      {nomClient ? (
        <Text style={{ marginTop: 20, fontSize: 15, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          {nomClient}
        </Text>
      ) : null}
      <Text style={{ marginTop: 4, fontSize: 9, color: '#475569' }}>
        {MOT_PRESET[preset]}
      </Text>
      <Text style={{ marginTop: 2, fontSize: 9, color: '#475569' }}>
        Au {fmtDate(resultat.date)}, selon les données au dossier
      </Text>

      {/* CE QUE LE DOCUMENT CONTIENT, dit d'emblée. Un rapport qui s'ouvre sur
          son propre décompte évite la lecture en diagonale qui cherche « le
          chiffre » — il n'y en a pas un, il y en a plusieurs, de natures
          différentes, et la couverture le pose tout de suite. */}
      <View
        style={{
          marginTop: 26, paddingVertical: 12, paddingHorizontal: 14,
          backgroundColor: '#ffffff', borderWidth: 0.8, borderColor: '#e2e8f0',
          borderStyle: 'solid', borderRadius: 3,
        }}
      >
        <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
          Ce que contient ce document
        </Text>
        <Text style={{ marginTop: 5, fontSize: 9.5, color: '#334155', lineHeight: 1.5 }}>
          {resultat.constats.length} piste{resultat.constats.length > 1 ? 's' : ''} examinée
          {resultat.constats.length > 1 ? 's' : ''}, dont {chiffrees} chiffrée
          {chiffrees > 1 ? 's' : ''}.
          {aDemander > 0
            ? ` ${aDemander} donnée${aDemander > 1 ? 's' : ''} manquante${aDemander > 1 ? 's' : ''} ${aDemander > 1 ? 'empêchent' : 'empêche'} d’aller plus loin — elles sont listées à la fin.`
            : ' Aucune donnée ne manque.'}
        </Text>
        <Text style={{ marginTop: 6, fontSize: 7.4, color: '#64748b', lineHeight: 1.4 }}>
          Les montants présentés sont de natures différentes — une perte à cristalliser, des droits
          de cotisation, une subvention — et ne s’additionnent pas. Chacun porte sa nature.
        </Text>
      </View>

      {resultat.revisionFiscalisteRequise && <PiedInterne />}
    </Page>
  );
}

export function OptimisationsFiscalesDocument({ donnees }: { donnees: DonneesDocumentFiscal }) {
  return (
    <Document title="Optimisations fiscales">
      <Couverture donnees={donnees} />
      <OptimisationsFiscalesPage
        resultat={donnees.resultat}
        piedInterne={donnees.resultat.revisionFiscalisteRequise}
        essaiIA={donnees.essaiIA === true}
      />
    </Document>
  );
}
