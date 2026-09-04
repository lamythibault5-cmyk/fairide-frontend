// Photos de plats en filigrane derrière la page d'accueil.
//
// PROVENANCE ET LICENCE. Domaine public (CC0 / Public Domain Mark), même source que galleryImages.js
// — donc aucune attribution à afficher, ce qui compte pour un décor : créditer dix-huit auteurs sous
// une accroche serait absurde. Les dix-huit liens ont été contrôlés un par un (requête réelle,
// réponse image).
//
// LE CHOIX DES SUJETS : des PLATS DRESSÉS, prêts à manger. Deux jeux ont été écartés avant celui-ci
// et l'écart est instructif. Le premier mêlait tajine, boulettes et pâtes en sauce : sous un voile,
// ces sujets sombres se lisent comme des taches brunes. Le second corrigeait la luminosité mais
// avec des légumes crus et des étals de primeur — lumineux, mais ça ne donne pas faim : ce sont des
// ingrédients, pas un repas. Ce qui donne envie, c'est une assiette, pas un cageot.
//
// CE QUE CES PHOTOS NE SONT PAS. Ce ne sont pas les plats des commerçants partenaires de Fairide.
// C'est de l'évocation, pas de la documentation. Si un jour la page doit montrer de VRAIS
// partenaires, il faudra tirer les photos de couverture des restaurants inscrits, pas d'ici.
//
// POURQUOI DE SI PETITES IMAGES. Suffixe Flickr "_m" = 240px de large, ~22 Ko pièce, agrandies par
// les tuiles. L'agrandissement ne se voit pas : le voile applique un contraste de 0,3 qui détruit
// de toute façon tout détail fin — un fichier plus lourd n'apporterait rien de visible. Les
// dix-huit pèsent 388 Ko au total, mais elles sont en chargement différé et réparties sur toute la
// hauteur de la page : seules les premières rangées sont téléchargées à l'arrivée.
export const LANDING_PHOTOS = [
  { src: 'https://live.staticflickr.com/65535/54051657108_535959274f_m.jpg', sujet: 'une pizza margherita' },
  { src: 'https://live.staticflickr.com/65535/54148058150_2d1c7f029e_m.jpg', sujet: 'un burger' },
  { src: 'https://live.staticflickr.com/65535/49891059268_aaa703bd5e_m.jpg', sujet: 'un plateau de sushis' },
  { src: 'https://live.staticflickr.com/65535/55076223598_87ab471992_m.jpg', sujet: 'un poke bowl au saumon' },
  { src: 'https://live.staticflickr.com/65535/54706781448_e0f0e7b7bf_m.jpg', sujet: 'des spaghettis à la bolognaise' },
  { src: 'https://live.staticflickr.com/65535/51567665011_ddc0aec599_m.jpg', sujet: 'des tacos' },
  { src: 'https://live.staticflickr.com/65535/51739863206_2c74d8613a_m.jpg', sujet: 'une paella' },
  { src: 'https://live.staticflickr.com/65535/52639740688_83cd14fc8d_m.jpg', sujet: 'un cappuccino' },
  { src: 'https://live.staticflickr.com/7286/16683913729_2ca6899d8f_m.jpg', sujet: 'un dessert aux fruits rouges' },
  { src: 'https://live.staticflickr.com/65535/55032972938_78e471dcc4_m.jpg', sujet: 'des ailes de poulet croustillantes' },
  { src: 'https://live.staticflickr.com/65535/54918375593_4d2d1670d9_m.jpg', sujet: 'un poulet aigre-doux' },
  { src: 'https://live.staticflickr.com/65535/51667255692_84075cf749_m.jpg', sujet: 'un bol de taboulé' },
  { src: 'https://live.staticflickr.com/65535/55007362059_3a1c7d72db_m.jpg', sujet: 'un bol de nouilles' },
  { src: 'https://live.staticflickr.com/65535/51943490100_7a05eca0e9_m.jpg', sujet: "une tartine à l'avocat" },
  { src: 'https://live.staticflickr.com/65535/54235252769_3630b27115_m.jpg', sujet: "un burger à l'avocat" },
  { src: 'https://live.staticflickr.com/65535/54605410245_084ecac0f3_m.jpg', sujet: 'un curry' },
  { src: 'https://live.staticflickr.com/5650/22723166628_25a6879690_m.jpg', sujet: 'des makis' },
  { src: 'https://live.staticflickr.com/4139/4897954457_8c6779c9d2_m.jpg', sujet: 'des tartelettes' }
];

// Cycle sans fin sur la liste : le fond de page en réclame bien plus que dix-huit pour couvrir
// toute sa hauteur. Le décalage de départ évite que deux zones de la page n'affichent la même
// mosaïque dans le même ordre, ce qui se remarque en faisant défiler.
export function photosDepuis(depart, combien = LANDING_PHOTOS.length) {
  const n = LANDING_PHOTOS.length;
  return Array.from({ length: combien }, (_, i) => LANDING_PHOTOS[(depart + i) % n]);
}
