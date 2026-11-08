import { useState } from 'react';
import MiseEnLigne from './MiseEnLigne';
import ConfirmDialog from '../ConfirmDialog';
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
import DemandeModifCarte from '../DemandeModifCarte';
import TvaCarte from './TvaCarte';
import Icone from '../Icone';
import { BandeauCommerce, FeuilleCommerce } from './BandeauCommerce';
import { SITE } from './CadreSite';
import TexteReplie from '../TexteReplie';
import { BandePhotos, FeuillePlat, RafalePhotos } from './AjoutPlat';
import { usePhotoPlat, useRegleCarte } from './ajoutPlatOutils';
import { EtatHausse, FenetreRefus, FeuilleTextes, RefusHausse, SupplementsCarte } from './HaussesCommerce';
import { regleHausses, useDeclarations } from './haussesOutils';

/* « MA CARTE » CÔTÉ COMMERCE, AU BANDEAU IRIS (fondateur, 2026-10-16, maquettes/tous-les-ecrans/tous-les-ecrans.html › Ma carte,
 * « Interrupteur de rupture »). Le commerce ne modifie pas ses plats lui-même (fondateur, 2026-10-01) : il met un plat en
 * rupture pour aujourd'hui, le retire de la carte, ou demande un changement à Fairide. La page garde ces trois gestes :
 *   - chaque plat a son interrupteur « En vente aujourd'hui » qui rebondit — c'est l'ancien bouton « Rupture », même route
 *     (POST /restaurants/:id/menu/:itemId/stock { outOfStock }) ; le plat revient tout seul demain ;
 *   - « Retirer de la carte » sous le nom (même route, { withdrawn }), sans retour automatique ;
 *   - la demande à Fairide (DemandeModifCarte) avec le bouton lime.
 * Les sections sont dans une bande collée en haut (verre dans l'app). Engagements, régimes et TVA suivent.
 * La console admin (modeAdmin) garde l'éditeur complet de MenuPage.jsx.
 *
 * LE PREMIER JOUR (fondateur, 2026-10-27, S1 de maquettes/audit-ecrans/audit-ecrans.html) : l'accueil disait « Relis et valide ta
 * carte », cet onglet ne le disait nulle part et son lime était « Envoyer à Fairride » (une demande de changement). Tant que le
 * commerce n'est pas en ligne, la rangée « Prochaine étape » (MiseEnLigne) vient en tête avec LE bouton lime, et la demande à
 * Fairide passe en iris. Plus de second bouton « Demander à Fairride une mise à jour » (le même formulaire, juste au-dessus).
 * Les engagements allergènes et vendeur professionnel se signent sur « Tes engagements » seulement (ConformiteCarte reçoit
 * `versEngagements`) ; la hausse de prix se choisit sur « C'est bon », puis dans une rangée de Commerce (Account.jsx).
 *
 * LE VERROU S'OUVRE SUR TROIS GESTES (fondateur, 2026-10-29, AjoutPlat.jsx) : le carré « + photo » d'un plat sans photo et
 * la bande « N plats sans photo » en rafale ; « Ajouter un plat » ; le prix d'un plat, touché, pour le changer. Prix toujours
 * déclarés sur l'honneur. « Ajouter un plat » prend le lime une fois le commerce en ligne : la demande à Fairride (nom,
 * description, retrait) passe en iris. Le titulaire seul : un membre de l'équipe du commerce ne voit pas ces gestes.
 *
 * LE COMMERCE CHANGE SES TEXTES ET SES SUPPLÉMENTS, UNE HAUSSE A SA PHOTO (Owen, 2026-11-08, maquettes/carte-hausses) : le nom
 * d'un plat touché ouvre la feuille « Changer ce plat » (nom, description, section, en ligne d'une touche ; « Retirer de la
 * carte » au bas de la feuille). Les suppléments payants sont listés sous les plats, leur prix touchable. Une hausse dont la
 * photo n'a pas convaincu l'équipe met sa carte de choix en tête (RefusHausse), et prend alors le lime de l'écran.
 * La demande à Fairride reste pour le reste (un supplément à ajouter, des options). Détails : HaussesCommerce.jsx. */
