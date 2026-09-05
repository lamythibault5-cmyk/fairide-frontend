import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LigneCompte from '../components/LigneCompte';
import { StarsDisplay } from '../components/Stars';

// La page Mon compte : un menu de rangées (icône, titre, sous-titre, chevron) groupées en cartes, du
// même dessin partout. Une rangée mène soit à une page (lien), soit à une action (bouton), soit se
// DÉPLIE sur place pour montrer un formulaire — les infos, le mot de passe, la langue, le solde, le
// parrainage… Repliées par défaut : la page se lit d'un coup d'œil, chaque réglage est à un geste, et
// on n'a plus sept formulaires ouverts les uns sous les autres.
//
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

const LANGUE_LABEL = { fr: 'Français', en: 'English', nl: 'Nederlands' };

const ABONNEMENT_RESUME = {
  trialing: 'subTrialing', active: 'subActive', past_due: 'subPastDueShort', paused: 'subPausedShort', canceled: 'subCanceledShort', inactive: 'subNotVisible'
};

export default function Account() {
  const { user, role, token, updateProfile, refreshUser, requestContactChange, confirmContactChange, requestDeletionCode, deleteAccount, logout } = useAuth();
  const toast = useToast();

  // Partage natif là où il existe (téléphones, Safari), presse-papiers ailleurs. Le refus de la
  // feuille de partage lève AbortError : ce n'est pas une panne, c'est un utilisateur qui a changé
  // d'avis — lui afficher une erreur serait lui reprocher son geste.
  async function partagerFairide() {
    const lien = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Fairide',
          text: t('accountUi.shareText'),
          url: lien
        });
        return;
      }
      await navigator.clipboard.writeText(lien);
      toast(t('accountUi.toastLinkCopied', { link: lien }));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      toast(t('accountUi.toastShareUnavailable', { link: lien }));
    }
  }
  const { t, language, locale } = useLanguage();
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

  // Les rangées dépliées. Plusieurs peuvent l'être à la fois : replier la précédente quand on en
  // ouvre une autre ferait disparaître ce qu'on était en train de comparer.
  const [ouvertes, setOuvertes] = useState(() => new Set());
  function basculer(cle) {
    setOuvertes((prev) => { const n = new Set(prev); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }
  // « Adresse de livraison » ne mène pas à une page : Fairide retient UNE adresse, celle du profil. La
  // ligne déplie « Mes infos » et met le curseur dans la rue, une fois le formulaire rendu.
  function ouvrirAdresse() {
    setOuvertes((prev) => new Set(prev).add('infos'));
    setTimeout(() => {
      const champ = document.getElementById('champ-adresse');
      if (!champ) return;
      const anime = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      champ.scrollIntoView({ block: 'center', behavior: anime ? 'smooth' : 'auto' });
      champ.focus({ preventScroll: true });
    }, 60);
  }

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
      toast(t('accountUi.toastSubActivating'));
      window.history.replaceState({}, '', '/account');
      setOuvertes((prev) => new Set(prev).add('abonnement'));
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
      toast(t('accountUi.toastOneService'));
      return;
    }
    setSavingServices(true);
    try {
      await api(`/restaurants/${restoId}/services`, { method: 'PATCH', token, body: { offersDelivery, offersPickup, offersDineIn } });
      refreshRestaurant();
      toast(t('accountUi.toastServicesUpdated'));
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
      toast(t('accountUi.toastSubPaused'));
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
      toast(t('accountUi.toastSubResumed'));
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
      toast(t('accountUi.toastSubCanceled'));
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

  const nomComplet = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initiales = (nomComplet || user.email || '?').split(/[\s@]+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase();
  const adresseResume = user.addressStreet && user.addressCity ? `${user.addressStreet} ${user.addressNumber || ''}, ${user.addressCity}`.replace(' ,', ',') : null;
  const solde = Number(user.balance || 0).toFixed(2);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('account.title')}</h2>

      {/* Qui est connecté : nom, e-mail, rôle. Une carte d'identité, pas un formulaire — les
          modifications se font dans les rangées en dessous. */}
      <div className="card account-identite">
        <span className="account-avatar" aria-hidden="true">{initiales}</span>
        <div className="account-identite-texte">
          <b>{nomComplet || user.email}</b>
          {nomComplet && <span className="small">{user.email}</span>}
        </div>
        <span className="pill teal">{ROLE_LABEL[role] || role}</span>
      </div>

      {/* ——— Mon profil : tout ce qui décrit la personne et son accès. ——— */}
      <div className="card account-groupe" aria-label={t('accountUi.myProfile')}>
        <LigneCompte icone="👤" titre={t('accountUi.myInfo')} sous={adresseResume || t('accountUi.profileSub')} ouverte={ouvertes.has('infos')} onClick={() => basculer('infos')}>
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
                <input id="champ-adresse" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
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

          {/* Supprimer le compte : au bout des infos personnelles, puisque c'est d'elles qu'il s'agit.
              Séparé par un filet et discret tant qu'on ne l'a pas demandé — on ne met pas un bouton
              rouge en pleine page pour un geste qu'on fait une fois. */}
          <div className="account-zone-danger">
            <b className="account-zone-danger-titre">{t('account.deleteTitle')}</b>
            {!confirmDeleteOpen && (
              <button type="button" className="btn-danger-ghost" onClick={() => setConfirmDeleteOpen(true)}>{t('account.deleteButton')}</button>
            )}
            {confirmDeleteOpen && (
              <div>
                <p className="small" style={{ color: 'var(--red)', marginBottom: 10 }}>{t('account.deleteWarning')}</p>
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
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingCode} onClick={handleSendDeleteCode}>
                        {sendingCode ? '...' : t('account.deleteRequestCode')}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteOpen(false)}>{t('common.cancel')}</button>
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
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={handleDeleteAccount}>
                        {deleting ? '...' : t('account.deleteConfirmFinal')}
                      </button>
                      <button type="button" className="btn-ghost" disabled={sendingCode} onClick={handleSendDeleteCode}>{t('auth.resendCode')}</button>
                      <button type="button" className="btn-ghost" onClick={() => { setConfirmDeleteOpen(false); setDeleteCodeSent(false); setDeleteCode(''); }}>{t('common.cancel')}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </LigneCompte>

        <LigneCompte icone="🔒" titre={t('accountUi.loginDetails')} sous={user.phone ? `${user.email} · ${user.phone}` : user.email} ouverte={ouvertes.has('connexion')} onClick={() => basculer('connexion')}>
          <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>
            {t('accountUi.contactCodeInfo')}
          </p>
          <ContactChangeField
            field="email" label={t('accountUi.emailAddress')} currentValue={user.email} type="email" placeholder={t('accountUi.phNewEmail')}
            requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
          />
          <div className="divider" style={{ margin: '4px 0' }} />
          <ContactChangeField
            field="phone" label={t('accountUi.phoneNumber')} currentValue={user.phone} type="tel" placeholder={t('accountUi.phPhone')}
            requestContactChange={requestContactChange} confirmContactChange={confirmContactChange} toast={toast}
          />
        </LigneCompte>

        <LigneCompte icone="🔑" titre={t('account.passwordTitle')} sous={t('accountUi.newPasswordSub')} ouverte={ouvertes.has('mdp')} onClick={() => basculer('mdp')}>
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
        </LigneCompte>

        {/* Langue de l'interface. Elle vivait dans la barre latérale, où elle était visible en permanence
            — mais une barre de navigation n'est pas l'endroit d'un réglage. Le choix est mémorisé dans
            localStorage (voir LanguageContext) : on ne le règle qu'une fois. Sa place est donc ici. */}
        <LigneCompte icone="🌍" titre={t('account.language')} sous={LANGUE_LABEL[language] || language} ouverte={ouvertes.has('langue')} onClick={() => basculer('langue')}>
          <p className="small" style={{ margin: '0 0 10px', opacity: 0.75 }}>{t('account.languageHelp')}</p>
          <LanguageSwitcher />
        </LigneCompte>

        {role === 'driver' && (
          <LigneCompte icone="📡" titre={t('account.geoTitle')} sous={locationSharingEnabled ? t('accountUi.sharingOn') : t('accountUi.sharingOff')} ouverte={ouvertes.has('geo')} onClick={() => basculer('geo')}>
            <p className="small" style={{ margin: '0 0 10px' }}>{t('account.geoExplain')}</p>
            <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={locationSharingEnabled} disabled={savingLocationSharing} onChange={toggleLocationSharing} />
              <span className="small">{t('account.geoToggleLabel')}</span>
            </label>
          </LigneCompte>
        )}
      </div>

      {/* ——— Solde et avantages. ——— */}
      <div className="card account-groupe" aria-label={t('accountUi.balanceBenefits')}>
        {role === 'client' && (
          <LigneCompte icone="💰" titre={t('accountUi.myBalance')} sous={t('accountUi.balanceSub', { balance: solde })} ouverte={ouvertes.has('solde')} onClick={() => basculer('solde')}>
            <div className="stat-card highlight" style={{ marginBottom: 14 }}>
              <div className="num">{solde}€</div>
              <div className="label">{t('account.balance')}</div>
            </div>
            <form onSubmit={handleRedeemCode} className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1, margin: 0 }}>
                <input value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder={t('account.redeemPlaceholder')} />
              </div>
              <button type="submit" className="btn-teal" disabled={redeeming}>{redeeming ? '...' : t('account.redeemButton')}</button>
            </form>
          </LigneCompte>
        )}

        {(role === 'restaurant' || role === 'driver') && (
          <LigneCompte icone="💰" titre={t('account.convert.title')} sous={`${solde}€ disponibles`} ouverte={ouvertes.has('convertir')} onClick={() => basculer('convertir')}>
            <p className="small" style={{ margin: '0 0 12px' }}>{t('account.convert.explain')}</p>
            <div className="stat-card highlight" style={{ marginBottom: 14 }}>
              <div className="num">{solde}€</div>
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
          </LigneCompte>
        )}

        <LigneCompte icone="🎁" titre={t('account.referral.title')} sous={referralStats ? t('accountUi.referralSummary', { code: referralStats.code, earned: referralStats.earnedTotal.toFixed(2) }) : t('accountUi.referralSub')} ouverte={ouvertes.has('parrainage')} onClick={() => basculer('parrainage')}>
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
        </LigneCompte>
      </div>

      {/* ——— Selon le rôle. Une rubrique ne figure qu'à UN endroit : ce qui est dans la barre du bas
          (restaurants, recherche, commandes, favoris, carte) n'est pas repris ici. ———
          Client : « Moyens de paiement » et « Titres restaurant » mènent à une réponse écrite, pas à un
          réglage — Fairide n'enregistre pas de carte et n'accepte pas encore les titres-restaurant. */}
      {role === 'client' && (
        <div className="card account-groupe" aria-label={t('accountUi.ordersAndFairide')}>
          <LigneCompte to="/invoices" icone="📄" titre={t('accountUi.myInvoices')} sous={t('accountUi.invoicesSub')} />
          <LigneCompte icone="📍" titre={t('accountUi.deliveryAddress')} sous={adresseResume || t('accountUi.addressSub')} onClick={ouvrirAdresse} />
          <LigneCompte to="/aide?sujet=paiement" icone="💳" titre={t('accountUi.paymentMethods')} sous={t('accountUi.paymentSub')} />
          <LigneCompte to="/aide?sujet=titres-restaurant" icone="🎫" titre={t('accountUi.mealVouchers')} sous={t('accountUi.mealVouchersSub')} />
          <LigneCompte to="/notre-histoire" icone="🧭" titre={t('accountUi.ourStory')} sous={t('accountUi.ourStorySub')} />
        </div>
      )}

      {role === 'restaurant' && restaurant && (
        <div className="card account-groupe" aria-label={t('accountUi.myBusiness')}>
          <LigneCompte icone="💳" titre={t('accountUi.subscription')} sous={ABONNEMENT_RESUME[restaurant.subscriptionStatus] ? t(`accountUi.${ABONNEMENT_RESUME[restaurant.subscriptionStatus]}`) : restaurant.subscriptionStatus} ouverte={ouvertes.has('abonnement')} onClick={() => basculer('abonnement')}>
            <p className="small" style={{ margin: '0 0 10px', opacity: 0.7 }}>
              {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
            </p>
            {restaurant.subscriptionStatus === 'trialing' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subTrialIntro')}
                {restaurant.freeTrialMonths > 1 ? t('accountUi.subEarlyBird', { n: restaurant.freeTrialMonths }) : ''}
                {restaurant.subscriptionCurrentPeriodEnd ? t('accountUi.subFirstCharge', { date: new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }) : '.'}
              </p>
            )}
            {restaurant.subscriptionStatus === 'active' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subVisibleIntro')}
                {restaurant.subscriptionCurrentPeriodEnd ? t('accountUi.subNextCharge', { date: new Date(restaurant.subscriptionCurrentPeriodEnd).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }) : ''}
              </p>
            )}
            {restaurant.subscriptionStatus === 'past_due' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subPastDue')}
              </p>
            )}
            {restaurant.subscriptionStatus === 'paused' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subPaused')}
              </p>
            )}
            {restaurant.subscriptionStatus === 'canceled' && (
              <p className="small" style={{ margin: '0 0 12px' }}>{t('accountUi.subCanceled')}</p>
            )}
            {restaurant.subscriptionStatus === 'inactive' && (
              <p className="small" style={{ margin: '0 0 12px' }}>
                {t('accountUi.subInactiveIntro')}
                {restaurant.freeTrialMonths > 1 ? t('accountUi.subEarlyBird2', { n: restaurant.freeTrialMonths }) : ''}
                {' '}{t('accountUi.subPendingValidation')}
              </p>
            )}

            {['inactive', 'past_due', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.adminStatus !== 'approved' && (
              <p className="small" style={{ margin: '0 0 12px', fontStyle: 'italic', opacity: 0.75 }}>
                {t('accountUi.subLocked')}
              </p>
            )}
            {['inactive', 'past_due', 'canceled'].includes(restaurant.subscriptionStatus) && restaurant.adminStatus === 'approved' && (
              <div>
                <div className="field" style={{ maxWidth: 260 }}>
                  <label>{t('auth.promoCode')}</label>
                  <input value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
                </div>
                <button className="btn-gold" disabled={subscribing} onClick={subscribeNow}>
                  {subscribing ? '...' : t('accountUi.subscribeBtn', { months: restaurant.freeTrialMonths > 1 ? t('accountUi.freeMonths', { n: restaurant.freeTrialMonths }) : t('accountUi.firstMonthFree') })}
                </button>
              </div>
            )}
            {['trialing', 'active', 'past_due'].includes(restaurant.subscriptionStatus) && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-ghost" disabled={pausingSub} onClick={pauseSubscription}>{pausingSub ? '...' : t('accountUi.pauseSub')}</button>
                {!confirmCancelSub && (
                  <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>{t('accountUi.cancelSub')}</button>
                )}
              </div>
            )}
            {restaurant.subscriptionStatus === 'paused' && (
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-teal" disabled={resumingSub} onClick={resumeSubscription}>{resumingSub ? '...' : 'Reprendre l\'abonnement'}</button>
                {!confirmCancelSub && (
                  <button className="btn-danger-ghost" onClick={() => setConfirmCancelSub(true)}>{t('accountUi.cancelSub')}</button>
                )}
              </div>
            )}
            {confirmCancelSub && (
              <div style={{ marginTop: 10 }}>
                <p className="small" style={{ color: 'var(--red)', marginBottom: 8 }}>
                  {t('accountUi.cancelSubConfirm')}
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={cancelingSub} onClick={cancelSubscription}>
                    {cancelingSub ? '...' : t('accountUi.yesCancel')}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmCancelSub(false)}>{t('accountUi.cancel')}</button>
                </div>
              </div>
            )}
          </LigneCompte>

          <LigneCompte
            icone="🛎️" titre={t('accountUi.servicesOffered')}
            sous={[offersDelivery && t('accountUi.delivery'), offersPickup && t('accountUi.pickup'), offersDineIn && t('accountUi.reservation')].filter(Boolean).join(' · ') || 'Aucun service actif'}
            ouverte={ouvertes.has('services')} onClick={() => basculer('services')}
          >
            <p className="small" style={{ margin: '0 0 12px' }}>
              {t('accountUi.servicesIntro')}
            </p>
            <div className="service-table-wrap">
              <table className="service-table">
                <thead>
                  <tr><th>{t('accountUi.service')}</th><th className="col-actif">{t('accountUi.offered')}</th><th>{t('accountUi.whatChanges')}</th></tr>
                </thead>
                <tbody>
                  {[
                    { cle: 'delivery', icone: '🚴', nom: t('accountUi.delivery'), valeur: offersDelivery, set: setOffersDelivery,
                      effet: t('accountUi.svcDeliveryDesc') },
                    { cle: 'pickup', icone: '🥡', nom: t('accountUi.pickup'), valeur: offersPickup, set: setOffersPickup,
                      effet: t('accountUi.svcPickupDesc') },
                    { cle: 'dine_in', icone: '🍽️', nom: t('accountUi.svcReservation'), valeur: offersDineIn, set: setOffersDineIn,
                      effet: t('accountUi.svcReservationDesc') }
                  ].map((s) => (
                    <tr key={s.cle} className={s.valeur ? '' : 'service-off'}>
                      <td><b>{s.icone} {s.nom}</b></td>
                      <td className="col-actif">
                        {/* Le libellé rend toute la cellule cliquable, et nomme la case pour un lecteur d'écran :
                            une case seule n'annoncerait que « coché », sans dire de quel service il s'agit. */}
                        <label className="service-toggle">
                          <input type="checkbox" checked={s.valeur} disabled={savingServices} onChange={(e) => s.set(e.target.checked)} />
                          <span className="sr-only">{s.nom}</span>
                        </label>
                      </td>
                      <td className="small">{s.valeur ? s.effet : <i>{t('accountUi.notOffered')}</i>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Récapitulatif vivant : le restaurateur voit la conséquence de sa combinaison avant
                d'enregistrer, plutôt que d'avoir à la déduire de trois cases. */}
            <p className="small service-summary">
              {!offersDelivery && !offersPickup && !offersDineIn
                ? t('accountUi.oneServiceWarn')
                : !offersDelivery && !offersPickup
                  ? t('accountUi.onlyReservationInfo')
                  : offersDelivery && offersPickup && offersDineIn
                    ? t('accountUi.allServicesInfo')
                    : t('accountUi.someServicesInfo', { list: [offersDelivery && t('accountUi.svcListDelivery'), offersPickup && t('accountUi.svcListPickup'), offersDineIn && t('accountUi.svcListReservation')].filter(Boolean).join(', ') })}
            </p>
            <button className="btn-teal" disabled={savingServices} onClick={saveServices}>{savingServices ? '...' : t('common.save')}</button>
          </LigneCompte>

          {/* Rubriques qu'on ouvre de temps en temps, sorties de la barre du bas : neuf onglets n'y
              tenaient pas, et sous 520px ils deviennent des icônes muettes. Ici elles gardent leur nom. */}
          <LigneCompte to="/dashboard/reservations" icone="📅" titre={t('accountUi.reservations')} sous={t('accountUi.reservationsSub')} />
          <LigneCompte to="/dashboard/reservations?onglet=salle" icone="🪑" titre={t('accountUi.floorPlan')} sous={t('accountUi.floorPlanSub')} />
          <LigneCompte to="/dashboard/reservations?onglet=reglages" icone="⚙️" titre={t('accountUi.reservationRules')} sous={t('accountUi.reservationRulesSub')} />
          <LigneCompte to="/dashboard/promotions" icone="🏷️" titre={t('accountUi.promotions')} sous={t('accountUi.promotionsSub')} />
          <LigneCompte to="/dashboard/invoices" icone="📄" titre={t('accountUi.invoices')} sous={t('accountUi.commissionInvoicesSub')} />
          <LigneCompte to="/dashboard/guide" icone="📘" titre={t('accountUi.guide')} sous={t('accountUi.guideSub')} />
          <LigneCompte to="/dashboard/reviews" icone="⭐" titre={t('accountUi.customerReviews')} sous={restaurant.reviewCount > 0 ? t('accountUi.ratingSummary', { rating: restaurant.rating.toFixed(1), count: restaurant.reviewCount }) : t('accountUi.noReviewsYet')} />
        </div>
      )}

      {/* Rubriques du livreur qu'on ouvre de temps en temps, sorties de la barre du bas au profit de ce
          qu'il consulte en course : commandes, carte, pourboires. */}
      {role === 'driver' && (
        <div className="card account-groupe" aria-label={t('accountUi.myRides')}>
          <LigneCompte icone="📊" titre={t('account.driverActivityTitle')} sous={driverDeliveries ? t('accountUi.deliveriesDone', { n: driverDeliveries.filter((o) => o.status === 'livre').length }) : '…'} ouverte={ouvertes.has('activite')} onClick={() => basculer('activite')}>
            <DriverActivity deliveries={driverDeliveries} reviews={driverReviews} t={t} />
          </LigneCompte>
          <LigneCompte to="/driver/reviews" icone="⭐" titre={t('accountUi.myReviews')} sous={t('accountUi.myReviewsSub')} />
          <LigneCompte to="/driver/invoices" icone="📄" titre={t('accountUi.myInvoices')} sous={t('accountUi.selfInvoicesSub')} />
        </div>
      )}

      {/* Assistance — commune à tous les rôles : un restaurateur ou un livreur a autant besoin de
          signaler un bug qu'un client. « Supprimer mon compte » n'y figure pas : il est au bout de
          « Mes infos », avec le reste de ce qui concerne la personne. */}
      <div className="card account-groupe" aria-label={t('accountUi.support')}>
        <LigneCompte to="/aide" icone="🛟" titre={t('accountUi.needHelp')} sous={t('accountUi.needHelpSub')} />
        <LigneCompte
          icone="💬" titre={t('accountUi.chat')} sous={t('accountUi.chatSub')}
          onClick={() => window.dispatchEvent(new Event('fairide:assistant-ouvrir'))}
        />
        <LigneCompte to="/aide?sujet=avis" icone="⭐" titre={t('accountUi.feedback')} sous={t('accountUi.feedbackSub')} />
        <LigneCompte icone="🔗" titre={t('accountUi.share')} sous={t('accountUi.shareSub')} onClick={partagerFairide} />
        <LigneCompte to="/aide?sujet=bug" icone="🐞" titre={t('accountUi.reportBug')} sous={t('accountUi.reportBugSub')} />
        {role !== 'client' && <LigneCompte to="/notre-histoire" icone="🧭" titre={t('accountUi.ourStory')} sous={t('accountUi.ourStorySub')} />}
      </div>

      <button className="btn-danger-ghost" onClick={logout}>{t('nav.logout')}</button>

      <p className="account-legal">
        <Link to="/confidentialite">{t('accountUi.privacy')}</Link>
        <Link to="/cgv">CGV</Link>
        <Link to="/mentions-legales">{t('accountUi.legalNotice')}</Link>
        <span className="account-build">Build {__BUILD_ID__}</span>
      </p>
    </div>
  );
}

