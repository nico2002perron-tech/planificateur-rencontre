// OUVRIR UN PDF PLUTÔT QUE DE LE TÉLÉCHARGER — demandé le 17 août 2026.
//
// « Est-ce qu'on pourrait faire en sorte qu'il ouvre directement quand je fais
// télécharger en PDF ? »
//
// Le geste réel du planificateur est de REGARDER le document — il le relit
// avant de le remettre, ou le montre à l'écran en rencontre. Le faire tomber
// dans le dossier Téléchargements imposait deux clics de plus et un aller-retour
// dans l'explorateur, pour un fichier qui, en exécution locale, est de toute
// façon déjà rangé dans le dossier du client par l'archivage.
//
// TROIS PRÉCAUTIONS, chacune payée par un piège connu :
//
//   1. NE PAS RÉVOQUER L'URL TOUT DE SUITE. `URL.revokeObjectURL()` appelé dans
//      la foulée coupe l'alimentation du visualiseur, qui lit le blob APRÈS
//      l'ouverture de l'onglet : la page s'ouvre vide ou « échec de
//      chargement ». On laisse une minute, largement de quoi charger.
//   2. LE BLOQUEUR DE FENÊTRES. `window.open` rend `null` quand le navigateur
//      refuse — il faut alors retomber sur le téléchargement, sinon le clic ne
//      produit RIEN et le planificateur croit l'application cassée.
//   3. LE NOM DU FICHIER RESTE NEUTRE. Il ne porte jamais le nom du client :
//      le dossier Téléchargements est souvent synchronisé sur OneDrive. Le nom
//      du client reste à l'intérieur du PDF.
import 'client-only';

export type ResultatOuverture = 'ouvert' | 'telecharge';

/**
 * Ouvre le PDF dans un nouvel onglet ; retombe sur le téléchargement si le
 * navigateur bloque la fenêtre. Rend ce qui s'est réellement produit, pour que
 * l'appelant puisse le DIRE — un message qui annonce « ouvert » quand le
 * fichier est tombé dans Téléchargements envoie chercher au mauvais endroit.
 */
export function ouvrirPdf(blob: Blob, nomFichier: string): ResultatOuverture {
  const url = URL.createObjectURL(blob);
  const onglet = window.open(url, '_blank');

  if (onglet) {
    // Une minute : le visualiseur a largement le temps de lire le blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'ouvert';
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'telecharge';
}
