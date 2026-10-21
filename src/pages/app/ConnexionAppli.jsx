import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PasswordInput from '../../components/PasswordInput';
import PhoneInput from '../../components/PhoneInput';
import BoutonsConnexionNative from '../../components/BoutonsConnexionNative';
import { estNatif, connexionFournisseur } from '../../natif';
import { attendrePage, espaceApresConnexion } from '../../routePrefetch';
import { lireBienvenue } from '../../bienvenue';
import { Haut } from './EcransBienvenue';
import { Champ } from './InscriptionAppli';

/* LA CONNEXION DANS L'APPLICATION (2026-10-15) — /login quand experienceApp(), à la place d'Auth.jsx.
 *
 * « J'ai déjà un compte », une session expirée, une déconnexion, un commerce touché sans compte : tout menait à la
 * page du site (en-tête Aide · Contact · Inscription, carte « Se connecter / Créer un compte », pied de page). C'est
 * maintenant un écran de l'accueil (.bv) : e-mail, mot de passe, un bouton. Les cas d'Auth.jsx y sont tous :
 *   - second facteur (TOTP_REQUIRED) : écran du code, pour le mot de passe comme pour Apple / Google ;
 *   - adresse jamais confirmée (EMAIL_NOT_VERIFIED) : écran du code ; un code neuf ne part que si l'ancien a expiré, et
 *     « Changer de numéro » y corrige un numéro mal tapé (audit du 19/10, auth-02 et auth-03) ;
 *   - mot de passe oublié (?oubli=1 aussi, lien périmé de ResetPassword.jsx) : e-mail, puis « lien envoyé » ;
 *   - pas de compte : « Créer un compte » ouvre l'inscription de l'app (/bienvenue, au choix du profil).
 * Un lien d'inscription du site (?audience=…&role=…) y mène directement, profil présélectionné. */

const AUDIENCE_ROLE = { partner: 'restaurant', client: 'client' };

