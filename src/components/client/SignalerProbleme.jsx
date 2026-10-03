import { useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

// Signaler un problème sur une commande livrée ou récupérée (plan de test USR-10, 2 octobre 2026) : article manquant,
// mauvais article, froid, jamais reçue… Avant, le client n'avait aucun moyen de le dire depuis le site. Le serveur crée
// un ticket support lié à la commande (POST /orders/:id/problem) et envoie un accusé de réception par e-mail.
const TYPES = ['missing_item', 'wrong_item', 'cold', 'never_received', 'other'];

export default function SignalerProbleme({ order, token, toast, signalement, onSignale }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  if (signalement) {
    return <p className="small" style={{ margin: '8px 0 0' }}>{t('orders.problem_sent', { ticket: signalement.ticketNumber, hours: signalement.responseWithinHours || 24 })}</p>;
  }
  if (!ouvert) {
    return <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setOuvert(true)}>{t('orders.problem_button')}</button>;
  }

  async function envoyer(e) {
    e.preventDefault();
    if (!type) { toast(t('orders.problem_kindRequired'), 'erreur'); return; }
    if (message.trim().length < 5) { toast(t('orders.problem_messageRequired'), 'erreur'); return; }
    setEnvoi(true);
    try {
      const r = photo
        ? await apiUpload(`/orders/${order.id}/problem`, { file: photo, fieldName: 'photo', token, fields: { kind: type, message: message.trim() } })
        : await api(`/orders/${order.id}/problem`, { method: 'POST', token, body: { kind: type, message: message.trim() } });
      toast(t('orders.problem_toastSent', { ticket: r.ticketNumber }));
      onSignale({ ...r, orderId: order.id });
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setEnvoi(false);
    }
  }

  const idBase = `probleme-${order.id}`;
  return (
    <form onSubmit={envoyer} style={{ background: 'var(--cream-dim)', borderRadius: 10, padding: 14, marginTop: 8 }}>
      <p className="small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{t('orders.problem_title')}</p>
      <div className="field">
        <label htmlFor={`${idBase}-type`}>{t('orders.problem_kindLabel')}</label>
        <select id={`${idBase}-type`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('orders.problem_kindPlaceholder')}</option>
          {TYPES.map((k) => <option key={k} value={k}>{t(`orders.problem_kind_${k}`)}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-message`}>{t('orders.problem_messageLabel')}</label>
        <textarea id={`${idBase}-message`} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('orders.problem_messagePlaceholder')} />
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-photo`}>{t('orders.problem_photoLabel')}</label>
        <input id={`${idBase}-photo`} type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
      </div>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('orders.problem_responseTime', { hours: 24 })}</p>
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('orders.problem_submit')}</button>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
