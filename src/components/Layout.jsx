import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEnteteDefilement } from '../hooks/useEnteteDefilement';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import { useToast } from '../context/ToastContext';
import useInbox from '../hooks/useInbox';
import BrandMark from './BrandMark';
import MotMarque from './MotMarque';
import Footer from './Footer';
import CookieBanner from './CookieBanner';
import Icone from './Icone';
import LanguageSwitcher from './LanguageSwitcher';
import DashboardSidebar from './DashboardSidebar';
import FloatingCart from './FloatingCart';
import SuiviCommande from './client/SuiviCommande';
import { SkeletonCards, SqueletteEcran } from './Skeleton';
import { experienceApp } from '../natif';
import { lireBienvenue } from '../bienvenue';
import useBarreSurIris from '../hooks/useBarreSurIris';
// Le cadre du site (barre latérale blanche, largeurs, bandeau et feuille, carte des cookies, connexion) : voir son en-tête.
import '../site-cadre.css';

// « Activer les notifications » juste après l'inscription, dans l'application seulement (voir AmorceNotifications.jsx).
// Chargé à la demande : sur fairride.be la condition est toujours fausse, et le module n'est jamais téléchargé.
const AmorceNotifications = lazy(() => import('./AmorceNotifications'));
// PAS DE RETOUR PAR GLISSEMENT (fondateur, 2026-10-23) : le glissement vers la droite pour reculer (bord gauche, puis de
// n'importe où) a été retiré — sur la liste, la page partait de côté sur un fond vide « à l'infini ». On recule par les
// boutons retour / fermer ; Android garde le geste du système.
/* L'APPLICATION N'A PAS LE CADRE DU SITE (2026-10-15). Dans l'app (experienceApp : la coque native ou le site ajouté à
 * l'écran d'accueil), aucune page ne montre l'en-tête du site (Restaurants · Aide · Contact · Connexion · Inscription),
 * son pied de page, la rangée des liens légaux ni la carte des cookies : c'était le site qui reprenait la main au milieu
 * de l'app. Connecté, toutes les pages — aide, pages légales, « C'est bon » compris — restent dans la coquille à
 * onglets, avec un « Retour » ; les liens légaux vivent au bas de Mon compte. Déconnecté, une barre d'app (la marque ou
 * Retour, et « Se connecter »). Pas de carte cookies ni d'écran de consentement : l'app ne demande que l'envoi des
 * rapports de panne, par une case à l'inscription, sur l'écran d'une panne et dans Mon compte (2026-10-16). */
const APPLI = experienceApp();
// Pages qui portent déjà leur « ← Mon compte » (RetourCompte.jsx) : pas de second Retour au-dessus.
const AVEC_RETOUR_COMPTE = ['/aide', '/notre-histoire'];

