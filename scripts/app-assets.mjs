// Sources des icônes et de l'écran de lancement de l'application (App Store / Play Store).
//
// Produit assets/icon.png (1024), assets/icon-foreground.png + icon-background.png (icône adaptative Android),
// assets/splash.png et splash-dark.png (2732, iris uni avec le vélo centré), à partir du même vélo « 5a » que
// public/icons/icon.svg — pas de fichier dessiné à part, pour que l'icône du téléphone et le favicon restent
// identiques. Ensuite : npx @capacitor/assets generate (voir docs/application-mobile.md ou `npm run app:assets`).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const IRIS = '#3B2FB5';
const LIME = '#C8F03C';
mkdirSync('assets', { recursive: true });

/* LA NETTETÉ DES BORDS (fondateur, 2026-10-18, capture zoomée : un liseré plus clair et plus foncé le long du vélo). Ce
 * liseré vient de la réduction « Lanczos » d'une IMAGE (sharp et @capacitor/assets par défaut), qui accentue les contours.
 * Un dessin vectoriel, lui, est redessiné par sharp directement à la taille demandée : bord net, sans halo. On ne réduit
 * donc jamais une image déjà rendue, sauf l'icône ronde (découpée en cercle avant réduction), réduite avec le noyau
 * « mitchell », qui ne fait pas de halo. Les icônes Android que @capacitor/assets tire de icon.png en Lanczos sont
 * redessinées ainsi par --icones-android, lancé après lui (npm run app:assets). L'icône 512 du Play Store se tire de
 * assets/icon.png en « mitchell » elle aussi. */
const SURECH = 4;
const net = (svg, cote) => sharp(svg).resize(cote, cote, { kernel: 'mitchell' }).png();

// Le vélo seul, dans une boîte 82 × 42 (viewBox de BrandMark.jsx), au centre d'un carré `cote`, largeur `largeur`.
function velo(cote, largeur, fond = null, trait = 5) {
  const echelle = largeur / 82;
  const x = (cote - 82 * echelle) / 2;
  const y = (cote - 42 * echelle) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cote}" height="${cote}" viewBox="0 0 ${cote} ${cote}">
  ${fond ? `<rect width="${cote}" height="${cote}" fill="${fond}"/>` : ''}
  <g transform="translate(${x} ${y}) scale(${echelle}) translate(3 -5)">
    <g fill="none" stroke="${LIME}" stroke-width="${trait}" stroke-linecap="round">
      <circle cx="15" cy="29" r="12.5"/><circle cx="61" cy="29" r="12.5"/>
    </g>
    <g fill="${LIME}">
      <rect x="16" y="8" width="44" height="5" rx="2.5"/>
      <g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5"/></g>
    </g>
  </g>
</svg>`);
}

// LE VÉLO « TRÈS GRAND » (fondateur, 2026-10-18, version D de maquettes/fiche-play-store/index.html) : 88 % de la largeur de
// l'icône, au lieu de 58 % (icône pleine) et 42 % (icône adaptative Android) — il ressortait trop peu à côté des autres
// applis. Le site garde un vélo un peu moins grand (public/icons/icon.svg, scripts/icones-site.mjs) : son icône est
// souvent découpée en cercle. Trait 4,65 : à cette taille, le trait de 5 paraissait lourd.
const LARGEUR_VELO = 0.88;
const TRAIT_VELO = 4.65;

/* --icones-android : redessine les icônes de lanceur Android (res/mipmap-*), après @capacitor/assets qui les a réduites en
 * Lanczos. Trois formes, mesurées sur ce que l'outil produit (2026-10-18) : ic_launcher (ancienne icône carrée, marge
 * transparente de 1/24 du côté), ic_launcher_round (icône pleine découpée en cercle), ic_launcher_foreground (le vélo seul,
 * pour l'icône adaptative). ic_launcher_background (iris uni) n'a pas de bord : on le laisse. */
if (process.argv.includes('--icones-android')) {
  const DENSITES = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  const res = 'android/app/src/main/res';
  for (const [densite, c] of Object.entries(DENSITES)) {
    const grand = c * SURECH;
    await net(velo(grand, grand * LARGEUR_VELO, null, TRAIT_VELO), c).toFile(`${res}/mipmap-${densite}/ic_launcher_foreground.png`);
    const rond = await sharp(velo(grand, grand * LARGEUR_VELO, IRIS, TRAIT_VELO))
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${grand}" height="${grand}"><circle cx="${grand / 2}" cy="${grand / 2}" r="${grand / 2}"/></svg>`), blend: 'dest-in' }])
      .png().toBuffer();
    await net(rond, c).toFile(`${res}/mipmap-${densite}/ic_launcher_round.png`);
    const marge = Math.round(c / 24); const dedans = c - 2 * marge;
    const carre = await net(velo(dedans * SURECH, dedans * SURECH * LARGEUR_VELO, IRIS, TRAIT_VELO), dedans).toBuffer();
    await sharp(carre).extend({ top: marge, bottom: marge, left: marge, right: marge, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${res}/mipmap-${densite}/ic_launcher.png`);
  }
  console.log('android : icônes de lanceur redessinées sans halo (mipmap-*)');
  process.exit(0);
}
// Icône pleine (iPhone, et l'icône 512 du Play Store en est une copie) : les magasins arrondissent eux-mêmes.
await net(velo(1024 * SURECH, 1024 * SURECH * LARGEUR_VELO, IRIS, TRAIT_VELO), 1024).toFile('assets/icon.png');
// Icône adaptative Android : ic_launcher.xml insère l'avant-plan à 16,7 % de chaque bord, donc cette image couvre la zone
// visible (72 dp sur 108). Le téléphone la découpe à sa forme (cercle sur Pixel, « squircle » chez Samsung, carré arrondi
// ailleurs) ; seul le cercle de 66 dp au centre est garanti. Le vélo à 88 % y tient : le point le plus éloigné du centre
// (le bas de la roue avant) est à 83 % du rayon, la limite à 92 %. Vérifié sur les trois formes le 2026-10-18.
await net(velo(1024 * SURECH, 1024 * SURECH * LARGEUR_VELO, null, TRAIT_VELO), 1024).toFile('assets/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: IRIS } }).png().toFile('assets/icon-background.png');
// Écran de lancement : iris uni, vélo à 22 % de large (même rendu que le #splash de index.html, sans le mot).
await sharp(velo(2732, 2732 * 0.22, IRIS)).png().toFile('assets/splash.png');
await sharp(velo(2732, 2732 * 0.22, IRIS)).png().toFile('assets/splash-dark.png');
console.log('assets/ : icon, icon-foreground, icon-background, splash, splash-dark');
