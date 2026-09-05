import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GameSwitcher from './GameSwitcher';

// Le bloc « carte + mini-jeux » commun aux trois pages Carte (client, restaurateur, livreur) : la carte
// dans sa colonne, les jeux à côté, un bouton pour agrandir, et la vue plein écran avec « Masquer la
// carte ». Chaque page fournit SA carte via `rendreCarte({ height, onEta })` — suivi d'une livraison
// pour le client et le restaurateur, guidage pour le livreur — et le bloc s'occupe du reste.
//
// Pourquoi des jeux sur une carte : pour que la personne reste devant la carte sans attendre pour rien,
// et voie le livreur arriver au lieu de devoir penser à ressortir son téléphone. Le bouton 💡 du
// sélecteur de jeux l'explique en une phrase, adaptée au rôle (voir POURQUOI).

const POURQUOI = {
  client: 'Pour rester sur la carte et voir ton livreur arriver sans attendre pour rien — et sans oublier de regarder ton téléphone pour savoir s\'il arrive bientôt.',
  restaurant: 'Pour garder un œil sur la livraison sans rester planté devant la carte : tu vois le livreur avancer et son heure d\'arrivée chez le client, sans avoir à revenir vérifier.',
  driver: 'Pour patienter au restaurant pendant que la commande se prépare, sans quitter la carte ni rater le départ. Jamais en roulant, évidemment.'
};

export default function TrackingWithGames({ role = 'client', rendreCarte, legende, etaSansEstimation = '🛵 Livreur en route', hauteur = 300 }) {
  const [pleinEcran, setPleinEcran] = useState(false);
  return (
    <>
      <div className="tracking-with-game" style={{ margin: '10px 0' }}>
        <div className="tracking-map-col">
          {rendreCarte({ height: hauteur })}
          {legende && <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>{legende}</div>}
        </div>
        <GameSwitcher pourquoi={POURQUOI[role]} />
      </div>
      <button type="button" className="tracking-expand-btn" onClick={() => setPleinEcran(true)}>⛶ Agrandir la carte et les jeux</button>
      {pleinEcran && (
        <TrackingFullscreen role={role} rendreCarte={rendreCarte} legende={legende} etaSansEstimation={etaSansEstimation} onClose={() => setPleinEcran(false)} />
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
    mapHeight: narrow
      ? Math.round(Math.max(170, Math.min(280, size.height * 0.3)))
      : Math.round(Math.max(320, Math.min(760, size.height - 210)))
  };
}

function TrackingFullscreen({ role, rendreCarte, legende, etaSansEstimation, onClose }) {
  const [carteMasquee, setCarteMasquee] = useState(false);
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

  const { mapHeight } = useFullscreenSizes();

  return createPortal(
    <div className="tracking-fullscreen-overlay">
      <div className="tracking-fullscreen-bar">
        <button type="button" className="tracking-fullscreen-toggle" onClick={() => setCarteMasquee((m) => !m)} aria-pressed={carteMasquee}>
          {carteMasquee ? '🗺️ Afficher la carte' : '🙈 Masquer la carte'}
        </button>
        {carteMasquee && (
          <span className="tracking-fullscreen-eta" aria-live="polite">
            {eta ? `${role === 'driver' ? '🏁 Arrivée' : '🛵 Arrive'} dans ~${eta.minutes} min` : etaSansEstimation}
          </span>
        )}
        <button type="button" className="tracking-fullscreen-close" onClick={onClose} aria-label="Fermer">✕</button>
      </div>
      <div className={`tracking-fullscreen-split${carteMasquee ? ' carte-masquee' : ''}`}>
        <div className="tracking-fullscreen-map" hidden={carteMasquee}>
          {rendreCarte({ height: mapHeight, onEta: setEta })}
          {legende && <div className="small tracking-fullscreen-map-caption">{legende}</div>}
        </div>
        <div className="tracking-fullscreen-game">
          <GameSwitcher fill large pourquoi={POURQUOI[role]} />
        </div>
      </div>
    </div>,
    document.body
  );
}
