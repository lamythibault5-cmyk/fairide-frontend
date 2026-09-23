import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import ErrorCard from '../../components/ErrorCard';
import LigneCompte from '../../components/LigneCompte';
import Icone from '../../components/Icone';
import { DeliveryTiming, deliveryInstructionLabel, formatOrderItem } from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { dateOuverturePaiements } from '../../launch';
import useRevalidation from '../../useRevalidation';
import useAlerteLivreur from '../../hooks/useAlerteLivreur';
import AlerteLivreurBar from '../../components/AlerteLivreurBar';
import { BandeauAllergie, BadgeAlcool, VerificationAge } from '../../components/conformite/CommandeConformite';

// Cadence maximale d'envoi de la position au serveur (voir l'effet watchPosition plus bas) — reprend
// l'intervalle de l'ancien sondage, pour que le passage à watchPosition n'augmente pas le trafic.
const MIN_LOCATION_SEND_INTERVAL_MS = 12000;

function formatClock(date) {
  return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

export default function DriverDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { token, user, refreshUser } = useAuth();
  const toast = useToast();
  const [available, setAvailable] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  // Un ref et non un state : sa valeur est lue dans load(), qui n'est pas re-créée à chaque rendu.
  const chargeReussieRef = useRef(false);
  const [codeInputs, setCodeInputs] = useState({});
  // Remise d'une commande avec alcool : pièce d'identité à contrôler d'abord (backlog B6).
  const [ageAVerifier, setAgeAVerifier] = useState(null);
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
      toast(e.message, 'erreur');
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
      toast(e.message, 'erreur');
      setConnecting(false);
    }
  }

  // Véhicule déclaré (dossier coursier) : explique pourquoi certaines courses n'apparaissent pas (vélo) ou
  // pourquoi les longues distances sont en tête (motorisé).
  const [vehicule, setVehicule] = useState(null);
  const [sac, setSac] = useState(null);
  useEffect(() => { api('/couriers/me', { token }).then((d) => setSac(d.courier?.bag || null)).catch(() => {}); }, [token]);
  useEffect(() => { api('/couriers/me', { token }).then((d) => setVehicule({ type: d.courier?.vehicleType || '', bikeMaxKm: d.pricing?.bikeMaxKm || 4, rate: ['velo', 'velo_electrique'].includes(d.courier?.vehicleType || '') ? d.pricing?.driverPerKmBike : d.pricing?.driverPerKmMotor, base: d.pricing?.deliveryBaseFee, baseKm: d.pricing?.deliveryBaseKm })).catch(() => {}); }, [token]);

  async function load() {
    try {
      const [availableData, mineData] = await Promise.all([
        api('/orders/available', { token }),
        api('/orders/mine/deliveries', { token })
      ]);
      setAvailable(availableData);
      setMine(mineData);
      setErreur(null);
      chargeReussieRef.current = true;
    } catch (e) {
      /* UN ÉCHEC NE DOIT PAS SE LIRE COMME « AUCUNE COURSE ».
         Jusqu'ici l'échec ne posait qu'un toast : `loading` passait à false, la page s'affichait
         avec des listes vides et le livreur lisait « aucune commande disponible ». C'est un
         mensonge coûteux — il est payé à la course, et rien ne lui disait de réessayer.

         L'écran d'erreur ne remplace la page QUE tant qu'aucun chargement n'a réussi. Ensuite on
         garde les données déjà affichées et le toast suffit : la page se recharge toute seule
         toutes les 15 secondes, et sur un réseau qui clignote (un livreur est en mouvement, c'est
         le cas normal) la faire basculer en écran d'erreur lui retirerait ses courses des mains. */
      setErreur(e);
      if (chargeReussieRef.current) toast(e.message, 'erreur');
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
  // Retour sur l'onglet après une absence : relecture immédiate, sans attendre le prochain cycle.
  useRevalidation(() => { load(); return refreshUser(); });

  useEffect(() => {
    activeIdsRef.current = mine.filter((o) => o.status === 'livraison').map((o) => o.id);
  }, [mine]);

  // Son, vibration, notification et compteur d'onglet : nouvelle course disponible, course prise devenue prête.
  const alerte = useAlerteLivreur({
    disponibles: available, mesCourses: mine, pret: !loading,
    actif: user?.adminStatus === 'approved' && user?.stripeConnectStatus === 'active' && !user?.driverPaused
  });

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

  // Refuser une course (B23bis) : elle quitte SA liste, et rien d'autre — le refus n'est relu par aucune
  // autre décision (docs/dispatch.md côté serveur). Retrait local immédiat, sans attendre le rechargement.
  async function refuserOffre(id) {
    try {
      await api(`/orders/${id}/refuse-offer`, { method: 'PATCH', token });
      setAvailable((prev) => prev.filter((x) => x.id !== id));
      toast(t('conformite.offerRefused'));
    } catch (e) { toast(e.message, 'erreur'); }
  }

  async function claim(id) {
    try { await api(`/orders/${id}/claim`, { method: 'PATCH', token }); load(); }
    catch (e) {
      toast(e.message, 'erreur');
      // Notices à relire (B4) ou titre de séjour expiré (B2) : ça se règle dans l'espace livreur, on y va.
      if (['NOTICES_A_ACCEPTER', 'TITRE_SEJOUR_EXPIRE'].includes(e.code)) navigate('/driver/onboarding');
    }
  }

  async function deliver(order, ageVerifie = false) {
    const id = order.id;
    const code = (codeInputs[id] || '').trim();
    if (!code) { toast(t('dashDriver.toastAskCode')); return; }
    if (order.containsAlcohol && !ageVerifie) { setAgeAVerifier(order); return; }
    try {
      await api(`/orders/${id}/deliver`, { method: 'PATCH', token, body: { code, ...(ageVerifie ? { ageCheck: 'verified' } : {}) } });
      setCodeInputs((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast(t('dashDriver.toastDelivered'));
      load();
    } catch (e) {
      toast(e.message, 'erreur');
    }
  }

  // Âge non prouvé à la porte : la commande est close, la course t'est payée, l'équipe décide du reste.
  async function refuserRemiseAge(order) {
    try {
      await api(`/orders/${order.id}/age-refused`, { method: 'PATCH', token, body: { reason: 'refused_age' } });
      setAgeAVerifier(null);
      toast(t('conformite.ageRefusedDriverDone'));
      load();
    } catch (e) { toast(e.message, 'erreur'); }
  }

  // Plus de carte « Aujourd'hui » dans la colonne de droite (2026-09-23) : ses trois compteurs
  // (disponibles, à récupérer, en livraison) redisaient les titres des sections de la page, et sur un
  // téléphone la colonne passe SOUS le contenu — le livreur ne la voyait qu'en bas de page. L'état du
  // partage de position qu'elle portait aussi est dans la rangée « Partage de position ».

  if (loading) return <SkeletonCards count={3} />;
  // Voir load() : seulement tant que rien n'a jamais chargé, sinon on garderait les courses en main.
  if (erreur && !chargeReussieRef.current) {
    return <ErrorCard titre={t('dashDriver.loadError')} message={erreur.message} onRetry={() => { setLoading(true); load(); }} />;
  }

  const awaitingPickup = mine.filter((o) => ['preparation', 'pret'].includes(o.status));
  const active = mine.filter((o) => o.status === 'livraison');
  // Courses livrées aujourd'hui : brut · retenue · net quand le serveur joint `driverEarning` à la
  // commande (précompte de l'économie collaborative), sinon le tarif livreur tel quel.
  const aujourdhui = new Date().toDateString();
  const livreesAujourdhui = mine.filter((o) => o.status === 'livre' && new Date(o.deliveredAt || o.updatedAt || o.createdAt).toDateString() === aujourdhui);
  const ligneGain = (o) => (o.driverEarning && o.driverEarning.gross != null
    ? t('dashDriver.earningLine', { gross: Number(o.driverEarning.gross).toFixed(2), withholding: Number(o.driverEarning.withholding ?? 0).toFixed(2), net: Number(o.driverEarning.net ?? (o.driverEarning.gross - (o.driverEarning.withholding || 0))).toFixed(2) })
    : t('dashDriver.rideFee', { fee: Number(o.driverFee ?? o.deliveryFee).toFixed(2) }));

  const approuve = user?.adminStatus === 'approved';
  const peutRouler = approuve && user?.stripeConnectStatus === 'active';
  const enPause = !!user?.driverPaused;

  // Une carte de course livrée ou à récupérer : on la montre TOUJOURS, pause ou non — se mettre en
  // pause coupe les nouvelles offres, pas les courses déjà prises.
  const carteRetrait = (o) => (
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
      <div className="small" style={{ marginTop: 4 }}>{t('dashDriver.rideFee', { fee: Number(o.driverFee ?? o.deliveryFee).toFixed(2) })}</div>
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', textAlign: 'center', margin: '10px 0' }}>
        <div className="small" style={{ marginBottom: 2 }}>{t('dashDriver.codeForRestaurant')}</div>
        <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 6, color: 'var(--ink)' }}>{o.pickupCode}</div>
      </div>
      {o.status !== 'pret' && <p className="small">{t('dashDriver.stillPreparing')}</p>}
    </div>
  );

  return (
    <div>
      {/* L'INTERRUPTEUR EN TÊTE (2026-09-23). Comme l'app Uber Driver : la première chose que le
          livreur voit, c'est s'il reçoit des courses ou non, et le geste pour changer, sur toute la
          largeur. Avant, « Pause » était un petit bouton au bout d'une rangée, sous deux liens vers le
          dossier et les gains — liens qui existent déjà dans la barre du bas et dans Mon compte, et
          qui sont partis d'ici pour cette raison (une rubrique, un seul endroit). */}
      {peutRouler && (
        <button type="button" className={`driver-switch${enPause ? ' off' : ''}`} aria-pressed={!enPause} disabled={togglingPause} onClick={togglePause}>
          <span className="driver-switch-dot" aria-hidden="true" />
          <span className="driver-switch-text">
            <b>{enPause ? t('dashDriver.accountPaused') : t('dashDriver.availableToDeliver')}</b>
            <span>{togglingPause ? '…' : enPause ? t('dashDriver.tapToResume') : t('dashDriver.tapToPause')}</span>
          </span>
        </button>
      )}

      {/* Rangées d'état qui demandent une action ou une vigilance : paiements à configurer, position
          partagée pendant une livraison. Rien d'autre — la carte n'apparaît que s'il y a une rangée. */}
      {((approuve && user?.stripeConnectStatus !== 'active') || active.length > 0) && (
      <div className="card account-groupe" aria-label={t('dashDriver.ariaAccount')}>
        {approuve && user?.stripeConnectStatus !== 'active' && (
          <LigneCompte
            accent={user?.stripeConnectStatus === 'restricted' ? 'danger' : 'warn'} icone="carteBancaire"
            titre={user?.stripeConnectStatus === 'restricted' ? t('dashDriver.paymentInfoTitle') : t('dashDriver.paymentsToConfigure')}
            sous={user?.stripeConnectStatus === 'restricted'
              ? t('dashDriver.stripeNeedsInfo')
              : t('dashDriver.viaStripe', { date: dateOuverturePaiements(getLocale()) })}
            action={user?.stripeConnectStatus === 'restricted' ? (
              <button type="button" className="btn-gold" style={{ padding: '8px 12px', fontSize: 13 }} disabled={connecting} onClick={connectOnboard}>
                {connecting ? '...' : t('dashDriver.complete')}
              </button>
            ) : (
              // Activation fermée jusqu'à début octobre 2026 : l'explication complète (et Stripe) est dans Mon compte › Paiement.
              <Link to="/account" className="btn-outline" style={{ padding: '8px 12px', fontSize: 13, display: 'inline-block' }}>{t('dashDriver.paymentsSoonBtn', { date: dateOuverturePaiements(getLocale()) })}</Link>
            )}
          />
        )}
        {active.length > 0 && (
          <LigneCompte
            accent={user?.locationSharingEnabled === false ? 'warn' : sharingLocation ? 'ok' : 'warn'} icone="position"
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
      )}

      {!approuve ? (
        <div className="empty" style={{ padding: '40px 20px' }}>
          {/* Une icône, pas son nom : la ligne affichait littéralement « horloge » ou « interdit » en
              34px — reliquat du remplacement des emojis par <Icone>, où la chaîne était restée seule. */}
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icone nom={user?.adminStatus === 'blocked' ? 'interdit' : 'horloge'} taille={34} /></div>
          <b>{user?.adminStatus === 'blocked' ? t('dashDriver.blockedTitle') : t('dashDriver.waitingTitle')}</b>
          <p className="small" style={{ margin: '6px auto 0', maxWidth: 420 }}>{user?.adminStatus === 'blocked' ? t('dashDriver.blockedText') : t('dashDriver.waitingEmpty')}</p>
        </div>
      ) : (<>
        {/* LA COURSE EN MAIN D'ABORD. Un livreur en pleine livraison ouvrait la page sur la liste des
            nouvelles offres et devait descendre pour retrouver le code client à saisir. L'ordre suit
            maintenant l'urgence : je livre → je vais chercher → je pourrais prendre. Une section vide
            ne s'affiche plus du tout, plutôt que « Pas de livraison en cours ». */}
        {active.length > 0 && <h2 className="section-title" style={{ marginTop: 0 }}>{t('dashDriver.myOngoing')}</h2>}
        {active.map((o) => (
          <div className="card" key={o.id}>
            <b>{o.restaurantName}</b> → {o.clientName}
            <div className="small" style={{ margin: '4px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
            <BandeauAllergie order={o} />
            <BadgeAlcool order={o} />
            {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
            <div className="small">{t('dashDriver.deliveryAt', { address: o.address })}</div>
            {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${o.distanceKm} km)` : '' })}</div>}
            {o.deliveryInstructions && (
              <div className="small" style={{ fontWeight: 600 }}>{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` · ${o.deliveryNote}` : ''}</div>
            )}
            <DeliveryTiming order={o} />
            <div className="small" style={{ marginTop: 2 }}>{t('dashDriver.rideFee', { fee: Number(o.driverFee ?? o.deliveryFee).toFixed(2) })}</div>
            {o.clientPhone && <div className="small">📞 <a href={`tel:${o.clientPhone}`}>{o.clientPhone}</a></div>}
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <input aria-label={t('dashDriver.phCustomerCode')}
                placeholder={t('dashDriver.phCustomerCode')}
                inputMode="numeric"
                style={{ maxWidth: 140 }}
                value={codeInputs[o.id] || ''}
                onChange={(e) => setCodeInputs((prev) => ({ ...prev, [o.id]: e.target.value }))}
              />
              <button className="btn-teal" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => deliver(o)}>{t('dashDriver.confirmDelivery')}</button>
            </div>
          </div>
        ))}

        {awaitingPickup.length > 0 && <h2 className="section-title" style={active.length ? undefined : { marginTop: 0 }}>{t('dashDriver.awaitingPickup')}</h2>}
        {awaitingPickup.map(carteRetrait)}

        {enPause ? (
          <div className="empty">{t('dashDriver.pausedText')}</div>
        ) : (
        <>
          <AlerteLivreurBar {...alerte} />
          {sac?.option === 'fairide' && sac.depositStatus !== 'refunded' && (
            <div className="card sac-fairide" style={{ borderLeft: '4px solid var(--teal, #1E8A7A)' }}>
              <b>🟢 {t('dashDriver.bagTitle')}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t(`dashDriver.bag_${sac.depositStatus}`, { amount: Number(sac.depositAmount || 40).toFixed(0) })}</p>
            </div>
          )}
          <h2 className="section-title" style={active.length || awaitingPickup.length ? undefined : { marginTop: 0 }}>{t('dashDriver.availableOrders')}</h2>
          {vehicule?.type && (
            <p className="small" style={{ margin: '-6px 0 10px' }}>
              {['velo', 'velo_electrique'].includes(vehicule.type) ? t('dashDriver.bikeRule', { km: vehicule.bikeMaxKm }) : t('dashDriver.motorRule', { km: vehicule.bikeMaxKm })}
              {vehicule.rate !== undefined && <> {t('dashDriver.rateRule', { base: Number(vehicule.base || 0).toFixed(2), baseKm: vehicule.baseKm, rate: Number(vehicule.rate || 0).toFixed(2) })}</>}
            </p>
          )}
          {available.length === 0 && <div className="empty">{t('dashDriver.noneAvailable')}</div>}
          {available.map((o) => (
            <div className="card" key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{o.restaurantName}</b>
                <span className="row" style={{ gap: 6 }}>
                  {o.distanceKm != null && <span className={`pill${o.longDistance ? ' gold' : ''}`}>{o.longDistance ? t('dashDriver.longDistance', { km: o.distanceKm }) : t('dashDriver.shortDistance', { km: o.distanceKm })}</span>}
                  <span className="pill teal">{o.commune}</span>
                </span>
              </div>
              <span className={`status-badge status-${o.status}`} style={{ marginBottom: 6, display: 'inline-block' }}>
                {o.status === 'pret' ? t('dashDriver.readyToPickUp') : t('dashDriver.preparing')}
              </span>
              <div className="small" style={{ margin: '6px 0' }}>{o.items.map(formatOrderItem).join(', ')}</div>
              {o.restaurantAddress && <div className="small">{t('dashDriver.pickupAt', { address: o.restaurantAddress })}</div>}
              {/* Adresse sans numéro ni nom du client avant la prise (le serveur ne les envoie pas). */}
              <div className="small" style={{ marginBottom: 4 }}>{t('dashDriver.deliveryAt', { address: o.address })} <span style={{ color: 'var(--ink-soft)' }}>({t('conformite.offerApproxAddress')})</span></div>
              {o.travelMinutes && <div className="small">{t('dashDriver.tripEstimate', { min: o.travelMinutes, km: o.distanceKm ? ` (${o.distanceKm} km)` : '' })}</div>}
              <DeliveryTiming order={o} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className="small">
                  <b>{t('conformite.offerPrice', { fee: Number(o.driverFee ?? o.deliveryFee).toFixed(2) })}</b>
                  {o.bonusCents > 0 && <span style={{ display: 'block', color: 'var(--ink-soft)' }}>{t('conformite.offerBonus', { amount: (o.bonusCents / 100).toFixed(2) })}</span>}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn-outline" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => refuserOffre(o.id)}>{t('conformite.refuseOffer')}</button>
                  <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => claim(o.id)}>{t('dashDriver.takeRide')}</button>
                </span>
              </div>
            </div>
          ))}
        </>
        )}

        {livreesAujourdhui.length > 0 && (<>
          <h2 className="section-title">{t('dashDriver.deliveredToday')}</h2>
          {livreesAujourdhui.map((o) => (
            <div className="card" key={o.id}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span><b>{o.restaurantName}</b>{o.commune ? ` → ${o.commune}` : ''}</span>
                <span className="small">{ligneGain(o)}</span>
              </div>
            </div>
          ))}
        </>)}
      </>)}
      <VerificationAge order={ageAVerifier} onFermer={() => setAgeAVerifier(null)}
        onVerifie={() => { const o = ageAVerifier; setAgeAVerifier(null); deliver(o, true); }}
        onRefuse={() => refuserRemiseAge(ageAVerifier)} />
    </div>
  );
}
