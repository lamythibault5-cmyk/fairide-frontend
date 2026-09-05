import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import LigneCompte from '../../components/LigneCompte';
import { DeliveryTiming, deliveryInstructionLabel, formatOrderItem } from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Cadence maximale d'envoi de la position au serveur (voir l'effet watchPosition plus bas) — reprend
// l'intervalle de l'ancien sondage, pour que le passage à watchPosition n'augmente pas le trafic.
const MIN_LOCATION_SEND_INTERVAL_MS = 12000;

function formatClock(date) {
  return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

export default function DriverDashboard() {
  const { t } = useLanguage();
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
  // La rangée d'état dépliée en tête (validation), null si aucune.
  const [statutOuvert, setStatutOuvert] = useState(null);
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
      toast(t('dashDriver.toastPaymentsValidating'));
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
    let lastCoords = null;

    function send(latitude, longitude) {
      if (!activeIdsRef.current.length) return;
      lastSentAt = Date.now();
      setLastPositionAt(new Date());
      activeIdsRef.current.forEach((id) => {
        api(`/orders/${id}/location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {});
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSharingLocation(true);
        const { latitude, longitude } = pos.coords;
        lastCoords = { latitude, longitude };
        // watchPosition peut émettre plusieurs fois par seconde en déplacement : on limite les envois
        // au même rythme que l'ancien sondage, pour ne pas multiplier les requêtes par course.
        if (Date.now() - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
        send(latitude, longitude);
      },
      () => {
        setSharingLocation(false);
        if (!deniedNotified) {
          deniedNotified = true;
          toast(t('dashDriver.toastAllowGeo'));
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );

    // Battement de cœur. watchPosition n'émet QUE lorsque la position change : un livreur immobile —
    // arrêté devant le restaurant en attendant la commande, ou coincé à un feu — n'envoyait donc plus
    // rien du tout, et le client voyait une carte vide. L'ancien sondage par intervalle envoyait au
    // moins une position toutes les 12 s, immobile ou non ; on rétablit cette garantie en réémettant
    // la dernière position connue quand aucune n'est partie depuis trop longtemps.
    const heartbeat = setInterval(() => {
      if (!lastCoords) return;
      if (Date.now() - lastSentAt < MIN_LOCATION_SEND_INTERVAL_MS) return;
      send(lastCoords.latitude, lastCoords.longitude);
    }, MIN_LOCATION_SEND_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(heartbeat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.locationSharingEnabled]);

  async function claim(id) {
    try { await api(`/orders/${id}/claim`, { method: 'PATCH', token }); load(); }
    catch (e) { toast(e.message); }
  }

  async function deliver(id) {
    const code = (codeInputs[id] || '').trim();
    if (!code) { toast(t('dashDriver.toastAskCode')); return; }
    try {
      await api(`/orders/${id}/deliver`, { method: 'PATCH', token, body: { code } });
      setCodeInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast(t('dashDriver.toastDelivered'));
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
        ? t('dashDriver.geoDisabled')
        : sharingLocation
          ? t('dashDriver.geoShared', { last: lastPositionAt ? t('dashDriver.geoLastSent', { time: formatClock(lastPositionAt) }) : '' })
          : t('dashDriver.geoWaiting');
    setRightSlot(
      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('dashDriver.today')}</h3>
        <div className="stat-grid">
          <div className="stat-card"><div className="num">{available.length}</div><div className="label">{t('dashDriver.available')}</div></div>
          <div className="stat-card"><div className="num">{awaitingPickupCount}</div><div className="label">{t('dashDriver.toPickUp')}</div></div>
          <div className="stat-card highlight"><div className="num">{activeCount}</div><div className="label">{t('dashDriver.delivering')}</div></div>
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
      {/* L'état du compte livreur, en rangées du même dessin que Mon compte (LigneCompte) : validation,
          paiements, disponibilité, partage de position. Une carte, une rangée par sujet, l'action à
          droite quand il y en a une — plus trois encadrés colorés empilés. */}
      <div className="card account-groupe" aria-label={t('dashDriver.ariaAccount')}>
        {user?.adminStatus === 'blocked' && (
          <LigneCompte accent="danger" icone="🚫" titre={t('dashDriver.blockedTitle')} sous={t('dashDriver.blockedSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
            <p className="small" style={{ margin: 0 }}>
              {t('dashDriver.blockedText')}
            </p>
          </LigneCompte>
        )}
        {user?.adminStatus !== 'approved' && user?.adminStatus !== 'blocked' && (
          <LigneCompte accent="warn" icone="🕐" titre={t('dashDriver.pendingTitle')} sous={t('dashDriver.pendingSub')} ouverte={statutOuvert === 'validation'} onClick={() => setStatutOuvert(statutOuvert === 'validation' ? null : 'validation')}>
            <p className="small" style={{ margin: 0 }}>
              {t('dashDriver.pendingText')}
            </p>
          </LigneCompte>
        )}
        {user?.adminStatus === 'approved' && user?.stripeConnectStatus !== 'active' && (
          <LigneCompte
            accent={user?.stripeConnectStatus === 'restricted' ? 'danger' : 'warn'} icone="💳"
            titre={user?.stripeConnectStatus === 'restricted' ? t('dashDriver.paymentInfoTitle') : t('dashDriver.paymentsToConfigure')}
            sous={user?.stripeConnectStatus === 'restricted'
              ? t('dashDriver.stripeNeedsInfo')
              : t('dashDriver.viaStripe')}
            action={(
              <button type="button" className="btn-gold" style={{ padding: '8px 12px', fontSize: 13 }} disabled={connecting} onClick={connectOnboard}>
                {connecting ? '...' : (user?.stripeConnectStatus === 'restricted' ? t('dashDriver.complete') : 'Configurer')}
              </button>
            )}
          />
        )}
        {user?.adminStatus === 'approved' && user?.stripeConnectStatus === 'active' && (
          <LigneCompte
            accent={user?.driverPaused ? 'warn' : 'ok'} icone={user?.driverPaused ? '⏸️' : '✅'}
            titre={user?.driverPaused ? t('dashDriver.accountPaused') : t('dashDriver.availableToDeliver')}
            sous={user?.driverPaused ? t('dashDriver.pausedSub') : t('dashDriver.availableSub')}
            action={(
              <button type="button" className={user?.driverPaused ? 'btn-teal' : 'btn-outline'} style={{ padding: '8px 12px', fontSize: 13 }} disabled={togglingPause} onClick={togglePause}>
                {togglingPause ? '...' : user?.driverPaused ? '▶️ Reprendre' : '⏸️ Pause'}
              </button>
            )}
          />
        )}
        {active.length > 0 && (
          <LigneCompte
            accent={user?.locationSharingEnabled === false ? 'warn' : sharingLocation ? 'ok' : 'warn'} icone="📍"
            titre={t('dashDriver.locationSharing')}
            sous={user?.locationSharingEnabled === false
              ? t('dashDriver.sharingDisabledSub')
              : sharingLocation
                ? t('dashDriver.sharingOnSub', { last: lastPositionAt ? t('dashDriver.geoLastSentDot', { time: formatClock(lastPositionAt) }) : '' })
                : t('dashDriver.sharingWaitingSub')}
            action={null}
          />
        )}
      </div>

      {user?.driverPaused ? (
        <div className="empty">{t('dashDriver.pausedText')}</div>
      ) : (
        <>
          <h2 className="section-title" style={{ marginTop: 0 }}>{t('dashDriver.availableOrders')}</h2>
          {available.length === 0 && <div className="empty">{t('dashDriver.noneAvailable')}</div>}
          {available.map((o) => (
            <div className="card" key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{o.restaurantName}</b>
                <span className="pill teal">{o.commune}</span>
              </div>
              <span className={`status-badge status-${o.status}`} style={{ marginBottom: 6, display: 'inline-block' }}>
                {o.status === 'pret' ? t('dashDriver.readyToPickUp') : t('dashDriver.preparing')}
              </span>
              <div className="small" style={{ margin: '6px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
              {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
              <div className="small" style={{ marginBottom: 4 }}>{t('dashDriver.deliveryAt', { address: o.address })}</div>
              {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${o.distanceKm} km)` : '' })}</div>}
              <DeliveryTiming order={o} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="small">{t('dashDriver.rideFee', { fee: o.deliveryFee.toFixed(2) })}</span>
                <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => claim(o.id)}>{t('dashDriver.takeRide')}</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h2 className="section-title">{t('dashDriver.awaitingPickup')}</h2>
      {awaitingPickup.length === 0 && <div className="empty">{t('dashDriver.noneToPickUp')}</div>}
      {awaitingPickup.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{o.restaurantName}</b>
            <span className={`status-badge status-${o.status}`}>{o.status === 'pret' ? t('dashDriver.readyToPickUp') : t('dashDriver.preparing')}</span>
          </div>
          <div className="small" style={{ margin: '4px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
          {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
          <div className="small">{t('dashDriver.deliveryAt', { address: o.address })}</div>
          {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${o.distanceKm} km)` : '' })}</div>}
          <DeliveryTiming order={o} />
          <div className="small" style={{ marginTop: 4 }}>{t('dashDriver.rideFee', { fee: o.deliveryFee.toFixed(2) })}</div>
          <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '10px 0' }}>
            <div className="small" style={{ marginBottom: 2 }}>{t('dashDriver.codeForRestaurant')}</div>
            <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 6, color: 'var(--ink)' }}>{o.pickupCode}</div>
          </div>
          {o.status !== 'pret' && (
            <p className="small">{t('dashDriver.stillPreparing')}</p>
          )}
        </div>
      ))}

      {/* L'état du partage de position est dans la rangée « Partage de position » en tête de page,
          avec le rappel « garde l'écran allumé » : sans app native, écran éteint = suivi interrompu. */}
      <h2 className="section-title">{t('dashDriver.myOngoing')}</h2>
      {active.length === 0 && <div className="empty">{t('dashDriver.noneOngoing')}</div>}
      {active.map((o) => (
        <div className="card" key={o.id}>
          <b>{o.restaurantName}</b> → {o.clientName}
          <div className="small" style={{ margin: '4px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
          {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
          <div className="small">{t('dashDriver.deliveryAt', { address: o.address })}</div>
          {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${o.distanceKm} km)` : '' })}</div>}
          {o.deliveryInstructions && (
            <div className="small" style={{ fontWeight: 600 }}>{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
          )}
          <DeliveryTiming order={o} />
          <div className="small" style={{ marginTop: 2 }}>{t('dashDriver.rideFee', { fee: o.deliveryFee.toFixed(2) })}</div>
          {o.clientPhone && <div className="small">📞 {o.clientPhone}</div>}
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <input
              placeholder={t('dashDriver.phCustomerCode')}
              style={{ maxWidth: 140 }}
              value={codeInputs[o.id] || ''}
              onChange={(e) => setCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
            />
            <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => deliver(o.id)}>{t('dashDriver.confirmDelivery')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
