import { useEffect, useRef, useState } from 'react';
import VIDEO from '../assets/cuisine.mp4';
import AFFICHE from '../assets/cuisine.jpg';

// Fond de cuisine plein écran pour la page d'accueil publique.
//
// UN MONTAGE, PAS UN PLAN. Huit séquences enchaînées par fondus de 1,6 s : une salade préparée dans
// une cuisine claire, un chef en veste blanche qui dresse, du sel qui tombe dans la fumée sur fond
// sombre, un saladier retourné à la pince, un flambé en cuisine professionnelle, du sel sur un bol
// fumant, une macro de tranche de tomate, un chef qui assaisonne un poisson. 51,2 secondes, une
// transition toutes les 6,4 secondes.
//
// Une version antérieure tenait sur un seul plan — une personne prépare une salade, sans autre
// événement. Reposant, mais on en faisait le tour en cinq secondes. L'ordre des plans n'est pas
// indifférent : les deux plans sombres de sel et de fumée encadrent le flambé, pour qu'on monte vers
// le pic et qu'on en redescende au lieu d'enchaîner deux temps forts.
//
// LE RYTHME EST MESURÉ, PAS ESTIMÉ. 12,9 de différence moyenne par demi-seconde — contre 7,3 pour le
// plan unique, 14,1 pour le montage à six, et 25 pour un plan qu'il avait fallu ralentir de moitié.
// Deux plans de plus et le rythme BAISSE : les nouveaux sont des plans lents, du sel qui tombe. Les
// pointes restent locales — fondus et flammes — donc voulues. Lu à 1×, sans ralenti : ralentir un
// geste humain le rend faux.
//
// LA BOUCLE EST FABRIQUÉE, PAS TROUVÉE. Aucune séquence de banque ne boucle d'elle-même : coupée où
// elle s'arrête, elle saute visiblement au redémarrage. Le fichier livré est monté avec ffmpeg — sa
// queue est fondue par-dessus sa tête, ce qui fait coïncider sa dernière image avec sa première.
// Mesuré : l'écart au raccord vaut 3,07, quand trois images consécutives en écartent 7,02 en moyenne
// (relevé hors fondu, en huit points du montage). Le raccord est deux fois plus discret qu'un
// dixième de seconde de mouvement ordinaire. La recette exacte est dans PROVENANCE.md — un fichier
// de remplacement devra repasser par là.
//
// POURQUOI CES SOURCES. Les images de galleryImages.js sont du domaine public collecté sur Flickr :
// des photos d'amateurs, prises au téléphone, sans éclairage. Aucun arrangement ne les fera
// ressembler à autre chose. Ici, huit séquences Pexels tournées en 4K, sous licence libre pour usage
// commercial sans attribution. Provenance et licences dans PROVENANCE.md.
//
// HÉBERGÉES PAR NOUS, ET C'EST VOULU. Une première version pointait directement sur les CDN de
// Pixabay et Pexels. Ça marchait, mais ça ne dépendait pas de nous : Pexels bloque déjà le lien
// direct vers ses vidéos (403 à la moindre requête). Le jour où ça arrive, la page d'accueil perd
// son fond sans que personne n'ait rien changé, et sans que rien ne le signale.
//
// Importés depuis src/assets plutôt que posés dans public/ : Vite leur donne un nom haché sur le
// contenu. Le jour où on remplace la séquence, l'URL change avec elle et les caches se vident
// d'eux-mêmes — là où un chemin fixe aurait continué de servir l'ancienne vidéo à qui l'avait
// déjà vue.
//
// LA 4K POUR TOUT LE MONDE. Une version précédente ne la servait qu'au-delà de 2560 pixels réels et
// livrait du 1080p ailleurs. Le choix est désormais unique : 22 Mo pour tous ceux qui reçoivent la
// vidéo — donc jamais un téléphone, jamais en mouvement réduit, jamais en économiseur de données.
//
// Ce poids tient parce que l'encodage est serré (CRF 35). Mesuré : contre un encodage deux crans
// au-dessus, l'écart vaut 1,57 en brut et 0,71 une fois le voile appliqué, soit quatre fois moins
// qu'une seule image de mouvement ordinaire (3,02). Compresser plus fort ne se voit pas ici, parce
// que le voile détruit de toute façon le détail fin que la compression abîme.

export default function CuisineBackdrop() {
  // La source n'est PAS choisie d'emblée, et la vidéo n'est pas seulement masquée en CSS : un
  // <video> masqué se télécharge quand même. `source` reste donc nulle tant que les conditions ne
  // sont pas réunies, ce qui garantit qu'un téléphone ne paie jamais les mégaoctets.
  const [source, setSource] = useState(null);
  const video = useRef(null);

  // Le navigateur suspend la lecture quand l'onglet passe en arrière-plan, et ne la reprend pas
  // toujours au retour : observé ici, la vidéo restait en pause sur une page pourtant redevenue
  // visible. Un fond figé sur une image, ça ne se signale pas — personne ne saurait que c'est un
  // défaut plutôt qu'un parti pris. On relance donc au retour à l'écran.
  useEffect(() => {
    if (!source) return undefined;
    const reprendre = () => {
      const v = video.current;
      if (v && v.paused && document.visibilityState === 'visible') v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', reprendre);
    return () => document.removeEventListener('visibilitychange', reprendre);
  }, [source]);

  useEffect(() => {
    const large = window.matchMedia('(min-width: 900px)');
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluer = () => {
      // Économiseur de données : l'utilisateur a demandé qu'on ne consomme pas, on ne consomme pas.
      const economie = navigator.connection?.saveData === true;
      setSource(!large.matches || calme.matches || economie ? null : VIDEO);
    };
    evaluer();
    large.addEventListener('change', evaluer);
    calme.addEventListener('change', evaluer);
    return () => {
      large.removeEventListener('change', evaluer);
      calme.removeEventListener('change', evaluer);
    };
  }, []);

  return (
    <div className="cuisine-fond" aria-hidden="true">
      {source ? (
        <video
          ref={video}
          className="cuisine-fond-media"
          src={source}
          poster={AFFICHE}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img className="cuisine-fond-media" src={AFFICHE} alt="" decoding="async" />
      )}
      {/* Le voile est ce qui rend le reste possible. Une vidéo change de luminosité d'une image à
          l'autre : contrairement à une photo fixe, on ne peut pas calculer son pire pixel. Le voile
          impose donc un plancher indépendant du contenu — même sur une image entièrement noire, le
          fond ne descend jamais sous le blanc à 55 %, ce qui garantit le contraste du texte quoi
          qu'il se passe à l'écran. */}
      <div className="cuisine-fond-voile" />
    </div>
  );
}
