import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { SkeletonCards, SqueletteEcran } from '../../components/Skeleton';
import EtatVide from '../../components/EtatVide';
import { useToast } from '../../context/ToastContext';
import { ligneIndisponible, lignesIndisponibles } from '../../panierDisponible';
import Icone from '../../components/Icone';
import ConfirmDialog from '../../components/ConfirmDialog';
import ChiffresRoulants from '../../components/ChiffresRoulants';
import { BandeauCommande, BarreCommande, FeuilleCommande, RouteCommande, RouteEtapes } from '../../components/EcranCommande';
import { experienceApp } from '../../natif';
import { computeUpsellSuggestions, LastChanceUpsell } from '../../components/UpsellPanier';
import { euros, remiseCourte } from '../../prixPlat';
import { mouvementReduit, vibrer } from '../../gestes';
import BandeauGroupe from '../../components/client/BandeauGroupe';

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
//
// HABIT DU 2026-10-16 (« Proposition » de mockups/tous-les-ecrans.html, fondateur) : le commerce et « Ton panier » sur un
// bandeau iris où le vélo arrive, les lignes dans la feuille blanche, des compteurs iris au chiffre dans un rond lime (comme
// le « − n + » de la carte, 3C), et dans l'app le sous-total qui roule dans la pastille iris d'une barre de verre (2C). Même
// contenu et mêmes fonctions qu'avant.
//
// LE SITE (2026-10-16, mockups/site-ordinateur.html, section 5) : la route Panier → Paiement → Suivi traverse le bandeau, et
// sur un ordinateur la page passe en deux colonnes — les lignes et les suggestions à gauche, un récapitulatif collant à
// droite (sous-total qui roule, le seul bouton lime). Sur un téléphone, la barre iris reste collée en bas. Styles :
// site-commande.css, sous html:not(.appli) ; l'app garde exactement sa page.
const APPLI = experienceApp();

// Les deux traits du compteur : Icone.jsx n'a ni plus ni moins.
const TRAIT_MOINS = <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;
const TRAIT_PLUS = <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>;

// Le compteur d'une ligne : − et + sur une pilule iris, le nombre dans un rond blanc (lime jusqu'au 2026-10-19 : avec trois
// lignes, quatre marques lime à l'écran ; le bouton de paiement est désormais le seul lime), qui monte ou descend quand il change.
function PasPanier({ qty, nom, onMoins, onPlus, libelleMoins, libellePlus }) {
  const avant = useRef(qty);
  const sens = qty > avant.current ? ' ec-ch-monte' : qty < avant.current ? ' ec-ch-descend' : '';
  useEffect(() => { avant.current = qty; }, [qty]);
  return (
    <span className="ec-pas" role="group" aria-label={nom}>
      <button type="button" className="ec-pas-moins" onClick={onMoins} aria-label={libelleMoins}>{TRAIT_MOINS}</button>
      <span className="ec-pas-chiffre" aria-live="polite"><span key={qty} className={sens.trim() || undefined}>{qty}</span></span>
      <button type="button" className="ec-pas-plus" onClick={onPlus} aria-label={libellePlus}>{TRAIT_PLUS}</button>
    </span>
  );
}

// Le prix d'une ligne = ce qu'on paie (audit design 2 du 2026-10-19, « un seul récit du prix ») : le même prix remisé que
// sur la carte, et « −5 % inclus » quand une offre s'applique. Jamais l'ancien prix barré (règle du fondateur).
function PrixLigne({ ligne, remise, t }) {
  const paye = Math.max(0, ligne.unitPrice * ligne.qty - (remise?.discount || 0));
  return (
    <span className="panier-ligne-prix">
      <b className="panier-ligne-paye">{euros(paye)}</b>
      {remise?.discount > 0 && remiseCourte(remise.promo, t) && <> · {t('panier.remiseIncluse', { remise: remiseCourte(remise.promo, t) })}</>}
    </span>
  );
}

