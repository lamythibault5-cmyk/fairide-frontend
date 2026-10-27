import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { usePreviewMode } from '../context/PreviewModeContext';
import BrandMark from './BrandMark';
import MotMarque from './MotMarque';
import Icone, { IconePleine } from './Icone';
import useInbox from '../hooks/useInbox';
import { useCurseurOnglets } from '../hooks/useCurseurOnglets';
import { useEnteteDefilement } from '../hooks/useEnteteDefilement';
import { useSiteLarge } from '../hooks/useSiteLarge';
import { experienceApp } from '../natif';
import { defilement } from '../gestes';
import { useModeEquipe } from '../modeEquipe';
import { lazyPage } from '../lazyPage';

const NATIF = experienceApp();

/* LA CONSOLE ADMIN HORS DU PREMIER CHARGEMENT DES CLIENTS (audit du 24/10). La recherche globale (et adminUtils.jsx qu'elle
   tire) et la navigation des pôles (adminModules.js) ne servent qu'au compte admin, sur le site ; importées en dur ici, elles
   partaient chez chaque visiteur (~15 Ko compressés). lazyPage() (lazy() qui recharge après une mise en ligne, comme les
   pages) : leur code ne vient qu'au premier affichage pour un admin.
   Pendant ce court chargement, rien à leur place (fallback null) — la barre garde sa marque, son profil et ses liens du bas. */
const AdminGlobalSearch = lazyPage(() => import('./admin/AdminGlobalSearch'));
const AdminNav = lazyPage(() => import('./admin/AdminNavLaterale'));

