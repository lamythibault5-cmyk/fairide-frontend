import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import PasswordInput from '../components/PasswordInput';

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
    if (password.length < 6 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
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
      if (err.status === 400) setLienRefuse(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="decor-page auth-decor">
      <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('resetPassword.title')}</h2>
          {(!token || lienRefuse) && (
            <>
              <p className="small texte-erreur">{t('resetPassword.invalidLink')}</p>
              {/* Sans ce bouton, la page s'arrêtait là : il fallait deviner qu'il faut repasser par « Se connecter ». */}
              <Link to="/login?oubli=1" className="btn-gold btn-block" style={{ display: 'block', textAlign: 'center', marginBottom: lienRefuse ? 14 : 0 }}>{t('resetPassword.newLink')}</Link>
            </>
          )}
          {token && done && (
            <>
              <p className="small" style={{ marginBottom: 14 }}>{t('resetPassword.updated')}</p>
              <button className="btn-gold btn-block" onClick={() => navigate('/login')}>{t('resetPassword.login')}</button>
            </>
          )}
          {token && !done && !lienRefuse && (
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="reset-mdp">{t('resetPassword.title')}</label>
                <PasswordInput id="reset-mdp" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('resetPassword.phPassword')} />
              </div>
              <div className="field">
                <label htmlFor="reset-mdp-confirme">{t('resetPassword.confirm')}</label>
                <PasswordInput id="reset-mdp-confirme" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder={t('resetPassword.phConfirm')} />
              </div>
              <button type="submit" className="btn-gold btn-block" disabled={loading}>
                {loading ? '...' : t('resetPassword.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
