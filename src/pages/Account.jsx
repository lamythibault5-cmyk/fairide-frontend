import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StarsDisplay } from '../components/Stars';
import { deliveryInstructionLabel, formatOrderItem } from '../orderStatus';

const ROLE_LABEL = { client: 'Client', restaurant: 'Commerce', driver: 'Livreur' };

const DELETION_REASONS = [
  'Je n\'utilise plus le service',
  'Prix ou frais trop élevés',
  'Mauvaise expérience avec une commande',
  'Problème avec un restaurant ou un livreur',
  'Je préfère une autre application',
  'Problème de confidentialité ou de sécurité',
  'Autre raison'
];

const GENDERS = [
  { value: '', label: 'Genre (optionnel)' },
  { value: 'Femme', label: 'Femme' },
  { value: 'Homme', label: 'Homme' },
  { value: 'Autre', label: 'Autre' },
  { value: 'Préfère ne pas dire', label: 'Préfère ne pas dire' }
];

export default function Account() {
  const { user, role, token, updateProfile, requestDeletionCode, deleteAccount, logout } = useAuth();
  const toast = useToast();
  const [driverDeliveries, setDriverDeliveries] = useState(null);
  const [driverReviews, setDriverReviews] = useState(null);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState(DELETION_REASONS[0]);
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

  const [payoutIban, setPayoutIban] = useState(user.payoutIban || '');
  const [payoutAccountHolder, setPayoutAccountHolder] = useState(user.payoutAccountHolder || '');
  const [savingPayout, setSavingPayout] = useState(false);

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

  async function savePayout(e) {
    e.preventDefault();
    setSavingPayout(true);
    try {
      await updateProfile({ payoutIban: payoutIban.trim(), payoutAccountHolder: payoutAccountHolder.trim() });
      toast('Infos de paiement enregistrées.');
    } catch (err) {
      toast(err.message);
    } finally {
      setSavingPayout(false);
    }
  }

  async function toggleLocationSharing(e) {
    const next = e.target.checked;
    setLocationSharingEnabled(next);
    setSavingLocationSharing(true);
    try {
      await updateProfile({ locationSharingEnabled: next });
      toast(next ? 'Partage de position en direct activé.' : 'Partage de position en direct désactivé.');
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
      toast('Infos mises à jour.');
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
      toast('Code envoyé par email.');
    } catch (err) {
      toast(err.message);
    } finally {
      setSendingCode(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deleteCode) { toast('Entre le code reçu par email.'); return; }
    setDeleting(true);
    try {
      const result = await deleteAccount({ code: deleteCode, reason: deleteReason, comment: deleteComment.trim() });
      toast(result.anonymized ? 'Compte supprimé. Ton historique de commandes reste visible pour les autres, sans tes données personnelles.' : 'Compte supprimé.');
    } catch (err) {
      toast(err.message);
      setDeleting(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { toast('Le nouveau mot de passe doit faire au moins 8 caractères.'); return; }
    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast('Mot de passe changé.');
    } catch (err) {
      toast(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Mon compte</h2>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="pill teal">{ROLE_LABEL[role] || role}</span>
          <span className="small">{user.email}</span>
        </div>

        {role === 'client' && (
          <div className="stat-card highlight" style={{ marginBottom: 14 }}>
            <div className="num">{Number(user.balance || 0).toFixed(2)}€</div>
            <div className="label">Ton solde Fairide</div>
          </div>
        )}

        <form onSubmit={saveInfo}>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Prénom</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Nom</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Genre</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Date de naissance</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 00 00 00" />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 2 }}>
              <label>Rue / Avenue</label>
              <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Numéro</label>
              <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Code postal</label>
              <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Ville / Commune</label>
              <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-teal" disabled={savingInfo}>{savingInfo ? '...' : 'Enregistrer'}</button>
        </form>
      </div>

      {(role === 'restaurant' || role === 'driver') && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Coordonnées de paiement</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>
            Renseigne où tu souhaites recevoir tes paiements Fairide. Le versement automatique arrive bientôt — en attendant, ces infos servent à Fairide pour te payer manuellement.
          </p>
          <form onSubmit={savePayout}>
            <div className="field">
              <label>Titulaire du compte</label>
              <input value={payoutAccountHolder} onChange={(e) => setPayoutAccountHolder(e.target.value)} placeholder="Nom complet ou raison sociale" />
            </div>
            <div className="field">
              <label>IBAN</label>
              <input value={payoutIban} onChange={(e) => setPayoutIban(e.target.value)} placeholder="BE00 0000 0000 0000" />
            </div>
            <button type="submit" className="btn-teal" disabled={savingPayout}>{savingPayout ? '...' : 'Enregistrer'}</button>
          </form>
        </div>
      )}

      {role === 'driver' && (
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Géolocalisation</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>
            Quand c'est activé, ta position est partagée en direct avec le client pendant tes livraisons, pour qu'il puisse te suivre sur la carte.
          </p>
          <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={locationSharingEnabled} disabled={savingLocationSharing} onChange={toggleLocationSharing} />
            <span className="small">Partager ma position en direct pendant les livraisons</span>
          </label>
        </div>
      )}

      {role === 'driver' && <DriverActivity deliveries={driverDeliveries} reviews={driverReviews} expandedDeliveryId={expandedDeliveryId} setExpandedDeliveryId={setExpandedDeliveryId} />}

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>Changer de mot de passe</h3>
        <form onSubmit={savePassword}>
          <div className="field">
            <label>Mot de passe actuel</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8 caractères minimum" />
          </div>
          <button type="submit" className="btn-outline" disabled={savingPassword}>{savingPassword ? '...' : 'Changer le mot de passe'}</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--red)' }}>Supprimer mon compte</h3>
        {!confirmDeleteOpen && (
          <button className="btn-danger-ghost" onClick={() => setConfirmDeleteOpen(true)}>🗑️ Supprimer mon compte</button>
        )}
        {confirmDeleteOpen && (
          <div>
            <p className="small" style={{ color: 'var(--red)', marginBottom: 10 }}>
              Cette action est irréversible. Si tu as déjà des commandes, tes données personnelles seront effacées
              mais ton historique de commandes restera visible (anonymisé) pour les commerces/livreurs concernés.
            </p>

            {!deleteCodeSent && (
              <>
                <div className="field">
                  <label>Pourquoi souhaites-tu nous quitter ?</label>
                  <select value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}>
                    {DELETION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Un commentaire (optionnel)</label>
                  <input value={deleteComment} onChange={(e) => setDeleteComment(e.target.value)} placeholder="Aide-nous à nous améliorer..." />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={sendingCode} onClick={handleSendDeleteCode}>
                    {sendingCode ? '...' : 'Recevoir un code de validation de suppression'}
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirmDeleteOpen(false)}>Annuler</button>
                </div>
              </>
            )}

            {deleteCodeSent && (
              <>
                <p className="small" style={{ marginBottom: 10 }}>
                  Un code de validation de suppression vient de t'être envoyé par email. Entre-le ci-dessous pour finaliser la suppression.
                </p>
                <div className="field">
                  <label>Code reçu par email</label>
                  <input value={deleteCode} onChange={(e) => setDeleteCode(e.target.value)} placeholder="123456" maxLength={6} />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={deleting} onClick={handleDeleteAccount}>
                    {deleting ? '...' : 'Oui, supprimer définitivement'}
                  </button>
                  <button className="btn-ghost" disabled={sendingCode} onClick={handleSendDeleteCode}>Renvoyer le code</button>
                  <button className="btn-ghost" onClick={() => { setConfirmDeleteOpen(false); setDeleteCodeSent(false); setDeleteCode(''); }}>Annuler</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <button className="btn-danger-ghost" onClick={logout}>Se déconnecter</button>
    </div>
  );
}

// Regroupe l'activité du livreur (gains, avis, historique) sur la page Mon compte plutôt que sur
// l'écran des livraisons — celui-ci ne garde que ce qui est actionnable dans l'instant (courses
// disponibles / en cours), le reste (performance, historique) se consulte ici.
function DriverActivity({ deliveries, reviews, expandedDeliveryId, setExpandedDeliveryId }) {
  if (!deliveries) return null;

  const delivered = deliveries.filter((o) => o.status === 'livre');
  const reviewByOrderId = {};
  (reviews?.reviews || []).forEach((r) => { if (r.orderId) reviewByOrderId[r.orderId] = r; });
  const tippedOrders = delivered.filter((o) => o.tipPaid && o.tipAmount > 0);
  const totalDeliveryFees = delivered.reduce((a, o) => a + o.deliveryFee, 0);
  const totalTips = tippedOrders.reduce((a, o) => a + o.tipAmount, 0);

  return (
    <>
      <h2 className="section-title">Mon activité de livreur</h2>
      <div className="stat-grid">
        <div className="stat-card"><div className="num">{delivered.length}</div><div className="label">Livraisons faites</div></div>
        <div className="stat-card highlight"><div className="num">{(totalDeliveryFees + totalTips).toFixed(2)}€</div><div className="label">Gains estimés (pourboires inclus)</div></div>
        <div className="stat-card">
          <div className="num" style={{ fontSize: 18 }}><StarsDisplay value={reviews?.avg || 0} size={18} /></div>
          <div className="label">{reviews?.count > 0 ? `${reviews.avg.toFixed(1)} (${reviews.count} avis)` : 'Pas encore d\'avis'}</div>
        </div>
      </div>

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>💛 Mes pourboires</h3>
      {tippedOrders.length === 0 && <div className="empty">Pas encore de pourboire reçu.</div>}
      {tippedOrders.length > 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--cream-dim)' }}>
            <b>Total reçu</b>
            <b>{totalTips.toFixed(2)}€</b>
          </div>
          {tippedOrders.map((o) => (
            <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div>
                <div style={{ fontSize: 13 }}>{o.restaurantName} → {o.clientName}</div>
                <div className="small">{new Date(o.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              <b style={{ color: 'var(--gold)' }}>{o.tipAmount.toFixed(2)}€</b>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>⭐ Mes avis</h3>
      {(!reviews || reviews.reviews.length === 0) && <div className="empty">Pas encore d'avis reçu.</div>}
      {reviews && reviews.reviews.length > 0 && (
        <div className="card">
          {reviews.reviews.map((r, i) => (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--cream-dim)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b style={{ fontSize: 13 }}>{r.clientName} · {r.restaurantName}</b>
                <StarsDisplay value={r.deliveryRating} />
              </div>
              {r.deliveryComment && <p className="small" style={{ margin: '4px 0 0' }}>{r.deliveryComment}</p>}
            </div>
          ))}
        </div>
      )}

      <h3 style={{ margin: '18px 0 6px', fontSize: 15 }}>📦 Historique de mes livraisons</h3>
      {delivered.length === 0 && <div className="empty">Pas encore de livraison terminée.</div>}
      {delivered.map((o) => {
        const isOpen = expandedDeliveryId === o.id;
        const review = reviewByOrderId[o.id];
        return (
          <div className="card" key={o.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedDeliveryId(isOpen ? null : o.id)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{o.restaurantName}</b> → {o.clientName}
              <span className="small">{new Date(o.createdAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <span className="small">{o.items.map(formatOrderItem).join(', ')}</span>
              <span className="small" style={{ fontWeight: 600 }}>{(o.deliveryFee + (o.tipPaid ? o.tipAmount : 0)).toFixed(2)}€</span>
            </div>
            {isOpen && (
              <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--cream-dim)' }}>
                {o.restaurantAddress && <div className="small">🏪 Retrait : {o.restaurantAddress}</div>}
                <div className="small">🏁 Livraison : {o.address}</div>
                {o.travelMinutes && <div className="small">🚴 Trajet resto → client : ~{o.travelMinutes} min{o.distanceKm ? ` (${o.distanceKm} km)` : ''}</div>}
                {o.deliveryInstructions && (
                  <div className="small" style={{ fontWeight: 600, marginTop: 2 }}>{deliveryInstructionLabel(o.deliveryInstructions)}{o.deliveryNote ? ` — ${o.deliveryNote}` : ''}</div>
                )}
                <div className="breakdown" style={{ marginTop: 8 }}>
                  <div className="line"><span>Frais de livraison</span><span>{o.deliveryFee.toFixed(2)}€</span></div>
                  {o.tipPaid && o.tipAmount > 0 && <div className="line"><span>Pourboire 💛</span><span>{o.tipAmount.toFixed(2)}€</span></div>}
                  <div className="line total"><span>Total gagné</span><span>{(o.deliveryFee + (o.tipPaid ? o.tipAmount : 0)).toFixed(2)}€</span></div>
                </div>
                {review ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>Note du client :</span>
                      <StarsDisplay value={review.deliveryRating} />
                    </div>
                    {review.deliveryComment && <p className="small" style={{ margin: '4px 0 0' }}>{review.deliveryComment}</p>}
                  </div>
                ) : (
                  <p className="small" style={{ marginTop: 10, opacity: 0.6 }}>Pas encore de note laissée par le client pour cette livraison.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
