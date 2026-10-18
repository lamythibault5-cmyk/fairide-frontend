// Les icônes PNG du SITE (favicon, écran d'accueil, PWA), rendues depuis public/icons/icon.svg : npm run icones:site.
//
// Le site a le vélo « grand » (fondateur, 2026-10-18) : Google et les navigateurs découpent souvent l'icône d'un site en
// cercle. L'application (Android, iPhone) et le Play Store ont le vélo « très grand » : voir scripts/app-assets.mjs.
//   - favicon-32.png et favicon.ico (16, 32, 48) : la tuile aux coins ronds, fond transparent autour ;
//   - apple-touch-icon.png (180), icons/icon-192.png, icons/icon-512.png : carré plein, l'appareil arrondit lui-même ;
//   - icons/icon-maskable-512.png : carré plein ; le vélo tient dans le cercle sûr de 80 % que demande le format.
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const tuile = readFileSync('public/icons/icon.svg', 'utf8');
const carre = tuile.replace('rx="32"', 'rx="0"');
// sharp redessine le SVG à la taille demandée ; « mitchell » au cas où une réduction resterait : pas de liseré (app-assets.mjs).
const rendre = (svg, cote) => sharp(Buffer.from(svg), { density: 72 * (cote / 132) * 4 }).resize(cote, cote, { kernel: 'mitchell' }).png().toBuffer();

writeFileSync('public/favicon-32.png', await rendre(tuile, 32));
writeFileSync('public/apple-touch-icon.png', await rendre(carre, 180));
writeFileSync('public/icons/icon-192.png', await rendre(carre, 192));
writeFileSync('public/icons/icon-512.png', await rendre(carre, 512));
writeFileSync('public/icons/icon-maskable-512.png', await rendre(carre, 512));

// favicon.ico : trois PNG (16, 32, 48) dans l'enveloppe ICO (en-tête 6 octets + 16 octets par image).
const images = await Promise.all([16, 32, 48].map((c) => rendre(tuile, c)));
const tete = Buffer.alloc(6 + 16 * images.length);
tete.writeUInt16LE(0, 0); tete.writeUInt16LE(1, 2); tete.writeUInt16LE(images.length, 4);
let decalage = tete.length;
images.forEach((img, i) => {
  const c = [16, 32, 48][i]; const o = 6 + 16 * i;
  tete.writeUInt8(c, o); tete.writeUInt8(c, o + 1); tete.writeUInt8(0, o + 2); tete.writeUInt8(0, o + 3);
  tete.writeUInt16LE(1, o + 4); tete.writeUInt16LE(32, o + 6); tete.writeUInt32LE(img.length, o + 8); tete.writeUInt32LE(decalage, o + 12);
  decalage += img.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([tete, ...images]));
console.log('public/ : favicon-32.png, favicon.ico, apple-touch-icon.png, icons/icon-192.png, icon-512.png, icon-maskable-512.png');
