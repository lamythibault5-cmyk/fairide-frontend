import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

/* Signaler un contenu ou un commerce (DSA art. 16 — backlog C6 du 23/09/2026).
 *
 * Ouvert à tous, connecté ou non : un signalement ne doit pas exiger un compte. On demande ce que
 * l'art. 16 §2 attend d'un signalement recevable — l'élément visé, la raison, une explication, une
 * adresse pour la réponse, et la déclaration de bonne foi. L'élément visé arrive par l'adresse
 * (?type=restaurant&id=…&nom=…) depuis le lien « Signaler » de la fiche. Le serveur accuse réception
 * par e-mail et envoie ensuite la décision motivée (routes/conformite.js). */
const CATEGORIES = ['illegal_product', 'food_safety', 'allergen_info', 'misleading', 'hate_or_harassment', 'fraud', 'ip_infringement', 'minor_safety', 'other'];

export default function ReportPage() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const toast = useToast();
  const id = useId();
  const [params] = useSearchParams();
  const type = params.get('type') || 'restaurant';
  const cibleId = params.get('id') || '';
  const nom = params.get('nom') || '';
  const [category, setCategory] = useState('');
  const [explanation, setExplanation] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [goodFaith, setGoodFaith] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(null);
  usePageMeta({ title: t('conformite.reportPageTitle'), description: t('conformite.reportPageTitle'), path: '/signaler' });

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const r = await api('/reports', { method: 'POST', token: token || undefined, body: { targetType: type, targetId: cibleId, category, explanation: explanation.trim(), email: email.trim(), goodFaith } });
      setEnvoye(r.id);
    } catch (err) {
      toast(err.message, 'erreur');
    } finally { setEnvoi(false); }
  }

  if (!cibleId) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('conformite.reportPageTitle')}</h2>
        <p className="small">{t('conformite.reportNoTarget')}</p>
        <p className="small">{t('conformite.dsaContactBody')}</p>
      </div>
    );
  }
  if (envoye) {
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t('conformite.reportSentTitle')}</h2>
        <p className="small">{t('conformite.reportSentBody', { ref: envoye })}</p>
        <Link to="/restaurants" className="btn-outline">{t('conformite.reportBack')}</Link>
      </div>
    );
  }
  return (
    <form className="card" onSubmit={envoyer}>
      <h2 style={{ marginTop: 0 }}>{t('conformite.reportPageTitle')}</h2>
      {nom && <p className="small">{t('conformite.reportTarget', { name: nom })}</p>}
      <div className="field">
        <label htmlFor={`${id}-cat`}>{t('conformite.reportCategory')}</label>
        <select id={`${id}-cat`} value={category} onChange={(e) => setCategory(e.target.value)} required>
          <option value="">—</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`conformite.reportCat_${c}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-exp`}>{t('conformite.reportExplanation')}</label>
        <textarea id={`${id}-exp`} rows={5} minLength={20} maxLength={4000} required value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-mail`}>{t('conformite.reportEmail')}</label>
        <input id={`${id}-mail`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} />
      </div>
      <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', margin: '4px 0 12px' }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={goodFaith} onChange={(e) => setGoodFaith(e.target.checked)} />
        <span className="small">{t('conformite.reportGoodFaith')}</span>
      </label>
      <button type="submit" className="btn-teal" disabled={envoi || !goodFaith || !category || explanation.trim().length < 20}>{envoi ? '…' : t('conformite.reportSubmit')}</button>
      <p className="small" style={{ marginTop: 12, color: 'var(--ink-soft)' }}>{t('conformite.reportAfter')}</p>
    </form>
  );
}
