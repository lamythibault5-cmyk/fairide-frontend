import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

function roles(t) {
  return [
    { value: 'client', label: t('auth.roleClient') },
    { value: 'restaurant', label: t('auth.roleRestaurant') },
    { value: 'driver', label: t('auth.roleDriver') }
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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Auth() {
  const { t } = useLanguage();
  const ROLES = roles(t);
  const GENDERS = genders(t);
  const [searchParams] = useSearchParams();
  const audience = searchParams.get('audience'); // 'client' | 'partner' | null
  const roleHint = searchParams.get('role'); // optional pre-pick within an audience, e.g. 'driver'
  const visibleRoles = audience === 'client' ? ROLES.filter((r) => r.value === 'client')
    : audience === 'partner' ? ROLES.filter((r) => r.value !== 'client')
    : ROLES;

  const [mode, setMode] = useState(audience ? 'register' : 'login');
  const [role, setRole] = useState(() => {
    if (audience === 'client') return 'client';
    if (audience === 'partner') return visibleRoles.some((r) => r.value === roleHint) ? roleHint : 'restaurant';
    return 'client';
  });
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [referralCode, setReferralCode] = useState(() => searchParams.get('ref') || '');
  const [legalName, setLegalName] = useState('');
  const [companyNumber, setCompanyNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  // Pré-rempli avec prénom+nom dès qu'ils sont saisis (cas le plus fréquent) tant que le champ n'a
  // pas été touché à la main — modifiable si le responsable légal du commerce diffère de la personne
  // qui crée le compte, sans reposer une question dont on connaît déjà la réponse dans la majorité des cas.
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleTouched, setResponsibleTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { login, register, verifyEmail, resendCode, forgotPassword, loginWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // Arrivée ici via une action nécessitant un compte (ex. "+" sur une carte, "Réserver une table")
  // depuis une page publique — on revient y déposer le client une fois connecté, au lieu de le
  // renvoyer systématiquement à l'accueil (voir RestaurantMenu.jsx / RestaurantList.jsx).
  const from = location.state?.from || '/';

  useEffect(() => {
    if (responsibleTouched) return;
    const full = `${firstName} ${lastName}`.trim();
    if (full) setResponsibleName(full);
  }, [firstName, lastName, responsibleTouched]);

  const googleBtnRef = useRef(null);
  const stateRef = useRef({ mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName });
  useEffect(() => { stateRef.current = { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName }; });

  async function handleGoogleCredential(response) {
    const { mode, role, phone, addressStreet, addressNumber, addressPostalCode, addressCity, legalName, companyNumber, vatNumber, responsibleName } = stateRef.current;
    if (mode === 'register' && (!phone.trim() || !addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim())) {
      toast(t('auth.googleIncompleteProfile'));
      return;
    }
    if (mode === 'register' && role === 'restaurant' && (!legalName.trim() || !companyNumber.trim() || !vatNumber.trim() || !responsibleName.trim())) {
      toast("Les informations légales de ton commerce sont requises (nom légal, n° d'entreprise, n° TVA, responsable).");
      return;
    }
    setLoading(true);
    try {
      const data = await loginWithGoogle(response.credential, role, {
        phone: phone.trim(),
        addressStreet: addressStreet.trim(), addressNumber: addressNumber.trim(),
        addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
        ...(role === 'restaurant' ? {
          legalName: legalName.trim(), companyNumber: companyNumber.trim(),
          vatNumber: vatNumber.trim(), responsibleName: responsibleName.trim()
        } : {})
      });
      toast(t('auth.welcome', { name: data.user.name }));
      navigate(from);
    } catch (err) {
      if (err.message === 'INCOMPLETE_PROFILE') {
        setMode('register');
        toast(t('auth.googleCompleteProfile'));
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
    if (!email || !password) { toast(t('auth.errEmailPassword')); return; }
    setLoading(true);
    try {
      if (mode === 'register') {
        if (!firstName.trim() || !lastName.trim()) { toast(t('auth.errNameRequired')); setLoading(false); return; }
        if (!phone.trim()) { toast(t('auth.errPhoneRequired')); setLoading(false); return; }
        if (!addressStreet.trim() || !addressNumber.trim() || !addressPostalCode.trim() || !addressCity.trim()) {
          toast(t('auth.errAddressRequired'));
          setLoading(false);
          return;
        }
        if (role === 'restaurant' && (!legalName.trim() || !companyNumber.trim() || !vatNumber.trim() || !responsibleName.trim())) {
          toast("Les informations légales de ton commerce sont requises (nom légal, n° d'entreprise, n° TVA, responsable).");
          setLoading(false);
          return;
        }
        if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
          toast(t('auth.errPasswordStrength'));
          setLoading(false);
          return;
        }
        if (password !== passwordConfirm) {
          toast(t('auth.errPasswordMismatch'));
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
          addressPostalCode: addressPostalCode.trim(), addressCity: addressCity.trim(),
          ...(role === 'restaurant' ? {
            legalName: legalName.trim(), companyNumber: companyNumber.trim(),
            vatNumber: vatNumber.trim(), responsibleName: responsibleName.trim()
          } : {})
        });
        if (data.needsVerification) {
          setPendingEmail(data.email);
          toast(t('auth.errVerificationSent'));
        }
      } else {
        const data = await login(email.trim(), password);
        toast(t('auth.welcome', { name: data.user.name }));
        navigate(from);
      }
    } catch (err) {
      if (err.message === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(email.trim());
        toast(t('auth.errEmailNotVerified'));
      } else {
        toast(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    if (!code.trim()) { toast(t('auth.errCodeRequired')); return; }
    setLoading(true);
    try {
      const data = await verifyEmail(pendingEmail, code.trim());
      toast(t('auth.welcome', { name: data.user.name }));
      navigate(from);
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail.trim()) { toast(t('auth.errEmailRequired')); return; }
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotSubmitted(true);
    } catch (err) {
      toast(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await resendCode(pendingEmail);
      toast(t('auth.newCodeSent'));
    } catch (err) {
      toast(err.message);
    } finally {
      setResending(false);
    }
  }

  const decorClass = audience === 'partner' ? 'partner' : audience === 'client' ? 'client' : '';

  if (forgotMode) {
    return (
      <div className={`decor-page auth-decor ${decorClass}`}>
        <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('auth.forgotTitle')}</h2>
          {forgotSubmitted ? (
            <>
              <p className="small" style={{ marginBottom: 14 }}>
                {t('auth.forgotSubmittedText', { email: forgotEmail })}
              </p>
              <button className="btn-ghost" onClick={() => { setForgotMode(false); setForgotSubmitted(false); setForgotEmail(''); }}>
                {t('auth.backToLogin')}
              </button>
            </>
          ) : (
            <>
              <p className="small" style={{ marginBottom: 14 }}>
                {t('auth.forgotText')}
              </p>
              <form onSubmit={submitForgotPassword}>
                <div className="field">
                  <label htmlFor="auth-f-1">{t('auth.email')}</label>
                  <input id="auth-f-1" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="toi@exemple.com" />
                </div>
                <button type="submit" className="btn-gold btn-block" disabled={forgotLoading}>
                  {forgotLoading ? t('common.loading') : t('auth.sendLink')}
                </button>
              </form>
              <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setForgotMode(false)}>
                {t('auth.backToLogin')}
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    );
  }

  if (pendingEmail) {
    return (
      <div className={`decor-page auth-decor ${decorClass}`}>
        <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('auth.verifyTitle')}</h2>
          <p className="small" style={{ marginBottom: 14 }}>
            {t('auth.verifyText', { email: pendingEmail })}
          </p>
          <form onSubmit={submitCode}>
            <div className="field">
              <label htmlFor="auth-f-2">{t('auth.verifyCodeLabel')}</label>
              <input id="auth-f-2"
                value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456"
                maxLength={6} style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6 }}
              />
            </div>
            <button type="submit" className="btn-gold btn-block" disabled={loading}>
              {loading ? t('common.loading') : t('auth.confirm')}
            </button>
          </form>
          <button className="btn-ghost" style={{ marginTop: 10 }} disabled={resending} onClick={handleResend}>
            {resending ? t('common.loading') : t('auth.resendCode')}
          </button>
          <button className="btn-ghost" style={{ marginTop: 4 }} onClick={() => { setPendingEmail(''); setCode(''); }}>
            {t('auth.back')}
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`decor-page auth-decor ${decorClass}`}>
      {audience && (
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <span className={`pill ${audience === 'client' ? 'gold' : 'teal'}`}>
            {audience === 'client' ? t('auth.clientSpace') : t('auth.partnerSpace')}
          </span>
          <h2 style={{ margin: '10px 0 0', fontSize: 22 }}>
            {audience === 'client' ? t('auth.clientHeading') : t('auth.partnerHeading')}
          </h2>
        </div>
      )}
      <div className="auth-box">
      <div className="card">
        <div className="auth-tabs">
          <div className={`chip${mode === 'login' ? ' active' : ''}`} onClick={() => setMode('login')}>{t('auth.login')}</div>
          <div className={`chip${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>{t('auth.register')}</div>
        </div>

        {mode === 'register' && (
          <>
            {visibleRoles.length > 1 && (
              <div className="role-pick">
                {visibleRoles.map((r) => (
                  <div key={r.value} className={`chip${role === r.value ? ' active' : ''}`} onClick={() => setRole(r.value)}>
                    {r.label}
                  </div>
                ))}
              </div>
            )}
            {role === 'driver' && (
              <>
                <p className="small" style={{ marginTop: -6, marginBottom: 8 }}>
                  {t('auth.driverGeoNotice')}
                </p>
                <p className="small" style={{ marginBottom: 12 }}>
                  {t('auth.driverFeeNotice')}
                </p>
              </>
            )}
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-3">{t('auth.firstName')}</label>
                <input id="auth-f-3" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('auth.firstName')} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-4">{t('auth.lastName')}</label>
                <input id="auth-f-4" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('auth.lastName')} />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-5">{t('auth.gender')}</label>
                <select id="auth-f-5" value={gender} onChange={(e) => setGender(e.target.value)}>
                  {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-6">{t('auth.birthDate')}</label>
                <input id="auth-f-6" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="auth-f-7">{t('auth.phone')}</label>
              <input id="auth-f-7" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 00 00 00" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="auth-f-8">{t('auth.street')}</label>
                <input id="auth-f-8" value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-9">{t('auth.number')}</label>
                <input id="auth-f-9" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="auth-f-10">{t('auth.postalCode')}</label>
                <input id="auth-f-10" value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="auth-f-11">{t('auth.city')}</label>
                <input id="auth-f-11" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Bruxelles" />
              </div>
            </div>
            {role === 'restaurant' && (
              <>
                <div className="divider" />
                <h4 style={{ margin: '0 0 4px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>Informations légales du commerce</h4>
                <p className="small" style={{ margin: '0 0 10px' }}>Obligatoire pour la vérification de conformité de ton commerce.</p>
                <div className="field">
                  <label htmlFor="auth-f-12">Nom légal / entreprise</label>
                  <input id="auth-f-12" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Ex: HORECA BRUSSELS SRL" />
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-13">N° d'entreprise (BCE)</label>
                    <input id="auth-f-13" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-14">N° TVA</label>
                    <input id="auth-f-14" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="BE0123.456.789" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="auth-f-15">Responsable</label>
                  <input id="auth-f-15"
                    value={responsibleName}
                    onChange={(e) => { setResponsibleName(e.target.value); setResponsibleTouched(true); }}
                    placeholder="Nom du responsable légal"
                  />
                </div>
                <div className="divider" />
              </>
            )}
            <div className="field">
              <label htmlFor="auth-f-16">{t('auth.promoCode')}</label>
              <input id="auth-f-16" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
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
              <span className="small">{t('auth.or')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
          </>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="auth-f-17">{t('auth.email')}</label>
            <input id="auth-f-17" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
          </div>
          <div className="field">
            <label htmlFor="auth-f-18">{t('auth.password')}</label>
            <input id="auth-f-18"
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('auth.passwordPlaceholderRegister') : t('auth.password')}
            />
          </div>
          {mode === 'login' && (
            <button type="button" className="btn-ghost" style={{ padding: '2px 0', marginBottom: 10, fontSize: 13 }} onClick={() => { setForgotEmail(email); setForgotMode(true); }}>
              {t('auth.forgotPassword')}
            </button>
          )}
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="auth-f-19">{t('auth.confirmPassword')}</label>
              <input id="auth-f-19" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder={t('auth.confirmPasswordPlaceholder')} />
            </div>
          )}
          <button type="submit" className="btn-gold btn-block" disabled={loading}>
            {loading ? t('common.loading') : mode === 'register' ? t('auth.createAccount') : t('auth.signIn')}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
