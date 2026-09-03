import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { StarsDisplay } from '../components/Stars';

// Les valeurs restent en français (stockées telles quelles côté backend) — seul le libellé affiché
// est traduit, même principe que ROLES/GENDERS dans Auth.jsx.
function deletionReasons(t) {
  return [
    { value: "Je n'utilise plus le service", label: t('account.deletionReasons.notUsing') },
    { value: 'Prix ou frais trop élevés', label: t('account.deletionReasons.tooExpensive') },
    { value: 'Mauvaise expérience avec une commande', label: t('account.deletionReasons.badExperience') },
    { value: 'Problème avec un restaurant ou un livreur', label: t('account.deletionReasons.restaurantDriverIssue') },
    { value: 'Je préfère une autre application', label: t('account.deletionReasons.otherApp') },
    { value: 'Problème de confidentialité ou de sécurité', label: t('account.deletionReasons.privacySecurity') },
    { value: 'Autre raison', label: t('account.deletionReasons.other') }
  ];
}

function genders(t) {
  return [
    { value: '', label: t('auth.genderPlaceholder') },
    { value: 'Femme', label: t('auth.genderWoman') },
    { value: 'Homme', label: t('auth.genderMan') },
    { value: 'Autre', label: t('auth.genderOther') },
    { value: 'Préfère ne pas dire', label: t('auth.genderPreferNot') }
  ];
}

