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
import { Page, Text, View } from '@react-pdf/renderer';
import { styles, C } from './styles';
import { SectionHeader, PageFooterV12 } from './year-activity-pages';
import type { ResultatAnalyse, Constat } from '@/lib/profils/strategies';

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
const TON: Record<Constat['statut'], { fond: string; bord: string; encre: string; mot: string }> = {
  calcule: { fond: '#f0fce8', bord: '#86c34a', encre: '#2f6b12', mot: 'chiffré' },
  'montant-a-confirmer': { fond: '#fffbeb', bord: '#fbbf24', encre: '#92400e', mot: 'à confirmer' },
  indisponible: { fond: '#f8fafc', bord: '#cbd5e1', encre: '#475569', mot: 'donnée manquante' },
  'non-applicable': { fond: '#f8fafc', bord: '#cbd5e1', encre: '#475569', mot: 'sans objet' },
};

function CarteConstat({ constat }: { constat: Constat }) {
  const t = TON[constat.statut];
  return (
    <View
      style={{
        marginBottom: 7,
        paddingVertical: 6,
        paddingHorizontal: 8,
        backgroundColor: t.fond,
        borderLeftWidth: 2.5,
        borderLeftColor: t.bord,
        borderLeftStyle: 'solid',
        borderRadius: 2,
      }}
      wrap={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: 9.5, fontFamily: 'Montserrat', fontWeight: 700, color: C.navy }}>
          {constat.titre}
        </Text>
        <Text style={{ marginLeft: 6, fontSize: 6.4, color: t.encre, textTransform: 'uppercase' }}>
          {t.mot}
        </Text>

        {/* LE MONTANT N'APPARAÎT QUE SI LE STATUT EST « calcule ».
            C'est la garde centrale : `montantEstime` est déjà null ailleurs
            (strategies.ts le verrouille et le teste), mais on ne dépend pas
            d'une seule barrière pour un chiffre qui atteint le client. */}
        {constat.statut === 'calcule' && constat.montantEstime !== null && (
          <Text
            style={{
              marginLeft: 'auto', fontSize: 12, fontFamily: 'Montserrat',
              fontWeight: 800, color: t.encre,
            }}
          >
            {fmt(constat.montantEstime)}
          </Text>
        )}
      </View>

      {/* CE QUE LE MONTANT EST. Sans cette ligne, trois chiffres de natures
          différentes s'alignent en colonne et se lisent comme trois économies
          comparables — alors que des droits de cotisation ne sont pas une
          économie. C'est le défaut qui a fait retirer le total de la page. */}
      {constat.statut === 'calcule' && constat.montantEstime !== null && (
        <Text style={{ marginTop: 1, fontSize: 6.4, color: t.encre, textAlign: 'right' }}>
          {constat.libelleMontant}
          {constat.recurrence === 'annuel' ? ', par année' : ', une seule fois'}
        </Text>
      )}

      <Text style={{ marginTop: 2.5, fontSize: 7.4, color: '#334155', lineHeight: 1.4 }}>
        {constat.explication}
      </Text>

      {constat.donneesManquantes.length > 0 && (
        <Text style={{ marginTop: 2.5, fontSize: 6.6, color: t.encre, lineHeight: 1.35 }}>
          Pour aller plus loin : {constat.donneesManquantes.join(' · ')}
        </Text>
      )}
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

export function OptimisationsFiscalesPage({ resultat }: { resultat: ResultatAnalyse }) {
  const dateLisible = fmtDate(resultat.date);
  const chiffres = resultat.constats.filter((c) => c.statut === 'calcule');

  return (
    <Page size="A4" orientation="portrait" style={[styles.page, { backgroundColor: '#fffdf9' }]}>
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

      {resultat.constats.map((c) => (
        <CarteConstat key={c.strategie} constat={c} />
      ))}

      {resultat.angleMort && <BlocAngleMort angleMort={resultat.angleMort} />}

      {resultat.questionsRencontre.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 8, fontFamily: 'Open Sans', fontWeight: 600, color: '#64748b' }}>
            À valider ensemble
          </Text>
          {resultat.questionsRencontre.map((q, i) => (
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
        <Text style={{ marginTop: 1.5, fontSize: 6.1, color: '#64748b', lineHeight: 1.34 }}>
          Ces constats sont établis à partir des données disponibles à la date indiquée : ils ne
          préjugent pas des résultats futurs et ne constituent ni une prévision, ni une
          recommandation, ni un conseil fiscal, juridique ou en placement. Toute mise en oeuvre doit
          être validée par un fiscaliste ou un comptable au regard de la situation complète du
          client. Ce document ne remplace pas les relevés officiels ni les avis de cotisation.
        </Text>
      </View>

      <PageFooterV12 />
    </Page>
  );
}
