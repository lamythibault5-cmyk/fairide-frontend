import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GameSwitcher from './GameSwitcher';
import { useLanguage } from '../context/LanguageContext';

// Le bloc « carte + mini-jeux » commun aux trois pages Carte (client, restaurateur, livreur) : la carte
// dans sa colonne, les jeux à côté, un bouton pour agrandir, et la vue plein écran avec « Masquer la
// carte ». Chaque page fournit SA carte via `rendreCarte({ height, onEta })` — suivi d'une livraison
// pour le client et le restaurateur, guidage pour le livreur — et le bloc s'occupe du reste.
//
// Pourquoi des jeux sur une carte : pour que la personne reste devant la carte sans attendre pour rien,
// et voie le livreur arriver au lieu de devoir penser à ressortir son téléphone. Le bouton 💡 du
// sélecteur de jeux l'explique en une phrase, adaptée au rôle (voir POURQUOI).

const POURQUOI = { client: 'whyClient', restaurant: 'whyRestaurant', driver: 'whyDriver' };

// En dessous de 560px, .tracking-with-game empile la carte au-dessus du jeu (styles.css) : le jeu n'est
// plus coincé dans une colonne de 140px, on lui donne alors un terrain plus large, plus agréable au pouce.
const EMPILE_BREAKPOINT = 560;

