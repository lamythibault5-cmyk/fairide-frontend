import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ResetPassword() {
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
    if (!token) { toast('Lien invalide — demande un nouveau lien de réinitialisation.'); return; }
    if (password.length < 5 || !/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
      toast('Le mot de passe doit faire au moins 5 caractères et contenir une majuscule et une minuscule.');
      return;
    }
    if (password !== passwordConfirm) {
      toast('Les deux mots de passe ne correspondent pas.');
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
      <div className="decor-blob teal" style={{ width: 300, height: 300, top: -100, left: -120 }} />
      <div className="decor-blob gold" style={{ width: 260, height: 260, bottom: -80, right: -100 }} />
      <div className="auth-box">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Nouveau mot de passe</h2>
          {!token && (
            <p className="small" style={{ color: 'var(--red)' }}>Ce lien est invalide. Demande un nouveau lien de réinitialisation depuis la page de connexion.</p>
          )}
          {token && done && (
            <>
              <p className="small" style={{ marginBottom: 14 }}>Ton mot de passe a été mis à jour. Tu peux maintenant te connecter.</p>
              <button className="btn-gold btn-block" onClick={() => navigate('/login')}>Se connecter</button>
            </>
          )}
          {token && !done && (
            <form onSubmit={submit}>
              <div className="field">
                <label>Nouveau mot de passe</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="5 caractères min., 1 majuscule, 1 minuscule" />
              </div>
              <div className="field">
                <label>Confirme le nouveau mot de passe</label>
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Retape le même mot de passe" />
              </div>
              <button type="submit" className="btn-gold btn-block" disabled={loading}>
                {loading ? '...' : 'Réinitialiser mon mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
