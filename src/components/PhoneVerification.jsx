import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

// Vérification du numéro de téléphone du compte, depuis « Mon compte » — jamais bloquante : elle peut se
// faire plus tard, la ligne le rappelle simplement tant qu'elle n'est pas faite. Le code arrive par SMS
// quand Fairide a un fournisseur SMS (voir sms.js côté serveur), sinon par e-mail à l'adresse du compte.
export default function PhoneVerification() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [etape, setEtape] = useState('repos'); // repos | envoye
  const [canal, setCanal] = useState('email');
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);

  if (!user?.phone) return null;
  if (user.phoneVerified) {
    return <p className="small" style={{ margin: '4px 0 0', color: 'var(--ok, #2e7d32)' }}>✅ {t('accountUi.phoneVerified')}</p>;
  }

  async function demander() {
    setOccupe(true);
    try {
      const r = await api('/auth/me/phone/request-verification', { method: 'POST', token });
      if (r.alreadyVerified) { await refreshUser(); return; }
      setCanal(r.canal || 'email'); setEtape('envoye');
      toast(r.canal === 'sms' ? t('accountUi.phoneCodeSentSms', { phone: user.phone }) : t('accountUi.phoneCodeSentEmail', { email: user.email }));
    } catch (e) { toast(e.message); } finally { setOccupe(false); }
  }

  async function confirmer() {
    if (!code.trim()) { toast(t('accountUi.toastCodeRequired')); return; }
    setOccupe(true);
    try {
      await api('/auth/me/phone/verify', { method: 'POST', token, body: { code: code.trim() } });
      await refreshUser();
      toast(t('accountUi.phoneVerifiedToast'));
      setEtape('repos'); setCode('');
    } catch (e) { toast(e.message); } finally { setOccupe(false); }
  }

  return (
    <div className="phone-verif" style={{ marginTop: 6 }}>
      {etape === 'repos' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small" style={{ flex: '1 1 200px' }}>⚠️ {t('accountUi.phoneNotVerified')}</span>
          <button type="button" className="btn-outline" style={{ padding: '6px 14px', fontSize: 13 }} disabled={occupe} onClick={demander}>
            {occupe ? '...' : t('accountUi.verifyPhone')}
          </button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>
            {canal === 'sms' ? t('accountUi.phoneCodeSentSms', { phone: user.phone }) : t('accountUi.phoneCodeSentEmail', { email: user.email })}
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} inputMode="numeric" autoComplete="one-time-code" aria-label={t('accountUi.verifyPhone')} />
            </div>
            <button type="button" className="btn-teal" disabled={occupe} onClick={confirmer}>{occupe ? '...' : t('accountUi.confirm')}</button>
            <button type="button" className="btn-ghost" disabled={occupe} onClick={demander}>{t('accountUi.resend')}</button>
            <button type="button" className="btn-ghost" onClick={() => { setEtape('repos'); setCode(''); }}>{t('accountUi.phoneVerifyLater')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
