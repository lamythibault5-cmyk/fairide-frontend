import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { categoryEmoji, categoryLabel, groupBySubsection, resolveItemImage } from '../../menuCategories';
import { imgProps } from '../../images';
import { euros } from '../../prixPlat';
import { defilement, vibrer } from '../../gestes';
import MenuConciergeRequest from '../MenuConciergeRequest';
import ConformiteCarte from '../conformite/ConformiteCarte';
import MentionsAlimentaires from './MentionsAlimentaires';
import HaussePrix from '../HaussePrix';
import DemandeModifCarte from '../DemandeModifCarte';
import TvaCarte from './TvaCarte';
import Icone from '../Icone';
import { BandeauCommerce, FeuilleCommerce } from './BandeauCommerce';
import { SITE } from './CadreSite';

/* « MA CARTE » CÔTÉ COMMERCE, AU BANDEAU IRIS (fondateur, 2026-10-16, mockups/tous-les-ecrans.html › Ma carte,
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

  // La section à l'écran allume sa pastille ; toucher une pastille y descend.
  const [active, setActive] = useState(0);
  const titres = useRef([]);
  const bande = useRef(null);
  useEffect(() => {
    const els = titres.current.filter(Boolean);
    if (!els.length || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entrees) => {
      const visibles = entrees.filter((e) => e.isIntersecting).map((e) => Number(e.target.dataset.rang));
      if (visibles.length) setActive(Math.min(...visibles));
    }, { rootMargin: '-90px 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections.length]);
  useEffect(() => {
    // Seulement la bande, de côté : scrollIntoView ferait aussi défiler la page jusqu'à elle.
    const b = bande.current;
    const on = b?.querySelector('.ec-puce.on');
    if (b && on) b.scrollTo({ left: on.offsetLeft - (b.clientWidth - on.offsetWidth) / 2, behavior: defilement() });
  }, [active]);
  const allerA = (k) => {
    setActive(k);
    titres.current[k]?.scrollIntoView({ behavior: defilement(), block: 'start' });
  };

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
              <div className="methode-tete"><h4>{t('menuPage.method1Title')}</h4><span className="pill gold">{t('menuPage.recommendedFree')}</span></div>
              <p className="small methode-sous">{t('menuPage.method1Sub')}</p>
              <MenuConciergeRequest restoId={restoId} urlSuggeree={urlSuggeree} />
            </div>
          </div>
        )}

        {!carteVide && (
          <>
            <p className="ec-carte-verrou" role="note">
              <Icone nom="cadenas" taille={16} />
              <span><b style={{ color: 'var(--ink)' }}>{t('menuPage.lockedTitle')}</b>{' · '}{t('ecranCommerce.verrouAide')}</span>
            </p>
            {sections.length > 1 && (
              <nav className="ec-sections" ref={bande} aria-label={t('ecranCommerce.sectionsCarte')}>
                {sections.map((s, k) => (
                  <button key={s.id} type="button" className={`ec-puce${k === active ? ' on' : ''}`} aria-pressed={k === active} onClick={() => allerA(k)}>
                    {categoryLabel(s.name, t)}
                  </button>
                ))}
              </nav>
            )}
            <div id="menu-liste">
              {sections.map((s, k) => (
                <section key={s.id} aria-labelledby={`ec-section-${s.id}`}>
                  <h2 className="ec-section-titre" id={`ec-section-${s.id}`} data-rang={k} ref={(el) => { titres.current[k] = el; }}>
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

        <p className="ec-feuille-titre">{t('menuPage.stepMore')}</p>
        {/* Carte signée, allergènes, vendeur professionnel (backlog de conformité A1, A2, A8). */}
        <ConformiteCarte restoId={restoId} rafraichir={restaurant} onChange={() => loadDashboard(restoId)} />
        {/* Halal, sans gluten, vegan, bio : déclarés par le commerce lui-même, malgré le verrou de la carte. */}
        <MentionsAlimentaires restaurant={restaurant} restoId={restoId} token={token} onChange={() => loadDashboard(restoId)} />
        {/* Hausse de prix gardée par le commerce (fondateur, 2026-09-30). */}
        {!carteVide && <HaussePrix restoId={restoId} nbPlats={menu.length} onChange={() => loadDashboard(restoId)} />}
        <TvaCarte restoId={restoId} token={token} menu={menu} toast={toast} onChange={() => loadDashboard(restoId)} />
      </FeuilleCommerce>
    </div>
  );
}

// Un plat : photo, nom, état du jour, « Retirer de la carte », et l'interrupteur « En vente aujourd'hui ». L'interrupteur
// bascule tout de suite (on montre la valeur visée pendant l'appel) et revient si le serveur refuse.
function LignePlat({ item, sections, t, onStock, onWithdraw }) {
  const [visee, setVisee] = useState(null);
  const [retraitEnCours, setRetraitEnCours] = useState(false);
  const enVente = visee ?? !item.outOfStockToday;
  const image = resolveItemImage(item, sections);
  const interrupteur = !item.withdrawn && (item.available !== false || item.outOfStockToday);
  const indisponible = !item.withdrawn && item.available === false && !item.outOfStockToday;
  const rupture = !item.withdrawn && !indisponible && !enVente;

  async function basculer() {
    if (visee !== null) return;
    const v = !enVente;
    setVisee(v);
    vibrer(10);
    try { await onStock(item.id, !v); } catch { /* message déjà affiché */ } finally { setVisee(null); }
  }
  async function retirer() {
    setRetraitEnCours(true);
    try { await onWithdraw(item.id, !item.withdrawn); } catch { /* message déjà affiché */ } finally { setRetraitEnCours(false); }
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
          <button type="button" className="ec-lien" disabled={retraitEnCours} onClick={retirer}
            title={item.withdrawn ? t('menuItem.withdrawBackHelp') : t('menuItem.withdrawHelp')}>
            {retraitEnCours ? '…' : item.withdrawn ? `↩︎ ${t('menuItem.withdrawBack')}` : t('menuItem.markUnavailable')}
          </button>
        )}
      </span>
      {interrupteur && (
        <button type="button" role="switch" aria-checked={enVente} className={`ec-interrupteur${enVente ? ' on' : ''}`}
          aria-label={`${t('ecranCommerce.enVenteAujourdhui')} : ${item.name}`} title={enVente ? t('menuItem.stockOutHelp') : t('menuItem.stockBackHelp')}
          aria-busy={visee !== null} onClick={basculer} />
      )}
    </div>
  );
}