// Items de nav par rôle : mêmes cibles que l'ancien .role-nav de Layout.jsx, juste redisposées
// verticalement avec une icône — pas de nouvelle page/route inventée ici.
function navItemsForRole(role, t, user, membreEquipe = false, pathname = '', etroit = false) {
  // Membre de l'équipe d'un commerce (modeEquipe.js) : le service seulement, ses commandes et son compte.
  if (role === 'restaurant' && membreEquipe) {
    return [
      { to: '/dashboard/orders', icon: 'commandes', label: t('nav.orders'), court: t('nav.court.orders') },
      { to: '/account', icon: 'compte', label: t('nav.account'), court: t('nav.court.account') }
    ];
  }
  if (role === 'client') {
    return [
      // CINQ onglets, plus six. Sur un téléphone, la barre du bas n'a de place que pour cinq cibles
      // confortables : à six, chacune tombait à 38px de haut, sous le minimum de 44px, et il fallait
      // viser. Les factures étaient déjà parties dans Mon compte pour la même raison ; les favoris
      // les y rejoignent. La règle ne change pas : une rubrique ne figure qu'à UN endroit.
      // « Recherche » a sa propre page, transversale : commerces, plats, cuisines, communes, aide,
      // commandes — pas seulement la liste des restaurants filtrée.
      { to: '/restaurants', icon: 'restaurants', label: t('nav.restaurants') },
      { to: '/map', icon: 'carte', label: t('nav.map') },
      { to: '/recherche', icon: 'recherche', label: t('nav.search') },
      { to: '/orders', icon: 'commandes', label: t('nav.orders'), court: t('nav.court.orders') },
      { to: '/account', icon: 'compte', label: t('nav.account'), court: t('nav.court.account') }
    ];
  }
  if (role === 'restaurant') {
    return [
      // Mon commerce = les infos du restaurant lui-même (création, puis modification) ; Ma carte = ce qu'il vend.
      // COMMANDES D'ABORD, MON COMMERCE EN TROISIÈME (fondateur, 2026-10-27, test du commerce de test) : c'est l'écran du
      // service, celui qu'on ouvre dix fois par jour, et l'accueil du commerce (espaceApresConnexion, routePrefetch.js). Avant
      // la mise en ligne, il montre la liste des étapes (OrdersPage, EtapesMiseEnLigne).
      { to: '/dashboard/orders', icon: 'commandes', label: t('nav.orders'), court: t('nav.court.orders') },
      { to: '/dashboard/menu', icon: 'restaurants', label: t('nav.myMenu'), court: t('nav.court.myMenu') },
      { to: '/dashboard', end: true, icon: 'commerce', label: t('nav.myBusiness'), court: t('nav.court.myBusiness') },
      // UN SEUL ONGLET « COMMERCE » SUR TÉLÉPHONE (fondateur, 2026-10-27, version A de maquettes/compte-commerce) : Mon compte
      // est monté dans Commerce (EditPage.jsx, Account `integre`) — Factures y était deux fois, « Mes commandes » répétait
      // l'onglet, et paiements et contrat étaient dans Compte quand la fiche était dans Commerce. L'ordinateur garde Mon compte.
      ...(etroit ? [] : [
      // Promotions, Factures et Mode d'emploi sont partis dans Mon compte : ce sont des rubriques
      // qu'on ouvre de temps en temps, pas au service. « Aperçu client » et « Carte » les y ont
      // rejoints, pour la même raison et une de plus : à sept onglets, la barre du bas d'un
      // téléphone donnait des cibles de 38px, sous le minimum de 44px. Cinq, pas plus.
      { to: '/account', icon: 'compte', label: t('nav.account'), court: t('nav.court.account') }])
    ];
  }
  if (role === 'driver') {
    // Ce qu'un livreur regarde EN COURSE : ses courses, la carte, ses gains. Les factures sont
    // dans Mon compte — on les ouvre de temps en temps, pas au guidon. Une rubrique, un seul endroit.
    //
    // 2026-09-23 : « Pourboires » est devenu « Gains » — la page des gains liste déjà chaque pourboire
    // (lignes de type `tip`), la page dédiée ne faisait qu'en extraire un sous-total. Et « Mon dossier
    // livreur » n'est un onglet que tant que le compte n'est pas validé : c'est l'inscription, qu'on
    // termine une fois ; ensuite il se rouvre depuis Mon compte.
    // PLUS D'ONGLET « CARTE » (fondateur, 2026-10-27 : « pour les livreurs, la carte est-elle vraiment nécessaire ? je ne
    // pense pas ») : une course s'ouvre dans Courses, et l'itinéraire part vers Maps ou Waze. La page /driver/map reste à son
    // adresse (liens déjà envoyés), sans onglet.
    return [
      { to: '/driver', end: true, icon: 'commandes', label: t('nav.rides') },
      // Validé et dossier rouvert depuis Mon compte : l'onglet revient le temps d'y être, allumé (deuxième audit design,
      // 2026-10-19 : la page « C'est bon, tu peux rouler » n'avait aucun onglet actif).
      ...(user?.adminStatus === 'approved' && !pathname.startsWith('/driver/onboarding') ? [] : [{ to: '/driver/onboarding', icon: 'dossier', label: t('nav.courierFile'), court: t('nav.court.courierFile') }]),
      { to: '/driver/earnings', icon: 'euro', label: t('nav.earnings') },
      { to: '/account', icon: 'compte', label: t('nav.account'), court: t('nav.court.account') }
    ];
  }
  return [{ to: '/account', icon: 'compte', label: t('nav.account'), court: t('nav.court.account') }];
}

