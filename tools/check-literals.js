/* Garde-fou des littéraux de gabarit qui portent du CSS ou du JavaScript client.
 *
 * Trois familles de pièges, toutes vécues sur ce fichier :
 *   1. un ACCENT GRAVE termine la chaîne au milieu du code ;
 *   2. une INTERPOLATION fait de même et injecte une valeur ;
 *   3. une BARRE OBLIQUE INVERSE ISOLÉE est mangée à la compilation. « \s » n'est
 *      pas une séquence d'échappement connue : JavaScript la réduit à « s ». Le
 *      code émis contenait donc /s+/g au lieu de /\s+/g, ce qui effaçait toutes
 *      les lettres « s » du base64 de la vidéo — neuf mille caractères — et la
 *      vidéo retombait silencieusement sur son image fixe.
 *      Dans ces littéraux, toute barre oblique inverse doit être DOUBLÉE.
 */
const fs = require('fs');
const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);
const files = process.argv.slice(2);
let bad = 0;

for (const p of files) {
  const t = fs.readFileSync(p, 'utf8');
  const open = t.indexOf('= ' + BT);
  const close = t.lastIndexOf(BT + '.trim()');
  if (open === -1 || close === -1) { console.log('?? ' + p + ' : littéral non trouvé'); bad++; continue; }
  const inner = t.slice(open + 3, close);
  const ticks = (inner.match(new RegExp(BT, 'g')) || []).length;
  const interp = (inner.match(/\$\{/g) || []).length;

  // Barres obliques inverses isolées : on retire d'abord les paires légitimes.
  const sansPaires = inner.split(BS + BS).join('');
  const seules = (sansPaires.match(new RegExp('\\' + BS, 'g')) || []).length;
  // Extraction des exemples par balayage : construire une classe de caractères
  // contenant une barre oblique inverse est précisément le genre de code qui
  // reproduit le bug qu'on traque.
  const exemples = [];
  for (let i = 0; i < sansPaires.length && exemples.length < 3; i++) {
    if (sansPaires[i] !== BS) continue;
    exemples.push(sansPaires.slice(Math.max(0, i - 26), i + 18).replace(/\s+/g, ' ').trim());
  }

  const ok = ticks === 0 && interp === 0 && seules === 0;
  if (!ok) bad++;
  console.log((ok ? 'OK ' : 'ECHEC ') + p.split(/[\\/]/).pop()
    + ' : accents graves=' + ticks + ' interpolations=' + interp + ' barres isolées=' + seules);
  exemples.forEach((e) => console.log('        ' + e));
}
process.exitCode = bad ? 1 : 0;
