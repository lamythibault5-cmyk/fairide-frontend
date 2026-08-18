import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { user, role, token, updateProfile, requestDeletionCode, deleteAccount, logout } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const ROLE_LABEL = { client: t('account.roleClient'), restaurant: t('account.roleRestaurant'), driver: t('account.roleDriver') };
  const DELETION_REASONS = deletionReasons(t);
  const GENDERS = genders(t);
  const [driverDeliveries, setDriverDeliveries] = useState(null);
  const [driverReviews, setDriverReviews] = useState(null);
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
  const [phone, setPhone] = useState(user.phone || '');
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
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
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
          <div className="stat-card highlight" style={{ marginBottom: 14 }}>
            <div className="num">{Number(user.balance || 0).toFixed(2)}€</div>
            <div className="label">{t('account.balance')}</div>
          </div>
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
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('account.phonePlaceholder')} />
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
