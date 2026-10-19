import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import PasswordInput from '../components/PasswordInput';
import CadreConnexion from '../components/CadreConnexion';
import { BandeauGeneral, FeuilleGenerale } from '../components/EcranGeneral';
import Icone from '../components/Icone';
import { experienceApp } from '../natif';

/* NOUVEAU MOT DE PASSE (/reset-password?token=…, le lien de l'e-mail « mot de passe oublié »).
 *
 * Le dessin (fondateur, 2026-10-19, section 4 de finitions-appli.html) : la sœur de la connexion. Sur le site, le même
 * cadre que /login (CadreConnexion : moitié iris et feuille blanche sur ordinateur, tout sur le blanc sous l'en-tête des
 * visiteurs sur téléphone) ; dans l'app, le bandeau iris (la tuile du vélo, qui n'est pas un lien) et la feuille blanche.
 * Le sous-titre ne nomme pas le compte : le serveur ne le donne pas avant l'envoi (routes/auth.js, /reset-password ne
 * renvoie que { ok }) — on dit plutôt ce qui va se passer, vérifié dans la même route : toutes les sessions sont fermées.
 *
 * Les règles sont cochées au fil de la frappe sous le premier champ (les mêmes que l'inscription : motDePasse.js côté
 * serveur, 6 caractères, une majuscule, une minuscule) ; le toast reste en filet de sécurité à l'envoi. */
const APPLI = experienceApp();
const REGLES = [['mdpLongueur', (v) => v.length >= 6], ['mdpMajuscule', (v) => /[A-Z]/.test(v)], ['mdpMinuscule', (v) => /[a-z]/.test(v)]];

export default function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Lien refusé par le serveur (périmé ou déjà utilisé) : on propose d'en demander un autre au lieu d'un toast seul.
  const [lienRefuse, setLienRefuse] = useState(false);
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!token) { toast(t('resetPassword.toastInvalid'), 'erreur'); return; }
    if (REGLES.some(([, ok]) => !ok(password))) {
      toast(t('resetPassword.toastWeak'), 'erreur');
      return;
    }
    if (password !== passwordConfirm) {
      toast(t('resetPassword.toastMismatch'), 'erreur');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      toast(err.message, 'erreur');
      // Un mot de passe refusé répond AUSSI 400 (PASSWORD_WEAK, PASSWORD_BREACHED : motDePasse.js). Le lien, lui, est
      // encore bon : la page ne doit pas basculer sur « lien plus valable », il suffit d'en choisir un autre.
      if (err.status === 400 && !String(err.code || '').startsWith('PASSWORD_')) setLienRefuse(true);
    } finally {
      setLoading(false);
    }
  }

  let contenu;
  if (!token || lienRefuse) {
    contenu = (
      <>
        <p className="gn-note" role="alert"><Icone nom="horloge" taille={18} />{t('resetPassword.invalidLink')}</p>
        {/* Sans ce bouton, la page s'arrêtait là : il fallait deviner qu'il faut repasser par « Se connecter ». */}
        <Link to="/login?oubli=1" className="btn-gold gn-action">{t('resetPassword.newLink')}</Link>
      </>
    );
  } else if (done) {
    contenu = (
      <>
        <span className="gn-coche" aria-hidden="true"><Icone nom="valider" taille={24} /></span>
        <p className="gn-texte gn-texte--encre" role="status">{t('resetPassword.updated')}</p>
        <button type="button" className="btn-gold gn-action" onClick={() => navigate('/login')}>{t('resetPassword.login')}</button>
      </>
    );
  } else {
    contenu = (
      <form onSubmit={submit}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="reset-mdp">{t('resetPassword.title')}</label>
          {/* Plus de texte d'exemple qui redit la règle (il était coupé par l'œil sur téléphone) : la liste dessous la
              montre en entier, et reste visible pendant la frappe. */}
          <PasswordInput id="reset-mdp" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <ul className="mdp-criteres gn-regles" aria-live="polite">
            {REGLES.map(([cle, ok]) => {
              const tenue = ok(password);
              return (
                <li key={cle} className={tenue ? 'ok' : ''}>
                  <span className="gn-regle-rond" aria-hidden="true">{tenue && <Icone nom="valider" taille={11} />}</span>
                  {t(`auth.${cle}`)}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="field">
          <label htmlFor="reset-mdp-confirme">{t('resetPassword.confirm')}</label>
          <PasswordInput id="reset-mdp-confirme" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder={t('resetPassword.phConfirm')} autoComplete="new-password" />
        </div>
        <button type="submit" className="btn-gold gn-action" style={{ marginTop: 6 }} disabled={loading}>
          {loading ? t('common.loading') : t('resetPassword.submit')}
        </button>
      </form>
    );
  }

  // La phrase du dessous ne vaut que devant le formulaire (lien refusé ou mot de passe déjà changé : rien à choisir).
  const sous = token && !lienRefuse && !done ? t('resetPassword.sous') : null;
  if (!APPLI) {
    return (
      <CadreConnexion titre={t('resetPassword.title')} sous={sous}>
        <div className="auth-site-form">{contenu}</div>
      </CadreConnexion>
    );
  }
  return (
    <div className="gn-page">
      <BandeauGeneral marque titre={t('resetPassword.title')} sous={sous} />
      <FeuilleGenerale>{contenu}</FeuilleGenerale>
    </div>
  );
}
