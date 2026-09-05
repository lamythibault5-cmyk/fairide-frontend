import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

export default function ResetPassword() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { resetPassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!token) { toast(t('resetPassword.toastInvalid')); return; }
    if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      toast(t('resetPassword.toastWeak'));
      return;
    }
    if (password !== passwordConfirm) {
      toast(t('resetPassword.toastMismatch'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      toast(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="decor-page auth-decor">
      <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t('resetPassword.title')}</h2>
          {!token && (
            <p className="small" style={{ color: 'var(--red)' }}>{t('resetPassword.invalidLink')}</p>
          )}
          {token && done && (
            <>
              <p className="small" style={{ marginBottom: 14 }}>{t('resetPassword.updated')}</p>
              <button className="btn-gold btn-block" onClick={() => navigate('/login')}>{t('resetPassword.login')}</button>
            </>
          )}
          {token && !done && (
            <form onSubmit={submit}>
              <div className="field">
                <label>{t('resetPassword.title')}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('resetPassword.phPassword')} />
              </div>
              <div className="field">
                <label>{t('resetPassword.confirm')}</label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder={t('resetPassword.phConfirm')} />
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