export default function CarteCommerce({ restaurant, restoId, loadDashboard, communs, urlSuggeree, onStock, onWithdraw, onConnect, connecting, lectureSeule = false }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const menu = restaurant.menu || [];
  const carteVide = menu.length === 0;
  const avantEnLigne = !restaurant.publicListed;
  const [aRetirer, setARetirer] = useState(null);
  const sections = (restaurant.sections || [])
    .map((s) => ({ ...s, items: menu.filter((i) => (i.category || 'plat') === s.name) }))
    .filter((s) => s.items.length > 0);
  const enLigne = menu.filter((i) => !i.withdrawn && i.available !== false && !i.outOfStockToday).length;
  const recharger = () => loadDashboard(restoId);
  const regle = useRegleCarte(restoId, token, restaurant);
  const titulaire = !lectureSeule;
  const hausses = regleHausses(restaurant);
  const declarations = useDeclarations(restoId, token, titulaire);
  // Après un prix déclaré, un texte changé ou un choix : la carte ET les déclarations (l'étiquette sous le prix en dépend).
  const toutRecharger = () => Promise.all([recharger(), declarations.charger()]);
  const photo = usePhotoPlat(restoId, token, recharger);
  // Plat ouvert dans la feuille : { nouveau: true }, { plat } pour son prix, ou { option } pour le prix d'un supplément.
  const [feuille, setFeuille] = useState(null);
  const [textes, setTextes] = useState(null);
  const [refusOuvert, setRefusOuvert] = useState(null);
  const [rafale, setRafale] = useState(false);
  const refus = titulaire ? declarations.refus : [];
  const sansPhoto = menu.filter((i) => !i.imageUrl && !i.withdrawn);

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
        {avantEnLigne && <MiseEnLigne restaurant={restaurant} restoId={restoId} token={token} onConnect={onConnect} connecting={connecting}
          onChange={() => loadDashboard(restoId)} lectureSeule={lectureSeule} />}
        {carteVide && (
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

        {/* Une photo refusée : la carte du choix en tête, avec le lime de l'écran (décision 3 de maquettes/carte-hausses). */}
        {refus.map((d, i) => (
          <RefusHausse key={d.id} d={d} restoId={restoId} token={token} badge={!!restaurant.prixComptoir} lime={i === 0} onFait={toutRecharger} />
        ))}
        {!carteVide && (
          <>
            <p className="ec-carte-verrou" role="note">
              <Icone nom="cadenas" taille={16} />
              <span><b style={{ color: 'var(--ink)' }}>{t('menuPage.lockedTitle')}</b>{' · '}<TexteReplie as="span" texte={t('ecranCommerce.verrouAide')} titre={t('menuPage.lockedTitle')} /></span>
            </p>
            {titulaire && <BandePhotos n={sansPhoto.length} onOuvrir={() => setRafale(true)} />}
            {titulaire && (
              <button type="button" className={`ec-bouton ${avantEnLigne || refus.length ? 'ec-bouton--iris' : 'ec-bouton--lime'} ec-ajout-bouton`} onClick={() => setFeuille({ nouveau: true })}>
                <span aria-hidden="true" className="ec-ajout-plus">+</span>{t('carteAjout.ajouter')}
              </button>
            )}
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
                        <LignePlat key={item.id} item={item} sections={restaurant.sections || []} t={t} onStock={onStock} onWithdraw={onWithdraw} onDemanderRetrait={setARetirer}
                          onPhoto={titulaire ? photo.choisir : null} photoEnvoi={photo.envoi === item.id} onPrix={titulaire ? (p) => setFeuille({ plat: p }) : null}
                          onTextes={titulaire ? setTextes : null}
                          etatHausse={titulaire ? <EtatHausse d={declarations.derniere.get(`p:${item.id}`)} h={hausses.delaiHeures} onRefus={setRefusOuvert} /> : null} />
                      ))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
            {/* Les suppléments payants, leur prix touchable par le titulaire (décision 2 de maquettes/carte-hausses). */}
            <SupplementsCarte restaurant={restaurant} onPrix={titulaire ? (o) => setFeuille({ option: o }) : null}
              derniere={declarations.derniere} h={hausses.delaiHeures} onRefus={setRefusOuvert} />
            {/* Le plus court chemin : écrire ce qu'on veut changer, l'équipe Fairride s'en charge (fondateur, 2026-10-01). Depuis
                le 2026-11-08, pour ce que le commerce ne fait pas lui-même : un supplément à ajouter, des options, un menu. */}
            <div className="ec-demande"><DemandeModifCarte restoId={restoId} lime={false} /></div>
          </>
        )}
        {photo.input}
        {feuille && <FeuillePlat restoId={restoId} token={token} restaurant={restaurant} regle={regle} plat={feuille.plat || null} option={feuille.option || null}
          onFermer={() => setFeuille(null)} onFait={toutRecharger} />}
        {textes && <FeuilleTextes restoId={restoId} token={token} restaurant={restaurant} plat={textes} onFermer={() => setTextes(null)} onFait={toutRecharger}
          onRetirer={setARetirer}
          onPrixSupplement={(s) => {
            const n = menu.filter((m) => (m.optionGroups || []).some((g) => g.id === s.groupe?.id)).length;
            setTextes(null); setFeuille({ option: { ...s, nbPlats: n } });
          }} />}
        {refusOuvert && <FenetreRefus d={refusOuvert} restoId={restoId} token={token} badge={!!restaurant.prixComptoir} onFait={toutRecharger} onFermer={() => setRefusOuvert(null)} />}
        {rafale && <RafalePhotos plats={sansPhoto} photo={photo} onFermer={() => setRafale(false)} />}
        <ConfirmDialog open={!!aRetirer} title={aRetirer ? t('ecranCommerce.retirerTitre', { name: aRetirer.name }) : ''} message={t('ecranCommerce.retirerTexte')}
          confirmLabel={t('menuItem.markUnavailable')} danger onCancel={() => setARetirer(null)}
          onConfirm={() => { const p = aRetirer; setARetirer(null); onWithdraw(p.id, true).catch(() => { /* message déjà affiché */ }); }} />

        {/* Ce qui suit se signe ou se règle soi-même (engagements, mentions, hausse, TVA) : plus « Aller plus loin », qui le
            faisait passer pour du facultatif (audit du 19/10, shop-16). */}
        <p className="ec-feuille-titre">{t('ecranCommerce.reglagesTitre')}</p>
        {/* Carte signée, allergènes, vendeur professionnel (backlog de conformité A1, A2, A8). */}
        <ConformiteCarte restoId={restoId} rafraichir={restaurant} onChange={() => loadDashboard(restoId)} versEngagements="/dashboard/engagements" />
        {/* Halal, végétarien, vegan, sans gluten, bio : déclarés par le commerce lui-même, malgré le verrou de la carte. De
            retour pour le commerce le 2026-10-27 (MENTIONS_COMMERCE, dietary.js) ; les clients ne les voient pas encore. */}
        {MENTIONS_COMMERCE && <MentionsAlimentaires restaurant={restaurant} restoId={restoId} token={token} onChange={() => loadDashboard(restoId)} />}
        <TvaCarte restoId={restoId} token={token} menu={menu} toast={toast} onChange={() => loadDashboard(restoId)} />
      </FeuilleCommerce>
    </div>
  );
}

