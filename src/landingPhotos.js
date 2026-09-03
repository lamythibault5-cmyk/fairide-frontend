// Photos de plats posées en filigrane derrière les blocs iris de la page d'accueil.
//
// PROVENANCE ET LICENCE. Domaine public (CC0 / Public Domain Mark), même source que galleryImages.js
// — donc aucune attribution à afficher, ce qui compte pour un décor : créditer douze auteurs sous
// une accroche serait absurde. Les douze liens ont été contrôlés un par un (requête réelle, réponse
// image).
//
// CE QUE CES PHOTOS NE SONT PAS. Ce ne sont pas les plats des commerçants partenaires de Fairide.
// C'est de l'évocation, pas de la documentation. À l'opacité où elles sont posées on ne distingue
// de toute façon aucun établissement — mais si un jour la page doit montrer de VRAIS partenaires,
// il faudra tirer les photos de couverture des restaurants inscrits, pas d'ici.
//
// POURQUOI DE SI PETITES IMAGES. Suffixe Flickr "_m" = 240px de large, ~20 Ko pièce. Un fond n'a pas
// besoin de plus : à cette taille les douze pèsent 243 Ko une seule fois, réutilisées telles quelles
// par les trois blocs (donc servies par le cache dès le deuxième). Les variantes réduites des autres
// hébergeurs de la galerie (rawpixel, stocksnap) n'existent pas — d'où le choix de Flickr seul.
//
// Un métier par image : le but est qu'on reconnaisse la variété du commerce de quartier, pas qu'on
// admire un plat.
export const LANDING_PHOTOS = [
  { src: 'https://live.staticflickr.com/65535/51332867394_2cc33d285e_m.jpg', sujet: 'une barquette de frites' },
  { src: 'https://live.staticflickr.com/65535/52501553597_923b00a7a5_m.jpg', sujet: 'des pains dorés' },
  { src: 'https://live.staticflickr.com/65535/54051854100_4ac6e93535_m.jpg', sujet: 'une pizza margherita' },
  { src: 'https://live.staticflickr.com/65535/49891059268_aaa703bd5e_m.jpg', sujet: 'un plateau de sushis' },
  { src: 'https://live.staticflickr.com/65535/52639520224_8bf5d73210_m.jpg', sujet: 'un cappuccino' },
  { src: 'https://live.staticflickr.com/65535/51708063784_bd3b2f17d1_m.jpg', sujet: 'une glace en cornet' },
  { src: 'https://live.staticflickr.com/65535/54706781448_e0f0e7b7bf_m.jpg', sujet: 'des pâtes à la bolognaise' },
  { src: 'https://live.staticflickr.com/65535/55028632261_44321deb1c_m.jpg', sujet: 'un couscous' },
  { src: 'https://live.staticflickr.com/65535/52272241896_fdee72550c_m.jpg', sujet: "des légumes d'étal" },
  { src: 'https://live.staticflickr.com/65535/54148058150_2d1c7f029e_m.jpg', sujet: 'un burger' },
  { src: 'https://live.staticflickr.com/65535/51306049173_dbffb39b97_m.jpg', sujet: 'des boulettes grillées' },
  { src: 'https://live.staticflickr.com/65535/53457228196_c7c7832520_m.jpg', sujet: 'des pâtisseries orientales' }
];

// Chaque bloc part d'un endroit différent de la liste : sans ce décalage, les trois blocs iris de la
// page afficheraient la même mosaïque dans le même ordre, ce qui se remarque en faisant défiler.
export function photosDepuis(depart, combien = LANDING_PHOTOS.length) {
  const n = LANDING_PHOTOS.length;
  return Array.from({ length: Math.min(combien, n) }, (_, i) => LANDING_PHOTOS[(depart + i) % n]);
}
