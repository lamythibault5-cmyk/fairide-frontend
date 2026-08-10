import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLES = [
  { value: 'client', label: '🧑‍🍳 Client' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'driver', label: '🛵 Livreur' }
];

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('client');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) { toast('Email et mot de passe requis.'); return; }
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        if (!name.trim()) { toast('Ton prénom est requis.'); setLoading(false); return; }
        if (!phone.trim()) { toast('Ton numéro de téléphone est requis.'); setLoading(false); return; }
        if (!address.trim()) { toast('Ton adresse est requise.'); setLoading(false); return; }
        data = await register(name.trim(), email.trim(), password, role, phone.trim(), address.trim());
      } else {
        data = await login(email.trim(), password);
      }
      toast(mode === 'register' ? `Bienvenue, ${data.user.name} ! Un email de confirmation t'a été envoyé.` : `Bienvenue, ${data.user.name} !`);
      navigate('/');
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-box">
      <div className="card">
        <div className="auth-tabs">
          <div className={`chip${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>Se connecter</div>
          <div className={`chip${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>Créer un compte</div>
        </div>

        {mode === 'register' && (
          <>
            <div className="role-pick">
              {ROLES.map((r) => (
                <div key={r.value} className={`chip${role === r.value ? ' active' : ''}`} onClick={() => setRole(r.value)}>
                  {r.label}
                </div>
              ))}
            </div>
            <div className="field">
              <label>Nom</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 00 00 00" />
            </div>
            <div className="field">
              <label>Adresse</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rue..., n°, commune" />
            </div>
          </>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum" />
          </div>
          <button type="submit" className="btn-gold btn-block" disabled={loading}>
            {loading ? '...' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
