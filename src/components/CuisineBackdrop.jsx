import { useEffect, useRef, useState } from 'react';
import VIDEO from '../assets/cuisine.mp4';
import AFFICHE from '../assets/cuisine.jpg';
import VIDEO_HD from '../assets/cuisine-hd.mp4';
import AFFICHE_HD from '../assets/cuisine-hd.jpg';
import VIDEO_SD from '../assets/cuisine-sd.mp4';
import AFFICHE_SD from '../assets/cuisine-sd.jpg';
import VIDEO_PORTRAIT from '../assets/cuisine-portrait.mp4';
import AFFICHE_PORTRAIT from '../assets/cuisine-portrait.jpg';

// Fond de cuisine plein écran pour la page d'accueil publique.
//
// UN MONTAGE, PAS UN PLAN. Douze séquences de 8 s enchaînées par fondus de 2,0 s : un cuisinier au
// fourneau, un chef en veste blanche qui dresse, du sel qui tombe dans la fumée sur fond sombre, un
// bol de légumes frais qu'on mélange, un saladier retourné à la pince, un flambé en cuisine
// professionnelle, du sel sur un bol fumant, une pizza qu'on garnit, une macro de tranche de tomate,
// un chef qui prépare un plat, une poêle fumante, un chef qui assaisonne un poisson. 72 secondes,
// une transition toutes les 6 secondes.
//
// Une version antérieure tenait sur un seul plan — une personne prépare une salade, sans autre
// événement. Reposant, mais on en faisait le tour en cinq secondes. Puis huit plans à fondus de
// 1,6 s ; les fondus sont passés à 2,0 s pour des transitions plus douces, et quatre plans se sont
// ajoutés. L'ordre alterne cuisine claire et plans sombres, et espace les temps forts (flambé, poêle
// fumante) au lieu de les enchaîner.
//
// LE RYTHME EST MESURÉ, PAS ESTIMÉ. 18,8 de différence moyenne par demi-seconde — contre 12,9 pour
// le montage à huit plans, 7,3 pour le plan unique, et 25 pour un plan qu'il avait fallu ralentir de
// moitié. Les plans ajoutés bougent plus que les plans de sel qu'ils entourent. Lu à 1×, sans
// ralenti : ralentir un geste humain le rend faux.
//
// LA BOUCLE EST FABRIQUÉE, PAS TROUVÉE. Aucune séquence de banque ne boucle d'elle-même : coupée où
// elle s'arrête, elle saute visiblement au redémarrage. Le fichier livré est monté avec ffmpeg — sa
// queue est fondue par-dessus sa tête, ce qui fait coïncider sa dernière image avec sa première.
// Mesuré : l'écart au raccord vaut 0,95, quand deux images consécutives en écartent 2,90 en moyenne
// (relevé hors fondu, au milieu de chaque plan). Le raccord vaut le tiers d'un vingt-cinquième de
// seconde de mouvement ordinaire. La recette exacte est dans PROVENANCE.md — un fichier de
// remplacement devra repasser par là.
//
// LE MÊME FOND SUR LA PAGE DE CONNEXION. C'est la porte d'entrée du même visiteur ; Layout.jsx ne le
// monte que pour quelqu'un de non connecté, sur / et /login.
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
// QUATRE FICHIERS, LE MÊME MONTAGE, tous tirés des intermédiaires quasi sans perte du montage (CRF 18),
// jamais d'un fichier déjà compressé (recette et poids dans PROVENANCE.md) :
//   - 1400 px et plus (grands écrans, moniteurs) : la 4K, CRF 31 en preset slow — une version
//     précédente était en CRF 35 preset medium, avec des blocs visibles dans la fumée et les fonds
//     sombres, même sous le voile ;
//   - de 900 à 1400 px (portables) : 1920×1080, CRF 27. À cette taille, un 1080p propre vaut mieux
//     qu'une 4K écrasée, pour un quart du poids ;
//   - moins de 900 px en paysage (tablette couchée) : 1600×900, CRF 30 ;
//   - moins de 900 px en portrait (téléphones, tablettes debout) : un recadrage central du 16:9 en
//     810×1440, CRF 30. Une première déclinaison mobile était un 1280×720 paysage : en portrait,
//     object-fit: cover n'en montrait qu'une bande centrale de 405 px de large, agrandie trois fois sur
//     un écran de 1170 px physiques — flou visible malgré le voile. Le recadrage sert au téléphone
//     deux fois plus de pixels utiles, pour un poids voisin.
// Une version encore antérieure ne servait AUCUNE vidéo sous 900 px, seulement la photo : le fond,
// qui est le geste visuel de l'accueil, n'existait donc pas pour la majorité des visiteurs.
//
// Ce que le téléphone ne reçoit toujours pas : la vidéo en « mouvement réduit » (réglage
// d'accessibilité du système) et en économiseur de données — dans les deux cas l'utilisateur l'a
// demandé explicitement, et la photo prend la place.
//
// Le poids des deux fichiers tient parce que l'encodage est serré. Mesuré sur la 4K : contre un
// encodage deux crans au-dessus, l'écart vaut 1,57 en brut et 0,71 une fois le voile appliqué, soit
// quatre fois moins qu'une seule image de mouvement ordinaire (3,02). Compresser plus fort ne se
// voit pas ici, parce que le voile détruit de toute façon le détail fin que la compression abîme.

