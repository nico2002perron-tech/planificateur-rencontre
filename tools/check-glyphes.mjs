/* Garde-fou des GLYPHES : tout caractère non-ASCII du HTML produit doit exister
 * dans les deux sous-ensembles de polices.
 *
 * Pourquoi : `tools/build-report-fonts.py` ne garde qu'une liste explicite de points
 * de code — 158 glyphes, latin plus accents français. Un caractère absent ne fait
 * pas d'erreur : le navigateur va le chercher dans une police de secours, et il
 * s'affiche dans un autre dessin, plus large, mal aligné — ou en carré vide sur un
 * poste dépouillé. On ne le voit pas en relisant, parce qu'on connaît le texte.
 *
 * Défaut vécu : le signe « environ » (≈, U+2248) était employé dans le calendrier
 * des revenus alors qu'il n'existe ni dans Open Sans ni dans Montserrat.
 *
 * Usage :  node tools/check-glyphes.mjs [chemin/vers/rapport.html]
 * Exige fontTools (le même que build-report-fonts.py).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const cible = process.argv[2] ?? 'C:/tmp/rapport-vivant.html';
if (!existsSync(cible)) {
  console.error('Fichier introuvable : ' + cible);
  process.exit(1);
}

const POLICES = [
  'public/fonts/web/OpenSans-Regular.woff2',
  'public/fonts/web/OpenSans-SemiBold.woff2',
  'public/fonts/web/Montserrat-Bold.woff2',
  'public/fonts/web/Montserrat-ExtraBold.woff2',
];

function cmapDe(f) {
  const py = 'from fontTools.ttLib import TTFont;'
    + 'f=TTFont(r"' + path.resolve(f) + '");'
    + 'print(",".join(str(c) for c in f.getBestCmap().keys()))';
  const out = execFileSync('python', ['-c', py], { encoding: 'utf8', maxBuffer: 1e8 });
  return new Set(out.trim().split(',').map(Number));
}

const cmaps = POLICES.filter(existsSync).map(cmapDe);
if (!cmaps.length) {
  console.error('Aucune police trouvée dans public/fonts/web — lancer build-report-fonts.py.');
  process.exit(1);
}
// Un caractère est couvert s'il existe dans AU MOINS une des deux familles : la pile
// de polices finit par Montserrat en repli, c'est ainsi que les flèches fonctionnent.
const couvert = (cp) => cmaps.some((c) => c.has(cp));

// On ne regarde que le TEXTE rendu : ni le base64 des ressources, ni le CSS, ni le
// script — leurs caractères ne sont jamais dessinés.
let html = readFileSync(cible, 'utf8');
html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
const texte = html.replace(/<[^>]+>/g, ' ');

const manquants = new Map();
for (const ch of texte) {
  const cp = ch.codePointAt(0);
  if (cp < 0x80) continue;
  if (couvert(cp)) continue;
  manquants.set(cp, (manquants.get(cp) ?? 0) + 1);
}

if (manquants.size === 0) {
  console.log('OK — tous les caractères dessinés existent dans les sous-ensembles.');
  process.exit(0);
}
console.log('ECHEC — ' + manquants.size + ' caractère(s) absent(s) des polices :');
for (const [cp, n] of [...manquants].sort((a, b) => b[1] - a[1])) {
  console.log('  U+' + cp.toString(16).toUpperCase().padStart(4, '0')
    + '  « ' + String.fromCodePoint(cp) + ' »  ' + n + ' occurrence(s)');
}
console.log('\nSoit on l\'ajoute à UNICODES dans tools/build-report-fonts.py et on');
console.log('regénère, soit on l\'écrit autrement. Ne pas le laisser passer.');
process.exit(1);