export default function Account() {
  const { user, role, token, updateProfile, refreshUser, requestContactChange, confirmContactChange, requestDeletionCode, deleteAccount, logout } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const ROLE_LABEL = { client: t('account.roleClient'), restaurant: t('account.roleRestaurant'), driver: t('account.roleDriver') };
  const DELETION_REASONS = deletionReasons(t);
  const GENDERS = genders(t);
  const [driverDeliveries, setDriverDeliveries] = useState(null);
  const [driverReviews, setDriverReviews] = useState(null);
  const [restoId, setRestoId] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [subscribing, setSubscribing] = useState(false);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [pausingSub, setPausingSub] = useState(false);
  const [resumingSub, setResumingSub] = useState(false);
  const [cancelingSub, setCancelingSub] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [converting, setConverting] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [offersPickup, setOffersPickup] = useState(true);
  const [offersDineIn, setOffersDineIn] = useState(true);
  const [savingServices, setSavingServices] = useState(false);
  const servicesInitRef = useRef(false);
  const [generatedCodes, setGeneratedCodes] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState(DELETION_REASONS[0].value);
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteCodeSent, setDeleteCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [gender, setGender] = useState(user.gender || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [addressStreet, setAddressStreet] = useState(user.addressStreet || '');
  const [addressNumber, setAddressNumber] = useState(user.addressNumber || '');
  const [addressPostalCode, setAddressPostalCode] = useState(user.addressPostalCode || '');
  const [addressCity, setAddressCity] = useState(user.addressCity || '');
  const [savingInfo, setSavingInfo] = useState(false);

  const [locationSharingEnabled, setLocationSharingEnabled] = useState(user.locationSharingEnabled !== false);
  const [savingLocationSharing, setSavingLocationSharing] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (role !== 'driver') return;
    Promise.all([
      api('/orders/mine/deliveries', { token }),
      api('/reviews/driver/mine', { token })
    ]).then(([deliveries, reviews]) => {
      setDriverDeliveries(deliveries);
      setDriverReviews(reviews);
    }).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    api('/auth/referral/mine', { token }).then(setReferralStats).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (role !== 'restaurant') return;
    api('/restaurants/mine/dashboard', { token }).then((list) => {
      if (list[0]) setRestoId(list[0].id);
    }).catch((e) => toast(e.message));
    if (new URLSearchParams(window.location.search).get('subscribed')) {
      toast('Merci ! Ton abonnement est en cours d\'activation (quelques secondes).');
      window.history.replaceState({}, '', '/account');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  useEffect(() => {
    if (!restoId) return;
    refreshRestaurant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  useEffect(() => {
    if (role !== 'restaurant') return;
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(clock);
  }, [role]);

  function refreshRestaurant() {
    if (!restoId) return;
    api(`/restaurants/${restoId}`).then(setRestaurant).catch((e) => toast(e.message));
  }

  // N'initialise les cases à cocher qu'une fois par restaurant, pas à chaque refreshRestaurant() (ex.
  // après une action sur l'abonnement) — sinon ça écraserait une modification en cours, non sauvegardée.
  useEffect(() => {
    if (!restaurant || servicesInitRef.current) return;
    servicesInitRef.current = true;
    setOffersDelivery(restaurant.offersDelivery);
    setOffersPickup(restaurant.offersPickup);
    setOffersDineIn(restaurant.offersDineIn);
  }, [restaurant]);

  async function saveServices() {
    if (!offersDelivery && !offersPickup && !offersDineIn) {
      toast('Sélectionne au moins un service.');
      return;
    }
    setSavingServices(true);
    try {
      await api(`/restaurants/${restoId}/services`, { method: 'PATCH', token, body: { offersDelivery, offersPickup, offersDineIn } });
      refreshRestaurant();
      toast('Services mis à jour.');
    } catch (err) {
      toast(err.message);
    } finally {
      setSavingServices(false);
    }
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
      refreshRestaurant();
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
      refreshRestaurant();
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
      refreshRestaurant();
      setConfirmCancelSub(false);
      toast('Abonnement résilié — ton restaurant n\'est plus visible aux clients.');
    } catch (e) {
      toast(e.message);
    } finally {
      setCancelingSub(false);
    }
  }

  useEffect(() => {
    if (role !== 'restaurant' && role !== 'driver') return;
    api('/auth/balance/codes/mine', { token }).then(setGeneratedCodes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function copyReferralCode() {
    if (!referralStats?.code) return;
    navigator.clipboard.writeText(referralStats.code).then(() => {
      toast(t('account.referral.toastCopied'));
    }).catch(() => {});
  }

  async function handleRedeemCode(e) {
    e.preventDefault();
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const result = await api('/auth/balance/redeem', { method: 'POST', token, body: { code: redeemCode.trim() } });
      toast(t('account.redeemSuccess', { amount: Number(result.amount).toFixed(2) }));
      setRedeemCode('');
      await refreshUser();
    } catch (err) {
      toast(err.message);
    } finally {
      setRedeeming(false);
    }
  }

  async function handleConvert(e) {
    e.preventDefault();
    const amount = Number(convertAmount);
    if (!amount || amount <= 0) return;
    setConverting(true);
    try {
      const result = await api('/auth/balance/convert', { method: 'POST', token, body: { amount } });
      toast(t('account.convert.toastSuccess', { code: result.code }));
      setConvertAmount('');
      setGeneratedCodes((prev) => [{ code: result.code, amount: Number(result.amount), used: false, createdAt: new Date().toISOString() }, ...(prev || [])]);
      await refreshUser();
    } catch (err) {
      toast(err.message);
    } finally {
      setConverting(false);
    }
  }

  async function toggleLocationSharing(e) {
    const next = e.target.checked;
    setLocationSharingEnabled(next);
    setSavingLocationSharing(true);
    try {
      await updateProfile({ locationSharingEnabled: next });
      toast(next ? t('account.toastGeoOn') : t('account.toastGeoOff'));
    } catch (err) {
      setLocationSharingEnabled(!next);
      toast(err.message);
    } finally {
      setSavingLocationSharing(false);
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await updateProfile({
        firstName: firstName.trim(), lastName: lastName.trim(),
        gender, birthDate: birthDate || '',
        addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
        addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim()
      });
      toast(t('account.toastInfoUpdated'));
    } catch (err) {
      toast(err.message);
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleSendDeleteCode() {
    setSendingCode(true);
    try {
      await requestDeletionCode();
      setDeleteCodeSent(true);
      toast(t('account.toastDeleteCodeSent'));
    } catch (err) {
      toast(err.message);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteCode) { toast(t('account.toastDeleteCodeRequired')); return; }
    setDeleting(true);
    try {
      const result = await deleteAccount({ code: deleteCode, reason: deleteReason, comment: deleteComment.trim() });
      toast(result.anonymized ? t('account.toastAccountDeletedAnon') : t('account.toastAccountDeleted'));
    } catch (err) {
      toast(err.message);
      setDeleting(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { toast(t('account.toastPasswordTooShort')); return; }
    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast(t('account.toastPasswordChanged'));
    } catch (err) {
      toast(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('account.title')}</h2>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="pill teal">{ROLE_LABEL[role] || role}</span>
          <span className="small">{user.email}</span>
        </div>

        {role === 'client' && (
          <>
            <div className="stat-card highlight" style={{ marginBottom: 14 }}>
              <div className="num">{Number(user.balance || 0).toFixed(2)}€</div>
              <div className="label">{t('account.balance')}</div>
            </div>
            <form onSubmit={handleRedeemCode} className="row" style={{ gap: 8, marginBottom: 14 }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder={t('account.redeemPlaceholder')} />
              </div>
              <button type="submit" className="btn-teal" disabled={redeeming}>{redeeming ? '...' : t('account.redeemButton')}</button>
            </form>
          </>
        )}

        <form onSubmit={saveInfo}>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('auth.firstName')}</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('auth.lastName')}</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('auth.gender')}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('account.birthDate')}</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 2 }}>
              <label>{t('auth.street')}</label>
              <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('auth.number')}</label>
              <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>{t('auth.postalCode')}</label>
              <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>{t('auth.city')}</label>
              <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-teal" disabled={savingInfo}>{savingInfo ? '...' : t('common.save')}</button>
        </form>
      </div>

      {/* Langue de l'interface. Elle vivait dans la barre latérale, où elle était visible en
          permanence — mais une barre de navigation n'est pas l'endroit d'un réglage, et sur
          téléphone elle y disputait la place aux onglets. Le choix est mémorisé dans
          localStorage (voir LanguageContext) : on ne le règle qu'une fois, et il survit à la
          déconnexion comme à la fermeture du navigateur. Sa place est donc ici.
          Le sélecteur reste en accès direct sur la bannière publique, pour un visiteur non connecté
          qui n'a pas encore de page Compte où aller. */}
      {/* Raccourcis du client. Volontairement limités à des rubriques qui mènent quelque part :
          Fairide n'a ni carte enregistrée (le paiement passe par Stripe à chaque commande) ni
          titres-restaurant, donc pas de ligne pour eux — une rubrique qui n'ouvre rien coûte plus
          de confiance qu'elle n'apporte de complétude.
          « Mes réservations » pointe sur la liste des commandes filtrée : les réservations SONT des
          commandes sur place, les ranger ailleurs les dédoublerait. */}
      {role === 'client' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { to: '/orders?type=dine_in', icone: '📅', titre: 'Mes réservations', sous: 'Tes tables réservées sur place' },
            { to: '/orders', icone: '📦', titre: 'Mes commandes', sous: 'Livraisons, à emporter et sur place' },
            { to: '/favorites', icone: '❤️', titre: 'Mes favoris', sous: 'Les commerces que tu as enregistrés' },
            { to: '/invoices', icone: '📄', titre: 'Mes factures', sous: 'Les reçus de tes commandes payées' },
            { to: '/map', icone: '🗺️', titre: 'Carte des commerces', sous: 'Trouver un commerce autour de toi' }
          ].map((r) => (
            <Link key={r.to} to={r.to} className="account-link-row">
              <span className="account-link-icon" aria-hidden="true">{r.icone}</span>
              <span className="account-link-text">
                <b>{r.titre}</b>
                <span className="small">{r.sous}</span>
              </span>
              <span className="account-link-chevron" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🌍 {t('account.language')}</h3>
        <p className="small" style={{ margin: '0 0 10px', opacity: 0.75 }}>{t('account.languageHelp')}</p>
        <LanguageSwitcher />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🔒 Coordonnées de connexion</h3>
        <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>
          Un code de confirmation est envoyé par email à ton adresse actuelle avant tout changement d'email ou de téléphone.
        </p>
        <ContactChangeField
          field="email" label="Adresse email" currentValue={user.email} type="email" placeholder="nouvelle@adresse.com"
          requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
        />
        <div className="divider" style={{ margin: '4px 0' }} />
        <ContactChangeField
          field="phone" label="Numéro de téléphone" currentValue={user.phone} type="tel" placeholder="04xx xx xx xx"
          requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
        />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🧭 Notre histoire</h3>
        <p className="small" style={{ margin: '0 0 14px', opacity: 0.75 }}>Pourquoi Fairide existe, et ce vers quoi la plateforme avance.</p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Le constat</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Sur les grandes plateformes de livraison, les commerces locaux perdent souvent entre 22 et 32% du montant de chaque commande en commission,
          une part qui pèse lourd sur leurs marges et qui finit parfois par se répercuter sur les prix payés par les clients. Les livreurs, de leur côté,
          ne touchent pas toujours l'intégralité des frais de livraison réglés par le client. Fairide est né de ce constat simple : il devait être possible
          de connecter commerces, clients et livreurs sans qu'une plateforme capte une part disproportionnée de la valeur créée par chacun.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre mission</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Donner aux commerces indépendants de Bruxelles (restaurants, supermarchés, commerces de quartier) un moyen de proposer la livraison et la vente en
          ligne sans commission excessive, et permettre aux livreurs d'être rémunérés justement pour leur travail. Fairide veut démontrer qu'un modèle de
          livraison plus équitable est possible, sans sacrifier la qualité de service pour les clients.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre démarche</h4>
        <ul className="small" style={{ margin: '0 0 14px', paddingLeft: 18 }}>
          <li>Une commission plafonnée à 10% du montant des produits pour les commerces partenaires, contre 22 à 32% sur les grandes plateformes.</li>
          <li>Les livreurs touchent 100% des frais de livraison réglés pour leur course.</li>
          <li>Des frais annoncés clairement aux commerces comme aux clients, sans commission cachée.</li>
          <li>Aucun matériel n'est imposé aux commerces partenaires : un simple appareil avec un navigateur suffit pour recevoir et traiter les commandes.</li>
        </ul>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Notre identité</h4>
        <p className="small" style={{ margin: '0 0 14px' }}>
          Fairide est conçue et opérée depuis la Belgique, par des Belges, pour des Belges. La plateforme est aujourd'hui active dans 19 communes
          bruxelloises et met un point d'honneur à soutenir le commerce local et les indépendants qui font vivre le quartier, pour que la valeur créée
          profite d'abord à Bruxelles.
        </p>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Nos valeurs</h4>
        <ul className="small" style={{ margin: '0 0 14px', paddingLeft: 18 }}>
          <li><b>Équité</b> : envers les commerces, qui gardent une plus grande part de leurs revenus, et envers les livreurs, justement payés.</li>
          <li><b>Transparence</b> : des frais clairs et compréhensibles, communiqués sans surprise.</li>
          <li><b>Proximité</b> : un ancrage bruxellois, au service des commerces et des habitants du quartier.</li>
          <li><b>Simplicité</b> : une plateforme facile à utiliser, sans matériel imposé ni complexité inutile.</li>
        </ul>

        <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Nos objectifs</h4>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Continuer à étendre la couverture de Fairide à davantage de communes bruxelloises.</li>
          <li>Lancer prochainement l'application mobile, disponible sur iOS, Android et AppGallery.</li>
          <li>Faire grandir le réseau de commerces et de livreurs partenaires, tout en conservant un modèle de commission juste et durable, pas seulement une offre de lancement.</li>
          <li>Rester fidèle, sur le long terme, à l'engagement d'une livraison à commission réduite.</li>
        </ul>
      </div>

      {/* Rubriques qu'on ouvre de temps en temps, sorties de la barre du bas : neuf onglets n'y
          tenaient pas, et sous 520px ils deviennent des icônes muettes où l'on ne distingue plus
          rien. Ici elles gardent leur nom en toutes lettres. */}
      {role === 'restaurant' && restaurant && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {[
            { to: '/dashboard/reservations', icone: '📅', titre: 'Réservations', sous: 'Ton agenda du jour, table par table' },
            { to: '/dashboard/tables', icone: '🪑', titre: 'Plan de salle', sous: 'Tes tables et tes créneaux de réservation' },
            { to: '/dashboard/promotions', icone: '🏷️', titre: 'Promotions', sous: 'Réductions et offres sur ta carte' },
            { to: '/dashboard/invoices', icone: '📄', titre: 'Factures', sous: 'Tes factures de commission' },
            { to: '/dashboard/guide', icone: '📘', titre: "Mode d'emploi", sous: 'Comment gérer ton commerce sur Fairide' }
          ].map((r) => (
            <Link key={r.to} to={r.to} className="account-link-row">
              <span className="account-link-icon" aria-hidden="true">{r.icone}</span>
              <span className="account-link-text">
                <b>{r.titre}</b>
                <span className="small">{r.sous}</span>
              </span>
              <span className="account-link-chevron" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card" style={{ border: `2px solid ${['active', 'trialing'].includes(restaurant.subscriptionStatus) ? 'var(--teal)' : 'var(--red)'}` }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>💳 Abonnement</h3>
          <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
            {now.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}
          </p>

          {restaurant.subscriptionStatus === 'trialing' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>✅ Essai gratuit en cours</h4>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant est visible aux clients. Le premier mois est offert pour tout restaurant, dans tous les cas
                {restaurant.freeTrialMonths > 1 ? ` — et comme ton restaurant fait partie des premiers inscrits sur Fairide, tu profites en réalité de ${restaurant.freeTrialMonths} mois offerts au total` : ''}
                {restaurant.subscriptionCurrentPeriodEnd ? ` (premier prélèvement de 20€ le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}).` : '.'}
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'active' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>✅ Abonnement actif</h4>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant est visible aux clients.
                {restaurant.subscriptionCurrentPeriodEnd ? ` Prochain prélèvement (20€) le ${new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ''}
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'past_due' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>⚠️ Paiement de l'abonnement échoué</h4>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Le dernier prélèvement de ton abonnement Fairide (20€/mois) a échoué. Ton restaurant n'est plus visible aux clients tant que ce n'est pas régularisé.
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'paused' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>⏸️ Abonnement en pause</h4>
              <p className="small" style={{ margin: '0 0 12px' }}>
                Ton restaurant n'est plus visible aux clients et ne reçoit plus de commandes. Aucun prélèvement tant qu'il reste en pause.
              </p>
            </>
          )}
          {restaurant.subscriptionStatus === 'canceled' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>❌ Abonnement résilié</h4>
              <p className="small" style={{ margin: '0 0 12px' }}>Ton restaurant n'est plus visible aux clients.</p>
            </>
          )}
          {restaurant.subscriptionStatus === 'inactive' && (
            <>
              <h4 style={{ margin: '0 0 6px', fontSize: 15 }}>🔒 Restaurant pas encore visible aux clients</h4>
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
                <label>{t('auth.promoCode')}</label>
                <input value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
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
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🛎️ Services proposés</h3>
          <p className="small" style={{ margin: '0 0 12px' }}>
            Choisis les modes de commande que ton restaurant propose à ses clients — n'importe quelle combinaison, au moins un doit rester actif.
            Si seule la réservation est activée, tes clients ne pourront pas commander en ligne : ils ne verront que la carte et un bouton pour réserver une table.
          </p>
          <div className="service-table-wrap">
            <table className="service-table">
              <thead>
                <tr><th>Service</th><th className="col-actif">Proposé</th><th>Ce que ça change pour le client</th></tr>
              </thead>
              <tbody>
                {[
                  { cle: 'delivery', icone: '🚴', nom: 'Livraison', valeur: offersDelivery, set: setOffersDelivery,
                    effet: 'Il commande en ligne et se fait livrer à son adresse.' },
                  { cle: 'pickup', icone: '🥡', nom: 'À emporter', valeur: offersPickup, set: setOffersPickup,
                    effet: 'Il commande et paie en ligne, puis vient chercher sa commande.' },
                  { cle: 'dine_in', icone: '🍽️', nom: 'Réservation de table', valeur: offersDineIn, set: setOffersDineIn,
                    effet: 'Il réserve une table en indiquant le nombre de personnes, sans commander en ligne.' }
                ].map((s) => (
                  <tr key={s.cle} className={s.valeur ? '' : 'service-off'}>
                    <td><b>{s.icone} {s.nom}</b></td>
                    <td className="col-actif">
                      {/* Le libellé rend toute la cellule cliquable, et nomme la case pour un lecteur d'écran :
                          une case seule n'annoncerait que « coché », sans dire de quel service il s'agit. */}
                      <label className="service-toggle">
                        <input
                          type="checkbox"
                          checked={s.valeur}
                          disabled={savingServices}
                          onChange={(e) => s.set(e.target.checked)}
                        />
                        <span className="sr-only">{s.nom}</span>
                      </label>
                    </td>
                    <td className="small">{s.valeur ? s.effet : <i>Non proposé — ce mode n'apparaît pas sur ta fiche.</i>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Récapitulatif vivant : le restaurateur voit la conséquence de sa combinaison avant
              d'enregistrer, plutôt que d'avoir à la déduire de trois cases. */}
          <p className="small service-summary">
            {!offersDelivery && !offersPickup && !offersDineIn
              ? '⚠️ Au moins un service doit rester proposé.'
              : !offersDelivery && !offersPickup
                ? '🍽️ Tes clients verront ta carte mais ne pourront rien commander en ligne : seulement réserver une table.'
                : offersDelivery && offersPickup && offersDineIn
                  ? '✅ Tes clients peuvent se faire livrer, venir chercher leur commande, ou réserver une table.'
                  : `Tes clients pourront : ${[offersDelivery && 'se faire livrer', offersPickup && 'venir chercher leur commande', offersDineIn && 'réserver une table'].filter(Boolean).join(', ')}.`}
          </p>
          <button className="btn-teal" disabled={savingServices} onClick={saveServices}>{savingServices ? '...' : t('common.save')}</button>
        </div>
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>⭐ Avis clients</h3>
              <div className="row" style={{ gap: 6 }}>
                <StarsDisplay value={restaurant.rating} />
                <span className="small">{restaurant.reviewCount > 0 ? `${restaurant.rating.toFixed(1)} (${restaurant.reviewCount} avis)` : "Pas encore d'avis"}</span>
              </div>
            </div>
            <Link to="/dashboard/reviews" className="btn-ghost">Voir tous les avis →</Link>
          </div>
        </div>
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>📄 Factures</h3>
              <p className="small" style={{ margin: 0 }}>Factures d'abonnement et de commission, par mois et par année.</p>
            </div>
            <Link to="/dashboard/invoices" className="btn-ghost">Voir mes factures →</Link>
          </div>
        </div>
      )}

      {role === 'restaurant' && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>📘 Mode d'emploi</h3>
              <p className="small" style={{ margin: 0 }}>Comment recevoir et traiter les commandes Fairide au quotidien, sans matériel imposé.</p>
            </div>
            <Link to="/dashboard/guide" className="btn-ghost">Voir le mode d'emploi →</Link>
          </div>
        </div>
      )}

      {role === 'driver' && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('account.geoTitle')}</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>
            {t('account.geoExplain')}
          </p>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={locationSharingEnabled} disabled={savingLocationSharing} onChange={toggleLocationSharing} />
            <span className="small">{t('account.geoToggleLabel')}</span>
          </label>
        </div>
      )}

      {role === 'driver' && <DriverActivity deliveries={driverDeliveries} reviews={driverReviews} t={t} />}

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('account.referral.title')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t(`account.referral.how.${role}`)}</p>
        {referralStats && (
          <>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input readOnly value={referralStats.code} style={{ fontWeight: 700, letterSpacing: 1 }} />
              </div>
              <button type="button" className="btn-teal" onClick={copyReferralCode}>{t('account.referral.copy')}</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="num">{referralStats.referredCount}</div>
                <div className="label">{t('account.referral.statInvited')}</div>
              </div>
              <div className="stat-card highlight" style={{ flex: 1 }}>
                <div className="num">{referralStats.earnedTotal.toFixed(2)}€</div>
                <div className="label">{t('account.referral.statEarned')}</div>
              </div>
            </div>
            {referralStats.pendingCount > 0 && (
              <p className="small" style={{ margin: '10px 0 0' }}>{t('account.referral.pending', { count: referralStats.pendingCount })}</p>
            )}
            <p className="small" style={{ margin: '10px 0 0', opacity: 0.75 }}>{t('account.referral.spendOnly')}</p>
          </>
        )}
      </div>

      {(role === 'restaurant' || role === 'driver') && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('account.convert.title')}</h3>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('account.convert.explain')}</p>
          <div className="stat-card highlight" style={{ marginBottom: 14 }}>
            <div className="num">{Number(user.balance || 0).toFixed(2)}€</div>
            <div className="label">{t('account.convert.balanceLabel')}</div>
          </div>
          <form onSubmit={handleConvert} className="row" style={{ gap: 8, marginBottom: generatedCodes?.length ? 14 : 0 }}>
            <div className="field" style={{ flex: 1, margin: 0 }}>
              <input type="number" step="0.01" min="5" value={convertAmount} onChange={(e) => setConvertAmount(e.target.value)} placeholder={t('account.convert.amountPlaceholder')} />
            </div>
            <button type="submit" className="btn-teal" disabled={converting}>{converting ? '...' : t('account.convert.button')}</button>
          </form>
          {generatedCodes && generatedCodes.length > 0 && (
            <div>
              <div className="small" style={{ margin: '4px 0 6px', fontWeight: 600 }}>{t('account.convert.myCodes')}</div>
              {generatedCodes.map((c) => (
                <div key={c.code} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontWeight: 700, letterSpacing: 1 }}>{c.code}</span>
                  <span className="small">{c.amount.toFixed(2)}€</span>
                  <span className={`pill ${c.used ? '' : 'teal'}`}>{c.used ? t('account.convert.used') : t('account.convert.unused')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>{t('account.passwordTitle')}</h3>
        <form onSubmit={savePassword}>
          <div className="field">
            <label>{t('account.currentPassword')}</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('account.newPassword')}</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('account.newPasswordPlaceholder')} />
          </div>
          <button type="submit" className="btn-outline" disabled={savingPassword}>{savingPassword ? '...' : t('account.changePassword')}</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--red)' }}>{t('account.deleteTitle')}</h3>
        {!confirmDeleteOpen && (
          <button className="btn-danger-ghost" onClick={() => setConfirmDeleteOpen(true)}>{t('account.deleteButton')}</button>
        )}
        {confirmDeleteOpen && (
          <div>
            <p className="small" style={{ color: 'var(--red)', marginBottom: 10 }}>
              {t('account.deleteWarning')}
            </p>

            {!deleteCodeSent && (
              <>
                <div className="field">
                  <label>{t('account.deleteWhy')}</label>
                  <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                    {DELETION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('account.deleteComment')}</label>
                  <input value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder={t('account.deleteCommentPlaceholder')} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingCode} onClick={handleSendDeleteCode}>
                    {sendingCode ? '...' : t('account.deleteRequestCode')}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmDeleteOpen(false)}>{t('common.cancel')}</button>
                </div>
              </>
            )}

            {deleteCodeSent && (
              <>
                <p className="small" style={{ marginBottom: 10 }}>
                  {role === 'client' ? t('account.deleteCodeSentText') : t('account.deleteCodeSentTextAdmin')}
                </p>
                <div className="field">
                  <label>{t('account.deleteCodeLabel')}</label>
                  <input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={handleDeleteAccount}>
                    {deleting ? '...' : t('account.deleteConfirmFinal')}
                  </button>
                  <button className="btn-ghost" disabled={sendingCode} onClick={handleSendDeleteCode}>{t('auth.resendCode')}</button>
                  <button className="btn-ghost" onClick={() => { setConfirmDeleteOpen(false); setDeleteCodeSent(false); setDeleteCode(''); }}>{t('common.cancel')}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <button className="btn-danger-ghost" onClick={logout}>{t('nav.logout')}</button>
    </div>
  );
}

// Un champ (email OU téléphone) avec son propre flux demande-code / confirme-code, indépendant de
// saveInfo() ci-dessus : la nouvelle valeur n'est jamais envoyée telle quelle à confirmContactChange
// tant qu'un code valide n'est pas fourni, donc rien à gérer côté état global du formulaire principal.
function ContactChangeField({ field, label, currentValue, type, placeholder, requestContactChange, confirmContactChange, toast }) {
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function cancel() {
    setEditing(false);
    setCodeSent(false);
    setNewValue('');
    setCode('');
  }

  async function sendCode() {
    if (!newValue.trim()) { toast('Renseigne la nouvelle valeur.'); return; }
    setSending(true);
    try {
      await requestContactChange(field, newValue.trim());
      setCodeSent(true);
      toast('Code envoyé par email à ton adresse actuelle.');
    } catch (e) {
      toast(e.message);
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    if (!code.trim()) { toast('Code requis.'); return; }
    setConfirming(true);
    try {
      await confirmContactChange(field, newValue.trim(), code.trim());
      toast(`${label} mis à jour.`);
      cancel();
    } catch (e) {
      toast(e.message);
    } finally {
      setConfirming(false);
    }
  }

  if (!editing) {
    return (
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <div>
          <div className="small" style={{ opacity: 0.7 }}>{label}</div>
          <div>{currentValue || '—'}</div>
        </div>
        <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setEditing(true)}>Changer</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div className="small" style={{ opacity: 0.7, marginBottom: 4 }}>{label}</div>
      {!codeSent ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, margin: 0, minWidth: 180 }}>
            <input type={type} value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder={placeholder} />
          </div>
          <button type="button" className="btn-teal" disabled={sending} onClick={sendCode}>{sending ? '...' : 'Envoyer le code'}</button>
          <button type="button" className="btn-ghost" onClick={cancel}>Annuler</button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>
            Code envoyé par email à ton adresse actuelle{field === 'phone' ? " (pas encore de SMS chez Fairide)" : ''} pour confirmer le passage à <b>{newValue}</b>.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            </div>
            <button type="button" className="btn-teal" disabled={confirming} onClick={confirm}>{confirming ? '...' : 'Confirmer'}</button>
            <button type="button" className="btn-ghost" disabled={sending} onClick={sendCode}>Renvoyer</button>
            <button type="button" className="btn-ghost" onClick={cancel}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Résumé compact de l'activité du livreur sur la page Mon compte — les détails (avis, historique de
// livraisons, pourboires) vivent chacun sur leur propre page dédiée (Avis, Pourboires, Mes commandes),
// pas besoin de les dupliquer ici.
function DriverActivity({ deliveries, reviews, t }) {
  if (!deliveries) return null;

  const delivered = deliveries.filter((o) => o.status === 'livre');
  const totalDeliveryFees = delivered.reduce((a, o) => a + o.deliveryFee, 0);
  const totalTips = delivered.filter((o) => o.tipPaid && o.tipAmount > 0).reduce((a, o) => a + o.tipAmount, 0);

  return (
    <>
      <h2 className="section-title">{t('account.driverActivityTitle')}</h2>
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">{t('account.deliveriesDone')}</div></div>
        <div className="stat-card highlight"><div className="num">{(totalDeliveryFees + totalTips).toFixed(2)}€</div><div className="label">{t('account.estimatedEarnings')}</div></div>
        <div className="stat-card">
          <div className="num" style={{ fontSize: 18 }}><StarsDisplay value={reviews?.avg || 0} size={18} /></div>
          <div className="label">{reviews?.count > 0 ? t('restaurantMenu.ratingReviews', { rating: reviews.avg.toFixed(1), count: reviews.count }) : t('account.noReviewsYet')}</div>
        </div>
      </div>
    </>
  );
}
