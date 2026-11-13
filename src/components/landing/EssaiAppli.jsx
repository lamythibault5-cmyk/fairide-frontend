import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSiteLarge } from '../../hooks/useSiteLarge';
import { api } from '../../api';
import { CHEMIN_LISTE } from '../../resumeCarte';
import { cheminFiche } from '../../adresseFiche';
import { lienStore } from '../../storesAppli';
import { NOM_CADRE_APERCU, messageDeLApercu } from '../../apercuSite';
import { cheminLocalise } from '../../i18n/routing';
import { imgProps, cacherImageCassee } from '../../images';
import { restaurantTypeLabel } from '../../menuCategories';
import BelgianMark from '../BelgianMark';
import AvecMarque from '../AvecMarque';
import Icone from '../Icone';
import PrixComptoir from '../PrixComptoir';
import CertifiedBadge from '../CertifiedBadge';
import Modale from '../Modale';

/* L'APPLI SUR L'ACCUEIL DU SITE (Owen, 2026-11-12, version A de maquettes/site-appli-essai et ses réponses).
 *
 * L'accueil paraissait vide : il ne montrait que les commerces qui vendent déjà (8 au plus, /restaurants/landing), en deux
 * sections qui répétaient les mêmes (« Déjà sur Fairride » et « Les commerces partenaires »), sans qu'aucune carte ne se
 * touche, quand l'appli en montre 29. Les deux sections, « L'alternative » et la bande « L'appli fairride » laissent la place
 * à un seul bloc :
 *   - à gauche, le minimum : le vélo belge, « Fairride, l'alternative bruxelloise à Uber Eats et Deliveroo » (le titre que
 *     les gens cherchent sur Google, voix.md, « fairride » en mot-logo), « Fini les prix gonflés. » et « Cherche le badge
 *     Prix du comptoir » ; sur ordinateur, un QR code pour installer l'appli (même adresse que les QR des flyers :
 *     /restaurants, où l'appli s'ouvre si elle est installée, storesAppli.js) ;
 *   - à droite, un faux téléphone : la VRAIE page des commerces de l'appli dans un cadre (apercuSite.js). Le doigt ou la
 *     molette sur le téléphone fait défiler l'appli, jamais la page (le défilement ne fuit pas du cadre, styles.css) ; à côté,
 *     on descend la page. Sur téléphone, il fait ~70 % de la largeur : les bords restent libres pour descendre la page, et
 *     les boutons des stores sont juste dessous.
 * Toucher un restaurant (ou tout autre lien du cadre) ouvre ici une fenêtre, jamais la carte du restaurant dans le cadre :
 * sur téléphone l'appli d'abord (les deux stores) avec « Continuer sur le site » ; sur ordinateur le compte d'abord, avec le
 * QR code. Créer son compte mène à la vraie inscription du site, qui ramène ensuite ICI (« /?essai », Home.jsx et
 * Layout.jsx), à la hauteur du faux téléphone (Owen, remarque 8). Déjà connecté : « Voir sa carte » ouvre sa fiche sur le site.
 * Le nombre de restaurants n'est jamais écrit (Owen, 2026-11-12). */

// Le téléphone de référence de l'appli (celui des captures et de verifier-appli.mjs), réduit pour tenir dans sa colonne.
const LARGEUR_APPLI = 390;
const HAUTEUR_APPLI = 844;
const ECHELLE_MAX = 0.92;
const LANGUES_BADGES = ['fr', 'nl', 'en'];

function BadgesStores({ t, language }) {
  const l = LANGUES_BADGES.includes(language) ? language : 'fr';
  return (
    <div className="sa-essai-stores">
      <a className="sa-badge" href={lienStore('ios', 'apercu')} target="_blank" rel="noopener noreferrer">
        <img src={`/badges/app-store-${l}.svg`} alt={t('landing.appBadgeIos')} height="44" loading="lazy" decoding="async" />
      </a>
      <a className="sa-badge" href={lienStore('android', 'apercu')} target="_blank" rel="noopener noreferrer">
        <img src={`/badges/google-play-${l}.png`} alt={t('landing.appBadgeAndroid')} height="44" loading="lazy" decoding="async" />
      </a>
    </div>
  );
}

