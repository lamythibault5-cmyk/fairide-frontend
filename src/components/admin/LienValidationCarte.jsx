import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

/* Admin › Commerces › fiche : « Lien C'est bon » (CODE-3, DEC-25). Fabrique un lien de validation de la carte (7 jours,
 * usage unique) et propose les trois canaux du document : WhatsApp, SMS, e-mail — ou de copier le lien. L'équipe ne
 * valide jamais à la place du commerce : elle lui envoie la page, il touche « C'est bon ». */
export default function LienValidationCarte({ restaurantId, phone, token, toast }) {
  const { t } = useLanguage();
  const [lien, setLien] = useState(null);
  const [enCours, setEnCours] = useState(false);
  async function creer(send) {
    setEnCours(true);
    try {
      const l = await api(`/admin/restaurants/${restaurantId}/menu-validation-link`, { method: 'POST', token, body: send ? { send } : {} });
      setLien(l);
      if (l.emailed) toast(t('validerCarte.adminEmailed'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }
  const message = lien ? t('validerCarte.adminMessage', { name: lien.restaurantName, url: lien.url }) : '';
  const tel = String(phone || '').replace(/[^\d+]/g, '');
  async function copier() {
    try { await navigator.clipboard.writeText(lien.url); toast(t('validerCarte.adminCopied')); } catch { toast(lien.url); }
  }
  return (
    <div className="field">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" onClick={() => creer(null)} disabled={enCours}>{t('validerCarte.adminCreate')}</button>
        <button type="button" className="btn-outline" onClick={() => creer('email')} disabled={enCours}>{t('validerCarte.adminEmail')}</button>
      </div>
      {lien && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <a className="btn-outline" href={`https://wa.me/${tel.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="btn-outline" href={`sms:${tel}?&body=${encodeURIComponent(message)}`}>SMS</a>
          <button type="button" className="btn-ghost" onClick={copier}>{t('validerCarte.adminCopy')}</button>
          <span className="small" style={{ color: 'var(--ink-soft)' }}>{t('validerCarte.adminExpires', { date: new Date(lien.expiresAt).toLocaleDateString() })}</span>
        </div>
      )}
    </div>
  );
}
