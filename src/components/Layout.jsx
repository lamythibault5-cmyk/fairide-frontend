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
const DASHBOARD_PATHS = ['/restaurants', '/recherche', '/favorites', '/orders', '/map', '/panier', '/invoices', '/checkout', '/order-success', '/order-cancelled', '/account', '/sales', '/dashboard', '/driver', '/admin'];
// Sous-sections de « Mon compte » : les pages qu on atteint depuis ses rangées. On y propose le chemin
// du retour, parce qu y arriver par le compte puis repartir par la barre du bas oblige à retraverser
// toute la navigation pour revenir d où l on vient. /account n y figure pas : c est la destination.
const SOUS_SECTIONS_COMPTE = ['/invoices', '/sales',
  '/dashboard/reservations', '/dashboard/tables', '/dashboard/promotions', '/dashboard/invoices', '/dashboard/guide', '/dashboard/reviews',
  '/driver/reviews', '/driver/invoices', '/driver/earnings'];
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
/* LE PARCOURS DE COMMANDE : les onglets du bas s'y effacent.
 *
 * À partir du moment où l'on entre dans un commerce, on ne navigue plus, on fait quelque chose —
 * voir la carte, remplir son panier, payer. Les onglets flottants n'y servent qu'à proposer de
 * partir, et sur téléphone ils RECOUVRAIENT le total au moment de payer : ils flottent à z-index 50
 * (styles.css) tandis que .cart-bar est collante sans z-index. La page /panier réservait la place,
 * /checkout ne l'a jamais fait — d'où le montant caché signalé par le fondateur (capture du
 * 2026-09-17). Les effacer règle la cause, pas le symptôme.
 *
 * /restaurants (la LISTE) n'en fait pas partie : on y flâne, les onglets y sont utiles. Le parcours
 * commence sur la fiche d'un commerce — exactement le geste qui, chez Uber Eats, fait disparaître la
 * barre du bas (DESIGN.md, et les captures fournies par le fondateur).
 *
 * Voir EnteteFlux.jsx, qui porte la seule sortie de ces pages. */