/* LES ONGLETS DE L'APP (fondateur, 2026-10-23, version A de maquettes/transitions-appli) : comme sur iPhone, un onglet
 * s'affiche tout de suite et retrouve ce qu'on y regardait ; toucher l'onglet où l'on est remonte en haut.
 *   - `replace` : changer d'onglet n'ajoute pas d'écran à l'historique (le glisser-retour ne ramène plus à l'onglet d'avant,
 *     et la navigation n'est pas animée, transitionPhoto.js n'emballe que les « avancer ») ;
 *   - `restaurerDefilement` : ScrollRestorer.jsx remet sous les yeux ce qu'on regardait en quittant l'onglet ;
 *   - sur l'onglet affiché lui-même (adresse exacte, pas une fiche ouverte depuis lui) : remonter en douceur, et l'écran
 *     repart de son état de départ (« fairide:onglet-retouche » : la liste efface ses filtres, 2026-10-26).
 * CHAQUE ONGLET RETROUVE SA PLACE, ET N'ARRIVE JAMAIS AU MILIEU D'UN TEXTE (fondateur, 2026-10-27, deux demandes du même
 * jour). Le matin, le test du commerce : « en cliquant sur Restaurant j'arrive au milieu de l'écran ; je dois arriver en haut
 * ou sur quelque chose de clair » — tout onglet s'est ouvert en haut. L'après-midi : « si je descends dans Mon compte, que je
 * passe sur l'accueil et que je reviens, je veux être où j'étais ». Les deux tiennent ensemble, parce que l'arrivée au milieu
 * venait surtout d'un défaut : un onglet sans place gardée s'ouvrait à la hauteur de l'onglet d'AVANT. ScrollRestorer.jsx ne
 * rend plus que ce qu'on avait vraiment sous les yeux (le titre de la rubrique, defilementAuto.js) ; s'il a disparu, si
 * l'onglet a été quitté il y a plus d'un quart d'heure, ou si l'écran montre une prochaine étape (la liste « avant d'être en
 * ligne »), l'onglet s'ouvre en haut.
 * S'ouvrent TOUJOURS EN HAUT les onglets qui sont une liste de choses à faire, la plus récente en haut : Recherche et Mes
 * commandes (fondateur, 2026-10-24 : on y revient pour une nouvelle recherche, ou pour la dernière commande), les Commandes
 * du commerce et les Courses du livreur (la commande à traiter, la course à prendre), et le dossier du livreur, une
 * inscription dont la prochaine étape est en haut. Menu, Commerce, Gains et Mon compte gardent leur place. */
const ONGLETS_EN_HAUT = new Set(['/recherche', '/orders', '/dashboard/orders', '/driver', '/driver/onboarding']);
/* SUR LE SITE AUSSI (fondateur, 2026-10-27 : « pour tous les changements d'écran, client, commerce et livreur ») — la barre
 * latérale devient la barre du bas sous 900px. Sans `replace` : sur le site, l'historique du navigateur reste celui qu'on
 * attend, chaque onglet ouvert est une page. */
function ongletSite(vers) {
  return ONGLETS_EN_HAUT.has(vers) ? {} : { state: { restaurerDefilement: true } };
}
function ongletAppli(vers, ici) {
  return {
    replace: true,
    state: ONGLETS_EN_HAUT.has(vers) ? undefined : { restaurerDefilement: true },
    onClick: (e) => {
      if (ici !== vers) return;
      e.preventDefault();
      // L'écran de l'onglet repart de son état de départ (la liste efface ses filtres, RestaurantList.jsx — 2026-10-26).
      window.dispatchEvent(new CustomEvent('fairide:onglet-retouche', { detail: vers }));
      window.scrollTo({ top: 0, behavior: defilement() });
    }
  };
}

// FR · NL · EN au bas de la barre latérale du site : trois petites pastilles, celle de la langue choisie cernée d'un filet.
const NOMS_LANGUES = { fr: 'FR', nl: 'NL', en: 'EN' };
function SelecteurLangue({ t }) {
  const { language, setLanguage, languages } = useLanguage();
  const ordre = ['fr', 'nl', 'en'].filter((l) => languages.includes(l));
  return (
    <div className="site-cote-langues" role="group" aria-label={t('siteCadre.langue')}>
      {ordre.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={l === language} onClick={() => setLanguage(l)}>{NOMS_LANGUES[l]}</button>
      ))}
    </div>
  );
}

