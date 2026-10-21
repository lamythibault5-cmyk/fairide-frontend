import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { euros } from '../prixPlat';
import { vibrer } from '../gestes';
import ChiffresRoulants from './ChiffresRoulants';
import EtatVide from './EtatVide';
import { ligneIndisponible } from '../panierDisponible';

/* LE PANIER EN COLONNE, À DROITE DE LA CARTE (fondateur, 2026-10-16, « Page d'un commerce » de mockups/site-ordinateur.html).
 * Sur un ordinateur, la place ne manque pas : au lieu d'une pilule posée sur la carte, le panier vit dans une colonne collante
 * à côté d'elle. On voit ce qu'on a pris en ajoutant, on corrige une quantité sans quitter la carte, et le total roule.
 *
 * Ce qu'elle montre, et rien de plus : les lignes (avec le compteur « − n + » de la version 3C, le chiffre dans un rond lime),
 * le sous-total des plats et « Voir le panier ». Pas de paiement ici : les frais, le pourboire, les codes et les cases légales
 * vivent sur /panier puis /checkout, comme avant. Le sous-total est celui du panier (CartContext.totals : remises des plats
 * comprises), pas une seconde règle de calcul.
 *
 * Elle n'existe que dans la mise en page large de la fiche (site-fiche.css la masque sinon). Quand elle est affichée, elle le
 * dit à la page (classe `panier-en-colonne` sur <html>) : la pilule flottante (FloatingCart), qui ferait doublon, se retire.
 * La mesure plutôt qu'une requête média recopiée : c'est la CSS de la fiche qui décide, la pilule suit. */
export default function PanierColonne({ restaurant, mode }) {
  const cart = useCart();
  const { t } = useLanguage();
  const racine = useRef(null);
  const [rebond, setRebond] = useState(0);

  useEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const html = document.documentElement;
    const obs = new ResizeObserver(([e]) => html.classList.toggle('panier-en-colonne', e.contentRect.width > 0));
    obs.observe(el);
    return () => { obs.disconnect(); html.classList.remove('panier-en-colonne'); };
  }, []);
  // Le bouton rebondit quand un plat y atterrit (gestes.js envolerVersPanier vise data-cible-panier), comme la pilule.
  useEffect(() => {
    const ecoute = () => setRebond((n) => n + 1);
    window.addEventListener('fairide:panier-atterri', ecoute);
    return () => window.removeEventListener('fairide:panier-atterri', ecoute);
  }, []);

  const ici = cart.restaurantId === restaurant.id;
  const lignes = ici ? Object.entries(cart.lines) : [];
  const nb = ici ? cart.count : 0;
  // Offre du panier comprise, comme la page Panier et la pastille (audit du 19/10, discovery-16).
  const sousTotal = ici ? cart.totals(restaurant.menu, restaurant.activeCartPromo).subtotal : 0;
  // Un panier pris chez un autre commerce n'est pas affiché comme s'il était d'ici : on le dit, avec le chemin pour le voir.
  const ailleurs = !ici && cart.count > 0;

  return (
    <aside className="fiche-panier-col" ref={racine} aria-label={t('panier.title')}>
      <h2 className="fiche-panier-titre">
        <span>{t('panier.title')}</span>
        {nb > 0 && <span className="fiche-panier-nb">{nb === 1 ? t('siteFiche.oneItem') : t('siteFiche.items', { n: nb })}</span>}
      </h2>
      {ailleurs && (
        <p className="small fiche-panier-ailleurs">
          {t('siteFiche.cartElsewhere', { name: cart.restaurantName })} <Link to="/panier">{t('panier.viewCart')}</Link>
        </p>
      )}
      {nb === 0 ? (
        <div className="fiche-panier-vide" data-cible-panier={ailleurs ? undefined : ''}>
          <EtatVide scene="panier" titre={t('panier.emptyTitle')} texte={t('siteFiche.emptyHint')} />
        </div>
      ) : (
        <>
          <ul className="fiche-panier-lignes">
            {lignes.map(([cle, l]) => {
              const options = (l.optionsSnapshot || []).map((o) => o.name).filter(Boolean).join(', ');
              return (
                <li key={cle} className="fiche-panier-ligne">
                  <span className="fiche-panier-ligne-texte">
                    <b>{l.name}</b>
                    {(options || l.note) && <small>{[options, l.note].filter(Boolean).join(' · ')}</small>}
                    {/* Plat en rupture, retiré ou dont une option n'existe plus : dit ici aussi, pas seulement au paiement
                        (audit du 19/10, discovery-17). */}
                    {ligneIndisponible(l, restaurant.menu)
                      ? <small className="ligne-indispo">{t('checkout.unavailableToday')}</small>
                      : <small className="fiche-panier-ligne-prix">{euros(l.unitPrice * l.qty)}</small>}
                  </span>
                  <span className="fiche-panier-pas" role="group" aria-label={l.name}>
                    <button type="button" onClick={() => { vibrer(6); cart.changeLineQty(cle, -1); }} aria-label={t('menuCategories.oneLess', { name: l.name })}>−</button>
                    <b key={l.qty}>{l.qty}</b>
                    <button type="button" onClick={() => { vibrer(6); cart.changeLineQty(cle, 1); }} disabled={l.qty >= 99} aria-label={t('siteFiche.oneMore', { name: l.name })}>+</button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="fiche-panier-st">
            <span>{t('siteFiche.subtotal')}</span>
            <b><ChiffresRoulants valeur={euros(sousTotal)} /></b>
          </p>
          <p className="small fiche-panier-note">{mode === 'pickup' ? t('siteFiche.notePickup') : t('siteFiche.noteDelivery')}</p>
          <Link to="/panier" className={`fiche-voir-panier${rebond ? ` fiche-voir-panier--rebond${rebond % 2}` : ''}`} data-cible-panier="">
            <span>{t('panier.viewCart')}</span>
            <span className="fiche-voir-panier-total"><ChiffresRoulants valeur={euros(sousTotal)} /></span>
          </Link>
        </>
      )}
    </aside>
  );
}
