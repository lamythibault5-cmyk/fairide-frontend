import { useState, useId } from 'react';
import { emailValide, telephonePlausible } from '../validation';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';

// `messageInitial` sert au centre d'aide : quand on arrive par « Signaler un bug », le message est
// déjà amorcé avec ce qu'il faut nous dire. Une trame vaut mieux qu'un champ vide — c'est elle qui
// fait la différence entre « ça marche pas » et un rapport exploitable.
export default function ContactSection({ messageInitial = '' }) {
  // Identifiants d'etiquette : useId donne une valeur par instance, donc pas de collision
  // quand ce composant est rendu plusieurs fois sur la meme page.
  const idsA11y = useId();
  const { t } = useLanguage();
  const INFO_CARDS = [
    // Noms du jeu maison (Icone.jsx), plus des emojis : le ✉️ et le 📞 se rendaient avec la police
    // du systeme, donc bleus et bombes sur Windows, plats ailleurs, a cote d'une interface au trait.
    { icon: 'courrier', title: t('contact.emailLabel'), lines: ['contact@fairide.be'] },
    { icon: 'position', title: t('contact.locationLabel'), lines: [t('contact.locationValue')] },
    { icon: 'telephone', title: t('contact.phoneLabel'), lines: ['+32 491 97 99 80'] }
  ];
  const ROLES = [
    { value: 'client', label: t('contact.roleClient') },
    { value: 'driver', label: t('contact.roleDriver') },
    { value: 'restaurant', label: t('contact.roleRestaurant') },
    { value: 'other', label: t('contact.roleOther') }
  ];
  const [senderRole, setSenderRole] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState(messageInitial);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [siteWeb, setSiteWeb] = useState(''); // pot de miel (voir routes/contact.js)

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!senderRole || !name.trim() || !email.trim() || !message.trim()) {
      setError(t('contact.errorRequired'));
      return;
    }
    if (!emailValide(email)) { setError(t('contact.errorEmail')); return; }
    if (phone.trim() && !telephonePlausible(phone)) { setError(t('contact.errorPhone')); return; }
    setSending(true);
    try {
      await api('/contact', { method: 'POST', body: { role: senderRole, name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim(), website: siteWeb } });
      setSent(true);
      setSenderRole(''); setName(''); setEmail(''); setPhone(''); setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="contact-grid">
      <div className="card">
        <p className="small" style={{ margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 700, color: 'var(--teal)' }}>{t('contact.eyebrow')}</p>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{t('contact.formTitle')}</h2>
        <p className="small" style={{ margin: '0 0 16px' }}>{t('contact.formSubtitle')}</p>
        {sent ? (
          <div className="pill teal" style={{ display: 'inline-block' }}>{t('contact.sentMessage')}</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <span className="titre-groupe" id="contact-role-titre">{t('contact.roleLabel')}</span>
              <div className="role-pick" style={{ marginBottom: 0 }} role="group" aria-labelledby="contact-role-titre">
                {ROLES.map((r) => (
                  <button type="button" key={r.value} aria-pressed={senderRole === r.value} className={`chip${senderRole === r.value ? ' active' : ''}`} onClick={() => setSenderRole(r.value)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor={idsA11y + '-fullname'}>{t('contact.fullName')}</label>
              <input id={idsA11y + '-fullname'} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contact.fullNamePlaceholder')} required maxLength={120} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor={idsA11y + '-emaillabel'}>{t('contact.emailLabel')}</label>
              <input id={idsA11y + '-emaillabel'} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contact.emailPlaceholder')} required maxLength={200} autoComplete="email" inputMode="email" />
            </div>
            <div className="field">
              <label htmlFor={idsA11y + '-phone'}>{t('contact.phone')}</label>
              <input id={idsA11y + '-phone'} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('contact.phonePlaceholder')} maxLength={40} />
            </div>
            <div className="field">
              <label htmlFor={idsA11y + '-message'}>{t('contact.message')}</label>
              <textarea id={idsA11y + '-message'} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('contact.messagePlaceholder')} required maxLength={4000} />
            </div>
            {/* Pot de miel : invisible et hors tabulation ; un robot le remplit, le serveur ignore alors l'envoi. */}
            <div className="hp-champ" aria-hidden="true">
              <label htmlFor={idsA11y + '-website'}>Site web</label>
              <input id={idsA11y + '-website'} name="website" tabIndex={-1} autoComplete="off" value={siteWeb} onChange={(e) => setSiteWeb(e.target.value)} />
            </div>
            {error && <p className="small" role="alert" style={{ color: 'var(--red)', margin: '0 0 10px' }}>{error}</p>}
            <button className="btn-gold" type="submit" disabled={sending} style={{ width: '100%' }}>
              {sending ? '...' : t('contact.send')}
            </button>
          </form>
        )}
      </div>
      <div className="contact-info-col">
        {INFO_CARDS.map((c) => (
          <div className="card contact-info-card" key={c.title}>
            <div className="contact-info-icon"><Icone nom={c.icon} taille={22} /></div>
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