export default function CuisineBackdrop() {
  // La source n'est PAS choisie d'emblée, et la vidéo n'est pas seulement masquée en CSS : un
  // <video> masqué se télécharge quand même. `source` reste donc nulle tant que les conditions ne
  // sont pas réunies (mouvement réduit, économiseur de données), et c'est ici que se décide quel
  // fichier — 4K ou 720p — le visiteur reçoit, jamais les deux.
  const [source, setSource] = useState(null);
  const [affiche, setAffiche] = useState(AFFICHE);
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

  // iOS en mode économie d'énergie (et quelques navigateurs Android) refuse l'autoplay, même muet :
  // la vidéo reste figée sur son affiche sans que rien ne le dise. Le premier geste du visiteur — un
  // simple défilement suffit — relance la lecture ; un geste, c'est tout ce que ces navigateurs
  // exigent. Écouteurs retirés dès que la lecture tourne.
  useEffect(() => {
    if (!source) return undefined;
    const v = video.current;
    if (!v) return undefined;
    const lancer = () => { if (v.paused) v.play().catch(() => {}); };
    const evenements = ['touchstart', 'pointerdown', 'scroll', 'keydown'];
    const arreter = () => evenements.forEach((e) => window.removeEventListener(e, lancer));
    evenements.forEach((e) => window.addEventListener(e, lancer, { passive: true }));
    v.addEventListener('playing', arreter, { once: true });
    return () => { arreter(); v.removeEventListener('playing', arreter); };
  }, [source]);

  // Révélation au défilement (demande du fondateur, 2026-09-13) : en haut de page on ne voit que l'aplat
  // Fairide ; le montage apparaît dès les premiers pixels de défilement et s'installe en 140 px, soit moins
  // d'un coup de molette. Une première version prenait 260 px et n'allait chercher la vidéo qu'au premier
  // pixel de défilement : le temps qu'elle arrive et se décode, on avait déjà fini de défiler et le fond
  // apparaissait après coup. Ici elle est montée dès que le visiteur montre l'intention de défiler
  // (molette, doigt posé, flèche du clavier), donc avant qu'il en ait besoin, et invisible jusque-là.
  // L'opacité est écrite DIRECTEMENT sur le nœud, pas via un état React. Passée par useState, elle
  // dépendait de l'ordonnanceur : une mise à jour née d'un défilement est de priorité « continue » et
  // pouvait attendre plusieurs images avant d'être peinte — le fond arrivait après le geste. Écrite à la
  // main, elle est là à l'image suivante, et le composant ne se redessine plus à chaque pixel défilé.
  const calque = useRef(null);
  const [visible, setVisible] = useState(false); // sert seulement à lancer ou arrêter la vidéo
  const [chargerMedia, setChargerMedia] = useState(false);
  useEffect(() => {
    let img = 0;
    let pageCourte = false; // page trop courte pour défiler : fond affiché d'emblée (voir le filet plus bas)
    const calculer = () => {
      img = 0;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const o = pageCourte ? 1 : Math.max(0, Math.min(1, (y - 12) / 140));
      if (calque.current) calque.current.style.opacity = String(o);
      setVisible(o > 0.02);
      if (o > 0) setChargerMedia(true);
    };
    // Onglet en arrière-plan : requestAnimationFrame ne tourne pas, on calcule directement — sinon le fond
    // resterait figé au retour sur l'onglet tant que rien ne bouge.
    const auDefilement = () => {
      if (document.hidden) { calculer(); return; }
      if (!img) img = requestAnimationFrame(calculer);
    };
    calculer();
    window.addEventListener('scroll', auDefilement, { passive: true });
    window.addEventListener('resize', auDefilement);
    document.addEventListener('visibilitychange', calculer);
    // Filet : sur une page trop courte pour défiler, le fond doit quand même exister.
    const court = setTimeout(() => { if (document.documentElement.scrollHeight <= window.innerHeight + 40) { pageCourte = true; calculer(); } }, 1200);
    // Intention de défiler : la molette tourne, un doigt se pose, une flèche est enfoncée. On monte la vidéo
    // à cet instant — elle a le temps d'arriver pendant le geste, et le fond est là au premier pixel.
    const intention = () => setChargerMedia(true);
    for (const e of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(e, intention, { passive: true, once: true });
    const prechauffe = setTimeout(intention, 900);
    return () => {
      window.removeEventListener('scroll', auDefilement); window.removeEventListener('resize', auDefilement);
      document.removeEventListener('visibilitychange', calculer);
      for (const e of ['wheel', 'touchstart', 'pointerdown', 'keydown']) window.removeEventListener(e, intention);
      cancelAnimationFrame(img); clearTimeout(court); clearTimeout(prechauffe);
    };
  }, []);
  // Rien à l'écran : on met la vidéo en pause plutôt que de la décoder pour personne (batterie des téléphones).
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (!visible) v.pause();
    else if (v.paused) v.play().catch(() => {});
  }, [visible, source, chargerMedia]);

  useEffect(() => {
    const large = window.matchMedia('(min-width: 900px)');
    const tresLarge = window.matchMedia('(min-width: 1400px)');
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluer = () => {
      // Économiseur de données : l'utilisateur a demandé qu'on ne consomme pas, on ne consomme pas.
      const economie = navigator.connection?.saveData === true;
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      const [videoChoisie, afficheChoisie] = tresLarge.matches ? [VIDEO, AFFICHE]
        : large.matches ? [VIDEO_HD, AFFICHE_HD]
          : portrait ? [VIDEO_PORTRAIT, AFFICHE_PORTRAIT] : [VIDEO_SD, AFFICHE_SD];
      setAffiche(afficheChoisie);
      setSource(calme.matches || economie ? null : videoChoisie);
    };
    const orientation = window.matchMedia('(orientation: portrait)');
    evaluer();
    large.addEventListener('change', evaluer);
    tresLarge.addEventListener('change', evaluer);
    calme.addEventListener('change', evaluer);
    orientation.addEventListener('change', evaluer);
    return () => {
      large.removeEventListener('change', evaluer);
      tresLarge.removeEventListener('change', evaluer);
      calme.removeEventListener('change', evaluer);
      orientation.removeEventListener('change', evaluer);
    };
  }, []);

  return (
    <div className="cuisine-fond" aria-hidden="true">
      {/* Le montage et son voile fondent ensemble : à 0, il ne reste que l'aplat Fairide du conteneur. */}
      <div className="cuisine-fond-calque" ref={calque}>
      {!chargerMedia ? null : source ? (
        <video
          ref={video}
          className="cuisine-fond-media"
          src={source}
          poster={affiche}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img className="cuisine-fond-media" src={affiche} alt="" decoding="async" />
      )}
      {/* Le voile est ce qui rend le reste possible. Une vidéo change de luminosité d'une image à
          l'autre : contrairement à une photo fixe, on ne peut pas calculer son pire pixel. Le voile
          impose donc un plancher indépendant du contenu — même sur une image entièrement noire, le
          fond ne descend jamais sous le blanc à 55 %, ce qui garantit le contraste du texte quoi
          qu'il se passe à l'écran. */}
      <div className="cuisine-fond-voile" />
      </div>
    </div>
  );
}
