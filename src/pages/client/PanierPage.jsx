import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import EtatVide from '../../components/EtatVide';
import Icone from '../../components/Icone';
import EnteteFlux from '../../components/EnteteFlux';
import { computeUpsellSuggestions, LastChanceUpsell } from '../../components/UpsellPanier';

// Le panier, sur sa propre page.
//
// C'était une bulle qui se dépliait par-dessus la page qu'on était en train de lire : on y voyait
// ses articles dans une fenêtre de la taille d'une carte de visite, posée sur un menu qu'elle
// cachait à moitié. Une page laisse la place de voir ce qu'on a commandé, de corriger les
// quantités, et de se faire proposer une boisson — ce qui se décide devant son panier, pas une fois
// engagé dans le paiement.
//
// L'ordre suit celui de l'application dont le fondateur a fourni les captures : les articles, puis
// les suggestions, puis un seul bouton vers le paiement.
export default function PanierPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [restaurant, setRestaurant] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!cart.restaurantId) { setChargement(false); return; }
    api(`/restaurants/${cart.restaurantId}`).then(setRestaurant).catch(() => {}).finally(() => setChargement(false));
  }, [cart.restaurantId]);

  if (cart.count === 0) {
    return (
      <EtatVide
        icone="sac" titre={t('panier.emptyTitle')} texte={t('panier.emptyText')}
        actionVers="/restaurants" actionTexte={t('orders.emptyAction')}
      />
    );
  }
  if (chargement) return <SkeletonCards count={2} />;

  // Les totaux précis demandent le menu du restaurant (promotions, prix à jour) ; sans lui, on
  // affiche la somme des prix mémorisés dans le panier plutôt que de ne rien afficher.
  const totaux = restaurant ? cart.totals(restaurant.menu, restaurant.activeCartPromo) : null;
  const sousTotal = totaux ? totaux.subtotal : cart.rawTotal;
  const { desserts, drinks } = restaurant ? computeUpsellSuggestions(restaurant, cart) : { desserts: [], drinks: [] };

  return (
    <div className="panier-page">
      {/* Une flèche, et non une croix : d'ici on RECULE d'un pas, vers la carte du commerce — on ne
          quitte pas le parcours. Le nom du commerce devient le titre de l'écran, comme chez Uber. */}
      {cart.restaurantId && (
        <EnteteFlux
          vers={`/restaurants/${cart.restaurantId}`}
          titre={cart.restaurantName || ''}
          libelle={t('panier.backToMenu')}
        />
      )}
      <h1 className="page-title" style={{ margin: '0 0 16px' }}>{t('panier.title')}</h1>

      <div className="card panier-lignes">
        {Object.entries(cart.lines).map(([cle, ligne]) => (
          <div key={cle} className="panier-ligne">
            {ligne.imageUrl
              ? <img className="panier-ligne-image" src={ligne.imageUrl} alt="" loading="lazy" />
              : <span className="panier-ligne-image panier-ligne-image-vide" aria-hidden="true"><Icone nom="restaurants" taille={20} /></span>}
            <div className="panier-ligne-texte">
              <b>{ligne.name}</b>
              {ligne.optionsSnapshot?.length > 0 && (
                <span className="small">{ligne.optionsSnapshot.map((o) => o.name).join(', ')}</span>
              )}
              <span className="panier-ligne-prix">{(ligne.unitPrice * ligne.qty).toFixed(2)}€</span>
            </div>
            <div className="panier-stepper">
              <button type="button" onClick={() => cart.changeLineQty(cle, -1)} aria-label="−">−</button>
              <span>{ligne.qty}</span>
              <button type="button" onClick={() => cart.changeLineQty(cle, 1)} aria-label="+">+</button>
            </div>
          </div>
        ))}
        <button type="button" className="btn-ghost panier-vider" onClick={() => cart.clearLines()}>{t('floatingCart.clear')}</button>
      </div>

      {restaurant && <LastChanceUpsell desserts={desserts} drinks={drinks} restaurant={restaurant} cart={cart} t={t} />}

      {totaux && totaux.discountedItems.map((d, i) => (
        <div className="row panier-remise" key={i}>
          <span className="small">{d.name || d.label}</span><span className="small">-{d.discount.toFixed(2)}€</span>
        </div>
      ))}

      <div className="cart-bar">
        <span>{t('common.subtotal')} · <b>{sousTotal.toFixed(2)}€</b></span>
        <button type="button" className="btn-gold" onClick={() => navigate('/checkout')}>{t('panier.toCheckout')}</button>
      </div>
    </div>
  );
}
