import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StarsDisplay } from '../../components/Stars';
import { ORDER_STAGES, loadStageColors, saveStageColors, resetStageColors } from '../../orderStatus';

// Regroupe ce qui concerne le compte plutôt que l'activité du jour : statut d'abonnement (et ses
// actions), avis clients, et personnalisation des couleurs de commandes — auparavant éparpillé sur
// toutes les pages (bannière commune) et en haut de "Mes commandes", qui ne devait garder que les
// commandes elles-mêmes.
export default function SubscriptionPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, reviews, restoId, loadDashboard } = useOutletContext();

  const [now, setNow] = useState(() => new Date());
  const [subscribing, setSubscribing] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [pausingSub, setPausingSub] = useState(false);
  const [resumingSub, setResumingSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);

  const [stageColors, setStageColors] = useState(() => loadStageColors(restoId));
  const [colorSettingsOpen, setColorSettingsOpen] = useState(false);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => { setStageColors(loadStageColors(restoId)); }, [restoId]);

  function setStageColor(key, color) {
    setStageColors((prev) => {
      const next = { ...prev, [key]: color };
      saveStageColors(restoId, next);
      return next;
    });
  }

  function resetColors() {
    setStageColors(resetStageColors(restoId));
  }

  async function subscribeNow() {
    setSubscribing(true);
    try {
      const r = await api(`/restaurants/${restoId}/subscription/checkout`, { method: 'POST', token, body: { promoCode: promoCodeInput.trim() || undefined } });
      window.location.href = r.checkoutUrl;
    } catch (e) {
      toast(e.message);
      setSubscribing(false);
    }
  }

  async function pauseSubscription() {
    setPausingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/pause`, { method: 'POST', token });
      await loadDashboard(restoId);
      toast('Abonnement mis en pause — ton restaurant n\'est plus visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setPausingSub(false);
    }
  }

  async function resumeSubscription() {
    setResumingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/resume`, { method: 'POST', token });
      await loadDashboard(restoId);
      toast('Abonnement repris — ton restaurant est de nouveau visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setResumingSub(false);
    }
  }

  async function cancelSubscription() {
    setCancelingSub(true);
    try {
      await api(`/restaurants/${restoId}/subscription/cancel`, { method: 'POST', token });
      await loadDashboard(restoId);
      setConfirmCancelSub(false);
      toast('Abonnement résilié — ton restaurant n\'est plus visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setCancelingSub(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ border: `2px solid ${['active', 'trialing'].includes(restaurant.subscriptionStatus) ? 'var(--teal)' : 'var(--red)'}` }}>
        <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
          Aujourd'hui : {now.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} à {now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
        </p>

        {restaurant.subscriptionStatus === 'trialing' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>✅ Essai gratuit en cours</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              Ton restaurant est visible aux clients. Le premier mois est offert pour tout restaurant, dans tous les cas
              {restaurant.freeTrialMonths > 1 ? ` — et comme ton restaurant fait partie des premiers inscrits sur Fairide, tu profites en réalité de ${restaurant.freeTrialMonths} mois offerts au total` : ''}
              {restaurant.subscriptionCurrentPeriodEnd ? ` (premier prélèvement de 20€ le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}).` : '.'}
            </p>
          </>
        )}
        {restaurant.subscriptionStatus === 'active' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>✅ Abonnement actif</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              Ton restaurant est visible aux clients.
              {restaurant.subscriptionCurrentPeriodEnd ? ` Prochain prélèvement (20€) le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
            </p>
          </>
        )}
        {restaurant.subscriptionStatus === 'past_due' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⚠️ Paiement de l'abonnement échoué</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              Le dernier prélèvement de ton abonnement Fairide (20€/mois) a échoué. Ton restaurant n'est plus visible aux clients tant que ce n'est pas régularisé.
            </p>
          </>
        )}
        {restaurant.subscriptionStatus === 'paused' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⏸️ Abonnement en pause</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              Ton restaurant n'est plus visible aux clients et ne reçoit plus de commandes. Aucun prélèvement tant qu'il reste en pause.
            </p>
          </>
        )}
        {restaurant.subscriptionStatus === 'canceled' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>❌ Abonnement résilié</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>Ton restaurant n'est plus visible aux clients.</p>
          </>
        )}
        {restaurant.subscriptionStatus === 'inactive' && (
          <>
            <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🔒 Restaurant pas encore visible aux clients</h3>
            <p className="small" style={{ margin: '0 0 12px' }}>
              Un abonnement Fairide à 20€/mois est nécessaire pour apparaître dans les résultats et recevoir des commandes.
              Le premier mois est offert pour tout restaurant, dans tous les cas — et Fairide offre aussi 3 mois aux 50 premiers
              restaurants inscrits sur la plateforme, puis 2 mois aux 100 suivants.
              {restaurant.freeTrialMonths > 1
                ? ` Ton restaurant fait partie de ceux-là : tu profites de ${restaurant.freeTrialMonths} mois offerts au total.`
                : ''}
              {' '}Ton abonnement n'entre en vigueur qu'une fois ton compte validé par l'équipe Fairide — le temps de vérifier
              la conformité de ton commerce et que le contrat soit accepté par les deux parties. Tu ne seras débité qu'au mois suivant l'activation.
            </p>
          </>
        )}

        {['inactive', 'past_due', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.adminStatus !== 'approved' && (
          <p className="small" style={{ margin: '0 0 12px', fontStyle: 'italic', opacity: 0.75 }}>
            🔒 Disponible après validation de ton compte par l'équipe Fairide.
          </p>
        )}
        {['inactive', 'past_due', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.adminStatus === 'approved' && (
          <div>
            <div className="field" style={{ maxWidth: 260 }}>
              <label>Code promo (optionnel)</label>
              <input value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value)} placeholder="Un code reçu ? Ajoute-le ici" />
            </div>
            <button className="btn-gold" disabled={subscribing} onClick={subscribeNow}>
              {subscribing ? '...' : `S'abonner — 20€/mois (${restaurant.freeTrialMonths > 1 ? `${restaurant.freeTrialMonths} mois offerts` : '1er mois offert'})`}
            </button>
          </div>
        )}
        {['trialing', 'active', 'past_due'].includes(restaurant.subscriptionStatus) && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost" disabled={pausingSub} onClick={pauseSubscription}>{pausingSub ? '...' : '⏸️ Mettre en pause'}</button>
            {!confirmCancelSub && (
              <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>Résilier l'abonnement</button>
            )}
          </div>
        )}
        {restaurant.subscriptionStatus === 'paused' && (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-teal" disabled={resumingSub} onClick={resumeSubscription}>{resumingSub ? '...' : 'Reprendre l\'abonnement'}</button>
            {!confirmCancelSub && (
              <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>Résilier l'abonnement</button>
            )}
          </div>
        )}
        {confirmCancelSub && (
          <div style={{ marginTop: 10 }}>
            <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
              Es-tu sûr ? Ton restaurant disparaîtra immédiatement des résultats clients. Il faudra un nouvel abonnement pour redevenir visible.
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={cancelingSub} onClick={cancelSubscription}>
                {cancelingSub ? '...' : 'Oui, résilier'}
              </button>
              <button className="btn-ghost" onClick={() => setConfirmCancelSub(false)}>Annuler</button>
            </div>
          </div>
        )}
      </div>

      {reviews && reviews.reviews.length > 0 && (
        <div className="card">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Avis clients</h3>
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName}</b>
                <StarsDisplay value={r.foodRating} />
              </div>
              {r.foodComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.foodComment}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="card no-print">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>🎨 Couleurs des commandes</h3>
          <button type="button" className="btn-ghost" onClick={() => setColorSettingsOpen((v) => !v)}>
            {colorSettingsOpen ? 'Fermer' : 'Personnaliser'}
          </button>
        </div>
        {colorSettingsOpen && (
          <div style={{ marginTop: 10 }}>
            <p className="small" style={{ margin: '0 0 10px' }}>
              Chaque commande est colorée selon où elle en est — ajuste les couleurs à ta convenance, ça reste enregistré sur cet appareil.
            </p>
            {ORDER_STAGES.map((s) => (
              <div key={s.key} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <span className="small">{s.icon} {s.label}</span>
                <input
                  type="color"
                  value={stageColors[s.key]}
                  onChange={(e) => setStageColor(s.key, e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
            ))}
            <button type="button" className="btn-ghost" style={{ marginTop: 6 }} onClick={resetColors}>Réinitialiser les couleurs par défaut</button>
          </div>
        )}
      </div>
    </div>
  );
}