function useLargeurFenetre() {
  const [largeur, setLargeur] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setLargeur(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return largeur;
}

// Les jeux se masquent (choix mémorisé) : la carte prend alors toute la largeur et gagne en hauteur — pour
// qui veut simplement suivre sa livraison, en grand et sans distraction. Vaut pour les trois rôles.
const CLE_JEUX_MASQUES = 'fairide_games_hidden';
function lireJeuxMasques() { try { return localStorage.getItem(CLE_JEUX_MASQUES) === '1'; } catch { return false; } }

export default function TrackingWithGames({ role = 'client', rendreCarte, legende, etaSansEstimation, hauteur = 300 }) {
  const { t } = useLanguage();
  const [pleinEcran, setPleinEcran] = useState(false);
  const [jeuxMasques, setJeuxMasques] = useState(lireJeuxMasques);
  const empile = useLargeurFenetre() <= EMPILE_BREAKPOINT;
  function basculerJeux() {
    setJeuxMasques((m) => { try { localStorage.setItem(CLE_JEUX_MASQUES, m ? '0' : '1'); } catch { /* sans stockage */ } return !m; });
  }
  const hauteurCarte = jeuxMasques ? Math.max(hauteur, 460) : hauteur;
  return (
    <>
      <div className={`tracking-with-game${jeuxMasques ? ' jeux-masques' : ''}`} style={{ margin: '10px 0' }}>
        <div className="tracking-map-col">
          {rendreCarte({ height: hauteurCarte })}
          {legende && <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>{legende}</div>}
        </div>
        {!jeuxMasques && <GameSwitcher pourquoi={t(`tracking.${POURQUOI[role]}`)} width={empile ? 240 : 140} height={empile ? 300 : 280} />}
      </div>
      <div className="tracking-actions">
        <button type="button" className="tracking-expand-btn" onClick={basculerJeux} aria-pressed={jeuxMasques}>{jeuxMasques ? t('tracking.showGames') : t('tracking.hideGames')}</button>
        <button type="button" className="tracking-expand-btn" onClick={() => setPleinEcran(true)}>{jeuxMasques ? t('tracking.enlargeMap') : t('tracking.enlarge')}</button>
      </div>
      {pleinEcran && (
        <TrackingFullscreen role={role} rendreCarte={rendreCarte} legende={legende} etaSansEstimation={etaSansEstimation} jeuxMasques={jeuxMasques} onBasculerJeux={basculerJeux} onClose={() => setPleinEcran(false)} />
      )}
    </>
  );
}

// Vue plein écran : la carte occupe une moitié de l'écran, le sélecteur de jeu et le jeu en cours
// l'autre moitié — empilés sous 800px (voir styles.css, .tracking-fullscreen-split). « Masquer la
// carte » donne tout l'écran au jeu ; la carte reste montée (juste cachée) pour continuer à recevoir
// les positions et recalculer le temps d'arrivée, qui s'affiche alors dans la barre du haut.
const NARROW_BREAKPOINT = 800;

function useFullscreenSizes() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    function onResize() { setSize({ width: window.innerWidth, height: window.innerHeight }); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const narrow = size.width <= NARROW_BREAKPOINT;
  // Empilé (téléphone) : la carte prend ~30 % de la hauteur, le jeu tout le reste (il remplit son bloc,
  // voir GameFrame `fill`). Côte à côte : la carte prend la hauteur disponible sous la barre d'outils,
  // moins la légende et la fraîcheur en dessous.
  return {
    narrow,
    hauteurEcran: size.height,
    mapHeight: narrow
      ? Math.round(Math.max(160, Math.min(280, size.height * 0.28)))
      : Math.round(Math.max(320, Math.min(760, size.height - 210)))
  };
}

function TrackingFullscreen({ role, rendreCarte, legende, etaSansEstimation, jeuxMasques = false, onBasculerJeux, onClose }) {
  const { t } = useLanguage();
  const { narrow, mapHeight, hauteurEcran } = useFullscreenSizes();
  // Grand écran : carte et jeu côte à côte, « Masquer la carte » donne tout l'écran au jeu. Téléphone : un
  // seul bloc à la fois, choisi par deux gros onglets (la carte empilée au-dessus d'un jeu minuscule ne
  // servait ni l'un ni l'autre) ; la carte reste montée, juste cachée, pour continuer à recevoir les
  // positions et le temps d'arrivée, affiché en permanence dans la barre.
  const [carteMasquee, setCarteMasquee] = useState(false);
  const [onglet, setOnglet] = useState('jeux'); // téléphone : 'carte' | 'jeux'
  const [eta, setEta] = useState(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Jeux masqués : la carte seule, en grand, quelle que soit la taille d'écran.
  const carteVisible = jeuxMasques ? true : (narrow ? onglet === 'carte' : !carteMasquee);
  const jeuxVisibles = !jeuxMasques && (narrow ? onglet === 'jeux' : true);
  const hauteurCarteFs = jeuxMasques ? Math.max(320, hauteurEcran - 170) : (narrow ? Math.max(mapHeight, 360) : mapHeight);
  const texteEta = eta
    ? (role === 'driver' ? t('tracking.etaDriver', { min: eta.minutes }) : t('tracking.etaClient', { min: eta.minutes }))
    : (etaSansEstimation || t('tracking.courierOnWay'));

  return createPortal(
    <div className="tracking-fullscreen-overlay" role="dialog" aria-modal="true" aria-label={t('tracking.fullscreenTitle')}>
      <div className="tracking-fullscreen-bar">
        {jeuxMasques ? null : narrow ? (
          <div className="tracking-fullscreen-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={onglet === 'carte'} className={onglet === 'carte' ? 'active' : ''} onClick={() => setOnglet('carte')}>🗺️ {t('tracking.tabMap')}</button>
            <button type="button" role="tab" aria-selected={onglet === 'jeux'} className={onglet === 'jeux' ? 'active' : ''} onClick={() => setOnglet('jeux')}>🎮 {t('tracking.tabGames')}</button>
          </div>
        ) : (
          <button type="button" className="tracking-fullscreen-toggle" onClick={() => setCarteMasquee((m) => !m)} aria-pressed={carteMasquee}>
            {carteMasquee ? t('tracking.showMap') : t('tracking.hideMap')}
          </button>
        )}
        {onBasculerJeux && (
          <button type="button" className="tracking-fullscreen-toggle" onClick={onBasculerJeux} aria-pressed={jeuxMasques}>{jeuxMasques ? t('tracking.showGames') : t('tracking.hideGames')}</button>
        )}
        <span className="tracking-fullscreen-eta" aria-live="polite">{texteEta}</span>
        <button type="button" className="tracking-fullscreen-close" onClick={onClose}>✕ <span>{t('tracking.close')}</span></button>
      </div>
      <div className={`tracking-fullscreen-split${carteVisible ? '' : ' carte-masquee'}${jeuxMasques ? ' jeux-masques' : ''}`}>
        <div className="tracking-fullscreen-map" hidden={!carteVisible}>
          {rendreCarte({ height: hauteurCarteFs, onEta: setEta })}
          {legende && <div className="small tracking-fullscreen-map-caption">{legende}</div>}
        </div>
        <div className="tracking-fullscreen-game" hidden={!jeuxVisibles}>
          <GameSwitcher fill large pourquoi={t(`tracking.${POURQUOI[role]}`)} />
        </div>
      </div>
      <p className="tracking-fullscreen-aide small">{t('tracking.fullscreenHelp')}</p>
    </div>,
    document.body
  );
}
