import { useState } from 'react';
import { api } from '../api';

const INFO_CARDS = [
  { icon: '✉️', title: 'Email', lines: ['fairide.entreprise@gmail.com'] },
  { icon: '📍', title: 'Localisation', lines: ['Belgique — Bruxelles (19 communes)'] },
  { icon: '📞', title: 'Téléphone & Rendez-vous', lines: ['+32 474 20 07 13'] }
];

export default function ContactSection() {
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
      setError('Nom, email et message sont requis.');
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
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Envoyez-nous un message</h2>
        <p className="small" style={{ margin: '0 0 16px' }}>Remplissez le formulaire ci-dessous et nous vous répondrons rapidement.</p>
        {sent ? (
          <div className="pill teal" style={{ display: 'inline-block' }}>✅ Message envoyé, merci ! On te répond très vite.</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nom complet</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean.dupont@example.com" />
            </div>
            <div className="field">
              <label>Téléphone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+32 XXX XX XX XX" />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Décrivez votre demande..." />
            </div>
            {error && <p className="small" style={{ color: 'var(--red)', margin: '0 0 10px' }}>{error}</p>}
            <button className="btn-gold" type="submit" disabled={sending} style={{ width: '100%' }}>
              {sending ? '...' : 'Envoyer le message'}
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
