import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEnteteDefilement } from '../hooks/useEnteteDefilement';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import { useToast } from '../context/ToastContext';
import useInbox from '../hooks/useInbox';
import BrandMark from './BrandMark';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import CuisineBackdrop from './CuisineBackdrop';
import LanguageSwitcher from './LanguageSwitcher';
import DashboardSidebar from './DashboardSidebar';
import FloatingCart from './FloatingCart';
import { SkeletonCards } from './Skeleton';

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
// Clé du conteneur animé autour du contenu. Elle changeait à CHAQUE adresse : dans l'espace
// restaurateur ou admin, passer d'un onglet à l'autre recréait donc toute la coquille (DashboardLayout,
// AdminLayout) — rechargement des données, squelettes, fondu sur toute la zone : le « mini-bug » au
// changement de page. À l'intérieur d'une coquille la clé est maintenant celle de la coquille ; c'est
// elle qui anime ses propres pages (voir DashboardLayout.jsx / AdminLayout.jsx).
const COQUILLES = ['/dashboard', '/admin'];
function cleTransition(pathname) {
  return COQUILLES.find((p) => pathname === p || pathname.startsWith(`${p}/`)) || pathname;
}
const attentePage = <div style={{ paddingTop: 8 }}><SkeletonCards count={3} /></div>;
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
  // En-tête escamotable : il s'efface quand on descend, revient quand on remonte.
  const enteteCache = useEnteteDefilement();
  const { t } = useLanguage();
  const location = useLocation();
  const toast = useToast();
  // Messages de Fairide : pastille sur « Mon compte », toast quand un nouveau message arrive pendant
  // que l'app est ouverte (une fois par hausse du compteur, jamais au premier chargement), et préfixe
  // « (n) » dans le titre de l'onglet tant qu'il reste du non lu.
  const { unread: nonLus, loadedAt: nonLusChargesA } = useInbox();
  const nonLusPrecedents = useRef(null);
  useEffect(() => {
    if (!nonLusChargesA) return;
    if (nonLusPrecedents.current !== null && nonLus > nonLusPrecedents.current) toast(t('inbox.newMessageToast'));
    nonLusPrecedents.current = nonLus;
  }, [nonLus, nonLusChargesA]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Les pages posent leur propre titre (usePageMeta), parfois après ce rendu (chargement différé) :
    // on observe <title> et on remet le préfixe à chaque changement, sans boucler (on ne réécrit que
    // si le préfixe attendu manque).
    const el = document.querySelector('title');
    const appliquer = () => {
      const brut = document.title.replace(/^\(\d+\) /, '');
      const voulu = nonLus > 0 ? `(${nonLus}) ${brut}` : brut;
      if (document.title !== voulu) document.title = voulu;
    };
    appliquer();
    if (!el || typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(appliquer);
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    return () => { obs.disconnect(); document.title = document.title.replace(/^\(\d+\) /, ''); };
  }, [nonLus]);
  // Filet contre la « page vide » : quelle qu'en soit la cause (module manquant, réponse jamais arrivée,
  // rendu avorté), si la zone de contenu n'affiche ni texte ni squelette 2,5 s après un changement de page,
  // elle est remontée (mêmes effets qu'une actualisation, sans en avoir l'air) ; si elle reste vide,
  // rechargement complet, au plus une fois toutes les deux minutes pour ne jamais boucler.
  const [remontage, setRemontage] = useState(0);
  const zone = useRef(null);
  // Changer de section (tableau de bord, compte, pages publiques) ramène toujours en haut de la page : sans
  // cela, on arrivait au milieu de la nouvelle section avec le défilement de la précédente. Les ancres (#…)
  // gardent leur cible.
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  useEffect(() => {
    let remonte = false;
    const vide = () => {
      const el = zone.current; if (!el || document.visibilityState !== 'visible') return false;
      if (el.querySelector('.skeleton, canvas, iframe, img, video, input, table')) return false;
      return (el.innerText || '').trim().length === 0 && el.getBoundingClientRect().height < 40;
    };
    const t1 = setTimeout(() => { if (vide()) { remonte = true; setRemontage((n) => n + 1); } }, 2500);
    const t2 = setTimeout(() => {
      if (!remonte || !vide()) return;
      let dernier = 0; try { dernier = Number(sessionStorage.getItem('fairide_reload_vide') || 0); } catch { /* sans stockage */ }
      if (Date.now() - dernier < 120000) return;
      try { sessionStorage.setItem('fairide_reload_vide', String(Date.now())); } catch { /* sans stockage */ }
      window.location.reload();
    }, 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.pathname]);
  const { previewMode } = usePreviewMode();
  const [rightSlot, setRightSlot] = useState(null);
  // Le restaurateur en mode aperçu voit le panier flottant comme un vrai client (voir RestaurantMenu.jsx
  // "addToCart" réel, pas le panier isolé de RestaurantPreview) — pousser jusqu'au paiement échoue
  // volontairement côté serveur (requireRole('client')), ce qui bloque naturellement au bon endroit.
  const seesClientCart = !user?.isAdmin && (role === 'client' || (previewMode && role === 'restaurant'));
  const leanHeader = !user && RESTAURANT_DETAIL_PATH.test(location.pathname);
  // Le fond de cuisine ne vit que sur l accueil PUBLIC : c est la seule page dont le rôle est de
  // donner envie. Ailleurs on vient faire quelque chose, et un fond animé gênerait.
  // …et sur la page de connexion / inscription, qui est la porte d entrée du même visiteur. Jamais
  // pour quelqu un de connecté : `!user` prime, quelle que soit l adresse.
  const fondCuisine = !user && (location.pathname === '/' || location.pathname === '/login');

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
            <Link className="dashboard-marque" to={accueilConnecte} aria-label={t('nav.homeAria')}>
              <BrandMark size={22} />
              <span>fairide</span>
            </Link>
            {estSousSectionCompte(location.pathname) && (
              <Link to="/account" state={{ restaurerDefilement: true }} className="dashboard-retour">{t('nav.backToAccount')}</Link>
            )}
            <div className="page-fade" key={`${cleTransition(location.pathname)}-${remontage}`} ref={zone}>
              <Suspense fallback={attentePage}>
                <Outlet context={{ setRightSlot }} />
              </Suspense>
            </div>
            <div className="dashboard-footer-links">
              <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
              <Link to="/cgv">{t('footer.terms')}</Link>
              <Link to="/confidentialite">{t('footer.privacy')}</Link>
              <Link to="/cookies">{t('footer.cookies')}</Link>
            </div>
          </main>
          {rightSlot && <aside className="dashboard-right">{rightSlot}</aside>}
        </div>
        <CookieBanner />
        {seesClientCart && <FloatingCart />}
      </>
    );
  }

  return (
    <>
      {fondCuisine && <CuisineBackdrop />}
      {/* L'en-tête s'efface quand on descend et revient quand on remonte : voir useEnteteDefilement. */}
      <div className={`hero${leanHeader ? ' hero-lean' : ''}${enteteCache ? ' hero-cache' : ''}`}>
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
                  {/* <span> et non <h1> : la marque est présente sur toutes les pages, elle y
                      confisquait donc le titre de niveau 1. Le h1 appartient au contenu de la
                      page. Rendu inchangé, voir .brand-name dans styles.css. */}
                  <span className="brand-name">fairide</span>
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
          {/* Sans cette nav, aucun lien crawlable ne mène de l'accueil vers /restaurants :
              l'autre <nav> ne s'affiche que pour un visiteur connecté, et un robot ne l'est
              jamais. Les fiches de commerce sont publiques et indexables par intention, mais
              restaient introuvables en pratique. C'est aussi le chemin qu'un visiteur veut :
              regarder avant de créer un compte. */}
          {!user && !leanHeader && (
            <nav className="role-nav">
              <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.restaurants')}</NavLink>
              <NavLink to="/aide" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.help')}</NavLink>
            </nav>
          )}
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
              {!user.isAdmin && (
                <NavLink to="/account" className={({ isActive }) => (isActive ? 'active' : '')}>
                  {t('nav.account')}
                  {nonLus > 0 && <span className="nav-badge tone-warn" aria-label={t('inbox.rowSubUnread', { n: nonLus })}>{nonLus}</span>}
                </NavLink>
              )}
              {user.isAdmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.admin')}</NavLink>}
            </nav>
          )}
        </div>
      </div>
      <div className={`wrap${fondCuisine ? ' wrap-fond' : ''}`} style={{ paddingTop: 24 }}>
        {/* <main> manquait sur toute la branche publique, celle qui sert les pages
            indexables. La branche tableau de bord en a une depuis toujours. */}
        <main className="page-fade" key={`${cleTransition(location.pathname)}-${remontage}`} ref={zone}>
          <Suspense fallback={attentePage}>
            <Outlet />
          </Suspense>
        </main>
        <Footer />
      </div>
      <CookieBanner />
      {seesClientCart && <FloatingCart />}
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