function QrAppli({ t, legende }) {
  return (
    <div className="sa-essai-qr">
      {/* Image fixe (public/badges/qr-appli.svg, https://fairride.be/restaurants) : pas de bibliothèque pour une seule adresse. */}
      <img src="/badges/qr-appli.svg" alt="" width="112" height="112" loading="lazy" decoding="async" />
      <span>{legende || t('landing.essaiQr')}</span>
    </div>
  );
}

// La fenêtre ouverte par un toucher dans le faux téléphone. `chemin` : la page que le cadre aurait ouverte.
function FenetreEssai({ chemin, onFermer }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const large = useSiteLarge(900);
  const [commerce, setCommerce] = useState(null);
  useEffect(() => {
    if (!/^\/restaurants\/[^/]+$/.test(chemin || '')) return undefined;
    let fini = false;
    // La même liste que celle du cadre (déjà dans le cache du navigateur) : on y retrouve le commerce par son adresse.
    api(CHEMIN_LISTE).then((liste) => {
      if (fini || !Array.isArray(liste)) return;
      setCommerce(liste.find((r) => cheminFiche(r) === chemin || `/restaurants/${r.id}` === chemin) || null);
    }).catch(() => {});
    return () => { fini = true; };
  }, [chemin]);

  // Après l'inscription (ou la connexion), retour sur l'accueil, à la hauteur du faux téléphone.
  const versCompte = (inscription) => navigate(inscription ? '/login?audience=client' : '/login', { state: { from: '/?essai' } });
  const appliDabord = !user && !large;
  const sous = commerce && [[commerce.cuisine, ...(commerce.extraCuisines || [])].filter(Boolean).slice(0, 1).map((c) => restaurantTypeLabel(c, t) || c).join(''), commerce.commune].filter(Boolean).join(' · ');
  const titre = user || appliDabord
    ? t(commerce ? 'landing.essaiAppliTitre' : 'landing.essaiAppliTitreSans')
    : t(commerce ? 'landing.essaiCompteTitre' : 'landing.essaiCompteTitreSans');

  return (
    <Modale ariaLabel={titre} onFermer={onFermer} classeBoite="sa-essai-fenetre" largeur={460}>
      <button type="button" className="sa-essai-fermer" onClick={onFermer} aria-label={t('landing.essaiFermer')}><Icone nom="croix" taille={16} /></button>
      {commerce && (
        <div className="sa-essai-commerce">
          {commerce.coverImageUrl && <img {...imgProps(commerce.coverImageUrl, 160)} alt="" onError={cacherImageCassee} />}
          <div>
            <b>{commerce.name}{commerce.certified && <CertifiedBadge size={16} />}</b>
            {sous && <span>{sous}</span>}
          </div>
        </div>
      )}
      <h3>{titre}</h3>
      {user ? (
        <>
          <p>{t('landing.essaiAppliSous')}</p>
          {commerce && <button type="button" className="btn-gold sa-essai-principal" onClick={() => navigate(cheminFiche(commerce))}>{t('landing.essaiVoirCarte')}</button>}
          {large ? <QrAppli t={t} legende={t('landing.essaiOuQr')} /> : <BadgesStores t={t} language={language} />}
        </>
      ) : appliDabord ? (
        <>
          <p>{t('landing.essaiAppliSous')}</p>
          <BadgesStores t={t} language={language} />
          <button type="button" className="sa-essai-lien" onClick={() => versCompte(true)}>{t('landing.essaiContinuerSite')}</button>
        </>
      ) : (
        <>
          <p>{t('landing.essaiCompteSous')}</p>
          <button type="button" className="btn-gold sa-essai-principal" onClick={() => versCompte(true)}>{t('landing.essaiCreer')}</button>
          <button type="button" className="sa-essai-lien" onClick={() => versCompte(false)}>{t('landing.essaiDejaCompte')}</button>
          {large ? <QrAppli t={t} legende={t('landing.essaiOuQr')} /> : <BadgesStores t={t} language={language} />}
        </>
      )}
    </Modale>
  );
}