export default function DashboardSidebar() {
  const { user, role, logout } = useAuth();
  const { t } = useLanguage();
  const { previewMode, exitPreview } = usePreviewMode();
  const membreEquipe = useModeEquipe();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navRef = useRef(null);
  // Membre de l'équipe d'un commerce (modeEquipe.js) : la liste des onglets change sans changer d'adresse — la pastille
  // restait sur la place de l'ancien onglet « Commandes », et l'onglet actif, blanc sur blanc, disparaissait.
  useCurseurOnglets(navRef, `${pathname}|${user?.isAdmin ? 'admin' : ''}|${membreEquipe ? 'equipe' : ''}`);
  /* LA BARRE DU BAS SE RÉDUIT AU DÉFILEMENT (sous 900px, voir styles.css) : on descend pour lire, les
   * libellés s'effacent et la barre se resserre autour des icônes ; on remonte — le geste de quelqu'un qui
   * cherche où aller — elle reprend sa taille. Même hook et même règle que l'en-tête du site, pour que les
   * deux bougent ensemble. Au-dessus de 900px la classe ne change rien : la barre latérale ne recouvre rien. */
  // Quasi instantané (retour du fondateur, 2026-10-14 : « elle met trop de temps à se réduire ») : 120px de défilement
  // avant la première réduction, c'était près d'un écran de pouce. Dans l'application, 24px et 3px de marge — dès que le
  // doigt descend ; sur le site, 60px et 6px, un peu plus de tolérance au tremblement d'un trackpad.
  const compacte = useEnteteDefilement(NATIF ? { seuil: 24, marge: 3 } : { seuil: 60, marge: 6 });
  /* LA BARRE DU PANIER SUIT (fondateur, 2026-10-17 : « que le panier se réduise en même temps que la barre, avec la même
   * animation »). L'état est publié sur <html> (`barre-compacte`) : la pilule du panier (FloatingCart, styles.css) se
   * réduit au même instant, avec les mêmes durées — un seul calcul de défilement pour les deux, donc jamais de décalage. */
  useEffect(() => {
    document.documentElement.classList.toggle('barre-compacte', compacte);
    return () => document.documentElement.classList.remove('barre-compacte');
  }, [compacte]);
  // Le compte admin (fairide.entreprise@gmail.com, voir middleware/auth.js isAdminEmail) sert
  // exclusivement à l'ERP interne : peu importe le rôle "métier" sous-jacent du compte ou la page visitée,
  // la sidebar ne montre jamais la nav client/restaurateur/livreur pour ce compte — seulement les 7
  // sections ERP. Un vrai utilisateur (non-admin) garde sa propre nav, avec juste un lien "Admin" en plus
  // s'il a aussi ce statut.
  // Sur le SITE seulement (Owen, 2026-10-20) : dans l'application, la console n'existe pas (App.jsx, AdminSurLeSite), donc
  // un compte admin y garde la navigation de son rôle — sinon la barre d'onglets menait vers des pôles qui n'existent pas.
  const isAdminAccount = !!user?.isAdmin && !NATIF;
  // Messages de Fairide non lus : pastille sur « Mon compte » (0 pour l'admin, le hook se désactive).
  const { unread: nonLus } = useInbox();
  // Un restaurateur en mode aperçu voit la nav "client" (favoris, commandes, carte...) au lieu de la
  // sienne, pour explorer l'expérience de bout en bout — voir ProtectedRoute pour l'accès aux pages
  // correspondantes, toujours réservées aux vrais clients côté API.
  const effectiveRole = previewMode && role === 'restaurant' ? 'client' : role;
  const etroit = !useSiteLarge(900);
  const items = isAdminAccount ? [] : navItemsForRole(effectiveRole, t, user, membreEquipe, pathname, etroit);
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  function leavePreview() {
    exitPreview();
    navigate('/dashboard/preview');
  }

  return (
    <aside className={`dashboard-sidebar${compacte ? ' dashboard-sidebar--compacte' : ''}`}>
      {/* La marque n'est pas un lien (fondateur, 2026-10-16) : elle menait à la liste des commerces, ce qu'on ne
          devine pas en la touchant. Les onglets juste en dessous y mènent déjà. */}
      <div className="dashboard-sidebar-brand">
        {/* Sur le site, la tuile de la maquette (40 px, site-cadre.css) ; l'app garde la sienne. */}
        <BrandMark size={NATIF ? 30 : 40} />
        <MotMarque />
      </div>
      {previewMode && role === 'restaurant' && (
        <div className="preview-mode-sidebar-banner">
          <span>{t('nav.previewModeBanner')}</span>
          <button type="button" onClick={leavePreview}>{t('nav.leave')}</button>
        </div>
      )}
      {isAdminAccount && <Suspense fallback={null}><AdminGlobalSearch /></Suspense>}
      {/* title et aria-label portent le libellé en toutes lettres : dans la barre compacte du bas
          (au défilement) il n'y a plus que les icônes, et une icône seule ne dit rien à un lecteur
          d'écran ni au survol. */}
      {isAdminAccount ? <Suspense fallback={null}><AdminNav t={t} /></Suspense> : (
      <nav className="dashboard-nav" ref={navRef}>
        <span className="nav-curseur" aria-hidden="true" />
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} title={item.label} aria-label={item.label} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}
            {...(NATIF ? ongletAppli(item.to, pathname) : ongletSite(item.to))}>
            {/* Dans l'app, la version pleine par-dessus : elle se montre sur l'onglet où l'on est et sous le doigt (styles.css). */}
            <span className="dashboard-nav-icon"><Icone nom={item.icon} taille={22} />{NATIF && <IconePleine nom={item.icon} taille={22} className="dashboard-nav-plein" />}</span>
            {/* Deux libellés : le complet pour la colonne latérale, le court pour la barre du bas (styles.css choisit). */}
            <span className="dashboard-nav-label"><span className="libelle-long">{item.label}</span>{item.court && <span className="libelle-court">{item.court}</span>}</span>
            {/* Les messages de Fairride : sur Compte, ou sur Commerce quand Mon compte y est monté (téléphone, 2026-10-27). */}
            {(item.to === '/account' || (item.to === '/dashboard' && etroit)) && nonLus > 0 && <span className="nav-badge tone-warn" aria-label={t('inbox.rowSubUnread', { n: nonLus })}>{nonLus}</span>}
          </NavLink>
        ))}
      </nav>
      )}
      {/* LE BAS DE LA BARRE, SUR LE SITE (fondateur, 2026-10-16, maquettes/site-ordinateur/site-ordinateur.html) : la langue et les liens
          légaux y descendent — ils étaient une rangée sous chaque page, et la langue n'existait que dans Mon compte. Rendu
          hors de l'app seulement (l'app n'a aucun cadre du site, voir Layout.jsx) ; masqué sous 900px, où la barre devient
          les onglets du bas (site-cadre.css). */}
      {!NATIF && (
        <div className="site-cote-bas">
          <SelecteurLangue t={t} />
          <nav className="site-cote-legal" aria-label={t('siteCadre.liensLegaux')}>
            <Link to="/mentions-legales">{t('footer.legalNotice')}</Link>
            <Link to="/cgv">{t('footer.terms')}</Link>
            <Link to="/confidentialite">{t('footer.privacy')}</Link>
            <Link to="/cookies">{t('footer.cookies')}</Link>
          </nav>
        </div>
      )}
      <div className="dashboard-profile-card">
        <div className="dashboard-profile-avatar">{initial}</div>
        <div className="dashboard-profile-info">
          <span className="dashboard-profile-name" title={user?.name}>{user?.name}</span>
          <span className="dashboard-profile-role">{previewMode && role === 'restaurant' ? t('nav.customerPreviewLower') : isAdminAccount ? 'admin' : membreEquipe && role === 'restaurant' ? t('team.profileRole') : t(`account.role${String(role || 'client').charAt(0).toUpperCase()}${role.slice(1)}`)}</span>
          <button type="button" className="dashboard-profile-logout" onClick={logout}>{t('nav.logout')}</button>
        </div>
      </div>
    </aside>
  );
}
