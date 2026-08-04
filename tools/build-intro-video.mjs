/**
 * Prépare la boucle vidéo du générique du « Rapport vivant ».
 *
 * La vidéo est INCORPORÉE en base64 dans le fichier HTML remis au client : chaque
 * kilo-octet est un kilo-octet de pièce jointe. On encode donc pour l'écran, pas
 * pour l'archive.
 *
 * Trois décisions, et leurs raisons :
 *
 *  1. ALLER-RETOUR. La source est une lente poussée avant de 10 s : sa dernière
 *     image ne raccorde pas avec la première, et une boucle simple montrerait une
 *     coupe toutes les 10 s. On concatène donc la séquence et son miroir : la
 *     caméra avance puis recule, la boucle est parfaitement invisible, et le
 *     générique peut rester à l'écran des minutes sans jamais « sauter ».
 *
 *  2. 960 DE LARGE, CRF 31. Le cadre n'occupe jamais plus de la moitié d'un écran ;
 *     960 couvre l'affichage à deux fois la densité. Le fond de studio est plat et
 *     le sujet lisse : à CRF 31 l'image reste indiscernable de la source (vérifié
 *     par comparaison d'images), pour environ 550 Ko au lieu de 2,5 Mo.
 *
 *  3. AUCUNE PISTE AUDIO. Un document financier ne fait pas de bruit — et les
 *     navigateurs n'autorisent la lecture automatique que si la vidéo est muette.
 *
 * Produit aussi une image fixe : elle sert de repli quand la vidéo ne se décode
 * pas, et d'affiche pour les personnes qui ont demandé moins d'animations.
 *
 * Usage : node tools/build-intro-video.mjs [chemin/vers/source.mp4]
 * Exige ffmpeg dans le PATH.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SOURCE_PAR_DEFAUT = path.join(
  'C:', 'Users', 'Utilisateur', 'OneDrive - IA Private Wealth', 'IA PublicQuébec',
  'NICOLAS PERRON', 'Site-Web-Groupe-Financier', 'image 3d',
  'jaimerais_que_tu_gardes_exacte.mp4',
);

const LARGEUR = 960;
const CRF = 31;

/**
 * On coupe la première demi-seconde : la source ouvre sur du blanc pur (255) et
 * se pose ensuite à 250-254 unités de gris. L'écart est faible, mais il tombe
 * pile au raccord de la boucle, là où l'oeil le repère le mieux.
 *
 * ⚠️ Cette source n'a AUCUNE période de boucle : on a cherché, pour chaque image
 * de fin possible, celle qui raccorderait le mieux avec le début — le meilleur
 * candidat (écart 4,20) ne fait pas mieux que deux images prises au hasard
 * (écart 4,46). Le mouvement n'est pas un cycle, c'est une évolution. L'aller-
 * retour reste donc la seule couture invisible.
 */
const DEBUT = 0.6;

const src = process.argv[2] ?? SOURCE_PAR_DEFAUT;
if (!existsSync(src)) {
  console.error('Source introuvable : ' + src);
  process.exit(1);
}

const publicDir = path.join(process.cwd(), 'public');
mkdirSync(publicDir, { recursive: true });
const outVideo = path.join(publicDir, 'intro-loop.mp4');
const outPoster = path.join(publicDir, 'intro-poster.webp');

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' });
}

// La boucle aller-retour. `split` duplique le flux, `reverse` retourne la copie,
// `concat` les recolle. `reverse` charge tout en mémoire : c'est acceptable pour
// dix secondes, ça ne le serait pas pour dix minutes.
ffmpeg([
  '-ss', String(DEBUT), '-i', src,
  '-an',
  '-filter_complex',
  `[0:v]scale=${LARGEUR}:-2,setsar=1,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,fps=24[v]`,
  '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(CRF),
  '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  // Groupe d'images court : la boucle redémarre sur une image clé, sans à-coup.
  '-g', '48',
  '-movflags', '+faststart',
  outVideo,
]);

// Affiche : une image de la fin du mouvement (sujet au plus près), la plus parlante.
ffmpeg([
  '-ss', '8.6', '-i', src,
  '-frames:v', '1',
  '-vf', `scale=${LARGEUR}:-2`,
  '-c:v', 'libwebp', '-quality', '72',
  outPoster,
]);

const ko = (f) => (statSync(f).size / 1024).toFixed(0).padStart(5) + ' Ko';
console.log('source        ' + ko(src));
console.log('boucle        ' + ko(outVideo) + '  -> ' + (statSync(outVideo).size * 1.37 / 1024).toFixed(0) + ' Ko une fois en base64');
console.log('affiche       ' + ko(outPoster));
