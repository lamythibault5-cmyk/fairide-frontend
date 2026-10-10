import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';

// Interrupteur de service du commerce (Commandes). Il ne savait que « ouvert / fermé » : un commerce débordé fermait et
// oubliait de rouvrir. Plan de test RES-9 (2 octobre 2026) : toucher l'interrupteur propose une PAUSE de 15, 30 ou
// 60 minutes, qui se lève toute seule (PUT /restaurants/:id/pause, voir pauseCommerce.js côté serveur), ou la
// fermeture jusqu'à réouverture manuelle comme avant. Les commandes en cours continuent dans tous les cas.
const DUREES = [15, 30, 60];

export default function InterrupteurService({ restaurant, restoId, token, toast, loadDashboard }) {
  const { t } = useLanguage();
  const [choix, setChoix] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  // L'heure de reprise passe toute seule : on relit l'horloge chaque minute pour rebasculer l'affichage.
  useEffect(() => { const id = setInterval(() => setMaintenant(Date.now()), 30000); return () => clearInterval(id); }, []);
  const enPause = restaurant.pausedUntil && restaurant.pausedUntil > maintenant;
  const ouvert = restaurant.open && !enPause;
  const reprise = enPause ? new Date(restaurant.pausedUntil).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
  // Stoppé pour la journée (fondateur, 2026-10-10) : la reprise tombe un autre jour — rouvre tout seul demain à 6 h.
  const stoppeJour = enPause && new Date(restaurant.pausedUntil).toDateString() !== new Date(maintenant).toDateString();

  async function agir(appel) {
    setEnCours(true);
    try { await appel(); await loadDashboard(restoId); setChoix(false); } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }
  const pause = (minutes) => agir(() => api(`/restaurants/${restoId}/pause`, { method: 'PUT', token, body: { minutes } }));
  const stopperJour = (closed) => agir(() => api(`/restaurants/${restoId}/close-today`, { method: 'PUT', token, body: { closed } }));
  const ouvrir = (open) => agir(() => api(`/restaurants/${restoId}`, { method: 'PATCH', token, body: { open } }));

  function toucher() {
    if (ouvert) setChoix(true);
    else if (stoppeJour) stopperJour(false);
    else if (enPause) pause(0);
    else ouvrir(true);
  }

  return (
    <>
      <button type="button" className={`service-switch${ouvert ? '' : ' off'}`} aria-pressed={!!ouvert} disabled={enCours} onClick={toucher}>
        <span className="service-switch-dot" aria-hidden="true" />
        <span className="service-switch-text">
          <b>{ouvert ? t('ordersResto.openTitle') : stoppeJour ? t('ordersResto.stoppedTodayTitle') : enPause ? t('ordersResto.pauseUntil', { time: reprise }) : t('ordersResto.pausedTitle')}</b>
          <span>{enCours ? '…' : ouvert ? t('ordersResto.openSub') : stoppeJour ? t('ordersResto.stoppedTodaySub', { time: reprise }) : enPause ? t('ordersResto.pauseResumeNow') : t('ordersResto.pausedSub')}</span>
        </span>
      </button>
      {choix && (
        <SousEcran titre={t('ordersResto.pauseTitle')} onFermer={() => setChoix(false)}>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('ordersResto.pauseHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {DUREES.map((m) => (
              <button key={m} type="button" className="btn-teal" disabled={enCours} style={{ minHeight: 48, flex: '1 1 30%' }} onClick={() => pause(m)}>{t('ordersResto.pauseMinutes', { n: m })}</button>
            ))}
          </div>
          {/* Plus rien à préparer aujourd'hui : stoppé jusqu'au lendemain 6 h, rouvre tout seul (fondateur, 2026-10-10). */}
          <div className="paiement-encart" style={{ marginBottom: 12 }}>
            <button type="button" className="btn-gold" disabled={enCours} style={{ width: '100%', minHeight: 48 }} onClick={() => stopperJour(true)}>⛔ {t('ordersResto.stopTodayBtn')}</button>
            <p className="small" style={{ margin: '8px 0 0' }}>{t('ordersResto.stopTodayHelp')}</p>
          </div>
          <button type="button" className="btn-outline" disabled={enCours} style={{ width: '100%', minHeight: 48 }} onClick={() => ouvrir(false)}>{t('ordersResto.closeUntilReopen')}</button>
        </SousEcran>
      )}
    </>
  );
}
