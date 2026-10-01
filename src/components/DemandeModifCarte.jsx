import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { vibrer } from '../gestes';

// « UNE MODIFICATION ? DIS-LE-NOUS » (fondateur, 2026-10-01). Modifier sa carte soi-même reste possible plus bas,
// mais un restaurateur en plein service n'a pas le temps de chercher le bon plat et le bon champ : il écrit ce qu'il
// veut (« le menu midi passe à 12,50 € », « plus de tiramisu »), joint une photo de l'ardoise s'il veut, et l'équipe
// Fairide le fait. Chaque demande devient une tâche « Modifier la carte » ; son statut s'affiche ici.
const EXEMPLES = ['modifExample1', 'modifExample2', 'modifExample3'];

export default function DemandeModifCarte({ restoId }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [demandes, setDemandes] = useState([]);
  const [message, setMessage] = useState('');
  const [fichiers, setFichiers] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const champFichier = useRef(null);

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/menu/change-requests`, { token }).then((r) => { if (!annule) setDemandes(r.requests || []); }).catch(() => {});
    return () => { annule = true; };
  }, [restoId, token]);

  async function envoyer() {
    if (message.trim().length < 3 && !fichiers.length) { toast(t('menuPage.modifEmpty'), 'erreur'); return; }
    setEnCours(true);
    try {
      // apiUpload et non api() : api() envoie toujours du JSON, et un FormData y devenait « {} ».
      const r = await apiUpload(`/restaurants/${restoId}/menu/change-requests`, { files: fichiers, fieldName: 'files', token, fields: { message: message.trim() } });
      setDemandes((l) => [r.request, ...l]);
      setMessage(''); setFichiers([]);
      if (champFichier.current) champFichier.current.value = '';
      vibrer(14);
      toast(t('menuPage.modifSent'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  const quand = (d) => new Date(d).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="card modif-carte" id="menu-demande-modif">
      <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>✏️ {t('menuPage.modifTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.modifIntro')}</p>
      <label htmlFor="modif-carte-texte" className="sr-only">{t('menuPage.modifTitle')}</label>
      <textarea id="modif-carte-texte" rows={3} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)}
        placeholder={t('menuPage.modifPlaceholder')} style={{ width: '100%', resize: 'vertical' }} />
      {/* Exemples en un toucher : ils montrent le ton attendu et remplissent le champ, à compléter. */}
      {!message && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0 0' }}>
          {EXEMPLES.map((k) => (
            <button key={k} type="button" className="chip" style={{ fontSize: 12 }} onClick={() => setMessage(t(`menuPage.${k}`))}>{t(`menuPage.${k}`)}</button>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <label className="btn-ghost" style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          📷 {fichiers.length ? t('menuPage.modifFiles', { n: fichiers.length }) : t('menuPage.modifAttach')}
          <input ref={champFichier} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => setFichiers([...(e.target.files || [])].slice(0, 5))} />
        </label>
        <button type="button" className="btn-teal" style={{ flex: '1 1 160px', minHeight: 44 }} disabled={enCours} onClick={envoyer}>
          {enCours ? '…' : t('menuPage.modifSend')}
        </button>
      </div>
      {demandes.length > 0 && (
        <ul className="modif-carte-liste">
          {demandes.slice(0, 5).map((d) => (
            <li key={d.id}>
              <span className={`pill modif-statut modif-statut--${d.status}`}>{t(`menuPage.modifStatus_${d.status}`)}</span>
              <span className="modif-carte-texte">{d.message || t('menuPage.modifPhotoOnly')}</span>
              <span className="small modif-carte-quand">{quand(d.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
