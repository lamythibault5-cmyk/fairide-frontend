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
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const { login, register, verifyEmail, resendCode, loginWithGoogle } = useAuth();
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
      if (mode === 'register') {
        if (!firstName.trim() || !lastName.trim()) { toast('Ton prénom et ton nom sont requis.'); setLoading(false); return; }
        if (!phone.trim()) { toast('Ton numéro de téléphone est requis.'); setLoading(false); return; }
        if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim()) {
          toast('Ton adresse complète (rue, numéro, code postal, ville) est requise.');
          setLoading(false);
          return;
        }
        if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
          toast('Le mot de passe doit faire au moins 5 caractères et contenir une majuscule et une minuscule.');
          setLoading(false);
          return;
        }
        if (password !== passwordConfirm) {
          toast('Les deux mots de passe ne correspondent pas.');
          setLoading(false);
          return;
        }
        if (role === 'driver' && 'geolocation' in navigator) {
          // Demande l'autorisation de géolocalisation une seule fois, à la création du compte.
          // Elle pourra être désactivée plus tard dans les réglages du compte.
          navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
        }
        const data = await register({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role,
          phone: phone.trim(), gender: gender || undefined, birthDate: birthDate || undefined,
          referralCode: referralCode.trim() || undefined,
          addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
          addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim()
        });
        if (data.needsVerification) {
          setPendingEmail(data.email);
          toast('Un code de vérification t\'a été envoyé par email.');
        }
      } else {
        const data = await login(email.trim(), password);
        toast(`Bienvenue, ${data.user.name} !`);
        navigate('/');
      }
    } catch (err) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email.trim());
        toast('Confirme d\'abord ton adresse email avec le code qu\'on t\'a envoyé.');
      } else {
        toast(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!code.trim()) { toast('Entre le code reçu par email.'); return; }
    setLoading(true);
    try {
      const data = await verifyEmail(pendingEmail, code.trim());
      toast(`Bienvenue, ${data.user.name} !`);
      navigate('/');
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendCode(pendingEmail);
      toast('Nouveau code envoyé.');
    } catch (err) {
      toast(err.message);
    } finally {
      setResending(false);
    }
  }

  if (pendingEmail) {
    return (
      <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Confirme ton email</h2>
          <p className="small" style={{ marginBottom: 14 }}>
            On a envoyé un code à 6 chiffres à <b>{pendingEmail}</b>. Entre-le ci-dessous pour activer ton compte.
          </p>
          <form onSubmit={submitCode}>
            <div className="field">
              <label>Code de vérification</label>
              <input
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
              />
            </div>
            <button type="submit" className="btn-gold btn-block" disabled={loading}>
              {loading ? '...' : 'Confirmer'}
            </button>
          </form>
          <button className="btn-ghost" style={{ marginTop: 10 }} disabled={resending} onClick={handleResend}>
            {resending ? '...' : 'Renvoyer le code'}
          </button>
          <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setPendingEmail(''); setCode(''); }}>
            &larr; Retour
          </button>
        </div>
      </div>
    );
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
            {role === 'driver' && (
              <p className="small" style={{ marginTop: -6, marginBottom: 12 }}>
                📍 En créant ton compte livreur, ton navigateur te demandera d'autoriser la géolocalisation — elle sert à partager ta position en direct avec les clients pendant tes livraisons. Tu peux la désactiver à tout moment dans les réglages de ton compte.
              </p>
            )}
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
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '5 caractères min., 1 majuscule, 1 minuscule' : 'Mot de passe'}
            />
          </div>
          {mode === 'register' && (
            <div className="field">
              <label>Confirme ton mot de passe</label>
              <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Retape le même mot de passe" />
            </div>
          )}
          <button type="submit" className="btn-gold btn-block" disabled={loading}>
            {loading ? '...' : mode === 'register' ? 'Créer mon compte' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
