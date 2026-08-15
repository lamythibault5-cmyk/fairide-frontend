import { useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';

export default function ContactSection() {
  const { t } = useLanguage();
  const INFO_CARDS = [
    { icon: '✉️', title: t('contact.emailLabel'), lines: ['fairide.entreprise@gmail.com'] },
    { icon: '📍', title: t('contact.locationLabel'), lines: [t('contact.locationValue')] },
    { icon: '📞', title: t('contact.phoneLabel'), lines: ['+32 474 20 07 13'] }
  ];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t('contact.errorRequired'));
      return;
    }
    setSending(true);
    try {
      await api('/contact', { method: 'POST', body: { name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() } });
      setSent(true);
      setName(''); setEmail(''); setPhone(''); setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="contact-grid">
      <div className="card">
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{t('contact.formTitle')}</h2>
        <p className="small" style={{ margin: '0 0 16px' }}>{t('contact.formSubtitle')}</p>
        {sent ? (
          <div className="pill teal" style={{ display: 'inline-block' }}>{t('contact.sentMessage')}</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>{t('contact.fullName')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contact.fullNamePlaceholder')} />
            </div>
            <div className="field">
              <label>{t('contact.emailLabel')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contact.emailPlaceholder')} />
            </div>
            <div className="field">
              <label>{t('contact.phone')}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('contact.phonePlaceholder')} />
            </div>
            <div className="field">
              <label>{t('contact.message')}</label>
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('contact.messagePlaceholder')} />
            </div>
            {error && <p className="small" style={{ color: 'var(--red)', margin: '0 0 10px' }}>{error}</p>}
            <button className="btn-gold" type="submit" disabled={sending} style={{ width: '100%' }}>
              {sending ? '...' : t('contact.send')}
            </button>
          </form>
        )}
      </div>
      <div className="contact-info-col">
        {INFO_CARDS.map((c) => (
          <div className="card contact-info-card" key={c.title}>
            <div className="contact-info-icon">{c.icon}</div>
            <div>
              <b>{c.title}</b>
              {c.lines.map((l) => <p className="small" key={l} style={{ margin: '2px 0 0' }}>{l}</p>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