const FLUX_COMMANDE = ['/panier', '/checkout', '/order-success', '/order-cancelled'];
// Fiche resto (/restaurants/:id) consultable sans compte (voir App.jsx) — un visiteur non connecté y
// arrive donc sur la nav publique plutôt que la coquille sidebar. On y allège quand même ce header
// (pas de gros bloc "Connexion/Inscription" au-dessus d'une carte de menu) : l'ajout au panier redirige
// déjà vers /login au bon moment (voir RestaurantMenu.jsx), le module d'auth du header y est redondant.
const RESTAURANT_DETAIL_PATH = /^\/restaurants\/[^/]+$/;
function estFluxCommande(pathname) {
  return RESTAURANT_DETAIL_PATH.test(pathname) || FLUX_COMMANDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
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
  // La pilule du panier ne s'affiche pas sur les pages QUI SONT le panier : sur /panier elle
  // doublerait le contenu de la page, sur /checkout elle proposerait de revenir en arriere au
  // moment de payer. Ailleurs, elle est le seul acces au panier.
  const pageDuPanier = location.pathname === '/panier' || location.pathname.startsWith('/checkout');
  const seesClientCart = !user?.isAdmin && !pageDuPanier && (role === 'client' || (previewMode && role === 'restaurant'));
  const leanHeader = !user && RESTAURANT_DETAIL_PATH.test(location.pathname);
  // Le fond de cuisine ne vit que sur l accueil PUBLIC : c est la seule page dont le rôle est de
  // donner envie. Ailleurs on vient faire quelque chose, et un fond animé gênerait.
  // Fond de cuisine : l'accueil, et les pages où l'on flâne — l'aide et la liste des commerces, avec ou
  // sans compte. Sur ces dernières, les cartes restent opaques (« doux ») : une centaine de cartes
  // floutées coûterait cher sur téléphone pour un fond qu'on ne verrait que dans les marges.
  //
  // /login N'EN FAIT PLUS PARTIE (demande du fondateur, 2026-09-21). Elle l'avait au titre de « porte
  // d'entrée du même visiteur », mais ce n'est pas une vitrine : on y vient remplir un formulaire, et
  // le fond s'y révélait au défilement — c'est-à-dire exactement au moment où l'on descend vers les
  // champs. La vidéo se chargeait en prime pour une page qui ne la montre jamais en grand.
  // `!user` prime toujours : quelqu'un de connecté n'a de fond nulle part.
  const fondVitrine = !user && location.pathname === '/';
  const fondDoux = location.pathname === '/aide' || location.pathname === '/restaurants' || RESTAURANT_DETAIL_PATH.test(location.pathname);
  const fondCuisine = fondVitrine || fondDoux;

  // Parcours de commande : la coquille reçoit une classe, et c'est la CSS qui efface les onglets —
  // sous 900px seulement, là où ils flottent par-dessus le contenu. Sur ordinateur la barre latérale
  // est une colonne de 240px qui ne recouvre rien, et la grille .dashboard-shell compte dessus : la
  // démonter là-bas casserait la mise en page pour rien. On ne retire donc PAS <DashboardSidebar />
  // du rendu — cela coûterait en prime un remontage complet à chaque entrée dans le parcours.
  const dansLeFlux = estFluxCommande(location.pathname);
  if (user && isDashboardPath(location.pathname)) {
    return (
      <>
        <div className={`dashboard-shell${rightSlot ? ' has-right' : ''}${dansLeFlux ? ' dashboard-shell--flux' : ''}`}>
          <DashboardSidebar />
          <main className="dashboard-main">
            {/* Il y avait ici une pastille « fairide » fixée en haut à droite, flottant au-dessus du
                contenu sur mobile et tablette. Elle est partie : elle ne servait qu'à rappeler le nom
                du site à quelqu'un qui y est déjà connecté, et elle le payait cher — elle mangeait la
                fin des titres de page (visible en néerlandais sur écran étroit), recouvrait la barre
                des sections d'une carte, et se posait sur l'avatar de Mon compte. Trois réserves
                d'espace ont été écrites pour la contourner ; les trois partent avec elle.
                Au-dessus de 900px la barre latérale porte déjà la marque, et c'est assez. */}
            {estSousSectionCompte(location.pathname) && (
              <Link to="/account" state={{ restaurerDefilement: true }} className="dashboard-retour">{t('nav.backToAccount')}</Link>
            )}
            <div className="page-fade" key={`${cleTransition(location.pathname)}-${remontage}`} ref={zone}>
              <Suspense fallback={attentePage}>
                <Outlet context={{ setRightSlot }} />
              </Suspense>
            </div>
          </main>
          {rightSlot && <aside className="dashboard-right">{rightSlot}</aside>}
          {/* Les liens légaux sont sortis de la colonne principale. Sous 900px, les trois zones
              s'empilent dans l'ordre « main » puis « right » : le pied de page, qui vivait à la fin
              de main, se retrouvait AU-DESSUS de la colonne de droite. Sur le tableau de bord d'un
              livreur, on lisait donc « Mentions légales · CGV · Confidentialité » puis, en dessous,
              la carte « Aujourd'hui » avec ses compteurs — du contenu après le pied de page.
              Il est maintenant une zone de la grille à lui, toujours la dernière. */}
          <div className="dashboard-footer-links">
            <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
            <Link to="/cgv">{t('footer.terms')}</Link>
            <Link to="/confidentialite">{t('footer.privacy')}</Link>
            <Link to="/cookies">{t('footer.cookies')}</Link>
          </div>
        </div>
        <CookieBanner />
        {seesClientCart && <FloatingCart />}
      </>
    );
  }

  return (
    <>
      {/* Accueil : les visuels transparaissent dès l'arrivée, sous un en-tête iris plein qui fait cadre (fondateur,
          2026-09-15 : un premier écran tout iris était « trop uniforme »). Ailleurs, révélés au défilement.
          Essai inverse le 2026-09-18 — aplat plein au repos, ouvert au défilement — abandonné : c'est bien
          la transparence dès l'arrivée qui est voulue ici. */}
      {/* `fondVitrine` NE VAUT PLUS QUE l'accueil depuis que /login n'a plus de fond : les deux
          conditions redondantes qui traînaient ici (`fondVitrine && pathname === '/'`, deux fois)
          disaient la même chose que `fondVitrine` seul, et s'écrivaient encore comme s'il pouvait
          désigner une autre adresse. */}
      {fondCuisine && <CuisineBackdrop key={fondVitrine ? 'accueil' : 'autre'} desLeDebut={fondVitrine} />}
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
              {/* Sans tuile : le bol lime flotte sur l'iris, net à toute densité (SVG). 44px, ce
                  n'est pas un chiffre rond mais le verrou de la spec : la marque fait 1,3 fois la
                  hauteur d'ascendante du mot, soit 44px pour un « fairide » à 34px, et l'écart de
                  14px (gap de .brand) vaut les 0,35 × corps demandés. L'ancien vélo montait à 78px
                  parce qu'il était en paysage et ne pesait que 40px de haut ; le bol est carré, la
                  même valeur en ferait une vignette deux fois plus grande que le mot. */}
              <BrandMark size={leanHeader ? 34 : 44} tile={false} color="#C8F03C" />
              {!leanHeader && (
                <div className="brand-text">
                  {/* <span> et non <h1> : la marque est présente sur toutes les pages, elle y
                      confisquait donc le titre de niveau 1. Le h1 appartient au contenu de la
                      page. Rendu inchangé, voir .brand-name dans styles.css. */}
                  <span className="brand-name wordmark">fairide</span>
                  <span className="brand-slogan">{t('common.slogan')}</span>
                </div>
              )}
            </Link>
            {/* La navigation vit DANS la rangée (au centre, entre la marque et les actions) : un seul bandeau,
                pas de seconde ligne. Sous 760px elle repasse sous la marque (voir .header-nav dans styles.css). */}
            {/* Sans cette nav, aucun lien crawlable ne mène de l'accueil vers /restaurants :
                l'autre <nav> ne s'affiche que pour un visiteur connecté, et un robot ne l'est
                jamais. Les fiches de commerce sont publiques et indexables par intention, mais
                restaient introuvables en pratique. C'est aussi le chemin qu'un visiteur veut :
                regarder avant de créer un compte. */}
            {!user && !leanHeader && (
              <nav className="role-nav header-nav">
                <NavLink to="/restaurants" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.restaurants')}</NavLink>
                <NavLink to="/aide" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.help')}</NavLink>
              </nav>
            )}
            {user && (
              <nav className="role-nav header-nav">
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
        </div>
      </div>
      <div className={`wrap${fondVitrine ? ' wrap-fond' : ''}${fondDoux ? ' wrap-fond-doux' : ''}`} style={{ paddingTop: 24 }}>
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