export default function PanierPage() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token } = useAuth();
  // « Vider » demande confirmation (audit du 15/10/2026) : un toucher effaçait tout le panier, sans retour possible.
  const [viderOuvert, setViderOuvert] = useState(false);
  const [restaurant, setRestaurant] = useState(null);
  const [chargement, setChargement] = useState(true);
  // Lignes qui glissent hors de la feuille avant d'être retirées du panier (dernier « − »).
  const [sortantes, setSortantes] = useState(() => new Set());

  useEffect(() => {
    if (!cart.restaurantId) { setChargement(false); return; }
    api(`/restaurants/${cart.restaurantId}`, { token }).then(setRestaurant).catch(() => {}).finally(() => setChargement(false));
  }, [cart.restaurantId, token]);

  // Les totaux précis demandent le menu du restaurant (promotions, prix à jour) ; sans lui, on
  // affiche la somme des prix mémorisés dans le panier plutôt que de ne rien afficher.
  const totaux = restaurant && cart.count > 0 ? cart.totals(restaurant.menu, restaurant.activeCartPromo) : null;
  const sousTotal = totaux ? totaux.subtotal : cart.rawTotal;

  /* PANIER VIDE (fondateur, 2026-10-17, « Empty cart » de mockups/commerces-marque.html) : le même bandeau que le panier plein,
     pour que l'écran ne change pas d'habit quand on retire le dernier article. */
  if (cart.count === 0) {
    return (
      <div className="panier-page ec-page sc-page panier-vide">
        <BandeauCommande vers="/restaurants" libelleRetour={t('restaurantMenu.backToRestaurants')} titre={t('panier.title')} sous={t('panier.bandeauVide')}>
          {APPLI ? <RouteCommande position={8} /> : <RouteEtapes actuelle={0} />}
        </BandeauCommande>
        <FeuilleCommande>
          <EtatVide
            icone="sac" scene="panier" titre={t('panier.emptyTitle')} texte={t('panier.emptyText')}
            actionVers="/restaurants" actionTexte={t('orders.emptyAction')}
          />
        </FeuilleCommande>
      </div>
    );
  }
  // Chargement dans l'app : le bandeau et la feuille dès la première image (Skeleton.jsx, audit « Look and feel »).
  if (chargement) return experienceApp() ? <SqueletteEcran titre={t('panier.title')} lignes={2} /> : <SkeletonCards count={2} />;

  const { desserts, drinks } = restaurant ? computeUpsellSuggestions(restaurant, cart) : { desserts: [], drinks: [] };

  function moins(cle, ligne) {
    vibrer(8);
    if (ligne.qty > 1 || mouvementReduit()) { cart.changeLineQty(cle, -1); return; }
    setSortantes((s) => new Set(s).add(cle));
    setTimeout(() => {
      cart.changeLineQty(cle, -1);
      setSortantes((s) => { const n = new Set(s); n.delete(cle); return n; });
    }, 260);
  }

  // Plats qui ne se commandent plus (rupture, retirés) : marqués, « Retirer », et le paiement attend qu'ils soient partis.
  const indisponibles = lignesIndisponibles(cart.lines, restaurant?.menu);
  const barre = (
    <BarreCommande montant={sousTotal} className="panier-barre">
      <span className="co-barre-total">
        <span className="co-barre-montant"><ChiffresRoulants valeur={euros(sousTotal)} /></span>
        <span className="co-barre-detail">{t('common.subtotal')}</span>
      </span>
      <button type="button" className="btn-gold" onClick={() => (indisponibles.length ? toast(t('checkout.removeUnavailable'), 'erreur') : navigate('/checkout'))}>{t('panier.toCheckout')}</button>
    </BarreCommande>
  );

  return (
    <div className="panier-page ec-page sc-page">
      {/* Une flèche, et non une croix : d'ici on RECULE d'un pas, vers la carte du commerce — on ne
          quitte pas le parcours. Le nom du commerce est en tête du bandeau, comme chez Uber. */}
      <BandeauCommande
        vers={cart.restaurantId ? `/restaurants/${cart.restaurantId}` : null}
        libelleRetour={t('panier.backToMenu')}
        haut={<><b>{cart.restaurantName || restaurant?.name || ''}</b>{restaurant?.commune ? ` · ${restaurant.commune}` : ''}</>}
        titre={t('panier.title')}
        sous={t(cart.count > 1 ? 'ecranCommande.articlesPluriel' : 'ecranCommande.articles', { count: cart.count })}
      >
        {APPLI ? <RouteCommande position={22} depart={-12} /> : <RouteEtapes actuelle={0} />}
      </BandeauCommande>

      <FeuilleCommande>
        {/* Commande groupée en cours : ce panier est une part à envoyer au groupe, pas à payer soi-même. */}
        <BandeauGroupe restaurantId={cart.restaurantId} />
        <div className="sc-grille">
        <div className="sc-principal">
        <div className="panier-lignes">
          {Object.entries(cart.lines).map(([cle, ligne]) => (
            <div key={cle} className={`panier-ligne${sortantes.has(cle) ? ' ec-sort' : ''}${indisponibles.includes(cle) ? ' panier-ligne--indispo' : ''}`}>
              {ligne.imageUrl
                ? <img className="panier-ligne-image" src={ligne.imageUrl} alt="" loading="lazy" />
                : <span className="panier-ligne-image panier-ligne-image-vide" aria-hidden="true"><Icone nom="restaurants" taille={20} /></span>}
              <div className="panier-ligne-texte">
                <b>{ligne.name}</b>
                {ligne.optionsSnapshot?.length > 0 && (
                  <span className="small">{ligne.optionsSnapshot.map((o) => o.name).join(', ')}</span>
                )}
                {ligne.note && <span className="small">« {ligne.note} »</span>}
                {ligneIndisponible(ligne, restaurant?.menu)
                  ? <span className="ligne-indispo">{t('checkout.unavailableToday')}</span>
                  : <PrixLigne ligne={ligne} remise={totaux?.lineDiscounts?.[cle]} t={t} />}
              </div>
              {indisponibles.includes(cle) ? (
                <button type="button" className="btn-outline btn-sm" onClick={() => cart.removeLine(cle)}>{t('checkout.removeLine')}</button>
              ) : (
              <PasPanier
                qty={ligne.qty} nom={ligne.name}
                onMoins={() => moins(cle, ligne)}
                onPlus={() => { vibrer(8); cart.changeLineQty(cle, 1); }}
                libelleMoins={t('checkout.qtyLess')} libellePlus={t('checkout.qtyMore')}
              />
              )}
            </div>
          ))}
          {/* Une phrase, et non plus une liste de remises sans titre sous les suggestions (audit design 2, 2026-10-19) : les
              lignes montrent déjà le prix payé, on dit seulement combien l'offre fait gagner et qui l'offre. */}
          {totaux?.promoDiscount > 0 && (
            <p className="panier-economie">{t('panier.economie', { amount: euros(totaux.promoDiscount), name: cart.restaurantName || restaurant?.name || '' })}</p>
          )}
          <button type="button" className="btn-ghost panier-vider" onClick={() => setViderOuvert(true)}>{t('floatingCart.clear')}</button>
          <ConfirmDialog open={viderOuvert} title={t('floatingCart.clearConfirmTitle')} message={t('floatingCart.clearConfirmBody')}
            confirmLabel={t('floatingCart.clear')} danger onConfirm={() => { setViderOuvert(false); cart.clearLines(); }} onCancel={() => setViderOuvert(false)} />
        </div>

        {restaurant && <LastChanceUpsell desserts={desserts} drinks={drinks} restaurant={restaurant} cart={cart} t={t} />}
        </div>
        {/* Site : le récapitulatif à droite (sur un téléphone, seule la barre en reste, collée en bas de l'écran). */}
        {!APPLI && (
          <aside className="sc-recap" aria-label={t('siteCommande.recap')}>
            <h2 className="sc-recap-titre">{t('siteCommande.recap')}</h2>
            <p className="sc-recap-sous">{cart.restaurantName || restaurant?.name || ''} · {t(cart.count > 1 ? 'ecranCommande.articlesPluriel' : 'ecranCommande.articles', { count: cart.count })}</p>
            {barre}
            <p className="sc-recap-note">{t('siteCommande.suiteAuPaiement')}</p>
          </aside>
        )}
        </div>
      </FeuilleCommande>

      {APPLI && barre}
    </div>
  );
}
