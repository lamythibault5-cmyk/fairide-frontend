import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLES = [
  { value: 'client', label: '🧑‍🍳 Client' },
  { value: 'restaurant', label: '🏪 Commerce' },
  { value: 'driver', label: '🛵 Livreur' }
];

const GENDERS = [
  { value: '', label: 'Genre (optionnel)' },
  { value: 'Femme', label: 'Femme' },
  { value: 'Homme', label: 'Homme' },
  { value: 'Autre', label: 'Autre' },
  { value: 'Préfère ne pas dire', label: 'Préfère ne pas dire' }
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('client');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const googleBtnRef = useRef(null);
  const stateRef = useRef({ mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity });
  useEffect(() => { stateRef.current = { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity }; });

  async function handleGoogleCredential(response) {
    const { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity } = stateRef.current;
    if (mode === 'register' && (!phone.trim() || !addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast('Renseigne ton téléphone et ton adresse complète avant de continuer avec Google.');
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithGoogle(response.credential, role, {
        phone: phone.trim(),
        addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
        addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim()
      });
      toast(`Bienvenue, ${data.user.name} !`);
      navigate('/');
    } catch (err) {
      if (err.message === 'INCOMPLETE_PROFILE') {
        setMode('register');
        toast('Complète ton profil (téléphone, adresse) puis reclique sur Continuer avec Google.');
      } else {
        toast(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    function tryInit() {
      if (cancelled) return;
      if (window.google?.accounts?.id && googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: 320, text: mode === 'register' ? 'signup_with' : 'signin_with'
        });
      } else {
        setTimeout(tryInit, 200);
      }
    }
    tryInit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) { toast('Email et mot de passe requis.'); return; }
    setLoading(true);
    try {
      let data;
      if (mode === 'register') {
        if (!firstName.trim() || !lastName.trim()) { toast('Ton prénom et ton nom sont requis.'); setLoading(false); return; }
        if (!phone.trim()) { toast('Ton numéro de téléphone est requis.'); setLoading(false); return; }
        if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim()) {
          toast('Ton adresse complète (rue, numéro, code postal, ville) est requise.');
          setLoading(false);
          return;
        }
        data = await register({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role,
          phone: phone.trim(), gender: gender || undefined, birthDate: birthDate || undefined,
          referralCode: referralCode.trim() || undefined,
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
          addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim()
        });
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
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Prénom</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Nom</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />
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
                <label>Date de naissance (optionnel)</label>
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
                <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Numéro</label>
                <input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Code postal</label>
                <input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Ville / Commune</label>
                <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Bruxelles" />
              </div>
            </div>
            <div className="field">
              <label>Code promo (optionnel)</label>
              <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Un code reçu ? Ajoute-le ici" />
            </div>
          </>
        )}

        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px' }}>
              <div ref={googleBtnRef} />
            </div>
            <div className="row" style={{ alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span className="small">ou</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
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