// Un champ (email OU téléphone) avec son propre flux demande-code / confirme-code, indépendant de
// saveInfo() ci-dessus : la nouvelle valeur n'est jamais envoyée telle quelle à confirmContactChange
// tant qu'un code valide n'est pas fourni, donc rien à gérer côté état global du formulaire principal.
function ContactChangeField({ field, label, currentValue, type, placeholder, requestContactChange, confirmContactChange, toast }) {
  const { t } = useLanguage();
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
    if (!newValue.trim()) { toast(t('accountUi.toastNewValue')); return; }
    setSending(true);
    try {
      await requestContactChange(field, newValue.trim());
      setCodeSent(true);
      toast(t('accountUi.toastCodeSent'));
    } catch (e) {
      toast(e.message);
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    if (!code.trim()) { toast(t('accountUi.toastCodeRequired')); return; }
    setConfirming(true);
    try {
      await confirmContactChange(field, newValue.trim(), code.trim());
      toast(t('accountUi.toastFieldUpdated', { label }));
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
        <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setEditing(true)}>{t('accountUi.change')}</button>
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
          <button type="button" className="btn-teal" disabled={sending} onClick={sendCode}>{sending ? '...' : t('accountUi.sendCode')}</button>
          <button type="button" className="btn-ghost" onClick={cancel}>{t('accountUi.cancel')}</button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {t('accountUi.codeSentConfirmSwitch', { sms: field === 'phone' ? t('accountUi.noSmsYet') : '' })} <b>{newValue}</b>.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            </div>
            <button type="button" className="btn-teal" disabled={confirming} onClick={confirm}>{confirming ? '...' : 'Confirmer'}</button>
            <button type="button" className="btn-ghost" disabled={sending} onClick={sendCode}>{t('accountUi.resend')}</button>
            <button type="button" className="btn-ghost" onClick={cancel}>{t('accountUi.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Résumé compact de l'activité du livreur, dans sa rangée dépliable de la page Mon compte — les détails
// (avis, historique de livraisons, pourboires) vivent chacun sur leur propre page dédiée.
function DriverActivity({ deliveries, reviews, t }) {
  if (!deliveries) return <p className="small">{t('accountUi.loading')}</p>;

  const delivered = deliveries.filter((o) => o.status === 'livre');
  const totalDeliveryFees = delivered.reduce((a, o) => a + o.deliveryFee, 0);
  const totalTips = delivered.filter((o) => o.tipPaid && o.tipAmount > 0).reduce((a, o) => a + o.tipAmount, 0);

  return (
    <div className="stat-grid" style={{ marginTop: 0 }}>
      <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">{t('account.deliveriesDone')}</div></div>
      <div className="stat-card highlight"><div className="num">{(totalDeliveryFees + totalTips).toFixed(2)}€</div><div className="label">{t('account.estimatedEarnings')}</div></div>
      <div className="stat-card">
        <div className="num" style={{ fontSize: 18 }}><StarsDisplay value={reviews?.avg || 0} size={18} /></div>
        <div className="label">{reviews?.count > 0 ? t('restaurantMenu.ratingReviews', { rating: reviews.avg.toFixed(1), count: reviews.count }) : t('account.noReviewsYet')}</div>
      </div>
    </div>
  );
}
