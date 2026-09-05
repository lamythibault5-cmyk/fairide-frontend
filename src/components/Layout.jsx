import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import CuisineBackdrop from './CuisineBackdrop';
import AssistantWidget from './AssistantWidget';
import LanguageSwitcher from './LanguageSwitcher';
import DashboardSidebar from './DashboardSidebar';
import FloatingCart from './FloatingCart';

// Pages "connectées" qui utilisent la coquille sidebar (client/livreur/restaurateur/admin) au lieu de
// la nav du haut classique.
const DASHBOARD_PATHS = ['/restaurants', '/recherche', '/favorites', '/orders', '/map', '/invoices', '/checkout', '/order-success', '/order-cancelled', '/account', '/dashboard', '/driver', '/admin'];
// Sous-sections de « Mon compte » : les pages qu on atteint depuis ses rangées. On y propose le chemin
// du retour, parce qu y arriver par le compte puis repartir par la barre du bas oblige à retraverser
// toute la navigation pour revenir d où l on vient. /account n y figure pas : c est la destination.
const SOUS_SECTIONS_COMPTE = ['/invoices',
  '/dashboard/reservations', '/dashboard/tables', '/dashboard/promotions', '/dashboard/invoices', '/dashboard/guide', '/dashboard/reviews',
  '/driver/reviews', '/driver/invoices'];
