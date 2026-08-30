import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { DeliveryTiming, deliveryInstructionLabel, formatOrderItem } from '../../orderStatus';

// Cadence maximale d'envoi de la position au serveur (voir l'effet watchPosition plus bas) — reprend
// l'intervalle de l'ancien sondage, pour que le passage à watchPosition n'augmente pas le trafic.
const MIN_LOCATION_SEND_INTERVAL_MS = 12000;

function formatClock(date) {
  return date.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

export default function DriverDashboard() {
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const { setRightSlot } = useOutletContext();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [codeInputs, setCodeInputs] = useState({});
  const [sharingLocation, setSharingLocation] = useState(false);
  const [lastPositionAt, setLastPositionAt] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const activeIdsRef = useRef([]);

  async function togglePause() {
    setTogglingPause(true);
    try {
      await api('/auth/me', { method: 'PATCH', token, body: { driverPaused: !user?.driverPaused } });
      await refreshUser();
    } catch (e) {
      toast(e.message);
    } finally {
      setTogglingPause(false);
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connect')) {
      toast('Configuration des paiements en cours de validation (quelques secondes).');
      window.history.replaceState({}, '', '/driver');
      // Le statut Stripe Connect n'est pas suivi par webhook pour ce type de compte (voir backend) —
      // on le relit activement au retour de l'onboarding avant de rafraîchir l'utilisateur en contexte.
      api('/auth/me/connect/refresh', { method: 'POST', token }).catch(() => {}).finally(() => refreshUser().catch(() => {}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connectOnboard() {
    setConnecting(true);
    try {
      const r = await api('/auth/me/connect/onboard', { method: 'POST', token });
      window.location.href = r.url;
    } catch (e) {
      toast(e.message);
      setConnecting(false);
    }
  }

  async function load() {
    try {
      const [availableData, mineData] = await Promise.all([
        api('/orders/available', { token }),
        api('/orders/mine/deliveries', { token })
      ]);
      setAvailable(availableData);
      setMine(mineData);
    } catch (e) {
      toast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // refreshUser() en plus de load() : contrairement au dashboard restaurateur (qui recharge tout
    // l'objet restaurant, adminStatus inclus, à chaque poll), le statut d'approbation du livreur vit
    // sur l'objet user mis en cache depuis la connexion — sans ce refresh périodique, une approbation
    // admin ne se refléterait ici qu'après une reconnexion manuelle.
    load();
    refreshUser().catch(() => {});
    const interval = setInterval(() => { load(); refreshUser().catch(() => {}); }, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    activeIdsRef.current = mine.filter((o) => o.status === 'livraison').map((o) => o.id);
  }, [mine]);

  // Partage de position : watchPosition plutôt qu'un getCurrentPosition relancé toutes les 12 s.
  //
  // Le sondage par setInterval était doublement fragile : un onglet en arrière-plan voit ses minuteurs
  // fortement ralentis, et un téléphone qui se verrouille les suspend tout court — donc le suivi
  // s'arrêtait en silence dès que le livreur rangeait son téléphone dans sa poche, sans que ni lui ni
  // le client ne le voient. watchPosition est alimenté par le GPS lui-même et continue à émettre plus
  // longtemps dans ces conditions.
  //
  // Ce que cela ne règle PAS : navigateur fermé ou appareil en veille prolongée. La géolocalisation en
  // arrière-plan n'existe pas sur le web ; elle demande une app native ou un emballage Capacitor. D'où
  // l'horodatage renvoyé au client (lastLocationAt ci-dessous) : tant que le suivi peut s'interrompre,
  // une carte figée doit être lisible comme telle plutôt que passer pour une position à jour.
  useEffect(() => {
    if (!('geolocation' in navigator) || user?.locationSharingEnabled === false) {
      setSharingLocation(false);
      return undefined;
    }
    let deniedNotified = false;
    let lastSentAt = 0;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSharingLocation(true);
        if (!activeIdsRef.current.length) return;
        // watchPosition peut émettre plusieurs fois par seconde en déplacement : on limite les envois
        // au même rythme que l'ancien sondage, pour ne pas multiplier les requêtes par course.
        const now = Date.now();
        if (now - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
        lastSentAt = now;
        const { latitude, longitude } = pos.coords;
        setLastPositionAt(new Date());
        activeIdsRef.current.forEach((id) => {
          api(`/orders/${id}/location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {});
        });
      },
      () => {
        setSharingLocation(false);
        if (!deniedNotified) {
          deniedNotified = true;
          toast('Autorise la géolocalisation dans ton navigateur pour partager ta position en direct avec le client.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationSharingEnabled]);

  async function claim(id) {
    try { await api(`/orders/${id}/claim`, { method: 'PATCH', token }); load(); }
    catch (e) { toast(e.message); }
  }

  async function deliver(id) {
    const code = (codeInputs[id] || '').trim();
    if (!code) { toast('Demande le code de livraison au client.'); return; }
    try {
      await api(`/orders/${id}/deliver`, { method: 'PATCH', token, body: { code } });
      setCodeInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast('Livraison confirmée !');
      load();
    } catch (e) {
      toast(e.message);
    }
  }

  useEffect(() => {
    const awaitingPickupCount = mine.filter((o) => ['preparation', 'pret'].includes(o.status)).length;
    const activeCount = mine.filter((o) => o.status === 'livraison').length;
    const statusText = activeCount === 0
      ? null
      : user?.locationSharingEnabled === false
        ? '📍 Partage de position désactivé.'
        : sharingLocation
          ? `📍 Position partagée${lastPositionAt ? ` — dernier envoi à ${formatClock(lastPositionAt)}` : ''}.`
          : '📍 En attente de l\'autorisation de géolocalisation...';
    setRightSlot(
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Aujourd'hui</h3>
        <div className="stat-grid">
          <div className="stat-card"><div className="num">{available.length}</div><div className="label">Disponibles</div></div>
          <div className="stat-card"><div className="num">{awaitingPickupCount}</div><div className="label">À récupérer</div></div>
          <div className="stat-card highlight"><div className="num">{activeCount}</div><div className="label">En livraison</div></div>
        </div>
        {statusText && <p className="small" style={{ margin: '10px 0 0' }}>{statusText}</p>}
      </div>
    );
    return () => setRightSlot(null);
  }, [available, mine, sharingLocation, lastPositionAt, user?.locationSharingEnabled, setRightSlot]);

  if (loading) return <SkeletonCards count={3} />;

  const awaitingPickup = mine.filter((o) => ['preparation', 'pret'].includes(o.status));
  const active = mine.filter((o) => o.status === 'livraison');

  return (
    <div>
      {user?.adminStatus !== 'approved' && (
        <div className="card" style={{ border: '2px solid var(--red)' }}>
          {user?.adminStatus === 'blocked' ? (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🚫 Compte bloqué par Fairide</h3>
              <p className="small" style={{ margin: 0 }}>
                Ton compte livreur a été bloqué par l'équipe Fairide — tu ne peux plus voir ni prendre de commandes. Contacte le support pour plus d'informations.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>🕐 En attente de validation</h3>
              <p className="small" style={{ margin: 0 }}>
                Ton compte livreur doit être validé par l'équipe Fairide avant de pouvoir voir et prendre des commandes. C'est généralement rapide, repasse un peu plus tard.
              </p>
            </>
          )}
        </div>
      )}

      {user?.adminStatus === 'approved' && user?.stripeConnectStatus !== 'active' && (
        <div className="card" style={{ border: `2px solid ${user?.stripeConnectStatus === 'restricted' ? 'var(--red)' : 'var(--gold)'}` }}>
          {user?.stripeConnectStatus === 'restricted' ? (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>⚠️ Informations de paiement à compléter</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Stripe a besoin d'informations supplémentaires pour pouvoir te verser tes paiements. Tant que ce n'est pas complété, tu ne peux pas prendre de nouvelles livraisons.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>💳 Configure tes paiements Fairide</h3>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Pour recevoir tes frais de livraison et tes pourboires directement sur ton compte bancaire, configure tes informations de paiement via Stripe (rapide et sécurisé). Tant que ce n'est pas fait, tu ne peux pas prendre de livraisons.
              </p>
            </>
          )}
          <button className="btn-gold" disabled={connecting} onClick={connectOnboard}>
            {connecting ? '...' : (user?.stripeConnectStatus === 'restricted' ? 'Compléter mes informations' : 'Configurer mes paiements')}
          </button>
        </div>
      )}

      {user?.adminStatus === 'approved' && user?.stripeConnectStatus === 'active' && (
        <div className="card" style={{ border: `2px solid ${user?.driverPaused ? 'var(--gold)' : 'var(--teal)'}` }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>
                {user?.driverPaused ? '⏸️ Compte en pause' : '✅ Compte validé, tu peux commencer à livrer'}
              </h3>
              <p className="small" style={{ margin: 0 }}>
                {user?.driverPaused
                  ? "Tu ne vois plus les commandes disponibles et ne peux pas en prendre. Réactive-toi quand tu es prêt à reprendre."
                  : 'Mets ton compte en pause à tout moment si tu arrêtes de livrer temporairement — tes livraisons en cours ne sont pas affectées.'}
              </p>
            </div>
            <button
              className={user?.driverPaused ? 'btn-teal' : 'btn-outline'}
              style={{ padding: '8px 14px', fontSize: 13, flexShrink: 0 }}
              disabled={togglingPause}
              onClick={togglePause}
            >
              {togglingPause ? '...' : user?.driverPaused ? '▶️ Reprendre' : '⏸️ Mettre en pause'}
            </button>
          </div>
        </div>
      )}

      {user?.driverPaused ? (
        <div className="empty">Ton compte est en pause — pas de nouvelles commandes tant que tu n'as pas repris.</div>
      ) : (
        <>
          <h2 className="section-title" style={{ marginTop: 0 }}>Commandes disponibles</h2>
          {available.length === 0 && <div className="empty">Aucune commande disponible pour l'instant.</div>}
          {available.map((o) => (
            <div className="card" key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{o.restaurantName}</b>
                <span className="pill teal">{o.commune}</span>
              </div>
              <span className={`status-badge status-${o.status}`} style={{ marginBottom: 6, display: 'inline-block' }}>
                {o.status === 'pret' ? 'Prête à récupérer' : 'En préparation'}
              </span>
              <div className="small" style={{ margin: '6px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
              {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
              <div className="small" style={{ marginBottom: 4 }}>🏁 Livraison : {o.address}</div>
              {o.travelMinutes && <div className="small">🚴 Trajet resto → client : ~{o.travelMinutes} min{o.distanceKm ? ` (${o.distanceKm} km)` : ''}</div>}
              <DeliveryTiming order={o} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="small">Course : {o.deliveryFee.toFixed(2)}€</span>
                <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => claim(o.id)}>Prendre la course</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h2 className="section-title">En attente de retrait</h2>
      {awaitingPickup.length === 0 && <div className="empty">Pas de commande à récupérer pour l'instant.</div>}
      {awaitingPickup.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{o.status === 'pret' ? 'Prête à récupérer' : 'En préparation'}</span>
          </div>
          <div className="small" style={{ margin: '4px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
          {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
          <div className="small">🏁 Livraison : {o.address}</div>
          {o.travelMinutes && <div className="small">🚴 Trajet resto → client : ~{o.travelMinutes} min{o.distanceKm ? ` (${o.distanceKm} km)` : ''}</div>}
          <DeliveryTiming order={o} />
          <div className="small" style={{ marginTop: 4 }}>Course : {o.deliveryFee.toFixed(2)}€</div>
          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '10px 0' }}>
            <div className="small" style={{ marginBottom: 2 }}>Code à donner au restaurant lors du retrait</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, letterSpacing: 4, color: 'var(--ink)' }}>{o.pickupCode}</div>
          </div>
          {o.status !== 'pret' && (
            <p className="small">La commande est encore en préparation — direction le restaurant, elle sera bientôt prête.</p>
          )}
        </div>
      ))}

      <h2 className="section-title">Mes livraisons en cours</h2>
      {active.length > 0 && (
        <div className="small" style={{ marginBottom: 10 }}>
          {user?.locationSharingEnabled === false
            ? '📍 Partage de position désactivé (réactivable dans les réglages du compte).'
            : sharingLocation
              ? `📍 Ta position est partagée avec le(s) client(s)${lastPositionAt ? ` — dernier envoi à ${formatClock(lastPositionAt)}` : ''}.`
              : '📍 En attente de ton autorisation de géolocalisation...'}
          {/* Dit explicitement ce que le web ne peut pas garantir, plutôt que de laisser croire à un
              suivi permanent : tant qu'il n'y a pas d'app native, écran éteint = suivi interrompu. */}
          {sharingLocation && (
            <div style={{ marginTop: 2 }}>Garde cet écran allumé : le partage s'interrompt quand le téléphone se verrouille.</div>
          )}
        </div>
      )}
      {active.length === 0 && <div className="empty">Pas de livraison en cours.</div>}
      {active.map((o) => (
        <div className="card" key={o.id}>
          <b>{o.restaurantName}</b> → {o.clientName}
          <div className="small" style={{ margin: '4px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
          {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
          <div className="small">🏁 Livraison : {o.address}</div>
          {o.travelMinutes && <div className="small">🚴 Trajet resto → client : ~{o.travelMinutes} min{o.distanceKm ? ` (${o.distanceKm} km)` : ''}</div>}
          {o.deliveryInstructions && (
            <div className="small" style={{ fontWeight: 600 }}>{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
          )}
          <DeliveryTiming order={o} />
          <div className="small" style={{ marginTop: 2 }}>Course : {o.deliveryFee.toFixed(2)}€</div>
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <input
              placeholder="Code du client"
              style={{ maxWidth: 140 }}
              value={codeInputs[o.id] || ''}
              onChange={(e) => setCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
            />
            <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => deliver(o.id)}>Confirmer la livraison</button>
          </div>
        </div>
      ))}
    </div>
  );
}
