import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import Icone from '../Icone';

/* Selfie de contrôle à la prise de service (CODE-14, DEC-23 ; serveur : controleSelfie.js).
 *
 * Environ une fois sur cinq, au hasard, quand le livreur reprend son service, Fairide lui demande un selfie.
 * UN DÉLAI POUR LE PRENDRE (fondateur, 2026-10-21) : 60 minutes, pendant lesquelles il voit et prend les courses comme
 * d'habitude ; la carte lui dit « prends-le avant HH:MM » (heure limite donnée par le serveur, dueAt). Après cette heure,
 * tant qu'il n'est pas pris, les nouvelles courses attendent (le serveur rend la liste vide et refuse la prise d'une
 * course ; `blocking`) : la carte le dit, et le bandeau du tableau de bord aussi (onEtat), pour qu'il ne croie pas à une
 * panne ni ne lise « Tu es disponible » (audit du 19/10, LIVE-25). Une fois la photo envoyée, tout reprend aussitôt ;
 * quelqu'un de l'équipe la compare à l'œil aux photos du dossier, puis l'efface.
 * Relu toutes les 15 secondes, au rythme des offres (audit du 19/10, courier-16 : une minute sans explication avant).
 * Le bouton ouvre la caméra frontale (capture="user") : une photo prise sur le moment, pas un fichier de la galerie. */
export default function SelfieControle({ token, onDepose, onEtat }) {
  const { t } = useLanguage();
  const [controle, setControle] = useState(null); // null, ou { dueAt, blocking }
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichier = useRef(null);
  const onEtatRef = useRef(onEtat);
  useEffect(() => { onEtatRef.current = onEtat; }, [onEtat]);
  const poser = useCallback((c) => { setControle(c); onEtatRef.current?.(c); }, []);
  const verifier = useCallback(() => {
    api('/couriers/me/selfie-check', { token })
      .then((r) => poser(r?.required ? { dueAt: r.dueAt || null, blocking: !!r.blocking } : null))
      .catch(() => {});
  }, [token, poser]);
  useEffect(() => {
    verifier();
    const id = setInterval(verifier, 15 * 1000);
    window.addEventListener('focus', verifier);
    return () => { clearInterval(id); window.removeEventListener('focus', verifier); onEtatRef.current?.(null); };
  }, [verifier]);
  if (!controle) return null;
  async function envoyer(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setEnvoi(true); setErreur('');
    try {
      await apiUpload('/couriers/me/selfie-check', { file: f, token, fieldName: 'file' });
      poser(null);
      onDepose?.();
    } catch (err) { setErreur(err.message); } finally { setEnvoi(false); }
  }
  const heure = controle.dueAt ? new Date(controle.dueAt).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : null;
  const delai = !controle.blocking && heure;
  return (
    <div className="card" role="alert" style={{ marginBottom: 12 }}>
      <b><Icone nom="apercu" taille={16} className="icone-texte" />{' '}{delai ? t('selfieControle.titleDelai', { time: heure }) : t('selfieControle.title')}</b>
      <p className="small" style={{ margin: '6px 0 10px' }}>{delai ? t('selfieControle.textDelai', { time: heure }) : t('selfieControle.text')}</p>
      <input ref={fichier} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={envoyer} />
      <button type="button" className="btn-teal" disabled={envoi} onClick={() => fichier.current?.click()}>{envoi ? '…' : t('selfieControle.button')}</button>
      {erreur && <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>{erreur}</p>}
      <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('selfieControle.privacy')}</p>
    </div>
  );
}
