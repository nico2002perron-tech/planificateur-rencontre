// Textes VERSIONNÉS de l'outil : consentement (Loi 25) et avis publics.
//
// ⚠️ Le wording exact est du ressort de Nicolas / la conformité iA. Les textes ci-dessous
// sont des PLACEHOLDERS clairement identifiés. Pour changer un texte de consentement :
// modifie la constante ET incrémente la `version` (elle est tracée dans `analyse_leads`
// pour l'audit Loi 25).

export const CONSENTEMENT_TRANSMISSION = {
  version: "transmission-v1-2026-07",
  texte:
    "J'autorise Groupe Financier Ste-Foy à recevoir mon analyse de portefeuille et mes coordonnées afin qu'un conseiller communique avec moi à ce sujet. Je peux retirer ce consentement en tout temps. [WORDING À VALIDER PAR LA CONFORMITÉ]",
} as const;

export const AVIS_PUBLIC =
  "Cet outil est fourni à titre informatif seulement. Il présente des constats généraux sur un portefeuille et ne constitue pas un conseil en placement, une recommandation d'achat ou de vente, ni une analyse personnalisée. Les valeurs reposent sur le référentiel de fonds de Groupe Financier Ste-Foy et sur des hypothèses divulguées.";

export const AVIS_PUBLIC_COURT =
  "Outil informatif — ne constitue pas un conseil en placement. Valeurs fondées sur des hypothèses divulguées.";
