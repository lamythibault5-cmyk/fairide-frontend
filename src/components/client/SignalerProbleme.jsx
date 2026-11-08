import { useState } from 'react';
import SousEcran from '../SousEcran';
import { experienceApp } from '../../natif';
import { api, apiUpload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { vibrer } from '../../gestes';
import Icone from '../Icone';
import ReclamationPlat, { EtatReclamation, peutReclamer } from './ReclamationPlat';

// Signaler un problème sur une commande livrée ou récupérée (plan de test USR-10, 2 octobre 2026) : article manquant,
// mauvais article, froid, jamais reçue… Avant, le client n'avait aucun moyen de le dire depuis le site. Le serveur crée
// un ticket support lié à la commande (POST /orders/:id/problem) et envoie un accusé de réception par e-mail.
const TYPES = ['missing_item', 'wrong_item', 'cold', 'never_received', 'other'];
/* REVUE DES FRICTIONS CLIENT (2026-11-08). Une liste native (<select>) au milieu d'une feuille, et un texte obligatoire même
 * quand le type dit tout : « jamais reçue » ou « froide », l'équipe sait quoi regarder avec la commande liée. Maintenant des
 * rangées à toucher (celles des feuilles de l'application, .bv-option), le texte facultatif pour ces deux types (le serveur
 * suit : routes/client.js, TYPES_PROBLEME › messageFacultatif) et la photo en bouton, comme dans ReclamationPlat. */
const MESSAGE_FACULTATIF = ['cold', 'never_received'];

export default function SignalerProbleme({ order, token, toast, signalement, onSignale, reclamation, onReclame }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  // Plat manquant déjà réclamé (ReclamationPlat) : où il en est, à la place du bouton.
  if (reclamation) return <EtatReclamation reclamation={reclamation} orderId={order.id} token={token} toast={toast} onChange={onReclame} />;
  if (signalement) {
    // Une fois l'équipe passée (audit du 19/10, AO-20) : « réponse sous 24 heures » restait affiché pour toujours. Le serveur
    // dit si le ticket est clos (status) ou si l'équipe a répondu (answered, GET /me/problems).
    const clos = ['resolu', 'ferme'].includes(signalement.status);
    const cle = clos ? 'orders.problem_closed' : signalement.answered ? 'orders.problem_answered' : 'orders.problem_sent';
    return <p className="small" style={{ margin: '8px 0 0' }}>{t(cle, { ticket: signalement.ticketNumber, hours: signalement.responseWithinHours || 24 })}</p>;
  }
  if (!ouvert) {
    return <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setOuvert(true)}>{t('orders.problem_button')}</button>;
  }

  async function envoyer(e) {
    e.preventDefault();
    if (!type) { toast(t('orders.problem_kindRequired'), 'erreur'); return; }
    if (!MESSAGE_FACULTATIF.includes(type) && message.trim().length < 5) { toast(t('orders.problem_messageRequired'), 'erreur'); return; }
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
  // Plat manquant ou mauvais plat, sur une commande livrée et payée en ligne depuis moins de 24 heures : le commerce décide
  // (fondateur, 2026-10-31), au lieu d'un ticket pour l'équipe.
  const parLeCommerce = ['missing_item', 'wrong_item'].includes(type) && peutReclamer(order) && !!onReclame;
  const facultatif = MESSAGE_FACULTATIF.includes(type);
  // Application : le formulaire s'ouvre dans une feuille au lieu de s'insérer au milieu de la carte de commande.
  if (experienceApp()) {
    return (
      <>
        <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => setOuvert(true)}>{t('orders.problem_button')}</button>
        <SousEcran titre={t('orders.problem_title')} onFermer={() => setOuvert(false)}>{formulaire(false)}</SousEcran>
      </>
    );
  }
  return formulaire(true);
  function formulaire(enLigne) {
  return (
    <form onSubmit={envoyer} style={enLigne ? { background: 'var(--cream-dim)', borderRadius: 10, padding: 14, marginTop: 8 } : undefined}>
      <p className="small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{t('orders.problem_title')}</p>
      <div className="field">
        <span className="field-intitule" id={`${idBase}-type`}>{t('orders.problem_kindLabel')}</span>
        <div role="radiogroup" aria-labelledby={`${idBase}-type`}>
          {TYPES.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={type === k} className={`bv-option${type === k ? ' on' : ''}`}
              onClick={() => { if (type !== k) vibrer(); setType(k); }}>
              {t(`orders.problem_kind_${k}`)}
            </button>
          ))}
        </div>
      </div>
      {parLeCommerce ? (
        <ReclamationPlat order={order} token={token} toast={toast} onAnnuler={() => setOuvert(false)}
          onReclame={(r) => { setOuvert(false); onReclame(r); }} />
      ) : (<>
      <div className="field">
        <label htmlFor={`${idBase}-message`}>{t(facultatif ? 'orders.problem_messageLabelOptional' : 'orders.problem_messageLabel')}</label>
        <textarea id={`${idBase}-message`} rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('orders.problem_messagePlaceholder')} aria-describedby={facultatif ? undefined : `${idBase}-message-aide`} />
        {/* Le minimum se lit avant l'envoi, pas seulement dans le toast d'erreur (audit du 19/10, AO-19). */}
        {!facultatif && <small id={`${idBase}-message-aide`} className="small">{t('orders.problem_messageHint')}</small>}
      </div>
      {/* Sans `capture` (audit du 19/10, AO-19) : le téléphone propose l'appareil photo OU la galerie ; avec, il ouvrait
          directement l'appareil, et une photo prise plus tôt ne pouvait pas être choisie. */}
      <label className={`reclamation-photo${photo ? ' ok' : ''}`}>
        <Icone nom="photo" taille={20} />
        <span>{photo ? t('orders.reclamationPhotoOk') : t('orders.problem_photoLabel')}</span>
        <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
      </label>
      <p className="small" style={{ margin: '0 0 8px' }}>{t('orders.problem_responseTime', { hours: 24 })}</p>
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('orders.problem_submit')}</button>
        <button type="button" className="btn-ghost" onClick={() => setOuvert(false)}>{t('common.cancel')}</button>
      </div>
      </>)}
    </form>
  );
  }
}
