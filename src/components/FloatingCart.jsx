import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';

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
export default function FloatingCart() {
  const cart = useCart();
  const { t } = useLanguage();
  if (cart.count === 0) return null;

  return (
    <Link to="/panier" className="panier-pilule">
      <span className="panier-pilule-icone" aria-hidden="true">
        <Icone nom="sac" taille={20} />
        {/* Le compteur sur l'icone, comme sur une application de courses : on voit d'un coup d'oeil
            combien d'articles attendent, sans avoir a lire. */}
        <span className="panier-pilule-compte">{cart.count}</span>
      </span>
      <span>{t('panier.viewCart')}</span>
      <b>{cart.rawTotal.toFixed(2)}€</b>
    </Link>
  );
}
