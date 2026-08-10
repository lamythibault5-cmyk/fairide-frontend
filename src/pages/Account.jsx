import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_LABEL = { client: 'Client', restaurant: 'Commerce', driver: 'Livreur' };

const GENDERS = [
  { value: '', label: 'Genre (optionnel)' },
  { value: 'Femme', label: 'Femme' },
  { value: 'Homme', label: 'Homme' },
  { value: 'Autre', label: 'Autre' },
  { value: 'Préfère ne pas dire', label: 'Préfère ne pas dire' }
];

export default function Account() {
  const { user, role, updateProfile, logout } = useAuth();
  const toast = useToast();
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

      <button className="btn-danger-ghost" onClick={logout}>Se déconnecter</button>
    </div>
  );
}
