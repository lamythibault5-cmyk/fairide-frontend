import { useEffect, useRef, useState } from 'react';
import VIDEO_1080 from '../assets/cuisine.mp4';
import VIDEO_4K from '../assets/cuisine-4k.mp4';
import AFFICHE from '../assets/cuisine.jpg';

// Fond de cuisine plein écran pour la page d'accueil publique.
//
// UN MONTAGE, PAS UN PLAN. Cinq séquences enchaînées par fondus : une préparation de salade dans une
// cuisine claire, des mains qui émincent des tomates, un saladier qu'on retourne à la pince, une
// macro de tranche de tomate, un filet d'huile dans une poêle. 44 secondes, une transition toutes
// les neuf secondes environ.
//
// Une version précédente tenait sur un seul plan — une personne prépare une salade, sans autre
// événement. Reposant, mais on en a fait le tour en cinq secondes, et le reste du temps le fond ne
// racontait plus rien. Le montage donne du rythme sans agiter : mesuré à 14,6 de différence moyenne
// par demi-seconde, soit exactement le double du plan unique (7,3), et bien en deçà des 25 d'un plan
// qu'il avait fallu ralentir de moitié. Les pics sont aux fondus, c'est-à-dire voulus.
//
// LA BOUCLE EST FABRIQUÉE, PAS TROUVÉE. Aucune séquence de banque ne boucle d'elle-même : coupée où
// elle s'arrête, elle saute visiblement au redémarrage. Le fichier livré est monté avec ffmpeg — sa
// queue est fondue par-dessus sa tête, ce qui fait coïncider sa dernière image avec sa première.
// Mesuré : l'écart au raccord vaut 6,03, quand trois images consécutives en écartent déjà 7,00. Le
// raccord saute donc moins qu'un dixième de seconde de mouvement ordinaire. La recette exacte est
// dans PROVENANCE.md — un fichier de remplacement devra repasser par là.
//
// PAS DE RALENTI. Les tout premiers plans étaient joués à 0,5× ou 0,75× pour les calmer. Celui-ci
// n'en a pas besoin, et ralentir un geste humain le rend faux.
//
// POURQUOI CES SOURCES. Les images de galleryImages.js sont du domaine public collecté sur Flickr :
// des photos d'amateurs, prises au téléphone, sans éclairage. Aucun arrangement ne les fera
// ressembler à autre chose. Ici, cinq séquences Pexels tournées en 4K, sous licence libre pour usage
// commercial sans attribution. Provenance et licences dans PROVENANCE.md.
//
// HÉBERGÉS PAR NOUS, ET C'EST VOULU. Une première version pointait directement sur les CDN de
// Pixabay et Pexels. Ça marchait, mais ça ne dépendait pas de nous : Pexels bloque déjà le lien
// direct vers ses vidéos (403 à la moindre requête). Le jour où ça arrive, la page d'accueil perd
// son fond sans que personne n'ait rien changé, et sans que rien ne le signale.
//
// Importés depuis src/assets plutôt que posés dans public/ : Vite leur donne un nom haché sur le
// contenu. Le jour où on remplace la séquence, l'URL change avec elle et les caches se vident
// d'eux-mêmes — là où un chemin fixe aurait continué de servir l'ancienne vidéo à qui l'avait
// déjà vue.

// La 4K pèse 28 Mo, la version 1080p 6,5 Mo. Le seuil n'est donc pas une largeur de fenêtre mais un
// nombre de pixels RÉELS : un écran de 1920 points affiché à dpr 1 ne montre que 1920 pixels, et la
// 4K n'y ajoute strictement rien pour quatre fois le poids. Elle n'est servie qu'au-delà de 2560
// pixels réels — écrans Retina et moniteurs 4K, les seuls qui aient de quoi la rendre.
const SEUIL_4K = 2560;

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
      if (!large.matches || calme.matches || economie) return setSource(null);
      const pixelsReels = window.innerWidth * (window.devicePixelRatio || 1);
      return setSource(pixelsReels >= SEUIL_4K ? VIDEO_4K : VIDEO_1080);
    };
    evaluer();
    // Volontairement pas d'écoute du redimensionnement : rien ne justifie de retélécharger 28 Mo
    // parce qu'on a élargi sa fenêtre. Le choix se fait à l'arrivée sur la page, une fois.
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
          key={source}
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
