import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { categoryEmoji, categoryLabel, groupBySubsection, resolveItemImage } from '../../menuCategories';
import { imgProps } from '../../images';
import { euros } from '../../prixPlat';
import { vibrer } from '../../gestes';
import { experienceApp } from '../../natif';
import CategoryQuickNav from '../CategoryQuickNav';
import '../../ecran-fiche.css';
import MenuConciergeRequest from '../MenuConciergeRequest';
import ConformiteCarte from '../conformite/ConformiteCarte';
import MentionsAlimentaires from './MentionsAlimentaires';
import { MENTIONS_COMMERCE } from '../../dietary';
import HaussePrix from '../HaussePrix';
import DemandeModifCarte from '../DemandeModifCarte';
import TvaCarte from './TvaCarte';
import Icone from '../Icone';
import { BandeauCommerce, FeuilleCommerce } from './BandeauCommerce';
import { SITE } from './CadreSite';
import TexteReplie from '../TexteReplie';

/* « MA CARTE » CÔTÉ COMMERCE, AU BANDEAU IRIS (fondateur, 2026-10-16, maquettes/tous-les-ecrans/tous-les-ecrans.html › Ma carte,
 * « Interrupteur de rupture »). Le commerce ne modifie pas ses plats lui-même (fondateur, 2026-10-01) : il met un plat en
 * rupture pour aujourd'hui, le retire de la carte, ou demande un changement à Fairide. La page garde ces trois gestes :
 *   - chaque plat a son interrupteur « En vente aujourd'hui » qui rebondit — c'est l'ancien bouton « Rupture », même route
 *     (POST /restaurants/:id/menu/:itemId/stock { outOfStock }) ; le plat revient tout seul demain ;
 *   - « Retirer de la carte » sous le nom (même route, { withdrawn }), sans retour automatique ;
 *   - la demande à Fairide (DemandeModifCarte) avec le bouton lime.
 * Les sections sont dans une bande collée en haut (verre dans l'app). Engagements, régimes, hausse de prix et TVA suivent,
 * comme avant. La console admin (modeAdmin) garde l'éditeur complet de MenuPage.jsx. */