// Pages "connectées" qui utilisent la coquille sidebar (client/livreur/restaurateur/admin) au lieu de
// la nav du haut classique.
const DASHBOARD_PATHS = ['/restaurants', '/recherche', '/favorites', '/orders', '/map', '/panier', '/groupe', '/invoices', '/checkout', '/order-success', '/order-cancelled', '/account', '/sales', '/documents', '/dashboard', '/driver', '/admin'];
// Sous-sections de « Mon compte » : les pages qu on atteint depuis ses rangées. On y propose le chemin
// du retour, parce qu y arriver par le compte puis repartir par la barre du bas oblige à retraverser
// toute la navigation pour revenir d où l on vient. /account n y figure pas : c est la destination.
const SOUS_SECTIONS_COMPTE = ['/invoices', '/sales', '/documents',
  '/dashboard/promotions', '/dashboard/invoices', '/dashboard/guide', '/dashboard/stats',
  '/driver/invoices', '/driver/onboarding'];
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
// Le module d'une page arrive : dans l'app, le bandeau iris et la feuille sont déjà là, titre en barres translucides et vélo
// qui roule (Skeleton.jsx, audit « Look and feel », 2026-10-19) ; sur le site, des lignes iris pâle.
function AttentePage() {
  return experienceApp() ? <SqueletteEcran /> : <div style={{ paddingTop: 8 }}><SkeletonCards count={3} /></div>;
}
const attentePage = <AttentePage />;
function isDashboardPath(pathname) {
  return DASHBOARD_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
/* CONNECTÉ, TOUT LE SITE EST DANS LA COQUILLE (fondateur, 2026-10-16, maquettes/site-ordinateur/site-ordinateur.html : le « cadre » de chaque
 * page connectée est la barre latérale). L'aide, les pages légales, notre histoire, « C'est bon » et la page introuvable
 * s'ouvraient sous l'en-tête iris du site, avec une seconde navigation (Restaurants · Favoris · Mes commandes) qui ne
 * ressemblait à rien d'autre une fois connecté — l'app, elle, les garde déjà dans sa coquille. Seules la connexion et le
 * nouveau mot de passe restent des pages de visiteur : on y vient sans session, ou pour en changer. */
const HORS_COQUILLE = ['/login', '/reset-password'];
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
 * barre du bas (docs/archives/DESIGN-uber.md, et les captures fournies par le fondateur).
 *
 * Voir EnteteFlux.jsx, qui porte la seule sortie de ces pages. */
// La commande groupée (/groupe/:code) en fait partie : elle a sa barre du bas et son retour à la carte, comme le panier.
const FLUX_COMMANDE = ['/panier', '/checkout', '/order-success', '/order-cancelled', '/groupe'];
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
  const navigate = useNavigate();
  const toast = useToast();
  // Retour d'une page de l'app : la page précédente s'il y en a une dans cette session, sinon l'accueil.
  const retourAppli = () => (location.key !== 'default' ? navigate(-1) : navigate('/'));
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
  // La barre d'app sans compte devient iris au-dessus d'un bandeau iris (useBarreSurIris.js, fondateur 2026-10-19).
  const barreAppli = useRef(null);
  useBarreSurIris(barreAppli, APPLI);
  // Le retour en haut à chaque changement de page est fait par ScrollRestorer (une seule règle, répétée le temps que
  // la page se charge) : il y en avait deux ici, qui se marchaient dessus au retour arrière.
  useEffect(() => {
    let remonte = false;
    const vide = () => {
      const el = zone.current; if (!el || document.visibilityState !== 'visible') return false;
      // Un écran plein de l'app (dossier livreur, envoi de carte : EcranPlein, rendu dans <body>) laisse la zone vide exprès.
      if (document.querySelector('.bv')) return false;
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
  // La commande groupée non plus : elle porte déjà « Envoyer mon panier au groupe » dans sa barre du bas.
  const pageDuPanier = location.pathname === '/panier' || location.pathname.startsWith('/checkout') || location.pathname.startsWith('/groupe/');
  // Dans l'application, un compte admin est traité selon son rôle (pas de console dans l'app, voir AdminSurLeSite).
  const seesClientCart = !(user?.isAdmin && !APPLI) && !pageDuPanier && (role === 'client' || (previewMode && role === 'restaurant'));
  const leanHeader = !user && RESTAURANT_DETAIL_PATH.test(location.pathname);
  // Le fond de cuisine ne vit que sur l accueil PUBLIC : c est la seule page dont le rôle est de
  // donner envie. Ailleurs on vient faire quelque chose, et un fond animé gênerait.
  // /login N'EN FAIT PLUS PARTIE (demande du fondateur, 2026-09-21). Elle l'avait au titre de « porte
  // d'entrée du même visiteur », mais ce n'est pas une vitrine : on y vient remplir un formulaire, et
  // le fond s'y révélait au défilement — c'est-à-dire exactement au moment où l'on descend vers les
  // champs. La vidéo se chargeait en prime pour une page qui ne la montre jamais en grand.
  // `!user` prime toujours : quelqu'un de connecté n'a de fond nulle part.
  //
  // L'ACCUEIL SEULEMENT, DEPUIS LE 2026-09-27 (demande du fondateur). L'aide, la liste des commerces et
  // la fiche d'un commerce avaient aussi la vidéo (variante « douce », cartes opaques) et son fondu au
  // défilement. Retirés : ce sont des pages où l'on vient faire quelque chose, et la vidéo n'y est pas
  // l'argument. Le raisonnement du paragraphe sur /login ci-dessus vaut désormais pour elles aussi.
  // L'accueil public (Landing.jsx) : depuis la version B du 2026-10-16, un bandeau iris plein et une feuille blanche, sans la
  // vidéo de cuisine qui passait derrière (CuisineBackdrop, retiré). Il prend toute la largeur utile (site-accueil.css).
  const fondVitrine = !user && location.pathname === '/';

  // Parcours de commande : la coquille reçoit une classe, et c'est la CSS qui efface les onglets —
  // sous 900px seulement, là où ils flottent par-dessus le contenu. Sur ordinateur la barre latérale
  // est une colonne de 240px qui ne recouvre rien, et la grille .dashboard-shell compte dessus : la
  // démonter là-bas casserait la mise en page pour rien. On ne retire donc PAS <DashboardSidebar />
  // du rendu — cela coûterait en prime un remontage complet à chaque entrée dans le parcours.
  const dansLeFlux = estFluxCommande(location.pathname);
  if (user && (isDashboardPath(location.pathname) || APPLI || !HORS_COQUILLE.includes(location.pathname))) {
    // Site : une page qui n'est à aucun espace (aide, pages légales…) se lit centrée sur la largeur de lecture
    // (.site-page-generique, site-cadre.css). Rien ne change dans l'app.
    const pageGenerique = !APPLI && !isDashboardPath(location.pathname);
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
            {/* App : une page hors des espaces (aide, pages légales, « C'est bon ») n'a pas d'onglet à elle — d'où un Retour. */}
            {APPLI && !isDashboardPath(location.pathname) && !AVEC_RETOUR_COMPTE.includes(location.pathname) && (
              <button type="button" className="dashboard-retour" data-retour-natif onClick={retourAppli}>← {t('appli.retour')}</button>
            )}
            <div className={`page-fade${pageGenerique ? ' site-page-generique' : ''}`} key={`${cleTransition(location.pathname)}-${remontage}`} ref={zone}>
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
              Il est maintenant une zone de la grille à lui, toujours la dernière.
              Sur le site au-dessus de 900px, ces liens vivent au bas de la barre latérale (DashboardSidebar.jsx) et la rangée
              est masquée (site-cadre.css) : elle ne sert plus qu'au téléphone. */}
          {!APPLI && <div className="dashboard-footer-links">
            <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
            <Link to="/cgv">{t('footer.terms')}</Link>
            <Link to="/confidentialite">{t('footer.privacy')}</Link>
            <Link to="/cookies">{t('footer.cookies')}</Link>
          </div>}
        </div>
        {!APPLI && <CookieBanner />}
        {seesClientCart && <SuiviCommande />}
        {seesClientCart && <FloatingCart />}
        {experienceApp() && lireBienvenue().amorceNotifs === 'a-faire' && <Suspense fallback={null}><AmorceNotifications /></Suspense>}
      </>
    );
  }

  // Application, sans compte : la barre d'app, le contenu, rien du site autour.
  // La connexion de l'app (ConnexionAppli) est un écran plein, comme l'accueil : rendue seule. Dans .wrap, l'animation de
  // la page en faisait le repère de son `position: fixed`, et la barre d'app passait par-dessus son en-tête.
  if (APPLI && location.pathname === '/login') {
    return <Suspense fallback={null}><Outlet /></Suspense>;
  }
  if (APPLI) {
    const accueilListe = location.pathname === '/restaurants' || location.key === 'default';
    return (
      <>
        <div className="appli-barre" ref={barreAppli}>
          {accueilListe ? (
            // La marque n'est pas un lien (fondateur, 2026-10-16) : « / » ramenait sur cette même liste.
            <span className="appli-marque"><BrandMark size={30} /><MotMarque /></span>
          ) : (
            <button type="button" className="bv-rond" data-retour-natif onClick={retourAppli} aria-label={t('appli.retour')}><Icone nom="retour" taille={18} /></button>
          )}
          <Link to="/login" className="appli-connexion">{t('nav.login')}</Link>
        </div>
        <div className="wrap appli-wrap">
          <main className="page-fade" key={`${cleTransition(location.pathname)}-${remontage}`} ref={zone}>
            <Suspense fallback={attentePage}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
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
            {/* aria-label : sur la fiche d'un commerce (en-tête allégé), le lien ne porte que le vélo, sans le mot — il lui
                fallait un nom pour les lecteurs d'écran (vérification automatique du 2026-10-17). */}
            <Link className="brand" to="/" aria-label="Fairride">
              {/* Sans tuile : le vélo lime flotte sur l'iris, net à toute densité (SVG). 78px de LARGE : le
                  vélo est en paysage (82 × 42), il ne pèse donc qu'environ 40px de haut — la hauteur
                  du mot. Le bol carré, entre le 2026-09-18 et le 2026-09-27, tenait à 44. */}
              <BrandMark size={leanHeader ? 44 : 78} tile={false} color="#C8F03C" />
              {!leanHeader && (
                <div className="brand-text">
                  {/* <span> et non <h1> : la marque est présente sur toutes les pages, elle y
                      confisquait donc le titre de niveau 1. Le h1 appartient au contenu de la
                      page. Rendu inchangé, voir .brand-name dans styles.css. */}
                  <MotMarque className="brand-name" />
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
                {/* « Contact » (fondateur, 2026-10-09) : le formulaire a quitté l'accueil. Il mène au formulaire
                    de /aide, ancre `contact` (HelpPage.jsx) — et non à une page /contact : vercel.json redirige
                    déjà /contact vers /aide en 301, que les navigateurs gardent en mémoire. <Link> et non
                    <NavLink> : sur /aide, « Aide » serait sinon surligné deux fois. */}
                <Link to="/aide?sujet=contact">{t('nav.contact')}</Link>
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
                {user.isAdmin && !APPLI && <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>{t('nav.admin')}</NavLink>}
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
                {/* « Inscription » en contour PARTOUT (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 4) : en lime,
                    elle faisait concurrence au geste de chaque page (« Se connecter », « C'est bon : valider ma carte »…). Sur un
                    téléphone, elle disparaît de l'en-tête : « Connexion » y suffit, l'inscription est un onglet de /login. */}
                <Link to="/login?audience=client" className="btn-outline header-register-btn header-register-btn--contour">{t('nav.register')}</Link>
              </div>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </div>
      <div className={`wrap${fondVitrine ? ' wrap-accueil' : ''}`} style={{ paddingTop: fondVitrine ? 0 : 24 }}>
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
      {seesClientCart && <SuiviCommande />}
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
