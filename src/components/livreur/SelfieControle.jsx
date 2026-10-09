import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

/* Selfie de contrôle à la prise de service (CODE-14, DEC-23 ; serveur : controleSelfie.js).
 *
 * Environ une fois sur cinq, au hasard, quand le livreur reprend son service, Fairide lui demande un selfie AVANT de lui
 * proposer des courses : tant qu'il n'est pas pris, la liste des courses reste vide (le serveur la rend vide et refuse la
 * prise d'une course). Le dire clairement ici évite qu'il croie à une panne. Une fois la photo envoyée, les courses
 * reviennent aussitôt ; quelqu'un de l'équipe la compare à l'œil aux photos du dossier, puis l'efface.
 * Le bouton ouvre la caméra frontale (capture="user") : une photo prise sur le moment, pas un fichier de la galerie. */
export default function SelfieControle({ token, onDepose }) {
  const { t } = useLanguage();
  const [requis, setRequis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichier = useRef(null);
  const verifier = useCallback(() => {
    api('/couriers/me/selfie-check', { token }).then((r) => setRequis(!!r?.required)).catch(() => {});
  }, [token]);
  useEffect(() => {
    verifier();
    const id = setInterval(verifier, 60 * 1000);
    window.addEventListener('focus', verifier);
    return () => { clearInterval(id); window.removeEventListener('focus', verifier); };
  }, [verifier]);
  if (!requis) return null;
  async function envoyer(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setEnvoi(true); setErreur('');
    try {
      await apiUpload('/couriers/me/selfie-check', { file: f, token, fieldName: 'file' });
      setRequis(false);
      onDepose?.();
    } catch (err) { setErreur(err.message); } finally { setEnvoi(false); }
  }
  return (
    <div className="card" role="alert" style={{ marginBottom: 12 }}>
      <b>📸 {t('selfieControle.title')}</b>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('selfieControle.text')}</p>
      <input ref={fichier} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={envoyer} />
      <button type="button" className="btn-teal" disabled={envoi} onClick={() => fichier.current?.click()}>{envoi ? '…' : t('selfieControle.button')}</button>
      {erreur && <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>{erreur}</p>}
      <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('selfieControle.privacy')}</p>
    </div>
  );
}
