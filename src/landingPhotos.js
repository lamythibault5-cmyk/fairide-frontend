// Photos de plats en filigrane derrière la page d'accueil.
//
// PROVENANCE ET LICENCE. Domaine public (CC0 / Public Domain Mark), même source que galleryImages.js
// — donc aucune attribution à afficher, ce qui compte pour un décor : créditer douze auteurs sous
// une accroche serait absurde. Les douze liens ont été contrôlés un par un (requête réelle, réponse
// image).
//
// LE CHOIX DES SUJETS. Frais, coloré, franchement éclairé : bols de légumes, poke bowls, étals de
// primeur, fruits. Ce n'est pas qu'une question de goût — c'est ce qui rend le filigrane possible.
// Un premier jeu mêlait tajine, boulettes et pâtes en sauce ; sous un voile, ces sujets sombres se
// lisent comme des taches brunes, et les rendre visibles demandait de monter l'opacité au point
// d'attaquer le texte. Un sujet clair et contrasté se reconnaît à voile égal.
//
// CE QUE CES PHOTOS NE SONT PAS. Ce ne sont pas les plats des commerçants partenaires de Fairide.
// C'est de l'évocation, pas de la documentation. Si un jour la page doit montrer de VRAIS
// partenaires, il faudra tirer les photos de couverture des restaurants inscrits, pas d'ici.
//
// POURQUOI DE SI PETITES IMAGES. Suffixe Flickr "_m" = 240px de large, ~22 Ko pièce. C'est la
// largeur d'une tuile sur un écran large (quatre colonnes dans 960px) : agrandir le fichier
// n'ajouterait aucun détail visible. Les douze pèsent 272 Ko une seule fois, réutilisées telles
// quelles par toutes les zones (donc servies par le cache dès la deuxième). Les variantes réduites
// des autres hébergeurs de la galerie (rawpixel, stocksnap) n'existent pas — d'où Flickr seul.
export const LANDING_PHOTOS = [
  { src: 'https://live.staticflickr.com/65535/54970565705_300ddefc98_m.jpg', sujet: 'un bol de légumes frais' },
  { src: 'https://live.staticflickr.com/65535/52272241896_fdee72550c_m.jpg', sujet: 'des tomates et des poivrons' },
  { src: 'https://live.staticflickr.com/65535/55076223598_87ab471992_m.jpg', sujet: 'un poke bowl' },
  { src: 'https://live.staticflickr.com/65535/52501553597_923b00a7a5_m.jpg', sujet: 'des pains dorés' },
  { src: 'https://live.staticflickr.com/8475/8426183676_276605ecea_m.jpg', sujet: 'des fraises' },
  { src: 'https://live.staticflickr.com/65535/51943490100_7a05eca0e9_m.jpg', sujet: "une tartine à l'avocat" },
  { src: 'https://live.staticflickr.com/65535/54935162199_11b277d058_m.jpg', sujet: 'un étal de légumes' },
  { src: 'https://live.staticflickr.com/65535/52639520224_8bf5d73210_m.jpg', sujet: 'un cappuccino' },
  { src: 'https://live.staticflickr.com/65535/51668044811_434e5f1785_m.jpg', sujet: 'des légumes sautés' },
  { src: 'https://live.staticflickr.com/65535/54290187106_6bcf9a2c09_m.jpg', sujet: 'des bols de fruits secs' },
  { src: 'https://live.staticflickr.com/65535/52272503184_f6607f062a_m.jpg', sujet: 'des courges et des poivrons' },
  { src: 'https://live.staticflickr.com/65535/55076021516_4344385fbf_m.jpg', sujet: 'un poke bowl aux crudités' }
];

// Chaque zone part d'un endroit différent de la liste : sans ce décalage, les blocs de la page
// afficheraient la même mosaïque dans le même ordre, ce qui se remarque en faisant défiler.
export function photosDepuis(depart, combien = LANDING_PHOTOS.length) {
  const n = LANDING_PHOTOS.length;
  return Array.from({ length: Math.min(combien, n) }, (_, i) => LANDING_PHOTOS[(depart + i) % n]);
}