function estSousSectionCompte(pathname) {
  return SOUS_SECTIONS_COMPTE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
function isDashboardPath(pathname) {
  return DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
// Fiche resto (/restaurants/:id) consultable sans compte (voir App.jsx) — un visiteur non connecté y
// arrive donc sur la nav publique plutôt que la coquille sidebar. On y allège quand même ce header
// (pas de gros bloc "Connexion/Inscription" au-dessus d'une carte de menu) : l'ajout au panier redirige
// déjà vers /login au bon moment (voir RestaurantMenu.jsx), le module d'auth du header y est redondant.
const RESTAURANT_DETAIL_PATH = /^\/restaurants\/[^/]+$/;
export default function Layout() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const { previewMode } = usePreviewMode();
  const [rightSlot, setRightSlot] = useState(null);
  // Le restaurateur en mode aperçu voit le panier flottant comme un vrai client (voir RestaurantMenu.jsx
  // "addToCart" réel, pas le panier isolé de RestaurantPreview) — pousser jusqu'au paiement échoue
  // volontairement côté serveur (requireRole('client')), ce qui bloque naturellement au bon endroit.
  const seesClientCart = !user?.isAdmin && (role === 'client' || (previewMode && role === 'restaurant'));
  const leanHeader = !user && RESTAURANT_DETAIL_PATH.test(location.pathname);
  // Le fond de cuisine ne vit que sur l accueil PUBLIC : c est la seule page dont le rôle est de
  // donner envie. Ailleurs on vient faire quelque chose, et un fond animé gênerait.
  const fondCuisine = !user && location.pathname === '/';

  // Sous 900px la barre latérale devient la barre du BAS, et sa règle CSS y masque son propre logo :
  // un utilisateur connecté n abordait donc plus aucune marque à l écran. On la remonte en haut à
  // droite du contenu, à cette largeur seulement — au-dessus, la barre latérale la porte déjà.
  const accueilConnecte = user?.isAdmin ? '/admin'
    : role === 'restaurant' ? '/dashboard'
    : role === 'driver' ? '/driver'
    : '/restaurants';
  if (user && isDashboardPath(location.pathname)) {
    return (
      <>
        <div className={`dashboard-shell${rightSlot ? ' has-right' : ''}`}>
          <DashboardSidebar />
          <main className="dashboard-main">
            {/* La marque, incrustée en haut à droite de l écran sur mobile et tablette : une pastille
                fixe qui flotte au-dessus du contenu, pas une barre qui prendrait une ligne entière
                (au-dessus de 900px la barre latérale la porte déjà, voir styles.css). Le retour vers
                Mon compte, lui, est du contenu : un simple lien en tête de page, seulement dans les
                sous-sections du compte. */}
            <Link className="dashboard-marque" to={accueilConnecte} aria-label="Fairide — accueil">
              <BrandMark size={22} />
              <span>fairide</span>
            </Link>
            {estSousSectionCompte(location.pathname) && (
              <Link to="/account" state={{ restaurerDefilement: true }} className="dashboard-retour">← Mon compte</Link>
            )}
            <div className="page-fade" key={location.pathname}>
              <Outlet context={{ setRightSlot }} />
            </div>
            <div className="dashboard-footer-links">
              <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
              <Link to="/cgv">{t('footer.terms')}</Link>
              <Link to="/confidentialite">{t('footer.privacy')}</Link>
            </div>
          </main>
          {rightSlot && <aside className="dashboard-right">{rightSlot}</aside>}
        </div>
        <CookieBanner />
        {seesClientCart && <FloatingCart />}
        <AssistantWidget />
      </>
    );
  }

  return (
    <>
      {fondCuisine && <CuisineBackdrop />}
      <div className={`hero${leanHeader ? ' hero-lean' : ''}`}>
        <div className="hero-inner">
          {/* Le sélecteur de langue est le DERNIER élément de la rangée, et non plus celui du
              milieu. La rangée contient trois blocs dont deux changent de largeur avec la langue
              (le slogan sous la marque, et le couple Connexion/Inscription) : en `space-between`,
              le sélecteur au milieu se faisait pousser à chaque changement de langue et
              s'échappait de sous le curseur au moment même où on cliquait dessus. Placé en
              dernier, son bord droit est collé au bord de la rangée : sa position ne dépend plus
              de la largeur de quoi que ce soit. Voir .header-row dans styles.css. */}
          <div className="row header-row">
            <Link className="brand" to="/">
              <BrandMark size={leanHeader ? 34 : 48} />
              {!leanHeader && (
                <div className="brand-text">
                  <h1>fairide</h1>
                  <span className="brand-slogan">{t('common.slogan')}</span>
                </div>
              )}
            </Link>
            {!leanHeader && user && (
              <div className="userbar" style={{ padding: 0 }}>
                <Link to="/account" style={{ color: 'var(--cream)', textDecoration: 'none', marginRight: 10, fontWeight: 600 }}>
                  {user.name}
                </Link>
                <button className="btn-ghost" style={{ color: 'var(--cream)' }} onClick={logout}>
                  {t('nav.logout')}
                </button>
              </div>
            )}
            {/* header-auth reste un bloc atomique : « Connexion » et « Inscription » ne se séparent
                jamais l'un de l'autre. La rangée entière est en nowrap et c'est la marque qui rétrécit
                quand la place manque — voir .header-row dans styles.css. */}
            {!leanHeader && !user && (
              <div className="row header-auth">
                <Link to="/login" className="header-auth-link">{t('nav.login')}</Link>
                <Link to="/login?audience=client" className="btn-gold header-register-btn">{t('nav.register')}</Link>
              </div>
            )}
            <LanguageSwitcher />
          </div>
          {user && (
            <nav className="role-nav">
              {/* Le compte admin ne voit jamais la nav client/restaurateur/livreur, seulement l'ERP —
                  voir la même règle dans DashboardSidebar.jsx (isAdminAccount). */}
              {!user.isAdmin && role === 'client' && (
                <>
                  <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.restaurants')}</NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.favorites')}</NavLink>
                  <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.orders')}</NavLink>
                </>
              )}
              {!user.isAdmin && role === 'restaurant' && (
                <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.myBusiness')}</NavLink>
              )}
              {!user.isAdmin && role === 'driver' && (
                <NavLink to="/driver" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.deliveries')}</NavLink>
              )}
              {!user.isAdmin && <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.account')}</NavLink>}
              {user.isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.admin')}</NavLink>}
            </nav>
          )}
        </div>
      </div>
      <div className={`wrap${fondCuisine ? ' wrap-fond' : ''}`} style={{ paddingTop: 24 }}>
        <div className="page-fade" key={location.pathname}>
          <Outlet />
        </div>
        <Footer />
      </div>
      <CookieBanner />
      {seesClientCart && <FloatingCart />}
      <AssistantWidget />
      {/* Pas de filigrane ici : cette branche affiche déjà la bannière .hero, avec le vélo ET le
          mot « fairide » à vingt pixels de l'endroit où le filigrane se serait posé. Il n'y
          apportait rien, et sa présence obligeait .hero-inner à réserver 88 à 108px de largeur
          pour ne pas passer dessous — c'est précisément cette réserve qui faisait déborder la
          rangée en français et en néerlandais, où les libellés sont plus longs qu'en anglais.
          Il reste monté sur la branche tableau de bord, la seule où il sert vraiment : la
          barre latérale y masque son propre logo sous 900px. */}
    </>
  );
}
