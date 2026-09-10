import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { dateCourte } from './resaUtils';

// « Envoyer un message au client » depuis une réservation : trois modèles prêts (confirmation,
// retard, rappel) et un texte libre, e-mail toujours, SMS en plus quand Twilio est configuré et
// qu'un numéro est connu. L'historique des envois (journalisé côté serveur) est affiché en dessous,
// pour que l'équipe de salle sache ce qui a déjà été dit à ce client.

const MODELES = ['confirmation', 'retard', 'rappel', 'libre'];

export default function ReservationMessageDialog({ r, restoId, token, toast, restaurant, onClose, onSent }) {
  const { t } = useLanguage();
  const [modele, setModele] = useState('confirmation');
  const [sujet, setSujet] = useState('');
  const [texte, setTexte] = useState('');
  const [sms, setSms] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [historique, setHistorique] = useState(null);
  const [erreurHisto, setErreurHisto] = useState('');
  const vars = { name: r.reservationName || '', resto: restaurant?.name || '', date: dateCourte(r.startAt), n: r.partySize };

  useEffect(() => {
    setSujet(t(`resa.msgSubject_${modele}`));
    setTexte(modele === 'libre' ? '' : t(`resa.msgBody_${modele}`, vars));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modele]);

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/reservations/${r.id}/messages`, { token })
      .then((d) => { if (!annule) setHistorique(d); })
      .catch((e) => { if (!annule) { setHistorique({ messages: [], smsAvailable: false }); setErreurHisto(e.message); } });
    return () => { annule = true; };
  }, [restoId, r.id, token]);

  const smsPossible = !!historique?.smsAvailable && !!r.clientPhone;
  const sansContact = !r.clientEmail && !r.clientPhone && r.source !== 'client';

  async function envoyer() {
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      const res = await api(`/restaurants/${restoId}/reservations/${r.id}/message`, { method: 'POST', token, body: { template: modele, subject: sujet, body: texte, sms } });
      toast(res.smsSent && res.emailSent ? t('resa.msgSentBoth') : res.smsSent ? t('resa.msgSentSms') : t('resa.msgSentEmail'));
      setHistorique((h) => ({ ...(h || { smsAvailable: false }), messages: [res, ...((h && h.messages) || [])] }));
      onSent?.(res);
      setModele('libre'); setTexte('');
    } catch (e) { toast(e.message); } finally { setEnvoi(false); }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <h3 style={{ margin: '0 0 4px' }}>{t('resa.msgTitle', { name: r.reservationName })}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>
          {r.clientEmail ? `✉️ ${r.clientEmail}` : ''}{r.clientEmail && r.clientPhone ? ' · ' : ''}{r.clientPhone ? `📞 ${r.clientPhone}` : ''}
          {!r.clientEmail && !r.clientPhone && (r.source === 'client' ? t('resa.msgAccountEmail') : '')}
        </p>
        {sansContact && <p className="small" style={{ color: 'var(--red)', margin: '0 0 10px' }}>{t('resa.msgNoContact')}</p>}

        <div className="resa-modeles" role="group" aria-label={t('resa.msgTemplates')}>
          {MODELES.map((m) => (
            <button key={m} type="button" className={modele === m ? 'actif' : ''} onClick={() => setModele(m)}>{t(`resa.msgTpl_${m}`)}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="resa-msg-sujet">{t('resa.msgSubjectLabel')}</label>
          <input id="resa-msg-sujet" value={sujet} maxLength={120} onChange={(e) => setSujet(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="resa-msg-texte">{t('resa.msgBodyLabel')}</label>
          <textarea id="resa-msg-texte" rows={5} maxLength={1500} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('resa.msgPlaceholder')} />
          <div className="small" style={{ textAlign: 'right' }}>{1500 - texte.length}</div>
        </div>
        <label className="row" style={{ gap: 8, cursor: smsPossible ? 'pointer' : 'default', opacity: smsPossible ? 1 : 0.6 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={sms && smsPossible} disabled={!smsPossible} onChange={(e) => setSms(e.target.checked)} />
          <span className="small">{smsPossible ? t('resa.msgAlsoSms') : (historique && !historique.smsAvailable ? t('resa.msgSmsUnavailable') : t('resa.msgSmsNoPhone'))}</span>
        </label>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={envoi}>{t('resa.close')}</button>
          <button type="button" className="btn-gold" onClick={envoyer} disabled={envoi || !texte.trim() || sansContact}>{envoi ? '…' : t('resa.msgSend')}</button>
        </div>

        <div className="resa-messages-liste">
          <b className="small">{t('resa.msgHistory')}</b>
          {historique === null && <p className="small">{t('resa.loading')}</p>}
          {erreurHisto && <p className="small" style={{ color: 'var(--red)' }}>{erreurHisto}</p>}
          {historique && historique.messages.length === 0 && !erreurHisto && <p className="small" style={{ margin: '4px 0 0' }}>{t('resa.msgNone')}</p>}
          {historique && historique.messages.map((m) => (
            <div key={m.id} className="resa-message">
              <span className="small">{dateCourte(m.createdAt)} · {t(`resa.msgTpl_${MODELES.includes(m.template) ? m.template : 'libre'}`)} · {(m.channels || []).map((c) => (c === 'sms' ? 'SMS' : c === 'email' ? t('resa.msgEmail') : t('resa.msgFailed'))).join(' + ')}</span>
              {m.subject && <b>{m.subject}</b>}
              <div>{m.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
