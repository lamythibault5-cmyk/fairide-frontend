import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PasswordInput from '../../components/PasswordInput';
import BoutonsConnexionNative from '../../components/BoutonsConnexionNative';
import { estNatif, connexionFournisseur } from '../../natif';
import { attendrePage, espaceApresConnexion } from '../../routePrefetch';
import { Haut } from './EcransBienvenue';
import { Champ } from './InscriptionAppli';

/* LA CONNEXION DANS L'APPLICATION (2026-10-15) — /login quand experienceApp(), à la place d'Auth.jsx.
 *
 * « J'ai déjà un compte », une session expirée, une déconnexion, un commerce touché sans compte : tout menait à la
 * page du site (en-tête Aide · Contact · Inscription, carte « Se connecter / Créer un compte », pied de page). C'est
 * maintenant un écran de l'accueil (.bv) : e-mail, mot de passe, un bouton. Les cas d'Auth.jsx y sont tous :
 *   - second facteur (TOTP_REQUIRED) : écran du code, pour le mot de passe comme pour Apple / Google ;
 *   - adresse jamais confirmée (EMAIL_NOT_VERIFIED) : un code neuf part, écran du code ;
 *   - mot de passe oublié (?oubli=1 aussi, lien périmé de ResetPassword.jsx) : e-mail, puis « lien envoyé » ;
 *   - pas de compte : « Créer un compte » ouvre l'inscription de l'app (/bienvenue, au choix du profil).
 * Un lien d'inscription du site (?audience=…&role=…) y mène directement, profil présélectionné. */

const AUDIENCE_ROLE = { partner: 'restaurant', client: 'client' };

export default function ConnexionAppli() {
  const { t } = useLanguage();
  const { login, verifyEmail, resendCode, forgotPassword, loginWithGoogle, loginWithApple } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Où revenir une fois connecté (ProtectedRoute, un commerce touché dans la liste) — comme Auth.jsx.
  const from = location.state?.from || '/';
  // Jeton Apple / Google d'un compte à second facteur, venu de l'accueil (Bienvenue.jsx) : on demande le code tout de suite.
  const [fed, setFed] = useState(location.state?.fed || null);
  const [ecran, setEcran] = useState(() => (location.state?.fed ? 'totp' : params.get('oubli') === '1' ? 'oubli' : 'connexion'));
  const [recule, setRecule] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [attente, setAttente] = useState(false);
  const [pasDeCompte, setPasDeCompte] = useState(false);

  // Lien d'inscription du site ouvert dans l'app : l'inscription de l'app, profil choisi.
  const audience = params.get('audience');
  if (audience || params.get('ref')) {
    const role = params.get('role') || AUDIENCE_ROLE[audience] || null;
    return <Navigate to="/bienvenue" replace state={{ depart: 'profil', role, from }} />;
  }

  const creerCompte = () => navigate('/bienvenue', { state: { depart: 'profil', from } });
  function aller(suivant, { arriere = false } = {}) { setErreurs({}); setRecule(arriere); setEcran(suivant); }
  function retour() {
    if (ecran === 'connexion') { navigate('/', { replace: true }); return; }
    setCode(''); setFed(null);
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
      // Le code de l'inscription a sans doute expiré : on en envoie un neuf (comme Auth.jsx).
      try { await resendCode(email.trim()); } catch { /* plafond atteint : « Renvoyer » reste là */ }
      setCode(''); aller('code');
      toast(t('auth.errVerificationSent'));
    } else if (err.code === 'TOTP_REQUIRED') {
      setCode(''); aller('totp');
    } else if (err.code === 'TOTP_INVALID' || err.code === 'TOTP_REPLAY') {
      setCode(''); setErreurs({ code: err.message });
    } else if (err.code === 'ACCOUNT_DELETED' || err.code === 'NO_ACCOUNT') {
      setPasDeCompte(true);
      setErreurs({ email: t(err.code === 'ACCOUNT_DELETED' ? 'auth.errAccountDeleted' : 'auth.errNoAccount') });
    } else {
      setErreurs({ [ecran === 'connexion' ? 'password' : 'code']: err.message });
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
    if ((ecran === 'totp' || ecran === 'code') && !code.trim()) { setErreurs({ code: requis }); return; }
    if (ecran === 'envoye') { aller('connexion', { arriere: true }); return; }
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
      else if (ecran === 'oubli') { await forgotPassword(email.trim()); aller('envoye'); return; }
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
        toast(err.message, 'erreur');
      }
    } catch (err) {
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) toast(err?.message ? `${t('appli.nativeLoginFailed')} (${err.message})` : t('appli.nativeLoginFailed'), 'erreur');
    } finally {
      if (!reussi) setAttente(false);
    }
  }

  async function renvoyer() {
    setAttente(true);
    try { await resendCode(email.trim()); setCode(''); toast(t('auth.newCodeSent')); }
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
      entete = titre(t('auth.verifyTitle'), t('auth.verifyText', { email: email.trim() }));
      contenu = (
        <>
          {champCode}
          <button type="button" className="bv-lien" disabled={attente} onClick={renvoyer}>{t('auth.resendCode')}</button>
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
