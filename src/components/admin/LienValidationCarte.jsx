import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { telephoneE164, telephoneLisible, estMobileBelge } from '../../validation';

/* Admin › Commerces › fiche : « Lien C'est bon » (CODE-3, DEC-25). Fabrique un lien de validation de la carte (7 jours,
 * usage unique) et propose les trois canaux du document : WhatsApp, SMS, e-mail — ou de copier le lien. L'équipe ne
 * valide jamais à la place du commerce : elle lui envoie la page, il touche « C'est bon ».
 *
 * À QUEL NUMÉRO (audit du 19/10, admin-67). Le numéro du commerce partait tel que saisi : « 0470 12 34 56 » donnait
 * wa.me/0470123456, que WhatsApp refuse ; une ligne fixe ouvrait une conversation inutile ; le portable du patron ou d'un
 * responsable, affiché juste au-dessus, n'était pas proposé. Les numéros sont mis au format international (+32…), et
 * l'équipe choisit parmi la ligne du commerce, le patron et les responsables ; WhatsApp et SMS ne s'ouvrent que vers un
 * portable. */
export default function LienValidationCarte({ restaurantId, phone, ownerPhone, managers = [], token, toast }) {
  const { t } = useLanguage();
  const [lien, setLien] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const numeros = [];
  const ajouter = (brut, nom) => { const e = telephoneE164(brut); if (e && !numeros.some((n) => n.e164 === e)) numeros.push({ e164: e, nom }); };
  ajouter(phone, t('validerCarte.adminPhoneShop'));
  ajouter(ownerPhone, t('validerCarte.adminPhoneOwner'));
  for (const m of managers || []) ajouter(m?.phone, m?.name || t('validerCarte.adminPhoneManager'));
  const premierMobile = numeros.find((n) => estMobileBelge(n.e164)) || numeros[0] || null;
  const [choisi, setChoisi] = useState(premierMobile?.e164 || '');
  const tel = choisi || premierMobile?.e164 || '';
  async function creer(send) {
    setEnCours(true);
    try {
      const l = await api(`/admin/restaurants/${restaurantId}/menu-validation-link`, { method: 'POST', token, body: send ? { send } : {} });
      setLien(l);
      if (l.emailed) toast(t('validerCarte.adminEmailed'), 'succes');
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }
  const message = lien ? t('validerCarte.adminMessage', { name: lien.restaurantName, url: lien.url }) : '';
  async function copier() {
    try { await navigator.clipboard.writeText(lien.url); toast(t('validerCarte.adminCopied'), 'succes'); } catch { toast(lien.url); }
  }
  const mobile = estMobileBelge(tel) || (tel && !tel.startsWith('+32'));
  return (
    <div className="field">
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" onClick={() => creer(null)} disabled={enCours}>{t('validerCarte.adminCreate')}</button>
        <button type="button" className="btn-outline" onClick={() => creer('email')} disabled={enCours}>{t('validerCarte.adminEmail')}</button>
      </div>
      {lien && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
          {numeros.length > 1 && (
            <select value={tel} onChange={(e) => setChoisi(e.target.value)} aria-label={t('validerCarte.adminPhoneChoice')} style={{ maxWidth: 260 }}>
              {numeros.map((n) => <option key={n.e164} value={n.e164}>{n.nom} · {telephoneLisible(n.e164)}</option>)}
            </select>
          )}
          {tel && mobile && <a className="btn-outline" href={`https://wa.me/${tel.slice(1)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {tel && mobile && <a className="btn-outline" href={`sms:${tel}?&body=${encodeURIComponent(message)}`}>SMS</a>}
          {(!tel || !mobile) && <span className="small" style={{ color: 'var(--ink-soft)' }}>{t('validerCarte.adminNoMobile')}</span>}
          <button type="button" className="btn-ghost" onClick={copier}>{t('validerCarte.adminCopy')}</button>
          <span className="small" style={{ color: 'var(--ink-soft)' }}>{t('validerCarte.adminExpires', { date: new Date(lien.expiresAt).toLocaleDateString() })}</span>
        </div>
      )}
    </div>
  );
}