export default function EssaiAppli() {
  const { t, language } = useLanguage();
  const large = useSiteLarge(900);
  const { search } = useLocation();
  const section = useRef(null);
  const colonne = useRef(null);
  const [echelle, setEchelle] = useState(0.68);
  const [fenetre, setFenetre] = useState(null);

  // Le téléphone garde les proportions de l'appli et prend la largeur que la CSS donne à sa colonne.
  useLayoutEffect(() => {
    const el = colonne.current;
    if (!el) return undefined;
    const mesurer = () => setEchelle(Math.min(ECHELLE_MAX, Math.max(0.5, (el.clientWidth - 18) / LARGEUR_APPLI)));
    mesurer();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ce que le cadre a voulu ouvrir (GardeApercu.jsx) : la fenêtre, ici.
  // Pendant qu'on fait défiler le téléphone (message « actif » de GardeApercu.jsx), les animations du site s'arrêtent : elles
  // partagent le fil principal avec le cadre. Elles repartent 1,5 s après le dernier geste. Une classe sur <html>, pas un état
  // React : rien à redessiner de ce côté.
  useEffect(() => {
    let reprise = null;
    const recevoir = (e) => {
      if (!messageDeLApercu(e)) return;
      if (e.data.type === 'ouvrir') setFenetre({ chemin: e.data.chemin });
      if (e.data.type === 'actif') {
        document.documentElement.classList.add('sa-essai-actif');
        clearTimeout(reprise);
        reprise = setTimeout(() => document.documentElement.classList.remove('sa-essai-actif'), 1500);
      }
    };
    window.addEventListener('message', recevoir);
    return () => { window.removeEventListener('message', recevoir); clearTimeout(reprise); document.documentElement.classList.remove('sa-essai-actif'); };
  }, []);

  // Revenu de l'inscription (« /?essai ») : on arrive sur le faux téléphone, la chose à faire (design.md, règle 5).
  useEffect(() => {
    if (new URLSearchParams(search).has('essai')) section.current?.scrollIntoView({ block: 'center' });
  }, [search]);

  return (
    <section className="sa-essai" id="essai" ref={section}>
      <div className="sa-essai-texte">
        <BelgianMark width={large ? 84 : 64} title={t('landing.proudlyBelgian')} />
        <h2><AvecMarque>{t('landing.altTitre')}</AvecMarque></h2>
        <ul className="sa-essai-raisons">
          <li><Icone nom="euro" taille={24} />{t('landing.essaiPrix')}</li>
          <li><Icone nom="etiquette" taille={24} />{t('landing.essaiBadge')} <PrixComptoir /></li>
        </ul>
        {large && <QrAppli t={t} />}
      </div>
      <div className="sa-essai-tel" ref={colonne}>
        <div className="sa-essai-cadre" style={{ width: LARGEUR_APPLI * echelle + 18, height: HAUTEUR_APPLI * echelle + 18, borderRadius: 50 * echelle + 9 }}>
          {/* Le cadre s'ouvre dans la langue de la page (/en/restaurants, /nl/restaurants : i18n/routing.js) et se recharge
              quand elle change. Avec « /restaurants » tout court, un visiteur arrivé par /en sans préférence enregistrée avait
              un téléphone en français. */}
          <iframe key={language} name={NOM_CADRE_APERCU} src={cheminLocalise('/restaurants', language)} title={t('landing.essaiCadre')} loading="lazy"
            width={LARGEUR_APPLI} height={HAUTEUR_APPLI} style={{ transform: `scale(${echelle})`, borderRadius: 50 }} />
        </div>
        {!large && <BadgesStores t={t} language={language} />}
      </div>
      {fenetre && <FenetreEssai chemin={fenetre.chemin} onFermer={() => setFenetre(null)} />}
    </section>
  );
}
