import { useState } from 'react';
import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

// Texte dans translations.js (espace `privacy`), en trois langues.
const SECTIONS = ['collected', 'purpose', 'sharing', 'retention', 'rights', 'cookies'];
const REQUEST_TYPES = ['access', 'delete', 'rectify', 'portability', 'objection'];

// Les sous-traitants, dans l'ordre où ils interviennent : payer, être prévenu, se connecter, être
// livré, puis ce qui tourne en arrière-plan.
//
// LA LISTE VIENT DU CODE, PAS D'UN SOUVENIR. Elle a été établie en relisant les appels réellement
// émis — geocode.js pour Nominatim, DeliveryTrackingMap.jsx pour OSRM et les fonds de carte,
// menuImport.js et menuTranslate.js pour Anthropic, cloudinary.js, main.jsx pour Sentry. La
// politique n'en citait que trois (Stripe, Resend, Google) ; cinq recevaient des données
// personnelles sans être déclarés nulle part. Ajouter un service ici quand on en branche un.
// Les noms sont des noms propres : ils ne se traduisent pas, seule la description est dans les
// trois langues.
const SOUS_TRAITANTS = [
  ['stripe', 'Stripe'],
  ['resend', 'Resend'],
  ['google', 'Google'],
  ['nominatim', 'Nominatim (OpenStreetMap)'],
  ['osrm', 'OSRM'],
  ['osmTiles', 'OpenStreetMap'],
  ['anthropic', 'Anthropic (Claude)'],
  ['cloudinary', 'Cloudinary'],
  ['sentry', 'Sentry'],
  ['vercel', 'Vercel'],
  ['railway', 'Railway'],
  ['unsplash', 'Unsplash']
];

export default function Privacy() {
  const { t } = useLanguage();
  usePageMeta({ title: t('privacy.pageTitle'), description: t('seo.privacyDescription'), path: '/confidentialite' });
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
          {/* Le tableau se glisse juste après « Partage des données », dont il est le détail :
              cette section dit à qui les données vont, celui-ci dit quoi, service par service. */}
          {s === 'sharing' && <SousTraitants />}
        </div>
      ))}
      <PrivacyRequestForm />
    </div>
  );
}

// Le tableau des sous-traitants. Deux colonnes seulement, et pas trois : sur un téléphone, une
// troisième colonne « finalité » forcerait un défilement horizontal sur la page qu'on lit le plus
// souvent sur mobile, en petits caractères. La finalité tient dans la description.
function SousTraitants() {
  const { t } = useLanguage();
  return (
    <div className="sous-traitants">
      <h3>{t('privacy.subprocessorsTitle')}</h3>
      <p className="small">{t('privacy.subprocessorsIntro')}</p>
      <div className="sous-traitants-tableau">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('privacy.subprocessorsService')}</th>
              <th scope="col">{t('privacy.subprocessorsData')}</th>
            </tr>
          </thead>
          <tbody>
            {SOUS_TRAITANTS.map(([cle, nom]) => (
              <tr key={cle}>
                <th scope="row">{nom}</th>
                <td>{t(`privacy.sub_${cle}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">{t('privacy.subprocessorsOutsideEu')}</p>
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