export default function ConnexionAppli() {
  const { t } = useLanguage();
  const { login, verifyEmail, resendCode, changePendingPhone, forgotPassword, confirmForgotPassword, loginWithGoogle, loginWithApple } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Où revenir une fois connecté (ProtectedRoute, un commerce touché dans la liste) — comme Auth.jsx.
  const from = location.state?.from || '/';
  // Jeton Apple / Google d'un compte à second facteur, venu de l'accueil (Bienvenue.jsx) : on demande le code tout de suite.
  const [fed, setFed] = useState(location.state?.fed || null);
  // Inscription qui attend son code (Bienvenue.jsx, Apple / Google) : on arrive directement sur l'écran du code.
  const attenteCode = location.state?.attenteCode || null;
  const [ecran, setEcran] = useState(() => (attenteCode?.email ? 'code' : location.state?.fed ? 'totp' : params.get('oubli') === '1' ? 'oubli' : 'connexion'));
  // Canal du code d'activation (depuis le 18/10/2026, le SMS pour tout le monde) et numéro masqué, pour le dire à l'écran.
  const [canalCode, setCanalCode] = useState(attenteCode?.canal || 'email');
  const [telMasque, setTelMasque] = useState(attenteCode?.telephone || '');
  const [recule, setRecule] = useState(false);
  const [email, setEmail] = useState(attenteCode?.email || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [attente, setAttente] = useState(false);
  const [pasDeCompte, setPasDeCompte] = useState(false);
  // « Changer de numéro » (audit du 19/10, auth-03) : le bon numéro, et le jeton Apple / Google d'un compte qui attend son
  // code (il prouve le compte à la place du mot de passe, qu'un compte Apple / Google n'a pas).
  const [nouveauNumero, setNouveauNumero] = useState('');
  const [preuve, setPreuve] = useState(attenteCode?.preuve || null);

  // Lien d'inscription du site ouvert dans l'app : l'inscription de l'app, profil choisi.
  const audience = params.get('audience');
  /* LE MUR DE COMPTE D'UN COMMERCE (audit du 19/10, auth-07). Un commerce touché sans session (murCompte.js) arrive ici avec
   * ?audience=client et le commerce en `from`. Tout partait vers l'accueil (« Tu es… », le questionnaire), sans lien de
   * connexion, et « J'ai déjà un compte » y perdait le commerce : une personne qui avait déjà un compte sur ce téléphone
   * (déconnectée, session expirée) se reconnectait et tombait sur la liste. Sur un téléphone qui a déjà vu l'accueil, c'est
   * donc CET écran de connexion, le commerce gardé en `from` ; « Créer un compte » mène toujours à l'accueil, avec lui. Un
   * premier lancement garde l'accueil (bienvenue.js), qui garde aussi `from` jusqu'au compte ouvert. */
  const murCompte = audience === 'client' && !params.get('role') && !params.get('ref') && !!location.state?.from && !!lireBienvenue().vu;
  if ((audience || params.get('ref')) && !murCompte) {
    const role = params.get('role') || AUDIENCE_ROLE[audience] || null;
    return <Navigate to="/bienvenue" replace state={{ depart: 'profil', role, from }} />;
  }

  const creerCompte = () => navigate('/bienvenue', { state: { depart: 'profil', from } });
  function aller(suivant, { arriere = false } = {}) { setErreurs({}); setRecule(arriere); setEcran(suivant); }
  function retour() {
    if (ecran === 'connexion') { navigate('/', { replace: true }); return; }
    if (ecran === 'oubliCode') { setCode(''); aller('oubli', { arriere: true }); return; }
    if (ecran === 'numero') { aller('code', { arriere: true }); return; }
    setCode(''); setFed(null); setPreuve(null);
    aller('connexion', { arriere: true });
  }

  async function arriver(user) {
    toast(t('auth.welcome', { name: user.name }), 'succes');
    await attendrePage(from === '/' ? espaceApresConnexion(user) : from);
    navigate(from, { replace: true });
  }

  // Erreurs communes au mot de passe et au code : ce que le serveur répond, rangé sous le bon champ.
  async function traiter(err) {
    if (err.message === 'EMAIL_NOT_VERIFIED') {
      // Code de l'inscription encore valable (codeActif, audit du 19/10, auth-02) : l'écran du code, sans SMS de plus.
      if (err.data?.codeActif) {
        setCanalCode(err.data.channel === 'sms' ? 'sms' : 'email'); setTelMasque(err.data.phoneMasked || '');
        setCode(''); aller('code');
        toast(t('auth.codeStillValid'));
        return;
      }
      // Code expiré : on en envoie un neuf (comme Auth.jsx), par SMS ou par e-mail.
      let r = null;
      try { r = await resendCode(email.trim()); } catch { /* plafond atteint : « Renvoyer » reste là */ }
      const canal = (r?.channel || err.data?.channel) === 'sms' ? 'sms' : 'email';
      setCanalCode(canal); setTelMasque(r?.phoneMasked || err.data?.phoneMasked || '');
      setCode(''); aller('code');
      toast(t(canal === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
    } else if (err.code === 'TOTP_REQUIRED') {
      setCode(''); aller('totp');
    } else if (err.code === 'TOTP_INVALID' || err.code === 'TOTP_REPLAY') {
      setCode(''); setErreurs({ code: err.message });
    } else if (err.code === 'ACCOUNT_DELETED' || err.code === 'NO_ACCOUNT') {
      setPasDeCompte(true);
      setErreurs({ email: t(err.code === 'ACCOUNT_DELETED' ? 'auth.errAccountDeleted' : 'auth.errNoAccount') });
    } else if (ecran === 'numero') {
      // « Changer de numéro » : le numéro refusé sous son champ, le mot de passe faux sous le sien.
      const MESSAGES = { PHONE_TAKEN: 'auth.errPhoneTaken', PHONE_INVALID: 'auth.errPhoneInvalid', PHONE_DOUBLE_PREFIX: 'auth.errPhoneDoublePrefix' };
      if (err.field === 'phone') setErreurs({ phone: MESSAGES[err.code] ? t(MESSAGES[err.code]) : err.message });
      else if (err.code === 'BAD_CREDENTIALS' && !preuve) setErreurs({ password: err.message });
      else toast(err.message, 'erreur');
    } else {
      // Chaque écran montre l'erreur sous SON champ. « Mot de passe oublié » n'a que l'e-mail : l'erreur (trop de demandes,
      // serveur injoignable…) allait sous un champ « code » absent de l'écran, et le bouton semblait ne rien faire
      // (audit du 19/10, auth-04 / CROSS-43).
      setErreurs({ [{ connexion: 'password', oubli: 'email' }[ecran] || 'code']: err.message });
    }
  }

  async function valider(ev) {
    ev.preventDefault();
    if (attente) return;
    const requis = t('auth.errFieldRequired');
    if (ecran === 'connexion' || ecran === 'oubli') {
      const e = {};
      if (!email.trim()) e.email = requis;
      if (ecran === 'connexion' && !password) e.password = requis;
      if (Object.keys(e).length) { setErreurs(e); return; }
    }
    if ((ecran === 'totp' || ecran === 'code' || ecran === 'oubliCode') && !code.trim()) { setErreurs({ code: requis }); return; }
    if (ecran === 'envoye') { aller('connexion', { arriere: true }); return; }
    if (ecran === 'numero') {
      const e = {};
      if (!nouveauNumero.trim()) e.phone = requis;
      if (!preuve && !password) e.password = requis;
      if (Object.keys(e).length) { setErreurs(e); return; }
    }
    setAttente(true); setErreurs({}); setPasDeCompte(false);
    let reussi = false;
    try {
      let data = null;
      if (ecran === 'connexion') data = await login(email.trim(), password);
      else if (ecran === 'totp' && fed) {
        data = fed.fournisseur === 'apple'
          ? await loginWithApple(fed.jeton, 'client', { totpCode: code.trim(), givenName: fed.prenom || undefined, familyName: fed.nom || undefined })
          : await loginWithGoogle(fed.jeton, 'client', { totpCode: code.trim() });
      } else if (ecran === 'totp') data = await login(email.trim(), password, code.trim());
      else if (ecran === 'code') data = await verifyEmail(email.trim(), code.trim());
      else if (ecran === 'oubli') {
        // Adresse jamais confirmée : d'abord le code reçu à l'adresse, puis le lien (fondateur, 18/10/2026).
        const r = await forgotPassword(email.trim());
        if (r?.confirmationRequired) { setCode(''); aller('oubliCode'); return; }
        aller('envoye'); return;
      } else if (ecran === 'oubliCode') { await confirmForgotPassword(email.trim(), code.trim()); aller('envoye'); return; }
      else if (ecran === 'numero') {
        // Un code part au bon numéro (audit du 19/10, auth-03), puis retour à l'écran du code.
        const r = await changePendingPhone(email.trim(), nouveauNumero.trim(), { password, preuve });
        const canal = r?.channel === 'sms' ? 'sms' : 'email';
        setCanalCode(canal); setTelMasque(r?.phoneMasked || nouveauNumero.trim());
        setCode(''); aller('code', { arriere: true });
        toast(t(canal === 'sms' ? 'auth.errVerificationSentSms' : 'auth.errVerificationSent'));
        return;
      }
      reussi = true;
      await arriver(data.user);
    } catch (err) {
      await traiter(err);
    } finally {
      if (!reussi) setAttente(false);
    }
  }

  // Apple / Google (application native) : compte existant → connecté ; pas encore de compte → l'inscription de l'app.
  async function viaFournisseur(fournisseur) {
    setAttente(true);
    let reussi = false;
    try {
      const jeton = await connexionFournisseur(fournisseur);
      try {
        const data = jeton.fournisseur === 'apple'
          ? await loginWithApple(jeton.jeton, 'client', { givenName: jeton.prenom || undefined, familyName: jeton.nom || undefined })
          : await loginWithGoogle(jeton.jeton, 'client', {});
        reussi = true;
        await arriver(data.user);
      } catch (err) {
        // Pas encore de compte : l'inscription de l'app, AVEC ce jeton (avant, il était jeté et la personne devait
        // retoucher « Continuer avec… » à la fin de l'accueil).
        if (err.message === 'INCOMPLETE_PROFILE') { toast(t('auth.errNoAccount')); navigate('/bienvenue', { state: { depart: 'profil', from, fed: jeton } }); return; }
        if (err.code === 'TOTP_REQUIRED') { setFed(jeton); setCode(''); aller('totp'); return; }
        // Inscription Apple / Google faite, code SMS jamais saisi : l'écran du code (« Renvoyer » y est).
        if (err.message === 'PHONE_NOT_VERIFIED') {
          setPreuve({ fournisseur: jeton.fournisseur, jeton: jeton.jeton });
          setEmail(err.data?.email || ''); setCanalCode('sms'); setTelMasque(err.data?.phoneMasked || '');
          setCode(''); aller('code'); return;
        }
        toast(err.message, 'erreur');
      }
    } catch (err) {
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) toast(err?.message ? `${t('appli.nativeLoginFailed')} (${err.message})` : t('appli.nativeLoginFailed'), 'erreur');
    } finally {
      if (!reussi) setAttente(false);
    }
  }

  // « Renvoyer le code » sur l'écran de confirmation d'adresse du mot de passe oublié : la même demande, un code neuf.
  async function renvoyerOubli() {
    setAttente(true);
    try { await forgotPassword(email.trim()); setCode(''); toast(t('auth.newCodeSent')); }
    catch (err) { toast(err.message, 'erreur'); }
    finally { setAttente(false); }
  }

  async function renvoyer() {
    setAttente(true);
    try {
      const r = await resendCode(email.trim());
      if (r?.channel) { setCanalCode(r.channel === 'sms' ? 'sms' : 'email'); if (r.phoneMasked) setTelMasque(r.phoneMasked); }
      setCode(''); toast(t(r?.channel === 'sms' ? 'auth.errVerificationSentSms' : 'auth.newCodeSent'));
    }
    catch (err) { toast(err.message, 'erreur'); }
    finally { setAttente(false); }
  }

  const champCode = (
    <>
      <label htmlFor="bv-c-code" className="sr-only">{t('auth.verifyCodeLabel')}</label>
      <input id="bv-c-code" className={`bv-saisie${erreurs.code ? ' input-invalid' : ''}`} inputMode="numeric" autoComplete="one-time-code" maxLength={ecran === 'totp' ? 11 : 6}
        placeholder="123456" value={code} onChange={(e) => setCode(ecran === 'totp' ? e.target.value : e.target.value.replace(/\D/g, '').slice(0, 6))} />
      {erreurs.code && <p className="field-error bv-centre" role="alert">{erreurs.code}</p>}
    </>
  );

  // Titre et sous-titre : sur le bandeau iris, au-dessus de la feuille (EcransBienvenue.jsx, Feuille).
  const titre = (texte, sous) => <><h1 className="bv-titre bv-titre-form">{texte}</h1><p className="bv-sous">{sous}</p></>;
  let entete;
  let contenu;
  let bouton = t('auth.signIn');
  switch (ecran) {
    case 'totp':
      bouton = t('auth.confirm');
      entete = titre(t('auth.totpLabel'), t('auth.totpHelp'));
      contenu = champCode;
      break;
    case 'code':
      bouton = t('auth.confirm');
      entete = titre(t('auth.verifyTitle'), canalCode === 'sms' ? t('auth.verifyTextSms', { phone: telMasque }) : t('auth.verifyText', { email: email.trim() }));
      contenu = (
        <>
          {champCode}
          <button type="button" className="bv-lien" disabled={attente} onClick={renvoyer}>{t('auth.resendCode')}</button>
          <button type="button" className="bv-lien" disabled={attente} onClick={() => { setNouveauNumero(''); aller('numero'); }}>{t('auth.changePhone')}</button>
        </>
      );
      break;
    case 'numero':
      bouton = t('auth.changePhoneSend');
      entete = titre(t('auth.changePhoneTitle'), t('auth.changePhoneText'));
      contenu = (
        <>
          <Champ id="bv-c-tel" label={t('auth.phone')} erreur={erreurs.phone}>
            <PhoneInput id="bv-c-tel" value={nouveauNumero} onChange={setNouveauNumero} invalid={!!erreurs.phone} />
          </Champ>
          {/* Sans jeton Apple / Google ni mot de passe en mémoire (écran rouvert), le mot de passe prouve le compte. */}
          {!preuve && (
            <Champ id="bv-c-tel-mdp" label={t('auth.changePhonePassword')} erreur={erreurs.password}>
              <PasswordInput id="bv-c-tel-mdp" value={password} invalid={!!erreurs.password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
            </Champ>
          )}
        </>
      );
      break;
    case 'oubliCode':
      bouton = t('auth.forgotConfirmBtn');
      entete = titre(t('auth.forgotConfirmTitle'), t('auth.forgotConfirmText', { email: email.trim() }));
      contenu = (
        <>
          {champCode}
          <button type="button" className="bv-lien" disabled={attente} onClick={renvoyerOubli}>{t('auth.resendCode')}</button>
        </>
      );
      break;
    case 'oubli':
      bouton = t('auth.sendLink');
      entete = titre(t('auth.forgotTitle'), t('auth.forgotText'));
      contenu = (
        <>
          <Champ id="bv-c-email-oubli" label={t('auth.email')} erreur={erreurs.email}>
            <input id="bv-c-email-oubli" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              className={erreurs.email ? 'input-invalid' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.phEmail')} />
          </Champ>
        </>
      );
      break;
    case 'envoye':
      bouton = t('appli.connRetour');
      entete = titre(t('auth.forgotTitle'), t('auth.forgotSubmittedText', { email: email.trim() }));
      contenu = null;
      break;
    default:
      entete = titre(t('appli.connTitre'), t('appli.connSous'));
      contenu = (
        <>
          <Champ id="bv-c-email" label={t('auth.email')} erreur={erreurs.email}>
            <input id="bv-c-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              className={erreurs.email ? 'input-invalid' : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.phEmail')} />
          </Champ>
          {pasDeCompte && <button type="button" className="bv-lien bv-lien-serre" onClick={creerCompte}>{t('appli.connCreer')}</button>}
          <Champ id="bv-c-mdp" label={t('auth.password')} erreur={erreurs.password}>
            <PasswordInput id="bv-c-mdp" value={password} invalid={!!erreurs.password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
          </Champ>
          <button type="button" className="bv-ajout" onClick={() => aller('oubli')}>{t('auth.forgotPassword')}</button>
        </>
      );
  }

  return (
    <div className="bv bv-bandeau">
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={ecran}>
        <Haut onRetour={retour} progression={null} />
        {entete}
        <form className="bv-form bv-feuille" onSubmit={valider} noValidate>
          {contenu}
          <div className="bv-grandit" />
          {/* Apple / Google : dans la vraie application seulement, au-dessus du bouton (comme l'écran du compte). */}
          {ecran === 'connexion' && estNatif() && <BoutonsConnexionNative onChoix={viaFournisseur} disabled={attente} />}
          <button type="submit" className="bv-btn btn-gold" disabled={attente}>{attente ? t('common.loading') : bouton}</button>
          {/* Pas en double : après « aucun compte », le lien est déjà sous le champ e-mail. */}
          {ecran === 'connexion' && !pasDeCompte && <button type="button" className="bv-lien" onClick={creerCompte}>{t('appli.connCreer')}</button>}
        </form>
      </main>
    </div>
  );
}
