import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icone from './Icone';

/* « CONFIRMER MON E-MAIL », DANS MON COMPTE (fondateur, 2026-10-18).
 *
 * L'inscription prouve le TÉLÉPHONE par SMS ; l'adresse e-mail se confirme ici, quand on veut. Elle est exigée pour
 * réinitialiser le mot de passe (sinon, après une faute de frappe, le lien partirait chez un inconnu) et pour recevoir les
 * nouvelles. Un code à 6 chiffres part à l'adresse et se tape ICI, dans le compte — pas un lien : un lien suffirait à qui
 * tient la boîte. Serveur : routes/auth.js, /me/email/confirm. Même allure que la vérification du téléphone
 * (PhoneVerification.jsx), juste au-dessus. */
export default function EmailConfirmation() {
  const { user, token, refreshUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [etape, setEtape] = useState('repos'); // repos | envoye
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);

  if (!user?.email || user.emailConfirmed !== false) return null;

  async function demander() {
    setOccupe(true);
    try {
      const r = await api('/auth/me/email/confirm/send', { method: 'POST', token });
      if (r.alreadyConfirmed) { await refreshUser(); return; }
      setEtape('envoye');
      toast(t('accountUi.emailCodeSent', { email: user.email }));
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  async function confirmer() {
    if (!code.trim()) { toast(t('accountUi.toastCodeRequired'), 'erreur'); return; }
    setOccupe(true);
    try {
      await api('/auth/me/email/confirm', { method: 'POST', token, body: { code: code.trim() } });
      await refreshUser();
      toast(t('accountUi.emailConfirmedToast'));
      setEtape('repos'); setCode('');
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  return (
    <div className="phone-verif" style={{ marginTop: 6 }}>
      {etape === 'repos' ? (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small" style={{ flex: '1 1 200px' }}><Icone nom="alerte" taille={16} className="icone-texte" />{' '}{t('accountUi.emailNotConfirmed')}</span>
          <button type="button" className="btn-outline btn-sm" disabled={occupe} onClick={demander}>
            {occupe ? '...' : t('accountUi.confirmEmail')}
          </button>
        </div>
      ) : (
        <div>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('accountUi.emailCodeSent', { email: user.email })}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, margin: 0, minWidth: 140 }}>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" maxLength={6} inputMode="numeric" autoComplete="one-time-code" aria-label={t('accountUi.confirmEmail')} />
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