// Un plat : photo, nom, état du jour, et l'interrupteur « En vente » / « Rupture aujourd'hui ».
/* DEUX GESTES QUI SE RESSEMBLAIENT (fondateur, 2026-10-27, S7 de maquettes/audit-ecrans) : sous chaque plat, l'interrupteur (rupture
 * pour aujourd'hui) et le lien « Retirer de la carte » (jusqu'à nouvel ordre), côte à côte, faciles à confondre en plein service.
 * L'interrupteur porte maintenant son mot ; retirer un plat se fait en le touchant, dans une fenêtre qui explique la différence
 * (ConfirmDialog). Un plat retiré garde son « Remettre » sous le nom. */
/* L'INTERRUPTEUR ET « RETIRER » NE SE VERROUILLENT PLUS (2026-10-23, app lente : la ligne basculait, puis restait bloquée
 * jusqu'à la fin du rechargement complet de la fiche). Le plat lui-même change dans la fiche gardée au toucher (MenuPage.jsx,
 * changerPlatEnStock) et revient si le serveur refuse ; un second toucher pendant l'envoi est permis, le dernier gagne
 * (actionOptimiste.js). Plus d'état « visé » à part : la ligne lit toujours le plat. */
/* LE CARRÉ « + PHOTO » ET LE PRIX TOUCHABLE (2026-10-29, AjoutPlat.jsx). Un plat sans photo à lui (imageUrl vide : l'image de
 * section ne compte pas) montre un carré en pointillés à la place de l'icône ; le toucher ouvre l'appareil photo ou la
 * photothèque. Le prix, sous le nom, ouvre la feuille « Nouveau prix ». `onPhoto` / `onPrix` absents : console en lecture. */
