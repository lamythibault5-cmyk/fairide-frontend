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

/* Étapes de l'inscription, dans l'ordre où elles sont posées.

   L'inscription tenait auparavant sur un seul écran : 13 champs pour un client, 17 pour un
   commerce, tous visibles d'un coup. À l'ouverture, ça se lit comme un dossier à monter et
   non comme une inscription — la personne referme avant d'avoir commencé. Le même nombre de
   questions réparti sur trois écrans se remplit sans jamais donner cette impression, parce
   qu'on ne voit à aucun moment plus de quatre champs.

   Le genre et la date de naissance ne sont plus demandés du tout : ils sont facultatifs côté
   serveur, ils ne servent à rien pour livrer un repas, et ils restent modifiables dans la page
   Compte (Account.jsx) pour qui veut les renseigner. Une question qui n'est pas nécessaire ne
   doit pas être posée à l'inscription.

   L'étape "business" n'existe que pour les commerces : le nom légal, le n° BCE, le n° TVA et le
   responsable sont exigés par POST /register côté backend, on ne peut pas s'en passer. */
const STEP_KEYS = {
  client: ['identity', 'address', 'account'],
  driver: ['identity', 'address', 'account'],
  restaurant: ['identity', 'business', 'address', 'account']
};

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function Auth() {
  const { t } = useLanguage();
  const ROLES = roles(t);
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
  /* Plus de champ "confirme ton mot de passe" : il ne protège de rien qu'un bouton "Afficher" ne
     protège mieux. Retaper un mot de passe à l'aveugle produit surtout la même faute deux fois,
     et c'est une question de plus à l'écran. Le voir suffit à le vérifier. */
  const [showPassword, setShowPassword] = useState(false);
  /* Le code de parrainage n'apparaît que si la personne en a un : soit il arrive dans l'URL
     (?ref=...) depuis un lien de parrainage, soit elle clique sur "J'ai un code". Sinon, c'est
     un champ vide de plus qui allonge le formulaire sans jamais servir. */
  const [referralOpen, setReferralOpen] = useState(() => Boolean(searchParams.get('ref')));
  /* Étape courante de l'inscription, et erreurs par champ. Les erreurs vivent sous le champ
     fautif plutôt qu'en toast : à la fin d'un formulaire de 13 champs, un toast "adresse
     requise" n'indique pas lequel des quatre champs d'adresse est vide. */
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
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

  const steps = STEP_KEYS[role] || STEP_KEYS.client;
  const stepKey = steps[Math.min(step, steps.length - 1)];
  const isLastStep = step >= steps.length - 1;

  /* Titre et sous-titre de l'étape en cours. Le sous-titre de l'adresse dépend du rôle : ce n'est
     pas la même adresse ni le même usage selon qu'on commande, qu'on livre ou qu'on vend. Dire à
     quoi sert une donnée au moment où on la demande évite la question "pourquoi vous voulez ça ?",
     qui est une des raisons pour lesquelles on abandonne un formulaire. */
  const stepCopy = {
    identity: { title: t('auth.stepIdentityTitle'), sub: t('auth.stepIdentitySub') },
    business: { title: t('auth.stepBusinessTitle'), sub: t('auth.stepBusinessSub') },
    address: {
      title: t('auth.stepAddressTitle'),
      sub: role === 'client' ? t('auth.stepAddressSubClient')
        : role === 'driver' ? t('auth.stepAddressSubDriver')
        : t('auth.stepAddressSubRestaurant')
    },
    account: { title: t('auth.stepAccountTitle'), sub: t('auth.stepAccountSub') }
  }[stepKey];

  /* Un commerce a une étape de plus qu'un client : changer de rôle en cours de route (ou passer
     de "Créer un compte" à "Se connecter") doit ramener au début, sinon on peut se retrouver à
     une étape 3 qui n'existe plus pour le nouveau rôle. */
  useEffect(() => { setStep(0); setErrors({}); }, [role, mode]);

  /* Valide UNE étape et renvoie ses erreurs, par champ. Les règles reproduisent exactement celles
     de POST /register côté backend (routes/auth.js) : prénom, nom, email, mot de passe, téléphone
     et adresse complète obligatoires, plus les quatre champs légaux pour un commerce. Les faire
     remonter ici évite un aller-retour réseau pour apprendre qu'il manque un numéro de rue. */
  function validateStep(key) {
    const required = t('auth.errFieldRequired');
    const e = {};
    if (key === 'identity') {
      if (!firstName.trim()) e.firstName = required;
      if (!lastName.trim()) e.lastName = required;
      if (!phone.trim()) e.phone = required;
    }
    if (key === 'business') {
      if (!legalName.trim()) e.legalName = required;
      if (!companyNumber.trim()) e.companyNumber = required;
      if (!vatNumber.trim()) e.vatNumber = required;
      if (!responsibleName.trim()) e.responsibleName = required;
    }
    if (key === 'address') {
      if (!addressStreet.trim()) e.addressStreet = required;
      if (!addressNumber.trim()) e.addressNumber = required;
      if (!addressPostalCode.trim()) e.addressPostalCode = required;
      if (!addressCity.trim()) e.addressCity = required;
    }
    if (key === 'account') {
      if (!email.trim()) e.email = required;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t('auth.errEmailInvalid');
      if (!password) e.password = required;
      else if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        e.password = t('auth.errPasswordStrength');
      }
    }
    return e;
  }

  function goNext() {
    const e = validateStep(stepKey);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => s + 1);
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  /* Erreur sous un champ. Le champ lui-même reçoit .input-invalid pour que le filet passe en
     rouge : la couleur seule ne suffirait pas (daltonisme), d'où le texte en plus. */
  function fieldError(name) {
    return errors[name] ? <p className="field-error">{errors[name]}</p> : null;
  }

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
        /* Filet de sécurité : chaque étape a déjà validé ses propres champs avant de laisser
           passer à la suivante, donc en pratique rien ne devrait tomber ici. Mais on revalide
           TOUTES les étapes avant d'appeler le serveur — un retour en arrière suivi d'un champ
           vidé pourrait sinon partir en requête et revenir en 400. Si une étape antérieure est
           en faute, on y ramène la personne plutôt que d'afficher une erreur hors contexte. */
        for (let i = 0; i < steps.length; i++) {
          const e = validateStep(steps[i]);
          if (Object.keys(e).length > 0) {
            setStep(i);
            setErrors(e);
            setLoading(false);
            return;
          }
        }
        if (role === 'driver' && 'geolocation' in navigator) {
          // Demande l'autorisation de géolocalisation une seule fois, à la création du compte.
          // Elle pourra être désactivée plus tard dans les réglages du compte.
          navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 5000 });
        }
        const data = await register({
          firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role,
          phone: phone.trim(),
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

        {mode === 'register' ? (
          /* Entrée par étapes. La touche Entrée passe à l'étape suivante tant qu'il en reste une,
             et ne déclenche la création du compte qu'à la dernière — sans ça, taper Entrée dans le
             champ "Prénom" enverrait un formulaire aux trois quarts vide. */
          <form onSubmit={(ev) => { if (isLastStep) { submit(ev); } else { ev.preventDefault(); goNext(); } }}>
            {visibleRoles.length > 1 && step === 0 && (
              <div className="role-pick">
                {visibleRoles.map((r) => (
                  <div key={r.value} className={`chip${role === r.value ? ' active' : ''}`} onClick={() => setRole(r.value)}>
                    {r.label}
                  </div>
                ))}
              </div>
            )}

            <div className="auth-step-head">
              <span className="auth-step-count">{t('auth.stepOf', { current: step + 1, total: steps.length })}</span>
              <h3>{stepCopy.title}</h3>
              <p className="small">{stepCopy.sub}</p>
              <div className="auth-step-bar">
                <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
              </div>
            </div>

            {stepKey === 'identity' && (
              <>
                {role === 'driver' && (
                  <>
                    <p className="small" style={{ marginBottom: 8 }}>{t('auth.driverGeoNotice')}</p>
                    <p className="small" style={{ marginBottom: 14 }}>{t('auth.driverFeeNotice')}</p>
                  </>
                )}
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-3">{t('auth.firstName')}</label>
                    <input id="auth-f-3" className={errors.firstName ? 'input-invalid' : undefined} autoFocus
                      value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t('auth.firstName')} />
                    {fieldError('firstName')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-4">{t('auth.lastName')}</label>
                    <input id="auth-f-4" className={errors.lastName ? 'input-invalid' : undefined}
                      value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t('auth.lastName')} />
                    {fieldError('lastName')}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="auth-f-7">{t('auth.phone')}</label>
                  <input id="auth-f-7" type="tel" className={errors.phone ? 'input-invalid' : undefined}
                    value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 470 00 00 00" />
                  {fieldError('phone')}
                </div>
              </>
            )}

            {stepKey === 'business' && (
              <>
                <div className="field">
                  <label htmlFor="auth-f-12">{t('auth.legalName')}</label>
                  <input id="auth-f-12" className={errors.legalName ? 'input-invalid' : undefined} autoFocus
                    value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Ex: HORECA BRUSSELS SRL" />
                  {fieldError('legalName')}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-13">{t('auth.companyNumber')}</label>
                    <input id="auth-f-13" className={errors.companyNumber ? 'input-invalid' : undefined}
                      value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="0123.456.789" />
                    {fieldError('companyNumber')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-14">{t('auth.vatNumber')}</label>
                    <input id="auth-f-14" className={errors.vatNumber ? 'input-invalid' : undefined}
                      value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="BE0123.456.789" />
                    {fieldError('vatNumber')}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="auth-f-15">{t('auth.responsibleName')}</label>
                  <input id="auth-f-15" className={errors.responsibleName ? 'input-invalid' : undefined}
                    value={responsibleName}
                    onChange={(e) => { setResponsibleName(e.target.value); setResponsibleTouched(true); }}
                    placeholder={t('auth.responsibleNamePlaceholder')}
                  />
                  {fieldError('responsibleName')}
                </div>
              </>
            )}

            {stepKey === 'address' && (
              <>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-8">{t('auth.street')}</label>
                    <input id="auth-f-8" className={errors.addressStreet ? 'input-invalid' : undefined} autoFocus
                      value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="Rue du Midi" />
                    {fieldError('addressStreet')}
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-9">{t('auth.number')}</label>
                    <input id="auth-f-9" className={errors.addressNumber ? 'input-invalid' : undefined}
                      value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="12" />
                    {fieldError('addressNumber')}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="auth-f-10">{t('auth.postalCode')}</label>
                    <input id="auth-f-10" className={errors.addressPostalCode ? 'input-invalid' : undefined}
                      value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="1000" />
                    {fieldError('addressPostalCode')}
                  </div>
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="auth-f-11">{t('auth.city')}</label>
                    <input id="auth-f-11" className={errors.addressCity ? 'input-invalid' : undefined}
                      value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="Bruxelles" />
                    {fieldError('addressCity')}
                  </div>
                </div>
              </>
            )}

            {stepKey === 'account' && (
              <>
                {GOOGLE_CLIENT_ID && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 10px' }}>
                      <div ref={googleBtnRef} />
                    </div>
                    <div className="row" style={{ alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                      <span className="small">{t('auth.or')}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                    </div>
                  </>
                )}
                <div className="field">
                  <label htmlFor="auth-f-17">{t('auth.email')}</label>
                  <input id="auth-f-17" type="email" className={errors.email ? 'input-invalid' : undefined}
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
                  {fieldError('email')}
                </div>
                <div className="field">
                  <div className="field-label-row">
                    <label htmlFor="auth-f-18">{t('auth.password')}</label>
                    <button type="button" className="btn-ghost field-toggle" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    </button>
                  </div>
                  <input id="auth-f-18" type={showPassword ? 'text' : 'password'}
                    className={errors.password ? 'input-invalid' : undefined}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholderRegister')}
                  />
                  {fieldError('password')}
                </div>
                {referralOpen ? (
                  <div className="field">
                    <label htmlFor="auth-f-16">{t('auth.promoCode')}</label>
                    <input id="auth-f-16" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder={t('auth.promoCodePlaceholder')} />
                  </div>
                ) : (
                  <button type="button" className="btn-ghost" style={{ padding: '2px 0', marginBottom: 10, fontSize: 13 }} onClick={() => setReferralOpen(true)}>
                    {t('auth.haveReferral')}
                  </button>
                )}
              </>
            )}

            <div className="auth-step-nav">
              {step > 0 && (
                <button type="button" className="btn-outline" onClick={goBack}>{t('auth.back')}</button>
              )}
              <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={loading}>
                {loading ? t('common.loading') : isLastStep ? t('auth.createAccount') : t('auth.continueStep')}
              </button>
            </div>
          </form>
        ) : (
          <>
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
                <input id="auth-f-18" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.password')} />
              </div>
              <button type="button" className="btn-ghost" style={{ padding: '2px 0', marginBottom: 10, fontSize: 13 }} onClick={() => { setForgotEmail(email); setForgotMode(true); }}>
                {t('auth.forgotPassword')}
              </button>
              <button type="submit" className="btn-gold btn-block" disabled={loading}>
                {loading ? t('common.loading') : t('auth.signIn')}
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
