import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_LABEL = { client: 'Client', restaurant: 'Restaurant', driver: 'Livreur' };

export default function Account() {
  const { user, role, updateProfile, logout } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [savingInfo, setSavingInfo] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveInfo(e) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), address: address.trim() });
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
        <form onSubmit={saveInfo}>
          <div className="field">
            <label>Nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 00 00 00" />
          </div>
          <div className="field">
            <label>Adresse</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue..., n°, commune" />
          </div>
          <button type="submit" className="btn-teal" disabled={savingInfo}>{savingInfo ? '...' : 'Enregistrer'}</button>
        </form>
      </div>

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
