/* Génère la version WEB du logo pour le « Rapport vivant » (export HTML autonome).
 *
 * Pourquoi : public/logo.png fait 791 × 315 px (131 Ko → 170 Ko en base64) alors
 * que le rapport l'affiche à 46 px de haut au plus (le carton de titre) et 34 px
 * dans le bandeau. Incorporé tel quel, le logo pèserait une part démesurée du
 * fichier. On en produit une version dimensionnée pour l'écran.
 *
 * 150 px de haut, soit 3,3× la plus grande taille d'affichage : le logo porte un
 * bloc de texte (« GROUPE FINANCIER STE-FOY ») dont les lettres font une dizaine de
 * pixels à l'écran. À 72 px d'actif, elles bavaient sur un écran à double densité —
 * le logo se lisait comme une tache. C'est du texte, pas un pictogramme : il lui
 * faut de la résolution.
 *
 * Lancer :  node scripts/build-report-logo.mjs
 * Sortie :  public/logo-web.png   (à committer — le serveur le lit à l'exécution)
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'public', 'logo.png');
const OUT = path.join(process.cwd(), 'public', 'logo-web.png');
const HAUTEUR = 150;

const avant = fs.statSync(SRC).size;
await sharp(SRC)
  .resize({ height: HAUTEUR, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(OUT);
const apres = fs.statSync(OUT).size;

const ko = (b) => (b / 1024).toFixed(1) + ' Ko';
const b64 = (b) => (Math.ceil(b / 3) * 4 / 1024).toFixed(1) + ' Ko';
console.log(`logo.png     : ${ko(avant)}  (base64 ${b64(avant)})`);
console.log(`logo-web.png : ${ko(apres)}  (base64 ${b64(apres)})  → ${(100 - (apres / avant) * 100).toFixed(1)} % de moins`);
