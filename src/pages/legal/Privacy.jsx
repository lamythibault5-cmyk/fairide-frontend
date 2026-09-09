import { useState } from 'react';
import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `privacy`), en trois langues.
const SECTIONS = ['collected', 'purpose', 'sharing', 'retention', 'rights', 'cookies'];
const REQUEST_TYPES = ['access', 'delete', 'rectify', 'portability', 'objection'];

export default function Privacy() {
  const { t } = useLanguage();
  usePageMeta({ title: t('privacy.pageTitle'), path: '/confidentialite' });
  return (
    <div className="card">
      <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
        {t('privacy.draftWarning')}
      </div>
      <h2 style={{ marginTop: 0 }}>{t('privacy.title')}</h2>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`privacy.${s}Title`)}</h3>
          <p className="small"><Rich text={t(`privacy.${s}`)} /></p>
        </div>
      ))}
      <PrivacyRequestForm />
    </div>
  );
}

// Exercice des droits RGPD (accès, suppression, rectification, portabilité, opposition) : la demande
// rejoint le registre de l'application admin « Conformité & RGPD » (POST /privacy/request, limité par IP)
// et un accusé de réception part immédiatement vers l'adresse indiquée.
function PrivacyRequestForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [type, setType] = useState('access');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await api('/privacy/request', { method: 'POST', body: { email: email.trim(), type, message: message.trim() } });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
      <h3>{t('privacy.requestTitle')}</h3>
      <p className="small">{t('privacy.requestIntro')}</p>
      {sent ? (
        <div style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>{t('privacy.requestSuccess')}</div>
      ) : (
        <form onSubmit={submit} style={{ maxWidth: 520 }}>
          <div className="field">
            <label htmlFor="privacy-email">{t('privacy.requestEmail')}</label>
            <input id="privacy-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="privacy-type">{t('privacy.requestType')}</label>
            <select id="privacy-type" value={type} onChange={(e) => setType(e.target.value)}>
              {REQUEST_TYPES.map((k) => <option key={k} value={k}>{t(`privacy.reqType_${k}`)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="privacy-message">{t('privacy.requestMessage')}</label>
            <textarea id="privacy-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn-gold" disabled={sending}>{sending ? '...' : t('privacy.requestSubmit')}</button>
        </form>
      )}
    </div>
  );
}
