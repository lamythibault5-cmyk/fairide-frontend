import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';
import { euros } from '../prixPlat';
import ChiffresRoulants from './ChiffresRoulants';

// La pilule du panier : « Voir le panier · 2 », posee au-dessus de la barre d'onglets.
//
// C'etait une bulle qui se DEPLIAIT par-dessus la page : on lisait ses articles dans une fenetre
// de la taille d'une carte de visite, posee sur le menu qu'elle cachait a moitie, avec ses propres
// steppers, son propre calcul de totaux et son propre bouton de commande - une demi-page de
// paiement flottante. Tout cela vit maintenant sur /panier, une vraie page.
//
// Ce qui reste ici est ce qu'une barre de panier doit faire : dire qu'il y a quelque chose dedans,
// combien, et y mener. Rien quand le panier est vide : un panier vide n'a rien a annoncer, et la
// bulle « Panier vide » d'avant recouvrait le contenu des autres pages sans rien apprendre.
/* LA BULLE, AILLEURS QUE DANS LES COMMERCES (fondateur, 2026-10-17 : « dans Mon compte je ne veux pas voir mon panier ;
 * il cache le bouton Parcourir les commerces, la carte… pousse-le sur le côté »). La barre complète ne reste que là où
 * l'on remplit son panier — la liste des commerces et la fiche d'un commerce. Partout ailleurs (Mon compte, Mes commandes,
 * la Carte, la Recherche, Favoris…), le panier se range en une bulle ronde sur le côté droit : le sac et son compteur, un
 * toucher mène au panier. Le total reste dit aux lecteurs d'écran (aria-label). */
function pageDAchat(chemin) {
  return chemin === '/restaurants' || chemin.startsWith('/restaurants/');
}

export default function FloatingCart() {
  const cart = useCart();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const bulle = !pageDAchat(pathname);
  const visible = cart.count > 0;
  // La pilule est fixe : sans place réservée en bas de page, elle recouvrait le dernier plat de la carte
  // (nom et prix illisibles sur une carte courte). La classe ajoute cette marge tant qu'elle est affichée.
  useEffect(() => {
    if (!visible) return undefined;
    document.documentElement.classList.add('avec-pilule-panier');
    return () => document.documentElement.classList.remove('avec-pilule-panier');
  }, [visible]);
  // Rebond à l'arrivée d'un plat (gestes.js envolerVersPanier) ou quand le compte augmente par un autre chemin.
  const [rebond, setRebond] = useState(0);
  const avant = useRef(cart.count);
  useEffect(() => {
    const ecoute = () => setRebond((n) => n + 1);
    window.addEventListener('fairide:panier-atterri', ecoute);
    return () => window.removeEventListener('fairide:panier-atterri', ecoute);
  }, []);
  useEffect(() => { if (cart.count > avant.current) setRebond((n) => n + 1); avant.current = cart.count; }, [cart.count]);
  if (!visible) return null;

  return (
    <Link to="/panier" className={`panier-pilule${bulle ? ' panier-pilule--bulle' : ''}${rebond ? ' panier-pilule--rebond' : ''}`} key={`pilule-${rebond}`}
      aria-label={`${t('panier.viewCart')} · ${euros(cart.sousTotal)}`}>
      <span className="panier-pilule-icone" aria-hidden="true">
        <Icone nom="sac" taille={20} />
        {/* Le compteur sur l'icone, comme sur une application de courses : on voit d'un coup d'oeil
            combien d'articles attendent, sans avoir a lire. */}
        <span className="panier-pilule-compte" key={cart.count}>{cart.count}</span>
      </span>
      <span className="panier-pilule-texte">{t('panier.viewCart')}</span>
      {/* Le même sous-total que la colonne et la page Panier, offres comprises (audit du 19/10, discovery-16). */}
      <b className="panier-pilule-total"><ChiffresRoulants valeur={euros(cart.sousTotal)} /></b>
    </Link>
  );
}
