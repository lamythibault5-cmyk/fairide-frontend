import { photosDepuis } from '../landingPhotos';

// Mosaïque de plats en filigrane derrière un bloc iris.
//
// Le fond ne doit jamais coûter une ligne de texte. D'où le traitement, qui n'est pas un simple
// « baisser l'opacité » :
//
//   1. les photos sont assombries par un filtre AVANT tout mélange (brightness .38) ;
//   2. elles sont mélangées en `screen`, qui ne peut qu'ÉCLAIRCIR le fond iris — jamais l'assombrir ;
//   3. le tout est posé à 30 % d'opacité.
//
// L'intérêt de `screen` est qu'il borne le pire cas : même un pixel blanc pur ne peut ajouter que
// 0,38 × 0,30 de clarté. Un mélange qui pourrait aussi bien éclaircir qu'assombrir (`overlay`,
// `luminosity`) laisserait passer des plaques quasi blanches sous du texte blanc. Le contraste
// mesuré au pire pixel des douze photos reste très au-dessus du seuil AA.
//
// aria-hidden et alt vides : c'est une texture. Un lecteur d'écran qui annoncerait « une barquette
// de frites » au milieu d'une accroche commerciale desservirait celui qui l'écoute.
export default function PhotoWash({ depart = 0, combien = 12 }) {
  return (
    <div className="photo-wash" aria-hidden="true">
      {photosDepuis(depart, combien).map((p) => (
        <img key={p.src} src={p.src} alt="" loading="lazy" decoding="async" draggable="false" />
      ))}
    </div>
  );
}
