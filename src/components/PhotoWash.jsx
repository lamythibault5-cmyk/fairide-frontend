import { photosDepuis } from '../landingPhotos';

// Mosaïque de plats en filigrane. Deux variantes, parce que les deux fonds de la page d'accueil
// n'ont rien en commun.
//
// SUR IRIS (bannière, bloc « où va ton euro », appel final) — texte clair sur fond sombre.
//   1. les photos sont assombries par un filtre AVANT tout mélange ;
//   2. elles sont mélangées en `screen`, qui ne peut qu'ÉCLAIRCIR le fond — jamais l'assombrir ;
//   3. le tout est posé à l'opacité fixée par bloc.
//
// SUR PAGE (le reste : marges, intervalles, titres de section) — texte sombre sur fond blanc.
//   Le sens s'inverse : les photos sont ÉCLAIRCIES et aplaties (contraste réduit), puis mélangées
//   en `multiply`, qui ne peut qu'ASSOMBRIR le blanc — jamais l'éclaircir.
//
// Dans les deux cas le mélange va dans un seul sens, et c'est tout l'intérêt : il borne le pire
// cas. Un mélange réversible (`overlay`, `luminosity`) laisserait passer des plaques quasi blanches
// sous du texte blanc, ou quasi noires sous du texte noir. Le contraste mesuré au pire pixel des
// douze photos reste au-dessus du seuil AA dans chaque zone.
//
// aria-hidden et alt vides : c'est une texture. Un lecteur d'écran qui annoncerait « un poke bowl »
// au milieu d'une accroche commerciale desservirait celui qui l'écoute.
export default function PhotoWash({ depart = 0, combien = 12, variante = 'iris' }) {
  return (
    <div className={`photo-wash photo-wash-${variante}`} aria-hidden="true">
      {/* Clé par position et non par URL : le fond de page répète la liste pour couvrir toute sa
          hauteur, deux tuiles portent donc la même source. La liste est figée et jamais réordonnée,
          l'index est ici une identité stable. */}
      {photosDepuis(depart, combien).map((p, i) => (
        <img key={i} src={p.src} alt="" loading="lazy" decoding="async" draggable="false" />
      ))}
    </div>
  );
}
