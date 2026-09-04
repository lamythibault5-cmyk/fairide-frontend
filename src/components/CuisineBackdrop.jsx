import { useEffect, useRef, useState } from 'react';
import VIDEO from '../assets/cuisine.mp4';
import AFFICHE from '../assets/cuisine.jpg';

// Fond de cuisine plein écran pour la page d'accueil publique.
//
// POURQUOI UNE SEULE IMAGE ET NON UNE MOSAÏQUE. Des versions précédentes posaient une grille de
// petites vignettes. Une grille de vignettes se lit comme une planche contact — c'est-à-dire comme
// du stock —, quelle que soit la qualité de chaque vignette. Un seul plan, cadré large, se lit
// comme une image de marque. C'est la différence entre montrer beaucoup et montrer bien.
//
// LA BOUCLE EST FABRIQUÉE, PAS TROUVÉE. Aucune séquence de banque ne boucle d'elle-même : coupée
// où elle s'arrête, elle saute visiblement au redémarrage. Le fichier livré a donc été monté avec
// ffmpeg — sa queue est fondue par-dessus sa tête, ce qui fait coïncider sa dernière image avec sa
// première. Mesuré : l'écart au raccord vaut 1,98, quand trois images consécutives en écartent déjà
// 2,50. Le raccord est donc plus discret qu'un dixième de seconde de mouvement ordinaire. La
// recette exacte est dans PROVENANCE.md — un fichier de remplacement devra repasser par là.
//
// PAS DE RALENTI. Les plans précédents étaient joués à 0,5× ou 0,75× pour les calmer. Celui-ci est
// filmé sur pied, seule la personne bouge : mesuré à 7,3 de différence moyenne par demi-seconde,
// contre 25 pour le plan d'avant. Il est déjà plus calme à vitesse réelle que le précédent ralenti
// de moitié — et ralentir un geste humain le rend faux.
//
// POURQUOI CETTE SOURCE. Les images de galleryImages.js sont du domaine public collecté sur Flickr :
// des photos d'amateurs, prises au téléphone, sans éclairage. Aucun arrangement ne les fera
// ressembler à autre chose. Ici, une séquence Pexels tournée en 4K (4096 × 2160), sous licence
// libre pour usage commercial sans attribution. Provenance et licences dans PROVENANCE.md.
//
// HÉBERGÉS PAR NOUS, ET C'EST VOULU. Une première version pointait directement sur les CDN de
// Pixabay et Pexels. Ça marchait, mais ça ne dépendait pas de nous : Pexels bloque déjà le lien
// direct vers ses vidéos (403 à la moindre requête), et rien ne garantissait que Pixabay ne ferait
// pas de même. Le jour où ça arrive, la page d'accueil perd son fond sans que personne n'ait rien
// changé, et sans que rien ne le signale. Les deux fichiers sont donc dans le dépôt.
//
// Importés depuis src/assets plutôt que posés dans public/ : Vite leur donne un nom haché sur le
// contenu. Le jour où on remplace la séquence, l'URL change avec elle et les caches se vident
// d'eux-mêmes — là où un chemin fixe aurait continué de servir l'ancienne vidéo à qui l'avait
// déjà vue.

export default function CuisineBackdrop() {
  // La vidéo n'est PAS rendue d'emblée, et pas seulement masquée en CSS : un <video> masqué se
  // télécharge quand même. Elle n'existe donc que si les trois conditions sont réunies, et l'état
  // initial (faux) garantit qu'un téléphone ne paie jamais les deux mégaoctets.
  const [videoOk, setVideoOk] = useState(false);
  const video = useRef(null);

  // Le navigateur suspend la lecture quand l'onglet passe en arrière-plan, et ne la reprend pas
  // toujours au retour : observé ici, la vidéo restait en pause à 8,22 s sur une page pourtant
  // redevenue visible. Un fond figé sur une image, ça ne se signale pas — personne ne saurait que
  // c'est un défaut plutôt qu'un parti pris. On relance donc au retour à l'écran.
  useEffect(() => {
    if (!videoOk) return undefined;
    const reprendre = () => {
      const v = video.current;
      if (v && v.paused && document.visibilityState === 'visible') v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', reprendre);
    return () => document.removeEventListener('visibilitychange', reprendre);
  }, [videoOk]);

  useEffect(() => {
    const large = window.matchMedia('(min-width: 900px)');
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Économiseur de données : l'utilisateur a demandé qu'on ne consomme pas, on ne consomme pas.
    const economie = navigator.connection?.saveData === true;
    const evaluer = () => setVideoOk(large.matches && !calme.matches && !economie);
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
      {videoOk ? (
        <video
          ref={video}
          className="cuisine-fond-media"
          src={VIDEO}
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
          fond ne descend jamais sous le blanc à 62 %, ce qui garantit le contraste du texte quoi
          qu'il se passe à l'écran. */}
      <div className="cuisine-fond-voile" />
    </div>
  );
}