/* LE NOM TOUCHÉ OUVRE « CHANGER CE PLAT » (Owen, 2026-11-08, `onTextes`, titulaire seul) : il ouvrait « Retirer de la carte »,
 * qui est maintenant au bas de cette feuille. Un membre de l'équipe du commerce garde le geste d'avant. `etatHausse` : la
 * ligne « Photo envoyée… » sous le prix (HaussesCommerce.jsx › EtatHausse). */
function LignePlat({ item, sections, t, onStock, onWithdraw, onDemanderRetrait, onPhoto, photoEnvoi, onPrix, onTextes, etatHausse }) {
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
  const retirable = !item.withdrawn && item.available !== false;
  const ouvrir = onTextes && !item.withdrawn ? () => onTextes(item) : retirable ? () => onDemanderRetrait(item) : undefined;
  return (
    <div className={`ec-plat${rupture ? ' ec-plat--rupture' : ''}${item.withdrawn || indisponible ? ' ec-plat--retire' : ''}`}>
      {onPhoto && !item.imageUrl && !item.withdrawn
        ? (
          <button type="button" className="ec-plat-photo ec-plat-photo--vide" disabled={photoEnvoi} onClick={() => onPhoto(item)} aria-label={t('carteAjout.photoPour', { name: item.name })}>
            {photoEnvoi ? '…' : t('carteAjout.photoCarre')}
          </button>
        )
        : image
        ? <img loading="lazy" decoding="async" {...imgProps(image, 58, '58px')} alt="" className="ec-plat-photo" onClick={ouvrir} />
        : <span className="ec-plat-photo" aria-hidden="true" onClick={ouvrir}><Icone nom={categoryEmoji(item.category)} taille={22} /></span>}
      <span className="ec-plat-texte">
        {ouvrir
          ? <button type="button" className="ec-plat-nom" onClick={ouvrir} title={onTextes ? t('hausses.toucherNom') : t('menuItem.withdrawHelp')}>{item.name}</button>
          : <b>{item.name}</b>}
        {item.activePromo && <span className="ec-plat-promo"><Icone nom="etiquette" taille={12} className="icone-texte" />{' '}{item.activePromo.label}</span>}
        {onPrix && !item.withdrawn && !rupture && !indisponible
          ? (
            <small key={etat} className="ec-plat-etat fondu">
              <button type="button" className="ec-plat-prix" onClick={() => onPrix(item)} aria-label={t('carteAjout.changerPrix', { name: item.name })}>
                {euros(item.price)}<Icone nom="crayon" taille={12} />
              </button>
              {` · ${t('ecranCommerce.enVente')}`}
            </small>
          )
          : <small key={etat} className="ec-plat-etat fondu">{etat}</small>}
        {!item.withdrawn && etatHausse}
        {item.withdrawn && (
          <button type="button" className="ec-lien" onClick={retirer} title={t('menuItem.withdrawBackHelp')}>
            {`↩︎ ${t('menuItem.withdrawBack')}`}
          </button>
        )}
      </span>
      {interrupteur && (
        <span className="ec-interrupteur-bloc">
          <button type="button" role="switch" aria-checked={enVente} className={`ec-interrupteur${enVente ? ' on' : ''}`}
            aria-label={`${t('ecranCommerce.enVenteAujourdhui')} : ${item.name}`} title={enVente ? t('menuItem.stockOutHelp') : t('menuItem.stockBackHelp')}
            onClick={basculer} />
          <small className="ec-interrupteur-mot" aria-hidden="true">{t(enVente ? 'ecranCommerce.interrupteurEnVente' : 'ecranCommerce.interrupteurRupture')}</small>
        </span>
      )}
    </div>
  );
}