export default function CarteCommerce({ restaurant, restoId, loadDashboard, communs, urlSuggeree, onStock, onWithdraw }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const menu = restaurant.menu || [];
  const carteVide = menu.length === 0;
  const [methodesOuvertes, setMethodesOuvertes] = useState(false);
  const sections = (restaurant.sections || [])
    .map((s) => ({ ...s, items: menu.filter((i) => (i.category || 'plat') === s.name) }))
    .filter((s) => s.items.length > 0);
  const enLigne = menu.filter((i) => !i.withdrawn && i.available !== false && !i.outOfStockToday).length;


  const titreEnLigne = enLigne === 0 ? t('ecranCommerce.aucunEnLigne') : t(enLigne === 1 ? 'ecranCommerce.produitEnLigne' : 'ecranCommerce.produitsEnLigne', { n: enLigne });
  // Sur le site : largeur de lecture (site-pro.css), une liste de plats n'a rien à gagner à 1 120 px.
  return (
    <div className={SITE ? 'sp-page sp-page--lecture' : undefined}>
      <BandeauCommerce>
        <div className="ec-b-haut">
          <span><b>{restaurant.name}</b></span>
          <span className="ec-chip"><Icone nom="cadenas" taille={13} />{t('ecranCommerce.gereeAvecFairide')}</span>
        </div>
        <h1 className="ec-b-titre">{t('ecranCommerce.taCarte')}</h1>
        <p className="ec-b-sous">{carteVide ? t('menuPage.stepCreateHelpEmpty') : titreEnLigne}</p>
      </BandeauCommerce>
      <FeuilleCommerce>
        {communs}
        {/* Côté commerce, la remise de carte et les étapes restantes sont dans la liste « Avant d'être en ligne » (MiseEnLigne). */}
        {(carteVide || methodesOuvertes) && (
          <div className="card" id="menu-methodes">
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('menuPage.methodsTitle')}</h3>
            <p className="small" style={{ margin: '0 0 14px' }}>{t('menuPage.methodsIntro')}</p>
            <div className="methode" id="menu-concierge">
              <div className="methode-tete"><h4>{t('menuPage.method1Title')}</h4><span className="pill teal">{t('menuPage.recommendedFree')}</span></div>
              <p className="small methode-sous">{t('menuPage.method1Sub')}</p>
              <MenuConciergeRequest restoId={restoId} urlSuggeree={urlSuggeree} />
            </div>
          </div>
        )}

        {!carteVide && (
          <>
            <p className="ec-carte-verrou" role="note">
              <Icone nom="cadenas" taille={16} />
              <span><b style={{ color: 'var(--ink)' }}>{t('menuPage.lockedTitle')}</b>{' · '}<TexteReplie as="span" texte={t('ecranCommerce.verrouAide')} titre={t('menuPage.lockedTitle')} /></span>
            </p>
            {/* LA BANDE DES SECTIONS DE LA VUE CLIENT (fondateur, 2026-10-27 : « la barre de menu sur la carte devrait être la même
                que la vue client »). C'était une rangée de pastilles à part (.ec-sections, la section lue en iris plein) ; c'est
                maintenant CategoryQuickNav, celle de la fiche du commerce : lentille de verre dans l'app, pastille iris qui glisse
                sur le site, même suivi au défilement, même saut. Les classes .fiche-page .fiche-appli lui donnent ses styles
                (ecran-fiche.css) ; .ec-carte-liste la colle en haut de l'écran du commerce, qui n'a pas les ronds de la fiche. */}
            <div id="menu-liste" className="fiche-page fiche-appli ec-carte-liste">
              <CategoryQuickNav categories={sections} verre={experienceApp()} pouce={!experienceApp()} />
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={`menu-cat-${s.id}`}>
                  <h2 className="ec-section-titre" id={`menu-cat-${s.id}`}>
                    {categoryLabel(s.name, t)} <span className="ec-section-compte">{s.items.length}</span>
                  </h2>
                  {groupBySubsection(s.items, s.name, t).map((g) => (
                    <div key={g.key || '__none'}>
                      {g.label && <p className="ec-sous-section">{g.label}</p>}
                      {g.items.map((item) => (
                        <LignePlat key={item.id} item={item} sections={restaurant.sections || []} t={t} onStock={onStock} onWithdraw={onWithdraw} />
                      ))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
            {/* Le plus court chemin : écrire ce qu'on veut changer, l'équipe Fairide s'en charge (fondateur, 2026-10-01). */}
            <div className="ec-demande"><DemandeModifCarte restoId={restoId} lime /></div>
            <button type="button" className="btn-outline btn-sm" style={{ marginBottom: 6 }} onClick={() => setMethodesOuvertes((o) => !o)}>
              {methodesOuvertes ? t('menuPage.hideMethods') : t('menuPage.askFairideAgain')}
            </button>
          </>
        )}

        {/* Ce qui suit se signe ou se règle soi-même (engagements, mentions, hausse, TVA) : plus « Aller plus loin », qui le
            faisait passer pour du facultatif (audit du 19/10, shop-16). */}
        <p className="ec-feuille-titre">{t('ecranCommerce.reglagesTitre')}</p>
        {/* Carte signée, allergènes, vendeur professionnel (backlog de conformité A1, A2, A8). */}
        <ConformiteCarte restoId={restoId} rafraichir={restaurant} onChange={() => loadDashboard(restoId)} />
        {/* Halal, végétarien, vegan, sans gluten, bio : déclarés par le commerce lui-même, malgré le verrou de la carte. De
            retour pour le commerce le 2026-10-27 (MENTIONS_COMMERCE, dietary.js) ; les clients ne les voient pas encore. */}
        {MENTIONS_COMMERCE && <MentionsAlimentaires restaurant={restaurant} restoId={restoId} token={token} onChange={() => loadDashboard(restoId)} />}
        {/* Hausse de prix gardée par le commerce (fondateur, 2026-09-30). */}
        {!carteVide && <HaussePrix restoId={restoId} nbPlats={menu.length} onChange={() => loadDashboard(restoId)} />}
        <TvaCarte restoId={restoId} token={token} menu={menu} toast={toast} onChange={() => loadDashboard(restoId)} />
      </FeuilleCommerce>
    </div>
  );
}

// Un plat : photo, nom, état du jour, « Retirer de la carte », et l'interrupteur « En vente aujourd'hui ».
/* L'INTERRUPTEUR ET « RETIRER » NE SE VERROUILLENT PLUS (2026-10-23, app lente : la ligne basculait, puis restait bloquée
 * jusqu'à la fin du rechargement complet de la fiche). Le plat lui-même change dans la fiche gardée au toucher (MenuPage.jsx,
 * changerPlatEnStock) et revient si le serveur refuse ; un second toucher pendant l'envoi est permis, le dernier gagne
 * (actionOptimiste.js). Plus d'état « visé » à part : la ligne lit toujours le plat. */
function LignePlat({ item, sections, t, onStock, onWithdraw }) {
  const enVente = !item.outOfStockToday;
  const image = resolveItemImage(item, sections);
  const interrupteur = !item.withdrawn && (item.available !== false || item.outOfStockToday);
  const indisponible = !item.withdrawn && item.available === false && !item.outOfStockToday;
  const rupture = !item.withdrawn && !indisponible && !enVente;

  function basculer() {
    vibrer('bascule');
    onStock(item.id, enVente).catch(() => { /* message déjà affiché, plat remis comme avant */ });
  }
  function retirer() {
    onWithdraw(item.id, !item.withdrawn).catch(() => { /* message déjà affiché, plat remis comme avant */ });
  }

  const etat = item.withdrawn ? t('ecranCommerce.retire')
    : rupture ? t('menuItem.stockOutToday')
      : indisponible ? t('menuItem.unavailable')
        : `${euros(item.price)} · ${t('ecranCommerce.enVente')}`;
  return (
    <div className={`ec-plat${rupture ? ' ec-plat--rupture' : ''}${item.withdrawn || indisponible ? ' ec-plat--retire' : ''}`}>
      {image
        ? <img loading="lazy" decoding="async" {...imgProps(image, 58, '58px')} alt="" className="ec-plat-photo" />
        : <span className="ec-plat-photo" aria-hidden="true"><Icone nom={categoryEmoji(item.category)} taille={22} /></span>}
      <span className="ec-plat-texte">
        <b>{item.name}</b>
        {item.activePromo && <span className="ec-plat-promo"><Icone nom="etiquette" taille={12} className="icone-texte" />{' '}{item.activePromo.label}</span>}
        <small key={etat} className="ec-plat-etat fondu">{etat}</small>
        {(item.withdrawn || item.available !== false) && (
          <button type="button" className="ec-lien" onClick={retirer}
            title={item.withdrawn ? t('menuItem.withdrawBackHelp') : t('menuItem.withdrawHelp')}>
            {item.withdrawn ? `↩︎ ${t('menuItem.withdrawBack')}` : t('menuItem.markUnavailable')}
          </button>
        )}
      </span>
      {interrupteur && (
        <button type="button" role="switch" aria-checked={enVente} className={`ec-interrupteur${enVente ? ' on' : ''}`}
          aria-label={`${t('ecranCommerce.enVenteAujourdhui')} : ${item.name}`} title={enVente ? t('menuItem.stockOutHelp') : t('menuItem.stockBackHelp')}
          onClick={basculer} />
      )}
    </div>
  );
}
