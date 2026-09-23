import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

// Le bloc « carte » des pages Carte du restaurateur et du livreur : la carte dans la page, et un bouton pour
// l'agrandir en plein écran avec le temps d'arrivée dans la barre du haut. Chaque page fournit SA carte via
// `rendreCarte({ height, onEta })` — suivi d'une livraison pour le restaurateur, guidage pour le livreur.
//
// Remplace TrackingWithGames (allègement, 23/09/2026) : les mini-jeux posés à côté de la carte — et leur page
// /jeux — ont été retirés. Environ 4 000 lignes de code et de styles qui n'apportaient rien à un client, un
// commerce ou un livreur. La carte, elle, n'a pas changé.
export default function CarteSuivi({ role = 'restaurant', rendreCarte, legende, etaSansEstimation, hauteur = 420 }) {
  const { t } = useLanguage();
  const [pleinEcran, setPleinEcran] = useState(false);
  return (
    <>
      <div className="tracking-with-game jeux-masques carte-seule" style={{ margin: '10px 0' }}>
        <div className="tracking-map-col">
          {rendreCarte({ height: Math.max(hauteur, 460) })}
          {legende && <div className="small" style={{ marginTop: 4, textAlign: 'center' }}>{legende}</div>}
        </div>
      </div>
      <div className="tracking-actions">
        <button type="button" className="tracking-expand-btn" onClick={() => setPleinEcran(true)}>{t('tracking.enlargeMap')}</button>
      </div>
      {pleinEcran && <CarteSuiviPleinEcran role={role} rendreCarte={rendreCarte} legende={legende} etaSansEstimation={etaSansEstimation} onClose={() => setPleinEcran(false)} />}
    </>
  );
}

function CarteSuiviPleinEcran({ role, rendreCarte, legende, etaSansEstimation, onClose }) {
  const { t } = useLanguage();
  const [eta, setEta] = useState(null);
  const [hauteurEcran, setHauteurEcran] = useState(() => window.innerHeight);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Vue agrandie ouverte : pas de panier flottant par-dessus la carte (styles.css).
    document.documentElement.classList.add('tracking-plein-actif');
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    const onResize = () => setHauteurEcran(window.innerHeight);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.classList.remove('tracking-plein-actif');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);

  const texteEta = eta
    ? (role === 'driver' ? t('tracking.etaDriver', { min: eta.minutes }) : t('tracking.etaClient', { min: eta.minutes }))
    : (etaSansEstimation || t('tracking.courierOnWay'));

  return createPortal(
    <div className="tracking-fullscreen-overlay" role="dialog" aria-modal="true" aria-label={t('tracking.fullscreenTitleMap')}>
      <div className="tracking-fullscreen-bar">
        <span className="tracking-fullscreen-eta" aria-live="polite">{texteEta}</span>
        <button type="button" className="tracking-fullscreen-close" onClick={onClose}>✕ <span>{t('tracking.close')}</span></button>
      </div>
      <div className="tracking-fullscreen-split jeux-masques">
        <div className="tracking-fullscreen-map">
          {rendreCarte({ height: Math.max(320, hauteurEcran - 170), onEta: setEta })}
          {legende && <div className="small tracking-fullscreen-map-caption">{legende}</div>}
        </div>
      </div>
      <p className="tracking-fullscreen-aide small">{t('tracking.fullscreenHelpMap')}</p>
    </div>,
    document.body
  );
}
